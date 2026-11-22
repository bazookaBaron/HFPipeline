// Send episode MG: ONE persistent iso "message world" shared by 5 cards (PLAN.md MG table). Times are GLOBAL episode seconds (1.5x track).
// Contract (same as cloud): `export default function addCues(mg, ctx)`; the engine calls it after createMG and before `await mg.build()`.
// Each card builds the same world and replays the whole timeline, so the camera and all object states carry over between cards.
// World, left to right: Leo's phone -> tower -> cable under the street (cross-section) -> cable on the sea floor -> the company building
// (the cloud episode's building: floor, curb walls, rack rows) -> Maya's phone. The message is one paper slab ("msg") that travels.
import { mixHex } from '../../mg/motion.js';

export const DATA = {
  episode: 'send', ratio: '9x16', layout: 'stack', duration: 44.45, camEase: 'power2.inOut', camTravel: 0.6,
  cam0: { x: .3, y: 1.4, z: .6, zoom: 2.8 },
  cues: [
    { id: 1, name: 'PHONE TO TOWER', at: 2.6, end: 9.0,
      cam: [{ at: 3.5, d: .6, to: { x: 2.5, y: 1.9, z: 1.7, zoom: 1.9 } }],
      beats: [{ t: 2.66, word: 'First', verb: 'phone rises' }, { t: 3.56, word: 'phone tower', verb: 'tower rises' }, { t: 5.82, word: 'Radio', verb: 'radio rings from the phone' }, { t: 7.18, word: 'shouts', verb: 'message jumps to the tower head' }, { t: 8.14, word: 'listens', verb: 'tower head lit' }],
      tags: [{ t: 2.75, text: 'PHONE' }, { t: 3.6, text: 'TOWER' }, { t: 5.82, text: 'RADIO WAVES' }] },
    { id: 2, name: 'UNDER STREET AND SEA', at: 11.0, end: 16.6,
      cam: [{ at: 11.3, d: .6, to: { x: 8.0, y: 2.6, z: -.6, zoom: 1.25 } }, { at: 13.45, d: .7, to: { x: 16.5, y: 2.6, z: -1.2, zoom: 1.25 } }, { at: 15.9, d: .6, to: { x: 16.5, y: 2.2, z: 1.8, zoom: .9 } }],
      beats: [{ t: 11.38, word: 'cables', verb: 'message drops into the street cable' }, { t: 12.4, word: 'street', verb: 'tag, message runs to the coast' }, { t: 13.52, word: 'sea', verb: 'camera pans, sea-floor cable, tag' }, { t: 16.04, word: 'satellites', verb: 'dashed ghost satellite above' }],
      tags: [{ t: 12.4, text: 'UNDER THE STREET' }, { t: 13.52, text: 'UNDER THE SEA' }, { t: 16.04, text: 'SATELLITE?' }] },
    { id: 3, name: 'BETWEEN CONTINENTS', at: 16.6, end: 24.1,
      cam: [{ at: 17.2, d: .7, to: { x: 17.0, y: 2.4, z: -.6, zoom: .62 } }, { at: 21.8, d: .6, to: { x: 17.0, y: 3.0, z: -1.75, zoom: 1.7 } }],
      beats: [{ t: 17.16, word: 'Mostly cables', verb: 'ghost satellite fades, pull back over both coasts' }, { t: 18.2, word: '99', verb: 'tag 99 %' }, { t: 21.98, word: 'light', verb: 'push in on the sea cable, light pulses run along it' }],
      tags: [{ t: 18.2, text: '99 % BETWEEN CONTINENTS' }, { t: 22.0, text: 'LIGHT IN GLASS' }] },
    { id: 4, name: 'COMPANY COMPUTERS', at: 25.6, end: 30.2,
      cam: [{ at: 25.6, d: .6, to: { x: 27.6, y: 2.4, z: .9, zoom: 1.05 } }, { at: 28.7, d: .6, to: { x: 32.0, y: 1.9, z: .9, zoom: 1.05 } }],
      beats: [{ t: 26.14, word: 'computers', verb: 'rack rows rise, message lands on a rack' }, { t: 27.48, word: 'photos', verb: 'tag (nod to the cloud episode)' }, { t: 28.76, word: "Maya's phone", verb: 'pan, Maya phone rises' }, { t: 29.24, word: 'pass', verb: 'message flies to her phone, check' }],
      tags: [{ t: 26.14, text: 'COMPANY COMPUTERS' }, { t: 27.48, text: 'SAME AS YOUR PHOTOS' }, { t: 28.76, text: "MAYA'S PHONE" }] },
    { id: 5, name: 'HOW LONG', at: 31.9, end: 37.4,
      cam: [{ at: 31.9, d: .7, to: { x: 17.2, y: 1.6, z: .2, zoom: .6 } }],
      beats: [{ t: 32.64, word: 'hand to hand', verb: 'every hop lights in turn' }, { t: 35.6, word: 'minute', verb: 'tag 1 MINUTE? (dashed)' }, { t: 36.2, word: 'Less', verb: 'message zips phone to phone, timer 0.0 -> 0.2 S, check' }],
      tags: [{ t: 35.6, text: '1 MINUTE?' }, { t: 36.2, text: '0.2 S' }, { t: 36.8, text: 'UNDER A SECOND' }] },
  ],
};

