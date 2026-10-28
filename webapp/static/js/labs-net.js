/* WCN Virtual Lab - networking labs: WiFi scanner, WLAN security, Beacon analyser, TCP/UDP, Bluetooth */
"use strict";

const modeChip = live => live ? `<span class="chip ok">● LIVE: real hardware</span>` : `<span class="chip warn">DEMO DATA: lab server offline</span>`;
const sigColor = dbm => dbm >= -50 ? "var(--ok)" : dbm >= -60 ? "var(--c3)" : dbm >= -70 ? "var(--warn)" : dbm >= -80 ? "var(--c6)" : "var(--bad)";
const qualityOf = dbm => dbm >= -50 ? "Excellent" : dbm >= -60 ? "Good" : dbm >= -70 ? "Fair" : dbm >= -80 ? "Weak" : "Very Weak";
const pctOf = dbm => Math.max(0, Math.min(100, 2 * (dbm + 100)));
const chFreq = ch => ch === 14 ? 2484 : ch <= 13 ? 2407 + 5 * ch : 5000 + 5 * ch;

/* =====================================================================
 * LAB 6 - WiFi scanner & RSSI analyser
 * ===================================================================== */
const DEMO_NETS = [
  ["CampusNet", "a4:2b:b0:11:22:01", -46, 6, "WPA2-Enterprise"], ["Lab-Staff", "a4:2b:b0:11:22:02", -58, 1, "WPA2-Personal"],
  ["Library_5G", "c8:3a:35:aa:10:24", -63, 36, "WPA3-Personal"], ["Guest-Open", "00:1d:7e:42:9c:10", -71, 11, "Open"],
  ["Hostel-B2", "f4:ec:38:77:aa:01", -79, 6, "WPA2-Personal"], ["CSE-Dept", "18:d6:c7:01:9e:33", -67, 149, "WPA2-Enterprise"],
  ["AndroidAP", "62:11:a9:0b:3c:4f", -84, 11, "WPA2-Personal"]];
function demoScan(t) {
  return DEMO_NETS.map(([ssid, bssid, r, ch, sec], i) => {
    const rssi = Math.round(r + 4 * Math.sin(t / 3 + i) + (Math.random() - .5) * 4);
    return { ssid, bssid, rssi, channel: ch, band: ch <= 14 ? "2.4 GHz" : "5 GHz", security: sec, quality: qualityOf(rssi), percent: pctOf(rssi), distance: +(10 ** ((20 - rssi + 27.55 - 20 * Math.log10(chFreq(ch))) / 20)).toFixed(1) };
  });
}

App.register({
  id: "wifi", num: 6, group: "net", icon: "📡", hardware: true,
  title: "WiFi Scanner &amp; RSSI Analyser",
  summary: "Scan the WiFi networks around you with your own adapter. View channel occupancy like a real WiFi analyser, track RSSI over time, and estimate distance with the free-space path loss model.",
  aim: "To scan and list nearby WiFi networks (SSID, BSSID, channel, band, security), and to analyse signal strength using RSSI: quality rating, estimated distance, channel congestion and statistics over time.",
  apparatus: "Laptop with WiFi adapter · Python 3 · <code>wifi_analyzer.py</code> (uses <code>netsh wlan</code> on Windows, <code>nmcli</code> on Linux)",
  theory: `
    <p><b>RSSI</b> (Received Signal Strength Indicator) is the received power in dBm. Typical WiFi values range from −30 dBm (next to the AP) to −90 dBm (unusable). Windows reports signal quality as a percentage, which the program maps linearly: dBm = %/2 − 100.</p>
    <table class="tbl" style="max-width:520px"><tr><th>RSSI</th><th>Quality</th><th>Use</th></tr>
    <tr><td>≥ −50 dBm</td><td>Excellent</td><td>Anything</td></tr><tr><td>−50 … −60</td><td>Good</td><td>Streaming, VoIP</td></tr>
    <tr><td>−60 … −70</td><td>Fair</td><td>Web browsing</td></tr><tr><td>−70 … −80</td><td>Weak</td><td>Unreliable</td></tr><tr><td>&lt; −80</td><td>Very weak</td><td>Drops</td></tr></table>
    <h3>Distance estimation: free-space path loss</h3>
    <div class="formula">FSPL(dB) = 20·log10(d_m) + 20·log10(f_MHz) − 27.55
d = 10^((Ptx − RSSI + 27.55 − 20·log10 f) / 20)        (Ptx ≈ 20 dBm)
Log-distance model:  PL(d) = PL(1 m) + 10·n·log10(d),   n ≈ 2 (free space) … 4 (indoor)</div>
    <h3>2.4 GHz channel overlap</h3>
    <p>2.4 GHz channels are 5 MHz apart but each signal is about 20 MHz wide, so a channel overlaps its ±4 neighbours. Only <b>1, 6 and 11</b> do not overlap. The program counts the APs within ±4 of each and recommends the least congested. 5 GHz channels (36, 40, … 165) do not overlap.</p>`,
  procedure: [
    "Make sure WiFi is turned on (on Windows 11, Location services must also be on for scanning).",
    "Press <b>Scan now</b> to list nearby networks with SSID, BSSID, channel, band, security and RSSI.",
    "Study the channel graph to see which channels are crowded, and note the recommended channel.",
    "Start <b>Monitor</b> to track RSSI over time. Walk around with the laptop and watch the curves change.",
    "Record min / max / average / standard deviation and stability for each network.",
    "Use the distance calculator to estimate the distance to an AP and compare it with reality."],
  result: "Nearby WiFi networks were scanned and their RSSI analysed. Signal quality, approximate distance and channel congestion were determined, and RSSI was seen to fluctuate over time because of multipath and movement.",
  viva: [
    ["What is RSSI and what are its units?", "Received Signal Strength Indicator: the received RF power, usually in dBm (decibels relative to 1 mW). It is a negative number; closer to 0 is stronger."],
    ["What is the difference between SSID and BSSID?", "The SSID is the human-readable network name. The BSSID is the MAC address of a particular AP radio. One SSID can have many BSSIDs (mesh or multiple APs and bands)."],
    ["Why are channels 1, 6 and 11 preferred in 2.4 GHz?", "They are the only three channels spaced 25 MHz apart, so their 20 MHz signals do not overlap."],
    ["Why is the distance estimate inaccurate indoors?", "Walls, floors, people and multipath add extra, variable loss. The path loss exponent is 3–4 instead of 2, and AP transmit power and antenna gains are unknown."],
    ["Why does RSSI fluctuate even when standing still?", "Multipath fading (constructive and destructive interference of reflections), people moving, interference, and the AP's power and rate adaptation."],
    ["What is the difference between 2.4 GHz and 5 GHz?", "2.4 GHz has better range and wall penetration but only 3 non-overlapping channels and more interference. 5 GHz has more channels and wider bandwidths (higher throughput) but shorter range."]],
  experiment(body) {
    const S = { interval: 3, filter: "", ptx: 20, n: 2, rssi: -60, freq: 2437 };
    let nets = [], hist = {}, timer = 0, scanning = false, sel = null, tick = 0;
    body.innerHTML = `
      <div class="panel"><div class="row">
        <button class="btn" id="scan">⟳ Scan now</button>
        <button class="btn ghost" id="mon">▶ Start monitor</button>
        <label class="row small">every <select data-k="interval"><option value="2">2 s</option><option value="3">3 s</option><option value="5">5 s</option><option value="10">10 s</option></select></label>
        <input type="text" data-k="filter" placeholder="Filter SSID…" style="width:160px">
        <span class="spacer"></span><span id="mode"></span><span id="scan-meta" class="muted small"></span></div></div>
      <div id="wifi-alert"></div>
      <div class="panel"><h3>Nearby networks <span class="spacer"></span><span id="count" class="muted"></span></h3><div class="tbl-wrap" id="nets"><div class="empty">Press <b>Scan now</b> to discover networks.</div></div></div>
      <div class="grid2">
        <div class="panel"><h3>2.4 GHz channel occupancy</h3><div id="ch24"></div><div id="rec" class="small muted"></div></div>
        <div class="panel"><h3>5 GHz channel occupancy</h3><div id="ch5"></div></div>
      </div>
      <div class="panel"><h3>RSSI over time (monitor) <span class="spacer"></span><span class="muted small">click a row above to highlight it</span></h3><div id="rt"></div></div>
      <div class="panel"><h3>RSSI statistics</h3><div class="tbl-wrap" id="stats"><div class="empty">Start the monitor to collect samples.</div></div></div>
      <div class="panel"><h3>Distance calculator (log-distance path loss)</h3>
        <div class="controls">${UI.slider("ptx", "AP transmit power", 0, 30, 1, "dBm")}${UI.slider("rssi", "Measured RSSI", -95, -30, 1, "dBm")}${UI.slider("freq", "Frequency", 2412, 5825, 5, "MHz")}${UI.slider("n", "Path-loss exponent n", 1.6, 4, 0.1)}</div>
        <div class="readouts" id="dist" style="margin-top:12px"></div></div>`;
    const p24 = new Plot($("#ch24", body), { height: 220 }), p5 = new Plot($("#ch5", body), { height: 220 }), pt = new Plot($("#rt", body), { height: 240 });
    $("#mode", body).innerHTML = modeChip(App.backend);

    const calc = () => {
      const pl = S.ptx - S.rssi, pl0 = 20 * Math.log10(S.freq) - 27.55;
      const d = 10 ** ((pl - pl0) / (10 * S.n)), dF = 10 ** ((pl - pl0) / 20);
      $("#dist", body).innerHTML = UI.readouts([["Path loss", `${pl} <small>dB</small>`], ["PL at 1 m", `${fmt(pl0, 1)} <small>dB</small>`], ["Distance (n = " + S.n + ")", `${fmt(d, 1)} <small>m</small>`], ["Free-space (n = 2)", `${fmt(dF, 1)} <small>m</small>`], ["Quality", qualityOf(S.rssi)]]);
    };
    const visible = () => nets.filter(n => !S.filter || n.ssid.toLowerCase().includes(S.filter.toLowerCase()));
    function render() {
      const list = visible().sort((a, b) => b.rssi - a.rssi);
      $("#count", body).textContent = `${list.length} BSSIDs`;
      $("#nets", body).innerHTML = list.length ? `<table class="tbl"><tr><th>#</th><th>SSID</th><th>BSSID</th><th>CH</th><th>Band</th><th>Security</th><th>RSSI</th><th>Signal</th><th>Quality</th><th>~Dist</th></tr>${list.map((n, i) => `
        <tr class="click ${sel === n.bssid ? "sel" : ""}" data-b="${n.bssid}"><td>${i + 1}</td><td><b>${esc(n.ssid)}</b></td><td class="mono">${n.bssid}</td><td class="mono">${n.channel}</td><td>${n.band}</td><td>${esc(n.security)}</td>
        <td class="mono">${n.rssi} dBm</td><td><span class="sigbar"><i style="width:${pctOf(n.rssi)}%;background:${sigColor(n.rssi)}"></i></span>${pctOf(n.rssi)}%</td>
        <td><span style="color:${sigColor(n.rssi)}">${n.quality}</span></td><td class="mono">${n.distance} m</td></tr>`).join("")}</table>`
        : `<div class="empty">No networks match.</div>`;
      $$("#nets tr[data-b]", body).forEach(r => r.onclick = () => { sel = sel === r.dataset.b ? null : r.dataset.b; render(); });
      // channel graphs
      const hump = (n, w) => { const xs = DSP.linspace(n.channel - w, n.channel + w, 30); return { x: xs, y: xs.map(x => -100 + (n.rssi + 100) * Math.max(0, 1 - ((x - n.channel) / w) ** 2)) }; };
      const draw = (p, arr, w, xlim, xf) => p.draw({
        series: arr.map((n, i) => ({ ...hump(n, w), color: cssVar(`--c${i % 8 + 1}`), width: sel === n.bssid ? 3 : 1.5, label: n.ssid, alpha: sel && sel !== n.bssid ? .35 : 1 })),
        labels: arr.map((n, i) => ({ x: n.channel, y: n.rssi, text: n.ssid, color: cssVar(`--c${i % 8 + 1}`) })), ylim: [-100, -20], xlim, xname: "channel", xfmt: xf, noSnap: true
      });
      const n24 = list.filter(n => n.channel >= 1 && n.channel <= 14), n5 = list.filter(n => n.channel > 14);
      draw(p24, n24, 2, [-1, 15], v => Number.isInteger(v) && v >= 1 && v <= 14 ? v : "");
      draw(p5, n5, 2, [30, 170]);
      const load = { 1: 0, 6: 0, 11: 0 };
      for (const c of [1, 6, 11]) load[c] = n24.filter(n => Math.abs(n.channel - c) <= 4).length;
      const best = Object.keys(load).sort((a, b) => load[a] - load[b])[0];
      const use = {}; list.forEach(n => use[n.channel] = (use[n.channel] || 0) + 1);
      $("#rec", body).innerHTML = list.length ? `Channel usage: ${Object.entries(use).map(([c, k]) => `ch${c}=${k}`).join(", ")}<br>APs overlapping 1 / 6 / 11: ${load[1]} / ${load[6]} / ${load[11]} → <b style="color:var(--ok)">least congested: channel ${best}</b>` : "";
      // history
      const keys = Object.keys(hist).filter(b => !S.filter || hist[b].ssid.toLowerCase().includes(S.filter.toLowerCase()))
        .sort((a, b) => DSP.mean(hist[b].s.map(s => s.r)) - DSP.mean(hist[a].s.map(s => s.r))).slice(0, 8);
      if (keys.length) {
        const t0 = Math.min(...keys.map(k => hist[k].s[0].t));
        pt.draw({ series: keys.map((k, i) => ({ x: hist[k].s.map(s => (s.t - t0) / 1000), y: hist[k].s.map(s => s.r), color: cssVar(`--c${i % 8 + 1}`), width: sel === k ? 3 : 1.6, label: hist[k].ssid })), ylim: [-100, -20], xname: "t (s)", xlabel: "Time (s)" });
        pt.setTitle(legend(keys.map((k, i) => [`--c${i % 8 + 1}`, hist[k].ssid])));
        $("#stats", body).innerHTML = `<table class="tbl"><tr><th>SSID</th><th>BSSID</th><th>Samples</th><th>Min</th><th>Max</th><th>Avg</th><th>StdDev</th><th>Quality</th><th>Stability</th></tr>${Object.entries(hist).map(([b, h]) => {
          const r = h.s.map(s => s.r), avg = DSP.mean(r), sd = DSP.std(r), stab = sd < 3 ? ["Stable", "ok"] : sd < 6 ? ["Moderate", "warn"] : ["Fluctuating", "bad"];
          return `<tr><td>${esc(h.ssid)}</td><td class="mono">${b}</td><td>${r.length}</td><td class="mono">${Math.min(...r)}</td><td class="mono">${Math.max(...r)}</td><td class="mono">${fmt(avg, 1)}</td><td class="mono">${fmt(sd, 2)}</td><td>${qualityOf(Math.round(avg))}</td><td><span class="chip ${stab[1]}">${stab[0]}</span></td></tr>`;
        }).join("")}</table>`;
      }
    }
    async function scan(record) {
      if (scanning) return; scanning = true;
      const btn = $("#scan", body); btn.disabled = true; btn.innerHTML = `<span class="spin"></span> Scanning…`;
      try {
        const r = App.backend ? await App.api("/api/wifi/scan") : { networks: demoScan(tick++), time: new Date().toLocaleTimeString() };
        nets = r.networks;
        $("#wifi-alert", body).innerHTML = !nets.length ? `<div class="alert warn">No networks found. Is WiFi on? On Windows 11, turn on <b>Settings › Privacy &amp; security › Location</b>; netsh needs it to scan.</div>` : "";
        $("#scan-meta", body).textContent = ` · last scan ${r.time}`;
        if (record) { const t = Date.now(); nets.forEach(n => { (hist[n.bssid] ||= { ssid: n.ssid, s: [] }).s.push({ t, r: n.rssi }); }); }
        render();
      } catch (e) { $("#wifi-alert", body).innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; }
      btn.disabled = false; btn.textContent = "⟳ Scan now"; scanning = false;
    }
    UI.bind(body, S, k => { if (["ptx", "rssi", "freq", "n"].includes(k)) calc(); else if (k === "interval" && timer) { stop(); start(); } else render(); });
    const start = () => { timer = setInterval(() => scan(true), S.interval * 1000); scan(true); const b = $("#mon", body); b.textContent = "■ Stop monitor"; b.classList.add("on"); b.classList.remove("ghost"); };
    const stop = () => { clearInterval(timer); timer = 0; const b = $("#mon", body); b.textContent = "▶ Start monitor"; b.classList.remove("on"); b.classList.add("ghost"); };
    $("#scan", body).onclick = () => scan(!!timer);
    $("#mon", body).onclick = () => timer ? stop() : start();
    calc(); scan(false);
    return () => { clearInterval(timer); [p24, p5, pt].forEach(p => p.destroy()); };
  },
});

