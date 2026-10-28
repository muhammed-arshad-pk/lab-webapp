/* WCN Virtual Lab - core: router, lab pages, UI controls, plotting, DSP helpers */
"use strict";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const fmt = (v, d = 2) => (v === undefined || v === null || Number.isNaN(v)) ? "–" : (Math.abs(v) >= 1e4 ? v.toExponential(2) : (+v).toFixed(d));
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* =====================================================================
 * DSP helpers
 * ===================================================================== */
const DSP = {
  range(n, f = i => i) { const a = new Array(n); for (let i = 0; i < n; i++) a[i] = f(i); return a; },
  linspace(a, b, n) { return DSP.range(n, i => a + (b - a) * i / (n - 1)); },
  rng(seed) {                       // mulberry32 - repeatable "np.random.seed"
    let s = seed >>> 0;
    const next = () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    let spare = null;
    next.randn = () => {
      if (spare !== null) { const v = spare; spare = null; return v; }
      let u = 0, v = 0; while (u === 0) u = next(); v = next();
      const m = Math.sqrt(-2 * Math.log(u)); spare = m * Math.sin(2 * Math.PI * v); return m * Math.cos(2 * Math.PI * v);
    };
    next.int = n => Math.floor(next() * n);
    return next;
  },
  fft(re, im, inverse = false) {    // in-place radix-2
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = 2 * Math.PI / len * (inverse ? 1 : -1), wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k, b = a + len / 2;
          const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
    if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  },
  spectrum(sig, fs, fmax) {         // single-sided magnitude spectrum
    let n = 1; while (n < sig.length) n <<= 1;
    const re = new Float64Array(n), im = new Float64Array(n); re.set(sig);
    DSP.fft(re, im);
    const f = [], m = [], df = fs / n;
    for (let k = 0; k <= n / 2 && k * df <= fmax; k++) { f.push(k * df); m.push(2 * Math.hypot(re[k], im[k]) / sig.length); }
    return { f, m };
  },
  mean: a => a.reduce((s, v) => s + v, 0) / (a.length || 1),
  std(a) { const m = DSP.mean(a); return Math.sqrt(DSP.mean(a.map(v => (v - m) ** 2))); },
  bin: (v, n) => v.toString(2).padStart(n, "0"),
};

/* =====================================================================
 * Plot - small canvas oscilloscope with hover readout
 * ===================================================================== */
function niceStep(range, target = 6) {
  const raw = range / target, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}
function tickLabel(v, step) {
  const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
  return (Math.abs(v) < step / 1e6 ? 0 : v).toFixed(Math.min(d, 4));
}

