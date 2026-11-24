# Channel pipeline: "trigger a channel" runbook (2026-11-15)

Run this when the user says "make a Powder Keg film" or "make a Partition Lines film". Any session can follow it.

**From now on each film is made for ONE channel.** The two-version rule (every film ships twice, a Partition and a Powder end line + card) applied only to the films made before the niche split: nvidia_v4, china_v4, trump_v4. New films get a single `channels.json` entry for their own channel and one variant.

| key | channel | niche | tagline |
|---|---|---|---|
| `powder` | Powder Keg | corporate collapses and white-collar fraud | How it blew up |
| `partition` | Partition Lines | geo-economics of borders, chokepoints and trade routes | The lines on the map that move money |

Everything niche-specific lives in `runtime/topics/niches.json` (scope, include/exclude terms, searchQueries, sources, titlePatterns, thumbnailPatterns, length, Shorts plan, seoKeywords, radarBuckets). Background: `runtime/topics/NICHE-RESEARCH-2026-11-15.md`. Read the channel's block before step 4.

## Start here from a new chat (fully runtime, nothing prebuilt)
The trigger is "make a Powder Keg film" or "make a Partition Lines film", optionally with a topic. Nothing from earlier films is reused: every set, cast, MG beat, photo and line is generated for this film at runtime (rule 0). The quality bar is **trump_v4 and china_v4**, which the user approved on 2026-11-15.

**One-command trigger (added 2026-11-22):** `node samples/obj3d/make_film.mjs <powder|partition> <film-id> [--dry-run]` walks the stages below in order, prints each command, skips stages whose inputs are missing and prints the agent briefs for the agent-only stages. See `README.md`.

**Read first, in this order:**
1. this file;
2. `MINIATURE-LESSONS.md`, all 31 items: every one is a mistake that cost a re-render;
3. `SCRIPT-REVIEW-2026-11-15.md` (format and plain-language rules; length = 1,450–1,650 words);
4. `MINIATURE-PLAN.md` (engine, v3 gates, rule 0);
5. the channel's block in `runtime/topics/niches.json`.

**Who does what:**
- **Main thread:** talks to the user, picks the topic with them, briefs agents, reviews outputs, writes `REPORT.md`, reports honestly.
- **Agents** do the work. One producer agent per film owns the film end to end. It may spawn helpers:
  - a research or fact-sheet agent;
  - the script-writer agent (`longform-writer` skill), the only source of spoken lines, including the end line;
  - a fact-check agent;
  - a photo agent.
- **Heavy jobs only through `node runtime/jobq.js`**:
  - one render at a time;
  - no voice job during a render;
  - the RAM floor auto-proceeds after 10 min.

