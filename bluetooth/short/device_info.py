import asyncio, sys
from bleak import BleakClient

async def main(addr):
    async with BleakClient(addr, timeout=20) as c:
        print("Device Name:", c.name, "\nDevice Type: Bluetooth Low Energy")
        for s in c.services:
            print(f"\nService Name: {s.description}\nService UUID: {s.uuid}\nProtocol: L2CAP -> ATT -> GATT")

asyncio.run(main(sys.argv[1]))
