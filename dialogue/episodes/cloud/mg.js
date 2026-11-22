// Cloud episode MG: ONE persistent iso "cloud world" shared by 5 cards (PLAN.md MG table). Times are GLOBAL episode seconds.
// Contract: `export default function addCues(mg, ctx)`; the engine calls addCues(mg, {ratio:'9x16'}) after createMG and before `await mg.build()`.
// Each card builds the same world and replays the whole timeline, so the camera and all object states carry over between cards
// (roof lifted in card 2 stays lifted in card 5; the camera starts where the previous card left it and travels to the new spot).
// The cue data below is mirrored to mg.json by `render.mjs cloud` (this file is the source).
import { mixHex } from '../../mg/motion.js';

export const DATA = {
  episode: 'cloud', ratio: '9x16', layout: 'stack', camEase: 'power2.inOut', camTravel: 0.7,
  cam0: { x: 4, y: 2.5, z: 4.6, zoom: 1.45 },
  cues: [
    { id: 1, name: 'THE CLOUD', at: 5.81, end: 8.81, cam: [{ at: 6.82, d: .7, to: { x: 4, y: 2.5, z: 2.2, zoom: .95 } }],
      beats: [{ t: 6.10, word: 'cloud', verb: 'cloud rises, tag CLOUD' }, { t: 6.82, word: 'building', verb: 'cloud -> dashed ghost, building rises, camera pulls back' }],
      tags: [{ t: 6.10, text: 'CLOUD' }, { t: 7.15, text: '= A BUILDING OF COMPUTERS' }] },
    { id: 2, name: 'DATA CENTRE', at: 10.0, end: 13.39, cam: [{ at: 10.0, d: .7, to: { x: 4, y: 2.6, z: 1.0, zoom: 1.3 } }],
      beats: [{ t: 10.04, word: 'huge room', verb: 'roof lifts' }, { t: 10.7, word: 'computers', verb: 'rack rows rise' }, { t: 12.0, word: 'fans', verb: 'fan discs spin + airflow lines, tag COOLING FANS' }],
      tags: [{ t: 12.0, text: 'COOLING FANS' }] },
    { id: 5, name: 'WHO OWNS IT', at: 14.4, end: 18.4, cam: [{ at: 14.4, d: .7, to: { x: 4, y: 2.6, z: 1.0, zoom: .95 } }, { at: 17.0, d: .6, to: { x: 4.2, y: 3.5, z: 1.0, zoom: 1.9 } }],
      beats: [{ t: 15.38, word: 'Google', verb: 'tag' }, { t: 15.94, word: 'Apple', verb: 'tag' }, { t: 16.46, word: 'Amazon', verb: 'tag' }, { t: 17.86, word: 'little space', verb: 'one slot lit accent, tag YOUR SPACE' }],
      tags: [{ t: 15.38, text: 'GOOGLE' }, { t: 15.94, text: 'APPLE' }, { t: 16.46, text: 'AMAZON' }, { t: 17.86, text: 'YOUR SPACE' }] },
    { id: 3, name: 'SPARE COPIES', at: 21.76, end: 26.2, cam: [{ at: 21.76, d: .7, to: { x: 13.8, y: 3.2, z: 1.0, zoom: 1.2 } }],
      beats: [{ t: 22.0, word: 'photo', verb: 'photo tile appears' }, { t: 22.3, word: 'spare copies', verb: 'copies fly onto racks 1-3' }, { t: 24.06, word: 'breaks', verb: 'rack 1 ember, OFFLINE' }, { t: 25.44, word: 'safe', verb: 'checks on racks 2-3' }],
      tags: [{ t: 22.05, text: 'PHOTO' }, { t: 23.0, text: 'COPY 1' }, { t: 23.25, text: 'COPY 2' }, { t: 23.5, text: 'COPY 3' }, { t: 24.06, text: 'OFFLINE' }] },
    { id: 4, name: 'SELFIES', at: 39.56, end: 42.6, cam: [{ at: 39.56, d: .7, to: { x: 21.2, y: 1.5, z: 1.7, zoom: 1.7 } }],
      beats: [{ t: 39.7, word: 'selfies', verb: 'slab stack drops on, counter 0 -> 40' }, { t: 40.68, word: '41', verb: 'one more slab drops, counter 41 accent' }],
      tags: [{ t: 39.8, text: '40 PHOTOS' }] },
  ],
};

