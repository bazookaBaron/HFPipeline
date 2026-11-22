// Usage: node dialogue/thumbs/make_thumb.mjs <slug|all> [--probe t1,t2,..]
// Reads dialogue/thumbs/hooks.json. Writes dialogue/episodes/<slug>/out/<slug>_thumb_9x16.png (1080x1920).
// --probe dumps frames of the final mp4 at the given seconds to dialogue/thumbs/work/ for picking cardT.
import fs from 'fs'; import path from 'path'; import cp from 'child_process'; import { fileURLToPath, pathToFileURL } from 'url'; import { createRequire } from 'module';
const here = path.dirname(fileURLToPath(import.meta.url)), REPO = path.resolve(here, '../..');
const puppeteer = createRequire(path.join(REPO, 'package.json'))('puppeteer-core');
const CHROME = 'C:/Users/debna/.cache/puppeteer/chrome-headless-shell/win64-146.0.7680.153/chrome-headless-shell-win64/chrome-headless-shell.exe';
const hooks = JSON.parse(fs.readFileSync(path.join(here, 'hooks.json'), 'utf8'));
const args = process.argv.slice(2), which = args[0] || 'all', pi = args.indexOf('--probe');
const slugs = which === 'all' ? Object.keys(hooks) : [which];
const work = path.join(here, 'work'); fs.mkdirSync(work, { recursive: true });
const vid = s => path.join(REPO, 'dialogue/episodes', s, 'out', `${s}_9x16.mp4`);
const grab = (s, t, out) => cp.execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(t), '-i', vid(s), '-frames:v', '1', out]);
if (pi > 0) { for (const t of args[pi + 1].split(',')) grab(slugs[0], t, path.join(work, `${slugs[0]}_t${t}.png`)); console.log('probed', slugs[0]); process.exit(0); }
const ACC = '#FFB84D', CREAM = '#FFF6E5';
const html = (h, frameUrl, fontUrl) => `<!doctype html><meta charset=utf-8><style>
@font-face{font-family:G;src:url(${fontUrl});font-weight:100 900}
*{margin:0;box-sizing:border-box}
body{width:1080px;height:1920px;overflow:hidden;background:#120c3a;font-family:G;position:relative}
.bg{position:absolute;inset:-60px;background:url(${frameUrl}) center/cover;filter:blur(26px) brightness(.38) saturate(1.2)}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(18,12,58,.82) 0%,rgba(18,12,58,.35) 55%,rgba(18,12,58,.7) 100%)}
.hook{position:absolute;left:70px;right:70px;top:360px;color:${CREAM};font-weight:850;font-size:176px;line-height:.93;letter-spacing:-4px;text-transform:uppercase;white-space:nowrap;text-shadow:0 6px 0 rgba(10,6,40,.55)}
.hook .a{color:${ACC}}
.tag{position:absolute;left:70px;top:0;font-weight:700;font-size:44px;letter-spacing:6px;color:#150f45;background:${ACC};padding:12px 28px 10px;border-radius:999px}
.card{position:absolute;left:54px;width:972px;height:560px;top:0;border-radius:40px;background:url(${frameUrl}) no-repeat;background-size:1350px auto;background-position:-189px -302px;box-shadow:0 0 0 4px rgba(255,255,255,.14),0 30px 80px rgba(0,0,0,.55)}
</style><div class=bg></div><div class=shade></div>
<div class=hook>${h.hook.map((l, i) => i === h.accent ? `<span class=a>${l}</span>` : l).join('<br>')}</div>
<div class=tag id=tag>${h.tag}</div><div class=card id=card></div>`;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'shell', args: ['--no-sandbox', '--allow-file-access-from-files'] });
for (const s of slugs) {
  const h = hooks[s], f = path.join(work, `${s}_card.png`); grab(s, h.cardT, f);
  const page = await browser.newPage(); await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  const p = path.join(work, `${s}.html`);
  fs.writeFileSync(p, html(h, pathToFileURL(f).href, pathToFileURL(path.join(REPO, 'dialogue/mg/fonts/Geist-400.woff2')).href));
  await page.goto(pathToFileURL(p).href); await page.evaluate(() => document.fonts.ready);
  const cardBottom = await page.evaluate(() => { const hk = document.querySelector('.hook'); let fs = 190; hk.style.fontSize = fs + 'px';
    while (hk.scrollWidth > 940 && fs > 120) { fs -= 4; hk.style.fontSize = fs + 'px'; }
    const hb = hk.getBoundingClientRect().bottom, tag = document.getElementById('tag'), card = document.getElementById('card');
    tag.style.top = Math.round(hb + 40) + 'px'; card.style.top = Math.round(hb + 40 + 70 + 36) + 'px'; return { fs, hb, cb: Math.round(hb + 146 + 560) }; });
  console.log(s, JSON.stringify(cardBottom));
  const out = path.join(REPO, 'dialogue/episodes', s, 'out', `${s}_thumb_9x16.png`);
  await page.screenshot({ path: out }); await page.close(); console.log(s, '->', out, );
}
await browser.close();
