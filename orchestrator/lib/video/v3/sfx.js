"use strict";

/**
 * SFX cues for a compiled v3 stage spec: every visual change gets a soft synthesized sound
 * (tools/sfx_mix.py), placed on the frame the motion starts.
 *   scaffold hard cut -> whoosh (peaks on the cut)   card / row / node enters -> tick
 *   lighting / tone / status -> glassy blip           slam / stamp / hero -> pop
 *   strike -> strike      typing -> key clicks        count-up -> tick roll
 *   connector draw / packets / surge -> swish         chapter (DC) + last scaffold -> chime
 * Cues closer than MIN_GAP to a louder/earlier cue are dropped, so busy beats stay clean.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const PROJECT_PYTHON = path.resolve(__dirname, "..", "..", "..", "..", ".venv",
  process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const PYTHON = process.env.SFX_PYTHON || (fs.existsSync(PROJECT_PYTHON) ? PROJECT_PYTHON : "python");
const MIN_GAP = 0.085;
const PRIORITY = { chime: 5, whoosh: 4, pop: 4, strike: 3, swish: 2, roll: 2, keys: 2, blip: 1, tick: 0 };

const OPS = {
  tick: ["reveal", "rowIn", "nodeIn", "dropIn", "lineIn", "fill", "activate", "branch", "advance", "counter", "text", "cellIn"],
  blip: ["light", "highlight", "tone", "rowTone", "rowStatus", "edgeTone", "layerTone", "pick", "panelTone", "setLive", "env", "cell", "cellTone", "lineHl", "lineTone", "rowText"],
  pop: ["slam", "stamp", "punch", "flash"],
  strike: ["strike", "rowStrike"],
  keys: ["type", "retype"],
  roll: ["count"],
  swish: ["draw", "packet", "surge", "traffic"],
  chime: ["chapter"],
};
const KIND_OF = {};
Object.entries(OPS).forEach(([k, ops]) => ops.forEach((o) => (KIND_OF[o] = k)));

function typedLength(e) {
  const v = e.value;
  const s = typeof v === "string" ? v : v && (v.text || v.to || v.value || "");
  return String(s || "").length || 12;
}

// LF (plan §6): the same library at lower density -- whoosh on scene cuts, a soft pop when a photo drops
// in, a tick roll on count-ups, a swish on drawn charts/arrows, a blip on highlights; no tick on every row.
const LF_KIND = { count: "roll", draw: "swish", arrow: "swish", highlight: "blip", annotate: "blip", zoomTo: "swish", pin: "tick", check: "tick", tick: "tick", win: "blip", press: "pop" };
const LF_MEDIA = new Set(["photo", "photoGrid", "portraitCard", "mapCard"]);
const LF_MIN_GAP = 0.3;

function sfxCuesLF(spec, duration) {
  const cues = [];
  const scaffolds = spec.scaffolds || [];
  let prevIds = new Set();
  scaffolds.forEach((s, si) => {
    const ids = new Set((s.modules || []).map((m) => m.id));
    if (si > 0 && [...ids].some((id) => !prevIds.has(id))) cues.push({ t: s.t0 - 0.2, at: s.t0, kind: "whoosh", var: si, gain: -3 });
    (s.modules || []).forEach((m, mi) => {
      if (prevIds.has(m.id) || !LF_MEDIA.has(m.type) || !m.at) return;
      cues.push({ t: s.t0 + m.at, at: s.t0 + m.at, kind: "pop", var: si + mi, gain: -6 });
    });
    if (s.template === "lfChapter") cues.push({ t: s.t0 + 0.02, at: s.t0 + 0.02, kind: "chime", var: si, gain: -4 });
    prevIds = ids;
  });
  (spec.events || []).forEach((e, i) => {
    const kind = LF_KIND[e.op];
    if (!kind) return;
    const c = { t: e.t, at: e.t, kind, var: i, gain: kind === "blip" || kind === "tick" ? -3 : -2 };
    if (kind === "roll") c.dur = (e.value && e.value.dur) || 1.2;
    if (kind === "swish") c.t = e.t - 0.04;
    cues.push(c);
  });
  // count-ups that run on entrance (bigNumber count: "enter")
  scaffolds.forEach((s) => (s.modules || []).forEach((m) => {
    if (m.type === "bigNumber" && m.props && m.props.count === "enter") cues.push({ t: s.t0 + (m.at || 0) + 0.15, at: s.t0 + (m.at || 0) + 0.15, kind: "roll", var: 3, dur: m.props.dur || 1.2, gain: -2 });
  }));
  cues.sort((a, b) => a.at - b.at || PRIORITY[b.kind] - PRIORITY[a.kind]);
  const kept = [];
  for (const c of cues) {
    if (c.at < 0.05 || c.at > duration - 0.05) continue;
    const near = kept.filter((k) => Math.abs(k.at - c.at) < LF_MIN_GAP);
    if (!near.length) kept.push(c);
    else if (near.every((k) => PRIORITY[c.kind] > PRIORITY[k.kind])) {
      near.forEach((k) => kept.splice(kept.indexOf(k), 1));
      kept.push(c);
    }
  }
  return kept.map(({ at, ...c }) => ({ ...c, t: +c.t.toFixed(3) }));
}

function sfxCues(spec, duration) {
  if (spec.profile === "LF") return sfxCuesLF(spec, duration);
  const cues = [];
  const scaffolds = spec.scaffolds || [];
  let prevIds = new Set();
  let prevLayout = null;
  scaffolds.forEach((s, si) => {
    const ids = new Set((s.modules || []).map((m) => m.id));
    const changed = si > 0 && ((s.layout || "") !== (prevLayout || "") || [...ids].some((id) => !prevIds.has(id)));
    if (changed) cues.push({ t: s.t0 - 0.2, at: s.t0, kind: "whoosh", var: si });
    (s.modules || []).forEach((m, mi) => {
      if (prevIds.has(m.id) || m.type === "hud" || m.type === "dcChrome" || m.type === "lcHeader") return;
      const t = s.t0 + (m.at || 0);
      if (m.at || !changed) cues.push({ t, at: t, kind: m.type === "hero" || m.type === "dcHero" || m.type === "stamp" ? "pop" : "tick", var: si + mi });
    });
    prevIds = ids;
    prevLayout = s.layout;
  });
  (spec.events || []).forEach((e, i) => {
    const SHOW = { line2: "tick", follow: "pop", site: "tick", type: "keys", click: "tick", tag1: "blip", tag2: "blip", tag3: "blip" };
    const kind = e.op === "show" ? SHOW[(e.value && e.value.part) || ""] : KIND_OF[e.op];
    if (!kind) return;
    const c = { t: e.t, at: e.t, kind, var: i };
    if (kind === "keys") c.dur = e.op === "show" ? 0.2 : Math.min(1.2, typedLength(e) / 60);
    if (kind === "roll") c.dur = (e.value && e.value.dur) || 0.6;
    if (kind === "swish") c.t = e.t - 0.04;
    cues.push(c);
  });
  if (scaffolds.length > 1) {
    const last = scaffolds[scaffolds.length - 1];
    cues.push({ t: last.t0 + 0.02, at: last.t0 + 0.02, kind: "chime", var: 1, gain: -2 });
  }
  // throttle: keep the higher-priority cue of any pair closer than MIN_GAP
  cues.sort((a, b) => a.at - b.at || PRIORITY[b.kind] - PRIORITY[a.kind]);
  const kept = [];
  for (const c of cues) {
    if (c.at < 0.05 || c.at > duration - 0.05) continue;
    const near = kept.filter((k) => Math.abs(k.at - c.at) < MIN_GAP);
    if (!near.length) kept.push(c);
    else if (near.every((k) => PRIORITY[c.kind] > PRIORITY[k.kind])) {
      near.forEach((k) => kept.splice(kept.indexOf(k), 1));
      kept.push(c);
    }
  }
  return kept.map(({ at, ...c }) => ({ ...c, t: +c.t.toFixed(3) }));
}

/** synthesized music-bed presets (tools/music_bed.py); the bed is optional and off by default */
const MUSIC_PRESETS = ["lofi", "ambient", "pulse"];

