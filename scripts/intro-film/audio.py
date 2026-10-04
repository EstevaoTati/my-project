"""Original score, sound design and narration mix for the intro film.

Everything is synthesised here (no samples, no third-party music), so the
soundtrack is owned outright. Narration comes from vo/*.wav (Kokoro TTS,
voice am_michael), placed at the times in timeline.json; sound effects follow
events.json, which the picture exports from the same timing.
Writes out/mix.wav (48 kHz stereo, pre-loudnorm).
"""
import json
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve, resample_poly

SR = 48000
TL = json.load(open("timeline.json"))
EV = json.load(open("events.json"))
T = TL["total"]; N = int(T * SR)
S = TL["scenes"]
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR


def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
def lp(x, f, o=2): return sosfilt(butter(o, f, "low", fs=SR, output="sos"), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], "band", fs=SR, output="sos"), x)
def put(bus, sig, t0, gain=1.0):
    i = int(t0 * SR)
    if i >= len(bus): return
    if i < 0: sig = sig[-i:]; i = 0
    n = min(len(sig), len(bus) - i); bus[i:i + n] += sig[:n] * gain
def adsr(n, a, r, sustain_n=None):
    e = np.ones(n); na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na) ** 1.5
    if nr: e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e
def keys(t, ks):
    return np.interp(t, [k[0] for k in ks], [k[1] for k in ks])

# ---------------- music ----------------
L = np.zeros(N); R = np.zeros(N)
BEAT = 60 / 96
# D major, two bars per chord (5 s): Dmaj9 - Bm9 - Gmaj9 - A6sus
CH = [[50, 62, 66, 69, 73, 76], [47, 62, 66, 69, 71, 73], [43, 62, 66, 67, 71, 69], [45, 61, 64, 66, 69, 71]]
CH_LEN = 5.0
END_CHORD = 84.2   # the final D chord rings from here into the last frame

def pad_note(m, dur, bright=1.0):
    n = int((dur + 2.5) * SR); tt = np.arange(n) / SR; y = np.zeros(n)
    for det in (-0.004, 0.0035):
        f = hz(m) * (1 + det)
        for k in range(1, 9):
            if f * k > 6000: break
            y += np.sin(2 * np.pi * f * k * tt + rng.uniform(0, 6.28)) * (1 / k ** (1.6 - 0.3 * bright))
    y *= adsr(n, 1.6, 2.5) * (0.85 + 0.15 * np.sin(2 * np.pi * 0.13 * tt))
    return y / 6

def chord_at(i): return CH[i % len(CH)]
t = 0.0; i = 0
while t < END_CHORD:
    dur = min(CH_LEN, END_CHORD - t)
    for j, m in enumerate(chord_at(i)):
        y = pad_note(m, dur)
        pan = 0.5 + 0.35 * np.sin(j * 1.7)
        put(L, y, t, 0.11 * (1 - pan) * 2); put(R, y, t, 0.11 * pan * 2)
    # sub bass on the root
    n = int((dur + 1.5) * SR); tt = np.arange(n) / SR; root = hz(chord_at(i)[0] - 12)
    b = (np.sin(2 * np.pi * root * tt) + 0.3 * np.sin(4 * np.pi * root * tt)) * adsr(n, 0.8, 1.5)
    if t >= 5: put(L, b, t, 0.10); put(R, b, t, 0.10)
    t += CH_LEN; i += 1
# final resolution: Dmaj9 rings out
for j, m in enumerate([50, 57, 62, 66, 69, 73, 76]):
    y = pad_note(m, 3.4, bright=0.8); n = len(y)
    y *= np.exp(-np.arange(n) / SR / 5.5)
    pan = 0.5 + 0.3 * np.sin(j * 1.3); put(L, y, END_CHORD, 0.15 * (1 - pan) * 2); put(R, y, END_CHORD, 0.15 * pan * 2)

# light electronic pulse (from the presenter's first line to the closing frame)
def kick():
    n = int(0.35 * SR); tt = np.arange(n) / SR
    f = 48 + 70 * np.exp(-tt * 28); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-tt * 9)
def hat():
    n = int(0.06 * SR); return hp(rng.standard_normal(n), 7000) * np.exp(-np.arange(n) / SR * 70)
