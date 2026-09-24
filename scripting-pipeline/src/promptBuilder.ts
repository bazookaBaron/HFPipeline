import type { GenerationInput, StructuralIssue } from "./types.js";
import { formatIssuesForRepairPrompt } from "./validation.js";
import { loadComponentCatalog, type ComponentInfo } from "./componentCatalog.js";

/**
 * Renders the real component catalog (read live from
 * video-engine/compositions/components/*\/registry-item.json) into prompt
 * text: name, category, description, and every declared variable with its
 * type/default/bounds. Timing variables (`..._at`) are called out explicitly
 * as NOT to be authored -- those are computed downstream from real narration
 * timestamps (see orchestrator/generate-video.js), never invented by Gemini.
 */
function formatCatalogForPrompt(catalog: ComponentInfo[]): string {
  if (catalog.length === 0) {
    return "  (WARNING: no real component catalog could be loaded. Do not invent a componentType name.)";
  }

  return catalog
    .map((c) => {
      const varLines = c.variables
        .map((v) => {
          const isTiming = v.id.endsWith("_at");
          const isDuration = v.id === "duration";
          const bits = [`${v.id} (${v.type}`];
          if (v.default !== undefined) bits.push(`, default=${JSON.stringify(v.default)}`);
          if (v.options) bits.push(`, options=[${v.options.join(", ")}]`);
          if (v.min !== undefined) bits.push(`, min=${v.min}`);
          if (v.max !== undefined) bits.push(`, max=${v.max}`);
          bits.push(")");
          const note = isTiming
            ? " -- TIMING variable: do NOT put this key in props, it is computed later from real narration timestamps"
            : isDuration
              ? " -- do NOT put this key in props, it is computed later from the real measured narration duration"
              : "";
          return `        - ${bits.join("")}${note}`;
        })
        .join("\n");
      return (
        `  - componentType "${c.name}" (category: ${c.category})\n` +
        `      description: ${c.description}\n` +
        `      variables:\n${varLines || "        (none)"}`
      );
    })
    .join("\n");
}

/**
 * Real system/architecture components worth nudging Gemini toward when they
 * exist in the catalog -- purely a selection hint, never a hard requirement
 * (checkComponentCatalog only cares that the chosen name is real). Safe to
 * leave in the prompt unconditionally: buildComponentSelectionHint() only
 * emits a line for a name that's actually present in the catalog passed in,
 * so this is a no-op until/unless these components exist.
 */
const COMPONENT_SELECTION_HINTS: { name: string; hint: string }[] = [
  {
    name: "node-graph-diagram",
    hint:
      '"node-graph-diagram" is a strong default for system/architecture topics involving several connected services or nodes. ' +
      'When its "layout" prop is "branch" (one source fanning out to several targets, e.g. a load balancer to multiple backend clusters), ' +
      'the "edges" array MUST include one edge from the source node to EVERY other node -- never leave a fanned-out node with no incoming edge. ' +
      'A real bug from a prior render: a load-balancer-to-two-clusters scene only included an edge to the first cluster, leaving the second cluster visually disconnected.',
  },
  {
    name: "deployment-dashboard",
    hint: '"deployment-dashboard" is a strong default for scenes about rollouts, monitoring, or operational/runtime state.',
  },
];

function buildComponentSelectionHint(catalog: ComponentInfo[]): string {
  const names = new Set(catalog.map((c) => c.name));
  const lines = COMPONENT_SELECTION_HINTS.filter((h) => names.has(h.name)).map((h) => `  - ${h.hint}`);
  return lines.length ? `\nComponent selection hints:\n${lines.join("\n")}\n` : "";
}

