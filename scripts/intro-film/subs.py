# SRT + ASS from the narration actually placed on the timeline (one TTS phrase per cue).
import json
TL = json.load(open("timeline.json")); cues = TL["cues"]
def split2(s, mx=46):
    if len(s) <= mx: return [s]
    words = s.split(); best = None
    for i in range(1, len(words)):
        a, b = " ".join(words[:i]), " ".join(words[i:])
        if len(a) <= mx and len(b) <= mx:
            sc = abs(len(a) - len(b)) - (6 if a[-1] in ",:" else 0)
            if best is None or sc < best[0]: best = (sc, [a, b])
    assert best, s; return best[1]
def ts(t, sep):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); sec, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}" if sep == "," else f"{h}:{m:02d}:{sec:02d}.{ms // 10:02d}"
rows = []
for i, c in enumerate(cues):
    st = c["at"]; en = c["at"] + c["dur"] + 0.25
    if i + 1 < len(cues): en = min(en, cues[i + 1]["at"] - 0.04)
    en = max(en, st + 1.2)  # short phrases stay up long enough to read
    if i + 1 < len(cues): en = min(en, cues[i + 1]["at"] - 0.04)
    rows.append((st, en, split2(c["text"])))
with open("out/estevao-tati-intro.en.srt", "w") as f:
    for i, (st, en, ls) in enumerate(rows, 1):
        f.write(f"{i}\n{ts(st, ',')} --> {ts(en, ',')}\n" + "\n".join(ls) + "\n\n")
ass = """[Script Info]
ScriptType: v4.00+
PlayResX: 3840
PlayResY: 2160
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Exo 2,74,&H00FFFFFF,&H00FFFFFF,&H70060302,&H70060302,0,0,0,0,100,100,1,0,3,18,0,2,400,400,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
for st, en, ls in rows:
    ass += f"Dialogue: 0,{ts(st, '.')},{ts(en, '.')},Cap,,0,0,0,,{(chr(92) + 'N').join(ls)}\n"
open("out/captions.ass", "w").write(ass)
print(open("out/estevao-tati-intro.en.srt").read()[:900])
