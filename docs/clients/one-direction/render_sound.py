#!/usr/bin/env python3
"""ONE DIRECTION — temp score and sound design, synthesised (no samples, no licence).

    python3 render_sound.py        # -> out/one-direction-temp-score.wav (48 kHz stereo)

This is a TEMP track: it locks timing and dynamics for the edit and shows the
composer the arc (piano + drone -> pulse -> strings -> crescendo -> impact ->
resolution). The release master needs a composed or licensed score and a real
narrator; every hit point below is the brief the composer gets.
Cue times match render_film.py; change one and you change the other.
"""
import os
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
DUR = 88.0
N = int(SR * DUR)
T = np.arange(N) / SR
rng = np.random.default_rng(1)


def env(a, d_in, hold, d_out):
    """Trapezoid envelope over T: rise from a, hold, fall."""
    e = np.clip((T - a) / max(d_in, 1e-3), 0, 1)
    e *= np.clip(1 - (T - (a + d_in + hold)) / max(d_out, 1e-3), 0, 1)
    return e


def band(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    m = (f >= lo) & (f <= hi)
    edge = np.exp(-((np.minimum(np.abs(f - lo), np.abs(f - hi))) / max(lo * 0.25, 20)) ** 2)
    X *= np.where(m, 1.0, edge)
    return np.fft.irfft(X, len(x))


def note(f, t0, dur, amp=1.0, harm=(1, .45, .2, .08), decay=None, attack=0.01):
    """Placed into a full-length buffer."""
    out = np.zeros(N)
    i0, i1 = int(t0 * SR), min(N, int((t0 + dur) * SR))
    tt = np.arange(i1 - i0) / SR
    s = sum(h * np.sin(2 * np.pi * f * (k + 1) * tt) for k, h in enumerate(harm))
    e = np.minimum(tt / attack, 1)
    e *= np.exp(-tt / decay) if decay else np.clip((dur - tt) / 0.6, 0, 1)
    out[i0:i1] = s * e * amp
    return out


def pad(freqs, t0, dur, amp, bright):
    """Detuned saw-ish ensemble; `bright` = number of harmonics."""
    out = np.zeros(N)
    i0, i1 = int(t0 * SR), min(N, int((t0 + dur) * SR))
    tt = np.arange(i1 - i0) / SR
    s = np.zeros_like(tt)
    for f in freqs:
        for det in (-0.12, 0.0, 0.11):
            ff = f * 2 ** (det / 12)
            ph = rng.random() * 6.28
            for k in range(1, int(bright) + 1):
                s += np.sin(2 * np.pi * ff * k * tt + ph * k) / k ** 1.3
    e = np.clip(tt / 1.2, 0, 1) * np.clip((dur - tt) / 1.4, 0, 1)
    out[i0:i1] = s * e * amp / (len(freqs) * 3)
    return out


def kick(t0, amp=1.0, f0=110, f1=42, dec=0.35):
    out = np.zeros(N)
    i0 = int(t0 * SR)
    n = min(N - i0, int(SR * dec * 4))
    tt = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-tt * 30)
    out[i0:i0 + n] = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / dec) * amp
    return out


def whoosh(t0, dur=0.9, amp=1.0, lo=300, hi=5000, peak=0.7):
    """Noise swell that peaks at t0 (the hit), `peak` = fraction of dur before it."""
    out = np.zeros(N)
    a = t0 - dur * peak
    i0, n = max(0, int(a * SR)), int(dur * SR)
    n = min(n, N - i0)
    x = band(rng.standard_normal(n), lo, hi)
    tt = np.arange(n) / n
    e = np.where(tt < peak, (tt / peak) ** 2.5, np.exp(-(tt - peak) / (1 - peak) * 4))
    out[i0:i0 + n] = x * e * amp / (np.abs(x).max() + 1e-9)
    return out


def reverb(x, secs=2.8, mix=0.3):
    n = int(SR * secs)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR / (secs / 6))
    ir = band(ir, 120, 7000)
    ir /= np.sqrt((ir ** 2).sum())
    L = len(x) + n
    y = np.fft.irfft(np.fft.rfft(x, L) * np.fft.rfft(ir, L), L)[:len(x)]
    return x * (1 - mix) + y * mix * 1.6


A1, E2, A2, C3, E3, F2, G2, C4 = 55, 82.41, 110, 130.81, 164.81, 87.31, 98.0, 261.63
hz = lambda m: 440 * 2 ** ((m - 69) / 12)

music = np.zeros(N)
sfx = np.zeros(N)

# --- bed: dark drone, always there, swelling into the transformation
drone_env = np.clip(T / 3, 0, 1) * (0.5 + 0.5 * np.clip((T - 25) / 40, 0, 1)) * np.clip((80.4 - T) / 0.4, 0, 1)
lfo = 1 + 0.003 * np.sin(2 * np.pi * 0.07 * T)
drone = (np.sin(2 * np.pi * A1 * lfo * T) + 0.6 * np.sin(2 * np.pi * E2 * T) + 0.35 * np.sin(2 * np.pi * A2 / lfo * T))
air = band(rng.standard_normal(N), 80, 600) * 0.6
music += (drone * 0.16 + air * 0.05) * drone_env

