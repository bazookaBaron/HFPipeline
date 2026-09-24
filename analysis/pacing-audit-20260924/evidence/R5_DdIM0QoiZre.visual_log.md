# R5_DdIM0QoiZre — frame-by-frame visual log

Source: 720x1280, 30 fps, 164.9 s. Evidence used: all 55 contact sheets (8 fps, 0.00–164.75 s) read in order; 30 fps strips for 26 windows (list in §5); a HUD crop sheet sampled at 31 times (`R5_hud.png`); full frames at 44.9 s and 118.4 s (`R5_full_449.png`, `R5_full_1184.png`); pixel-diff tests for Ken Burns. Beat stats come from `r5_build.py` → `r5_stats_mine.json`. The scaffold table comes from `r5_scaf.py`.

Topic: "What does Palantir actually do?". It is a faceless explainer with a cartoon mascot (bald kid with glasses holding a tablet) on a dark UI "dashboard" canvas.

Legend for the beat log:
- **kind**: SWAP = the layout or sub-layout changes in a single frame. POP = an element enters. LIT = a highlight or recolor. DRAW = a stroke or line draws on. TITLE = a serif hero word appears. LABEL = a small mono or sans label. MOVE = a translation. TYPE = a typewriter effect. STRIKE = a strikethrough. GRID = a cell-wave fill.
- **sync**:
  - A = word-anchored: the thing shown is the thing being said, within about 0.3 s. I allowed up to 0.45 s and noted lags.
  - S = synced to the onset of a sentence or phrase. It is a structural swap whose content is the topic of the sentence, not one specific word.
  - F = free-running: no word match, or more than 0.45 s off.
- **narration at t**: the Whisper words around the beat's start.
- **region**: % of frame height. L/R = the mascot side or the right-hand info panel.

Frame zones used below:
- HUD label: about 11% H.
- Main framed content box: 14–44% H.
- Mascot: 41–71% H, x 0–41%.
- Right info panel: 46–61% H, x 43–94%.
- Caption: 78% H.

## 1. BEAT LOG (entire video, 202 visual beats)

