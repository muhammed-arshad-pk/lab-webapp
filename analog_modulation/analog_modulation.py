"""
Analog Modulation: Amplitude (AM), Frequency (FM) and Phase (PM) modulation.
Plots message, carrier and the three modulated waveforms.
"""
import numpy as np
import matplotlib.pyplot as plt

# ---------------- Parameters ----------------
fs = 10000          # sampling frequency (Hz)
t = np.arange(0, 1, 1 / fs)

Am, fm = 1.0, 5     # message amplitude & frequency
Ac, fc = 1.0, 50    # carrier amplitude & frequency
ka = 0.8            # AM modulation index
kf = 30             # FM frequency deviation (Hz per unit amplitude)
kp = np.pi / 2      # PM phase deviation (rad per unit amplitude)

# ---------------- Signals ----------------
message = Am * np.sin(2 * np.pi * fm * t)
carrier = Ac * np.sin(2 * np.pi * fc * t)

# AM: amplitude of carrier varies with the message
am_signal = Ac * (1 + ka * message) * np.sin(2 * np.pi * fc * t)

# FM: instantaneous frequency varies with the message
#     phase = 2*pi*kf * integral(message dt)
integral_m = np.cumsum(message) / fs
fm_signal = Ac * np.sin(2 * np.pi * fc * t + 2 * np.pi * kf * integral_m)

# PM: phase of carrier varies directly with the message
pm_signal = Ac * np.sin(2 * np.pi * fc * t + kp * message)

# ---------------- Info ----------------
print("Analog Modulation Parameters")
print(f"  Message : Am={Am}, fm={fm} Hz")
print(f"  Carrier : Ac={Ac}, fc={fc} Hz")
print(f"  AM modulation index (mu)    = {ka}")
print(f"  FM modulation index (beta)  = {kf * Am / fm:.2f}")
print(f"  PM phase deviation (rad)    = {kp * Am:.2f}")

# ---------------- Plot ----------------
plots = [
    (message, "Message Signal", "b"),
    (carrier, "Carrier Signal", "g"),
    (am_signal, "Amplitude Modulated (AM) Signal", "r"),
    (fm_signal, "Frequency Modulated (FM) Signal", "m"),
    (pm_signal, "Phase Modulated (PM) Signal", "c"),
]

fig, axes = plt.subplots(len(plots), 1, figsize=(12, 12), sharex=True)
for ax, (sig, title, color) in zip(axes, plots):
    ax.plot(t, sig, color, linewidth=1)
    ax.set_title(title)
    ax.set_ylabel("Amplitude")
    ax.grid(True)
# draw the AM envelope for reference
axes[2].plot(t, Ac * (1 + ka * message), "k--", linewidth=0.8)
axes[2].plot(t, -Ac * (1 + ka * message), "k--", linewidth=0.8)
axes[-1].set_xlabel("Time (s)")

plt.tight_layout()
plt.savefig("analog_modulation.png", dpi=120)
plt.show()
