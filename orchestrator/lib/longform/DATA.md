# Real data series (LF charts and maps)

## Pipeline

Stage `data` in `make-longform.js` and `research-longform.js` runs between `research` and `outline`:

1. **Input.** `lib/longform/data.js` reads `dossier.dataAsks` (`[{metric, country?, years, worldBankIndicator?}]`).
2. **Fetch.** It calls the World Bank Indicators API v2. The request shape was verified live on 2026-09-27:
   `https://api.worldbank.org/v2/country/<ISO3>/indicator/<CODE>?format=json&date=Y1:Y2&per_page=100`.
   It returns `[meta, rows]`.
3. **Countries.** Names map to codes through a small table, then the `/v2/country` list.
4. **Cache and politeness.** Responses are cached for 24 h under `orchestrator/output/.cache/data`. Requests are limited to ≤ 4/s, with backoff on 429/5xx, and use a descriptive User-Agent.
5. **IMF skipped.** IMF DataMapper is not used; WDI covers the indicators the research prompt asks for.
6. **Output.** `<out>/data.json`:

```jsonc
{ "version": "data.v1", "key": "<hash of dataAsks>",
  "series": [
    { "id": "S1", "kind": "time", "metric": "...", "country": "PAK", "countryName": "Pakistan",
      "unit": "% of GNI", "indicator": "DT.DOD.DECT.GN.ZS", "indicatorName": "External debt stocks (% of GNI)",
      "source": "World Bank, External debt stocks (% of GNI) (DT.DOD.DECT.GN.ZS)",
      "sourceUrl": "https://data.worldbank.org/indicator/DT.DOD.DECT.GN.ZS?locations=PK",
      "licence": "CC BY 4.0", "decimals": 1, "retrieved": "2026-09-27",
      "points": [{ "x": 2010, "y": 32.8 }, ...] },
    { "id": "S3", "kind": "map", "country": "all", "year": 2023, "values": { "PAK": 39.4, ... }, ... } ],
  "skipped": [{ "ask": {...}, "reason": "no World Bank indicator (company / non-WDI data)" }] }
```

### Ids and rounding

- **Ids:**
  - time series come first, in `dataAsks` order;
  - then one cross-country `map` series per distinct indicator. It uses the latest year that has ≥ 60 % of the best year's coverage, countries only (no aggregates).
- **Rounding** is deterministic:
  - the API's `decimal` hint;
  - or, for currency, a rescale to `US$ billion` / `US$ trillion` followed by rounding by magnitude. Map series scale by their median.

### Facts added to the dossier

For every time series, `mergeDataFacts` adds facts to the dossier:

- `D<n>` holds the **latest value** of the series;
- a second `D<n>` holds the **peak**, when the peak falls in a different year.

Each fact looks like this:

```js
{ id, claim, value, unit, year, sources: [{ title: series.source, url: sourceUrl }], confidence: "high", series: "S1" }
```

The merge is idempotent. It also:

- appends the World Bank URLs to `dossier.sources`, so the description credits them;
- writes a summary to `dossier.dataSeries`.

The outline and script see these facts like any other, so the numbers gate accepts "thirty-nine percent of GNI".

## How a storyboard references a series

Any object inside module props or an event `value` that has `series: "<id>"` is filled at compile time.
This happens in `compileStoryboard(sb, timeline, { media, data })`, through `lib/video/v3/series.js`.

| ref | becomes |
|---|---|
| `lineChart` props `{title, series: "S1", from?: 2010, to?, last?}` | `points`, `unit` (unless authored), `decimals`, `source`, `sourceUrl` |
| `lineChart` props `{series: ["S1", "S4"]}` | `series: [{name: <country>, points}]`, sources joined with "; " |
| `barChart` props `{series: "S2"}` | `bars: [{label: "2016", value}]` (the last 8 years unless from/to/last given) |
| map `choropleth: {series: "S3", title?}` (prop or event value) | `values {ISO3: v}`, `unit`, `year`, `source` (with the year) |

### Rules

- **The source line always comes from the data.** Charts must have a source (compile throws without one). A series ref satisfies that rule.
- **Missing data throws.** An unknown id throws. So does a ref when no data.json is given. The compiler never invents a number.
- **Where the data comes from:**
  - `generate-video-v3.js --data <file>`, or `sb.dataFile` (relative to the storyboard);
  - `make-longform.js` sets `dataFile` on a chapter storyboard only when that storyboard has a series ref;
  - the render key then includes a hash of the series.
- **For storyboardLF (to add once the framing work lands):**
  - list `dossier.dataSeries` in the chapter prompt: `S1 time PAK "% of GNI" 2010-2023`;
  - ask for `{series: "S1"}` instead of typed-in points whenever a chart shows one of them;
  - leave `unit` and `source` out of the prompt: they come from data.json.
