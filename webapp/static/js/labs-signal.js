/* WCN Virtual Lab - signal labs: Analog modulation, Digital modulation, PCM, OFDM, CDMA */
"use strict";

App.group("signals", "Signals &amp; Modulation");
App.group("net", "Wireless Networking");
App.group("cisco", "Cisco Networking");

const TAU = 2 * Math.PI;
function erfc(x) {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}
const Qf = x => 0.5 * erfc(x / Math.SQRT2);
const db = x => 10 * Math.log10(x);

/* split layout: sticky control column + plot column */
function labLayout(body, controlsHtml, extraLeft = "") {
  body.innerHTML = `<div class="split">
    <div class="sticky">
      <div class="panel"><h3>Signal generator / controls</h3><div class="controls">${controlsHtml}</div></div>
      <div class="panel"><h3>Observations</h3><div class="readouts" id="ro"></div></div>
      ${extraLeft}
    </div>
    <div id="right"></div></div>`;
  return $("#right", body);
}
function panel(parent, title, cls = "") {
  const p = document.createElement("div");
  p.className = "panel " + cls;
  p.innerHTML = title ? `<h3>${title}</h3>` : "";
  parent.appendChild(p);
  return p;
}

/* =====================================================================
 * LAB 1 - Analog modulation
 * ===================================================================== */
App.register({
  id: "analog", num: 1, group: "signals", icon: "〰️",
  title: "Analog Modulation (AM / FM / PM)",
  summary: "Modulate a sinusoidal message onto a carrier using amplitude, frequency and phase modulation. Watch it on a scope and a spectrum analyser, and recover it with an envelope detector.",
  aim: "To generate amplitude, frequency and phase modulated waveforms for a sinusoidal message signal, and to study the effect of modulation index on the waveform and its spectrum.",
  apparatus: "Python 3 (NumPy, Matplotlib) · <code>analog_modulation/analog_modulation.py</code> · virtual function generator, oscilloscope and spectrum analyser in this lab.",
  theory: `
    <p>Modulation shifts a low-frequency message m(t) onto a high-frequency carrier c(t) = A<sub>c</sub> sin(2πf<sub>c</sub>t) so it can be radiated by a practical antenna and so many channels can share the spectrum.</p>
    <h3>Amplitude Modulation (AM)</h3>
    <div class="formula">s_AM(t) = Ac [1 + ka·m(t)] sin(2π fc t)        μ = ka·Am  (modulation index)
Bandwidth = 2 fm        Pt = Pc (1 + μ²/2)        η = μ² / (2 + μ²)</div>
    <p>The envelope follows the message. If μ &gt; 1 the envelope crosses zero (<b>over-modulation</b>) and an envelope detector can no longer recover the message without distortion.</p>
    <h3>Frequency Modulation (FM)</h3>
    <div class="formula">s_FM(t) = Ac sin(2π fc t + 2π kf ∫ m(τ) dτ)        Δf = kf·Am,   β = Δf / fm
Carson's rule: BW ≈ 2(β + 1) fm</div>
    <p>The instantaneous frequency f<sub>i</sub> = f<sub>c</sub> + k<sub>f</sub> m(t) swings around the carrier. Amplitude stays constant, so FM is robust against amplitude noise.</p>
    <h3>Phase Modulation (PM)</h3>
    <div class="formula">s_PM(t) = Ac sin(2π fc t + kp·m(t))        Δφ = kp·Am</div>
    <p>PM and FM are closely related: FM of m(t) is PM of ∫m(t)dt. With a sinusoidal message, the PM waveform's frequency deviation peaks where the message slope is largest. The FM waveform's peaks where the message amplitude is largest.</p>`,
  procedure: [
    "Set the message amplitude A<sub>m</sub> and frequency f<sub>m</sub>, and the carrier A<sub>c</sub> and f<sub>c</sub> (keep f<sub>c</sub> ≫ f<sub>m</sub>).",
    "Observe the message, carrier, AM, FM and PM waveforms on the oscilloscope view.",
    "Vary k<sub>a</sub> so that μ &lt; 1, μ = 1 and μ &gt; 1 and note the envelope. Enable the envelope detector to see the distortion caused by over-modulation.",
    "Increase k<sub>f</sub> and observe the compression and expansion of the FM waveform. Switch to the spectrum view and verify Carson's bandwidth.",
    "Record μ, β, Δφ and the bandwidths from the observation panel.",
    "Run the original program from the <i>Run Program</i> tab and compare."],
  result: "AM, FM and PM waveforms were generated and observed. The effect of modulation index on the envelope and spectrum was verified, and over-modulation distortion appeared for μ > 1.",
  viva: [
    ["What is modulation and why is it needed?", "Modulation impresses a message onto a carrier. It reduces antenna size (λ/4 at the carrier frequency), allows frequency-division multiplexing of many signals, and moves the signal to a band with suitable propagation."],
    ["What happens when μ > 1 in AM?", "Over-modulation: the envelope 1 + μ·m(t) goes negative, phase reversals occur, an envelope detector distorts the output and spurious sidebands widen the spectrum."],
    ["What is the power efficiency of AM at μ = 1?", "η = μ²/(2+μ²) = 1/3 ≈ 33%. Two thirds of the power stays in the carrier, which carries no information."],
    ["State Carson's rule.", "BW ≈ 2(Δf + fm) = 2(β+1)fm. It contains about 98% of the FM signal power."],
    ["Differentiate narrowband and wideband FM.", "NBFM has β ≪ 1 (BW ≈ 2fm, like AM). WBFM has β > 1 and many significant Bessel sidebands, with better noise immunity."],
    ["How is PM related to FM?", "FM of m(t) equals PM of ∫m(t)dt, and PM of m(t) equals FM of dm/dt. Both are angle modulation."],
    ["Why is FM less affected by noise than AM?", "Noise mostly disturbs amplitude. FM carries information in frequency, and a limiter removes amplitude variations before detection."]],
  experiment(body) {
    const S = { Am: 1, fm: 5, Ac: 1, fc: 50, ka: 0.8, kf: 30, kp: 1.5708, win: 1, view: "time", env: false, live: false, t0: 0 };
    const right = labLayout(body, `
      ${UI.slider("Am", "Message amplitude A<sub>m</sub>", 0.1, 2, 0.05)}
      ${UI.slider("fm", "Message frequency f<sub>m</sub>", 1, 20, 1, "Hz")}
      ${UI.slider("Ac", "Carrier amplitude A<sub>c</sub>", 0.5, 2, 0.05)}
      ${UI.slider("fc", "Carrier frequency f<sub>c</sub>", 20, 200, 5, "Hz")}
      ${UI.slider("ka", "AM sensitivity k<sub>a</sub>", 0.05, 1.5, 0.05)}
      ${UI.slider("kf", "FM deviation k<sub>f</sub>", 1, 100, 1, "Hz/V")}
      ${UI.slider("kp", "PM deviation k<sub>p</sub>", 0.1, 6.28, 0.05, "rad/V")}
      ${UI.slider("win", "Scope time window", 0.1, 1, 0.05, "s")}
      ${UI.select("view", "Instrument", [["time", "Oscilloscope (time domain)"], ["freq", "Spectrum analyser"]])}
      <div class="row">${UI.check("env", "Envelope detector")} ${UI.check("live", "Live scope (run)")}</div>`);
    const warn = document.createElement("div"); right.appendChild(warn);
    const pp = panel(right, "Waveforms", "plots");
    const names = ["Message m(t)", "Carrier c(t)", "AM signal", "FM signal", "PM signal"];
    const P = names.map(n => new Plot(pp, { height: 150, title: `<b>${n}</b>` }));
    const envPlot = new Plot(pp, { height: 150, title: `<b>Envelope detector output</b> ${legend([["--c1", "original message"], ["--c3", "recovered"]])}` });
    const fsA = 8192;

    const update = () => {
      const { Am, fm, Ac, fc, ka, kf, kp, t0 } = S, mu = ka * Am, beta = kf * Am / fm;
      const n = fsA, t = DSP.range(n, i => t0 + i / fsA);
      const msg = t.map(x => Am * Math.sin(TAU * fm * x));
      const car = t.map(x => Ac * Math.sin(TAU * fc * x));
      const am = t.map((x, i) => Ac * (1 + ka * msg[i]) * Math.sin(TAU * fc * x));
      const fmS = t.map(x => Ac * Math.sin(TAU * fc * x + beta * (1 - Math.cos(TAU * fm * x))));
      const pm = t.map((x, i) => Ac * Math.sin(TAU * fc * x + kp * msg[i]));
      const sigs = [msg, car, am, fmS, pm], cols = ["--c1", "--c3", "--c8", "--c5", "--c7"].map(cssVar);

      envPlot.el.style.display = S.env && S.view === "time" ? "" : "none";
      if (S.view === "time") {
        const m = Math.round(S.win * fsA), tx = t.slice(0, m);
        const A = Ac * (1 + ka * Am) * 1.15;
        P.forEach((p, k) => {
          const series = [{ x: tx, y: sigs[k].slice(0, m), color: cols[k], width: 1.1, label: names[k] }];
          if (k === 2) {
            series.push({ x: tx, y: msg.slice(0, m).map(v => Ac * (1 + ka * v)), color: cssVar("--muted"), dash: [4, 3], width: 1, label: "envelope" });
            series.push({ x: tx, y: msg.slice(0, m).map(v => -Ac * (1 + ka * v)), color: cssVar("--muted"), dash: [4, 3], width: 1, noHover: true });
          }
          p.draw({ series, xlim: [tx[0], tx[m - 1]], ylim: k === 0 ? [-2.1, 2.1] : [-Math.max(A, Ac * 1.15), Math.max(A, Ac * 1.15)], xname: "t (s)", xlabel: k === 4 ? "Time (s)" : "" });
        });
        if (S.env) {      // rectifier + moving-average low-pass (one carrier period)
          const w = Math.max(1, Math.round(fsA / fc)), pre = [0];
          for (let i = 0; i < n; i++) pre.push(pre[i] + Math.abs(am[i]));
          const rec = DSP.range(m, i => { const a = Math.max(0, i - (w >> 1)), b = Math.min(n, a + w); return ((pre[b] - pre[a]) / (b - a) * Math.PI / 2 / Ac - 1) / ka; });
          envPlot.draw({ series: [{ x: tx, y: msg.slice(0, m), color: cols[0], label: "message" }, { x: tx, y: rec, color: cssVar("--c3"), width: 1.6, label: "recovered" }], xlim: [tx[0], tx[m - 1]], xname: "t (s)" });
        }
      } else {
        const fmax = Math.min(fsA / 2, fc + Math.max(6 * fm, 2 * (beta + 2) * fm, 2 * (kp * Am + 2) * fm));
        P.forEach((p, k) => {
          const sp = DSP.spectrum(sigs[k], fsA, fmax);
          p.draw({ series: [{ x: sp.f, y: sp.m, color: cols[k], width: 1.2, label: "|S(f)|" }], xlim: [0, fmax], ylim: [0, Math.max(...sp.m) * 1.15 || 1], xname: "f (Hz)", xlabel: k === 4 ? "Frequency (Hz)" : "" });
        });
      }
      warn.innerHTML = mu > 1 ? `<div class="alert bad">⚠ Over-modulation: μ = ${fmt(mu)} &gt; 1. The AM envelope crosses zero, so an envelope detector will distort the output. Turn on the envelope detector to see it.</div>`
        : fc < 5 * fm ? `<div class="alert warn">Carrier is not much larger than the message frequency (f<sub>c</sub>/f<sub>m</sub> = ${fmt(fc / fm, 1)}). Keep f<sub>c</sub> ≫ f<sub>m</sub>.</div>` : "";
      $("#ro", body).innerHTML = UI.readouts([
        ["AM index μ", fmt(mu), mu > 1 ? "bad" : mu === 1 ? "warn" : "ok"],
        ["FM index β", fmt(beta)],
        ["PM Δφ", `${fmt(kp * Am)} <small>rad</small>`],
        ["FM Δf", `${fmt(kf * Am, 1)} <small>Hz</small>`],
        ["AM bandwidth", `${fmt(2 * fm, 0)} <small>Hz</small>`],
        ["FM BW (Carson)", `${fmt(2 * (beta + 1) * fm, 1)} <small>Hz</small>`],
        ["PM BW (approx)", `${fmt(2 * (kp * Am + 1) * fm, 1)} <small>Hz</small>`],
        ["AM Pt / Pc", fmt(1 + mu * mu / 2, 3)],
        ["AM efficiency η", `${fmt(100 * mu * mu / (2 + mu * mu), 1)} <small>%</small>`],
        ["Sidebands (AM)", `${fc - fm}, ${fc + fm} <small>Hz</small>`]]);
    };
    UI.bind(body, S, k => { if (k === "live" && S.live) loop(); update(); });
    let raf = 0, last = 0;
    const loop = now => {
      if (!S.live) return;
      if (now && now - last > 40) { S.t0 = (S.t0 + 0.004) % 1; last = now; update(); }
      raf = requestAnimationFrame(loop);
    };
    update();
    return () => { S.live = false; cancelAnimationFrame(raf); [...P, envPlot].forEach(p => p.destroy()); };
  },
});

