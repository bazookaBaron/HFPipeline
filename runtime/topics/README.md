# Topic radar (Blind Luck Time)

Finds current, in-niche controversies (corporate scandals, China-US tech/trade, Trump/Russia,
war, espionage, big tech, geopolitics, money), ranks them for virality fit, and finds the most
recent usable photo for each topic's key people, places and organisations.
Node 22, no npm packages.

## Usage

```
node runtime/topics/radar.mjs                         # today -> runtime/topics/out/<date>/radar.md + radar.json
node runtime/topics/radar.mjs --date 2026-11-15 --days 3 --top 15
node runtime/topics/radar.mjs --gnews                 # also use Google News RSS (see robots note below)
node runtime/topics/radar.mjs --no-gdelt              # skip GDELT (faster; GDELT allows 1 request / 5 s)
node runtime/topics/radar.mjs --gdelt-photo-budget 30 # max GDELT photo searches per run (default 30)
node runtime/topics/radar.mjs --channel powder        # niche radar -> out/<date>/powder/radar.md + radar.json (also: partition)
    [--no-gdelt --gdelt-photo-budget 0 for a ~5 min run; --debug --debug-only prints niche-fit of the top 40 clusters and exits]
node runtime/topics/radar.mjs --subject "Tim Cook" --subject "Alice Huang"   # photo lookup only -> out/<date>/subjects.json
node runtime/topics/radar.mjs --download t01 --dest samples/obj3d/films/<film>   # photos/ + photos.json + credits.txt
    [--max 6] [--per-subject 1]
```

A cold full run took about 19 minutes on 2026-11-15, mostly GDELT back-off (it answered 429 often) and article-page reads. Use `--no-gdelt --gdelt-photo-budget 0` for a fast pass of about 3 minutes, with fewer news photos. Responses are
cached in `out/.cache/` (news 1-3 h, Wikipedia/Wikidata metadata 3-7 days), so a re-run is fast.
**Downloads happen only with `--download`**, one film at a time (the user approves downloads per film).

## Sources

| source | used for | notes |
|---|---|---|
| Publisher RSS (BBC, Al Jazeera, NPR, Guardian, NYT, CNBC, DW, France 24, Washington Post) | stories, lead images | syndication feeds; each host's robots.txt is checked |
| GDELT DOC 2.0 API | stories from thousands of outlets, `socialimage`, per-subject photo search | 1 request / 5 s; 429s are retried with back-off |
| Wikipedia Current events portal (last 3 days) | curated stories + exact Wikipedia links for subjects | action API, falls back to the REST HTML if the action API is rate-limited |
| Wikimedia pageviews (top + per-article) | momentum (views vs the prior week) | REST API |
| Hacker News (Algolia) | tech stories, points | API |
| Wikipedia REST summary + media-list, Wikidata | resolve names, person/place/org, P18 image, bioguide ID | |
| Wikimedia file metadata (en.wikipedia action API, Commons API fallback) + Commons search (newest first) | licensed photos with licence/author/date | |
| unitedstates/images (GitHub) | US Congress official portraits (public domain) | via Wikidata bioguide ID |
| News article pages | caption-matched photo or og:image, photo credit | robots.txt checked per host |
| **Skipped:** Reddit | | robots.txt is `Disallow: /` for all agents; JSON returns 403 without OAuth |
| **Skipped:** YouTube counts | | needs a Data API key |
| **Opt-in:** Google News RSS (`--gnews`) | | news.google.com/robots.txt disallows `/rss` for generic agents, so it is off by default |
| **Not automated:** whitehouse.gov, bioguide.congress.gov, DVIDS, State Dept Flickr, Flickr CC search | | WP REST 403 / robots `Disallow: /` / needs API key. White House and DVIDS photos still appear through Commons, where they are tagged PD-USGov |

Requests use the generic User-Agent `TopicRadar/0.1 (research script)`, a per-host rate limit, and the disk cache.

## Clustering and scoring

Headlines are clustered greedily by IDF-weighted overlap of words and capitalised names
(names count 1.6x). Clusters need at least 2 stories, or a Wikipedia Current events entry.
After names are resolved, clusters with the same lead person merge into one topic, and the absorbed
headlines are listed as `angles` (e.g. Huang resigns / Congress summons / successor list).
Ambiguous headline words map to the right article through `ALIASES` in `lib/config.mjs`
(e.g. Congress -> United States Congress).

Each topic's score is in `radar.json -> topics[].score.breakdown`, with the evidence words that fired:

| component | max | signal |
|---|---|---|
| momentum | 25 | distinct outlets, number of source types, Wikipedia views vs the prior week, HN points |
| famous | 15 | people and companies with Wikipedia articles, their average daily views |
| conflict | 15 | controversy words (scandal, resign, spy, sanctions, probe...) |
| arc | 15 | twist words (secret, revealed, second, shaky...), days covered, number of actors |
| visual | 10 | miniature-friendly objects and places (chips, embassy, strait, courtroom...) |
| evergreen | 10 | backstory hooks (China, Russia, CIA, cold war, founder...) |
| nicheFit | 10 | niche buckets hit minus off-niche words; topics under 3 are dropped |

