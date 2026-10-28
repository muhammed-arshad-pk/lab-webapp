"""
802.11 Beacon Frame Capture & Analyser
======================================
Captures beacon frames (live, or from a .pcap file) and reports for each one:

  a. Which access point sent the beacon     -> SSID + BSSID (addr3)
  b. Which channel it is using              -> DS Parameter Set element (ID 3)
  c. What security mechanism is advertised  -> RSN (ID 48) / WPA vendor IE /
                                               Privacy capability bit
  d. What supported data rates are advertised -> Supported Rates (ID 1) +
                                               Extended Supported Rates (ID 50)
  e. What is the beacon interval            -> fixed field, in Time Units (TU)
                                               1 TU = 1024 microseconds

Usage:
  python beacon_analyzer.py --pcap sample_beacons.pcap        # offline analysis
  python beacon_analyzer.py --iface wlan0mon --count 50       # live capture

Live capture needs a WiFi adapter in MONITOR MODE:
  Linux  : sudo airmon-ng start wlan0   ->  --iface wlan0mon   (run with sudo)
  Windows: Npcap with "Support raw 802.11 traffic" + an adapter that supports
           monitor mode (most built-in laptop cards do not).
Requires: pip install scapy
"""

import argparse
import struct
import sys

from scapy.all import Dot11, Dot11Beacon, Dot11Elt, RadioTap, rdpcap, sniff

# ---------------------------------------------------------------------------
# Lookup tables (IEEE 802.11 cipher / AKM suite selectors)
# ---------------------------------------------------------------------------
CIPHERS = {0: "None", 1: "WEP-40", 2: "TKIP", 4: "CCMP-128 (AES)",
           5: "WEP-104", 8: "GCMP-128", 9: "GCMP-256", 10: "CCMP-256"}
AKMS = {1: "802.1X (Enterprise)", 2: "PSK", 3: "FT-802.1X", 4: "FT-PSK",
        5: "802.1X-SHA256", 6: "PSK-SHA256", 8: "SAE", 9: "FT-SAE",
        12: "802.1X-Suite-B-192", 18: "OWE"}

ELT_SSID, ELT_RATES, ELT_DS, ELT_RSN, ELT_EXT_RATES, ELT_VENDOR = 0, 1, 3, 48, 50, 221


# ---------------------------------------------------------------------------
# Information-element parsers
# ---------------------------------------------------------------------------
def iter_elements(pkt):
    """Yield (id, info-bytes) for every tagged parameter in the frame."""
    elt = pkt.getlayer(Dot11Elt)
    while isinstance(elt, Dot11Elt):
        yield elt.ID, bytes(elt.info)
        elt = elt.payload


def parse_suites(data):
    """
    Parse the common body of RSN / WPA elements:
    version(2) | group cipher(4) | pairwise count(2) | pairwise(4*n)
               | AKM count(2)    | AKM(4*n)
    Returns (group_cipher, [pairwise], [akm]).
    """
    try:
        pos = 2                                         # skip version
        group = CIPHERS.get(data[pos + 3], f"type {data[pos + 3]}")
        pos += 4
        (n,) = struct.unpack_from("<H", data, pos); pos += 2
        pairwise = [CIPHERS.get(data[pos + 4 * i + 3], "?") for i in range(n)]
        pos += 4 * n
        (n,) = struct.unpack_from("<H", data, pos); pos += 2
        akm = [AKMS.get(data[pos + 4 * i + 3], "?") for i in range(n)]
        return group, pairwise, akm
    except (IndexError, struct.error):
        return "?", [], []


def security_of(pkt, elements):
    """Work out the advertised security mechanism."""
    rsn = next((info for eid, info in elements if eid == ELT_RSN), None)
    wpa = next((info[4:] for eid, info in elements
                if eid == ELT_VENDOR and info[:4] == b"\x00\x50\xf2\x01"), None)
    privacy = bool(int(pkt[Dot11Beacon].cap) & 0x0010)   # Privacy bit

    if rsn is not None:
        group, pairwise, akm = parse_suites(rsn)
        if "SAE" in akm and "PSK" in akm:
            proto = "WPA2/WPA3-Personal (transition)"
        elif "SAE" in akm or "FT-SAE" in akm:
            proto = "WPA3-Personal"
        elif "OWE" in akm:
            proto = "OWE (Enhanced Open)"
        elif any("802.1X" in a for a in akm):
            proto = "WPA2-Enterprise"
        else:
            proto = "WPA2-Personal"
        if wpa is not None:
            proto = "WPA/" + proto
    elif wpa is not None:
        group, pairwise, akm = parse_suites(wpa)
        proto = "WPA-Personal" if "PSK" in akm else "WPA-Enterprise"
    elif privacy:
        return {"protocol": "WEP", "cipher": "WEP", "akm": "Open/Shared Key"}
    else:
        return {"protocol": "Open (no encryption)", "cipher": "-", "akm": "-"}

    return {"protocol": proto,
            "cipher": ", ".join(pairwise) or group,
            "akm": ", ".join(akm)}


