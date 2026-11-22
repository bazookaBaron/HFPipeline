// one-off: localise Google Fonts (OFL) latin subsets + trim Natural Earth 50m admin-0 (public domain) to South Asia
import fs from "fs"; import path from "path"; import { fileURLToPath } from "url";
const here = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.join(here, "fonts/g.css"), "utf8");
const blocks = css.split("/* ").slice(1).map(b => ({ sub: b.slice(0, b.indexOf(" */")), body: b.slice(b.indexOf("@font-face")) })).filter(b => b.sub === "latin");
let out = "";
for (const b of blocks) {
  const fam = /font-family: '([^']+)'/.exec(b.body)[1], url = /url\(([^)]+)\)/.exec(b.body)[1];
  const fn = fam.replace(/\s+/g, "") + ".woff2"; const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  fs.writeFileSync(path.join(here, "fonts", fn), buf); console.log(fn, buf.length);
  out += b.body.replace(url, "/fonts/" + fn).replace(/font-display: swap;\s*/, "");
}
fs.writeFileSync(path.join(here, "fonts/fonts.css"), out);
const g = JSON.parse(fs.readFileSync(path.join(here, "data/ne50.geojson"), "utf8"));
const keep = ["India", "Bangladesh", "Nepal", "Bhutan", "Pakistan", "China", "Myanmar", "Sri Lanka", "Afghanistan"];
const r = a => Math.round(a * 200) / 200;
const rr = c => typeof c[0] === "number" ? [r(c[0]), r(c[1])] : c.map(rr);
const feats = g.features.filter(f => keep.includes(f.properties.NAME || f.properties.ADMIN)).map(f => ({ type: "Feature", properties: { name: f.properties.NAME || f.properties.ADMIN }, geometry: { type: f.geometry.type, coordinates: rr(f.geometry.coordinates) } }));
fs.writeFileSync(path.join(here, "data/countries_sasia.geojson"), JSON.stringify({ type: "FeatureCollection", source: "Natural Earth 50m admin-0 (public domain), trimmed", features: feats }));
console.log(feats.map(f => f.properties.name).join(","), fs.statSync(path.join(here, "data/countries_sasia.geojson")).size);
