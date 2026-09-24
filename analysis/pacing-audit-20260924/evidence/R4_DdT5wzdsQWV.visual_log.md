# R4_DdT5wzdsQWV visual log (reference, light theme)

169.67 s, 30 fps, vertical 1080x1920.

**Sources:**
- All 57 contact sheets (8 fps) were read, 0.00-169.50 s.
- 17 frame strips at 30 fps.
- Transcript word times.
- The machine beat list, used as a cross-check.

**Key to the Sync column:**
- **A** = anchored: the thing shown is the thing said, within about 0.3 s.
- **N** = near: 0.3-0.6 s off, or only a weak match.
- **F** = free-running.

**Key to the Region column:**
- "card" is the diagram area, given as a % of frame height.
- "full" means the whole frame, i.e. a scaffold crossfade.

## 1. BEAT LOG (144 discrete beats)

| # | t (s) | type | what changed | region | est. dur (ms) | narration at that moment | sync |
|---|---|---|---|---|---|---|---|
| 1 | 0.00 | scene | Whole frame fades in: header, title "Build a file upload service", Google Drive window card, footer | full | 133 | Let's@0.00 | A |
| 2 | 0.20 | appear | Caption pill fades in | caption | 67 | design@0.34 | F |
| 3 | 0.53 | pop | MP4 file icon fades in centre of card | card 40-48% | 100 | design@0.34 / file@0.80 | A |
| 4 | 4.13 | scene | X-fade -> "Looks simple.": Upload-a-file window + Backend Receive->store window + grey connector | full | 150 | The user@4.08-4.36 | A |
| 5 | 4.60 | pop | MP4 icon fades into drop zone | card 33-38% | 100 | picks@4.54 | A |
| 6 | 6.60 | recolor | Connector upload->backend turns blue | card 45-50% | 100 | the backend@6.40-6.46 | A |
| 7 | 6.80 | move | MP4 icon slides down connector and shrinks into doc packet (ease-in-out) | card 35-50% | 630 | stores it@6.70-7.04 | A |
| 8 | 11.37 | scene | X-fade -> "Version 1"; stepper dot 1 fills; Browser/Upload API/Postgres (metadata+file bytes) diagram | full | 150 | Version 1@11.12-11.34 | A |
| 9 | 12.00 | fill | "My files" upload bar fills (continuous, ~0.8 s) | card 33% | 800 | Store everything@11.78-12.16 | N |
| 10 | 12.25 | pop | Packet appears on bytes arrow browser->API | card 32% | 100 | everything@12.16 | F |
| 11 | 13.37 | draw | API->Postgres elbow connector draws (grey ghost path recolors blue) | card 35-50% | 300 | A user@13.46 | A |
| 12 | 13.67 | move | Packet starts travelling API->Postgres (then loops) | card 35-50% | 300 | uploads@14.10 | N |
| 13 | 15.13 | scene | X-fade -> "Validate the user": POST /uploads window, HTTPS chip, Cookie line | full | 150 | validate@15.28 | A |
| 14 | 15.87 | appear | Row "(check) Verify the session" fades/rises in | card 38% | 100 | the user@15.60-15.82 | A |
| 15 | 16.75 | appear | Row "(check) Resolve user_id = 42" + "Authenticated user" box | card 42-45% | 133 | some@16.76 (extract@16.48) | F |
| 16 | 17.13 | scene | X-fade -> "What is metadata?": empty demo.mp4/details window | full | 150 | metadata@16.98 | A |
| 17 | 17.85 | appear | Row name = demo.mp4 | card 33% | 133 | file name@17.62-17.92 | A |
| 18 | 18.23 | appear | Row size = 52428800 bytes | card 36% | 133 | size@18.32 | A |
| 19 | 18.63 | appear | Row type = video/mp4 | card 39% | 133 | type@18.88 | A |
| 20 | 19.00 | appear | Row owner_id = 42 | card 42% | 133 | owner@19.30 | A |
| 21 | 19.60 | pop | MP4 icon pops bottom-right of card | card 55% | 100 | Then@19.62 | F |
| 22 | 20.00 | scene | X-fade -> "Put the file in SQL?": PostgreSQL window file_bytes BYTEA | full | 150 | store@20.04 | A |
| 23 | 20.65 | appear | SQL INSERT INTO files ... text block fades in | card 40% | 133 | itself@20.58 | A |
| 24 | 22.33 | appear | Red-outlined box "Large bytes grow the database" | card 50% | 133 | this@22.34 (bad idea@23.9) | F |
| 25 | 24.00 | appear | Grey note "Postgres supports binary data. The tradeoff is operational cost at scale." | card 54% | 133 | bad idea@23.90-24.08 | A |
| 26 | 26.25 | scene | X-fade -> "Let SQL do SQL": SELECT query window | full | 150 | Databases@26.24 | A |
| 27 | 26.93 | appear | Result row demo.mp4 50 MB | card 45% | 133 | for structured@27.02-27.20 | N |
| 28 | 27.33 | appear | Result row notes.pdf 240 KB | card 48% | 133 | structured data@27.20-27.52 | A |
| 29 | 29.10 | scene | X-fade -> "Binary data adds up": huge blue display text "Big bytes." (no window) | full | 150 | They are not@28.72-29.28 | F |
| 30 | 29.57 | pop | MP4 icon #1 | card 45% | 100 | usually@29.42 | F |
| 31 | 30.23 | pop | MP4 icon #2 (fade + 4 px rise) | card 47% | 100 | best place@29.92-30.08 | F |
| 32 | 30.87 | pop | MP4 icon #3 | card 49% | 100 | videos@30.94 | A |
| 33 | 31.70 | appear | Red strip "More storage I/O - replication - backups" | card 58% | 133 | PDFs@31.58 (backups@32.38) | N |
| 34 | 34.10 | scene | X-fade -> "Version 2"; stepper dot 2; Postgres window over Amazon S3 window | full | 150 | version 2@34.24-34.48 | A |
| 35 | 35.13 | draw | Purple object_key connector Postgres<->S3 draws + purple key packet (loops) | card 45-52% | 250 | metadata@35.28 | A |
| 36 | 37.23 | scene | X-fade -> "The metadata record": empty PostgreSQL/files table | full | 150 | Postgres@37.00 | A |
| 37 | 38.00 | appear | Row id f_1042 | card 33% | 167 | things like@37.78-38.06 | F |
| 38 | 38.40 | appear | Row owner_id 42 | card 36% | 167 | user ID@38.42-38.64 | A |
| 39 | 38.77 | appear | Row name demo.mp4 | card 39% | 167 | ID@38.64 (file name@39.2) | F |
| 40 | 39.10 | appear | Row size_bytes 52428800 | card 42% | 167 | file@39.20 (size@40.2) | F |
| 41 | 39.57 | appear | Row content_type video/mp4 | card 45% | 167 | name@39.60 | F |
| 42 | 39.90 | appear | Row permissions owner: read/write | card 48% | 167 | size@40.20 (permissions@40.64) | F |
| 43 | 40.37 | appear | Row created_at 2026-... | card 51% | 167 | size@40.20 (upload time@41.4) | F |
| 44 | 40.77 | appear | Row object_key u42/f_1042 | card 54% | 167 | permissions@40.64 (object key@42.18) | F |
| 45 | 41.17 | appear | Row status pending -> ready | card 57% | 167 | upload@41.14 | F |
| 46 | 42.63 | scene | X-fade -> "The actual file -> S3": uploads-bucket window, green "Block public access: ON" chip | full | 150 | The actual@42.60-42.96 | A |
| 47 | 43.17 | pop | MP4 icon fades into bucket card | card 50% | 100 | file goes@43.18-43.48 | A |
| 48 | 45.47 | scene | X-fade -> "Two jobs. Two stores.": 4-node diagram (My files, Upload API, Metadata, Amazon S3) | full | 150 | Now your@45.46-45.82 | A |
| 49 | 45.70 | fill | Upload bar fills + blue packet on bytes arrow (loops) | card 33% | 800 | your database@45.82-45.96 | F |
| 50 | 46.90 | draw | Purple API->Metadata elbow draws + packet | card 38-50% | 300 | to query@46.88-47.08 | A |
| 51 | 48.00 | draw | Blue API->S3 elbow draws + packet | card 38-50% | 300 | S3 handles@47.80-48.24 | A |
| 52 | 50.67 | scene | X-fade -> "One bottleneck remains": big blue "5 GB", My files/Upload API/S3 | full | 150 | But now@50.54-50.80 | N |
| 53 | 51.37 | draw | Browser->API connector + packet | card 32% | 200 | another problem@51.22-51.42 | F |
| 54 | 52.75 | draw | API->S3 vertical connector + packet | card 38-50% | 200 | uploads@52.90 | A |
| 55 | 55.70 | appear | Red pill "Then 5 GB out to S3" | card 55% | 133 | all 5GB@55.48-55.64 | A |
| 56 | 60.33 | scene | X-fade -> "An expensive pipe": red display text "API load (up-arrow)" | full | 150 | turns our backend@60.18-60.62 | N |
| 57 | 61.03 | appear | Red row "Network bandwidth" + full-width red bar (fade + 6 px rise) | card 40% | 133 | expensive@61.28 (bandwidth@62.48) | F |
| 58 | 62.13 | appear | Red row "Connection occupancy" | card 46% | 133 | More@62.14 | F |
| 59 | 63.23 | appear | Red row "Memory / buffering pressure" | card 52% | 133 | memory@63.38 | A |
| 60 | 64.33 | appear | Red row "More application capacity" | card 58% | 133 | servers@64.56 | A |
| 61 | 66.67 | scene | X-fade -> "Version 3"; stepper dot 3; diagram with POST / PUT labels | full | 150 | version 3@66.78-66.96 | A |
| 62 | 67.00 | draw | Green POST, purple metadata, blue PUT connectors draw; packets start | card 33-50% | 400 | Upload directly@67.38-67.78 | N |
| 63 | 69.27 | scene | X-fade -> "Ask for permission": POST /uploads JSON window | full | 150 | user first asks@69.30-69.78 | A |
| 64 | 70.47 | appear | Box "Small JSON request" | card 47% | 133 | backend, I want@70.32-71.08 | A |
| 65 | 71.27 | appear | Grey "The video stays in the browser." | card 51% | 133 | upload this file@71.32-71.78 | A |
| 66 | 72.40 | scene | X-fade -> "Check before signing": empty checklist window | full | 150 | backend checks@72.50-72.80 | A |
| 67 | 72.57 | appear | Check row "Authenticated?" | card 36% | 133 | checks@72.80 (authenticated@73.42) | F |
| 68 | 73.90 | appear | Check row "Allowed to upload?" | card 40% | 133 | authenticated@73.42 (allowed@74.58) | F |
| 69 | 75.37 | appear | Check row "Acceptable declared type?" | card 44% | 133 | Is the file type@75.42-76.08 | A |
| 70 | 76.77 | appear | Check row "Enough storage quota?" | card 48% | 133 | Do they@76.96 (quota@77.94) | F |
| 71 | 77.43 | appear | Grey note "Reserve quota, verify size and content after upload." | card 52% | 133 | enough storage@77.48-77.68 | F |
| 72 | 78.73 | scene | X-fade -> "Pre-signed upload URL": PUT one object, PRE-SIGNED URL chip | full | 150 | If everything@78.44-78.88 | F |
| 73 | 79.40 | appear | Row bucket uploads-bucket | card 42% | 167 | looks good@79.12-79.40 | F |
| 74 | 79.87 | appear | Row key u42/f_1042 | card 45% | 167 | the backend@79.70-79.80 | F |
| 75 | 80.27 | appear | Row expiresIn 300 seconds | card 48% | 167 | generates@80.08 | F |
| 76 | 80.77 | appear | Signed https://...X-Amz-Signature URL text | card 53% | 167 | pre-signed URL@80.72-81.20 | A |
| 77 | 82.43 | scene | X-fade -> "A scoped permission": SCOPED + TIME-LIMITED chip | full | 150 | That URL gives@81.96-82.66 | A |
| 78 | 83.17 | appear | Row bucket | card 42% | 167 | the client@83.12-83.30 | F |
| 79 | 83.57 | appear | Row key | card 45% | 167 | temporary@83.52 | F |
| 80 | 83.97 | appear | Row expiresIn 300 seconds | card 48% | 167 | permission@83.88 | A |
| 81 | 84.40 | appear | Signed URL text | card 53% | 167 | upload@84.56 | F |
| 82 | 87.07 | scene | X-fade -> "1. Request -> authorize": 4-node diagram | full | 150 | So the flow becomes@86.78-87.48 | A |
| 83 | 87.47 | draw | Purple "check permissions" elbow API->Metadata + packets | card 38-50% | 300 | flow@87.28 | F |
| 84 | 90.43 | scene | X-fade -> "2. Return the signed URL" | full | 150 | backend creates@90.28-90.58 | A |
| 85 | 91.00 | draw | Green URL connector API->browser + packet | card 32% | 250 | pre-signed URL@91.08-91.56 | A |
| 86 | 92.77 | scene | X-fade -> "3. Browser -> S3": long blue PUT path browser->S3 already drawn | full | 150 | client uploads@92.82-93.08 | A |
| 87 | 97.63 | scene | X-fade -> "Verify. Then mark ready." | full | 150 | Once the upload@97.22-97.68 | A |
| 88 | 97.90 | draw | Green "done" + "HEAD / completion check" connectors | card 32-48% | 300 | finishes@97.90 | A |
| 89 | 98.50 | draw | Purple "status = ready" connector to Metadata + packet | card 42-50% | 150 | mark@98.58 | A |
| 90 | 100.73 | scene | X-fade -> "20 GB. 99% uploaded.": big blue "20 GB" in browser window | full | 150 | what about huge@100.72-101.16 | A |
| 91 | 100.90 | fill | Progress bar fills to 99% (~1.9 s continuous) | card 42% | 1900 | files? If a 20GB@101.38-102.48 | N |
| 92 | 103.10 | appear | Red "Connection interrupted" box | card 47% | 133 | fails@103.22 | A |
| 93 | 104.93 | appear | Grey "Whole-file retry throws away progress." | card 51% | 133 | making the user@104.50-105.22 (restart@105.44) | N |
| 94 | 107.53 | scene | X-fade -> "Upload in parts": empty S3 multipart window | full | 150 | So for large@107.34-107.88 | A |
| 95 | 108.13 | pop | Chunk 01 (fade + 3 px rise) | card 38% | 133 | large files@107.88-108.12 | F |
| 96 | 108.40 | pop | Chunk 02 | card 38% | 100 | we use@108.54 | F |
| 97 | 108.63 | pop | Chunk 03 | card 38% | 100 | multi@108.84 | F |
| 98 | 108.87 | pop | Chunk 04 | card 38% | 100 | multi-part@109.14 | F |
| 99 | 109.13 | pop | Chunk 05 | card 42% | 100 | -part@109.14 | F |
| 100 | 109.37 | pop | Chunk 06 | card 42% | 100 | uploads@109.36 | F |
| 101 | 109.63 | pop | Chunk 07 | card 42% | 100 | uploads@109.36 | F |
| 102 | 109.87 | pop | Chunk 08 | card 42% | 100 | Split@109.98 | F |
| 103 | 110.13 | pop | Chunk 09 | card 46% | 100 | the@110.30 | F |
| 104 | 110.37 | pop | Chunk 10 | card 46% | 100 | file@110.48 | F |
| 105 | 110.60 | pop | Chunk 11 | card 46% | 100 | into@110.68 | F |
| 106 | 110.83 | pop | Chunk 12 | card 46% | 100 | chunks@110.88 | A |
| 107 | 112.10 | appear | Note "Upload parts in parallel; keep each ETag." | card 50% | 133 | 50MB@112.10 (independently@114.04) | F |
| 108 | 115.10 | scene | X-fade -> "Retry only the failed part": empty multipart window (grid rebuilt from zero) | full | 150 | If one chunk fails@114.88-115.66 | A |
| 109 | 115.75 | pop | Chunk 01 re-pops (grid rebuild, 250 ms stagger) | card 38% | 100 | fails@115.66 | F |
| 110 | 116.00 | pop | Chunk 02 | card 38% | 100 | retry@116.12 | F |
| 111 | 116.25 | pop | Chunk 03 | card 38% | 100 | retry@116.12 | F |
| 112 | 116.50 | pop | Chunk 04 | card 38% | 100 | that@116.46 | F |
| 113 | 116.75 | pop | Chunk 05 | card 42% | 100 | chunk@116.64 | F |
| 114 | 117.00 | pop | Chunk 06 | card 42% | 100 | Not@117.08 | F |
| 115 | 117.20 | pop | Chunk 07 appears RED (fade + ~3 px dip-and-return) | card 42% | 133 | Not the@117.08-117.38 | F |
| 116 | 117.37 | pop | Chunk 08 | card 42% | 100 | entire@117.54 | F |
| 117 | 117.63 | pop | Chunk 09 | card 46% | 100 | entire@117.54 | F |
| 118 | 117.73 | recolor | Chunk 07 flips red -> green (RGB lerp, muddy olive midpoint) | card 42% | 133 | entire file@117.54-117.82 | F |
| 119 | 117.87 | pop | Chunk 10 | card 46% | 100 | file@117.82 | F |
| 120 | 118.13 | pop | Chunk 11 | card 46% | 100 | Then@118.08 | F |
| 121 | 118.37 | pop | Chunk 12 | card 46% | 100 | S3@118.54 | F |
| 122 | 118.50 | appear | Note "Retry part 07 -> CompleteMultipartUpload" | card 50% | 133 | Then S3@118.08-118.54 | A |
| 123 | 119.60 | morph | 12 chunks collapse row-by-row toward centre (ease-in) and dissolve into "One object / Complete" S3 card | card 38-50% | 630 | combines the parts into@118.98-119.82 | A |
| 124 | 121.30 | scene | X-fade -> "Downloads: reverse the flow": diagram with file ID label | full | 150 | Downloads@121.00 | N |
| 125 | 121.63 | draw | Green file-ID connector + purple "read permissions" elbow + packets | card 32-50% | 300 | similar way@121.92-122.16 | F |
| 126 | 127.10 | scene | X-fade -> "A signed download URL": green GET URL connector | full | 150 | If they're allowed@127.00-127.48 | A |
| 127 | 131.50 | draw | Blue S3->browser GET path draws + packet | card 38-50% | 370 | client downloads@131.50-131.78 | A |
| 128 | 134.20 | scene | X-fade -> "The bytes bypass the API": blue S3->browser path only | full | 150 | our API server@134.36-135.04 | A |
| 129 | 137.63 | scene | X-fade -> "Popular public files?": Origin S3 + EU/US/APAC edge windows, green Cached chips | full | 150 | popular public@137.84-138.22 | A |
| 130 | 138.37 | draw | Origin->EU edge branch draws blue (near-linear) + packet | card 35-45% | 300 | files@138.48 | F |
| 131 | 139.10 | draw | Origin->US edge branch draws + packet | card 35-45% | 200 | we can put@139.06-139.46 | F |
| 132 | 139.25 | draw | Origin->APAC edge branch draws + packet | card 35-45% | 200 | put a@139.46-139.64 (CDN@139.76) | N |
| 133 | 141.67 | appear | Grey box "Cache hit -> nearest edge -> user" | card 50% | 133 | download from@141.20-141.50 / nearby edge@142.02 | N |
| 134 | 145.53 | scene | X-fade -> "The final architecture": 4-node diagram | full | 150 | So if we simplify@145.46-145.80 | A |
| 135 | 146.43 | draw | Green POST connector + packet | card 32% | 150 | the architecture@146.16-146.38 | F |
| 136 | 147.25 | draw | Purple metadata elbow + packet | card 38-50% | 300 | Postgres stores@146.78-147.54 | A |
| 137 | 148.25 | draw | Blue PUT path + packet | card 38-50% | 300 | information@148.00 | F |
| 138 | 151.73 | scene | X-fade -> "Control access. Scale transfers." (same diagram, connectors reset) | full | 150 | Our backend handles@151.36-152.04 | N |
| 139 | 152.50 | draw | Green POST connector | card 32% | 150 | authentication@152.44 | A |
| 140 | 153.30 | draw | Purple metadata elbow | card 38-50% | 300 | permissions@153.22 | A |
| 141 | 154.40 | draw | Blue PUT path | card 38-50% | 300 | URLs@154.44 | A |
| 142 | 162.73 | scene | X-fade -> "Control the file. Skip the heavy lifting.": pills "API = who + what" (green) / "S3 = the bytes" (blue) | full | 150 | key design idea@162.58-163.00 | A |
| 143 | 164.73 | pop | Postgres elephant + "+" + S3 bucket icons fade in | card 52% | 133 | application server@164.26-164.60 | F |
| 144 | 167.23 | appear | Grey "A scalable file service, by design." | card 58% | 133 | having to@167.36-167.62 | F |

