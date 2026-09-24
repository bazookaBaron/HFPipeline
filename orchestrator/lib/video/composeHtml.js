"use strict";

/**
 * Builds a full top-level HyperFrames composition document for a run.
 *
 * IMPORTANT: every asset path below is ROOT-RELATIVE to the video-engine/
 * project root -- NEVER "../"-prefixed -- confirmed empirically (StaticGuard
 * rejects any "../" asset path regardless of which subdirectory the
 * composition file itself lives in).
 *
 * Persistent chrome (video-quality redesign, following real reference-video
 * research -- see PLAN.md): none of this lives inside any of the 56
 * video-engine components. It's handled here, at the root-composition level,
 * exactly like accent/captions/sfx already were:
 *  - accent: unchanged, overrides --hf-brand, cascades to every component.
 *  - mascot: a persistent character image, mounted once for the whole video,
 *    corner-positioned (NOT resizing/repositioning existing scene content --
 *    the 56 components assume full-frame layout and were validated that way;
 *    forcibly shrinking them into a side column would risk breaking
 *    already-proven text-fit/layout logic across all of them for a purely
 *    cosmetic gain. Corner placement gets the "persistent host" effect
 *    real reference videos have without that risk).
 *  - status HUD: a persistent top bar with a real state machine (label +
 *    status pill + metric, changing at specific timestamps) -- the
 *    "evolving live dashboard" device that ties an entire video together in
 *    the reference research. Renders on top of scene content (opaque bar,
 *    slim height) so it can never visually break on top of any component's
 *    own layout, only cover a thin strip at the very top.
 *  - captions: REDESIGNED from the previous plain-text version -- now a
 *    bordered box with per-word emphasis coloring, driven by the same
 *    narrationAnchors data already used for component timing (an anchor's
 *    words are exactly the words worth emphasizing -- no new script schema
 *    field needed for this).
 *  - sfx: unchanged, a real synthesized whoosh at each scene boundary.
 */

// 3 (not 4) -- a real end-to-end check found a 4-word phrase wrapping to 2 lines,
// growing the caption box tall enough to collide with full-frame scene content
// positioned in the lower part of the frame (e.g. a node-graph-diagram node).
// Shorter phrases wrap far less often, keeping the box's real height predictable.
const CAPTION_WORDS_PER_GROUP = 3;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;
const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "to", "of", "in", "on", "at",
  "and", "or", "but", "so", "it", "its", "this", "that", "you", "your", "we", "our", "for",
  "with", "as", "by", "from", "into", "then", "than", "there", "here", "just", "do", "does",
]);

function normWord(w) {
  return String(w || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Builds the set of "emphasis-worthy" normalized words for a scene from its real
 * narrationAnchors -- these are exactly the words the script-generation/anchor-resolution
 * step already identified as meaningful enough to time a visual reveal against, so reusing
 * them for caption emphasis needs no new data, just a different consumer of the same field. */
function anchorEmphasisSet(narrationAnchors) {
  const set = new Set();
  (narrationAnchors || []).forEach((a) => {
    String((a && a.anchorText) || "")
      .split(/\s+/)
      .map(normWord)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w))
      .forEach((w) => set.add(w));
  });
  return set;
}

/** Groups a flat global word array into short caption phrases, each carrying which of its
 * words should render emphasized. Each phrase shows from its first word's start to the
 * earlier of (its last word's end + a short hold) or the next phrase's start, so captions
 * never overlap. */
function groupCaptionPhrases(words) {
  const phrases = [];
  for (let i = 0; i < words.length; i += CAPTION_WORDS_PER_GROUP) {
    const group = words.slice(i, i + CAPTION_WORDS_PER_GROUP);
    if (!group.length) continue;
    phrases.push({
      words: group.map((w) => ({ text: (w.word || w.text || "").trim(), emphasis: !!w.emphasis })),
      start: group[0].start,
      end: group[group.length - 1].end,
    });
  }
  for (let i = 0; i < phrases.length; i++) {
    const holdEnd = phrases[i].end + 0.35;
    const nextStart = i + 1 < phrases.length ? phrases[i + 1].start : Infinity;
    phrases[i].displayEnd = Math.min(holdEnd, nextStart - 0.02);
    if (phrases[i].displayEnd <= phrases[i].start) {
      phrases[i].displayEnd = phrases[i].start + 0.2;
    }
  }
  return phrases.filter((p) => p.words.length > 0);
}

