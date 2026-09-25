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
              // R2 E12: old chunk dims for 1 frame, new chunk at ~30% then full (2-frame crossfade).
              if (i === 0) capTl.set(L.el, { opacity: 1 }, on);
              else {
                capTl.set(L.el, { opacity: 0.3 }, on);
                capTl.set(L.el, { opacity: 1 }, on + F);
              }
              if (next) {
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