/* =====================================================================
 * LAB 7 - WLAN security report
 * ===================================================================== */
const AUTH_MAP = {
  "open": ["Open", "Open System (no authentication)"], "shared": ["WEP", "Shared Key"],
  "wpa-personal": ["WPA", "PSK (Pre-Shared Key / password)"], "wpa-enterprise": ["WPA", "802.1X / EAP (RADIUS server)"],
  "wpa2-personal": ["WPA2", "PSK (Pre-Shared Key / password)"], "wpa2-enterprise": ["WPA2", "802.1X / EAP (RADIUS server)"],
  "wpa3-personal": ["WPA3", "SAE (Simultaneous Authentication of Equals)"], "wpa3-enterprise": ["WPA3", "802.1X / EAP (RADIUS server)"],
  "owe": ["Enhanced Open (OWE)", "OWE (Opportunistic Wireless Encryption)"]};
const CIPHER_MAP = { none: ["None (traffic unencrypted)", "Insecure"], wep: ["WEP (RC4)", "Insecure"], tkip: ["TKIP (RC4-based)", "Weak / deprecated"], ccmp: ["CCMP (AES-128)", "Strong"], gcmp: ["GCMP (AES)", "Strong"], "gcmp-256": ["GCMP-256 (AES-256)", "Strong"] };
function classify(auth, cipher) {   // port of wlan_security_report.classify()
  let [sec, am] = AUTH_MAP[auth.toLowerCase()] || [auth, auth];
  if (sec === "Open" && cipher.toLowerCase() === "wep") [sec, am] = ["WEP", "Open System + WEP key"];
  const [enc, strength] = CIPHER_MAP[cipher.toLowerCase()] || [cipher, "Unknown"];
  let verdict;
  if (sec === "Open" || sec === "WEP" || strength !== "Strong") verdict = strength === "Insecure" || sec === "Open" ? "INSECURE" : "WEAK";
  else if (sec === "WPA") verdict = "WEAK";
  else verdict = "SECURE";
  return { security: sec, auth: am, encryption: enc, verdict };
}
const verdictChip = v => `<span class="chip ${v === "SECURE" ? "ok" : v === "WEAK" ? "warn" : "bad"}">${v}</span>`;
const DEMO_WLAN = {
  connected: { ssid: "CampusNet", ...classify("WPA2-Enterprise", "CCMP"), channel: "6 (2.4 GHz)", bssid: "a4:2b:b0:11:22:01", radio: "802.11ax", signal: "92%", rssi: "-46", interface: "Wi-Fi - Intel(R) Wi-Fi 6 AX201" },
  nearby: [["CampusNet", "WPA2-Enterprise", "CCMP", "6 (2.4 GHz)", 3], ["Library_5G", "WPA3-Personal", "CCMP", "36 (5 GHz)", 1], ["Guest-Open", "Open", "None", "11 (2.4 GHz)", 1], ["OldLab", "Shared", "WEP", "6 (2.4 GHz)", 1], ["Legacy-AP", "WPA-Personal", "TKIP", "1 (2.4 GHz)", 1], ["Hostel-B2", "WPA2-Personal", "CCMP", "6 (2.4 GHz)", 2]]
    .map(([ssid, a, c, ch, aps]) => ({ ssid, ...classify(a, c), channel: ch, aps, signal: Math.round(40 + Math.random() * 55) + "%", raw_auth: a, raw_cipher: c }))};