### Ambient (continuous) motion NOT counted as discrete beats above
- **Mascot blink**: eyes-closed sprite held ~200 ms, then hard swap back; no tween (strip 1.150-1.517 s: eyes open f0-f4, closed f5-f10 = 1.317-1.483 s, open f11). Runs on a timer, not narration: ~29 blinks, about every 4.4-5.5 s (machine pairs at 1.3/1.5, 5.7/5.9, 9.2/9.4, 14.6/14.8, 18.8/19.0 ...). Mouth stays in the same open grin in every sheet, so there is **no visible lip-sync**.
- **Packets on connectors**: small blue, purple or green "doc" squares travel along every drawn connector at constant speed and loop. Strip 93.0-94.2 s: horizontal x advances ~5 px/frame at a steady rate f9-f30, which reads as **linear**. The loop period is ~1.6 s (machine periodic beats at 154.6/156.2/157.8/159.4/161.0 s, all settle 367 ms). Present in every diagram scaffold: 6.8-11.3, 13.7-15.1, 35.4-37.2, 45.6-50.6, 51.4-60.3, 67.4-69.2, 87.5-90.4, 91.0-97.6, 98.0-100.7, 121.6-137.6, 138.4-145.5, 146.4-162.7 s.
- **Upload progress bars** in the "My files" node fill slowly and reset with the loop (e.g. 51.0-60.3 s, 45.6-50.6 s).

