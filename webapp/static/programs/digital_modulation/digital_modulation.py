"""
Digital Modulation: BASK, BFSK, BPSK and QPSK.

1. An analog signal (sine wave) is sampled and quantized (ADC) and the
   binary value of every sample is printed.
2. The resulting bit stream is modulated with BASK, BFSK, BPSK and QPSK.
3. Each modulated signal is demodulated (coherent correlation) and the
   recovered bits are printed and checked against the original.
"""
import numpy as np
import matplotlib.pyplot as plt

# ---------------- Analog -> Binary (ADC) ----------------
n_samples = 4        # number of samples taken from the analog signal
n_bits = 4           # bits per sample (16 quantization levels)
f_analog = 1         # analog signal frequency (Hz)

t_s = np.arange(n_samples) / (n_samples * f_analog)
analog = np.sin(2 * np.pi * f_analog * t_s + np.pi / 6)

levels = 2 ** n_bits
quantized = np.round((analog + 1) / 2 * (levels - 1)).astype(int)  # 0..15

print("Analog signal -> binary (ADC)")
print(f"{'Sample':>6} {'Analog':>9} {'Level':>6} {'Binary':>8}")
bit_str = ""
for i, (a, q) in enumerate(zip(analog, quantized)):
    b = format(q, f"0{n_bits}b")
    bit_str += b
    print(f"{i:>6} {a:>9.4f} {q:>6} {b:>8}")

bits = np.array([int(b) for b in bit_str])
print(f"\nBit stream ({len(bits)} bits): {bit_str}\n")

# ---------------- Modulation parameters ----------------
fs = 1000           # samples per second
Tb = 1.0            # bit duration (s)
spb = int(fs * Tb)  # samples per bit
fc = 5              # carrier frequency (Hz)
f0, f1 = 3, 8       # BFSK frequencies for bit 0 and bit 1

tb = np.arange(spb) / fs                      # time within one bit
t = np.arange(len(bits) * spb) / fs           # full time axis
digital = np.repeat(bits, spb)                # NRZ waveform for plotting


def bask(bits):
    return np.concatenate([b * np.sin(2 * np.pi * fc * tb) for b in bits])


def bfsk(bits):
    return np.concatenate([np.sin(2 * np.pi * (f1 if b else f0) * tb) for b in bits])


def bpsk(bits):
    # bit 1 -> phase 0, bit 0 -> phase pi
    return np.concatenate([(2 * b - 1) * np.sin(2 * np.pi * fc * tb) for b in bits])


ts = np.arange(2 * spb) / fs                  # time within one QPSK symbol (2 bits)


def qpsk(bits):
    # each symbol (2 bits) lasts 2*Tb; I on cos, Q on sin (Gray mapping)
    pairs = bits.reshape(-1, 2)
    sym = [((2 * i - 1) * np.cos(2 * np.pi * fc * ts) +
            (2 * q - 1) * np.sin(2 * np.pi * fc * ts)) / np.sqrt(2)
           for i, q in pairs]
    return np.concatenate(sym)


# ---------------- Demodulation (correlation receivers) ----------------
def chunks(sig):
    return sig.reshape(-1, spb)


def demod_bask(sig):
    ref = np.sin(2 * np.pi * fc * tb)
    energy = np.sum(ref * ref)
    return (chunks(sig) @ ref > energy / 2).astype(int)


def demod_bfsk(sig):
    c0 = chunks(sig) @ np.sin(2 * np.pi * f0 * tb)
    c1 = chunks(sig) @ np.sin(2 * np.pi * f1 * tb)
    return (c1 > c0).astype(int)


def demod_bpsk(sig):
    return (chunks(sig) @ np.sin(2 * np.pi * fc * tb) > 0).astype(int)


def demod_qpsk(sig):
    sym = sig.reshape(-1, 2 * spb)
    i = (sym @ np.cos(2 * np.pi * fc * ts) > 0).astype(int)
    q = (sym @ np.sin(2 * np.pi * fc * ts) > 0).astype(int)
    return np.column_stack([i, q]).ravel()


schemes = {
    "BASK": (bask, demod_bask),
    "BFSK": (bfsk, demod_bfsk),
    "BPSK": (bpsk, demod_bpsk),
    "QPSK": (qpsk, demod_qpsk),
}

signals = {}
for name, (mod, demod) in schemes.items():
    sig = mod(bits)
    rx = demod(sig)
    signals[name] = sig
    rx_str = "".join(map(str, rx))
    status = "OK" if np.array_equal(rx, bits) else "MISMATCH"
    print(f"{name} demodulated bits : {rx_str}  [{status}]")

# Recover analog sample values from the bits (DAC) using QPSK output
rx = demod_qpsk(signals["QPSK"])
words = ["".join(map(str, w)) for w in rx.reshape(-1, n_bits)]
print("\nRecovered samples (from QPSK):")
for w in words:
    level = int(w, 2)
    print(f"  {w} -> level {level:>2} -> value {level / (levels - 1) * 2 - 1:+.4f}")

# ---------------- Plot ----------------
fig, axes = plt.subplots(6, 1, figsize=(13, 14))

axes[0].stem(t_s, analog)
axes[0].plot(np.linspace(0, 1, 500), np.sin(2 * np.pi * f_analog * np.linspace(0, 1, 500) + np.pi / 6), "g--", alpha=0.5)
for x, y, q in zip(t_s, analog, quantized):
    axes[0].annotate(format(q, f"0{n_bits}b"), (x, y), textcoords="offset points", xytext=(5, 8))
axes[0].set_title("Analog Signal & Sampled Values (with binary codes)")

axes[1].plot(t, digital, "k", drawstyle="steps-post")
axes[1].set_ylim(-0.2, 1.2)
axes[1].set_title(f"Digital Bit Stream: {bit_str}")

colors = ["r", "m", "b", "c"]
for ax, (name, sig), c in zip(axes[2:], signals.items(), colors):
    ax.plot(t, sig, c, linewidth=1)
    ax.set_title(f"{name} Modulated Signal")
axes[-1].set_title("QPSK Modulated Signal (1 symbol = 2 bits)")

for ax in axes[1:]:
    for k in range(len(bits) + 1):
        ax.axvline(k * Tb, color="gray", linewidth=0.4)
for ax in axes:
    ax.set_ylabel("Amplitude")
    ax.grid(True, alpha=0.3)
axes[-1].set_xlabel("Time (s)")

plt.tight_layout()
plt.savefig("digital_modulation.png", dpi=120)
plt.show()