/**
 * Mix SFX (and, when `music` names a preset, the ducked synthesized bed) under the narration:
 * writes outWav (48 kHz stereo) and returns {cues, ...stats}. sfx=false mixes the bed alone.
 */
function mixSfx({ spec, duration, narrationWav, outWav, stemWav, sfx = true, music = null, musicStemWav, swell = [], log = () => {} }) {
  if (music && !MUSIC_PRESETS.includes(music)) throw new Error(`unknown music preset "${music}" (have ${MUSIC_PRESETS.join(", ")})`);
  const cues = sfx ? sfxCues(spec, duration) : [];
  const cuesPath = outWav + ".cues.json";
  fs.writeFileSync(cuesPath, JSON.stringify({ cues }, null, 1));
  const args = [path.join(__dirname, "..", "..", "..", "tools", "sfx_mix.py"), cuesPath, narrationWav, outWav];
  if (stemWav) args.push("--stem", stemWav);
  if (music) {
    args.push("--music", music, "--duration", String(duration));
    if (musicStemWav) args.push("--music-stem", musicStemWav);
    // [[t0, t1], ...] windows where the bed swells +3 dB (LF chapter cards)
    if (swell && swell.length) args.push("--swell", JSON.stringify(swell));
  }
  const r = spawnSync(PYTHON, args, { encoding: "utf-8" });
  if (r.status !== 0) throw new Error(`sfx mix failed: ${(r.stderr || r.error || "").toString().slice(-600)}`);
  const stats = JSON.parse(r.stdout.trim().split(/\n/).pop());
  if (sfx) log(`sfx: ${cues.length} cues mixed (${Object.entries(cues.reduce((a, c) => ((a[c.kind] = (a[c.kind] || 0) + 1), a), {})).map(([k, n]) => k + " " + n).join(", ")})`);
  if (music) log(`music: "${music}" bed ${stats.bedDb} dB under the voice, ${stats.duckDb} dB more under speech (mono fold ${stats.monoLossDb} dB)`);
  return { cues, ...stats };
}

module.exports = { sfxCues, mixSfx, MUSIC_PRESETS };
