"""Synthesize the film's soundtrack: music bed + sound design on the film's cues.

Everything is generated here (no samples, no licences): a cinematic pad on an
Am-F-C-G progression, a sub pulse, an arpeggio and light drums that enter with
the product walkthrough, and effects placed on the cues the film exports.
"""
import json, sys
import numpy as np

SR = 44100
cues = json.load(open(sys.argv[1]))
DUR = cues["dur"] + 0.5
N = int(DUR * SR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)

import os
BASS_IN = float(os.environ.get('BASS_IN', 6.3))
ARP_IN = float(os.environ.get('ARP_IN', 26.0))
DRUMS_IN = float(os.environ.get('DRUMS_IN', 20.9))
HATS_IN = float(os.environ.get('HATS_IN', 26.0))
BPM = 100
BEAT = 60 / BPM
BAR = 4 * BEAT

def midi(n): return 440.0 * 2 ** ((n - 69) / 12)

def env_adsr(n, a, d, s, r, sus_len):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    sl = max(0, int(sus_len * SR))
    e = np.concatenate([np.linspace(0, 1, max(a, 1)), np.linspace(1, s, max(d, 1)), np.full(sl, s), np.linspace(s, 0, max(r, 1))])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))

def lowpass(x, cutoff):
    # one-pole, applied twice
    a = np.exp(-2 * np.pi * cutoff / SR)
    for _ in range(2):
        y = np.empty_like(x); acc = 0.0
        # vectorised via lfilter-like cumulative approach is complex; do it in chunks with numpy
        y = _onepole(x, a)
        x = y
    return x

def _onepole(x, a):
    # y[n] = (1-a) x[n] + a y[n-1]  — implemented with scipy-free recursion in blocks
    out = np.empty_like(x)
    prev = 0.0
    b = 1 - a
    block = 4096
    powers = a ** np.arange(1, block + 1)
    for i in range(0, len(x), block):
        seg = x[i:i + block] * b
        n = len(seg)
        # y = conv(seg, a^k) + prev * a^(k+1)
        k = np.arange(n)
        y = np.convolve(seg, a ** k)[:n] + prev * powers[:n]
        out[i:i + n] = y
        prev = y[-1]
    return out

def highpass(x, cutoff):
    return x - _onepole(x, np.exp(-2 * np.pi * cutoff / SR))

L = np.zeros(N); R = np.zeros(N)
def add(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N: return
    sig = sig[: N - i]
    lg, rg = gain * np.sqrt((1 - pan) / 2), gain * np.sqrt((1 + pan) / 2)
    L[i:i + len(sig)] += sig * lg
    R[i:i + len(sig)] += sig * rg

# ---------------------------------------------------------------- music ----
# progression: Am  F  C  G  (2 bars each) — warm, cinematic, hopeful
CHORDS = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67]]
ROOTS = [45, 41, 48, 43]
CH_LEN = 2 * BAR

def pad_note(f, length):
    n = int(length * SR); tt = np.arange(n) / SR
    s = np.zeros(n)
    for det in (-0.12, 0.0, 0.11):           # three slightly detuned voices
        ff = f * 2 ** (det / 12)
        for h, amp in ((1, 1), (2, .35), (3, .18), (4, .08)):
            s += amp * np.sin(2 * np.pi * ff * h * tt + rng.uniform(0, 6))
    return s * env_adsr(n, 1.2, .4, .8, 1.6, length - 3.2)

music = np.zeros(N)
tcur = 0.0
ci = 0
while tcur < DUR:
    for note in CHORDS[ci % 4]:
        sig = pad_note(midi(note), CH_LEN + 1.5)
        i = int(tcur * SR); seg = sig[: max(0, N - i)]
        music[i:i + len(seg)] += seg * 0.028
    tcur += CH_LEN; ci += 1
music = lowpass(music, 2600)

