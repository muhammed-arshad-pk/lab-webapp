"""
UDP Server - connectionless communication over wireless LAN
============================================================
Listens on all interfaces and echoes every datagram back to its sender with
a server timestamp. No connection setup; each datagram is independent.

Usage:
  python udp_server.py                # port 5001
  python udp_server.py --port 6001
"""

import argparse
import socket
from datetime import datetime

BUFFER_SIZE = 4096


def get_lan_ip():
    """Return this machine's IP on the WLAN (the one clients should send to)."""
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


def main():
    ap = argparse.ArgumentParser(description="UDP echo server")
    ap.add_argument("--host", default="0.0.0.0", help="bind address (default: all)")
    ap.add_argument("--port", type=int, default=5001)
    args = ap.parse_args()

    server = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    server.bind((args.host, args.port))
    server.settimeout(1.0)                      # lets Ctrl+C work on Windows

    print(f"UDP server listening on {args.host}:{args.port}")
    print(f"Clients on the WLAN should send to: {get_lan_ip()}:{args.port}")
    print("Press Ctrl+C to stop.\n")

    packets = 0
    try:
        while True:
            try:
                data, addr = server.recvfrom(BUFFER_SIZE)
            except socket.timeout:
                continue
            except ConnectionResetError:
                # Windows raises this when a previous reply hit a closed port
                continue
            packets += 1
            msg = data.decode("utf-8", errors="replace")
            print(f"[{now()}] #{packets} {addr[0]}:{addr[1]} -> {msg!r} "
                  f"({len(data)} bytes)")
            reply = f"[server {now()}] echo: {msg}"
            server.sendto(reply.encode("utf-8"), addr)
    except KeyboardInterrupt:
        print(f"\nShutting down UDP server ({packets} datagrams received).")
    finally:
        server.close()


if __name__ == "__main__":
    main()
