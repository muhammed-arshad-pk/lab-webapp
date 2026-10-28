"""
WiFi Scanner & RSSI-based Signal Strength Analyser
===================================================

1) Scans and lists nearby WiFi networks (SSID, BSSID, channel, band, security).
2) Analyses signal strength using RSSI (dBm): quality rating, estimated distance,
   and live monitoring with min/max/avg/std-dev statistics.

Works with no third-party packages:
  - Windows : uses `netsh wlan show networks mode=bssid`
  - Linux   : uses `nmcli`
  - macOS   : uses `system_profiler SPAirPortDataType`

Usage:
  python wifi_analyzer.py                 # scan once and analyse
  python wifi_analyzer.py --monitor 10    # 10 scan rounds, per-network RSSI stats
  python wifi_analyzer.py --monitor 10 --ssid "MyWiFi"
"""

import argparse
import math
import platform
import re
import statistics
import subprocess
import time
from dataclasses import dataclass, field


# ----------------------------------------------------------------------------
# Data model
# ----------------------------------------------------------------------------
@dataclass
class WifiNetwork:
    ssid: str
    bssid: str
    rssi: int                 # dBm
    channel: int = 0
    band: str = ""
    security: str = ""
    samples: list = field(default_factory=list)


# ----------------------------------------------------------------------------
# RSSI helpers
# ----------------------------------------------------------------------------
def percent_to_dbm(percent: int) -> int:
    """Windows reports signal quality 0-100 %. Map linearly to -100..-50 dBm."""
    return int(percent / 2 - 100)


def dbm_to_percent(dbm: int) -> int:
    return max(0, min(100, 2 * (dbm + 100)))


def rssi_quality(dbm: int) -> str:
    if dbm >= -50:
        return "Excellent"
    if dbm >= -60:
        return "Good"
    if dbm >= -70:
        return "Fair"
    if dbm >= -80:
        return "Weak"
    return "Very Weak"


def channel_to_band(channel: int) -> str:
    if 1 <= channel <= 14:
        return "2.4 GHz"
    if 32 <= channel <= 177:
        return "5 GHz"
    return "6 GHz" if channel else "?"


def channel_to_freq_mhz(channel: int) -> int:
    if channel == 14:
        return 2484
    if 1 <= channel <= 13:
        return 2407 + 5 * channel
    if 32 <= channel <= 177:
        return 5000 + 5 * channel
    return 2437


def estimate_distance(dbm: int, channel: int) -> float:
    """
    Free-Space Path Loss estimate:
        FSPL(dB) = 20*log10(d_m) + 20*log10(f_MHz) - 27.55
    Assumes a typical AP transmit power of ~20 dBm. Indoors (walls, reflections)
    this is only a rough indication.
    """
    tx_power = 20
    freq = channel_to_freq_mhz(channel)
    path_loss = tx_power - dbm
    exp = (path_loss + 27.55 - 20 * math.log10(freq)) / 20
    return round(10 ** exp, 1)


def signal_bar(dbm: int, width: int = 20) -> str:
    filled = round(dbm_to_percent(dbm) / 100 * width)
    return "#" * filled + "-" * (width - filled)


# ----------------------------------------------------------------------------
# Platform scanners
# ----------------------------------------------------------------------------
def _run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True,
                          encoding="utf-8", errors="ignore").stdout


def scan_windows():
    out = _run(["netsh", "wlan", "show", "networks", "mode=bssid"])
    networks, ssid, security, cur = [], "", "", None
    for raw in out.splitlines():
        line = raw.strip()
        if m := re.match(r"^SSID \d+\s*:\s*(.*)$", line):
            ssid = m.group(1) or "<hidden>"
        elif m := re.match(r"^Authentication\s*:\s*(.*)$", line):
            security = m.group(1)
        elif m := re.match(r"^BSSID \d+\s*:\s*(.*)$", line):
            cur = WifiNetwork(ssid, m.group(1).lower(), -100, security=security)
            networks.append(cur)
        elif cur and (m := re.match(r"^Signal\s*:\s*(\d+)%", line)):
            cur.rssi = percent_to_dbm(int(m.group(1)))
        elif cur and (m := re.match(r"^Channel\s*:\s*(\d+)", line)):
            cur.channel = int(m.group(1))
            cur.band = channel_to_band(cur.channel)
    if not networks and "location" in out.lower():
        print("[!] Windows blocked the scan: enable Location services "
              "(Settings > Privacy & security > Location).")
    return networks


def scan_linux():
    _run(["nmcli", "dev", "wifi", "rescan"])
    out = _run(["nmcli", "-t", "-f", "SSID,BSSID,CHAN,SIGNAL,SECURITY",
                "dev", "wifi", "list"])
    networks = []
    for line in out.splitlines():
        # nmcli escapes ':' inside fields as '\:'
        parts = [p.replace("\\:", ":") for p in re.split(r"(?<!\\):", line)]
        if len(parts) < 5:
            continue
        ssid, bssid, chan, signal, sec = parts[:5]
        ch = int(chan) if chan.isdigit() else 0
        networks.append(WifiNetwork(ssid or "<hidden>", bssid.lower(),
                                    percent_to_dbm(int(signal or 0)),
                                    ch, channel_to_band(ch), sec or "Open"))
    return networks


