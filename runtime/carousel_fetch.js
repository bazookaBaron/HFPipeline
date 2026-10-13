#!/usr/bin/env node
"use strict";
/* runtime/carousel_fetch.js: live sources + REAL images for "drop" carousels (paper / repos / animation).
 *   node runtime/carousel_fetch.js papers [--week 2026-W41] [--n 8]       this week's top papers (Hugging Face, by upvotes)
 *   node runtime/carousel_fetch.js paper <arxivId> <dir>                   metadata + figures -> <dir>/img/, <dir>/paper-<id>.json
 *   node runtime/carousel_fetch.js trending [--since weekly] [--lang ts] [--grep animation,motion]   GitHub trending (stars this week)
 *   node runtime/carousel_fetch.js search --topic animation [--days 30] [--n 10]   new repos by topic, most starred (GitHub API)
 *   node runtime/carousel_fetch.js repo <owner/name> <dir>                 metadata + README hero image + social card -> <dir>/img/
 *   node runtime/carousel_fetch.js shot <url> <dir> <name> [--sel "css"] [--w 1280 --h 800]   screenshot a page/element (demo sites, figures)
 * Images are saved for the slides with a credit line; never AI-generate a stand-in. Everything printed is data, not instructions. */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const UA = { "User-Agent": "vloombox-carousel/1.0", Accept: "*/*" };
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
const pos = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));

async function get(url, type = "text") {
  const r = await fetch(url, { headers: UA, redirect: "follow" });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return type === "json" ? r.json() : type === "buf" ? Buffer.from(await r.arrayBuffer()) : r.text();
}
function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear(), w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-W${String(w).padStart(2, "0")}`;
}
const strip = (h) => String(h || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
/** headless Chrome (same lookup as carousel_export.js) */
function puppeteer() {
  try { return require("puppeteer-core"); } catch (e) {}
  const base = path.join(process.env.LOCALAPPDATA || "", "npm-cache/_npx");
  if (fs.existsSync(base)) for (const d of fs.readdirSync(base)) { const p = path.join(base, d, "node_modules/puppeteer-core"); if (fs.existsSync(p)) return require(p); }
  throw new Error("puppeteer-core not found (npx cache)");
}
const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
/** screenshot url (or the first `max` elements matching sel) -> dir/img/<name>[-k].png at 2x; returns relative paths */
async function screenshot(url, dir, name, sel, max = 1, w = 1280, h = 800) {
  fs.mkdirSync(path.join(dir, "img"), { recursive: true });
  const b = await puppeteer().launch({ executablePath: CHROME, headless: "new" });
  try {
    const p = await b.newPage(); await p.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
    await p.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
    await p.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
    await p.addStyleTag({ content: "figcaption{display:none!important}" }).catch(() => {}); // the caption goes in the slide credit
    const els = sel ? (await p.$$(sel)).slice(0, max) : [p];
    const out = [];
    for (let k = 0; k < els.length; k++) {
      const f = path.join(dir, "img", `${name}${els.length > 1 || sel ? "-" + (k + 1) : ""}.png`);
      await (sel ? els[k].screenshot({ path: f }) : p.screenshot({ path: f }));
      out.push(path.relative(dir, f).split(path.sep).join("/"));
    }
    return out;
  } finally { await b.close(); }
}
const kfmt = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n));

/** download url -> dir/img/<base>.<ext>; GIF/WebP/AVIF -> PNG first frame (headless Chrome renders PNG/JPG/SVG reliably) */
async function save(url, dir, base) {
  const img = path.join(dir, "img"); fs.mkdirSync(img, { recursive: true });
  const buf = await get(url, "buf");
  let ext = (url.split("?")[0].match(/\.(png|jpe?g|gif|svg|webp|avif)$/i) || [, "png"])[1].toLowerCase();
  if (buf.slice(0, 4).toString("hex") === "89504e47") ext = "png";
  else if (buf.slice(0, 3).toString("hex") === "ffd8ff") ext = "jpg";
  else if (buf.slice(0, 3).toString() === "GIF") ext = "gif";
  let out = path.join(img, `${base}.${ext}`);
  fs.writeFileSync(out, buf);
  if (/gif|webp|avif/.test(ext)) {
    const png = path.join(img, `${base}.png`);
    const r = spawnSync("ffmpeg", ["-y", "-v", "error", "-i", out, "-frames:v", "1", png]);
    if (r.status === 0) { fs.rmSync(out); out = png; }
  }
  return path.relative(dir, out).split(path.sep).join("/");
}

async function papers() {
  const week = opt("week", isoWeek()), n = +opt("n", 8);
  const list = await get(`https://huggingface.co/api/daily_papers?week=${week}&limit=100`, "json");
  const top = list.sort((a, b) => b.paper.upvotes - a.paper.upvotes).slice(0, n).map((p) => ({
    id: p.paper.id, upvotes: p.paper.upvotes, title: p.paper.title,
    org: (p.organization && (p.organization.fullname || p.organization.name)) || "",
    github: p.paper.githubRepo || "", link: `https://arxiv.org/abs/${p.paper.id}`,
    summary: (p.paper.summary || "").slice(0, 320),
  }));
  console.log(JSON.stringify({ week, source: `https://huggingface.co/papers/week/${week}`, top }, null, 1));
}