App.register({
  id: "wlan", num: 7, group: "net", icon: "🔐", hardware: true,
  title: "WLAN Security Configuration Report",
  summary: "Audit the security of the WLAN you are connected to and every network nearby: security type, authentication, encryption cipher and channel, with a SECURE / WEAK / INSECURE verdict for each.",
  aim: "To report the SSID, security type, authentication method, encryption method and channel of the connected WLAN and all nearby WLANs, and to assess the strength of each configuration.",
  apparatus: "Windows laptop with WiFi · Python 3 · <code>wlan_security/wlan_security_report.py</code> (uses <code>netsh wlan show interfaces / networks</code>)",
  theory: `
    <p>WLAN security has three parts: <b>authentication</b> (who may join), <b>key management</b> (how session keys are derived) and <b>encryption</b> (how frames are protected).</p>
    <table class="tbl"><tr><th>Standard</th><th>Authentication</th><th>Encryption</th><th>Status</th></tr>
    <tr><td>Open</td><td>None</td><td>None</td><td>${verdictChip("INSECURE")}</td></tr>
    <tr><td>WEP (1997)</td><td>Open / Shared Key</td><td>RC4, 24-bit IV</td><td>${verdictChip("INSECURE")} cracked in minutes</td></tr>
    <tr><td>WPA (2003)</td><td>PSK / 802.1X</td><td>TKIP (RC4 + per-packet key, MIC)</td><td>${verdictChip("WEAK")} deprecated</td></tr>
    <tr><td>WPA2 (2004)</td><td>PSK / 802.1X-EAP</td><td>CCMP (AES-128 CTR + CBC-MAC)</td><td>${verdictChip("SECURE")} if strong passphrase</td></tr>
    <tr><td>WPA3 (2018)</td><td>SAE (Dragonfly) / 802.1X-192</td><td>CCMP / GCMP-256</td><td>${verdictChip("SECURE")} forward secrecy</td></tr>
    <tr><td>OWE / Enhanced Open</td><td>None (Diffie-Hellman)</td><td>CCMP</td><td>Encrypted open networks</td></tr></table>
    <h3>Personal vs Enterprise</h3>
    <p><b>Personal (PSK)</b>: one shared passphrase. The PMK is derived from the passphrase and SSID by PBKDF2. A captured 4-way handshake allows offline dictionary attacks (WPA2), which WPA3-SAE prevents.<br>
    <b>Enterprise (802.1X/EAP)</b>: each user authenticates against a RADIUS server (EAP-TLS, PEAP…) and gets a unique key.</p>
    <h3>4-way handshake</h3>
    <div class="formula">PTK = PRF(PMK, ANonce, SNonce, AP MAC, STA MAC)
AP → STA : ANonce
STA → AP : SNonce + MIC
AP → STA : GTK (encrypted) + MIC
STA → AP : ACK</div>`,
  procedure: [
    "Connect the laptop to a WLAN.",
    "Press <b>Generate report</b>. The connected network's negotiated settings appear in section 1.",
    "Section 2 lists every nearby network's advertised settings with its verdict.",
    "Note any network whose advertised and negotiated security differ.",
    "Use the configuration analyser to check the verdict for each combination of authentication and cipher.",
    "Write down recommendations for each insecure or weak network."],
  result: "The security configuration of the connected and nearby WLANs was reported and assessed. Open and WEP networks were found insecure, TKIP/WPA weak, and WPA2/WPA3 with CCMP/GCMP secure.",
  viva: [
    ["Why is WEP insecure?", "It uses a 24-bit IV that repeats quickly, RC4 key scheduling weaknesses (FMS/PTW attacks) and a CRC-32 integrity check, so the key can be recovered from captured traffic in minutes."],
    ["What is the difference between TKIP and CCMP?", "TKIP is a stop-gap that wraps RC4 with per-packet keys and the Michael MIC so old hardware could run it. CCMP uses AES in counter mode with CBC-MAC and is far stronger."],
    ["What does WPA3-SAE improve?", "SAE (a Dragonfly key exchange) resists offline dictionary attacks and provides forward secrecy. Management Frame Protection (802.11w) is mandatory."],
    ["What is 802.1X?", "Port-based network access control. The client (supplicant) authenticates through the AP (authenticator) to a RADIUS server using EAP."],
    ["What is a PMK and a PTK?", "The Pairwise Master Key comes from the PSK or EAP. The Pairwise Transient Key is derived in the 4-way handshake from the PMK plus nonces and MACs, and encrypts unicast traffic."],
    ["Why can advertised and negotiated security differ?", "An AP in transition or mixed mode (e.g. WPA2/WPA3 or TKIP+CCMP) advertises several options. The client negotiates the best one it supports."]],
  experiment(body) {
    const S = { a: "WPA2-Personal", c: "CCMP" };
    body.innerHTML = `
      <div class="panel"><div class="row"><button class="btn" id="gen">📝 Generate report</button><span class="spacer"></span><span id="mode"></span></div></div>
      <div id="rep"><div class="empty">Press <b>Generate report</b> to audit your WLAN.</div></div>
      <div class="panel"><h3>Security configuration analyser</h3>
        <div class="controls">${UI.select("a", "Authentication (as reported by Windows)", Object.keys(AUTH_MAP).map(k => [k.replace(/(^|-)(\w)/g, (m, d, c) => d + c.toUpperCase()).replace("Wpa", "WPA").replace("Owe", "OWE"), k.replace(/(^|-)(\w)/g, (m, d, c) => d + c.toUpperCase()).replace("Wpa", "WPA").replace("Owe", "OWE")]))}
        ${UI.select("c", "Encryption / cipher", [["None", "None"], ["WEP", "WEP"], ["TKIP", "TKIP"], ["CCMP", "CCMP (AES)"], ["GCMP-256", "GCMP-256"]])}</div>
        <div id="an" style="margin-top:12px"></div></div>`;
    $("#mode", body).innerHTML = modeChip(App.backend);
    const advice = (r, a, c) => {
      const t = [];
      if (r.security === "Open") t.push("Traffic is sent in clear text. Anyone nearby can read it. Use WPA2/WPA3, or at least OWE (Enhanced Open).");
      if (r.security === "WEP") t.push("WEP can be cracked in minutes (IV reuse, RC4 weaknesses). Replace it immediately.");
      if (/tkip/i.test(c)) t.push("TKIP is deprecated and limits 802.11n/ac to 54 Mbps. Switch to CCMP (AES).");
      if (r.security === "WPA") t.push("WPA (v1) is obsolete. Upgrade to WPA2 or WPA3.");
      if (/wpa2-personal/i.test(a)) t.push("WPA2-PSK is only as strong as its passphrase: use 12+ random characters. A captured handshake allows offline guessing. Prefer WPA3-SAE.");
      if (/wpa3/i.test(a) && /tkip|wep|none/i.test(c)) t.push("Invalid combination: WPA3 requires CCMP or GCMP.");
      if (/enterprise/i.test(a) && r.verdict === "SECURE") t.push("Enterprise mode gives every user an individual key. Make sure clients validate the RADIUS server certificate.");
      if (/wpa3-personal/i.test(a) && r.verdict === "SECURE") t.push("WPA3-SAE resists offline dictionary attacks and provides forward secrecy. This is the best personal-mode option.");
      if (/owe/i.test(a)) t.push("OWE encrypts an open network but does not authenticate the AP, so an attacker can still run an evil twin.");
      return t;
    };
    const analyse = () => {
      const r = classify(S.a, S.c);
      $("#an", body).innerHTML = `<div class="readouts">${UI.readouts([["b. Security type", r.security], ["c. Authentication", r.auth], ["d. Encryption", r.encryption], ["Assessment", r.verdict, r.verdict === "SECURE" ? "ok" : r.verdict === "WEAK" ? "warn" : "bad"]])}</div>
        <ul class="small" style="margin:10px 0 0">${advice(r, S.a, S.c).map(t => `<li>${t}</li>`).join("")}</ul>`;
    };
    const card = (n, title, extra) => `<div class="panel"><h3>${title}<span class="spacer"></span>${verdictChip(n.verdict)}</h3>
      <table class="tbl"><tr><td style="width:220px">a. SSID</td><td><b>${esc(n.ssid)}</b></td></tr><tr><td>b. Security type</td><td>${esc(n.security)}</td></tr>
      <tr><td>c. Authentication method</td><td>${esc(n.auth)}</td></tr><tr><td>d. Encryption method</td><td>${esc(n.encryption)}</td></tr><tr><td>e. Channel</td><td>${esc(n.channel)}</td></tr>
      ${Object.entries(extra).map(([k, v]) => `<tr><td class="muted">${k}</td><td class="mono">${esc(v)}</td></tr>`).join("")}</table></div>`;
    $("#gen", body).onclick = async () => {
      const btn = $("#gen", body); btn.disabled = true; btn.innerHTML = `<span class="spin"></span> Querying netsh…`;
      try {
        const r = App.backend ? await App.api("/api/wlan/report") : DEMO_WLAN;
        const c = r.connected, mism = c && r.nearby.find(n => n.ssid === c.ssid && (n.raw_auth !== c.raw_auth || n.raw_cipher !== c.raw_cipher) && c.raw_auth);
        const counts = { SECURE: 0, WEAK: 0, INSECURE: 0 }; r.nearby.forEach(n => counts[n.verdict] = (counts[n.verdict] || 0) + 1);
        $("#rep", body).innerHTML = `
          <div class="readouts" style="margin-bottom:16px">${UI.readouts([["Networks found", r.nearby.length], ["Secure", counts.SECURE, "ok"], ["Weak", counts.WEAK, "warn"], ["Insecure", counts.INSECURE, "bad"]])}</div>
          ${c ? card(c, "[1] Connected network: negotiated settings", { "Interface": c.interface, "BSSID": c.bssid, "Radio type": c.radio, "Signal": `${c.signal} (RSSI ${c.rssi} dBm)` }) : `<div class="alert warn">[1] Not connected to any WLAN.</div>`}
          ${mism ? `<div class="alert info">Note: '${esc(c.ssid)}' advertises ${esc(mism.raw_auth)} / ${esc(mism.raw_cipher)}, but this connection negotiated ${esc(c.raw_auth)} / ${esc(c.raw_cipher)}.</div>` : ""}
          <div class="panel"><h3>[2] Nearby networks: advertised settings (${r.nearby.length})</h3><div class="tbl-wrap"><table class="tbl">
          <tr><th>a. SSID</th><th>b. Security</th><th>c. Authentication</th><th>d. Encryption</th><th>e. Channel</th><th>APs</th><th>Best signal</th><th>Assessment</th></tr>
          ${r.nearby.map(n => `<tr><td><b>${esc(n.ssid)}</b></td><td>${esc(n.security)}</td><td>${esc(n.auth)}</td><td>${esc(n.encryption)}</td><td>${esc(n.channel)}</td><td>${n.aps}</td><td class="mono">${esc(n.signal)}</td><td>${verdictChip(n.verdict)}</td></tr>`).join("")}
          </table></div></div>`;
      } catch (e) { $("#rep", body).innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; }
      btn.disabled = false; btn.textContent = "📝 Generate report";
    };
    UI.bind(body, S, analyse); analyse();
  },
});

