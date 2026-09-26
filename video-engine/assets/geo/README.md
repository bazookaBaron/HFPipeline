# Vector map assets (LF worldMap / countryMap)

Compact country outlines for the long-form map modules
(`compositions/components/lib/stage/modules-map.js`, resolved at compile time by
`orchestrator/lib/video/v3/geo.js`).

| file | countries | bytes | source scale |
|---|---|---|---|
| `world-110m.json` | 177 | 74,811 | 1:110m (world views) |
| `world-50m.json` | 239 | 263,550 | 1:50m (regional / zoomed views) |

## Provenance

- **Data:** Natural Earth, Admin 0 – Countries, version **5.1.1**
  (the `VERSION` file at the pinned commit below). Made with Natural Earth.
- **Licence:** public domain (https://www.naturalearthdata.com/about/terms-of-use/).
  No attribution is required. We credit it anyway in this file.
- **Downloaded:** 2026-09-27 from the official Natural Earth GitHub repository
  (nvkelso/natural-earth-vector), pinned to commit `9380cca83db5f9aef52d5e762765100745f84b27`
  (2022-05-13, the last change to both files):
  - https://raw.githubusercontent.com/nvkelso/natural-earth-vector/9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_110m_admin_0_countries.geojson
    (838,726 bytes, sha256 `6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f`)
  - https://raw.githubusercontent.com/nvkelso/natural-earth-vector/9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_50m_admin_0_countries.geojson
    (3,083,490 bytes, sha256 `3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb`)
- The raw GeoJSON is **not committed**. It is cached under `orchestrator/output/.cache/geo/`,
  which is gitignored.

## Build (deterministic)

```
python build_geo.py <ne_110m_admin_0_countries.geojson> <ne_50m_admin_0_countries.geojson>
```

What the build does:

- **Projection:** Natural Earth I, y pointing down. Coordinates are rounded to integers:
  - 110m at 1000 units per projected radian;
  - 50m at 5000 units per projected radian. The stage scales 110m paths ×5 so both files share map units.
- **Paths:** relative SVG paths. The 50m file gets a light Douglas–Peucker pass (2.5 units, about 3 km), and specks are dropped.
- **Keys:** ISO3 (`ISO_A3_EH`, else `ADM0_A3`). Kosovo is keyed `XKX`, which is the World Bank's code for it.
- **Fields per country:**
  - `n` name;
  - `a2` ISO2;
  - `d` path;
  - `b` main-landmass bbox, used for fit-to-country. France's `b` leaves out French Guiana; the US's leaves out Alaska and Hawaii;
  - `B` full bbox;
  - `P` bbox of each polygon, used for view culling;
  - `c` Natural Earth label point.

## Boundaries caveat

Natural Earth's default admin-0 layer draws **de facto** boundaries. For example, Kashmir is split along
the Line of Control, Aksai Chin is shown as China, and Siachen is a separate unit (`KAS`).

Maps of India are legally and politically sensitive for an Indian audience. Natural Earth publishes
point-of-view variants (such as `ne_10m_admin_0_countries_ind`), but only at 1:10m. Downloading one would
need a separate OK. Until then, frame India maps so the northern border is not the focus.
