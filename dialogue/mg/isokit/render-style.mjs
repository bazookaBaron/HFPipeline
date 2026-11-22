// Usage (from repo root): node runtime/jobq.js --kind render -- node dialogue/mg/isokit/render-style.mjs [A,B,C] [t]
// Renders isokit style frames (episodes/_style/frames.js) in 9:16 card layout and 16:9 full frame + one side-by-side sheet.
import http from 'http'; import fs from 'fs'; import path from 'path'; import cp from 'child_process'; import { fileURLToPath, pathToFileURL } from 'url'; import { createRequire } from 'module';
const here = path.dirname(fileURLToPath(import.meta.url)), DLG = path.resolve(here, '../..'), REPO = path.resolve(DLG, '..');
const puppeteer = createRequire(path.join(REPO, 'package.json'))('puppeteer-core');
const CHROME = 'C:/Users/debna/.cache/puppeteer/chrome-headless-shell/win64-146.0.7680.153/chrome-headless-shell-win64/chrome-headless-shell.exe';
const { pageHtml } = await import(pathToFileURL(path.join(here, 'stage.js')).href);
const { FRAMES } = await import(pathToFileURL(path.join(DLG, 'episodes/_style/frames.js')).href);
const OUT = path.join(DLG, 'episodes/_style/out'), HT = path.join(OUT, 'html'); fs.mkdirSync(HT, { recursive: true });
const MIME = { '.html': 'text/html', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => { const f = path.join(DLG, decodeURIComponent(req.url.split('?')[0])); if (path.relative(DLG, f).startsWith('..') || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const port = server.address().port;
const names = (process.argv[2] || 'A,B,C').split(','), t = +(process.argv[3] ?? 2);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell', args: ['--no-sandbox'] });
const DIMS = { '9x16': [1080, 1920], '16x9': [1920, 1080] };
try {
  for (const n of names) for (const r of ['9x16', '16x9']) {
    const html = pageHtml(FRAMES[n], r, t), file = `${n}_${r}`; fs.writeFileSync(path.join(HT, file + '.html'), html);
    const p = await browser.newPage(); await p.setViewport({ width: DIMS[r][0], height: DIMS[r][1] }); p.on('pageerror', e => console.log('PAGEERROR', e.message));
    await p.goto(`http://127.0.0.1:${port}/episodes/_style/out/html/${file}.html`, { waitUntil: 'load' }); await p.evaluate('document.fonts.ready.then(()=>1)');
    await p.screenshot({ path: path.join(OUT, `style_${file}.png`) }); await p.close(); console.log('[style]', file);
  }
  const ins = [], fl = []; let k = 0;
  for (const n of names) { ins.push('-i', path.join(OUT, `style_${n}_9x16.png`), '-i', path.join(OUT, `style_${n}_16x9.png`)); fl.push(`[${k}:v]scale=608:1080[a${k}];[a${k}][${k + 1}:v]hstack=2[r${k}]`); k += 2; }
  const rows = names.map((_, i) => `[r${i * 2}]`).join('');
  fl.push(`${rows}${names.length > 1 ? `vstack=${names.length},` : ''}pad=iw+24:ih+24:12:12:color=0x0b0a1e,scale=1800:-1[o]`);
  cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...ins, '-filter_complex', fl.join(';'), '-map', '[o]', path.join(OUT, 'style_sheet.png')]); console.log('[style] sheet');
} catch (e) { console.error('FAILED', e.stack || e); process.exitCode = 1; }
await browser.close(); server.close();