/* =====================================================================
 * LAB 2 - Digital modulation
 * ===================================================================== */
App.register({
  id: "digital", num: 2, group: "signals", icon: "📶",
  title: "Digital Modulation (BASK, BFSK, BPSK, QPSK)",
  summary: "Digitise an analog signal with an ADC, then modulate the bit stream with ASK, FSK, PSK and QPSK. Add channel noise, demodulate with correlation receivers and measure the bit error rate (BER) against theory.",
  aim: "To convert an analog signal to a binary stream, modulate it using BASK, BFSK, BPSK and QPSK, demodulate it with coherent correlation receivers, and compare the recovered bits with the original.",
  apparatus: "Python 3 (NumPy, Matplotlib) · <code>digital_modulation/digital_modulation.py</code>",
  theory: `
    <p>In digital modulation, one property of a sinusoidal carrier is switched between a finite set of values according to the data bits.</p>
    <div class="formula">BASK : s(t) = b · A sin(2π fc t)                     (on-off keying)
BFSK : s(t) = A sin(2π f1 t) if b=1,  A sin(2π f0 t) if b=0
BPSK : s(t) = (2b−1) · A sin(2π fc t)               (phase 0 or π)
QPSK : s(t) = [(2bI−1) cos(2π fc t) + (2bQ−1) sin(2π fc t)] / √2   (2 bits/symbol)</div>
    <h3>Coherent correlation receiver</h3>
    <p>The receiver multiplies the incoming signal by a local replica of each basis function and integrates over one bit (or symbol) period. The result is compared with a threshold: E/2 for BASK, the larger branch for BFSK, and the sign for BPSK and QPSK.</p>
    <h3>Bit error rate in AWGN</h3>
    <div class="formula">BPSK, QPSK      : Pb = Q(√(2 Eb/N0))
Coherent BFSK   : Pb = Q(√(Eb/N0))
Coherent BASK   : Pb = Q(√(Eb/N0))   (average Eb)</div>
    <p>QPSK sends 2 bits per symbol in the same bandwidth as BPSK with the same BER per bit. That is why it doubles spectral efficiency.</p>`,
  procedure: [
    "Choose the number of samples and bits/sample for the ADC (or type your own bits).",
    "Observe the sampled analog signal with its binary codes and the resulting NRZ bit stream.",
    "Observe the BASK, BFSK, BPSK and QPSK waveforms. The grey lines mark bit boundaries.",
    "Enable channel noise and reduce E<sub>b</sub>/N<sub>0</sub>. Watch the constellation spread and the errors (red) appear in the demodulated bits.",
    "Compare the Monte-Carlo BER of each scheme with the theoretical curve.",
    "Note the recovered analog sample values (DAC) obtained from the QPSK receiver."],
  result: "The analog signal was converted to bits and modulated using BASK, BFSK, BPSK and QPSK. Without noise every scheme recovered the bits exactly. With AWGN, the PSK schemes showed about a 3 dB advantage over ASK/FSK, matching theory.",
  viva: [
    ["Why does BPSK outperform BASK at the same Eb/N0?", "BPSK's antipodal signals (±s) are 2√Eb apart in signal space. On-off BASK points are only √(2Eb) apart, which costs 3 dB."],
    ["What is the bandwidth of BPSK and QPSK for bit rate Rb?", "BPSK null-to-null ≈ 2Rb. QPSK ≈ Rb (2 bits per symbol halves the symbol rate)."],
    ["What is Gray coding and why is it used?", "Adjacent constellation points differ in only one bit, so the most likely symbol error (to a neighbour) produces only one bit error."],
    ["What is a coherent receiver?", "A receiver that knows the carrier frequency and phase exactly (it uses carrier recovery) and correlates with a synchronised local replica."],
    ["Why is BFSK called orthogonal signalling?", "When the tones are spaced by a multiple of 1/(2Tb), their correlation over a bit is zero, so the signal points lie on perpendicular axes."],
    ["What does the constellation diagram show?", "Correlator outputs in signal space (I/Q). Noise spreads each ideal point into a cloud. Errors occur when a point crosses a decision boundary."]],
  experiment(body) {
    const S = { src: "adc", ns: 4, nb: 4, ph: 30, custom: "1011001110001101", fc: 5, f0: 3, f1: 8, noise: false, ebn0: 8, seed: 7 };
    const right = labLayout(body, `
      ${UI.select("src", "Bit source", [["adc", "Analog signal → ADC"], ["bits", "Custom bit string"]])}
      <div data-show="adc">${UI.slider("ns", "Samples taken", 2, 8, 1)}</div>
      <div data-show="adc">${UI.slider("nb", "Bits per sample", 2, 8, 1)}</div>
      <div data-show="adc">${UI.slider("ph", "Analog phase", 0, 360, 5, "°")}</div>
      <div data-show="bits">${UI.text("custom", "Bits (0/1)", "10110010")}</div>
      ${UI.slider("fc", "Carrier f<sub>c</sub> (cycles/bit)", 1, 10, 1)}
      ${UI.slider("f0", "BFSK f<sub>0</sub> (bit 0)", 1, 10, 1)}
      ${UI.slider("f1", "BFSK f<sub>1</sub> (bit 1)", 1, 12, 1)}
      ${UI.check("noise", "Add AWGN channel noise")}
      ${UI.slider("ebn0", "E<sub>b</sub>/N<sub>0</sub>", -4, 20, 0.5, "dB")}
      <button class="btn ghost small" id="reseed">🎲 New noise realisation</button>`);
    const spb = 200;
    const pAdc = panel(right, "1 · Analog → binary (ADC)"), adcPlot = new Plot(pAdc, { height: 170 });
    const adcTbl = document.createElement("div"); adcTbl.className = "tbl-wrap"; pAdc.appendChild(adcTbl);
    const pw = panel(right, "2 · Bit stream and modulated waveforms", "plots");
    const titles = ["Digital bit stream (NRZ)", "BASK", "BFSK", "BPSK", "QPSK (1 symbol = 2 bits)"];
    const W = titles.map(t => new Plot(pw, { height: 130, title: `<b>${t}</b>` }));
    const pr = panel(right, "3 · Demodulation (correlation receivers)");
    const resTbl = document.createElement("div"); resTbl.className = "tbl-wrap"; pr.appendChild(resTbl);
    const dac = document.createElement("div"); dac.style.marginTop = "10px"; pr.appendChild(dac);
    const pc = panel(right, "4 · Signal-space constellation (correlator outputs, 400 random bits + your bits)");
    const cg = document.createElement("div"); cg.className = "grid2"; pc.appendChild(cg);
    const C = ["BASK", "BFSK", "BPSK", "QPSK"].map(t => new Plot(cg, { height: 220, title: `<b>${t}</b>` }));
    const pb = panel(right, "5 · BER vs Eb/N0 - theory (lines) and Monte-Carlo measurement (dots)");
    const berPlot = new Plot(pb, { height: 230 });

    const schemes = {
      BASK: { Eb: spb / 4, mod: b => DSP.range(b.length * spb, i => b[Math.floor(i / spb)] * Math.sin(TAU * S.fc * (i % spb) / spb)) },
      BFSK: { Eb: spb / 2, mod: b => DSP.range(b.length * spb, i => Math.sin(TAU * (b[Math.floor(i / spb)] ? S.f1 : S.f0) * (i % spb) / spb)) },
      BPSK: { Eb: spb / 2, mod: b => DSP.range(b.length * spb, i => (2 * b[Math.floor(i / spb)] - 1) * Math.sin(TAU * S.fc * (i % spb) / spb)) },
      QPSK: { Eb: spb / 2, mod: b => DSP.range(b.length * spb, i => { const k = Math.floor(i / (2 * spb)) * 2, tt = (i % (2 * spb)) / spb; return ((2 * b[k] - 1) * Math.cos(TAU * S.fc * tt) + (2 * b[k + 1] - 1) * Math.sin(TAU * S.fc * tt)) / Math.SQRT2; }) },
    };
    const corr = (sig, off, f, n, fn = Math.sin) => { let s = 0; for (let i = 0; i < n; i++) s += sig[off + i] * fn(TAU * f * i / spb); return s; };
    function demod(name, sig, nbits) {
      const out = [], pts = [];
      if (name === "QPSK") for (let k = 0; k < nbits; k += 2) {
        const I = corr(sig, k * spb, S.fc, 2 * spb, Math.cos), Q = corr(sig, k * spb, S.fc, 2 * spb);
        out.push(+(I > 0), +(Q > 0)); pts.push([I / spb, Q / spb]);
      } else for (let k = 0; k < nbits; k++) {
        if (name === "BFSK") { const c0 = corr(sig, k * spb, S.f0, spb), c1 = corr(sig, k * spb, S.f1, spb); out.push(+(c1 > c0)); pts.push([c0 / (spb / 2), c1 / (spb / 2)]); }
        else { const c = corr(sig, k * spb, S.fc, spb); out.push(name === "BASK" ? +(c > spb / 4) : +(c > 0)); pts.push([c / (spb / 2), 0]); }
      }
      return { out, pts };
    }
    const addNoise = (sig, Eb, rnd) => {
      if (!S.noise) return sig;
      const sd = Math.sqrt(Eb / (2 * 10 ** (S.ebn0 / 10)));
      return sig.map(v => v + sd * rnd.randn());
    };

    const update = () => {
      $$("[data-show]", body).forEach(d => d.style.display = d.dataset.show === S.src ? "" : "none");
      let bits = [], analog = [], q = [], levels = 2 ** S.nb, ts = [];
      if (S.src === "adc") {
        ts = DSP.range(S.ns, i => i / S.ns);
        analog = ts.map(t => Math.sin(TAU * t + S.ph * Math.PI / 180));
        q = analog.map(a => Math.round((a + 1) / 2 * (levels - 1)));
        bits = q.flatMap(v => [...DSP.bin(v, S.nb)].map(Number));
      } else bits = [...String(S.custom).replace(/[^01]/g, "")].map(Number);
      if (!bits.length) bits = [0];
      const padded = bits.length % 2 ? [...bits, 0] : bits;
      const nb = bits.length, rnd = DSP.rng(S.seed);

      pAdc.style.display = S.src === "adc" ? "" : "none";
      if (S.src === "adc") {
        const tt = DSP.linspace(0, 1, 400);
        adcPlot.draw({
          series: [{ x: tt, y: tt.map(t => Math.sin(TAU * t + S.ph * Math.PI / 180)), color: cssVar("--c3"), dash: [5, 4], label: "analog" },
          { x: ts, y: analog, mode: "stem", color: cssVar("--c1"), label: "sample" }],
          labels: ts.map((t, i) => ({ x: t, y: analog[i], text: DSP.bin(q[i], S.nb), dy: 8 })), ylim: [-1.4, 1.4], xname: "t (s)"
        });
        adcTbl.innerHTML = `<table class="tbl"><tr><th>Sample</th><th>Time</th><th>Analog</th><th>Level (0–${levels - 1})</th><th>Binary</th></tr>${analog.map((a, i) => `<tr><td>${i}</td><td class="mono">${fmt(ts[i], 3)}</td><td class="mono">${fmt(a, 4)}</td><td class="mono">${q[i]}</td><td class="bits">${DSP.bin(q[i], S.nb)}</td></tr>`).join("")}</table>
          <p class="small muted" style="margin-top:8px">Bit stream (${nb} bits): <span class="bits">${bits.join("")}</span></p>`;
      }
      const t = DSP.range(nb * spb, i => i / spb), vl = DSP.range(nb + 1, i => i);
      W[0].draw({ series: [{ x: DSP.range(nb, i => i), y: bits, mode: "step", stepEnd: nb, color: cssVar("--text"), width: 1.8, label: "bit" }], ylim: [-0.3, 1.3], xlim: [0, nb], vlines: vl, labels: bits.map((b, i) => ({ x: i + 0.5, y: 1.05, text: b })), xname: "t (Tb)" });
      W[0].setTitle(`<b>Digital bit stream (NRZ)</b> <span class="bits">${bits.join("")}</span>`);
      const res = {}, cols = { BASK: "--c8", BFSK: "--c5", BPSK: "--c1", QPSK: "--c7" };
      Object.entries(schemes).forEach(([name, sc], k) => {
        const b = name === "QPSK" ? padded : bits;
        const clean = sc.mod(b), rx = addNoise(clean, sc.Eb, rnd);
        res[name] = demod(name, rx, b.length);
        const tt = name === "QPSK" ? DSP.range(b.length * spb, i => i / spb) : t;
        W[k + 1].draw({ series: [{ x: tt, y: rx, color: cssVar(cols[name]), width: 1, label: name }], ylim: [-1.8, 1.8], xlim: [0, b.length], vlines: name === "QPSK" ? DSP.range(b.length / 2 + 1, i => 2 * i) : vl, xname: "t (Tb)" });
      });
      W[2].setTitle(`<b>BFSK</b> <span class="muted">f₀ = ${S.f0}, f₁ = ${S.f1} cycles/bit</span>`);
      // results table
      resTbl.innerHTML = `<table class="tbl"><tr><th>Scheme</th><th>Bits/symbol</th><th>Demodulated bits</th><th>Errors</th><th>Status</th></tr>${Object.keys(schemes).map(n => {
        const ref = n === "QPSK" ? padded : bits, e = res[n].out.filter((v, i) => v !== ref[i]).length;
        return `<tr><td><b>${n}</b></td><td>${n === "QPSK" ? 2 : 1}</td><td>${UI.bits(res[n].out.join(""), ref)}</td><td class="mono">${e}/${ref.length}</td><td>${e ? `<span class="chip bad">MISMATCH</span>` : `<span class="chip ok">OK</span>`}</td></tr>`;
      }).join("")}</table>${bits.length % 2 ? `<p class="small muted">QPSK needs pairs of bits, so one 0 was padded.</p>` : ""}`;
      if (S.src === "adc") {
        const rxq = res.QPSK.out.slice(0, nb), words = DSP.range(S.ns, i => rxq.slice(i * S.nb, (i + 1) * S.nb).join(""));
        dac.innerHTML = `<b class="small">Recovered samples (DAC) from QPSK:</b> ${words.map(w => { const l = parseInt(w, 2); return `<span class="chip info mono">${w} → ${l} → ${(l / (levels - 1) * 2 - 1).toFixed(4)}</span>`; }).join(" ")}`;
      } else dac.innerHTML = "";
      // constellation + Monte Carlo BER
      const mc = DSP.range(400, () => rnd.int(2)), berNow = {};
      ["BASK", "BFSK", "BPSK", "QPSK"].forEach((name, k) => {
        const sc = schemes[name], rx = addNoise(sc.mod(mc), sc.Eb, rnd), d = demod(name, rx, mc.length);
        berNow[name] = d.out.filter((v, i) => v !== mc[i]).length / mc.length;
        const ideal = { BASK: [[0, 0], [1, 0]], BFSK: [[1, 0], [0, 1]], BPSK: [[-1, 0], [1, 0]], QPSK: [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => [a / Math.SQRT2, b / Math.SQRT2]) }[name];
        const all = [...d.pts, ...res[name].pts];
        C[k].draw({
          equal: true, xlim: [-1.8, 1.8], ylim: [-1.8, 1.8], xname: name === "BFSK" ? "φ0" : "I",
          series: [{ x: all.map(p => p[0]), y: all.map(p => p[1]), mode: "dots", r: 2, color: cssVar(cols[name]), alpha: .55 },
          { x: ideal.map(p => p[0]), y: ideal.map(p => p[1]), mode: "dots", r: 5, color: cssVar("--text") }],
          labels: name === "QPSK" ? [["00", -1, -1], ["01", -1, 1], ["10", 1, -1], ["11", 1, 1]].map(([s, a, b]) => ({ x: a * .71, y: b * .71, text: s, dy: 9 })) : name === "BFSK" ? [{ x: 1, y: 0, text: "0", dy: 9 }, { x: 0, y: 1, text: "1", dy: 9 }] : [{ x: ideal[0][0], y: 0, text: "0", dy: 9 }, { x: ideal[1][0], y: 0, text: "1", dy: 9 }],
        });
        C[k].setTitle(`<b>${name}</b> <span class="muted">BER over 400 bits: ${fmt(berNow[name], 4)}</span>`);
      });
      const g = DSP.linspace(-4, 14, 80), lin = g.map(v => 10 ** (v / 10));
      const th = { BPSK: lin.map(x => Qf(Math.sqrt(2 * x))), BASK: lin.map(x => Qf(Math.sqrt(x))) };
      const l10 = v => Math.log10(Math.max(v, 1e-6));
      berPlot.draw({
        series: [{ x: g, y: th.BPSK.map(l10), color: cssVar("--c1"), label: "BPSK/QPSK theory" }, { x: g, y: th.BASK.map(l10), color: cssVar("--c8"), dash: [5, 3], label: "BASK/BFSK theory" },
        ...(S.noise ? Object.keys(berNow).map(n => ({ x: [S.ebn0], y: [l10(berNow[n] || 1 / 800)], mode: "dots", r: 5, color: cssVar(cols[n]), label: `${n} measured` })) : [])],
        ylim: [-6, 0], xlim: [-4, 14], xlabel: "Eb/N0 (dB)    (y axis: log10 BER)", xname: "Eb/N0", vlines: S.noise ? [S.ebn0] : []
      });
      const pbT = Qf(Math.sqrt(2 * 10 ** (S.ebn0 / 10)));
      $("#ro", body).innerHTML = UI.readouts([
        ["Total bits", nb], ["Samples / bit", spb],
        ["Channel", S.noise ? `${S.ebn0} <small>dB Eb/N0</small>` : "Noise-free", S.noise ? "warn" : "ok"],
        ["Theory BER BPSK", S.noise ? pbT.toExponential(2) : "0"],
        ["Theory BER BASK", S.noise ? Qf(Math.sqrt(10 ** (S.ebn0 / 10))).toExponential(2) : "0"],
        ["QPSK symbols", padded.length / 2],
        ["ADC levels", S.src === "adc" ? levels : "–"],
        ["Bit errors (all)", Object.keys(res).reduce((s, n) => s + res[n].out.filter((v, i) => v !== (n === "QPSK" ? padded : bits)[i]).length, 0)]]);
    };
    UI.bind(body, S, update);
    $("#reseed", body).onclick = () => { S.seed++; update(); };
    update();
    return () => [adcPlot, ...W, ...C, berPlot].forEach(p => p.destroy());
  },
});