function buildCaptionsComposition(phrases, totalDuration, safeAccent) {
  if (!phrases.length) return "";
  const phrasesJson = JSON.stringify(phrases).replace(/</g, "\\u003c");
  return `      <div
        id="captions-comp"
        data-composition-id="captions"
        data-start="0"
        data-duration="${totalDuration.toFixed(3)}"
        data-width="1080"
        data-height="1920"
        data-track-index="5"
        data-timeline-role="captions"
        data-caption-root="true"
      >
        <style>
          #captions-comp { position: absolute; inset: 0; pointer-events: none; }
          /* bottom:24% (not the original 9%) -- a real hyperframes-check + snapshot run
             against a real generated video found this box overlapping the persistent
             mascot's image, dense full-bleed scene content underneath (e.g.
             deployment-dashboard's bottom "OF TRAFFIC" readouts), and -- even after an
             earlier bottom:21% fix -- a node-graph-diagram node label, once a 4-word
             caption phrase wrapped to 2 lines and grew the box taller than expected.
             24% + the smaller 36px font (was 40px) + 3-word (was 4-word) phrase grouping
             together keep the box's real worst-case height comfortably short of the
             frame's lower content zone. This is a mitigation, not a proof: a full-frame
             component could still in principle place content in this reserved strip. */
          #captions-comp .cap-box {
            position: absolute;
            left: 6%;
            right: 6%;
            bottom: 24%;
            box-sizing: border-box;
            padding: 14px 22px;
            text-align: center;
            font-family: Inter, ui-sans-serif, system-ui, sans-serif;
            font-weight: 700;
            font-size: 36px;
            line-height: 1.3;
            color: #ffffff;
            background: rgba(8, 10, 14, 0.82);
            border: 3px solid ${safeAccent};
            border-radius: 10px;
            opacity: 0;
          }
          #captions-comp .cap-em { color: ${safeAccent}; }
        </style>
        <div id="cap-box" class="cap-box"></div>
        <script>
          (function () {
            "use strict";
            var PHRASES = ${phrasesJson};
            var boxEl = document.getElementById("cap-box");
            function escapeHtml(s) {
              return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            }
            function renderPhrase(p) {
              boxEl.innerHTML = p.words
                .map(function (w) {
                  var safe = escapeHtml(w.text);
                  return w.emphasis ? '<span class="cap-em">' + safe + "</span>" : safe;
                })
                .join(" ");
            }
            var capTl = gsap.timeline({ paused: true });
            PHRASES.forEach(function (p) {
              capTl.call(renderPhrase, [p], p.start);
              capTl.fromTo(boxEl, { opacity: 0 }, { opacity: 1, duration: 0.12 }, p.start);
              capTl.to(boxEl, { opacity: 0, duration: 0.12 }, Math.max(p.start + 0.01, p.displayEnd));
            });
            window.__timelines = window.__timelines || {};
            window.__timelines["captions"] = capTl;
          })();
        </script>
      </div>`;
}

/** Persistent host-character layer. Corner-positioned (see file header for why), one calm
 * entrance animation then static -- per this project's own motion-doctrine skill, a
 * "ban on idle wobble": a persistent character should not gratuitously bob/breathe just to
 * look alive; it should perform a real motion once (the entrance) and then hold, the same
 * discipline every other component in this library already follows. */