K, Hh = kick(), hat()
pulse_level = lambda x: keys(x, [[0, 0], [5.5, 0], [7.5, 1], [58.6, 1], [59.3, 0.4], [60.5, 1.15], [69, 1.15], [70, 0.85], [79.3, 0.85], [81, 0.4], [84, 0]])
b = 5.5
while b < 84:
    lv = pulse_level(b)
    beat_in_bar = round((b - 5.5) / BEAT) % 4
    if lv > 0:
        if beat_in_bar in (0, 2): put(L, K, b, 0.16 * lv); put(R, K, b, 0.16 * lv)
        put(L, Hh, b + BEAT / 2, 0.025 * lv); put(R, Hh, b + BEAT / 2 + 0.004, 0.03 * lv)
    b += BEAT

# subtle melodic detail: a soft pluck arpeggio on chord tones
def pluck(m, dec=0.45):
    n = int(1.2 * SR); tt = np.arange(n) / SR; f = hz(m)
    y = np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(4 * np.pi * f * tt) * np.exp(-tt * 10) + 0.12 * np.sin(6 * np.pi * f * tt) * np.exp(-tt * 16)
    return y * np.exp(-tt / dec) * np.minimum(1, tt / 0.004)
arp_level = lambda x: keys(x, [[0, 0], [18.0, 0], [20, 1], [46, 1], [47, 0.7], [58.5, 0.7], [60, 1.0], [69, 1.0], [70, 0.6], [79, 0.6], [81, 0]])
PAT = [0, 2, 1, 3, 2, 4, 3, 1]
b = 18.0; step = 0
while b < 81:
    lv = arp_level(b)
    if lv > 0.01:
        ch = sorted(chord_at(int(b // CH_LEN))[1:])
        m = ch[PAT[step % 8] % len(ch)] + 12
        y = pluck(m); pan = 0.5 + 0.3 * np.sin(step * 0.9)
        put(L, y, b, 0.035 * lv * (1 - pan) * 2); put(R, y, b, 0.035 * lv * pan * 2)
    b += BEAT / 2; step += 1

# musical lift under the MWINDA DIGITAL reveal: a high, slow swell
lift_t = [e["t"] for e in EV if e["kind"] == "lift"][0]
for m in (74, 78, 81, 86):
    n = int((S["s7"][0] - lift_t + 1.5) * SR); tt = np.arange(n) / SR
    y = sum(np.sin(2 * np.pi * hz(m) * (1 + d) * tt) for d in (-0.003, 0.003)) / 2
    env = np.minimum(1, tt / 1.8) * np.clip((n / SR - tt) / 1.5, 0, 1)
    put(L, y * env, lift_t, 0.03); put(R, y * env, lift_t + 0.01, 0.03)

music = np.stack([L, R])

# ---------------- sound design ----------------
FL = np.zeros(N); FR = np.zeros(N)
def sweep_noise(dur, f0, f1, q=0.5):
    n = int(dur * SR); x = rng.standard_normal(n); out = np.zeros(n); blk = 512
    zi = None
    for s0 in range(0, n, blk):
        u = s0 / n; fc = f0 * (f1 / f0) ** u
        sos = butter(2, [fc * (1 - q / 2), fc * (1 + q / 2)], "band", fs=SR, output="sos")
        out[s0:s0 + blk] = sosfilt(sos, x[s0:s0 + blk])
    return out
for e in EV:
    k, t0, g = e["kind"], e["t"], e["gain"]
    if k == "whoosh":
        d = 1.1; y = sweep_noise(d, 300, 2400, 0.9); n = len(y); u = np.arange(n) / n
        env = np.sin(np.pi * u ** 0.7) ** 2; y *= env
        put(FL, y * (1 - u), t0, 0.22 * g); put(FR, y * u, t0, 0.22 * g)
    elif k == "riser":
        d = 1.3; y = sweep_noise(d, 200, 3000, 0.8); n = len(y); u = np.arange(n) / n
        y *= u ** 2 * (1 - np.clip((u - 0.92) / 0.08, 0, 1))
        tt = np.arange(n) / SR; tone = np.sin(2 * np.pi * np.cumsum(110 + 330 * u ** 2) / SR) * u ** 2 * 0.4
        put(FL, y + tone, t0 + 0.0, 0.16 * g); put(FR, y + tone, t0 + 0.01, 0.16 * g)
    elif k == "accent":
        n = int(3.5 * SR); tt = np.arange(n) / SR; f = hz(74)
        bell = sum(a * np.sin(2 * np.pi * f * r * tt) * np.exp(-tt * dk) for r, a, dk in [(1, 1, 0.9), (2.0, 0.4, 1.4), (2.76, 0.25, 2.2), (5.4, 0.08, 4)])
        boom = np.sin(2 * np.pi * 55 * tt) * np.exp(-tt * 2.2) * 0.8
        y = (bell * 0.5 + boom) * np.minimum(1, tt / 0.003)
        put(FL, y, t0, 0.14 * g); put(FR, y, t0 + 0.012, 0.14 * g)
    elif k == "tick":
        n = int(0.12 * SR); tt = np.arange(n) / SR
        y = (np.sin(2 * np.pi * 1760 * tt) + 0.5 * np.sin(2 * np.pi * 2640 * tt)) * np.exp(-tt * 55)
        put(FL, y, t0, 0.05 * g); put(FR, y, t0, 0.05 * g)
fx = np.stack([FL, FR])

# reverb: a decorrelated, exponentially decaying stereo tail
def ir(sec, dk):
    n = int(sec * SR); tt = np.arange(n) / SR
    return np.stack([lp(rng.standard_normal(n), 6000) * np.exp(-tt * dk) for _ in range(2)]) * 0.02
IR = ir(2.8, 2.6)
def verb(x, wet):
    return x + wet * np.stack([fftconvolve(x[c], IR[c])[:N] for c in range(2)])
music = verb(music, 0.9); fx = verb(fx, 0.6)

# ---------------- narration ----------------
vo = np.zeros(N)
for c in TL["cues"]:
    y, sr = sf.read(c["file"]); y = resample_poly(y, SR, sr)
    put(vo, y, c["at"])
vo = hp(vo, 80, 2)
vo = vo + 0.25 * bp(vo, 2500, 5000)   # a little presence
def follower(x, att, rel, blk=64):
    a_, r_ = np.exp(-blk / (att * SR)), np.exp(-blk / (rel * SR)); out = np.zeros(len(x)); acc = 0.0
    for i0 in range(0, len(x), blk):
        v = np.abs(x[i0:i0 + blk]).max(); acc = a_ * acc + (1 - a_) * v if v > acc else r_ * acc; out[i0:i0 + blk] = acc
    return out
vo /= np.max(np.abs(vo)) + 1e-9
# gentle 3:1 compression above -14 dBFS peak envelope, then set speech RMS to -20 dBFS
lvl = 20 * np.log10(follower(vo, 0.005, 0.12) + 1e-9)
vo *= 10 ** (-np.maximum(0, lvl + 14) * (1 - 1 / 3) / 20)
_sp = np.zeros(N, bool)
for c in TL["cues"]: _sp[int(c["at"] * SR):int((c["at"] + c["dur"]) * SR)] = True
vo *= 10 ** ((-20 - 20 * np.log10(np.sqrt(np.mean(vo[_sp] ** 2)))) / 20)

# ducking: music sits under the voice and rises in the gaps, opening, transitions and ending
env = np.abs(vo); a_att, a_rel = np.exp(-1 / (0.05 * SR)), np.exp(-1 / (0.45 * SR))
sm = np.zeros(N); acc = 0.0
for i0 in range(0, N, 64):          # block-wise envelope follower
    v = env[i0:i0 + 64].max()
    acc = a_att * acc + (1 - a_att) * v if v > acc else a_rel ** 64 * acc
    sm[i0:i0 + 64] = acc
duck = 1 - 0.80 * np.clip(sm / 0.05, 0, 1)
base = 0.36 * keys(t_all, [[0, 2.0], [4.6, 2.0], [5.8, 1.0], [79.4, 1.0], [80.3, 1.1], [85.9, 1.1], [86.8, 2.0], [90, 2.0]])
lift = 1 + 0.25 * np.exp(-((t_all - (lift_t + 1.0)) / 1.6) ** 2)
mus_gain = base * duck * lift
fade = np.clip((T - t_all) / 0.6, 0, 1) ** 2 * np.clip(t_all / 0.05, 0, 1)
fx *= 0.55
mix = (music * mus_gain * 0.9 + fx) * fade + np.stack([vo, vo])
mix /= max(1.0, np.max(np.abs(mix)) / 0.95)
sf.write("out/mix.wav", mix.T.astype(np.float32), SR, subtype="FLOAT")
sf.write("out/music_only.wav", ((music * base * lift * 0.9 + fx) * fade).T.astype(np.float32) / max(1.0, np.max(np.abs(music)) / 0.95), SR, subtype="FLOAT")
sp = np.zeros(N, bool)
for c in TL["cues"]: sp[int(c["at"] * SR):int((c["at"] + c["dur"]) * SR)] = True
db = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
bed = (music * mus_gain * 0.9 + fx)[0]
print("voice", round(db(vo[sp]), 1), "bed under voice", round(db(bed[sp]), 1), "bed in s1", round(db(bed[:5 * SR]), 1), "end", round(db(bed[87 * SR:]), 1))
print("mix peak", np.max(np.abs(mix)), "duration", N / SR)
