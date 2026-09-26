"use strict";

// Maps (geo.js + modules-map.js contract) and data-series refs (series.js) through compileStoryboard.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { compileStoryboard } = require("./compile");
const G = require("./geo");

const SB = require("../../../fixtures/v3/lf-map-smoke.json");
const DATA = require("../../../fixtures/v3/lf-map-smoke.data.json");

function synthTimeline(sb) {
  let t = 0.15;
  const words = [];
  const sentenceTimes = sb.sentences.map((s) => {
    const start = t;
    s.text.split(/\s+/).filter(Boolean).forEach((w, wi) => {
      words.push({ i: words.length, sentenceId: s.id, wi, text: w, start: +t.toFixed(3), end: +(t + 0.33).toFixed(3) });
      t += 0.36;
    });
    const st = { id: s.id, start: +(start - 0.06).toFixed(3), end: +t.toFixed(3) };
    t += 0.35;
    return st;
  });
  return { sentenceTimes, words, totalSeconds: +(t + 0.3).toFixed(3) };
}
const clone = (x) => JSON.parse(JSON.stringify(x));

test("geo assets: both resolutions present, keyed by ISO3, small enough to commit", () => {
  const a = fs.statSync(path.join(G.GEO_DIR, "world-110m.json")).size;
  const b = fs.statSync(path.join(G.GEO_DIR, "world-50m.json")).size;
  assert.ok(a + b < 3 * 1024 * 1024, `${a + b} bytes`);
  const g = G.load("50m");
  assert.strictEqual(g.projection, "naturalEarth1");
  ["IND", "PAK", "CHN", "FRA", "NOR", "USA", "XKX"].forEach((k) => assert.ok(g.countries[k], k));
  // France zooms to the mainland, not French Guiana
  assert.ok(g.countries.FRA.b[0] > -1000 && g.countries.FRA.B[0] < -4000);
});

test("project / point / fitBox", () => {
  assert.deepStrictEqual(G.project(0, 0), [0, 0]);
  const k = G.point({ city: "Karachi" }, "t");
  assert.deepStrictEqual(k, G.project(67.01, 24.86));
  assert.deepStrictEqual(G.point("city:Karachi", "t"), k);
  assert.deepStrictEqual(G.point([67.01, 24.86], "t"), k);
  assert.throws(() => G.point({ city: "Atlantis" }, "t"), /unknown city/);
  assert.throws(() => G.point({ iso: "XXX" }, "t"), /unknown country/);
  const v = G.fitBox([0, 0, 100, 100], 2, 0);
  assert.deepStrictEqual(v, [-50, 0, 200, 100]);
  assert.deepStrictEqual(G.niceBreaks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), [2, 4, 6, 8]);
});

test("compile: map modules get view + only the paths they can show; map events are projected", () => {
  const sb = clone(SB);
  const spec = compileStoryboard(sb, synthTimeline(sb), { data: DATA });
  const m1 = spec.scaffolds[0].modules.find((m) => m.id === "map1");
  const isos = m1.props.geo.countries.map((c) => c.iso);
  ["IND", "PAK", "CHN", "AFG"].forEach((k) => assert.ok(isos.includes(k), k));
  assert.ok(!isos.includes("BRA") && !isos.includes("CAN") && !isos.includes("ATA"), "far-away countries are not shipped");
  assert.ok(m1.props.geo.countries.every((c) => c.res === "50m"), "zoomed-in views use 1:50m");
  const aspect = m1.rect[2] / m1.rect[3];
  assert.ok(Math.abs(m1.props.view[2] / m1.props.view[3] - aspect) < 0.01, "view matches the rect aspect");
  // countryMap labels its focus countries
  assert.deepStrictEqual(m1.props.highlight.map((h) => [h.iso, h.label && h.label.text]), [["IND", "India"], ["PAK", "Pakistan"]]);
  const ev = Object.fromEntries(spec.events.filter((e) => e.target === "map1").map((e) => [e.op, e.value]));
  assert.deepStrictEqual(ev.pin.at, G.project(67.01, 24.86));
  assert.strictEqual(ev.pin.label, "Karachi");
  assert.strictEqual(ev.zoomTo.view.length, 4);
  assert.deepStrictEqual(ev.arrow.to, G.project(116.41, 39.9));
  // the world map ships 1:110m, and its choropleth came from data.json series S3
  const m2 = spec.scaffolds[1].modules.find((m) => m.id === "map2");
  assert.ok(m2.props.geo.countries.every((c) => c.res === "110m"));
  const ch = spec.events.find((e) => e.op === "choropleth").value;
  assert.strictEqual(ch.source, "World Bank, External debt stocks (% of GNI) (DT.DOD.DECT.GN.ZS), 2023");
  assert.strictEqual(ch.colors.length, 5);
  assert.strictEqual(ch.cls.PAK, 1);
  assert.strictEqual(ch.labels.length, 5);
  // deterministic
  assert.deepStrictEqual(compileStoryboard(clone(SB), synthTimeline(sb), { data: DATA }), spec);
});

test("series refs: lineChart points + source from data.json; barChart bars; errors", () => {
  const sb = clone(SB);
  const spec = compileStoryboard(sb, synthTimeline(sb), { data: DATA });
  const ch = spec.scaffolds[2].modules.find((m) => m.id === "chart1");
  assert.strictEqual(ch.props.source, "World Bank, External debt stocks (% of GNI) (DT.DOD.DECT.GN.ZS)");
  assert.strictEqual(ch.props.unit, "% of GNI");
  assert.strictEqual(ch.props.points[0].x, 2010);
  assert.deepStrictEqual(ch.props.points.slice(-1)[0], { x: 2023, y: 39.4 });
  assert.ok(!("series" in ch.props) && !("from" in ch.props));

  const bar = clone(SB);
  bar.scaffolds[2].slots.modules[0] = { id: "chart1", type: "barChart", rect: [96, 120, 1728, 840], props: { title: "India GDP", series: "S2" } };
  bar.events = bar.events.filter((e) => e.target !== "chart1");
  const b = compileStoryboard(bar, synthTimeline(bar), { data: DATA }).scaffolds[2].modules.find((m) => m.id === "chart1");
  assert.strictEqual(b.props.bars.length, 8);
  assert.deepStrictEqual(b.props.bars.slice(-1)[0], { label: "2023", value: 3.5 });
  assert.strictEqual(b.props.unit, "US$ trillion");

  const multi = clone(bar);
  multi.scaffolds[2].slots.modules[0] = { id: "chart1", type: "lineChart", rect: [96, 120, 1728, 840], props: { series: ["S1", "S1"], from: 2020 } };
  const ml = compileStoryboard(multi, synthTimeline(multi), { data: DATA }).scaffolds[2].modules.find((m) => m.id === "chart1");
  assert.deepStrictEqual(ml.props.series.map((s) => [s.name, s.points.length]), [["Pakistan", 4], ["Pakistan", 4]]);

  const bad = clone(SB);
  bad.scaffolds[2].slots.modules[0].props.series = "S9";
  assert.throws(() => compileStoryboard(bad, synthTimeline(bad), { data: DATA }), /unknown data series "S9"/);
  assert.throws(() => compileStoryboard(clone(SB), synthTimeline(SB), {}), /no data\.json was given/);
});