function buildMascot(totalDuration) {
  return `      <div
        id="mascot-comp"
        data-composition-id="mascot"
        data-start="0"
        data-duration="${totalDuration.toFixed(3)}"
        data-width="1080"
        data-height="1920"
        data-track-index="7"
      >
        <style>
          #mascot-comp { position: absolute; inset: 0; pointer-events: none; }
          /* width:15% (not the original 26%) -- a real snapshot showed the larger mascot
             covering roughly a third of the frame, overlapping the caption box and dense
             full-bleed scene content (deployment-dashboard's card readouts). At 15% width
             (~162px on a 1080-wide frame) the source SVG's real 635x913 aspect ratio gives
             a ~233px-tall image, so its top edge sits at bottom(3%) + height(~12.1%) =
             ~15.1% from the bottom -- comfortably clear of the caption box's own bottom:21%
             (see buildCaptionsComposition). Still a recognizable persistent corner host,
             just no longer content-obstructing. */
          #mascot-comp .mascot-img {
            position: absolute;
            left: 3%;
            bottom: 3%;
            width: 15%;
            height: auto;
            opacity: 0;
            filter: drop-shadow(0 8px 18px rgba(0,0,0,0.5));
          }
        </style>
        <img class="mascot-img" id="mascot-img" src="assets/mascot/spongebob.svg" alt="" />
        <script>
          (function () {
            "use strict";
            var mTl = gsap.timeline({ paused: true });
            mTl.fromTo(
              "#mascot-img",
              { opacity: 0, y: 24 },
              { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" },
              0.15
            );
            window.__timelines = window.__timelines || {};
            window.__timelines["mascot"] = mTl;
          })();
        </script>
      </div>`;
}

/**
 * Classifies a real scenePlan beat's text (see orchestrator/lib/video/scenePlan.js's
 * ARC_STAGES) into a HUD status. Matched by prefix against the beat strings that file
 * literally emits ("Hook:", "Naive/obvious approach:", "Why it breaks:", "The real
 * mechanism...", "A complication or edge case...", "A refinement or alternative...",
 * "Recap:") -- if scenePlan.js's own wording ever changes, only this function needs to
 * change, nothing about the HUD rendering itself.
 */
function classifyBeatStatus(beatText) {
  const t = String(beatText || "").toLowerCase();
  if (/^(why it breaks|a complication)/.test(t)) {
    return { statusText: "DEGRADED", statusColor: "#ff6e6e" };
  }
  if (/^(the real mechanism|a refinement)/.test(t)) {
    return { statusText: "DEPLOYING", statusColor: "#f2c538" };
  }
  if (/^recap/.test(t)) {
    return { statusText: "STABLE", statusColor: "#71f5a7" };
  }
  return { statusText: "OK", statusColor: "#71f5a7" }; // hook, naive/obvious approach, default
}

/**
 * Derives real HUD state-machine transitions from the real narrative arc, instead of the
 * single honest static label this used to fall back to. One entry per REAL status change
 * (not one per scene -- most adjacent scenes share a status, e.g. the whole "mechanism"
 * stretch), timed to that scene's real (TTS-measured) start second.
 *
 * @param {{beat: string}[]} scenePlan same order/length as composedScenes (see generate-video.js)
 * @param {{start: number}[]} composedScenes
 * @param {string} [brandHandle]
 * @returns {{at:number, label:string, statusText:string, statusColor:string, metric:string}[]}
 */
function deriveHudStates(scenePlan, composedScenes, brandHandle) {
  const states = [];
  let lastStatusText = null;
  for (let i = 0; i < composedScenes.length; i++) {
    const beat = (scenePlan[i] && scenePlan[i].beat) || "";
    const cls = classifyBeatStatus(beat);
    if (cls.statusText !== lastStatusText) {
      states.push({
        at: composedScenes[i].start,
        label: brandHandle || "LIVE",
        statusText: cls.statusText,
        statusColor: cls.statusColor,
        metric: "",
      });
      lastStatusText = cls.statusText;
    }
  }
  if (states.length) states[0].at = 0;
  return states;
}