`total = (momentum + famous + conflict + arc + visual + evergreen) x (0.5 + nicheFit/20) - risk penalties`

Risk flags (each a penalty): unverified claims (alleged, reportedly, sources say), defamation risk
(allegations plus named living people), graphic violence, a private individual involved, and thin sourcing.
The lexicons live in `lib/config.mjs`.

The hook is the most central headline in the cluster. It is a pointer, not a script line: spoken
lines go through the script-writer agent.

## Photo rules (user decision 2026-11-15)

Every subject gets the most recent good photo from any source, ranked in tiers:

1. **tier 1, free licence or public domain:** Wikimedia files with CC BY / CC BY-SA / CC0 / PD (incl. PD-USGov White House and DVIDS photos), and Congress portraits. `licence` = e.g. `CC BY 4.0`, `public domain`.
2. **tier 2, press kit:** photos from the company's own newsroom domain. `licence` = `press kit`.
3. **tier 3, news photos:** a photo whose caption or alt text names the subject, else the article's og:image when the headline names the subject. Fair-use files on Wikipedia also land here. `licence` = `copyrighted, credited`.

Within a tier, newest first. Getty Images photos are kept but sort last in their tier and carry
`avoid: "Getty Images: avoid if an alternative exists"`. When the best tier-1 photo is over 2 years old
and a newer photo exists, the subject gets a flag naming the newer one (`newest` in JSON).

Every photo records `credit` (outlet, plus photographer or agency when the page states one), `source`
(the page URL) and `url`. **Credit every photo on its card and in the YouTube description.**
`--download` writes the description note into credits.txt.

- **AI images are excluded:** filename, caption, category or alt text matching AI-generated / Midjourney / DALL-E / Stable Diffusion etc. This is keyword-based, so the producer still has to check.
- **Private individuals:** names without a Wikipedia article, or with only a disambiguation page, are flagged `PRIVATE INDIVIDUAL?`. A photo may still be listed when an article caption names them; showing their face is an editorial call (silhouette preferred).
- `relevance` says how the photo was matched: `caption names the subject` (strong), or `headline names the subject; lead image not verified to show them` (weak: often shows someone else).

### Content filter (required human check)

The radar cannot see images. **Every photo starts as `"contentCheck": "pending"`.** Before use, the film
producer must open each photo and set it to `"ok - <what it shows>"` in photos.json, e.g.
`"ok - Tim Cook on stage, 2026"`.

- **Never use:** gore or blood, bodies, killings or executions, torture, child abuse or children in distress, or sexual content.
- **Allowed:** accident scenes with no visible injured or dead people.
- **Pre-filter:** captions, headlines or filenames with words like body, corpse, killed, execution, blood, massacre, victim, wounded, nude... are marked `"rejected-keyword"`. These never become `best` and are never downloaded.
- **War or attack topics** (`warTopic: true`): news scene photos of non-person subjects carry `warNote`, and places, maps, leaders and documents rank ahead of them.

### photos.json

`--download` matches `samples/obj3d/films/nvidia_v4/photos.json`. Each entry has `file`, `page`, `licence`,
`licenceUrl`, `author`, `credit`, `w`, `h`, `modified`, `source`, `cardCredit` and `checked`, plus
`contentCheck` (and `avoid` for Getty). Set `modified: true` and add `(modified: greyscale, cropped)`
to the credit when you change a photo.

## Known gaps

- Clustering is lexical: the same story can split into 2 topics, and unrelated stories that share a big name can merge. Read the sources.
- A person whose Wikipedia article exists only because of the news event is treated as a public figure. Check the article.
- Photo relevance is by caption or headline text. A news og:image often shows a different person, so `relevance` says which kind of match it is.
- Photo credits are scraped from page markup (JSON-LD creditText, credit classes, or agency names near the image). Many pages state none, so the credit falls back to "<outlet> (photographer not stated)".
- Content and AI filters are keyword-only. The human `contentCheck` is the real gate.
- Wikimedia's anonymous rate limit can 429 the en.wikipedia action API from a shared IP. The radar then falls back to REST and the Commons API, and fair-use files hosted only on en.wikipedia are missed.
- GDELT throttles hard. When the per-run photo budget runs out, later subjects only use images from already-gathered stories.
- No YouTube, Reddit or X/Twitter signal (key or robots). With Google News off by default, mainstream US coverage comes through the publisher feeds and GDELT.

## Channel mode (`--channel powder|partition`, 2026-11-15)

