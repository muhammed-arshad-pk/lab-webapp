import socket, sys

s = socket.socket()
s.connect((sys.argv[1] if len(sys.argv) > 1 else "127.0.0.1", 5000))
while (m := input("You: ")) != "exit":
    s.send(m.encode())
    print("Server:", s.recv(1024).decode())
s.send(b"exit")
s.close()
