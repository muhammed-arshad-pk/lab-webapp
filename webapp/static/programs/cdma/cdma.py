"""
Code Division Multiple Access (CDMA) - Direct Sequence Spread Spectrum
1. Generate orthogonal Walsh (Hadamard) spreading codes
2. Give every user its own code and random data bits
3. Spread each user's bits (bit x code) and add all users on one channel
4. Add AWGN noise
5. Despread at the receiver (correlate with each user's code) and recover bits
6. Show that a receiver with a code nobody uses gets ~0 (orthogonality)
"""
import numpy as np
import matplotlib.pyplot as plt

np.random.seed(1)

# ---------------- Parameters ----------------
n_users = 4         # number of simultaneous users
L = 8               # spreading factor (chips per bit), power of 2 >= n_users
n_bits = 6          # data bits per user
snr_db = 5          # channel SNR per chip (dB)


# ---------------- 1. Walsh codes ----------------
def walsh(n):
    """Sylvester construction: H(2n) = [[H, H], [H, -H]]."""
    H = np.array([[1]])
    while H.shape[0] < n:
        H = np.block([[H, H], [H, -H]])
    return H


W = walsh(L)
codes = W[1:n_users + 1]            # skip row 0 (all ones) - like IS-95 pilot
print("Walsh code matrix (rows = codes):")
print(W)
print("\nCross-correlation of user codes (C * C^T / L):")
print(codes @ codes.T // L)

# ---------------- 2. User data ----------------
bits = np.random.randint(0, 2, (n_users, n_bits))
symbols = 2 * bits - 1              # 0 -> -1, 1 -> +1 (BPSK / NRZ)

# ---------------- 3. Spreading & channel sum ----------------
spread = np.array([np.kron(symbols[u], codes[u]) for u in range(n_users)])
channel = spread.sum(axis=0)

# ---------------- 4. AWGN ----------------
noise_std = np.sqrt(1 / (10 ** (snr_db / 10)))
rx = channel + noise_std * np.random.randn(len(channel))

# ---------------- 5. Despreading ----------------
chips = rx.reshape(n_bits, L)       # one row per bit period
corr = chips @ codes.T / L          # correlator output: (n_bits, n_users)
rx_bits = (corr > 0).astype(int).T

print(f"\nUsers = {n_users}, spreading factor = {L}, SNR = {snr_db} dB")
print(f"Processing gain = 10*log10({L}) = {10 * np.log10(L):.2f} dB\n")
print(f"{'User':>4}  {'Code':<{3 * L}}  {'Sent':<{n_bits}}  {'Received':<{n_bits}}  Errors")
for u in range(n_users):
    code_str = " ".join(f"{c:+d}" for c in codes[u])
    sent = "".join(map(str, bits[u]))
    got = "".join(map(str, rx_bits[u]))
    print(f"{u + 1:>4}  {code_str:<{3 * L}}  {sent:<{n_bits}}  {got:<{n_bits}}  "
          f"{np.sum(bits[u] != rx_bits[u])}")

# ---------------- 6. Unused code ----------------
unused = W[n_users + 1] if n_users + 1 < L else W[0]
print(f"\nDespreading with an unused code -> {np.round(chips @ unused / L, 2)}"
      "  (close to 0: other users look like noise)")

# ---------------- Plot ----------------
fig, axes = plt.subplots(n_users + 3, 1, figsize=(12, 2 * (n_users + 3)), sharex=True)
tc = np.arange(n_bits * L + 1)

for u in range(n_users):
    ax = axes[u]
    ax.step(tc, np.append(np.repeat(symbols[u], L), symbols[u][-1]), "k--",
            where="post", alpha=0.5, label="data")
    ax.step(tc, np.append(spread[u], spread[u][-1]), where="post", label="spread")
    ax.set_title(f"User {u + 1}: bits {''.join(map(str, bits[u]))} spread with Walsh code "
                 f"{' '.join(f'{c:+d}' for c in codes[u])}")
    ax.set_ylim(-1.5, 1.5)
    ax.legend(loc="upper right")

axes[n_users].step(tc, np.append(channel, channel[-1]), "m", where="post")
axes[n_users].set_title("Composite channel signal (sum of all users)")

axes[n_users + 1].plot(np.arange(len(rx)) + 0.5, rx, "r.-", linewidth=0.8)
axes[n_users + 1].set_title(f"Received signal with AWGN (SNR = {snr_db} dB)")

for u in range(n_users):
    axes[n_users + 2].stem(np.arange(n_bits) * L + L / 2 + u * 0.6, corr[:, u],
                           linefmt=f"C{u}-", markerfmt=f"C{u}o", basefmt="k-",
                           label=f"user {u + 1}")
axes[n_users + 2].set_title("Correlator outputs after despreading (>0 -> 1, <0 -> 0)")
axes[n_users + 2].legend(loc="upper right", ncol=n_users)
axes[-1].set_xlabel("Chip index")

for ax in axes:
    for k in range(n_bits + 1):
        ax.axvline(k * L, color="gray", linewidth=0.4)
    ax.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig("cdma.png", dpi=120)
plt.show()
