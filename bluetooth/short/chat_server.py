import socket, threading

s = socket.socket(socket.AF_BLUETOOTH, socket.SOCK_STREAM, socket.BTPROTO_RFCOMM)
s.bind((socket.BDADDR_ANY, 4))
s.listen(1)
print("Waiting on RFCOMM channel 4 ...")
c, a = s.accept()
print("Connected:", a)
threading.Thread(target=lambda: [print("\nFriend:", m.decode()) for m in iter(lambda: c.recv(1024), b"")], daemon=True).start()
while (m := input()) != "/quit":
    c.send(m.encode())
c.close()
