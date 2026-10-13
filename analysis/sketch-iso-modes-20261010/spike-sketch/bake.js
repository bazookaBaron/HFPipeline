#!/usr/bin/env node
/* bake.js — scene spec -> per-element transparent PNG layers + paths.json (reveal geometry).
 * usage: node bake.js scene.js [--out dir] [--gl gpu|default|swiftshader|auto] [--density 2] [--force] [--only id,id]
 * Each element: brush.clear(paper) -> seed -> draw -> render -> readback -> colour-key (alpha = projection of
 * (paper - px) onto (paper - inkColour); rgb := exact theme colour) -> crop -> PNG. Cached by hash(element, theme colour, lib, density, BAKE_VER). */
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const { expand } = require("./geom");
const BAKE_VER = 3;
function findPuppeteer() {
  try { return require("puppeteer-core"); } catch (e) {}
  const base = path.join(process.env.LOCALAPPDATA || "", "npm-cache/_npx");
  if (fs.existsSync(base)) for (const d of fs.readdirSync(base)) { const p = path.join(base, d, "node_modules/puppeteer-core"); if (fs.existsSync(p)) return require(p); }
  throw new Error("puppeteer-core not found (npx cache)");
}
const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find(fs.existsSync);
const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf("--" + k); return i >= 0 ? argv[i + 1] : d; };
const sceneFile = path.resolve(argv.find((a) => !a.startsWith("--") && !argv[argv.indexOf(a) - 1]?.startsWith("--")) || "scene.js");
const scene = require(sceneFile), Theme = require(path.resolve(__dirname, scene.themeJs || "comp/theme.js"));
const T = Theme.get(scene.theme || "cobalt");
const OUT = path.resolve(arg("out", path.join(path.dirname(sceneFile), "comp/board"))), DENS = +arg("density", 2), FORCE = argv.includes("--force");
const ONLY = arg("only", "") ? arg("only").split(",") : null;
const LIB = fs.readFileSync(path.join(__dirname, "vendor/brush.js"), "utf8"), LIBH = crypto.createHash("sha1").update(LIB).digest("hex").slice(0, 10);
const GLARGS = {
  gpu: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"],
  default: [],
  swiftshader: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
};
const W = scene.W || 1600, H = scene.H || 860;

async function launch(mode) {
  const b = await findPuppeteer().launch({ executablePath: chrome, headless: "new", args: ["--allow-file-access-from-files", ...GLARGS[mode]] });
  const p = await b.newPage();
  p.on("pageerror", (e) => console.error("[page]", e.message));
  await p.setContent(`<!doctype html><html><body style="margin:0"></body></html>`);
  await p.addScriptTag({ content: LIB });
  const info = await p.evaluate((W, H, D) => {
    try {
      const c = document.createElement("canvas").getContext("webgl2"); if (!c) return { ok: false, err: "no webgl2" };
      const ext = c.getExtension("WEBGL_debug_renderer_info"), ren = ext ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL) : c.getParameter(c.RENDERER);
      window.CV = brush.createCanvas(W, H, { pixelDensity: D, parent: document.body });
      brush.angleMode(brush.DEGREES);
      return { ok: true, renderer: ren };
    } catch (e) { return { ok: false, err: String(e) }; }
  }, W, H, DENS);
  return { b, p, info };
}

