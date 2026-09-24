# R3_DdSc-I9IqNC: visual log (reference, light theme)

Source: 720x1280 @30fps, 134.53 s. I read all 45 contact sheets (8 fps) in order and rendered 16 frame-by-frame strips at 30 fps (listed in section 3.5).
The transcript is Whisper, 457 words at 204 wpm in 57 sentences.
Timestamps are in seconds. "A" means word-anchored: the thing shown is the thing being said, within about 0.3 s. "F" means free-running, followed by lead/lag vs the matching word where one exists.

## 0. Persistent chrome (present in every frame, never animates)
- **Header HUD** at about 12% of height. Left: tiny mono "GIT / WORKTREES". Right: a scene counter "NN — 32" that steps 01 to 32 on every cut. A hairline rule sits under it.
- **Title** (bold sans, ~5% of height, ~18% y) and **subtitle** (tiny mono caps, ~24% y). Both hard-swap on the cut frame with no text animation.
- **Mascot**: a Rick-style cartoon holding a laptop, at x 5–22% and y 40–72% (~32% of frame height). The pose is identical in all 45 sheets. The only motion is mouth flaps (a new mouth shape every 1–2 frames while narration plays; strip 10.0–10.8 s) and occasional blinks. There is no idle sway, bob or reaction.
- **Caption**: a white rounded pill centred at ~76% y, about 4% tall. It has bold sans text and 2–5 words per chunk (typically 3–4, e.g. "Normally one repository means" / "one working tree.").
  - Chunks swap about once a second: ~130 chunks over 123 s of speech.
  - The swap is a 2-frame fade (~67 ms; strip 11.50→11.567).
  - Word states: the current word is red, spoken words are near-black, upcoming words are grey. The colour flip takes ~2 frames.
- **Background**: flat off-white (corner luminance is a constant 241.7 in the stats) with a faint static dot grid, visible behind the mascot in strip 10.0 s. Nothing in the background animates.

## 1. BEAT LOG (whole video; diagram beats only, caption/mascot style logged once above)
Region: "C1" = first card slot (~28–35% y), "C2" ≈ 38–48% y, "C3" ≈ 50–60% y, "ann" = small annotation line under the diagram (~62–70% y). Diagrams sit at x 30–93%.

