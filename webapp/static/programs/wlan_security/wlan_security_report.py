"""
WLAN Security Configuration Report
==================================
Reports, for the connected network and every nearby network:

  a. SSID
  b. Security Type           (Open / WEP / WPA / WPA2 / WPA3 / OWE)
  c. Authentication Method   (Open System, Shared Key, PSK, SAE, 802.1X/EAP)
  d. Encryption Method       (None, WEP, TKIP, CCMP-AES, GCMP-AES)
  e. Channel                 (+ band)

Data source (Windows, no extra packages):
  netsh wlan show interfaces          -> the network you are connected to
  netsh wlan show networks mode=bssid -> all networks in range

Usage:
  python wlan_security_report.py
"""

import platform
import re
import subprocess
import sys

# Windows "Authentication" value -> (b. security type, c. authentication method)
AUTH_MAP = {
    "open":            ("Open",  "Open System (no authentication)"),
    "shared":          ("WEP",   "Shared Key"),
    "wpa-personal":    ("WPA",   "PSK (Pre-Shared Key / password)"),
    "wpa-enterprise":  ("WPA",   "802.1X / EAP (RADIUS server)"),
    "wpa2-personal":   ("WPA2",  "PSK (Pre-Shared Key / password)"),
    "wpa2-enterprise": ("WPA2",  "802.1X / EAP (RADIUS server)"),
    "wpa3-personal":   ("WPA3",  "SAE (Simultaneous Authentication of Equals)"),
    "wpa3-enterprise": ("WPA3",  "802.1X / EAP (RADIUS server)"),
    "wpa3-enterprise 192 bits": ("WPA3", "802.1X / EAP Suite-B 192-bit"),
    "owe":             ("Enhanced Open (OWE)", "OWE (Opportunistic Wireless Encryption)"),
}

# Windows "Encryption"/"Cipher" value -> (d. encryption method, strength)
CIPHER_MAP = {
    "none": ("None (traffic unencrypted)", "Insecure"),
    "wep":  ("WEP (RC4)",                  "Insecure"),
    "tkip": ("TKIP (RC4-based)",           "Weak / deprecated"),
    "ccmp": ("CCMP (AES-128)",             "Strong"),
    "gcmp": ("GCMP (AES)",                 "Strong"),
    "gcmp-256": ("GCMP-256 (AES-256)",     "Strong"),
}


def netsh(*args):
    return subprocess.run(["netsh", "wlan", *args], capture_output=True, text=True,
                          encoding="utf-8", errors="ignore").stdout


def field(line):
    """Split 'Key   : value' into (key_lower, value)."""
    key, _, value = line.partition(":")
    return key.strip().lower(), value.strip()


def classify(auth, cipher):
    """Map the raw Windows values to the report fields b, c, d."""
    sec_type, auth_method = AUTH_MAP.get(auth.lower(), (auth, auth))
    if sec_type == "Open" and cipher.lower() == "wep":
        sec_type, auth_method = "WEP", "Open System + WEP key"
    enc, strength = CIPHER_MAP.get(cipher.lower(), (cipher, "Unknown"))

    if sec_type in ("Open", "WEP") or strength != "Strong":
        verdict = "INSECURE" if strength == "Insecure" or sec_type == "Open" else "WEAK"
    elif sec_type == "WPA":
        verdict = "WEAK"
    else:
        verdict = "SECURE"
    return sec_type, auth_method, enc, verdict


def channel_band(channel, band=""):
    if band:
        return f"{channel} ({band})"
    ch = int(channel) if channel.isdigit() else 0
    return f"{channel} ({'2.4 GHz' if ch <= 14 else '5 GHz'})"


# ---------------------------------------------------------------------------
def connected_network():
    """Parse 'netsh wlan show interfaces' for the currently connected WLAN."""
    info = {}
    for line in netsh("show", "interfaces").splitlines():
        key, value = field(line)
        if key and value and key not in info:
            info[key] = value
    if info.get("state") != "connected":
        return None
    return info


