// Usage: node runtime/jobq.js --kind render -- node dialogue/mg/render-tpl.mjs <episode> [9x16,16x9]
// MG sheet + bbox check + lint for an episode whose mg.js uses mg/templates.js, in both ratios. Writes episodes/<ep>/out/mg_sheet_<ratio>.png, mg_bbox_<ratio>.json, stills_<ratio>/.
// Does not touch render.mjs / mg.json (separate runner so a running episode job is never disturbed).
import http from 'http'; import fs from 'fs'; import path from 'path'; import cp from 'child_process'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
const here = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(here, '../..');
const puppeteer = createRequire(path.join(REPO, 'package.json'))('puppeteer-core');
const CHROME = 'C:/Users/debna/.cache/puppeteer/chrome-headless-shell/win64-146.0.7680.153/chrome-headless-shell-win64/chrome-headless-shell.exe';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.geojson': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.css': 'text/css' };
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]), f = /^\/(episodes|mg)\//.test(u) ? path.join(here, '..', u) : path.join(here, u); if (path.relative(path.join(here, '..'), f).startsWith('..') || !fs.existsSync(f) || !fs.statSync(f).isFile()) { console.log('  404', req.url); res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const [ep, ratios = '9x16,16x9'] = process.argv.slice(2); if (!ep) { console.log('usage: render-tpl.mjs <episode> [9x16,16x9]'); process.exit(2); }
const OUT = path.join(here, '../episodes', ep, 'out'); fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell', protocolTimeout: 3600000, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox', '--allow-file-access-from-files'] });
const DIMS = { '9x16': [1080, 1920], '16x9': [1920, 1080] }; let fails = 0;
try {
  for (const a of ratios.split(',')) {
    const [w, h] = DIMS[a], p = await browser.newPage(); await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 }); p.on('console', m => console.log(`  [${a}]`, m.text())); p.on('pageerror', e => console.log('  PAGEERROR', e.message));
    await p.goto(`http://127.0.0.1:${port}/preview.html?w=${w}&h=${h}`); await p.waitForFunction('window.__ready===true', { timeout: 60000 });
    const { lint, data } = await p.evaluate(u => window.loadEpisode(u), `/episodes/${ep}/mg.js`); const warns = await p.evaluate('window.__tplWarnings||[]'); console.log(`[${ep} ${a}] lint:`, lint.length ? lint.join(' | ') : 'ok', '| template warnings:', warns.length ? warns.join(' | ') : 'none');
    const dir = path.join(OUT, `stills_${a}`); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); let i = 0;
    for (const c of data.cues) for (const [lab, t] of [['in', c.at + .55], ['mid', c.at + (c.end - c.at) * .5], ['end', c.end - .3]]) { await p.evaluate(t => window.frame(t), t); await p.evaluate('document.fonts.ready.then(()=>1)'); await p.screenshot({ path: path.join(dir, `s_${String(++i).padStart(2, '0')}_${c.tpl}_${lab}.png`), type: 'png' }); }
    const bad = await p.evaluate(() => window.isoCheck()); fs.writeFileSync(path.join(OUT, `mg_bbox_${a}.json`), JSON.stringify({ lint, warnings: warns, checks: bad }, null, 1));
    const cols = 6, tw = a === '9x16' ? 300 : 440;
    // ffmpeg on Windows has no glob: copy to a plain numbered sequence for the tile
    const files = fs.readdirSync(dir).sort(); const seq = path.join(OUT, `seq_${a}`); fs.rmSync(seq, { recursive: true, force: true }); fs.mkdirSync(seq); files.forEach((f, k) => fs.copyFileSync(path.join(dir, f), path.join(seq, `q_${String(k + 1).padStart(2, '0')}.png`)));
    await new Promise(r => cp.execFile('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', path.join(seq, 'q_%02d.png'), '-vf', `scale=${tw}:-1,tile=${cols}x${Math.ceil(files.length / cols)}:padding=6:color=0x222222`, '-frames:v', '1', path.join(OUT, `mg_sheet_${a}.png`)], r)); fs.rmSync(seq, { recursive: true, force: true }); 
    const nf = bad.filter(x => !x.ok); console.log(`[${ep} ${a}] ${i} stills; bbox: ${nf.length} failures of ${bad.length}`); nf.forEach(x => console.log('   FAIL', JSON.stringify(x))); if (lint.length || nf.length || warns.length) fails++;
    await p.close();
  }
} catch (e) { console.error('FAILED', e.stack || e); fails++; }
await browser.close(); server.close(); process.exitCode = fails ? 1 : 0;