class Plot {
  constructor(parent, { height = 170, title = "" } = {}) {
    this.height = height;
    this.el = document.createElement("div");
    this.el.className = "plot";
    this.el.innerHTML = `<div class="plot-title"></div><canvas></canvas>`;
    this.titleEl = this.el.firstChild;
    this.setTitle(title);
    this.canvas = this.el.querySelector("canvas");
    this.ctx = this.canvas.getContext("2d");
    parent.appendChild(this.el);
    this.ro = new ResizeObserver(() => this.cfg && this.draw(this.cfg));
    this.ro.observe(this.canvas);
    this.canvas.addEventListener("mousemove", e => this.hover(e));
    this.canvas.addEventListener("mouseleave", () => { App.tooltip(null); this.cfg && this.render(); });
  }
  setTitle(html) { this.titleEl.innerHTML = html; this.titleEl.style.display = html ? "" : "none"; }
  draw(cfg) { this.cfg = cfg; this.render(); }
  render(cursor) {
    const cfg = this.cfg, c = this.canvas, ctx = this.ctx, dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth || 600, H = cfg.height || this.height;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); c.style.height = H + "px";
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const series = cfg.series || [];
    let [x0, x1] = cfg.xlim || [Infinity, -Infinity], [y0, y1] = cfg.ylim || [Infinity, -Infinity];
    if (!cfg.xlim || !cfg.ylim) for (const s of series) for (let i = 0; i < s.y.length; i++) {
      const x = s.x ? s.x[i] : i, y = s.y[i];
      if (!cfg.xlim) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
      if (!cfg.ylim && Number.isFinite(y)) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (!Number.isFinite(x0)) { x0 = 0; x1 = 1; }
    if (!Number.isFinite(y0)) { y0 = -1; y1 = 1; }
    if (!cfg.ylim) { const pad = (y1 - y0) * 0.1 || 0.5; y0 -= pad; y1 += pad; if (cfg.yzero) y0 = Math.min(y0, 0); }
    if (x1 === x0) x1 = x0 + 1;
    const L = 46, R = 12, T = 10, B = cfg.xlabel ? 34 : 22;
    let pw = W - L - R, ph = H - T - B;
    if (cfg.equal) {
      const sx = pw / (x1 - x0), sy = ph / (y1 - y0), s = Math.min(sx, sy);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      x0 = cx - pw / s / 2; x1 = cx + pw / s / 2; y0 = cy - ph / s / 2; y1 = cy + ph / s / 2;
    }
    const X = x => L + (x - x0) / (x1 - x0) * pw, Y = y => T + (1 - (y - y0) / (y1 - y0)) * ph;
    this.map = { X, Y, x0, x1, y0, y1, L, T, pw, ph, W, H };

    const grid = cssVar("--plot-grid"), axis = cssVar("--plot-axis"), muted = cssVar("--muted"), text = cssVar("--text");
    ctx.font = "10px " + cssVar("--mono");
    // spans
    for (const s of cfg.spans || []) {
      ctx.fillStyle = s.color || "rgba(251,191,36,.18)";
      ctx.fillRect(X(s.x0), T, X(s.x1) - X(s.x0), ph);
    }
    // grid + ticks
    const xs = niceStep(x1 - x0, Math.max(3, pw / 90)), ys = niceStep(y1 - y0, Math.max(2, ph / 40));
    ctx.strokeStyle = grid; ctx.lineWidth = 1; ctx.fillStyle = muted;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (let v = Math.ceil(x0 / xs) * xs; v <= x1 + xs * 1e-9; v += xs) {
      const px = Math.round(X(v)) + .5; ctx.beginPath(); ctx.moveTo(px, T); ctx.lineTo(px, T + ph); ctx.stroke();
      ctx.fillText(cfg.xfmt ? cfg.xfmt(v) : tickLabel(v, xs), px, T + ph + 4);
    }
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for (let v = Math.ceil(y0 / ys) * ys; v <= y1 + ys * 1e-9; v += ys) {
      const py = Math.round(Y(v)) + .5; ctx.beginPath(); ctx.moveTo(L, py); ctx.lineTo(L + pw, py); ctx.stroke();
      ctx.fillText(tickLabel(v, ys), L - 5, py);
    }
    ctx.strokeStyle = axis;
    if (y0 < 0 && y1 > 0) { ctx.beginPath(); ctx.moveTo(L, Y(0)); ctx.lineTo(L + pw, Y(0)); ctx.stroke(); }
    if (cfg.equal && x0 < 0 && x1 > 0) { ctx.beginPath(); ctx.moveTo(X(0), T); ctx.lineTo(X(0), T + ph); ctx.stroke(); }
    ctx.strokeRect(L + .5, T + .5, pw, ph);
    if (cfg.xlabel) { ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillStyle = muted; ctx.fillText(cfg.xlabel, L + pw / 2, H - 2); }
    for (const v of cfg.vlines || []) {
      const px = Math.round(X(v)) + .5; if (px < L || px > L + pw) continue;
      ctx.strokeStyle = axis; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(px, T); ctx.lineTo(px, T + ph); ctx.stroke(); ctx.setLineDash([]);
    }
    for (const hl of cfg.hlines || []) {
      const v = typeof hl === "number" ? hl : hl.y;
      ctx.strokeStyle = hl.color || axis; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(L, Y(v)); ctx.lineTo(L + pw, Y(v)); ctx.stroke(); ctx.setLineDash([]);
    }

    // series
    ctx.save(); ctx.beginPath(); ctx.rect(L, T, pw, ph); ctx.clip();
    series.forEach((s, si) => {
      const col = s.color || cssVar(`--c${si % 8 + 1}`), n = s.y.length, gx = i => s.x ? s.x[i] : i;
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = s.width || 1.4; ctx.globalAlpha = s.alpha ?? 1;
      ctx.setLineDash(s.dash || []);
      const mode = s.mode || "line";
      if (mode === "line" || mode === "step") {
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
          const px = X(gx(i)), py = Y(s.y[i]);
          if (i === 0) ctx.moveTo(px, py);
          else if (mode === "step") { ctx.lineTo(px, Y(s.y[i - 1])); ctx.lineTo(px, py); }
          else ctx.lineTo(px, py);
        }
        if (mode === "step" && s.stepEnd !== undefined) ctx.lineTo(X(s.stepEnd), Y(s.y[n - 1]));
        ctx.stroke();
      } else if (mode === "stem") {
        const by = Y(Math.max(y0, Math.min(y1, 0)));
        for (let i = 0; i < n; i++) {
          const px = X(gx(i)), py = Y(s.y[i]);
          ctx.beginPath(); ctx.moveTo(px, by); ctx.lineTo(px, py); ctx.stroke();
          ctx.beginPath(); ctx.arc(px, py, s.r || 3, 0, 7); ctx.fill();
        }
      } else if (mode === "dots") {
        for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.arc(X(gx(i)), Y(s.y[i]), s.r || 2.5, 0, 7); ctx.fill(); }
      } else if (mode === "bars") {
        const bw = Math.max(1, pw / (x1 - x0) * (s.barWidth || 0.8));
        for (let i = 0; i < n; i++) { const px = X(gx(i)), py = Y(s.y[i]), by = Y(Math.max(y0, 0)); ctx.fillRect(px - bw / 2, Math.min(py, by), bw, Math.abs(by - py)); }
      }
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    });
    // text labels
    ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillStyle = text;
    for (const lb of cfg.labels || []) { ctx.fillStyle = lb.color || text; ctx.fillText(lb.text, X(lb.x), Y(lb.y) - (lb.dy ?? 5)); }
    ctx.restore();

    if (cursor) {
      ctx.strokeStyle = cssVar("--accent"); ctx.globalAlpha = .6;
      ctx.beginPath(); ctx.moveTo(cursor.px, T); ctx.lineTo(cursor.px, T + ph); ctx.stroke();
      ctx.globalAlpha = 1;
      for (const p of cursor.pts) { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.px, p.py, 3.5, 0, 7); ctx.fill(); }
    }
  }
  hover(e) {
    if (!this.cfg || !this.map) return;
    const r = this.canvas.getBoundingClientRect(), m = this.map, mx = e.clientX - r.left, my = e.clientY - r.top;
    if (mx < m.L || mx > m.L + m.pw || my < m.T || my > m.T + m.ph) { App.tooltip(null); this.render(); return; }
    const x = m.x0 + (mx - m.L) / m.pw * (m.x1 - m.x0), y = m.y0 + (1 - (my - m.T) / m.ph) * (m.y1 - m.y0);
    const lines = [`${this.cfg.xname || "x"} = ${fmt(x, 3)}`], pts = [];
    if (this.cfg.equal || this.cfg.noSnap) lines.push(`y = ${fmt(y, 3)}`);
    else (this.cfg.series || []).forEach((s, si) => {
      if (!s.y.length || s.noHover) return;
      let i;
      if (s.x) { let lo = 0, hi = s.x.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (s.x[mid] <= x) lo = mid; else hi = mid; } i = Math.abs(s.x[hi] - x) < Math.abs(s.x[lo] - x) ? hi : lo; if (s.mode === "step") i = lo; }
      else i = Math.max(0, Math.min(s.y.length - 1, Math.round(x)));
      const col = s.color || cssVar(`--c${si % 8 + 1}`);
      lines.push(`<span style="color:${col}">■</span> ${esc(s.label || "y" + (si + 1))}: ${fmt(s.y[i], 3)}`);
      pts.push({ px: m.X(s.x ? s.x[i] : i), py: m.Y(s.y[i]), color: col });
    });
    this.render({ px: mx, pts });
    App.tooltip(lines.join("<br>"), e.clientX, e.clientY);
  }
  destroy() { this.ro.disconnect(); }
}

