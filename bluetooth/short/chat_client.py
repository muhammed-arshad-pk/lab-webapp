import socket, sys, threading

c = socket.socket(socket.AF_BLUETOOTH, socket.SOCK_STREAM, socket.BTPROTO_RFCOMM)
c.connect((sys.argv[1], 4))
print("Connected to", sys.argv[1])
threading.Thread(target=lambda: [print("\nFriend:", m.decode()) for m in iter(lambda: c.recv(1024), b"")], daemon=True).start()
while (m := input()) != "/quit":
    c.send(m.encode())
c.close()
