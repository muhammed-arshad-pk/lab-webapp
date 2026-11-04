"""
Bluetooth Two-Way Chat - SERVER
===============================
Waits for a chat client to connect over Bluetooth RFCOMM, then both sides can
send and receive messages at the same time (a background thread receives
while the main thread reads your keyboard input).

Usage:
  python chat_server.py                # RFCOMM channel 4
  python chat_server.py --channel 6
Type /quit to leave.

Pair the two devices first (Settings > Bluetooth), then start this server
BEFORE the client. Give the client this machine's Bluetooth MAC address.
"""

import argparse
import asyncio
import socket
import subprocess
import sys
import threading
from datetime import datetime


def local_bt_address():
    """Best-effort lookup of this machine's Bluetooth MAC address."""
    try:
        if sys.platform == "win32":
            from winrt.windows.devices.bluetooth import BluetoothAdapter

            async def get():
                return await BluetoothAdapter.get_default_async()
            adapter = asyncio.run(get())
            if adapter:
                a = adapter.bluetooth_address
                return ":".join(f"{(a >> s) & 0xFF:02X}" for s in range(40, -1, -8))
        else:
            out = subprocess.run(["bluetoothctl", "list"], capture_output=True,
                                 text=True).stdout.split()
            return out[1] if len(out) > 1 else None
    except Exception:
        pass
    return None


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
    ap = argparse.ArgumentParser(description="Bluetooth chat server")
    ap.add_argument("--channel", type=int, default=4, help="RFCOMM channel (1-30)")
    args = ap.parse_args()

    server = socket.socket(socket.AF_BLUETOOTH, socket.SOCK_STREAM, socket.BTPROTO_RFCOMM)
    try:
        server.bind((socket.BDADDR_ANY, args.channel))
    except OSError as e:
        sys.exit(f"Cannot bind RFCOMM channel {args.channel}: {e}\n"
                 "Is Bluetooth on? Try another --channel.")
    server.listen(1)
    server.settimeout(1.0)                    # lets Ctrl+C work on Windows

    mac = local_bt_address() or "<see Settings > Bluetooth>"
    print(f"Bluetooth chat server on RFCOMM channel {args.channel}")
    print(f"Client should run:  python chat_client.py {mac} --channel {args.channel}")
    print("Waiting for a connection ... (Ctrl+C to stop)")

    try:
        while True:
            try:
                conn, addr = server.accept()
                break
            except socket.timeout:
                continue
    except KeyboardInterrupt:
        server.close()
        return
    server.close()

    peer = addr[0] if isinstance(addr, tuple) else str(addr)
    print(f"Connected to {peer}")
    chat(conn, peer)


if __name__ == "__main__":
    main()