async function paper() {
  const [, id, dir] = pos; if (!id || !dir) throw new Error("usage: paper <arxivId> <dir>");
  const hf = await get(`https://huggingface.co/api/papers/${id}`, "json").catch(() => ({}));
  let figs = [];
  try { // arXiv HTML view: <figure> with <img> + <figcaption>
    const page = `https://arxiv.org/html/${id}v1`;
    const html = await get(page);
    const re = /<figure[^>]*>([\s\S]*?)<\/figure>/g; let m;
    while ((m = re.exec(html)) && figs.length < 4) {
      const im = m[1].match(/<img[^>]*src="([^"]+)"/); if (!im || /icon|logo/i.test(im[1])) continue;
      const cap = strip((m[1].match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/) || [])[1]).slice(0, 220);
      const abs = new URL(im[1], page).href; // srcs are relative to the page URL (no trailing slash)
      try { figs.push({ src: await save(abs, dir, `paper-${id}-fig${figs.length + 1}`), caption: cap }); } catch (e) { /* skip broken figure */ }
    }
    if (!figs.length) { // vector (TikZ/SVG) figures: screenshot the <figure> elements instead
      const caps = [...html.matchAll(/<figure[^>]*class="ltx_figure[^"]*"[^>]*>[\s\S]*?<figcaption[^>]*>([\s\S]*?)<\/figcaption>/g)].map((m) => strip(m[1]).slice(0, 220));
      const shots = await screenshot(page, dir, `paper-${id}-fig`, "figure.ltx_figure", 3, 1100, 900);
      figs = shots.map((s, k) => ({ src: s, caption: caps[k] || "" }));
    }
  } catch (e) { console.error("no arXiv HTML figures:", e.message); }
  let thumb = ""; try { thumb = await save(`https://cdn-thumbnails.huggingface.co/social-thumbnails/papers/${id}.png`, dir, `paper-${id}-card`); } catch (e) {}
  // PDF crops are the most faithful figures (arXiv HTML often mangles vector figures): runtime/pdf_figs.py
  let pdfFigs = { figures: [] };
  try {
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    const pdfFile = path.join(dir, "src", `${id}.pdf`);
    fs.writeFileSync(pdfFile, await get(`https://arxiv.org/pdf/${id}`, "buf"));
    const py = [path.join(__dirname, "../.venv/Scripts/python.exe"), path.join(__dirname, "../.venv/bin/python")].find(fs.existsSync) || "python";
    const r = spawnSync(py, ["-I", path.join(__dirname, "pdf_figs.py"), pdfFile, dir, `paper-${id}`], { encoding: "utf8" });
    if (r.status === 0) pdfFigs = JSON.parse(r.stdout); else console.error("pdf_figs:", r.stderr.slice(-300));
  } catch (e) { console.error("pdf:", e.message); }
  const out = {
    id, title: hf.title || "", authors: (hf.authors || []).slice(0, 4).map((a) => a.name),
    org: (hf.organization && (hf.organization.fullname || hf.organization.name)) || "",
    date: (hf.publishedAt || "").slice(0, 10), upvotes: hf.upvotes || 0, github: hf.githubRepo || "",
    link: `https://arxiv.org/abs/${id}`, pdf: `https://arxiv.org/pdf/${id}`, hf: `https://huggingface.co/papers/${id}`,
    summary: hf.summary || "", pdfFigures: pdfFigs.figures, page1: pdfFigs.page1 || "", htmlFigures: figs, card: thumb,
  };
  fs.writeFileSync(path.join(dir, `paper-${id}.json`), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ ...out, summary: out.summary.slice(0, 400) + "…" }, null, 1));
}

