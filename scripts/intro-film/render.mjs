// node render.mjs stills <scale> t1,t2,...        -> stills/t_<t>.jpg
// node render.mjs video <scale> <from> <to> <out> -> H.264 segment (frames [from,to) at 30 fps)
import { createRequire } from 'module';
import { spawn } from 'child_process';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const [mode, scaleS, a, b, out] = process.argv.slice(2);
const scale = parseFloat(scaleS);
const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', m => console.log('[page]', m.text())); page.on('pageerror', e => console.log('[err]', e.message));
await page.goto(`http://127.0.0.1:8765/film.html?scale=${scale}`);
await page.evaluate(() => window.ready);
const grab = async t => Buffer.from((await page.evaluate(t => { window.frame(t);
  return document.getElementById('c').toDataURL('image/jpeg', 0.95).split(',')[1]; }, t)), 'base64');
if (mode === 'events') { fs.writeFileSync('events.json', JSON.stringify(await page.evaluate(() => window.EVENTS), null, 1)); }
const SD = process.env.STILLS || 'stills';
if (mode === 'stills') { fs.mkdirSync(SD, { recursive: true });
  for (const t of a.split(',').map(Number)) fs.writeFileSync(`${SD}/t_${t.toFixed(2)}.jpg`, await grab(t)); }
if (mode === 'video') {
  const f0 = +a, f1 = +b;
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-tune', 'film',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-x264-params', 'keyint=60:min-keyint=60:scenecut=0', out],
    { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) { const buf = await grab(f / 30);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - f0) % 150 === 0) console.log(out, f, ((Date.now() - t0) / (f - f0 + 1)).toFixed(0) + 'ms/frame'); }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
}
await browser.close();