// subjects that must sit inside the card at a time (checked by mg/render.mjs ep send)
export const CHECKS = [
  { cue: 1, t: 3.0, ids: ['pA'] }, { cue: 1, t: 4.4, ids: ['pA', 'tw', 'twH'] }, { cue: 1, t: 7.6, ids: ['pA', 'twH', 'msg'] },
  { cue: 2, t: 12.2, ids: ['c0', 'msg'] }, { cue: 2, t: 14.6, ids: ['c2', 'msg'] }, { cue: 2, t: 16.4, ids: ['sat', 'msg'] },
  { cue: 3, t: 19.0, ids: ['c2', 'msg'] }, { cue: 3, t: 23.0, ids: ['msg'] },
  { cue: 4, t: 27.0, ids: ['rf2', 'msg'] }, { cue: 4, t: 29.9, ids: ['pB', 'msg'] },
  { cue: 5, t: 33.2, ids: ['pA', 'twH', 'rb2', 'pB'] }, { cue: 5, t: 37.2, ids: ['pA', 'pB', 'msg'] },
];

export default function addCues(mg, ctx = {}) {
  const C = mg.C, D = DATA;
  const COL = { ground: mixHex(C.ink, C.muted, .22), cut: mixHex(C.ink, C.muted, .3), floor: mixHex(C.ink, C.muted, .38), wall: C.muted, rack: mixHex(C.muted, C.ink, .12),
    sea: mixHex(C.ink, C.accent2, .32), seabed: mixHex(C.ink, C.muted, .15), phone: mixHex(C.ink, C.muted, .55), cable: C.accent2, msg: C.paper, mast: C.muted, head: mixHex(C.muted, C.paper, .3) };
  const BX = 24.2, BR = [['rb1', BX + .9, 1.0], ['rb2', BX + 3.5, 1.0], ['rb3', BX + 6.1, 1.0], ['rf1', BX + .9, 3.0], ['rf2', BX + 3.5, 3.0], ['rf3', BX + 6.1, 3.0]];
  const RK = { w: 1.4, d: 1.0, h: 1.7 };
  // message waypoints (min corner of the 0.5 x 0.35 x 0.3 slab)
  const P = { phoneA: [-.02, 1.0, 1.15], head: [4.4, 2.3, 3.85], foot: [4.55, 3.2, -.62], coast: [11.7, 3.2, -.62], floorA: [11.7, 3.2, -1.78], floorB: [21.9, 3.2, -1.78],
    landB: [21.9, 3.2, -.62], rack: [BX + 3.95, 3.3, 1.95], phoneB: [34.48, 1.0, 1.15] };
  const ROUTE = ['phoneA', 'head', 'foot', 'coast', 'floorA', 'floorB', 'landB', 'rack', 'phoneB'];

  function world(b, cue) {
    const w = b.iso({ t0: cue.at, cam: D.cam0, S: 44 });
    // land A (cross-section: front face at y = 3), sea (seabed + water), land B
    w.box('gA', { x: -3, y: -3, z: -2.2, w: 15, d: 6, h: 2.2, color: COL.ground });
    w.box('sf', { x: 12, y: -3, z: -2.2, w: 10, d: 6, h: .3, color: COL.seabed });
    w.box('sea', { x: 12, y: -3, z: -1.9, w: 10, d: 5.95, h: 1.65, color: COL.sea });
    w.box('gB', { x: 22, y: -3, z: -2.2, w: 15, d: 6, h: 2.2, color: COL.ground });
    // Leo's phone + screen, tower + head
    w.box('pA', { x: 0, y: 1.2, z: 0, w: .5, d: .26, h: 1.0, color: COL.phone }); w.box('sA', { x: .07, y: 1.46, z: .12, w: .36, d: .03, h: .76, color: C.accent2 });
    w.box('tw', { x: 4.6, y: 2.4, z: 0, w: .32, d: .32, h: 3.4, color: COL.mast }); w.box('twH', { x: 4.36, y: 2.16, z: 3.4, w: .8, d: .8, h: .32, color: COL.head });
    // cables on the cross-section faces (in front of y = 3): tower foot down, street run, coast drop, sea floor, coast rise, run into the building
    w.box('c0', { x: 4.7, y: 3.0, z: -.5, w: .12, d: .12, h: .5, color: COL.cable });
    w.box('c1', { x: 4.7, y: 3.0, z: -.5, w: 7.3, d: .12, h: .12, color: COL.cable });
    w.box('c1b', { x: 11.9, y: 3.0, z: -1.85, w: .12, d: .12, h: 1.47, color: COL.cable });
    w.box('c2', { x: 11.9, y: 3.0, z: -1.85, w: 10.2, d: .12, h: .12, color: COL.cable });
    w.box('c2b', { x: 22.0, y: 3.0, z: -1.85, w: .12, d: .12, h: 1.47, color: COL.cable });
    w.box('c3', { x: 22.0, y: 3.0, z: -.5, w: 2.4, d: .12, h: .12, color: COL.cable });
    // ghost satellite (only ever dashed: "not how it goes")
    w.box('sat', { x: 15.6, y: .2, z: 5.6, w: 1.0, d: .7, h: .5, color: COL.head, ghostColor: C.paper }); w.box('satP', { x: 14.2, y: .3, z: 5.75, w: 3.8, d: .5, h: .06, color: COL.head, ghostColor: C.paper });
    // the company building (cloud episode): floor, low curb walls, rack rows with fans
    w.box('fl', { x: BX, y: 0, z: 0, w: 8, d: 5, h: .2, color: COL.floor });
    w.box('wb', { x: BX, y: 0, z: .2, w: 8, d: .25, h: .3, color: COL.wall }); w.box('wl', { x: BX, y: .25, z: .2, w: .25, d: 4.5, h: .3, color: COL.wall });
    w.box('wf', { x: BX, y: 4.75, z: .2, w: 8, d: .25, h: .3, color: COL.wall }); w.box('wr', { x: BX + 7.75, y: .25, z: .2, w: .25, d: 4.5, h: .3, color: COL.wall });
    for (const [id, x, y] of BR) w.box(id, { x, y, z: .2, ...RK, color: COL.rack });
    for (const [id] of BR) w.disc('fan_' + id, { on: id, r: .36, color: C.accent2, spinAt: 26.2 });
    // Maya's phone + screen
    w.box('pB', { x: 34.5, y: 1.2, z: 0, w: .5, d: .26, h: 1.0, color: COL.phone }); w.box('sB', { x: 34.57, y: 1.46, z: .12, w: .36, d: .03, h: .76, color: C.accent2 });
    // the message
    w.box('msg', { x: 0, y: 0, z: 0, w: .5, d: .35, h: .3, color: COL.msg });

    // ---- camera (global, shared by every card) ----
    for (const c of D.cues) for (const k of c.cam) w.camTo(k.at, k.to, { d: k.d });
    // ---- state timeline (global, shared) ----
    const moveTo = (at, dur, p, ez = 'p2io') => { w.set('msg', 'dx', at, dur, P[p][0], { ez }); w.set('msg', 'dy', at, dur, P[p][1], { ez }); w.set('msg', 'dz', at, dur, P[p][2], { ez }); };
    const jump = (at, p) => { w.set('msg', 'dx', at, .01, P[p][0], { ez: 'linear' }); w.set('msg', 'dy', at, .01, P[p][1], { ez: 'linear' }); w.set('msg', 'dz', at, .01, P[p][2], { ez: 'linear' }); };
    w.set('msg', 'dx', 0, .01, P.phoneA[0], { from: P.phoneA[0] }); w.set('msg', 'dy', 0, .01, P.phoneA[1], { from: P.phoneA[1] }); w.set('msg', 'dz', 0, .01, P.phoneA[2], { from: P.phoneA[2] });
    w.set('msg', 'solid', 0, .01, 0, { from: 0, ez: 'linear' });
    // cue 1: phone, tower, radio, message jumps to the tower head
    ['pA', 'sA'].forEach((id, i) => w.rise(id, 2.66 + i * .12, .5)); w.set('msg', 'solid', 3.1, .3, 1, { ez: 'linear' });
    ['tw', 'twH'].forEach((id, i) => w.rise(id, 3.56 + i * .3, .55));
    moveTo(7.18, .55, 'head'); w.tint('twH', 8.14, C.accent2, .3);
    // cue 2: down into the street cable, along to the coast, down to the sea floor
    w.set('c0', 'solid', 11.2, .3, 1, { from: 0, ez: 'linear' }); w.set('c1', 'solid', 11.4, .4, 1, { from: 0, ez: 'linear' });
    moveTo(11.38, .5, 'foot'); moveTo(12.4, 1.0, 'coast');
    w.set('c1b', 'solid', 13.2, .3, 1, { from: 0, ez: 'linear' }); w.set('c2', 'solid', 13.5, .4, 1, { from: 0, ez: 'linear' }); w.set('c2b', 'solid', 13.7, .3, 1, { from: 0, ez: 'linear' });
    moveTo(13.45, .45, 'floorA'); moveTo(14.0, 2.4, 'floorB', 'linear');
    for (const id of ['sat', 'satP']) { w.set(id, 'solid', 0, .01, 0, { from: 0, ez: 'linear' }); w.ghost(id, 16.04, .3, { until: 17.3, fade: .4 }); }
    // cue 3: across to land B (the message sits on the far coast while the camera pulls back), then the light pulses
    moveTo(18.4, .5, 'landB');
    // cue 4: building rises, message onto a rack, Maya's phone rises, message flies to it
    w.set('c3', 'solid', 25.7, .3, 1, { from: 0, ez: 'linear' });
    ['fl', 'wb', 'wl', 'wf', 'wr'].forEach((id, i) => w.rise(id, 25.7 + i * .06, .45)); BR.forEach(([id], i) => w.rise(id, 26.14 + i * .08, .45)); BR.forEach(([id], i) => w.rise('fan_' + id, 26.6 + i * .05, .3));
    moveTo(26.3, .6, 'rack'); w.tint('rf2', 28.1, C.accent2, .3);
    ['pB', 'sB'].forEach((id, i) => w.rise(id, 28.76 + i * .12, .45)); moveTo(29.24, .6, 'phoneB');
    // cue 5: the whole route in one go, phone to phone (0.9 s on screen; the timer shows the real figure)
    w.set('msg', 'solid', 36.05, .08, 0, { ez: 'linear' }); jump(36.14, 'phoneA'); w.set('msg', 'solid', 36.16, .06, 1, { ez: 'linear' });
    const legs = ROUTE.slice(1), step = .9 / legs.length; legs.forEach((p, i) => moveTo(36.2 + i * step, step, p, 'linear'));

    // ---- per-card overlays ----
    if (cue.id === 1) {
      w.tag('pA', 'PHONE', { at: 2.75, until: 5.6, dy: -60 }); w.tag('twH', 'TOWER', { at: 3.6, dx: 110, dy: -60 });
      w.ring([.25, 1.33, 1.0], { at: 5.82, until: 8.6, r: 2.6, n: 3, period: 1.0, color: 'accent2' });
      w.tag([1.4, 1.4, 1.6], 'RADIO WAVES', { at: 5.82, dy: 120, color: 'accent2' });
    }
    if (cue.id === 2) {
      w.tag([8.3, 3.06, -.45], 'UNDER THE STREET', { at: 12.4, until: 13.45, dy: 90 });
      w.tag([16.9, 3.06, -1.8], 'UNDER THE SEA', { at: 13.52, dy: 70, color: 'accent2' });
      w.tag('sat', 'SATELLITE?', { at: 16.04, dy: -50 });
    }
    if (cue.id === 3) {
      w.tag([17.0, 3.06, -1.8], '99 % BETWEEN CONTINENTS', { at: 18.2, until: 21.7, dy: 110, color: 'accent' });
      for (let i = 0; i < 3; i++) w.flow([12.2 + i * 3.1, 3.06, -1.79], [14.8 + i * 3.1, 3.06, -1.79], { at: 21.98 + i * .08, color: 'paper' });
      w.tag([17.0, 3.06, -1.8], 'LIGHT IN GLASS', { at: 22.0, dy: 80, color: 'accent2' });
    }
    if (cue.id === 4) {
      w.tag('rb2', 'COMPANY COMPUTERS', { at: 26.14, until: 28.6, dy: -110 });
      w.tag('rf2', 'SAME AS YOUR PHOTOS', { at: 27.48, until: 28.6, dy: 100, color: 'accent' });
      w.tag('pB', "MAYA'S PHONE", { at: 28.76, dy: -80 }); w.check('pB', { at: 29.9, dy: -150 });
    }
    if (cue.id === 5) {
      // hand to hand: each hop lights in turn (rings at both phones and the tower head)
      w.ring([.25, 1.33, 1.0], { at: 32.64, until: 34.2, r: 1.8, n: 2, period: .8, color: 'accent2' });
      w.ring([4.76, 2.56, 3.72], { at: 32.9, until: 34.2, r: 1.8, n: 2, period: .8, color: 'accent2' });
      w.flow([4.76, 3.06, -.44], [11.9, 3.06, -.44], { at: 33.05, until: 34.2, color: 'paper' }); w.flow([11.9, 3.06, -1.79], [22.0, 3.06, -1.79], { at: 33.2, until: 34.2, color: 'paper' });
      w.ring([34.75, 1.33, 1.0], { at: 33.66, until: 34.4, r: 1.8, n: 2, period: .8, color: 'accent2' });
      w.tag([17.0, 1.6, 2.4], '1 MINUTE?', { at: 35.6, until: 36.15, dy: -40, color: 'muted' });
      w.tag([17.0, 1.6, 2.4], t => `<b style="font-weight:500;color:${t >= 37.1 ? C.accent : C.paper}">${Math.min(.2, Math.max(0, (t - 36.2) / .9 * .2)).toFixed(1)} S</b>`, { at: 36.2, dy: -40, words: '0.2 S' });
      w.tag('pB', 'UNDER A SECOND', { at: 36.8, dy: -110, dx: -90, color: 'accent' }); w.check('pB', { at: 37.1, dy: -46 });
    }
    return w;
  }

  mg.iso = { worlds: [], DATA, CHECKS };
  for (const cue of D.cues) {
    mg.beat({ at: cue.at, dur: +(cue.end - cue.at).toFixed(3), layout: 'stack', tag: cue.name }, b => { mg.iso.worlds.push({ cue: cue.id, at: cue.at, w: world(b, cue), W: b.W, H: b.H }); });
  }
}