function legend(items) {
  return `<span class="legend">${items.map(([c, t]) => `<span><i style="background:${c.startsWith("--") ? `var(${c})` : c}"></i>${esc(t)}</span>`).join("")}</span>`;
}

/* =====================================================================
 * UI controls bound to a state object
 * ===================================================================== */
const UI = {
  slider(k, label, min, max, step, unit = "") { return `<label class="ctl"><span class="lbl"><span>${label}</span><b data-out="${k}"></b></span><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" data-unit="${unit}"></label>`; },
  select(k, label, opts) { return `<label class="ctl"><span class="lbl">${label}</span><select data-k="${k}">${opts.map(o => Array.isArray(o) ? `<option value="${o[0]}">${o[1]}</option>` : `<option>${o}</option>`).join("")}</select></label>`; },
  check(k, label) { return `<label class="chk"><input type="checkbox" data-k="${k}"> ${label}</label>`; },
  text(k, label, ph = "") { return `<label class="ctl"><span class="lbl">${label}</span><input type="text" data-k="${k}" placeholder="${ph}"></label>`; },
  bind(root, state, onChange) {
    const sync = () => $$("[data-out]", root).forEach(o => {
      const inp = $(`[data-k="${o.dataset.out}"]`, root), v = state[o.dataset.out];
      o.textContent = (typeof v === "number" ? +v.toFixed(4) : v) + (inp?.dataset.unit ? " " + inp.dataset.unit : "");
    });
    $$("[data-k]", root).forEach(inp => {
      const k = inp.dataset.k;
      if (inp.type === "checkbox") inp.checked = !!state[k]; else inp.value = state[k];
      inp.addEventListener("input", () => {
        if (inp.type === "checkbox") state[k] = inp.checked;
        else if (inp.type === "range" || inp.type === "number") state[k] = +inp.value;
        else if (inp.tagName === "SELECT" && !isNaN(+inp.value) && inp.value !== "") state[k] = +inp.value;
        else state[k] = inp.value;
        sync(); onChange(k);
      });
    });
    sync();
    return { sync, set(k, v) { state[k] = v; const i = $(`[data-k="${k}"]`, root); if (i) { if (i.type === "checkbox") i.checked = !!v; else i.value = v; } sync(); } };
  },
  readouts(items) {
    return items.map(([k, v, cls = ""]) => `<div class="ro ${cls}"><div class="k">${k}</div><div class="v">${v}</div></div>`).join("");
  },
  bits(bits, ref) {
    return `<span class="bits">${[...bits].map((b, i) => ref && ref[i] !== undefined && String(ref[i]) !== String(b) ? `<span class="err">${b}</span>` : b).join("")}</span>`;
  },
};