def nearby_networks():
    """Parse 'netsh wlan show networks mode=bssid' into one entry per SSID."""
    nets, cur, bss = [], None, None
    for line in netsh("show", "networks", "mode=bssid").splitlines():
        key, value = field(line)
        if re.match(r"^ssid \d+$", key):
            cur = {"ssid": value or "<hidden>", "auth": "", "cipher": "", "bss": []}
            nets.append(cur)
        elif cur is None:
            continue
        elif key == "authentication":
            cur["auth"] = value
        elif key == "encryption":
            cur["cipher"] = value
        elif re.match(r"^bssid \d+$", key):
            bss = {"bssid": value, "channel": "", "band": "", "signal": ""}
            cur["bss"].append(bss)
        elif bss is not None and key in ("channel", "band", "signal"):
            bss[key] = value
    return nets


# ---------------------------------------------------------------------------
def print_record(title, ssid, auth, cipher, channels, extra=None):
    sec_type, auth_method, enc, verdict = classify(auth, cipher)
    print(f"\n{title}")
    print(f"  a. SSID                  : {ssid}")
    print(f"  b. Security Type         : {sec_type}")
    print(f"  c. Authentication Method : {auth_method}")
    print(f"  d. Encryption Method     : {enc}")
    print(f"  e. Channel               : {channels}")
    for k, v in (extra or {}).items():
        print(f"     {k:<21}: {v}")
    print(f"     {'Assessment':<21}: {verdict}")
    return sec_type, auth_method, enc, verdict


def main():
    if platform.system() != "Windows":
        sys.exit("This script uses 'netsh wlan' and runs on Windows only.")

    print("=" * 70)
    print(" WLAN SECURITY CONFIGURATION REPORT")
    print("=" * 70)

    # --- 1. Connected network: what was actually negotiated ---------------
    conn = connected_network()
    print("\n[1] CONNECTED NETWORK (negotiated settings)")
    if conn:
        print_record(
            f"  Interface: {conn.get('name')} - {conn.get('description')}",
            conn.get("ssid", "?"), conn.get("authentication", "?"),
            conn.get("cipher", "?"),
            channel_band(conn.get("channel", "?"), conn.get("band", "")),
            {"BSSID": conn.get("ap bssid", "?"),
             "Radio type": conn.get("radio type", "?"),
             "Signal": f"{conn.get('signal', '?')} (RSSI {conn.get('rssi', '?')} dBm)"})
    else:
        print("  Not connected to any WLAN.")

    # --- 2. All networks in range: what each AP advertises ----------------
    nets = nearby_networks()
    print(f"\n[2] NEARBY NETWORKS (advertised settings) - {len(nets)} found")
    if not nets:
        print("  None found. Is WiFi on, and Location services enabled?")
    rows = []
    for i, n in enumerate(nets, 1):
        channels = ", ".join(sorted({channel_band(b["channel"], b["band"])
                                     for b in n["bss"]})) or "?"
        best = max(n["bss"], key=lambda b: int(b["signal"].rstrip("%") or 0),
                   default={"signal": "?"})
        result = print_record(f"  Network {i}", n["ssid"], n["auth"], n["cipher"],
                              channels, {"Access points": len(n["bss"]),
                                         "Best signal": best["signal"]})
        rows.append((n["ssid"], *result, channels))

    # --- 3. Summary table --------------------------------------------------
    if rows:
        print("\n[3] SUMMARY")
        print(f"  {'SSID':<20} {'Security':<9} {'Authentication':<22} "
              f"{'Encryption':<18} {'Channel':<26} Assessment")
        print("  " + "-" * 110)
        for ssid, sec, auth, enc, verdict, ch in rows:
            print(f"  {ssid[:20]:<20} {sec:<9} {auth.split(' (')[0][:22]:<22} "
                  f"{enc.split(' (')[0]:<18} {ch:<26} {verdict}")

    # Point out when the connection was negotiated weaker than advertised
    if conn:
        adv = next((n for n in nets if n["ssid"] == conn.get("ssid")), None)
        if adv and (adv["auth"], adv["cipher"]) != (conn.get("authentication"),
                                                    conn.get("cipher")):
            print(f"\nNote: '{conn['ssid']}' advertises {adv['auth']} / {adv['cipher']}, "
                  f"but this connection negotiated {conn.get('authentication')} / "
                  f"{conn.get('cipher')}.")


if __name__ == "__main__":
    main()