// Non-whoosh SFX pool for per-animation cues (real user feedback: "no whoosh" for these --
// whoosh stays reserved for scene-to-scene transitions only, see sfxTags below). Rotated
// round-robin ACROSS THE WHOLE VIDEO (not reset per scene) so consecutive scenes don't
// always open on the same sound.
const ANIMATION_SFX_POOL = ["pop.mp3", "click-soft.mp3", "ping.mp3", "chime.mp3", "sparkle.mp3"];
// Hard cap per scene -- a component with many list items (e.g. a 10-line diff) would
// otherwise fire one SFX per line, reading as a machine-gun rattle instead of punctuating
// the animation. Evenly downsampled to this many cues when a scene would exceed it.
const MAX_SFX_CUES_PER_SCENE = 6;
// Cues closer together than this collapse into one -- overlapping/near-simultaneous short
// SFX clips just phase into noise rather than reading as two distinct hits.
const MIN_SFX_CUE_GAP = 0.18;

/**
 * Derives real per-animation SFX cue timestamps (seconds, LOCAL to the scene) from a
 * scene's own resolved timing props -- generic across component types, matching this
 * project's existing naming conventions (every component in the library times its reveals
 * via a `..._at` numeric prop, and staggers repeated reveals via a `..._stagger` numeric
 * prop paired with a same-named plural list prop, e.g. `edge_stagger` + `edges`,
 * `line_stagger` + `lines`, `step_stagger` + `steps`, `item_stagger` + `items`).
 * Also picks up any array-of-objects prop carrying its own `at` field (e.g.
 * node-graph-diagram's `pulses`), which already used this exact shape before this change.
 *
 * Never a per-componentType map: a new component that follows the same `..._at`/
 * `..._stagger` naming convention gets real cues for free, and one that doesn't still gets
 * a single cue at its `reveal_at` (or 0.3s) rather than none at all.
 *
 * @param {Record<string, unknown>} props real resolved props for one scene
 * @returns {number[]} sorted, deduped, capped local-time cue seconds
 */
function deriveAnimationCueTimes(props) {
  const times = new Set();
  const AT_KEY_RE = /(^|_)at$/;
  const baseRevealAt = typeof props.reveal_at === "number" && isFinite(props.reveal_at) ? props.reveal_at : 0.3;

  for (const [key, val] of Object.entries(props || {})) {
    if (AT_KEY_RE.test(key) && typeof val === "number" && isFinite(val) && val >= 0) {
      times.add(val);
    }
    if (/_stagger$/.test(key) && typeof val === "number" && isFinite(val) && val > 0) {
      const listKey = key.replace(/_stagger$/, "") + "s";
      const list = props[listKey];
      const count = Array.isArray(list) ? list.length : typeof list === "string" ? list.split("|").length : 0;
      for (let i = 0; i < Math.min(count, 8); i++) {
        times.add(baseRevealAt + i * val);
      }
    }
    if (Array.isArray(val)) {
      val.forEach((entry) => {
        if (entry && typeof entry === "object" && typeof entry.at === "number" && isFinite(entry.at) && entry.at >= 0) {
          times.add(entry.at);
        }
      });
    }
  }

  if (times.size === 0) times.add(baseRevealAt);

  const sorted = Array.from(times).sort((a, b) => a - b);
  const deduped = [];
  for (const t of sorted) {
    if (!deduped.length || t - deduped[deduped.length - 1] >= MIN_SFX_CUE_GAP) deduped.push(t);
  }
  if (deduped.length <= MAX_SFX_CUES_PER_SCENE) return deduped;

  // Even downsample rather than a hard truncate, so a dense late-scene beat still gets
  // *a* cue instead of every cue clustering at the start.
  const picked = [];
  const step = (deduped.length - 1) / (MAX_SFX_CUES_PER_SCENE - 1);
  for (let i = 0; i < MAX_SFX_CUES_PER_SCENE; i++) {
    picked.push(deduped[Math.round(i * step)]);
  }
  return Array.from(new Set(picked));
}