// page-side: draw one element's ops, key, crop -> {png, bbox}
async function bakeOne(p, el, ex) {
  return p.evaluate((W, H, D, paper, scaleB, seed, ops, keyCol, gain) => {
    const t0 = performance.now();
    if (!window.__scaled) { brush.scaleBrushes(scaleB); window.__scaled = 1; }
    brush.seed(seed); brush.noiseSeed(seed);
    brush.clear(paper);
    brush.push(); brush.translate(-W / 2, -H / 2);
    if (window.__wig) brush.wiggle(window.__wig);
    for (const o of ops) {
      if (o.op === "stroke") { brush.noFill(); brush.noHatch(); brush.set(o.brush, o.color, o.weight); brush.spline(o.pts, 0); }
      else if (o.op === "hatch") { brush.noStroke(); brush.noFill(); brush.hatchStyle(o.brush, o.color, o.weight); brush.hatch(o.dist, o.angle, { rand: 0.08, continuous: false }); brush.polygon(o.pts); brush.noHatch(); }
      else if (o.op === "wash") { brush.noStroke(); brush.noHatch(); brush.fill(o.color, o.opacity); brush.fillBleed(o.bleed, "out"); brush.fillTexture(o.tex, 0.5); brush.polygon(o.pts); brush.noFill(); }
    }
    brush.pop(); brush.render();
    const t1 = performance.now();
    const cw = window.CV.width, ch = window.CV.height, c2 = document.createElement("canvas"); c2.width = cw; c2.height = ch;
    const g = c2.getContext("2d", { willReadFrequently: true }); g.drawImage(window.CV, 0, 0);
    const im = g.getImageData(0, 0, cw, ch), d = im.data;
    const hx = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
    const P = hx(paper), C = hx(keyCol), dv = [P[0] - C[0], P[1] - C[1], P[2] - C[2]], dd = dv[0] * dv[0] + dv[1] * dv[1] + dv[2] * dv[2];
    let x0 = cw, y0 = ch, x1 = -1, y1 = -1, offPal = 0, inked = 0;
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const i = (y * cw + x) * 4, r = d[i], gg = d[i + 1], b = d[i + 2];
      let a = ((P[0] - r) * dv[0] + (P[1] - gg) * dv[1] + (P[2] - b) * dv[2]) / dd;
      // residual from the paper->ink line (spectral mixing / off-palette) — diagnostic only
      if (a > 0.05) { inked++; const rr = P[0] - a * dv[0] - r, rg = P[1] - a * dv[1] - gg, rb = P[2] - a * dv[2] - b; if (rr * rr + rg * rg + rb * rb > 900) offPal++; }
      a = a < 0.035 ? 0 : Math.min(1, ((a - 0.035) / 0.965) * gain);
      d[i] = C[0]; d[i + 1] = C[1]; d[i + 2] = C[2]; d[i + 3] = Math.round(a * 255);
      if (a > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return { empty: true };
    x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(cw - 1, x1 + 2); y1 = Math.min(ch - 1, y1 + 2);
    g.putImageData(im, 0, 0);
    const c3 = document.createElement("canvas"); c3.width = x1 - x0 + 1; c3.height = y1 - y0 + 1;
    c3.getContext("2d").drawImage(c2, x0, y0, c3.width, c3.height, 0, 0, c3.width, c3.height);
    const png = c3.toDataURL("image/png");
    return { png, bbox: [x0 / D, y0 / D, c3.width / D, c3.height / D], drawMs: t1 - t0, totMs: performance.now() - t0, offPal, inked };
  }, W, H, DENS, T.paper, scene.scaleBrushes || 5, el.seed || 1, ex.ops, ex.color, el.gain || 1);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const cacheF = path.join(OUT, "paths.json"), prev = fs.existsSync(cacheF) ? JSON.parse(fs.readFileSync(cacheF, "utf8")) : { elements: [] };
  const prevBy = Object.fromEntries((prev.elements || []).map((e) => [e.id, e]));
  const modeArg = arg("gl", "auto"), tries = modeArg === "auto" ? ["gpu", "default", "swiftshader"] : [modeArg];
  const els = scene.elements, todo = [], outEls = [];
  for (const el of els) {
    const ex = expand(el, T);
    const hash = crypto.createHash("sha1").update(JSON.stringify([BAKE_VER, LIBH, DENS, scene.scaleBrushes || 5, T.paper, ex.color, el, ex.ops])).digest("hex").slice(0, 12);
    const rec = { id: el.id, kind: el.kind, layer: el.layer ?? (el.kind === "wash" ? 0 : el.kind === "hatch" ? 1 : 2), colorToken: el.colorToken || "ink", hash, png: `layers/${el.id}.png`, reveal: ex.reveal };
    const hit = !FORCE && prevBy[el.id] && prevBy[el.id].hash === hash && fs.existsSync(path.join(OUT, rec.png));
    if (hit && (!ONLY || !ONLY.includes(el.id))) { rec.bbox = prevBy[el.id].bbox; rec.cached = true; } else todo.push({ el, ex, rec });
    outEls.push(rec);
  }
  let used = null, timing = { launchMs: 0, perEl: [] };
  if (todo.length) {
    let L;
    for (const m of tries) {
      const t0 = Date.now(); L = await launch(m); timing.launchMs = Date.now() - t0;
      console.log(`[gl ${m}] ${L.info.ok ? "OK " + L.info.renderer : "FAIL " + L.info.err}`);
      if (L.info.ok) { used = m; break; } await L.b.close();
    }
    if (!used) { console.error("no WebGL2 mode worked"); process.exit(2); }
    fs.mkdirSync(path.join(OUT, "layers"), { recursive: true });
    const tAll = Date.now();
    for (const { el, ex, rec } of todo) {
      const t0 = Date.now(), r = await bakeOne(L.p, el, ex);
      if (r.empty) { console.warn("empty layer", el.id); rec.bbox = [0, 0, 0, 0]; continue; }
      fs.writeFileSync(path.join(OUT, rec.png), Buffer.from(r.png.split(",")[1], "base64"));
      rec.bbox = r.bbox.map((v) => Math.round(v * 100) / 100);
      const ms = Date.now() - t0; timing.perEl.push([el.id, ms, Math.round(r.drawMs)]);
      console.log(`  ${el.id.padEnd(14)} ${el.kind.padEnd(9)} ${String(ms).padStart(5)} ms (draw ${Math.round(r.drawMs)}) offPalette ${(100 * r.offPal / Math.max(1, r.inked)).toFixed(1)}%`);
    }
    timing.bakeMs = Date.now() - tAll; await L.b.close();
  }
  const out = { W, H, density: DENS, theme: T.id, lib: "p5.brush 2.2.3 " + LIBH, gl: used, elements: outEls };
  fs.writeFileSync(cacheF, JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(OUT, "paths.js"), "window.BOARD=" + JSON.stringify(out) + ";\n");
  const n = todo.length;
  console.log(`baked ${n}/${outEls.length} (cached ${outEls.length - n}) gl=${used} launch ${timing.launchMs} ms, bake ${timing.bakeMs || 0} ms${n ? ", avg " + Math.round(timing.bakeMs / n) + " ms/el" : ""}`);
})();
