/* Monochrome poster themes: one hue per video, rotated across renders.
 * Fixed roles on every theme: ink #111 (text + 6 px outlines), paper #FBF7EE (cards),
 * one SHADOW tone (hard offset shadows + the puppet's shade side), one MARKER (accent words,
 * highlights), one ALERT (✕, stamps). Section changes shift between bg / deep / pale of the
 * same hue; the dot grid stays on all of them.
 * Node: require('./theme').next(slug, { exclude: ["tomato"] }) picks the next unused hue (history in
 * theme-history.json); `exclude` drops ids from the rotation for that call.
 * WORLD themes (diorama, diorama-dusk) are for the 3D "Diorama World" long-form: warm paper bg, sky / terracotta /
 * olive roles and a soft (blurred) shadow instead of the hard offset. Theme.get() finds them; next() never rotates to them.
 * Browser: window.THEME = <object>; Theme.apply(THEME) writes CSS variables on :root. */
(function (root) {
  const THEMES = [
    { id: "green",   bg: "#4DAF4A", deep: "#2E7D32", pale: "#CDE8C4", shadow: "#3F6FC0", marker: "#F6DA1C", alert: "#E8553E" },
    { id: "cobalt",  bg: "#3F6FC0", deep: "#22427E", pale: "#CBD9F2", shadow: "#1C2B57", marker: "#F6DA1C", alert: "#F0603E" },
    { id: "tomato",  bg: "#E8553E", deep: "#A8301E", pale: "#F9D3C8", shadow: "#3F6FC0", marker: "#F6DA1C", alert: "#111111" },
    { id: "mustard", bg: "#F2C230", deep: "#B88A0E", pale: "#FBEDB8", shadow: "#3F6FC0", marker: "#FFFFFF", alert: "#E8553E" },
    { id: "violet",  bg: "#7A5CD6", deep: "#4B3596", pale: "#E0D7F7", shadow: "#2B1F5E", marker: "#F6DA1C", alert: "#F0603E" },
    { id: "teal",    bg: "#1FA3A0", deep: "#126B69", pale: "#C6ECEA", shadow: "#1C3F7A", marker: "#F6DA1C", alert: "#E8553E" },
    { id: "pink",    bg: "#F07AA8", deep: "#B8406F", pale: "#FBD9E7", shadow: "#3F6FC0", marker: "#F6DA1C", alert: "#111111" },
    { id: "orange",  bg: "#F28C28", deep: "#B85E0C", pale: "#FCE0C4", shadow: "#3F6FC0", marker: "#FFFFFF", alert: "#111111" },
  ];
  const WORLD = [
    { id: "diorama",      bg: "#EFE6D3", deep: "#8A6A48", pale: "#F8F2E6", paper: "#FBF7EE", ink: "#2B2520",
      sky: "#7FB2D6", terracotta: "#C9683E", olive: "#7E8C4B",
      shadow: "#6B5A44", softShadow: "0 18px 42px rgba(74,54,32,.20)", marker: "#C9683E", alert: "#B5402A", dot: "rgba(60,40,20,.10)" },
    { id: "diorama-dusk", bg: "#2F2B3B", deep: "#1F1C2A", pale: "#4A4359", paper: "#F3EADB", ink: "#1E1A22",
      sky: "#8DA9D9", terracotta: "#E0875C", olive: "#9FAE6A",
      shadow: "#0F0D16", softShadow: "0 20px 48px rgba(0,0,0,.40)", marker: "#E0875C", alert: "#F0603E", dot: "rgba(255,255,255,.08)" },
  ];
  const BASE = { ink: "#111111", paper: "#FBF7EE", dot: "rgba(0,0,0,.13)" };
  const full = (t) => ({ ...BASE, ...t });

  const Theme = {
    THEMES, WORLD,
    get: (id) => full(THEMES.find((t) => t.id === id) || WORLD.find((t) => t.id === id) || THEMES[0]),
    css: (t) => Object.entries(full(t)).filter(([k]) => k !== "id").map(([k, v]) => `--${k}:${v}`).join(";"),
    apply: (t) => { const s = document.documentElement.style; Object.entries(full(t)).forEach(([k, v]) => k !== "id" && s.setProperty("--" + k, v)); },
  };

  if (typeof module !== "undefined" && module.exports) {
    const fs = require("fs"), path = require("path"), hist = path.join(__dirname, "theme-history.json");
    // next(slug, { exclude }): reuse the hue already assigned to this slug (unless excluded), else the least recently used hue
    Theme.next = (slug, { exclude = [] } = {}) => {
      const h = fs.existsSync(hist) ? JSON.parse(fs.readFileSync(hist, "utf8")) : { order: [], bySlug: {} };
      if (h.bySlug[slug] && !exclude.includes(h.bySlug[slug])) return Theme.get(h.bySlug[slug]);
      const pool = THEMES.filter((t) => !exclude.includes(t.id)), used = h.order.filter((id) => !exclude.includes(id)).slice(-(pool.length - 1));
      const pick = pool.find((t) => !used.includes(t.id)) || pool[0];
      h.order.push(pick.id); h.bySlug[slug] = pick.id;
      fs.writeFileSync(hist, JSON.stringify(h, null, 1));
      return full(pick);
    };
    module.exports = Theme;
  } else root.Theme = Theme;
})(this);
