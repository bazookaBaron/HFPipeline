"use strict";
// LF compile post-passes (long-form v2 plan §3 follow-ups):
//
// applyStandIns: media that resolved on the ladder's stand-in rungs (b: a related place photo, c: a
//   generic generated scene, d: a name card) is not a picture of the subject. The storyboard's labels
//   and annotations were written for the subject, so:
//     - the tag is replaced by what is actually shown (rung b), "Illustrative scene" (rung c), or dropped
//       (rung d: the card already names the person);
//     - highlight boxes aimed at the picture become neutral beats (a push toward the centre; a monogram
//       pulse on a name card) so the scene keeps its rhythm; arrows are dropped;
//     - a callout whose leader points INTO the picture moves off the picture when it overlaps it (right,
//       then left side, if that spot is free) and its leader re-anchors to the picture's nearest edge;
//       with no free spot the leader is dropped and the chip stays.
// fixNumberDisplay: a bigNumber shows its value with enough decimals that the displayed figure is within
//   2 % of the fact (1.33 -> "1.33", never "1"); count ops' targets likewise.

const TOL = 0.02;
const FRAME = { x0: 96, x1: 1824, y0: 110, y1: 970 };
const SUBJECT_OPS = new Set(["highlight", "unhighlight", "arrow"]);
const LEADER_TYPES = new Set(["callout"]);

const inside = (pt, r) => pt[0] >= r[0] && pt[0] <= r[0] + r[2] && pt[1] >= r[1] && pt[1] <= r[1] + r[3];
const overlaps = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];

/** nearest point on the rect's border to pt (pt inside the rect) */
function edgePoint(pt, r, prefer) {
  const d = { left: pt[0] - r[0], right: r[0] + r[2] - pt[0], top: pt[1] - r[1], bottom: r[1] + r[3] - pt[1] };
  const side = prefer || Object.keys(d).reduce((a, b) => (d[b] < d[a] ? b : a));
  const y = Math.max(r[1] + 12, Math.min(r[1] + r[3] - 12, pt[1]));
  const x = Math.max(r[0] + 12, Math.min(r[0] + r[2] - 12, pt[0]));
  if (side === "left") return [r[0], y];
  if (side === "right") return [r[0] + r[2], y];
  if (side === "top") return [x, r[1]];
  return [x, r[1] + r[3]];
}

function standInTag(si) {
  if (si.rung === "related") return String(si.shows || "").replace(/\s+/g, " ").trim().slice(0, 52) || null;
  if (si.rung === "scene") return "Illustrative scene";
  return null;
}

