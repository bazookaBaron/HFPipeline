import { WireScriptSchema, toInternalScript } from "./wireSchema.js";
import { runStructuralChecks } from "./validation.js";
import { buildInitialPrompt, buildRepairPrompt } from "./promptBuilder.js";
import { ComponentHistory } from "./history.js";
import { loadComponentCatalog, type ComponentInfo } from "./componentCatalog.js";
import type { GenerateFn } from "./geminiClient.js";
import type { GenerationInput, Script, StructuralIssue, ValidationConfig } from "./types.js";
import { DEFAULT_VALIDATION_CONFIG } from "./types.js";

export interface AttemptRecord {
  attempt: number; // 0-indexed
  rawResponse: unknown;
  schemaValid: boolean;
  issues: StructuralIssue[];
}

export interface GenerateScriptResult {
  script: Script;
  attempts: AttemptRecord[];
}

export class ScriptGenerationError extends Error {
  constructor(
    message: string,
    public readonly attempts: AttemptRecord[]
  ) {
    super(message);
    this.name = "ScriptGenerationError";
  }
}

function zodErrorToIssues(error: { issues: { path: (string | number)[]; message: string }[] }): StructuralIssue[] {
  return error.issues.map((i) => ({
    check: "schema" as const,
    message: `Field "${i.path.join(".") || "(root)"}": ${i.message}`,
  }));
}

/**
 * Runs the schema-call + reject-and-repair loop end to end:
 *   1. Ask Gemini (via the injected `generate` fn) for a structured response.
 *   2. Parse it against WireScriptSchema (this is the zod-schema-backed
 *      structural validation that mirrors the responseSchema sent to Gemini).
 *   3. Convert to the internal Script shape and run the structural checks
 *      that no schema can express (pacing, anchor-substring, variety,
 *      placeholder-content).
 *   4. On any failure, re-prompt with the SPECIFIC failure reasons and the
 *      previous invalid response, bounded by config.maxRetries.
 *   5. On success, record the accepted componentType choices to the local
 *      history file so future variety checks see them.
 */
export async function generateScript(
  input: GenerationInput,
  generate: GenerateFn,
  history: ComponentHistory,
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG,
  catalog: ComponentInfo[] = loadComponentCatalog()
): Promise<GenerateScriptResult> {
  const attempts: AttemptRecord[] = [];
  let lastRaw: unknown = undefined;
  let lastIssues: StructuralIssue[] = [];

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    const prompt =
      attempt === 0
        ? buildInitialPrompt(input, catalog)
        : buildRepairPrompt(input, lastRaw, lastIssues, catalog);

    const raw = await generate(prompt);
    lastRaw = raw;

    const parsed = WireScriptSchema.safeParse(raw);
    if (!parsed.success) {
      const issues = zodErrorToIssues(parsed.error);
      attempts.push({ attempt, rawResponse: raw, schemaValid: false, issues });
      lastIssues = issues;
      continue;
    }

    const script = toInternalScript(parsed.data);
    const structuralIssues = runStructuralChecks(script, history, config, catalog);
    attempts.push({ attempt, rawResponse: raw, schemaValid: true, issues: structuralIssues });

    if (structuralIssues.length === 0) {
      history.recordScript(script);
      return { script, attempts };
    }

    lastIssues = structuralIssues;
  }

  throw new ScriptGenerationError(
    `Failed to produce a structurally-valid script after ${config.maxRetries + 1} attempt(s). ` +
      `Last issues:\n${lastIssues.map((i) => `- [${i.check}] ${i.message}`).join("\n")}`,
    attempts
  );
}
