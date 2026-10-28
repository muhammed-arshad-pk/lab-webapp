"""
Bluetooth File Transfer - SENDER (client)
=========================================
Sends one or more files to file_receiver.py over Bluetooth RFCOMM and waits
for the receiver to confirm each file's SHA-256 checksum.

Usage:
  python file_sender.py <receiver_bluetooth_mac> <file> [<file> ...]
  python file_sender.py AA:BB:CC:DD:EE:FF photo.jpg notes.pdf --channel 7
"""

import argparse
import hashlib
import json
import os
import socket
import sys
import time

CHUNK = 4096


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(65536), b""):
            h.update(block)
    return h.hexdigest()


def progress(done, total, start):
    pct = done / total * 100 if total else 100
    rate = done / max(time.time() - start, 1e-6) / 1024
    bar = "#" * int(pct / 4)
    print(f"\r  [{bar:<25}] {pct:5.1f}%  {done}/{total} bytes  {rate:.1f} KB/s",
          end="", flush=True)


def send_file(sock, reader, path):
    size = os.path.getsize(path)
    digest = sha256_of(path)
    print(f"\nSending '{os.path.basename(path)}' ({size} bytes)")

    header = {"name": os.path.basename(path), "size": size, "sha256": digest}
    sock.sendall((json.dumps(header) + "\n").encode())

    sent, start = 0, time.time()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(CHUNK), b""):
            sock.sendall(block)
            sent += len(block)
            progress(sent, size, start)
    print()

    reply = reader.readline()
    if not reply:
        raise ConnectionError("receiver closed the connection")
    status = json.loads(reply)
    elapsed = time.time() - start
    if status.get("status") == "ok":
        print(f"  Delivered and verified in {elapsed:.2f} s "
              f"({size / max(elapsed, 1e-6) / 1024:.1f} KB/s)")
        return True
    print("  Receiver reported a CHECKSUM MISMATCH")
    return False


def main():
    ap = argparse.ArgumentParser(description="Bluetooth file sender")
    ap.add_argument("receiver", help="Bluetooth MAC address of the receiver")
    ap.add_argument("files", nargs="+", help="file(s) to send")
    ap.add_argument("--channel", type=int, default=5, help="RFCOMM channel (1-30)")
    args = ap.parse_args()

    missing = [f for f in args.files if not os.path.isfile(f)]
    if missing:
        sys.exit(f"File(s) not found: {', '.join(missing)}")

    sock = socket.socket(socket.AF_BLUETOOTH, socket.SOCK_STREAM, socket.BTPROTO_RFCOMM)
    print(f"Connecting to {args.receiver} on RFCOMM channel {args.channel} ...")
    try:
        sock.connect((args.receiver, args.channel))
    except OSError as e:
        sys.exit(f"Connection failed: {e}\n"
                 "Check: receiver running, devices paired, same channel, Bluetooth on.")
    print("Connected.")

    reader = sock.makefile("rb")
    ok = 0
    try:
        for path in args.files:
            ok += send_file(sock, reader, path)
    except (OSError, ValueError) as e:
        print(f"\n[!] Transfer failed: {e}")
    finally:
        reader.close()
        sock.close()
    print(f"\n{ok}/{len(args.files)} file(s) sent successfully.")


if __name__ == "__main__":
    main()
