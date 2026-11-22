// Usage: node dialogue/mg/render.mjs stills [name,...] | video 9x16|16x9 | all | cloud (episode cue stills + contact sheet + bbox checks) | cloudvideo | ep <name> (same as cloud for any episode) | epvideo <name>     (run through runtime/jobq.js, kind render)
import http from 'http'; import fs from 'fs'; import path from 'path'; import cp from 'child_process'; import { fileURLToPath, pathToFileURL } from 'url'; import { createRequire } from 'module';
const here = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(here, '../..');
const puppeteer = createRequire(path.join(REPO, 'package.json'))('puppeteer-core');
const CHROME = 'C:/Users/debna/.cache/puppeteer/chrome-headless-shell/win64-146.0.7680.153/chrome-headless-shell-win64/chrome-headless-shell.exe';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.geojson': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.css': 'text/css' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]), f = /^\/(episodes|mg)\//.test(u) ? path.join(here, '..', u) : path.join(here, u);  /* /episodes/* and /mg/* resolve from dialogue/ (engine layout) */ if (path.relative(path.join(here, '..'), f).startsWith('..') || !fs.existsSync(f) || !fs.statSync(f).isFile()) { console.log('  404', req.url); res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const OUT = path.join(here, 'examples', 'out'); fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell', protocolTimeout: 3600000, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox', '--allow-file-access-from-files'] });
const DIMS = { '9x16': [1080, 1920], '16x9': [1920, 1080] }; const pages = {};
const page = async a => pages[a] ??= await (async () => { const [w, h] = DIMS[a]; const p = await browser.newPage(); await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 }); p.on('console', m => console.log(`  [${a}]`, m.text())); p.on('pageerror', e => console.log('  PAGEERROR', e.message)); await p.goto(`http://127.0.0.1:${port}/preview.html?w=${w}&h=${h}`); await p.waitForFunction('window.__ready===true', { timeout: 60000 }); return p; })();
const { examples, order } = await import(pathToFileURL(path.join(here, 'examples/index.js')).href);
const lintAll = {};
async function stills(names) {
  for (const a of ['9x16', '16x9']) { const p = await page(a); for (const n of names) {
    const issues = await p.evaluate(n => window.load(n), n); lintAll[`${n}_${a}`] = issues; await p.evaluate(t => window.frame(t), examples[n].still); await p.evaluate('document.fonts.ready.then(()=>1)');
    await p.screenshot({ path: path.join(OUT, `${n}_${a}.png`), type: 'png' }); console.log(`[still] ${n}_${a} lint: ${issues.length ? issues.join(' | ') : 'ok'}`); } }
  fs.writeFileSync(path.join(OUT, 'lint.json'), JSON.stringify(lintAll, null, 1));
}
async function video(a) {
  const p = await page(a), N = 42 * 30; console.log('lint chain', JSON.stringify(await p.evaluate(() => window.load('chain', { per: 7, k: 1 })))); const file = path.join(OUT, `chain_42s_${a}.mp4`); const t0 = Date.now();
  const ff = cp.spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'medium', '-r', '30', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < N; i++) { await p.evaluate(t => window.frame(t), i / 30); const buf = await p.screenshot({ type: 'jpeg', quality: 95 }); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log(`[video] ${a} ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

// ---- episode jobs: cloud ----------------------------------------------------------------------------------------------------------
let EPN = 'cloud', EP = path.join(here, '../episodes/cloud'), EPOUT = path.join(EP, 'out');
const useEp = n => { EPN = n; EP = path.join(here, '../episodes', n); EPOUT = path.join(EP, 'out'); };
async function loadEpisode() { const p = await page('9x16'); const r = await p.evaluate(u => window.loadEpisode(u), `/episodes/${EPN}/mg.js`); return { p, ...r }; }
async function cloud() {
  fs.mkdirSync(path.join(EPOUT, 'stills'), { recursive: true }); const { p, lint, data, checks } = await loadEpisode(); console.log(`[${EPN}] lint:`, lint.length ? lint.join(' | ') : 'ok');
  fs.writeFileSync(path.join(EP, 'mg.json'), JSON.stringify(data, null, 1));
  const times = []; for (const c of data.cues) { for (const b of c.beats) times.push([c.id, b.t + .4, b.word]); times.push([c.id, c.end - .3, 'hold']); }
  let i = 0; for (const [cue, t, w] of times) { await p.evaluate(t => window.frame(t), t); await p.evaluate('document.fonts.ready.then(()=>1)'); await p.screenshot({ path: path.join(EPOUT, 'stills', `s_${String(++i).padStart(2, '0')}.png`), type: 'png' }); console.log(`  still ${i}: cue ${cue} t=${t.toFixed(2)} (${w})`); }
  await new Promise(r => cp.execFile('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', path.join(EPOUT, 'stills', 's_%02d.png'), '-vf', `scale=324:-1,tile=${Math.ceil(i / 4)}x4:padding=6:color=0x222222`, '-frames:v', '1', path.join(EPOUT, 'mg_sheet_9x16.png')], r));
  const bad = await p.evaluate(() => window.isoCheck()); fs.writeFileSync(path.join(EPOUT, 'mg_bbox.json'), JSON.stringify({ lint, checks: bad }, null, 1));
  console.log(`[${EPN}] ${i} stills; bbox check: ${bad.filter(x => !x.ok).length} failures of ${bad.length}`); bad.filter(x => !x.ok).forEach(x => console.log('   FAIL', JSON.stringify(x)));
  if (lint.length || bad.some(x => !x.ok)) process.exitCode = 1;
}
async function cloudvideo() {
  const { p, lint } = await loadEpisode(); console.log('lint', lint.length ? lint : 'ok'); const file = path.join(EPOUT, 'mg_only_9x16.mp4'), N = Math.round((JSON.parse(fs.readFileSync(path.join(EP, 'mg.json'), 'utf8')).duration ?? 45.4) * 30), t0 = Date.now(); fs.mkdirSync(EPOUT, { recursive: true });
  const ff = cp.spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-preset', 'veryfast', '-r', '30', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < N; i++) { await p.evaluate(t => window.frame(t), i / 30); const buf = await p.screenshot({ type: 'jpeg', quality: 90 }); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); console.log(`[cloudvideo] ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
const [job, ...rest] = process.argv.slice(2);
try { if (job === 'stills') await stills(rest.length ? rest[0].split(',') : order); else if (job === 'video') await video(rest[0]); else if (job === 'cloud') await cloud(); else if (job === 'ep') { useEp(rest[0]); await cloud(); } else if (job === 'epvideo') { useEp(rest[0]); await cloudvideo(); } else if (job === 'cloudvideo') await cloudvideo(); else if (job === 'all') { await stills(order); await video('9x16'); await video('16x9'); } else console.log('jobs: stills [names] | video 9x16|16x9 | all'); }
catch (e) { console.error('FAILED', e.stack || e); process.exitCode = 1; }
await browser.close(); server.close();