### Caption style (logged once)
- White rounded pill with a thin grey border and soft drop shadow, horizontally centred, box centre at **~78% of frame height**, below the diagram and footnote.
- Bold dark sans text (Inter-like, same family as titles). Chunks hold **2-4 words, usually 3** ("Let's design a file", "upload service like", "Google Drive. At first,").
- The active word is recoloured **brand blue** with a hard switch per word (0.125 s tiles show the highlight jumping, e.g. 0.25 "Let's"→0.375 "design"→0.875 "file").
- A new chunk replaces the old one roughly **every 0.6-1.3 s**. The swap is a near-cut with a 1-2 frame fade-in (strip 1.000 s f0 shows an empty pill slot, and the new chunk is fully opaque at f1 = 1.033 s; faded tiles also appear at 3.375 s and 8.625 s).
- Captions are never styled with the diagram's accent colours. Machine rows 11-12 were excluded as caption rows.

## 2. SCENE / SCAFFOLD STRUCTURE

There are 33 scaffolds. Every transition is the **same** ~150 ms opacity crossfade: outgoing content dissolves while incoming content fades in with a 2-4 px rise. The header ("SYSTEM DESIGN / FILE SERVICES" + 3-dot stepper), mascot, footnote rule, caption and footer stay persistent and do not transition. Strip 4.000-4.567 s: the old card is gone by f5 (4.167). The new title and windows are ~30% at f5, ~70% at f6, ~90% at f7, and 100% at f8 (4.267), with the title moving up ~2 px. There are **no hard cuts, slides, pushes or morph transitions between scaffolds**. The one morph (chunks into an object, 119.6 s) happens *inside* a scaffold.

