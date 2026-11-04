/* 802.11 beacon parser in the browser: pcap / pcapng reader + a JavaScript port of
 * beacon_analyzer.py (security, rates, channel, interval) and a byte-level field map. */
"use strict";

const Beacon = (() => {
  const CIPHERS = { 0: "None", 1: "WEP-40", 2: "TKIP", 4: "CCMP-128 (AES)", 5: "WEP-104", 8: "GCMP-128", 9: "GCMP-256", 10: "CCMP-256" };
  const AKMS = { 1: "802.1X (Enterprise)", 2: "PSK", 3: "FT-802.1X", 4: "FT-PSK", 5: "802.1X-SHA256", 6: "PSK-SHA256", 8: "SAE", 9: "FT-SAE", 12: "802.1X-Suite-B-192", 18: "OWE" };
  const TAGS = { 0: "SSID", 1: "Supported Rates", 3: "DS Parameter Set (channel)", 5: "TIM", 7: "Country", 42: "ERP", 45: "HT Capabilities", 48: "RSN (WPA2/WPA3)", 50: "Extended Supported Rates", 61: "HT Operation", 127: "Extended Capabilities", 191: "VHT Capabilities", 221: "Vendor Specific" };
  const LINK_80211 = 105, LINK_RADIOTAP = 127;
  const hex = b => [...b].map(x => x.toString(16).padStart(2, "0"));
  const mac = b => hex(b).join(":");
  const u16 = (b, o) => b[o] | b[o + 1] << 8;

  /* ---------- capture files ---------- */
  function readCapture(buf) {
    const dv = new DataView(buf), magic = dv.getUint32(0, false);
    if (magic === 0x0A0D0D0A) return readPcapng(buf);
    const fmt = { 0xa1b2c3d4: [false, 1e6], 0xd4c3b2a1: [true, 1e6], 0xa1b23c4d: [false, 1e9], 0x4d3cb2a1: [true, 1e9] }[magic];
    if (!fmt) throw new Error("Not a pcap / pcapng file");
    const [le, res] = fmt, link = dv.getUint32(20, le), out = [];
    for (let o = 24; o + 16 <= buf.byteLength;) {
      const sec = dv.getUint32(o, le), frac = dv.getUint32(o + 4, le), incl = dv.getUint32(o + 8, le);
      o += 16;
      if (o + incl > buf.byteLength) break;
      out.push({ time: sec + frac / res, link, data: new Uint8Array(buf, o, incl) });
      o += incl;
    }
    return out;
  }
  function readPcapng(buf) {
    const dv = new DataView(buf), links = [], out = [];
    let le = true;
    for (let o = 0; o + 12 <= buf.byteLength;) {
      const type = dv.getUint32(o, le);
      if (type === 0x0A0D0D0A) le = dv.getUint32(o + 8, true) === 0x1A2B3C4D;
      const len = dv.getUint32(o + 4, le);
      if (len < 12 || o + len > buf.byteLength) break;
      if (type === 0x0A0D0D0A) links.length = 0;
      else if (type === 1) links.push(dv.getUint16(o + 8, le));
      else if (type === 6) {
        const ifc = dv.getUint32(o + 8, le), ts = dv.getUint32(o + 12, le) * 4294967296 + dv.getUint32(o + 16, le), cap = dv.getUint32(o + 20, le);
        out.push({ time: ts / 1e6, link: links[ifc], data: new Uint8Array(buf, o + 28, cap) });
      }
      o += len;
    }
    return out;
  }

  /* ---------- radiotap: flags, channel frequency, antenna signal ---------- */
  function radiotap(d) {
    const len = u16(d, 2), dv = new DataView(d.buffer, d.byteOffset, d.byteLength), out = { len, flags: 0, freq: null, signal: null };
    let p = 4;
    const present = dv.getUint32(p, true);
    while (dv.getUint32(p, true) & 0x80000000 && p + 8 <= len) p += 4;     // extended bitmaps
    p += 4;
    const field = (bit, align, size, read) => {
      if (!(present & (1 << bit))) return;
      p = Math.ceil(p / align) * align;
      if (p + size <= len) read(p);
      p += size;
    };
    field(0, 8, 8, () => { });                                   // TSFT
    field(1, 1, 1, q => { out.flags = d[q]; });                  // Flags
    field(2, 1, 1, () => { });                                   // Rate
    field(3, 2, 4, q => { out.freq = u16(d, q); });              // Channel
    field(4, 1, 2, () => { });                                   // FHSS
    field(5, 1, 1, q => { out.signal = dv.getInt8(q); });        // dBm antenna signal
    return out;
  }

  /* ---------- information elements (port of beacon_analyzer.py) ---------- */
  function parseSuites(d) {
    try {
      let p = 2;
      if (d.length < p + 6) throw 0;
      const group = CIPHERS[d[p + 3]] ?? `type ${d[p + 3]}`;
      p += 4;
      let n = u16(d, p); p += 2;
      if (p + 4 * n > d.length) throw 0;
      const pairwise = Array.from({ length: n }, (_, i) => CIPHERS[d[p + 4 * i + 3]] ?? "?");
      p += 4 * n;
      if (p + 2 > d.length) throw 0;
      n = u16(d, p); p += 2;
      if (p + 4 * n > d.length) throw 0;
      const akm = Array.from({ length: n }, (_, i) => AKMS[d[p + 4 * i + 3]] ?? "?");
      return [group, pairwise, akm];
    } catch { return ["?", [], []]; }
  }
  function securityOf(els, cap) {
    const rsn = els.find(([id]) => id === 48)?.[1];
    const wpaEl = els.find(([id, info]) => id === 221 && info[0] === 0x00 && info[1] === 0x50 && info[2] === 0xf2 && info[3] === 0x01);
    const wpa = wpaEl ? wpaEl[1].subarray(4) : null, privacy = !!(cap & 0x0010);
    let group, pairwise, akm, proto;
    if (rsn) {
      [group, pairwise, akm] = parseSuites(rsn);
      if (akm.includes("SAE") && akm.includes("PSK")) proto = "WPA2/WPA3-Personal (transition)";
      else if (akm.includes("SAE") || akm.includes("FT-SAE")) proto = "WPA3-Personal";
      else if (akm.includes("OWE")) proto = "OWE (Enhanced Open)";
      else if (akm.some(a => a.includes("802.1X"))) proto = "WPA2-Enterprise";
      else proto = "WPA2-Personal";
      if (wpa) proto = "WPA/" + proto;
    } else if (wpa) {
      [group, pairwise, akm] = parseSuites(wpa);
      proto = akm.includes("PSK") ? "WPA-Personal" : "WPA-Enterprise";
    } else if (privacy) return { protocol: "WEP", cipher: "WEP", akm: "Open/Shared Key" };
    else return { protocol: "Open (no encryption)", cipher: "-", akm: "-" };
    return { protocol: proto, cipher: pairwise.join(", ") || group, akm: akm.join(", ") };
  }
  const rateList = info => [...info].map(b => `${(b & 0x7f) / 2}${b & 0x80 ? "*" : ""}`);

  /* ---------- one frame ---------- */
  function parse({ data: d, link }) {
    let rt = { len: 0, flags: 0, freq: null, signal: null };
    if (link === LINK_RADIOTAP) rt = radiotap(d);
    else if (link !== LINK_80211) return null;
    const end = rt.flags & 0x10 ? d.length - 4 : d.length;        // strip FCS
    const f = d.subarray(rt.len, end);
    if (f.length < 36 || ((f[0] >> 2) & 3) !== 0 || (f[0] >> 4) !== 8) return null;   // management / beacon
    const els = [];
    for (let o = 36; o + 2 <= f.length;) {
      const id = f[o], ln = f[o + 1];
      if (o + 2 + ln > f.length) break;
      els.push([id, f.subarray(o + 2, o + 2 + ln), o]);
      o += 2 + ln;
    }
    const ssidB = els.find(([id]) => id === 0)?.[1] || new Uint8Array();
    const ssid = ssidB.some(b => b) ? new TextDecoder().decode(ssidB) : "<hidden>";
    const interval = u16(f, 32), cap = u16(f, 34);
    const ds = els.find(([id, info]) => id === 3 && info.length)?.[1];
    let channel = ds ? ds[0] : null;
    if (channel === null && rt.freq) channel = rt.freq === 2484 ? 14 : rt.freq < 3000 ? Math.floor((rt.freq - 2407) / 5) : Math.floor((rt.freq - 5000) / 5);

    // byte-level field map (offsets in the full captured frame)
    const B = rt.len, fields = [];
    if (rt.len) fields.push({ layer: "Radiotap", name: "Radiotap header", start: 0, len: rt.len, value: `${rt.len} bytes (capture metadata${rt.freq ? `: ${rt.freq} MHz` : ""}${rt.signal !== null ? `, ${rt.signal} dBm` : ""})` });
    [["Frame Control", 0, 2, `0x${hex(f.subarray(0, 2)).join("")} (type=Management, subtype=8 Beacon)`], ["Duration", 2, 2, `${u16(f, 2)} us`],
    ["Addr1 / Destination", 4, 6, mac(f.subarray(4, 10))], ["Addr2 / Source", 10, 6, mac(f.subarray(10, 16))], ["Addr3 / BSSID", 16, 6, mac(f.subarray(16, 22))],
    ["Sequence Control", 22, 2, `seq ${u16(f, 22) >> 4}`]].forEach(([name, o, len, value]) => fields.push({ layer: "802.11 MAC header", name, start: B + o, len, value }));
    const ts = new DataView(f.buffer, f.byteOffset + 24, 8).getBigUint64(0, true);
    fields.push({ layer: "Fixed parameters", name: "Timestamp", start: B + 24, len: 8, value: `${ts} us` });
    fields.push({ layer: "Fixed parameters", name: "Beacon Interval", start: B + 32, len: 2, value: `${interval} TU = ${(interval * 1.024).toFixed(1)} ms` });
    fields.push({ layer: "Fixed parameters", name: "Capability Info", start: B + 34, len: 2, value: `0x${cap.toString(16).padStart(4, "0")} (Privacy=${cap & 0x10 ? 1 : 0})` });
    for (const [id, info, o] of els) {
      const value = id === 0 ? `'${new TextDecoder().decode(info)}'` : id === 1 || id === 50 ? rateList(info).join(", ") + " Mbps" : id === 3 && info.length ? `channel ${info[0]}` : hex(info).join(" ");
      fields.push({ layer: "Tagged parameters", name: `Tag ${id}: ${TAGS[id] || "Element"}`, start: B + o, len: info.length + 2, value });
    }
    if (end < d.length) fields.push({ layer: "Trailer", name: "Frame Check Sequence", start: end, len: 4, value: hex(d.subarray(end)).join("") });

    return {
      ssid, bssid: mac(f.subarray(16, 22)), channel, security: securityOf(els, cap),
      rates: els.filter(([id]) => id === 1 || id === 50).flatMap(([, info]) => rateList(info)),
      interval_tu: interval, interval_ms: interval * 1.024, signal: rt.signal,
      hex: hex(d).join(""), fields,
    };
  }

  function analyse(buf) {
    const beacons = [], aps = {};
    readCapture(buf).forEach((fr, i) => {
      const b = parse(fr);
      if (!b) return;
      b.index = i + 1; b.time = fr.time;
      beacons.push(b);
      const a = aps[b.bssid] ||= { ssid: b.ssid, bssid: b.bssid, channel: b.channel, security: b.security, rates: b.rates, interval_tu: b.interval_tu, interval_ms: b.interval_ms, signal: b.signal, count: 0 };
      a.count++;
    });
    return { beacons: beacons.slice(0, 500), aps: Object.values(aps), total: beacons.length };
  }

  return { analyse };
})();
