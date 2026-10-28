"""
Orthogonal Frequency Division Multiplexing (OFDM)
1. Generate random QPSK symbols
2. Map them onto subcarriers
3. Perform IFFT
4. Add cyclic prefix
5. Plot the OFDM waveform (receiver check included)
"""
import numpy as np
import matplotlib.pyplot as plt

np.random.seed(0)

# ---------------- Parameters ----------------
N = 64              # number of subcarriers (FFT size)
CP = 16             # cyclic prefix length (N/4)
n_symbols = 3       # number of OFDM symbols
bits_per_sym = 2    # QPSK

# ---------------- 1. Random QPSK symbols ----------------
bits = np.random.randint(0, 2, N * n_symbols * bits_per_sym)
pairs = bits.reshape(-1, 2)
# Gray mapping: 00 -> 1+j, 01 -> 1-j, 11 -> -1-j, 10 -> -1+j (normalized)
qpsk = ((1 - 2 * pairs[:, 0]) + 1j * (1 - 2 * pairs[:, 1])) / np.sqrt(2)

print("OFDM Parameters")
print(f"  Subcarriers = {N}, CP length = {CP}, OFDM symbols = {n_symbols}")
print(f"  Total bits = {len(bits)}, QPSK symbols = {len(qpsk)}\n")
print("First 8 QPSK symbols:")
for b, s in zip(pairs[:8], qpsk[:8]):
    print(f"  {b[0]}{b[1]} -> {s.real:+.3f} {s.imag:+.3f}j")

# ---------------- 2. Map onto subcarriers ----------------
X = qpsk.reshape(n_symbols, N)          # each row = one OFDM symbol in freq domain

# ---------------- 3. IFFT ----------------
x = np.fft.ifft(X, axis=1) * np.sqrt(N)  # time-domain OFDM symbols

# ---------------- 4. Add cyclic prefix ----------------
x_cp = np.hstack([x[:, -CP:], x])        # copy last CP samples to the front
tx = x_cp.ravel()                        # serial transmit stream

print(f"\nSamples per OFDM symbol: {N} + {CP} CP = {N + CP}")
print(f"Total transmitted samples: {len(tx)}")
print(f"PAPR = {10 * np.log10(np.max(np.abs(tx) ** 2) / np.mean(np.abs(tx) ** 2)):.2f} dB")

# ---------------- Receiver (verification) ----------------
rx = tx.reshape(n_symbols, N + CP)[:, CP:]          # remove CP
Y = np.fft.fft(rx, axis=1) / np.sqrt(N)             # FFT
rx_bits = np.column_stack([Y.ravel().real < 0, Y.ravel().imag < 0]).astype(int).ravel()
errors = np.sum(rx_bits != bits)
print(f"Receiver: bit errors = {errors} / {len(bits)}")

# ---------------- 5. Plots ----------------
fig = plt.figure(figsize=(13, 12))

# QPSK constellation
ax1 = fig.add_subplot(3, 2, 1)
ax1.scatter(qpsk.real, qpsk.imag, c="b")
for s, lbl in zip([1 + 1j, -1 + 1j, -1 - 1j, 1 - 1j], ["00", "10", "11", "01"]):
    s /= np.sqrt(2)
    ax1.annotate(lbl, (s.real, s.imag), textcoords="offset points", xytext=(8, 8))
ax1.axhline(0, color="k", linewidth=0.6)
ax1.axvline(0, color="k", linewidth=0.6)
ax1.set_xlim(-1.2, 1.2)
ax1.set_ylim(-1.2, 1.2)
ax1.set_title("1. QPSK Constellation")
ax1.set_xlabel("In-phase")
ax1.set_ylabel("Quadrature")

# Subcarrier mapping (first OFDM symbol)
ax2 = fig.add_subplot(3, 2, 2)
k = np.arange(N)
ax2.stem(k, X[0].real, linefmt="b-", markerfmt="bo", basefmt="k-", label="Real")
ax2.stem(k + 0.3, X[0].imag, linefmt="r-", markerfmt="ro", basefmt="k-", label="Imag")
ax2.set_title("2. QPSK Symbols Mapped onto Subcarriers (Symbol 1)")
ax2.set_xlabel("Subcarrier index")
ax2.legend(loc="upper right")

# One OFDM symbol after IFFT (no CP)
ax3 = fig.add_subplot(3, 1, 2)
ax3.plot(np.arange(N), x[0].real, "b", label="Real")
ax3.plot(np.arange(N), x[0].imag, "r", label="Imag")
ax3.set_title("3. Time-Domain OFDM Symbol after IFFT (Symbol 1, no CP)")
ax3.set_xlabel("Sample index")
ax3.legend(loc="upper right")

# Full OFDM waveform with CP highlighted
ax4 = fig.add_subplot(3, 1, 3)
n = np.arange(len(tx))
ax4.plot(n, tx.real, "b", linewidth=1, label="Real")
ax4.plot(n, tx.imag, "r", linewidth=1, alpha=0.6, label="Imag")
for s in range(n_symbols):
    start = s * (N + CP)
    ax4.axvspan(start, start + CP, color="orange", alpha=0.3,
                label="Cyclic Prefix" if s == 0 else None)
    ax4.axvline(start, color="k", linewidth=0.6)
ax4.set_title(f"4 & 5. OFDM Waveform with Cyclic Prefix ({n_symbols} symbols)")
ax4.set_xlabel("Sample index")
ax4.legend(loc="upper right")

for ax in [ax2, ax3, ax4, ax1]:
    ax.grid(True, alpha=0.3)
for ax in [ax2, ax3, ax4]:
    ax.set_ylabel("Amplitude")

plt.tight_layout()
plt.savefig("ofdm.png", dpi=120)
plt.show()