| # | time (s) | scaffold (title) | layout | discrete beats | life (s) |
|---|---|---|---|---|---|
| 1 | 0.00-4.13 | Build a file upload service | single window card (Google Drive) | 3 | 4.13 |
| 2 | 4.13-11.37 | Looks simple. | 2 stacked windows + connector | 4 | 7.24 |
| 3 | 11.37-15.13 | Version 1 | 3-node diagram | 5 | 3.76 |
| 4 | 15.13-17.13 | Validate the user | request window + check rows | 3 | 2.00 |
| 5 | 17.13-20.00 | What is metadata? | key/value table window | 6 | 2.87 |
| 6 | 20.00-26.25 | Put the file in SQL? | code window + warning boxes | 4 | 6.25 |
| 7 | 26.25-29.10 | Let SQL do SQL | query + result rows | 3 | 2.85 |
| 8 | 29.10-34.10 | Binary data adds up | big display text + icons | 5 | 5.00 |
| 9 | 34.10-37.23 | Version 2 | 2 stacked windows + purple link | 2 | 3.13 |
| 10 | 37.23-42.63 | The metadata record | table window, 9 rows | 10 | 5.40 |
| 11 | 42.63-45.47 | The actual file → S3 | bucket window | 2 | 2.84 |
| 12 | 45.47-50.67 | Two jobs. Two stores. | 4-node diagram | 4 | 5.20 |
| 13 | 50.67-60.33 | One bottleneck remains | 3-node diagram + "5 GB" | 4 | 9.66 |
| 14 | 60.33-66.67 | An expensive pipe | red display text + 4 red rows | 5 | 6.34 |
| 15 | 66.67-69.27 | Version 3 | 4-node diagram | 2 | 2.60 |
| 16 | 69.27-72.40 | Ask for permission | JSON window | 3 | 3.13 |
| 17 | 72.40-78.73 | Check before signing | checklist window | 6 | 6.33 |
| 18 | 78.73-82.43 | Pre-signed upload URL | ticket window, rows | 5 | 3.70 |
| 19 | 82.43-87.07 | A scoped permission | ticket window, rows | 5 | 4.64 |
| 20 | 87.07-90.43 | 1. Request → authorize | 4-node diagram | 2 | 3.36 |
| 21 | 90.43-92.77 | 2. Return the signed URL | 4-node diagram | 2 | 2.34 |
| 22 | 92.77-97.63 | 3. Browser → S3 | 4-node diagram | 1 | 4.86 |
| 23 | 97.63-100.73 | Verify. Then mark ready. | 4-node diagram | 3 | 3.10 |
| 24 | 100.73-107.53 | 20 GB. 99% uploaded. | big number + progress bar | 4 | 6.80 |
| 25 | 107.53-115.10 | Upload in parts | 4×3 chunk grid | 14 | 7.57 |
| 26 | 115.10-121.30 | Retry only the failed part | chunk grid → merged object | 16 | 6.20 |
| 27 | 121.30-127.10 | Downloads: reverse the flow | 4-node diagram | 2 | 5.80 |
| 28 | 127.10-134.20 | A signed download URL | 4-node diagram | 2 | 7.10 |
| 29 | 134.20-137.63 | The bytes bypass the API | 4-node diagram | 1 | 3.43 |
| 30 | 137.63-145.53 | Popular public files? | origin + 3 edge tree | 5 | 7.90 |
| 31 | 145.53-151.73 | The final architecture | 4-node diagram | 4 | 6.20 |
| 32 | 151.73-162.73 | Control access. Scale transfers. | 4-node diagram (replayed) | 4 | 11.00 |
| 33 | 162.73-169.67 | Control the file. Skip the heavy lifting. | 2 pills + 2 logos | 3 | 6.94 |

