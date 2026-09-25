#!/usr/bin/env node
"use strict";
// topic -> validated storyboard.v3 (Gemini + repair loop). Usage: node tools/v3-storyboard.js "topic" out.json
const fs = require("fs");
const { generateStoryboard } = require("../lib/video/v3/storyboardGen");
const [topic, out] = process.argv.slice(2);
generateStoryboard(topic, { log: (m) => process.stderr.write(m + "\n") })
  .then((r) => {
    fs.writeFileSync(out, JSON.stringify(r.storyboard, null, 1));
    console.log(JSON.stringify({ ok: true, out, attempts: r.attempts.length }));
  })
  .catch((e) => {
    if (e.last) fs.writeFileSync(out + ".failed.json", JSON.stringify(e.last, null, 1));
    console.error(e.message);
    process.exit(1);
  });
