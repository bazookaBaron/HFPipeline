// "What happens when I hit send?" - the PLAN table as data for dialogue/compiler/compile.mjs (same contract as the cloud table inside compile.mjs).
// Rig names: ms_X = the MS rig (PLAN.md calls it seat_X). Words are matched inside the line by normalised text, `#n` = n-th occurrence.
export const CFG = {
  words: "fish/words_send.json", audio: "fish/campfire_send_1p5x.wav", duration: 44.45, set: "campfire", pair: ["dadu", "rohan"],
  who: { WALTER: "A", LEO: "B" },
  // ASR spelling -> script tokens ("99 %" = "Ninety-nine percent,")
  alias: { 99: ["ninetynine"], "": ["percent"] },
  lead: 0.15, capMax: 5, // 6-word captions with long words wrapped to two lines into the card edge (send v1 frame at 27 s)
  tail: { t0: 41.60, rig: "wide2", move: ["push", 0.02] },
};
export const PLAN = [
  { n: 1, shots: [{ rig: "ots_B", move: ["push", 0.03] }], face: [["curious"]], lis: [["warm"]], g: [["lean_in", "@start", { line: true }], ["tilt", "maya"]] },
  { n: 2, shots: [{ rig: "ms_A", plan: "seat_A", move: ["push", 0.03] }], face: [["warm"]], lis: [["curious"]], g: [["open_palm", "tower"]] },
  { n: 3, shots: [{ rig: "ots_B", move: ["hold"] }], face: [["surprised"]], lis: [["amused", null, 0.6]], g: [["head_back", "through"], ["palm_up", "air"]] },
  { n: 4, shots: [{ rig: "ms_A", plan: "seat_A", move: ["hold"] }, { from: "your", rig: "ms_B", plan: "seat_B", move: ["hold"], subject: "B", cutin: true }],
    face: [["amused"]], lis: [["surprised", null, 0.5], ["curious", "your"]], g: [["nod", "radio"], ["shoulder_bounce", "shouts"]], lg: [["slow_nod", "listens"]] },
  { n: 5, shots: [{ rig: "ots_B", move: ["hold"] }], face: [["curious"]], lis: [["warm"]], g: [["lean_in", "@start", { line: true }]] },
  { n: 6, shots: [{ rig: "ms_A", plan: "seat_A", move: ["push", 0.03] }, { from: "under", rig: "ms_B", plan: "seat_B", move: ["hold"], subject: "B", cutin: true }],
    face: [["firm_light"]], lis: [["curious"], ["surprised", "sea", 0.7]], g: [["head_shake", "not"], ["open_palm", "cables"]], lg: [["brows_up", "sea"]] },
  { n: 7, shots: [{ rig: "ots_B", move: ["hold"] }], face: [["confused"]], lis: [["amused", null, 0.6]], g: [["head_back", "sea"], ["hand_chest", "thought"]] },
  { n: 8, shots: [{ rig: "ms_A", plan: "seat_A", move: ["hold"] }], face: [["firm_light"]], lis: [["confused", null, 0.6]], g: [["palm_down", "mostly"], ["nod", "continents"]] },
  { n: 9, shots: [{ rig: "mcu_B", move: ["push", 0.04] }], face: [["surprised"]], lis: [["amused"]], g: [["hands_lift", "swimming"]] },
  { n: 10, shots: [{ rig: "ms_A", plan: "seat_A", move: ["hold"] }], face: [["amused"]], lis: [["impressed", null, 0.7]], g: [["nod", "as"], ["palm_up", "glass"]] },
  { n: 11, shots: [{ rig: "ots_B", move: ["hold"] }], face: [["curious"]], lis: [["warm"]], g: [["lean_in", "@start", { line: true }]] },
  { n: 12, shots: [{ rig: "wide2", move: ["push", 0.04] }], face: [["warm"]], lis: [["curious"], ["impressed", "photos", 0.8], ["thinking", "pass"]],
    g: [["open_palm", "computers"], ["nod", "photos"], ["flick", "pass"]] },
  { n: 13, shots: [{ rig: "ots_B", move: ["push", 0.03] }], face: [["thinking"]], lis: [["warm"]], g: [["palm_up", "note"]], gaze: "fire" },
  { n: 14, shots: [{ rig: "ms_A", plan: "seat_A", move: ["hold"] }], face: [["amused"]], lis: [["impressed", null, 0.6]], g: [["nod", "exactly"], ["two_hand_open", "hand"]] },
  { n: 15, shots: [{ rig: "ots_B", move: ["hold"] }], face: [["curious"]], lis: [["warm"]], g: [["lean_in", "@start", { line: true }], ["tilt", "minute"]] },
  { n: 16, shots: [{ rig: "ms_A", plan: "seat_A", move: ["hold"] }], face: [["firm_light"]], lis: [["surprised", null, 0.7]], g: [["head_shake", "less"], ["palm_down", "second"]] },
  { n: 17, shots: [{ rig: "mcu_B", move: ["push", 0.04] }], face: [["grin", null, 0.6], ["grin", "hour"]], lis: [["amused", null, 0.5]], g: [["two_hand_open", "hour"]] },
  { n: 18, shots: [{ rig: "mcu_A", move: ["hold"] }], face: [["dry"]], lis: [["grin", null, 0.8]], g: [] },
];
// tail (no voice): Leo grins at the fire (caught out), Walter stays amused
export const TAIL = { face: { A: [["amused", 0.7]], B: [["grin", 0.6]] }, gaze: { B: "fire" }, g: [{ actor: "B", kind: "deflate" }] };
