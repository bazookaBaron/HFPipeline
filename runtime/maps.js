/* Poster-style animated maps (seek-safe GSAP). Needs gsap, runtime/geo/geo.js (window.MAPS_GEO) and the theme CSS vars.
 * Doc: runtime/MAPS.md. Every performance is M.verb(args, t, opts) on the paused timeline passed as opts.tl.
 * Geometry is data-driven: tweens only move small state objects, draw() re-renders SVG from state (camera, arcs, lift),
 * so strokes/shadows stay constant in screen px at any zoom. */
(function (root) {
  const NS = "http://www.w3.org/2000/svg", S = 5000;
  const Maps = { tl: null };
  const REGIONS = {
    asia: [58, -11, 146, 52], "south-asia": [60, 5, 98, 38], "east-asia": [95, 18, 146, 50], "southeast-asia": [92, -11, 142, 24],
    "middle-east": [32, 12, 63, 42], europe: [-12, 35, 40, 62], africa: [-20, -36, 52, 38], "north-america": [-130, 14, -60, 55],
    "south-america": [-82, -56, -34, 13], oceania: [110, -48, 180, -8], "indian-ocean": [40, -15, 100, 32],
  };
  const CITIES = {
    mumbai: [72.88, 19.08], delhi: [77.21, 28.61], bengaluru: [77.59, 12.97], chennai: [80.27, 13.08], kolkata: [88.36, 22.57], hyderabad: [78.49, 17.39],
    karachi: [67.01, 24.86], islamabad: [73.05, 33.68], dhaka: [90.41, 23.81], colombo: [79.86, 6.93], kathmandu: [85.32, 27.72],
    beijing: [116.41, 39.9], shanghai: [121.47, 31.23], "hong kong": [114.17, 22.32], singapore: [103.82, 1.35], tokyo: [139.69, 35.69], seoul: [126.98, 37.57],
    jakarta: [106.85, -6.21], bangkok: [100.5, 13.76], dubai: [55.27, 25.2], "abu dhabi": [54.37, 24.45], riyadh: [46.68, 24.71], doha: [51.53, 25.29],
    tehran: [51.39, 35.69], istanbul: [28.98, 41.01], moscow: [37.62, 55.76], london: [-0.13, 51.51], paris: [2.35, 48.86], frankfurt: [8.68, 50.11],
    "new york": [-74.01, 40.71], "san francisco": [-122.42, 37.77], "sao paulo": [-46.63, -23.55], lagos: [3.38, 6.52], nairobi: [36.82, -1.29],
    johannesburg: [28.05, -26.2], cairo: [31.24, 30.04], sydney: [151.21, -33.87], mecca: [39.83, 21.42], jeddah: [39.17, 21.54], muscat: [58.41, 23.59],
  };
  function project(lon, lat) {
    const lam = lon * Math.PI / 180, phi = lat * Math.PI / 180, p2 = phi * phi, p4 = p2 * p2;
    const x = lam * (0.8707 - 0.131979 * p2 - 0.013791 * p4 + 0.003971 * p2 * p4 * p4 - 0.001529 * p4 * p4 * p4);
    const y = phi * (1.007226 + 0.015085 * p2 - 0.044475 * p2 * p4 + 0.028874 * p4 * p4 - 0.005916 * p2 * p4 * p4);
    return [x * S, -y * S];
  }
  /* Doc2D "Atlas & Ledger" palette for skin:"atlas" (o.theme still overrides). bg/sea2 = sea gradient, coast = soft coast line. */
  const ATLAS_T = { ink: "#13223B", paper: "#F5EDDF", bg: "#B4D8DF", sea2: "#86BACB", deep: "#1E7C83", pale: "#EADFC9", shadow: "#13223B", coast: "#5E7487",
    marker: "#F2A93B", alert: "#E5593F", teal: "#1E7C83", mint: "#3FB68B", sky: "#5AA9E6", label: "#2A3850", seaLabel: "#1D4655", pencil: "#E5593F" };
  Maps.ATLAS_T = ATLAS_T;
  /* inverse of project(): projected units -> [lon, lat] (Newton on the Natural Earth I y-polynomial) */
  Maps.unproject = function (x, y) {
    const Y = -y / S; let phi = Y;
    for (let i = 0; i < 12; i++) { const p2 = phi * phi, p4 = p2 * p2, f = phi * (1.007226 + 0.015085 * p2 - 0.044475 * p2 * p4 + 0.028874 * p4 * p4 - 0.005916 * p2 * p4 * p4) - Y,
      d = 1.007226 + 3 * 0.015085 * p2 - 7 * 0.044475 * p2 * p4 + 9 * 0.028874 * p4 * p4 - 11 * 0.005916 * p2 * p4 * p4; phi -= f / d; }
    const p2 = phi * phi, p4 = p2 * p2, xk = 0.8707 - 0.131979 * p2 - 0.013791 * p4 + 0.003971 * p2 * p4 * p4 - 0.001529 * p4 * p4 * p4;
    return [x / S / xk * 180 / Math.PI, phi * 180 / Math.PI];
  };
  /* single-stroke hand lettering for M.pencil("write"): [advance, path] on a 10-unit cap height (y down, baseline 10) */
  const HAND = {
    "0": [6.4, "M3 0C0.6 0 0 3 0 5C0 7.5 1 10 3.2 10C5.3 10 6.2 7.5 6.2 5C6.2 2.5 5.4 0 3 0"],
    "1": [4.2, "M0.8 2.2L3.2 0L3.2 10"],
    "2": [6.6, "M0.3 2.2C0.8 0.6 2 0 3.2 0C5 0 6 1.2 6 2.7C6 5 2.2 7 0 10L6.3 10"],
    "3": [6.6, "M0.4 1.2C1 0.4 2 0 3 0C4.8 0 5.8 1 5.8 2.4C5.8 3.9 4.5 4.8 2.6 4.8C4.8 4.8 6.2 5.9 6.2 7.4C6.2 9 4.8 10 3 10C1.8 10 0.8 9.6 0.1 8.8"],
    "4": [6.8, "M4.8 10L4.8 0L0 7L6.5 7"],
    "5": [6.6, "M5.8 0L1.2 0L0.6 4.4C1.4 3.9 2.3 3.7 3.2 3.7C5 3.7 6.2 5 6.2 6.8C6.2 8.7 4.8 10 3 10C1.8 10 0.8 9.6 0 8.8"],
    "6": [6.6, "M5.4 0.6C4.7 0.2 4 0 3.3 0C1.2 0 0 2.5 0 6C0 8.5 1.2 10 3.1 10C4.9 10 6.1 8.7 6.1 6.8C6.1 5 4.9 3.8 3.2 3.8C1.8 3.8 0.6 4.6 0.1 5.8"],
    "7": [6.2, "M0 0L6 0C4 3 2.6 6 2.2 10"],
    "8": [6.4, "M3 4.6C1.5 4.6 0.5 3.6 0.5 2.3C0.5 1 1.6 0 3 0C4.4 0 5.5 1 5.5 2.3C5.5 3.6 4.5 4.6 3 4.6C1.3 4.6 0 5.7 0 7.3C0 8.9 1.3 10 3 10C4.7 10 6 8.9 6 7.3C6 5.7 4.7 4.6 3 4.6"],
    "9": [6.4, "M5.9 4.2C5.4 5.4 4.3 6.2 2.9 6.2C1.2 6.2 0 5 0 3.2C0 1.3 1.2 0 3 0C4.9 0 6 1.5 6 4C6 7.5 4.8 10 2.7 10C2 10 1.3 9.8 0.6 9.4"],
    A: [6.4, "M0 10L3.1 0L6.2 10M1.1 6.5L5 6.5"], B: [6.4, "M0 10L0 0L3.2 0C4.7 0 5.5 1 5.5 2.3C5.5 3.7 4.6 4.7 3 4.7L0 4.7M3 4.7C5 4.7 6 5.8 6 7.3C6 8.9 4.9 10 3.3 10L0 10"],
    C: [6.4, "M6 1.4C5.3 0.5 4.3 0 3.2 0C1.2 0 0 2.4 0 5C0 7.6 1.2 10 3.2 10C4.3 10 5.3 9.5 6 8.6"], D: [6.4, "M0 0L0 10L2.6 10C4.9 10 6 7.6 6 5C6 2.4 4.9 0 2.6 0L0 0"],
    E: [5.9, "M5.6 0L0 0L0 10L5.8 10M0 4.8L4.4 4.8"], F: [5.7, "M5.6 0L0 0L0 10M0 4.8L4.4 4.8"],
    G: [6.6, "M6 1.4C5.3 0.5 4.3 0 3.2 0C1.2 0 0 2.4 0 5C0 7.6 1.2 10 3.2 10C4.6 10 6 9 6 7L6 5.6L3.6 5.6"], H: [6.4, "M0 0L0 10M6 0L6 10M0 4.9L6 4.9"],
    I: [1.6, "M0.6 0L0.6 10"], J: [5.4, "M5 0L5 7C5 8.9 4 10 2.6 10C1.4 10 0.5 9.3 0 8.3"], K: [6, "M0 0L0 10M5.8 0L0 6.2M2 4.2L6 10"],
    L: [5.6, "M0 0L0 10L5.5 10"], M: [7.4, "M0 10L0.4 0L3.5 7L6.6 0L7 10"], N: [6.4, "M0 10L0 0L6 10L6 0"],
    O: [7.4, "M3.5 0C1 0 0 2.6 0 5C0 7.4 1 10 3.5 10C6 10 7 7.4 7 5C7 2.6 6 0 3.5 0"], P: [6.2, "M0 10L0 0L3.3 0C5 0 6 1.1 6 2.7C6 4.3 5 5.4 3.3 5.4L0 5.4"],
    Q: [7.4, "M3.5 0C1 0 0 2.6 0 5C0 7.4 1 10 3.5 10C6 10 7 7.4 7 5C7 2.6 6 0 3.5 0M4.2 7.4L7.2 10.6"], R: [6.3, "M0 10L0 0L3.3 0C5 0 6 1.1 6 2.7C6 4.3 5 5.4 3.3 5.4L0 5.4M3 5.4L6 10"],
    S: [6.1, "M5.7 1.3C5 0.4 4 0 3 0C1.5 0 0.4 0.9 0.4 2.4C0.4 5.4 6 4.4 6 7.5C6 9 4.8 10 3.1 10C1.8 10 0.7 9.5 0 8.6"], T: [6.3, "M0 0L6.4 0M3.2 0L3.2 10"],
    U: [6.4, "M0 0L0 6.8C0 8.9 1.3 10 3 10C4.7 10 6 8.9 6 6.8L6 0"], V: [6.2, "M0 0L3.1 10L6.2 0"], W: [8.2, "M0 0L2 10L4 2.5L6 10L8 0"],
    X: [6.1, "M0 0L6 10M6 0L0 10"], Y: [6.1, "M0 0L3 5L6 0M3 5L3 10"], Z: [6.3, "M0.2 0L6 0L0 10L6.2 10"],
    "-": [4.6, "M0.4 6L4.2 6"], ".": [1.4, "M0.5 9.6L0.7 10"], ",": [1.6, "M1 9.4L0.3 11.5"], "/": [4.6, "M0 10L4.5 0"], ":": [1.6, "M0.7 3.5L0.8 3.8M0.7 9.5L0.8 9.8"],
    "'": [1.4, "M1 0L0.7 2.5"], "+": [5.6, "M0.3 5L5.3 5M2.8 2.5L2.8 7.5"], "!": [1.6, "M0.7 0L0.7 6.8M0.7 9.6L0.7 10"],
    "(": [2.8, "M2.5 -0.5C0.6 2 0.6 8 2.5 10.5"], ")": [2.8, "M0.3 -0.5C2.2 2 2.2 8 0.3 10.5"], "%": [6.4, "M0 10L6 0M1.5 0C0.6 0 0.2 0.8 0.2 1.7C0.2 2.6 0.6 3.4 1.5 3.4C2.4 3.4 2.8 2.6 2.8 1.7C2.8 0.8 2.4 0 1.5 0M4.7 6.6C3.8 6.6 3.4 7.4 3.4 8.3C3.4 9.2 3.8 10 4.7 10C5.6 10 6 9.2 6 8.3C6 7.4 5.6 6.6 4.7 6.6"],
    $: [6.1, "M5.7 1.3C5 0.4 4 0 3 0C1.5 0 0.4 0.9 0.4 2.4C0.4 5.4 6 4.4 6 7.5C6 9 4.8 10 3.1 10C1.8 10 0.7 9.5 0 8.6M3.1 -1.4L3.1 11.4"],
    "?": [5.4, "M0.2 1.8C0.6 0.6 1.6 0 2.8 0C4.3 0 5.2 1 5.2 2.4C5.2 4.6 2.6 4.8 2.6 7M2.6 9.6L2.6 10"], " ": [3.4, ""],
  };
  Maps.HAND = HAND;
  /* named straits / canals / capes (Doc2D labels name them explicitly): key -> [lon, lat, label] */
  const WATERWAYS = {
    hormuz: [56.45, 26.56, "Strait of Hormuz"], "bab-el-mandeb": [43.33, 12.58, "Bab-el-Mandeb"], malacca: [100.3, 3.2, "Strait of Malacca"],
    suez: [32.35, 30.6, "Suez Canal"], panama: [-79.7, 9.1, "Panama Canal"], bosphorus: [29.05, 41.12, "Bosphorus"], dardanelles: [26.4, 40.2, "Dardanelles"],
    gibraltar: [-5.6, 35.95, "Strait of Gibraltar"], dover: [1.45, 51.0, "Strait of Dover"], "english channel": [-1.5, 50.2, "English Channel"],
    taiwan: [119.5, 24.5, "Taiwan Strait"], palk: [79.6, 10.0, "Palk Strait"], kiel: [9.6, 54.1, "Kiel Canal"], sunda: [105.8, -6.0, "Sunda Strait"],
    lombok: [115.7, -8.7, "Lombok Strait"], magellan: [-70.5, -53.3, "Strait of Magellan"], "good hope": [18.47, -34.36, "Cape of Good Hope"],
    "korea strait": [129.0, 34.5, "Korea Strait"], bering: [-169.0, 65.8, "Bering Strait"], "mozambique channel": [41.0, -18.0, "Mozambique Channel"],
  };
  Maps.WATERWAYS = WATERWAYS;
  Object.assign(CITIES, { rotterdam: [4.05, 51.95], "port said": [32.3, 31.26], "cape town": [18.42, -33.92], "los angeles": [-118.24, 34.05], "shenzhen": [114.06, 22.54],
    "busan": [129.08, 35.18], veldhoven: [5.40, 51.42], "bayan obo": [109.97, 41.77], chicago: [-87.63, 41.88], "ford chicago": [-87.54, 41.67], osaka: [135.50, 34.69], yokohama: [139.64, 35.44], dalian: [121.61, 38.91], tianjin: [117.20, 39.08], qingdao: [120.38, 36.07], baotou: [109.84, 40.66], "mountain pass": [-115.53, 35.48], "las vegas": [-115.14, 36.17],
    "mount weld": [122.55, -28.86], fremantle: [115.75, -32.05], kuantan: [103.33, 3.82], gebeng: [103.38, 3.97], ningbo: [121.55, 29.87], ganzhou: [114.93, 25.83], kalgoorlie: [121.47, -30.75], eindhoven: [5.48, 51.44], hsinchu: [120.97, 24.80], pyeongtaek: [127.11, 36.99], icheon: [127.44, 37.27],
    hwaseong: [127.06, 37.20], chandler: [-111.84, 33.30], phoenix: [-112.07, 33.45], hillsboro: [-122.99, 45.52], schiphol: [4.76, 52.31], taipei: [121.56, 25.03], "san jose": [-121.89, 37.34], dresden: [13.74, 51.05], "antwerp": [4.4, 51.22], "hamburg": [9.99, 53.55], "piraeus": [23.63, 37.94], "colombo port": [79.84, 6.95], "kochi": [76.27, 9.93], "chittagong": [91.83, 22.36] });
  Maps.project = project; Maps.CITIES = CITIES; Maps.REGIONS = REGIONS;
  const hex = (c) => { c = String(c).trim(); if (c[0] !== "#") return [255, 255, 255]; if (c.length === 4) c = "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); };
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
  const mk = (tag, at, par) => { const e = document.createElementNS(NS, tag); for (const k in at || {}) e.setAttribute(k, at[k]); if (par) par.appendChild(e); return e; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const title = (n) => String(n).replace(/\b\w/g, (m) => m.toUpperCase());

  Maps.mount = function (id, o) {
    o = o || {};
    const G = root.MAPS_GEO; if (!G) throw new Error("maps: load runtime/geo/geo.js first");
    const tl = o.tl || Maps.tl; if (!tl) throw new Error("maps: pass opts.tl (paused gsap timeline)");
    const host = typeof id === "string" ? document.getElementById(id.replace(/^#/, "")) : id;
    const wide = o.layout !== "9x16";
    const W = o.w || (wide ? 1920 : 1080), H = o.h || (wide ? 1080 : 1920), X = o.x || 0, Y = o.y || 0;
    const cs = getComputedStyle(document.documentElement), V = (n, d) => (cs.getPropertyValue("--" + n).trim() || d);
    const T = Object.assign({ ink: V("ink", "#111111"), paper: V("paper", "#FBF7EE"), bg: V("bg", "#4DAF4A"), deep: V("deep", "#2E7D32"), pale: V("pale", "#CDE8C4"), shadow: V("shadow", "#3F6FC0"), marker: V("marker", "#F6DA1C"), alert: V("alert", "#E8553E"), dot: V("dot", "rgba(0,0,0,.13)") }, o.skin === "atlas" || o.skin === "paper" ? ATLAS_T : {}, o.theme || {});
    const PAPER = o.skin === "paper"; // Doc2D paper-cut: baked land/sea tiles (maps_paper.py), shimmer, drift + layer parallax, tags
    const ATLAS = o.skin === "atlas" || PAPER;
    if (PAPER && !(o.theme && o.theme.seaLabel)) T.seaLabel = "#13223B"; // navy lettering reads on every depth band // Doc2D atlas skin: relief, paper grain, soft coast shadow, tracked place labels (implies calm)
    const CALM = !!o.calm || ATLAS; // Doc2D: calm eases, soft chips, no bounce, thin coasts, plain sea
    const land = PAPER ? "rgba(243,234,216,0)" : o.land === "pale" ? T.pale : T.paper, SH = o.shadow == null ? 9 : o.shadow, ids = (host.id || "m") + "_";
    const water = o.water === "deep" ? T.deep : T.bg;
    host.setAttribute("data-layout-allow-overflow", ""); host.setAttribute("data-layout-allow-overlap", "");
    host.style.cssText += `;position:absolute;left:${X}px;top:${Y}px;width:${W}px;height:${H}px;overflow:hidden;background-color:${PAPER ? "#5C94B2" : water};${PAPER ? "" : ATLAS ? `background-image:radial-gradient(ellipse 120% 95% at 42% 34%, ${T.bg} 0%, ${T.sea2} 100%);` : CALM ? `background-image:radial-gradient(ellipse at 50% 40%, rgba(255,255,255,.10), rgba(0,0,0,.18));` : `background-image:radial-gradient(circle at center,${T.dot} 0 1.8px,transparent 2.4px);background-size:36px 36px;`}${o.frame ? `border:6px solid ${T.ink};box-sizing:border-box;box-shadow:10px 10px 0 ${T.shadow};border-radius:22px;` : ""}`;
    const PM = PAPER ? root.MAPS_PAPER : null, pbase = o.reliefPath || "relief/";
    if (PAPER && !PM) throw new Error("maps: skin paper needs relief.js with MAPS_PAPER (python runtime/maps_paper.py)");
    // paper: a sky behind and one "plane" holding sea + shimmer + land, so M.tilt can lean the whole sheet back in CSS 3D
    const sky = PAPER ? host.appendChild(document.createElement("div")) : null, plane = PAPER ? host.appendChild(document.createElement("div")) : null, LH = plane || host;
    if (sky) { sky.style.cssText = "position:absolute;inset:0;opacity:0;background:linear-gradient(180deg,#B9D3DC 0%,#D9E4DF 22%,#F1E6CF 34%,#E9DCC2 100%)"; plane.style.cssText = "position:absolute;inset:0;transform-origin:50% 72%"; }
    const seaSvg = PAPER ? mk("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: "position:absolute;left:0;top:0;overflow:hidden" }, LH) : null;
    const shim = PAPER && o.shimmer !== false ? LH.appendChild(document.createElement("div")) : null;
    if (shim) shim.style.cssText = `position:absolute;inset:0;pointer-events:none;background-image:url(${pbase + PM.shimmer}),url(${pbase + PM.shimmer});background-size:512px 512px,800px 800px;opacity:${o.shimmer == null ? 0.5 : o.shimmer}`;
    const svg = mk("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: "position:absolute;left:0;top:0;overflow:hidden" }, LH);
    const defs = mk("defs", {}, svg), isos = Object.keys(G.countries);
    isos.forEach((k) => { mk("path", { id: ids + k, d: G.countries[k].d, pathLength: 1, "fill-rule": "evenodd" }, defs); if (G.countries[k].s) mk("path", { id: ids + k + "_s", d: G.countries[k].s, "fill-rule": "evenodd" }, defs); });
    const grat = mk("path", { fill: "none", stroke: T.ink, "stroke-opacity": ATLAS ? 0.13 : 0.15, "stroke-linecap": "butt" }, svg);
    { const parts = []; for (let lo = -180; lo <= 180; lo += 15) { const p = []; for (let la = -75; la <= 85; la += 5) p.push(project(lo, la)); parts.push("M" + p.map((q) => q[0].toFixed(0) + " " + q[1].toFixed(0)).join("L")); }
      for (let la = -75; la <= 75; la += 15) { const p = []; for (let lo = -180; lo <= 180; lo += 5) p.push(project(lo, la)); parts.push("M" + p.map((q) => q[0].toFixed(0) + " " + q[1].toFixed(0)).join("L")); }
      grat.setAttribute("d", parts.join("")); if (o.graticule === false || (PAPER && !o.graticule)) grat.style.display = "none"; }
    const ptiles = []; // paper skin: baked sea (seaSvg) + land (under everything in svg) tiles, LOD like relief
    if (PAPER) { const lg = mk("g", {}, svg); svg.insertBefore(lg, grat); const sg = mk("g", {}, seaSvg);
      const im = (q, lo) => { const b = [q.x, q.y, q.x + q.w, q.y + q.h], at = (f) => ({ href: pbase + f, x: q.x, y: q.y, width: q.w, height: q.h, preserveAspectRatio: "none", style: "display:none" });
        ptiles.push({ lo, b, sea: 1, e: mk("image", at(q.s), sg) }); if (q.l) ptiles.push({ lo, b, sea: 0, e: mk("image", at(q.l), lg) }); };
      im(PM.lo, 1); PM.tiles.forEach((q) => im(q, 0)); }
    const layer = (at) => mk("g", at, svg);
    let blur = null; if (ATLAS) { const f = mk("filter", { id: ids + "soft", x: "-2%", y: "-2%", width: "104%", height: "104%" }, defs); blur = mk("feGaussianBlur", { stdDeviation: 5 }, f); }
    const shadowG = layer(ATLAS ? { fill: T.shadow, stroke: "none", opacity: 0.2, filter: `url(#${ids}soft)` } : { fill: T.shadow, stroke: T.shadow, "stroke-linejoin": "round" });
    const coast2G = ATLAS ? layer({ fill: "none", stroke: T.ink, "stroke-opacity": 0.22, "stroke-linejoin": "round" }) : null; // offset print line (hand-registered look)
    const coastG = layer(ATLAS ? { fill: T.coast, stroke: T.coast, "stroke-linejoin": "round" } : { fill: T.ink, stroke: T.ink, "stroke-linejoin": "round" });
    const fillsG = layer({ fill: land, stroke: "none" }), reliefG = ATLAS ? layer({ opacity: o.relief == null ? 0.42 : +o.relief || 0 }) : null;
    const linesG = layer({ fill: "none", stroke: T.ink, "stroke-opacity": ATLAS ? 0.45 : 1, "stroke-linejoin": "round", "stroke-linecap": "round" }), topG = layer({});
    const use = (par, k, at) => mk("use", Object.assign({ href: "#" + ids + k }, at || {}), par);
    const fillUse = {};
    isos.forEach((k) => { use(shadowG, G.countries[k].s ? k + "_s" : k); if (coast2G) use(coast2G, k); use(coastG, k); fillUse[k] = use(fillsG, k); use(linesG, k); });
    const tiles = []; // relief LOD: world raster when zoomed out, ~source-resolution tiles when zoomed in
    if (reliefG && !PAPER && o.relief !== false && root.MAPS_RELIEF) { const R = root.MAPS_RELIEF, base = o.reliefPath || "relief/", im = (q, lo) => tiles.push({ lo, b: [q.x, q.y, q.x + q.w, q.y + q.h], e: mk("image", { href: base + q.f, x: q.x, y: q.y, width: q.w, height: q.h, preserveAspectRatio: "none", style: "display:none" }, reliefG) });
      im(R.lo, 1); R.tiles.forEach((q) => im(q, 0)); }
    if (PAPER) [shadowG, coastG, coast2G].forEach((e) => (e.style.display = "none"));
    if (PAPER && !o.drawBorders && !o.borders) linesG.style.display = "none";
    if (ATLAS && !PAPER && o.grain !== false) host.appendChild(document.createElement("div")).style.cssText = `position:absolute;inset:0;pointer-events:none;background-image:url(${o.grainPath || "paper.jpg"});background-size:512px 512px;mix-blend-mode:multiply;opacity:${o.grain == null ? 0.55 : o.grain}`;
    const ov = mk("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: "position:absolute;left:0;top:0;overflow:hidden;pointer-events:none" }, host);
    gsap.set(linesG, { attr: { "stroke-dasharray": 1, "stroke-dashoffset": o.drawBorders ? 1 : 0 } });

    // ---------- camera ----------
    const asp = W / H, M = { el: host, svg, ov, T, W, H, tl, cam: null };
    const bboxOf = (spec) => {
      const cc = (k) => { const c = G.countries[String(k).toUpperCase()]; if (!c) throw new Error("maps: unknown country " + k); return c.b; };
      if (spec === "world") return [-13497, project(0, 84)[1], 13571, project(0, -57)[1]];
      if (typeof spec === "string" && REGIONS[spec]) spec = REGIONS[spec];
      if (typeof spec === "string") return cc(spec);
      if (Array.isArray(spec) && typeof spec[0] === "string") { const bs = spec.map(cc); return [Math.min(...bs.map((b) => b[0])), Math.min(...bs.map((b) => b[1])), Math.max(...bs.map((b) => b[2])), Math.max(...bs.map((b) => b[3]))]; }
      if (spec && !Array.isArray(spec) && spec.lon) spec = [spec.lon[0], spec.lat[0], spec.lon[1], spec.lat[1]];
      if (Array.isArray(spec) && spec.length === 4) { const p = []; for (let i = 0; i <= 16; i++) { const u = i / 16, lo = spec[0] + (spec[2] - spec[0]) * u, la = spec[1] + (spec[3] - spec[1]) * u; p.push(project(lo, spec[1]), project(lo, spec[3]), project(spec[0], la), project(spec[2], la)); }
        return [Math.min(...p.map((q) => q[0])), Math.min(...p.map((q) => q[1])), Math.max(...p.map((q) => q[0])), Math.max(...p.map((q) => q[1]))]; }
      throw new Error("maps: bad view " + JSON.stringify(spec));
    };
    const fit = (spec, pad) => {
      if (spec && spec.cx != null) return { cx: spec.cx, cy: spec.cy, w: spec.w };
      const b = bboxOf(spec), p = pad == null ? (spec === "world" ? 0.01 : 0.08) : pad, bw = (b[2] - b[0]) * (1 + 2 * p), bh = (b[3] - b[1]) * (1 + 2 * p);
      return { cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, w: Math.max(bw, bh * asp) };
    };
    M.fit = fit;
    let v0 = o.view || "world"; if (v0 === "region") v0 = o.region || "asia";
    M.cam = fit(v0, o.pad);
    const pt = (p) => { if (typeof p === "string") { const c = CITIES[p.toLowerCase()] || WATERWAYS[p.toLowerCase()]; if (c) return project(c[0], c[1]); const k = G.countries[p.toUpperCase()]; if (k) return k.c; throw new Error("maps: unknown place " + p); } return project(p[0], p[1]); };
    M.pt = pt;

    // ---------- anchored screen-space overlay ----------
    /* paper: labels/tags fade out as their box nears the safe-area edge (seek-safe: a function of position), so zooms never crop text */
    const SAFE = Object.assign(wide ? { l: 60, r: W - 60, t: 52, b: H - 52 } : { l: 24, r: W - 24, t: 240, b: H - 400 }, o.safe || {});
    const DR = { x: 0, y: 0, z: 0, t: 0 }, LP = PAPER ? 0.35 : 0, RP = PAPER ? 0.12 : 0; // paper: continuous drift (px) + label/route parallax factors
    const anchors = [], arcs = [], focuses = [], hooks = []; // hooks: Doc2D extras redrawn with the camera
    M.hooks = hooks; M.anchor = (x, y) => anchor(x, y);
    const anchor = (x, y, lp) => { const g = mk("g", {}, ov), a = { g, x, y, lp }; anchors.push(a); return a; }; // lp: parallax factor (paper), default LP
    const chip = (par, text, c) => {
      c = c || {}; const fs = c.size || 36, w = Math.ceil(String(text).length * fs * 0.5 + (c.pad || 14) * 2), h = Math.ceil(fs * 1.2 + 12), g = mk("g", {}, par);
      if (CALM) mk("rect", { x: -w / 2, y: -h / 2 + 5, width: w, height: h, rx: 6, fill: "rgba(0,0,0,.22)", filter: "blur(3px)" }, g);
      else mk("rect", { x: -w / 2 + 4, y: -h / 2 + 4, width: w, height: h, rx: 9, fill: T.shadow }, g);
      mk("rect", { x: -w / 2, y: -h / 2, width: w, height: h, rx: CALM ? 6 : 9, fill: c.fill || T.paper, stroke: CALM ? "none" : T.ink, "stroke-width": 3.5 }, g);
      const t = mk("text", { x: 0, y: 1, "text-anchor": "middle", "dominant-baseline": "central", "font-family": CALM ? "Oswald,Impact,sans-serif" : "Anton,Impact,sans-serif", "font-weight": CALM ? 600 : 400, "font-size": fs, "letter-spacing": fs * (CALM ? 0.08 : 0.03), fill: c.color || T.ink }, g); t.textContent = String(text).toUpperCase();
      return { g, w, h, t };
    };
    M.chip = chip;
    const hide = (e) => { e.style.opacity = 0; return e; };
    const O0 = (e) => { gsap.set(e, { transformOrigin: "0px 0px" }); return e; };
    const pop = (e, t, d) => { tl.set(e, { opacity: 1 }, t);
      if (CALM) { tl.fromTo(e, { opacity: 0, scale: 0.9, y: 10 }, { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: "power3.out", immediateRender: false }, t); return; }
      tl.fromTo(e, { scale: 0, rotation: -6 }, { scale: 1, rotation: 0, duration: d || 0.28, ease: "back.out(2.6)", immediateRender: false }, t); };

    // ---------- draw: pure function of state ----------
    function draw() {
      const c = M.cam, w = c.w / (1 + DR.z), h = w / asp, s = w / W, vx = c.cx + DR.x * s - w / 2, vy = c.cy + DR.y * s - h / 2;
      svg.setAttribute("viewBox", `${vx} ${vy} ${w} ${h}`);
      if (PAPER) { // sea sheet sits deeper: half the drift; labels ride higher (LP); tiles by LOD + view
        const ws = c.w / (1 + DR.z * 0.5), ss = ws / W, hs = ws / asp, sx = c.cx + DR.x * 0.5 * s - ws / 2, sy = c.cy + DR.y * 0.5 * s - hs / 2;
        seaSvg.setAttribute("viewBox", `${sx} ${sy} ${ws} ${hs}`);
        ptiles.forEach((q) => { const X0 = q.sea ? sx : vx, Y0 = q.sea ? sy : vy, ww = q.sea ? ws : w, hh = q.sea ? hs : h, on = (q.lo ? s > 6 : s <= 6) && q.b[2] > X0 && q.b[0] < X0 + ww && q.b[3] > Y0 && q.b[1] < Y0 + hh; q.e.style.display = on ? "" : "none"; });
        if (shim) shim.style.backgroundPosition = `${(-sx / ss + DR.t * 11).toFixed(1)}px ${(-sy / ss + DR.t * 5).toFixed(1)}px, ${(-sx / ss - DR.t * 7).toFixed(1)}px ${(-sy / ss + DR.t * 9).toFixed(1)}px`;
        topG.setAttribute("transform", `translate(${(-DR.x * RP * s).toFixed(2)} ${(-DR.y * RP * s).toFixed(2)})`); }
      grat.setAttribute("stroke-width", 1.6 * s); grat.setAttribute("stroke-dasharray", `${9 * s} ${9 * s}`);
      shadowG.setAttribute("stroke-width", 6 * s); shadowG.setAttribute("transform", ATLAS ? `translate(${3 * s} ${6 * s})` : `translate(${SH * s} ${SH * s})`);
      if (ATLAS) { blur.setAttribute("stdDeviation", 7 * s); coast2G.setAttribute("stroke-width", 1.1 * s); coast2G.setAttribute("transform", `translate(${-2.6 * s} ${2.2 * s})`);
        grat.setAttribute("stroke-dasharray", "none"); grat.setAttribute("stroke-width", 1.1 * s);
        tiles.forEach((q) => { const on = (q.lo ? s > 6 : s <= 6) && q.b[2] > vx && q.b[0] < vx + w && q.b[3] > vy && q.b[1] < vy + h; q.e.style.display = on ? "" : "none"; }); }
      coastG.setAttribute("stroke-width", (ATLAS ? 1.8 : CALM ? 2.4 : 6) * s); linesG.setAttribute("stroke-width", (o.border || (CALM ? 1.6 : 2.8)) * s);
      focuses.forEach((f) => {
        const k = f.p, sc = 1 + 0.04 * k, ce = f.c, off = (SH + 11 * k) * s, lift = 6 * k * s, tf = `translate(${ce[0]} ${ce[1]}) scale(${sc}) translate(${-ce[0]} ${-ce[1]})`;
        f.sh.setAttribute("transform", `translate(${off} ${off}) ${tf}`); f.sh.setAttribute("stroke-width", 6 * s);
        f.body.setAttribute("transform", `translate(${-lift} ${-lift}) ${tf}`); f.coast.setAttribute("stroke-width", 6 * s); f.line.setAttribute("stroke-width", (o.border || 2.8) * 1.15 * s);
      });
      arcs.forEach((A) => {
        const N = A.pts.length - 1, show = A.p > 0.001;
        A.g.style.display = show ? "" : "none"; if (!show) return;
        const f = A.p * N, n = Math.floor(f), pts = A.pts.slice(0, n + 1); if (f > n && n < N) pts.push([A.pts[n][0] + (A.pts[n + 1][0] - A.pts[n][0]) * (f - n), A.pts[n][1] + (A.pts[n + 1][1] - A.pts[n][1]) * (f - n)]);
        const d = "M" + pts.map((q) => q[0].toFixed(1) + " " + q[1].toFixed(1)).join("L"), dash = `0.01 ${19 * s}`;
        [A.sh, A.ln].forEach((e) => { e.setAttribute("d", d); e.setAttribute("stroke-width", 9 * s); e.setAttribute("stroke-dasharray", dash); e.setAttribute("stroke-dashoffset", -A.off * s); });
        A.sh.setAttribute("transform", `translate(${3.5 * s} ${3.5 * s})`);
        const tip = pts[pts.length - 1], pr = pts[Math.max(0, pts.length - 4)], ang = Math.atan2(tip[1] - pr[1], tip[0] - pr[0]), L = 32 * s, Wd = 20 * s, ca = Math.cos(ang), sa = Math.sin(ang);
        const P = (u, v) => `${(tip[0] + ca * u - sa * v).toFixed(1)},${(tip[1] + sa * u + ca * v).toFixed(1)}`;
        A.ah.setAttribute("points", `${P(L * 0.45, 0)} ${P(-L * 0.55, -Wd)} ${P(-L * 0.25, 0)} ${P(-L * 0.55, Wd)}`); A.ah.setAttribute("stroke-width", 4 * s);
        A.ahs.setAttribute("points", A.ah.getAttribute("points")); A.ahs.setAttribute("transform", `translate(${3.5 * s} ${3.5 * s})`);
        A.dots.forEach((D, i) => {
          const q = (A.q + i / A.dots.length) % 1, on = A.dotOn && A.p >= 0.999, ff = q * N, nn = Math.min(N - 1, Math.floor(ff)), r = ff - nn;
          const x = A.pts[nn][0] + (A.pts[nn + 1][0] - A.pts[nn][0]) * r, y = A.pts[nn][1] + (A.pts[nn + 1][1] - A.pts[nn][1]) * r;
          D.style.display = on ? "" : "none"; D.setAttribute("transform", `translate(${x} ${y})`);
          D.firstChild.setAttribute("r", 12 * s); D.firstChild.setAttribute("stroke-width", 4 * s); D.firstChild.setAttribute("cx", 3.5 * s); D.firstChild.setAttribute("cy", 3.5 * s);
          D.lastChild.setAttribute("r", 12 * s); D.lastChild.setAttribute("stroke-width", 4 * s);
        });
      });
      anchors.forEach((a) => { const ax = (a.x - vx) / s - DR.x * (a.lp == null ? LP : a.lp), ay = (a.y - vy) / s - DR.y * (a.lp == null ? LP : a.lp);
        a.g.setAttribute("transform", `translate(${ax.toFixed(2)} ${ay.toFixed(2)})`);
        if (a.box) { const b = a.box, m = Math.min(ax + b[0] - SAFE.l, ay + b[1] - SAFE.t, SAFE.r - ax - b[2], SAFE.b - ay - b[3]); a.g.setAttribute("opacity", clamp(m / 40, 0, 1).toFixed(3)); } });
      hooks.forEach((fn) => fn(vx + DR.x * RP * s, vy + DR.y * RP * s, s, w, h));
    }
    M.draw = draw;
    const run = (t, d, ease, fn, ex) => {
      const st = { p: 0 };
      tl.to(st, Object.assign({ p: 1, duration: d, ease, immediateRender: false, onUpdate: () => { fn(st.p); draw(); }, onComplete: () => { fn(1); draw(); }, onReverseComplete: () => { fn(0); draw(); } }, ex), t);
      return st;
    };

    // ---------- performances ----------
    M.drawBorders = (t, d) => { d = d || 1.4; tl.fromTo(linesG, { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: d, ease: "power2.inOut", immediateRender: false }, t); tl.set(linesG, { attr: { "stroke-dasharray": "none" } }, t + d + 0.01); };
    M.zoom = (view, t, d, z) => {
      z = z || {}; d = d || 1.6; const a = M._next || fit(v0, o.pad), b = fit(view, z.pad), ia = 1 / a.w, ib = 1 / b.w, same = Math.abs(ia - ib) < 1e-12; M._next = b;
      run(t, d, z.ease || "power2.inOut", (p) => {
        const w = Math.exp(Math.log(a.w) + (Math.log(b.w) - Math.log(a.w)) * p), u = same ? p : 1 - (1 - p) * (1 - p);
        M.cam = { cx: a.cx + (b.cx - a.cx) * u, cy: a.cy + (b.cy - a.cy) * u, w };
      });
      return M;
    };
    M.focus = (iso, t, f) => {
      f = f || {}; iso = iso.toUpperCase(); const ce = G.countries[iso].c, d = f.dur || 0.7, col = f.color || T.marker;
      const g = mk("g", { opacity: 0 }, topG), sh = mk("g", { fill: T.shadow, stroke: T.shadow, "stroke-linejoin": "round" }, g), body = mk("g", {}, g);
      use(sh, iso); const coast = mk("g", { fill: T.ink, stroke: T.ink, "stroke-linejoin": "round" }, body); use(coast, iso);
      const fl = use(mk("g", { fill: land }, body), iso), line = mk("g", { fill: "none", stroke: T.ink, "stroke-linejoin": "round" }, body); use(line, iso);
      const F = { p: 0, c: ce, sh, body, coast, line }; focuses.push(F);
      tl.set(g, { opacity: 1 }, t);
      run(t, d, CALM ? "power3.out" : "back.out(1.7)", (p) => { F.p = p; });
      tl.fromTo(fl.parentNode, { fill: land }, { fill: col, duration: d * 0.8, ease: "power2.out", immediateRender: false }, t);
      if (f.dim !== false) tl.fromTo(fillsG, { fill: land }, { fill: PAPER ? `rgba(19,34,59,${f.dimAmt == null ? 0.16 : f.dimAmt})` : mix(land, T.bg, f.dimAmt == null ? 0.3 : f.dimAmt), duration: d, ease: "power2.out", immediateRender: false }, t);
      if (f.label !== false) M.label(iso, t + d * 0.6, { text: f.label === true || f.label == null ? G.countries[iso].n : f.label, dx: f.dx, dy: f.dy, size: 40 });
      return M;
    };
    M.clear = (t, d) => { d = d || 0.4; const kids = Array.from(ov.children).concat(Array.from(topG.children)); if (kids.length) tl.to(kids, { opacity: 0, duration: d, ease: "power2.in" }, t); tl.to(fillsG, { fill: land, duration: d }, t); return M; };
    M.label = (where, t, l) => {
      l = l || {}; if (PAPER && !l.chip) return M.tag(where, t, l); if (ATLAS && !l.chip) return M.place(where, t, l);
      const p = pt(where), a = anchor(p[0], p[1]), w = mk("g", { transform: `translate(${l.dx || 0} ${l.dy || 0})` }, a.g), inner = O0(hide(mk("g", {}, w)));
      chip(inner, l.text || (typeof where === "string" ? title(where) : ""), l); pop(inner, t, 0.26); return M;
    };
    M.pin = (where, t, p) => {
      p = p || {}; const xy = pt(where), a = anchor(xy[0], xy[1]), k = p.size || 1.3, inner = hide(mk("g", {}, a.g));
      const sh = O0(mk("ellipse", { cx: 5, cy: 2, rx: 16 * k, ry: 5.5 * k, fill: T.shadow }, inner));
      const body = O0(mk("g", {}, inner)); mk("path", { d: "M0 0C-5 -13 -20 -24 -20 -40a20 20 0 1 1 40 0C20 -24 5 -13 0 0z", transform: `scale(${k})`, fill: p.color || T.marker, stroke: T.ink, "stroke-width": 4.5 / k, "stroke-linejoin": "round" }, body);
      mk("circle", { cx: 0, cy: -40 * k, r: 7.5 * k, fill: T.ink }, body);
      tl.set(inner, { opacity: 1 }, t);
      if (CALM) { // fade + short settle, no drop/squash
        tl.fromTo(inner, { opacity: 0, y: -26 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out", immediateRender: false }, t);
        if (p.label !== false) { const lt = p.label || title(where), wrap = mk("g", { transform: `translate(${(p.dx || 0) + 0} ${(p.dy || 0) - 92 * k})` }, a.g), c0 = chip(wrap, lt, { size: p.fs || 34 }); hide(c0.g); O0(c0.g); pop(c0.g, t + 0.35); }
        return M; }
      tl.fromTo(sh, { scale: 0.2 }, { scale: 1, duration: 0.22, ease: "power2.in", immediateRender: false }, t);
      tl.fromTo(body, { y: -170, scaleX: 0.9, scaleY: 1.12 }, { y: 0, scaleX: 1, scaleY: 1, duration: 0.22, ease: "power3.in", immediateRender: false }, t);
      tl.to(body, { scaleX: 1.22, scaleY: 0.72, duration: 0.06, ease: "power2.out" }, t + 0.22);
      tl.to(body, { scaleX: 1, scaleY: 1, y: -22 * k, duration: 0.13, ease: "power2.out" }, t + 0.28);
      tl.to(body, { y: 0, duration: 0.11, ease: "power2.in" }, t + 0.41);
      tl.to(body, { scaleX: 1.1, scaleY: 0.88, duration: 0.05 }, t + 0.52); tl.to(body, { scaleX: 1, scaleY: 1, duration: 0.12, ease: "back.out(3)" }, t + 0.57);
      if (p.label !== false) { const side = p.side || "r", lt = p.label || title(where), wrap = mk("g", {}, a.g), c0 = chip(wrap, lt, { size: p.fs || 34 }), inn = c0.g;
        const ox = { r: c0.w / 2 + 26 * k, l: -c0.w / 2 - 26 * k, t: 0, b: 0 }[side], oy = { r: -38 * k, l: -38 * k, t: -92 * k - c0.h / 2, b: c0.h / 2 + 18 }[side];
        wrap.setAttribute("transform", `translate(${(p.dx || 0) + ox} ${(p.dy || 0) + oy})`); hide(inn); O0(inn); pop(inn, t + 0.5, 0.26); }
      return M;
    };
    const arcPts = (a, b, bend) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), c = [(a[0] + b[0]) / 2 - dy * bend, (a[1] + b[1]) / 2 + dx * bend], out = [];
      for (let i = 0; i <= 90; i++) { const u = i / 90, v = 1 - u; out.push([v * v * a[0] + 2 * u * v * c[0] + u * u * b[0], v * v * a[1] + 2 * u * v * c[1] + u * u * b[1]]); } return out; };
    const rings = (where, t, n, col) => { const xy = pt(where), a = anchor(xy[0], xy[1]), g = mk("g", {}, a.g), base = O0(mk("circle", { r: 9, fill: col || T.marker, stroke: T.ink, "stroke-width": 4.5, opacity: 0 }, g));
      tl.fromTo(base, { scale: 0, opacity: 1 }, { scale: 1, opacity: 1, duration: CALM ? 0.4 : 0.25, ease: CALM ? "power3.out" : "back.out(3)", immediateRender: false }, t);
      [0, 0.32].forEach((dl) => { const r = O0(mk("circle", { r: 14, fill: "none", stroke: T.ink, "stroke-width": 4, opacity: 0 }, g));
        tl.fromTo(r, { scale: 0.5, opacity: 1 }, { scale: 2.6, opacity: 0, duration: 0.9, ease: "power1.out", repeat: n, repeatDelay: 0.15, immediateRender: false }, t + 0.2 + dl); }); };
    function makeArc(from, to, t, r) {
      r = r || {}; const A = { pts: arcPts(pt(from), pt(to), r.bend == null ? 0.22 : r.bend), p: 0, q: 0, off: 0, dotOn: 0, dots: [] }, col = r.color || T.marker;
      A.g = mk("g", { "stroke-linecap": "round" }, topG); A.sh = mk("path", { fill: "none", stroke: T.shadow }, A.g); A.ln = mk("path", { fill: "none", stroke: T.ink }, A.g);
      A.ahs = mk("polygon", { fill: T.shadow, stroke: T.shadow, "stroke-linejoin": "round" }, A.g); A.ah = mk("polygon", { fill: col, stroke: T.ink, "stroke-linejoin": "round" }, A.g);
      for (let i = 0; i < (r.dots || 1); i++) { const D = mk("g", { style: "display:none" }, A.g); mk("circle", { fill: T.shadow, stroke: T.shadow }, D); mk("circle", { fill: col, stroke: T.ink }, D); A.dots.push(D); }
      arcs.push(A); const d = r.dur || 1.1;
      tl.to(A, { p: 1, duration: d, ease: "power2.inOut", immediateRender: false, onUpdate: draw, onComplete: draw, onReverseComplete: draw }, t);
      const loops = r.loops || 2, per = r.per || 1.4;
      tl.to(A, { off: 15 * 6 * (d + loops * per), duration: d + loops * per, ease: "none", immediateRender: false, onUpdate: draw }, t);
      tl.set(A, { dotOn: 1 }, t + d);
      tl.to(A, { q: 1, duration: per, ease: "none", repeat: loops - 1, immediateRender: false, onUpdate: draw, onComplete: () => { A.q = 0.999; draw(); } }, t + d);
      return A;
    }
    M.route = (from, to, t, r) => { r = r || {}; makeArc(from, to, t, r); const n = r.rings == null ? 1 : r.rings; rings(from, t, n); rings(to, t + (r.dur || 1.1) * 0.9, n);
      if (r.labels !== false) { if (r.fromLabel !== "") M.label(from, t + 0.1, { text: r.fromLabel || (typeof from === "string" ? title(from) : ""), dy: -50 }); M.label(to, t + (r.dur || 1.1), { text: r.toLabel || (typeof to === "string" ? title(to) : ""), dy: -50 }); } return M; };
    M.tradeFlow = (hub, targets, t, r) => { r = r || {}; targets.forEach((tg, i) => { const at = t + i * (r.gap || 0.28); makeArc(hub, tg, at, { dur: 0.9, bend: i % 2 ? -0.2 : 0.2, loops: r.loops || 2, per: r.per || 1.3, dots: 2 }); rings(tg, at + 0.8, 0);
      if (r.labels !== false) M.label(tg, at + 0.9, { text: typeof tg === "string" ? title(tg) : "", dy: -48, size: 26 }); }); rings(hub, t, 0); return M; };
    M.choropleth = (data, t, c) => {
      c = c || {}; const keys = Object.keys(data).sort((a, b) => data[a] - data[b]), vals = keys.map((k) => data[k]), lo = Math.min(...vals), hi = Math.max(...vals);
      const ramp = c.ramp || [T.pale, mix(T.pale, T.marker, 0.5), T.marker, mix(T.marker, T.deep, 0.5), T.deep];
      const cls = (v) => clamp(Math.floor(((v - lo) / (hi - lo || 1)) * 5), 0, 4), gap = c.stagger || 0.3, unit = c.unit || "";
      keys.forEach((k, i) => { const at = t + i * gap, e = fillUse[k.toUpperCase()]; tl.fromTo(e, { fill: land }, { fill: ramp[cls(data[k])], duration: 0.3, ease: "power2.out", immediateRender: false }, at);
        if (c.values !== false) { const ce = G.countries[k.toUpperCase()].c, a = anchor(ce[0], ce[1]), w = mk("g", { transform: `translate(${(c.off && c.off[k]) ? c.off[k][0] : 0} ${(c.off && c.off[k]) ? c.off[k][1] : 0})` }, a.g), inn = O0(hide(mk("g", {}, w)));
          chip(inn, (c.fmt ? c.fmt(data[k]) : data[k]) + unit, { size: 30 }); pop(inn, at + 0.1, 0.25); } });
      const lx = c.legendX == null ? 48 : c.legendX, ly = c.legendY == null ? H - 120 : c.legendY, lgw = mk("g", { transform: `translate(${lx} ${ly - 40}) scale(1.4)` }, ov), lg = O0(hide(mk("g", {}, lgw))), lw = Math.max(5 * 46 + 34, (c.title || '').length * 15 + 36);
      mk("rect", { x: 4, y: 4, width: lw, height: 92, rx: 12, fill: T.shadow }, lg); mk("rect", { width: lw, height: 92, rx: 12, fill: T.paper, stroke: T.ink, "stroke-width": 4 }, lg);
      const tt = mk("text", { x: 18, y: 30, "font-family": "Anton,Impact,sans-serif", "font-size": 24, "letter-spacing": 0.8, fill: T.ink }, lg); tt.textContent = (c.title || "").toUpperCase();
      ramp.forEach((col, i) => mk("rect", { x: 18 + i * 46, y: 42, width: 44, height: 24, fill: col, stroke: T.ink, "stroke-width": 3 }, lg));
      [["LOW " + lo + unit, 18, "start"], ["HIGH " + hi + unit, 18 + 5 * 46 - 2, "end"]].forEach((q) => { const e = mk("text", { x: q[1], y: 86, "text-anchor": q[2], "font-family": "Anton,Impact,sans-serif", "font-size": 20, fill: T.ink }, lg); e.textContent = q[0]; }); tl.set(lg, { opacity: 1 }, t); tl.fromTo(lg, { scale: 0.6, y: 20 }, { scale: 1, y: 0, duration: 0.3, ease: "back.out(2)", immediateRender: false }, t); return M;
    };
    M.count = (where, n, t, c) => {
      c = c || {}; const xy = pt(where), a = anchor(xy[0], xy[1]);
      let DX = c.dx, DY = c.dy == null ? -60 : c.dy, EX = 0; const wd0 = Math.max(200, ((c.prefix || "") + Math.round(n).toLocaleString("en-US") + (c.suffix || "")).length * 40 + 44), cc = typeof where === "string" && G.countries[where.toUpperCase()];
      if (cc && DX == null) { // auto-place on the side with free room; stem ends inside the outline, away from the label
        const cam = M._next || fit(v0, o.pad), sc = cam.w / W, b = cc.b, sx = (xy[0] - (cam.cx - cam.w / 2)) / sc, rx = (b[2] - xy[0]) / sc, lx = (xy[0] - b[0]) / sc, side = W - (sx + rx) >= sx - lx ? 1 : -1, e = side > 0 ? rx : lx;
        DX = side * (e + 34 + wd0 / 2); DX = clamp(DX, -(sx - wd0 / 2 - 24), W - sx - wd0 / 2 - 24); EX = side * Math.max(e * 0.6, 90);
      } else if (DX == null) { DX = 70; DY = c.dy == null ? -90 : c.dy; }
      const w = mk("g", { transform: `translate(${DX} ${DY})` }, a.g), inn = O0(hide(mk("g", {}, w))), fmt = (v) => (c.prefix || "") + Math.round(v).toLocaleString("en-US") + (c.suffix || "");
      const wd = Math.max(200, fmt(n).length * 40 + 44), hh = c.label ? 148 : 84; mk("line", { x1: 0, y1: 0, x2: EX - DX, y2: -DY, stroke: T.ink, "stroke-width": 4, "stroke-linecap": "round" }, inn);
      mk("circle", { cx: EX - DX, cy: -DY, r: 8, fill: T.ink }, inn);
      const st = mk("g", { transform: `rotate(${c.tilt == null ? -4 : c.tilt})` }, inn);
      mk("rect", { x: -wd / 2 + 6, y: -hh / 2 + 6, width: wd, height: hh, rx: 14, fill: T.shadow }, st); mk("rect", { x: -wd / 2, y: -hh / 2, width: wd, height: hh, rx: 14, fill: T.marker, stroke: T.ink, "stroke-width": 5 }, st);
      const num = mk("text", { x: 0, y: c.label ? -28 : 2, "text-anchor": "middle", "dominant-baseline": "central", "font-family": "Anton,Impact,sans-serif", "font-size": 58, fill: T.ink }, st); num.textContent = fmt(0);
      if (c.label) { const lb = mk("text", { x: 0, y: 48, "text-anchor": "middle", "dominant-baseline": "central", "font-family": "Anton,Impact,sans-serif", "font-size": 24, "letter-spacing": 1, fill: T.ink }, st); lb.textContent = String(c.label).toUpperCase(); }
      pop(inn, t, 0.3); const s = { v: 0 }; tl.to(s, { v: n, duration: c.dur || 0.9, ease: "power2.out", immediateRender: false, onUpdate: () => { num.textContent = fmt(s.v); }, onComplete: () => { num.textContent = fmt(n); }, onReverseComplete: () => { num.textContent = fmt(0); } }, t + 0.1); return M;
    };

    // ================= Doc2D extras (new verbs; reels never call them) =================
    const ovDefs = mk("defs", {}, ov);
    const rough = mk("filter", { id: ids + "rough", x: "-10%", y: "-10%", width: "120%", height: "120%" }, ovDefs);
    mk("feTurbulence", { type: "fractalNoise", baseFrequency: 0.045, numOctaves: 2, seed: 4, result: "n" }, rough);
    mk("feDisplacementMap", { in: "SourceGraphic", in2: "n", scale: 2.6, xChannelSelector: "R", yChannelSelector: "G" }, rough);
    const softF = mk("filter", { id: ids + "gsh", x: "-40%", y: "-40%", width: "180%", height: "180%" }, ovDefs); mk("feGaussianBlur", { stdDeviation: 3 }, softF);
    const lonlat = (p) => { if (typeof p === "string") { const c = CITIES[p.toLowerCase()]; if (c) return c; const k = G.countries[p.toUpperCase()]; if (k) return Maps.unproject(k.c[0], k.c[1]); throw new Error("maps: unknown place " + p); } return p; };
    const scr = (q, vx, vy, s) => [(q[0] - vx) / s, (q[1] - vy) / s];
    const dStr = (pts) => "M" + pts.map((q) => q[0].toFixed(1) + " " + q[1].toFixed(1)).join("L");
    const cum = (pts) => { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return c; };
    const at = (pts, c, d) => { // point + angle at arc length d along a polyline
      d = clamp(d, 0, c[c.length - 1]); let i = 1; while (i < c.length - 1 && c[i] < d) i++;
      const a = pts[i - 1], b = pts[i], u = (d - c[i - 1]) / ((c[i] - c[i - 1]) || 1);
      return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, ang: Math.atan2(b[1] - a[1], b[0] - a[0]), i };
    };
    const upto = (pts, c, d) => { const e = at(pts, c, d), out = pts.slice(0, e.i); out.push([e.x, e.y]); return out; };
    const smooth = (P, n) => { // Catmull-Rom through projected waypoints
      if (P.length < 3) { const out = []; for (let i = 0; i <= n; i++) { const u = i / n; out.push([P[0][0] + (P[1][0] - P[0][0]) * u, P[0][1] + (P[1][1] - P[0][1]) * u]); } return out; }
      const out = [], seg = P.length - 1, k = Math.max(4, Math.round(n / seg));
      for (let i = 0; i < seg; i++) { const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(seg, i + 2)];
        for (let j = 0; j < k; j++) { const u = j / k, u2 = u * u, u3 = u2 * u;
          out.push([0, 1].map((a) => 0.5 * (2 * p1[a] + (-p0[a] + p2[a]) * u + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * u2 + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * u3))); } }
      out.push(P[seg]); return out;
    };
    const great = (a, b, n) => { // great-circle samples between two [lon,lat], projected
      const R = Math.PI / 180, v = (q) => [Math.cos(q[1] * R) * Math.cos(q[0] * R), Math.cos(q[1] * R) * Math.sin(q[0] * R), Math.sin(q[1] * R)];
      const A = v(a), B = v(b), om = Math.acos(clamp(A[0] * B[0] + A[1] * B[1] + A[2] * B[2], -1, 1)), out = [];
      for (let i = 0; i <= n; i++) { const u = i / n, s0 = om < 1e-6 ? 1 - u : Math.sin((1 - u) * om) / Math.sin(om), s1 = om < 1e-6 ? u : Math.sin(u * om) / Math.sin(om);
        const x = s0 * A[0] + s1 * B[0], y = s0 * A[1] + s1 * B[1], z = s0 * A[2] + s1 * B[2]; out.push(project(Math.atan2(y, x) / R, Math.atan2(z, Math.hypot(x, y)) / R)); }
      return out;
    };
    const routePts = (route, kind, n) => { // [places] -> projected polyline
      if (kind === "great" && route.length === 2) return great(lonlat(route[0]), lonlat(route[1]), n || 120);
      if (kind === "arc" && route.length === 2) return arcPts(pt(route[0]), pt(route[1]), 0.18);
      return smooth(route.map(pt), n || 140);
    };
    const show = (e, t, d, y) => { tl.fromTo(e, { opacity: 0, y: y == null ? 8 : y }, { opacity: 1, y: 0, duration: d || 0.6, ease: "power3.out", immediateRender: false }, t); };
    const fade = (e, t, d) => tl.to(e, { opacity: 0, duration: d || 0.4, ease: "power2.in" }, t);

    /* M.place(where, t, {text, kind:"country|sea|city|region", size, color, dx, dy, rotate, track, out})
       Atlas lettering straight on the map: wide-tracked caps with a paper halo; letters settle from wider tracking. */
    M.place = (where, t, l) => {
      l = l || {}; const kind = l.kind || (typeof where === "string" && G.countries[where.toUpperCase()] && !CITIES[where.toLowerCase()] ? "country" : "city");
      const p = pt(where), a = anchor(p[0], p[1]), fs = l.size || { country: 30, sea: 24, city: 24, region: 40 }[kind] || 28;
      const g = mk("g", { transform: `translate(${l.dx || 0} ${l.dy || 0}) rotate(${l.rotate || 0})` }, a.g), inner = hide(mk("g", {}, g));
      const sea = kind === "sea", col = l.color || (sea ? T.seaLabel || T.deep : T.label || T.ink), tr = l.track == null ? (sea ? 0.42 : kind === "region" ? 0.5 : 0.3) : l.track;
      const lines = String(l.text || (typeof where === "string" ? (G.countries[where.toUpperCase()] && !CITIES[where.toLowerCase()] ? G.countries[where.toUpperCase()].n : title(where)) : "")).toUpperCase().split("\n");
      const tx = lines.map((ln, i) => { const e = mk("text", { x: 0, y: (i - (lines.length - 1) / 2) * fs * 1.25, "text-anchor": "middle", "dominant-baseline": "central",
        "font-family": sea ? "Plex,'IBM Plex Mono',monospace" : "Oswald,Impact,sans-serif", "font-weight": sea ? 500 : kind === "city" ? 500 : 600, "font-style": sea ? "italic" : "normal", "font-size": fs,
        fill: col, stroke: ATLAS ? T.paper : "none", "stroke-opacity": sea ? 0 : 0.85, "stroke-width": fs * 0.22, "stroke-linejoin": "round", "paint-order": "stroke", "letter-spacing": fs * tr }, inner); e.textContent = ln; return e; });
      const fin = [inner]; if (kind === "city" && l.dot !== false) { const dg = hide(mk("g", {}, a.g)); mk("circle", { cx: 0, cy: 0, r: 7, fill: T.paper, stroke: T.ink, "stroke-width": 3 }, dg); fin.push(dg); }
      tl.fromTo(fin, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: "sine.inOut", immediateRender: false }, t);
      if (l.out != null) fade(fin, l.out, 0.6);
      if (PAPER && l.edgeFade !== false) { const n = Math.max(...lines.map((x) => x.length)), hw = n * fs * (0.62 + tr) / 2 + 8, hh = lines.length * fs * 0.7 + 6, rr = Math.abs((l.rotate || 0) * Math.PI / 180), bw = hw * Math.cos(rr) + hh * Math.sin(rr), bh = hw * Math.sin(rr) + hh * Math.cos(rr), ox = l.dx || 0, oy = l.dy || 0; a.box = [ox - bw, oy - bh, ox + bw, oy + bh]; }
      tl.fromTo(tx, { attr: { "letter-spacing": fs * (tr + 0.25) } }, { attr: { "letter-spacing": fs * tr }, duration: 1.4, ease: "power3.out", immediateRender: false }, t);
      return M;
    };

    // ---- line draw-on: a soft glowing tip (default) or, opt-in, a pencil glyph travels the stroke while it draws ----
    const glowTip = (par, col, wd) => { // bright core + blurred halo + short fading trail of dots, all in the line colour
      const g = mk("g", {}, par), trail = [];
      for (let i = 10; i >= 1; i--) trail.push(mk("circle", { r: wd * (0.42 + 0.05 * (10 - i)), fill: col, opacity: 0.42 * Math.pow(1 - i / 11, 1.6) }, g));
      mk("circle", { r: wd * 2.3, fill: col, opacity: 0.5, filter: `url(#${ids}gsh)` }, g);
      mk("circle", { r: wd * 0.95, fill: mix(col, "#ffffff", 0.65) }, g);
      g.trail = trail.reverse(); return g; };
    const pencilGlyph = (par) => { // tip at 0,0; body up-right
      const g = mk("g", {}, par), sh = mk("g", { transform: "translate(12 16) rotate(-52)", opacity: 0.28, filter: `url(#${ids}gsh)` }, g);
      mk("path", { d: "M0 0L26 -9L160 -9L160 9L26 9Z", fill: "#000" }, sh);
      const b = mk("g", { transform: "rotate(-52)" }, g);
      mk("path", { d: "M0 0L26 -9L26 9Z", fill: "#E9C9A0" }, b); mk("path", { d: "M0 0L8 -2.8L8 2.8Z", fill: T.pencilLead || T.pencil || T.alert }, b);
      mk("rect", { x: 26, y: -9, width: 108, height: 18, fill: T.marker }, b); mk("rect", { x: 26, y: -9, width: 108, height: 6, fill: "#fff", opacity: 0.28 }, b);
      mk("rect", { x: 26, y: 3, width: 108, height: 6, fill: "#000", opacity: 0.12 }, b);
      mk("rect", { x: 134, y: -9.5, width: 14, height: 19, fill: "#B9C0C8" }, b); mk("rect", { x: 137, y: -9.5, width: 2, height: 19, fill: "#8C949E" }, b); mk("rect", { x: 142, y: -9.5, width: 2, height: 19, fill: "#8C949E" }, b);
      mk("path", { d: "M148 -9L160 -9Q164 0 160 9L148 9Z", fill: "#E58C8C" }, b);
      return g;
    };
    const rnd = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const strokeText = (text, size, seed) => { // -> [{d}] strokes in px, centred on 0,0 (baseline at +size/2)
      const k = size / 10, r = rnd(seed || 7), out = []; let x = 0;
      for (const ch of String(text).toUpperCase()) { const gl = HAND[ch] || HAND["?"]; if (!gl) { x += 5; continue; }
        const rot = (r() - 0.5) * 4, dy = (r() - 0.5) * 0.7, sc = 1 + (r() - 0.5) * 0.06;
        gl[1].split(/(?=M)/).filter(Boolean).forEach((sub) => out.push({ sub, x, rot, dy, sc })); x += gl[0] * sc + 0.9; }
      const W0 = (x - 0.9) * k;
      return out.map((q) => { const tx = -W0 / 2 + q.x * k, ty = -size / 2 + q.dy * k, ks = k * q.sc;
        return { d: q.sub, tf: `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) skewX(-9) rotate(${q.rot.toFixed(2)}) scale(${ks.toFixed(3)})`, k: ks, m: new DOMMatrix().translate(tx, ty).skewX(-9).rotate(q.rot).scale(ks) }; });
    };
    /* M.pencil(kind, spec, t, {color, width, dur, r, ry, w, text, size, dx, dy, bend, hold, cursor:"glow"|"pencil"|"none"})
       kind: "circle" (spec = place), "underline" (place), "write" (place; opts.text), "arrow" (spec = [from, to]), "path" (spec = [places]) */
    M.pencil = (kind, spec, t, p) => {
      p = p || {}; const col = p.color || T.pencil || T.alert, wd = p.width || 5.5, R = rnd(p.seed || 11);
      let host_ = ov, dyn = null, strokes = [], dur = p.dur;
      if (kind === "arrow" || kind === "path") {
        const geo = (kind === "arrow" ? [spec[0], spec[1]] : spec).map(pt);
        dyn = (vx, vy, s) => { const P = geo.map((q) => scr(q, vx, vy, s)).map((q) => [q[0] + (p.dx || 0), q[1] + (p.dy || 0)]);
          let line; if (P.length === 2) { const a = P[0], b = P[1], dx = b[0] - a[0], dy = b[1] - a[1], bd = p.bend == null ? 0.18 : p.bend, c = [(a[0] + b[0]) / 2 - dy * bd, (a[1] + b[1]) / 2 + dx * bd];
            const sh = p.shorten == null ? 18 : p.shorten, L = Math.hypot(dx, dy) || 1; line = []; for (let i = 0; i <= 40; i++) { const u = i / 40, v = 1 - u; line.push([v * v * a[0] + 2 * u * v * c[0] + u * u * b[0], v * v * a[1] + 2 * u * v * c[1] + u * u * b[1]]); }
            const cc = cum(line); line = upto(line, cc, cc[cc.length - 1] - sh * Math.min(1, L / 200)); }
          else line = smooth(P, 80);
          const d = [dStr(line)];
          if (kind === "arrow") { const n = line.length - 1, e = line[n], pr = line[Math.max(0, n - 3)], an = Math.atan2(e[1] - pr[1], e[0] - pr[0]), hl = p.head || 30;
            [0.5, -0.5].forEach((da) => d.push(`M${e[0].toFixed(1)} ${e[1].toFixed(1)}L${(e[0] - Math.cos(an + da) * hl).toFixed(1)} ${(e[1] - Math.sin(an + da) * hl).toFixed(1)}`)); }
          return d; };
        strokes = dyn(0, 0, 1).map(() => ({})); dur = dur || 1.1;
      } else {
        const xy = pt(spec), a = anchor(xy[0], xy[1]); host_ = mk("g", { transform: `translate(${p.dx || 0} ${p.dy || 0})` }, a.g);
        if (kind === "circle") { const rx = p.r || 70, ry = p.ry || rx * 0.8, a0 = -2.3, sw = Math.PI * 2 * 1.13, ph = R() * 6, tilt = (p.tilt == null ? -8 : p.tilt) * Math.PI / 180, q = [];
          for (let i = 0; i <= 96; i++) { const u = i / 96, th = a0 + sw * u, k = 1 + 0.035 * Math.sin(3 * th + ph) + 0.07 * u - 0.03, x = Math.cos(th) * rx * k, y = Math.sin(th) * ry * k;
            q.push([x * Math.cos(tilt) - y * Math.sin(tilt), x * Math.sin(tilt) + y * Math.cos(tilt)]); }
          strokes = [{ d: dStr(q) }]; dur = dur || 0.95; }
        else if (kind === "underline") { const w = p.w || 180, y = p.y == null ? 34 : p.y; strokes = [{ d: `M${-w / 2} ${y + 3}C${-w / 6} ${y - 4} ${w / 6} ${y + 2} ${w / 2} ${y - 3}` }]; if (p.double) strokes.push({ d: `M${-w / 2 + 14} ${y + 13}C${-w / 8} ${y + 7} ${w / 6} ${y + 12} ${w / 2 - 10} ${y + 8}` }); dur = dur || 0.55; }
        else if (kind === "write") { strokes = strokeText(p.text || "", p.size || 46, p.seed); dur = dur || Math.max(0.6, strokes.length * 0.075); }
        else throw new Error("maps: pencil kind " + kind);
      }
      const sg = mk("g", { fill: "none", stroke: col, "stroke-width": wd, "stroke-linecap": "round", "stroke-linejoin": "round", filter: p.rough === false || (PAPER && !p.rough) ? null : `url(#${ids}rough)`, opacity: p.opacity || 0.95 }, host_);
      const els = strokes.map((q) => { const e = mk("path", { d: q.d || "M0 0" }, sg); if (q.tf) { e.setAttribute("transform", q.tf); e.setAttribute("stroke-width", wd / q.k); } e.style.display = "none"; return e; });
      const cur_ = p.cursor || "glow", pen = cur_ === "pencil" ? pencilGlyph(host_) : cur_ === "none" ? mk("g", {}, host_) : glowTip(host_, col, wd), tipG = pen.trail ? pen : null; pen.style.opacity = 0;
      const st = { p: 0, lift: 1, f: 0, m: 0 }; let L = null;
      const flowS = p.flow == null ? (PAPER && (kind === "path" || kind === "arrow") ? 6 : 0) : p.flow; // dash flow along the finished route (s)
      const flows = flowS > 0 ? els.slice(0, 1).map(() => mk("path", { fill: "none", stroke: mix(col, "#ffffff", 0.62), "stroke-width": wd * 0.42, "stroke-dasharray": `${wd * 1.8} ${wd * 2.6}`, "stroke-linecap": "round", style: "display:none" }, sg)) : [];
      const upd = (vx, vy, s) => {
        if (st.p <= 0 && st.lift >= 1) { els.forEach((e) => (e.style.display = "none")); pen.style.opacity = 0; return; }
        if (dyn) { dyn(vx, vy, s).forEach((d, i) => els[i].setAttribute("d", d)); L = null; }
        if (!L) L = els.map((e) => e.getTotalLength());
        const tot = L.reduce((a, b) => a + b, 0); let cur = st.p * tot, px = 0, py = 0, done = false, ti = 0, td = 0;
        els.forEach((e, i) => { const dr = clamp(cur, 0, L[i]); cur -= L[i];
          e.style.display = dr > 0.01 ? "" : "none"; e.setAttribute("stroke-dasharray", `${L[i] + 1} ${L[i] + 1}`); e.setAttribute("stroke-dashoffset", L[i] + 1 - dr);
          if (!done && (dr < L[i] || i === els.length - 1)) { done = true; let q = e.getPointAtLength(dr); if (strokes[i].m) q = strokes[i].m.transformPoint(q); px = q.x; py = q.y; ti = i; td = dr; } });
        if (tipG) { // tip sits on the stroke end; trail dots sample backwards along the current stroke; gone once the line is complete
          pen.style.opacity = ((1 - st.lift) * clamp((1 - st.p) * 25, 0, 1) * clamp(st.p * 40, 0, 1)).toFixed(3); pen.setAttribute("transform", `translate(${px.toFixed(1)} ${py.toFixed(1)})`);
          tipG.trail.forEach((c, k) => { let q = els[ti].getPointAtLength(Math.max(0, td - (k + 1) * wd * 1.3)); if (strokes[ti].m) q = strokes[ti].m.transformPoint(q); c.setAttribute("cx", (q.x - px).toFixed(1)); c.setAttribute("cy", (q.y - py).toFixed(1)); });
          flows.forEach((f, i) => { const on = st.f > 0 && st.p >= 0.999; f.style.display = on ? "" : "none"; if (on) { f.setAttribute("d", els[i].getAttribute("d")); f.setAttribute("stroke-dashoffset", (-st.m).toFixed(1)); } });
          return; }
        pen.style.opacity = 1 - st.lift; pen.setAttribute("transform", `translate(${(px + st.lift * 46).toFixed(1)} ${(py - st.lift * 60).toFixed(1)})`);
      };
      hooks.push(upd); const rd = () => draw();
      tl.fromTo(st, { lift: 1 }, { lift: 0, duration: 0.35, ease: "power2.out", immediateRender: false, onUpdate: rd, onReverseComplete: rd }, Math.max(0, t - 0.3));
      tl.fromTo(st, { p: 0 }, { p: 1, duration: dur, ease: kind === "write" ? "none" : "power1.inOut", immediateRender: false, onUpdate: rd, onComplete: rd, onReverseComplete: rd }, t);
      tl.to(st, { lift: 1, duration: 0.45, ease: "power2.in", immediateRender: false, onUpdate: rd, onComplete: rd }, t + dur + (p.hold || 0.05));
      if (flowS > 0) { tl.set(st, { f: 1 }, t + dur); tl.fromTo(st, { m: 0 }, { m: 34 * flowS, duration: flowS, ease: "none", immediateRender: false, onUpdate: rd }, t + dur); }
      return M;
    };

    /* M.front(route, t, {color, dur, hold, area:[ISO...], reach, width, label})  route = [places] (or [ISO...] -> area defaults to them)
       Chevrons march along a growing band; the area behind the front fills in (hatched tint) as the front advances. */
    M.front = (route, t, f) => {
      f = f || {}; const col = f.color || T.alert, isoR = route.every((r) => typeof r === "string" && G.countries[r.toUpperCase()] && !CITIES[r.toLowerCase()]);
      const area = f.area || (isoR ? route : null), P = routePts(route, f.path || "smooth", 160), C = cum(P), LT = C[C.length - 1], dur = f.dur || 2.4, hold = f.hold == null ? 4 : f.hold;
      const g = mk("g", { opacity: 0 }, topG), mid = ids + "fr" + hooks.length;
      let maskP = null, pat = null, hatch = null, areaG = null;
      if (area) {
        const mask = mk("mask", { id: mid, maskUnits: "userSpaceOnUse", x: -30000, y: -20000, width: 60000, height: 40000 }, defs);
        let reach = f.reach; if (!reach) { const bs = area.map((k) => G.countries[k.toUpperCase()].b); reach = 1.25 * Math.max(Math.max(...bs.map((b) => b[2])) - Math.min(...bs.map((b) => b[0])), Math.max(...bs.map((b) => b[3])) - Math.min(...bs.map((b) => b[1]))); }
        maskP = mk("path", { d: dStr(P), fill: "none", stroke: "#fff", "stroke-width": reach, "stroke-linecap": "round", "stroke-linejoin": "round" }, mask);
        pat = mk("pattern", { id: mid + "h", patternUnits: "userSpaceOnUse", width: 10, height: 10, patternTransform: "rotate(35)" }, defs); hatch = mk("rect", { x: 0, y: 0, width: 3, height: 10, fill: col, opacity: 0.38 }, pat);
        areaG = mk("g", { mask: `url(#${mid})` }, g);
        const fillA = mk("g", { fill: col, "fill-opacity": f.fillOpacity || 0.26 }, areaG), hatchA = mk("g", { fill: `url(#${mid}h)` }, areaG), edge = mk("g", { fill: "none", stroke: col, "stroke-opacity": 0.85, "stroke-linejoin": "round" }, areaG);
        area.forEach((k) => { k = k.toUpperCase(); use(fillA, k); use(hatchA, k); use(edge, k); }); areaG.edge = edge;
      }
      const band = mk("path", { fill: "none", stroke: col, "stroke-opacity": 0.3, "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
      const chev = []; for (let i = 0; i < 48; i++) chev.push(mk("path", { d: "M-9 -13L5 0L-9 13", fill: "none", stroke: f.chevron || mix(col, T.ink, 0.45), "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round", style: "display:none" }, g));
      const headSh = mk("path", { d: "M26 0L-16 -24L-8 0L-16 24Z", fill: T.ink, opacity: 0.22 }, g), head = mk("path", { d: "M26 0L-16 -24L-8 0L-16 24Z", fill: col, stroke: T.paper, "stroke-width": 3, "stroke-linejoin": "round" }, g);
      const st = { p: 0, m: 0 };
      hooks.push((vx, vy, s) => {
        const Ld = st.p * LT; g.style.display = st.p > 0.001 ? "" : "none"; if (st.p <= 0.001) return;
        const bw = (f.width || 34) * s; band.setAttribute("d", dStr(upto(P, C, Ld))); band.setAttribute("stroke-width", bw);
        if (maskP) { maskP.setAttribute("stroke-dasharray", `${Ld} ${LT * 2 + 1}`); pat.setAttribute("width", 12 * s); pat.setAttribute("height", 12 * s); hatch.setAttribute("width", 3.2 * s); hatch.setAttribute("height", 12 * s); areaG.edge.setAttribute("stroke-width", 2.2 * s); }
        const sp = 64 * s, off = (st.m * s) % sp, tip = Ld - 30 * s;
        chev.forEach((e, i) => { const d = off + i * sp; if (d > tip - 10 * s || d < 6 * s) { e.style.display = "none"; return; } const q = at(P, C, d), a = clamp(Math.min(d / (1.5 * sp), (tip - d) / sp), 0, 1);
          e.style.display = ""; e.setAttribute("opacity", a.toFixed(3)); e.setAttribute("transform", `translate(${q.x.toFixed(1)} ${q.y.toFixed(1)}) rotate(${(q.ang * 180 / Math.PI).toFixed(1)}) scale(${(1.35 * s * (f.width || 34) / 34).toFixed(3)})`); e.setAttribute("stroke-width", 5); });
        const hq = at(P, C, Ld), tf = `translate(${hq.x.toFixed(1)} ${hq.y.toFixed(1)}) rotate(${(hq.ang * 180 / Math.PI).toFixed(1)}) scale(${(s * 1.25).toFixed(3)})`; head.setAttribute("transform", tf); headSh.setAttribute("transform", `translate(${2 * s} ${5 * s}) ` + tf);
      });
      const rd = () => draw(); tl.set(g, { opacity: 1 }, t);
      tl.fromTo(st, { p: 0 }, { p: 1, duration: dur, ease: f.ease || "power2.inOut", immediateRender: false, onUpdate: rd, onComplete: rd, onReverseComplete: rd }, t);
      tl.fromTo(st, { m: 0 }, { m: 70 * (dur + hold), duration: dur + hold, ease: "none", immediateRender: false, onUpdate: rd }, t);
      if (f.label) M.place(f.labelAt || route[route.length - 1], t + dur * 0.8, { text: f.label, kind: "region", color: col, dx: f.labelDx || 0, dy: f.labelDy || -70, size: f.labelSize || 30 });
      return M;
    };

    /* M.mover(from, to, t, {glyph:"ship|plane|truck", color, dur, via:[places], path:"great|smooth|arc", size, trail, fadeOut, ease})
       Glyph rides a great-circle (plane default) or smoothed waypoint route (ship/truck), auto-rotated to the tangent. */
    const GLYPH = {
      ship: (g, c) => { mk("path", { d: "M36 0C30 -8 20 -11 8 -11L-31 -11Q-35 -11 -35 -7L-35 7Q-35 11 -31 11L8 11C20 11 30 8 36 0Z", fill: c, stroke: T.paper, "stroke-width": 2.5 }, g);
        [[-18, -7], [-6, -7], [6, -7], [-18, 1], [-6, 1], [6, 1]].forEach((q, i) => mk("rect", { x: q[0], y: q[1], width: 10.5, height: 6, rx: 1, fill: [T.marker, T.paper, T.teal || T.deep, T.paper, T.alert, T.marker][i], opacity: 0.95 }, g));
        mk("rect", { x: -32, y: -8, width: 9, height: 16, rx: 2, fill: T.paper }, g); },
      plane: (g, c) => mk("path", { d: "M34 0Q34 -3 28 -3.4L6 -4L-6 -27Q-8 -30 -12 -30L-9 -4L-24 -4L-30 -13L-35 -13L-31 0L-35 13L-30 13L-24 4L-9 4L-12 30Q-8 30 -6 27L6 4L28 3.4Q34 3 34 0Z", fill: c, stroke: T.paper, "stroke-width": 2.5, "stroke-linejoin": "round" }, g),
      tanker: (g, c) => { mk("path", { d: "M48 0C42 -9 30 -12 14 -12L-44 -12Q-48 -12 -48 -8L-48 8Q-48 12 -44 12L14 12C30 12 42 9 48 0Z", fill: c, stroke: T.paper, "stroke-width": 2.5 }, g);
        mk("path", { d: "M-30 0L34 0M-24 -6L26 -6M-24 6L26 6", stroke: T.paper, "stroke-opacity": 0.55, "stroke-width": 1.6, fill: "none" }, g);
        [-14, 6, 24].forEach((x) => mk("circle", { cx: x, cy: 0, r: 3.2, fill: T.marker }, g)); mk("rect", { x: -45, y: -9, width: 10, height: 18, rx: 2, fill: T.paper }, g); },
      token: (g, c) => { mk("circle", { r: 15, fill: c, stroke: T.paper, "stroke-width": 3 }, g); mk("path", { d: "M-6 -5L8 0L-6 5Z", fill: T.paper }, g); },
      blip: (g, c) => { mk("path", { d: "M12 0L-7 -7L-3 0L-7 7Z", fill: c, stroke: "#0B1626", "stroke-width": 1.2, "stroke-linejoin": "round" }, g); },
      truck: (g, c) => { mk("rect", { x: -36, y: -10, width: 46, height: 20, rx: 2.5, fill: c, stroke: T.paper, "stroke-width": 2.5 }, g); mk("rect", { x: 13, y: -9, width: 20, height: 18, rx: 5, fill: T.paper, stroke: c, "stroke-width": 2.5 }, g); mk("rect", { x: 26, y: -6.5, width: 4, height: 13, rx: 1, fill: c }, g); },
    };
    M.GLYPH = GLYPH;
    M.mover = (from, to, t, m) => {
      m = m || {}; const gl = m.glyph || "ship", col = m.color || T.ink, route = [from].concat(m.via || [], [to]);
      const P = routePts(route, m.path || (gl === "plane" && !m.via ? "great" : "smooth"), 160), C = cum(P), LT = C[C.length - 1], dur = m.dur || 3;
      const trail = m.trail === false ? null : mk("path", { fill: "none", stroke: m.trailColor || col, "stroke-opacity": 0.55, "stroke-linecap": "round" }, topG);
      const a = { g: mk("g", {}, ov), x: 0, y: 0 }, inner = mk("g", { opacity: 0 }, a.g), k = m.size || 1;
      const GF = typeof gl === "function" ? gl : GLYPH[gl], sh = mk("g", { opacity: m.shadow === false ? 0 : 0.28, filter: `url(#${ids}gsh)`, transform: "translate(3 6)" }, inner); GF(sh, "#000");
      const body = mk("g", {}, inner); GF(body, col);
      const st = { q: 0 };
      hooks.push((vx, vy, s) => {
        const e = at(P, C, st.q * LT), e2 = at(P, C, Math.min(LT, st.q * LT + 6 * s)), e1 = at(P, C, Math.max(0, st.q * LT - 6 * s)), ang = Math.atan2(e2.y - e1.y, e2.x - e1.x) * 180 / Math.PI;
        a.g.setAttribute("transform", `translate(${((e.x - vx) / s).toFixed(2)} ${((e.y - vy) / s).toFixed(2)}) rotate(${ang.toFixed(2)}) scale(${k})`);
        if (trail) { const on = st.q > 0.002; trail.style.display = on ? "" : "none"; if (on) { trail.setAttribute("d", dStr(upto(P, C, st.q * LT))); trail.setAttribute("stroke-width", 3 * s); trail.setAttribute("stroke-dasharray", `${0.01} ${11 * s}`); } }
      });
      const rd = () => draw();
      tl.fromTo(inner, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.5, ease: "power3.out", immediateRender: false }, t);
      tl.fromTo(st, { q: m.q0 || 0 }, { q: 1, duration: dur, ease: m.ease || "sine.inOut", immediateRender: false, onUpdate: rd, onComplete: rd, onReverseComplete: rd }, t);
      if (m.fadeOut) { fade(inner, t + dur - 0.1, 0.5); if (trail) fade(trail, t + dur, 0.6); }
      return M;
    };

    /* M.trade(route, t, {color, dur, hold, width, path:"smooth|great|arc", speed, glow})  route line draws on, then dashes travel along it */
    M.trade = (route, t, r) => {
      r = r || {}; const col = r.color || T.marker, P = routePts(route, r.path || (route.length === 2 ? "arc" : "smooth"), 160), C = cum(P), LT = C[C.length - 1], dur = r.dur || 1.4, hold = r.hold == null ? 6 : r.hold;
      const g = mk("g", { "stroke-linecap": "round", "stroke-linejoin": "round", fill: "none" }, topG), glow = mk("path", { stroke: col, "stroke-opacity": 0.22 }, g), base = mk("path", { stroke: T.ink, "stroke-opacity": 0.35 }, g), dash = mk("path", { stroke: col }, g);
      const st = { p: 0, m: 0 }, tip = r.tip === false ? null : glowTip(ov, col, r.width || 5); if (tip) tip.style.opacity = 0;
      hooks.push((vx, vy, s) => { const on = st.p > 0.001; g.style.display = on ? "" : "none";
        if (tip) { const vis = on && st.p < 0.999; tip.style.opacity = vis ? clamp((1 - st.p) * 25, 0, 1).toFixed(3) : 0;
          if (vis) { const e = at(P, C, st.p * LT), ex = (e.x - vx) / s, ey = (e.y - vy) / s; tip.setAttribute("transform", `translate(${ex.toFixed(1)} ${ey.toFixed(1)})`);
            tip.trail.forEach((c, k) => { const q = at(P, C, Math.max(0, st.p * LT - (k + 1) * (r.width || 5) * 1.3 * s)); c.setAttribute("cx", ((q.x - vx) / s - ex).toFixed(1)); c.setAttribute("cy", ((q.y - vy) / s - ey).toFixed(1)); }); } }
        if (!on) return; const d = dStr(upto(P, C, st.p * LT)), wd = (r.width || 5) * s;
        [glow, base, dash].forEach((e) => e.setAttribute("d", d)); glow.setAttribute("stroke-width", wd * 3.2); base.setAttribute("stroke-width", wd * 0.5);
        dash.setAttribute("stroke-width", wd); dash.setAttribute("stroke-dasharray", `${16 * s} ${14 * s}`); dash.setAttribute("stroke-dashoffset", -st.m * s); });
      const rd = () => draw();
      tl.fromTo(st, { p: 0 }, { p: 1, duration: dur, ease: "power2.inOut", immediateRender: false, onUpdate: rd, onComplete: rd, onReverseComplete: rd }, t);
      tl.fromTo(st, { m: 0 }, { m: (r.speed || 60) * (dur + hold), duration: dur + hold, ease: "none", immediateRender: false, onUpdate: rd }, t);
      return M;
    };

    /* M.tag(where, t, {text, dx, dy, size, color, accent, out, rotate})  paper tag on a leader line. The dot sits on the land layer,
       the tag rides the label layer (parallax), the leader draws on first. Waterway keys (Maps.WATERWAYS) name themselves. */
    M.tag = (where, t, g) => {
      g = g || {}; const xy = pt(where), ww = typeof where === "string" && WATERWAYS[where.toLowerCase()];
      const text = String(g.text || (ww ? ww[2] : typeof where === "string" ? (G.countries[where.toUpperCase()] && !CITIES[where.toLowerCase()] ? G.countries[where.toUpperCase()].n : title(where)) : "")).toUpperCase();
      const fs = g.size || 28, tw = text.length * fs * 0.56 + 34, th = fs + 22, dx = g.dx == null ? 0 : g.dx, dy = g.dy == null ? -110 : g.dy, acc = g.accent || g.color || T.alert;
      const dotA = anchor(xy[0], xy[1], 0), tagA = anchor(xy[0], xy[1]);
      if (g.edgeFade !== false) { tagA.box = [dx - tw / 2 - 6, dy - th / 2 - 8, dx + tw / 2 + 8, dy + th / 2 + 8]; dotA.box = [Math.min(-12, tagA.box[0]), Math.min(-12, tagA.box[1]), Math.max(12, tagA.box[2]), Math.max(12, tagA.box[3])]; }
      const lead = mk("line", { stroke: T.ink, "stroke-width": 2.2, "stroke-opacity": 0.75, "stroke-linecap": "round", opacity: 0 }, dotA.g);
      const dot = mk("g", { opacity: 0 }, dotA.g); mk("circle", { r: 9, fill: T.paper, opacity: 0.9 }, dot); mk("circle", { r: 5.5, fill: acc }, dot);
      const wrap = mk("g", { transform: `translate(${dx} ${dy}) rotate(${g.rotate == null ? -1.5 : g.rotate})` }, tagA.g), inn = mk("g", { opacity: 0 }, wrap);
      [[7, 0.10], [4, 0.14]].forEach(([o, a]) => mk("rect", { x: -tw / 2 + o * 0.6, y: -th / 2 + o, width: tw, height: th, rx: 3, fill: T.ink, opacity: a }, inn));
      mk("rect", { x: -tw / 2, y: -th / 2, width: tw, height: th, rx: 3, fill: "#FBF6EC" }, inn);
      mk("rect", { x: -tw / 2, y: -th / 2, width: 7, height: th, fill: acc }, inn);
      const tx = mk("text", { x: 4, y: 1, "text-anchor": "middle", "dominant-baseline": "central", "font-family": "Oswald,Impact,sans-serif", "font-weight": 600, "font-size": fs, "letter-spacing": fs * 0.1, fill: T.ink }, inn); tx.textContent = text;
      const st = { p: 0 };
      hooks.push(() => { // leader from the dot to the tag's nearest edge, in the dot's frame
        const pa = dotA.g.getAttribute("transform"), pb = tagA.g.getAttribute("transform"), A = (pa || "").match(/-?[\d.]+/g), B = (pb || "").match(/-?[\d.]+/g); if (!A || !B) return;
        const ox = +B[0] - +A[0] + dx, oy = +B[1] - +A[1] + dy, ey = oy + (oy < 0 ? th / 2 : -th / 2), u = st.p;
        lead.setAttribute("x1", 0); lead.setAttribute("y1", 0); lead.setAttribute("x2", (ox * u).toFixed(1)); lead.setAttribute("y2", (ey * u).toFixed(1)); });
      const rd = () => draw();
      tl.fromTo(dot, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "sine.out", immediateRender: false }, t);
      tl.fromTo(lead, { opacity: 0 }, { opacity: 1, duration: 0.2, immediateRender: false }, t);
      tl.fromTo(st, { p: 0 }, { p: 1, duration: 0.45, ease: "power2.out", immediateRender: false, onUpdate: rd, onComplete: rd, onReverseComplete: rd }, t + 0.05);
      tl.fromTo(inn, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", immediateRender: false }, t + 0.35);
      if (g.out != null) fade([dot, lead, inn], g.out, 0.5);
      return M;
    };
    /* M.drift(t0, t1, {x, y, z})  continuous slow camera drift (screen px / zoom fraction) layered on any M.zoom; in skin paper the
       sea sheet moves at half the drift, routes at 1.12x, labels at 1.35x (parallax). Auto for skin paper: opts.drift = [t0, t1] | false. */
    M.drift = (t0, t1, d) => {
      d = d || {}; const rd = () => draw();
      tl.fromTo(DR, { x: 0, y: 0, z: 0, t: 0 }, { x: d.x == null ? -70 : d.x, y: d.y == null ? -26 : d.y, z: d.z == null ? 0.035 : d.z, t: t1 - t0, duration: t1 - t0, ease: "none", immediateRender: false, onUpdate: rd, onComplete: rd, onReverseComplete: rd }, t0);
      return M;
    };
    if (PAPER && o.drift !== false) { const w_ = Array.isArray(o.drift) ? o.drift : [0, 12]; M.drift(w_[0], w_[1], o.driftMove); }

    /* M.stat(where, n, t, {label, prefix, suffix, dx, dy, dur, decimals, color})  atlas-style number card with a thin leader to the place */
    M.stat = (where, n, t, c) => {
      c = c || {}; const xy = pt(where), a = anchor(xy[0], xy[1]), dx = c.dx == null ? 260 : c.dx, dy = c.dy == null ? -170 : c.dy, dec = c.decimals || 0;
      const fmt = (v) => (c.prefix || "") + (+v).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }) + (c.suffix || "");
      const fs = c.size || 72, wd = Math.max(fmt(n).length * fs * 0.5, String(c.label || "").length * 15.5) + 64, hh = fs + (c.label ? 76 : 40);
      const g = mk("g", {}, a.g), lead = mk("path", { d: `M0 0L${dx * 0.55} ${dy}L${dx - wd / 2} ${dy}`, fill: "none", stroke: T.ink, "stroke-width": 2.5, "stroke-opacity": 0.8, pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 }, g);
      const dot = mk("circle", { r: 6, fill: T.ink, opacity: 0 }, g);
      const card = mk("g", { transform: `translate(${dx} ${dy})` }, g), inn = hide(mk("g", {}, card));
      mk("rect", { x: -wd / 2, y: -hh / 2 + 10, width: wd, height: hh, rx: 10, fill: "rgba(10,18,32,.32)", filter: `url(#${ids}gsh)` }, inn);
      mk("rect", { x: -wd / 2, y: -hh / 2, width: wd, height: hh, rx: 10, fill: T.paper }, inn); mk("rect", { x: -wd / 2, y: -hh / 2, width: 10, height: hh, rx: 3, fill: c.color || T.alert }, inn);
      const num = mk("text", { x: 6, y: c.label ? -hh / 2 + 22 + fs * 0.5 : 2, "text-anchor": "middle", "dominant-baseline": "central", "font-family": "Oswald,Impact,sans-serif", "font-weight": 700, "font-size": fs, fill: T.ink }, inn); num.textContent = fmt(0);
      if (c.label) { const lb = mk("text", { x: 6, y: hh / 2 - 26, "text-anchor": "middle", "dominant-baseline": "central", "font-family": "Plex,'IBM Plex Mono',monospace", "font-weight": 500, "font-size": 22, "letter-spacing": 2.2, fill: T.label || T.ink }, inn); lb.textContent = String(c.label).toUpperCase(); }
      tl.fromTo(dot, { opacity: 0 }, { opacity: 1, duration: 0.3, immediateRender: false }, t);
      tl.fromTo(lead, { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.5, ease: "power2.inOut", immediateRender: false }, t);
      tl.set(inn, { opacity: 1 }, t + 0.3); tl.fromTo(inn, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out", immediateRender: false }, t + 0.3);
      const s0 = { v: 0 }; tl.to(s0, { v: n, duration: c.dur || 1.2, ease: "power2.out", immediateRender: false, onUpdate: () => { num.textContent = fmt(s0.v); }, onComplete: () => { num.textContent = fmt(n); }, onReverseComplete: () => { num.textContent = fmt(0); } }, t + 0.35);
      return M;
    };

    // ================= Doc2D upgrades: street dive (deep vector land + streets + tilt), data layers, race =================
    const ease01 = (u) => u * u * (3 - 2 * u);
    const lerpS = (a, b, u) => a + (b - a) * u;
    /* deep zoom: vector paper land for nearby countries (the baked tiles are country scale), faded in by zoom */
    const deepG = PAPER ? mk("g", { style: "display:none" }, svg) : null, deepSet = new Set();
    if (deepG) { svg.insertBefore(deepG, fillsG); }
    let deepParts = null;
    /* nearby rings of a country, parsed from geo.js relative paths and Chaikin-smoothed (2 passes): crisp paper edges at city scale */
    const smoothRings = (k, c, r) => {
      const out = []; for (const sub of G.countries[k].d.split(/(?=M)/)) { const n = (sub.match(/-?\d+(\.\d+)?/g) || []).map(Number); if (n.length < 6) continue;
        let x = n[0], y = n[1]; const q = [[x, y]]; for (let i = 2; i + 1 < n.length; i += 2) { x += n[i]; y += n[i + 1]; q.push([x, y]); }
        let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9; q.forEach(([a, b]) => { bx0 = Math.min(bx0, a); bx1 = Math.max(bx1, a); by0 = Math.min(by0, b); by1 = Math.max(by1, b); });
        if (bx0 > c[0] + r || bx1 < c[0] - r || by0 > c[1] + r || by1 < c[1] - r) continue;
        let R_ = q; for (let it = 0; it < 2; it++) { const z = []; for (let i = 0; i < R_.length; i++) { const A = R_[i], B = R_[(i + 1) % R_.length]; z.push([A[0] * 0.75 + B[0] * 0.25, A[1] * 0.75 + B[1] * 0.25], [A[0] * 0.25 + B[0] * 0.75, A[1] * 0.25 + B[1] * 0.75]); } R_ = z; }
        out.push(dStr(R_) + "Z"); }
      return out.join("");
    };
    const DEEP_SEA = ["#C6E3E3", "#ACD5DB", "#90C2D1"];
    const deepLand = (isos, c, r) => {
      if (!deepG) return; if (!deepParts) { const pat = mk("pattern", { id: ids + "grainP", patternUnits: "userSpaceOnUse", width: 512, height: 512 }, defs);
        const seaR = mk("rect", { fill: DEEP_SEA[2] }, deepG), bands = [1, 0].map((i) => ({ sh: mk("g", { fill: "none", stroke: T.ink, "stroke-opacity": 0.1, "stroke-linejoin": "round" }, deepG), b: mk("g", { fill: "none", stroke: DEEP_SEA[i], "stroke-linejoin": "round" }, deepG), w: i ? 64 : 26 }));
        deepParts = { pat, seaR, bands, img: mk("image", { href: o.grainPath || "paper.jpg", width: 512, height: 512, opacity: 0.5 }, pat),
          sh: mk("g", { fill: T.ink, opacity: 0.22 }, deepG), fill: mk("g", { fill: "#F1E6D1" }, deepG), grain: mk("g", { fill: `url(#${ids}grainP)`, style: "mix-blend-mode:multiply" }, deepG),
          edge: mk("g", { fill: "none", stroke: "#FFFFFF", "stroke-opacity": 0.65, "stroke-linejoin": "round" }, deepG), seam: mk("g", { fill: "none", stroke: "#A8967A", "stroke-opacity": 0.8, "stroke-linejoin": "round" }, deepG), extra: mk("g", {}, deepG) }; }
      isos.forEach((k) => { k = k.toUpperCase(); if (deepSet.has(k) || !G.countries[k]) return; deepSet.add(k); const d = smoothRings(k, c, r); if (!d) return;
        deepParts.bands.forEach((B) => { mk("path", { d }, B.sh); mk("path", { d }, B.b); });
        ["sh", "fill", "grain", "edge", "seam"].forEach((n) => mk("path", { d, "fill-rule": "evenodd" }, deepParts[n])); });
    };
    const nearIsos = (xy, r) => Object.keys(G.countries).filter((k) => { const b = G.countries[k].B || G.countries[k].b; return b[0] < xy[0] + r && b[2] > xy[0] - r && b[1] < xy[1] + r && b[3] > xy[1] - r; });
    hooks.push((vx, vy, s, w) => { if (!deepG || !deepParts) return; const a = clamp((0.26 - s) / 0.16, 0, 1); deepG.style.display = a > 0.001 ? "" : "none"; if (a <= 0.001) return;
      deepG.setAttribute("opacity", ease01(a).toFixed(3)); deepParts.sh.setAttribute("transform", `translate(${3 * s} ${5 * s})`);
      const R_ = deepParts.seaR; R_.setAttribute("x", vx - 3 * w); R_.setAttribute("y", vy - 3 * w); R_.setAttribute("width", 7 * w); R_.setAttribute("height", 7 * w);
      deepParts.bands.forEach((B) => { B.b.setAttribute("stroke-width", 2 * B.w * s); B.sh.setAttribute("stroke-width", 2 * B.w * s); B.sh.setAttribute("transform", `translate(${2.5 * s} ${4 * s})`); }); deepParts.edge.setAttribute("transform", `translate(${-0.9 * s} ${-0.9 * s})`);
      deepParts.edge.setAttribute("stroke-width", 1.4 * s); deepParts.seam.setAttribute("stroke-width", 1.1 * s); deepParts.pat.setAttribute("width", 512 * s); deepParts.pat.setAttribute("height", 512 * s);
      deepParts.img.setAttribute("width", 512 * s); deepParts.img.setAttribute("height", 512 * s); });

    /* M.streets(city, t, {km, seed, arterials, rings}) procedural paper street plan around a place (deterministic), clipped to land,
       appears with zoom (from ~120 km view widths down). Purely illustrative: not real streets. */
    M.streets = (where, t, o2) => {
      o2 = o2 || {}; const c = pt(where), U = 1 / 1.274, R0 = (o2.km || 22) * U, rnd_ = rnd(o2.seed || 5), near = nearIsos(c, Math.max(R0 * 4, 120)), farR = Math.max(R0 * 6, 420); deepLand(nearIsos(c, farR), c, farR); // every coast the deep sea sheet could show
      const cid = ids + "clip" + hooks.length, cp = mk("clipPath", { id: cid }, defs); near.forEach((k) => { const d = smoothRings(k.toUpperCase(), c, R0 * 6); if (d) mk("path", { d }, cp); });
      const g = mk("g", { "clip-path": `url(#${cid})`, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0 }, deepParts.extra);
      const urban = mk("path", { fill: "#E3CDA6", stroke: "none", opacity: 0.9 }, g), roads = { local: [], ring: [], art: [] };
      const blob = []; for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2, r = R0 * (0.62 + 0.18 * Math.sin(3 * a + 1.3) + 0.1 * Math.sin(5 * a + 0.4)); blob.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]); }
      urban.setAttribute("d", dStr(blob) + "Z");
      // arterials: uneven angles and lengths, wandering (two sine wobbles), some starting off-centre, so no perfect starburst
      const na = o2.arterials || 8; for (let i = 0; i < na; i++) { const a0 = (i / na) * Math.PI * 2 + (rnd_() - 0.5) * 0.9, q = [], bend = (rnd_() - 0.5) * 0.9, ph = rnd_() * 6, len = R0 * (0.8 + 0.7 * rnd_()), r0 = R0 * 0.18 * rnd_(), w1 = 0.025 + 0.03 * rnd_();
        for (let j = 0; j <= 28; j++) { const u = j / 28, a = a0 + bend * u * u + w1 * Math.sin(u * 7 + ph) + 0.008 * Math.sin(u * 13 + ph * 2), r = r0 + (len - r0) * u; q.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]); } roads.art.push(q); }
      (o2.rings || [0.35, 0.7]).forEach((rf) => { const q = [], ph = rnd_() * 6; for (let j = 0; j <= 64; j++) { const a = (j / 64) * Math.PI * 2, r = R0 * rf * (1 + 0.08 * Math.sin(4 * a + ph)); q.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]); } roads.ring.push(q); });
      for (let p_ = 0; p_ < (o2.patches || 12); p_++) { const pa = rnd_() * Math.PI * 2, pr = R0 * (0.1 + 0.45 * rnd_()), px = c[0] + Math.cos(pa) * pr, py = c[1] + Math.sin(pa) * pr, rot = rnd_() * Math.PI, sz = R0 * (0.18 + 0.12 * rnd_()), st = sz / (5 + Math.floor(rnd_() * 4));
        const cs = Math.cos(rot), sn = Math.sin(rot), P_ = (u, v) => [px + u * cs - v * sn, py + u * sn + v * cs];
        for (let k = -sz; k <= sz + 1e-9; k += st) { roads.local.push([P_(-sz, k), P_(sz, k)]); roads.local.push([P_(k, -sz), P_(k, sz)]); } }
      const mkSet = (list, col, w, cas) => list.map((q) => { const d = dStr(q), e = cas ? mk("path", { d, stroke: cas, "data-w": w * 1.9 }, g) : null; return [e, mk("path", { d, stroke: col, "data-w": w }, g)]; });
      const els = [].concat(mkSet(roads.local, "#FFFAF0", 1.5, "#C9B490"), mkSet(roads.ring, "#FFFBF2", 3.2, "#9C8562"), mkSet(roads.art, "#FFF8E8", 4.4, "#8E7653")).flat().filter(Boolean);
      const st = { a: 0 };
      hooks.push((vx, vy, s) => { const z = clamp((0.42 - s) / 0.3, 0, 1) * st.a; g.setAttribute("opacity", z.toFixed(3)); if (z <= 0.001) return; els.forEach((e) => e.setAttribute("stroke-width", +e.getAttribute("data-w") * s)); });
      tl.fromTo(st, { a: 0 }, { a: 1, duration: 0.8, ease: "sine.inOut", immediateRender: false, onUpdate: () => draw() }, t);
      return M;
    };

    /* tilt: the whole paper plane leans back toward a horizon (CSS 3D on the plane), a paper sky rises behind it, overlays fade.
       M.tilt(t, dur, {to: 0..1, deg: 38, scale: 1.5, ease}) chains (to:0 lays it flat again). The end frame puts the horizon at
       ~33% of the frame, the same as a world-kit exterior establish cam, for a matched crossfade into SETS.mount(..., {cam:"establish"}). */
    const TI = { a: 0 }; let tiNext = 0;
    if (PAPER) { o.tiltDeg = o.tiltDeg || 38; o.tiltScale = o.tiltScale || 1.95; }
    M.tilt = (t, d, k) => {
      k = k || {}; if (!plane) return M; const a0 = tiNext, a1 = k.to == null ? 1 : k.to; tiNext = a1; if (k.deg) o.tiltDeg = k.deg; if (k.scale) o.tiltScale = k.scale;
      tl.fromTo(TI, { a: a0 }, { a: a1, duration: d || 2.2, ease: k.ease || "sine.inOut", immediateRender: false, onUpdate: () => draw(), onComplete: () => draw(), onReverseComplete: () => draw() }, t);
      return M;
    };
    hooks.push(() => { if (!plane) return; const a = TI.a;
      plane.style.transform = a > 0.0005 ? `perspective(1000px) rotateX(${(o.tiltDeg * a).toFixed(3)}deg) scale(${(1 + (o.tiltScale - 1) * a).toFixed(4)})` : "";
      const m = a > 0.0005 ? `linear-gradient(to bottom, rgba(0,0,0,${(1 - a).toFixed(3)}) 0%, #000 ${(42 * a).toFixed(1)}%)` : "none"; plane.style.webkitMaskImage = m; plane.style.maskImage = m;
      sky.style.opacity = a.toFixed(3); ov.style.opacity = (1 - clamp(a * 2.5, 0, 1)).toFixed(3); });

    /* ---- data layers (paper look, calm, never static) ---- */
    /* M.choro({ISO: v}, t, {ramp, stagger, title, unit, fmt, legend:true, opacity})  country sheets re-inked in value order (multiplied
       over the paper so relief + grain show through), legend card bottom-left in the safe area */
    M.choro = (data, t, c) => {
      c = c || {}; const keys = Object.keys(data).sort((a, b) => data[a] - data[b]), vals = keys.map((k) => data[k]), lo = Math.min(...vals), hi = Math.max(...vals);
      const ramp = c.ramp || ["#F6E3B4", "#F2C27A", "#EE9A55", "#DD6B45", "#B8463D"], gap = c.stagger || 0.12, op = c.opacity == null ? 0.78 : c.opacity;
      const cls = (v) => clamp(Math.floor(((v - lo) / (hi - lo || 1)) * ramp.length), 0, ramp.length - 1);
      const cg = mk("g", { style: "mix-blend-mode:multiply" }, svg); svg.insertBefore(cg, linesG);
      keys.forEach((k, i) => { const e = use(cg, k.toUpperCase(), { fill: ramp[cls(data[k])], "fill-opacity": 0 }); tl.fromTo(e, { attr: { "fill-opacity": 0 } }, { attr: { "fill-opacity": op }, duration: 0.6, ease: "sine.inOut", immediateRender: false }, t + i * gap); });
      if (c.legend !== false) { const lg = mk("g", { opacity: 0 }, ov), lw = 5 * 64 + 48, lh = 118, fm = c.fmt || ((v) => v + (c.unit || ""));
        const lx = c.legendX == null ? SAFE.l + 12 : c.legendX, ly = c.legendY == null ? SAFE.b - lh - 12 : c.legendY; lg.setAttribute("transform", `translate(${lx} ${ly})`);
        [[7, 0.1], [4, 0.14]].forEach(([oo, a]) => mk("rect", { x: oo * 0.6, y: oo, width: lw, height: lh, rx: 4, fill: T.ink, opacity: a }, lg)); mk("rect", { width: lw, height: lh, rx: 4, fill: "#FBF6EC" }, lg);
        const tt = mk("text", { x: 24, y: 36, "font-family": "Oswald,Impact,sans-serif", "font-weight": 600, "font-size": 26, "letter-spacing": 2.6, fill: T.ink }, lg); tt.textContent = String(c.title || "").toUpperCase();
        ramp.forEach((col, i) => mk("rect", { x: 24 + i * 64, y: 52, width: 62, height: 22, fill: col }, lg));
        const rowL = mk("g", {}, lg); [[fm(lo), 24, "start"], [fm(hi), lw - 24, "end"]].forEach((q) => { const e = mk("text", { x: q[1], y: 100, "text-anchor": q[2], "font-family": "Plex,'IBM Plex Mono',monospace", "font-weight": 500, "font-size": 24, fill: T.ink }, rowL); e.textContent = q[0]; });
        tl.fromTo(lg, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "sine.inOut", immediateRender: false }, t); if (c.out != null) fade(lg, c.out, 0.5); }
      if (c.out != null) tl.to(cg, { opacity: 0, duration: 0.6, ease: "sine.inOut" }, c.out);
      return M;
    };

    /* M.symbols({place: value}, t, {color, max, rmax:px, unit, fmt, stagger, labels:true})  proportional paper discs (area ~ value),
       stacked-paper shadow, value inside when the disc is big enough; they breathe ~2% so the frame is never static */
    M.symbols = (data, t, c) => {
      c = c || {}; const keys = Object.keys(data), mx = c.max || Math.max(...keys.map((k) => data[k])), rmax = c.rmax || 70, col = c.color || T.teal || T.deep, gap = c.stagger || 0.15;
      const fm = c.fmt || ((v) => (+v).toLocaleString("en-US") + (c.unit || ""));
      keys.sort((a, b) => data[b] - data[a]).forEach((k, i) => {
        const xy = pt(k), a = anchor(xy[0], xy[1], 0), r = Math.max(10, rmax * Math.sqrt(data[k] / mx)), g = mk("g", { opacity: 0 }, a.g), inn = mk("g", {}, g);
        mk("circle", { cx: 3, cy: 6, r, fill: T.ink, opacity: 0.18 }, inn); mk("circle", { r, fill: col, opacity: 0.88 }, inn); mk("circle", { r: r - 4, fill: "none", stroke: "#FFFFFF", "stroke-opacity": 0.45, "stroke-width": 2 }, inn);
        if (c.labels !== false && r >= 44) { const tx = mk("text", { x: 0, y: 1, "text-anchor": "middle", "dominant-baseline": "central", "font-family": "Oswald,Impact,sans-serif", "font-weight": 700, "font-size": Math.min(40, Math.max(26, r * 0.55)), fill: "#FBF6EC" }, inn); tx.textContent = fm(data[k]); }
        a.box = [-r - 6, -r - 6, r + 10, r + 12];
        const at_ = t + i * gap, ph = i * 1.7;
        tl.fromTo(g, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "sine.inOut", immediateRender: false }, at_);
        const st = { k: 0 }; tl.fromTo(st, { k: 0 }, { k: 1, duration: 0.7, ease: "power3.out", immediateRender: false, onUpdate: () => draw() }, at_);
        hooks.push(() => { inn.setAttribute("transform", `scale(${(st.k * (1 + 0.022 * Math.sin(DR.t * 1.6 + ph))).toFixed(4)})`); });
        if (c.out != null) fade(g, c.out, 0.5);
      });
      return M;
    };

    /* M.heat([[lon, lat, w], ...], t, {km, levels, ramp, res, stagger, opacity})  density field painted once into stacked paper
       contour sheets (one image per level, each with a lit edge + soft shadow), levels lay down in turn; slow breathing after */
    M.heat = (pts, t, c) => {
      c = c || {}; const P = pts.map((q) => { const xy = pt([q[0], q[1]]); return [xy[0], xy[1], q[2] == null ? 1 : q[2]]; }), rad = (c.km || 120) / 1.274;
      const bx0 = Math.min(...P.map((q) => q[0])) - rad * 3, by0 = Math.min(...P.map((q) => q[1])) - rad * 3, bx1 = Math.max(...P.map((q) => q[0])) + rad * 3, by1 = Math.max(...P.map((q) => q[1])) + rad * 3;
      const res = c.res || 900, upp = Math.max(bx1 - bx0, by1 - by0) / res, cw = Math.ceil((bx1 - bx0) / upp), ch = Math.ceil((by1 - by0) / upp), F = new Float32Array(cw * ch);
      const rp = rad / upp, rr = Math.ceil(rp * 3);
      P.forEach(([x, y, w]) => { const cx = (x - bx0) / upp, cy = (y - by0) / upp; for (let j = Math.max(0, Math.floor(cy - rr)); j < Math.min(ch, cy + rr); j++) for (let i = Math.max(0, Math.floor(cx - rr)); i < Math.min(cw, cx + rr); i++) { const d2 = ((i - cx) ** 2 + (j - cy) ** 2) / (rp * rp); F[j * cw + i] += w * Math.exp(-d2 / 2); } });
      let fmax = 0; for (const v of F) fmax = Math.max(fmax, v);
      const ramp = c.ramp || ["#F7E2A8", "#F3BE6E", "#EC9150", "#DC6644", "#B9423C"], L = c.levels || ramp.length, gl = mk("g", {}, svg); svg.insertBefore(gl, linesG);
      const imgs = [];
      for (let k = 0; k < L; k++) {
        const th = fmax * (0.12 + 0.8 * k / L), cv = document.createElement("canvas"); cv.width = cw; cv.height = ch; const x = cv.getContext("2d"), id = x.createImageData(cw, ch), D = id.data, rgb = hex(ramp[k % ramp.length]);
        const inside = (i, j) => i >= 0 && j >= 0 && i < cw && j < ch && F[j * cw + i] >= th;
        for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) { const p = (j * cw + i) * 4, v = F[j * cw + i];
          if (v >= th) { const a = clamp((v - th) / (fmax * 0.02) + 0.5, 0, 1), lit = !inside(i - 2, j - 2) ? 1.12 : 1, dk = !inside(i + 2, j + 2) ? 0.86 : 1;
            D[p] = clamp(rgb[0] * lit * dk, 0, 255); D[p + 1] = clamp(rgb[1] * lit * dk, 0, 255); D[p + 2] = clamp(rgb[2] * lit * dk, 0, 255); D[p + 3] = 235 * a; }
          else if (inside(i - 3, j - 4) || inside(i - 1, j - 2)) { D[p] = 19; D[p + 1] = 34; D[p + 2] = 59; D[p + 3] = 46; } }
        x.putImageData(id, 0, 0);
        const im = mk("image", { href: cv.toDataURL("image/png"), x: bx0, y: by0, width: cw * upp, height: ch * upp, preserveAspectRatio: "none", opacity: 0 }, gl); imgs.push(im);
        tl.fromTo(im, { attr: { opacity: 0 } }, { attr: { opacity: c.opacity == null ? 0.92 : c.opacity }, duration: 0.6, ease: "sine.inOut", immediateRender: false }, t + k * (c.stagger || 0.25));
      }
      hooks.push(() => { const b = 1 + 0.012 * Math.sin(DR.t * 1.3), cx = (bx0 + bx1) / 2, cy = (by0 + by1) / 2; gl.setAttribute("transform", `translate(${cx} ${cy}) scale(${b.toFixed(4)}) translate(${-cx} ${-cy})`); });
      if (c.out != null) tl.to(imgs, { attr: { opacity: 0 }, duration: 0.6, ease: "sine.inOut" }, c.out);
      return M;
    };

    /* M.flow(from, to, t, {value, max, wmax, color, dur, hold, bend, speed, label, labelDx, labelDy})  flow line whose width grows to its
       volume (tapered toward the destination) with dashes streaming along it; optional value tag at the midpoint */
    M.flow = (from, to, t, f) => {
      f = f || {}; const col = f.color || T.alert, P = arcPts(pt(from), pt(to), f.bend == null ? 0.18 : f.bend), C = cum(P), LT = C[C.length - 1], dur = f.dur || 1.6, hold = f.hold == null ? 6 : f.hold;
      const wv = (f.wmax || 26) * Math.sqrt((f.value || 1) / (f.max || f.value || 1)), g = mk("g", { fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, topG);
      const body = mk("path", { fill: col, opacity: 0.55 }, g), core = mk("path", { stroke: mix(col, "#FFFFFF", 0.55), "stroke-opacity": 0.9 }, g), st = { p: 0, v: 0, m: 0 };
      const tip = glowTip(ov, col, Math.max(4, wv * 0.35)); tip.style.opacity = 0;
      hooks.push((vx, vy, s) => { const on = st.p > 0.001; g.style.display = on ? "" : "none"; tip.style.opacity = on && st.p < 0.999 ? clamp((1 - st.p) * 25, 0, 1).toFixed(3) : 0; if (!on) return;
        const pts_ = upto(P, C, st.p * LT), n = pts_.length, L_ = [], R_ = [];
        for (let i = 0; i < n; i++) { const a = pts_[Math.max(0, i - 1)], b = pts_[Math.min(n - 1, i + 1)], an = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2, u = i / Math.max(1, n - 1), w_ = (wv * st.v * (1 - 0.45 * u * st.p) / 2 + 1.5) * s;
          L_.push([pts_[i][0] + Math.cos(an) * w_, pts_[i][1] + Math.sin(an) * w_]); R_.push([pts_[i][0] - Math.cos(an) * w_, pts_[i][1] - Math.sin(an) * w_]); }
        body.setAttribute("d", dStr(L_.concat(R_.reverse())) + "Z"); core.setAttribute("d", dStr(pts_)); core.setAttribute("stroke-width", Math.max(2, wv * st.v * 0.22) * s);
        core.setAttribute("stroke-dasharray", `${10 * s} ${14 * s}`); core.setAttribute("stroke-dashoffset", (-st.m * s).toFixed(2));
        const e = pts_[n - 1]; tip.setAttribute("transform", `translate(${((e[0] - vx) / s).toFixed(1)} ${((e[1] - vy) / s).toFixed(1)})`); tip.trail.forEach((c_) => { c_.setAttribute("cx", 0); c_.setAttribute("cy", 0); }); });
      const rd = () => draw();
      tl.fromTo(st, { p: 0 }, { p: 1, duration: dur, ease: "power2.inOut", immediateRender: false, onUpdate: rd, onComplete: rd, onReverseComplete: rd }, t);
      tl.fromTo(st, { v: 0.15 }, { v: 1, duration: dur + 0.8, ease: "power2.out", immediateRender: false, onUpdate: rd }, t);
      tl.fromTo(st, { m: 0 }, { m: (f.speed || 55) * (dur + hold), duration: dur + hold, ease: "none", immediateRender: false, onUpdate: rd }, t);
      if (f.label) { const mid = P[Math.floor(P.length / 2)]; const lab = Maps.unproject(mid[0], mid[1]); M.tag(lab, t + dur * 0.7, { text: f.label, dx: f.labelDx || 0, dy: f.labelDy == null ? -70 : f.labelDy, accent: col, out: f.out }); }
      if (f.out != null) tl.to(g, { opacity: 0, duration: 0.5, ease: "sine.inOut" }, f.out);
      return M;
    };

    /* M.air(from, to, t, {color, width, dur, flow, plane:true, planeColor, size, label, dx, dy, out})  air-freight leg: great-circle line
       draws with the glowing tip while a plane rides it, then dashes flow along it */
    M.air = (from, to, t, a) => {
      a = a || {}; const A = lonlat(from), B = lonlat(to), R = Math.PI / 180, v = (q) => [Math.cos(q[1] * R) * Math.cos(q[0] * R), Math.cos(q[1] * R) * Math.sin(q[0] * R), Math.sin(q[1] * R)];
      const P = v(A), Q = v(B), om = Math.acos(clamp(P[0] * Q[0] + P[1] * Q[1] + P[2] * Q[2], -1, 1)) || 1e-6, pts = [], dur = a.dur || 2.6, col = a.color || T.marker;
      for (let i = 0; i <= 48; i++) { const u = i / 48, s0 = Math.sin((1 - u) * om) / Math.sin(om), s1 = Math.sin(u * om) / Math.sin(om), x = s0 * P[0] + s1 * Q[0], y = s0 * P[1] + s1 * Q[1], z = s0 * P[2] + s1 * Q[2];
        pts.push([Math.atan2(y, x) / R, Math.atan2(z, Math.hypot(x, y)) / R]); }
      M.pencil("path", pts, t, { color: col, width: a.width || 5, dur, flow: a.flow == null ? 6 : a.flow, hold: a.hold == null ? 6 : a.hold });
      if (a.plane !== false) M.mover(A, B, t, { glyph: "plane", path: "great", dur, ease: "power1.inOut", color: a.planeColor || T.ink, size: a.size || 1.05, trail: false, fadeOut: a.fadeOut !== false });
      if (a.label) M.tag(to, t + dur * 0.85, { text: a.label === true ? undefined : a.label, dx: a.dx, dy: a.dy, accent: col, out: a.out });
      return M;
    };
    /* M.restrict(isos, t, {color, hatch, opacity, label, where, dx, dy, out})  export-control / sanctions layer: countries greyed out
       (desaturating grey sheet + diagonal hatch, multiplied so relief still reads) with an optional stamp tag */
    M.restrict = (isos, t, r) => {
      r = r || {}; isos = [].concat(isos).map((k) => k.toUpperCase()); const pid = ids + "rx" + hooks.length;
      const pat = mk("pattern", { id: pid, patternUnits: "userSpaceOnUse", width: 14, height: 14, patternTransform: "rotate(45)" }, defs), bar = mk("rect", { x: 0, y: 0, width: 4, height: 14, fill: r.hatch || "#3D4350", opacity: 0.55 }, pat);
      const g = mk("g", { opacity: 0 }, svg); svg.insertBefore(g, linesG);
      const fl = mk("g", { fill: r.color || "#9A9DA4", "fill-opacity": r.opacity == null ? 0.82 : r.opacity, style: "mix-blend-mode:multiply" }, g), ht = mk("g", { fill: `url(#${pid})` }, g), ed = mk("g", { fill: "none", stroke: "#3D4350", "stroke-opacity": 0.7, "stroke-linejoin": "round" }, g);
      isos.forEach((k) => { if (!G.countries[k]) return; use(fl, k); if (r.hatch !== false) use(ht, k); use(ed, k); });
      hooks.push((vx, vy, s) => { pat.setAttribute("width", 14 * s); pat.setAttribute("height", 14 * s); bar.setAttribute("width", 4 * s); bar.setAttribute("height", 14 * s); ed.setAttribute("stroke-width", 2 * s); });
      tl.fromTo(g, { opacity: 0 }, { opacity: 1, duration: r.dur || 0.9, ease: "sine.inOut", immediateRender: false }, t);
      if (r.label) M.tag(r.where || isos[0], t + 0.5, { text: r.label, dx: r.dx, dy: r.dy, accent: "#3D4350", out: r.out });
      if (r.out != null) tl.to(g, { opacity: 0, duration: 0.6, ease: "sine.inOut" }, r.out);
      return M;
    };

    /* M.chain(steps, t, {title, color, gap, x, y, w, out})  supply-chain strip (screen space, bottom of the safe area): one paper card per
       step joined by arrows; each card's bar fills to `share` (China's share by default) and its number counts up.
       steps: [{name:"Mining", share:70, note:"China's share"}, ...] */
    M.chain = (steps, t, c) => {
      c = c || {}; const n = steps.length, gap = 64, W_ = c.w || Math.min(SAFE.r - SAFE.l - 40, n * 420 + (n - 1) * gap), cw = (W_ - (n - 1) * gap) / n, ch = 158;
      const x0 = c.x == null ? (SAFE.l + SAFE.r) / 2 - W_ / 2 : c.x, y0 = c.y == null ? SAFE.b - ch - 20 : c.y, col = c.color || T.alert, all = [];
      if (c.title) { const tg = mk("g", { transform: `translate(${x0} ${y0 - 22})`, opacity: 0 }, ov); const tt = mk("text", { x: 0, y: 0, "font-family": "Oswald,Impact,sans-serif", "font-weight": 600, "font-size": 30, "letter-spacing": 3, fill: T.ink, stroke: "#FBF6EC", "stroke-width": 7, "paint-order": "stroke", "stroke-linejoin": "round" }, tg); tt.textContent = String(c.title).toUpperCase();
        tl.fromTo(tg, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "sine.inOut", immediateRender: false }, t); all.push(tg); }
      steps.forEach((st_, i) => {
        const at = t + 0.3 + i * (c.stagger || 0.9), x = x0 + i * (cw + gap), g = mk("g", { transform: `translate(${x} ${y0})`, opacity: 0 }, ov); all.push(g);
        [[8, 0.1], [4, 0.14]].forEach(([d, a]) => mk("rect", { x: d * 0.6, y: d, width: cw, height: ch, rx: 4, fill: T.ink, opacity: a }, g));
        mk("rect", { width: cw, height: ch, rx: 4, fill: "#FBF6EC" }, g); mk("rect", { width: 9, height: ch, fill: col }, g);
        const nm = mk("text", { x: 30, y: 44, "font-family": "Oswald,Impact,sans-serif", "font-weight": 600, "font-size": 30, "letter-spacing": 3, fill: T.ink }, g); nm.textContent = String(st_.name).toUpperCase();
        const num = mk("text", { x: 30, y: 108, "font-family": "Oswald,Impact,sans-serif", "font-weight": 700, "font-size": 54, fill: col }, g); num.textContent = "0%";
        const nt = mk("text", { x: cw - 24, y: 104, "text-anchor": "end", "font-family": "Plex,'IBM Plex Mono',monospace", "font-weight": 500, "font-size": 24, fill: "#3B4A63" }, g); nt.textContent = String(st_.note || "China's share").toUpperCase();
        mk("rect", { x: 30, y: 126, width: cw - 54, height: 14, rx: 7, fill: "#E3D8C3" }, g); const bar = mk("rect", { x: 30, y: 126, width: 0, height: 14, rx: 7, fill: col }, g);
        if (i < n - 1) { const ar = mk("path", { d: `M${cw + 12} ${ch / 2}L${cw + gap - 18} ${ch / 2}M${cw + gap - 30} ${ch / 2 - 13}L${cw + gap - 16} ${ch / 2}L${cw + gap - 30} ${ch / 2 + 13}`, fill: "none", stroke: T.ink, "stroke-width": 5, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0 }, g);
          tl.fromTo(ar, { opacity: 0 }, { opacity: 0.8, duration: 0.4, ease: "sine.inOut", immediateRender: false }, at + 0.6); }
        tl.fromTo(g, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out", immediateRender: false }, at);
        const v = { v: 0 }, sh = st_.share || 0;
        tl.fromTo(v, { v: 0 }, { v: sh, duration: 1.1, ease: "power2.out", immediateRender: false, onUpdate: () => { num.textContent = Math.round(v.v) + "%"; bar.setAttribute("width", ((cw - 54) * v.v / 100).toFixed(1)); },
          onComplete: () => { num.textContent = sh + "%"; bar.setAttribute("width", ((cw - 54) * sh / 100).toFixed(1)); }, onReverseComplete: () => { num.textContent = "0%"; bar.setAttribute("width", 0); } }, at + 0.2);
      });
      if (c.out != null) fade(all, c.out, 0.5);
      return M;
    };

    /* M.fan(from, [to, ...], t, {value, max, color, stagger, dur, bend, label, labelAt, labelDx, labelDy, out})  one layer of flows from a
       source to many destinations (call again with a bigger value/colour for escalating layers: mined -> refined -> magnets) */
    M.fan = (from, tos, t, f) => {
      f = f || {}; tos.forEach((to, i) => M.flow(from, to, t + i * (f.stagger || 0.18), { value: f.value || 1, max: f.max || 1, wmax: f.wmax || 22, color: f.color || T.alert, dur: f.dur || 1.4, hold: f.hold, bend: (f.bend == null ? 0.16 : f.bend) * (i % 2 ? -1 : 1), out: f.out }));
      if (f.label) M.tag(f.labelAt || from, t + 0.5, { text: f.label, dx: f.labelDx == null ? 0 : f.labelDx, dy: f.labelDy == null ? -120 : f.labelDy, accent: f.color || T.alert, out: f.out });
      return M;
    };
    /* M.hold(where, t, {text:"Held", color, dx, dy, out})  a "held" marker on a lane: paper badge with pause bars that settles in and
       breathes, plus a tag (cargo stopped at a port / checkpoint) */
    M.hold = (where, t, h) => {
      h = h || {}; const xy = pt(where), a = anchor(xy[0], xy[1], 0), g = mk("g", { opacity: 0 }, a.g), col = h.color || T.alert, inn = mk("g", {}, g);
      mk("circle", { cx: 3, cy: 6, r: 30, fill: T.ink, opacity: 0.22 }, inn); mk("path", { d: "M-12.4 -30L12.4 -30L30 -12.4L30 12.4L12.4 30L-12.4 30L-30 12.4L-30 -12.4Z", fill: col, stroke: "#FBF6EC", "stroke-width": 4 }, inn);
      mk("rect", { x: -10, y: -12, width: 7, height: 24, rx: 2, fill: "#FBF6EC" }, inn); mk("rect", { x: 3, y: -12, width: 7, height: 24, rx: 2, fill: "#FBF6EC" }, inn);
      a.box = [-40, -40, 44, 44];
      hooks.push(() => inn.setAttribute("transform", `scale(${(1 + 0.035 * Math.sin(DR.t * 2.4)).toFixed(4)})`));
      tl.fromTo(g, { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: 0.5, ease: "power3.out", immediateRender: false, transformOrigin: "0px 0px" }, t);
      if (h.text !== false) M.tag(where, t + 0.3, { text: h.text || "Held", dx: h.dx == null ? 0 : h.dx, dy: h.dy == null ? -110 : h.dy, accent: col, out: h.out });
      if (h.out != null) fade(g, h.out, 0.5);
      return M;
    };
    /* M.lightup(places, t, {color, badge:"CN", stagger, label, labelAt, out})  abstract "lights up everywhere": each place gets a soft glow
       that blooms then breathes, with a small stamped licence badge; places lit in order (product made anywhere -> China licence) */
    M.lightup = (places, t, l) => {
      l = l || {}; const col = l.color || T.alert;
      places.forEach((p, i) => {
        const xy = pt(p), a = anchor(xy[0], xy[1], 0), g = mk("g", { opacity: 0 }, a.g), at_ = t + i * (l.stagger || 0.22), ph = i * 1.3;
        const gl = mk("circle", { r: 34, fill: col, opacity: 0.28, filter: `url(#${ids}gsh)` }, g); mk("circle", { r: 9, fill: col, stroke: "#FBF6EC", "stroke-width": 3 }, g);
        if (l.badge !== false) { const b = mk("g", { transform: "translate(18 -30) rotate(-8)" }, g); mk("rect", { x: 0, y: -15, width: 54, height: 30, rx: 3, fill: "#FBF6EC", stroke: col, "stroke-width": 2.5 }, b);
          const tx = mk("text", { x: 27, y: 1, "text-anchor": "middle", "dominant-baseline": "central", "font-family": "Oswald,Impact,sans-serif", "font-weight": 700, "font-size": 24, fill: col }, b); tx.textContent = l.badge || "CN"; }
        a.box = [-40, -50, 80, 40];
        hooks.push(() => gl.setAttribute("r", (34 * (1 + 0.15 * Math.sin(DR.t * 2 + ph))).toFixed(1)));
        tl.fromTo(g, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: "sine.inOut", immediateRender: false }, at_);
        if (l.out != null) fade(g, l.out, 0.5);
      });
      if (l.label) M.tag(l.labelAt || places[0], t + places.length * (l.stagger || 0.22) + 0.2, { text: l.label, dx: l.labelDx, dy: l.labelDy, accent: col, out: l.out });
      return M;
    };

    /* M.race(routeA, routeB, t, {dur, days:[a, b], names:["Via Suez","Via the Cape"], colors, glyph, cards:"tl,tr"})  two routes draw at
       once, a ship rides each tip at the same speed (so the longer route arrives later), each card's day counter ticks to its total */
    M.race = (A, B, t, r) => {
      r = r || {}; const days = r.days || [20, 34], names = r.names || ["Route A", "Route B"], cols = r.colors || [T.marker, T.alert], mxD = Math.max(...days), D0 = r.dur || 9;
      [A, B].forEach((route, i) => {
        const d = D0 * days[i] / mxD, P = routePts(route, "smooth", 220), C = cum(P), LT = C[C.length - 1], col = cols[i];
        const line = mk("path", { fill: "none", stroke: col, "stroke-linecap": "round", "stroke-linejoin": "round" }, topG), fl = mk("path", { fill: "none", stroke: mix(col, "#FFFFFF", 0.6), "stroke-linecap": "round" }, topG);
        const a = { g: mk("g", { opacity: 0 }, ov) }, sh = mk("g", { opacity: 0.25, transform: "translate(3 6)" }, a.g); GLYPH[r.glyph || "ship"](sh, "#000"); GLYPH[r.glyph || "ship"](mk("g", {}, a.g), mix(col, T.ink, 0.35));
        const st = { p: 0, m: 0 };
        hooks.push((vx, vy, s) => { const on = st.p > 0.001; line.style.display = fl.style.display = on ? "" : "none"; a.g.setAttribute("opacity", on ? 1 : 0); if (!on) return;
          const L_ = st.p * LT, d_ = dStr(upto(P, C, L_)); line.setAttribute("d", d_); line.setAttribute("stroke-width", 6 * s); fl.setAttribute("d", d_); fl.setAttribute("stroke-width", 2.2 * s);
          fl.setAttribute("stroke-dasharray", `${9 * s} ${13 * s}`); fl.setAttribute("stroke-dashoffset", (-st.m * s).toFixed(2));
          const e = at(P, C, L_), e2 = at(P, C, Math.min(LT, L_ + 4 * s)), e1 = at(P, C, Math.max(0, L_ - 4 * s)), ang = Math.atan2(e2.y - e1.y, e2.x - e1.x) * 180 / Math.PI;
          a.g.setAttribute("transform", `translate(${((e.x - vx) / s).toFixed(1)} ${((e.y - vy) / s).toFixed(1)}) rotate(${ang.toFixed(1)}) scale(${r.size || 0.9})`); });
        const rd = () => draw();
        tl.fromTo(st, { p: 0 }, { p: 1, duration: d, ease: "none", immediateRender: false, onUpdate: rd, onComplete: rd, onReverseComplete: rd }, t);
        tl.fromTo(st, { m: 0 }, { m: 40 * (D0 + (r.hold || 3)), duration: D0 + (r.hold || 3), ease: "none", immediateRender: false, onUpdate: rd }, t);
        // day counter card (screen space, top corners inside the safe area)
        const cw_ = 390, chh = 128, cx = i === 0 ? SAFE.l + 16 : SAFE.r - 16 - cw_, cy = SAFE.t + 16, card = mk("g", { transform: `translate(${cx} ${cy})`, opacity: 0 }, ov);
        [[7, 0.1], [4, 0.14]].forEach(([oo, al]) => mk("rect", { x: oo * 0.6, y: oo, width: cw_, height: chh, rx: 4, fill: T.ink, opacity: al }, card));
        mk("rect", { width: cw_, height: chh, rx: 4, fill: "#FBF6EC" }, card); mk("rect", { width: 9, height: chh, fill: col }, card);
        const nm = mk("text", { x: 30, y: 36, "font-family": "Oswald,Impact,sans-serif", "font-weight": 600, "font-size": 26, "letter-spacing": 2.4, fill: T.ink }, card); nm.textContent = String(names[i]).toUpperCase();
        const num = mk("text", { x: 30, y: 108, "font-family": "Oswald,Impact,sans-serif", "font-weight": 700, "font-size": 46, fill: T.ink }, card); num.textContent = "DAY 0";
        const ok = mk("text", { x: cw_ - 24, y: 104, "text-anchor": "end", "font-family": "Plex,'IBM Plex Mono',monospace", "font-weight": 600, "font-size": 24, fill: mix(col, T.ink, 0.4), opacity: 0 }, card); ok.textContent = "ARRIVED";
        const cs = { v: 0 }; tl.fromTo(card, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "sine.inOut", immediateRender: false }, Math.max(0, t - 0.4));
        tl.fromTo(cs, { v: 0 }, { v: days[i], duration: d, ease: "none", immediateRender: false, onUpdate: () => { num.textContent = "DAY " + Math.floor(cs.v); }, onComplete: () => { num.textContent = "DAY " + days[i]; }, onReverseComplete: () => { num.textContent = "DAY 0"; } }, t);
        tl.fromTo(ok, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: "sine.inOut", immediateRender: false }, t + d);
        if (r.out != null) fade([card], r.out, 0.5);
      });
      return M;
    };
    draw();
    return M;
  };
  root.Maps = Maps;
})(this);
