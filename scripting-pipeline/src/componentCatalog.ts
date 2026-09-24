import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Loads the REAL video-engine component library at runtime, straight from
 * each component's own `registry-item.json` -- no hardcoded/duplicated list
 * of names anywhere in this pipeline. This is the reconciliation Phase 3's
 * own report flagged as needed once Phase 2's real catalog landed (see
 * PHASE3-REPORT.md "Reconciliation needed").
 *
 * Every subfolder of video-engine/compositions/components/ is a real
 * component EXCEPT `lib/` (shared JS/CSS, not a component) and
 * `_registry-reference/` (read-only reference material pulled from
 * HyperFrames' hosted registry, not part of this project's own catalog) --
 * per the component library's own README.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Finds the scripting-pipeline package root by walking up from `startDir`
 * looking for its own package.json -- robust to whether this module is
 * running as TS source (src/componentCatalog.ts, one level under the
 * package root) or as compiled output (dist/src/componentCatalog.js, two
 * levels under it), so the components-directory lookup below doesn't break
 * depending on which one invoked it (e.g. the orchestrator importing the
 * built dist/ output).
 */
function findPackageRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.name === "scripting-pipeline") return dir;
      } catch {
        // ignore and keep walking
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: assume we're exactly one level under the package root (the
  // original, less-robust assumption), rather than throwing.
  return dirname(startDir);
}

export interface ComponentVariable {
  id: string;
  type: string;
  default?: unknown;
  min?: number;
  max?: number;
  options?: string[];
}

export interface ComponentInfo {
  name: string;
  title?: string;
  description: string;
  category: string;
  variables: ComponentVariable[];
}

const EXCLUDED_DIRS = new Set(["lib", "_registry-reference"]);

/** <repo root>/video-engine/compositions/components, resolved via the scripting-pipeline package root. */
function defaultComponentsDir(): string {
  const packageRoot = findPackageRoot(__dirname);
  const repoRoot = dirname(packageRoot);
  return join(repoRoot, "video-engine", "compositions", "components");
}

let cachedDir: string | null = null;
let cachedCatalog: ComponentInfo[] | null = null;

/**
 * Reads every `<component>/registry-item.json` under `componentsDir`
 * (defaults to the real video-engine catalog, or `COMPONENTS_DIR` env var).
 * Memoized per resolved directory -- call `clearComponentCatalogCache()` in
 * tests that need to force a re-read.
 */
export function loadComponentCatalog(componentsDir?: string): ComponentInfo[] {
  const dir = componentsDir ?? process.env.COMPONENTS_DIR ?? defaultComponentsDir();

  if (cachedDir === dir && cachedCatalog) {
    return cachedCatalog;
  }

  if (!existsSync(dir)) {
    console.error(`[componentCatalog] components directory not found: ${dir}`);
    cachedDir = dir;
    cachedCatalog = [];
    return cachedCatalog;
  }

  const entries: ComponentInfo[] = [];
  const subdirs = readdirSync(dir, { withFileTypes: true }).filter(
    (d) => d.isDirectory() && !EXCLUDED_DIRS.has(d.name)
  );

  for (const sub of subdirs) {
    const manifestPath = join(dir, sub.name, "registry-item.json");
    if (!existsSync(manifestPath)) continue; // e.g. an empty scaffolded stub folder
    try {
      const raw = JSON.parse(readFileSync(manifestPath, "utf-8"));
      entries.push({
        name: typeof raw.name === "string" ? raw.name : sub.name,
        title: typeof raw.title === "string" ? raw.title : undefined,
        description: typeof raw.description === "string" ? raw.description : "",
        category: typeof raw.category === "string" ? raw.category : "uncategorized",
        variables: Array.isArray(raw.variables) ? raw.variables : [],
      });
    } catch (e) {
      console.error(`[componentCatalog] failed to parse ${manifestPath}: ${(e as Error).message}`);
    }
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));
  cachedDir = dir;
  cachedCatalog = entries;
  return entries;
}

export function getComponentNames(catalog: ComponentInfo[]): string[] {
  return catalog.map((c) => c.name);
}

export function findComponent(catalog: ComponentInfo[], name: string): ComponentInfo | undefined {
  return catalog.find((c) => c.name === name);
}

/** A component's declared timing variables -- always named `..._at`, always paired with `duration`. */
export function timingVariableIds(component: ComponentInfo): string[] {
  return component.variables.filter((v) => v.id.endsWith("_at")).map((v) => v.id);
}

/** Test-only escape hatch: force the next loadComponentCatalog() call to re-read from disk. */
export function clearComponentCatalogCache(): void {
  cachedDir = null;
  cachedCatalog = null;
}
