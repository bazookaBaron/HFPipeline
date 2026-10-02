# Presenter puppet (rigged flat vector)

This is a hand-authored SVG puppet for HyperFrames/GSAP 9:16 reels, drawn in a bold editorial flat style. Every shape has a thick, even black outline (`LW` 6.5 viewBox units, hands about 6). Fills are 100% flat, and ONE cobalt shadow colour does all the shading: the far side of the face and neck, under the hair, the inner ears, the hands and the clothing folds. The character is original. He has chunky curly black cloud hair made of round lobes with a blue under-shadow, huge round eyes with lash ticks and small dot pupils, a big split red/blue wedge nose, a tiny off-centre mouth and light dot stubble, and he wears a red-orange ribbed crewneck with ribbed cuffs. He is designed to sit on a solid flat background (green, blue, yellow or cream). The halftone dot shadow is optional and off by default.

- `runtime/puppet.js` holds the art and the rig, and generates the SVG into the page. Copy it next to your composition, together with GSAP.
- `puppet.svg` is a static export at rest (viewBox 0 0 600 680, ids prefixed `pz-`). It is for reference and editing only. Regenerate it with `node -e "require('fs').writeFileSync('puppet.svg', require('../../../../runtime/puppet.js').svg('pz'))"`.
- `poses.jpg` is a contact sheet of all poses.
- The demo is at `out/puppet-demo/` (`index.html` and `demo.mp4`).

## API

```js
const P = Puppet.mount("#pz", { width: 560, id: "pz",      // id = DOM id prefix (unique per puppet)
  theme: { shadow: "#3F6FC0", skin: "#F2A07F", shirt: "#E94F37" }, // optional; also line, hair, nose, eye, tongue
  halftone: false });                                      // true = old offset dot shadow behind the rig
const tl = gsap.timeline({ paused: true });
Puppet.pose(tl, 1.2, "point_left", { d: 0.2 });   // joints tween with back.out, the hand swaps at d/2
Puppet.talk(tl, words);                          // words = [{w, s, e}], lip flap picks visemes from vowels
Puppet.blinks(tl, DUR, { seed: 5 });             // deterministic blink schedule
Puppet.look(tl, 3.0, "left");                    // center|left|right|up|down|upleft|upright|[dx,dy] (pupil px, eye r=33)
Puppet.face(tl, 4.0, { brows: "frown", eyes: "wide", mouth: "o", look: "up" });
Puppet.mouth(tl, t, "smile");                    // closed|small|wide|o|smile
Puppet.breathe(tl, 0, DUR, { period: 3.2 });     // optional torso scaleY, timeline-driven
Puppet.enter(tl, 0, { d: 0.32 });                // rise from the bottom
```

- **Theme:** the defaults are in `Puppet.THEME`. Any key you pass overrides it per mount, and `P.theme` holds the resolved colours.
- **Static export:** `Puppet.svg(id, { theme, halftone })` returns the markup without mounting it.
- **Instance methods:** each static call also exists on the instance (`P.pose(tl, ...)`). Static calls act on the last mounted puppet, or on `{ puppet: P }`.
- **Poses:** `idle`, `point_up`, `point_left`, `wave` (hand wiggle for `hold` s), `thumbs_up`, `shrug`, `both_open`, `oops`, `thinking`, `shocked`, `present`, `count_1`, `count_2`, `count_3`.
- **Custom poses:** you can pass a pose object instead of a name, e.g. `{ A: { ik: [x, y], ha: 150, h: "open" }, B: {...}, head, brows, eyes, look, mouth, shoulders, rig }`.
  - `A` is the screen-left arm and `B` is the screen-right arm.
  - `ik` is the wrist target in viewBox coordinates. The 2-bone IK puts the elbow below by default; `bend: ±1` forces the side.
  - `ha` is the absolute hand angle: 0 = fingers down, 180 = up, 90 = left, -90 = right.
  - You can give `ang: [upper, fore, hand]` instead of `ik`.
- **Hands:** `open`, `wave`, `point`, `fist`, `thumbs`, `palmup`, `two`, `three`.
- **Brows:** `neutral`, `raised`, `frown`, `one`.
- **Eyes:** `open`, `wide`, `blink`.

## Rig and seek-safety