/* =====================================================================
 * LAB 8 - Beacon frame analyser
 * ===================================================================== */
App.register({
  id: "beacon", num: 8, group: "net", icon: "🛰️", hardware: true,
  title: "802.11 Beacon Frame Analyser",
  summary: "Open a packet capture and dissect 802.11 beacon frames byte by byte, as in Wireshark: which AP sent each one, its channel, security, supported rates and beacon interval.",
  aim: "To capture or read 802.11 beacon frames and determine (a) the access point that sent each beacon, (b) its channel, (c) the advertised security mechanism, (d) the supported data rates and (e) the beacon interval.",
  apparatus: "Python 3 + Scapy · <code>beacon_analyzer/beacon_analyzer.py</code> · <code>sample_beacons.pcap</code> (built by <code>create_sample_pcap.py</code>) · a monitor-mode WiFi adapter for live capture",
  theory: `
    <p>An access point broadcasts a <b>beacon</b> (management frame, type 0, subtype 8) about every 102.4 ms so that stations can discover it and stay synchronised. Each beacon contains:</p>
    <div class="formula">Radiotap header   (added by the capturing card: channel frequency, signal dBm)
802.11 MAC header (24 B) : Frame Control | Duration | Addr1 = ff:ff:ff:ff:ff:ff | Addr2 = SA | Addr3 = BSSID | Seq
Fixed fields (12 B)      : Timestamp (8) | Beacon Interval (2, in TU) | Capability Info (2)
Tagged elements          : ID (1) | Length (1) | Value …</div>
    <table class="tbl"><tr><th>Question</th><th>Where it comes from</th></tr>
    <tr><td>a. Which AP</td><td>SSID element (ID 0) + BSSID (Addr3)</td></tr>
    <tr><td>b. Channel</td><td>DS Parameter Set (ID 3), or the radiotap frequency</td></tr>
    <tr><td>c. Security</td><td>RSN element (ID 48) → cipher and AKM suites; WPA vendor IE (ID 221, OUI 00:50:F2 type 1); Capability Privacy bit → WEP</td></tr>
    <tr><td>d. Data rates</td><td>Supported Rates (ID 1) + Extended Rates (ID 50), in units of 500 kbps; MSB = basic (mandatory) rate</td></tr>
    <tr><td>e. Beacon interval</td><td>Fixed field in Time Units, 1 TU = 1024 µs → 100 TU = 102.4 ms</td></tr></table>
    <h3>Rate encoding example</h3><div class="formula">0x82 = 1000 0010 → basic bit = 1, rate = 0x02 × 0.5 = 1 Mbps*
0x6C = 0110 1100 → basic bit = 0, rate = 108 × 0.5 = 54 Mbps</div>
    <h3>RSN AKM suites</h3><p>00-0F-AC:1 = 802.1X (Enterprise), :2 = PSK (WPA2-Personal), :8 = SAE (WPA3-Personal), :18 = OWE. Cipher 4 = CCMP-AES, 2 = TKIP.</p>`,
  procedure: [
    "Load the sample capture <code>sample_beacons.pcap</code>, or upload your own capture (from Wireshark or airodump-ng, in monitor mode).",
    "The AP summary table answers questions a–e for each access point.",
    "Click any beacon in the packet list to open its dissection.",
    "Hover over a field in the tree to highlight its bytes in the hex dump (and the other way round).",
    "Decode the rates and RSN element by hand from the hex, and verify them against the decoded values.",
    "For live capture: <code>sudo airmon-ng start wlan0</code>, then <code>python beacon_analyzer.py --iface wlan0mon</code>."],
  result: "Beacon frames were parsed and, for each AP, the SSID/BSSID, channel, security mechanism (Open, WEP, WPA, WPA2, WPA3), supported rates and beacon interval (100 TU = 102.4 ms) were determined.",
  viva: [
    ["What is a beacon frame?", "A periodic management frame (type 0, subtype 8) broadcast by an AP. It announces the SSID, capabilities, rates, channel and security, and carries a timestamp for TSF synchronisation."],
    ["What is a TU?", "A Time Unit = 1024 µs. The default beacon interval of 100 TU is 102.4 ms."],
    ["Why is monitor mode needed?", "In managed mode the card passes up only frames for its own network, as Ethernet frames. Monitor mode delivers every raw 802.11 frame with a radiotap header."],
    ["How do you identify WEP from a beacon?", "There is no RSN or WPA element, but the Privacy bit (0x0010) in Capability Info is set."],
    ["What does an asterisk on a rate mean?", "It is a basic (mandatory) rate: the MSB is set, and every station must support it to join the BSS."],
    ["What is a hidden SSID?", "The AP sends a zero-length (or null-filled) SSID in its beacons. The name still appears in probe responses, so it is not real security."]],
  experiment(body) {
    let data = null, cur = null;
    body.innerHTML = `
      <div class="panel"><div class="row">
        <button class="btn" id="sample">📂 Load sample_beacons.pcap</button>
        <label class="btn ghost">⬆ Upload .pcap<input type="file" id="up" accept=".pcap,.pcapng,.cap" hidden></label>
        <span class="spacer"></span><span id="meta" class="muted small"></span></div></div>
      <div id="bmsg">${App.backend ? `<div class="empty">Load a capture to begin.</div>` : `<div class="alert warn">The beacon analyser needs the lab server (it uses Scapy to read pcap files). Run <code>python webapp\\server.py</code>.</div>`}</div>
      <div id="bout" hidden>
        <div class="panel"><h3>Summary: access points</h3><div class="tbl-wrap" id="aps"></div></div>
        <div class="panel"><h3>Packet list (beacon frames)</h3><div class="tbl-wrap" id="pkts" style="max-height:300px;overflow:auto"></div></div>
        <div class="grid2"><div class="panel"><h3>Decoded beacon <span id="bn"></span></h3><div id="ans"></div><div class="tree" id="tree"></div></div>
        <div class="panel"><h3>Hex dump</h3><div class="hex" id="hex"></div></div></div>
      </div>`;
    const show = r => {
      data = r;
      if (!r.beacons.length) { $("#bmsg", body).innerHTML = `<div class="alert warn">No beacon frames found in this capture.</div>`; $("#bout", body).hidden = true; return; }
      $("#bmsg", body).innerHTML = ""; $("#bout", body).hidden = false;
      $("#meta", body).textContent = `${r.total} beacons from ${r.aps.length} APs`;
      $("#aps", body).innerHTML = `<table class="tbl"><tr><th>a. SSID</th><th>BSSID</th><th>b. CH</th><th>c. Security</th><th>Cipher / AKM</th><th>d. Rates (Mbps)</th><th>e. Interval</th><th>Signal</th><th>Beacons</th></tr>${r.aps.sort((a, b) => (a.channel || 0) - (b.channel || 0)).map(a => `
        <tr><td><b>${esc(a.ssid)}</b></td><td class="mono">${a.bssid}</td><td class="mono">${a.channel}</td><td>${esc(a.security.protocol)}</td><td class="small">${esc(a.security.cipher)} / ${esc(a.security.akm)}</td><td class="mono small">${a.rates.join(" ")}</td><td class="mono">${a.interval_tu} TU = ${fmt(a.interval_ms, 1)} ms</td><td class="mono">${a.signal ?? "–"} dBm</td><td>${a.count}</td></tr>`).join("")}</table>`;
      const t0 = r.beacons[0].time;
      $("#pkts", body).innerHTML = `<table class="tbl"><tr><th>No.</th><th>Time</th><th>Source (BSSID)</th><th>Destination</th><th>Protocol</th><th>Info</th></tr>${r.beacons.map((b, i) => `
        <tr class="click" data-i="${i}"><td>${b.index}</td><td class="mono">${fmt(b.time - t0, 6)}</td><td class="mono">${b.bssid}</td><td class="mono">Broadcast</td><td>802.11</td><td>Beacon frame, SSID="${esc(b.ssid)}", CH ${b.channel}, BI=${b.interval_tu}</td></tr>`).join("")}</table>`;
      $$("#pkts tr[data-i]", body).forEach(tr => tr.onclick = () => pick(+tr.dataset.i));
      pick(0);
    };
    const pick = i => {
      cur = data.beacons[i];
      $$("#pkts tr[data-i]", body).forEach(tr => tr.classList.toggle("sel", +tr.dataset.i === i));
      $("#bn", body).innerHTML = `<span class="chip info">#${cur.index}</span>`;
      const s = cur.security;
      $("#ans", body).innerHTML = `<table class="tbl" style="margin-bottom:10px"><tr><td>a. Access point</td><td><b>${esc(cur.ssid)}</b> <span class="mono small">(${cur.bssid})</span></td></tr><tr><td>b. Channel</td><td>${cur.channel} (${cur.channel <= 14 ? "2.4" : "5"} GHz)</td></tr>
        <tr><td>c. Security</td><td>${esc(s.protocol)}<br><span class="small muted">cipher = ${esc(s.cipher)}, AKM = ${esc(s.akm)}</span></td></tr><tr><td>d. Supported rates</td><td class="mono small">${cur.rates.join(", ")} Mbps <span class="muted">(* = basic)</span></td></tr>
        <tr><td>e. Beacon interval</td><td>${cur.interval_tu} TU = ${fmt(cur.interval_ms, 1)} ms</td></tr></table>`;
      let layer = "";
      $("#tree", body).innerHTML = cur.fields.map((f, k) => (f.layer !== layer ? `<div class="layer">▾ ${(layer = f.layer)}</div>` : "") + `<div class="fld" data-f="${k}"><span>${esc(f.name)}</span><span>${esc(f.value)}</span></div>`).join("");
      const bytes = cur.hex.match(/../g), owner = new Array(bytes.length).fill(-1);
      cur.fields.forEach((f, k) => { for (let j = f.start; j < f.start + f.len && j < bytes.length; j++) owner[j] = k; });
      let html = "";
      for (let o = 0; o < bytes.length; o += 16) html += `<span class="off">${o.toString(16).padStart(4, "0")}</span><span>${bytes.slice(o, o + 16).map((b, j) => `<span class="b" data-o="${owner[o + j]}">${b}</span>`).join(" ")}</span>`;
      $("#hex", body).innerHTML = html;
      const hl = k => { $$("#hex .b", body).forEach(b => b.classList.toggle("hl", b.dataset.o === String(k))); $$("#tree .fld", body).forEach(f => f.classList.toggle("hl", f.dataset.f === String(k))); };
      $$("#tree .fld", body).forEach(f => f.onmouseenter = () => hl(f.dataset.f));
      $$("#hex .b", body).forEach(b => b.onmouseenter = () => hl(b.dataset.o));
    };
    const load = async (p) => {
      $("#bmsg", body).innerHTML = `<div class="empty"><span class="spin"></span> Parsing capture with Scapy…</div>`;
      try { show(await p); } catch (e) { $("#bmsg", body).innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; }
    };
    $("#sample", body).onclick = () => load(App.api("/api/beacon/sample"));
    $("#up", body).onchange = async e => { const f = e.target.files[0]; if (f) load(App.api("/api/beacon/upload", { body: await f.arrayBuffer(), raw: true })); };
    if (App.backend) $("#sample", body).click();
  },
});

