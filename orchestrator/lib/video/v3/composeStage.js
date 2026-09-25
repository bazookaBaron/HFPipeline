"use strict";

/**
 * v3 root composition: one continuous narration track, ONE full-frame `stage` sub-composition
 * (background, chrome, mascot, scaffolds of modules, events) and the caption layer.
 * Caption skins are measured per profile (analysis/pacing-audit-20260924/design/SPEC.md 4.4).
 */

const CAPTION_SKINS = {
  // DH "sticker" (R2): box y 1416-1531.5, 3 px white border, hard 8 px accent offset shadow,
  // 62 px w800, pad-x 39; spoken #ebf1f9 / active #549bf4 / upcoming #8f99a9; 2-frame crossfade.
  DH: {
    top: 1416,
    height: 116,
    fontSize: 62,
    weight: 800,
    padX: 39,
    fill: "#07080b",
    border: "3px solid #ffffff",
    radius: 0,
    shadow: (accent) => `8px 8px 0 0 ${accent}`,
    past: "#ebf1f9",
    now: "#549bf4",
    next: "#8f99a9",
    maxWords: 4,
    swap: "crossfade2",
    wordLag: 0.06,
  },
  // DC "quiet chip" (R5): box y 1444.5-1548 (h 103.5), #090D11, 1.5 px #15191C, r 9, soft shadow;
  // ~54 px w650; 2-state karaoke: active #FBFEFF, everything else #B0B4B9; swap = old chunk all-grey
  // for 1 f, exactly 1 blank frame, new chunk grey with the active word white.
  DC: {
    top: 1444.5,
    height: 103.5,
    fontSize: 54,
    weight: 650,
    padX: 36,
    fill: "#090d11",
    border: "1.5px solid #15191c",
    radius: 9,
    shadow: () => "0 5px 6px #07080b",
    past: "#b0b4b9",
    now: "#fbfeff",
    next: "#b0b4b9",
    maxWords: 4,
    swap: "blank",
    wordLag: 0.0,
  },
  // LC "paper" (R4): box y 1452-1545 (h 94.5), #FEFCF8, 1.5 px #C5C7C2, r 12, soft shadow ~7.5 px
  // down; 50 px w800; spoken #13232D / active #1D5EBD / upcoming #425058; swap = old chunk exits in
  // 1 f (scale .87 + fade), 1 blank frame, new chunk pops .985 -> 1.015 -> 1 over 3 f.
  LC: {
    top: 1452,
    height: 94.5,
    fontSize: 50,
    weight: 800,
    padX: 34,
    fill: "#fefcf8",
    border: "1.5px solid #c5c7c2",
    radius: 12,
    shadow: () => "0 7.5px 7px #dde3e9",
    past: "#13232d",
    now: "#1d5ebd",
    next: "#425058",
    maxWords: 3,
    swap: "pop",
    wordLag: 0.07,
  },
};

const F = 1 / 30;

/** Chunk words into caption phrases: <= maxWords, break after sentence/clause punctuation. */
function chunkWords(words, maxWords) {
  const out = [];
  let cur = [];
  const flush = () => {
    if (cur.length) out.push(cur);
    cur = [];
  };
  words.forEach((w, i) => {
    cur.push(w);
    const text = String(w.text || w.word || "");
    const next = words[i + 1];
    const endsClause = /[.!?;:]$/.test(text) || (/,$/.test(text) && cur.length >= 2);
    const gapAfter = next ? next.start - w.end : 0;
    if (cur.length >= maxWords || endsClause || gapAfter > 0.35) flush();
  });
  flush();
  // avoid orphan single words by merging into the previous chunk when it has room
  for (let i = out.length - 1; i > 0; i--) {
    if (out[i].length === 1 && out[i - 1].length < maxWords + 1 && !/[.!?]$/.test(String(out[i - 1][out[i - 1].length - 1].text))) {
      out[i - 1] = out[i - 1].concat(out[i]);
      out.splice(i, 1);
    }
  }
  return out;
}

