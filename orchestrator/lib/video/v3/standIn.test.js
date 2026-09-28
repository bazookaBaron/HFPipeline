"use strict";

// LF compile post-passes: stand-in media loses the subject's labels/annotations; bigNumbers keep the
// fact's digits (the Argentina ch3 incident: a Griesa slot resolved to a courthouse photo still tagged
// "U.S. Judge Thomas Griesa" with a highlight box on random windows; $1.33 billion shown as "$1").

const test = require("node:test");
const assert = require("node:assert");
const { applyStandIns, fixNumberDisplay, numberDisplayProblems, neededDecimals, displayed } = require("./standIn");

// the rendered ch3 sc2 geometry (lfStage hero + left bigNumber + right callout pointing into the photo)
function courtScene(standIn) {
  return [
    {
      id: "sc2",
      t0: 3,
      t1: 15,
      modules: [
        { id: "lfhead", type: "lfHeader", rect: [96, 48, 1100, 40], props: {} },
        { id: "s2_title", type: "lfText", rect: [242, 112, 1436, 96], props: { title: "Fights with holdout creditors in court" } },
        { id: "griesa_img", type: "photo", rect: [432, 236, 1056, 594], props: { slot: "griesaPhoto", tag: "U.S. Judge Thomas Griesa", standIn } },
        { id: "order_num", type: "bigNumber", rect: [176, 421, 320, 224], props: { prefix: "$", value: 1.33, unit: "billion" } },
        { id: "holdout_co", type: "callout", rect: [1329.5, 473.5, 280, 100], props: { value: "100%", text: "Demanded full cash payout", to: [-105, -88] } },
      ],
    },
  ];
}
const courtEvents = () => [
  { t: 4, op: "highlight", target: "griesa_img", value: { box: [25, 20, 50, 60], label: "Holdout Creditors" } },
  { t: 9, op: "zoomTo", target: "griesa_img", value: { box: [10, 10, 80, 80] } },
  { t: 11, op: "count", target: "order_num", value: { to: 1.33 } },
];

test("stand-in (related place): re-tagged with what it shows, subject highlight dropped, callout moved off the photo with its leader on the edge", () => {
  const sc = courtScene({ rung: "related", shows: "Daniel Patrick Moynihan United States Courthouse" });
  const ev = courtEvents();
  const r = applyStandIns(sc, ev);
  const [photo, co] = [sc[0].modules[2], sc[0].modules[4]];
  assert.strictEqual(photo.props.tag, "Daniel Patrick Moynihan United States Courthouse");
  // the subject highlight keeps its beat as a neutral push-in (no box, no "Holdout Creditors" label)
  assert.deepStrictEqual(ev.map((e) => e.op), ["zoomTo", "zoomTo", "count"]);
  assert.deepStrictEqual(ev[0].value, { box: [14, 14, 72, 72] });
  assert.strictEqual(r.droppedEvents, 0);
  assert.deepStrictEqual(co.rect, [1512, 473.5, 280, 100]); // right of the photo (1488 + 24)
  const abs = [co.rect[0] + co.props.to[0], co.rect[1] + co.props.to[1]];
  assert.strictEqual(abs[0], 1488, "leader ends on the photo's right edge");
  assert.ok(abs[1] >= 236 && abs[1] <= 830);
});

test("stand-in (name card): no tag (the card names the person), no highlight; generic scene is labelled as such", () => {
  const sc = courtScene({ rung: "namecard" });
  const ev = courtEvents();
  applyStandIns(sc, ev);
  assert.ok(!("tag" in sc[0].modules[2].props));
  assert.deepStrictEqual(ev.filter((e) => e.op === "highlight").map((e) => e.value), [{ pulse: true }]); // monogram pulse, no box/label
  const g = courtScene({ rung: "scene", shows: "an empty courtroom" });
  applyStandIns(g, []);
  assert.strictEqual(g[0].modules[2].props.tag, "Illustrative scene");
});

test("stand-in: a callout with no free spot keeps its chip but loses the leader; real photos are untouched", () => {
  const sc = courtScene({ rung: "namecard" });
  sc[0].modules.push({ id: "blocker", type: "lfText", rect: [1500, 400, 300, 300], props: {} }, { id: "blocker2", type: "lfText", rect: [96, 400, 330, 300], props: {} });
  applyStandIns(sc, []);
  const co = sc[0].modules[4];
  assert.deepStrictEqual(co.rect, [1329.5, 473.5, 280, 100]);
  assert.ok(!co.props.to);
  const real = courtScene(undefined);
  const ev = courtEvents();
  applyStandIns(real, ev);
  assert.strictEqual(real[0].modules[2].props.tag, "U.S. Judge Thomas Griesa");
  assert.strictEqual(ev.length, 3);
});

test("bigNumber keeps the fact's digits: 1.33 -> 2 decimals (1.3 would be 2.3 % off), count targets too; check flags a lossy display", () => {
  assert.strictEqual(neededDecimals(1.33), 2);
  assert.strictEqual(neededDecimals(550), 0);
  assert.strictEqual(neededDecimals(101.4), 0); // 101 is within 2 %
  assert.strictEqual(neededDecimals(2.5), 1);
  assert.strictEqual(neededDecimals(0.0421), 3);
  assert.strictEqual(displayed(1.33, 0), 1);
  const sc = courtScene(undefined);
  const spec = { scaffolds: sc };
  assert.deepStrictEqual(numberDisplayProblems(spec), ["sc2/order_num: shows 1 for 1.33"]);
  const fixed = fixNumberDisplay(sc, courtEvents());
  assert.deepStrictEqual(fixed, ["sc2/order_num: 1.33 shown with 2 decimal(s)"]);
  assert.strictEqual(sc[0].modules[3].props.decimals, 2);
  assert.strictEqual(displayed(1.33, 2), 1.33); // the count-up's final frame is fmt(to) at these decimals
  assert.deepStrictEqual(numberDisplayProblems(spec), []);
  // a count op whose target needs more digits than the value raises the decimals too
  const sc2 = courtScene(undefined);
  sc2[0].modules[3].props.value = 2;
  fixNumberDisplay(sc2, [{ op: "count", target: "order_num", value: { to: 1.33 } }]);
  assert.strictEqual(sc2[0].modules[3].props.decimals, 2);
});