/**
 * Builds the real per-animation SFX <audio> tags for the whole video: one short cue per
 * real animation beat (see deriveAnimationCueTimes), rotating through ANIMATION_SFX_POOL --
 * distinct from sfxTags' scene-transition whoosh (different purpose, different track).
 *
 * @param {{componentType: string, durationSeconds: number, start: number, props: Record<string, unknown>}[]} composedScenes
 * @returns {string}
 */
function buildAnimationSfxTags(composedScenes) {
  let poolIndex = 0;
  const tags = [];
  composedScenes.forEach((s, sceneIdx) => {
    const localTimes = deriveAnimationCueTimes(s.props).filter((t) => t < s.durationSeconds - 0.1);
    localTimes.forEach((localAt, i) => {
      const file = ANIMATION_SFX_POOL[poolIndex % ANIMATION_SFX_POOL.length];
      poolIndex += 1;
      const absAt = Math.max(0, s.start + localAt).toFixed(3);
      tags.push(`      <audio
        id="sfx-anim-${sceneIdx + 1}-${i + 1}"
        class="clip"
        data-start="${absAt}"
        data-duration="0.6"
        data-track-index="3"
        src="assets/sfx/${file}"
      ></audio>`);
    });
  });
  return tags.join("\n");
}

/**
 * Persistent status HUD -- a thin, always-visible top bar with a real state machine:
 * label (left) + status pill (colored dot + text) + metric (right), all of which can change
 * at specific timestamps. Renders on an opaque bar above scene content, so it can only ever
 * cover a thin strip at the very top of the frame, never visually break a component's own
 * layout underneath.
 *
 * @param {{at:number, label?:string, statusText?:string, statusColor?:string, metric?:string}[]} hudStates
 */
function buildStatusHud(hudStates, totalDuration, safeAccent, defaultLabel) {
  const states =
    hudStates && hudStates.length
      ? hudStates
      : [{ at: 0, label: defaultLabel || "LIVE", statusText: "OK", statusColor: safeAccent, metric: "" }];
  const statesJson = JSON.stringify(states).replace(/</g, "\\u003c");
  return `      <div
        id="hud-comp"
        data-composition-id="status-hud"
        data-start="0"
        data-duration="${totalDuration.toFixed(3)}"
        data-width="1080"
        data-height="1920"
        data-track-index="8"
      >
        <style>
          #hud-comp { position: absolute; inset: 0; pointer-events: none; }
          #hud-comp .hud-bar {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 76px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 5%;
            background: rgba(8, 10, 14, 0.92);
            border-bottom: 1px solid rgba(255,255,255,0.08);
            font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
            box-sizing: border-box;
          }
          #hud-comp .hud-left { display: flex; align-items: center; gap: 12px; min-width: 0; }
          #hud-comp .hud-label { color: #f4f5f7; font-weight: 700; font-size: 22px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          #hud-comp .hud-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 3px 10px;
            border-radius: 999px;
            font-size: 16px;
            font-weight: 700;
            border: 1px solid currentColor;
            white-space: nowrap;
          }
          #hud-comp .hud-pill::before {
            content: "";
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: currentColor;
            display: inline-block;
          }
          #hud-comp .hud-metric { color: #9aa1ad; font-size: 18px; white-space: nowrap; flex: 0 0 auto; }
        </style>
        <div class="hud-bar" id="hud-bar">
          <div class="hud-left">
            <span class="hud-label" id="hud-label"></span>
            <span class="hud-pill" id="hud-pill"></span>
          </div>
          <span class="hud-metric" id="hud-metric"></span>
        </div>
        <script>
          (function () {
            "use strict";
            var STATES = ${statesJson};
            var labelEl = document.getElementById("hud-label");
            var pillEl = document.getElementById("hud-pill");
            var metricEl = document.getElementById("hud-metric");
            function applyState(s) {
              labelEl.textContent = s.label || "";
              pillEl.textContent = s.statusText || "";
              pillEl.style.color = s.statusColor || "${safeAccent}";
              metricEl.textContent = s.metric || "";
            }
            var hudTl = gsap.timeline({ paused: true });
            hudTl.call(applyState, [STATES[0]], 0);
            hudTl.fromTo("#hud-bar", { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0);
            for (var i = 1; i < STATES.length; i++) {
              hudTl.call(applyState, [STATES[i]], STATES[i].at);
              hudTl.fromTo(
                pillEl,
                { scale: 1 },
                { scale: 1.15, duration: 0.15, yoyo: true, repeat: 1, ease: "power1.out" },
                STATES[i].at
              );
            }
            window.__timelines = window.__timelines || {};
            window.__timelines["status-hud"] = hudTl;
          })();
        </script>
      </div>`;
}