def scan_macos():
    out = _run(["system_profiler", "SPAirPortDataType"])
    networks, cur = [], None
    for raw in out.splitlines():
        line = raw.strip()
        if line.endswith(":") and raw.startswith(" " * 12) and not raw.startswith(" " * 14):
            cur = WifiNetwork(line[:-1], "n/a", -100)
            networks.append(cur)
        elif cur and (m := re.match(r"Channel:\s*(\d+)", line)):
            cur.channel = int(m.group(1))
            cur.band = channel_to_band(cur.channel)
        elif cur and (m := re.match(r"Security:\s*(.*)", line)):
            cur.security = m.group(1)
        elif cur and (m := re.match(r"Signal / Noise:\s*(-?\d+)", line)):
            cur.rssi = int(m.group(1))
    return [n for n in networks if n.rssi > -100]


def scan_networks():
    system = platform.system()
    if system == "Windows":
        return scan_windows()
    if system == "Linux":
        return scan_linux()
    if system == "Darwin":
        return scan_macos()
    raise OSError(f"Unsupported OS: {system}")


# ----------------------------------------------------------------------------
# Part 1: list networks
# ----------------------------------------------------------------------------
def list_networks(networks):
    networks = sorted(networks, key=lambda n: n.rssi, reverse=True)
    print(f"\n=== Nearby WiFi Networks ({len(networks)} found) ===")
    print(f"{'#':>2}  {'SSID':<28} {'BSSID':<18} {'CH':>3} {'Band':<8} {'Security'}")
    print("-" * 82)
    for i, n in enumerate(networks, 1):
        print(f"{i:>2}  {n.ssid[:28]:<28} {n.bssid:<18} {n.channel:>3} "
              f"{n.band:<8} {n.security}")


# ----------------------------------------------------------------------------
# Part 2: RSSI analysis
# ----------------------------------------------------------------------------
def analyse_rssi(networks):
    networks = sorted(networks, key=lambda n: n.rssi, reverse=True)
    print("\n=== RSSI Signal Strength Analysis ===")
    print(f"{'SSID':<28} {'RSSI':>8} {'Signal':<22} {'Quality':<10} {'~Dist'}")
    print("-" * 82)
    for n in networks:
        print(f"{n.ssid[:28]:<28} {n.rssi:>4} dBm [{signal_bar(n.rssi)}] "
              f"{rssi_quality(n.rssi):<10} {estimate_distance(n.rssi, n.channel)} m")

    if not networks:
        return
    best = networks[0]
    print(f"\nStrongest : {best.ssid} ({best.rssi} dBm, {rssi_quality(best.rssi)})")

    # Channel congestion (2.4 GHz channels overlap within +/-4)
    usage = {}
    for n in networks:
        usage[n.channel] = usage.get(n.channel, 0) + 1
    print("Channel usage:", ", ".join(f"ch{c}={k}" for c, k in sorted(usage.items())))
    load = {c: sum(1 for n in networks if 1 <= n.channel <= 14 and abs(n.channel - c) <= 4)
            for c in (1, 6, 11)}
    print(f"Least congested 2.4 GHz channel (1/6/11): {min(load, key=load.get)}")


def monitor(rounds, interval, ssid_filter=None):
    tracked = {}
    print(f"\nMonitoring RSSI for {rounds} rounds every {interval}s ...")
    for r in range(1, rounds + 1):
        for n in scan_networks():
            if ssid_filter and n.ssid != ssid_filter:
                continue
            tracked.setdefault(n.bssid, n).samples.append(n.rssi)
        print(f"  round {r}/{rounds}: {len(tracked)} network(s) tracked")
        if r < rounds:
            time.sleep(interval)

    print("\n=== RSSI Statistics ===")
    print(f"{'SSID':<24} {'BSSID':<18} {'Min':>5} {'Max':>5} {'Avg':>7} "
          f"{'StdDev':>7}  {'Quality':<10} Stability")
    print("-" * 96)
    for n in sorted(tracked.values(), key=lambda x: statistics.mean(x.samples), reverse=True):
        s = n.samples
        avg = statistics.mean(s)
        sd = statistics.pstdev(s)
        stability = "Stable" if sd < 3 else "Moderate" if sd < 6 else "Fluctuating"
        print(f"{n.ssid[:24]:<24} {n.bssid:<18} {min(s):>5} {max(s):>5} {avg:>7.1f} "
              f"{sd:>7.2f}  {rssi_quality(round(avg)):<10} {stability}")


# ----------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="WiFi scanner and RSSI analyser")
    ap.add_argument("--monitor", type=int, metavar="N",
                    help="take N scans and report RSSI statistics")
    ap.add_argument("--interval", type=float, default=3, help="seconds between scans")
    ap.add_argument("--ssid", help="only monitor this SSID")
    args = ap.parse_args()

    networks = scan_networks()
    if not networks:
        print("No networks found. Is WiFi enabled?")
        return
    list_networks(networks)
    analyse_rssi(networks)

    if args.monitor:
        monitor(args.monitor, args.interval, args.ssid)


if __name__ == "__main__":
    main()