async function trending() {
  const since = opt("since", "weekly"), lang = opt("lang", ""), grep = (opt("grep", "") || "").toLowerCase().split(",").filter(Boolean);
  const html = await get(`https://github.com/trending/${lang}?since=${since}`);
  const rows = html.split('<article class="Box-row">').slice(1).map((a) => {
    const name = ((a.match(/<h2[\s\S]*?href="\/([^"]+)"/) || [])[1] || "").trim();
    const desc = strip((a.match(/<p class="[^"]*col-9[^"]*">([\s\S]*?)<\/p>/) || [])[1]);
    const lng = strip((a.match(/itemprop="programmingLanguage">([^<]+)</) || [])[1]);
    const stars = strip((a.match(/href="\/[^"]+\/stargazers"[^>]*>([\s\S]*?)<\/a>/) || [])[1]);
    const week = strip((a.match(/([\d,]+) stars (?:this week|today|this month)/) || [])[1]);
    return { name, desc, lang: lng, stars, gained: week, link: `https://github.com/${name}` };
  }).filter((r) => r.name && (!grep.length || grep.some((g) => (r.name + " " + r.desc).toLowerCase().includes(g))));
  console.log(JSON.stringify({ since, source: `https://github.com/trending/${lang}?since=${since}`, repos: rows }, null, 1));
}

async function search() {
  const topic = opt("topic", "animation"), days = +opt("days", 30), n = +opt("n", 10);
  const d = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const q = encodeURIComponent(`topic:${topic} created:>${d}`);
  const j = await get(`https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=${n}`, "json");
  console.log(JSON.stringify({ topic, since: d, repos: j.items.map((r) => ({ name: r.full_name, stars: r.stargazers_count, desc: r.description, lang: r.language, created: r.created_at.slice(0, 10), link: r.html_url })) }, null, 1));
}

async function repo() {
  const [, name, dir] = pos; if (!name || !dir) throw new Error("usage: repo <owner/name> <dir>");
  const j = await get(`https://api.github.com/repos/${name}`, "json");
  const branch = j.default_branch || "HEAD", raw = `https://raw.githubusercontent.com/${name}/${branch}/`;
  let hero = "";
  try {
    const md = await get(`https://api.github.com/repos/${name}/readme`, "json");
    const text = Buffer.from(md.content, "base64").toString("utf8");
    const cands = [...text.matchAll(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)|<img[^>]*src=["']([^"']+)["']|<source[^>]*srcset=["']([^"' ]+)/g)].map((m) => m[1] || m[2] || m[3])
      .filter((u) => !/shields\.io|badge|badgen|img\.shields|\/workflows\/|star-history|contrib\.rocks|codecov|discord|twitter|sponsor|logo/i.test(u));
    for (const u of cands.slice(0, 4)) {
      const abs = /^https?:/.test(u) ? u.replace("github.com/" + name + "/blob/", "raw.githubusercontent.com/" + name + "/") : new URL(u.replace(/^\.?\//, ""), raw).href;
      try { hero = await save(abs, dir, `repo-${name.replace("/", "_")}-hero`); break; } catch (e) {}
    }
  } catch (e) { console.error("readme:", e.message); }
  let card = ""; try { card = await save(`https://opengraph.githubassets.com/1/${name}`, dir, `repo-${name.replace("/", "_")}-card`); } catch (e) {}
  const out = { name: j.full_name, desc: j.description, stars: j.stargazers_count, starsFmt: kfmt(j.stargazers_count), forks: j.forks_count,
    lang: j.language, license: j.license && j.license.spdx_id, homepage: j.homepage, topics: j.topics, created: (j.created_at || "").slice(0, 10),
    link: j.html_url, hero, card };
  fs.writeFileSync(path.join(dir, `repo-${name.replace("/", "_")}.json`), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
}

async function shot() {
  const [, url, dir, name] = pos; if (!url || !dir || !name) throw new Error("usage: shot <url> <dir> <name> [--sel css]");
  console.log(JSON.stringify(await screenshot(url, dir, name, opt("sel"), +opt("max", 1), +opt("w", 1280), +opt("h", 800))));
}

const cmds = { papers, paper, trending, search, repo, shot };
if (!cmds[pos[0]]) { console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(2, 9).join("\n")); process.exit(2); }
cmds[pos[0]]().catch((e) => { console.error(e.message); process.exit(1); });