/* =====================================================================
 * LAB 9 - TCP / UDP client-server
 * ===================================================================== */
App.register({
  id: "tcpudp", num: 9, group: "net", icon: "🔌", hardware: true,
  title: "TCP &amp; UDP Client–Server Communication",
  summary: "Start real TCP and UDP echo servers, connect clients from this browser (or from a friend's laptop on the same WiFi), exchange messages, and compare handshakes, RTT and reliability.",
  aim: "To implement connection-oriented (TCP) and connectionless (UDP) client–server communication over a wireless LAN and compare their behaviour and round-trip times.",
  apparatus: "Two laptops on the same WLAN (or one, using 127.0.0.1) · Python 3 · <code>tcp_udp_comm/server/*.py</code>, <code>tcp_udp_comm/client/*.py</code>",
  runNote: "The TCP/UDP programs are interactive (they wait for typed input), so this lab runs the same socket code from the Experiment tab instead. The Source tab shows the original programs.",
  theory: `
    <table class="tbl"><tr><th></th><th>TCP</th><th>UDP</th></tr>
    <tr><td>Connection</td><td>Connection-oriented (3-way handshake)</td><td>Connectionless</td></tr>
    <tr><td>Reliability</td><td>ACKs, retransmission, in-order delivery</td><td>Best effort: may be lost, duplicated or reordered</td></tr>
    <tr><td>Flow / congestion control</td><td>Yes (sliding window, cwnd)</td><td>No</td></tr>
    <tr><td>Data unit</td><td>Byte stream (no message boundaries)</td><td>Datagram (boundaries kept)</td></tr>
    <tr><td>Header</td><td>20–60 bytes</td><td>8 bytes</td></tr>
    <tr><td>Socket calls</td><td>socket → bind → listen → accept / connect → send/recv</td><td>socket → bind → sendto / recvfrom</td></tr>
    <tr><td>Uses</td><td>HTTP, SSH, FTP, email</td><td>DNS, DHCP, VoIP, video streaming, gaming</td></tr></table>
    <h3>TCP connection life-cycle</h3>
    <div class="formula">Client                Server
  SYN  (seq=x)      →
                    ←  SYN-ACK (seq=y, ack=x+1)
  ACK  (ack=y+1)    →        … connection ESTABLISHED …
  PSH  data         →
                    ←  ACK / PSH echo
  FIN               →        (4-way close: FIN, ACK, FIN, ACK)</div>
    <p><b>RTT</b> (round-trip time) is measured from just before <code>send()</code> to the moment the reply arrives. Over WiFi it is typically 2–20 ms. On the loopback interface (127.0.0.1) it is well under 1 ms.</p>`,
  procedure: [
    "Start the TCP server on port 5000. The server console shows the LAN IP that other machines should use.",
    "In the client panel, choose TCP, enter the server IP (127.0.0.1 for this machine, or the LAN IP shown on another laptop) and press Connect. Note the handshake time.",
    "Send messages and note the echo reply and the RTT for each one. Send <code>exit</code> to close the connection.",
    "Start the UDP server on port 5001. Switch the client to UDP and send messages. Note that there is no connect step.",
    "Send a UDP message to a port with no server and observe the loss (no reply, no error from the network).",
    "Compare the average RTT and the behaviour of TCP and UDP in the statistics panel."],
  result: "TCP and UDP client–server communication was established over the WLAN. TCP needed a handshake and delivered every message reliably. UDP sent datagrams without a connection, with slightly lower RTT, but gave no delivery guarantee.",
  viva: [
    ["Why does TCP need a 3-way handshake?", "Both sides must exchange and acknowledge their initial sequence numbers to synchronise state and reject stale or duplicate connection requests."],
    ["Why does the server bind to 0.0.0.0?", "0.0.0.0 means all interfaces. The server accepts connections arriving on WiFi, Ethernet or loopback."],
    ["What is a socket?", "An endpoint of communication identified by (IP, port, protocol). A TCP connection is the 4-tuple (src IP, src port, dst IP, dst port)."],
    ["Why can't TCP preserve message boundaries?", "TCP is a byte stream, and the sender may coalesce or split writes. The program uses a newline delimiter to frame messages (<code>makefile().readline()</code>)."],
    ["What is the purpose of SO_REUSEADDR?", "It allows a restarted server to bind its port immediately, even while old connections are in TIME_WAIT."],
    ["When would you prefer UDP over TCP?", "When low latency matters more than reliability (VoIP, live video, games, DNS queries), or when the application implements its own reliability (QUIC)."],
    ["How does the server handle multiple TCP clients?", "accept() returns a new socket per client, and each is handled in its own thread, while the listening socket keeps accepting."]],
  experiment(body) {
    const S = { sproto: "TCP", sport: 5000, cproto: "TCP", host: "127.0.0.1", cport: 5000, msg: "Hello from client" };
    let sid = null, since = 0, poll = 0, arrows = [], rtts = [], hs = [], running = new Set(), sim = !App.backend, simSrvLog = [];
    body.innerHTML = `
      ${sim ? `<div class="alert warn">Lab server offline: this is an in-browser simulation. Run <code>python webapp\\server.py</code> to use real sockets.</div>` : ""}
      <div class="grid2">
        <div class="panel"><h3>🖥 Server <span class="spacer"></span><span id="sstate" class="chip muted">stopped</span></h3>
          <div class="controls">${UI.select("sproto", "Protocol", ["TCP", "UDP"])}<label class="ctl"><span class="lbl">Port</span><input type="number" data-k="sport" min="1024" max="65535"></label></div>
          <div class="row" style="margin:10px 0"><button class="btn" id="sstart">▶ Start server</button><button class="btn ghost" id="sstop">■ Stop</button><span class="muted small" id="sip"></span></div>
          <div class="terminal short" id="slog"><span class="dim">Server console</span>\n</div></div>
        <div class="panel"><h3>💻 Client <span class="spacer"></span><span id="cstate" class="chip muted">idle</span></h3>
          <div class="controls">${UI.select("cproto", "Protocol", ["TCP", "UDP"])}${UI.text("host", "Server IP")}<label class="ctl"><span class="lbl">Port</span><input type="number" data-k="cport" min="1" max="65535"></label></div>
          <div class="row" style="margin:10px 0"><button class="btn" id="conn">Connect</button><button class="btn ghost" id="disc">Disconnect</button></div>
          <div class="row" style="margin-bottom:10px"><input type="text" data-k="msg" style="flex:1" id="msgin"><button class="btn" id="send">Send ➤</button><button class="btn ghost" id="burst">×10</button></div>
          <div class="terminal short" id="clog"><span class="dim">Client console</span>\n</div></div>
      </div>
      <div class="grid2">
        <div class="panel"><h3>Packet exchange (conceptual segments for each real operation)</h3><svg class="seq" id="seq" viewBox="0 0 520 380"></svg></div>
        <div class="panel"><h3>Round-trip time</h3><div id="rttp"></div><div class="readouts" id="rstats" style="margin-top:12px"></div></div>
      </div>`;
    const rttPlot = new Plot($("#rttp", body), { height: 230 });
    const tlog = (id, cls, text) => { const t = $(id, body); t.insertAdjacentHTML("beforeend", `<span class="${cls}">[${new Date().toLocaleTimeString()}] ${esc(text)}</span>\n`); t.scrollTop = t.scrollHeight; };
    const cli = (t, c = "cli") => tlog("#clog", c, t);
    const srvState = () => { const any = [...running]; $("#sstate", body).className = `chip ${any.length ? "ok" : "muted"}`; $("#sstate", body).textContent = any.length ? "listening " + any.join(", ") : "stopped"; };
    const cliState = () => { const t = S.cproto === "UDP" ? ["connectionless", "info"] : sid ? ["ESTABLISHED", "ok"] : ["CLOSED", "muted"]; $("#cstate", body).className = `chip ${t[1]}`; $("#cstate", body).textContent = t[0]; $("#conn", body).style.display = $("#disc", body).style.display = S.cproto === "TCP" ? "" : "none"; };

    function drawSeq() {
      const svg = $("#seq", body), show = arrows.slice(-13), mut = cssVar("--muted"), txt = cssVar("--text");
      let h = `<text x="70" y="22" fill="${txt}" text-anchor="middle" font-weight="600" font-size="13">Client</text><text x="450" y="22" fill="${txt}" text-anchor="middle" font-weight="600" font-size="13">Server :${S.cport}</text>
        <line x1="70" y1="32" x2="70" y2="375" stroke="${mut}" stroke-dasharray="4 4"/><line x1="450" y1="32" x2="450" y2="375" stroke="${mut}" stroke-dasharray="4 4"/>`;
      show.forEach((a, i) => {
        const y = 50 + i * 25, r = a.dir > 0, x1 = r ? 72 : 448, x2 = r ? 440 : 80, col = cssVar(a.color || (a.proto === "UDP" ? "--c5" : "--c1"));
        const last = i === show.length - 1 && a.fresh;
        h += `<line x1="${x1}" y1="${y}" x2="${a.lost ? (x1 + x2) / 2 : x2}" y2="${y + 12}" stroke="${col}" stroke-width="1.8" ${last ? `stroke-dasharray="400" stroke-dashoffset="400"><animate attributeName="stroke-dashoffset" from="400" to="0" dur=".35s" fill="freeze"/></line>` : "/>"}
          ${a.lost ? `<text x="${(x1 + x2) / 2 + 6}" y="${y + 12}" fill="${cssVar("--bad")}" font-size="14">✗</text>` : `<polygon points="${x2},${y + 12} ${x2 + (r ? -7 : 7)},${y + 6} ${x2 + (r ? -8 : 8)},${y + 14}" fill="${col}"/>`}
          <text x="260" y="${y + 3}" fill="${col}" text-anchor="middle" font-size="11" font-family="monospace">${esc(a.label)}</text>`;
        a.fresh = false;
      });
      svg.innerHTML = h;
    }
    const arrow = (dir, label, extra = {}) => { arrows.push({ dir, label, proto: S.cproto, fresh: true, ...extra }); drawSeq(); };
    function stats() {
      const by = p => rtts.filter(r => r.p === p).map(r => r.v);
      const t = by("TCP"), u = by("UDP"), s = a => a.length ? `${fmt(DSP.mean(a), 3)} <small>ms</small>` : "–";
      rttPlot.draw({ series: [{ x: rtts.map((r, i) => i + 1).filter((_, i) => rtts[i].p === "TCP"), y: t, mode: "dots", r: 4, color: cssVar("--c1"), label: "TCP" }, { x: rtts.map((r, i) => i + 1).filter((_, i) => rtts[i].p === "UDP"), y: u, mode: "dots", r: 4, color: cssVar("--c5"), label: "UDP" }], xlim: [0, Math.max(10, rtts.length + 1)], yzero: true, xname: "msg #", xlabel: "Message number   (y: RTT ms)", noSnap: true });
      rttPlot.setTitle(legend([["--c1", "TCP"], ["--c5", "UDP"]]));
      $("#rstats", body).innerHTML = UI.readouts([["TCP messages", t.length], ["TCP avg RTT", s(t)], ["TCP min / max", t.length ? `${fmt(Math.min(...t), 2)} / ${fmt(Math.max(...t), 2)}` : "–"], ["Handshake avg", s(hs)], ["UDP messages", u.length], ["UDP avg RTT", s(u)], ["UDP lost", rtts.filter(r => r.p === "UDP-lost").length, "warn"]]);
    }
    // ---- simulated backend (offline) ----
    const simApi = {
      async start(p, port) { running.add(`${p}:${port}`); simSrvLog.push(`${p} server listening on 0.0.0.0:${port} [simulated]`); return { ip: "127.0.0.1" }; },
      async stop(p, port) { running.delete(`${p}:${port}`); simSrvLog.push(`${p} server on port ${port} stopped`); },
      async connect(h, port) { await sleep(3); if (!running.has(`TCP:${port}`)) throw new Error(`[WinError 10061] No connection could be made because the target machine actively refused it`); simSrvLog.push(`[+] Connected: 127.0.0.1:${50000 + rtts.length}`); return { sid: "sim", handshake_ms: .2 + Math.random() * .4, local: "127.0.0.1:" + (50000 + rtts.length) }; },
      async send(p, h, port, msg) {
        const l = .1 + Math.random() * .5; await sleep(2);
        if (!running.has(`${p}:${port}`)) { if (p === "UDP") return { reply: null, lost: true, note: "No reply within 2 s - UDP gives no delivery guarantee" }; throw new Error("connection lost"); }
        simSrvLog.push(`127.0.0.1 -> '${msg}'`); return { reply: msg.toLowerCase() === "exit" ? "BYE" : `[server ${new Date().toLocaleTimeString()}] echo: ${msg}`, rtt_ms: l, closed: msg.toLowerCase() === "exit" };
      },
      async close() { simSrvLog.push("[-] Disconnected"); },
    };
    const api = sim ? simApi : {
      start: (p, port) => App.api("/api/net/server/start", { body: { proto: p, port } }),
      stop: (p, port) => App.api("/api/net/server/stop", { body: { proto: p, port } }),
      connect: (h, port) => App.api("/api/net/connect", { body: { host: h, port } }),
      send: (p, h, port, msg) => App.api("/api/net/send", { body: { proto: p, host: h, port, msg, sid } }),
      close: () => App.api("/api/net/close", { body: { sid } }),
    };
    async function pollLog() {
      if (sim) { while (simSrvLog.length) tlog("#slog", "srv", simSrvLog.shift()); return; }
      try {
        const r = await App.api(`/api/net/log?since=${since}`);
        r.events.forEach(e => { since = e.n + 1; if (e.side === "server") tlog("#slog", "srv", `${e.text}`); });
      } catch { }
    }
    poll = setInterval(pollLog, 600);
    if (!sim) App.api("/api/net/servers").then(r => { r.servers.forEach(s => running.add(s)); $("#sip", body).textContent = `LAN IP: ${r.ip}`; srvState(); since = 0; });

    $("#sstart", body).onclick = async () => {
      try { const r = await api.start(S.sproto, S.sport); running.add(`${S.sproto}:${S.sport}`); $("#sip", body).textContent = `LAN IP: ${r.ip || "?"}`; srvState(); pollLog(); }
      catch (e) { tlog("#slog", "err", e.message); }
    };
    $("#sstop", body).onclick = async () => { await api.stop(S.sproto, S.sport).catch(() => { }); running.delete(`${S.sproto}:${S.sport}`); srvState(); pollLog(); };
    $("#conn", body).onclick = async () => {
      if (sid) return cli("Already connected.", "dim");
      try {
        cli(`connect(('${S.host}', ${S.cport}))  - 3-way handshake…`, "dim");
        const r = await api.connect(S.host, S.cport); sid = r.sid; hs.push(r.handshake_ms);
        arrow(1, "SYN  seq=x"); await sleep(120); arrow(-1, "SYN-ACK  seq=y ack=x+1"); await sleep(120); arrow(1, "ACK  ack=y+1");
        cli(`Connected to ${S.host}:${S.cport} from ${r.local} (handshake ${fmt(r.handshake_ms, 3)} ms)`);
      } catch (e) { cli(e.message, "err"); arrow(1, "SYN", { color: "--bad" }); await sleep(120); arrow(-1, "RST (port closed)", { color: "--bad" }); }
      cliState(); stats();
    };
    const disconnect = async () => {
      if (!sid) return;
      await api.close().catch(() => { }); sid = null;
      arrow(1, "FIN"); await sleep(100); arrow(-1, "ACK"); await sleep(100); arrow(-1, "FIN"); await sleep(100); arrow(1, "ACK");
      cli("Connection closed.", "dim"); cliState();
    };
    $("#disc", body).onclick = disconnect;
    async function send(msg) {
      if (!msg) return;
      try {
        if (S.cproto === "TCP") {
          if (!sid) return cli("Not connected. Press Connect first (TCP needs a connection).", "err");
          cli(`You: ${msg}`, "prompt");
          const r = await api.send("TCP", S.host, S.cport, msg);
          arrow(1, `PSH,ACK  len=${msg.length + 1}`); arrow(-1, `PSH,ACK  echo`);
          cli(`Server: ${r.reply}   (RTT ${fmt(r.rtt_ms, 3)} ms)`);
          if (msg.toLowerCase() !== "exit") rtts.push({ p: "TCP", v: r.rtt_ms });
          if (r.closed) { sid = null; arrow(-1, "FIN"); arrow(1, "ACK"); cli("Server closed the connection.", "dim"); cliState(); }
        } else {
          cli(`You: ${msg}`, "prompt");
          const r = await api.send("UDP", S.host, S.cport, msg);
          if (r.lost) { arrow(1, `UDP datagram ${msg.length} B`, { lost: true, proto: "UDP" }); cli(r.note, "err"); rtts.push({ p: "UDP-lost", v: 0 }); }
          else { arrow(1, `UDP datagram ${msg.length} B`); arrow(-1, "UDP reply"); cli(`Server: ${r.reply}   (RTT ${fmt(r.rtt_ms, 3)} ms)`); rtts.push({ p: "UDP", v: r.rtt_ms }); }
        }
      } catch (e) { cli(e.message, "err"); }
      stats(); pollLog();
    }
    $("#send", body).onclick = () => send(S.msg);
    $("#msgin", body).onkeydown = e => { if (e.key === "Enter") send(S.msg); };
    $("#burst", body).onclick = async () => { for (let i = 1; i <= 10; i++) await send(`${S.msg} #${i}`); };
    const bind = UI.bind(body, S, k => {
      if (k === "sproto") { bind.set("sport", S.sproto === "TCP" ? 5000 : 5001); }
      if (k === "cproto") { bind.set("cport", S.cproto === "TCP" ? 5000 : 5001); if (sid) disconnect(); }
      cliState(); if (k === "cport") drawSeq();
    });
    cliState(); srvState(); drawSeq(); stats();
    return () => { clearInterval(poll); if (sid && !sim) App.api("/api/net/close", { body: { sid } }).catch(() => { }); rttPlot.destroy(); };
  },
});