# --- 00–12 piano: four sparse notes, the "question"
for t0, m in [(0.35, 69), (4.4, 76), (8.3, 72), (10.4, 71)]:
    music += note(hz(m), t0, 4.5, 0.22, decay=1.6)
    music += note(hz(m - 12), t0, 4.5, 0.10, decay=1.2)
music += note(hz(93), 0.35, 3, 0.03, harm=(1,), decay=1.0)   # the glint of the first light

# --- 12–76.8 pulse: heartbeat that becomes momentum
beats = []
for t0, t1, step, amp in [(12.0, 25.0, 0.75, 0.30), (25.0, 53.0, 0.75, 0.42), (53.0, 66.0, 0.5, 0.48), (66.0, 76.8, 0.375, 0.55)]:
    beats += [(b, amp) for b in np.arange(t0, t1, step)]
for b, amp in beats:
    music += kick(b, amp * (0.7 + 0.3 * min(1, (b - 12) / 60)))

# --- 25–80 strings: Am F C G, opening up (more harmonics) as clarity arrives
prog = [(A2, C3, E3, 220.0), (F2, A2, C3, 174.6), (C3 / 2 * 2, E3, 196.0, 261.6), (G2, 123.5, 146.8, 196.0)]
t0, k = 25.0, 0
while t0 < 76.8:
    p = (t0 - 25) / 52
    music += pad(prog[k % 4], t0, 4.6, 0.10 + 0.32 * p ** 1.3, 3 + 9 * p)
    t0 += 4.0
    k += 1
# high line in the transformation
for t0, m, d in [(66.0, 76, 3.0), (69.0, 79, 3.0), (72.0, 81, 2.6), (74.6, 84, 2.4)]:
    music += note(hz(m), t0, d, 0.07, harm=(1, .3, .12), attack=0.5)

# --- 76.8 breath -> 77.2–80.4 riser -> 80.4 impact -> resolution
sfx += whoosh(80.4, 3.2, 0.5, 200, 9000, peak=0.98)
music += note(hz(45), 77.2, 3.2, 0.12, harm=(1, .5), attack=2.8)
sfx += kick(80.4, 1.2, f0=90, f1=28, dec=1.1)
sfx += band(rng.standard_normal(N), 60, 4000) * env(80.4, 0.005, 0.02, 0.5) * 0.35
for f in (C3, 196.0, 261.6, 329.6, 293.7):          # C add9: lands open, not final-sounding-brass
    music += note(f, 80.4, 7.6, 0.08, harm=(1, .35, .15, .06), attack=0.6)
music += note(C4 * 2, 82.4, 5.6, 0.03, harm=(1,), attack=1.5)  # shimmer under the tagline

# --- type and transition hits
type_hits = [4.4, 8.3, 13.0, 15.6, 18.2, 20.8, 68.2, 72.4, 82.4]
for h in type_hits:
    sfx += whoosh(h, 0.7, 0.18, 1500, 9000, peak=0.6)
plate_cuts = [12.0 + 2.6 * i for i in range(1, 5)] + [37.0 + 16 / 6 * i for i in range(1, 6)]
for h in plate_cuts:
    sfx += whoosh(h, 0.6, 0.22, 600, 6000, peak=0.75)
sfx += whoosh(25.0, 1.4, 0.55, 300, 8000, peak=0.85)       # the beam
sfx += kick(25.05, 0.6, f0=80, f1=35, dec=0.8)
for i in range(7):                                         # scene 05 words
    h = 53.3 + 1.36 * i
    sfx += whoosh(h, 0.5, 0.3, 400, 7000, peak=0.8)
    sfx += kick(h, 0.35, f0=150, f1=60, dec=0.12)
sfx += whoosh(63.0, 1.0, 0.25, 200, 3000, peak=0.6)        # into the audience
crowd = band(rng.standard_normal(N), 300, 2500) * env(63.0, 0.6, 1.8, 0.8) * 0.06
sfx += crowd
sfx += whoosh(66.0, 1.2, 0.3, 200, 5000, peak=0.7)

mix = reverb(music, 3.2, 0.35) + reverb(sfx, 1.8, 0.2)
mix *= np.clip((DUR - T) / 1.2, 0, 1) * np.clip(T / 0.05, 0, 1)
# stereo: slow decorrelated widening, centre stays solid for the narrator's mono
side = band(np.roll(mix, int(SR * 0.011)), 400, 16000) * 0.25
L, R = mix + side, mix - side
st = np.stack([L, R], 1)
st /= np.abs(st).max() / 0.89
# leave headroom for the voice: music bed sits ~-18 LUFS-ish; final loudness is done in ffmpeg
pcm = (st * 32767).astype(np.int16)
os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
with wave.open(os.path.join(HERE, "out", "one-direction-temp-score.wav"), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("ok")