/**
 * @param {object} opts
 * @param {string} opts.runId
 * @param {{componentType: string, durationSeconds: number, start: number, props: Record<string, unknown>, audioRelPath: string, words: {word:string,start:number,end:number}[], narrationAnchors?: {anchorText:string,propPath:string}[]}[]} opts.scenes
 * @param {string} [opts.accentColor]
 * @param {string} [opts.brandHandle]
 * @param {boolean} [opts.captionsOn]
 * @param {boolean} [opts.sfxOn]
 * @param {boolean} [opts.mascotOn] default true
 * @param {{at:number, label?:string, statusText?:string, statusColor?:string, metric?:string}[]} [opts.hudStates]
 * @param {"dark"|"light"} [opts.theme] default "dark". "light" wraps every scene in
 *   chapter-shell (breadcrumb + step indicator + real sceneHeadline/sceneSubtitle chrome),
 *   with the scene's own component placed as a static sibling sized to chapter-shell's
 *   documented fixed content-card rect -- never a nested/dynamic mount (see
 *   chapter-shell.html's own header comment for why that was tried and doesn't render).
 * @returns {string} full HTML document
 */
function buildComposition({
  runId,
  scenes,
  accentColor,
  brandHandle,
  captionsOn,
  sfxOn,
  mascotOn,
  hudStates,
  theme,
  topicCategory,
}) {
  const totalDuration = scenes.length ? scenes[scenes.length - 1].start + scenes[scenes.length - 1].durationSeconds : 0;

  const safeAccent = HEX_COLOR_RE.test(String(accentColor || "")) ? accentColor : "#6ea8fe";

  const audioTags = scenes
    .map(
      (s, i) => `      <audio
        id="scene-${i + 1}-audio"
        class="clip"
        data-start="${s.start}"
        data-track-index="0"
        src="${s.audioRelPath}"
      ></audio>`
    )
    .join("\n");

  const isLightTheme = theme === "light";
  // chapter-shell's own documented fixed content-card rect (top:40cqmin, left/right:6.4cqmin,
  // bottom:42.6cqmin of a 1080x1920 frame, cqmin=10.8px) -- see chapter-shell.html's header
  // comment. Computed once here, in pixels, so the sibling content div below can be sized/
  // positioned to it exactly, matching the real snapshot-verified layout from this project's
  // own scratch validation of that pattern. Keep these 4 numbers in sync with
  // chapter-shell.html's .cs-content-outer CSS if either ever changes.
  //
  // Both rects' BOTTOM edge lands at y:1460 (76% down a 1920 frame) -- not the old 97%.
  // Real user feedback on a rendered video (frame-by-frame /watch of blue-green-deployment-v2,
  // 2026-09) found scene content running edge-to-edge into the very top and bottom of the
  // frame, exactly where Instagram/YouTube's own uploader chrome (username/back button up
  // top; caption/description/like-comment-share rail at the bottom) overlays a posted Reel
  // or Short -- on top of our own persistent HUD bar (0-76px) and caption box (bottom:24%,
  // see buildCaptionsComposition). SAFE_RECT (dark theme) / SHELL_RECT (light theme) both
  // now confine the actual scene graphic to the vertical middle band (~11%-76%), clear of
  // all four of those top/bottom occupants.
  const SHELL_RECT = { top: 432, left: 69, width: 942, height: 1028 };
  // Dark theme has no chapter-shell chrome to clear, only the HUD bar (0-76px) plus real
  // platform-chrome buffer -- 210px top gives ~2.75x that bar's height. left:0/width:1080
  // (no horizontal clip; the complaint was vertical only) with a full-bleed bg-filler div
  // behind so the letterboxed strips above/below read as continuous background, not a
  // visible seam -- see bgFillerDiv below.
  const SAFE_RECT = { top: 210, left: 0, width: 1080, height: 1250 };

  const sceneTags = scenes
    .map((s, i) => {
      const varsJson = JSON.stringify(s.props).replace(/'/g, "&#39;");
      const rect = isLightTheme ? SHELL_RECT : SAFE_RECT;
      // Dark theme still needs its own full-bleed background behind the clipped content div
      // -- unlike light theme (chapter-shell's cs-bg-layer already paints the whole 1080x1920
      // frame), there is no other element covering the space above/below SAFE_RECT. #0b0d10
      // matches every component's own --hf-bg fallback exactly, so the seam is invisible.
      const bgFillerDiv = isLightTheme
        ? ""
        : `      <div
        id="scene-${i + 1}-bg"
        class="clip"
        data-start="${s.start}"
        data-duration="${s.durationSeconds}"
        style="position:absolute; inset:0; width:1080px; height:1920px; background:var(--hf-bg-mesh, #0b0d10);"
      ></div>\n`;
      const contentDiv = `      <div
        id="scene-${i + 1}-comp"
        data-composition-id="scene-${i + 1}"
        data-composition-src="compositions/components/${s.componentType}/${s.componentType}.html"
        data-variable-values='${varsJson}'
        data-start="${s.start}"
        data-duration="${s.durationSeconds}"
        data-width="${rect.width}"
        data-height="${rect.height}"
        data-track-index="${isLightTheme ? 2 : 1}"
        class="clip"
        style="position:absolute; top:${rect.top}px; left:${rect.left}px; width:${rect.width}px; height:${rect.height}px;"
      ></div>`;

      if (!isLightTheme) return bgFillerDiv + contentDiv;

      const shellVars = {
        breadcrumb: String(topicCategory || "").toUpperCase().replace(/[_-]+/g, " / ") || "OVERVIEW",
        currentStep: i + 1,
        totalSteps: scenes.length,
        headline: s.sceneHeadline || "",
        subtitle: s.sceneSubtitle || "",
        reveal_at: 0.2,
        content_at: 0.6,
        duration: s.durationSeconds,
      };
      const shellVarsJson = JSON.stringify(shellVars).replace(/'/g, "&#39;");
      const shellDiv = `      <div
        id="scene-${i + 1}-shell"
        data-composition-id="scene-${i + 1}-shell"
        data-composition-src="compositions/components/chapter-shell/chapter-shell.html"
        data-variable-values='${shellVarsJson}'
        data-start="${s.start}"
        data-duration="${s.durationSeconds}"
        data-width="1080"
        data-height="1920"
        data-track-index="1"
      ></div>`;

      return shellDiv + "\n" + contentDiv;
    })
    .join("\n");

  // SFX: a short real whoosh at every scene-to-scene boundary (not before scene 1).
  const sfxTags =
    sfxOn && scenes.length > 1
      ? scenes
          .slice(1)
          .map(
            (s, i) => `      <audio
        id="sfx-${i + 1}"
        class="clip"
        data-start="${Math.max(0, s.start - 0.05).toFixed(3)}"
        data-track-index="2"
        src="assets/sfx/whoosh.wav"
      ></audio>`
          )
          .join("\n")
      : "";

  // Per-animation SFX cues -- real user feedback: "each and every animation should have
  // SFX, like pulse and other things (no whoosh)". Distinct pool/track from the
  // scene-transition whoosh above. Gated behind the same sfxOn flag.
  const animationSfxTags = sfxOn ? buildAnimationSfxTags(scenes) : "";

  // Captions: aggregate every scene's real word timings with the scene's real cumulative
  // start offset (same data the anchor-resolution step already used), and mark each word
  // for emphasis if it appears in that scene's own real narrationAnchors.
  let captionsBlock = "";
  if (captionsOn) {
    const globalWords = [];
    scenes.forEach((s) => {
      const emphasisSet = anchorEmphasisSet(s.narrationAnchors);
      (s.words || []).forEach((w) => {
        const text = w.word || w.text || "";
        globalWords.push({
          word: text,
          start: (w.start || 0) + s.start,
          end: (w.end || 0) + s.start,
          emphasis: emphasisSet.has(normWord(text)),
        });
      });
    });
    const phrases = groupCaptionPhrases(globalWords);
    captionsBlock = buildCaptionsComposition(phrases, totalDuration, safeAccent);
  }

  const mascotBlock = mascotOn === false ? "" : buildMascot(totalDuration);
  const hudBlock = buildStatusHud(hudStates, totalDuration, safeAccent, brandHandle);

  return `<!doctype html>
<html lang="en" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <!-- Shared component library globals (HFTextFit, HFProps) -- root-relative
         to the video-engine/ project root, same as index.html. -->
    <script src="compositions/components/lib/text-fit.js"></script>
    <script src="compositions/components/lib/props.js"></script>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      html,
      body {
        margin: 0;
        width: 1080px;
        height: 1920px;
        overflow: hidden;
        background: #0a0a0a;
      }
      :root {
        /* Real accent-color wiring: every component reads its chrome color
           via var(--hf-brand, #6ea8fe) with this exact fallback, so
           overriding it here is sufficient -- no per-component changes. */
        --hf-brand: ${safeAccent};
        /* Ambient "light mesh" background -- real user feedback: production-grade videos
           use a soft layered color-blob background, not a flat single color. Four low-
           opacity (7-10%) radial blobs in the brand + rotation accents over the same dark
           base every component already falls back to, via color-mix so it always tracks
           the real accent colors (including a custom --hf-brand override) rather than
           hardcoded hex. Cascades down into every mounted sub-composition the same way
           --hf-brand already does -- confirmed working via this project's own accent
           wiring, since HyperFrames mounts sub-compositions as real inlined DOM, not
           iframes, so CSS custom properties inherit normally. Deliberately subtle (not a
           loud pattern) so it never threatens the WCAG contrast pass most components rely
           on for text sitting directly on their own stage background. Each component's own
           .xxx-stage background reads var(--hf-bg-mesh, var(--hf-bg, #0b0d10)) -- falls
           back to the plain flat color for any component not yet wired to it, or a demo
           harness that never defines this token at all.
           NEVER applied to a component's INNER chrome surfaces that must render as a real,
           legible solid color regardless of theme (a terminal console body, a code-editor
           body, a chat window's card, a phone screen) -- those are correctly left reading
           plain var(--hf-bg, #0b0d10). */
        --hf-bg-mesh:
          radial-gradient(ellipse 70% 50% at 15% 10%, color-mix(in srgb, var(--hf-brand, #6ea8fe) 10%, transparent), transparent 60%),
          radial-gradient(ellipse 60% 45% at 90% 15%, color-mix(in srgb, var(--hf-accent-2, #c5a3ff) 8%, transparent), transparent 60%),
          radial-gradient(ellipse 65% 55% at 85% 95%, color-mix(in srgb, var(--hf-accent, #71f5a7) 7%, transparent), transparent 65%),
          radial-gradient(ellipse 55% 45% at 10% 90%, color-mix(in srgb, var(--hf-accent-3, #ffb84d) 7%, transparent), transparent 60%),
          var(--hf-bg, #0b0d10);
      }
      #root {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="${runId}"
      data-start="0"
      data-width="1080"
      data-height="1920"
    >
${audioTags}
${sfxTags}
${animationSfxTags}
${sceneTags}
${captionsBlock}
${mascotBlock}
${hudBlock}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      window.__timelines["${runId}"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`;
}

module.exports = { buildComposition, groupCaptionPhrases, anchorEmphasisSet, deriveHudStates, deriveAnimationCueTimes };
