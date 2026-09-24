import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_RESPONSE_SCHEMA } from "./wireSchema.js";

/**
 * Injectable LLM-call boundary. `pipeline.ts` depends only on this function
 * type, never on the concrete Gemini SDK -- which is what lets
 * test/pipeline.test.ts drive the whole reject-and-repair loop against
 * canned fixture responses (including deliberately broken ones) with zero
 * network access and no API key.
 *
 * Returns the raw parsed JSON (still in wire shape, i.e. props as
 * {key,value}[] -- see wireSchema.ts) -- or throws if the call itself fails.
 */
export type GenerateFn = (prompt: string) => Promise<unknown>;

export interface GeminiClientOptions {
  apiKey: string;
  model?: string;
}

/**
 * Real Gemini call using `responseSchema` structured output. Model id is
 * overridable via GEMINI_MODEL / the `model` option since Gemini model
 * names change over time -- confirm the current one before relying on this
 * long-term.
 */
export function createGeminiGenerateFn(options: GeminiClientOptions): GenerateFn {
  const genAI = new GoogleGenerativeAI(options.apiKey);
  const model = genAI.getGenerativeModel({
    model: options.model ?? "gemini-3.6-flash",
    generationConfig: {
      responseMimeType: "application/json",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      responseSchema: GEMINI_RESPONSE_SCHEMA as any,
    },
  });

  return async (prompt: string): Promise<unknown> => {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text);
  };
}
