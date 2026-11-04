"""
WCN Virtual Lab - backend
=========================
Serves the web app and exposes the real lab programs in C:\\WCN as a JSON API.
Standard library only (numpy / scapy / bleak are used if the lab modules need them).

  python server.py              # http://localhost:8000
  python server.py --port 9000

Endpoints
  GET  /api/status                      capabilities of this machine
  GET  /api/source?lab=<id>             source code of a lab's programs
  POST /api/run        {lab}            run the original .py program, return stdout + plots
  GET  /api/wifi/scan                   nearby networks + RSSI analysis   (wifi_analyzer.py)
  GET  /api/wlan/report                 connected + nearby security info  (wlan_security_report.py)
  POST /api/net/server/start {proto, port}   start a real TCP/UDP echo server
  POST /api/net/server/stop  {proto, port}
  POST /api/net/server/send  {proto, port, msg}  server -> its clients
  POST /api/net/connect {host, port}          TCP client: 3-way handshake
  POST /api/net/send    {proto, host, port, msg, sid}
  POST /api/net/close   {sid}
  GET  /api/net/log?since=N             server-side event log
  GET  /api/bt/scan?timeout=S           Bluetooth discovery                (discover_devices.py)
  GET  /api/bt/info?address=MAC&ble=1   BLE GATT services                  (device_info.py)
"""

import argparse
import asyncio
import base64
import importlib
import importlib.util
import json
import mimetypes
import os
import platform
import queue
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import traceback
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
WCN = os.path.dirname(HERE)
STATIC = os.path.join(HERE, "static")

# lab id -> (program files shown in "Source", program run by "Run", extra args)
LABS = {
    "analog":   (["analog_modulation/analog_modulation.py"], "analog_modulation/analog_modulation.py", []),
    "digital":  (["digital_modulation/digital_modulation.py"], "digital_modulation/digital_modulation.py", []),
    "pcm":      (["pcm/pcm.py"], "pcm/pcm.py", []),
    "ofdm":     (["ofdm/ofdm.py"], "ofdm/ofdm.py", []),
    "cdma":     (["cdma/cdma.py"], "cdma/cdma.py", []),
    "wifi":     (["wifi_analyzer.py"], "wifi_analyzer.py", []),
    "wlan":     (["wlan_security/wlan_security_report.py", "wlan_security/short/wlan_security.py"],
                 "wlan_security/wlan_security_report.py", []),
    "beacon":   (["beacon_analyzer/beacon_analyzer.py", "beacon_analyzer/create_sample_pcap.py",
                  "beacon_analyzer/short/beacon.py"],
                 "beacon_analyzer/beacon_analyzer.py",
                 ["--pcap", os.path.join(WCN, "beacon_analyzer", "sample_beacons.pcap")]),
    "tcpudp":   (["tcp_udp_comm/server/tcp_server.py", "tcp_udp_comm/client/tcp_client.py",
                  "tcp_udp_comm/server/udp_server.py", "tcp_udp_comm/client/udp_client.py"], None, []),
    "bluetooth": (["bluetooth/discover_devices.py", "bluetooth/device_info.py",
                   "bluetooth/chat/chat_server.py", "bluetooth/chat/chat_client.py",
                   "bluetooth/file_transfer/file_sender.py",
                   "bluetooth/file_transfer/file_receiver.py", "bluetooth/short/bluetooth_all.py"],
                  "bluetooth/discover_devices.py", ["--timeout", "6"]),
}

for sub in ("", "wlan_security", "beacon_analyzer", "bluetooth"):
    p = os.path.join(WCN, sub)
    if p not in sys.path:
        sys.path.insert(0, p)


def lab_module(name):
    return importlib.import_module(name)


def has_module(name):
    try:
        return importlib.util.find_spec(name) is not None
    except (ImportError, ValueError):
        return False


def now():
    return datetime.now().strftime("%H:%M:%S.%f")[:-3]


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