/** mutates scaffolds (module props / rects) and events; returns a report */
function applyStandIns(scaffolds, events) {
  const report = { retagged: [], droppedEvents: 0, callouts: [] };
  const drop = new Set();
  for (const s of scaffolds) {
    for (const m of s.modules) {
      const si = m.props && m.props.standIn;
      if (!si || !Array.isArray(m.rect)) continue;
      const tag = standInTag(si);
      if (m.props.tag !== undefined || tag) {
        if (tag) m.props.tag = tag;
        else delete m.props.tag;
        report.retagged.push(`${s.id}/${m.id}`);
      }
      delete m.props.fallbackLabel;
      // subject annotations become neutral beats (the storyboard's visual rhythm stays): on a picture a
      // highlight turns into a slow push toward the centre (unhighlight -> zoomOut); on a name card into a
      // monogram pulse. Arrows are dropped.
      events.forEach((e, i) => {
        if (String(e.target || "").split(".")[0] !== m.id || !SUBJECT_OPS.has(e.op)) return;
        if (e.op === "arrow" || (si.rung === "namecard" && e.op === "unhighlight")) return drop.add(i);
        if (si.rung === "namecard") e.value = { pulse: true };
        else if (e.op === "highlight") (e.op = "zoomTo"), (e.value = { box: [14, 14, 72, 72] });
        else (e.op = "zoomOut"), (e.value = {});
        report.converted = (report.converted || 0) + 1;
      });
      // callouts pointing into the picture
      const others = s.modules.filter((x) => x !== m && Array.isArray(x.rect) && !/^lf(Header|Progress|Credit)$/.test(x.type));
      for (const co of others) {
        if (!LEADER_TYPES.has(co.type) || !Array.isArray(co.props && co.props.to)) continue;
        const abs = [co.rect[0] + co.props.to[0], co.rect[1] + co.props.to[1]];
        if (!inside(abs, m.rect)) continue;
        let rect = co.rect.slice();
        let side = null;
        if (overlaps(rect, m.rect)) {
          const free = (r) => r[0] >= FRAME.x0 && r[0] + r[2] <= FRAME.x1 && others.every((x) => x === co || !overlaps(r, x.rect));
          const right = [m.rect[0] + m.rect[2] + 24, rect[1], rect[2], rect[3]];
          const left = [m.rect[0] - 24 - rect[2], rect[1], rect[2], rect[3]];
          if (free(right)) (rect = right), (side = "right");
          else if (free(left)) (rect = left), (side = "left");
          else rect = null;
        }
        if (!rect) {
          delete co.props.to;
          report.callouts.push(`${s.id}/${co.id}: leader dropped`);
          continue;
        }
        const target = edgePoint(abs, m.rect, side);
        co.rect = rect.map((v) => Math.round(v * 2) / 2);
        co.props.to = [Math.round(target[0] - co.rect[0]), Math.round(target[1] - co.rect[1])];
        report.callouts.push(`${s.id}/${co.id}: ${side ? `moved ${side}, ` : ""}leader to the ${side || "nearest"} edge`);
      }
    }
  }
  if (drop.size) {
    const keep = events.filter((_, i) => !drop.has(i));
    events.length = 0;
    events.push(...keep);
  }
  report.droppedEvents = drop.size;
  return report;
}

/** decimals (0-3) the display needs so round(v, d) is within TOL of v; never fewer than `given` */
function neededDecimals(v, given = 0) {
  const x = Number(v);
  let d = Math.max(0, Math.min(3, Number(given) || 0));
  if (!Number.isFinite(x) || x === 0) return d;
  while (d < 3 && Math.abs(Number(x.toFixed(d)) - x) > TOL * Math.abs(x)) d++;
  return d;
}

/** the figure a bigNumber shows for value v with d decimals (what fmtNum renders, minus grouping) */
function displayed(v, d) {
  return d ? Number(Number(v).toFixed(d)) : Math.round(Number(v));
}

function fixNumberDisplay(scaffolds, events) {
  const fixed = [];
  for (const s of scaffolds) {
    for (const m of s.modules) {
      if (m.type !== "bigNumber" || !m.props) continue;
      const targets = [m.props.value, ...events.filter((e) => e.op === "count" && String(e.target || "").split(".")[0] === m.id && e.value && e.value.to !== undefined).map((e) => e.value.to)];
      const d = targets.reduce((a, v) => Math.max(a, neededDecimals(v, m.props.decimals)), Number(m.props.decimals) || 0);
      if (d !== (Number(m.props.decimals) || 0)) {
        m.props.decimals = d;
        fixed.push(`${s.id}/${m.id}: ${m.props.value} shown with ${d} decimal(s)`);
      }
    }
  }
  return fixed;
}

/** spec check: every bigNumber's shown figure within TOL of its value (and of count targets) */
function numberDisplayProblems(spec) {
  const out = [];
  for (const s of spec.scaffolds || []) {
    for (const m of s.modules || []) {
      if (m.type !== "bigNumber" || !m.props || m.props.value === undefined) continue;
      const v = Number(m.props.value);
      const shown = displayed(v, Number(m.props.decimals) || 0);
      if (Number.isFinite(v) && v !== 0 && Math.abs(shown - v) > TOL * Math.abs(v)) out.push(`${s.id}/${m.id}: shows ${shown} for ${v}`);
    }
  }
  return out;
}

module.exports = { applyStandIns, fixNumberDisplay, numberDisplayProblems, neededDecimals, displayed, edgePoint };