/* =====================================================================
 * LAB 10 - Bluetooth
 * ===================================================================== */
const DEMO_BT = [
  { address: "F4:7B:09:1C:22:A1", name: "Galaxy S23", kind: "Classic", type: "Phone", paired: true, rssi: null },
  { address: "38:18:4C:5E:90:12", name: "WH-1000XM4", kind: "Classic", type: "Audio/Video", paired: false, rssi: null },
  { address: "C2:4D:91:7A:33:0F", name: "Mi Smart Band 7", kind: "BLE", type: "Low Energy", paired: null, rssi: -62 },
  { address: "E8:9F:6D:12:45:7B", name: "<unknown>", kind: "BLE", type: "Low Energy", paired: null, rssi: -88 },
  { address: "D0:03:4B:22:6A:9C", name: "Tile", kind: "BLE", type: "Low Energy", paired: null, rssi: -74 }];

App.register({
  id: "bluetooth", num: 10, group: "net", icon: "🔷", hardware: true,
  title: "Bluetooth: Discovery, Services, Chat &amp; File Transfer",
  summary: "Discover nearby Classic and BLE devices with your Bluetooth radio, read a BLE device's GATT services, and run an RFCOMM chat and file transfer while watching the protocol stack and frequency hopping.",
  aim: "To discover nearby Bluetooth devices (MAC address and name), retrieve a device's information and services, and implement two-way chat and file transfer over Bluetooth RFCOMM.",
  apparatus: "Two Bluetooth-enabled computers/phones · Python 3 · <code>bleak</code> (BLE), WinRT/PyBluez (Classic) · <code>bluetooth/*.py</code>",
  runNote: "Runs <code>discover_devices.py --timeout 6</code> (Classic + BLE scan). Chat and file transfer need two paired machines; run them from a terminal using the commands shown in the Experiment tab.",
  theory: `
    <p>Bluetooth operates in the 2.4 GHz ISM band. <b>Classic (BR/EDR)</b> uses 79 × 1 MHz channels with <b>frequency hopping</b> at 1600 hops/s. <b>BLE</b> uses 40 × 2 MHz channels (3 advertising + 37 data). Devices form a <b>piconet</b>: one central (master) and up to 7 active peripherals (slaves).</p>
    <h3>Protocol stack</h3>
    <div class="formula">Application    chat / file transfer             GATT profiles
RFCOMM         serial-port emulation (ch 1–30)  ATT
L2CAP          multiplexing, segmentation       L2CAP (CID 0x0004)
HCI            host ↔ controller interface
Link Manager / Baseband / Radio   (FHSS, 79 ch)   LE Link Layer / PHY (40 ch)</div>
    <h3>Connection steps (Classic)</h3>
    <ol><li><b>Inquiry</b>: discover devices in range (address, name, class of device).</li><li><b>Paging</b>: connect to a specific address.</li><li><b>SDP</b>: look up which RFCOMM channel offers the service.</li><li><b>RFCOMM</b>: open a reliable stream, used like a TCP socket (<code>AF_BLUETOOTH, BTPROTO_RFCOMM</code>).</li></ol>
    <h3>File transfer protocol used in the program</h3>
    <div class="formula">Header : JSON {name, size, sha256}\\n
Data   : 4096-byte chunks
Reply  : OK / FAIL after the receiver checks the SHA-256 checksum</div>`,
  procedure: [
    "Turn Bluetooth on and make the other device discoverable.",
    "Press <b>Scan</b> to discover Classic and BLE devices. Note each one's MAC address, name, type and RSSI.",
    "Press <b>Info</b> on a BLE device to list its GATT services and characteristics.",
    "In the piconet simulator, go through inquiry, paging, SDP and RFCOMM, then chat. Watch each message travel down and up the stack.",
    "Send a file and verify the SHA-256 checksum on the receiving side.",
    "With two real machines: run <code>chat_server.py</code> on one and <code>chat_client.py MAC</code> on the other, then repeat with <code>file_receiver.py</code> / <code>file_sender.py</code>."],
  result: "Nearby Bluetooth devices were discovered and their services listed. Two-way chat and file transfer over RFCOMM were carried out, and the file's integrity was verified with SHA-256.",
  viva: [
    ["What is a piconet and a scatternet?", "A piconet is one master with up to 7 active slaves (255 parked) sharing a hopping sequence. A scatternet is several piconets linked by a device that belongs to more than one."],
    ["Why does Bluetooth use frequency hopping?", "Hopping 1600 times a second over 79 channels spreads the signal, avoids persistent interference from WiFi and microwaves, and allows many piconets to coexist."],
    ["What is RFCOMM?", "A transport protocol that emulates RS-232 serial ports over L2CAP. It provides a reliable stream, much like TCP."],
    ["What is SDP?", "The Service Discovery Protocol. A client queries the server's service records (UUIDs) to learn which RFCOMM channel or L2CAP PSM a service uses."],
    ["Difference between Classic and BLE?", "Classic suits continuous streaming (audio, file transfer, around 1–3 Mbps). BLE is designed for low power, small bursty data via GATT, and advertising beacons."],
    ["What is GATT?", "The Generic Attribute Profile: BLE data is organised into services, which contain characteristics, which have descriptors. All are identified by UUIDs and accessed through ATT read/write/notify."],
    ["What is the range of Bluetooth?", "Class 1 is ~100 m (100 mW), Class 2 ~10 m (2.5 mW), Class 3 ~1 m (1 mW)."]],
  experiment(body) {
    const S = { timeout: 6, chat: "" };
    let step = 0, hopTimer = 0, hop = 0;
    body.innerHTML = `
      <div class="panel"><h3>1 · Device discovery (inquiry scan) <span class="spacer"></span><span id="mode"></span></h3>
        <div class="row"><button class="btn" id="bscan">🔍 Scan</button><div style="width:220px">${UI.slider("timeout", "Scan time", 2, 15, 1, "s")}</div><span id="bmeta" class="muted small"></span></div>
        <div class="tbl-wrap" id="bdev" style="margin-top:12px"><div class="empty">Press Scan to discover nearby Bluetooth devices.</div></div></div>
      <div class="panel" id="binfo" hidden><h3>2 · Device information &amp; services</h3><div id="binfo-body"></div></div>
      <div class="panel"><h3>3 · Piconet simulator: RFCOMM chat &amp; file transfer</h3>
        <div class="row" style="margin-bottom:12px">
          <button class="btn small" data-step="1">① Inquiry</button><button class="btn small ghost" data-step="2">② Page / connect</button>
          <button class="btn small ghost" data-step="3">③ SDP lookup</button><button class="btn small ghost" data-step="4">④ Open RFCOMM ch 4</button>
          <span class="spacer"></span><span id="link" class="chip muted">no link</span></div>
        <div class="grid3">
          <div><b class="small">💻 Laptop (server)</b><div class="stackviz" id="stA" style="margin-top:6px"></div></div>
          <div><b class="small">Radio: 79 × 1 MHz channels, frequency hopping</b><div id="hopp"></div><div class="terminal" id="btlog" style="height:150px;margin-top:8px"></div></div>
          <div><b class="small">📱 Phone (client)</b><div class="stackviz" id="stB" style="margin-top:6px"></div></div>
        </div>
        <div class="grid2" style="margin-top:14px">
          <div><div class="chatbox" id="chatA"></div><div class="row" style="margin-top:6px"><input type="text" id="inA" placeholder="Laptop says…" style="flex:1"><button class="btn small" id="sendA">Send</button></div></div>
          <div><div class="chatbox" id="chatB"></div><div class="row" style="margin-top:6px"><input type="text" id="inB" placeholder="Phone says…" style="flex:1"><button class="btn small" id="sendB">Send</button></div></div>
        </div>
        <div style="margin-top:14px"><b class="small">File transfer (phone → laptop)</b>
          <div class="row" style="margin-top:6px"><input type="file" id="bfile"><span id="fmeta" class="small muted"></span></div>
          <div class="progress" style="margin-top:8px"><i id="fbar"></i></div><div id="fres" class="small" style="margin-top:6px"></div></div>
      </div>
      <div class="panel"><h3>Run with two real devices</h3><div class="terminal">${esc(`# Machine A (server)                          # Machine B (client)
python bluetooth\\chat\\chat_server.py            python bluetooth\\chat\\chat_client.py <A's MAC>
python bluetooth\\file_transfer\\file_receiver.py  python bluetooth\\file_transfer\\file_sender.py <A's MAC> photo.jpg
# Device info (scan and choose, or give a MAC)
python bluetooth\\device_info.py                  python bluetooth\\device_info.py C2:4D:91:7A:33:0F --ble`)}</div></div>`;
    $("#mode", body).innerHTML = modeChip(App.backend);
    const layers = ["Application", "RFCOMM", "L2CAP", "HCI", "Baseband / Radio"];
    ["#stA", "#stB"].forEach(id => $(id, body).innerHTML = layers.map(l => `<div data-l="${l}"><span>${l}</span><span class="muted small"></span></div>`).join(""));
    const hopPlot = new Plot($("#hopp", body), { height: 120 });
    const hopSeq = [];
    const drawHop = () => { hopPlot.draw({ series: [{ x: DSP.range(79, i => i), y: DSP.range(79, i => hopSeq.slice(-12).includes(i) ? (i === hopSeq[hopSeq.length - 1] ? 1 : .35) : 0.02), mode: "bars", barWidth: .9, color: cssVar("--accent") }], xlim: [-1, 79], ylim: [0, 1.1], xname: "channel (2402 + k MHz)", noSnap: true }); };
    const doHop = () => { hop = (hop * 37 + 11 + Math.floor(Math.random() * 7)) % 79; hopSeq.push(hop); if (hopSeq.length > 40) hopSeq.shift(); drawHop(); return hop; };
    drawHop();
    const blog = (t, c = "") => { const el = $("#btlog", body); el.insertAdjacentHTML("beforeend", `<span class="${c}">${esc(t)}</span>\n`); el.scrollTop = el.scrollHeight; };
    async function travel(from, to, label) {
      const A = $$(`${from} [data-l]`, body), B = $$(`${to} [data-l]`, body);
      for (const l of A) { l.classList.add("hot"); l.lastChild.textContent = label; await sleep(70); l.classList.remove("hot"); l.lastChild.textContent = ""; }
      const ch = doHop(); blog(`  hop → ch ${ch} (${2402 + ch} MHz)`, "dim");
      for (const l of B.reverse()) { l.classList.add("hot"); l.lastChild.textContent = label; await sleep(70); l.classList.remove("hot"); l.lastChild.textContent = ""; }
    }
    const steps = {
      1: async () => { blog("Phone: HCI_Inquiry (GIAC, 10.24 s)…"); for (let i = 0; i < 4; i++) { doHop(); await sleep(120); } blog("  found 'WCN-Laptop' 3C:A9:F4:12:34:56  class=Computer"); },
      2: async () => { blog("Phone: HCI_Create_Connection → 3C:A9:F4:12:34:56 (paging)"); await travel("#stB", "#stA", "PAGE"); blog("  ACL link up, role = central"); },
      3: async () => { blog("Phone: SDP ServiceSearchAttributeRequest UUID 0x1101 (Serial Port)"); await travel("#stB", "#stA", "SDP req"); await travel("#stA", "#stB", "SDP rsp"); blog("  → Serial Port service on RFCOMM channel 4"); },
      4: async () => { blog("Phone: L2CAP connect PSM 0x0003 → RFCOMM SABM ch 4"); await travel("#stB", "#stA", "SABM"); await travel("#stA", "#stB", "UA"); blog("  RFCOMM channel 4 OPEN. Chat ready.", ""); $("#link", body).className = "chip ok"; $("#link", body).textContent = "RFCOMM ch 4 open"; },
    };
    $$("[data-step]", body).forEach(b => b.onclick = async () => {
      const n = +b.dataset.step;
      if (n !== step + 1) { blog(n <= step ? "Step already done." : `Do step ${step + 1} first.`, "err"); return; }
      b.disabled = true; await steps[n](); step = n; b.disabled = false; b.classList.add("ghost");
      const nx = $(`[data-step="${n + 1}"]`, body); if (nx) nx.classList.remove("ghost");
    });
    const bubble = (box, me, text, who) => { const c = $(box, body); c.insertAdjacentHTML("beforeend", `<div class="msg ${me ? "me" : "them"}"><small>${who} · ${new Date().toLocaleTimeString()}</small>${esc(text)}</div>`); c.scrollTop = c.scrollHeight; };
    async function chat(side) {
      const inp = $(side === "A" ? "#inA" : "#inB", body), text = inp.value.trim();
      if (!text) return;
      if (step < 4) { blog("Open the RFCOMM channel first (steps ①–④).", "err"); return; }
      inp.value = "";
      const [me, them, fs, ts, nm] = side === "A" ? ["#chatA", "#chatB", "#stA", "#stB", "Laptop"] : ["#chatB", "#chatA", "#stB", "#stA", "Phone"];
      bubble(me, true, text, "You"); blog(`${nm} → RFCOMM UIH ${text.length + 1} B`);
      await travel(fs, ts, `"${text.slice(0, 10)}"`); bubble(them, false, text, nm);
    }
    $("#sendA", body).onclick = () => chat("A"); $("#sendB", body).onclick = () => chat("B");
    $("#inA", body).onkeydown = e => e.key === "Enter" && chat("A"); $("#inB", body).onkeydown = e => e.key === "Enter" && chat("B");
    const sha = async buf => crypto.subtle ? [...new Uint8Array(await crypto.subtle.digest("SHA-256", buf))].map(b => b.toString(16).padStart(2, "0")).join("") : "(SHA-256 needs https or localhost)";
    $("#bfile", body).onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      if (step < 4) { blog("Open the RFCOMM channel first (steps ①–④).", "err"); e.target.value = ""; return; }
      const buf = await f.arrayBuffer(), h = await sha(buf), chunks = Math.ceil(buf.byteLength / 4096) || 1, t0 = performance.now();
      $("#fmeta", body).textContent = `${f.name} · ${buf.byteLength} bytes · ${chunks} chunks of 4096 B`;
      blog(`Phone → header {"name":"${f.name}","size":${buf.byteLength},"sha256":"${h.slice(0, 16)}…"}`);
      await travel("#stB", "#stA", "header");
      const delay = Math.max(2, Math.min(60, 2500 / chunks));
      for (let i = 0; i < chunks; i++) {
        if (i % Math.max(1, Math.floor(chunks / 25)) === 0) doHop();
        $("#fbar", body).style.width = `${(i + 1) / chunks * 100}%`;
        await sleep(delay);
      }
      const rh = await sha(buf.slice(0)), ok = rh === h, secs = (performance.now() - t0) / 1000;
      await travel("#stA", "#stB", ok ? "OK" : "FAIL");
      $("#fres", body).innerHTML = `${ok ? `<span class="chip ok">✓ checksum verified</span>` : `<span class="chip bad">✗ checksum mismatch</span>`} Saved <b>received_${esc(f.name)}</b> · ${(buf.byteLength / 1024 / secs).toFixed(1)} KB/s (simulated)<br><span class="mono small muted">sent SHA-256: ${h}<br>recv SHA-256: ${rh}</span>`;
      blog(`Laptop: SHA-256 match → reply OK`);
      e.target.value = "";
    };
    // ---- real scan ----
    $("#bscan", body).onclick = async () => {
      const btn = $("#bscan", body); btn.disabled = true; btn.innerHTML = `<span class="spin"></span> Scanning ${S.timeout * 2}s…`;
      try {
        const r = App.backend ? await App.api(`/api/bt/scan?timeout=${S.timeout}`) : (await sleep(1200), { devices: DEMO_BT });
        $("#bmeta", body).textContent = `${r.devices.length} device(s)`;
        $("#bdev", body).innerHTML = r.devices.length ? `<table class="tbl"><tr><th>#</th><th>MAC address</th><th>Name</th><th>Kind</th><th>Type</th><th>RSSI</th><th>Paired</th><th></th></tr>${r.devices.map((d, i) => `
          <tr><td>${i + 1}</td><td class="mono">${d.address}</td><td><b>${esc(d.name)}</b></td><td><span class="chip ${d.kind === "BLE" ? "info" : "muted"}">${d.kind}</span></td><td>${esc(d.type)}</td>
          <td class="mono">${d.rssi != null ? `<span class="sigbar"><i style="width:${pctOf(d.rssi)}%;background:${sigColor(d.rssi)}"></i></span>${d.rssi} dBm` : "–"}</td><td>${d.paired === true ? "yes" : d.paired === false ? "no" : "–"}</td>
          <td><button class="btn small ghost" data-a="${d.address}" data-ble="${d.kind === "BLE" ? 1 : 0}">Info</button></td></tr>`).join("")}</table>`
          : `<div class="empty">No devices found. Is Bluetooth on and the other device discoverable?</div>`;
        $$("[data-a]", body).forEach(b => b.onclick = () => info(b.dataset.a, b.dataset.ble === "1", b));
      } catch (e) { $("#bdev", body).innerHTML = `<div class="alert bad">${esc(e.message)}</div>`; }
      btn.disabled = false; btn.textContent = "🔍 Scan";
    };
    async function info(addr, ble, btn) {
      const panelEl = $("#binfo", body), bb = $("#binfo-body", body); panelEl.hidden = false;
      bb.innerHTML = `<div class="empty"><span class="spin"></span> Querying ${addr} (${ble ? "BLE / GATT" : "Classic / SDP"})…</div>`;
      btn.disabled = true;
      try {
        const r = App.backend ? await App.api(`/api/bt/info?address=${encodeURIComponent(addr)}&ble=${ble ? 1 : 0}`)
          : { info: { "Device Name": "Mi Smart Band 7", "MAC Address": addr, "Device Type": "Bluetooth Low Energy - Watch (Appearance 0x00C0)" }, services: [{ uuid: "00001800-0000-1000-8000-00805f9b34fb", name: "Generic Access Profile", protocol: "L2CAP (CID 0x0004) -> ATT -> GATT", characteristics: ["Device Name [00002a00-…] (read)", "Appearance [00002a01-…] (read)"] }, { uuid: "0000180d-0000-1000-8000-00805f9b34fb", name: "Heart Rate", protocol: "L2CAP (CID 0x0004) -> ATT -> GATT", characteristics: ["Heart Rate Measurement [00002a37-…] (notify)"] }, { uuid: "0000180f-0000-1000-8000-00805f9b34fb", name: "Battery Service", protocol: "L2CAP (CID 0x0004) -> ATT -> GATT", characteristics: ["Battery Level [00002a19-…] (read, notify)"] }] };
        bb.innerHTML = `<table class="tbl" style="margin-bottom:12px">${Object.entries(r.info).map(([k, v]) => `<tr><td style="width:180px">${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join("")}</table>
          <b class="small">Available services: ${r.services.length}</b>${r.services.map((s, i) => `<details class="viva" style="margin-top:8px" ${i < 3 ? "open" : ""}><summary>[${i + 1}] ${esc(s.name)}</summary><div><span class="mono small">UUID ${esc(s.uuid)}</span><br>Protocol: ${esc(s.protocol)}${s.profile ? `<br>Profile: ${esc(s.profile)}` : ""}${(s.characteristics || []).length ? `<ul>${s.characteristics.map(c => `<li class="mono small">${esc(c)}</li>`).join("")}</ul>` : ""}</div></details>`).join("")}`;
      } catch (e) { bb.innerHTML = `<div class="alert bad">${esc(e.message)}<br><span class="small">BLE devices must be advertising and connectable. Classic devices usually need to be paired first.</span></div>`; }
      btn.disabled = false;
    }
    UI.bind(body, S, () => { });
    return () => { clearInterval(hopTimer); hopPlot.destroy(); };
  },
});
