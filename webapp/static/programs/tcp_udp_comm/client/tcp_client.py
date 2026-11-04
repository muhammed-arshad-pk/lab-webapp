"""
TCP Client - connection-oriented communication over wireless LAN
=================================================================
Connects to the TCP server, sends messages typed by the user and prints the
server's reply along with the round-trip time (RTT).

Usage:
  python tcp_client.py <server_ip>            # port 5000
  python tcp_client.py 192.168.1.10 --port 6000
Type 'exit' to quit.
"""

import argparse
import socket
import time


def main():
    ap = argparse.ArgumentParser(description="TCP client")
    ap.add_argument("server_ip", help="IP address of the machine running tcp_server.py")
    ap.add_argument("--port", type=int, default=5000)
    args = ap.parse_args()

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(5)
    try:
        t0 = time.perf_counter()
        sock.connect((args.server_ip, args.port))       # 3-way handshake
        connect_ms = (time.perf_counter() - t0) * 1000
    except OSError as e:
        print(f"Could not connect to {args.server_ip}:{args.port}: {e}")
        return

    local = sock.getsockname()
    print(f"Connected to {args.server_ip}:{args.port} from {local[0]}:{local[1]} "
          f"(handshake {connect_ms:.2f} ms)")
    print("Type a message and press Enter ('exit' to quit).\n")

    rtts = []
    reader = sock.makefile("r", encoding="utf-8", newline="\n")
    try:
        while True:
            try:
                msg = input("You: ")
            except EOFError:
                msg = "exit"
            if not msg:
                continue

            t0 = time.perf_counter()
            sock.sendall((msg + "\n").encode("utf-8"))
            reply = reader.readline()
            rtt = (time.perf_counter() - t0) * 1000

            if not reply:
                print("Server closed the connection.")
                break
            if msg.lower() == "exit":
                print("Server:", reply.strip())
                break
            rtts.append(rtt)
            print(f"Server: {reply.strip()}   (RTT {rtt:.2f} ms)")
    except (socket.timeout, ConnectionError) as e:
        print(f"Connection error: {e}")
    except KeyboardInterrupt:
        pass
    finally:
        reader.close()
        sock.close()

    if rtts:
        print(f"\nMessages: {len(rtts)} | RTT min {min(rtts):.2f} / "
              f"avg {sum(rtts) / len(rtts):.2f} / max {max(rtts):.2f} ms")


if __name__ == "__main__":
    main()