function buildCaptions(words, totalDuration, profile, accent) {
  const skin = CAPTION_SKINS[profile] || CAPTION_SKINS.DH;
  if (!words.length) return "";
  const chunks = chunkWords(words, skin.maxWords).map((g) => ({
    start: g[0].start,
    end: g[g.length - 1].end,
    words: g.map((w) => ({ t: String(w.text || w.word || "").trim(), s: w.start + skin.wordLag })),
  }));
  const json = JSON.stringify(chunks).replace(/</g, "\\u003c");
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
          #captions-comp .cap3 {
            position: absolute;
            left: 540px;
            top: ${skin.top}px;
            height: ${skin.height}px;
            transform: translateX(-50%);
            transform-origin: 50% 50%;
            display: flex;
            align-items: center;
            white-space: nowrap;
            padding: 0 ${skin.padX}px;
            box-sizing: border-box;
            font-family: Inter, ui-sans-serif, system-ui, sans-serif;
            font-weight: ${skin.weight};
            letter-spacing: -0.01em;
            line-height: 1;
            background: ${skin.fill};
            border: ${skin.border};
            border-radius: ${skin.radius}px;
            box-shadow: ${skin.shadow(accent)};
            opacity: 0;
          }
          #captions-comp .cap3 span span { color: ${skin.next}; }
          #captions-comp .cap3 span span[data-s="now"] { color: ${skin.now}; }
          #captions-comp .cap3 span span[data-s="past"] { color: ${skin.past}; }
        </style>
        <script>
          (function () {
            "use strict";
            var CHUNKS = ${json};
            var F = ${F};
            var SWAP = "${skin.swap}";
            var root = document.getElementById("captions-comp");
            var FAMILY = "Inter, ui-sans-serif, system-ui, sans-serif";
            var capTl = gsap.timeline({ paused: true });
            var lines = CHUNKS.map(function (c) {
              var line = document.createElement("div");
              line.className = "cap3";
              var text = c.words.map(function (w) { return w.t; }).join(" ");
              var size = ${skin.fontSize};
              if (window.HFTextFit) {
                while (size > 40 && HFTextFit.measure(text, ${skin.weight}, size, FAMILY) > 1080 * 0.9 - ${2 * skin.padX + 6}) size -= 2;
              }
              line.style.fontSize = size + "px";
              // inline wrapper: the box is a flex container, which would drop the space text nodes
              var inner = document.createElement("span");
              line.appendChild(inner);
              var spans = c.words.map(function (w, wi) {
                var sp = document.createElement("span");
                sp.textContent = w.t;
                inner.appendChild(sp);
                if (wi < c.words.length - 1) inner.appendChild(document.createTextNode(" "));
                return sp;
              });
              root.appendChild(line);
              return { el: line, spans: spans };
            });
            CHUNKS.forEach(function (c, i) {
              var L = lines[i];
              var on = c.start;
              var next = CHUNKS[i + 1];
              if (SWAP === "blank") {
                // R5: old chunk turns all-grey for 1 f, then exactly 1 blank frame, then the new chunk
                var inB = i === 0 ? on : on + F;
                capTl.set(L.el, { opacity: 1 }, inB);
                if (next) {
                  L.spans.forEach(function (sp) {
                    capTl.set(sp, { attr: { "data-s": "past" } }, Math.max(inB + F, next.start - F));
                  });
                  capTl.set(L.el, { opacity: 0 }, next.start);
                }
              } else if (SWAP === "pop") {
                // R4: exit 1 f (scale .87 + fade), 1 blank frame, new chunk .985 -> 1.015 -> 1
                var inAt = i === 0 ? on : on + F;
                capTl.set(L.el, { opacity: 1, scale: 0.985 }, inAt);
                capTl.set(L.el, { scale: 1.015 }, inAt + F);
                capTl.set(L.el, { scale: 1 }, inAt + 2 * F);
                if (next) {
                  capTl.set(L.el, { opacity: 0.35, scale: 0.87 }, Math.max(inAt + 3 * F, next.start - F));
                  capTl.set(L.el, { opacity: 0 }, next.start);
                }
              } else if (i === 0) capTl.set(L.el, { opacity: 1 }, on);
              else {
                // R2 E12: old chunk dims for 1 frame, new chunk at ~30% then full (2-frame crossfade).
                capTl.set(L.el, { opacity: 0.3 }, on);
                capTl.set(L.el, { opacity: 1 }, on + F);
              }
              if (SWAP === "pop" || SWAP === "blank") {
                if (!next) capTl.set(L.el, { opacity: 0 }, Math.min(${totalDuration.toFixed(3)} - F, c.end + 0.4));
              } else if (next) {
                capTl.set(L.el, { opacity: 0.4 }, Math.max(on + F, next.start - F));
                capTl.set(L.el, { opacity: 0 }, next.start);
              } else {
                capTl.set(L.el, { opacity: 0 }, Math.min(${totalDuration.toFixed(3)} - F, c.end + 0.4));
              }
              L.spans.forEach(function (sp, wi) {
                capTl.set(sp, { attr: { "data-s": "now" } }, c.words[wi].s);
                if (wi + 1 < L.spans.length) capTl.set(sp, { attr: { "data-s": "past" } }, c.words[wi + 1].s);
              });
            });
            capTl.set({}, {}, ${totalDuration.toFixed(3)});
            window.__timelines = window.__timelines || {};
            window.__timelines["captions"] = capTl;
          })();
        </script>
      </div>`;
}

/**
 * @param {object} o
 * @param {string} o.runId
 * @param {number} o.totalDuration final seconds
 * @param {object} o.spec compiled stage spec (see video-engine/.../lib/stage/core.js)
 * @param {string} [o.narrationRelPath]
 * @param {Array<{text,start,end}>} [o.words] final-time words for captions
 * @param {string} [o.profile] "DH"
 * @param {string} [o.accent] caption shadow colour
 */
function buildStageComposition({ runId, totalDuration, spec, narrationRelPath, words, profile = "DH", accent = "#4497ff", captionsOn = true }) {
  const specJson = JSON.stringify({ spec: JSON.stringify(spec), duration: Number(totalDuration.toFixed(3)) }).replace(/'/g, "&#39;");
  const narrationTag = narrationRelPath
    ? `      <audio id="narration-audio" class="clip" data-start="0" data-track-index="0" src="${narrationRelPath}"></audio>`
    : "";
  return `<!doctype html>
