// wifi_crowd MG sheet: every iso card at its storyboard stills, composited over the approved 9:16 backdrop with the float card + caption row.
// Usage (repo root): node runtime/jobq.js --kind render -- node dialogue/episodes/wifi_crowd/mgsheet.mjs [t1,t2,..]
// Writes episodes/wifi_crowd/out/mg_stills/*.png + out/mg_sheet_9x16.png (+ ms per MG frame).
import http from 'http'; import fs from 'fs'; import path from 'path'; import cp from 'child_process'; import { fileURLToPath } from 'url'; import { createRequire } from 'module';
const here = path.dirname(fileURLToPath(import.meta.url)), DLG = path.resolve(here, '../..'), REPO = path.resolve(DLG, '..');
const puppeteer = createRequire(path.join(REPO, 'package.json'))('puppeteer-core');
const CHROME = 'C:/Users/debna/.cache/puppeteer/chrome-headless-shell/win64-146.0.7680.153/chrome-headless-shell-win64/chrome-headless-shell.exe';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const PAGE = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#0E1621}#root{position:relative;width:1080px;height:1920px;background:url(/mg/examples/backdrop/hero_wide_9x16.png) center/cover}</style><div id="root"></div>
<script type="module">import { createMG } from '/mg/index.js'; const mg = createMG({ root: document.getElementById('root'), ratio: '9x16', base: location.origin + '/mg/' });
const em = await import('/episodes/wifi_crowd/mg.js'); em.default(mg, { ratio: '9x16' }); const E = await (await fetch('/episodes/wifi_crowd/shots.json').then(r => r.ok ? r : fetch('/episodes/gps/shots.json'))).json(); mg.captions(E.captions); await mg.build();
window.seek = t => mg.seek(t); window.cards = em.CARDS.map(c => ({ at: c.at, end: c.end, stills: c.stills, tag: typeof c.tag === 'function' ? c.tag(c.at + 1) : c.tag })); window.lint = () => mg.lint(); window.__ready = true;</script>`;
const server = http.createServer((req, res) => { const u = decodeURIComponent(req.url.split('?')[0]); if (u === '/page.html') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(PAGE); }
  const f = path.join(DLG, u); if (path.relative(DLG, f).startsWith('..') || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell', args: ['--no-sandbox'] });
const OUT = path.join(here, 'out'), ST = path.join(OUT, 'mg_stills'); fs.rmSync(ST, { recursive: true, force: true }); fs.mkdirSync(ST, { recursive: true });
try {
  const p = await browser.newPage(); await p.setViewport({ width: 1080, height: 1920 }); p.on('pageerror', e => console.log('PAGEERROR', e.message)); p.on('console', m => console.log('  [page]', m.text()));
  await p.goto(`http://127.0.0.1:${port}/page.html`); await p.waitForFunction('window.__ready===true', { timeout: 60000 }); await p.evaluate('document.fonts.ready.then(()=>1)');
  const cards = await p.evaluate('window.cards'); const arg = process.argv[2]; const times = arg ? arg.split(',').map(Number) : cards.flatMap(c => [c.at + .5, ...c.stills]);
  let i = 0, ms = 0; for (const t of times) { const t0 = Date.now(); await p.evaluate(t => window.seek(t), t); ms += Date.now() - t0; await p.screenshot({ path: path.join(ST, `m_${String(++i).padStart(2, '0')}.png`) }); }
  console.log('[mgsheet] lint:', JSON.stringify(await p.evaluate('window.lint()')), `| ${(ms / i).toFixed(0)} ms per MG seek | times ${times.map(t => t.toFixed(2)).join(' ')}`);
  cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', path.join(ST, 'm_%02d.png'), '-vf', `crop=1080:1000:0:80,scale=432:-1,tile=5x${Math.ceil(i / 5)}:padding=6:color=0x222222`, '-frames:v', '1', path.join(OUT, 'mg_sheet_9x16.png')]); console.log('[mgsheet] ->', path.relative(REPO, path.join(OUT, 'mg_sheet_9x16.png')), i, 'stills');
} catch (e) { console.error('FAILED', e.stack || e); process.exitCode = 1; }
await browser.close(); server.close();
