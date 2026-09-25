#!/usr/bin/env node
/*
 * record_site.js — deterministic, frame-by-frame website recorder.
 *
 * Drives a JSON "shot list" (timeline of actions) in headless Chrome
 * (puppeteer from carousel-engine/node_modules), renders a synthetic cursor,
 * click ripples, hover highlights and a styled stand-in for native <select>
 * popups, captures every frame with page.screenshot at a fixed fps and pipes
 * the PNGs to ffmpeg (h264 / yuv420p / faststart). Real time is decoupled
 * from video time: async page work (network, debounce) happens between frames
 * or inside `waitFor` steps that emit no frames, so clips never show spinners.
 *
 * Usage:
 *   node orchestrator/tools/record_site.js <shot.json | dir> [more...]
 *        [--only id1,id2] [--out DIR] [--contact] [--contact-only] [--dry]
 *
 * Shot list format (one clip per file, or {"clips":[...]}):
 * {
 *   "id": "jobs-search-backend",
 *   "url": "https://www.vloombox.in/",
 *   "viewport": "16x9" | "4x3" | "mobile" | {width,height,dsf,out:[w,h]},
 *   "fps": 30,
 *   "ready": "js expr, truthy when the page is ready to film",
 *   "hideSelectors": ["css", ...],           // extra elements to hide
 *   "setup": [actions run before frame 0, no frames emitted],
 *   "cursor": {"start":[x,y], "visible":true},
 *   "actions": [ ...timeline... ],
 *   "page": "/", "tags": [], "description": "", "promoLine": ""
 * }
 *
 * Actions ({"do": ...}); any action may carry "what" (segment label; {var}
 * placeholders are filled from `capture` values):
 *   hold      {dur}                                   still frames
 *   move      {to: target|[x,y], dur}                 eased cursor path (slight arc)
 *   click     {target?, dur?, ripple?:true}           move (if target) + press + ripple + real click
 *   type      {text, cps?:9, target?}                 click target first if given; human-pace keystrokes
 *   key       {key}                                   single key press (e.g. "Escape")
 *   scroll    {by|to|toTarget, dur, el?, offset?}     eased scroll of window or element
 *   select    {target, value, dur?}                   styled dropdown overlay, pick option, real select
 *   highlight {target, dur, pad?}                     glowing ring around target
 *   waitFor   {js?, idle?:true, timeout?, settle?}    wait (no frames) for condition / network idle
 *   capture   {vars:{name:"js expr"}}                 read values for segment labels
 *   beat      {what, actions:[...]}                   group → one segment spanning children
 *   goto      {url}                                   in-site navigation (never off vloombox.in)
 *
 * Targets: {"sel":"css", "text":"exact", "textIncludes":"x", "placeholder":"x",
 *           "hasOption":"x", "nth":0, "anchor":[fx,fy] (0..1 in bbox, default .5,.5),
 *           "offset":[dx,dy]}
 *
 * Safety: stays on the allowed host (main-frame navigations elsewhere are
 * aborted), blocks popups and form submission, and refuses to click links
 * that leave the site or controls labelled apply / sign in / unlock / buy /
 * subscribe / submit / create account / logout.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const puppeteer = require(require.resolve('puppeteer', { paths: [path.join(REPO, 'carousel-engine')] }));

const DEFAULT_OUT = path.join(REPO, 'video-engine', 'assets', 'media', 'vloombox');
const ALLOWED_HOSTS = [/(^|\.)vloombox\.in$/i];
const FORBIDDEN_LABEL = /\b(apply|sign ?in|sign ?up|log ?in|log ?out|unlock|upgrade|buy|subscribe|checkout|submit|create account|continue with|pay)\b/i;

const VIEWPORTS = {
  // "16x9" is the literal 1280x720@1.5 desktop; "16x9-close" renders the same
  // 1920x1080 capture from a 1024x576 CSS viewport so UI text is ~25% larger
  // once the clip is shrunk into a 750-957 px reel window (the library default).
  '16x9': { width: 1280, height: 720, dsf: 1.5, out: [1280, 720] },
  '16x9-close': { width: 1024, height: 576, dsf: 1.875, out: [1280, 720] },
  '4x3-close': { width: 880, height: 660, dsf: 2, out: [960, 720] },
  '4x3': { width: 1024, height: 768, dsf: 1.5, out: [1024, 768] },
  mobile: { width: 390, height: 844, dsf: 2, out: [540, 1168], mobile: true },
};

// ---------------------------------------------------------------- helpers
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;

function rng(seedStr) {
  let h = 2166136261;
  for (const c of seedStr) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

function hostAllowed(u) {
  try {
    const h = new URL(u).hostname;
    return ALLOWED_HOSTS.some((re) => re.test(h));
  } catch { return false; }
}

function args() {
  const a = process.argv.slice(2);
  const o = { files: [], only: null, out: DEFAULT_OUT, contact: false, contactOnly: false, dry: false };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--only') o.only = a[++i].split(',');
    else if (a[i] === '--out') o.out = path.resolve(a[++i]);
    else if (a[i] === '--contact') o.contact = true;
    else if (a[i] === '--contact-only') o.contactOnly = true;
    else if (a[i] === '--dry') o.dry = true;
    else o.files.push(a[i]);
  }
  return o;
}

function loadShots(files) {
  const shots = [];
  for (const f of files) {
    const st = fs.statSync(f);
    const list = st.isDirectory()
      ? fs.readdirSync(f).filter((n) => n.endsWith('.json')).sort().map((n) => path.join(f, n))
      : [f];
    for (const p of list) {
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      for (const c of j.clips || [j]) shots.push({ ...(j.defaults || {}), ...c, _file: p });
    }
  }
  return shots;
}

// ---------------------------------------------------------------- page-side code
const OVERLAY_CSS = `
html{scroll-behavior:auto!important}
::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}
*{scrollbar-width:none!important}
input,textarea{caret-color:transparent!important}
[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i],
[class*="toast" i],[id*="intercom" i],[class*="crisp" i]{display:none!important}
#__rec{position:fixed;inset:0;pointer-events:none;z-index:2147483647;overflow:hidden}
#__rec .cur{position:absolute;left:0;top:0;width:26px;height:26px;transform-origin:3px 2px;
  filter:drop-shadow(0 2px 3px rgba(0,0,0,.45)) drop-shadow(0 0 1px rgba(0,0,0,.6));will-change:transform}
#__rec .rip{position:absolute;left:0;top:0;border-radius:50%;border:2px solid rgba(34,211,238,.95);
  background:rgba(34,211,238,.18);box-sizing:border-box}
#__rec .hl{position:absolute;border-radius:10px;box-sizing:border-box;border:2px solid rgba(34,211,238,.9);
  box-shadow:0 0 0 4px rgba(34,211,238,.16),0 0 22px rgba(34,211,238,.35)}
#__rec .dd{position:absolute;background:#141418;border:1px solid #2c2d33;border-radius:8px;padding:4px;
  box-shadow:0 14px 34px rgba(0,0,0,.55);box-sizing:border-box}
#__rec .dd div{height:30px;line-height:30px;padding:0 12px;border-radius:5px;color:#c9cdd3;white-space:nowrap;overflow:hidden}
#__rec .dd div.on{background:rgba(34,211,238,.16);color:#5fe4e6}
#__rec .dd div.sel{color:#fff;font-weight:700}
#__rec .caret{position:absolute;width:2px;background:#5fe4e6;border-radius:1px}
`;

const CURSOR_SVG = `<svg viewBox="0 0 26 26" width="26" height="26" xmlns="http://www.w3.org/2000/svg">
<path d="M3 2 L3 21.5 L8.2 16.9 L11.6 24.2 L15 22.7 L11.7 15.6 L18.6 15.6 Z" fill="#ffffff" stroke="#0b0c0f" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

async function installOverlay(page) {
  await page.evaluate((css, svg) => {
    if (!document.getElementById('__rec_css')) {
      const s = document.createElement('style');
      s.id = '__rec_css'; s.textContent = css; document.head.appendChild(s);
    }
    if (!document.getElementById('__rec')) {
      const r = document.createElement('div'); r.id = '__rec';
      r.innerHTML = `<div class="hls"></div><div class="dds"></div><div class="rips"></div><div class="carets"></div><div class="cur">${svg}</div>`;
      document.documentElement.appendChild(r);
    }
    window.__recFind = (spec) => {
      const all = [...document.querySelectorAll(spec.sel || '*')].filter((e) => !e.closest('#__rec'));
      const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
      let c = all.filter(vis);
      const txt = (e) => (e.innerText || e.value || '').trim().replace(/\s+/g, ' ');
      if (spec.text != null) c = c.filter((e) => txt(e) === spec.text);
      if (spec.textIncludes != null) c = c.filter((e) => txt(e).includes(spec.textIncludes));
      if (spec.textMatch != null) { const re = new RegExp(spec.textMatch); c = c.filter((e) => re.test(txt(e))); }
      if (spec.placeholder != null) c = c.filter((e) => (e.getAttribute('placeholder') || '').startsWith(spec.placeholder));
      if (spec.hasOption != null) c = c.filter((e) => e.tagName === 'SELECT' && [...e.options].some((o) => o.text.includes(spec.hasOption)));
      if (spec.scrollable) c = c.filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 5);
      if (spec.text != null || spec.textIncludes != null || spec.textMatch != null) {
        // prefer the innermost matching element
        c = c.filter((e) => !c.some((o) => o !== e && e.contains(o)));
      }
      if (spec.near) {
        const d = (e) => { const r = e.getBoundingClientRect(); return Math.hypot(r.left + r.width / 2 - spec.near[0], r.top + r.height / 2 - spec.near[1]); };
        c.sort((a, b) => d(a) - d(b));
      }
      let el = c[spec.nth || 0];
      if (!el) return null;
      for (let i = 0; i < (spec.up || 0); i++) el = el.parentElement;
      const id = 't' + Math.random().toString(36).slice(2, 8);
      el.setAttribute('data-rec', id);
      const r = el.getBoundingClientRect();
      const a = el.closest('a');
      let tr = null;
      if (spec.text != null || spec.textIncludes != null || spec.textMatch != null) {
        const rg = document.createRange(); rg.selectNodeContents(el); const q = rg.getBoundingClientRect();
        if (q.width > 0 && q.width < r.width - 4) tr = { x: q.left, y: Math.min(q.top, r.top + (r.height - q.height) / 2), w: q.width, h: q.height };
      }
      return { id, x: r.left, y: r.top, w: r.width, h: r.height, tag: el.tagName, tr,
        label: (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 80),
        href: a ? a.href : null, type: el.getAttribute('type') || '',
        options: el.tagName === 'SELECT' ? [...el.options].map((o) => ({ v: o.value, t: o.text })) : null,
        selIndex: el.tagName === 'SELECT' ? el.selectedIndex : null,
        font: getComputedStyle(el).fontFamily, fontSize: getComputedStyle(el).fontSize };
    };
    window.__recRender = (s) => {
      const root = document.getElementById('__rec'); if (!root) return;
      const cur = root.querySelector('.cur');
      cur.style.display = s.cursor.visible ? 'block' : 'none';
      cur.style.transform = `translate(${s.cursor.x - 3}px,${s.cursor.y - 2}px) scale(${s.cursor.scale})`;
      const rips = root.querySelector('.rips'); rips.innerHTML = '';
      for (const r of s.ripples) {
        const d = document.createElement('div'); d.className = 'rip';
        d.style.width = d.style.height = (2 * r.r) + 'px';
        d.style.transform = `translate(${r.x - r.r}px,${r.y - r.r}px)`; d.style.opacity = r.o;
        rips.appendChild(d);
      }
      const hls = root.querySelector('.hls'); hls.innerHTML = '';
      for (const h of s.highlights) {
        const d = document.createElement('div'); d.className = 'hl';
        Object.assign(d.style, { left: h.x + 'px', top: h.y + 'px', width: h.w + 'px', height: h.h + 'px', opacity: h.o });
        hls.appendChild(d);
      }
      const dds = root.querySelector('.dds'); dds.innerHTML = '';
      if (s.dropdown) {
        const dd = s.dropdown; const d = document.createElement('div'); d.className = 'dd';
        Object.assign(d.style, { left: dd.x + 'px', top: dd.y + 'px', width: dd.w + 'px', opacity: dd.o,
          transform: `translateY(${(1 - dd.o) * -6}px)`, fontFamily: dd.font, fontSize: dd.fontSize });
        dd.options.forEach((o, i) => { const it = document.createElement('div'); it.textContent = o.t;
          if (i === dd.hover) it.classList.add('on'); if (i === dd.selIndex) it.classList.add('sel'); d.appendChild(it); });
        dds.appendChild(d);
      }
      const carets = root.querySelector('.carets'); carets.innerHTML = '';
      if (s.caret) {
        const el = document.activeElement;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
          const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
          const cv = window.__recCv || (window.__recCv = document.createElement('canvas'));
          const cx = cv.getContext('2d'); cx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
          const tw = cx.measureText(el.value.slice(0, el.selectionEnd == null ? el.value.length : el.selectionEnd)).width;
          const fs = parseFloat(cs.fontSize); const pl = parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth);
          const c = document.createElement('div'); c.className = 'caret';
          Object.assign(c.style, { left: (r.left + pl + tw + 1 - el.scrollLeft) + 'px', top: (r.top + r.height / 2 - fs * 0.62) + 'px',
            height: (fs * 1.24) + 'px', opacity: s.caret.o });
          carets.appendChild(c);
        }
      }
    };
    window.__recLoading = () => {
      // visible "Loading" text or spinning element inside the viewport
      const W = innerWidth, H = innerHeight;
      const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n; while ((n = tw.nextNode())) {
        if (/\bloading\b/i.test(n.textContent) && n.parentElement && !n.parentElement.closest('#__rec')) {
          const r = n.parentElement.getBoundingClientRect();
          if (r.width && r.bottom > 0 && r.top < H && r.right > 0 && r.left < W && getComputedStyle(n.parentElement).visibility !== 'hidden') return 'text:' + n.textContent.trim().slice(0, 40);
        }
      }
      for (const a of document.getAnimations ? document.getAnimations() : []) {
        const t = a.effect && a.effect.target; if (!t || t.closest('#__rec')) continue;
        const nm = (a.animationName || '').toLowerCase();
        if (/spin|rotate|loader|loading|skeleton|shimmer/.test(nm)) {
          const r = t.getBoundingClientRect();
          if (r.width && r.bottom > 0 && r.top < H) return 'anim:' + nm;
        }
      }
      return '';
    };
  }, OVERLAY_CSS, CURSOR_SVG);
}

// ---------------------------------------------------------------- recorder
class Recorder {
  constructor(page, shot, vp, outFile) {
    this.page = page; this.shot = shot; this.vp = vp; this.outFile = outFile;
    this.fps = shot.fps || 30; this.frame = 0;
    const cs = (shot.cursor && shot.cursor.start) || [vp.width * 0.62, vp.height * 0.58];
    this.cursor = { x: cs[0], y: cs[1], scale: 1, visible: !vp.mobile && !(shot.cursor && shot.cursor.visible === false) };
    this.ripples = []; this.highlights = []; this.dropdown = null; this.caret = null;
    this.segments = []; this.vars = {}; this.qc = { loadingFrames: [], dupRuns: [], holds: [] };
    this.lastHash = null; this.dupRun = 0; this.inMotion = false; this.rand = rng(shot.id);
    this.firstFramePng = null;
  }

  f(sec) { return Math.max(1, Math.round(sec * this.fps)); }
  t() { return +(this.frame / this.fps).toFixed(3); }

  startEncoder() {
    const [ow, oh] = this.vp.out;
    this.ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(this.fps), '-c:v', 'png', '-i', '-',
      '-vf', `scale=${ow}:${oh}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(this.shot.crf || 18),
      '-tune', 'animation', '-r', String(this.fps), '-movflags', '+faststart', '-an', this.outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
    this.ffDone = new Promise((res, rej) => this.ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))));
    this.ffDone.catch(() => {});
  }

  async finish() {
    this.ff.stdin.end();
    await this.ffDone;
    this.closeDupRun();
  }

  closeDupRun() {
    // a stall = ≥3 identical consecutive frames while the cursor/page was supposed to be moving
    if ((this.dupMotionFrames || 0) >= 5) this.qc.dupRuns.push({ at: +((this.frame - this.dupRun) / this.fps).toFixed(3), frames: this.dupRun, motionFrames: this.dupMotionFrames });
    this.dupRun = 0; this.dupMotionFrames = 0;
  }

  // Render overlay state at the current frame and capture one frame.
  async emit() {
    const now = this.frame;
    const ripples = [];
    this.ripples = this.ripples.filter((r) => now - r.f0 < r.n);
    for (const r of this.ripples) {
      const p = (now - r.f0) / r.n;
      ripples.push({ x: r.x, y: r.y, r: 6 + 22 * easeOutCubic(p), o: 0.9 * (1 - p) });
    }
    const highlights = [];
    this.highlights = this.highlights.filter((h) => now < h.f1);
    for (const h of this.highlights) {
      const fin = this.f(0.2);
      const o = Math.min(1, (now - h.f0) / fin, (h.f1 - now) / fin);
      highlights.push({ x: h.x, y: h.y, w: h.w, h: h.h, o: clamp(o, 0, 1) });
    }
    let caret = null;
    if (this.caret) caret = { o: Math.floor((now - this.caret.f0) / (this.fps * 0.53)) % 2 === 0 || this.caret.solidUntil > now ? 1 : 0 };
    await this.page.evaluate((s) => window.__recRender && window.__recRender(s),
      { cursor: this.cursor, ripples, highlights, dropdown: this.dropdown, caret });
    if (this.cursor.visible && !this.vp.mobile) {
      await this.page.mouse.move(this.cursor.x, this.cursor.y); // real hover states follow the cursor
    }
    const buf = await this.page.screenshot({ type: 'png', optimizeForSpeed: true });
    if (now === 0) this.firstFramePng = buf;
    const hash = crypto.createHash('md5').update(buf).digest('hex');
    if (hash === this.lastHash) { this.dupRun++; if (this.inMotion) this.dupMotionFrames = (this.dupMotionFrames || 0) + 1; } else this.closeDupRun();
    this.lastHash = hash;
    if (now % 3 === 0) {
      const ld = await this.page.evaluate(() => (window.__recLoading ? window.__recLoading() : ''));
      if (ld) this.qc.loadingFrames.push({ t: this.t(), what: ld });
    }
    if (!this.ff.stdin.write(buf)) await new Promise((r) => this.ff.stdin.once('drain', r));
    this.frame++;
  }

  async target(spec, allowOff = false) {
    if (Array.isArray(spec)) return { x: spec[0], y: spec[1], w: 0, h: 0, cx: spec[0], cy: spec[1] };
    let t = null;
    for (let i = 0; i < 40 && !t; i++) { t = await this.page.evaluate((s) => window.__recFind(s), spec); if (!t) await sleep(250); }
    if (!t) throw new Error('target not found: ' + JSON.stringify(spec));
    const an = spec.anchor || [0.5, 0.5]; const off = spec.offset || [0, 0];
    t.cx = t.x + t.w * an[0] + off[0]; t.cy = t.y + t.h * an[1] + off[1];
    if (!allowOff && (t.cy < 0 || t.cy > this.vp.height || t.cx < 0 || t.cx > this.vp.width)) throw new Error(`target offscreen (${Math.round(t.cx)},${Math.round(t.cy)}): ${JSON.stringify(spec)}`);
    return t;
  }

  guardClick(t) {
    if (t.href && !hostAllowed(t.href)) throw new Error('refusing click: leaves site → ' + t.href);
    if (t.type === 'submit') throw new Error('refusing click: submit control');
    if (FORBIDDEN_LABEL.test(t.label || '')) throw new Error('refusing click: forbidden label "' + t.label + '"');
  }

  async moveTo(x, y, dur) {
    const n = this.f(dur); const x0 = this.cursor.x; const y0 = this.cursor.y;
    const dx = x - x0; const dy = y - y0; const dist = Math.hypot(dx, dy);
    if (dist < 1) return this.hold(dur);
    // perpendicular arc, direction chosen deterministically
    const bend = (this.rand() < 0.5 ? -1 : 1) * Math.min(40, dist * 0.08);
    const nx = -dy / dist; const ny = dx / dist;
    this.inMotion = true;
    for (let i = 1; i <= n; i++) {
      const p = easeInOutCubic(i / n); const arc = Math.sin(Math.PI * p) * bend;
      this.cursor.x = x0 + dx * p + nx * arc; this.cursor.y = y0 + dy * p + ny * arc;
      await this.emit();
    }
    this.inMotion = false;
  }

  async hold(dur) {
    const n = this.f(dur); const s = this.t();
    for (let i = 0; i < n; i++) await this.emit();
    this.qc.holds.push([s, this.t()]);
  }

  async press(x, y, doClick, t) {
    // cursor press-in/release (4 frames) + ripple, then the real click. The click
    // lands after the press frames so any navigation / loading state it triggers
    // is absorbed by the following waitFor instead of being filmed.
    this.ripples.push({ x, y, f0: this.frame, n: this.f(0.5) });
    for (const sc of [0.9, 0.84, 0.9, 1]) { this.cursor.scale = sc; await this.emit(); }
    if (doClick) {
      if (t) this.guardClick(t);
      const hit = await this.page.evaluate((px, py) => {
        const e = document.elementFromPoint(px, py); if (!e) return null;
        const a = e.closest('a'); const b = e.closest('button,[role=button],input[type=submit]');
        return { href: a ? a.href : null, label: (b || a) ? ((b || a).innerText || (b || a).getAttribute('aria-label') || '').trim().slice(0, 80) : '', type: b ? b.getAttribute('type') || '' : '' };
      }, x, y);
      if (hit) this.guardClick(hit);
      await this.page.mouse.click(x, y);
    }
  }

  async scroll(a) {
    const n = this.f(a.dur || 1.2);
    let el = a.el || null;
    if (el && typeof el === 'object') { const t = await this.target(el); el = `[data-rec="${t.id}"]`; }
    const info = await this.page.evaluate((sel) => {
      const e = sel ? document.querySelector(sel) : document.scrollingElement;
      return { y: e.scrollTop, max: e.scrollHeight - e.clientHeight };
    }, el);
    let to;
    if (a.toTarget) {
      const t = await this.target(a.toTarget, true);
      to = info.y + t.y - (a.offset != null ? a.offset : 90);
    } else if (a.to != null) to = a.to === 'bottom' ? info.max : a.to;
    else to = info.y + (a.by || 400);
    to = clamp(Math.round(to), 0, info.max);
    const from = info.y; const ease = a.ease === 'cubic' ? easeInOutCubic : easeInOutSine;
    this.inMotion = true;
    for (let i = 1; i <= n; i++) {
      const y = from + (to - from) * ease(i / n);
      await this.page.evaluate((sel, yy) => { const e = sel ? document.querySelector(sel) : document.scrollingElement; e.scrollTop = yy; }, el, y);
      await this.emit();
    }
    this.inMotion = false;
  }

  async type(a) {
    if (a.target) await this.click({ target: a.target, dur: a.moveDur || 0.7 });
    const cps = a.cps || 9; const text = a.text;
    // per-char schedule with seeded jitter; spaces/after-word pauses slightly longer
    let tt = 0; const times = [];
    for (let i = 0; i < text.length; i++) {
      times.push(tt);
      let d = (1 / cps) * (0.75 + this.rand() * 0.5);
      if (text[i] === ' ') d *= 1.4;
      tt += d;
    }
    const total = this.f(tt + 0.15); const f0 = this.frame; let k = 0;
    this.caret = { f0, solidUntil: f0 };
    for (let i = 0; i < total; i++) {
      const now = (this.frame - f0) / this.fps;
      while (k < text.length && times[k] <= now) { await this.page.keyboard.type(text[k]); k++; this.caret.solidUntil = this.frame + this.f(0.5); }
      await this.emit();
    }
    while (k < text.length) await this.page.keyboard.type(text[k++]);
  }

  async click(a) {
    let t = null;
    if (a.target) {
      t = await this.target(a.target);
      await this.moveTo(t.cx, t.cy, a.dur || 0.7);
      await this.hold(a.pre || 0.12);
    }
    await this.press(this.cursor.x, this.cursor.y, a.real !== false, t);
    if (a.caret) this.caret = { f0: this.frame, solidUntil: this.frame };
  }

  async select(a) {
    const t = await this.target(a.target);
    if (t.tag !== 'SELECT') throw new Error('select target is not a <select>');
    await this.moveTo(t.cx, t.cy, a.moveDur || 0.7);
    await this.hold(0.12);
    await this.press(this.cursor.x, this.cursor.y, false);
    const idx = t.options.findIndex((o) => o.v === a.value || o.t === a.value);
    if (idx < 0) throw new Error('option not found: ' + a.value);
    const itemH = 30; const pad = 4;
    const dd = { x: t.x, y: t.y + t.h + 4, w: Math.max(t.w, 190), o: 0, hover: t.selIndex, selIndex: t.selIndex,
      options: t.options, font: t.font, fontSize: t.fontSize };
    if (dd.y + t.options.length * itemH + 2 * pad > this.vp.height - 8) dd.y = t.y - 4 - t.options.length * itemH - 2 * pad;
    this.dropdown = dd;
    const nf = this.f(0.14);
    for (let i = 1; i <= nf; i++) { dd.o = easeOutCubic(i / nf); await this.emit(); }
    await this.hold(0.3);
    // glide down the list, hovering each option on the way
    const oy = (i) => dd.y + pad + i * itemH + itemH / 2;
    const tx = dd.x + Math.min(dd.w * 0.4, 90);
    const n = this.f(a.dur || 0.8); const x0 = this.cursor.x; const y0 = this.cursor.y;
    this.inMotion = true;
    for (let i = 1; i <= n; i++) {
      const p = easeInOutCubic(i / n);
      this.cursor.x = x0 + (tx - x0) * p; this.cursor.y = y0 + (oy(idx) - y0) * p;
      const hv = Math.floor((this.cursor.y - dd.y - pad) / itemH);
      dd.hover = hv >= 0 && hv < t.options.length ? hv : dd.hover;
      await this.emit();
    }
    this.inMotion = false;
    dd.hover = idx;
    await this.hold(0.25);
    this.ripples.push({ x: this.cursor.x, y: this.cursor.y, f0: this.frame, n: this.f(0.5) });
    for (const sc of [0.9, 0.84]) { this.cursor.scale = sc; await this.emit(); }
    this.dropdown = null;
    await this.page.select(`[data-rec="${t.id}"]`, t.options[idx].v);
    for (const sc of [0.9, 1]) { this.cursor.scale = sc; await this.emit(); }
  }

  async waitFor(a) {
    const timeout = a.timeout || 15000;
    if (!hostAllowed(this.page.url())) throw new Error('page left the site: ' + this.page.url());
    if (a.idle !== false) await this.page.waitForNetworkIdle({ idleTime: 400, timeout }).catch(() => {});
    if (a.js) await this.page.waitForFunction(a.js, { timeout, polling: 100 });
    await this.page.evaluate(() => document.fonts && document.fonts.ready);
    await installOverlay(this.page);
    await sleep((a.settle != null ? a.settle : 0.25) * 1000);
  }

  async run(actions) {
    for (const a of actions) {
      const s = this.t();
      if (process.env.REC_DEBUG) console.log(`    [${s.toFixed(2)}] ${a.do} ${JSON.stringify(a.target || a.to || a.text || a.js || '')}`);
      switch (a.do) {
        case 'hold': await this.hold(a.dur || 0.4); break;
        case 'move': { const t = await this.target(a.to); await this.moveTo(t.cx, t.cy, a.dur || 0.7); break; }
        case 'click': await this.click(a); break;
        case 'type': await this.type(a); break;
        case 'key': await this.page.keyboard.press(a.key); await this.emit(); break;
        case 'scroll': await this.scroll(a); break;
        case 'select': await this.select(a); break;
        case 'highlight': {
          const t = await this.target(a.target); const pad = a.pad != null ? a.pad : 6;
          const R = a.tight !== false && t.tr ? t.tr : t;
          this.highlights.push({ x: R.x - pad, y: R.y - pad, w: R.w + 2 * pad, h: R.h + 2 * pad, f0: this.frame, f1: this.frame + this.f(a.dur || 1.2) });
          const at = a.at || [0.5, 0.62];
          if (a.move !== false) await this.moveTo(R.x + R.w * at[0], R.y + R.h * at[1], a.moveDur || 0.6);
          if (a.hold) await this.hold(a.hold);
          break;
        }
        case 'caret': this.caret = a.off ? null : { f0: this.frame, solidUntil: this.frame }; break;
        case 'hideCursor': this.cursor.visible = false; break;
        case 'showCursor': this.cursor.visible = !this.vp.mobile; break;
        case 'waitFor': await this.waitFor(a); break;
        case 'capture':
          for (const [k, js] of Object.entries(a.vars)) this.vars[k] = await this.page.evaluate(js);
          break;
        case 'beat': await this.run(a.actions); break;
        case 'goto':
          if (!hostAllowed(a.url)) throw new Error('refusing goto off-site: ' + a.url);
          await this.page.goto(a.url, { waitUntil: 'networkidle2', timeout: 60000 });
          await installOverlay(this.page); break;
        default: throw new Error('unknown action ' + a.do);
      }
      if (a.what) this.segments.push({ start: s, end: this.t(), what: a.what });
    }
  }

  resolvedSegments() {
    return this.segments.map((sg) => ({ ...sg, what: sg.what.replace(/\{(\w+)\}/g, (m, k) => (this.vars[k] != null ? String(this.vars[k]) : m)) }));
  }
}

// ---------------------------------------------------------------- setup / safety
async function preparePage(browser, vp) {
  const page = await browser.newPage();
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: vp.dsf, isMobile: !!vp.mobile, hasTouch: !!vp.mobile });
  if (vp.mobile) await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }, { name: 'prefers-color-scheme', value: 'dark' }]);
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.isNavigationRequest() && req.frame() === page.mainFrame() && !hostAllowed(req.url()) && !req.url().startsWith('about:')) {
      console.warn('  [guard] blocked navigation to', req.url());
      return req.abort('blockedbyclient');
    }
    req.continue();
  });
  await page.evaluateOnNewDocument(() => {
    document.addEventListener('submit', (e) => { e.preventDefault(); e.stopImmediatePropagation(); }, true);
    window.open = () => null;
  });
  return page;
}

async function openAndSettle(page, shot) {
  if (!hostAllowed(shot.url)) throw new Error('url not on allowed host: ' + shot.url);
  await page.goto(shot.url, { waitUntil: 'networkidle2', timeout: 60000 });
  if (!hostAllowed(page.url())) throw new Error('landed off-site: ' + page.url());
  if (shot.expectPath && new URL(page.url()).pathname !== shot.expectPath) throw new Error('redirected to ' + page.url());
  await installOverlay(page);
  if (shot.hideSelectors && shot.hideSelectors.length) {
    await page.addStyleTag({ content: shot.hideSelectors.join(',') + '{display:none!important}' });
  }
  if (shot.ready) await page.waitForFunction(shot.ready, { timeout: 30000, polling: 100 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});
  // make sure images in the viewport finished decoding
  await page.evaluate(async () => {
    await Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 4000); })));
  });
  await sleep(400);
}

// ---------------------------------------------------------------- verification
function probe(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries', 'stream=width,height,nb_read_frames,r_frame_rate', '-of', 'json', file], { encoding: 'utf8' });
  const s = JSON.parse(r.stdout).streams[0];
  return { width: s.width, height: s.height, frames: +s.nb_read_frames };
}

function blackCheck(file) {
  // dark-UI safe thresholds: a frame is "black" only if ≥99% of pixels are ≤ ~2% luma
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-vf', 'blackdetect=d=0.03:pic_th=0.99:pix_th=0.02', '-an', '-f', 'null', '-'], { encoding: 'utf8' });
  const hits = [...(r.stderr || '').matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => [+m[1], +m[2]]);
  const y = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-vf', 'select=eq(n\\,0),signalstats,metadata=print:key=lavfi.signalstats.YAVG', '-frames:v', '1', '-an', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /YAVG=([\d.]+)/.exec(y.stderr || '');
  return { blackRanges: hits, firstFrameYavg: m ? +(+m[1]).toFixed(1) : null };
}

function diffRuns(file, fps) {
  // per-frame mean abs difference; report runs of ≥3 identical frames
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-vf', 'scale=320:-2,tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG', '-an', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const vals = [...(r.stderr || '').matchAll(/YAVG=([\d.]+)/g)].map((m) => +m[1]);
  return vals;
}

// ---------------------------------------------------------------- contact sheet
async function contactSheet(browser, outDir, manifest) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rec-contact-'));
  const rows = [];
  for (const c of manifest) {
    const file = path.join(outDir, c.file); const cells = [];
    for (const [k, fr] of [0.04, 0.3, 0.55, 0.8, 0.97].entries()) {
      const t = (c.duration * fr).toFixed(3); const png = path.join(tmp, `${c.id}_${k}.png`);
      spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', t, '-i', file, '-frames:v', '1', '-vf', 'scale=384:-2', png]);
      cells.push({ png: 'file:///' + png.replace(/\\/g, '/'), t });
    }
    rows.push({ c, cells });
  }
  const html = `<html><body style="margin:0;background:#0d0f12;font:13px/1.3 Segoe UI,Arial;color:#cfd3da;padding:14px">
  <div style="font-size:18px;font-weight:700;margin:0 0 10px">vloombox footage library — ${manifest.length} clips</div>
  ${rows.map(({ c, cells }) => `<div style="margin:0 0 12px"><div style="margin:0 0 4px"><b style="color:#5fe4e6">${c.id}</b> · ${c.page} · ${c.duration}s · ${c.width}x${c.height} — ${c.description}</div>
  <div style="display:flex;gap:6px">${cells.map((x) => `<div style="position:relative"><img src="${x.png}" style="width:384px;display:block;border:1px solid #2a2d33;border-radius:4px"><span style="position:absolute;left:4px;bottom:4px;background:#000a;padding:1px 4px;border-radius:3px;font-size:11px">${x.t}s</span></div>`).join('')}</div></div>`).join('')}
  </body></html>`;
  const hp = path.join(tmp, 'sheet.html'); fs.writeFileSync(hp, html);
  const page = await browser.newPage();
  await page.setViewport({ width: 1990, height: 800 });
  await page.goto('file:///' + hp.replace(/\\/g, '/'), { waitUntil: 'load' });
  const out = path.join(outDir, 'contact.png');
  await page.screenshot({ path: out, fullPage: true });
  await page.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  return out;
}

// ---------------------------------------------------------------- main
async function main() {
  const o = args();
  fs.mkdirSync(o.out, { recursive: true });
  const manifestPath = path.join(o.out, 'manifest.json');
  let manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : [];
  const browser = await puppeteer.launch({ headless: true, args: ['--hide-scrollbars', '--font-render-hinting=none', '--disable-lcd-text'] });
  try {
    if (!o.contactOnly) {
      let shots = loadShots(o.files.length ? o.files : [path.join(REPO, 'orchestrator', 'recordings', 'vloombox')]);
      if (o.only) shots = shots.filter((s) => o.only.includes(s.id));
      for (const shot of shots) {
        const vp = typeof shot.viewport === 'object' ? shot.viewport : VIEWPORTS[shot.viewport || '16x9'];
        const file = `${shot.id}.mp4`; const outFile = path.join(o.out, file);
        const t0 = Date.now();
        console.log(`\n▶ ${shot.id}  (${shot.url})`);
        const page = await preparePage(browser, vp);
        let rec = null;
        page.on('popup', (p) => p.close().catch(() => {}));
        try {
          await openAndSettle(page, shot);
          rec = new Recorder(page, shot, vp, outFile);
          if (shot.setup) {
            // setup runs with frames discarded
            rec.emit = async () => { await page.evaluate((s) => window.__recRender && window.__recRender(s), { cursor: rec.cursor, ripples: [], highlights: [], dropdown: null, caret: null }); };
            await rec.run(shot.setup);
            delete rec.emit; rec.frame = 0; rec.segments = []; rec.qc.holds = []; rec.ripples = []; rec.caret = null;
            await page.waitForNetworkIdle({ idleTime: 400, timeout: 10000 }).catch(() => {});
            await sleep(300);
          }
          if (o.dry) { console.log('  dry ok'); continue; }
          rec.startEncoder();
          await rec.run(shot.actions);
          await rec.finish();
          const poster = `${shot.id}.png`;
          spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', outFile, '-frames:v', '1', path.join(o.out, poster)]);
          const pr = probe(outFile); const bc = blackCheck(outFile);
          const diffs = diffRuns(outFile, rec.fps);
          // identical-frame runs outside intentional holds
          const inHold = (t, n) => rec.qc.holds.some(([a, b]) => t <= b + 0.2 && t + n / rec.fps >= a - 0.2);
          let run = 0; const stalls = [];
          diffs.forEach((d, i) => { if (d < 0.02) run++; else { if (run >= 5 && !inHold((i - run) / rec.fps, run)) stalls.push({ at: +((i - run) / rec.fps).toFixed(2), frames: run }); run = 0; } });
          const maxJump = diffs.length ? Math.max(...diffs.slice(1)) : 0;
          const qc = {
            firstFrameYavg: bc.firstFrameYavg, blackRanges: bc.blackRanges, loadingFrames: rec.qc.loadingFrames.slice(0, 5),
            stalledRunsOutsideHolds: stalls, dupRunsDuringMotion: rec.qc.dupRuns, maxFrameDiff: +maxJump.toFixed(2),
            ok: bc.blackRanges.length === 0 && (bc.firstFrameYavg || 0) > 17 && rec.qc.loadingFrames.length === 0 && rec.qc.dupRuns.length === 0,
          };
          const entry = {
            id: shot.id, file, poster, page: shot.page || new URL(shot.url).pathname, url: shot.url,
            duration: +(pr.frames / rec.fps).toFixed(3), fps: rec.fps, width: pr.width, height: pr.height,
            aspect: vp.out[0] / vp.out[1] > 1.5 ? '16:9' : vp.out[0] > vp.out[1] ? '4:3' : '9:19.5',
            tags: shot.tags || [], description: shot.description || '', segments: rec.resolvedSegments(),
            promoLine: shot.promoLine || '', licence: 'owned (vloombox.in)',
            recordedAt: new Date().toISOString().slice(0, 10), bytes: fs.statSync(outFile).size, qc,
          };
          manifest = manifest.filter((m) => m.id !== shot.id).concat(entry);
          fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
          console.log(`  ✓ ${entry.duration}s ${pr.width}x${pr.height} ${(entry.bytes / 1e6).toFixed(2)}MB in ${((Date.now() - t0) / 1000).toFixed(0)}s  qc=${qc.ok ? 'OK' : 'CHECK ' + JSON.stringify(qc)}`);
          for (const s of entry.segments) console.log(`    ${s.start.toFixed(2)}–${s.end.toFixed(2)}  ${s.what}`);
        } catch (e) {
          console.error(`  ✗ ${shot.id}: ${e.message}`);
          if (rec && rec.ff) { rec.ff.kill(); await rec.ffDone.catch(() => {}); }
          try { fs.unlinkSync(outFile); } catch {}
          process.exitCode = 1;
        } finally {
          await page.close().catch(() => {});
        }
      }
    }
    if (o.contact || o.contactOnly) {
      const order = loadShots([path.join(REPO, 'orchestrator', 'recordings', 'vloombox')]).map((s) => s.id);
      manifest.sort((a, b) => (order.indexOf(a.id) + 1 || 999) - (order.indexOf(b.id) + 1 || 999));
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log('contact sheet →', await contactSheet(browser, o.out, manifest));
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