# ---------------------------------------------------------------------------
# Run original program
# ---------------------------------------------------------------------------
def run_program(lab):
    _, script, args = LABS[lab]
    if not script:
        return {"error": "This lab is interactive; use the client/server panels."}
    path = os.path.join(WCN, script)
    work = tempfile.mkdtemp(prefix="wcnlab_")
    env = dict(os.environ, MPLBACKEND="Agg", PYTHONIOENCODING="utf-8", PYTHONWARNINGS="ignore")
    t0 = time.perf_counter()
    try:
        proc = subprocess.run([sys.executable, path, *args], cwd=work, env=env,
                              capture_output=True, text=True, encoding="utf-8",
                              errors="replace", timeout=90, stdin=subprocess.DEVNULL)
        out, err, code = proc.stdout, proc.stderr, proc.returncode
    except subprocess.TimeoutExpired as e:
        out, err, code = e.stdout or "", "Timed out after 90 s", -1
    images = []
    for f in sorted(os.listdir(work)):
        if f.lower().endswith(".png"):
            with open(os.path.join(work, f), "rb") as fh:
                images.append({"name": f, "data": base64.b64encode(fh.read()).decode()})
    shutil.rmtree(work, ignore_errors=True)
    cmd = "python " + script.replace("/", os.sep) + " " + " ".join(
        os.path.relpath(a, WCN) if os.path.isabs(a) else a for a in args)
    return {"command": cmd.strip(), "stdout": out, "stderr": err, "returncode": code,
            "seconds": round(time.perf_counter() - t0, 2), "images": images}


# ---------------------------------------------------------------------------
# WiFi / WLAN
# ---------------------------------------------------------------------------
def wifi_scan():
    wa = lab_module("wifi_analyzer")
    nets = wa.scan_networks()
    return {"networks": [{
        "ssid": n.ssid, "bssid": n.bssid, "rssi": n.rssi, "channel": n.channel,
        "band": n.band, "security": n.security, "quality": wa.rssi_quality(n.rssi),
        "percent": wa.dbm_to_percent(n.rssi),
        "distance": wa.estimate_distance(n.rssi, n.channel)} for n in nets],
        "time": now()}


def wlan_report():
    ws = lab_module("wlan_security_report")
    conn = ws.connected_network()
    connected = None
    if conn:
        sec, auth, enc, verdict = ws.classify(conn.get("authentication", "?"), conn.get("cipher", "?"))
        connected = {"ssid": conn.get("ssid", "?"), "security": sec, "auth": auth, "encryption": enc,
                     "verdict": verdict,
                     "channel": ws.channel_band(conn.get("channel", "?"), conn.get("band", "")),
                     "bssid": conn.get("ap bssid", "?"), "radio": conn.get("radio type", "?"),
                     "signal": conn.get("signal", "?"), "rssi": conn.get("rssi", "?"),
                     "interface": f"{conn.get('name', '')} - {conn.get('description', '')}",
                     "raw_auth": conn.get("authentication"), "raw_cipher": conn.get("cipher")}
    nearby = []
    for n in ws.nearby_networks():
        sec, auth, enc, verdict = ws.classify(n["auth"], n["cipher"])
        chans = ", ".join(sorted({ws.channel_band(b["channel"], b["band"]) for b in n["bss"]})) or "?"
        nearby.append({"ssid": n["ssid"], "security": sec, "auth": auth, "encryption": enc,
                       "verdict": verdict, "channel": chans, "aps": len(n["bss"]),
                       "raw_auth": n["auth"], "raw_cipher": n["cipher"],
                       "signal": max((b["signal"] for b in n["bss"]),
                                     key=lambda s: int(s.rstrip("%") or 0), default="?")})
    return {"connected": connected, "nearby": nearby}


# ---------------------------------------------------------------------------
# TCP / UDP lab - real sockets, two-way
# ---------------------------------------------------------------------------
NET_LOG, NET_LOCK = [], threading.Lock()
SERVERS = {}            # (proto, port) -> {"sock", "stop", "peers": {addr: (conn, lock) | None}}
CLIENTS = {}            # sid -> {"sock", "proto", "addr", "replies": Queue}


def log(side, proto, kind, text, **extra):
    with NET_LOCK:
        NET_LOG.append({"n": len(NET_LOG), "t": now(), "side": side, "proto": proto,
                        "kind": kind, "text": text, **extra})