// subjects that must sit inside the card at a time (checked by render.mjs)
export const CHECKS = [
  { cue: 1, t: 6.6, ids: ['cl1', 'cl3', 'cl4', 'cl5'] }, { cue: 1, t: 8.0, ids: ['cl1', 'fl', 'roof'] },
  { cue: 2, t: 11.4, ids: ['fl', 'wb', 'rb1', 'rb3', 'rf3'] }, { cue: 2, t: 12.8, ids: ['rb1', 'rb3', 'rf1', 'rf3'] },
  { cue: 5, t: 15.7, ids: ['fl', 'rb1', 'rb3'] }, { cue: 5, t: 17.7, ids: ['rf2'] }, { cue: 5, t: 18.2, ids: ['rf2', 'slot'] },
  { cue: 3, t: 22.9, ids: ['t0', 'R1', 'R2', 'R3'] }, { cue: 3, t: 24.6, ids: ['R1', 'R2', 'R3'] }, { cue: 3, t: 25.9, ids: ['R1', 'R2', 'R3'] },
  { cue: 4, t: 40.2, ids: ['ped', 's8'] }, { cue: 4, t: 41.6, ids: ['ped', 's9'] },
];

export default function addCues(mg, ctx = {}) {
  const C = mg.C, D = DATA;
  const COL = { ground: mixHex(C.ink, C.muted, .22), floor: mixHex(C.ink, C.muted, .38), wall: C.muted, roof: mixHex(C.muted, C.paper, .3), rack: mixHex(C.muted, C.ink, .12), cloud: C.paper, tile: C.paper, slab: C.paper };
  const cloud = [['cl1', 1.5, 1, 4, 5, 3, .8], ['cl3', -.2, 1.7, 4, 1.7, 1.6, .6], ['cl4', 6.5, 1.6, 4, 1.7, 1.8, .6], ['cl2', 2.5, 1.5, 4.8, 3, 2, .8], ['cl5', 3.2, 1.9, 5.6, 1.6, 1.2, .5]];
  const BR = [['rb1', .9, 1.0], ['rb2', 3.5, 1.0], ['rb3', 6.1, 1.0], ['rf1', .9, 3.0], ['rf2', 3.5, 3.0], ['rf3', 6.1, 3.0]];   // rack rows inside the building
  const SR = [['R1', 11.2, 3.6], ['R2', 14.2, 2.1], ['R3', 17.2, .6]];                                                              // three standalone racks
  const RK = { w: 1.4, d: 1.0, h: 1.7 }, TOPZ = .2 + RK.h;

  function world(b, cue) {
    const w = b.iso({ t0: cue.at, cam: D.cam0, S: 44 });
    w.box('ground', { x: -4, y: -4, z: -.3, w: 33, d: 14, h: .3, color: COL.ground });
    // building: floor, 4 walls, roof
    w.box('fl', { x: 0, y: 0, z: 0, w: 8, d: 5, h: .2, color: COL.floor });
    w.box('wb', { x: 0, y: 0, z: .2, w: 8, d: .25, h: 2.2, color: COL.wall }); w.box('wl', { x: 0, y: .25, z: .2, w: .25, d: 4.5, h: 2.2, color: COL.wall });
    w.box('wf', { x: 0, y: 4.75, z: .2, w: 8, d: .25, h: 2.2, color: COL.wall }); w.box('wr', { x: 7.75, y: .25, z: .2, w: .25, d: 4.5, h: 2.2, color: COL.wall });
    w.box('roof', { x: 0, y: 0, z: 2.4, w: 8, d: 5, h: .25, color: COL.roof });
    for (const [id, x, y] of BR) w.box(id, { x, y, z: .2, ...RK, color: COL.rack });
    for (const [id] of BR) w.disc('fan_' + id, { on: id, r: .36, color: C.accent2, spinAt: 12.0 });
    w.box('slot', { x: 3.7, y: 4.0, z: .7, w: 1.0, d: .04, h: .3, color: C.accent });   // sits on the +y face of rf2
    for (const [id, x, y] of SR) w.box(id, { x, y, z: 0, ...RK, color: COL.rack });
    w.box('t0', { x: 9.2, y: 5.1, z: 0, w: 1.2, d: 1.2, h: .12, color: COL.tile });
    SR.forEach(([id, x, y], i) => w.box('cp' + (i + 1), { x: x + .25, y: y + .05, z: 1.7, w: .9, d: .9, h: .1, color: C.accent2 }));
    w.box('ped', { x: 20.6, y: .9, z: 0, w: 1.5, d: 1.1, h: 1.0, color: COL.rack });
    for (let i = 1; i <= 9; i++) w.box('s' + i, { x: 20.7, y: 1.0, z: 1.0 + (i - 1) * .17, w: 1.3, d: .9, h: .16, color: i === 9 ? C.accent : (i % 2 ? C.paper : mixHex(C.paper, C.accent2, .35)) });
    for (const [id, x, y, z, ww, dd, h] of cloud) w.box(id, { x, y, z, w: ww, d: dd, h, color: COL.cloud, ghostColor: C.paper });

    // ---- camera (global, shared by every card) ----
    for (const c of D.cues) for (const k of c.cam) w.camTo(k.at, k.to, { d: k.d });
    // ---- state timeline (global, shared) ----
    cloud.forEach(([id], i) => w.rise(id, 5.9 + i * .08, .5));                                                        // cue 1: cloud appears
    cloud.forEach(([id], i) => { w.fade(id, 6.82 + i * .03, .3); w.ghost(id, 6.82 + i * .03, .3, { until: 8.4, fade: .4 }); });   // "building": cloud -> dashed ghost
    ['fl', 'wb', 'wl', 'wf', 'wr'].forEach((id, i) => w.rise(id, 6.9 + i * .1, .55)); w.drop('roof', 7.4, .5, 1.6);     // building rises under it, roof settles
    ['wb', 'wl', 'wf', 'wr'].forEach(id => w.set(id, 'grow', 10.04, .6, .12, { ez: 'p2io' })); w.lift('roof', 10.04, .7, 2.6);   // cue 2: roof lifts, walls drop to a curb
    BR.forEach(([id], i) => w.rise(id, 10.7 + i * .1, .5));                                                           // rack rows rise (stagger)
    BR.forEach(([id], i) => { w.rise('fan_' + id, 12.0 + i * .05, .4); });                              // "fans": discs on, spinning
    w.set('slot', 'solid', 17.86, .3, 1, { from: 0, ez: 'linear' });                                                  // cue 5: one slot lit accent
    w.set('t0', 'solid', 21.9, .3, 1, { from: 0, ez: 'linear' });                                                     // cue 3: photo tile
    SR.forEach(([id, x, y], i) => {
      const a = 22.3 + i * .25, ox = 9.2 + .15 - (x + .25), oy = 5.1 + .15 - (y + .05);
      w.set('cp' + (i + 1), 'solid', a, .1, 1, { from: 0, ez: 'linear' }); w.set('cp' + (i + 1), 'dx', a, .7, 0, { from: ox, ez: 'p2io' }); w.set('cp' + (i + 1), 'dy', a, .7, 0, { from: oy, ez: 'p2io' });
      w.set('cp' + (i + 1), 'dz', a, .35, 1.0, { from: -1.58, ez: 'p2io' }); w.set('cp' + (i + 1), 'dz', a + .35, .35, 0, { ez: 'p3out' });
    });
    w.tint('R1', 24.06);                                                                                   // rack 1 breaks -> ember (default tint colour)
    for (let i = 1; i <= 8; i++) { w.drop('s' + i, 39.7 + (i - 1) * .05, .4, 1.4); } w.drop('s9', 40.68, .45, 1.8);       // cue 4: slabs drop on, #41 drops

    // ---- per-card overlays (tags / flow / checks live only in their own card so each card stays <= 12 words) ----
    if (cue.id === 1) {
      w.tag('cl2', 'CLOUD', { at: 6.10, until: 6.82, dy: -80 });
      w.tag([4, 5, 0], '= A BUILDING OF COMPUTERS', { at: 7.15, dy: 96, color: 'accent' });
    }
    if (cue.id === 2) {
      w.tag('rb2', 'COOLING FANS', { at: 12.0, dy: -120, color: 'accent2' });
      BR.forEach(([id], i) => { const g = rackTop(id); w.flow([g[0], g[1], TOPZ + .05], [g[0], g[1], TOPZ + 1.9], { at: 12.0 + i * .06, color: 'accent2' }); });
    }
    if (cue.id === 5) {
      w.tag('rb1', 'GOOGLE', { at: 15.38, until: 17.0, dx: -120, dy: -90 }); w.tag('rb2', 'APPLE', { at: 15.94, until: 17.0, dx: 0, dy: -160 }); w.tag('rb3', 'AMAZON', { at: 16.46, until: 17.0, dx: 120, dy: -90 });
      w.tag('slot', 'YOUR SPACE', { at: 17.86, dy: 90, color: 'accent' });
    }
    if (cue.id === 3) {
      w.tag('t0', 'PHOTO', { at: 22.05, dy: -70 });
      SR.forEach(([id], i) => w.tag(id, 'COPY ' + (i + 1), { at: 23.0 + i * .25, until: i === 0 ? 24.06 : undefined, dy: -110 }));
      w.tag('R1', 'OFFLINE', { at: 24.06, dy: -110, color: '#D65F2A' });
      w.check('R2', { at: 25.44, dy: -34 }); w.check('R3', { at: 25.44, dy: -34 });
    }
    if (cue.id === 4) w.counter('s8', 0, 40, { at: 39.56, dur: .35, label: 'PHOTOS', switchAt: 40.68, to2: 41, dy: -95 });
    return w;
  }
  const rackTop = id => { const r = [...BR].find(q => q[0] === id); return [r[1] + RK.w / 2, r[2] + RK.d / 2]; };

  mg.iso = { worlds: [], DATA, CHECKS };
  for (const cue of D.cues) {
    mg.beat({ at: cue.at, dur: +(cue.end - cue.at).toFixed(3), layout: 'stack', tag: cue.name }, b => { mg.iso.worlds.push({ cue: cue.id, at: cue.at, w: world(b, cue), W: b.W, H: b.H }); });
  }
}
