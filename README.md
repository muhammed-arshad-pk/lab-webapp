# WCN Virtual Lab

Wireless Communication & Networks lab programs in Python, plus an interactive web app that brings all the experiments together.

## Run the web app

```bash
python webapp/server.py
```

Then open http://localhost:8000 (on Windows you can also double-click `webapp/start_lab.bat`).

The server uses only the Python standard library. The labs themselves use the packages listed below.

Each lab in the web app has five tabs:
- **Experiment**: an interactive simulation, or real hardware for the networking labs.
- **Aim & Theory**: aim, theory, procedure and result.
- **Run Program**: runs the original Python script and shows its output and plot.
- **Source Code**: the lab's Python programs.
- **Viva**: viva questions with answers.

## Labs

| # | Lab | Program |
|---|-----|---------|
| 1 | Analog Modulation (AM / FM / PM) | `analog_modulation/analog_modulation.py` |
| 2 | Digital Modulation (BASK, BFSK, BPSK, QPSK) | `digital_modulation/digital_modulation.py` |
| 3 | Pulse Code Modulation | `pcm/pcm.py` |
| 4 | OFDM transmitter & receiver | `ofdm/ofdm.py` |
| 5 | Code Division Multiple Access (CDMA) | `cdma/cdma.py` |
| 6 | WiFi scanner & RSSI analyser | `wifi_analyzer.py` |
| 7 | WLAN security configuration report | `wlan_security/wlan_security_report.py` |
| 8 | 802.11 beacon frame analyser | `beacon_analyzer/beacon_analyzer.py` |
| 9 | TCP & UDP client–server | `tcp_udp_comm/` |
| 10 | Bluetooth discovery, info, chat & file transfer | `bluetooth/` |
| C | Cisco Packet Tracer labs | coming soon |

Each `short/` folder contains a condensed version of the same program.

## Requirements

```bash
pip install numpy matplotlib scapy bleak
```

- The WiFi and WLAN labs use `netsh` on Windows (Location services must be on) and `nmcli` on Linux.
- Live beacon capture needs a WiFi adapter in monitor mode. Otherwise, use `beacon_analyzer/sample_beacons.pcap`.
- Bluetooth Classic on Windows uses WinRT; see `bluetooth/requirements.txt`.