def rates_of(elements):
    """Rates are in 500 kbps units; the top bit marks a basic (mandatory) rate."""
    rates = []
    for eid, info in elements:
        if eid in (ELT_RATES, ELT_EXT_RATES):
            for b in info:
                mbps = (b & 0x7F) / 2
                label = f"{mbps:g}"
                rates.append(label + "*" if b & 0x80 else label)
    return rates


def channel_of(pkt, elements):
    ds = next((info for eid, info in elements if eid == ELT_DS and info), None)
    if ds:
        return ds[0]
    # Fall back to the radiotap frequency if there is no DS element (5 GHz APs
    # sometimes omit it)
    if pkt.haslayer(RadioTap) and getattr(pkt[RadioTap], "ChannelFrequency", None):
        f = pkt[RadioTap].ChannelFrequency
        return 14 if f == 2484 else (f - 2407) // 5 if f < 3000 else (f - 5000) // 5
    return None


def signal_of(pkt):
    if pkt.haslayer(RadioTap):
        return getattr(pkt[RadioTap], "dBm_AntSignal", None)
    return None


# ---------------------------------------------------------------------------
# Beacon analysis
# ---------------------------------------------------------------------------
def analyse_beacon(pkt):
    elements = list(iter_elements(pkt))
    ssid = next((info for eid, info in elements if eid == ELT_SSID), b"")
    ssid = ssid.decode("utf-8", errors="replace") if ssid.strip(b"\x00") else "<hidden>"
    interval_tu = pkt[Dot11Beacon].beacon_interval
    return {
        "ssid": ssid,
        "bssid": pkt[Dot11].addr3,
        "channel": channel_of(pkt, elements),
        "security": security_of(pkt, elements),
        "rates": rates_of(elements),
        "interval_tu": interval_tu,
        "interval_ms": interval_tu * 1.024,
        "signal": signal_of(pkt),
    }


def print_beacon(n, b):
    sec = b["security"]
    print(f"\n----- Beacon #{n} -----")
    print(f"a. Access Point    : SSID = {b['ssid']!r}, BSSID = {b['bssid']}")
    print(f"b. Channel         : {b['channel']}")
    print(f"c. Security        : {sec['protocol']}")
    print(f"                     cipher = {sec['cipher']}, auth (AKM) = {sec['akm']}")
    print(f"d. Supported rates : {', '.join(b['rates'])} Mbps   (* = basic rate)")
    print(f"e. Beacon interval : {b['interval_tu']} TU = {b['interval_ms']:.1f} ms")
    if b["signal"] is not None:
        print(f"   Signal          : {b['signal']} dBm")


def print_summary(aps):
    if not aps:
        print("\nNo beacon frames found.")
        return
    print(f"\n\n=== Summary: {len(aps)} access point(s) ===")
    print(f"{'SSID':<18} {'BSSID':<18} {'CH':>3} {'Security':<32} "
          f"{'Interval':>9} {'Beacons':>7}  Rates (Mbps)")
    print("-" * 120)
    for b in sorted(aps.values(), key=lambda x: (x["channel"] or 0, x["ssid"])):
        print(f"{b['ssid'][:18]:<18} {b['bssid']:<18} {str(b['channel']):>3} "
              f"{b['security']['protocol'][:32]:<32} {b['interval_ms']:>6.1f} ms "
              f"{b['count']:>7}  {' '.join(r.rstrip('*') for r in b['rates'])}")


def main():
    ap = argparse.ArgumentParser(description="802.11 beacon frame analyser")
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--pcap", help="analyse beacons from a capture file")
    src.add_argument("--iface", help="monitor-mode interface for live capture")
    ap.add_argument("--count", type=int, default=0,
                    help="live: stop after N beacons (default: until Ctrl+C)")
    ap.add_argument("--timeout", type=int, default=None, help="live: stop after N s")
    ap.add_argument("--all", action="store_true",
                    help="print every beacon (default: only the first per AP)")
    args = ap.parse_args()

    aps = {}

    def handle(pkt):
        if not pkt.haslayer(Dot11Beacon):
            return
        b = analyse_beacon(pkt)
        first = b["bssid"] not in aps
        if first:
            b["count"] = 0
            aps[b["bssid"]] = b
        aps[b["bssid"]]["count"] += 1
        if first or args.all:
            print_beacon(sum(a["count"] for a in aps.values()), b)

    if args.pcap:
        print(f"Reading beacon frames from {args.pcap} ...")
        for pkt in rdpcap(args.pcap):
            handle(pkt)
    else:
        print(f"Capturing beacon frames on {args.iface} (Ctrl+C to stop) ...")
        try:
            sniff(iface=args.iface, prn=handle, store=False, count=0,
                  timeout=args.timeout, monitor=True,
                  stop_filter=lambda _: args.count and
                  sum(a["count"] for a in aps.values()) >= args.count)
        except (OSError, PermissionError, ValueError) as e:
            sys.exit(f"Live capture failed: {e}\n"
                     "Check the adapter is in monitor mode and run as root/admin.")

    print_summary(aps)


if __name__ == "__main__":
    main()