Mean scaffold life is **5.14 s** (median 5.0 s, min 2.0 s, max 11.0 s). The same 4-node diagram (My files / Upload API / Metadata / Amazon S3) is re-used in scaffolds 12, 15, 20-23, 27-29, 31 and 32. Each reuse **crossfades to a fresh copy and redraws the relevant connector** rather than morphing in place. The "Version N" scaffolds (3, 9, 15) fill stepper dot N in the header.

## 3. TEN-POINT ANALYSIS

**(1) Beat timestamps:** see the log above. There are 144 discrete beats: 33 scaffold crossfades, 48 appear, 33 pop, 22 connector draws, 3 fills, 2 recolours, 2 moves and 1 morph.

**(2) Gap distribution (discrete beats):**
- Gaps: min 100 ms, p10 240 ms, **median 690 ms**, mean 1178 ms, p90 2670 ms, max 8330 ms.
- Histogram: <200 ms: 7 · 200-400: 35 · 400-700: 30 · 700-1000: 15 · 1-2 s: 27 · 2-3 s: 19 · 3-5 s: 9 · >5 s: 2.
- Time in holds: 77% in gaps >1 s and 54% in gaps >2 s, though ambient packets and blinks cover every hold.
- **Bursts:** chunk grids at ~250 ms (108.13-110.83 s, 12 pops; 115.75-118.37 s, 13 events); metadata rows at ~375 ms (38.0-41.17 s, 9 rows); URL ticket rows at ~400-500 ms (79.4-80.77 s, 83.17-84.40 s).
- **Longest holds:**
  - 154.4→162.73 (8.3 s): final diagram fully drawn, only looping packets plus bar.
  - 121.63→127.10 (5.5 s): download diagram with looping packets.
  - 92.77→97.63 (4.9 s): browser→S3 PUT path with packet looping.
  - 55.7→60.33 (4.6 s): "5 GB" diagram, bar filling, packets.
  - 6.8→11.37 (4.6 s): packet bobbing on the connector.
  - 127.1→131.5 (4.4 s): GET URL packet looping.
  - Every long hold has a live looping element, so no frame is ever fully frozen.

