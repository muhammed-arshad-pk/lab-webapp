import asyncio, os, socket, sys, threading
from bleak import BleakClient, BleakScanner

def rfcomm():
    return socket.socket(socket.AF_BLUETOOTH, socket.SOCK_STREAM, socket.BTPROTO_RFCOMM)

def serve(ch):
    s = rfcomm(); s.bind((socket.BDADDR_ANY, ch)); s.listen(1)
    print(f"Waiting on RFCOMM channel {ch} ...")
    c, a = s.accept(); print("Connected:", a)
    return c

def connect(addr, ch):
    c = rfcomm(); c.connect((addr, ch)); print("Connected to", addr)
    return c

def chat(c):
    threading.Thread(target=lambda: [print("\nFriend:", m.decode()) for m in iter(lambda: c.recv(1024), b"")], daemon=True).start()
    while (m := input()) != "/quit":
        c.send(m.encode())
    c.close()

async def scan():
    for d, adv in (await BleakScanner.discover(timeout=10, return_adv=True)).values():
        print(d.address, adv.local_name or d.name or "<unknown>", adv.rssi, "dBm")

async def info(addr):
    async with BleakClient(addr, timeout=20) as c:
        print("Device Name:", c.name, "\nDevice Type: Bluetooth Low Energy")
        for s in c.services:
            print(f"\nService Name: {s.description}\nService UUID: {s.uuid}\nProtocol: L2CAP -> ATT -> GATT")

cmd, *a = sys.argv[1:] or ["help"]
if cmd == "scan": asyncio.run(scan())
elif cmd == "info": asyncio.run(info(a[0]))
elif cmd == "chat-server": chat(serve(4))
elif cmd == "chat-client": chat(connect(a[0], 4))
elif cmd == "send":
    c, data = connect(a[0], 5), open(a[1], "rb").read()
    c.sendall(f"{os.path.basename(a[1])}\n{len(data)}\n".encode() + data)
    print("Sent", len(data), "bytes"); c.close()
elif cmd == "receive":
    r = serve(5).makefile("rb")
    name, size = "received_" + os.path.basename(r.readline().decode().strip()), int(r.readline())
    open(name, "wb").write(r.read(size)); print(f"Saved {name} ({size} bytes)")
else:
    print("Usage: bluetooth_all.py scan | info MAC | chat-server | chat-client MAC | receive | send MAC FILE")