/* =====================================================================
 * Python syntax highlighter (for "Source code" tab)
 * ===================================================================== */
function highlightPy(code) {
  const KW = /^(def|class|return|if|elif|else|for|while|in|not|and|or|import|from|as|with|try|except|finally|raise|lambda|None|True|False|async|await|yield|pass|break|continue|global|is|del)$/;
  const re = /("""[\s\S]*?"""|'''[\s\S]*?'''|[rbfRBF]{0,2}"(?:\\.|[^"\\\n])*"|[rbfRBF]{0,2}'(?:\\.|[^'\\\n])*'|#[^\n]*|\b\d+(?:\.\d+)?(?:e[-+]?\d+)?\b|\b[A-Za-z_]\w*\b)/g;
  let out = "", last = 0, m;
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index));
    const t = m[0];
    let cls = "";
    if (t[0] === "#") cls = "com";
    else if (/^[rbfRBF]{0,2}["']/.test(t)) cls = "str";
    else if (/^\d/.test(t)) cls = "num";
    else if (KW.test(t)) cls = "kw";
    else if (code[re.lastIndex] === "(") cls = "fn";
    out += cls ? `<span class="${cls}">${esc(t)}</span>` : esc(t);
    last = re.lastIndex;
  }
  out += esc(code.slice(last));
  // wrap lines, keeping multi-line spans valid
  const lines = out.split("\n"); let open = null;
  return lines.map(l => {
    let s = (open ? `<span class="${open}">` : "") + l;
    const opens = [...l.matchAll(/<span class="(\w+)">/g)].length, closes = (l.match(/<\/span>/g) || []).length;
    if (open) { if (closes > opens) open = null; }
    else if (opens > closes) open = [...l.matchAll(/<span class="(\w+)">/g)].pop()[1];
    if (open) s += "</span>";
    return `<span class="ln">${s || " "}</span>`;
  }).join("");
}