**(3) Rates:**
- 144 discrete beats in 169.7 s = **50.9 discrete beats/min** (machine count, including blinks and loops: 75.7/min).
- **Hard cuts: 0.** Scaffold changes (crossfades): 32 = **11.3/min**, one about every 5.1 s.

**(4) Narration sync:**
- Of 144 beats, **67 (46.5%) are word-anchored** (semantic match within ~0.3 s), 13 (9%) are near (0.3-0.6 s or a weak match) and **64 (44.4%) are free-running**.
- **Scaffold crossfades are the most tightly anchored:** 27 of 33 land within ~0.3 s of the first word of a new sentence or the scene keyword (e.g. 15.13 "validate"@15.28, 34.10 "version 2"@34.24, 92.77 "client uploads"@92.82).
- **Lists run on a fixed timer, not on words:**
  - Metadata rows 38.0-41.17 s run every ~375 ms and lead the narration by 0.6-1.4 s (object_key shown at 40.77, spoken at 42.18).
  - Check rows 72.57/73.90/75.37/76.77 s run on an exact **1.37 s** period and lead the words by 0.6-1.2 s.
  - Red rows 61.03/62.13/63.23/64.33 s run on an exact **1.10 s** period.
  - The chunk grid runs every 250 ms regardless of speech.
- There are 63 sentences, so **2.3 discrete beats per sentence** (the machine count gives 3.4).

**(5) Motion quality (30 fps strips):**