| # | t (s) | kind | what changed | region (% H) | motion ms | narration at t | sync | anchor word |
|---|---|---|---|---|---|---|---|---|
| 1 | 0.233 | MOVE | Mascot slides in from left edge | L 41-71% | 330 | "What does Palantir" | F |  |
| 2 | 0.600 | POP | Palantir logo pops right of mascot | R 46-48% | 66 | "does Palantir actually" | A | Palantir@0.44 |
| 3 | 0.633 | DRAW | Connector curves draw between 5 DB nodes | top 30-40% | 270 | "does Palantir actually" | F |  |
| 4 | 1.375 | LABEL | Logo sub-label 'PALANTIR TECHNOLOGIES' fades in | R 49% | 100 | "actually do? People" | F |  |
| 5 | 1.500 | LABEL | 2nd sub-label line (founded/HQ) fades in | R 50% | 100 | "actually do? People" | F |  |
| 6 | 2.000 | SWAP | Sub-scaffold 'WHAT PEOPLE SAY IT IS': node map dims, logo out, chip 'the spy company' | full | 33 | "do? People talk" | S | People@1.80 |
| 7 | 2.500 | POP | Chip 'the AI company' stacks in | R 50% | 100 | "talk about Palantir" | F |  |
| 8 | 2.750 | POP | Chip 'big data' stacks in | R 51% | 100 | "about Palantir all" | F |  |
| 9 | 3.625 | POP | Chip 'the Peter Thiel one' stacks in | R 52% | 100 | "the time. It" | F |  |
| 10 | 4.000 | POP | Chip 'nobody really knows' stacks in | R 53% | 100 | "the time. It" | F |  |
| 11 | 4.417 | SWAP | Chips replaced by list POLITICAL/MYSTERIOUS/CONTROVERSIAL | R 48-56% | 33 | "time. It is" | A | It is political@4.16-4.64 |
| 12 | 4.917 | LIT | POLITICAL stamp-box (scale-down + tilt) | R 49% | 167 | "is political, it" | A | political@4.64 |
| 13 | 5.875 | LIT | MYSTERIOUS stamp-box | R 52% | 167 | "is mysterious, it" | A | mysterious@5.76 |
| 14 | 6.875 | LIT | CONTROVERSIAL stamp-box | R 55% | 167 | "is controversial. But" | A | controversial@6.80 |
| 15 | 7.883 | SWAP | List collapses into small pill row at top of box | top 16% / R | 33 | "controversial. But most" | S | But@7.58 |
| 16 | 8.875 | POP | Empty 'WHAT IT ACTUALLY DOES' box | R 46-56% | 100 | "still cannot explain" | A | cannot explain what@8.76-9.40 |
| 17 | 9.375 | POP | '?' appears in box | R 51% | 100 | "explain what the" | A | explain@9.04 |
| 18 | 10.875 | LIT | '?' ring pulse | R 51% | 250 | "actually does. So" | A | does@10.62 |
| 19 | 11.375 | SWAP | 'ONE ORGANISATION' card appears top, node map removed | top 22-30% | 33 | "does. So let's" | S | So let's fix that@11.16 |
| 20 | 11.750 | MOVE | Pill row + '?' box slide/fade out; header -> 'START HERE' | top/R | 150 | "let's fix that." | F |  |
| 21 | 12.500 | SWAP | CHAPTER 2 'THE PROBLEM' (HUD seg 2): timeline + facts table + 3 founder photos | full content | 33 | "that. Palantir was" | A | Palantir was founded@12.40 |
| 22 | 12.625 | LIT | First founder photo highlighted | R 57% | 66 | "that. Palantir was" | F |  |
| 23 | 13.950 | TITLE | Serif '2003' + tick marker fade/scale in on timeline | top 22% | 67 | "in 2003 to" | A | 2003@13.72 |
| 24 | 14.750 | SWAP | Sub-scaffold 'WHAT IT WAS BUILT FOR' (content cleared) | full content | 33 | "to solve one" | S | to solve@14.72 |
| 25 | 14.875 | LABEL | Paragraph 'The data an organisation already has...' fades in | R 51-55% | 100 | "to solve one" | F |  |
| 26 | 15.317 | TITLE | Serif 'ONE PROBLEM' fade + tracking-in | top 30% | 100 | "one problem. Large" | A | one problem@14.98-15.18 |
| 27 | 15.650 | LABEL | Mono sub 'SOLVE THIS AND YOU HAVE A COMPANY' | top 33% | 67 | "one problem. Large" | F |  |
| 28 | 16.250 | SWAP | Sub-scaffold 'A LARGE ORGANISATION': empty data panel + 3-row table | top 24-35% + R | 33 | "problem. Large organizations" | A | Large organizations@16.02 |
| 29 | 17.533 | GRID | Data grid fills in a diagonal cell wave | top 25-34% | 400 | "organizations already had" | A | enormous@17.88 |
| 30 | 19.250 | LABEL | Header -> 'COMPLETELY DIFFERENT SYSTEMS'; right card text swap | top 14% + R | 33 | "data, but it" | S | but@19.08 |
| 31 | 19.700 | MOVE | Grid splits into 5 offset blocks | top 25-34% | 170 | "was scattered across" | A | scattered@19.62 |
| 32 | 21.000 | LABEL | System labels fade in under 5 blocks | top 35% | 100 | "different systems. Imagine" | A | systems@21.00 |
| 33 | 21.933 | SWAP | CHAPTER 3 'AN INTELLIGENCE AGENCY' (HUD 3): full-width Pentagon photo card, mascot hidden | full | 33 | "systems. Imagine an" | A | Imagine an intelligence agency@21.74 |
| 34 | 23.767 | SWAP | 'WHAT THE AGENCY ALREADY HOLDS': 5 dim source tiles + list; mascot back | full | 33 | "agency. You have" | S | You have@23.48 |
| 35 | 24.375 | LIT | FIELD REPORTS tile fills with image + list row | top 18-23% | 100 | "field reports, satellite" | A | field reports@24.02-24.30 |
| 36 | 25.625 | LIT | SATELLITE IMAGERY tile fills + list row | top 18-23% | 100 | "satellite imagery, location" | A | imagery@25.24 |
| 37 | 25.750 | POP | Detail sub-panel (scene metadata) appears | R 58-62% | 100 | "satellite imagery, location" | F |  |
| 38 | 26.125 | LIT | LOCATION DATA tile fills; detail -> coordinates | top 18-23% + R | 100 | "imagery, location data," | A | location@25.86 |
| 39 | 27.125 | LIT | COMMUNICATIONS tile fills + list row | top 18-23% | 100 | "data, communications and" | A | communications@26.88 |
| 40 | 27.875 | LIT | DEPT DATABASES tile + detail -> 'DEPT A person_id' | top + R | 100 | "and databases built" | A | databases@27.86 |
| 41 | 29.125 | POP | DB cylinder icons pop (1 then 3, staggered) | top 36-38% | 130 | "different departments. The" | A | different departments@28.84-29.16 |
| 42 | 30.100 | SWAP | 'NOTHING IS MISSING': cylinders out, 'A LACK OF DATA' label, problem panel | full content | 33 | "departments. The problem" | A | The problem is not a lack of data@30.00 |
| 43 | 31.125 | STRIKE | Strike through 'A LACK OF DATA' | L 36% | 150 | "lack of data." | A | lack@30.94 |
| 44 | 31.867 | SWAP | 'FIVE SOURCES, NO JOIN': grids removed, list panel returns | full content | 33 | "data. The problem" | S | The problem is that@31.66 |
| 45 | 32.250 | LABEL | Mono 'NO SHARED KEY . NO JOIN . NO PICTURE' | top 34% | 100 | "problem is that" | F |  |
| 46 | 32.625 | TITLE | Serif 'NONE OF IT CONNECTS' | top 38% | 100 | "that none of" | A | none@32.54 |
| 47 | 33.533 | SWAP | CHAPTER 4 'GOTHAM' (HUD 4): 'PALANTIR'S FIRST PLATFORM' + table | full content | 33 | "connects. Palantir built" | A | Palantir built Gotham@33.54 |
| 48 | 34.375 | TITLE | Serif 'GOTHAM' | top 37% | 100 | "built Gotham for" | A | Gotham@34.28 |
| 49 | 35.125 | LABEL | Sub 'ONE PLACE WHERE ALL OF IT MEETS' + mini logo | top 42% | 100 | "this world. Think" | F |  |
| 50 | 35.600 | SWAP | 'ONE GIANT DETECTIVE WALL': title out, 1st pinned evidence card, panel swap | full content | 33 | "world. Think of" | S | Think of it as@35.42 |
| 51 | 36.350 | POP | Evidence card 2 (laptop photo) pops, tilted | top 28-33% | 100 | "one giant detective" | F |  |
| 52 | 36.617 | POP | Evidence card 3 pops | top 28-33% | 66 | "giant detective wall," | F |  |
| 53 | 36.850 | POP | Evidence card 4 pops | top 28-33% | 66 | "giant detective wall," | F |  |
| 54 | 37.375 | POP | Evidence card 5 (map) pops | top 33-38% | 100 | "detective wall, except" | F |  |
| 55 | 37.875 | SWAP | Header 'MANUALLY CONNECTING PHOTOS WITH RED STRING'; panel METHOD/SCALE | top 14% + R | 33 | "wall, except instead" | S | Except instead of@37.62 |
| 56 | 38.000 | POP | Evidence card 6 pops lower | top 36% | 100 | "wall, except instead" | F |  |
| 57 | 39.367 | DRAW | Red string 1 draws card->card | top 30% | 100 | "connecting photos with" | A | photos with red string@39.26 |
| 58 | 39.800 | DRAW | Red string 2 draws | top 32% | 130 | "photos with RedString," | F |  |
| 59 | 40.100 | DRAW | Red string 3 draws | top 33% | 130 | "with RedString, the" | A | RedString@40.06 |
| 60 | 40.967 | SWAP | 'THE SOFTWARE LINKS THEM': cards removed, dim entity nodes, panel | full content | 33 | "RedString, the software" | A | the software links@40.72-41.34 |
| 61 | 42.000 | LIT | PERSON node lights pink | top 27% | 66 | "links people, places," | A | people@41.66 |
| 62 | 42.250 | LIT | PLACE node lights | top 27% | 66 | "people, places, events," | A | places@42.12 |
| 63 | 42.750 | LIT | EVENT node lights | top 32% | 66 | "places, events, documents" | A | events@42.64 |
| 64 | 43.125 | LIT | DOCUMENT node lights | top 34% | 66 | "events, documents and" | A | documents@43.02 |
| 65 | 43.750 | LIT | VEHICLE node lights | top 37% | 66 | "and vehicles together." | A | vehicles@43.58 |
| 66 | 44.250 | DRAW | Pink link curves draw node->node (sequential) | top 27-40% | 350 | "vehicles together. An" | A | together@43.86 |
| 67 | 44.867 | SWAP | 'AN ANALYST STARTS WITH ONE PERSON': PERSON teal 'SUBJECT 4471', entity table | content + R | 33 | "together. An analyst" | A | An analyst@44.58 |
| 68 | 46.900 | SWAP | 'AN ASSOCIATED PHONE NUMBER': panel -> call log | top 14% + R | 33 | "person, find an" | A | find an associated phone@46.68 |
| 69 | 48.000 | LIT | PHONE node lights + number label + link | top 27-30% | 100 | "phone number, connect" | A | phone number@47.64-48.04 |
| 70 | 48.633 | SWAP | 'THAT NUMBER TO A LOCATION': panel -> satellite map | top 14% + R | 33 | "number, connect that" | A | connect that number@48.46 |
| 71 | 48.750 | LIT | LOCATION node lights + coords + link | top 27-30% | 100 | "number, connect that" | F | (location@49.54, 0.8s early) |
| 72 | 49.867 | LABEL | Map caption 'SAME CELL SITE, SAME HOUR' | R 60% | 100 | "a location, and" | F |  |
| 73 | 50.133 | SWAP | 'AND THAT LOCATION TO ANOTHER EVENT': panel -> chain list | top 14% + R | 33 | "location, and then" | S | and then connect that@50.06 |
| 74 | 50.600 | LIT | EVENT node lights + date + link | top 32% | 100 | "then connect that" | F | (event@51.78, 1.2s early) |
| 75 | 52.100 | POP | EVENT row appended to chain list | R 58% | 66 | "another event. Palantir" | A | event@51.78 |
| 76 | 52.567 | SWAP | CHAPTER 5 'THE SAME PROBLEM' (HUD 5): graph out, 'GOVERNMENT & DEFENSE', compare table | full content | 33 | "another event. Palantir" | S | Palantir later realized@52.62 |
| 77 | 53.500 | MOVE | Card row push-slide: agency cards exit left, manufacturer cards enter right | top 18-24% | 570 | "later realized businesses" | A | businesses@53.86 |
| 78 | 55.125 | POP | Teal pill 'THE SAME PROBLEM' | top 37% | 100 | "same problem. Imagine" | A | same problem@54.94 |
| 79 | 55.867 | SWAP | Full-width factory photo card 'IMAGINE A MANUFACTURER', mascot hidden | full | 33 | "problem. Imagine a" | A | Imagine a manufacturer@55.72 |
| 80 | 56.750 | LIT | Table value 'ONE PER FUNCTION' brightens | mid 53% | 66 | "a manufacturer. Factory" | F |  |
| 81 | 57.250 | SWAP | 'FACTORY DATA IS IN ONE SYSTEM': list + detail; mascot back | full | 33 | "manufacturer. Factory data" | A | Factory data@57.12 |
| 82 | 57.875 | POP | Factory machine photo pops with connector | top 34-38% | 100 | "data is in" | A | data@57.56 |
| 83 | 59.133 | SWAP | 'ORDERS ARE SOMEWHERE ELSE': ORDERS row lit, photo dims, detail -> SO numbers | top 14% + R | 33 | "system. Orders are" | A | Orders@58.80 |
| 84 | 60.567 | SWAP | 'SHIPPING . PAYMENTS . INVENTORY': relayout, shipping photo, 3-row panel | content + R | 33 | "else. Shipping, payments" | A | Shipping@60.38 |
| 85 | 61.125 | POP | Payments photo pops | top 34% | 100 | "Shipping, payments and" | A | payments@60.98 |
| 86 | 61.750 | POP | Inventory photo pops | top 34% | 100 | "and inventory, each" | A | inventory@61.48 |
| 87 | 61.875 | POP | 4th photo (warehouse) pops | top 34% | 100 | "and inventory, each" | F |  |
| 88 | 62.400 | SWAP | 'EACH IN ITS OWN DATABASE': photos out, 5 DB cylinders under cards | full content | 33 | "inventory, each live" | A | each live in their own database@62.14 |
| 89 | 62.750 | DRAW | Drop lines card->cylinder | top 24-26% | 100 | "live in their" | F |  |
| 90 | 63.500 | LABEL | Mono 'FIVE KEYS . NO JOIN' | top 30% | 100 | "own database. So" | F |  |
| 91 | 64.067 | SWAP | 'SO PALANTIR BUILT': cylinders out, panel BUILT FOR COMMERCIAL | content + R | 33 | "database. So Palantir" | S | So Palantir built@63.98 |
| 92 | 64.500 | DRAW | Teal drop lines grow down from cards | top 24-27% | 130 | "So Palantir built" | F |  |
| 93 | 65.067 | POP | Teal FOUNDRY bar grows (130ms) then serif text fades (100ms) | top 27-31% | 330 | "built Foundry. Foundry" | A | Foundry@65.02 |
| 94 | 65.600 | LABEL | Sub 'ONE PLACE THE FIVE SYSTEMS MEET' | top 33% | 100 | "built Foundry. Foundry" | F |  |
| 95 | 65.900 | SWAP | CHAPTER 6 'FOUNDRY' (HUD 6): 'FOUNDRY BRINGS THEM TOGETHER', bar moves up, 5-row list | full content | 33 | "Foundry. Foundry brings" | A | Foundry brings@65.78 |
| 96 | 67.750 | LIT | List rows get teal 'connected' badges | R 50-54% | 100 | "together and turns" | A | together@67.34 |
| 97 | 68.100 | SWAP | 'RAW ROWS BECOME REAL-WORLD OBJECTS': object-icon row + panel text | content + R | 33 | "together and turns" | A | turns them into@68.20 |
| 98 | 68.375 | LIT | Object icon 1 highlighted | top 32% | 66 | "and turns them" | F |  |
| 99 | 68.875 | LIT | Object icon 2 highlighted | top 32% | 66 | "into something people" | F |  |
| 100 | 69.250 | LIT | Object icon 3 highlighted | top 32% | 66 | "something people inside" | F |  |
| 101 | 69.625 | LIT | Object icon 4 highlighted | top 32% | 66 | "people inside the" | F |  |
| 102 | 70.400 | SWAP | 'SOMETHING PEOPLE CAN ACT ON': panel -> action cards, 1st amber | R 46-60% | 33 | "can actually use" | A | can actually use@70.22 |
| 103 | 70.875 | POP | 2nd action row | R 52% | 66 | "actually use for" | F |  |
| 104 | 71.250 | LIT | 3rd action row amber | R 55% | 66 | "for decisions and" | A | decisions@71.22 |
| 105 | 72.967 | SWAP | 'ONE MACHINE, TWO WORLDS': FOUNDRY|GOTHAM dim columns, panel gone | full content | 33 | "operations. Foundry is" | A | Foundry is the@72.92 |
| 106 | 73.875 | LIT | FOUNDRY column lights | top 18-30% L | 100 | "the commercial data" | A | commercial@73.76 |
| 107 | 74.625 | LABEL | Mono 'SAME OBJECT MODEL' | top 32% R | 100 | "data platform, while" | F |  |
| 108 | 75.375 | LIT | GOTHAM column lights | top 18-30% R | 100 | "platform, while Gotham" | A | Gotham@75.46 |
| 109 | 77.125 | POP | Teal pill 'GOVERNMENT & DEFENSE' under Gotham | top 30% | 100 | "with government and" | A | government@76.96 |
| 110 | 78.367 | SWAP | CHAPTER 7 'THE ONTOLOGY' (HUD 7): 'THE WORD ?' box + graph + panel | full content | 33 | "defense. Now there" | S | Now there is one concept@78.16 |
| 111 | 79.900 | LIT | '?' ring pulse | top 24% | 200 | "hear constantly, the" | F |  |
| 112 | 80.600 | SWAP | Box + panel removed, header 'THE WORD' | content | 33 | "constantly, the ontology." | S | the ontology@80.42 |
| 113 | 80.875 | TITLE | Serif 'THE ONTOLOGY' | top 22% | 100 | "the ontology. This" | A | ontology@80.68 |
| 114 | 81.125 | LABEL | Mono 'WHERE RAW DATA GETS REAL-WORLD MEANING' | top 25% | 100 | "the ontology. This" | F |  |
| 115 | 81.625 | SWAP | 'RAW DATA, THEN MEANING': raw rows -> arrow -> dim meaning box | full content | 33 | "ontology. This is" | A | This is where raw data@81.32-82.28 |
| 116 | 83.125 | LIT | Meaning box lights teal | top 18-26% R | 100 | "real -world meaning." | A | real-world@82.84 |
| 117 | 83.625 | LABEL | 'THE COMPANY'S OWN WORDS' | top 28% | 100 | "-world meaning. Instead" | F |  |
| 118 | 84.167 | SWAP | 'WHAT A DATABASE ACTUALLY SAYS': DB table (847 row amber) + panel | full content | 33 | "meaning. Instead of" | A | a database@84.64-84.72 |
| 119 | 86.750 | LIT | '847' cell amber outline | top 20% | 66 | "equals 847, the" | A | 847@86.42 |
| 120 | 87.000 | LABEL | Mono 'A NUMBER. NOTHING ELSE.' | top 25% | 100 | "equals 847, the" | F |  |
| 121 | 87.533 | SWAP | 'WHAT THE ONTOLOGY SAYS INSTEAD': FACTORY A object card | full content | 33 | "847, the ontology" | A | the ontology represents@87.36 |
| 122 | 89.783 | LIT | FACTORY A card brightens to active (title/values white) | top 20-30% | 66 | "factory A. It" | A | factory A@89.46-89.80 |
| 123 | 90.500 | SWAP | 'AND WHAT IT IS CONNECTED TO': object graph | full content | 33 | "A. It produces" | S | It produces@90.22 |
| 124 | 90.875 | DRAW | Link FACTORY A -> products | top 27% | 200 | "produces these products." | A | produces@90.58 |
| 125 | 92.400 | DRAW | Link orders -> FACTORY A | top 27% | 350 | "These orders depend" | A | orders depend@92.18-92.50 |
| 126 | 93.000 | LABEL | Edge label 'DEPENDS ON' | top 28% | 100 | "depend on it." | F |  |
| 127 | 94.000 | DRAW | Link FACTORY A -> shipments | top 28-31% | 150 | "These shipments leave" | A | leave@94.10 |
| 128 | 94.967 | SWAP | 'NOT THIS': raw table | full content | 33 | "it. So instead" | S | So instead of@94.80 |
| 129 | 96.750 | STRIKE | Strike line through table + 'PEOPLE DO NOT THINK IN TABLES' | top 20-23% | 150 | "database tables, people" | A | tables@96.30 |
| 130 | 97.233 | SWAP | 'OBJECTS AND RELATIONSHIPS': full object graph | full content | 33 | "tables, people work" | A | people work with actual objects@96.88-98.14 |
| 131 | 99.875 | LABEL | Mono 'THE REAL WORLD, IN SOFTWARE' top-right | top 16% | 100 | "real world. Then" | A | real world@99.64 |
| 132 | 100.500 | SWAP | CHAPTER 8 'FORWARD DEPLOYED ENGINEERS' (HUD 8): PALANTIR|CUSTOMER cards + panel | full content | 33 | "world. Then there" | S | Then there are forward@100.32 |
| 133 | 101.300 | MOVE | Engineer icon travels Palantir card -> Customer card with trail line | top 27% | 330 | "are forward deployed" | A | deployed@101.38 |
| 134 | 102.033 | LABEL | 'PALANTIR ENGINEER' label | top 30% | 100 | "deployed engineers, or" | F |  |
| 135 | 102.667 | SWAP | 'THE JOB TITLE YOU WILL HEAR': cards shrink to top strip, panel out | content | 33 | "engineers, or FDS." | A | or FDEs@102.42 |
| 136 | 102.900 | TITLE | Serif 'FDE' | top 36% | 100 | "or FDS. Palantir" | A | FDEs@102.72 |
| 137 | 103.150 | LABEL | Mono 'FORWARD DEPLOYED ENGINEER' | top 39% | 100 | "or FDS. Palantir" | F |  |
| 138 | 103.767 | SWAP | Photo card 'INSIDE THE CUSTOMER'S OWN OPERATION' + WHERE/WITH/ON table | full content | 33 | "FDS. Palantir engineers" | S | Palantir engineers work@103.66 |
| 139 | 105.875 | LIT | Row 'THE CUSTOMER'S SITE' brightens | R 50% | 66 | "inside customer operations," | A | customer@105.66 |
| 140 | 106.500 | LIT | Row 'THEIR REAL PROBLEMS' brightens | R 55% | 66 | "customer operations, connecting" | F |  |
| 141 | 107.133 | SWAP | 'CONNECTING DATA, BUILDING WORKFLOWS': customer-ops box + chips + steps | full content | 33 | "operations, connecting data" | A | connecting data@106.86 |
| 142 | 107.250 | DRAW | Connector lines between POS/ERP/TMS/LEDGER/API | top 23% | 100 | "operations, connecting data" | A | data@107.32 |
| 143 | 108.250 | LIT | Workflow steps 2-3 brighten | R 51-55% | 100 | "and building workflows" | A | building workflows@108.16 |
| 144 | 109.133 | TYPE | 'AROUND A REAL PROBLEM': question types on (870ms, linear) + LATE DELIVERY WATCH panel | top 22-30% + R | 870 | "around the real" | A | the real problems@109.38 |
| 145 | 111.375 | LABEL | Mono 'LATE DELIVERY WATCH' under question | top 31% | 100 | "organizations have. And" | F |  |
| 146 | 111.767 | SWAP | CHAPTER 9 'AIP' (HUD 9): 'AND THEN SOMETHING CHANGES' teal base bar | full content | 33 | "have. And then" | S | And then AI happened@111.62 |
| 147 | 112.283 | POP | Amber 'A LANGUAGE MODEL' chip drops in from above | top 32% | 170 | "then AI happened." | A | AI@112.16 |
| 148 | 112.750 | LABEL | 'ARRIVES ON TOP' | top 35% | 100 | "AI happened. In" | F |  |
| 149 | 113.367 | SWAP | 'TWENTY YEARS AFTER 2003': timeline 2003..2023 + dashed 'SOMETHING NEW' | full content | 33 | "happened. In 2023," | A | In 2023@113.08-113.48 |
| 150 | 113.617 | DRAW | Timeline progress line 2003->2023 + end dot | top 18% | 430 | "In 2023, Palantir" | A | 2023@113.48 |
| 151 | 115.500 | POP | Amber AIP box fills dashed slot | top 24% | 133 | "launched AIP, its" | A | AIP@115.28 |
| 152 | 116.367 | SWAP | 'WHAT THE LETTERS STAND FOR': AIP title + A/I/P tiles (A lit) + panel | full content | 33 | "AIP, its artificial" | A | artificial@116.46 |
| 153 | 117.125 | LIT | I tile lights | top 23% | 66 | "artificial intelligence platform." | A | intelligence@116.78 |
| 154 | 117.750 | LIT | P tile lights | top 23% | 66 | "platform. Here is" | F | (platform@117.18, 0.57 late) |
| 155 | 118.267 | SWAP | 'HERE IS WHY THAT MATTERED': model vs company cards + cursor panel | full content | 33 | "platform. Here is" | S | Here is why@117.72 |
| 156 | 119.633 | SWAP | 'A MODEL, ON ITS OWN': LANGUAGE MODEL chip + panel | full content | 33 | "mattered. The language" | A | The language model@119.44-119.76 |
| 157 | 120.875 | DRAW | 4 dangling unplugged stubs drop below chip | top 25% | 133 | "by itself can" | A | itself@120.58 |
| 158 | 121.750 | LABEL | Mono 'NOTHING OF YOURS IS PLUGGED IN' | top 28% | 100 | "answer questions. But" | F |  |
| 159 | 122.300 | SWAP | 'NOT THIS': 'Summarize this document' pill + panel | full content | 33 | "questions. But a" | S | But a company@122.08 |
| 160 | 123.875 | STRIKE | Pill struck through | top 20% | 150 | "to summarize this" | A | summarize@123.74 |
| 161 | 124.750 | LABEL | Mono 'A COMPANY DOES NOT WANT THIS' | top 22% | 100 | "this document. It" | F |  |
| 162 | 125.267 | SWAP | 'THIS': amber prompt box + sources table | full content | 33 | "document. It wants" | S | It wants@125.06 |
| 163 | 125.375 | TYPE | Prompt types on in lockstep with speech: 'Which factories are at risk' | top 22-25% | 1200 | "It wants which" | A | which factories@125.64-125.80 |
| 164 | 126.950 | TYPE | Typing line 2 'of missing deliveries' | top 25% | 500 | "of missing deliveries" | A | missing deliveries@126.92 |
| 165 | 128.000 | TYPE | Typing 'next week?' | top 27% | 200 | "next week. Why" | A | week@127.82 |
| 166 | 128.500 | SWAP | 'AND THEN THE TWO HARD ONES': 'WHY?' box fades in | full content | 100 | "week. Why and" | A | Why@128.22 |
| 167 | 129.125 | POP | 'WHAT SHOULD WE DO ABOUT IT?' box fades in | top 26% | 100 | "and what should" | A | what should@129.02 |
| 168 | 130.250 | LABEL | Mono 'BOTH ANSWERS LIVE IN THEIR OWN DATA' | top 29% | 100 | "about it? That" | F |  |
| 169 | 130.625 | SWAP | 'IT ONLY WORKS ON A STACK': question bar + 4-layer stack | full content | 33 | "it? That only" | S | That only works when@130.42 |
| 170 | 132.183 | POP | Amber AIP layer drops onto top of stack | top 23% | 170 | "sits on top" | A | sits on top@131.88-132.40 |
| 171 | 133.667 | LABEL | Mono 'AIP SITS ON TOP OF ALL OF IT' | top 33% | 100 | "company data, permissions," | F |  |
| 172 | 134.133 | LABEL | Header -> 'AND THE THREE LAYERS BETWEEN' | top 14% | 33 | "data, permissions, business" | A | permissions business logic@133.92-134.94 |
| 173 | 136.867 | SWAP | 'THE ANSWER, WITH ITS REASONS': ranked plant list, PLANT A amber | full content | 33 | "ontology. AIP does" | S | AIP does exactly that@136.74 |
| 174 | 137.625 | LIT | PLANT D row amber | top 24% | 66 | "does exactly that" | F |  |
| 175 | 137.875 | LIT | PLANT C row teal | top 26% | 66 | "exactly that while" | F |  |
| 176 | 138.467 | SWAP | 'WITH THE CONTROLS STILL ON': THE DATA circle + faint role chips | full content | 33 | "that while keeping" | S | while keeping@138.22 |
| 177 | 139.100 | DRAW | Dashed access ring fades in + 'ACCESS CONTROLS' | top 18-31% | 100 | "keeping access controls" | A | access@138.92 |
| 178 | 139.500 | LIT | ANALYST chip lights teal | top 22% | 66 | "access controls and" | A | controls@139.26 |
| 179 | 140.100 | LIT | EVERYONE ELSE chip labelled | top 22% | 66 | "and governance around" | F |  |
| 180 | 141.267 | SWAP | CHAPTER 10 'THE BUSINESS' (HUD 10): card row + 4-step teal pipeline + panel | full content | 33 | "data. And that" | S | And that is really@141.10 |
| 181 | 142.100 | POP | Palantir logo pops beside mascot | R 47% | 66 | "the Palantir business." | A | Palantir@142.10 |
| 182 | 142.750 | LABEL | 'THE PALANTIR BUSINESS' sub-label | R 49% | 100 | "Palantir business. It" | A | business@142.50 |
| 183 | 143.167 | SWAP | 'WHAT IT IS NOT': two bars AN AI COMPANY / GOVT SURVEILLANCE SOFTWARE | full content | 33 | "business. It is" | S | It is not simply AI@142.94 |
| 184 | 143.967 | STRIKE | Strike through 'AN AI COMPANY' (267ms ease-out) | top 23% | 267 | "simply AI, and" | A | AI@143.78 |
| 185 | 145.875 | STRIKE | Strike through 'GOVERNMENT SURVEILLANCE SOFTWARE' | top 27% | 250 | "government surveillance software." | A | surveillance@145.70 |
| 186 | 147.100 | SWAP | 'AT ITS CORE': card row + big data grid | full content | 33 | "software. At its" | S | At its core@146.56 |
| 187 | 148.750 | LABEL | Mono 'EVERY SYSTEM, EVERY YEAR, NO SHARED KEY' | top 32% | 100 | "takes messy data" | A | messy data@148.58 |
| 188 | 149.400 | MOVE | Header 'SCATTERED ACROSS AN ORGANISATION' + grid splits into 5 | top 14-31% | 170 | "data scattered across" | A | scattered@149.22 |
| 189 | 149.500 | LABEL | 'FIVE SYSTEMS, FIVE KEYS' | top 32% | 100 | "data scattered across" | F |  |
| 190 | 151.167 | SWAP | 'CONNECTS IT, AND NAMES IT': teal pipeline tiles lit | top 26-32% | 33 | "organization, connects it," | A | connects@150.92 |
| 191 | 153.367 | SWAP | 'AND BUILDS ON TOP OF IT': layered stack panel appears | R 46-56% | 33 | "meaning, and builds" | A | builds@153.42 |
| 192 | 153.875 | LIT | APPLICATIONS layer lights | R 48% | 66 | "builds applications and" | A | applications@153.68 |
| 193 | 154.625 | LIT | AIP layer amber | R 46% | 66 | "and AI on" | A | AI@154.42 |
| 194 | 155.500 | SWAP | 'SO PEOPLE CAN DECIDE': stack out, ACTED ON tile lights | content | 33 | "top, so people" | S | so people@155.32 |
| 195 | 156.633 | POP | Amber decision card 'MOVE SO-88214' | R 49-54% | 100 | "make decisions with" | A | decisions@156.52 |
| 196 | 157.667 | SWAP | 'THEY ALREADY HAVE ALL OF IT': big data grid | full content | 33 | "it. Most companies" | S | Most companies already@157.38 |
| 197 | 159.200 | LABEL | Mono 'NOTHING NEW HAS TO BE COLLECTED' | top 36% | 100 | "the information they" | F |  |
| 198 | 160.033 | SWAP | 'ALL THAT DISCONNECTED INFORMATION': scattered entity nodes | full content | 33 | "they need. Palantir" | S | Palantir tries@160.12 |
| 199 | 161.375 | DRAW | Teal links draw progressively between nodes | top 25-36% | 500 | "turn all that" | A | turn...disconnected@161.12-161.74 |
| 200 | 163.183 | SWAP | 'WHAT PALANTIR IS FOR': nodes snap into one linked row | top 25-35% | 33 | "information into one" | A | one@163.24 |
| 201 | 163.283 | DRAW | Underline draws left->right under row | top 36% | 250 | "into one operating" | F |  |
| 202 | 163.450 | TITLE | Serif 'ONE OPERATING PICTURE' fades in | top 38% | 67 | "one operating picture." | A | operating@163.46 |
**Not logged as beats: continuous mascot idle animation.** The mascot blinks, and there are small mouth and tablet shifts. Strips confirm it:
- A blink at 3.20–3.30 s: eyes closed for 4 frames, about 133 ms.
- A double blink at 67.25–67.35 s and 67.48 s.
- A mouth and tablet shift at 8.883–8.95 s.

