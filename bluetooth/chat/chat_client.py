"""
Bluetooth Two-Way Chat - CLIENT
===============================
Connects to chat_server.py over Bluetooth RFCOMM. Both sides can send and
receive messages at the same time.

Usage:
  python chat_client.py <server_bluetooth_mac>
  python chat_client.py AA:BB:CC:DD:EE:FF --channel 6
Type /quit to leave.
"""

import argparse
import socket
import sys
import threading
from datetime import datetime


def receive_loop(conn, peer, done):
    """Print every line the peer sends until the connection closes."""
    try:
        with conn.makefile("r", encoding="utf-8", newline="\n") as reader:
            for line in reader:
                print(f"\r[{datetime.now():%H:%M:%S}] {peer}: {line.rstrip()}\nYou: ",
                      end="", flush=True)
    except OSError:
        pass
    if not done.is_set():
        print(f"\n*** {peer} left the chat. Press Enter to exit. ***")
    done.set()


def chat(conn, peer):
    done = threading.Event()
    threading.Thread(target=receive_loop, args=(conn, peer, done), daemon=True).start()
    print("Chat started. Type a message and press Enter (/quit to leave).\n")
    try:
        while not done.is_set():
            msg = input("You: ")
            if done.is_set():
                break
            if msg.strip() == "/quit":
                break
            if msg:
                conn.sendall((msg + "\n").encode("utf-8"))
    except (EOFError, KeyboardInterrupt, OSError):
        pass
    done.set()
    conn.close()
    print("Chat closed.")


def main():
    ap = argparse.ArgumentParser(description="Bluetooth chat client")
    ap.add_argument("server", help="Bluetooth MAC address of the chat server")
    ap.add_argument("--channel", type=int, default=4, help="RFCOMM channel (1-30)")
    args = ap.parse_args()

    sock = socket.socket(socket.AF_BLUETOOTH, socket.SOCK_STREAM, socket.BTPROTO_RFCOMM)
    print(f"Connecting to {args.server} on RFCOMM channel {args.channel} ...")
    try:
        sock.connect((args.server, args.channel))
    except OSError as e:
        sys.exit(f"Connection failed: {e}\n"
                 "Check: server running, devices paired, same channel, Bluetooth on.")
    print(f"Connected to {args.server}")
    chat(sock, args.server)


if __name__ == "__main__":
    main()
