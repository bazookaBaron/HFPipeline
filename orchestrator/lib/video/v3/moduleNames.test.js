"use strict";
// Every stage module file registers into one shared namespace (HF.modules). A second file that
// registers an existing name silently replaces it for every profile (the LF year timeline once
// shadowed the shorts `timeline` and broke DC storyboards), so names must be unique across files.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const STAGE = path.resolve(__dirname, "..", "..", "..", "..", "video-engine", "compositions", "components", "lib", "stage");

function registrations() {
  const seen = new Map(); // name -> [file:line]
  for (const f of fs.readdirSync(STAGE).filter((x) => x.endsWith(".js"))) {
    fs.readFileSync(path.join(STAGE, f), "utf-8")
      .split(/\r?\n/)
      .forEach((line, i) => {
        const m = line.match(/^\s*M(?:\.(\w+)|\[["'](\w+)["']\])\s*=[^=]/);
        if (!m) return;
        const name = m[1] || m[2];
        seen.set(name, (seen.get(name) || []).concat(`${f}:${i + 1}`));
      });
  }
  return seen;
}

test("stage module names are registered once across all module files", () => {
  const seen = registrations();
  assert.ok(seen.size > 50, `expected the stage module registry, found ${seen.size} names`);
  const dups = [...seen].filter(([, at]) => at.length > 1).map(([n, at]) => `${n}: ${at.join(", ")}`);
  assert.deepStrictEqual(dups, [], `module names registered more than once:\n${dups.join("\n")}`);
});

test("the module catalog has no duplicate keys", () => {
  // an object literal keeps the LAST duplicate key, so a clash hides the earlier doc entry
  const src = fs.readFileSync(path.join(__dirname, "catalog.js"), "utf-8");
  const body = src.slice(src.indexOf("{", src.search(/const MODULES\s*=/)));
  let depth = 0;
  const keys = new Map();
  body.split(/\r?\n/).some((line, i) => {
    const m = depth === 1 && line.match(/^\s{2}(\w+):\s/);
    if (m) keys.set(m[1], (keys.get(m[1]) || 0) + 1);
    for (const ch of line.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, "")) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }
    return i > 0 && depth === 0;
  });
  assert.ok(keys.size > 20, `expected the module catalog, found ${keys.size} keys`);
  const dups = [...keys].filter(([, n]) => n > 1).map(([k]) => k);
  assert.deepStrictEqual(dups, []);
});
