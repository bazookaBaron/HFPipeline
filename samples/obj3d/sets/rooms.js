// ROOM + STREET SCENES: buildRoom(spec, ctx) -> the same object as composer.js buildSet:
//   { group, subjects, proxies, framings, paths, update, setFocus, light, info, field, items, focus }
// scale:"room"  (1 unit = 1 m): a dollhouse cut-away - floor slab with a visible diorama edge, 2 (or 1 / 0) kept walls with cut caps,
//   skirting, window openings with frames and soft sun shafts, doors, partitions, optional adjoining rooms; furniture is solved from
//   spec.place + room-type rules (ARCH) with clearances, figures from spec.groups (groups.stage when available) + spec.people (cast).
// scale:"street" (1 unit = 2.5 m): built in metres and scaled 0.4: diorama base, pavements + kerbs, road, procedural facades, courthouse steps,
//   lamps, trees, parked cars, stage/barriers, crowds.
// Everything is seeded: same spec + seed -> same scene; another seed -> different furniture variants, figure looks, accessories.
import * as THREE from "three";
import { Builder, MK, FOCUSMAP, rng } from "./grammar3d.js";
import { FURN } from "./furniture.js";
import { posedPerson } from "./poses.js";
let GROUPS = null;
try { GROUPS = await import("./groups.js"); } catch (e) { GROUPS = null; }

const V = (x, y, z) => new THREE.Vector3(x, y, z), D2R = Math.PI / 180, PI = Math.PI, HP = PI / 2, TAU = PI * 2;
const R = (r, a, b) => a + (b - a) * r(), pick = (r, a) => a[Math.floor(r() * a.length) % a.length], clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const hashStr = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const angTo = (x0, z0, x1, z1) => Math.atan2(z1 - z0, x1 - x0);
const snap90 = a => Math.round(a / HP) * HP;
export const FIG_H = 1.75;   // standing figure height in metres (posedPerson is 1 unit tall)
const STREET_S = 0.4;        // street scale: 1 unit = 2.5 m

// ============================== room-type rules (defaults merged under the spec) ==============================
export const ARCH = {
  boardroom: { room: { w: 9, d: 7, h: 3, floor: "carpet", floorAlt: ["carpet", "wood", "carpet"], windows: 3, doors: [{ wall: "left", at: 0.82 }] },
    place: [{ what: "boardroomTable", name: "table", at: "center", seats: 10, off: [0.3, -0.2] }, { what: "rug", at: "under:table", pad: 0.5 }, { what: "screenWall", name: "screen", at: "left", nx: 2, ny: 1 }, { what: "credenza", at: "back", n: 2 }, { what: "wallArt", at: "back", n: 2 }, { what: "shelf", at: "left", n: 1, fill: "mixed" },
      { what: "plant", at: "corner", n: 3 }, { what: "chair", style: "stack", at: "left", n: 3 }, { what: "screenStand", at: "near:table" }, { what: "waterCooler", at: "left" }],
    groups: [{ form: "table", of: "table", n: 8, name: "board" }] },
  courtroom: { room: { w: 15, d: 12, h: 3.8, floor: "wood", floorAlt: ["wood", "carpet"], windows: 4, wainscot: true, doors: [{ wall: "left", at: 0.85, w: 1.6 }] },
    place: [{ what: "judgeBench", name: "bench", at: "back", focusable: true }, { what: "flag", at: "back", n: 2, near: "bench" }, { what: "wallArt", kind: "seal", at: "back", near: "bench", w: 1.1, h: 1.1, y: 2.5 }, { what: "clock", at: "left" }, { what: "juryBox", name: "jury", at: "left", near: [0, -2.2] }, { what: "witnessBox", name: "witnessStand", at: "front-of:bench", lat: 2.7, gap: 0.2, face: "center" }, { what: "witnessTable", name: "counselA", seats: 2, at: "front-of:bench", lat: -0.2, gap: 2.4, face: "bench" }, { what: "witnessTable", name: "counselB", seats: 2, at: "front-of:bench", lat: -3.6, gap: 2.4, face: "bench" },
      { what: "pews", name: "gallery", rows: 3, len: 9, aisle: 1.2, bar: true, at: "front", wallGap: 0.25, near: [1.0, 0] }, { what: "desk", at: "front-of:bench", lat: -3.3, gap: 0.2, variant: "papers", face: "center" }, { what: "filing", at: "left", n: 2, drawers: 2 }],
    groups: [{ form: "table", of: "bench", n: 2, name: "judge" }, { form: "table", of: "jury", n: 12, name: "jurors" }, { form: "table", of: "counselA", name: "prosecution" }, { form: "table", of: "counselB", name: "defence" }, { form: "audience", of: "gallery", n: 16, name: "public" }] },
  hearing: { room: { w: 17, d: 13, h: 4.4, floor: "carpet", floorAlt: ["carpet", "wood"], windows: 0, wainscot: true, doors: [{ wall: "left", at: 0.88, w: 1.6 }] },
    place: [{ what: "dais", name: "dais", seats: 11, at: "back" }, { what: "flag", at: "back", n: 2, near: "dais" }, { what: "witnessTable", name: "witnessTable", seats: 3, at: "front-of:dais", gap: -2.2 },
      { what: "chairsRows", name: "gallery", rows: 3, cols: 10, aisle: 1.2, at: "behind:witnessTable", gap: 1.3, alt: "front" }, { what: "tvCamera", n: 3, at: "side:witnessTable", face: "dais" }],
    groups: [{ form: "table", of: "dais", n: 11, name: "senators" }, { form: "table", of: "dais", staff: true, n: 5, name: "staff" }, { form: "audience", of: "gallery", n: 22, name: "public" }, { form: "workers", of: "tvCamera", name: "camOps" },
      { form: "crowd", n: 5, area: "well", poses: ["kneel", "kneel", "look_down"], prop: "camera", name: "photographers" }] },
  hotel: { room: { w: 8.5, d: 6.5, h: 2.8, floor: "carpet", floorAlt: ["carpet", "wood"], windows: 2, curtains: true, doors: [{ wall: "left", at: 0.85 }] },
    place: [{ what: "bed", name: "bed", at: "back", near: [-0.6, 0] }, { what: "rug", at: "under:bed", pad: 0.9 }, { what: "sofa", name: "sofa", at: "left", w: 1.9 }, { what: "coffeeTable", name: "coffee", at: "front-of:sofa", gap: 0.45 }, { what: "chair", style: "arm", at: "front-of:coffee", gap: 0.5 },
      { what: "desk", at: "back", variant: "lamp", alt: "left" }, { what: "credenza", at: "back", len: 1.4 }, { what: "wardrobe", at: "left" }, { what: "wallArt", at: "back", n: 1, near: "bed" }, { what: "plant", at: "corner", n: 2 }] },
  diner: { room: { w: 13, d: 8, h: 3.1, floor: "tile", windows: 3, doors: [{ wall: "back", at: 0.94, w: 1.1 }] },
    place: [{ what: "booth", name: "booths", n: 4, at: "back" }, { what: "counter", name: "counter", diner: true, len: 5, at: "left" }, { what: "plant", at: "corner" }, { what: "roundTable", n: 2, seats: 3, at: "center" }] },
  newsroom: { room: { w: 16, d: 12, h: 3.2, floor: "carpet", floorAlt: ["carpet", "concrete", "carpet"], windows: 4, doors: [{ wall: "left", at: 0.9 }] },
    place: [{ what: "screenWall", name: "screens", at: "back", nx: 4, ny: 2 }, { what: "newsDesk", name: "pods", n: 6, n2: 3, at: "grid", cols: 3, gapX: 1.8, gapZ: 1.6, off: [0.4, 0.5] }, { what: "partition", glass: true, len: 4, at: "left", name: "editorGlass" }, { what: "wallArt", kind: "photo", at: "back", n: 2 }, { what: "filing", at: "left", n: 4 }, { what: "shelf", at: "left", fill: "mixed" }, { what: "plant", at: "corner", n: 2 }, { what: "whiteboard", at: "left" }],
    groups: [{ form: "table", of: "pods", n: 22, name: "staff" }, { form: "huddle", n: 3, name: "editors" }] },
  trading: { room: { w: 18, d: 13, h: 3.4, floor: "carpet", floorAlt: ["carpet", "tile"], windows: 3, doors: [{ wall: "left", at: 0.9 }] },
    place: [{ what: "screenWall", name: "ticker", at: "back", nx: 6, ny: 2 }, { what: "tradingDesk", name: "desks", n: 6, at: "grid", cols: 3, gapX: 1.7, gapZ: 1.5, h: 0, off: [0, 0.6] }, { what: "plant", at: "corner", n: 2 }],
    groups: [{ form: "table", of: "desks", n: 44, name: "traders", poses: ["sit_type", "phone", "sit_lean", "sit_type", "sit"] }, { form: "crowd", n: 6, area: "aisles", poses: ["phone", "point", "stand_arms_crossed"], name: "floor" }] },
  factory: { room: { w: 24, d: 15, h: 6, floor: "concrete", windows: 5, highWindows: true, doors: [{ wall: "left", at: 0.8, w: 3.5, h: 4 }] },
    place: [{ what: "assemblyLine", name: "line", len: 15, at: [1, -2.2], h: 90 }, { what: "assemblyLine", name: "line2", len: 15, at: [1, 3.2], h: 90 }, { what: "machineTool", n: 4, at: "left" }, { what: "crates", n: 4, at: "back" }, { what: "shelf", n: 3, at: "back", fill: "boxes", height: 2.4, w: 1.6 }],
    groups: [{ form: "workers", of: "assemblyLine", name: "workers" }, { form: "workers", of: "machineTool", name: "machinists" }] },
  mill: { room: { w: 20, d: 13, h: 4.2, floor: "wood", windows: 6, columns: true, shaft: true, doors: [{ wall: "left", at: 0.85, w: 1.4 }] },
    place: [{ what: "spinningFrame", name: "frames", n: 4, at: "grid", cols: 4, len: 7.5, gapX: 2.2, h: 0, off: [0.8, 0.4] }, { what: "crates", kind: "crate", n: 2, at: "back" }, { what: "workbench", at: "left" }],
    groups: [{ form: "workers", of: "spinningFrame", name: "spinners", o: { hat: "none", coat: false, tie: false } }] },
  trollfarm: { room: { w: 14, d: 11, h: 2.8, floor: "carpet", floorAlt: ["carpet", "tile", "concrete"], windows: 3, doors: [{ wall: "left", at: 0.9 }] },
    place: [{ what: "deskRow", name: "rows", n: 4, at: "grid", cols: 4, rowsN: 1, per: 7, gapX: 1.0, h: 0, off: [0.6, 0] }, { what: "whiteboard", at: "left", wallMount: true }, { what: "filing", at: "back", n: 3 }, { what: "waterCooler", at: "left" }, { what: "wallArt", kind: "chart", at: "back", n: 2 }, { what: "clock", at: "back" }, { what: "docPile", at: "back" }],
    groups: [{ form: "table", of: "rows", n: 26, name: "operators", poses: ["sit_type", "sit_type", "sit_lean", "sit_type"] }] },
  pressroom: { room: { w: 13, d: 10, h: 3.2, floor: "carpet", floorAlt: ["carpet", "wood"], windows: 0, doors: [{ wall: "left", at: 0.88 }] },
    place: [{ what: "podium", name: "podium", at: "back", riser: 0.3, mics: 7, wallGap: 1.2 }, { what: "flag", at: "back", n: 2, near: "podium" }, { what: "chairsRows", name: "seats", rows: 3, cols: 10, aisle: 1.2, at: "front-of:podium", gap: 4.2 },
      { what: "tvCamera", n: 4, at: "side:seats", gap: 0.5, face: "podium" }],
    groups: [{ form: "podium", of: "podium", n: 12, name: "scrum" }, { form: "audience", of: "seats", n: 14, name: "reporters" }, { form: "workers", of: "tvCamera", name: "camOps" }] },
  airport: { room: { w: 24, d: 14, h: 4.6, floor: "tile", windows: 6, winLeft: 0, bigWindows: true, walls: "cutaway2", apron: 17, apronX: -1, doors: [{ wall: "back", at: 0.2, w: 1.6, h: 2.3 }] },
    place: [{ what: "jet", name: "jet", outside: [-1, -10.9], h: 90, scale: 0.7, len: 18, bridge: [-7.2, -7.2] }, { what: "gateDesk", name: "gate", at: [-8.6, -4.5], h: 270 }, { what: "beamSeats", name: "seats", n: 9, double: true, at: "grid", cols: 3, rowsN: 3, gapX: 2.4, gapZ: 1.5, h: 0, off: [1.5, 0.4] }, { what: "ropePosts", at: [-6.2, -2.8], len: 4.5, h: 0 },
      { what: "screenWall", name: "departures", at: "left", nx: 2, ny: 1, near: [0, -1] }, { what: "counter", name: "kiosk", len: 3, stools: 3, at: "left", near: [0, 3.5] }, { what: "plant", at: "corner", n: 3 }, { what: "beamSeats", n: 2, at: "back", near: [7, 0] }],
    groups: [{ form: "table", of: "seats", n: 30, name: "travellers" }, { form: "queue", n: 8, at: [-7.2, -3.6], dir: 90, name: "queue", prop: "briefcase" }, { form: "workers", of: "gateDesk", n: 2, name: "agents" }, { form: "table", of: "kiosk", n: 2, name: "coffee" },
      { form: "crowd", n: 9, area: [-4, 4.4, 10, 6.4], poses: ["walk", "walk", "carry", "phone"], mode: "plaza", name: "walkers" }] },
  office: { room: { w: 10, d: 8, h: 3, floor: "carpet", windows: 3 }, place: [{ what: "desk", n: 6, at: "grid", cols: 3, gapX: 1.6, gapZ: 1.4 }, { what: "shelf", at: "back", n: 2 }, { what: "plant", at: "corner" }], groups: [{ form: "table", of: "desk", n: 5 }] },
  lab: { room: { w: 11, d: 8, h: 3.2, floor: "tile", windows: 3 }, place: [{ what: "labBench", n: 4, at: "grid", cols: 2, gapX: 1.6, gapZ: 1.2 }, { what: "shelf", at: "back", n: 3, fill: "boxes" }], groups: [{ form: "workers", of: "labBench" }] },
  // street scale
  rally: { street: { w: 64, d: 44, kind: "plaza", facades: ["back", "left"], road: "front" },
    place: [{ what: "stage", name: "stage", at: "back", w: 9, d: 4.5, wallGap: 5.2 }, { what: "barrier", n: 1, len: 14, at: "front-of:stage", gap: 1.6 }, { what: "flag", n: 4, at: "on:stage" }, { what: "tvCamera", n: 2, at: "front-of:stage", gap: 8.5, spacing: 5, face: "stage" }],
    groups: [{ form: "podium", of: "stage", n: 0, name: "speaker" }, { form: "crowd", n: 170, area: "front-of:stage", gap: 2.6, poses: ["stand", "applaud", "raise_hand", "stand", "phone", "applaud", "stand_arms_crossed"], signs: 0.12, name: "crowd" }] },
  steps: { street: { w: 60, d: 42, kind: "steps", facades: ["back", "left"], road: "front" },
    place: [{ what: "newsVan", n: 3, at: "kerb" }, { what: "barrier", n: 2, len: 9, at: "plaza" }, { what: "tvCamera", n: 3, at: "plaza", face: "steps" }],
    groups: [{ form: "podium", at: "steps-foot", n: 18, name: "scrum" }, { form: "crowd", n: 40, area: "plaza", poses: ["stand", "phone", "stand_arms_crossed"], name: "onlookers" }] },
  market: { street: { w: 50, d: 34, kind: "market", facades: ["back", "left"], road: "front" },
    place: [{ what: "stall", n: 12, at: "aisle" }], groups: [{ form: "crowd", n: 60, area: "aisle", poses: ["stand", "carry", "walk", "phone"], name: "shoppers" }, { form: "workers", of: "stall", name: "vendors" }] },
};