/* =====================================================================
 * LAB 3 - PCM
 * ===================================================================== */
App.register({
  id: "pcm", num: 3, group: "signals", icon: "🔢",
  title: "Pulse Code Modulation (PCM)",
  summary: "Sample, quantise and encode an analog sinusoid into a PCM bit stream, then decode and reconstruct it. Explore Nyquist aliasing, quantisation noise, SQNR and μ-law companding.",
  aim: "To generate an analog sinusoidal signal, sample it, quantise the samples, encode each quantised value into binary, then decode and reconstruct the signal.",
  apparatus: "Python 3 (NumPy, Matplotlib) · <code>pcm/pcm.py</code>",
  theory: `
    <p>PCM is the basic analog-to-digital technique behind digital telephony (G.711) and digital audio. It has three steps.</p>
    <ol><li><b>Sampling</b>: take values at intervals Ts = 1/fs. Nyquist theorem: fs ≥ 2·f<sub>max</sub>, otherwise <i>aliasing</i> occurs.</li>
    <li><b>Quantisation</b>: round each sample to one of L = 2<sup>n</sup> levels. The rounding error is <i>quantisation noise</i>.</li>
    <li><b>Encoding</b>: represent each level index with n bits.</li></ol>
    <div class="formula">Step size        Δ = 2A / L           (uniform mid-rise quantiser)
Level value      x_q = −A + (i + ½)Δ
Bit rate         Rb = n · fs   bits/s,   minimum bandwidth = Rb / 2
SQNR (sinusoid)  ≈ 6.02 n + 1.76  dB   (+6 dB for each extra bit)</div>
    <h3>Reconstruction</h3><p>The receiver maps each code back to its level and passes the samples through an ideal low-pass filter (sinc interpolation): x(t) = Σ x[n] sinc(fs(t − nTs)).</p>
    <h3>μ-law companding</h3><p>Speech has many small amplitudes. μ-law (μ = 255) compresses the signal before uniform quantisation and expands it afterwards. This gives small signals finer steps and keeps the SQNR roughly constant over a wide dynamic range.</p>
    <div class="formula">y = sgn(x) · ln(1 + μ|x|/A) / ln(1 + μ) · A</div>`,
  procedure: [
    "Set the signal frequency f and amplitude A.",
    "Set the sampling frequency f<sub>s</sub>. Verify that the reconstruction is correct for f<sub>s</sub> ≥ 2f and observe aliasing for f<sub>s</sub> &lt; 2f.",
    "Vary the bits per sample n and observe the number of levels, the step size and the staircase.",
    "Note the binary code of each sample and the PCM bit stream.",
    "Compare the measured SQNR with 6.02n + 1.76 dB. Try μ-law with a small amplitude.",
    "Observe the reconstructed signal and the reconstruction error."],
  result: "PCM encoding and decoding were carried out. The measured SQNR increased about 6 dB per bit, as expected, and aliasing was observed below the Nyquist rate.",
  viva: [
    ["State the sampling theorem.", "A band-limited signal with highest frequency fm is completely described by samples taken at fs ≥ 2fm, and can be reconstructed from them by an ideal low-pass filter."],
    ["What is aliasing? How is it prevented?", "When fs < 2fm, high frequencies fold back and appear as lower ones. It is prevented with an anti-aliasing low-pass filter before the sampler and an adequate fs."],
    ["What is quantisation noise?", "The difference between the actual sample and the quantised level. For uniform quantisation it is roughly uniform on ±Δ/2 with power Δ²/12."],
    ["Why does SQNR improve by 6 dB per bit?", "Each extra bit doubles L, which halves Δ and quarters the noise power Δ²/12. 10·log10(4) ≈ 6.02 dB."],
    ["What are the bit rate and bandwidth for telephone PCM?", "fs = 8 kHz and n = 8 give 64 kbps (DS0), with a minimum bandwidth of 32 kHz."],
    ["What is companding?", "Compressing at the transmitter and expanding at the receiver (μ-law in N. America and Japan, A-law in Europe) so weak signals get better SQNR."]],
  experiment(body) {
    const S = { A: 1, f: 2, fs: 20, nb: 3, comp: "uniform" };
    const right = labLayout(body, `
      ${UI.slider("A", "Amplitude A", 0.1, 1, 0.05, "V")}
      ${UI.slider("f", "Signal frequency f", 1, 10, 0.5, "Hz")}
      ${UI.slider("fs", "Sampling frequency f<sub>s</sub>", 2, 100, 1, "Hz")}
      ${UI.slider("nb", "Bits per sample n", 1, 8, 1)}
      ${UI.select("comp", "Quantiser", [["uniform", "Uniform (mid-rise)"], ["mulaw", "μ-law companded (μ=255)"]])}`);
    const warn = document.createElement("div"); right.appendChild(warn);
    const pp = panel(right, "PCM chain", "plots");
    const T = ["1 · Analog sinusoidal signal", "2 · Sampled signal", "3 & 4 · Quantised signal with binary codes", "4 · PCM encoded bit stream", "5 · Reconstructed signal (sinc interpolation)"];
    const P = T.map((t, i) => new Plot(pp, { height: i === 2 ? 210 : 150, title: `<b>${t}</b>` }));
    const pt = panel(right, "Encoding table");
    const tbl = document.createElement("div"); tbl.className = "tbl-wrap"; tbl.style.maxHeight = "340px"; tbl.style.overflow = "auto"; pt.appendChild(tbl);
    const Vfull = 1, mu = 255;
    const update = () => {
      const { A, f, fs, nb } = S, L = 2 ** nb, d = 2 * Vfull / L;
      const t = DSP.linspace(0, 1, 2000), an = t.map(x => A * Math.sin(TAU * f * x));
      const ts = DSP.range(Math.floor(fs), k => k / fs), sm = ts.map(x => A * Math.sin(TAU * f * x));
      const comp = x => S.comp === "mulaw" ? Math.sign(x) * Math.log(1 + mu * Math.abs(x) / Vfull) / Math.log(1 + mu) * Vfull : x;
      const expand = y => S.comp === "mulaw" ? Math.sign(y) * Vfull / mu * ((1 + mu) ** (Math.abs(y) / Vfull) - 1) : y;
      const idx = sm.map(x => Math.min(L - 1, Math.max(0, Math.floor((comp(x) + Vfull) / d))));
      const qv = idx.map(i => expand(-Vfull + (i + 0.5) * d));
      const codes = idx.map(i => DSP.bin(i, nb)), stream = codes.join(""), bits = [...stream].map(Number);
      const rec = t.map(x => qv.reduce((s, v, n) => { const a = fs * (x - ts[n]); return s + v * (a === 0 ? 1 : Math.sin(Math.PI * a) / (Math.PI * a)); }, 0));
      const qe = sm.map((s, i) => s - qv[i]), mse = DSP.mean(qe.map(e => e * e)), ps = DSP.mean(sm.map(s => s * s));
      const sqnr = mse > 0 ? db(ps / mse) : Infinity;
      const aliasing = fs < 2 * f, fa = Math.abs(f - fs * Math.round(f / fs));
      const lv = DSP.range(L, i => expand(-Vfull + (i + .5) * d));
      const ylim = [-1.15, 1.15], cA = cssVar("--c1"), cS = cssVar("--c8"), dim = { color: cA, alpha: .3, noHover: true };
      P[0].draw({ series: [{ x: t, y: an, color: cA, label: "x(t)" }], ylim, xname: "t (s)" });
      P[1].draw({ series: [{ x: t, y: an, ...dim }, { x: ts, y: sm, mode: "stem", color: cS, label: "x[n]" }], ylim, xname: "t (s)" });
      P[2].draw({
        series: [{ x: t, y: an, ...dim }, { x: ts, y: qv, mode: "step", stepEnd: 1, color: cssVar("--c3"), width: 1.8, label: "quantised" }, { x: ts, y: sm, mode: "dots", color: cS, r: 3, label: "sample" }],
        hlines: L <= 64 ? lv : [], ylim, xname: "t (s)", labels: ts.length <= 40 && nb <= 6 ? ts.map((x, i) => ({ x, y: qv[i], text: codes[i], dy: 4 })) : []
      });
      P[3].draw({ series: [{ x: DSP.range(bits.length, i => i), y: bits, mode: "step", stepEnd: bits.length, color: cssVar("--text"), width: 1.4, label: "bit" }], ylim: [-.3, 1.3], xlim: [0, Math.max(1, bits.length)], xname: "bit #", vlines: bits.length <= 120 ? DSP.range(ts.length + 1, i => i * nb) : [] });
      P[3].setTitle(`<b>4 · PCM encoded bit stream</b> <span class="muted">${bits.length} bits · ${nb * fs} bps</span>`);
      P[4].draw({ series: [{ x: t, y: an, color: cA, dash: [5, 4], label: "original" }, { x: t, y: rec, color: cssVar("--c5"), width: 1.6, label: "reconstructed" }], ylim: [-1.4, 1.4], xname: "t (s)" });
      P[4].setTitle(`<b>5 · Reconstructed signal</b> ${legend([["--c1", "original"], ["--c5", "reconstructed"]])}`);
      warn.innerHTML = aliasing ? `<div class="alert bad">⚠ Aliasing: f<sub>s</sub> = ${fs} Hz is below the Nyquist rate 2f = ${2 * f} Hz. The reconstructed signal comes out at the alias frequency |f − k·f<sub>s</sub>| = ${fmt(fa, 1)} Hz.</div>`
        : fs === 2 * f ? `<div class="alert warn">Sampling exactly at the Nyquist rate. Depending on phase, the samples can fall on zero crossings.</div>` : "";
      $("#ro", body).innerHTML = UI.readouts([
        ["Levels L = 2ⁿ", L], ["Step size Δ", `${fmt(d, 4)} <small>V</small>`],
        ["Nyquist rate", `${2 * f} <small>Hz</small>`, aliasing ? "bad" : "ok"],
        ["Samples", ts.length], ["Bit rate n·fs", `${nb * fs} <small>bps</small>`],
        ["Min. bandwidth", `${nb * fs / 2} <small>Hz</small>`],
        ["Quant. MSE", fmt(mse, 5)],
        ["SQNR measured", `${Number.isFinite(sqnr) ? fmt(sqnr, 2) : "∞"} <small>dB</small>`],
        ["SQNR theory", `${fmt(6.02 * nb + 1.76, 2)} <small>dB</small>`],
        ["Max |error|", fmt(Math.max(...qe.map(Math.abs)), 4)]]);
      tbl.innerHTML = `<table class="tbl"><tr><th>n</th><th>Time</th><th>Sample</th><th>Level</th><th>Quantised</th><th>Error</th><th>Binary</th></tr>${ts.map((x, i) => `<tr><td>${i}</td><td class="mono">${fmt(x, 3)}</td><td class="mono">${fmt(sm[i], 4)}</td><td class="mono">${idx[i]}</td><td class="mono">${fmt(qv[i], 4)}</td><td class="mono">${fmt(qe[i], 4)}</td><td class="bits">${codes[i]}</td></tr>`).join("")}</table>
        <p class="small muted" style="margin:8px 0 0">PCM bit stream: <span class="bits" style="word-break:break-all">${stream}</span></p>`;
    };
    UI.bind(body, S, update); update();
    return () => P.forEach(p => p.destroy());
  },
});