def stamp():
    return datetime.now().strftime("%H:%M:%S")


def tcp_handle(conn, addr, port, peers):
    log("server", "TCP", "connect", f"[+] Connected: {addr[0]}:{addr[1]}", port=port)
    lock = threading.Lock()                     # echo and server-push share the socket
    peers[addr] = (conn, lock)
    total = 0
    try:
        with conn, conn.makefile("r", encoding="utf-8", newline="\n") as reader:
            for line in reader:
                msg = line.rstrip("\n")
                total += len(line.encode())
                log("server", "TCP", "recv", f"{addr[0]}:{addr[1]} -> {msg!r}", port=port,
                    bytes=len(line.encode()))
                with lock:
                    if msg.lower() == "exit":
                        conn.sendall(b"BYE\n")
                        break
                    conn.sendall(f"[server {stamp()}] echo: {msg}\n".encode())
    except OSError:
        pass
    peers.pop(addr, None)
    log("server", "TCP", "disconnect",
        f"[-] Disconnected: {addr[0]}:{addr[1]} ({total} bytes received)", port=port)


def tcp_server(sock, stop, port, peers):
    while not stop.is_set():
        try:
            conn, addr = sock.accept()
        except socket.timeout:
            continue
        except OSError:
            break
        threading.Thread(target=tcp_handle, args=(conn, addr, port, peers), daemon=True).start()
    for conn, _ in list(peers.values()):      # shutdown() sends FIN even while a reader is blocked
        try:
            conn.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass
    sock.close()


def udp_server(sock, stop, port, peers):
    packets = 0
    while not stop.is_set():
        try:
            data, addr = sock.recvfrom(4096)
        except (socket.timeout, ConnectionResetError):
            continue
        except OSError:
            break
        packets += 1
        peers[addr] = None                      # UDP has no connection: remember who wrote to us
        msg = data.decode("utf-8", "replace")
        log("server", "UDP", "recv", f"#{packets} {addr[0]}:{addr[1]} -> {msg!r} ({len(data)} bytes)",
            port=port, bytes=len(data))
        sock.sendto(f"[server {stamp()}] echo: {msg}".encode(), addr)
    sock.close()


def server_start(proto, port):
    key = (proto, port)
    if key in SERVERS:
        return {"ok": True, "already": True, "ip": lan_ip()}
    kind = socket.SOCK_STREAM if proto == "TCP" else socket.SOCK_DGRAM
    sock = socket.socket(socket.AF_INET, kind)
    if proto == "TCP":
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(("0.0.0.0", port))
    if proto == "TCP":
        sock.listen(5)
    sock.settimeout(0.5)
    stop, peers = threading.Event(), {}
    target = tcp_server if proto == "TCP" else udp_server
    threading.Thread(target=target, args=(sock, stop, port, peers), daemon=True).start()
    SERVERS[key] = {"sock": sock, "stop": stop, "peers": peers}
    log("server", proto, "start", f"{proto} server listening on 0.0.0.0:{port} "
                                  f"(clients on the WLAN use {lan_ip()}:{port})", port=port)
    return {"ok": True, "ip": lan_ip()}


def server_stop(proto, port):
    s = SERVERS.pop((proto, port), None)
    if s:
        s["stop"].set()
        log("server", proto, "stop", f"{proto} server on port {port} stopped", port=port)
    return {"ok": True}


def server_send(proto, port, msg):
    """Server -> client: TCP to every connected client, UDP to every client that has written to us."""
    s = SERVERS.get((proto, port))
    if not s:
        raise ConnectionError(f"{proto} server on port {port} is not running")
    peers = list(s["peers"].items())
    if not peers:
        raise ConnectionError("No client connected yet" if proto == "TCP" else
                              "No client known yet - a UDP server only learns a client's "
                              "address when the client sends it a datagram first")
    line = f"[server {stamp()}] says: {msg}"
    for addr, peer in peers:
        if proto == "TCP":
            conn, lock = peer
            with lock:
                conn.sendall((line + "\n").encode())
        else:
            s["sock"].sendto(line.encode(), addr)
        log("server", proto, "send", f"{addr[0]}:{addr[1]} <- {msg!r}", port=port)
    return {"sent": len(peers)}