// ============================== tiny geometry helpers ==============================
function obbHit(A, B) { for (const t of [A.a, A.a + HP, B.a, B.a + HP]) { const ux = Math.cos(t), uz = Math.sin(t);
    const pr = o => Math.abs(o.hx * (Math.cos(o.a) * ux + Math.sin(o.a) * uz)) + Math.abs(o.hz * (-Math.sin(o.a) * ux + Math.cos(o.a) * uz));
    if (Math.abs((B.x - A.x) * ux + (B.z - A.z) * uz) > pr(A) + pr(B)) return false; } return true; }
const toWorld = (x, z, a, lx, lz) => [x + lx * Math.cos(a) - lz * Math.sin(a), z + lx * Math.sin(a) + lz * Math.cos(a)];
function wallRun(b, k, axis, c, a0, a1, H, T, opens, y0 = 0) {   // solid wall along axis ('x' or 'z') at centre line c, from a0 to a1, with openings {u0,u1,y0,y1}
  const o = opens.filter(q => q.u1 > a0 && q.u0 < a1).sort((p, q) => p.u0 - q.u0); let cur = a0;
  const piece = (u0, u1, ya, yb) => { if (u1 - u0 < 1e-3 || yb - ya < 1e-3) return; if (axis === "x") b.box(k, u1 - u0, yb - ya, T, (u0 + u1) / 2, y0 + ya, c); else b.box(k, T, yb - ya, u1 - u0, c, y0 + ya, (u0 + u1) / 2); };
  for (const q of o) { piece(cur, q.u0, 0, H); piece(q.u0, q.u1, 0, q.y0); piece(q.u0, q.u1, q.y1, H); cur = q.u1; } piece(cur, a1, 0, H); }

// ============================== figures ==============================
function figure(ctx, rnd, o = {}, cast = {}) { const c = o.char ? (cast[o.char] || {}) : {};
  const oo = { build: R(rnd, 0.85, 1.22), hat: "none", hair: pick(rnd, ["short", "short", "short", "none", "bun", "long"]), coat: rnd() < 0.55, tie: rnd() < 0.35, skirt: false, prop: null, seed: Math.floor(rnd() * 1e6), ...(o.base || {}), ...(o.look || {}), ...c, ...(o.o || {}) };
  if (!o.base && oo.skirt === false && (oo.hair === "bun" || oo.hair === "long") && rnd() < 0.5) oo.skirt = true; if (o.prop !== undefined && o.prop !== null) oo.prop = o.prop; oo.pose = o.pose || oo.pose || "stand";
  if (/^sit/.test(oo.pose)) oo.seated = true; delete oo.scale; delete oo.mark;
  const g = posedPerson(ctx.KM, oo), s = FIG_H * (o.scale ?? c.scale ?? 1) * (o.char ? 1 : R(rnd, 0.96, 1.04)); g.scale.setScalar(s);
  g.traverse(m => { if (m.isMesh) m.castShadow = m.receiveShadow = true; }); g.userData.fig = { pose: oo.pose, s, char: o.char || null, seated: !!oo.seated || /^sit/.test(oo.pose) }; return g; }
const SEAT_POSES = ["sit_listen", "sit", "sit_lean", "sit_listen", "sit_type"], STAND_POSES = ["stand", "stand_hips", "phone", "stand_arms_crossed", "stand", "point", "look_down"];

// local stand-in for groups.stage (same signature) - used until sets/groups.js exists
function stageLocal(form, opts, rnd) { const out = [], n = opts.n ?? 6, poses = opts.poses;
  const P = (i, def) => poses ? poses[i % poses.length] : def;
  if (form === "table" || form === "bench_row" || form === "audience") { const A = (opts.anchors || []).filter(a => a.type === "seat" || a.type === "bench"); const k = Math.min(n, A.length);
    const idx = []; if (k >= A.length) for (let i = 0; i < A.length; i++) idx.push(i); else { const used = new Set(); for (let i = 0; i < k; i++) { let j = Math.floor((i + 0.5) * A.length / k); if (form === "audience") j = Math.floor(rnd() * A.length); while (used.has(j)) j = (j + 1) % A.length; used.add(j); idx.push(j); } }
    for (const [i, j] of idx.entries()) { const a = A[j]; out.push({ x: a.x, z: a.z, y: a.y, h: a.h, pose: P(i, pick(rnd, SEAT_POSES)), anchor: a }); } return out; }
  if (form === "workers") { const A = (opts.anchors || []).filter(a => a.type === "stand" || a.type === "podium"); for (let i = 0; i < Math.min(n, A.length); i++) { const a = A[i]; out.push({ x: a.x, z: a.z, y: a.y ?? 0, h: a.h, pose: P(i, a.work ? pick(rnd, ["look_down", "look_down", "stand", "carry"]) : "stand"), anchor: a }); } return out; }
  const at = opts.at ?? [0, 0], att = opts.attractor;
  if (form === "pair") { const d = opts.gap ?? 1.0, h = opts.h ?? 0; out.push({ x: at[0] - Math.cos(h) * d / 2, z: at[1] - Math.sin(h) * d / 2, h, pose: P(0, "speak") }, { x: at[0] + Math.cos(h) * d / 2, z: at[1] + Math.sin(h) * d / 2, h: h + PI, pose: P(1, "stand") }); return out; }
  if (form === "huddle") { const r = 0.45 + 0.13 * n, a0 = rnd() * TAU; for (let i = 0; i < n; i++) { const a = a0 + i / n * TAU; out.push({ x: at[0] + Math.cos(a) * r, z: at[1] + Math.sin(a) * r, h: a + PI + R(rnd, -0.2, 0.2), pose: P(i, pick(rnd, ["stand", "stand_arms_crossed", "speak", "look_down", "stand_hips"])) }); } return out; }
  if (form === "queue" || form === "procession") { const h = opts.h ?? 0, sp = form === "queue" ? 0.8 : 1.1; for (let i = 0; i < n; i++) { const two = form === "procession" ? (i % 2 ? 0.45 : -0.45) : R(rnd, -0.08, 0.08), k = form === "procession" ? Math.floor(i / 2) : i;
      out.push({ x: at[0] - Math.cos(h) * k * sp - Math.sin(h) * two, z: at[1] - Math.sin(h) * k * sp + Math.cos(h) * two, h: h + R(rnd, -0.15, 0.15), pose: P(i, form === "queue" ? pick(rnd, ["stand", "phone", "stand", "look_down"]) : pick(rnd, ["walk", "walk", "carry"])) }); } return out; }
  if (form === "podium") { const sp = opts.speaker; if (sp && opts.withSpeaker !== false) out.push({ x: sp.x, z: sp.z, y: sp.y, h: sp.h, pose: opts.speakerPose ?? "speak", speaker: true });
    const fx = Math.cos(sp ? sp.h : 0), fz = Math.sin(sp ? sp.h : 0), c = sp ? [sp.x + fx * (opts.front ?? 0.9), sp.z + fz * (opts.front ?? 0.9)] : at; let placed = 0;
    for (let tries = 0; placed < n && tries < n * 60; tries++) { const ring = 1.0 + Math.floor(placed / 7) * 0.62 + R(rnd, 0, 0.25), a = (sp ? sp.h : 0) + R(rnd, -1.15, 1.15), x = c[0] + Math.cos(a) * ring, z = c[1] + Math.sin(a) * ring;
      if (out.some(q => !q.speaker && Math.hypot(q.x - x, q.z - z) < 0.55)) continue; const tgt = sp ? [sp.x, sp.z] : at; out.push({ x, z, h: angTo(x, z, tgt[0], tgt[1]) + R(rnd, -0.15, 0.15), pose: P(placed, pick(rnd, ["mic", "phone", "stand", "mic", "raise_hand", "phone"])) }); placed++; }
    return out; }
  if (form === "crowd") { const A = opts.area ?? [at[0] - 3, at[1] - 3, at[0] + 3, at[1] + 3], md = opts.minD ?? 0.62, pts = [];
    for (let tries = 0; pts.length < n && tries < n * 80; tries++) { const x = R(rnd, A[0], A[2]), z = R(rnd, A[1], A[3]); if (pts.some(q => Math.hypot(q.x - x, q.z - z) < md)) continue;
      const h = att ? angTo(x, z, att[0], att[1]) + R(rnd, -0.35, 0.35) : rnd() * TAU; pts.push({ x, z, h, pose: P(pts.length, pick(rnd, STAND_POSES)) }); } return pts; }
  return out; }
function stage(form, opts, rnd) {   // groups.js (builder B) uses h = rotation.y (faces (cos h, -sin h)) and {x,z} points; rooms.js uses h with faces (cos h, sin h)
  if (GROUPS?.stage) { try { const pt = p => p ? (Array.isArray(p) ? { x: p[0], z: p[1] } : { x: p.x, z: p.z }) : undefined, mix = opts.poses ? opts.poses.map(q => [q, 1]) : undefined;
      const o = { n: opts.n, mix, wardrobe: opts.wardrobe, dress: opts.dress, avoid: opts.avoid }; let f2 = form;
      if (form === "table" || form === "audience" || form === "bench_row") { f2 = "table"; o.anchors = (opts.anchors || []).filter(a => a.type === "seat").map(a => ({ x: a.x, z: a.z, h: -a.h, type: "seat" })); if (!o.anchors.length) return stageLocal(form, opts, rnd); }
      else if (form === "workers") { o.anchors = (opts.anchors || []).filter(a => a.type === "seat" || a.type === "stand").map(a => ({ x: a.x, z: a.z, h: -a.h, type: a.type })); if (opts.n !== undefined && opts.n < o.anchors.length) o.anchors = o.anchors.slice(0, opts.n); }
      else if (form === "podium") { const sp = opts.speaker || { x: opts.at[0], z: opts.at[1], h: 0 }; o.at = { x: sp.x, z: sp.z }; o.face = { x: sp.x + Math.cos(sp.h) * 6, z: sp.z + Math.sin(sp.h) * 6 }; o.speakerPose = opts.speakerPose; o.aides = opts.aides ?? (opts.n ? 2 : 0); o.near = opts.near; o.far = opts.far; o.spread = opts.spread; }
      else if (form === "crowd") { const A = opts.area; o.at = { x: (A[0] + A[2]) / 2, z: (A[1] + A[3]) / 2 }; o.w = A[2] - A[0]; o.d = A[3] - A[1]; o.face = pt(opts.attractor); o.mode = opts.mode ?? (opts.attractor ? "rally" : "plaza"); o.minD = opts.minD; }
      else if (form === "queue") { o.at = pt(opts.at); o.to = { x: o.at.x + Math.cos(opts.h ?? 0), z: o.at.z + Math.sin(opts.h ?? 0) }; o.gap = opts.gap; }
      else if (form === "pair") { o.at = pt(opts.at); o.h = -(opts.h ?? 0); o.kind = opts.kind; o.gap = opts.gap; }
      else if (form === "huddle" || form === "procession") { o.at = pt(opts.at); o.h = -(opts.h ?? 0); }
      const r = GROUPS.stage(f2, o, rnd);
      if (Array.isArray(r)) return r.map(e => ({ x: e.x, z: e.z, h: -e.h, pose: e.pose, base: e.o, speaker: e.role === "speaker", role: e.role, seat: !!e.seat }));
    } catch (e) { console.warn("groups.stage failed, local fallback:", form, e.message); } }
  return stageLocal(form, opts, rnd); }

