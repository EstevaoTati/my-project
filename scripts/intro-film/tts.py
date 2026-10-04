# Narration: one TTS call per caption phrase, so every SRT cue is exact.
import json, numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
k = Kokoro("models/kokoro.onnx", "models/voices.bin")
VOICE = "am_michael"
# (scene, [phrases]) — script text verbatim from the brief, split at natural breaks
LINES = {
 "s2": ["I'm Estevao Tati,", "an AI consultant and AI OS founder.",
        "I help individuals and businesses turn the possibilities of artificial intelligence",
        "into practical solutions."],
 "s3": ["Every project begins with a clear need.",
        "My work connects AI strategy with implementation:",
        "identifying useful applications, selecting an approach,",
        "and building systems around the work people actually do."],
 "s4": ["That can include assistants connected to documents,", "agents that coordinate tasks,",
        "and automated workflows.", "The aim is to make AI useful within real business processes."],
 "s5": ["I also design and develop websites, web applications, and mobile experiences,",
        "bringing the interface and the underlying technology together",
        "around the needs of the project."],
 "s6": ["Explore MWINDA DIGITAL to discover its approach to AI and digital innovation,",
        "and find a starting point for your next business idea."],
 "s7": ["Whether you're an entrepreneur, a professional, or an organization exploring AI,",
        "let's start with your goals and shape the next step together."],
 "s8": ["Visit my portfolio or MWINDA DIGITAL.", "Let's talk about your next project."],
}
SAY = {"MWINDA DIGITAL": "Mwinda Digital"}
# espeak reads "Mwinda" as "Em-winda" and anglicises the name; fix in phoneme space
FIX = {"ˈɛmwˈɪndə": "mwˈɪndə", "ɛstˈɛvaʊ tˈæɾi": "ɛʃtɛvˈaʊ tˈɑːti"}
out = {}
for sc, phrases in LINES.items():
    segs = []
    for p in phrases:
        spoken = p
        for a, b in SAY.items(): spoken = spoken.replace(a, b)
        ph = k.tokenizer.phonemize(spoken, "en-us")
        for a_, b_ in FIX.items(): ph = ph.replace(a_, b_)
        a, sr = k.create(ph, voice=VOICE, speed=1.0, lang="en-us", is_phonemes=True)
        a = np.asarray(a, dtype=np.float32)
        # trim leading/trailing silence
        idx = np.where(np.abs(a) > 0.01)[0]
        a = a[max(0, idx[0]-240): idx[-1]+2400]
        fn = f"vo/{sc}_{len(segs)}.wav"; sf.write(fn, a, sr)
        segs.append({"text": p, "file": fn, "dur": len(a)/sr})
    out[sc] = segs
json.dump(out, open("vo/vo.json", "w"), indent=1)
for sc, s in out.items(): print(sc, round(sum(x["dur"] for x in s), 2), [round(x["dur"],2) for x in s])