**Producer brief checklist** (paste this into the producer agent's prompt, filled in):
- **Inputs:** film id `<topic>_v1`, channel key, the fact sheet path, and the script path once written.
- **Read:** MINIATURE-LESSONS.md and MINIATURE-PLAN.md before anything else.
- **Script:**
  - the writer's script only;
  - check it is 1,450–1,650 spoken words before voicing (lesson 22);
  - diff the header against the fact sheet (lesson 4);
  - the fact-check agent passes it.
- **Voice:**
  - `python samples/obj3d/audio/voice.py <film> tts`, then `build`;
  - reroll ASR flags once; `--force` only for near-homophones, listed in the report;
  - model from the script header `model:`. The default is s2.1-pro (paid, about $0.12 a film). s2.1-pro-free measured the same in A/B testing, but the user hasn't chosen it yet; use it only if the user says so.
- **Photos:**
  - the user's standing consent: credited copyrighted and news photos are allowed (lessons 17 and 27);
  - follow the preference order, no Getty where an alternative exists, and the content filter;
  - view every photo, and write `contentCheck`, `entities.json` and `photos_missing.txt`;
  - aim for 4.5–5 cards per minute, by coverage, not quota.
- **Plan:**
  - write `films/<film>/make_plan_v4.py` with all-new sets, at least 85% room and street time, MG for numbers (aim for 25–35%), and in-world chapter titles;
  - run `render.mjs shots` until every v3 gate passes;
  - then lines gate, `keycheck.mjs`, `photocheck.mjs`, kindgate for the kinds used;
  - review three contact-sheet rounds.
  - Never loosen a gate.
- **Render and mix:**
  - render: `QS="ar=16x9&film=<film>" VW=1920 VH=1080 node runtime/jobq.js --kind render --prio 1 -- "node samples/obj3d/render.mjs video film 30"`;
  - mix: `python samples/obj3d/audio/mix.py <film> 169`, which defaults to MIX_TP −2;
  - confirm −14 ±0.5 LUFS and ≤ −1 dBTP on the mp4.
- **Channel end line:**
  - one entry in `channels.json` for this channel only;
  - a Powder Keg line must end with the name in its own sentence (lesson 23);
  - then `python samples/obj3d/variants.py <film>`.
- **Thumbnail:** `films/<film>/make_thumb.py` → `out/<film>_thumb.jpg`. Look at it.
- **Return:** the full report as text (lesson 28). It covers:
  - files;
  - length;
  - loudness;
  - photo count and the missing list;
  - voice flags;
  - gates;
  - weak spots;
  - time per stage.
- **Rules:** commit nothing, don't touch the puppet pipeline, never print the Fish key (`.vendor-assets/.env`), no AI images of real people.

**Main thread after the producer reports:**
- Check it yourself:
  - pull the end-card frame and the thumbnail and look at them;
  - run ebur128 on the final mp4;
  - confirm the length.
- Write `films/<film>/REPORT.md`.
- Give the user:
  - the paths;
  - length, photos, gates;
  - the weak spots;
  - the lines to listen to;
  - the upload description (step 8) with the tags.

**Time to quote the user:** about 5–6 h per film end to end, 7 h with a second film in the queue. Add queue waits explicitly (lesson 30).

## Steps

### 1. Radar
```
node runtime/topics/radar.mjs --channel <powder|partition>      # add --no-gdelt --gdelt-photo-budget 0 for a ~3 min pass
```
Writes `runtime/topics/out/<date>/<channel>/radar.md` and `radar.json`: about 12 in-niche topics, each with a draft working title ("draft; the script writer rewrites it"), score breakdown, risk flags, 3-5 sources and licensed photo candidates. Without `--channel` the old all-niche radar runs unchanged. Photos download only with `--download <id> --channel <ch> --dest samples/obj3d/films/<film>` (one film, user approves).

**Opportunity ranking (added 2026-11-15).** The user wants topics with high demand, low competition and lasting growth, strictly in the channel's niche, plus the latest news.
- **Score:** final = 55% opportunity + 30% timeliness + 15% visual/arc. Opportunity is the geometric mean of three parts:
  - demand: YouTube autocomplete depth;
  - competition gap;
  - evergreen/growth: 24 months of Wikipedia pageviews, with a spike penalty.
- **Evergreen backlog:** 27 cases per channel in niches.json `backlog`, scored the same way. A backlog case touched by today's news gets +2 timeliness.
- **Hard niche gate:** off-niche items never appear in the top 10. They're listed only in the appendix, with the reason.
- **YouTube Data API v3 (live since 2026-11-15):**
  - The key is `YOUTUBE_API_KEY` in `.vendor-assets/.env`. Never print it.
  - Demand is the mean views/day of the top 5 results. The gap counts strong same-angle long-form videos from the last 24 months, and only counts fully when demand is at least 4.
  - Quota: the free tier is 10,000 units/day, and one search costs 100. `--yt-budget` defaults to 4000 per run, and results are cached for 7 days. Cache-only rerun: `--yt-budget 0`.
  - News that can't be matched to a company or route goes to "News to watch (not scored)", never into the top 10.
  - A gap of 10 means no recent strong competitor was found, not proof of demand. Check the top-5 evidence in radar.json before picking.
- **Competition gap, older notes (before the API):** empty until one of these exists:
  - a vidIQ export in `runtime/topics/vidiq/<channel>.csv` (columns keyword, search volume, competition, overall). The user's vidIQ is on a different account, so they export it by hand;
  - a YouTube Data API key. Not set up; it needs the user to create one.
  - The YouTube results page is disallowed by robots.txt, so don't scrape it.
- When showing the list, say plainly that the competition gap is unknown unless one of those sources is present.
- Read the angles before scripting: the backlog angles came from the model's knowledge.

### 2. Pick the topic
The user picks one from radar.md. If they say "you choose", propose the top one in two lines (topic, why now, risk flags) and wait one turn unless the standing autonomy rules say proceed. Powder: skip anything that is allegation-only or about a private individual. Partition: skip war-tactics, casualty or prediction topics.

### 3. Fact-sheet research (with sources)
A research subagent writes `films/<film>/factsheet.md`: dated claims, each with a source URL and a tag `filed / ruled / reported / alleged`. Powder: name living people only with charges, filings or rulings. Partition: separate measured facts (tonnage, share, price, date) from analyst opinion. The fact sheet becomes the script header's fact block; the fact-check agent compares every claim with it before voicing.

### 4. Script
Use the script-writer agent (never write lines yourself): `longform-writer` skill, the format in `SCRIPT-REVIEW-2026-11-15.md` (`#hook`, `#chapter`, `{loop}`/`{payoff}`, `{dry}`, `#part`, `#payoff`, 5-7 chapters of 75-110 s, cold open <= 20 s and one question), the plain layman rules (people by role, everyday words, no AI tells), and the channel voice:
- **Powder Keg:** deadpan, forensic, "how did nobody notice". Follow one object (the memo, the ledger, the invoice) to the payoff.
- **Partition Lines:** calm, concrete, money-first. Follow one cargo, ship or price through the line.

Title: written from the channel's `titlePatterns`. Length: the current miniature flow is 8–9 min, which is 1,450–1,650 spoken words; count them before voicing. niches.json's `idealLengthMin` (14–18 min) is the long-term goal; say so honestly if asked.

### 5. Miniature film
Per `MINIATURE-PLAN.md` and `MINIATURE-LESSONS.md` (read the lessons first): plan, gates, review rounds, render, mix, rule 0 (no asset or scene reuse).

### 6. End line and card for THAT channel only
Put one entry in `films/<film>/channels.json`, for the film's own channel:
```
{"powder": {"name": "Powder Keg", "line": "NARR (plain, dry): <last fact line>. Like the video, and subscribe. <name in its own sentence, e.g. 'This channel is called Powder Keg.'>"}}
```
The script writer writes this line. For Powder Keg the name must close its own short sentence, otherwise the name check hears "Powderkeg" (lesson 23).
After the main render run `python samples/obj3d/variants.py <film>` (resume with `--from <stage>`). Do not add the other channel, so only one variant is built.

### 7. Thumbnail
`films/<film>/make_thumb.py` to `out/<film>_thumb.jpg` (1280x720), following the channel's `thumbnailPatterns` (white miniature scene, one red subject, big number tag, label tag, optional credited photo pin). No faces drawn. Readable at phone size. A film is not done without it.

### 8. Upload description template
```
<one-line hook, plain words>

<2-3 sentence summary of what happened and why it matters>

Chapters
0:00 <title>
...

Sources
<every fact-sheet source URL>

Images belong to their owners. Credits: <contents of credits.txt>

<Channel tagline>. Subscribe to <Channel name>.
Illustrated reconstruction; scenes are dramatised miniatures, not footage. Claims about people refer to public filings and reporting; allegations are described as allegations.

Tags: <8-12 picked from the channel's seoKeywords + the topic's own terms>
```

### 9. Shorts
Per the channel's `shorts` block in niches.json (3 per film, 35-55 s). Each Short gets its own hook line from the script-writer agent, ends with a card pointing to the full film, and is never a raw slice of the film. Shorts are for discovery only.
- Powder beats: the hook moment (the memo that...), the most absurd number, how it was caught.
- Partition beats: this one line on the map (a single map move), what one ship crossing costs (number reveal), the country you didn't expect (twist). Same-day topical Shorts are allowed from existing sets with a new script line.

## Monetisation safeguards (from the niche research)
- **Logged human review per film:** the user (or a named reviewer) watches the final cut and the log line goes into `films/<film>/REPORT.md` (date, who, what was checked: facts vs fact sheet, names, ad-safety). No film uploads without it.
- **No visual reuse:** rule 0 holds across films and channels; run the stills comparison against the previous film's contact sheet. Reused or templated visuals risk the "reused content" demonetisation flag.
- **Shorts with their own hooks:** written separately, never auto-sliced.
- Also: ad-safe framing (neutral titles, non-graphic imagery, no war words in thumbnails for Partition Lines); credit every photo; disclose that the scenes are dramatised.