| beat | start frame | settle frame | duration | curve seen |
|---|---|---|---|---|
| Intro whole-frame fade-in | 0.000 (title ~30%) | 0.133 | 133 ms | opacity ease-out + ~2 px rise |
| Scaffold crossfade | 4.133 (old fading) | 4.267 | 133-167 ms | opacity dissolve, incoming +2-4 px rise, no scale |
| MP4 icon pop | 0.533 (~40%) | 0.600 | 100 ms | opacity ease-out, size constant, no overshoot |
| MP4 icon #2 | 30.233 (30%) | 30.333 | 100 ms | fade + 4 px upward, ease-out |
| Check row "Verify the session" | 15.867 (35%) | 15.933 | 100 ms | fade + ~3-4 px rise, ease-out |
| Metadata row size_bytes | 39.067 (~10%) | 39.233 | 167 ms | opacity 10/15/25/55/90/100%, **ease-in-out**, ~3 px rise |
| Red "Network bandwidth" row + bar | 61.033 (30%) | 61.133 | 133 ms | fade + 6 px rise, ease-out; bar appears at full width with **no fill tween** |
| Chunk 01 pop | 108.100 (5%) | 108.233 | 133 ms | fade + 3 px rise, ease-out; next chunk at +267 ms |
| Chunk 07 red appear | 117.167 | 117.333 | 167 ms | fade, then ~2-4 px dip-and-return (y 165→167→169→165), a small nudge |
| Chunk 07 colour flip red→green | 117.733 | 117.833 | 100-133 ms | linear RGB lerp (muddy olive at 117.767) |
| Connector draw API→Postgres | 13.367 | 13.667 | 300 ms | path-reveal along a pre-drawn grey ghost line, near-linear (fast vertical, even horizontal) |
| CDN EU branch draw | 138.367 | 138.667 | 300 ms | near-linear reveal, ~35 px/frame horizontal; next branches at 139.1 / 139.25 |
| File slides down connector | 6.800 | ~7.433 | ~630 ms | **ease-in-out** (2.5 px/f → 6 px/f → ~1 px/f), shrinks into packet |
| Chunks → "One object" morph | 119.600 | 120.233 | ~630 ms | row-staggered collapse to centre, ease-in; new card fades in 120.133→120.233 (100 ms) |
| Packet travel | 93.0 | loop | ~1.6 s loop | linear, constant ~5 px/frame |
| Mascot blink | 1.317 | 1.517 | 200 ms hold | hard sprite swap, no tween |
| Caption chunk swap | 1.000 (empty) | 1.033 | 33-67 ms | near-cut / 1-2 frame fade |
| Logos pop (end) | 164.733 (30%) | 164.833 | 100-133 ms | opacity ease-out, no scale |

No overshoot, bounce or elastic motion was found anywhere, and no element scales up from small. The only non-monotonic motion is the ~3 px nudge on the failed chunk (117.2 s). The house style is a **100-167 ms fade with a 2-6 px rise**. This agrees with the machine data: peak_pos median 0 (motion front-loaded) and median settle 167 ms.

**(6) Camera:** none. Across all 57 sheets the header, mascot, footer and caption stay at identical pixel positions (e.g. mascot silhouette identical at 0.125, 60.0, 120.0 and 169.5 s). There are **no zoom punches, no pans, no shake, no parallax and no depth of field**. The only frame-wide event is the 150 ms crossfade.

