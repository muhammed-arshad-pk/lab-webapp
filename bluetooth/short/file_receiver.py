import os, socket

s = socket.socket(socket.AF_BLUETOOTH, socket.SOCK_STREAM, socket.BTPROTO_RFCOMM)
s.bind((socket.BDADDR_ANY, 5))
s.listen(1)
print("Waiting on RFCOMM channel 5 ...")
c, a = s.accept()
r = c.makefile("rb")
name = "received_" + os.path.basename(r.readline().decode().strip())
size = int(r.readline())
open(name, "wb").write(r.read(size))
print(f"Saved {name} ({size} bytes) from {a}")
c.close()
