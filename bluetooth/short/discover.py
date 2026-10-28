import asyncio
from bleak import BleakScanner

for d, adv in asyncio.run(BleakScanner.discover(timeout=10, return_adv=True)).values():
    print(d.address, adv.local_name or d.name or "<unknown>", adv.rssi, "dBm")