- **Joints:** every joint is a static `translate()` wrapper (the pivot) around a GSAP-rotated `<g>` with `svgOrigin "0 0"`. The chain is shoulder → `armX` → elbow → `foreX` → wrist → `handX`.
- **Head:** the head tilts on `pz-neck` (pivot at 300,470).
- **Eyes and brows:** eyes use the `eyeL/R` groups (wide) and the `blinkL/R` groups (blink). Pupils sit in the `.pz-pupil` groups, clipped to the sclera. Brows are `browL/R`.
- **Swaps:** hands and mouths swap with `tl.set(autoAlpha)`.
- **Determinism:** there is no `Math.random`, `Date` or CSS transform on any tweened element. All pivots are set once in `mount`.
- **Check:** seeking out of order (forward, back, random) gives identical DOM transforms.
- **Elbows:** they are overlapping round-capped sleeve capsules, so there are no gaps at any angle.

## Full-body mode (long-form, 16:9)

`mode: "full"` adds trousers (flat ink-blue, cobalt shade side), a belt, white sneakers with a coloured sole stripe, and legs with 2-bone IK
(hip, knee, ankle). The torso runs to the hips with a ribbed hem. `mode: "bust"` (the default) is unchanged and is what reels use.

```js
const P = Puppet.mount("#pz", { mode: "full", height: 620, id: "pz" });   // height = hair-top to sole in px (or pass width)
const tl = gsap.timeline({ paused: true });
Puppet.place(tl, 0, 640);                              // instant x offset in px (relative to the mount spot), e.g. start off-screen
Puppet.walk(tl, 0.1, 2.5, { from: 640, to: 0 });       // translate + walk cycle: planted stance feet, arcing swing feet, hip bob, arm swing, head bob
Puppet.moveTo(tl, 5, -300, { d: 1.2 });               // walks (short distances become a step or two); d optional
Puppet.pose(tl, 3, "present_left");                    // body states are poses too (see list); arm/hand poses and visemes work as before
Puppet.shift(tl, 4, "l" | "r" | "c");                  // weight shift: hips over one foot, the other knee relaxes, feet stay planted
Puppet.step(tl, 4, "l" | "r", { len: 46 });            // one planted-foot step to the side
Puppet.jump(tl, 6, { h: 150 });                        // h in px; squash, stretch, tuck, landing squash. arms go up (arms:false to skip)
Puppet.hop(tl, 6, { n: 2 });                           // celebratory hops with fist pumps
Puppet.sit(tl, 8); Puppet.stand(tl, 10);               // sit on an implied box/stool (draw your own prop); stand-up leans forward first
Puppet.lean(tl, 3, { dir: "r" });                      // lean on an invisible wall
Puppet.tap(tl, 3, { hold: 1.2, foot: "r" });           // nervous toe tap
Puppet.turn(tl, 7, "toggle" | "mirror" | "front");     // turn in place (card-spin through edge-on)
Puppet.pointScreen(tl, 3, "l");                        // whole-arm point at a big screen + body twist
Puppet.idle(tl, 0, DUR, { amt: 1 });                   // idle micro-sway + breathing, a pure function of time
Puppet.breathe(tl, 0, DUR);                            // optional torso scaleY breathing (origin at the hips in full mode)
```

- **Body poses** for `Puppet.pose(tl, t, name)`: `stand`, `step_l`, `step_r`, `lean` (`{dir}`), `sit`, `jump` (`{h}`), `hop` (`{n}`), `present_left`, `present_right`,
  `point_screen_l`, `point_screen_r`, `tap` (`{hold, foot}`). `shrug` also raises the shoulders and sinks the head in full mode. A pose can carry
  `body: { hx, hy, tilt, lean, twist, ... }` (channel targets) in a custom pose object.
- **Units:** all x positions and `h` are in screen px. Offsets are relative to where the puppet is mounted. Author body motions in time order.
- **How it works:** body motions write keyframes into per-channel tracks (x, y, hip offset/tilt, lean, twist, sit, squash, foot offsets, arm swing, head bob).
  One driver tween on your timeline evaluates the tracks as a pure function of time, then solves the leg IK. Feet are IK targets in the figure frame, so a
  planted foot does not move while the hips sway. The walk keeps stance feet fixed in WORLD space (`rig offset = world - body x`).
- **Seek-safety:** the driver is a single `ease:"none"` tween with `onUpdate`; there is no Math.random, Date or rAF. Seeking any order gives the same pose.
- **Demo:** `out/puppet-demo-full/index.html` (1920x1080, 15 s). `out/puppet-demo-full/tour/` has a pose tour. Contact sheet: `full-body.jpg`.
- **Limits:** the walk is a front-view sideways shuffle (feet swing along x; shoes flip to face the travel direction). `turn` mirrors the whole figure, so the
  cobalt shade side flips too. Sitting uses foreshortened thighs, and the stool/box is your own prop. Keep `walk` strides at about 100 units or less (reach is clamped).