Loads the channel block from `niches.json`. Adds its `sources.rss` + `sources.rssExtra` feeds (same robots, rate limit and cache rules), uses its
`searchQueries` for GDELT, Hacker News and (with `--gnews`) Google News, and defaults to a 7-day window. nicheFit is measured against the channel:
`includeTerms` + `radarTerms` (2 points each) plus matching `radarBuckets` categories; any `excludeTerms` / `radarExclude` hit drops the topic.
Topics need niche fit >= 4. Single-story topics from the channel feeds are kept (they carry the "thin sourcing" flag). Each topic gets a draft
working title from `titlePatterns`, marked "draft; the script writer rewrites it". Without `--channel` nothing changes. The channel runbook is
`samples/obj3d/CHANNEL-PIPELINE.md`.

### Opportunity scoring and evergreen backlog (channel mode)

Each candidate gets 0-10 sub-scores from `lib/opportunity.mjs` (responses cached in `runtime/topics/cache/`):

| sub-score | source | what it measures |
|---|---|---|
| demand | YouTube results page (median views/day of the top 20) + YouTube autocomplete depth | only the autocomplete part runs by default (see robots note) |
| competition gap (higher = less crowded) | YouTube results page: recent (<12 months) videos above 100k views, long explainers on the same angle | **null unless `--yt-search` or a vidIQ file is used** |
| evergreen/growth | Wikipedia monthly pageviews, 24 months, main entity: median month (baseline), last 6 months vs the prior 12 (trend), a spike with no baseline is penalised | |

A failed or blocked source gives `null` (never an invented number), lowers `confidence`, and is listed under "Opportunity sources" in radar.md. Unknown parts count as a neutral 5 in the combined score.
**robots.txt:** `youtube.com/robots.txt` disallows `/results` for generic agents, so the YouTube search page is **off by default**. `--yt-search` is an operator override (like `--gnews`): it requests the page anyway at one request per 4 s with a 12 h cache. It is untested against the live page layout; if the parse fails the sub-score stays null.
Autocomplete is `suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=...` (robots allows it).

**Final ranking:** 55% opportunity (geometric mean of demand, competition gap, evergreen) + 30% timeliness (news momentum; +2 when a news story touches a backlog case) + 15% visual/arc. Hard gate before ranking: niche fit >= 6, no excludeTerm/radarExclude hit, Partition drops war-tactics/casualty wording, Powder drops private individuals and allegation-only stories. Dropped items are listed in an appendix only. News topics about the same entity are merged.

**Backlog:** `niches.json -> <channel>.backlog` = `{name, wiki, match[], angle}` (wiki = exact English Wikipedia title, verified; match = lower-case words that mark a news story as touching this case). Backlog items are scored like news topics; a matching news story becomes the "news peg".

**vidIQ export (optional, offline):** put `runtime/topics/vidiq/<channel>.csv` (or `.json`) exported from vidIQ. Columns (case-insensitive): `keyword`, `search volume` (or `volume`), `competition`, `overall` (or `overall score`). Values 0-100, absolute monthly searches (>100), or text levels (Very low .. Very high). A row matches when its keyword equals or is contained in one of the topic's search phrases, or contains the entity name. Matching rows override demand and competition gap and are marked `source: "vidiq"`. JSON form: an array of objects with the same keys.

### YouTube Data API (default source for demand and competition gap)

`lib/opportunity.mjs` reads `YOUTUBE_API_KEY` from `.vendor-assets/.env` (git-ignored). The key is only added to the request at send time: it is never printed, logged, or part of a cache file name (cache files are `cache/ytapi-<sha1 of the key-less URL>.json`, 7-day TTL).
Per entity: `search.list` (video, 25 results, relevanceLanguage en, order relevance; 100 units) -> `videos.list` (snippet, contentDetails, statistics; 1 unit) -> `channels.list` (statistics for subscriber counts; 1 unit). One phrase per topic, a second phrase only for the current top 15.
- **demand:** median views/day of the results, log scale (20 views/day = 0, 5,000 = 10), blended 80/20 with autocomplete depth.
- **competition gap (10 = open):** 10 - 0.8 per strong same-angle video (title has the entity, > 6 min, <= 24 months old, > 100k views or channel > 500k subs) - 1.5 if the top 5 are all > 500k-subscriber channels, + 1.5 when only old videos prove demand (<= 2 strong recent, >= 2 old videos above the median views/day).
- Optional backlog field `q` replaces the entity name in search phrases when the name is ambiguous (e.g. Olympus).
- **Quota:** `--yt-budget N` caps units per run (default 4000 = about 40 searches). On a 403/429/quotaExceeded the API is switched off for the rest of the run and the remaining sub-scores stay null with a note. The run summary prints `units used / budget`.
- Precedence: vidIQ file > YouTube API > scraped results page (`--yt-search`, opt-in, robots.txt override) > autocomplete only.