/* =====================================================================
 * App: registry, router, lab page shell
 * ===================================================================== */
const App = {
  labs: [],
  groups: [],
  backend: false,
  status: null,
  cleanup: null,

  group(id, title) { this.groups.push({ id, title }); },
  register(lab) { this.labs.push(lab); },

  async api(path, opts = {}) {
    if (!this.backend) throw new Error("Backend not running - start it with:  python webapp\\server.py");
    const init = { method: opts.method || (opts.body !== undefined ? "POST" : "GET"), headers: {} };
    if (opts.body !== undefined) {
      if (opts.raw) init.body = opts.body;
      else { init.body = JSON.stringify(opts.body); init.headers["Content-Type"] = "application/json"; }
    }
    const res = await fetch(path, init);
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || res.statusText);
    return data;
  },

  tooltip(html, x, y) {
    const t = $("#tooltip");
    if (!html) { t.hidden = true; return; }
    t.innerHTML = html; t.hidden = false;
    const w = t.offsetWidth, h = t.offsetHeight;
    t.style.left = Math.min(window.innerWidth - w - 8, x + 14) + "px";
    t.style.top = Math.max(8, y - h - 10) + "px";
  },

  async start() {
    const saved = (() => { try { return localStorage.getItem("wcn-theme"); } catch { return null; } })();
    if (saved) document.documentElement.dataset.theme = saved;
    $("#theme-toggle").onclick = () => {
      const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
      const next = cur === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("wcn-theme", next); } catch { }
      this.route();
    };
    if (!saved && matchMedia("(prefers-color-scheme: light)").matches) document.documentElement.dataset.theme = "light";
    $("#menu-btn").onclick = () => $("#sidebar").classList.toggle("open");
    setInterval(() => { $("#clock").textContent = new Date().toLocaleTimeString(); }, 1000);
    this.buildNav();
    window.addEventListener("hashchange", () => this.route());
    await this.checkBackend();
    this.route();
  },

  async checkBackend() {
    const st = $("#backend-status");
    try {
      if (location.protocol === "file:") throw 0;
      const r = await fetch("/api/status");
      this.status = await r.json();
      this.backend = true;
      st.className = "status on";
      st.lastElementChild.textContent = `Lab server online · ${this.status.host} (${this.status.ip})`;
    } catch {
      this.backend = false;
      st.className = "status off";
      st.lastElementChild.textContent = "Offline - simulations only";
    }
  },

  buildNav() {
    $("#nav").innerHTML = `<a class="nav-item" href="#/" data-id="home"><span class="num">⌂</span>Dashboard</a>` +
      this.groups.map(g => `<div class="nav-group">${g.title}</div>` +
        this.labs.filter(l => l.group === g.id).map(l =>
          `<a class="nav-item ${l.soon ? "soon" : ""}" href="#/lab/${l.id}" data-id="${l.id}"><span class="num">${l.num}</span>${l.title}</a>`).join("")).join("");
  },

  route() {
    if (this.cleanup) { try { this.cleanup(); } catch { } this.cleanup = null; }
    App.tooltip(null);
    $("#sidebar").classList.remove("open");
    const parts = location.hash.replace(/^#\/?/, "").split("/");
    const lab = parts[0] === "lab" && this.labs.find(l => l.id === parts[1]);
    $$(".nav-item").forEach(a => a.classList.toggle("active", a.dataset.id === (lab ? lab.id : "home")));
    window.scrollTo(0, 0);
    if (lab) this.renderLab(lab, parts[2] || "experiment");
    else this.renderHome();
  },

  renderHome() {
    $("#crumbs").innerHTML = "<b>Dashboard</b>";
    const st = this.status;
    $("#view").innerHTML = `
      <section class="hero">
        <h1>Wireless Communication &amp; Networks: Virtual Lab</h1>
        <p>Every experiment from the WCN course in one place. Turn the knobs on the signal labs and watch the waveforms,
        spectra and constellations change as you go. The networking labs talk to your real WiFi adapter, Bluetooth radio and sockets
        through the lab server, and every lab can run the original Python program and show its console output and plots.</p>
        <div class="row" style="margin-top:14px">
          ${st ? `<span class="chip ok">Lab server online</span><span class="chip muted">${esc(st.os)} · Python ${esc(st.python)}</span>
            <span class="chip ${st.scapy ? "ok" : "warn"}">scapy ${st.scapy ? "✓" : "✗"}</span>
            <span class="chip ${st.bleak ? "ok" : "warn"}">bleak ${st.bleak ? "✓" : "✗"}</span>
            <span class="chip ${st.matplotlib ? "ok" : "warn"}">matplotlib ${st.matplotlib ? "✓" : "✗"}</span>`
        : `<span class="chip warn">Lab server offline</span><span class="muted small">Simulations work. For real hardware labs run <code>python webapp\\server.py</code> and open http://localhost:8000</span>`}
        </div>
      </section>
      ${this.groups.map(g => `<h2>${g.title}</h2><div class="cards">${this.labs.filter(l => l.group === g.id).map(l => `
        <a class="card ${l.soon ? "soon" : ""}" href="#/lab/${l.id}">
          <div class="top"><span class="ic">${l.icon}</span><span class="chip ${l.soon ? "muted" : l.hardware ? "warn" : "info"}">${l.soon ? "Coming soon" : l.hardware ? "Real hardware" : "Simulation"}</span></div>
          <h3>${l.num}. ${l.title}</h3><p>${l.summary}</p></a>`).join("")}</div>`).join("")}`;
  },

  renderLab(lab, tab) {
    $("#crumbs").innerHTML = `${this.groups.find(g => g.id === lab.group).title} › <b>${lab.title}</b>`;
    const tabs = lab.tabs || [["experiment", "🧪 Experiment"], ["theory", "📘 Aim & Theory"], ["run", "▶ Run Program"], ["source", "{ } Source Code"], ["viva", "❓ Viva"]];
    if (!tabs.some(t => t[0] === tab)) tab = tabs[0][0];
    $("#view").innerHTML = `
      <div class="lab-head"><span class="num">LAB ${lab.num}</span><div><h1>${lab.title}</h1><p>${lab.summary}</p></div></div>
      <div class="tabs">${tabs.map(([id, t]) => `<button class="tab ${id === tab ? "active" : ""}" data-tab="${id}">${t}</button>`).join("")}</div>
      <div id="tab-body"></div>`;
    $$(".tab").forEach(b => b.onclick = () => { location.hash = `#/lab/${lab.id}/${b.dataset.tab}`; });
    const body = $("#tab-body");
    if (tab === "experiment") this.cleanup = lab.experiment(body) || null;
    else if (tab === "theory") this.renderTheory(lab, body);
    else if (tab === "run") this.renderRun(lab, body);
    else if (tab === "source") this.renderSource(lab, body);
    else if (tab === "viva") body.innerHTML = `<div class="theory">${(lab.viva || []).map(([q, a]) => `<details class="viva"><summary>${q}</summary><div>${a}</div></details>`).join("")}</div>`;
    else if (lab.extraTabs?.[tab]) this.cleanup = lab.extraTabs[tab](body) || null;
  },

  renderTheory(lab, body) {
    body.innerHTML = `<div class="theory">
      <h2>Aim</h2><p>${lab.aim}</p>
      ${lab.apparatus ? `<h2>Apparatus / Software</h2><p>${lab.apparatus}</p>` : ""}
      <h2>Theory</h2>${lab.theory}
      <h2>Procedure</h2><ol>${(lab.procedure || []).map(p => `<li>${p}</li>`).join("")}</ol>
      ${lab.result ? `<h2>Result</h2><p>${lab.result}</p>` : ""}</div>`;
  },

  renderRun(lab, body) {
    body.innerHTML = `
      <div class="panel">
        <h3>Run the original Python program on the lab server</h3>
        <p class="muted small">${lab.runNote || "Runs the program from your WCN folder with the plot window switched off, then shows its console output and any figure it saved."}</p>
        <div class="row"><button class="btn" id="run-btn">▶ Run program</button><span id="run-meta" class="muted small"></span></div>
      </div>
      <div class="terminal" id="run-out"><span class="dim">Output appears here.</span></div>
      <div id="run-imgs"></div>`;
    $("#run-btn").onclick = async () => {
      const btn = $("#run-btn"), out = $("#run-out");
      btn.disabled = true; btn.innerHTML = `<span class="spin"></span> Running…`;
      out.innerHTML = `<span class="dim">Running…</span>`; $("#run-imgs").innerHTML = "";
      try {
        const r = await App.api("/api/run", { body: { lab: lab.id } });
        out.innerHTML = `<span class="prompt">C:\\WCN&gt; ${esc(r.command)}</span>\n${esc(r.stdout)}${r.stderr ? `<span class="err">${esc(r.stderr)}</span>` : ""}\n<span class="dim">[process exited with code ${r.returncode} in ${r.seconds}s]</span>`;
        $("#run-meta").textContent = `exit ${r.returncode} · ${r.seconds}s`;
        $("#run-imgs").innerHTML = r.images.map(i => `<img class="run-img" alt="${esc(i.name)}" src="data:image/png;base64,${i.data}">`).join("");
      } catch (e) { out.innerHTML = `<span class="err">${esc(e.message)}</span>`; }
      btn.disabled = false; btn.textContent = "▶ Run again";
    };
  },

  async renderSource(lab, body) {
    body.innerHTML = `<div class="file-tabs" id="ftabs"></div><div class="code" id="code"><span class="ln">Loading…</span></div>`;
    try {
      const { files } = await App.api(`/api/source?lab=${lab.id}`);
      const show = i => {
        $$("#ftabs .btn").forEach((b, j) => b.classList.toggle("ghost", j !== i));
        $("#code").innerHTML = highlightPy(files[i].code);
      };
      $("#ftabs").innerHTML = files.map((f, i) => `<button class="btn small ghost" data-i="${i}">${esc(f.path)}</button>`).join("");
      $$("#ftabs .btn").forEach(b => b.onclick = () => show(+b.dataset.i));
      show(0);
    } catch (e) { $("#code").innerHTML = `<span class="ln">${esc(e.message)}</span>`; }
  },
};