**(7) Colour:**
- **Background:** flat warm off-white (#F3F3EE-ish; machine corner luminance constant at 242.8 in every frame), not animated. There may be very faint horizontal banding (visible only in some crops, e.g. strip 60.9 s). Windows are ivory with a light grey title bar and 3 grey "traffic" dots.
- **Accents are semantic, one colour per meaning:** blue = bytes and data path; purple = metadata, keys and permissions; green = control plane, success checks, S3 logo and "Cached ✓" chips; red/brick = cost and failure ("API load ↑" 60.3 s, "Connection interrupted" 103.1 s, failed chunk 117.2 s).
- **Distinct hues visible at once**, excluding the cyan-haired mascot:
  - 1 at 38.0 s (table, purple keys only)
  - 1 at 61.0 s (red only)
  - 2 at 0.5 s (blue icon + Google logo multicolour)
  - 3 at 48.0 s (blue, purple, green)
  - 3 at 99.0 s (green, purple, blue)
  - 3 at 117.8 s (blue chips, red→green)
  - 2 at 138.7 s (green, blue)
  - Machine: median 2, max 3.
- Simultaneous items **share one accent per semantic role**. For example, all 12 chunks are the same pale blue; only the failed one differs. Items are not rainbow-coded.

**(8) Iconography and graphic style:**
- **Flat, no glow.** Mac-style window chrome (3 dots + monospace path, e.g. "api.example.com", "PostgreSQL / files table") on every card.
- **Corners:** window radius ~8-10 px at 1080 w; chips and pills are fully rounded; chunk tiles are rounded squares.
- **Lines:** hairline 1 px grey card borders and ghost connectors; drawn connectors are ~3 px solid orthogonal elbows (no curves, no arrowheads).
- **Icons:** filled product logos (Postgres elephant, S3 green bucket tile, Google Drive), plus a filled blue MP4 file tile with a play glyph.
- **Type:** monospace for keys and values, bold grotesk for titles (the "y" in "bytes" is distinctive).
- **Recurring motifs:**
  - Rick-style mascot, full body, left side, holding a laptop.
  - Header "SYSTEM DESIGN / FILE SERVICES" with a 3-dot stepper.
  - Blue underline dash + bold one-line footnote under each scene (e.g. "Follow one file. Improve its route.").
  - Footer "RICK'S BACKEND LAB / NN" page counter that increments per scaffold (01 at 0 s, 02 at 4.2 s, 03 at 11.4 s ...).
  - Display-size coloured text used as the "diagram" in 3 scaffolds ("Big bytes." 29.1 s, "API load ↑" 60.3 s, "5 GB"/"20 GB" 50.7/100.7 s).

**(9) Sound:** not assessable visually. Visible events that would suit an SFX: packet arrivals, check-row pops (72.6-76.8 s), the red error box (103.1 s), the failed-chunk nudge (117.2 s) and the chunk merge (119.6 s). The machine audio stats show only 15% of prominent transients near a visual beat, which is chance level (23.4% vs 24% chance for beat-to-transient). That suggests no SFX is synced to the visuals.

**(10) Layout and safe zone (fraction of 1920 height):**

| zone | position |
|---|---|
| Top margin | 0-11% clear |
| Header row | ~12.5% |
| Title | 15-19% (two-line titles to ~22%) |
| Subtitle | ~24% |
| Content windows | **~28-62%** tall, x ≈ 29-93% of width |
| Mascot | x 3-27%, y 31-72% (≈41% of frame height), fixed |
| Footnote | ~68-70% |
| **Caption pill** | **~78%** |
| Footer rule + counter | ~87% |
| Bottom margin | 89-100% clear |

Machine content margins (225 px top, 232 px bottom of 1920) agree. The machine row-change profile confirms that change happens almost entirely in bands 2 and 5-9 (title plus diagram) and 12 (caption).

## 4. WHAT MAKES THIS FEEL FAST (observed mechanisms only)

1. **A new scaffold every ~5 s, with its own headline.** There are 32 crossfades in 170 s, each swapping the title text as well as the diagram (4.13, 11.37, 15.13, 17.13, 20.00 s ...). The shortest lives are 2.0 s (15.13-17.13) and 2.34 s (90.43-92.77).
2. **Very short entrances.** Pops and rows settle in 100-167 ms (0.533→0.600; 15.867→15.933; 108.100→108.233), and crossfades take ~150 ms (4.133→4.267). Nothing takes longer than ~630 ms (6.8 s slide, 119.6 s morph).
3. **Timed stagger bursts.** Items land on a fixed grid, faster than speech:
   - 250 ms chunk pops (108.13-110.83 s; 115.75-118.37 s)
   - 375 ms table rows (38.0-41.17 s)
   - 1.1 s and 1.37 s list rows (61.0-64.3 s; 72.6-76.8 s)
   The lists are **shown before they are spoken**, so the eye is always ahead of the ear.
4. **Something always moves.** Linear packets loop on every drawn connector (~1.6 s period), upload bars fill, and the mascot blinks every ~5 s. Even the 8.3 s hold at 154.4-162.7 s and the 5.5 s hold at 121.6-127.1 s never freeze.
5. **Connectors are revealed on the keyword.** Path draws are re-triggered on each re-used diagram: 46.90 "query", 48.00 "S3 handles", 131.50 "client downloads", 153.30 "permissions", 154.40 "URLs". This makes the same diagram feel new each time.
6. **Captions change fast.** Chunks of ~3 words swap every 0.6-1.3 s with a per-word blue highlight (0.25-2.1 s; 8.6-10.0 s). This adds a steady beat in the caption band on top of the diagram beats.
7. **Display-size numbers and words replace diagrams at the tension points.** "Big bytes." (29.1 s), "5 GB" (50.7 s), "API load ↑" in red (60.3 s) and "20 GB" (100.7 s) change the visual scale without any camera move.

## 5. Machine beat list vs visual count

**Totals.** The machine list has **214** beats. I counted **144** discrete beats by eye.

**Why the machine count is higher:**
- **55 machine beats (26%) are mascot blink edges.** These are the rows16 5-6 / settle-33 ms pairs about 200 ms apart (1.3/1.5, 5.7/5.9 ...), so about 29 blinks. They are ambient, not content.
- **About 20 machine beats come from the packet and progress-bar loops.** They sit on a 1.6 s cadence, e.g. 148.43, 150.03, 154.6, 156.2, 157.8, 159.4, 161.0 s, all settle 367 ms. The long settle times (3033 ms at 46.37, 51.47, 121.7, 128.1 s ...) are the continuous progress-bar fills.
- Take those out and the machine list has about 139 beats, close to my 144.

**Where the two counts agree:**
- The machine found 32 large-area beats (area >= 0.25). That matches my 32 scaffold crossfades one-for-one. The timing agrees within 40 ms (e.g. 4.167 vs 4.13; 137.667 vs 137.63).
- Cuts = 0 in both.

**Where they disagree:**
- **Chunk pops.** The machine caught only about 7 of the 12 pops at 108-110.8 s and merged some of the 250 ms stagger.
- **Longest holds.** The machine's longest hold is 2.83 s. Mine is 8.33 s (154.4-162.73 s). My number is longer because I did not count the ambient loops that fill that gap.
- **Anchoring.** The machine's word-onset test gave 46.7% beats within +/-80 ms of a word onset, against 49.9% by chance, so it says "not anchored". My semantic count gives 46.5% anchored. The difference comes from which beats are counted: crossfades and connector draws are anchored, while lists, grids and all ambient motion are free-running. That split is why the machine result looks like chance overall.
