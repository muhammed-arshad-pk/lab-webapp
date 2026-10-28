"""
Builds sample_beacons.pcap: realistic 802.11 beacon frames from several
access points using different channels, security modes and data rates.
Use it to test beacon_analyzer.py on a machine that can't do monitor mode.

  python create_sample_pcap.py
  python beacon_analyzer.py --pcap sample_beacons.pcap
"""

import struct

from scapy.all import Dot11, Dot11Beacon, Dot11Elt, RadioTap, wrpcap

OUI = b"\x00\x0f\xac"                       # IEEE 802.11 suite OUI
WPA_OUI = b"\x00\x50\xf2"                   # Microsoft OUI used by WPA1


def suites(group, pairwise, akms, oui=OUI):
    body = struct.pack("<H", 1) + oui + bytes([group])
    body += struct.pack("<H", len(pairwise)) + b"".join(oui + bytes([c]) for c in pairwise)
    body += struct.pack("<H", len(akms)) + b"".join(oui + bytes([a]) for a in akms)
    return body


def rsn(group, pairwise, akms):
    return Dot11Elt(ID=48, info=suites(group, pairwise, akms) + b"\x00\x00")


def wpa1(group, pairwise, akms):
    return Dot11Elt(ID=221, info=WPA_OUI + b"\x01" + suites(group, pairwise, akms, WPA_OUI))


B_RATES = bytes([0x82, 0x84, 0x8B, 0x96])                 # 1*,2*,5.5*,11*
G_RATES = bytes([0x0C, 0x12, 0x18, 0x24])                 # 6,9,12,18
G_EXT = bytes([0x30, 0x48, 0x60, 0x6C])                   # 24,36,48,54
A_RATES = bytes([0x8C, 0x12, 0x98, 0x24, 0xB0, 0x48, 0x60, 0x6C])  # 5 GHz OFDM

# (ssid, bssid, channel, interval TU, privacy, rates, ext rates, security IEs, dBm)
APS = [
    ("CampusOpen",  "00:11:22:33:44:01", 1,   100, False, B_RATES + G_RATES, G_EXT, [], -48),
    ("OldLab-WEP",  "00:11:22:33:44:02", 6,   100, True,  B_RATES, b"", [], -71),
    ("Legacy-WPA",  "00:11:22:33:44:03", 6,   200, True,  B_RATES + G_RATES, G_EXT,
     [wpa1(2, [2], [2])], -66),
    ("Home-WPA2",   "00:11:22:33:44:04", 11,  100, True,  B_RATES + G_RATES, G_EXT,
     [rsn(4, [4], [2])], -55),
    ("Office-Ent",  "00:11:22:33:44:05", 36,  100, True,  A_RATES, b"",
     [rsn(4, [4], [1])], -62),
    ("Secure-WPA3", "00:11:22:33:44:06", 149, 102, True,  A_RATES, b"",
     [rsn(4, [4], [8])], -58),
    ("Mixed-Mode",  "00:11:22:33:44:07", 11,  100, True,  B_RATES + G_RATES, G_EXT,
     [rsn(2, [4, 2], [2]), wpa1(2, [2, 4], [2])], -74),
]


def beacon(ssid, bssid, ch, interval, privacy, rates, ext, sec, dbm, ts):
    cap = 0x0401 | (0x0010 if privacy else 0)             # ESS + short slot (+Privacy)
    freq = 2407 + 5 * ch if ch <= 13 else 5000 + 5 * ch
    pkt = (RadioTap(present="Flags+Channel+dBm_AntSignal", Flags=0,
                    ChannelFrequency=freq,
                    ChannelFlags=0x00A0 if ch <= 14 else 0x0140,
                    dBm_AntSignal=dbm)
           / Dot11(type=0, subtype=8, addr1="ff:ff:ff:ff:ff:ff", addr2=bssid, addr3=bssid)
           / Dot11Beacon(timestamp=ts, beacon_interval=interval, cap=cap)
           / Dot11Elt(ID=0, info=ssid.encode())
           / Dot11Elt(ID=1, info=rates)
           / Dot11Elt(ID=3, info=bytes([ch])))
    if ext:
        pkt /= Dot11Elt(ID=50, info=ext)
    for ie in sec:
        pkt /= ie
    return pkt


def main():
    frames = []
    for rnd in range(3):                                  # 3 beacons per AP
        for i, ap in enumerate(APS):
            frames.append(beacon(*ap, ts=(rnd * 102400) + i * 1000))
    wrpcap("sample_beacons.pcap", frames)
    print(f"Wrote {len(frames)} beacon frames from {len(APS)} APs to sample_beacons.pcap")


if __name__ == "__main__":
    main()
