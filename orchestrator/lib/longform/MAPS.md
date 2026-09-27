# Vector maps: worldMap / countryMap

**Status (2026-09-27):** sections 1-3 are integrated into `catalog.js`, `templates-lf.js` and `storyboardLF.js` (`lf-sb.3`, `mapProblems`).
The geo assets use the Natural Earth **India point-of-view** layer.

The pieces already built:

- **Geo assets:** `video-engine/assets/geo/world-{110m,50m}.json`. They are Natural Earth 5.1.1 admin-0, India point of view, 1:10m, simplified (public domain). Provenance is in the README there.
- **Stage module:** `video-engine/compositions/components/lib/stage/modules-map.js`. It is registered in `composeStage.js` and in `tools/layout_audit.js`.
- **Compile-time resolver:** `orchestrator/lib/video/v3/geo.js`, called from `compile.js` for every `worldMap` / `countryMap` module and its events. It:
  - fits the views to the module rect;
  - projects points;
  - culls the paths to what the views can show;
  - picks the regional file for zoomed views and the world file for world views.
- **Proof:** `fixtures/v3/lf-map-smoke.json` (free template, 1920x1080). Run it through `tools/v3-dryrun.js`, then `tools/stage-preview.js --check` and `tools/layout_audit.js`.

## 1. Catalog entries

Add these to `lib/video/v3/catalog.js`, in the LF block next to `mapCard`:

```js
  worldMap: { only: "LF", use: "vector world map (Natural Earth): highlight countries, pin cities, draw money/goods flows, or a choropleth of a World Bank series; the camera can zoom to a region on a word", props: "{focus?: [ISO3] (fit to these; default whole world), highlight?: [{iso, tone?, label?: true|text}], pins?: [{city|iso|lonlat:[lon,lat], label?, tone?}], arrows?: [{from, to, label?, tone?}], choropleth?: {series: 'S3', title?}, card?: true}", ops: { highlight: "{iso, tone?, label?} country fills with the tone", dim: "{iso}", pin: "{city|iso|lonlat, label?, tone?} dot pops + label chip", arrow: "{from, to, label?, tone?} curved flow line draws on (0.9 s); from/to = {city}|{iso}|{lonlat}", zoomTo: "{isos: [ISO3] | view: 'world', dur?: 1.2} the camera moves; pins and arrows ride along", choropleth: "{series: 'S3', title?} countries fill west to east, legend + source line land" } },
  countryMap: { only: "LF", use: "vector regional map fitted to 1-4 countries (names labelled), for where-is-it / border / neighbour beats; same ops as worldMap", props: "{focus: [ISO3] (1-4, required), highlight?, pins?, arrows?, labels?: false}", ops: "same as worldMap" },
```

Cities known by name are listed in `CITIES` in `geo.js`: about 50 finance and capital cities, including Karachi, Mumbai, Beijing, Colombo, Hambantota, Gwadar and Dubai. Any other place needs `lonlat`. Country codes are ISO3, the same codes World Bank uses (Kosovo is `XKX`).

## 2. Templates (`templates-lf.js`)

- **`lfStage` hero.** Accept `type: "worldMap" | "countryMap"` next to photo / mapCard / barChart / lineChart. Use the same centred card rect as a chart hero. The module draws its own paper card and sets its fit from its rect, so any rect works.
  - Keep the bottom 90 px clear.
  - The legend sits bottom-left inside the map, at about 22 px from the left and 50 px from the bottom, so satellites belong on the right rail.
- **`lfMap`.** Change `hero: { type: "mapCard", ...s.map }` to `hero: { type: (s.map && s.map.type) || "countryMap", ...s.map }`. Keep `mapCard` (Commons locator images) as the explicit fallback type.
- **Guide text** (`catalog.js`, `lfMap`):
  > slots: map {type?: countryMap (default) | worldMap | mapCard, props} centred hero, left? / right? satellites.
  > Prefer countryMap/worldMap: they are vector, exact, and animate on words.
- **Credits.** Natural Earth is public domain, so the map needs no credit chip. A choropleth prints its own `Source: World Bank, ...` line. Do not add `worldMap` / `countryMap` to `CREDIT_OWNERS`.

## 3. storyboardLF prompt and checks

Add to the LF chapter prompt:

- Use `countryMap` for "where is X, who borders whom" beats and `worldMap` for global comparisons.
- Mark the beats with events on the words:
  - `highlight` on the country's name;
  - `pin` on the city;
  - `arrow` on the verb of the flow ("lent", "exports", "borrowed");
  - `zoomTo` when the story moves region.
- Use at most 1 `zoomTo` per scaffold, and put at least 1.4 s between a `zoomTo` and the next map event, because the zoom takes 1.2 s.
- Draw at most 3 arrows and 4 pins per map, with pin labels of 14 characters or fewer.
- Choropleths use only `dossier.dataSeries` entries of kind `map` (`{series: "S3"}`). Never type values in.

Add a deterministic check: compile with the real `geo.js`. It throws on unknown ISO3 codes and unknown cities, so a check failure is simply the compile error text.

## 4. Known caveats

- **Boundaries.** The maps show India's official boundary: all of J&K and Ladakh, including Gilgit-Baltistan and Aksai Chin. See the README in `assets/geo`.
- **Choropleth scope.** A choropleth colours only countries present in the view's path set. World views use the world file, which drops the smallest islands.
- **One map per id.** A map module keeps its camera state across scaffolds when the same id persists. Use a new id for a new map.