# sub pulse + bass from the logo onwards, sidechain-style
bass = np.zeros(N)
tcur, ci = 0.0, 0
while tcur < DUR:
    f = midi(ROOTS[ci % 4] - 12)
    for b in range(8):
        st = tcur + b * BEAT
        if st < BASS_IN or st > DUR - 2.0: continue
        n = int(BEAT * SR); tt = np.arange(n) / SR
        e = (1 - np.exp(-tt * 40)) * np.exp(-tt * 2.2)
        sig = (np.sin(2 * np.pi * f * tt) + .3 * np.sin(4 * np.pi * f * tt)) * e
        i = int(st * SR); seg = sig[: max(0, N - i)]
        bass[i:i + len(seg)] += seg * 0.16
    tcur += CH_LEN; ci += 1

# arpeggio during the walkthrough (26 → 79 s), 8th notes
arp = np.zeros(N)
step = BEAT / 2
k = 0
tt0 = ARP_IN - (ARP_IN % step)
tc = tt0
while tc < DUR - 4.5:
    ci = int(tc // CH_LEN) % 4
    tones = CHORDS[ci] + [CHORDS[ci][1] + 12]
    f = midi(tones[k % len(tones)] + 12)
    n = int(.42 * SR); tt = np.arange(n) / SR
    sig = (np.sin(2 * np.pi * f * tt) + .25 * np.sin(6 * np.pi * f * tt)) * np.exp(-tt * 9) * (1 - np.exp(-tt * 300))
    i = int(tc * SR); seg = sig[: max(0, N - i)]
    arp[i:i + len(seg)] += seg * 0.045
    tc += step; k += 1

# drums: kick on beats, hats on off-beats, from the BI intro (20.9) to 79
drums = np.zeros(N)
def kick():
    n = int(.35 * SR); tt = np.arange(n) / SR
    f = 45 + 80 * np.exp(-tt * 30)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-tt * 9)
def hat():
    n = int(.06 * SR); tt = np.arange(n) / SR
    return highpass(rng.standard_normal(n), 6000) * np.exp(-tt * 70)
KICK, HAT = kick(), hat()
tc = DRUMS_IN
while tc < DUR - 4.5:
    i = int(tc * SR)
    seg = KICK[: max(0, N - i)]; drums[i:i + len(seg)] += seg * .20
    j = int((tc + BEAT / 2) * SR)
    if tc > HATS_IN:
        seg = HAT[: max(0, N - j)]; drums[j:j + len(seg)] += seg * .05
    tc += BEAT

# fades: music swells in, ducks a little under the logo, out at the end
fade = np.clip(t / 2.5, 0, 1) * np.clip((DUR - .3 - t) / 3.0, 0, 1)
bed = (music + bass + arp + drums) * fade

# ---------------------------------------------------------------- effects --
def noise(n): return rng.standard_normal(n)
def fx(kind):
    if kind == "click":
        n = int(.05 * SR); tt = np.arange(n) / SR
        return (highpass(noise(n), 2000) * .5 + np.sin(2 * np.pi * 2400 * tt)) * np.exp(-tt * 120) * .35
    if kind == "tick":
        n = int(.12 * SR); tt = np.arange(n) / SR
        return np.sin(2 * np.pi * 1760 * tt) * np.exp(-tt * 40) * .16
    if kind == "ding":
        n = int(1.0 * SR); tt = np.arange(n) / SR
        return (np.sin(2 * np.pi * 1318.5 * tt) + .5 * np.sin(2 * np.pi * 2637 * tt) + .2 * np.sin(2 * np.pi * 3951 * tt)) * np.exp(-tt * 5) * .16
    if kind in ("whoosh", "swish"):
        d = .9 if kind == "whoosh" else .45
        n = int(d * SR); tt = np.arange(n) / SR
        e = np.sin(np.pi * tt / d) ** 2
        x = noise(n)
        lo = _onepole(x, np.exp(-2 * np.pi * 900 / SR))
        hi = x - _onepole(x, np.exp(-2 * np.pi * 3000 / SR))
        mix = lo * (1 - tt / d) + hi * (tt / d)
        return mix * e * (.22 if kind == "whoosh" else .14)
    if kind == "boom":
        n = int(2.2 * SR); tt = np.arange(n) / SR
        f = 32 + 50 * np.exp(-tt * 5)
        sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 1.6)
        air = _onepole(noise(n), np.exp(-2 * np.pi * 400 / SR)) * np.exp(-tt * 3)
        return (sub * .55 + air * .5) * .6
    if kind == "hit":
        n = int(1.2 * SR); tt = np.arange(n) / SR
        return (np.sin(2 * np.pi * (60 + 40 * np.exp(-tt * 20)) * tt) * np.exp(-tt * 4) * .5
                + _onepole(noise(n), np.exp(-2 * np.pi * 1500 / SR)) * np.exp(-tt * 8) * .2)
    if kind == "shimmer":
        n = int(1.6 * SR); tt = np.arange(n) / SR
        s = np.zeros(n)
        for j, m in enumerate([81, 84, 88, 93]):
            st = int(j * .07 * SR)
            ttj = tt[: n - st]
            s[st:] += np.sin(2 * np.pi * midi(m) * ttj) * np.exp(-ttj * 3)
        return s * .07
    if kind == "riser":
        n = int(3.0 * SR); tt = np.arange(n) / SR
        f = 220 * 2 ** (tt * 1.0)
        return (np.sin(2 * np.pi * np.cumsum(f) / SR) * .3 + highpass(noise(n), 1500) * .4) * (tt / 3) ** 2 * np.exp(-np.maximum(tt - 2.7, 0) * 20) * .25
    return np.zeros(1)