The machine list has 40 beats confined to band 7-7 (44–50% H = mascot eyes). This is the blink track, about 14.5 per minute.

**Caption style (logged once):**
- Position: centered at about 78% H (text baseline around y=1003/1280). The box spans about 75–81% H and roughly x 22–78%.
- Font and box: bold geometric sans (Inter-like), about 34 px cap-to-descender on 720 px, on a dark translucent rounded box (about 6 px radius).
- Highlight: one word at a time, karaoke style. The word being spoken is white. The other words in the chunk are about 50% gray. Previously spoken words go back to gray: at 3.75 s only "the" is white in "Palantir all the time.".
- Chunks: 1–4 words, e.g. "What does Palantir", "actually do?", "847,", "week.". A chunk usually lasts 0.6–1.6 s: "What does Palantir" runs 0.125–1.375; "People talk about" runs 2.0–2.75.
- Chunk change: the old chunk dims for about 1 frame at 8 fps (5.625 "It is political, it" shows faded). The new chunk enters dim, then goes bright within about 100 ms (2.000 → 2.125, 21.875 → 22.0).
- Rate: about 3 words per chunk × 481 words gives roughly 160 chunks, about 58 per minute (estimated, not counted).

## 2. SCENE / SCAFFOLD STRUCTURE

There are three nested levels:

