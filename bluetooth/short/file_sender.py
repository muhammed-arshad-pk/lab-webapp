import os, socket, sys

s = socket.socket(socket.AF_BLUETOOTH, socket.SOCK_STREAM, socket.BTPROTO_RFCOMM)
s.connect((sys.argv[1], 5))
data = open(sys.argv[2], "rb").read()
s.sendall(f"{os.path.basename(sys.argv[2])}\n{len(data)}\n".encode() + data)
print("Sent", len(data), "bytes")
s.close()
