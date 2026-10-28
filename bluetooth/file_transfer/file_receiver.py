"""
Bluetooth File Transfer - RECEIVER (server)
===========================================
Listens on an RFCOMM channel and saves every file a sender pushes to it into
the ./received folder. Each file's SHA-256 is checked to confirm it arrived
intact.

Protocol (per file):
  sender   -> {"name": ..., "size": ..., "sha256": ...}\\n   (JSON header)
  sender   -> <size> bytes of file data
  receiver -> {"status": "ok" | "error", "sha256": ...}\\n

Usage:
  python file_receiver.py                       # RFCOMM channel 5
  python file_receiver.py --channel 7 --out downloads
"""

import argparse
import asyncio
import hashlib
import json
import os
import socket
import subprocess
import sys
import time

CHUNK = 4096


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


def progress(done, total, start):
    pct = done / total * 100 if total else 100
    rate = done / max(time.time() - start, 1e-6) / 1024
    bar = "#" * int(pct / 4)
    print(f"\r  [{bar:<25}] {pct:5.1f}%  {done}/{total} bytes  {rate:.1f} KB/s",
          end="", flush=True)


def unique_path(folder, name):
    name = os.path.basename(name) or "unnamed"          # never trust sender paths
    base, ext = os.path.splitext(name)
    path, n = os.path.join(folder, name), 1
    while os.path.exists(path):
        path = os.path.join(folder, f"{base} ({n}){ext}")
        n += 1
    return path


def receive_files(conn, out_dir):
    reader = conn.makefile("rb")
    count = 0
    while True:
        header = reader.readline()
        if not header:
            break                                        # sender finished
        meta = json.loads(header)
        size = int(meta["size"])
        path = unique_path(out_dir, meta["name"])
        print(f"\nReceiving '{meta['name']}' ({size} bytes) -> {path}")

        sha, received, start = hashlib.sha256(), 0, time.time()
        with open(path, "wb") as f:
            while received < size:
                data = reader.read(min(CHUNK, size - received))
                if not data:
                    raise ConnectionError("sender disconnected mid-file")
                f.write(data)
                sha.update(data)
                received += len(data)
                progress(received, size, start)
        print()

        ok = sha.hexdigest() == meta["sha256"]
        conn.sendall((json.dumps({"status": "ok" if ok else "error",
                                  "sha256": sha.hexdigest()}) + "\n").encode())
        print(f"  {'Saved, SHA-256 verified' if ok else 'CHECKSUM MISMATCH - file corrupted'}"
              f" ({time.time() - start:.2f} s)")
        count += 1
    reader.close()
    return count


def main():
    ap = argparse.ArgumentParser(description="Bluetooth file receiver")
    ap.add_argument("--channel", type=int, default=5, help="RFCOMM channel (1-30)")
    ap.add_argument("--out", default="received", help="folder to save files in")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    server = socket.socket(socket.AF_BLUETOOTH, socket.SOCK_STREAM, socket.BTPROTO_RFCOMM)
    try:
        server.bind((socket.BDADDR_ANY, args.channel))
    except OSError as e:
        sys.exit(f"Cannot bind RFCOMM channel {args.channel}: {e}\n"
                 "Is Bluetooth on? Try another --channel.")
    server.listen(1)
    server.settimeout(1.0)                               # lets Ctrl+C work on Windows

    mac = local_bt_address() or "<see Settings > Bluetooth>"
    print(f"Bluetooth file receiver on RFCOMM channel {args.channel}")
    print(f"Files are saved to: {os.path.abspath(args.out)}")
    print(f"Sender should run:  python file_sender.py {mac} <file> --channel {args.channel}")
    print("Waiting for senders ... (Ctrl+C to stop)")

    try:
        while True:
            try:
                conn, addr = server.accept()
            except socket.timeout:
                continue
            peer = addr[0] if isinstance(addr, tuple) else str(addr)
            print(f"\n[+] Connection from {peer}")
            try:
                n = receive_files(conn, args.out)
                print(f"[-] {peer} done: {n} file(s) received")
            except (OSError, ValueError, KeyError) as e:
                print(f"\n[!] Transfer from {peer} failed: {e}")
            finally:
                conn.close()
    except KeyboardInterrupt:
        print("\nReceiver stopped.")
    finally:
        server.close()


if __name__ == "__main__":
    main()