**(a) Chapters (HUD level): 10.** A 10-segment progress bar sits top-right with a chapter label top-left. It advances one teal segment per chapter; this is verified in `R5_hud.png`.

| Chapter | Starts at (s) |
|---|---|
| WHAT DOES PALANTIR ACTUALLY DO | 0 |
| THE PROBLEM | 12.50 |
| AN INTELLIGENCE AGENCY | 21.93 |
| GOTHAM | 33.53 |
| THE SAME PROBLEM | 52.57 |
| FOUNDRY | 65.90 |
| THE ONTOLOGY | 78.37 |
| FORWARD DEPLOYED ENGINEERS | 100.50 |
| AIP | 111.77 |
| THE BUSINESS | 141.27 |

Mean chapter length is 16.5 s. Every chapter change is a 1-frame content swap. The HUD, grid background and mascot persist across it.

**(b) Layout scaffolds: 33.** A scaffold is a persistent layout or anchor element. Mean life is 5.0 s, median 3.3 s, range 1.1–28.8 s. The two long ones are persistent **5-card top rows**:
- Agency sources, 23.77–52.57 s (28.8 s).
- Manufacturer systems, 57.25–72.97 s, and again 147.1–164.9 s.

Many sub-states are hard-swapped beneath each of those rows.

**(c) Sub-states: 63.** Each sub-state is a change of the subheader label inside the content box, e.g. "AN ANALYST STARTS WITH ONE PERSON". There are 62 SWAP beats (22.6 per minute), so a sub-state lasts 2.6 s on average.