<html lang="en" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <script src="compositions/components/lib/text-fit.js"></script>
    <script src="compositions/components/lib/props.js"></script>
    <script src="compositions/components/lib/stage/core.js"></script>
    <script src="compositions/components/lib/stage/modules-dh.js"></script>
    <script src="compositions/components/lib/stage/modules-dh2.js"></script>
    <script src="compositions/components/lib/icons.js"></script>
    <script src="compositions/components/lib/stage/modules-dh3.js"></script>
    <script src="compositions/components/lib/stage/modules-dh4.js"></script>
    <script src="compositions/components/lib/stage/theme-lc.js"></script>
    <script src="compositions/components/lib/stage/profile-lc.js"></script>
    <script src="compositions/components/lib/stage/profile-dc.js"></script>
    <script src="compositions/components/lib/stage/modules-end.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1080px; height: 1920px; overflow: hidden; background: #000; }
      #root { position: relative; width: 1080px; height: 1920px; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="${runId}" data-start="0" data-width="1080" data-height="1920">
${narrationTag}
      <!-- Duration anchor: with a lone sub-composition clip, \`hyperframes snapshot\` stopped
           showing the stage after ~1.8 s (verified 2026-09-25); an explicit full-length clip
           pins the root's length for every tool. -->
      <div id="duration-anchor" class="clip" data-start="0" data-duration="${totalDuration.toFixed(3)}" data-track-index="9" style="position:absolute; left:0; top:0; width:1px; height:1px;"></div>
      <div
        id="stage-comp"
        data-composition-id="stage-main"
        data-composition-src="compositions/components/stage/stage.html"
        data-variable-values='${specJson}'
        data-start="0"
        data-duration="${totalDuration.toFixed(3)}"
        data-width="1080"
        data-height="1920"
        data-track-index="1"
        class="clip"
        style="position:absolute; left:0; top:0; width:1080px; height:1920px;"
      ></div>
${captionsOn ? buildCaptions(words || [], totalDuration, profile, accent) : ""}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      // Pad the root timeline to the full length (an empty root timeline let snapshot drop the
      // stage after ~1.8 s when no other timeline was registered; verified 2026-09-25).
      tl.set({}, {}, ${totalDuration.toFixed(3)});
      window.__timelines["${runId}"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`;
}

module.exports = { buildStageComposition, chunkWords, CAPTION_SKINS };
