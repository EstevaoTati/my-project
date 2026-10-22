// Render film.html deterministically: seek(t) per frame, screenshot, pipe to ffmpeg.
//   node render.mjs preview fr 1.2,7,15      -> preview-fr-<t>.jpg
//   node render.mjs video fr                 -> mwinda-film-fr.mp4 (silent)
//   node render.mjs cues fr                  -> cues.json
import { chromium } from "../bi-harness/node_modules/playwright-core/index.mjs";
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const HERE = new URL("./", import.meta.url).pathname;
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const [mode, lang = "fr", arg = ""] = process.argv.slice(2);
const FPS = Number(process.env.FPS || 30);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ["--no-sandbox", "--force-color-profile=srgb"] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("pageerror", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("console", m.text()); });
await page.goto("file://" + HERE + "film.html?lang=" + lang + (process.env.URLCTA ? "&url=" + encodeURIComponent(process.env.URLCTA) : ""));
await page.evaluate(() => window.ready);
const dur = await page.evaluate(() => window.FILM.DUR);

if (mode === "cues") {
  const cues = await page.evaluate(() => window.FILM.CUES);
  writeFileSync(HERE + "cues.json", JSON.stringify({ dur, cues }, null, 1));
  console.log(cues.length, "cues");
} else if (mode === "preview") {
  for (const t of arg.split(",").map(Number)) {
    await page.evaluate((t) => window.FILM.seek(t), t);
    await page.screenshot({ path: `${HERE}preview-${lang}-${t}.jpg`, type: "jpeg", quality: 85 });
  }
  console.log("previews written");
} else if (mode === "video") {
  const out = HERE + `mwinda-film-${lang}-silent.mp4`;
  const ff = spawn(FFMPEG, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart", out],
    { stdio: ["pipe", "inherit", "inherit"] });
  const frames = Math.round(dur * FPS);
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    await page.evaluate((t) => window.FILM.seek(t), i / FPS);
    const buf = await page.screenshot({ type: "jpeg", quality: 94 });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (i % 150 === 0) console.log(`frame ${i}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  console.log("wrote", out);
}
await browser.close();