| # | time range (s) | life (s) | scaffold | beats inside | entry transition |
|---|---|---|---|---|---|
| 1 | 0.00-2.00 | 2.0 | Intro node map 'FIVE SYSTEMS . ONE ORGANISATION' + logo | 5 | opens on it; mascot slides in 330ms |
| 2 | 2.00-11.38 | 9.4 | 'WHAT PEOPLE SAY IT IS' over dimmed node map (chips -> word list -> pill row + '?' box) | 13 | hard swap 1f |
| 3 | 11.38-12.50 | 1.1 | 'ONE ORGANISATION / START HERE' card | 2 | hard swap 1f (+150ms fade-out of leftovers) |
| 4 | 12.50-14.75 | 2.2 | Ch2 THE PROBLEM: founding timeline + facts + founders | 3 | hard swap 1f |
| 5 | 14.75-16.25 | 1.5 | 'WHAT IT WAS BUILT FOR': ONE PROBLEM serif | 4 | hard swap 1f |
| 6 | 16.25-21.93 | 5.7 | Data-grid panel (whole -> split into 5) | 5 | hard swap 1f |
| 7 | 21.93-23.77 | 1.8 | Ch3 full-width Pentagon photo card (no mascot) | 1 | hard cut 1f |
| 8 | 23.77-52.57 | 28.8 | Agency 5-source card row (persistent top row; 12 sub-states below: holds / nothing missing / no join / GOTHAM / wall / red string / entity links / analyst->phone->location->event) | 42 | hard cut 1f |
| 9 | 52.57-55.87 | 3.3 | Ch5 'BUSINESSES HAVE THE SAME PROBLEM' compare (card row pushes agency->manufacturer) | 3 | hard swap 1f; card row push-slide 570ms inside |
| 10 | 55.87-57.25 | 1.4 | Full-width factory photo card (no mascot) | 2 | hard cut 1f |
| 11 | 57.25-72.97 | 15.7 | Manufacturer 5-card row (persistent; 9 sub-states: factory data / orders / shipping / DBs / so built / FOUNDRY bar / brings together / objects / act on) | 24 | hard cut 1f |
| 12 | 72.97-78.37 | 5.4 | 'ONE MACHINE, TWO WORLDS' Foundry|Gotham columns | 5 | hard swap 1f |
| 13 | 78.37-81.62 | 3.3 | Ch7 'THE WORD' ? box + ontology graph -> THE ONTOLOGY serif | 5 | hard swap 1f |
| 14 | 81.62-87.53 | 5.9 | Tables: raw->meaning, then DB table w/ 847 | 6 | hard swap 1f |
| 15 | 87.53-94.97 | 7.4 | FACTORY A object card -> object graph | 7 | hard swap 1f |
| 16 | 94.97-97.23 | 2.3 | 'NOT THIS' raw table | 2 | hard swap 1f |
| 17 | 97.23-100.50 | 3.3 | 'OBJECTS AND RELATIONSHIPS' graph | 2 | hard swap 1f |
| 18 | 100.50-103.77 | 3.3 | Ch8 PALANTIR|CUSTOMER cards -> FDE serif | 6 | hard swap 1f |
| 19 | 103.77-107.13 | 3.4 | FDE photo card + WHERE/WITH/ON table | 3 | hard swap 1f |
| 20 | 107.13-111.77 | 4.6 | Customer-ops chips box -> typed problem question | 5 | hard swap 1f |
| 21 | 111.77-113.37 | 1.6 | Ch9 base bar + LANGUAGE MODEL chip | 3 | hard swap 1f |
| 22 | 113.37-116.37 | 3.0 | Timeline 2003->2023 + AIP slot | 3 | hard swap 1f |
| 23 | 116.37-118.27 | 1.9 | AIP letters A/I/P | 3 | hard swap 1f |
| 24 | 118.27-119.63 | 1.4 | Model-answers vs company-asks cards | 1 | hard swap 1f |
| 25 | 119.63-122.30 | 2.7 | LANGUAGE MODEL chip alone (unplugged) | 3 | hard swap 1f |
| 26 | 122.30-128.50 | 6.2 | Prompt pill: NOT THIS -> THIS (typed amber prompt) | 7 | hard swap 1f |
| 27 | 128.50-130.62 | 2.1 | Two hard questions WHY? / WHAT SHOULD WE DO | 3 | hard swap + 100ms box fade |
| 28 | 130.62-136.87 | 6.2 | Question + 4-layer stack (+AIP layer) | 4 | hard swap 1f |
| 29 | 136.87-138.47 | 1.6 | Ranked answer list (Plant A/D/C) | 3 | hard swap 1f |
| 30 | 138.47-141.27 | 2.8 | THE DATA circle + access ring + roles | 4 | hard swap 1f |
| 31 | 141.27-143.17 | 1.9 | Ch10 manufacturer card row + 4-step pipeline + logo | 3 | hard swap 1f |
| 32 | 143.17-147.10 | 3.9 | 'WHAT IT IS NOT' two struck bars | 3 | hard swap 1f |
| 33 | 147.10-164.90 | 17.8 | Recap on manufacturer card row (grid -> split -> pipeline -> stack -> decision -> grid -> nodes -> one row) | 17 | hard swap 1f |

