"use strict";

// Spoken-script findings: analysis/script-audit-20260926/SCRIPT_PATTERN_ANALYSIS.md.
// These are topic-independent writing constraints, not visual/layout rules.
const NARRATIVE_GUIDE = `SPOKEN STORY (derived from five 2.5-3 minute tech explainers; compress their logic into this 45-55 second short):
- Decide the ONE viewer question and the ONE mechanism this short can actually answer. Narrow a broad topic to an explainable angle; do not cram every adjacent feature or historical fact into it.
- Name the subject or desired outcome immediately. A direct question, concrete task, or useful misconception can work; do not force a sensational statistic or the same hook shape every time.
- Give the viewer a concrete mental model early: a checkout retry, ambiguous sentence, oversized upload, repository task, or familiar product comparison. Reuse that SAME example to explain the mechanism instead of starting a new example every sentence.
- Make the middle causal: who does what, what state changes, and why the next step exists. Introduce the technical name when its job is clear. Spend most of the words here rather than listing loosely related facts.
- Choose the arc that fits the subject: a naive fix that fails for a systems problem; a worked example plus necessary parts for a concept; or a category comparison plus differentiator for a company/platform. Do not invent a failed approach merely to fill a template.
- Add one earned complication, boundary, or consequence. If the topic cannot support one, deepen the mechanism instead. Use transitions only when they change the question; avoid repeated rhetorical-question filler.
- End the topic script with a concise callback to the opening and the causal takeaway. Do not add a follow/share/site CTA: a fixed branded ending is appended separately after this script.
- Avoid fabricated exact statistics, valuations, dates, benchmarks or product claims. If a precise claim is not established by the topic or supplied evidence, use a defensible qualitative description. Describe a mitigation as reducing risk, not as "always" or "never" guaranteeing an outcome when races, failures or exceptions remain. Keep the current spoken-number and identifier rules.`;

const EMPTY_OPEN = /^(?:in this video(?:,|\s)|today(?:,|\s)(?:we(?:'re| are| will)?\s|let'?s\s)|let'?s (?:talk|discuss) about|welcome back|hey (?:guys|everyone))/i;
const CHANNEL_CTA = /\b(?:follow (?:us|me|for more)|like and subscribe|subscribe (?:for|to) (?:more|our)|share this video|check out vloombox)\b/i;
const ABSOLUTE_OUTCOME = /\b(?:eliminat(?:e|es|ing)|guarantee(?:s|d)?|ensure(?:s|d)?)\b|\bwill always\b|\bnever (?:fail|serve|happen|occur)\b/i;

function normalize(text) {
  return String(text || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Only deterministic, high-confidence failures; arc/quality need editorial judgment. */
function narrativeProblems(sentences) {
  if (!Array.isArray(sentences) || !sentences.length) return [];
  const problems = [];
  const first = String(sentences[0].text || "").trim();
  if (EMPTY_OPEN.test(first)) problems.push("topic script starts with generic throat-clearing; name the question, task or subject immediately");
  sentences.forEach((s, i) => {
    if (CHANNEL_CTA.test(String(s.text || ""))) problems.push(`sentence ${s.id || i + 1} duplicates the separately appended channel CTA`);
    if (ABSOLUTE_OUTCOME.test(String(s.text || ""))) problems.push(`sentence ${s.id || i + 1} makes an absolute outcome claim; qualify its scope or describe risk reduction instead`);
    if (i > 0 && normalize(s.text) && normalize(s.text) === normalize(sentences[i - 1].text)) {
      problems.push(`sentence ${s.id || i + 1} repeats the preceding sentence instead of advancing the explanation`);
    }
  });
  return problems;
}

module.exports = { NARRATIVE_GUIDE, narrativeProblems };