export function buildInitialPrompt(
  input: GenerationInput,
  catalog: ComponentInfo[] = loadComponentCatalog()
): string {
  const sceneList = input.scenes
    .map((s, i) => `  ${i + 1}. sceneId="${s.sceneId}", targetDurationSeconds=${s.targetDurationSeconds}, beat: ${s.beat}`)
    .join("\n");

  const catalogText = formatCatalogForPrompt(catalog);
  const componentHint = buildComponentSelectionHint(catalog);

  return `You are writing the script for a vertical CS/tech-explainer video.

Topic: ${input.topic}
Topic category (coarse bucket, reuse an existing category string like "cs-fundamentals", "web-security", "devtools" when it fits): ${input.topicCategory}
${input.audienceNote ? `Audience note: ${input.audienceNote}\n` : ""}
NARRATIVE ARC -- structure the WHOLE script around this, not a list of unrelated facts. Real reference explainers in this style run 90-150 seconds across 10-16 scenes and follow one concrete story arc from start to finish:
  1. HOOK -- state the problem or question directly. No "In this video we will..." or "Today we're going to talk about..." throat-clearing.
  2. NAIVE/OBVIOUS APPROACH -- what someone would reasonably try first, stated as if it might work.
  3. WHY IT BREAKS -- the concrete, specific failure mode of that naive approach (not "it doesn't scale well" -- the actual mechanism of the failure).
  4. THE REAL MECHANISM -- how it actually works. If it has real sub-steps, spend 2-3 scenes going one step deeper each time instead of compressing everything into a single dense scene.
  5. A COMPLICATION OR EDGE CASE -- what makes this non-trivial in practice (concurrency, scale, an adversarial input, a resource limit, a race).
  6. A REFINEMENT OR ALTERNATIVE -- how real systems actually handle that complication.
  7. RECAP -- tie it together, ideally with ONE concrete metaphor in the reference transcripts' style (e.g. "blue is the stage currently serving the audience, green is an identical stage behind the curtain"). Synthesize hook-through-refinement into a single takeaway; never introduce new unexplained material here.
The ${input.scenes.length} scene(s) listed below are already ordered along this arc -- each one's "beat" names which stage it belongs to. Make sure every scene's narration actually advances the story; no scene should just restate an earlier one in different words.

WRITING STYLE -- match real tech-explainer narration, not a textbook or a marketing script:
- Short, punchy, technically precise sentences. Prefer two or three short sentences over one long compound sentence.
- Use REAL, SPECIFIC numbers and nouns, never vague quantities: "a hundred thousand devices" not "a lot of devices"; "a 50-millisecond timeout" not "a short timeout"; name the actual protocol, data structure, or service where one is relevant.
- Use rhetorical-question transitions to carry the viewer from one beat to the next, e.g. "So what does that look like technically?", "Now what about at scale?", "But what happens when two of these race each other?" -- vary the phrasing across scenes, never reuse the same question twice in one script.
- The FIRST scene's narration must read like a genuine hook: a direct question, a surprising concrete fact, or a stated problem. Never a generic intro like "In this video we'll discuss X" or "Let's talk about X today."
- The LAST scene's narration must read like a real recap/synthesis that calls back to earlier scenes (ideally via a concrete metaphor) -- not a brand-new fact with no connection to what came before.

Produce exactly ${input.scenes.length} scene(s), one per beat below, in order:
${sceneList}

Real component catalog -- "componentType" MUST be exactly one of these names (case-sensitive, never invented, never paraphrased, never renamed):
${catalogText}
${componentHint}
Hard rules:
- Every field must contain real, topic-specific content. Never write placeholder, generic, or templated text (e.g. no "Lorem ipsum", no "Your headline here", no titles that are just the component's name).
- Each scene's "narration" is the exact words the narrator speaks during that scene. Write it to comfortably fill its target duration at a natural spoken pace (~150 words per minute) -- neither padded nor rushed.
- For each entry in "narrationAnchors", "anchorText" must be an EXACT, verbatim, copy-pasted substring of that scene's own "narration" field (same casing, same punctuation) -- never a paraphrase or a word that merely sounds similar. Only add an anchor when you can point at the literal text.
- "componentType" must be picked from the real component catalog above -- choose whichever real component's description best matches what this scene visually needs. Do not invent a name that isn't in the list.
- Vary componentType choices across scenes and avoid defaulting to the same one you might have used in prior runs on this topic category.
- "props" holds ONLY that component's declared CONTENT variables (the non-timing ones listed above) as key/value pairs -- author real values relevant to the topic, not generic labels (e.g. key "url", value "https://example.com/login").
- NEVER author a props key that ends in "_at", and NEVER author a "duration" props key -- both are computed later from the real synthesized narration, not something you write a value for. If you want a reveal timed to a specific moment, add a narrationAnchors entry whose "propPath" is "props.<that component's _at variable name>" (e.g. "props.type_at") instead of putting a value in props yourself.

Return only the structured JSON described by the response schema.`;
}

export function buildRepairPrompt(
  input: GenerationInput,
  previousRawResponse: unknown,
  issues: StructuralIssue[],
  catalog: ComponentInfo[] = loadComponentCatalog()
): string {
  const issuesText = formatIssuesForRepairPrompt(issues);
  return `${buildInitialPrompt(input, catalog)}

Your previous attempt failed validation. Here is exactly what was wrong -- fix EVERY item below in your next response. Do not repeat these mistakes.

${issuesText}

Your previous (invalid) response was:
${JSON.stringify(previousRawResponse, null, 2)}

Return a corrected, complete structured JSON response (all scenes, not just the fixed ones) that resolves every issue listed above while still satisfying all the original hard rules.`;
}