/* =====================================================================
 * LAB 4 - OFDM
 * ===================================================================== */
App.register({
  id: "ofdm", num: 4, group: "signals", icon: "📊",
  title: "OFDM Transmitter &amp; Receiver",
  summary: "Map random symbols onto orthogonal subcarriers, apply the IFFT, add a cyclic prefix, and pass the result through a noisy multipath channel. See why the cyclic prefix and a one-tap equaliser make OFDM work.",
  aim: "To generate random QPSK symbols, map them onto subcarriers, perform the IFFT, add a cyclic prefix and plot the OFDM waveform, then verify reception with FFT-based demodulation.",
  apparatus: "Python 3 (NumPy, Matplotlib) · <code>ofdm/ofdm.py</code>",
  theory: `
    <p>Orthogonal Frequency Division Multiplexing splits a high-rate stream into N low-rate streams, each carried on its own subcarrier. The subcarriers are spaced Δf = 1/T<sub>u</sub> apart, so they are orthogonal over one symbol and overlap without interfering. OFDM is used in WiFi (802.11a/g/n/ac/ax), LTE, 5G NR and DVB.</p>
    <div class="formula">x[n] = (1/√N) Σ_k X[k] · e^{j2πkn/N}     (IFFT: frequency → time)
Y[k] = H[k]·X[k] + W[k]                   (after CP removal + FFT)
X̂[k] = Y[k] / H[k]                        (one-tap equaliser)</div>
    <h3>Cyclic prefix (CP)</h3>
    <p>The last L<sub>cp</sub> samples of each symbol are copied to its front. If the channel delay spread is no longer than the CP:</p>
    <ul><li>the previous symbol's echo falls only in the CP, so there is <b>no ISI</b>;</li><li>linear convolution with the channel looks circular, so each subcarrier sees only a complex gain H[k] and there is <b>no ICI</b>.</li></ul>
    <p>The cost is overhead: efficiency = N/(N+L<sub>cp</sub>).</p>
    <h3>PAPR</h3><p>Summing many independent subcarriers produces large peaks (high peak-to-average power ratio), which demands linear power amplifiers.</p>`,
  procedure: [
    "Select the FFT size N (number of subcarriers), the CP length and the number of OFDM symbols.",
    "Observe the transmit constellation and the symbols mapped onto the subcarriers.",
    "Observe the time-domain symbol after the IFFT and the full waveform. The cyclic prefix is shaded.",
    "Add AWGN and observe the received constellation and the BER.",
    "Select the multipath channel. Make the delay longer than the CP and observe the ISI errors, then increase the CP to remove them.",
    "Switch the equaliser off and observe the rotated, scaled constellation."],
  result: "The OFDM signal was generated with IFFT and CP and received error-free over an ideal channel. With multipath, a CP at least as long as the channel delay plus a one-tap equaliser removed ISI and ICI completely.",
  viva: [
    ["Why are OFDM subcarriers orthogonal?", "Subcarriers at integer multiples of 1/Tu complete an integer number of cycles in Tu, so their inner product over the symbol is zero."],
    ["Why is the IFFT used at the transmitter?", "The IFFT efficiently computes the sum of N modulated subcarriers in O(N log N), replacing N separate oscillators."],
    ["What is the purpose of the cyclic prefix?", "It absorbs multipath echoes (no ISI) and makes the channel convolution circular, so each subcarrier sees a single complex gain (no ICI). That allows one-tap equalisation."],
    ["What happens if the delay spread exceeds the CP?", "Energy from the previous symbol leaks into the FFT window (ISI) and orthogonality breaks (ICI), producing an irreducible error floor."],
    ["What is PAPR and why is it a problem?", "The peak-to-average power ratio. High peaks drive power amplifiers into saturation and cause distortion, so expensive linear PAs or PAPR reduction are needed."],
    ["Give 802.11a OFDM parameters.", "64-point FFT, 52 used subcarriers (48 data + 4 pilot), 312.5 kHz spacing, 3.2 µs symbol + 0.8 µs CP = 4 µs."]],
  experiment(body) {
    const S = { N: 64, cp: 16, ns: 3, mod: "QPSK", noise: false, snr: 20, chan: "ideal", delay: 4, gain: 0.6, eq: true, seed: 0 };
    const right = labLayout(body, `
      ${UI.select("N", "Subcarriers (FFT size N)", [16, 32, 64, 128])}
      ${UI.slider("cp", "Cyclic prefix length", 0, 32, 1, "samples")}
      ${UI.slider("ns", "OFDM symbols", 1, 6, 1)}
      ${UI.select("mod", "Subcarrier modulation", ["BPSK", "QPSK", "16-QAM"])}
      ${UI.check("noise", "Add AWGN")}
      ${UI.slider("snr", "SNR", 0, 40, 1, "dB")}
      ${UI.select("chan", "Channel", [["ideal", "Ideal (h = δ[n])"], ["multi", "2-path multipath"]])}
      <div data-mp>${UI.slider("delay", "Echo delay", 1, 32, 1, "samples")}</div>
      <div data-mp>${UI.slider("gain", "Echo gain", 0.1, 0.9, 0.05)}</div>
      <div data-mp>${UI.check("eq", "One-tap equaliser")}</div>
      <button class="btn ghost small" id="reseed">🎲 New random bits</button>`);
    const warn = document.createElement("div"); right.appendChild(warn);
    const g1 = document.createElement("div"); g1.className = "grid2"; right.appendChild(g1);
    const pA = panel(g1, "1 · TX constellation"), cTx = new Plot(pA, { height: 240 });
    const pB = panel(g1, "6 · RX constellation (after FFT)"), cRx = new Plot(pB, { height: 240 });
    const pp = panel(right, "Transmitter / channel", "plots");
    const sub = new Plot(pp, { height: 160, title: `<b>2 · Symbols mapped onto subcarriers (OFDM symbol 1)</b> ${legend([["--c1", "Real"], ["--c8", "Imag"]])}` });
    const td = new Plot(pp, { height: 160, title: `<b>3 · Time-domain OFDM symbol after IFFT (symbol 1, no CP)</b> ${legend([["--c1", "Real"], ["--c8", "Imag"]])}` });
    const wf = new Plot(pp, { height: 190, title: `<b>4 & 5 · Transmitted OFDM waveform with cyclic prefix</b> ${legend([["--c1", "Real"], ["--c8", "Imag"], ["rgba(251,146,60,.6)", "Cyclic prefix"]])}` });
    const hp = new Plot(pp, { height: 140, title: `<b>Channel frequency response |H[k]|</b>` });

    const maps = {
      BPSK: { k: 1, map: b => [1 - 2 * b[0], 0], pts: [[1, 0], [-1, 0]] },
      QPSK: { k: 2, map: b => [(1 - 2 * b[0]) / Math.SQRT2, (1 - 2 * b[1]) / Math.SQRT2] },
      "16-QAM": { k: 4, map: b => { const lv = (a, c) => ({ "00": -3, "01": -1, "11": 1, "10": 3 })[`${a}${c}`] / Math.sqrt(10); return [lv(b[0], b[1]), lv(b[2], b[3])]; } },
    };
    const allPts = name => { const m = maps[name]; return DSP.range(2 ** m.k, v => { const b = [...DSP.bin(v, m.k)].map(Number); return { b, p: m.map(b) }; }); };

    const update = () => {
      $$("[data-mp]", body).forEach(d => d.style.display = S.chan === "multi" ? "" : "none");
      const N = S.N, cp = Math.min(S.cp, N), M = maps[S.mod], rnd = DSP.rng(S.seed + 1);
      const nbits = N * S.ns * M.k, bits = DSP.range(nbits, () => rnd.int(2));
      const X = DSP.range(S.ns, s => DSP.range(N, k => M.map(bits.slice((s * N + k) * M.k, (s * N + k + 1) * M.k))));
      // IFFT + CP
      const tx = [], sym1 = [];
      X.forEach((row, s) => {
        const re = Float64Array.from(row.map(p => p[0])), im = Float64Array.from(row.map(p => p[1]));
        DSP.fft(re, im, true);
        const x = DSP.range(N, i => [re[i] * Math.sqrt(N), im[i] * Math.sqrt(N)]);
        if (s === 0) sym1.push(...x);
        tx.push(...x.slice(N - cp), ...x);
      });
      // channel
      const d = S.chan === "multi" ? S.delay : 0, gch = S.chan === "multi" ? S.gain : 0;
      let rx = tx.map((v, n) => n >= d && d ? [v[0] + gch * tx[n - d][0], v[1] + gch * tx[n - d][1]] : [...v]);
      const pw = DSP.mean(tx.map(v => v[0] ** 2 + v[1] ** 2));
      if (S.noise) { const sd = Math.sqrt(pw / 10 ** (S.snr / 10) / 2); rx = rx.map(v => [v[0] + sd * rnd.randn(), v[1] + sd * rnd.randn()]); }
      // receiver
      const H = DSP.range(N, k => d ? [1 + gch * Math.cos(-TAU * k * d / N), gch * Math.sin(-TAU * k * d / N)] : [1, 0]);
      const constel = allPts(S.mod), rxPts = [], rxBits = [];
      for (let s = 0; s < S.ns; s++) {
        const seg = rx.slice(s * (N + cp) + cp, (s + 1) * (N + cp));
        const re = Float64Array.from(seg.map(v => v[0])), im = Float64Array.from(seg.map(v => v[1]));
        DSP.fft(re, im);
        for (let k = 0; k < N; k++) {
          let yr = re[k] / Math.sqrt(N), yi = im[k] / Math.sqrt(N);
          if (S.eq && d) { const [hr, hi] = H[k], m2 = hr * hr + hi * hi; [yr, yi] = [(yr * hr + yi * hi) / m2, (yi * hr - yr * hi) / m2]; }
          rxPts.push([yr, yi]);
          let best = constel[0], bd = Infinity;
          for (const c of constel) { const dd = (c.p[0] - yr) ** 2 + (c.p[1] - yi) ** 2; if (dd < bd) { bd = dd; best = c; } }
          rxBits.push(...best.b);
        }
      }
      const errs = rxBits.filter((b, i) => b !== bits[i]).length;
      const peak = Math.max(...tx.map(v => v[0] ** 2 + v[1] ** 2)), papr = db(peak / pw);
      // plots
      const lim = S.mod === "16-QAM" ? 1.6 : 1.5, ideal = constel.map(c => c.p);
      cTx.draw({ equal: true, xlim: [-lim, lim], ylim: [-lim, lim], xname: "I", series: [{ x: ideal.map(p => p[0]), y: ideal.map(p => p[1]), mode: "dots", r: 5, color: cssVar("--c1") }], labels: constel.map(c => ({ x: c.p[0], y: c.p[1], text: c.b.join(""), dy: 8 })) });
      const rl = Math.max(lim, Math.min(4, Math.max(...rxPts.map(p => Math.max(Math.abs(p[0]), Math.abs(p[1])))) * 1.1));
      cRx.draw({ equal: true, xlim: [-rl, rl], ylim: [-rl, rl], xname: "I", series: [{ x: rxPts.map(p => p[0]), y: rxPts.map(p => p[1]), mode: "dots", r: 2.2, alpha: .6, color: cssVar(errs ? "--c4" : "--c3") }, { x: ideal.map(p => p[0]), y: ideal.map(p => p[1]), mode: "dots", r: 4, color: cssVar("--text") }] });
      const k = DSP.range(N, i => i);
      sub.draw({ series: [{ x: k, y: X[0].map(p => p[0]), mode: "stem", r: 2.5, color: cssVar("--c1"), label: "Re" }, { x: k.map(v => v + .3), y: X[0].map(p => p[1]), mode: "stem", r: 2.5, color: cssVar("--c8"), label: "Im" }], xlim: [-1, N], xname: "subcarrier k", ylim: [-1.3, 1.3] });
      td.draw({ series: [{ x: k, y: sym1.map(p => p[0]), color: cssVar("--c1"), label: "Re" }, { x: k, y: sym1.map(p => p[1]), color: cssVar("--c8"), label: "Im" }], xname: "sample n" });
      const n = DSP.range(tx.length, i => i);
      wf.draw({ series: [{ x: n, y: tx.map(p => p[0]), color: cssVar("--c1"), width: 1, label: "Re" }, { x: n, y: tx.map(p => p[1]), color: cssVar("--c8"), width: 1, alpha: .7, label: "Im" }], spans: DSP.range(S.ns, s => ({ x0: s * (N + cp), x1: s * (N + cp) + cp, color: "rgba(251,146,60,.28)" })), vlines: DSP.range(S.ns + 1, s => s * (N + cp)), xname: "sample n", xlabel: "Sample index" });
      hp.el.style.display = d ? "" : "none";
      if (d) hp.draw({ series: [{ x: k, y: H.map(h => Math.hypot(h[0], h[1])), mode: "stem", r: 2, color: cssVar("--c5"), label: "|H|" }], ylim: [0, 2], xname: "subcarrier k" });
      warn.innerHTML = d > cp ? `<div class="alert bad">⚠ Echo delay (${d} samples) &gt; CP (${cp}). The previous symbol leaks into the FFT window, so ISI/ICI appear and the equaliser cannot remove them. Increase the CP to at least ${d}.</div>`
        : d && !S.eq ? `<div class="alert warn">Equaliser off: each subcarrier is rotated and scaled by H[k], so the constellation is smeared.</div>`
          : d ? `<div class="alert ok">CP (${cp}) ≥ delay (${d}). The channel acts as one complex gain per subcarrier, and the one-tap equaliser fixes it exactly.</div>` : "";
      $("#ro", body).innerHTML = UI.readouts([
        ["Total bits", nbits], ["Bits / subcarrier", M.k],
        ["Samples / symbol", `${N} + ${cp}`], ["TX samples", tx.length],
        ["CP overhead", `${fmt(100 * cp / (N + cp), 1)} <small>%</small>`],
        ["Efficiency N/(N+CP)", `${fmt(100 * N / (N + cp), 1)} <small>%</small>`],
        ["PAPR", `${fmt(papr, 2)} <small>dB</small>`],
        ["Bit errors", `${errs} / ${nbits}`, errs ? "bad" : "ok"],
        ["BER", errs ? (errs / nbits).toExponential(2) : "0", errs ? "bad" : "ok"]]);
    };
    UI.bind(body, S, update);
    $("#reseed", body).onclick = () => { S.seed++; update(); };
    update();
    return () => [cTx, cRx, sub, td, wf, hp].forEach(p => p.destroy());
  },
});