def client_reader(sid, c):
    """Background receive loop: echoes answer the pending send(), anything else is a server push."""
    sock, proto = c["sock"], c["proto"]
    try:
        if proto == "TCP":
            with sock.makefile("r", encoding="utf-8", newline="\n") as reader:
                for line in reader:
                    deliver(c, line.rstrip("\n"))
        else:
            while sid in CLIENTS:
                try:
                    data, _ = sock.recvfrom(4096)
                except (socket.timeout, ConnectionResetError):
                    continue
                deliver(c, data.decode("utf-8", "replace"))
    except (OSError, ValueError):
        pass
    c["replies"].put(None)                      # connection closed
    if proto == "TCP" and CLIENTS.pop(sid, None):
        log("client", "TCP", "close", "Server closed the connection.")


def deliver(c, msg):
    if "] echo: " in msg or msg == "BYE":
        c["replies"].put(msg)
    else:
        log("client", c["proto"], "push", f"Server: {msg}")


def new_client(proto, sock, addr):
    sid = f"{proto[0].lower()}{int(time.time() * 1000) % 10 ** 8}"
    c = CLIENTS[sid] = {"sock": sock, "proto": proto, "addr": addr, "replies": queue.Queue()}
    threading.Thread(target=client_reader, args=(sid, c), daemon=True).start()
    return sid


def tcp_connect(host, port):
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(5)
    t0 = time.perf_counter()
    sock.connect((host, port))
    ms = (time.perf_counter() - t0) * 1000
    sock.settimeout(None)
    sid = new_client("TCP", sock, (host, port))
    local = sock.getsockname()
    log("client", "TCP", "connect", f"Connected to {host}:{port} from {local[0]}:{local[1]} "
                                    f"(handshake {ms:.2f} ms)")
    return {"sid": sid, "handshake_ms": round(ms, 3), "local": f"{local[0]}:{local[1]}"}


def net_send(proto, host, port, msg, sid=None):
    c = CLIENTS.get(sid)
    if proto == "TCP" and not c:
        raise ConnectionError("Not connected - press Connect first")
    if proto == "UDP" and (not c or c["proto"] != "UDP" or c["addr"] != (host, port)):
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)   # one socket per UDP session,
        sock.bind(("0.0.0.0", 0))                                  # so the server can write back
        sock.settimeout(0.5)
        if c and c["proto"] == "UDP":
            net_close(sid)
        sid = new_client("UDP", sock, (host, port))
        c = CLIENTS[sid]
    while not c["replies"].empty():             # drop late replies to earlier lost datagrams
        c["replies"].get_nowait()
    t0 = time.perf_counter()
    if proto == "TCP":
        c["sock"].sendall((msg + "\n").encode())
    else:
        c["sock"].sendto(msg.encode(), (host, port))
    try:
        reply = c["replies"].get(timeout=5 if proto == "TCP" else 2)
    except queue.Empty:
        if proto == "TCP":
            raise TimeoutError("No reply from the server within 5 s")
        return {"reply": None, "lost": True, "bytes": len(msg.encode()), "sid": sid,
                "note": "No reply within 2 s - UDP gives no delivery guarantee"}
    rtt = (time.perf_counter() - t0) * 1000
    local = "%s:%d" % c["sock"].getsockname()
    if proto == "TCP" and (reply is None or msg.lower() == "exit"):
        net_close(sid)
    return {"reply": reply or "", "rtt_ms": round(rtt, 3), "bytes": len(msg.encode()) + (proto == "TCP"),
            "closed": sid not in CLIENTS, "sid": sid, "local": local}


def net_close(sid):
    c = CLIENTS.pop(sid, None)
    if c:
        try:
            if c["proto"] == "TCP":
                c["sock"].shutdown(socket.SHUT_RDWR)
            c["sock"].close()
        except OSError:
            pass
        if c["proto"] == "TCP":
            log("client", "TCP", "close", "Client closed connection (FIN)")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Bluetooth
