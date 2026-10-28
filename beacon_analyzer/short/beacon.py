import sys
from scapy.all import Dot11Beacon, rdpcap, sniff

seen = set()

def show(p):
    if p.haslayer(Dot11Beacon) and p.addr3 not in seen:
        seen.add(p.addr3)
        s = p[Dot11Beacon].network_stats()
        if s["crypto"] == {"OPN"} and int(p.cap) & 0x10: s["crypto"] = {"WEP"}
        print(f"\nAP: {s['ssid']} ({p.addr3})\nChannel: {s.get('channel')}\n"
              f"Security: {', '.join(s['crypto'])}\nRates: {s.get('rates')} Mbps\n"
              f"Interval: {p.beacon_interval} TU")

a = sys.argv[1] if len(sys.argv) > 1 else __file__ + "/../../sample_beacons.pcap"
if a.endswith(".pcap"):
    for p in rdpcap(a): show(p)
else:
    sniff(iface=a, prn=show, monitor=True)
