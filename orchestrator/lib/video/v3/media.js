"use strict";

/**
 * Root media layer for `media` modules with kind "video" (refs R7/R8, design/R8/AUDIT.md §2).
 *
 * HyperFrames plays only framework-timed <video> elements, so the stage module draws the window
 * chrome + poster, and this builds the timed trims that composeStage.js places in the ROOT
 * composition exactly over the window body:
 *   - one entry per visible run of the module (consecutive scaffolds that contain it);
 *   - trims: props.trims [{in, at?: {text, sentence?}, variant?}] -- trim k starts 100 ms before
 *     its anchor word (R8: trims lead the clause by ~110 ms), the first at the run start, each
 *     lasts until the next trim or the run end;
 *   - a trim longer than the clip left after `in` holds the clip's last frame (props.lastFrame),
 *     never loops, never shows black;
 *   - `shrink` events become root tweens on the footage wrapper (same 433 ms power2.inOut FLIP
 *     the stage runs on the window).
 */

const HEAD = 40.5;
const BORDER = 1.5;
const LEAD = 0.1;

function round(x) {
  return Math.round(x * 1000) / 1000;
}

function bodyRect(rect, props) {
  const head = props.head || props.dot ? HEAD : 0;
  return [rect[0] + BORDER, rect[1] + BORDER + head, rect[2] - 2 * BORDER, rect[3] - 2 * BORDER - head];
}

function buildMediaLayer({ scaffolds, events, sbScaffolds, wordTime }) {
  const out = [];
  const byId = new Map();
  scaffolds.forEach((s, si) => {
    s.modules.forEach((m) => {
      if (m.type !== "media" || (m.props && m.props.kind === "image")) return;
      let e = byId.get(m.id);
      const last = e && e.runs[e.runs.length - 1];
      if (last && Math.abs(last.t1 - s.t0) < 1e-6) {
        last.t1 = s.t1;
      } else {
        if (!e) {
          e = { id: m.id, props: m.props || {}, runs: [] };
          byId.set(m.id, e);
          out.push(e);
        }
        e.runs.push({ t0: s.t0 + (m.at || 0), t1: s.t1, rect: m.rect, from: (sbScaffolds[si] || {}).from });
      }
    });
  });

  return out.map((e, ei) => {
    const p = e.props;
    const trimsIn = Array.isArray(p.trims) && p.trims.length ? p.trims : [{ in: p.in || 0 }];
    const items = [];
    const wrappers = e.runs.map((run, ri) => {
      // trim start times inside this run
      const starts = trimsIn.map((tr, k) => {
        if (k === 0 || !tr.at) return k === 0 ? run.t0 : null;
        const w = wordTime(tr.at.sentence || run.from, tr.at, `media ${e.id} trim ${k + 1}`);
        return Math.min(run.t1 - 0.3, Math.max(run.t0, w.start - LEAD));
      });
      const list = trimsIn
        .map((tr, k) => ({ tr, t: starts[k] }))
        .filter((x) => x.t !== null && x.t >= run.t0 - 1e-6 && x.t < run.t1)
        .sort((a, b) => a.t - b.t);
      list.forEach((x, k) => {
        const t0 = x.t;
        const t1 = k + 1 < list.length ? list[k + 1].t : run.t1;
        const src = x.tr.src || p.src;
        const clipLeft = Number(x.tr.clipDur || p.clipDur) > 0 ? Number(x.tr.clipDur || p.clipDur) - (x.tr.in || 0) : Infinity;
        const vdur = Math.min(t1 - t0, clipLeft - 1 / 30);
        items.push({ kind: "video", src, start: round(t0), dur: round(vdur), mediaStart: round(x.tr.in || 0), wrap: ri });
        if (t1 - t0 > vdur + 1e-3 && (x.tr.lastFrame || p.lastFrame)) {
          items.push({ kind: "img", src: x.tr.lastFrame || p.lastFrame, start: round(t0 + vdur), dur: round(t1 - t0 - vdur), wrap: ri });
        }
      });
      const body = bodyRect(run.rect, p);
      const tweens = (events || [])
        .filter((ev) => ev.op === "shrink" && String(ev.target).split(".")[0] === e.id && ev.t >= run.t0 && ev.t < run.t1)
        .map((ev) => ({
          t: ev.t,
          scale: (ev.value && ev.value.scale) || 0.403,
          // origin = the WINDOW's top-right corner, in wrapper-local px
          origin: [round(run.rect[0] + run.rect[2] - body[0]), round(run.rect[1] - body[1])],
        }));
      // overlays drawn ON the footage (the video layer sits above the stage): highlight boxes
      const hls = [];
      (events || [])
        .filter((ev) => String(ev.target).split(".")[0] === e.id && ev.t >= run.t0 && ev.t < run.t1 && (ev.op === "highlight" || ev.op === "unhighlight"))
        .forEach((ev) => {
          if (ev.op === "highlight") hls.push({ t: ev.t, t1: run.t1, box: (ev.value && ev.value.box) || [10, 10, 30, 20], tone: (ev.value && ev.value.tone) || "amber" });
          else if (hls.length) hls[hls.length - 1].t1 = ev.t;
        });
      return { id: `media${ei}_${ri}`, rect: body.map(round), radius: 7.5, t0: round(run.t0), t1: round(run.t1), tweens, highlights: hls };
    });
    return { id: e.id, wrappers, items: items.map((it, k) => ({ ...it, id: `m${ei}_${k}` })) };
  });
}

module.exports = { buildMediaLayer, bodyRect, HEAD };

/**
 * Hard media gate (before render): every trim's source exists locally, its first shown frame is not
 * black (R8 defect: 13/17 trim starts showed one black frame), and the window body aspect is within
 * 2% of the footage aspect (cover never crops more than 2%).
 */
function checkMedia(media, veDir) {
  const fs = require("fs");
  const path = require("path");
  const { spawnSync } = require("child_process");
  const problems = [];
  const probeCache = new Map();
  (media || []).forEach((m) =>
    m.items.forEach((it) => {
      const file = path.join(veDir, it.src);
      if (!fs.existsSync(file)) return problems.push(`media ${m.id}: missing ${it.src}`);
      if (it.kind !== "video") return;
      if (!probeCache.has(file)) {
        const pr = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file], { encoding: "utf-8" });
        const [w, h] = String(pr.stdout || "").trim().split(",").map(Number);
        probeCache.set(file, w && h ? w / h : null);
      }
      const ar = probeCache.get(file);
      const wr = m.wrappers[it.wrap];
      if (ar && wr) {
        const box = wr.rect[2] / wr.rect[3];
        const crop = 1 - Math.min(ar, box) / Math.max(ar, box);
        if (crop > 0.02) problems.push(`media ${m.id}: window aspect ${box.toFixed(3)} vs footage ${ar.toFixed(3)} crops ${(crop * 100).toFixed(1)}% (max 2%)`);
      }
      const r = spawnSync("ffmpeg", ["-v", "error", "-ss", String(it.mediaStart || 0), "-i", file, "-frames:v", "1", "-vf", "scale=64:-1,format=gray", "-f", "rawvideo", "-"], { maxBuffer: 1 << 20 });
      const buf = r.stdout || Buffer.alloc(0);
      const mean = buf.length ? buf.reduce((a, b) => a + b, 0) / buf.length : 0;
      if (mean < 8) problems.push(`media ${m.id}: trim at ${it.mediaStart}s of ${it.src} opens on a black frame (mean luma ${mean.toFixed(1)})`);
    })
  );
  return problems;
}

module.exports.checkMedia = checkMedia;