Scaffolds: 33; mean life 5.00s; median 3.26s; min 1.1s; max 28.8s

**Transitions between scaffolds:**
- **Every scaffold change is a hard 1-frame swap.** There are no crossfades, slides, morphs or camera pushes between scaffolds. Strips confirm it:
  - 7.850 → 7.883: the word list becomes the pill row.
  - 21.900 → 21.933: grid to Pentagon photo.
  - 4.383 → 4.417: chips to word list.
  - 163.150 → 163.183: scattered nodes snap into one row, with no tween.
  - Machine cross-check: 45 of 56 large-area machine beats (area ≥ 0.2) settle in ≤33 ms.
- What makes the hard swaps feel continuous is what stays put: the HUD, the grid background, the mascot, the framed content box, and (inside scaffolds 8, 11 and 33) the 5-card top row.
- The only animated *layout* transition is inside scaffold 9: a horizontal **push-slide of the card row** at 53.50–54.07 s (570 ms). Agency cards exit left with ease-in; manufacturer cards enter from the right with ease-out.
- The mascot enters once, sliding in at 0.233 s. It hard-cuts out and in for the two full-width photo scaffolds: gone at 21.933 and back at 23.767; gone at 55.867 and back at 57.25.

## 3. THE 10-POINT ANALYSIS

### (1) Beat timestamps
See §1: 202 beats. The mix by kind is: 62 SWAP, 42 LIT, 30 LABEL, 29 POP, 16 DRAW, 7 TITLE, 6 MOVE, 5 STRIKE, 4 TYPE and 1 GRID.

### (2) Gap distribution (between consecutive logged beats, ms)
- **min 33 · p10 250 · p25 450 · median 633 · p75 1033 · p90 1575 · max 2734 · mean 812.**
- Histogram: <200 ms: 13 · 200–400: 31 · 400–700: 61 · 700–1000: 39 · 1–2 s: 49 · 2–3 s: 8 · >3 s: **0**.
- Time spent in gaps longer than 1 s is 50% of the runtime. Gaps longer than 2 s cover 11%.
- Beats per 10 s window: 17, 14, 10, 17, 14, 11, 18, 10, 11, 9, 13, 12, 11, 11, 11, 8, 5. The front half is denser than the back half, and the outro slows down.

**Bursts:**
- 0.23–1.50 s: 5 beats in 1.3 s (mascot, logo, lines, 2 labels).
- 41.97–44.87 s: 7 beats in 2.9 s (5 entity nodes light one per word, then links draw, then a swap).
- 24.38–27.88 s: 6 beats in 3.5 s (source tiles light one per word).
- 60.57–62.75 s: 6 beats in 2.2 s.
- 125.27–129.13 s: 6 beats (typed prompt locked to speech, then two question boxes).

