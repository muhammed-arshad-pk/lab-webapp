"""
Pulse Code Modulation (PCM)
1. Generate an analog sinusoidal signal
2. Sample it
3. Quantize the samples
4. Encode each quantized value into binary
5. Decode and reconstruct the signal
"""
import numpy as np
import matplotlib.pyplot as plt

# ---------------- Parameters ----------------
A = 1.0             # amplitude
f = 2               # analog signal frequency (Hz)
duration = 1        # seconds
fs = 20             # sampling frequency (Hz), > 2f (Nyquist)
n_bits = 3          # bits per sample
L = 2 ** n_bits     # number of quantization levels

# ---------------- 1. Analog signal ----------------
t = np.linspace(0, duration, 2000)
analog = A * np.sin(2 * np.pi * f * t)

# ---------------- 2. Sampling ----------------
ts = np.arange(0, duration, 1 / fs)
samples = A * np.sin(2 * np.pi * f * ts)

# ---------------- 3. Quantization (uniform, mid-rise) ----------------
delta = 2 * A / L                                     # step size
index = np.floor((samples + A) / delta).astype(int)   # level index 0..L-1
index = np.clip(index, 0, L - 1)
quantized = -A + (index + 0.5) * delta                # level value
q_error = samples - quantized

# ---------------- 4. Encoding (binary) ----------------
codes = [format(i, f"0{n_bits}b") for i in index]
pcm_stream = "".join(codes)

print("Pulse Code Modulation")
print(f"  Signal freq = {f} Hz, Sampling freq = {fs} Hz, Bits/sample = {n_bits}")
print(f"  Levels = {L}, Step size = {delta:.4f}\n")
print(f"{'n':>3} {'Time':>6} {'Sample':>9} {'Level':>6} {'Quantized':>10} {'Binary':>7}")
for n, (tt, s, i, q, c) in enumerate(zip(ts, samples, index, quantized, codes)):
    print(f"{n:>3} {tt:>6.3f} {s:>9.4f} {i:>6} {q:>10.4f} {c:>7}")
print(f"\nPCM bit stream ({len(pcm_stream)} bits):\n{pcm_stream}")

# ---------------- 5. Decoding & Reconstruction ----------------
rx_codes = [pcm_stream[k:k + n_bits] for k in range(0, len(pcm_stream), n_bits)]
rx_index = np.array([int(c, 2) for c in rx_codes])
rx_values = -A + (rx_index + 0.5) * delta


def sinc_reconstruct(values, t_samples, t_out, fs):
    # ideal low-pass (sinc interpolation) reconstruction
    return np.array([np.sum(values * np.sinc(fs * (tt - t_samples))) for tt in t_out])


reconstructed = sinc_reconstruct(rx_values, ts, t, fs)

mse = np.mean(q_error ** 2)
sqnr = 10 * np.log10(np.mean(samples ** 2) / mse)
print(f"\nQuantization MSE = {mse:.5f}, SQNR = {sqnr:.2f} dB "
      f"(theory 6.02n + 1.76 = {6.02 * n_bits + 1.76:.2f} dB)")

# ---------------- Plot ----------------
fig, axes = plt.subplots(5, 1, figsize=(12, 14))

axes[0].plot(t, analog, "b")
axes[0].set_title("1. Analog Sinusoidal Signal")

axes[1].plot(t, analog, "b", alpha=0.3)
axes[1].stem(ts, samples, linefmt="r-", markerfmt="ro", basefmt="k-")
axes[1].set_title(f"2. Sampled Signal (fs = {fs} Hz)")

axes[2].plot(t, analog, "b", alpha=0.3)
axes[2].step(ts, quantized, "g", where="post", label="Quantized")
axes[2].plot(ts, samples, "ro", markersize=4, label="Samples")
for lvl in -A + (np.arange(L) + 0.5) * delta:
    axes[2].axhline(lvl, color="gray", linestyle=":", linewidth=0.6)
for tt, q, c in zip(ts, quantized, codes):
    axes[2].annotate(c, (tt, q), textcoords="offset points", xytext=(0, 6),
                     ha="center", fontsize=7)
axes[2].set_title(f"3 & 4. Quantized Signal ({L} levels) with Binary Codes")
axes[2].legend(loc="upper right")

bits = np.array([int(b) for b in pcm_stream])
tb = np.arange(len(bits) + 1)
axes[3].step(tb, np.append(bits, bits[-1]), "k", where="post")
axes[3].set_ylim(-0.2, 1.2)
axes[3].set_title("4. PCM Encoded Bit Stream")
axes[3].set_xlabel("Bit index")

axes[4].plot(t, analog, "b--", alpha=0.6, label="Original")
axes[4].plot(t, reconstructed, "m", label="Reconstructed")
axes[4].set_title("5. Reconstructed Signal")
axes[4].legend(loc="upper right")
axes[4].set_xlabel("Time (s)")

for ax in axes:
    ax.set_ylabel("Amplitude")
    ax.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig("pcm.png", dpi=120)
plt.show()
