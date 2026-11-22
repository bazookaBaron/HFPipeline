// Helper for voice.py: synthesise lines (JSON [{text,wav,json}]) with the narrator clone.
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
const { synthesizeScene } = require(path.join(ROOT, "orchestrator/lib/video/voiceSynth"));
const vdir = path.join(ROOT, "voice-pipeline/voices/narrator");
const prof = JSON.parse(fs.readFileSync(path.join(vdir, "profile.json"), "utf8"));
const jobs = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
(async () => {
  for (const j of jobs) {
    const r = await synthesizeScene({ genText: j.text, outAudio: path.resolve(j.wav), outTiming: path.resolve(j.json),
      refAudio: path.join(vdir, prof.reference_audio), refText: prof.reference_text, log: () => {} });
    console.log("synth", r.durationSeconds.toFixed(2) + "s", r.wordCount + "w", j.text.slice(0, 50));
  }
})().catch(e => { console.error(e); process.exit(1); });