/* =====================================================================
 * LAB 5 - CDMA (new)
 * ===================================================================== */
App.register({
  id: "cdma", num: 5, group: "signals", icon: "🧬",
  title: "Code Division Multiple Access (CDMA)",
  summary: "Several users transmit at the same time on the same frequency, each separated by an orthogonal Walsh code. Spread, combine, add noise, then despread to pick any one user out of the mix. Try PN codes and the near–far problem.",
  aim: "To simulate a DS-CDMA system in which multiple users share one channel using orthogonal Walsh spreading codes, and to recover each user's data by correlating with that user's code.",
  apparatus: "Python 3 (NumPy, Matplotlib) · <code>cdma/cdma.py</code> (new program added with this lab)",
  theory: `
    <p>In <b>CDMA</b> all users transmit simultaneously over the entire bandwidth. They are separated by giving each one a unique <b>spreading code</b>. Each data bit (±1) is multiplied by a code of L chips, so the chip rate is L times the bit rate (direct-sequence spread spectrum).</p>
    <div class="formula">Spreading     s_u(t) = d_u(t) · c_u(t)             (d = ±1 data, c = ±1 chips)
Channel       r(t) = Σ_u A_u s_u(t) + n(t)
Despreading   z_u = (1/L) Σ_chips r · c_u   →  d̂_u = sign(z_u)
Orthogonality (1/L) Σ c_i c_j = 1 if i = j, else 0
Processing gain  Gp = L = Rc / Rb   →  10·log10(L) dB</div>
    <h3>Walsh–Hadamard codes</h3>
    <p>Built recursively: H<sub>1</sub> = [1], H<sub>2n</sub> = [[H<sub>n</sub>, H<sub>n</sub>], [H<sub>n</sub>, −H<sub>n</sub>]]. Each row is perfectly orthogonal to every other row when the rows are time-aligned, so other users cancel exactly on a synchronous link (like the IS-95 / CDMA2000 forward link).</p>
    <h3>PN codes and the near–far problem</h3>
    <p>Pseudo-random (PN) codes are only <i>approximately</i> orthogonal, so each other user adds a little interference (multiple-access interference, MAI). If one user is much stronger (near the base station), its residual cross-correlation can swamp a weak far user. That is why CDMA systems use tight <b>power control</b>.</p>`,
  procedure: [
    "Choose the number of users and the spreading factor L. Observe the Walsh code matrix and the cross-correlation matrix (identity means orthogonal).",
    "Click bits in the data table to set each user's data, or press Randomise.",
    "Observe each user's spread signal, the composite channel signal and the noisy received signal.",
    "Tune the receiver to each user's code and verify that the correct bits are recovered. Tune it to an unused code and verify that the output is about 0.",
    "Lower the SNR and observe the errors. Note the processing gain.",
    "Switch to PN codes, raise user 1's power (near–far) and observe errors appearing for the other users."],
  result: "Multiple users were transmitted simultaneously on one channel and each was recovered by despreading with its own Walsh code. Orthogonal codes gave zero multiple-access interference. PN codes with unequal power showed the near–far problem.",
  viva: [
    ["What is spread spectrum?", "A technique that spreads a narrowband signal over a much wider bandwidth with a code that is independent of the data. It gives interference and jamming resistance, low probability of intercept, and multiple access."],
    ["What is processing gain?", "Gp = chip rate / bit rate = L. Despreading collapses the wanted signal back to narrowband while spreading interference, improving SINR by 10·log10(L) dB."],
    ["Why are Walsh codes used on the downlink and PN codes on the uplink?", "Walsh codes are orthogonal only when synchronised. The base station transmits all users aligned (downlink). Uplink users arrive with different delays, so PN codes with good auto- and cross-correlation are used."],
    ["Explain the near–far problem.", "A nearby strong user's signal leaks through the imperfect cross-correlation and drowns out a weak distant user. It is solved by closed-loop power control (800 Hz in IS-95)."],
    ["What is a RAKE receiver?", "It has several correlator 'fingers', each locked to a different multipath delay, and combines them (maximal-ratio combining). Multipath becomes diversity gain."],
    ["Compare FDMA, TDMA and CDMA.", "FDMA gives each user a frequency band, TDMA a time slot, and CDMA a code over the whole band at all times. CDMA has a soft capacity limit and supports soft hand-off."],
    ["What does despreading with a wrong code give?", "Almost zero (exactly zero for orthogonal Walsh codes). The other users' signals look like low-level noise."]],
  experiment(body) {
    const S = { users: 4, L: 8, nbits: 6, code: "walsh", noise: true, snr: 5, nf: 0, rx: 1, seed: 1 };
    let data = [];
    const right = labLayout(body, `
      ${UI.slider("users", "Number of users", 1, 8, 1)}
      ${UI.select("L", "Spreading factor L (chips/bit)", [4, 8, 16, 32])}
      ${UI.slider("nbits", "Bits per user", 2, 12, 1)}
      ${UI.select("code", "Spreading codes", [["walsh", "Walsh–Hadamard (orthogonal)"], ["pn", "Random PN (non-orthogonal)"]])}
      ${UI.check("noise", "Add AWGN")}
      ${UI.slider("snr", "SNR per chip", -10, 30, 1, "dB")}
      ${UI.slider("nf", "Near–far: user 1 power boost", 0, 20, 1, "dB")}
      <button class="btn ghost small" id="rand">🎲 Randomise data &amp; noise</button>`);
    const gtop = document.createElement("div"); gtop.className = "grid2"; right.appendChild(gtop);
    const pCodes = panel(gtop, "1 · Spreading codes"), codeBox = document.createElement("div"); pCodes.appendChild(codeBox);
    const pX = panel(gtop, "Cross-correlation (1/L)·C·Cᵀ"), xBox = document.createElement("div"); pX.appendChild(xBox);
    const pData = panel(right, "2 · User data (click a bit to flip it)"), dataBox = document.createElement("div"); dataBox.className = "tbl-wrap"; pData.appendChild(dataBox);
    const pS = panel(right, "3 · Spreading: data × code", "plots");
    const pC = panel(right, "4 · Shared channel", "plots");
    const chanPlot = new Plot(pC, { height: 150, title: "<b>Composite channel signal (sum of all users)</b>" });
    const rxPlot = new Plot(pC, { height: 150, title: "<b>Received signal with AWGN</b>" });
    const pR = panel(right, "5 · Receiver: despread with a chosen code");
    pR.insertAdjacentHTML("beforeend", `<div class="row" style="margin-bottom:10px"><label class="ctl" style="min-width:240px"><span class="lbl">Receiver tuned to</span><select id="rxsel"></select></label><div id="rxout" class="small"></div></div>`);
    const prodPlot = new Plot(pR, { height: 150 }), corrPlot = new Plot(pR, { height: 170, title: "<b>Correlator output per bit, all users</b> (&gt; 0 → 1, &lt; 0 → 0)" });
    const pT = panel(right, "6 · Results"), resBox = document.createElement("div"); resBox.className = "tbl-wrap"; pT.appendChild(resBox);
    let userPlots = [];

    const walsh = n => { let H = [[1]]; while (H.length < n) H = [...H.map(r => [...r, ...r]), ...H.map(r => [...r, ...r.map(v => -v)])]; return H; };
    function ensureData(rnd, force) {
      if (force || data.length !== S.users || data[0]?.length !== S.nbits) {
        const old = data;
        data = DSP.range(S.users, u => DSP.range(S.nbits, k => !force && old[u] && old[u][k] !== undefined ? old[u][k] : rnd.int(2)));
      }
    }
    const update = (k, force) => {
      const maxU = S.code === "walsh" ? S.L - 1 : S.L;
      if (S.users > maxU) { bind.set("users", maxU); }
      const U = S.users, L = S.L, nb = S.nbits, rnd = DSP.rng(S.seed * 7919);
      ensureData(rnd, force);
      const W = walsh(L);
      const pn = DSP.range(L + 1, () => DSP.range(L, () => rnd.int(2) ? 1 : -1));
      const codes = S.code === "walsh" ? W.slice(1, U + 1) : pn.slice(0, U);
      const unused = S.code === "walsh" ? (U + 1 < L ? W[U + 1] : W[0]) : pn[L];
      const amp = DSP.range(U, u => u === 0 ? 10 ** (S.nf / 20) : 1);
      const spread = codes.map((c, u) => data[u].flatMap(b => c.map(ch => (2 * b - 1) * ch)));
      const chan = DSP.range(nb * L, i => spread.reduce((s, sp, u) => s + amp[u] * sp[i], 0));
      const sd = S.noise ? Math.sqrt(1 / 10 ** (S.snr / 10)) : 0;
      const rxs = chan.map(v => v + sd * rnd.randn());
      const despread = c => DSP.range(nb, b => c.reduce((s, ch, j) => s + rxs[b * L + j] * ch, 0) / L);
      const corrs = codes.map(despread), dec = corrs.map(z => z.map(v => +(v > 0)));
      // codes + xcorr
      const showRows = S.code === "walsh" ? W : codes;
      codeBox.innerHTML = `<div class="matrix" style="grid-template-columns:auto repeat(${L},22px)">${showRows.map((r, i) => {
        const u = S.code === "walsh" ? i - 1 : i, tag = S.code === "walsh" ? (i === 0 ? "W0 pilot" : u < U ? `W${i} → U${u + 1}` : `W${i} free`) : `PN → U${i + 1}`;
        return `<span class="rl">${tag}</span>${r.map(v => `<span class="${v > 0 ? "p" : "n"}" style="${S.code === "walsh" && (u < 0 || u >= U) ? "opacity:.35" : ""}">${v > 0 ? "+" : "−"}</span>`).join("")}`;
      }).join("")}</div>`;
      const xc = codes.map(a => codes.map(b => a.reduce((s, v, j) => s + v * b[j], 0) / L));
      const maxX = Math.max(0, ...xc.flatMap((r, i) => r.filter((_, j) => j !== i).map(Math.abs)));
      xBox.innerHTML = `<table class="tbl" style="width:auto"><tr><th></th>${codes.map((_, j) => `<th>U${j + 1}</th>`).join("")}</tr>${xc.map((r, i) => `<tr><th>U${i + 1}</th>${r.map((v, j) => `<td class="mono" style="color:${i === j ? "var(--ok)" : Math.abs(v) > 1e-9 ? "var(--warn)" : "var(--muted)"}">${fmt(v, 2)}</td>`).join("")}</tr>`).join("")}</table>
        <p class="small muted" style="margin-top:8px">${maxX < 1e-9 ? "All off-diagonal entries are 0: the codes are <b>perfectly orthogonal</b>, so users do not interfere." : `Largest cross-correlation = ${fmt(maxX, 2)}. PN codes are <b>not</b> orthogonal, so each user leaks interference into the others.`}</p>`;
      // data editor
      dataBox.innerHTML = `<table class="tbl"><tr><th>User</th><th>Power</th><th>Data bits</th></tr>${data.map((row, u) => `<tr><td><span class="chip" style="color:var(--c${u % 8 + 1})">User ${u + 1}</span></td><td class="mono">${u === 0 && S.nf ? `+${S.nf} dB` : "0 dB"}</td><td>${row.map((b, k) => `<button class="bitbtn ${b ? "one" : ""}" data-u="${u}" data-b="${k}">${b}</button>`).join(" ")}</td></tr>`).join("")}</table>`;
      $$(".bitbtn", dataBox).forEach(btn => btn.onclick = () => { data[+btn.dataset.u][+btn.dataset.b] ^= 1; update(); });
      // per-user spread plots
      if (userPlots.length !== U) { userPlots.forEach(p => { p.destroy(); p.el.remove(); }); userPlots = DSP.range(U, () => new Plot(pS, { height: 105 })); }
      const xs = DSP.range(nb * L, i => i), vl = DSP.range(nb + 1, b => b * L);
      userPlots.forEach((p, u) => {
        p.setTitle(`<b style="color:var(--c${u % 8 + 1})">User ${u + 1}</b> <span class="bits">${data[u].join("")}</span> × <span class="mono small">${codes[u].map(v => v > 0 ? "+" : "−").join("")}</span>`);
        p.draw({ series: [{ x: xs, y: data[u].flatMap(b => Array(L).fill(2 * b - 1)), mode: "step", stepEnd: nb * L, color: cssVar("--muted"), dash: [4, 3], label: "data" }, { x: xs, y: spread[u], mode: "step", stepEnd: nb * L, color: cssVar(`--c${u % 8 + 1}`), width: 1.5, label: "chips" }], ylim: [-1.5, 1.5], xlim: [0, nb * L], vlines: vl, xname: "chip" });
      });
      chanPlot.draw({ series: [{ x: xs, y: chan, mode: "step", stepEnd: nb * L, color: cssVar("--c5"), width: 1.5, label: "Σ" }], xlim: [0, nb * L], vlines: vl, xname: "chip" });
      rxPlot.draw({ series: [{ x: xs.map(v => v + .5), y: rxs, color: cssVar("--c8"), width: 1, label: "r" }, { x: xs.map(v => v + .5), y: rxs, mode: "dots", r: 2, color: cssVar("--c8"), noHover: true }], xlim: [0, nb * L], vlines: vl, xname: "chip" });
      rxPlot.setTitle(`<b>Received signal</b> <span class="muted">${S.noise ? `AWGN, SNR ${S.snr} dB per chip (σ = ${fmt(sd, 3)})` : "noise-free"}</span>`);
      // receiver selector
      const sel = $("#rxsel", body), opts = [...codes.map((_, u) => [u + 1, `User ${u + 1}'s code`]), [0, "Unused code (eavesdropper)"]];
      if (S.rx > U) S.rx = 1;
      sel.innerHTML = opts.map(([v, t]) => `<option value="${v}" ${v === S.rx ? "selected" : ""}>${t}</option>`).join("");
      sel.onchange = () => { S.rx = +sel.value; update(); };
      const rc = S.rx ? codes[S.rx - 1] : unused, z = S.rx ? corrs[S.rx - 1] : despread(unused);
      const prod = xs.map(i => rxs[i] * rc[i % L]);
      prodPlot.setTitle(`<b>r(t) × c(t) for the selected code</b> <span class="muted">integrate over each bit, then decide</span>`);
      prodPlot.draw({ series: [{ x: xs, y: prod, mode: "step", stepEnd: nb * L, color: cssVar("--c4"), width: 1.3, label: "r·c" }, { x: vl.slice(0, -1).map(v => v + L / 2), y: z, mode: "dots", r: 5, color: cssVar("--text"), label: "mean" }], xlim: [0, nb * L], vlines: vl, xname: "chip" });
      const rxb = z.map(v => +(v > 0));
      $("#rxout", body).innerHTML = S.rx ? `Correlator: <span class="mono">${z.map(v => fmt(v, 2)).join(", ")}</span><br>Decoded: ${UI.bits(rxb.join(""), data[S.rx - 1])} &nbsp; Sent: <span class="bits">${data[S.rx - 1].join("")}</span>`
        : `Correlator: <span class="mono">${z.map(v => fmt(v, 2)).join(", ")}</span><br><span class="muted">${S.code === "walsh" && !S.noise ? "Exactly 0: no user is on this code." : "Close to 0: nobody is using this code, so you hear only noise and interference."}</span>`;
      corrPlot.draw({ series: corrs.map((z, u) => ({ x: z.map((_, b) => b * L + L / 2 + (u - (U - 1) / 2) * Math.min(0.8, L / (U + 1))), y: z, mode: "stem", r: 3, color: cssVar(`--c${u % 8 + 1}`), label: `U${u + 1}` })), xlim: [0, nb * L], vlines: vl, xname: "chip", noSnap: true });
      // results
      let totalErr = 0;
      resBox.innerHTML = `<table class="tbl"><tr><th>User</th><th>Code</th><th>Sent</th><th>Received</th><th>Errors</th></tr>${codes.map((c, u) => {
        const e = dec[u].filter((b, i) => b !== data[u][i]).length; totalErr += e;
        return `<tr><td>User ${u + 1}</td><td class="mono small">${c.map(v => v > 0 ? "+1" : "−1").join(" ")}</td><td class="bits">${data[u].join("")}</td><td>${UI.bits(dec[u].join(""), data[u])}</td><td>${e ? `<span class="chip bad">${e}</span>` : `<span class="chip ok">0</span>`}</td></tr>`;
      }).join("")}</table>`;
      $("#ro", body).innerHTML = UI.readouts([
        ["Processing gain", `${fmt(db(L), 2)} <small>dB</small>`], ["Chip rate / bit rate", `${L}×`],
        ["Active users", `${U} / ${maxU}`], ["Max cross-corr", fmt(maxX, 2), maxX > 0 ? "warn" : "ok"],
        ["Total bit errors", `${totalErr} / ${U * nb}`, totalErr ? "bad" : "ok"],
        ["System BER", totalErr ? (totalErr / (U * nb)).toExponential(2) : "0", totalErr ? "bad" : "ok"],
        ["SNR after despread", S.noise ? `${fmt(S.snr + db(L), 1)} <small>dB</small>` : "∞"]]);
    };
    const bind = UI.bind(body, S, k => update(k, false));
    $("#rand", body).onclick = () => { S.seed++; update(null, true); };
    update(null, true);
    return () => [chanPlot, rxPlot, prodPlot, corrPlot, ...userPlots].forEach(p => p.destroy());
  },
});
