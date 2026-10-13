# Carousel generator (IG @vloombox, poster theme, max 7 slides)

```
node runtime/carousel.js <dir>/slides.json <dir>     # renders <dir>/index.html, runs the lint (fix every ERROR)
node runtime/carousel_export.js <dir> --sheet        # slide-N.png (1080x1350) + sheet.jpg; fix every ISSUES line
node runtime/carousel_lint.js <dir>/slides.json      # lint alone
```
Images live in `<dir>/img/` and are referenced relative to slides.json (`"img/x.png"`).

## Rules (why the old carousels failed: weak hook, fragments, 3 boxes per slide, trivia)
- **Max 7 slides.** One idea per slide. Slide 2 must work on its own (Instagram reportedly re-serves unswiped carousels starting from slide 2).
- **Hook**: write 5 cover titles and keep one scoring ≥ 4/5 on: specific · about the reader · open loop · tension · payoff promised in the sub.
- **Spine test**: the 7 headlines read alone tell the whole story.
- **Copy**: headline ≤ 13 words, a full claim. Body 15–55 words of real sentences (≤ 30 on image slides). "Why it matters" ≤ 22 words on every point/paper/repo slide. Every number gets a `source`.
- **One panel per slide**, one visual or one real image. No decoration. Real images only, each with a `credit`.
- Theme: the poster hue (`runtime/theme.js`), dot grid, Anton headlines, paper panel, hard shadow, marker. `brand` = `@vloombox`.
- Caption: hook line + 2–3 lines of value + links (paper / repos) + "save this". Never ask for likes.

## Modes and their 7-slide spines
| Mode (trigger) | 1 | 2 | 3–5 (or 3–6) | 6 | 7 |
|---|---|---|---|---|---|
| explainer ("carousel") | cover | `point`: the core idea / the wrong belief | 3 `point`s | `takeaway`: things to DO | `end` |
| paper ("carousel - paper") | cover: badge "#1 on Hugging Face this week", page-1 polaroid | `point`: the problem | `paper` card (real figure), then the findings as `point`s | last finding / what it means for you | `end` with `link` |
| repos / animation | cover: "4 repos that went nuts this week" + combined stars | 4 × `repo` (real README image, stars, +this week, `get` command) | | `takeaway` / pick by need | `end` |
| vloombox ("carousel - vloombox") | cover: "N sites, rated" | `point`: the problem + how we rate | `rate` × 3 (ascending) | `rate` vloombox (`pick:true`, #1) | `board` with `cta` |

**vloombox mode**: topics like where to find fresh tech jobs, referrals, hiring sites by role. Claims come only from `runtime/assets/vloombox/facts.json` (`verified:true`). vloombox has the strictly highest score and the only `pick` (lint), and is rated last as the climax. Each `rate` has `criteria` (the score ≈ their mean). Competitor pros/cons are factual and fair. Keep the "we built it" tag. On DSA / LLD / interview carousels vloombox is **not** rated as a practice site: it appears as the next step ("ready to apply?") and on the end slide.

## Live sources (`runtime/carousel_fetch.js`)
```
papers [--week 2026-W41] [--n 8]     top papers this week by Hugging Face upvotes (id, title, org, github, summary)
paper <arxivId> <dir>                 -> img/paper-<id>-page1.png (cover), -pfigN.png (PDF figure crops, best), -fig-N.png (HTML), paper-<id>.json
trending [--since weekly] [--lang ts] [--grep animation,motion]   GitHub trending with "stars this week"
search --topic animation [--days 30]  new repos on a topic, most starred
repo <owner/name> <dir>               -> img/repo-<o>_<n>-hero.png (README image), -card.png (GitHub social card), repo-<o>_<n>.json
shot <url> <dir> <name> [--sel css]   screenshot a page or element (demo sites, product pages)
```
Pick the paper for the audience (devs / job-seekers), not only by upvotes. Read the abstract (and the intro if needed) before writing. **Look at every image crop before using it**: arXiv HTML can mangle vector figures (use the `pfig` PDF crops).

## slides.json
```json
{ "topic": "...", "theme": "violet", "brand": "@vloombox", "slides": [ ... ] }
```
Text supports `[[marker]]` (one per headline) and `**bold**`.

| type | fields |
|---|---|
| `cover` | `kicker`, `badge`, `title`, `sub`, `image:{src,credit}` (polaroid) **or** `art` (a visual), `save:true` |
| `point` | `kicker`, `title`, `body`, `visual` **or** `image`, `why`, `whyLabel?`, `source` |
| `paper` | `kicker`, `title`, `image` (figure), `paper:{title,org,date,votes?,link}`, `body` (≤ 30 words), `why` |
| `repo` | `kicker`, `title` (the benefit), `image`, `repo:{name,desc,stars,week,lang,license}`, `body`, `get` (install cmd), `why` |
| `rate` | `kicker`, `title`, `rank`, `name`, `score`, `criteria:[{label,score}]`, `best`, `pros[2]`, `cons[1-2]`, `verdict`, `pick`, `stamp?`, `disclose?`, `source` |
| `board` | `kicker`, `title`, `body?`, `rows:[{name,score,pick?,note?}]`, `why`, `whyLabel?`, `cta?`, `site?` |
| `takeaway` | `kicker`, `title`, `body?`, `items[]` (checklist), `why?` |
| `end` | `title`, `sub`, `link?`, `linkLabel?`, `items?`, `cta` (default "[[Follow]] @vloombox"), `site` |

Visuals (inside `point`/`cover.art`): `stat {value,label,small}`, `bars {sentence?,rows:[{label,pct,value}],caption}`, `flow {nodes[3-4],hot,loop?}`, `qa {pairs}`, `rank {items}`, `chunks` (legacy).
Legacy types (`content`, `recap`) still render for old carousels but skip the v2 lint.

Examples: `out/carousels/2026-10-09-paper-realcompanion/`, `out/carousels/2026-10-09-vloombox-jobs/`.
