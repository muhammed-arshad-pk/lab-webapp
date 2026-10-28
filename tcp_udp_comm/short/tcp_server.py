import socket

s = socket.socket()
s.bind(("0.0.0.0", 5000))
s.listen(1)
print("TCP server on port 5000")
c, a = s.accept()
print("Connected:", a)
while (m := c.recv(1024).decode()) and m != "exit":
    print("Client:", m)
    c.send(("echo: " + m).encode())
c.close()