**Longest holds (what's on screen):**

| Hold (s) | Length | On screen |
|---|---|---|
| 134.13–136.87 | 2.73 s | Static 5-layer stack (AIP / ontology / business logic / permissions / connected data) plus the mono line "AIP SITS ON TOP OF ALL OF IT". The narration names the layers ("permissions, business logic, and the ontology") but they are **not** highlighted one by one. |
| 97.23–99.88 | 2.64 s | Static object graph (order, Factory A, product, shipment) during "objects and relationships from the real world". |
| 84.17–86.75 | 2.58 s | Static DB table with amber row 847 during "Instead of a database saying factory ID equals". The 847 cell outline lands at 86.75. |
| 87.53–89.78 | 2.25 s | FACTORY A object card, dim, until it brightens on "factory A". |
| 109.13–111.38 | 2.24 s | Typed question (typing takes the first 870 ms) plus the LATE DELIVERY WATCH panel. |
| 151.17–153.37 | 2.20 s | Teal 4-step pipeline (FIVE SYSTEMS → CONNECTED → NAMED → ACTED ON) during "connects it, gives it real world meaning". |
| 103.77–105.88 | 2.11 s | Static FDE photo card (no Ken Burns). |

The machine reports a 3.50 s hold at 91.47–94.97 s. It is not real: line draws at 92.40 (orders→Factory) and 94.00 (Factory→shipments) fall inside it.

### (3) Beats/min and cuts/min
- **73.5 visual beats per minute** (202 in 164.9 s).
- **True cuts: 0.** There is no shot change; the chrome and mascot are always continuous.
- **Content hard-swaps: 62, or 22.6 per minute.** Of these, 10 are chapter changes (3.6/min) and 33 are scaffold changes (12/min).
- The two full-bleed photo cards at 21.933 and 55.867 are the closest thing to editorial cuts, because the mascot disappears.

### (4) Narration-to-visual sync
- **Word-anchored (A): 114/202 = 56%.**
- **Sentence/phrase-onset structural swaps (S): 31 = 15%.**
- **Free-running (F): 57 = 28%.**
- Most F beats are secondary: mono kicker labels, staggered evidence cards, sequential icon highlights at 68.4–69.6, and early node lights at 48.75 and 50.60.
- Beats per spoken sentence (45 sentences): **mean 4.6, median 4, min 1, max 17.** The 17 is the 35.4–44.2 s "detective wall … people, places, events, documents and vehicles together" sentence.

Typical anchoring lag is +0.1 to +0.35 s after word onset:
- political 4.64 → 4.917
- 2003 13.72 → 13.95
- people 41.66 → 42.00
- surveillance 145.70 → 145.875

Early outliers:
- LOCATION node at 48.75, 0.8 s before "location".
- EVENT node at 50.60, 1.2 s before "event".

Machine cross-check: only 35% of its beats fall within ±80 ms of a word onset, against 45% by chance. The anchoring is to meaning at about +0.1–0.35 s, not to syllable onsets.

### (5) Motion quality (measured on 30 fps strips)

| Beat | Frames (start→settle) | Duration | Curve observed |
|---|---|---|---|
| Mascot slide-in | 0.233→0.567 | 330 ms | ease-out: large steps f1–f4, tiny steps f8–f11; no overshoot |
| Palantir logo pop | 0.567 absent → 0.600 ~50% → 0.633 full | 66 ms | near-hard fade, no scale |
| DB connector draw | 0.633→~0.90 | ~270 ms | progressive stroke reveal |
| POLITICAL stamp-box | 4.917→5.083 | 167 ms | starts ~130% scale, ~3° tilt, low opacity; scales down to 100%, ease-out; no overshoot |
| Chips→word list | 4.383→4.417 | 1 frame | hard swap |
| List→pill row | 7.850→7.883 | 1 frame | hard swap |
| "2003" serif + tick | 13.950→14.017 | 67 ms | fade + slight scale-down, ease-out |
| "ONE PROBLEM" | 15.317→15.417 | 100 ms | opacity 40→100% plus letter-spacing tightening; mono subtitle 15.650→15.717 (67 ms) |
| Grid cell wave | 17.533→17.933 | 400 ms | diagonal staggered fill, roughly linear front |
| Grid split to 5 | 19.667→19.833 | 170 ms | ease-out (biggest jump in the first frame); blocks end with ± y offsets; no overshoot |
| Pentagon card | 21.900→21.933 | 1 frame | hard cut; photo static afterwards (mean abs diff 22.1 vs 23.6 s = 0.03/255) |
| Red strings (×3) | 39.367→39.467 · 39.80→39.93 · 40.10→40.23 | 100–130 ms each | stroke draw, staggered about 350 ms |
| Entity link curves | 44.25→~44.60 | ~350 ms | sequential stroke draw |
| Card-row push-slide | 53.50→54.07 | 570 ms | exit ~230 ms ease-in (accelerating), entry ~330 ms ease-out; no overshoot |
| FOUNDRY bar + text | bar 65.067→65.20; text 65.30→65.40 | 130 ms + 100 ms (230 ms stagger) | bar grows, ease-out; text fades |
| Engineer icon travel | 101.333→101.667 | 330 ms | **ease-in-out**; per-frame steps ≈ 3, 5, 10, 18, 28, 30, 20, 11, 8, 1 px (strip scale); trail line |
| Typewriter #1 | 109.167→110.033 | 870 ms | linear, about 2 characters per frame (~70 characters per second) |
| Typewriter #2 | 125.375→128.1 | ~2.7 s | types in word-lockstep with speech |
| LANGUAGE MODEL chip | 112.283→112.45 | 170 ms | drops ~70 px (full-res) from above plus fade; steps 14, 10, 7, 5, 4, 2 → ease-out; no overshoot |
| Timeline progress | 113.617→114.05 | 430 ms | ease-in-out (slow start, fast middle, slow end); end dot pops at 114.05 |
| AIP layer drop onto stack | 132.183→132.35 | 170 ms | drop about 50 px plus fade, ease-out |
| Access ring | 139.10→139.20 | 100 ms | fade-in; label follows at 139.20 |
| Strikethrough "AN AI COMPANY" | 143.967→144.233 | 267 ms | ease-out (≈40, 60, 75, 85, 92, 97, 100% per frame) |
| Nodes → one row | 163.150→163.183 | 1 frame | hard snap; underline draws 163.28→~163.50; title fades 163.45→163.517 (67 ms) |
| Mascot blink | 3.20→3.30 | 133 ms | 4 closed frames |

**Summary of motion quality:**
- **Layout changes** are 1-frame cuts.
- **Element entrances** are 66–170 ms fade, scale or drop with ease-out.
- **Strokes** draw in 100–430 ms.
- **Translations** take 330–570 ms, ease-out or ease-in-out.
- There is **no overshoot or bounce in any strip.** The machine rebound fraction is 6.3%, and every flagged rebound I checked was a stagger or a second element, not a spring.
- Machine settle median is 67 ms and the median peak position is 0.0. Both agree: motion is front-loaded and ease-out or instant.

### (6) Camera-level effects
**None observed.**
- No zoom punches, shake, parallax, pans, rack focus or DOF anywhere.
- Photos have no Ken Burns. Pixel diff on the photo region:
  - Pentagon, 22.1 vs 23.6 s: 0.03.
  - Factory, 56.0 vs 57.1 s: 0.02.
  - FDE photo, 103.9 vs 106.9 s: 0.25 (0–255 scale).
- The background grid never moves: corner luminance stays at 9.9 ± 0.2 through the whole video.

All motion is element-level inside a fixed 2D canvas.

### (7) Color
**Background:** flat near-black (luma about 10) with a faint static square grid, about 1 px lines. It is not a gradient and not animated.

**Accent system (semantic, not per-item):**

| Accent | Used for | Examples |
|---|---|---|
| **Teal/cyan** | connected data, the platform, "solution" states | DB connector lines 0.63; FOUNDRY bar 65.07; meaning box 83.13; pipeline tiles 151.17; ANALYST chip 139.5 |
| **Amber/gold** | AI, the question, decisions, emphasis | LANGUAGE MODEL chip 112.28; AIP box 115.5; typed prompts 109.13 and 125.38; 847 row 84.17; action rows 70.4; decision card 156.63 |
| **Pink/red** | Gotham entities and the red string | nodes 42.0–43.75; links 44.25; red string 39.37 |

A one-off green tint marks the founder photo at 12.625.

**Hues visible at the same time:**
- 1 at 0.6 s (teal lines).
- 2 at 44.9 s (teal subject plus pink links and icons).
- 2 at 132.3 s (amber question and AIP layer plus teal data layer).
- 2 at 156.7 s (teal pipeline plus amber decision).
- 0–1 in most frames. The machine agrees: 0 saturated hues in 88% of frames and 1 hue in 12%.

**Sets share one accent:**
- All 5 entity nodes are pink.
- All 5 source tiles are neutral until lit.
- The A/I/P tiles all turn amber.

Photos are desaturated and cool-graded to sit inside the palette.

### (8) Iconography / graphic style
- **Icons** are line (outline) icons with a stroke of about 1.5–2 px, inside rounded-square tiles (radius about 6–8 px, 1 px border). Examples: person, phone, pin, document, car, alert-diamond, DB cylinder, factory. They are flat, with no glow; lit state = accent stroke plus a slightly tinted tile fill (see 44.9 s).
- **Cards and panels** are dark fill (≈#121518) with a 1 px low-contrast border and a small radius (≈4–6 px). Tables use monospace rows, e.g. `entity_type PERSON` at 44.9 s.
- **Three type roles:**
  - Condensed **serif caps** for hero words: 2003, ONE PROBLEM, NONE OF IT CONNECTS, GOTHAM, FOUNDRY, THE ONTOLOGY, FDE, AIP, ONE OPERATING PICTURE.
  - **Bold sans** for card titles and captions.
  - **Letter-spaced mono caps** for kicker labels and subheaders.
- **Recurring motifs:**
  - HUD: chapter label plus a 10-segment progress bar with one teal segment, top.
  - A framed content box with a mono subheader.
  - A persistent 5-card source row with photo thumbnails and mono category tags (HUMINT / IMINT / GEO / SIGINT / SYSTEMS).
  - Strikethrough as the negation device (31.1, 96.8, 123.9, 144.0, 145.9).
  - Split grid for "scattered" (19.7, 149.4).
  - Dim-to-lit enumeration.
  - "NOT THIS" / "THIS" pairing (94.97 / 97.23; 122.3 / 125.27).
- **Mascot:** a cartoon figure (flat cel style with black outlines) that contrasts with the UI. It has idle blinks and mouth shifts only; it never gestures or moves after the 0.233 s entrance.

### (9) Sound
**Not assessable visually.**

Visible cues that would suit SFX:
- Stamp-in boxes at 4.917, 5.875 and 6.875 (thunk).
- Typewriter at 109.13 and 125.38 (key clicks).
- Strikethroughs at 144.0 and 145.9 (swipe).
- Hard swaps (tick).

The machine audio cross-check shows no audio-locked beats: 19.9% of beats land on prominent transients, against 18% by chance.

### (10) Layout / safe zones (720x1280 measured on the 44.9 s frame)

| Zone | Height % | Pixels |
|---|---|---|
| Top clear margin (nothing) | 0–10.5% | 0–135 |
| HUD row (chapter label + progress bar) | ~11% | y≈140 |
| Main content box | 14–44% | 180–560 |
| Mascot (x 0–41%, feet shadow at ~71%) | 41–71% | 520–915 |
| Right info panel (x 43–94%) | 46–61% | 595–775 |
| Caption box | 75–81% | text centered at 78% |
| Bottom clear margin | 81–100% | ~245 px |

- All non-caption content sits between 10.6% and 79.8% H (rows 136–1021 are >1% bright). The machine agrees: 10.5% top and 20.7% bottom content margins.
- The mascot is about 41% of frame width × 31% of height and always sits on the left, overlapping the lower edge of the content box.
- Big serif titles sometimes overlap the mascot's head, e.g. 33.0 s "NONE OF IT CONNECTS" and 163.5 s.

## 4. What makes this feel fast (observed mechanisms only)

1. **Constant hard sub-state swaps under a fixed frame.** There are 62 one-frame content swaps (22.6/min) and no true cuts. The HUD, grid, mascot and card rows never move, so each swap reads as "next step", not "new scene". Examples:
   - The analyst chain swaps 4 times in 5.3 s: 44.867, 46.900, 48.633, 50.133.
   - The AIP section runs 118.267 → 119.633 → 122.300 → 125.267 → 128.500 → 130.625.
2. **One visual event per named noun (word-locked enumeration).** Each item in a spoken list lights about 0.1–0.35 s after its word:
   - Entity nodes at 42.00, 42.25, 42.75, 43.125 and 43.75 (people, places, events, documents, vehicles).
   - Source tiles at 24.375, 25.625, 26.125, 27.125 and 27.875.
   - Stamp boxes at 4.917, 5.875 and 6.875.
   - Plus 29.125, 61.125 and 61.75.
3. **Persistent anchor rows allow very short sub-states.** The agency card row stays 23.77–52.57 s (12 sub-states beneath it). The manufacturer row stays 57.25–72.97 s (9 sub-states) and again 147.1–164.9 s. Only the lower half reloads.
4. **Micro-entrances are short and front-loaded.** Element pops take 66–170 ms, ease-out, with no overshoot:
   - Logo at 0.600 (66 ms).
   - "2003" at 13.950 (67 ms).
   - Stamp at 4.917 (167 ms).
   - Chip drop at 112.283 (170 ms).
   - AIP layer at 132.183 (170 ms).
5. **A serif "hero word" lands on the key noun of the sentence**, giving big-type punctuation roughly every 10–20 s: 15.317 ONE PROBLEM, 32.625 NONE OF IT CONNECTS, 34.375 GOTHAM, 80.875 THE ONTOLOGY, 102.900 FDE, 163.450 ONE OPERATING PICTURE.
6. **Secondary mono kicker labels fill the holds.** About 0.5–1.5 s after a primary beat, a small label arrives, so no gap exceeds 2.73 s: 32.250, 63.500, 87.000, 121.750, 124.750, 130.250, 133.667, 159.200.
7. **Negation and contrast are shown as actions, not text.** Strikethroughs at 31.125, 96.750, 123.875, 143.967 and 145.875. NOT THIS / THIS pairs at 94.967 / 97.233 and 122.300 / 125.267.
8. **Typing locked to speech.** The prompt types in step with the narration at 125.375–128.1 ("which factories… next week?"). A problem statement types at 109.133.
9. **A visible progress HUD** advances one segment per chapter at 12.50, 21.93, 33.53, 52.57, 65.90, 78.37, 100.50, 111.77 and 141.27, so the viewer always sees forward progress.
10. **Travel with purpose.** Things that move do it to act out the sentence:
    - The engineer icon travels into the customer card at 101.333 (330 ms, ease-in-out) on "deployed".
    - The card row pushes from agency to manufacturer at 53.50 on "businesses".
    - The grid splits on "scattered" at 19.700 and 149.400.

## 5. Machine beat list vs my visual count

**Totals:** the machine found 206 beats. I logged 202 (plus about 40 mascot blinks that I did not log). The totals nearly match (-2%), but the sets differ.

**Machine beats with no visual beat within 0.2 s: 45.**
- **27** of them are band 7-7, which is mascot blinks.
- The other 18:
  - Tween frames of beats I logged: 53.767 (push-slide), 65.3 (FOUNDRY text), 101.6 (icon travel), 89.533 (the FACTORY A brighten that I logged at 89.783), 163.833 and 164.133 (final underline and title settle).
  - Probable cursor blink in the empty answer panel: 118.667 and 118.933.
  - **Not visually confirmed:** 22.667 and 22.867 (the Pentagon photo is pixel-static, so probably codec noise), 98.267 and 98.533 (graph looks unchanged in the strip), 30.533, 32.967, 46.5, 90.1, 91.467 and 137.1.

**My beats with no machine beat within 0.2 s: 49.** These are mostly small-area events the detector under-weights:
- Word-locked node and tile lights: 42.0, 42.25, 42.75, 43.75, 48.0.
- Red-string and link draws: 39.37, 39.8, 40.1, 44.25, 90.875, 92.4, 94.0, 161.375.
- Strikethroughs: 31.125, 123.875.
- Mono labels: 15.65, 32.25, 63.5, 87.0, 112.75, 148.75.
- Icon highlights: 68.375–69.625.

**What this means for the numbers:**
- **The machine gap distribution overstates holds.** Its max is 3.50 s and its 1–3 s bin holds 54 gaps. My max is 2.73 s and my 1–3 s bin holds 57 gaps, but I have 0 gaps over 3 s against the machine's 3.
- My median gap is identical to the machine's: 633 ms.
- **The machine undercounts semantic, word-anchored small beats by about 24%** (49 of 202). It overcounts mascot idle by about 27 beats.

**Artifacts in this folder:** strips `R5_DdIM0QoiZre_strip_*.jpg`, plus `R5_masc.jpg` (mascot slide) and `R5_hud.png` (HUD progress). Beat data is in `r5_build.py`, `r5_stats_mine.json` and `r5_cmp.json`.