// ============================== main ==============================
export function buildRoom(specIn, ctx) {
  const t0 = performance.now(), { M, KM, KMR } = ctx, mk = MK(M, KM), fmap = FOCUSMAP(M, KM, KMR), warns = [];
  const A0 = ARCH[specIn.type] || {}, street = (specIn.scale ?? (A0.street ? "street" : "room")) === "street";
  const spec = { ...A0, ...specIn, room: { ...(A0.room || {}), ...(specIn.room || {}) }, street: { ...(A0.street || {}), ...(specIn.street || {}) }, place: specIn.place ?? A0.place ?? [], groups: specIn.groups ?? A0.groups ?? [], people: specIn.people ?? A0.people ?? [] };
  if (specIn.addPlace) spec.place = spec.place.concat(specIn.addPlace); if (specIn.addGroups) spec.groups = spec.groups.concat(specIn.addGroups);
  if (spec.vary !== false) { const rv = rng((hashStr(spec.id ?? "room") ^ Math.imul(spec.seed ?? 1, 2654435761)) >>> 0), pin = specIn.room || {}, R2 = (a, b) => a + (b - a) * rv(), rd = x => Math.round(x * 10) / 10;
    if (!street) { const r = spec.room; if (pin.w === undefined && r.w) r.w = rd(r.w * R2(0.92, 1.1)); if (pin.d === undefined && r.d) r.d = rd(r.d * R2(0.93, 1.1)); if (pin.windows === undefined && typeof r.windows === "number" && r.windows > 0) r.windows = Math.max(1, r.windows + (rv() < 0.35 ? (rv() < 0.5 ? -1 : 1) : 0));
      if (pin.floor === undefined && r.floorAlt) r.floor = r.floorAlt[Math.floor(rv() * r.floorAlt.length) % r.floorAlt.length]; if (pin.wainscot === undefined && r.wainscotP) r.wainscot = rv() < r.wainscotP;
      if (pin.doors === undefined && Array.isArray(r.doors)) r.doors = r.doors.map(q => ({ ...q, at: clamp((q.at ?? 0.8) + R2(-0.08, 0.04), 0.1, 0.92) })); }
    else { const st = spec.street; if (!(specIn.street || {}).w) st.w = rd((st.w ?? 60) * R2(0.94, 1.08)); }
    if (!specIn.place) spec.place = spec.place.map(e => { const q = { ...e }; if (q.at === "center") q.off = [(q.off?.[0] ?? 0) + R2(-0.5, 0.5), (q.off?.[1] ?? 0) + R2(-0.35, 0.35)];
      if (q.at === "grid") { q.gapX = (q.gapX ?? 1.2) * R2(0.88, 1.12); q.gapZ = (q.gapZ ?? 1.2) * R2(0.88, 1.12); q.off = [(q.off?.[0] ?? 0) + R2(-0.4, 0.4), (q.off?.[1] ?? 0) + R2(-0.3, 0.3)]; }
      if (q.at === "back" && !q.name && rv() < 0.3) q.at = "left"; else if (q.at === "left" && !q.name && rv() < 0.3) q.at = "back"; return q; });
    // layout variety beyond size (v3): a diagonal MIRROR (back<->left, front<->right: the dais / bench / booths / screen change wall, doors and
    // windows follow), table shape + seat count, and a seeded furniture set (decor dropped / added) - same type, two seeds, two arrangements.
    const MIRROR_OK = new Set(["boardroom", "courtroom", "hearing", "hotel", "diner", "pressroom"]), SW = { back: "left", left: "back", front: "right", right: "front" };
    if (!street && MIRROR_OK.has(spec.type) && spec.mirror !== false && (spec.mirror === true || rv() < 0.5)) { const r = spec.room, sw2 = a => Array.isArray(a) ? (a.length === 4 ? [a[1], a[0], a[3], a[2]] : [a[1], a[0]]) : a;
      if (pin.w === undefined && pin.d === undefined) { const t = r.w; r.w = Math.max(r.d, r.w * 0.92); r.d = Math.max(t * 0.85, r.d); }
      if (Array.isArray(r.doors) && pin.doors === undefined) r.doors = r.doors.map(q => ({ ...q, wall: SW[q.wall ?? "left"] ?? q.wall, at: q.wall === "left" ? clamp(1 - (q.at ?? 0.8), 0.08, 0.3) : q.at }));
      const mir = e => { const q = { ...e }; if (typeof q.at === "string" && SW[q.at]) q.at = SW[q.at]; if (typeof q.alt === "string" && SW[q.alt]) q.alt = SW[q.alt]; for (const k of ["at", "near", "off", "area"]) if (Array.isArray(q[k])) q[k] = sw2(q[k]); return q; };
      spec.place = spec.place.map(mir); spec.groups = spec.groups.map(mir); spec.people = spec.people.map(mir); spec.mirrored = true; }
    if (!specIn.place) { const DECOR2 = { boardroom: ["whiteboard", "clock", "filing"], courtroom: ["clock", "plant"], hearing: ["clock"], hotel: ["plant", "wallArt"], diner: ["plant", "wallArt"], pressroom: ["plant", "wallArt"], newsroom: ["clock", "waterCooler"], trading: ["clock", "waterCooler"], trollfarm: ["plant"], office: ["whiteboard", "filing"] }[spec.type] || [];
      spec.place = spec.place.filter(e => e.name || !["plant", "wallArt", "credenza", "shelf", "chair", "waterCooler", "screenStand", "filing"].includes(e.what) || rv() > 0.28);
      for (const w of DECOR2) if (rv() < 0.45) spec.place.push({ what: w, at: rv() < 0.5 ? "back" : "left" });
      spec.place = spec.place.map(e => e.what === "boardroomTable" ? { ...e, shape: e.shape ?? (rv() < 0.5 ? "racetrack" : "rect"), seats: e.seats === 10 ? [8, 10, 12][Math.floor(rv() * 3)] : e.seats } : e); } }
  const fparams = e => { const fp = { ...e, ...(e.params || {}) }; delete fp.h; if (e.height !== undefined) fp.h = e.height; return fp; };
  const ROWISH = new Set(["booth", "filing", "serverRack", "deskRow", "beamSeats", "newsDesk", "tradingDesk", "cluster", "screenWall"]);
  const S = street ? STREET_S : 1, seed = hashStr(spec.id ?? "room") ^ Math.imul(spec.seed ?? 1, 7919), rnd = rng(seed), cast = spec.cast || {};
  const E = s => ({ M, KM, KMR, MK: mk, rnd: rng(s >>> 0) });
  const group = new THREE.Group(); group.name = spec.id ?? "room"; const inner = new THREE.Group(); inner.scale.setScalar(S); group.add(inner);
  const SUBJ = {}, MULTI = new Set(), items = [], proxies = [], occ = [], anchorsAll = []; let focusRec = null;
  const addSubj = (name, o) => { if (!name) return; (SUBJ[name] ??= []).push(o); };
  const shell = new Builder();
  const proxyBox = (cx, cy, cz, sx, sy, sz, ry = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz)); m.visible = false; m.position.set(cx, cy, cz); m.rotation.y = ry; inner.add(m); m.updateMatrixWorld(true);
    const hs = V(sx / 2, sy / 2, sz / 2); proxies.push({ mesh: m, hs, dyn: false }); ctx.proxy?.(m, spec.id, hs, false); return m; };

  // ---------------- cells (regions the solver fills) + shell ----------------
  const cells = []; let main, wallsKept = [], openSides = { az: [8, 82] }, extBox; const T = 0.2;
  const windowsOn = { back: [], left: [] }, doorsOn = { back: [], left: [] };
  const L0 = spec.light || {};
  const sunAz = L0.az ?? (street ? 128 : 62), sunEl = L0.el ?? (street ? 38 : 52);
  let streetInfo = null, stepsGeom = null, RS = null;

  function buildRoomShell() {
    const r = spec.room, w = r.w ?? 9, d = r.d ?? 7, H = r.h ?? 3, walls = r.walls ?? "cutaway2", fl = r.floor ?? "wood";
    const adj = (r.rooms || []).map(q => ({ ...q, w: q.w ?? 5 })); const xMax = w / 2 + adj.reduce((s, q) => s + q.w + T, 0);
    main = { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2, H, name: "main", place: spec.place, groups: spec.groups };
    cells.push(main); let xc = w / 2 + T; for (const q of adj) { cells.push({ x0: xc, x1: xc + q.w, z0: -d / 2, z1: d / 2, H, name: q.name ?? "room2", place: q.place || (ARCH[q.type]?.place ?? []), groups: q.groups || (ARCH[q.type]?.groups ?? []), floor: q.floor }); xc += q.w + T; }
    const X0 = -w / 2, X1 = xMax, Z0 = -d / 2, Z1 = d / 2, keepBack = walls !== "open", keepLeft = walls === "cutaway2" || walls === "box";
    if (r.apron) openSides.apron = r.apron;
    openSides.az = walls === "cutaway2" ? [8, 82] : walls === "cutaway1" ? [8, 172] : [0, 360];
    // --- diorama base: floor slab with a visible edge, stepped plinth below
    const m = 0.45; shell.box("l", X1 - X0 + 2 * T + 2 * m + 0.3, 0.22, Z1 - Z0 + T + 2 * m + 0.3, (X0 + X1) / 2 - T / 2, -0.58, (Z0 + Z1) / 2 - T / 2);
    shell.box("w", X1 - X0 + 2 * T + 2 * m, 0.36, Z1 - Z0 + T + 2 * m, (X0 + X1) / 2 - T / 2, -0.36, (Z0 + Z1) / 2 - T / 2);
    shell.box("l", X1 - X0 + 2 * T + 2 * m + 0.02, 0.025, Z1 - Z0 + T + 2 * m + 0.02, (X0 + X1) / 2 - T / 2, -0.07, (Z0 + Z1) / 2 - T / 2);
    for (const c of cells) floorFinish(c, c.floor ?? fl);
    if (r.apron) { const AD = r.apron, zc = Z0 - T - AD / 2, Wa = X1 - X0 + 2 * T + 2 * m; shell.box("l", Wa + 0.3, 0.22, AD, (X0 + X1) / 2 - T / 2, -0.58, zc - m / 2); shell.box("w", Wa, 0.36, AD, (X0 + X1) / 2 - T / 2, -0.36, zc - m / 2);
      shell.box("l", Wa, 0.012, AD, (X0 + X1) / 2 - T / 2, -0.012, zc - m / 2); shell.box("w", 0.18, 0.004, AD - 1, r.apronX ?? 0, 0, zc - m / 2); for (let x = X0 + 2; x < X1 - 1; x += 6) shell.box("w", 2.5, 0.004, 0.15, x, 0, Z0 - T - AD + 1.2);
      for (let i = 0; i < 6; i++) shell.cone("w", 0.12, 0.35, (r.apronX ?? 0) + (i % 2 ? 5 : -5), 0, Z0 - T - 3 - i * 2.2, 8); }
    const doors = r.doors ?? [{ wall: keepLeft ? "left" : "back", at: 0.85 }];
    for (const q of doors) { const wall = q.wall ?? "left"; if ((wall === "left" && !keepLeft) || (wall === "back" && !keepBack)) continue; const span = wall === "back" ? [X0, w / 2] : [Z0, Z1], u = span[0] + (span[1] - span[0]) * (q.at ?? 0.8), dw = q.w ?? 0.95;
      doorsOn[wall].push({ u0: u - dw / 2, u1: u + dw / 2, y0: 0, y1: q.h ?? 2.1 }); }
    extBox = new THREE.Box3(V(X0 - T, -0.6, Z0 - T), V(X1, H, Z1));
    RS = { r, w, d, H, X0, X1, Z0, Z1, keepBack, keepLeft };
    // reserved clearances: in front of every door
    for (const q of doorsOn.left) occ.push({ x: X0 + 0.7, z: (q.u0 + q.u1) / 2, hx: 0.7, hz: (q.u1 - q.u0) / 2 + 0.15, a: 0, h: 2, id: "doorway" });
    for (const q of doorsOn.back) occ.push({ x: (q.u0 + q.u1) / 2, z: Z0 + 0.7, hx: (q.u1 - q.u0) / 2 + 0.15, hz: 0.7, a: 0, h: 2, id: "doorway" });
  }
  // phase B (after furniture): windows go into the wall spans that furniture left free, then walls, frames, curtains, shafts
  function computeWindows() { const { r, w, d, H, X0, X1, Z0, Z1, keepBack, keepLeft } = RS;
    const nWin = r.windows ?? 2, big = r.bigWindows, high = r.highWindows;
    const wy0 = big ? 0.35 : high ? H - 2.0 : 0.88, wy1 = big ? H - 0.3 : high ? H - 0.45 : Math.min(H - 0.35, 0.88 + 1.6);
    const blocked = wall => { const out = []; for (const q of occ) { if (q.id === "doorway" || q.id === "col") continue; if ((q.h ?? 0) <= wy0 + 0.42 && !(q.y0 > 0)) continue; if ((q.y0 ?? 0) >= wy1) continue;
        const cs = Math.cos(q.a), sn = Math.sin(q.a), ex = Math.abs(cs) * q.hx + Math.abs(sn) * q.hz, ez = Math.abs(sn) * q.hx + Math.abs(cs) * q.hz;
        if (wall === "back" && q.z - ez < Z0 + 0.9) out.push([q.x - ex, q.x + ex]); if (wall === "left" && q.x - ex < X0 + 0.9) out.push([q.z - ez, q.z + ez]); }
      for (const q of doorsOn[wall]) out.push([q.u0 - 0.35, q.u1 + 0.35]); return out; };
    const autoWin = (wall, n, ww) => { if (n <= 0) return; const span = wall === "back" ? [X0 + 0.6, w / 2 - 0.6] : [Z0 + 0.6, Z1 - 0.9], B = blocked(wall), got = [];
      const ok = u => u - ww / 2 > span[0] && u + ww / 2 < span[1] && !B.some(([a, b]) => u + ww / 2 + 0.15 > a && u - ww / 2 - 0.15 < b) && !got.some(g => Math.abs(g - u) < ww + 0.7);
      for (let i = 0; i < n; i++) { const ideal = span[0] + (span[1] - span[0]) * (i + 0.5) / n; let best = null; for (let du = 0; du < (span[1] - span[0]) / n; du += 0.05) { for (const u of [ideal + du, ideal - du]) if (ok(u)) { best = u; break; } if (best !== null) break; } if (best !== null) got.push(best); }
      for (const u of got) windowsOn[wall].push({ u0: u - ww / 2, u1: u + ww / 2, y0: wy0, y1: wy1 }); };
    if (Array.isArray(nWin)) { for (const q of nWin) { const wall = q.wall ?? "back", span = wall === "back" ? [X0, w / 2] : [Z0, Z1], u = span[0] + (span[1] - span[0]) * (q.at ?? 0.5), ww2 = q.w ?? 1.35; windowsOn[wall].push({ u0: u - ww2 / 2, u1: u + ww2 / 2, y0: q.y0 ?? wy0, y1: q.y1 ?? wy1 }); } }
    else if (nWin > 0) { const nb = keepBack ? (keepLeft ? (r.winLeft !== undefined ? nWin - r.winLeft : Math.max(1, Math.round(nWin * 0.7))) : nWin) : 0, nl = keepLeft ? nWin - nb : 0, ww = r.winW ?? (big ? Math.min(3.2, w / (nWin + 1)) : 1.35);
      if (keepBack) autoWin("back", nb, ww); if (keepLeft) autoWin("left", nl, ww); } }
  function buildWalls() { const { r, w, d, H, X0, X1, Z0, Z1, keepBack, keepLeft } = RS;
    if (keepBack) { const op = [...windowsOn.back, ...doorsOn.back]; wallRun(shell, "w", "x", Z0 - T / 2, X0 - (keepLeft ? T : 0), X1, H, T, op);
      shell.box("l", X1 - X0 + (keepLeft ? T : 0) + 0.004, 0.012, T + 0.004, (X0 - (keepLeft ? T : 0) + X1) / 2, H, Z0 - T / 2); shell.box("l", 0.012, H, T + 0.004, X1 + 0.006, 0, Z0 - T / 2);
      skirt("x", Z0 + 0.012, X0, X1, op); if (r.wainscot) wainscot("x", Z0, X0, X1, op); proxyBox((X0 + X1) / 2, H / 2, Z0 - T / 2, X1 - X0 + T, H, T); wallsKept.push("back"); }
    if (keepLeft) { const op = [...windowsOn.left, ...doorsOn.left]; wallRun(shell, "w", "z", X0 - T / 2, Z0, Z1, H, T, op);
      shell.box("l", T + 0.004, 0.012, Z1 - Z0 + 0.004, X0 - T / 2, H, (Z0 + Z1) / 2); shell.box("l", T + 0.004, H, 0.012, X0 - T / 2, 0, Z1 + 0.006);
      skirt("z", X0 + 0.012, Z0, Z1, op); if (r.wainscot) wainscot("z", X0, Z0, Z1, op); proxyBox(X0 - T / 2, H / 2, (Z0 + Z1) / 2, T, H, Z1 - Z0); wallsKept.push("left"); }
    for (let i = 1; i < cells.length; i++) { const x = cells[i].x0 - T / 2, op = [{ u0: Z0 + d * 0.25, u1: Z0 + d * 0.25 + 1.0, y0: 0, y1: 2.1 }]; wallRun(shell, "w", "z", x, Z0, Z1, H, T, op);
      shell.box("l", T + 0.004, 0.012, Z1 - Z0, x, H, (Z0 + Z1) / 2); shell.box("l", T + 0.004, H, 0.012, x, 0, Z1 + 0.006); skirt("z", x - T / 2 - 0.012, Z0, Z1, op, -1); skirt("z", x + T / 2 + 0.012, Z0, Z1, op, 1);
      openingFrame("left", x, op[0], true); proxyBox(x, H / 2, (Z0 + Z1) / 2, T, H, Z1 - Z0); }
    for (const wall of ["back", "left"]) { for (const q of windowsOn[wall]) openingFrame(wall, null, q, false); for (const q of doorsOn[wall]) openingFrame(wall, null, q, true); }
    if (r.curtains) for (const q of [...windowsOn.back, ...windowsOn.left]) curtains(q, windowsOn.back.includes(q) ? "back" : "left");
    const dirW = (az, el) => V(Math.cos(el * D2R) * Math.cos(az * D2R), Math.sin(el * D2R), Math.cos(el * D2R) * Math.sin(az * D2R));
    if (L0.shafts !== false) { const mat = new THREE.MeshBasicMaterial({ color: 0xfff3dc, transparent: true, opacity: L0.shaftOpacity ?? 0.085, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false });
      for (const wall of ["back", "left"]) for (const q of windowsOn[wall]) { const sd = wall === "back" ? dirW(L0.shaftAz ?? 252, L0.shaftEl ?? 40) : dirW(L0.shaftAzL ?? 198, L0.shaftEl ?? 40);
        const P = (u, y) => wall === "back" ? V(u, y, Z0) : V(X0, y, u), win = [P(q.u0, q.y0), P(q.u1, q.y0), P(q.u1, q.y1), P(q.u0, q.y1)], flr = win.map(p => p.clone().addScaledVector(sd, -(p.y - 0.01) / sd.y));
        const pos = [], quad = (a, b, c, e) => pos.push(...a.toArray(), ...b.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...e.toArray());
        for (let i = 0; i < 4; i++) quad(win[i], win[(i + 1) % 4], flr[(i + 1) % 4], flr[i]); quad(flr[0], flr[1], flr[2], flr[3]);
        const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); const sm = new THREE.Mesh(g, mat); sm.renderOrder = 3; sm.userData.noFocus = true; sm.castShadow = sm.receiveShadow = false; inner.add(sm); } }
    inner.add(shell.group(mk)); }
  function floorFinish(c, fl) { const W = c.x1 - c.x0, D = c.z1 - c.z0, cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2;
    const base = { wood: "l", tile: "w", carpet: "l", concrete: "l", stone: "w" }[fl] ?? "w"; shell.box(base, W + 0.002, 0.012, D + 0.002, cx, -0.012, cz);
    if (fl === "wood") { const pw = 0.18; let row = 0; for (let z = c.z0 + pw; z < c.z1 - 0.01; z += pw, row++) shell.box("k", W, 0.002, 0.008, cx, 0, z); const r2 = rng(hashStr(c.name) + 3); for (let z = c.z0; z < c.z1 - 0.01; z += pw) { let x = c.x0 + r2() * 1.2; while (x < c.x1) { shell.box("k", 0.008, 0.002, pw, x, 0, z + pw / 2); x += R(r2, 1.0, 2.2); } } }
    else if (fl === "tile") { const ts = 0.6; for (let x = c.x0 + ts; x < c.x1 - 0.01; x += ts) shell.box("l", 0.012, 0.002, D, x, 0, cz); for (let z = c.z0 + ts; z < c.z1 - 0.01; z += ts) shell.box("l", W, 0.002, 0.012, cx, 0, z); }
    else if (fl === "carpet") { shell.box("g", W - 0.5, 0.004, D - 0.5, cx, 0, cz); shell.box("l", W - 0.66, 0.006, D - 0.66, cx, 0, cz); }
    else if (fl === "concrete") { for (let x = c.x0 + 3; x < c.x1 - 0.1; x += 3) shell.box("k", 0.015, 0.002, D, x, 0, cz); for (let z = c.z0 + 3; z < c.z1 - 0.1; z += 3) shell.box("k", W, 0.002, 0.015, cx, 0, z);
      for (let z = c.z0 + 1.5; z < c.z1; z += 4.5) { shell.box("w", W - 1, 0.003, 0.08, cx, 0, z); } } }
  function skirt(axis, c, a0, a1, opens, side = 1) { const o = opens.filter(q => q.y0 < 0.1).sort((p, q) => p.u0 - q.u0); let cur = a0;
    const pc = (u0, u1) => { if (u1 - u0 < 0.02) return; if (axis === "x") shell.box("l", u1 - u0, 0.11, 0.024, (u0 + u1) / 2, 0, c); else shell.box("l", 0.024, 0.11, u1 - u0, c, 0, (u0 + u1) / 2); };
    for (const q of o) { pc(cur, q.u0 - 0.08); cur = q.u1 + 0.08; } pc(cur, a1); }
  function wainscot(axis, c, a0, a1, opens) { const H1 = 1.1, o = opens.sort((p, q) => p.u0 - q.u0); let cur = a0; const runs = []; for (const q of o) { if (q.y0 < H1) { runs.push([cur, q.u0 - 0.1]); cur = q.u1 + 0.1; } } runs.push([cur, a1]);
    for (const [u0, u1] of runs) { if (u1 - u0 < 0.4) continue; const L = u1 - u0, n = Math.max(1, Math.round(L / 1.1));
      if (axis === "x") { shell.box("w", L, 0.05, 0.05, (u0 + u1) / 2, H1, c + 0.025); for (let i = 0; i < n; i++) shell.box("l", L / n - 0.14, 0.62, 0.016, u0 + (i + 0.5) * L / n, 0.26, c + 0.008); }
      else { shell.box("w", 0.05, 0.05, L, c + 0.025, H1, (u0 + u1) / 2); for (let i = 0; i < n; i++) shell.box("l", 0.016, 0.62, L / n - 0.14, c + 0.008, 0.26, u0 + (i + 0.5) * L / n); } } }
  function openingFrame(wall, cx, q, isDoor) { const u = (q.u0 + q.u1) / 2, wO = q.u1 - q.u0, hO = q.y1 - q.y0, r = spec.room;
    const it = isDoor ? FURN.door(E(seed + Math.round(u * 100)), { w: wO, open: wall === "left" ? -0.9 : 0.9 }) : FURN.window(E(seed + 7), { w: wO, h: hO, t: T });
    const g = it.g; if (isDoor && wO > 1.2) g.scale.set(1, (q.y1 / 2.1), wO / 0.95 / (wO / 0.95)); const X0 = cells[0].x0, Z0 = cells[0].z0;
    if (wall === "back") { g.position.set(u, q.y0, Z0 - T / 2); g.rotation.y = -HP; } else { g.position.set(cx ?? X0 - T / 2, q.y0, u); g.rotation.y = 0; }
    inner.add(g); if (isDoor) { // a dim corridor box behind the door so the opening reads as a doorway, not a hole
      const cb = new Builder(); if (wall === "back") cb.box("l", wO + 0.6, 2.4, 1.0, u, 0, Z0 - T - 0.5); else if (cx === null) cb.box("l", 1.0, 2.4, wO + 0.6, X0 - T - 0.5, 0, u); inner.add(cb.group(mk)); } }
  function curtains(q, wall) { const X0 = cells[0].x0, Z0 = cells[0].z0; for (const s of [-1, 1]) { const u = s < 0 ? q.u0 - 0.18 : q.u1 + 0.18; for (let f = 0; f < 4; f++) { const off = (f - 1.5) * 0.07;
      if (wall === "back") shell.cyl("l", 0.045, 0.06, q.y1 + 0.25, u + off, 0, Z0 + 0.09 + (f % 2) * 0.03, 8); else shell.cyl("l", 0.045, 0.06, q.y1 + 0.25, X0 + 0.09 + (f % 2) * 0.03, 0, u + off, 8); } }
    if (wall === "back") shell.cyl("k", 0.015, 0.015, 0.01, 0, 0, 0); }

  // ---------------- street shell (metres) ----------------
  function buildStreetShell() {
    const st = spec.street, w = st.w ?? 60, d = st.d ?? 40, kind = st.kind ?? "plaza", rs = rng(seed + 11);
    const X0 = -w / 2, X1 = w / 2, Z0 = -d / 2, Z1 = d / 2, roadW = 9, pavW = 5.5;
    openSides.az = [10, 80];
    // diorama base
    shell.box("l", w + 2.4, 0.6, d + 2.4, 0, -1.4, 0); shell.box("w", w + 1.6, 0.8, d + 1.6, 0, -0.8, 0); shell.box("l", w + 1.62, 0.05, d + 1.62, 0, -0.1, 0);
    const facadeDepth = 9, backZ = Z0 + facadeDepth, leftX = X0 + facadeDepth;   // facade fronts
    const hasLeft = (st.facades ?? ["back", "left"]).includes("left");
    // ground: pavement along the facades, then the plaza / street; a road along the front edge
    const plz = { x0: hasLeft ? leftX + pavW : X0 + 2, x1: X1 - 2, z0: backZ + pavW, z1: st.road === "front" ? Z1 - roadW - 3.5 : Z1 - 2 };
    shell.box("w", w, 0.05, d, 0, -0.05, 0);   // base paving
    // pavement slabs grid (front of facades)
    for (let x = X0 + 1.2; x < X1; x += 1.2) shell.box("l", 0.03, 0.004, pavW, x, 0, backZ + pavW / 2);
    shell.box("l", w, 0.16, 0.25, 0, 0, backZ + pavW);   // kerb along the back pavement
    if (hasLeft) { for (let z = backZ; z < Z1; z += 1.2) shell.box("l", pavW, 0.004, 0.03, leftX + pavW / 2, 0, z); shell.box("l", 0.25, 0.16, Z1 - backZ - pavW, leftX + pavW, 0, (backZ + pavW + Z1) / 2); }
    // plaza tiles
    for (let x = plz.x0; x < plz.x1; x += 2.4) shell.box("l", 0.04, 0.005, plz.z1 - plz.z0, x, 0, (plz.z0 + plz.z1) / 2);
    for (let z = plz.z0; z < plz.z1; z += 2.4) shell.box("l", plz.x1 - plz.x0, 0.005, 0.04, (plz.x0 + plz.x1) / 2, 0, z);
    if (st.road === "front") { const rz = Z1 - roadW / 2 - 1.0; shell.box("l", w, 0.02, roadW, 0, -0.02, rz); for (let x = X0 + 1; x < X1; x += 4) shell.box("w", 2.2, 0.006, 0.14, x, 0, rz);
      shell.box("l", w, 0.16, 0.25, 0, 0, rz - roadW / 2); shell.box("w", w, 0.12, 1.0, 0, 0, Z1 - 0.5);
      for (let i = 0; i < 6; i++) shell.box("w", 0.5, 0.006, 3.6, -4 + i * 1.0, 0, rz);   // zebra crossing
      for (let x = X0 + 6; x < X1 - 4; x += R(rs, 7, 10)) { const it = FURN.car(E(seed + Math.round(x * 13)), {}); it.g.position.set(x, 0, rz + roadW / 2 - 1.3); it.g.rotation.y = rs() < 0.5 ? 0 : PI; inner.add(it.g); } }
    // facades
    const fac = (x0, x1, axis, frontC, dirIn) => { let u = x0; while (u < x1 - 3) { const bw = Math.min(x1 - u, R(rs, 7, 13)); facade(u, u + bw, axis, frontC, dirIn, rs); u += bw; } };
    if (kind === "steps") { const cw = 26, cx = hasLeft ? (leftX + X1) / 2 + 2 : 0; fac(hasLeft ? leftX : X0, cx - cw / 2 - 0.2, "x", backZ, 1); fac(cx + cw / 2 + 0.2, X1, "x", backZ, 1); courthouse(cx, cw, backZ); }
    else fac(hasLeft ? leftX : X0, X1, "x", backZ, 1);
    if (hasLeft) fac(backZ, Z1 - (st.road === "front" ? roadW + 2 : 0), "z", leftX, 1);
    // lamps + trees along the back kerb, bollards
    for (let x = (hasLeft ? leftX : X0) + 4; x < X1 - 2; x += 9) { const it = FURN.lampPost(E(seed + x), { banner: kind === "plaza" }); it.g.position.set(x, 0, backZ + pavW - 0.6); it.g.rotation.y = HP; inner.add(it.g); occ.push({ x, z: backZ + pavW - 0.6, hx: 0.3, hz: 0.3, a: 0, h: 6, id: "lamp" }); }
    if (kind !== "steps") for (let x = (hasLeft ? leftX : X0) + 8.5; x < X1 - 4; x += 18) { const it = FURN.tree(E(seed + x * 3), {}); it.g.position.set(x, 0, backZ + pavW - 1.6); inner.add(it.g); occ.push({ x, z: backZ + pavW - 1.6, hx: 0.9, hz: 0.9, a: 0, h: 7, id: "tree" }); }
    extBox = new THREE.Box3(V(X0, -1.4, Z0), V(X1, 22, Z1));
    main = { x0: plz.x0, x1: plz.x1, z0: kind === "steps" ? backZ + pavW + 1 : plz.z0 - pavW + 0.6, z1: plz.z1, H: 20, name: "plaza", place: spec.place, groups: spec.groups };
    cells.push(main); streetInfo = { kind, backZ, leftX: hasLeft ? leftX : null, pavW, roadZ: st.road === "front" ? Z1 - roadW / 2 - 1.0 : null, roadW, X0, X1, Z0, Z1, plz };
    if (stepsGeom) streetInfo.stepsFoot = [stepsGeom.cx, stepsGeom.front + stepsGeom.nSt * stepsGeom.sD + 2.2];
  }
  function facade(u0, u1, axis, front, dirIn, rs) {   // a building with its street face at `front` (z for axis x, x for axis z), extending away from the street
    const bw = u1 - u0, fl = Math.floor(R(rs, 3, 6.99)), fh = 3.4, gH = 4.2, Hh = gH + (fl - 1) * fh + 1.0, style = pick(rs, ["classic", "modern", "classic", "plain"]), depth = 9;
    const b = new Builder(), bays = Math.max(2, Math.round(bw / 2.6));
    // build in local frame: street face at z=0, building toward -z, u along x
    b.box("w", bw - 0.1, Hh, depth, bw / 2, 0, -depth / 2); b.box("l", bw, 0.35, 0.3, bw / 2, Hh - 0.35, 0.1); b.box("w", bw - 0.1, 0.8, 0.12, bw / 2, Hh, -0.06);   // cornice + parapet
    if (style === "classic") for (let i = 0; i <= bays; i++) b.box("l", 0.28, Hh - gH, 0.14, 0.05 + i * (bw - 0.1) / bays, gH, 0.07);
    b.box("l", bw, 0.3, 0.22, bw / 2, gH - 0.3, 0.1);   // shopfront fascia
    // ground floor: shopfront windows + door + awning
    const sh = rng(Math.round(u0 * 31) + seed); const nShop = Math.max(1, Math.round(bw / 6)); for (let s = 0; s < nShop; s++) { const sx0 = 0.4 + s * (bw - 0.8) / nShop, sw = (bw - 0.8) / nShop - 0.4;
      b.box("k", sw, gH - 1.0, 0.1, sx0 + sw / 2, 0.5, -0.06); b.box("l", sw + 0.2, 0.12, 0.3, sx0 + sw / 2, 0.38, 0.1); for (let m = 1; m < 3; m++) b.box("l", 0.06, gH - 1.0, 0.12, sx0 + m * sw / 3, 0.5, -0.04);
      b.box("d", 1.1, 2.3, 0.1, sx0 + sw * (sh() < 0.5 ? 0.2 : 0.8), 0, -0.02);
      if (sh() < 0.6) { const aw = new THREE.BoxGeometry(sw, 0.06, 1.4); b.add(sh() < 0.5 ? "w" : "l", aw, sx0 + sw / 2, gH - 0.55, 0.65, 0, 1, 1, 1, -0.32, 0); b.box("w", sw, 0.3, 0.04, sx0 + sw / 2, gH - 1.05, 1.32); } }
    // upper floors: windows per bay
    for (let f = 1; f < fl; f++) { const y = gH + (f - 1) * fh + 0.9; for (let i = 0; i < bays; i++) { const x = 0.05 + (i + 0.5) * (bw - 0.1) / bays, wW = style === "modern" ? (bw - 0.1) / bays - 0.25 : 1.2;
      b.box("k", wW, 1.7, 0.1, x, y, -0.04); b.box("l", wW + 0.2, 0.09, 0.22, x, y - 0.09, 0.06); if (style !== "modern") { b.box("l", wW + 0.24, 0.12, 0.08, x, y + 1.72, 0.02); b.box("l", 0.05, 1.7, 0.12, x, y, -0.02); }
      if (style === "classic" && f === 1 && sh() < 0.4) { b.box("w", wW + 0.3, 0.06, 0.6, x, y - 0.12, 0.3); for (let k = 0; k < 6; k++) b.box("l", 0.03, 0.75, 0.03, x - wW / 2 + k * wW / 5, y - 0.06, 0.58); b.box("l", wW + 0.3, 0.04, 0.04, x, y + 0.68, 0.58); } } }
    if (style === "modern") for (let f = 1; f < fl; f++) b.box("l", bw, 0.25, 0.18, bw / 2, gH + (f - 1) * fh + 0.62, 0.06);
    for (let i = 0; i < 2; i++) b.box("l", R(sh, 0.8, 1.6), R(sh, 0.6, 1.2), R(sh, 0.8, 1.6), R(sh, 1, bw - 1), Hh, R(sh, -6, -2));   // roof units
    const g = b.group(mk); if (axis === "x") { g.position.set(u0, 0, front); } else { g.position.set(front, 0, u1); g.rotation.y = HP; }
    inner.add(g); if (axis === "x") proxyBox(u0 + bw / 2, Hh / 2, front - depth / 2, bw, Hh, depth); else proxyBox(front - depth / 2, Hh / 2, u0 + bw / 2, depth, Hh, bw); }
  function courthouse(cx, cw, front) { const b = new Builder(), nSt = 10, sH = 0.17, sD = 0.42, P = nSt * sH, Hh = 13, depth = 14, nc = 8;
    for (let i = 0; i < nSt; i++) b.box(i % 2 ? "w" : "w", cw + 2 - i * 0.0, sH, (nSt - i) * sD + 0.6, cx, i * sH, front + (nSt - i) * sD / 2 - 0.3);
    for (let i = 0; i < nSt; i++) b.box("l", cw + 2, 0.012, 0.02, cx, (i + 1) * sH, front + (nSt - i - 1) * sD + 0.1);   // step nosings
    for (const s of [-1, 1]) { b.box("w", 1.2, P + 0.9, nSt * sD + 0.6, cx + s * (cw / 2 + 1.6), 0, front + nSt * sD / 2 - 0.3); b.box("l", 1.3, 0.12, nSt * sD + 0.7, cx + s * (cw / 2 + 1.6), P + 0.9, front + nSt * sD / 2 - 0.3); }
    b.box("w", cw, Hh, depth, cx, P, front - depth / 2 - 0.2); b.box("l", cw + 0.6, 0.6, 3.6, cx, P + Hh - 1.6, front + 0.4); b.prism("w", cw + 0.8, 3.2, 3.8, cx, P + Hh - 1.0, front + 0.4, 0); b.prism("l", cw - 1.2, 2.3, 0.1, cx, P + Hh - 0.7, front + 2.3, 0);
    b.box("w", cw + 0.6, 0.4, 3.8, cx, P, front + 0.4);
    for (let i = 0; i < nc; i++) { const x = cx - cw / 2 + 1.2 + i * (cw - 2.4) / (nc - 1); b.cyl("w", 0.48, 0.55, Hh - 2.4, x, P + 0.4, front + 1.6, 18); b.box("l", 1.3, 0.3, 1.3, x, P + 0.4, front + 1.6); b.box("l", 1.3, 0.35, 1.3, x, P + Hh - 2.35, front + 1.6);
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; b.box("l", 0.04, Hh - 2.6, 0.04, x + Math.cos(a) * 0.5, P + 0.6, front + 1.6 + Math.sin(a) * 0.5); } }
    for (const s of [-1, 0, 1]) { b.box("d", 2.0, 4.2, 0.1, cx + s * 4.2, P, front - 0.15); b.box("l", 2.4, 0.3, 0.3, cx + s * 4.2, P + 4.2, front - 0.1); }
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) b.box("k", 1.3, 2.4, 0.1, cx + s * (cw / 2 - 2 - i * 0.0) , P + 6 + (i % 2) * 0, front - 0.15);
    for (const s of [-1, 1]) { b.cyl("l", 0.08, 0.08, 9, cx + s * (cw / 2 + 3.2), 0, front + 4.8, 8); b.box("w", 1.8, 1.1, 0.03, cx + s * (cw / 2 + 3.2) + 0.95, 7.6, front + 4.8); }
    inner.add(b.group(mk)); proxyBox(cx, (P + Hh) / 2, front - depth / 2, cw, P + Hh, depth); occ.push({ x: cx, z: front + nSt * sD / 2, hx: cw / 2 + 2.2, hz: nSt * sD / 2 + 0.3, a: 0, h: P, id: "steps" });
    stepsGeom = { cx, front, P, nSt, sH, sD, cw }; }
  if (!street) buildRoomShell(); else buildStreetShell();
  if (street) inner.add(shell.group(mk));

  // ---------------- solver: furniture ----------------
  const recByName = {}, recsByWhat = {};
  const inCell = (c, o) => { const cs = Math.cos(o.a), sn = Math.sin(o.a); for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const x = o.x + sx * o.hx * cs - sz * o.hz * sn, z = o.z + sx * o.hx * sn + sz * o.hz * cs; if (x < c.x0 + 0.05 || x > c.x1 - 0.05 || z < c.z0 + 0.05 || z > c.z1 - 0.05) return false; } return true; };
  const blocker = (o, ign) => { for (const q of occ) { if (ign && ign.has(q.id)) continue; if (o.y1 !== undefined && ((q.y0 ?? 0) >= o.y1 || (q.h ?? 9) <= (o.y0 ?? 0))) continue; if (obbHit(o, q)) return (items.find(r => r.id === q.id)?.name) ?? q.id; } return null; };
  const free = (o, ign) => { for (const q of occ) { if (ign && ign.has(q.id)) continue; if (o.y1 !== undefined && ((q.y0 ?? 0) >= o.y1 || (q.h ?? 9) <= (o.y0 ?? 0))) continue; if (obbHit(o, q)) return false; } return true; };
  const wallAxisOf = it => it.wallAxis ?? (it.wall === 1 ? 0 : PI);
  function targetOf(t, c) { if (Array.isArray(t)) return t; if (t === "center" || !t) return [(c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2]; const r = recByName[t] || (recsByWhat[t] || [])[0]; if (!r) return [(c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2];
    if (r.it.focusPt) { const [x, z] = toWorld(r.x, r.z, r.a, r.it.focusPt[0], r.it.focusPt[1]); return [x, z]; } return [r.x, r.z]; }
  function candidates(e, it, c, k, n) {
    const at = e.at ?? "center", out = [], cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2, hx = it.len / 2, hz = it.wid / 2, wg = e.wallGap ?? 0.05;
    const faceH = (x, z) => { if (e.h !== undefined) return e.h * D2R; if (e.face) { const [tx, tz] = targetOf(e.face, c), raw = angTo(x, z, tx, tz) - (it.faceAxis ?? 0); return e.snap === false || (it.r < 0.8 && !e.snap) ? raw : snap90(raw); } const [tx, tz] = targetOf(spec.attract, c); return snap90(angTo(x, z, tx, tz) - (it.faceAxis ?? 0)); };
    const alongWall = (wall) => {   // wall: back (z0, normal +z) | left (x0, normal +x) | right (x1) | front (z1)
      const outN = { back: -HP, left: PI, right: 0, front: HP }[wall], a = outN - wallAxisOf(it), nx = Math.cos(outN), nz = Math.sin(outN);
      const ext = Math.abs(Math.cos(a) * nx + Math.sin(a) * nz) * hx + Math.abs(-Math.sin(a) * nx + Math.cos(a) * nz) * hz, along = Math.abs(Math.cos(a) * nz - Math.sin(a) * nx) * hx + Math.abs(Math.sin(a) * nz + Math.cos(a) * nx) * hz;
      const pts = []; const span = wall === "back" || wall === "front" ? [c.x0 + along + 0.15, c.x1 - along - 0.15] : [c.z0 + along + 0.15, c.z1 - along - 0.15]; if (span[1] < span[0]) return pts;
      let pref = e.near ? (wall === "back" || wall === "front" ? targetOf(e.near, c)[0] : targetOf(e.near, c)[1]) : (span[0] + span[1]) / 2;
      const steps = 60; const list = []; for (let i = 0; i <= steps; i++) list.push(span[0] + (span[1] - span[0]) * i / steps); list.sort((p, q) => Math.abs(p - pref) - Math.abs(q - pref));
      if (e.near) { const nr = recByName[e.near]; if (nr) { const rem = list.filter(u => Math.abs(u - pref) > 0.3); list.length = 0; list.push(...rem); } }
      for (const u of list) { const off = ext + wg; if (wall === "back") pts.push({ x: u, z: c.z0 + off, a }); else if (wall === "front") pts.push({ x: u, z: c.z1 - off, a }); else if (wall === "left") pts.push({ x: c.x0 + off, z: u, a }); else pts.push({ x: c.x1 - off, z: u, a }); }
      { const ww = [...(windowsOn[wall] || []), ...(doorsOn[wall] || [])], y0 = it.mount ? it.mount[0] : 0, y1 = it.mount ? it.mount[1] : it.h; if (ww.length && (it.tall || it.mount || it.h > 0.95)) return pts.filter(p => !ww.some(q => { const u = wall === "back" || wall === "front" ? p.x : p.z; return u + along > q.u0 - 0.1 && u - along < q.u1 + 0.1 && q.y0 < y1 && q.y1 > y0; })); }
      return pts; };
    const spiral = (x0, z0, rmax = 99) => { const pts = []; for (let r = 0; r < rmax; r += 0.25) { const m = Math.max(1, Math.round(r * 6)); for (let i = 0; i < m; i++) { const t = i / m * TAU + r; const x = x0 + Math.cos(t) * r, z = z0 + Math.sin(t) * r; pts.push({ x, z, a: faceH(x, z) }); } if (pts.length > 1500) break; } return pts; };
    if (Array.isArray(at)) { const step = e.step ?? [0, 0]; return spiral(at[0] + step[0] * k, at[1] + step[1] * k, 3); }
    const tok = String(at).split(":"), kw = tok[0], ref = tok[1];
    if (kw === "center") return spiral(cx + (e.off?.[0] ?? 0), cz + (e.off?.[1] ?? 0));
    if (kw === "back" || kw === "left" || kw === "right" || kw === "front") return alongWall(kw);
    if (kw === "corner") { const cs = [[c.x0, c.z0], [c.x1, c.z0], [c.x0, c.z1]].sort(() => rnd() - 0.5); cs.unshift([c.x0, c.z0]); return cs.flatMap(([x, z]) => spiral(x + Math.sign(cx - x) * (hx + 0.3), z + Math.sign(cz - z) * (hz + 0.3), 1.5)); }
    if (kw === "window") { const ws = [...windowsOn.back.map(q => ({ x: (q.u0 + q.u1) / 2, z: c.z0 + hz + 0.1, a: -HP - wallAxisOf(it) })), ...windowsOn.left.map(q => ({ x: c.x0 + hx + 0.1, z: (q.u0 + q.u1) / 2, a: PI - wallAxisOf(it) }))]; return ws; }
    if ((kw === "front-of" || kw === "behind" || kw === "side") && recByName[ref]) { const r = recByName[ref], f = r.a + (r.it.faceAxis ?? 0), dir = kw === "behind" ? f + PI : kw === "side" ? f + HP * (e.side ?? (k % 2 ? 1 : -1)) : f;
      let base; if (kw === "front-of" && r.it.focusPt) { const [x, z] = toWorld(r.x, r.z, r.a, r.it.focusPt[0], r.it.focusPt[1]); base = [x, z]; }
      else { const ext = Math.abs(Math.cos(dir - r.a)) * r.it.len / 2 + Math.abs(Math.sin(dir - r.a)) * r.it.wid / 2; base = [r.x + Math.cos(dir) * ext, r.z + Math.sin(dir) * ext]; }
      const g = e.gap ?? 0.8, aa = e.face ? null : dir + PI; const pts = []; for (let dd = 0; dd < 8; dd += 0.2) for (const lat of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4, 3.2, -3.2]) { const lat2 = lat + (kw === "side" ? 0 : (e.lat ?? 0)) + (n > 1 && kw !== "side" ? (k - (n - 1) / 2) * (e.spacing ?? 1.6) : 0);
        const ext2 = Math.abs(Math.cos((aa ?? 0) - dir)) * hx + Math.abs(Math.sin((aa ?? 0) - dir)) * hz, d2 = (r.it.focusPt && kw === "front-of" ? 0 : g) + ext2 + dd + (r.it.focusPt && kw === "front-of" ? g : 0), x = base[0] + Math.cos(dir) * d2 - Math.sin(dir) * lat2, z = base[1] + Math.sin(dir) * d2 + Math.cos(dir) * lat2;
        const a = aa !== null ? (e.side !== undefined && kw === "front-of" ? aa : aa) - (it.faceAxis ?? 0) : faceH(x, z); pts.push({ x, z, a }); } return pts; }
    if (kw === "under" && recByName[ref]) { const r = recByName[ref]; return [{ x: r.x, z: r.z, a: r.a }]; }
    if (kw === "near" && recByName[ref]) { const r = recByName[ref]; return spiral(r.x, r.z).filter(p => Math.hypot(p.x - r.x, p.z - r.z) > r.it.r * 0.6); }
    if (kw === "on" && recByName[ref]) { const r = recByName[ref], dk = r.it.deck ?? 0; const pts = []; for (let i = 0; i < 40; i++) { const lx = R(rnd, -r.it.len / 2 + 0.5, -r.it.len / 2 + 1.2), lz = (k % 2 ? 1 : -1) * R(rnd, r.it.wid * 0.15, r.it.wid * 0.42); const [x, z] = toWorld(r.x, r.z, r.a, lx, lz); pts.push({ x, z, a: r.a, y: dk, onTop: r.id }); } return pts; }
    if (kw === "kerb" && streetInfo?.roadZ) { const pts = []; for (let x = c.x1 - 6; x > c.x0; x -= 1) pts.push({ x, z: streetInfo.roadZ - streetInfo.roadW / 2 + 1.4, a: rnd() < 0.5 ? 0 : PI, road: true }); return pts; }
    if (kw === "plaza" || kw === "aisle") return spiral(cx + R(rnd, -4, 4), cz + R(rnd, -3, 3));
    return spiral(cx, cz);
  }
  function placeGrid(e, c, sub) {   // n items in a grid (rows x cols) centred in the cell (or e.area), same heading
    const n = e.n ?? 4, cols = e.cols ?? Math.ceil(Math.sqrt(n)), rows = e.rowsN ?? Math.ceil(n / cols), recs = [], sd = seed + hashStr(e.what) + recs.length;
    const items0 = []; for (let i = 0; i < n; i++) items0.push(FURN[e.what](E(sd + i * 101), { ...fparams(e), n: e.per ?? e.n2 ?? undefined }));
    const a = (e.h ?? 0) * D2R, it0 = items0[0], ex = Math.abs(Math.cos(a)) * it0.len + Math.abs(Math.sin(a)) * it0.wid, ez = Math.abs(Math.sin(a)) * it0.len + Math.abs(Math.cos(a)) * it0.wid;
    const gx = e.gapX ?? 1.2, gz = e.gapZ ?? 1.2, Wt = cols * ex + (cols - 1) * gx, Dt = rows * ez + (rows - 1) * gz, A = e.area ?? [c.x0, c.z0, c.x1, c.z1], cx = (A[0] + A[2]) / 2 + (e.off?.[0] ?? 0), cz = (A[1] + A[3]) / 2 + (e.off?.[1] ?? 0);
    for (let i = 0; i < n; i++) { const ci = i % cols, ri = Math.floor(i / cols), x = cx - Wt / 2 + ex / 2 + ci * (ex + gx), z = cz - Dt / 2 + ez / 2 + ri * (ez + gz);
      const o = { x, z, a, hx: items0[i].len / 2 + (items0[i].pad ?? 0.5) * 0.5, hz: items0[i].wid / 2 + (items0[i].pad ?? 0.5) * 0.5 };
      let ok = inCell(c, { ...o, hx: items0[i].len / 2, hz: items0[i].wid / 2 }) && free(o); if (!ok) { // nudge
        for (const [dx, dz] of [[0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4], [0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]]) { const o2 = { ...o, x: x + dx, z: z + dz }; if (inCell(c, { ...o2, hx: items0[i].len / 2, hz: items0[i].wid / 2 }) && free(o2)) { o.x = o2.x; o.z = o2.z; ok = true; break; } } }
      if (!ok) { warns.push(`grid ${e.what} ${i} did not fit`); continue; } recs.push(commit(e, items0[i], o.x, o.z, a, 0)); }
    return recs; }
  let idc = 0;
  function commit(e, it, x, z, a, y = 0) { const id = "f" + (++idc), name = e.name ? (e.n > 1 ? e.name : e.name) : null; it.g.position.set(x, y, z); it.g.rotation.y = -a; it.g.updateMatrixWorld(true); inner.add(it.g);
    const pad = (e.clear ?? it.pad ?? 0.5) * 0.5; if (!it.flat) occ.push({ x, z, hx: it.len / 2 + pad, hz: it.wid / 2 + pad, a, h: it.h + y, y0: it.mount ? it.mount[0] : y, id, tall: it.tall });
    const rec = { id, name: e.name ?? e.what, what: e.what, obj: it.g, x, z, y, a, h: a, r: it.r, it, e, anchors: it.anchors.map(q => { const [wx, wz] = toWorld(x, z, a, q.x, q.z); return { ...q, x: wx, z: wz, y: (q.y ?? 0) + y, h: q.h + a, rec: id, used: false }; }) };
    items.push(rec); anchorsAll.push(...rec.anchors); if (!recByName[rec.name]) recByName[rec.name] = rec; (recsByWhat[e.what] ??= []).push(rec); addSubj(rec.name, it.g); if (rec.name !== e.what) addSubj(e.what, it.g); it.g.userData.set = { name: rec.name, what: e.what, r: it.r };
    if (it.tall || it.h > 1.9) makeProxy(it.g, it);
    if (e.focus && !focusRec) focusRec = { kind: "item", objs: [it.g], rec }; return rec; }
  function makeProxy(g, it) { const m = new THREE.Mesh(new THREE.BoxGeometry(it.len, it.h, it.wid)); m.visible = false; m.position.set(0, it.h / 2, 0); g.add(m); m.updateMatrixWorld(true); const hs = V(it.len / 2, it.h / 2, it.wid / 2); proxies.push({ mesh: m, hs, dyn: false }); ctx.proxy?.(m, spec.id, hs, false); }
  function runPlace(e, c) {
    if (!FURN[e.what]) { warns.push("unknown furniture " + e.what); return; }
    if (e.at === "grid") return placeGrid(e, c);
    if (e.outside) { const it = FURN[e.what](E(seed + hashStr(e.what)), fparams(e)), a = (e.h ?? 0) * D2R; it.g.position.set(e.outside[0], 0, e.outside[1]); it.g.rotation.y = -a; if (e.scale) it.g.scale.setScalar(e.scale); inner.add(it.g);
      if (e.bridge) { const b = new Builder(), sc = e.scale ?? 1, door = [e.outside[0] - 2.1 * sc, e.outside[1] - 2.4 * sc], wallP = [e.bridge[0], e.bridge[1]], dx = door[0] - wallP[0], dz = door[1] - wallP[1], L = Math.hypot(dx, dz), ang = Math.atan2(dz, dx), yb = 2.8 * sc - 0.85;
        b.add("w", new THREE.BoxGeometry(L, 2.4, 2.0), (wallP[0] + door[0]) / 2, yb + 1.0, (wallP[1] + door[1]) / 2, -ang); for (let k = 1; k < 5; k++) b.add("l", new THREE.BoxGeometry(0.06, 2.42, 2.02), wallP[0] + dx * k / 5, yb + 1.0, wallP[1] + dz * k / 5, -ang);
        const lx = wallP[0] + dx * 0.7, lz = wallP[1] + dz * 0.7; b.box("k", 0.25, yb - 0.2, 0.25, lx, 0, lz); b.box("k", 1.4, 0.35, 0.6, lx, 0, lz, -ang); b.box("w", 1.6, 2.6, 2.6, door[0], yb - 0.1, door[1], -ang); inner.add(b.group(mk)); } items.push({ id: "out" + (++idc), name: e.name ?? e.what, what: e.what, obj: it.g, x: e.outside[0], z: e.outside[1], y: 0, a, it, e, anchors: [] }); addSubj(e.name ?? e.what, it.g); return; }
    const n = ROWISH.has(e.what) ? (e.count ?? 1) : (e.n ?? 1); const ur = String(e.at ?? "").startsWith("under:") ? recByName[String(e.at).slice(6)] : null, ux = ur ? { len: ur.it.len + (e.pad ?? 0.3), wid: ur.it.wid + (e.pad ?? 0.3) } : {};
    for (let k = 0; k < n; k++) { const it = FURN[e.what](E(seed + hashStr((e.name ?? e.what) + k) + k * 977), { ...fparams(e), ...ux }); let done = false; const why = {};
      const cand = candidates(e, it, c, k, n); for (const p of cand) { const o = { x: p.x, z: p.z, a: p.a, hx: it.len / 2 + (it.pad ?? 0.5) * 0.5, hz: it.wid / 2 + (it.pad ?? 0.5) * 0.5, y0: it.mount ? it.mount[0] : 0, y1: it.mount ? it.mount[1] : it.h };
        if (it.flat) { commit(e, it, p.x, p.z, p.a, 0); done = true; break; }
        const ign = p.onTop ? new Set([p.onTop]) : null; if (!p.road && !p.onTop && !inCell(c, { ...o, hx: it.len / 2, hz: it.wid / 2 })) { why.cell = (why.cell || 0) + 1; continue; } const hit = blocker(o, ign); if (hit) { why[hit] = (why[hit] || 0) + 1; continue; } commit(e, it, p.x, p.z, p.a, p.y ?? 0); done = true; break; }
      if (!done && e.alt) { const e2 = { ...e, at: e.alt, alt: undefined, n: 1, count: 1 }; const n0 = items.length; runPlace(e2, c); if (items.length > n0) done = true; }
      if (!done) warns.push(`could not place ${e.what}${n > 1 ? " #" + k : ""} (${Object.entries(why).sort((p, q) => q[1] - p[1]).slice(0, 3).map(([k2, v]) => k2 + ":" + v).join(" ")})`); } }
  const DECOR = new Set(["wardrobe", "wallArt", "clock", "credenza", "shelf", "rack", "plant", "chair", "waterCooler", "filing", "whiteboard", "screenWall", "screenStand", "flag", "crates", "boxes", "docPile"]);
  const isDecor = e => DECOR.has(e.what) && !e.name && !street;   // named pieces are primary: windows keep clear of them
  for (const c of cells) for (const e of c.place || []) if (!isDecor(e)) runPlace(e, c);
  if (!street && RS.r.columns) { const { w, d, H, X0, Z0 } = RS, nx = Math.max(2, Math.round(w / 4.2)), nz = Math.max(1, Math.round(d / 4.8)), xsUsed = new Set();   // cast-iron columns, nudged into the aisles the machines left free
    for (let i = 1; i < nx; i++) { let xs = null; const x0 = X0 + i * w / nx; for (const dx of [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2, 1.5, -1.5]) { const x = x0 + dx; let ok = true; for (let j = 1; j <= nz; j++) if (!free({ x, z: Z0 + j * d / (nz + 1), a: 0, hx: 0.22, hz: 0.22 })) ok = false; if (ok) { xs = x; break; } }
      if (xs === null) continue; for (let j = 1; j <= nz; j++) { const x = xs, z = Z0 + j * d / (nz + 1); shell.cyl("l", 0.09, 0.11, H - 0.25, x, 0, z, 12); shell.cyl("l", 0.16, 0.18, 0.12, x, 0, z, 12); shell.box("l", 0.36, 0.1, 0.36, x, H - 0.3, z); occ.push({ x, z, hx: 0.22, hz: 0.22, a: 0, h: H, id: "col" }); }
      shell.box("l", 0.2, 0.08, d, xs, H - 0.2, Z0 + d / 2); }
    for (let j = 1; j <= nz; j++) shell.box("l", w, 0.22, 0.16, X0 + w / 2, H - 0.42, Z0 + j * d / (nz + 1)); RS.beamZ = Array.from({ length: nz }, (_, j) => Z0 + (j + 1) * d / (nz + 1)); }
  if (!street) computeWindows();
  for (const c of cells) for (const e of c.place || []) if (isDecor(e)) runPlace(e, c);
  // mill: line shafts above the frames, hung from the columns
  if (spec.room?.shaft) for (const r of recsByWhat.spinningFrame || []) { const b = new Builder(), L = r.it.wid + 2, y = 3.4; const g = new THREE.CylinderGeometry(0.045, 0.045, L, 10); g.rotateX(HP); b.add("k", g, 0, y, 0); for (const bz of (RS.beamZ || [])) { const z = bz - r.z; if (Math.abs(z) > L / 2) continue; b.box("k", 0.06, main.H - 0.42 - y, 0.06, 0, y, z); b.box("k", 0.3, 0.05, 0.08, 0, main.H - 0.47, z); b.cyl("k", 0.11, 0.11, 0.07, 0, y - 0.035, z, 12); }
    const gg = b.group(mk); gg.position.set(r.x, 0, r.z); gg.rotation.y = -r.a + (Math.abs(Math.sin(r.a)) > 0.5 ? 0 : 0); inner.add(gg); }

  if (!street) buildWalls();
  // ---------------- figures ----------------
  const figRoot = new THREE.Group(); figRoot.name = "figures"; inner.add(figRoot); const figs = [];
  const figOcc = []; const fr = 0.24;
  const deckIds = () => new Set(items.filter(r => r.it?.deck).map(r => r.id));
  const figFree = (x, z) => { for (const q of figOcc) if (Math.hypot(q.x - x, q.z - z) < fr * 2) return false; const o = { x, z, a: 0, hx: fr, hz: fr }, dk = deckIds(); for (const q of occ) if (q.id !== "doorway" && !dk.has(q.id) && obbHit(o, q)) return false; return true; };
  function addFig(p, look, name, opt = {}) { const g = figure(ctx, rng(seed + figs.length * 7919 + 13), { pose: p.pose, char: look.char, prop: p.prop ?? look.prop, base: p.base, o: { ...(look.o || {}), ...(p.o || {}) }, look: look.look, scale: look.scale }, cast);
    let y = p.y ?? floorY(p.x, p.z); const seated = g.userData.fig.seated; if (seated && p.anchor) { const sh = g.userData.seatH, s = g.userData.fig.s; y = sh !== undefined ? p.anchor.y - sh * s : Math.max(0, p.anchor.y - 0.46); }
    g.position.set(p.x, y, p.z); g.rotation.y = -(p.h ?? 0); g.updateMatrixWorld(true); figRoot.add(g); figs.push(g); figOcc.push({ x: p.x, z: p.z }); if (p.anchor) p.anchor.used = true; addSubj(name, g); g.userData.fig.name = name; return g; }
  function floorY(x, z) { let y = 0; for (const r of items) { const dk = r.it?.deck; if (!dk) continue; const dx = x - r.x, dz = z - r.z, lx = dx * Math.cos(r.a) + dz * Math.sin(r.a), lz = -dx * Math.sin(r.a) + dz * Math.cos(r.a), D = r.it.deckBox || [r.it.len / 2, r.it.wid / 2];
      if (Math.abs(lx) < D[0] && Math.abs(lz) < D[1]) y = Math.max(y, dk + r.y); } return y; }
  const matchAnchor = (x, z) => { let best = null, bd = 0.06; for (const a of anchorsAll) { if (a.used) continue; const d = Math.hypot(a.x - x, a.z - z); if (d < bd) { bd = d; best = a; } } return best; };
  const anchorsOf = (of, opt = {}) => { const recs = [].concat(of || []).flatMap(nm => items.filter(r => r.it && (r.name === nm || r.what === nm))); const uniq = [...new Set(recs)];
    return uniq.flatMap(r => r.anchors).filter(a => !a.used && (opt.staff ? a.staff : !a.staff)); };
  function resolveAt(at, c) { if (Array.isArray(at)) return at; if (!at) return [(c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2]; if (at === "steps-foot" && streetInfo?.stepsFoot) return streetInfo.stepsFoot;
    const [kw, ref] = String(at).split(":"); const r = recByName[ref ?? kw]; if (kw === "front-of" && r) { const f = r.a + (r.it.faceAxis ?? 0), d = r.it.len / 2 + 1.5; return [r.x + Math.cos(f) * d, r.z + Math.sin(f) * d]; } if (r) return [r.x, r.z]; return [(c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2]; }
  function areaOf(a, c, gr) { if (Array.isArray(a)) return a; const [kw, ref] = String(a ?? "").split(":"), r = recByName[ref];
    if (kw === "front-of" && r) { const f = r.a + (r.it.faceAxis ?? 0), g0 = r.it.len / 2 + (gr.gap ?? 1.5); const cx = r.x + Math.cos(f) * g0, cz = r.z + Math.sin(f) * g0;   // a band in front of the item, clipped to the cell
      const far = Math.max(c.x1 - c.x0, c.z1 - c.z0); const ux = Math.cos(f), uz = Math.sin(f); const x0 = Math.min(cx, cx + ux * far), x1 = Math.max(cx, cx + ux * far), z0 = Math.min(cz, cz + uz * far), z1 = Math.max(cz, cz + uz * far);
      const latW = (gr.width ?? Math.max(r.it.wid, r.it.len) * 1.6) / 2; return [clamp(Math.abs(ux) > 0.5 ? x0 : cx - latW, c.x0 + 0.4, c.x1 - 0.4), clamp(Math.abs(uz) > 0.5 ? z0 : cz - latW, c.z0 + 0.4, c.z1 - 0.4), clamp(Math.abs(ux) > 0.5 ? x1 : cx + latW, c.x0 + 0.4, c.x1 - 0.4), clamp(Math.abs(uz) > 0.5 ? z1 : cz + latW, c.z0 + 0.4, c.z1 - 0.4)]; }
    if (kw === "well") { const d = recByName.dais, w2 = recByName.witnessTable; if (d && w2) { const [tx, tz] = targetOf("dais", c); const mx = (tx + w2.x) / 2, mz = (tz + w2.z) / 2; return [mx - 1.6, mz - 1.2, mx + 1.6, mz + 1.2].map((v, i) => i % 2 ? v : v); } }
    if (kw === "aisles") return [c.x0 + 0.6, c.z1 - 2.0, c.x1 - 0.6, c.z1 - 0.6];
    return [c.x0 + 0.6, c.z0 + 0.6, c.x1 - 0.6, c.z1 - 0.6]; }
  const avoidList = () => { const out = []; for (const q of occ) { const L = Math.max(q.hx, q.hz), w = Math.min(q.hx, q.hz), n = Math.max(1, Math.ceil(L / Math.max(0.3, w))), ax = q.hx >= q.hz ? q.a : q.a + HP;
      for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : -L + w + (i / (n - 1)) * 2 * (L - w); out.push({ x: q.x + Math.cos(ax) * t, z: q.z + Math.sin(ax) * t, r: w * 1.15 }); } } return out; };
  // explicit people first (named characters take their anchors before groups fill the rest)
  for (const p of spec.people || []) { const c = main; let pos = null; const at = p.at;
    if (Array.isArray(at)) pos = { x: at[0], z: at[1], y: 0, h: 0 };
    else if (typeof at === "string") { const [kw, ref, idx] = at.split(":");
      if ((kw === "seat" || kw === "stand" || kw === "podium") && ref) { const A = anchorsOf(ref, { staff: false }).filter(a => kw === "seat" ? a.type === "seat" : kw === "podium" ? a.type === "podium" : a.type === "stand" || a.type === "podium"); const a = A[Math.min(A.length - 1, +(idx ?? 0))] || A[0]; if (a) pos = { x: a.x, z: a.z, y: a.y, h: a.h, anchor: a }; }
      else if (kw === "end" && recByName[ref]) { const r = recByName[ref], s = +(idx ?? 1) >= 0 ? 1 : -1, [x, z] = toWorld(r.x, r.z, r.a, s * (r.it.len / 2 + 0.25), 0); pos = { x, z, y: 0, h: angTo(x, z, r.x, r.z) }; }
      else if (kw === "front-of" && recByName[ref]) { const [x, z] = resolveAt(at, c); pos = { x, z, y: 0, h: angTo(x, z, recByName[ref].x, recByName[ref].z) }; }
      else if (recByName[kw]) { const a = anchorsOf(kw)[0]; if (a) pos = { x: a.x, z: a.z, y: a.y, h: a.h, anchor: a }; } }
    if (!pos) { warns.push("person " + p.id + " has no spot"); pos = { x: 0, z: 0, y: 0, h: 0 }; }
    if (p.face !== undefined) { const t = typeof p.face === "number" ? null : targetOf(p.face, c); pos.h = t ? angTo(pos.x, pos.z, t[0], t[1]) : p.face * D2R; }
    if (p.dx || p.dz) { pos.x += p.dx ?? 0; pos.z += p.dz ?? 0; }
    const g = addFig({ ...pos, pose: p.pose ?? (pos.anchor?.type === "seat" ? "sit" : "stand"), prop: p.prop, o: p.o }, { char: p.char, prop: p.prop }, p.id); if (p.with) { addSubj(p.with, g); MULTI.add(p.with); } }
  // groups
  const groupNames = []; let gi = 0;
  for (const c of cells) for (const gr of c.groups || []) { const name = gr.name ?? `${gr.form}${gi++}`; groupNames.push(name); MULTI.add(name); const r2 = rng(seed + hashStr(name) + 5); let list = [];
    const look = { char: gr.char, prop: gr.prop, o: gr.o, look: gr.look, scale: gr.scale };
    if (gr.form === "table" || gr.form === "bench_row" || gr.form === "audience" || gr.form === "workers") { const A = anchorsOf(gr.of ?? [], { staff: gr.staff }); list = stage(gr.form === "workers" ? "workers" : gr.form, { n: gr.n ?? A.length, anchors: A, poses: gr.poses }, r2); }
    else if (gr.form === "podium") { const pr = recByName[gr.of] ? anchorsOf(gr.of).find(a => a.type === "podium") : null; const ctr = resolveAt(gr.at, c), sp = pr ?? (gr.at ? { x: ctr[0], z: ctr[1], y: 0, h: (gr.h ?? 0) * D2R } : null);
      list = stage("podium", { n: gr.n ?? 10, speaker: sp, withSpeaker: !!pr || gr.speaker !== false, poses: gr.poses, front: gr.front, at: ctr, attractor: ctr }, r2);
      if (sp && !pr) { /* a scrum around a walking figure: the centre is the named person if given */ } }
    else if (gr.form === "crowd") { const ar = areaOf(gr.area, c, gr), att = gr.toward ? targetOf(gr.toward, c) : (String(gr.area ?? "").startsWith("front-of:") ? targetOf(String(gr.area).split(":")[1], c) : null);
      list = stage("crowd", { n: gr.n ?? 20, area: ar, attractor: att, poses: gr.poses, mode: gr.mode, minD: gr.minD ?? (street ? 0.75 : 0.7), avoid: avoidList() }, r2); if (gr.signs) for (const q of list) if (r2() < gr.signs) { q.pose = "raise_hand"; q.prop = "sign"; } }
    else if (gr.form === "pair" || gr.form === "huddle" || gr.form === "queue" || gr.form === "procession") { let ctr = resolveAt(gr.at, c); if (gr.form === "huddle" && !gr.at) { for (let t = 0; t < 200; t++) { const x = R(r2, c.x0 + 1.5, c.x1 - 1.5), z = R(r2, c.z0 + 1.5, c.z1 - 1.5); if (figFree(x, z) && figFree(x + 0.9, z) && figFree(x - 0.9, z) && figFree(x, z + 0.9) && figFree(x, z - 0.9)) { ctr = [x, z]; break; } } }
      list = stage(gr.form, { n: gr.n ?? (gr.form === "pair" ? 2 : 4), at: ctr, h: (gr.dir ?? gr.h ?? 0) * D2R, gap: gr.gap, poses: gr.poses }, r2); }
    let k = 0; for (const p of list) { if (!p.anchor && (p.seat || p.speaker || gr.form === "workers")) p.anchor = matchAnchor(p.x, p.z); if (p.anchor && p.y === undefined) p.y = p.anchor.y; const seatedAt = !!p.anchor; if (!seatedAt && !figFree(p.x, p.z) && !gr.force) continue; if (p.x < extBox.min.x || p.x > extBox.max.x || p.z < extBox.min.z || p.z > extBox.max.z) continue;
      const lk = { ...look, prop: p.prop ?? look.prop, o: { ...(look.o || {}), ...(p.o || {}) } }; if (p.speaker && gr.speakerChar) lk.char = gr.speakerChar; if (gr.cast && gr.cast[k]) lk.char = gr.cast[k];
      const g = addFig(p, lk, name); if (p.speaker) addSubj(name + ".speaker", g); k++; } }

  // ---------------- focus ----------------
  const fspec = typeof spec.focus === "string" ? { id: spec.focus } : (spec.focus || null);
  if (fspec && SUBJ[fspec.id]) focusRec = { kind: MULTI.has(fspec.id) ? "group" : "item", objs: fspec.index !== undefined ? [SUBJ[fspec.id][fspec.index]] : (MULTI.has(fspec.id) || fspec.all ? SUBJ[fspec.id].slice() : SUBJ[fspec.id].slice(0, 1)), name: fspec.id };
  else if (fspec) warns.push("focus " + fspec.id + " not found");
  const subjects = SUBJ; if (focusRec) subjects.focus = focusRec.objs;
  let focusCur = [];
  const meshesOf = o => { const ms = []; o.traverse(m => { if (m.isMesh && !m.userData.noFocus && m.material && (fmap.has(m.material) || m.userData.m0)) ms.push(m); }); return ms; };
  const setFocus = (name, idx = 0) => { for (const m of focusCur) if (m.userData.m0) m.material = m.userData.m0; focusCur = []; if (name == null) return;
    let objs = name === "focus" ? (focusRec ? focusRec.objs : []) : typeof name === "string" ? (MULTI.has(name) ? (SUBJ[name] ?? []) : (SUBJ[name] ?? []).slice(idx, idx + 1)) : [].concat(name);
    for (const o of objs) for (const m of meshesOf(o)) { m.userData.m0 ??= m.material; const r = fmap.get(m.userData.m0); if (r) { m.material = r; focusCur.push(m); } } };
  if (spec.focusDefault !== false && focusRec) setFocus("focus");

  // ---------------- framings (metres, converted to set units at the end) ----------------
  const FOV = 40, tanV = Math.tan(FOV / 2 * D2R), ASP = 16 / 9;
  const dirOf = (az, el) => V(Math.cos(el * D2R) * Math.cos(az * D2R), Math.sin(el * D2R), Math.cos(el * D2R) * Math.sin(az * D2R));
  const fitD = (box, az, el, margin = 1.1) => { const dv = dirOf(az, el), f = dv.clone().negate(), right = V().crossVectors(f, V(0, 1, 0)).normalize(), upv = V().crossVectors(right, f).normalize(), c0 = box.getCenter(V()); let d = 1;
    for (let i = 0; i < 8; i++) { const c = V(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(c0), x = Math.abs(c.dot(right)), y = Math.abs(c.dot(upv)), z = c.dot(f); d = Math.max(d, x / (tanV * ASP) - z, y / tanV - z); } return d * margin + 0.3; };
  const bboxOf = objs => { const bb = new THREE.Box3(); for (const o of [].concat(objs)) { o.updateMatrixWorld(true); bb.expandByObject(o); } return bb; };
  inner.updateMatrixWorld(true); group.updateMatrixWorld(true);
  const invS = 1 / S, toM = bb => bb.isEmpty() ? bb : new THREE.Box3(bb.min.clone().multiplyScalar(invS), bb.max.clone().multiplyScalar(invS));   // world (set units) -> metres (group is at origin while building)
  const figBox = figs.length ? toM(bboxOf(figs)) : null, focusBox = focusRec ? toM(bboxOf(focusRec.objs)) : (figBox ?? new THREE.Box3(V(-1, 0, -1), V(1, 1.8, 1)));
  const actBox = new THREE.Box3(); for (const r of items) if (r.it && !["jet", "car", "lampPost", "tree", "newsVan"].includes(r.what)) actBox.union(toM(bboxOf(r.obj))); if (figBox) actBox.union(figBox); if (actBox.isEmpty()) actBox.copy(extBox);
  actBox.intersect(extBox.clone().expandByScalar(0.5));
  const cellBox = new THREE.Box3(V(cells[0].x0, 0, cells[0].z0), V(cells[cells.length - 1].x1, street ? 6 : main.H, cells[0].z1));
  const [az0, az1] = openSides.az, azOK = az => { const a = ((az % 360) + 360) % 360; return az1 - az0 >= 359 || (a >= az0 && a <= az1); }, azClamp = az => az1 - az0 >= 359 ? az : clamp(((az % 360) + 360) % 360, az0, az1);
  const figFracAt = d => FIG_H / (2 * d * tanV);   // a standing figure near the look point, as a share of frame height
  const dForFrac = f => FIG_H / (2 * f * tanV);
  const occluded = (pos, look, ignore) => { const n = 24; for (let i = 0; i <= n; i++) { const q = pos.clone().lerp(look, i / n * 0.88); for (const o of occ) { if (o.id === "doorway" || (ignore && ignore.has(o.id))) continue; if (q.y > (o.h ?? 1) + 0.05) continue; const dx = q.x - o.x, dz = q.z - o.z, ca = Math.cos(o.a), sa = Math.sin(o.a), lx = dx * ca + dz * sa, lz = -dx * sa + dz * ca; if (Math.abs(lx) < Math.max(o.hx - 0.2, o.hx * 0.6) && Math.abs(lz) < Math.max(o.hz - 0.2, o.hz * 0.6)) return true; } }
    for (const f of figs) { const p = f.position, top = p.y + FIG_H * 1.02; for (let i = 0; i <= n; i++) { const q = pos.clone().lerp(look, i / n * 0.8); if (q.y < top && Math.hypot(q.x - p.x, q.z - p.z) < 0.28 && pos.distanceTo(p) < 7.2) return true; } }
    if (!street) { if (wallsKept.includes("back") && pos.z < cells[0].z0 + 0.1) return true; if (wallsKept.includes("left") && pos.x < cells[0].x0 + 0.1) return true; }
    return pos.y < 1.62; };
  const framings = [];
  const figTooClose = (pos, look) => { const fwd = look.clone().sub(pos).normalize(), dmin = dForFrac(0.34); for (const f of figs) { const p = f.position.clone().multiplyScalar(invS); p.y += 0.9; const v = p.sub(pos), dist = v.length(); if (dist > dmin) continue; if (v.normalize().dot(fwd) > Math.cos(38 * D2R)) return true; } return false; };
  const mkF = (name, look, az, el, d, note, opt = {}) => { let best = null;
    outer: for (const da of [0, 8, -8, 16, -16, 26, -26, 38, -38]) for (const de of [0, 6, 12, 20]) { const a2 = azClamp(az + da), e2 = Math.min(84, el + de), pos = look.clone().addScaledVector(dirOf(a2, e2), d);
      if (!occluded(pos, look, opt.ignore) && !figTooClose(pos, look)) { best = { name, look: look.clone(), az: a2, el: e2, d, note: note + (da || de ? " (adjusted)" : "") }; break outer; } }
    if (!best) best = { name, look: look.clone(), az: azClamp(az), el: Math.min(80, el + 22), d, note: note + " (unverified)" }; framings.push(best); return best; };
  const fc = focusBox.getCenter(V()), fsz = focusBox.getSize(V()), ac = actBox.getCenter(V()), azMid = (az0 + Math.min(az1, az0 + 90)) / 2;
  const lookY = b => Math.min(b.getCenter(V()).y, (street ? 1.1 : 1.0));
  const medD = Math.max(dForFrac(0.25), fitD(focusBox.clone().expandByScalar(0.6), azMid, 22, 1.15)), wideBox = street ? actBox.clone().union(new THREE.Box3(V(actBox.min.x, 0, actBox.min.z), V(actBox.max.x, 8, actBox.max.z))) : actBox.clone().expandByScalar(0.6).union(new THREE.Box3(V(cells[0].x0, 0, cells[0].z0), V(cells[cells.length - 1].x1, main.H, cells[0].z0 + 0.5)));
  mkF("wide", wideBox.getCenter(V()), azMid + 4, street ? 32 : 34, fitD(wideBox, azMid + 4, street ? 32 : 34, 0.9), "dollhouse establishing, whole room");
  mkF("highCorner", ac.clone().setY(0.9), az0 + (az1 - az0 >= 359 ? 35 : Math.min(28, (az1 - az0) * 0.3)), 50, fitD(actBox.clone().expandByScalar(0.6), az0 + 28, 50, 1.05), "high corner over the activity");
  mkF("topDown", cellBox.getCenter(V()).setY(0), 90, 82, fitD(new THREE.Box3(V(cellBox.min.x, 0, cellBox.min.z), V(cellBox.max.x, 1.5, cellBox.max.z)), 90, 82, 1.02), "top-down plan (film.html clamps focus framings to el 40: request by name)");
  { const d = Math.max(dForFrac(0.27), fitD(focusBox.clone().expandByScalar(0.5), azMid, 6, 1.2)), ly = lookY(focusBox); const el = Math.asin(clamp((1.68 - ly) / d, -0.2, 0.6)) / D2R; mkF("eyeLevel", fc.clone().setY(ly), azMid - 6, Math.max(el, 2), d, "eye level (1.7 m) on the focus"); }
  mkF("threeQuarter", fc.clone().setY(lookY(focusBox)), azMid + 10, street ? 34 : 24, medD, "three-quarter on the focus");
  mkF("lateral", fc.clone().setY(lookY(focusBox)), azClamp(az1 - 6), 15, medD * 1.05, "low lateral on the focus");
  // along the longest table (or row of seats)
  { const tb = items.filter(r => r.anchors.filter(a => a.type === "seat").length >= 4 && r.it).sort((a, b) => b.it.len - a.it.len)[0];
    if (tb) { const ax = tb.a + (tb.it.len >= tb.it.wid ? 0 : HP); let best = null; for (const a of [ax, ax + PI]) { const az = ((a / D2R) % 360 + 360) % 360; const sc = azOK(az) ? 0 : Math.min(Math.abs(az - az0), Math.abs(az - az1)); if (!best || sc < best.sc) best = { az, sc }; }
      const L = Math.max(tb.it.len, tb.it.wid), d = Math.max(L * 0.5 + dForFrac(0.3), dForFrac(0.22)); mkF("alongTable", V(tb.x, 0.85 + tb.y, tb.z), best.az, 17, d, "down the length of " + tb.name); } }
  // doorway: from the open corner at eye level, looking across the room
  { const pos = V(cells[cells.length - 1].x1 + 0.6, 1.72, cells[0].z1 + 0.6), look = ac.clone().setY(0.95), dv = pos.clone().sub(look), d = dv.length(); mkF("doorway", look, Math.atan2(dv.z, dv.x) / D2R, Math.asin(dv.y / d) / D2R, Math.max(d, dForFrac(0.3)), "from the open corner, eye level"); }
  // over the shoulder: behind a non-focus figure that looks toward the focus, far enough back that it stays under 0.33 of frame height
  { const fset = new Set(focusRec?.objs || []); let best = null; for (const f of figs) { if (fset.has(f)) continue; const p = f.position.clone().multiplyScalar(invS), dxz = Math.hypot(p.x - fc.x, p.z - fc.z); if (dxz < 2 || dxz > 9) continue; const away = Math.atan2(p.z - fc.z, p.x - fc.x) / D2R; if (!azOK(away)) continue;
      const sc = Math.abs(dxz - 4.5); if (!best || sc < best.sc) best = { sc, p, away, dxz }; }
    if (best) { const back = Math.max(dForFrac(0.32), 6.6) - 0; const camH = best.p.y + FIG_H * 1.05 + 0.4, pos = V(best.p.x + Math.cos(best.away * D2R) * back, camH, best.p.z + Math.sin(best.away * D2R) * back), look = fc.clone().setY(lookY(focusBox)), dv = pos.clone().sub(look), d = dv.length();
      framings.push({ name: "overShoulder", look, az: Math.atan2(dv.z, dv.x) / D2R, el: Math.asin(dv.y / d) / D2R, d, note: "behind a figure looking at the focus", exact: true }); } }
  // detail: the most interesting non-focus furniture (podium, bench, dais, stall...) - medium-close
  { const pri = ["podium", "judgeBench", "witnessBox", "dais", "screenWall", "stall", "spinningFrame", "assemblyLine", "gateDesk", "stage", "counter", "booth", "labBench", "machineTool", "bed", "tradingDesk", "newsDesk", "deskRow"];
    const cand = items.filter(r => r.it && !(focusRec?.objs || []).includes(r.obj) && pri.includes(r.what)).sort((a, b) => pri.indexOf(a.what) - pri.indexOf(b.what))[0];
    if (cand) { const bb = toM(bboxOf(cand.obj)), c = bb.getCenter(V()); c.y = Math.min(c.y, 1.2); mkF("detail", c, azMid - 14, 26, Math.max(dForFrac(0.32), fitD(bb.clone().expandByScalar(0.3), azMid - 14, 26, 1.1)), "medium on " + cand.name); } }
  // reveal path (2-3 stops, small az steps so coast2 speed caps hold): room -> secondary cluster -> focus
  const paths = [];
  { const s1 = mkF("reveal1", ac.clone().setY(0.9), street ? az0 + 6 : azMid - 18, street ? 30 : 38, fitD(actBox.clone().expandByScalar(0.3), azMid - 18, 38, 1.0), "reveal stop 1: the room");
    const sec = figs.length ? (() => { const fset = new Set(focusRec?.objs || []); const others = figs.filter(f => !fset.has(f)); if (!others.length) return null; const mid = others[Math.floor(others.length * 0.35)]; return mid.position.clone().multiplyScalar(invS); })() : null;
    const midLook = sec ? sec.clone().lerp(fc, 0.35).setY(1.0) : ac.clone().lerp(fc, 0.5).setY(1.0);
    const s2 = mkF("reveal2", midLook, street ? az0 + 14 : azMid - 6, street ? 26 : 30, Math.max(dForFrac(0.2), (s1.d + medD) / 2), "reveal stop 2: a detail on the way");
    const s3 = street && figBox ? mkF("reveal3", fc.clone().lerp(figBox.getCenter(V()), 0.4).setY(1.0), az0 + 24, 24, Math.max(medD * 1.5, dForFrac(0.10)), "reveal stop 3: speaker and crowd") : mkF("reveal3", fc.clone().setY(lookY(focusBox)), azMid + 6, 24, medD, "reveal stop 3: the focus");
    paths.push({ name: "reveal", stops: [s1.name, s2.name, s3.name], hopMin: street ? 5.5 : 4, note: "dolly through 3 stops; film.html drops stops / the path when a hop would be < hopMin s (room 4 s, street 5.5 s) or exceed the room/street speed caps" }); }
  // more camera moves (2-stop paths): push in from the room to the focus, descend from the high corner to eye level, slide along the table
  { const has = n => framings.some(f => f.name === n && !/unverified/.test(f.note || ""));
    if (has("wide") && has("threeQuarter")) paths.push({ name: "push", stops: ["wide", "threeQuarter"], note: "push from the dollhouse view into the focus" });
    if (has("highCorner") && has("eyeLevel")) paths.push({ name: "descend", stops: ["highCorner", "eyeLevel"], note: "crane down from the high corner to eye level" });
    if (has("alongTable") && has("threeQuarter")) paths.push({ name: "slide", stops: ["alongTable", "threeQuarter"], note: "from down the table round to the focus" });
    if (has("doorway") && has("reveal3")) paths.push({ name: "enter", stops: ["doorway", "reveal3"], note: "from the open corner into the focus" }); }
  // wide framings in big rooms: figures must stay >= 10% of frame height (else they read as specks) - pull the camera in toward the activity
  if (!street) { const pc = new THREE.PerspectiveCamera(FOV, ASP, 0.05, 500), fb = new THREE.Box3(V(cells[0].x0, 0, cells[0].z0), V(cells[cells.length - 1].x1, 0.2, cells[0].z1));
    for (const f of framings) { if (f.name !== "wide" && f.name !== "reveal1") continue; f.look = fb.getCenter(V()).setY(0.6); f.az = f.name === "wide" ? azMid + 6 : azMid - 6; f.el = f.name === "wide" ? 30 : 33;   // diagonal + lower: the room reads wide (fills the width), not tall
      for (let it = 0; it < 6; it++) { pc.position.copy(f.look).addScaledVector(dirOf(f.az, f.el), f.d); pc.lookAt(f.look); pc.updateMatrixWorld(); pc.updateProjectionMatrix(); let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
        for (let i = 0; i < 8; i++) { const q = V(i & 1 ? fb.max.x : fb.min.x, i & 2 ? (i & 4 ? 0 : main.H) : 0, i & 4 ? fb.max.z : fb.min.z).project(pc); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
        const k = Math.max((x1 - x0) / 1.74, (y1 - y0) / 2.15); f.d *= 0.35 + 0.65 * k; }   // room footprint ~86% of the frame width (and its walls inside the height)
      f.note += " (fitted: room ~87% of frame width)"; } }
  if (figs.length) for (const f of framings) { if (!["wide", "highCorner", "reveal1", "doorway"].includes(f.name)) continue; const dMax = dForFrac(street ? 0.10 : 0.14); if (f.d <= dMax) continue;
    const k = dMax / f.d; f.look = f.look.clone().lerp(figBox.getCenter(V()).setY(f.look.y), 0.35 * (1 - k)); f.d = dMax; f.note += " (tightened to keep figures readable)"; }
  for (const f of framings) { f.look = f.look.clone().multiplyScalar(S); f.d *= S; f.unit = S; f.figFrac = +figFracAt(f.d / S).toFixed(3); }

  // ---------------- light, field, info ----------------
  const room = !street, sky = L0.sky ?? (room ? 0xdcd8d0 : 0xdde2e6);
  const light = { sunAz, sunEl, sunColor: L0.sunColor ?? (room ? 0xffeed6 : 0xfff2dc), sunIntensity: L0.sun ?? (room ? 3.7 : 3.4), hemiIntensity: L0.hemi ?? (room ? 0.95 : 0.85), ao: L0.ao ?? 1.35, aoRadius: L0.aoRadius ?? (room ? 0.4 : 0.8), sky, fog: [room ? 70 : 60 * S * 4, room ? 260 : 600], tiltAmt: L0.tilt ?? (room ? 1.9 : 2.2), shadowExt: Math.max(extBox.max.x - extBox.min.x, extBox.max.z - extBox.min.z) * 0.62 * S, camMin: (room ? 4 : 10) * S };
  const field = { y: () => 0, s: () => 99 };
  const recPeople = { name: "people", what: "people", obj: figRoot, x: 0, z: 0, y: 0, h: 0, r: 0, it: { kind: "people" } }; items.push(recPeople);
  for (const r of items) if (r.it && r.it.kind !== "people") r.what = r.what;
  const update = () => {};
  let tris = 0, meshes = 0; group.traverse(m => { if (m.isMesh && m.visible) { meshes++; const gg = m.geometry; tris += (gg.index ? gg.index.count : gg.attributes.position.count) / 3; } });
  const info = { id: spec.id, scale: street ? "street" : "room", unit: S, ms: Math.round(performance.now() - t0), tris: Math.round(tris), drawCalls: meshes, items: items.length, figures: figs.length, warns, ground: street ? "street" : "interior", size: (extBox.max.x - extBox.min.x) * S, ext: (extBox.max.x - extBox.min.x) * S, camMin: light.camMin, azRange: openSides.az.slice(), eyeMin: 1.5 * S, groups: groupNames, groupsLib: GROUPS?.stage ? "groups.js" : "local" };
  let focusObj = null; if (focusRec) { if (focusRec.objs.length === 1) focusObj = focusRec.objs[0]; else { const bb = bboxOf(focusRec.objs), sz = bb.getSize(V()), cc = bb.getCenter(V()); focusObj = new THREE.Mesh(new THREE.BoxGeometry(sz.x, sz.y, sz.z)); focusObj.visible = false; focusObj.userData.noFocus = true; focusObj.position.copy(cc); group.add(focusObj); focusObj.updateMatrixWorld(true); } }   // a group focus gets an invisible box marker so film.html subjCenter frames the whole group
  const focusOut = focusRec ? { obj: focusObj, objs: focusRec.objs, name: focusRec.name ?? focusRec.rec?.name } : null;
  return { group, subjects, proxies, framings, paths, update, setFocus, light, info, field, items, focus: focusOut, figures: figs };
}