# ---------------------------------------------------------------------------
def bt_scan(timeout):
    dd = lab_module("discover_devices")
    return {"devices": asyncio.run(dd.discover_all(timeout))}


def bt_info(address, ble):
    di = lab_module("device_info")
    info, services = asyncio.run(di.ble_info(address) if ble else di.classic_info(address))
    return {"info": info, "services": services}


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    server_version = "WCNLab/1.0"

    def log_message(self, fmt, *args):
        if "/api/net/log" not in self.path:
            sys.stderr.write(f"[{now()}] {fmt % args}\n")

    def send_json(self, obj, code=200):
        data = json.dumps(obj, default=str).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n else b""

    def json_body(self):
        b = self.body()
        return json.loads(b) if b else {}

    def do_GET(self):
        self.route("GET")

    def do_POST(self):
        self.route("POST")

    def route(self, method):
        url = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(url.query).items()}
        p = url.path
        try:
            if not p.startswith("/api/"):
                return self.static(p)
            if p == "/api/status":
                return self.send_json({
                    "os": platform.system(), "python": platform.python_version(),
                    "ip": lan_ip(), "host": socket.gethostname(),
                    "scapy": has_module("scapy"), "bleak": has_module("bleak"),
                    "numpy": has_module("numpy"), "matplotlib": has_module("matplotlib")})
            if p == "/api/source":
                files = []
                for rel in LABS[q["lab"]][0]:
                    with open(os.path.join(WCN, rel), encoding="utf-8") as f:
                        files.append({"path": rel, "code": f.read()})
                return self.send_json({"files": files})
            if p == "/api/run":
                return self.send_json(run_program(self.json_body()["lab"]))
            if p == "/api/wifi/scan":
                return self.send_json(wifi_scan())
            if p == "/api/wlan/report":
                return self.send_json(wlan_report())
            if p == "/api/net/server/start":
                b = self.json_body()
                return self.send_json(server_start(b["proto"], int(b["port"])))
            if p == "/api/net/server/stop":
                b = self.json_body()
                return self.send_json(server_stop(b["proto"], int(b["port"])))
            if p == "/api/net/server/send":
                b = self.json_body()
                return self.send_json(server_send(b["proto"], int(b["port"]), b["msg"]))
            if p == "/api/net/servers":
                return self.send_json({"servers": [f"{k[0]}:{k[1]}" for k in SERVERS], "ip": lan_ip()})
            if p == "/api/net/connect":
                b = self.json_body()
                return self.send_json(tcp_connect(b["host"], int(b["port"])))
            if p == "/api/net/send":
                b = self.json_body()
                return self.send_json(net_send(b["proto"], b["host"], int(b["port"]), b["msg"],
                                               b.get("sid")))
            if p == "/api/net/close":
                return self.send_json(net_close(self.json_body().get("sid")))
            if p == "/api/net/log":
                since = int(q.get("since", 0))
                with NET_LOCK:
                    return self.send_json({"events": NET_LOG[since:]})
            if p == "/api/bt/scan":
                return self.send_json(bt_scan(float(q.get("timeout", 6))))
            if p == "/api/bt/info":
                return self.send_json(bt_info(q["address"], q.get("ble") == "1"))
            return self.send_json({"error": "unknown endpoint"}, 404)
        except Exception as e:
            traceback.print_exc()
            return self.send_json({"error": f"{type(e).__name__}: {e}"}, 500)

    def static(self, p):
        rel = "index.html" if p in ("/", "") else p.lstrip("/")
        path = os.path.normpath(os.path.join(STATIC, rel))
        if not path.startswith(STATIC) or not os.path.isfile(path):
            self.send_response(404)
            self.end_headers()
            return
        with open(path, "rb") as f:
            data = f.read()
        self.send_response(200)
        ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype.endswith("javascript"):
            ctype += "; charset=utf-8"
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)


def main():
    ap = argparse.ArgumentParser(description="WCN Virtual Lab web server")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--host", default="127.0.0.1")
    args = ap.parse_args()
    mimetypes.add_type("text/javascript", ".js")
    httpd = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"WCN Virtual Lab running at http://localhost:{args.port}  (Ctrl+C to stop)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
