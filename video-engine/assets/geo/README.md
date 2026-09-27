# Vector map assets (LF worldMap / countryMap)

Compact country outlines for the long-form map modules
(`compositions/components/lib/stage/modules-map.js`, resolved at compile time by
`orchestrator/lib/video/v3/geo.js`).

| file | countries | bytes | detail |
|---|---|---|---|
| `world-110m.json` | 233 | 209,809 | world views (1000 units/rad, DP 1.2) |
| `world-50m.json` | 240 | 374,389 | regional / zoomed views (5000 units/rad, DP 3.0) |

The file names are historical. **Both files are built from the 1:10m India point-of-view layer**, so they show India's
official boundary: all of Jammu & Kashmir and Ladakh, including Gilgit-Baltistan and Aksai Chin. The channel's
audience is Indian. The POV layer has no separate Kashmir or Siachen units, and it does not recognise Kosovo
(it is part of Serbia there).

## Provenance

- **Data:** Natural Earth, Admin 0 – Countries, **India point of view** (`ne_10m_admin_0_countries_ind`), version
  **5.1.1** (the `VERSION` file at the pinned commit below). Made with Natural Earth.
- **Licence:** public domain (https://www.naturalearthdata.com/about/terms-of-use/). No attribution is required.
- **Downloaded:** 2026-09-27 from the official Natural Earth GitHub repository (nvkelso/natural-earth-vector), pinned to
  commit `9380cca83db5f9aef52d5e762765100745f84b27`:
  - https://raw.githubusercontent.com/nvkelso/natural-earth-vector/9380cca83db5f9aef52d5e762765100745f84b27/geojson/ne_10m_admin_0_countries_ind.geojson
    (13,242,091 bytes, sha256 `3e67a5a6ddeff3247ca8400cd2514fd4a5ac6e5432823b25d610a7028597d45f`). **This is the build source.**
  - Earlier builds used the default de facto layers, which are no longer used:
    - `ne_110m_admin_0_countries.geojson` (838,726 bytes, sha256 `6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f`);
    - `ne_50m_admin_0_countries.geojson` (3,083,490 bytes, sha256 `3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb`).
- The raw GeoJSON is **not committed**. It is cached under `orchestrator/output/.cache/geo/`, which is gitignored.

## Build (deterministic)

```
python build_geo.py <ne_10m_admin_0_countries_ind.geojson>
```

What the build does:

- **Projection:** Natural Earth I, y pointing down. Coordinates are rounded to integers:
  - world file (`world-110m.json`) at 1000 units per projected radian;
  - regional file (`world-50m.json`) at 5000 units per projected radian. The stage scales world paths ×5 so both files share map units.
- **Paths:** relative SVG paths, simplified from 1:10m with Douglas–Peucker (1.2 units for the world file, 3.0 for the regional file); specks are dropped.
- **Keys:** ISO3 (`ISO_A3_EH`, else `ADM0_A3`). A Kosovo feature would be keyed `XKX` (the World Bank code), but the India POV layer has none.
- **Fields per country:**
  - `n` name;
  - `a2` ISO2;
  - `d` path;
  - `b` main-landmass bbox, used for fit-to-country. France's `b` leaves out French Guiana; the US's leaves out Alaska and Hawaii;
  - `B` full bbox;
  - `P` bbox of each polygon, used for view culling;
  - `c` Natural Earth label point.

## Boundaries

The build uses India's official boundary (the India POV layer) on purpose. Do not swap in the default de facto layers:
they split Kashmir along the LoC and show Aksai Chin as China. That is not acceptable for this channel.
