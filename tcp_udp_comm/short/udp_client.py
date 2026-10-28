import socket, sys

s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
srv = (sys.argv[1] if len(sys.argv) > 1 else "127.0.0.1", 5001)
while (m := input("You: ")) != "exit":
    s.sendto(m.encode(), srv)
    print("Server:", s.recvfrom(1024)[0].decode())
