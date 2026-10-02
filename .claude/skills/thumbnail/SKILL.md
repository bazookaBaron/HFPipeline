---
name: thumbnail
description: Make high-CTR thumbnails (YouTube 1280x720, reel/short covers 1080x1920) in the poster-monochrome theme with the rigged character — no AI image generation. Use for every long-form and reel, or when the user asks for a thumbnail/cover.
---

# Thumbnail: poster-style, high CTR, no AI

Always make one per video: long-form gets a 1280x720 YouTube thumbnail; a reel gets a 1080x1920 cover, whose middle 1080x1350 must work as the grid crop.
Tool: `node runtime/thumbnail.js <spec.json> [outDir]` renders the HTML and exports PNG plus a `-mobile.png` squint test at 336x188. Spec format: `runtime/THUMBNAIL.md`.
Same theme hue as the video (`Theme.get(id)`). Use only real licensed photos from the video's `media.json`, poster maps (`runtime/maps.js`), components and the puppet. **Never AI-generated images.**

## CTR rules: what makes it clickable

1. **One idea, readable in 1 second.** The text is 2–5 words at ≥ 150 px Anton, high contrast (ink on paper / marker), max 2 lines. It must still read in the 336x188 mobile export.
2. **Don't repeat the title.** The thumbnail adds the *curiosity gap* and the title explains. Example: title "How India became a swing power", thumb "EVERYONE WANTS INDIA".
3. **Emotion face.** The character is big, 55–70% of the frame height, with an extreme pose and expression (shocked, pointing, shrug, thinking), looking toward the text or the subject. Use a thick outline and a hard shadow so it pops off the bg.
4. **One focal subject plus one supporting anchor.** The subject is a map shape, a big number, or one real photo badge. Use at most 4 visual groups in total. Dense, but each group is instantly legible.
5. **Directional cues.** One big arrow, circle or ✕/✓ pointing at the key thing. Use `--alert` only for that cue.
6. **Contrast and colour.** Theme bg with the dot grid, paper cards, a marker highlight on ONE key word, a deep-tone vignette for depth. Nothing important within 120 px of the bottom-right, where YouTube's timestamp sits.
7. **Composition.** Text on one third, character on the opposite third, subject in between or behind. Slight tilts (−4° to 4°) on cards and stickers give energy.
8. **Numbers and stakes.** Prefer a concrete number or a conflict ("55%", "50% TARIFF", "3 RIVALS · 1 WINNER") over generic words.

## Workflow (≤ 0.15 window)

1. Write 3 hook variants, each with a different angle: conflict, number, curiosity. Put them in one spec.
2. Render all 3 and look at the mobile squint sheet ONCE. Pick the one whose text and face read clearly at the small size; fix any text below 150 px.
3. Deliver `thumb-A/B/C.png`, marking the pick. Credit any photo used in the video description.
