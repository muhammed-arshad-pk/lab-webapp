import socket

s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.bind(("0.0.0.0", 5001))
print("UDP server on port 5001")
while True:
    m, a = s.recvfrom(1024)
    print(a, ":", m.decode())
    s.sendto(b"echo: " + m, a)
