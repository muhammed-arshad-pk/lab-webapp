"""
UDP Client - connectionless communication over wireless LAN
============================================================
Sends messages typed by the user to the UDP server as datagrams and prints
the reply with round-trip time. Because UDP has no delivery guarantee, a
reply that doesn't arrive within the timeout is counted as lost.

Usage:
  python udp_client.py <server_ip>            # port 5001
  python udp_client.py 192.168.1.10 --port 6001 --timeout 2
Type 'exit' to quit.
"""

import argparse
import socket
import time

BUFFER_SIZE = 4096


def main():
    ap = argparse.ArgumentParser(description="UDP client")
    ap.add_argument("server_ip", help="IP address of the machine running udp_server.py")
    ap.add_argument("--port", type=int, default=5001)
    ap.add_argument("--timeout", type=float, default=2.0,
                    help="seconds to wait for a reply before counting it lost")
    args = ap.parse_args()

    server = (args.server_ip, args.port)
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(args.timeout)

    print(f"UDP client ready -> {server[0]}:{server[1]} (no connection needed)")
    print("Type a message and press Enter ('exit' to quit).\n")

    sent, rtts = 0, []
    try:
        while True:
            try:
                msg = input("You: ")
            except EOFError:
                break
            if msg.lower() == "exit":
                break
            if not msg:
                continue

            t0 = time.perf_counter()
            sock.sendto(msg.encode("utf-8"), server)
            sent += 1
            try:
                data, addr = sock.recvfrom(BUFFER_SIZE)
                rtt = (time.perf_counter() - t0) * 1000
                rtts.append(rtt)
                print(f"Server: {data.decode('utf-8', errors='replace')}   "
                      f"(RTT {rtt:.2f} ms)")
            except socket.timeout:
                print(f"No reply within {args.timeout}s - datagram lost?")
            except ConnectionResetError:
                print("No server listening on that port (ICMP port unreachable).")
    except KeyboardInterrupt:
        pass
    finally:
        sock.close()

    if sent:
        lost = sent - len(rtts)
        print(f"\nSent {sent} | received {len(rtts)} | lost {lost} "
              f"({lost / sent * 100:.1f}%)")
        if rtts:
            print(f"RTT min {min(rtts):.2f} / avg {sum(rtts) / len(rtts):.2f} / "
                  f"max {max(rtts):.2f} ms")


if __name__ == "__main__":
    main()