| # | t | what changed | region | motion dur | narration at t | anchor |
|---|---|---|---|---|---|---|
| 1 | 0.03 | S01 "Git worktrees." opens. ONE REPOSITORY card (red border, git logo) fades in | C1 | 133 ms | "Git"0.00 | A |
| 2 | 0.13 | app/ card (blue "main" pill) fades in with ≤1% vertical drift | C2 | 167–200 ms | "WorkTree's"0.18 | A |
| 3 | 0.17–0.47 | red bracket connector: stubs, then the trunk draws down | left of cards | ~300 ms | "WorkTree's" | F |
| 4 | 0.63 | auth/ card (purple feature/auth pill) fades in, trunk extends | C3 | ~130 ms | "explained"0.68 | F |
| 5 | 1.53 | **CUT** to S02 "Two parts." Git database card fades, red anchor dot | C1 | 133–167 ms | "repository"1.66 | F (the DB is named at 3.36) |
| 6 | 2.13 | Working tree card fades in | C2 | 167 ms | "has two"2.04–2.46 | A |
| 7 | 2.30–2.70 | red vertical connector draws DB→WT | between cards | 400 ms, ease-in-out | "two parts"2.46 | A |
| 8 | 3.40 | **CUT** to S03 "The Git database." ONE REPOSITORY card | C1 | 133 ms | "The Git database"3.18–3.52 | A |
| 9 | 3.63 | 6 hollow commit nodes (4 red, 2 purple) appear at once | C2 | ~100 ms | "database,"3.52 | F |
| 10 | 3.90–4.23 | main line draws left→right through the nodes | C2 | 333 ms, linear | "which holds"4.12–4.30 | A (commits 4.50, −0.4 s) |
| 11 | 3.93 | "main" pill fades in | C2 | 100 ms | "which" | F |
| 12 | 4.57–4.83 | purple branch curve draws up to the purple nodes | C2 | ~270 ms, linear | "commits,"4.50 → "branches"5.00 | A |
| 13 | 4.70 | "feature/auth" label fades in | C2 | 100 ms | "branches" | A |
| 14 | 5.75 | red ann "Commits connect into history." | ann | ~130 ms | "history"5.50 | A |
| 15 | 7.03 | **CUT** to S04 "Your working files." app/ file-tree card | C1–C2 | 133 ms | "the working tree"7.02–7.34 | A |
| 16 | 7.23 | tree row "├ src/" | C1 | 100 ms | "working tree" | F |
| 17 | 7.50 | row "│ ├ app.ts" | C1 | 100 ms | "tree," | F |
| 18 | 7.73 | row "└ auth.ts" | C1 | 100 ms | "the" | F |
| 19 | 8.03 | row "├ package.json" | C1 | 100 ms | "actual" | F |
| 20 | 8.27 | row "└ README.md" | C1 | 100 ms | "folder"8.30 | A |
| 21 | 8.63 | blue "app.ts" file pill | C2 | 133 ms | "of files"8.72–8.90 | A |
| 22 | 9.13 | blue ann "These are the files you open and edit." | ann | 133 ms | "you see"9.14–9.36 | A |
| 23 | 10.10 | **CUT** to S05 "One folder. One checkout." repo card | C1 | 133 ms | "Normally, one repository"10.10–10.64 | A |
| 24 | 10.30–10.70 | bracket stubs and trunk draw | left | ~400 ms | "one repository" | F |
| 25 | 10.63 | app/ (main) card | C2 | 133 ms | "repository"10.64 | F (one working tree 11.54, −0.9 s) |
| 26 | 12.40 | purple "Next task: authentication" with divider | ann | 133 ms | "Say"12.48 | F (feature 13.80, −1.4 s) |
| 27 | 14.40 | **CUT** to S06 "Switch the branch." macOS terminal (traffic lights, "Terminal — zsh") | C1 | 133 ms | "You create"14.26–14.56 | F |
| 28 | 14.75–16.23 | typing "git switch -c feature/auth", red block cursor | C1 | ~15 char/s (2 frames/char) | "git switch dash c feature auth"15.34–16.92 | A (runs ~0.3–0.7 s ahead) |
| 29 | 16.37 | green output "Switched to a new branch" | C1 | 100 ms | "feature"16.40 | A |
| 30 | 16.40 | app/ card with purple feature/auth pill | C2 | 133 ms | "feature auth"16.40–16.92 | A |
| 31 | 17.40 | purple ann "Same path. Different checkout." | ann | 133 ms | "Your folder switches"17.38 | A |
| 32 | 19.00 | **CUT** to S07 "Both open. At once." app/ main card | C1 | 133 ms | "But what if"18.94 | F (main 19.60, −0.6 s) |
| 33 | 19.63 | auth/ feature/auth card | C2 | 133 ms | "main"19.60 | F (feature auth 20.44, −0.8 s) |
| 34 | 20.63 | condensed bold caps "AT THE SAME TIME?" fade + rise | C3 | 167–200 ms, ease-out | "feature auth"20.44–20.70 | F (−0.7 s vs 21.32) |
| 35 | 22.60 | **CUT** to S08 "The awkward options." "main ⇄ feature/auth" pill strip | C1 | 133 ms | "Normally you'd"22.52 | F (switching 23.20, −0.6 s) |
| 36 | 23.88 | "Another full clone / Another Git database" card | C2 | 133 ms | "or clone"23.92–24.20 | A |
| 37 | 24.90 | red ann "There is a better way." | ann | 133 ms | "repository again"24.70 | F (better 26.72, −1.8 s) |
| 38 | 25.90 | **CUT** to S09 "Add a worktree." tiny mono "$ git switch main" under the subtitle; diagram area empty | top | 133 ms | "WorkTree's give you"25.94 | F |
| 39 | 27.50 | terminal window | C1 | 133 ms | "You run"27.28–27.82 | A |
| 40 | 27.80–29.40 | typing "git worktree add ../auth feature/auth" (wraps to 2 lines) | C1 | ~1.6 s | "git worktree add"27.96–28.64 … "feature auth"31.52 | A at the start, then 2.4 s ahead by the end |
| 41 | 29.63 | green "Preparing worktree…" | C1 | 100 ms | "sibling"29.60 | F |
| 42 | 30.27 | auth/ card (feature/auth) | C2 | 133 ms | "called auth"30.20–30.44 | A |
| 43 | 31.27 | purple ann "Existing branch → sibling folder" | ann | 133 ms | "branch"31.30 | A |
| 44 | 32.50 | **CUT** to S10 "Two folders." app/ main card | C1 | 133 ms | "Git creates that folder"32.38 | A |
| 45 | 33.63 | green "✓ main stays on main" strip and auth/ card together | C1.5, C2 | 133 ms | "Your original folder"33.62 | A (strip ~0.8 s ahead of "stays") |
| 46 | 35.50 | green "✓ auth checks out feature/auth" strip | C3 | 133 ms | "The new one"35.32–35.72 | A |
| 47 | 36.93 | **CUT** to S11 "One repository underneath." repo card | C1 | 167 ms, ease-out | "Two folders"36.88 | F (repository 38.36, −1.4 s) |
| 48 | 37.10–37.40 | bracket stubs, then trunk | left | ~300 ms | "folders," | F |
| 49 | 37.23 | app/ card | C2 | 167 ms | "folders"37.04 | A |
| 50 | 37.50 | auth/ card | C3 | 167 ms | "two branches"37.58 | A |
| 51 | 39.67 | **CUT** to S12 "Keep going." auth/ card | C1 | 133 ms | "And you can keep going"39.60 | F |
| 52 | 41.00 | billing/ card (green feature/billing) | C2 | 133 ms | "billing"40.98 | A |
| 53 | 43.13 | dashboard/ card (amber folder + feature/dashboard) | C3 | 133 ms | "dashboard"43.10 | A |
| 54 | 45.60 | **CUT** to S13 "Separate folders. Shared repo." repo card | C1 | 133 ms | "Three"45.44 | F |
| 55 | 45.80 | bracket and auth/ card | C2 | ~200 ms | "independent"45.74 | F |
| 56 | 46.75 | billing/ card | C3 | 133 ms | "directories"46.48 | F |
| 57 | 47.50 | dashboard/ card | C4 (~62%) | 133 ms | "connected"47.28 | F (a steady ~0.75 s cadence that ignores words) |
| 58 | 49.80 | **CUT** to S14 "The history is shared." 2 coloured dots, then "app/.git/objects" card at 49.88 | C1 | 133 ms | "Git doesn't"49.82 | F |
| 59 | 50.13–50.87 | six object-hash chips (a1/2f, c5/7e…) stagger in over 2 rows | C2 | 100 ms each, 120 ms stagger | "duplicate the full history"50.34–51.16 | A |
| 60 | 51.63 | auth/ mini folder card | C3 left | 133 ms | "each time"51.50 | F |
| 61 | 51.88–52.00 | purple connector draws auth→chips | C2–C3 | ~130 ms | "time." | F |
| 62 | 52.00 | billing/ mini card, then green connector 52.13–52.25 | C3 right | ~250 ms | "time."51.78 | F (share 52.96, −0.9 s) |
| 63 | 54.75 | **CUT** to S15 "Shared data. Local state." repo card | C1 | 133 ms | "So"54.60 | F |
| 64 | 54.88 | "Shared object database · commits · trees · file contents" card | C2 | 133 ms | "commits"54.84 | A |
| 65 | 56.38 | "auth/.git → app/.git/worktrees/auth" card | C3 | 133 ms | "history"56.38 | F |
| 66 | 56.88 | row "├ HEAD → feature/auth" | C3 | 100 ms | "reused"56.88 | F |
| 67 | 57.38 | row "└ index → staging area" | C3 | 100 ms | "Only"57.28 | F |
| 68 | 58.38 | purple ann "Your working files live in auth/." | ann | 133 ms | "files"58.30 | A |
| 69 | 59.77 | **CUT** to S16 "Lighter than full clones." "3 full clones" card with full-width red bar (bar fades, does not grow) | C1 | 133 ms | "That makes"59.56 | F (clones 61.58) |
| 70 | 60.88 | "3 linked worktrees" card with short red bar | C2 | 133 ms | "than multiple"60.76 | A |
| 71 | 62.27 | red ann "Lighter ≠ zero disk cost" | ann | 133 ms | "But they're not free"62.16 | A |
| 72 | 63.27 | **CUT** to S17 "Dependencies still add up." auth/ card "node_modules/ · dist/" | C1 | 133 ms | "Huge generated"63.12 | A |
| 73 | 64.63 | billing/ card | C2 | 133 ms | "node modules"64.92 | A |
| 74 | 65.77 | dashboard/ card | C3 | 133 ms | "every WorkTree"66.08 | A |
| 75 | 66.60 | 8 amber blocks (disk bar), all fading together from beige to brown | ann right | 133 ms, no stagger | "can"66.72 | F (disk 67.36, −0.75 s) |
| 76 | 66.90 | "DISK USAGE ↑" label | ann left | 100 ms | "still eat" | F |
| 77 | 68.60 | **CUT** to S18 "Why multiple checkouts?" VS Code window "auth.ts" with status bar | C1–C2 | 133 ms | "Why does"68.50 | F |
| 78 | 69.13–69.75 | 4 code lines fade in | C1 | 125 ms stagger | "feature exist?"69.00 | F |
| 79 | 70.40 | purple "Feature in progress…" | ann | 133 ms | "sometimes"70.26 | F |
| 80 | 71.77 | green "ANOTHER TASK ARRIVES" strip | ann | 133 ms | "branches"71.82 | F |
| 81 | 73.37 | **CUT** to S19 "Production breaks." empty VS Code window | C1 | 133 ms | "You're halfway"73.32 | F |
| 82 | 73.88–74.63 | code lines re-type (4 lines, 125 ms stagger) | C1 | 750 ms | "halfway through a big feature" | A |
| 83 | 74.03 | pink/red alert box "! Production: sign-in failing" | C2 | 133 ms | "big"74.12 | F (production 74.76, −0.7 s) |
| 84 | 75.80 | **CUT** to S20 "The context-switch dance." terminal | C1 | 133 ms | "Without"75.66 | F |
| 85 | 76.13–76.63 | typing "git stash" | C1 | 500 ms | "stash"76.78 | A |
| 86 | 76.40 | checklist panel and "01 stash your feature" | C2 | 133 ms | "stash" | A |
| 87 | 76.90 | green "Saved working directory" | C1 | 100 ms | "everything"77.10 | A |
| 88 | 77.13 | "02 switch to hotfix" | C2 | 100 ms | (switch 77.68) | F (−0.55 s) |
| 89 | 77.63 | "03 fix the bug" | C2 | 100 ms | (fix 78.12) | F (−0.5 s) |
| 90 | 78.27 | "04 switch back + restore" | C2 | 100 ms | (switch back 78.90) | F (−0.6 s) |
| 91 | 79.75 | **CUT** to S21 "Leave the feature intact." auth/ card "Uncommitted edits stay here" | C1 | 133 ms | "With WorkTree's"79.58 | F |
| 92 | 80.27 | green "FEATURE UNTOUCHED" strip | C1.5 | 133 ms | "leave your feature"80.42 | A |
| 93 | 80.77 | hotfix/ card | C2 | 133 ms | "feature"80.70 | F (hotfix 82.94, −2.2 s) |
| 94 | 82.40 | green ann "Two directories. No stash detour." | ann | 133 ms | "already"82.32 | F |
| 95 | 84.03 | **CUT** to S22 "Pick up where you left off." VS Code | C1 | 133 ms | "production"83.98 | F |
| 96 | 84.40 | green "✓ Hotfix complete" | C2 | 133 ms | "and return"84.30 | A |
| 97 | 84.63–85.25 | code lines restore (4 lines) | C1 | ~620 ms | "return exactly where you were" | A |
| 98 | 86.27 | **CUT** to S23 "Now give that to agents." terminal with "Claude Code / Let's build." and a pixel mascot icon | C1–C2 | 133 ms | "And this is where"86.24 | F (agents 88.90, −2.6 s) |
| 99 | 87.40 | input prompt row appears | C2 | 100 ms | "useful" | F |
| 100 | 87.63–88.27 | typing "Build authentication" | C2 | 640 ms (~30 char/s) | "again." | F |
| 101 | 88.75 | "✱ Working…" | C2 | 100 ms | "agents"88.90 | A |
| 102 | 89.03 | "esc to interrupt" | C2 | 100 ms | – | F |
| 103 | 89.88 | "3 sessions" card: 3 icons and "auth/ · billing/ · dashboard/" | C3 | 133 ms | "three"90.02 | A |
| 104 | 91.40 | **CUT** to S24 "Three agents. Three jobs." terminal 1 (feature/auth) | C1 | 133 ms | "One builds"91.28 | A |
| 105 | 91.65 | "> Build authentication" | C1 | 100 ms | "authentication"91.68 | A |
| 106 | 92.13 | "Edit(src/auth.ts)" | C1 | 100 ms | – | F |
| 107 | 92.40 | terminal 2 (feature/billing) | C2 | 133 ms | "One fixes"92.50 | A |
| 108 | 92.65 | "> Fix billing totals" | C2 | 100 ms | "fixes"92.80 | A |
| 109 | 93.25 | "Edit(src/billing.ts)" | C2 | 100 ms | – | F |
| 110 | 93.52 | terminal 3 (feature/dashboard) | C3 | 133 ms | "One"93.64 | A |
| 111 | 93.80 | "> Redesign the dashboard" | C3 | 100 ms | "redesigns"93.90 | A |
| 112 | 94.40 | "Edit(dashboard.tsx)" | C3 | 100 ms | – | F |
| 113 | 95.30 | **CUT** to S25 "One shared folder gets messy." VS Code | C1 | 133 ms | "In a single working"95.24 | A |
| 114 | 95.88 | line "// src/config.ts", purple agent cursor, green "Auth session → config.ts" | C1, C2 | 100 ms | "directory"95.98 | F |
| 115 | 96.13 | line "export const mode = "auth";" | C1 | 100 ms | "they'd" | F |
| 116 | 96.30 | line "// another agent edits this too" | C1 | 100 ms | "edit"96.68 | A |
| 117 | 96.50–99.9 | 2nd (green) then 3rd (amber) cursor join. All cursors move every frame (continuous) | C1 | continuous 3.4 s | "the same files"97.00 | A |
| 118 | 96.88 | red "Billing session → config.ts" strip | C2 | 133 ms | "same files"97.00 | A |
| 119 | 98.40 | red ann "Branch changed underneath you" | ann | 133 ms | "under each other"98.36 | A |
| 120 | 100.10 | **CUT** to S26 "Give each agent a worktree." repo card and bracket | C1 | ~300 ms | "Instead,"100.02 | F |
| 121 | 100.88 | auth/ card with "Claude Code" row | C2 | 133 ms | "agent"100.82 | A |
| 122 | 102.13 | billing/ card | C3 | 133 ms | "One repository"102.02 | F |
| 123 | 103.25 | dashboard/ card | C4 | 133 ms | "three folders"103.26 | A |
| 124 | 106.13 | **CUT** to S27 "Edit. Test. Commit." terminal 1 | C1 | 133 ms | "Each agent"105.98 | A |
| 125 | 106.37 | "> Run auth tests" and purple progress bar | C1 | bar grows ~850 ms, ~linear | "edits, runs"106.56–107.02 | A |
| 126 | 106.50 | terminal 2 and "Run billing tests"; green bar from 106.80 | C2 | 133 ms + ~800 ms | "runs"107.02 | A |
| 127 | 106.83 | "Bash(npm test) · PASS" (auth) | C1 | 100 ms | "tests" | A |
| 128 | 106.87 | terminal 3 and "Run dashboard tests"; amber bar from 107.20 | C3 | 133 ms + bar | "tests"107.20 | A |
| 129 | 107.37 | "✓ committed a41c7e2" | between C1/C2 | 100 ms | "and commits"107.70 | A |
| 130 | 107.90 | "committed 07a931" | between C2/C3 | 100 ms | "commits"107.88 | A |
| 131 | 108.13 | "committed d69ff1" | below C3 | 100 ms | "independently"108.14 | A |
| 132 | 109.13 | **CUT** to S28 "Merge the finished branches." 3 branch pills and centre dot | C1 | 133 ms | "When they're done"108.90 | F |
| 133 | 109.40–109.87 | purple curve draws down to the dot | C1–C2 | 467 ms, ease-in-out | "you merge"109.64 | A |
| 134 | 109.63–109.93 | green straight line draws | C1–C2 | 300 ms | "merge" | A |
| 135 | 109.83–110.20 | amber curve draws | C1–C2 | 367 ms | "their branches"109.94 | A |
| 136 | 109.90 | app/ main card "Combined, reviewed changes" | C3 | 167 ms | "their"109.94 | F (main 110.94, −1.0 s) |
| 137 | 111.37 | **CUT** to S29 "Conflicts can still happen." "config.ts — merge conflict" card | C1 | 133 ms | "Merge conflicts"111.36 | A |
| 138 | 111.63 | "<<<<<<< feature/auth" (purple band) | C1 | 133 ms | "conflicts"111.60 | A |
| 139 | 111.90 | "timeout = 30;" | C1 | 133 ms | "can" | F |
| 140 | 112.50 | "=======" | C1 | 100 ms | "happen"112.46 | F |
| 141 | 112.88 | "timeout = 60;" (green band) | C1 | 133 ms | "If"112.94 | F |
| 142 | 113.13 | ">>>>>>> feature/billing" | C1 | 133 ms | "two branches"113.14 | A |
| 143 | 114.00 | red box "Choose the intended behavior. Resolve, then commit." | C2 | 133 ms | "same"114.14 | F (resolved 115.50, −1.5 s) |
| 144 | 116.27 | **CUT** to S30 "Real folders. Simultaneously." repo card and bracket | C1 | ~350 ms | "don't solve"116.74 | F |
| 145 | 116.50 | auth/ card "Editable now" | C2 | 133 ms | "don't" | F |
| 146 | 117.75 | billing/ card | C3 | 133 ms | "conflicts."117.44 | F |
| 147 | 118.88 | dashboard/ card | C4 | 133 ms | "different."118.70 | F |
| 148 | 122.90 | **CUT** to S31 "History → files on disk." red dot; Branches card (purple commit dots) at 123.0 | C1 | 133 ms | "That's the mental model"122.90 | F (branches 123.90, −0.9 s) |
| 149 | 124.57–124.83 | red arrow draws down | C1→C2 | ~270 ms, accelerating | "multiple versions"124.62 | F |
| 150 | 125.10 | Worktrees card "Several checkouts at once" | C2 | 200 ms | "versions of"125.24 | F (WorkTree's 126.10, −1.0 s) |
| 151 | 127.27 | red ann "1 repository → many working directories" | ann | 133 ms | "several"127.40 | A |
| 152 | 129.27 | **CUT** to S32 "Build in parallel. Clean up." terminal | C1 | 133 ms | "And AI agents"129.06 | F |
| 153 | 129.63–130.87 | typing "git worktree remove ../auth" | C1 | 1.25 s | "just happen to be one of" | F |
| 154 | 131.13 | "Worktree removed; branch retained." | C1 | 100 ms | "modern" | F |
| 155 | 131.40 | card "Optional: delete the merged branch · git branch -d feature/auth" | C2 | 133 ms | "reasons" | F |
| 156 | 133.17 | red ann "One repo. Many places to work." | ann | 133 ms | "sitting there"133.22 | F |
| – | 134.53 | end, no outro card, CTA or logo | | | | |

## 2. SCENE / SCAFFOLD STRUCTURE
There are 32 scenes, numbered by the on-screen counter 01–32. Every transition is a **hard cut**, verified frame by frame:
- 1.500 (old) → 1.533 (new, card at ~15% opacity)
- 7.000 → 7.033
- 36.900 → 36.933

There is no exit animation, crossfade, slide, morph or camera move. The header, mascot and caption never change, so each cut reads as a content swap inside a fixed frame.

The diagrams use about 6 recurring **scaffold types**:
- **(T)** repo-card + bracket + stacked folder cards: S01, S05, S11, S13, S26, S30
- **(V)** vertical 2-card with a connector: S02, S31
- **(W)** window chrome, either terminal (S06, S09, S20, S23, S32) or VS Code (S18, S19, S22, S25)
- **(S)** stacked cards: S07, S08, S10, S12, S15, S16, S17, S24, S27, S29
- **(G)** git graph or merge graph: S03, S28
- **(O)** object chips: S14

Scenes with the same scaffold type are **rebuilt from empty** each time; nothing carries across a cut.

| S | t start | dur (s) | title | scaffold | beats inside | last beat → cut (hold) |
|---|---|---|---|---|---|---|
|01|0.00|1.53|Git worktrees.|T|4|0.90|
|02|1.53|1.87|Two parts.|V|3|1.10|
|03|3.40|3.63|The Git database.|G|7|1.28|
|04|7.03|3.07|Your working files.|file tree|8|0.97|
|05|10.10|4.30|One folder. One checkout.|T|4|2.00|
|06|14.40|4.60|Switch the branch.|W terminal|5|1.60|
|07|19.00|3.60|Both open. At once.|S|3|1.97|
|08|22.60|3.30|The awkward options.|S|3|1.00|
|09|25.90|6.60|Add a worktree.|W terminal|6|1.23|
|10|32.50|4.43|Two folders.|S|3|1.43|
|11|36.93|2.74|One repository underneath.|T|4|2.17|
|12|39.67|5.93|Keep going.|S|3|2.47|
|13|45.60|4.20|Separate folders. Shared repo.|T|4|2.30|
|14|49.80|4.95|The history is shared.|O|5|2.75|
|15|54.75|5.02|Shared data. Local state.|S|6|1.39|
|16|59.77|3.50|Lighter than full clones.|S (bars)|3|1.00|
|17|63.27|5.33|Dependencies still add up.|S|5|1.70|
|18|68.60|4.77|Why multiple checkouts?|W VS Code|4|1.60|
|19|73.37|2.43|Production breaks.|W VS Code|3|1.77|
|20|75.80|3.95|The context-switch dance.|W terminal + checklist|7|1.48|
|21|79.75|4.28|Leave the feature intact.|S|4|1.63|
|22|84.03|2.24|Pick up where you left off.|W VS Code|3|1.64|
|23|86.27|5.13|Now give that to agents.|W Claude Code|6|1.52|
|24|91.40|3.90|Three agents. Three jobs.|S (3 terminals)|9|0.90|
|25|95.30|4.80|One shared folder gets messy.|W VS Code + cursors|7|1.70|
|26|100.10|6.03|Give each agent a worktree.|T|4|2.88|
|27|106.13|3.00|Edit. Test. Commit.|S (3 terminals + bars)|8|1.00|
|28|109.13|2.24|Merge the finished branches.|G merge|5|1.47|
|29|111.37|4.90|Conflicts can still happen.|S (diff)|7|2.27|
|30|116.27|6.63|Real folders. Simultaneously.|T|4|4.02|
|31|122.90|6.37|History → files on disk.|V|4|2.00|
|32|129.27|5.26|Build in parallel. Clean up.|W terminal|5|1.36|

Scaffold lifetimes:
- Mean 4.20 s, min 1.53 s (S01), max 6.63 s (S30).
- Beats per scene: 3–9, mean 4.9.
- Every scene builds up front and then holds for a median ~1.6 s before the next cut.
- Cuts land on **sentence onsets**: 31 of 31 cuts fall 0–0.45 s after the first word of a transcript sentence (e.g. 10.10 vs "Normally"10.10; 111.37 vs "Merge"111.36; 122.90 vs "That's"122.90). With 57 sentences and 32 scenes, that is ~1.8 sentences per scene.

## 3. TEN-POINT ANALYSIS
**(1) Beat timestamps.** See section 1: 156 diagram beats, of which 31 are cuts.

**(2) Gap distribution** (156 beats → 155 gaps):
- min 30 ms, p25 270, **median 600 ms**, p75 1360, max 4020, mean 859.
- Histogram: <200: 15 · 200–400: 45 · 400–700: 23 · 700–1000: 9 · 1–2 s: 52 · 2–3 s: 10 · >3 s: 1.
- The distribution is bimodal: bursts of 100–400 ms inside a scene's build (typing, staggers, line draws) and 1–2 s holds before each cut.

Bursts:
- 3.63–4.83: 5 beats in 1.2 s
- 50.13–52.25: chips and connectors
- 76.13–78.27: stash checklist
- 91.40–94.40: 9 beats in 3 s
- 106.13–108.13: 8 beats in 2 s
- 109.40–110.20: 4 overlapping line draws

Longest holds (what is on screen):
- **118.9–122.9 (4.0 s)**: the full T-scaffold, repo plus 3 "Editable now" cards. Only the mascot mouth and captions move.
- **103.3–106.1 (2.9 s)**: T-scaffold with 3 agent-worktree cards.
- **52.0–54.75 (2.75 s)**: object chips with auth/billing mini-cards.
- **43.1–45.6 (2.5 s)**: 3 folder cards (auth/billing/dashboard).
- **47.5–49.8 (2.3 s)**: 3-card T-scaffold.
- **114.0–116.27 (2.3 s)**: conflict diff with the red resolve box.
- **125.1–127.27 (2.2 s)**: Branches→Worktrees.
- **37.5–39.67 (2.2 s)**: 2-card T.

During every hold the caption highlight still advances each word (~0.29 s at 204 wpm), a new chunk appears about every 1 s, and the mascot mouth flaps. The frame is therefore never fully static, but the diagram is.

**(3) Rates.** 156 beats / 134.5 s = **69.6 beats/min**. **31 cuts = 13.8 cuts/min** (one every 4.2 s).

**(4) Narration sync.**
- **75 of 156 beats (48%) are word-anchored**; 81 (52%) are free-running.
- Free beats almost always **lead** the matching word, by 0.4–2.6 s (e.g. #34 −0.7, #37 −1.8, #88–90 −0.5/−0.6, #93 −2.2, #98 −2.6). I found no beat that lags its word by more than 0.3 s.
- Anchoring is strongest in enumerations and commands:
  - billing 40.98 → 41.00
  - dashboard 43.10 → 43.13
  - three terminals 91.40, 92.40, 93.52 on "One…/One…/One…"
  - merge lines on "merge"
- Anchoring is weakest in rebuilt T-scaffolds, whose cards stagger on a fixed ~0.75–1.1 s cadence (S13, S30).
- Beats per sentence: 156 / 57 = **2.7** (the machine estimate was 3.3).
- Cuts per sentence: 0.54, and every cut sits on a sentence boundary.

**(5) Motion quality** (measured on 30 fps strips; frame numbers are within each strip):

| beat | window | frames → duration | curve observed |
|---|---|---|---|
| repo card appear | 0.000–0.133 | f1 ~30% → f4 100%: 133 ms | ease-out (largest opacity step on f1); ≤1% y drift; no scale |
| child card (app/) | 0.133–0.300 | f4–f9: ~170–200 ms | fade with ~1% vertical drift; linear-ish |
| cut + card (S02) | 1.500→1.533 cut; card f7–f11 | hard cut; card ~15/40/80/95/100% → 133–167 ms | hard cut, then ease-out fade |
| connector DB→WT | 2.300–2.700 | 12 frames: 400 ms | **ease-in-out** (slow first 3 frames, fast middle, slow last 2) |
| git main line | 3.900–4.233 | 10 frames: 333 ms | **linear** (constant px/frame); nodes pre-placed as hollow circles |
| branch curve | 4.567–4.833 | 8 frames: ~270 ms | linear-ish path draw |
| tree rows | 7.233–8.270 | each row 3 frames (100 ms) at 233–300 ms stagger | opacity only, no slide |
| typing | 15.300–16.267 | ~2 frames per char (~15 char/s) | stepped, blinking red block cursor; output line 100 ms fade (16.367–16.433) |
| "AT THE SAME TIME?" | 20.633–20.800 | 5–6 frames: 167–200 ms | fade 25→100% with ~1% rise; ease-out; no scale, **no overshoot** |
| S11 cut + repo card + bracket | 36.900→36.933 cut; card 36.933–37.100; trunk 37.200–37.400; cards 37.233–37.400 and 37.500–37.667 | card 167 ms; trunk 200 ms; cards 167 ms each | hard cut, ease-out fades, sequential |
| object chips | 50.133–50.867 | 6 chips, 3 frames each, ~120 ms stagger | fade with ~1% rise, ease-out |
| disk bar | 66.600–66.733 | 4 frames: 133 ms | all 8 blocks fade at once (colour/opacity), no grow, no stagger |
| agent cursors | 96.000–96.767 | position changes every frame | continuous wander; 2nd cursor fades in at 96.50 |
| test progress bars | 106.433–~107.30 | ~26 frames: ~850 ms each, 3 bars staggered ~370–400 ms | width grow, ~linear |
| merge curves | 109.400–110.200 | purple 14 frames (467 ms), green 9 (300 ms), amber 11 (367 ms), ~220 ms stagger, overlapping | purple clearly **ease-in-out**; others linear-ish |
| arrow draw | 124.567–124.833 | 8 frames: ~270 ms | **accelerating** (ease-in / linear-to-fast) |
| caption chunk swap | 11.500→11.567 | 2 frames: ~67 ms | near-hard fade; word colour flip ~2 frames |

Summary: element entrances are 100–200 ms opacity fades with at most ~1% drift. Line draws are 270–470 ms, linear or ease-in-out. Nothing bounces, overshoots or scales, and nothing ever exits: elements only accumulate until the hard cut. The machine settle median of 200 ms agrees.

**(6) Camera.** There are **none**. The header, title and mascot hold identical pixel positions on all 45 sheets: no zoom punch, push-in, shake, parallax, pan, rack focus or DOF blur. All energy comes from content appearing inside a locked frame.

**(7) Colour.**
- Background: flat warm off-white with a faint static dot grid, not animated.
- Ink is near-black. The primary accent is **brick red**, used for the repo card, connectors, the active caption word, red annotations and alerts.
- **Semantic per-entity colours stay consistent for the whole video**:
  - main = blue (pill, folder icon)
  - feature/auth = purple
  - feature/billing = green
  - feature/dashboard = amber/brown
  - success/state strips = pale green
  - danger = pale red/pink
- Simultaneous hues:
  - 1.0 s: red, blue, purple = 3
  - 47.9 s: red, purple, green, amber, blue = 5
  - 96.9 s: purple, green, amber cursors plus green and red strips = 5
  - 109.9 s: purple, green, amber, blue, plus red caption = 5
  - 25.0 s: red plus 2 small pills = ~3
- So simultaneous items **each get a distinct hue**, but saturation is tiny: pills and bars are small, and the stats' saturated-pixel median is 0.4%. That explains why the machine hue count is 0–1.

**(8) Graphic style.**
- Flat, no glow and no gradients. Cards are white with 1 px light-grey borders, a very soft shadow and small corner radii (~4–6 px at 720p).
- The repo card uses a 1.5–2 px red border.
- Icons are line-style (outline folders, a branch glyph in pills). The git logo is a filled red diamond; the "III" bars on the repo card are filled red.
- Commit nodes are hollow rings with ~2 px strokes; connectors are 2 px.
- Mono type for paths and code; bold grotesque sans for titles and captions.
- Recurring motifs:
  - macOS window chrome (traffic lights) for Terminal and VS Code, including the VS Code status bar
  - Claude Code pixel-mascot icon
  - the "NN — 32" scene counter
  - the mascot, which is always present
  - pill tags for branch names
  - the red annotation-under-divider line that ends most scenes (#14, 22, 26, 31, 37, 43, 68, 71, 94, 119, 151, 156)

**(9) Sound.** Not assessable visually. Visible cues that would suggest SFX:
- typing sequences (14.75, 27.80, 76.13, 87.63, 129.63)
- alert box at 74.03
- "PASS" lines at 106.83 and 107.20
- commit confirmations at 107.37–108.13

No visual beat pulses or flashes that would imply music sync.

**(10) Layout and safe zone** (percent of 1280 height):

| zone | y (% of height) |
|---|---|
| empty top margin | 0–11% (stats: 232 px at 1920) |
| header | ~12% |
| title | ~18% |
| subtitle | ~24% |
| diagram band | 28–72%, at x 30–93% |
| mascot | 40–72%, at x 5–22% (≈32% of frame height, always left, facing camera) |
| caption pill | ~74–78% |
| empty bottom margin | 80–100% (stats: 435 px at 1920 ≈ 23%) |

Content is left-anchored: the mascot is on the left and the diagram is right of centre. All change happens between 28% and 78% y. This matches the machine row-change profile, bands 2–10 only.

## 4. What makes this feel fast (observed mechanisms only)
1. **A hard cut on nearly every sentence, one every 4.2 s, with no transition time.** The new scene's first element starts fading on the very next frame (1.500→1.533, 7.000→7.033, 36.900→36.933), and cuts line up with sentence onsets (10.10, 49.80, 111.37, 122.90).
2. **Front-loaded builds.** Each scene reaches its "complete" state within ~1–3 s, then holds for ~1.6 s. The viewer gets 3–9 fast additive reveals per scene: S03 had 7 beats in 2.4 s (3.40–5.75), S24 had 9 beats in 3.0 s (91.40–94.40), S27 had 8 beats in 2.0 s (106.13–108.13).
3. **Short entrances.** Most entrances are 100–200 ms fades with no easing theatrics and no overshoot: 0.033–0.133, 20.633–20.800, 50.133–50.867. Nothing waits for an animation to finish.
4. **Visuals that anticipate the words.** Free beats lead narration by 0.4–2.6 s rather than lagging: "AT THE SAME TIME?" at 20.63 vs 21.32, checklist steps 77.13, 77.63 and 78.27 each ~0.5 s early, hotfix/ at 80.77 vs 82.94. The eye is always slightly ahead of the ear.
5. **Something is always moving, even in holds.** Caption word highlights advance about every 0.29 s and chunks swap every ~1 s (strip 11.30–11.87). The mascot's mouth changes every 1–2 frames (strip 10.0–10.8). Typing runs at ~15 char/s (15.30–16.27, 27.80–29.40, 129.63–130.87), and agent cursors wander every frame (96.0–99.9).
6. **Overlapping staggers instead of sequential waits:**
   - merge curves 109.40, 109.63 and 109.83, each 300–470 ms and overlapping
   - test bars 106.43, 106.80 and 107.20
   - object chips at ~120 ms spacing (50.13–50.87)
   - tree rows at ~250 ms spacing (7.23–8.27)
7. **Stable chrome.** The header, counter, mascot and caption never move (all 45 sheets), so each cut reads as instant information replacement rather than a disorienting camera change. The step counter (01→32) signals steady progress.

## 5. Machine beat list vs this visual log
- **Machine: 187 beats. Visual: 156.**
- The 31 machine full-frame beats (rows "2-10"/"2-9", area 0.28–0.47) match my 31 cuts to within 33–67 ms (1.533, 3.400, 7.033 … 129.300). The machine's `cuts: 0` is a detector miss: only ~30–45% of pixels change on a cut, because the background, mascot and caption are unchanged.
- 46 machine beats are single-band-7 (43.8–50% y) with settle 33 ms, and 64 are tiny single-band events at area ≤0.03 in bands 4–7. Those bands contain the mascot's head, so these are **mascot mouth/eye changes, not diagram beats**. Examples: 4.300, 4.500, 13.400, 13.600, 26.500, 26.700, 55.300, 55.500.
- Removing them leaves ~123–141 machine diagram beats against my 156. The machine under-counts for two reasons:
  - It merges fast staggers: 6 object chips at 50.13–50.87 become ~5 beats, 4 code lines become 1–2, and the 3 merge curves become 1–2.
  - Typing is one continuous event.
- The machine's median gap of 433 ms is shorter than mine (600 ms) because of the mascot blink/mouth events. Both agree on the longest hold, 119.03–122.70 (machine) vs 118.88–122.90 (visual).
- Machine peak_pos median 0 (ease-out-like) agrees with the fade entrances, and settle median 200 ms agrees with the measured 133–200 ms fades.