sfx_L = np.zeros(N); sfx_R = np.zeros(N)
pan_cycle = [-.3, .25, -.1, .35, -.25, .1]
for i, c in enumerate(cues["cues"]):
    s = fx(c["kind"])
    st = c["t"] - (0.25 if c["kind"] in ("whoosh",) else 0)
    p = pan_cycle[i % len(pan_cycle)] if c["kind"] in ("tick", "swish", "ding") else 0
    j = int(max(0, st) * SR); seg = s[: max(0, N - j)]
    sfx_L[j:j + len(seg)] += seg * np.sqrt((1 - p) / 2) * 1.414
    sfx_R[j:j + len(seg)] += seg * np.sqrt((1 + p) / 2) * 1.414

# --------------------------------------------------------------- reverb ----
def make_ir(secs=1.8):
    n = int(secs * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 3.2)
    ir = _onepole(ir, np.exp(-2 * np.pi * 5000 / SR))
    return ir / np.sqrt(np.sum(ir ** 2))

def convolve(x, ir):
    size = 1 << int(np.ceil(np.log2(len(x) + len(ir))))
    return np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]

# One room for both ears, with a little difference for space: two independent
# reverbs made the mix wide but nearly uncorrelated (bad on phones and in mono).
IR_A = make_ir()
IR_B = .85 * IR_A + .15 * make_ir()
IR_B /= np.sqrt(np.sum(IR_B ** 2))

# Width on the highs only: a delay on the full mix put the 45-55 Hz bass in
# anti-phase between channels, which cancels it on a mono speaker.
d = int(.011 * SR)
low = _onepole(_onepole(bed, np.exp(-2 * np.pi * 250 / SR)), np.exp(-2 * np.pi * 250 / SR))
high = bed - low
bedL = low + high
bedR = low + np.concatenate([np.zeros(d), high[:-d]]) * .35 + high * .65
srcL, srcR = bedL + sfx_L * .9, bedR + sfx_R * .9
MIX = .24
L = srcL * (1 - MIX) + convolve(srcL, IR_A) * MIX
R = srcR * (1 - MIX) + convolve(srcR, IR_B) * MIX

st = np.stack([L, R], axis=1)
st = np.tanh(st * 1.15) / np.tanh(1.15)          # gentle glue
peak = np.max(np.abs(st))
st = st / peak * 10 ** (-1.0 / 20)                # -1 dBFS peak
pcm = (st * 32767).astype("<i2")
import wave
with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
rms = np.sqrt(np.mean(st ** 2))
print(f"wrote {sys.argv[2]}  {DUR:.1f}s  rms {20*np.log10(rms):.1f} dBFS")
