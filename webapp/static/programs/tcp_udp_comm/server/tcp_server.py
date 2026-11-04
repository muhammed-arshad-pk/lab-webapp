"""
TCP Server - connection-oriented communication over wireless LAN
=================================================================
Listens on all interfaces, accepts multiple clients (one thread each) and
echoes every message back with a server timestamp.

Usage:
  python tcp_server.py                # port 5000
  python tcp_server.py --port 6000
"""

import argparse
import socket
import threading
from datetime import datetime


def get_lan_ip():
    """Return this machine's IP on the WLAN (the one clients should connect to)."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))    # no packet is sent; just picks the route
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def now():
    return datetime.now().strftime("%H:%M:%S")


def handle_client(conn, addr):
    print(f"[{now()}] [+] Connected: {addr[0]}:{addr[1]}")
    total_bytes = 0
    with conn, conn.makefile("r", encoding="utf-8", newline="\n") as reader:
        for line in reader:                     # one message per line
            msg = line.rstrip("\n")
            total_bytes += len(line.encode())
            print(f"[{now()}] {addr[0]}:{addr[1]} -> {msg!r}")
            if msg.lower() == "exit":
                conn.sendall(b"BYE\n")
                break
            reply = f"[server {now()}] echo: {msg}\n"
            conn.sendall(reply.encode("utf-8"))
    print(f"[{now()}] [-] Disconnected: {addr[0]}:{addr[1]} "
          f"({total_bytes} bytes received)")


def main():
    ap = argparse.ArgumentParser(description="TCP echo server")
    ap.add_argument("--host", default="0.0.0.0", help="bind address (default: all)")
    ap.add_argument("--port", type=int, default=5000)
    args = ap.parse_args()

    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((args.host, args.port))
    server.listen(5)
    server.settimeout(1.0)                      # lets Ctrl+C work on Windows

    print(f"TCP server listening on {args.host}:{args.port}")
    print(f"Clients on the WLAN should connect to: {get_lan_ip()}:{args.port}")
    print("Press Ctrl+C to stop.\n")

    try:
        while True:
            try:
                conn, addr = server.accept()
            except socket.timeout:
                continue
            threading.Thread(target=handle_client, args=(conn, addr),
                             daemon=True).start()
    except KeyboardInterrupt:
        print("\nShutting down TCP server.")
    finally:
        server.close()


if __name__ == "__main__":
    main()
