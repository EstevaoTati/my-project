# Lay the narration on the 90 s timeline; scenes stretch to the recorded voice.
import json
vo = json.load(open("vo/vo.json"))
TOTAL = 90.0
PAUSE = {",": 0.24, ":": 0.36, ".": 0.55}
LEAD = {"s2": 0.9, "s3": 0.7, "s4": 0.6, "s5": 0.6, "s6": 1.3, "s7": 0.7, "s8": 0.8}
TAIL = 0.45
scenes = {"s1": [0.0, 5.0]}
t = 5.0; cues = []
for sc in ["s2","s3","s4","s5","s6","s7","s8"]:
    start = t; t += LEAD[sc]
    for i, p in enumerate(vo[sc]):
        p["at"] = round(t, 3); cues.append(p)
        t += p["dur"]
        if i < len(vo[sc]) - 1: t += PAUSE.get(p["text"][-1], 0.08)
    t += TAIL
    scenes[sc] = [round(start, 3), round(t, 3)]
spoken_end = cues[-1]["at"] + cues[-1]["dur"]
scenes["s8"][1] = TOTAL
print("speech ends", round(spoken_end, 2), "final hold", round(TOTAL - spoken_end, 2))
for k, v in scenes.items(): print(k, v, round(v[1]-v[0], 2))
assert TOTAL - spoken_end >= 3.0, "final frame must hold > 2 s after speech"
json.dump({"total": TOTAL, "scenes": scenes, "cues": cues}, open("timeline.json", "w"), indent=1)
