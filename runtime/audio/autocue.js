/* Doc2D auto sound cues (runtime/audio/README.md "Auto cues").
   Load AFTER doc-kit / cast / crowd / vehicles and BEFORE the composition src. It wraps the generator APIs from the outside,
   so cast verbs, crowd modes and vehicles push action SFX onto window.__sfx without any call in the scene code.
   DOC.finish() then coalesces them: overlapping footsteps merge into one multi-walker cue, same-kind cues closer than
   1.2 s merge, and the whole auto layer is capped at ~1 cue / 1.5 s on average so the bed stays documentary-sparse.
   Opt out per page: window.AUTOCUE = false (before this file), or DOC.autocue(false) in src. */
(function (root) {
  "use strict";
  if (root.AUTOCUE === false || !root.DOC) return;
  const DOC = root.DOC, OUT = [];
  let on = true;
  DOC.autocue = (v) => { on = v !== false; };
  DOC.surface = DOC.surface || null;                       // force a footstep surface for the page: DOC.surface = "wood"
  const r3 = (x) => +(+x).toFixed(3);
  const emit = (t, kind, o) => { if (on && isFinite(t) && t >= 0) OUT.push(Object.assign({ t: r3(t), kind, auto: 1 }, o || {})); };

  /* footstep surface: explicit > the ambience region playing at t > concrete */
  const SURF = { port: "concrete", factory: "concrete", city: "concrete", street: "concrete", market: "concrete", crowd: "concrete",
    office: "carpet", trading: "carpet", room: "wood", server: "tile", sea: "metal", wind: "gravel", night: "grass", rain: "concrete" };
  const surfaceAt = (t) => {
    if (DOC.surface) return DOC.surface;
    const q = (root.__sfx || []).filter((c) => c.amb && c.t0 <= t && t < c.t1).pop();
    return (q && SURF[q.amb]) || "concrete";
  };

  // ---------------------------------------------------------------- cast
  const VERB = {
    signDocument: ["pencil", { dur: 1.0 }], takeNotes: ["pencil", { dur: 1.4 }], slidePaper: ["paper"], handOver: ["paper", { gain: -3 }],
    type: ["type", { dur: 1.6 }], hoistFlag: ["rope", { dur: 2.0 }], lockGate: ["chain", { dur: 0.8 }], openGate: ["chain", { dur: 0.8 }],
    phoneCall: ["ui_tick", { gain: -4 }], sitDown: ["paper", { gain: -8 }],
  };
  const ACT = { applaud: ["applause", { size: "small" }], type: ["type"], write: ["pencil"], cheer: ["cheer", { size: "small" }], flagWave: ["flag"] };
  function wrapActor(A) {
    if (!A || A.__ac) return; A.__ac = 1;
    const GAIT = (root.CAST && root.CAST.GAIT) || {};
    const walk = A.walk;
    A.walk = function (t, where, o) {
      const t1 = walk.apply(this, arguments), g = (o && typeof o === "object" && o.gait) || "walk";
      const w = this.window, a = Math.max(t, w ? w[0] : 0), b = Math.min(t1, w ? w[1] : t1);
      if (b - a > 0.6) emit(a + 0.25, "steps", { dur: r3(b - a - 0.4), rate: r3(1 / ((GAIT[g] && GAIT[g].stepT) || 0.5)), surface: surfaceAt(a), people: 1 });
      return t1;
    };
    if (A.run && A.run !== walk) { const run = A.run; A.run = function () { return run.apply(this, arguments); }; }  // run -> walk(gait run): caught above
    if (A.verb) {
      const verb = A.verb;
      A.verb = function (t, name, o) { const r = verb.apply(this, arguments), m = VERB[name]; if (m) emit(t, m[0], Object.assign({}, m[1])); return r; };
    }
    if (A.do) {
      const act = A.do;
      A.do = function (t, what, dur) { const r = act.apply(this, arguments), m = ACT[what]; if (m) emit(t + 0.2, m[0], Object.assign({ dur: Math.max(0.8, (dur || 2) - 0.4) }, m[1])); return r; };
    }
  }
  if (root.CAST && root.CAST.add) {
    const add = root.CAST.add;
    root.CAST.add = function () { const a = add.apply(this, arguments); if (a) wrapActor(Object.getPrototypeOf(a)); return a; };
  }

  // ---------------------------------------------------------------- crowds
  const C = root.CROWD;
  const cue = (v, o) => { try { return typeof v === "number" ? v : C.cue(v, o); } catch (e) { return NaN; } };
  const win = (o) => { const s = o.s || o.shot; return [o.t0 != null ? cue(o.t0, o) : s ? s.t0 : 0, o.t1 != null ? cue(o.t1, o) : s ? s.t1 : NaN]; };
  const size = (o) => { const n = o.n || o.count || (o.rows && o.cols ? o.rows * o.cols : 0) || 40; return n > 120 ? "large" : n > 25 ? "medium" : "small"; };
  const BEAT = { applause: "applause", ovation: "applause", cheer: "cheer", protest: "chant", raise: "murmur" };
  function crowdCues(name, o) {
    const [t0, t1] = win(o), sz = size(o);
    (o.beats || []).forEach((b) => { const t = cue(b[0], o), k = BEAT[b[1]]; if (k) emit(t, k, { dur: 2.6, size: sz }); });
    (o.chants || []).forEach((c) => emit(cue(c, o), "chant", { dur: o.chantDur || 2.4, size: sz }));
    if (/march|stream|queue|board|disperse|picket/.test(name) && isFinite(t1) && t1 - t0 > 1)
      emit(t0 + 0.3, "steps", { dur: r3(Math.min(t1 - t0 - 0.5, 8)), rate: name === "march" ? 2 : 1.8, surface: surfaceAt(t0), people: sz === "small" ? 4 : 10 });
    if (/rally|assembly|crowd/.test(name) && !(o.beats || []).length && isFinite(t1)) emit(t0 + 0.5, "murmur", { dur: Math.min(3, t1 - t0), size: sz, gain: -6 });
  }
  if (C) for (const k of ["march", "rally", "picket", "sitin", "queue", "assembly", "boardTrain", "boardBus", "board", "disperse", "crowd", "seated", "stream", "world"]) {
    const f = C[k]; if (typeof f !== "function") continue;
    C[k] = function (st, o) { const r = f.apply(this, arguments); try { if (o && typeof o === "object") crowdCues(k === "world" ? o.mode || "crowd" : k, o); } catch (e) {} return r; };
  }

  // ---------------------------------------------------------------- vehicles
  const V = root.VEH;
  const VK = { car: "car", van: "car", bus: "bus", truck: "truck", tanker: "truck", tram: "train", train: "train", heli: "heli", plane: "plane",
    cargojet: "plane", ship: "ship", forklift: "forklift" };
  function vehCues(h, o) {
    let veh = VK[o.kind || "car"] || "car";
    if (o.gen) { try { const c = V.genMeta(o.gen).cls; veh = { rail: "train", air: "plane", sea: "ship" }[c] || (/(truck|bus)/.test(o.gen.family || "") ? "truck" : "car"); } catch (e) {} }
    const [t0, t1] = win(o); if (!isFinite(t1)) return;
    /* motion from the drive options only: sampling h.at() can force a world render per call (too slow at mount) */
    const ks = o.keys || [], u0 = ks.length ? ks[0][1] : null, u1 = ks.length ? ks[ks.length - 1][1] : null;
    const motion = o.profile === "takeoff" ? "depart" : o.profile === "land" ? "arrive" : o.stop != null ? "arrive" : o.startAt != null ? "depart"
      : o.speed === 0 ? "idle" : ks.length > 1 && u0 === ks[1][1] ? "depart" : ks.length > 1 && u1 === ks[ks.length - 2][1] ? "arrive" : "pass";
    emit(t0, "engine", { veh, motion, dur: r3(Math.min(t1 - t0, 10)), dir: o.dir || 1, gain: veh === "ship" ? 0 : -3 });
    for (const [tt, val] of o.doors || []) if (veh === "car" || veh === "truck") emit(tt, val > 0.5 ? "door" : "door_car", val > 0.5 ? { action: "open" } : {});
    for (const [tt] of (o.ramp || []).slice(0, 1)) emit(tt, "chain", { dur: 1.5 });
    if (/forklift/.test(o.kind || "") && o.lift) emit(cue(o.lift[0][0], o), "reverse_beep", { dur: 1.5 });
  }
  if (V) {
    const drive = V.drive;
    let nested = 0;   // traffic / convoy / shuttle call drive per vehicle: the place's ambience carries those, one cue per group
    V.drive = function (st, o) { const h = drive.apply(this, arguments); if (!nested) try { vehCues(h, o || {}); } catch (e) {} return h; };
    for (const k of ["traffic", "convoy", "shuttle"]) if (typeof V[k] === "function") {
      const f = V[k];
      V[k] = function (st, o) {
        nested++; let r; try { r = f.apply(this, arguments); } finally { nested--; }
        try { const [t0, t1] = win(o || {}); if (k !== "traffic" && isFinite(t1)) emit(t0 + 0.3, "engine", { veh: VK[(o.kinds || [o.kind])[0]] || "truck", motion: k === "shuttle" ? "idle" : "pass", dur: r3(Math.min(8, t1 - t0)), gain: -6 }); } catch (e) {}
        return r;
      };
    }
  }

  // ---------------------------------------------------------------- chapter openers
  if (DOC.chapterTag) { const ct = DOC.chapterTag; DOC.chapterTag = function (t) { emit(t, "logo"); return ct.apply(this, arguments); }; }


  // ---------------------------------------------------------------- places: upgrade fallback ambience (room/wind) to the scene's place
  /* compile.js emits DOC.amb(..., "room") for library places it doesn't know; the place id/title says what the bed should be */
  /* first matching whole word of the place id wins, in this priority order */
  const PLACE = [["cleanroom fab lab wafer litho lithography", "cleanroom"], ["airport apron runway airfield hangar", "airport"], ["server datacenter datacentre", "server"], ["trading exchange stock", "trading"], ["fishing marina", "harbour"], ["mine quarry pit", "mine"], ["separation smelter chemical solvent extraction", "separation"], ["magnet magnets sintering", "magnet"], ["assembly carplant", "assembly"], ["port quay container yard dock depot harbor harbour", "port"],
    ["strait deck ocean sea canal bow bridge", "sea"], ["supermarket bazaar market mall", "market"], ["protest maidan rally street", "crowd"],
    ["press earnings congress parliament summit stage hall station terminal", "crowd"], ["factory plant refinery warehouse mill", "factory"],
    ["home study house bedroom kitchen", "room"], ["office hq ops lobby newsroom boardroom", "office"], ["night", "night"],
    ["road desert coast village field farm", "wind"], ["room", "room"]].map(([w, a]) => [new Set(w.split(" ")), a]);
  const EXTRA = { port: [["gull", { gain: -6 }, 2.5], ["horn", { veh: "ship", gain: -10 }, 7]], sea: [["gull", { gain: -8 }, 4]],
    city: [["horn", { veh: "car", gain: -12 }, 5]], crowd: [], night: [["dog", { gain: -10 }, 6]], market: [["bird", { gain: -10 }, 3]] };
  const SCENES = [];
  const placeAmb = (id) => { const w = String(id || "").toLowerCase().split(/[^a-z0-9]+/); for (const [S, a] of PLACE) if (w.some((x) => S.has(x))) return a; return null; };
  if (root.RECIPE && root.RECIPE.scene) {
    const sc = root.RECIPE.scene;
    root.RECIPE.scene = function (spec) {
      try { const id = typeof spec.set === "string" ? spec.set : spec.set && (spec.set.id || spec.set.title); SCENES.push({ t0: spec.t0, t1: spec.t1, amb: placeAmb(id), id }); } catch (e) {}
      return sc.apply(this, arguments);
    };
  }
  if (root.SETS && root.SETS.mount) {
    const mount = root.SETS.mount;
    root.SETS.mount = function (sh, name) {
      try { if (sh && isFinite(sh.t0) && isFinite(sh.t1)) SCENES.push({ t0: sh.t0, t1: sh.t1, amb: placeAmb(typeof name === "string" ? name : name && (name.id || name.title)), id: name, mount: 1 }); } catch (e) {}
      return mount.apply(this, arguments);
    };
  }
  function upgradePlaces(Q) {
    // a mounted place with no ambience at all gets its bed (vertical reels mount sets directly)
    for (const s of SCENES) if (s.amb && !Q.some((c) => c.amb && Math.min(c.t1, s.t1) - Math.max(c.t0, s.t0) > 0.3))
      Q.push({ t: r3(s.t0), t0: r3(s.t0), t1: r3(s.t1), amb: s.amb, place: s.id, auto: 1, placed: 1 });
    for (const c of Q) {
      if (!c.amb || (c.amb !== "room" && c.amb !== "wind") || c.placed) continue;
      const s = SCENES.filter((s) => s.amb && Math.min(c.t1, s.t1) - Math.max(c.t0, s.t0) > 0.5 * (c.t1 - c.t0)).pop();
      if (s && s.amb !== c.amb) { c.fallback = c.amb; c.amb = s.amb; c.place = s.id; }
    }
    const last = {};   // place details: one per kind per 12 s at most
    for (const s of SCENES.slice().sort((a, b) => a.t0 - b.t0)) for (const [k, o, dt] of EXTRA[s.amb] || []) {
      const t = s.t0 + dt; if (s.t1 - s.t0 > dt + 1 && !(t - (last[k] == null ? -99 : last[k]) < 12)) { emit(t, k, Object.assign({}, o)); last[k] = t; }
    }
  }

  // ---------------------------------------------------------------- coalesce at finish
  const finish = DOC.finish;
  DOC.finish = function () {
    const Q = finish.apply(this, arguments) || root.__sfx;
    if (on) { upgradePlaces(Q); if (!DOC.surface) OUT.forEach((c) => { if (c.kind === "steps" && !c.surfaceSet) c.surface = surfaceAt(c.t); }); }
    const hand = Q.filter((c) => c.kind && !c.auto), keep = [];
    OUT.sort((a, b) => a.t - b.t);
    for (const c of OUT) {
      if (hand.some((h) => h.kind === c.kind && Math.abs(h.t - c.t) < 1.5)) continue;          // a hand cue wins
      const p = keep.filter((k) => k.kind === c.kind).pop();
      if (p && c.kind === "steps" && c.t <= p.t + p.dur) { p.dur = r3(Math.max(p.dur, c.t + c.dur - p.t)); p.people = Math.min(12, (p.people || 1) + (c.people || 1)); continue; }
      if (p && c.t - p.t < 1.2) { if (c.dur) p.dur = r3(Math.max(p.dur || 0, c.t + c.dur - p.t)); continue; }
      keep.push(c);
    }
    // sparse: on average at most one auto one-shot per 1.5 s; beds of action (steps/engine) always kept
    const span = Math.max(1, ...Q.concat(keep).map((c) => c.t1 || c.t)), cap = Math.ceil(span / 1.5);
    const shots = keep.filter((c) => !/^(steps|engine)$/.test(c.kind)), drop = new Set(shots.slice(cap));
    for (const c of keep) if (!drop.has(c)) Q.push(c);
    return Q;
  };
})(typeof window !== "undefined" ? window : globalThis);
