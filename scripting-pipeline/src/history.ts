import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Script } from "./types.js";

/**
 * Local JSON history of recently-used componentType values per
 * topicCategory, used by the variety check (validation.ts#checkVariety) so
 * we don't lean on the same visual component run after run.
 *
 * File shape:
 * {
 *   "categories": {
 *     "cs-fundamentals": { "recentComponents": ["browserWindow", "kpiCluster", ...] }
 *   }
 * }
 *
 * `recentComponents` is append-ordered, oldest first. Callers only ever look
 * at the *tail* (most recent N) via getRecent().
 */

export interface HistoryFileShape {
  categories: Record<string, { recentComponents: string[] }>;
}

const MAX_STORED_PER_CATEGORY = 200; // hard cap so the file doesn't grow unbounded

export class ComponentHistory {
  private data: HistoryFileShape;

  constructor(private readonly filePath: string) {
    this.data = ComponentHistory.load(filePath);
  }

  private static load(filePath: string): HistoryFileShape {
    if (!existsSync(filePath)) {
      return { categories: {} };
    }
    try {
      const raw = readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.categories) {
        return parsed as HistoryFileShape;
      }
      return { categories: {} };
    } catch {
      // Corrupt/unreadable history file should never crash the pipeline --
      // just start fresh rather than blocking script generation on it.
      return { categories: {} };
    }
  }

  /** Most recent `windowSize` componentType usages recorded for this category, oldest first. */
  getRecent(topicCategory: string, windowSize: number): string[] {
    const entry = this.data.categories[topicCategory];
    if (!entry) return [];
    return entry.recentComponents.slice(-windowSize);
  }

  /** Record every scene's componentType from an accepted script, then persist to disk. */
  recordScript(script: Script): void {
    const entry = this.data.categories[script.topicCategory] ?? { recentComponents: [] };
    for (const scene of script.scenes) {
      entry.recentComponents.push(scene.componentType);
    }
    if (entry.recentComponents.length > MAX_STORED_PER_CATEGORY) {
      entry.recentComponents = entry.recentComponents.slice(-MAX_STORED_PER_CATEGORY);
    }
    this.data.categories[script.topicCategory] = entry;
    this.save();
  }

  private save(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2) + "\n", "utf-8");
  }
}
