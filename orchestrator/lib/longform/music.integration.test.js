"use strict";

// Real library path end to end on synthetic tracks (tools/make_test_music.py): index with librosa,
// plan, mix with switching (sfx_mix.py --music-plan). Takes ~3 min (librosa JIT + analysis), so it runs only
// with MUSIC_IT=1 (and librosa installed): MUSIC_IT=1 node --test lib/longform/music.integration.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const MP = require("./musicPlan");

const PY = process.env.SFX_PYTHON || "python";
const TOOLS = path.join(__dirname, "..", "..", "tools");
const hasLibrosa = !!process.env.MUSIC_IT && spawnSync(PY, ["-c", "import librosa"], { encoding: "utf-8" }).status === 0;
const run = (args) => {
  const r = spawnSync(PY, args, { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout.trim().split(/\r?\n/).pop());
};

test("synthetic library: index -> plan -> switching mix", { skip: (!process.env.MUSIC_IT && "set MUSIC_IT=1 to run (~3 min)") || (!hasLibrosa && "librosa not installed"), timeout: 600000 }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "music-lib-"));
  try {
    const lib = path.join(dir, "lib");
    run([path.join(TOOLS, "make_test_music.py"), lib]);
    const s1 = run([path.join(TOOLS, "music_index.py"), "--lib", lib]);
    assert.equal(s1.tracks, 7);
    assert.equal(s1.analysed, 7);
    assert.deepEqual(s1.errors, []);
    const s2 = run([path.join(TOOLS, "music_index.py"), "--lib", lib]);
    assert.equal(s2.analysed, 0, "incremental: nothing re-analysed");

    const ix = MP.loadIndex(lib);
    assert.equal(ix.tracks.length, 6);
    assert.equal(ix.sfx.length, 1);
    assert.equal(ix.sfx[0].credit, 'Music: "Sub drop" by HFPipeline test synth (synthetic), test-only');
    const ten = ix.tracks.find((t) => t.id === "tension/synthetic-tension-a.wav");
    assert.ok(Math.abs(ten.bpm - 100) < 2, `bpm ${ten.bpm}`);
    // bars are 2.4 s from 0: every downbeat sits on the bar grid (within 80 ms)
    for (const d of ten.downbeats) assert.ok(Math.min(d % 2.4, 2.4 - (d % 2.4)) < 0.08, `downbeat ${d}`);
    assert.ok(ten.entry >= 4.7, "entry skips the quiet 2-bar intro");
    assert.ok(ten.loop && ten.loop.end - ten.loop.start >= 9.5);
    const tr = MP.pickTrailer(ix);
    assert.equal(tr.track.id, "trailer/synthetic-trailer-a.wav");
    assert.ok(tr.track.montageOk);

    // 2 chapters, 50 s each; voice = speech-like bursts
    const plan = MP.planMusic({ index: ix, chapters: [{ id: "cold", start: 0, duration: 50 }, { id: "ch1", start: 50, duration: 50 }], tags: { cold: { mood: "tension", energy: 4 }, ch1: { mood: "calm", energy: 2 } }, videoId: "it" });
    assert.deepEqual(plan.transitions, [50]);
    assert.deepEqual(plan.segments.map((s) => s.track.id), ["tension/synthetic-tension-a.wav", "calm/synthetic-calm-a.wav"]);
    const planFile = path.join(dir, "plan.json");
    fs.writeFileSync(planFile, JSON.stringify(plan));
    const voice = path.join(dir, "voice.wav");
    const mix = path.join(dir, "mix.wav");
    const stem = path.join(dir, "bed.wav");
    const cues = path.join(dir, "cues.json");
    fs.writeFileSync(cues, JSON.stringify({ cues: [] }));
    const mk = spawnSync(PY, ["-c", `
import numpy as np, wave
sr=48000; n=100*sr; t=np.arange(n)/sr
x=0.2*np.sin(2*np.pi*180*t)*(np.sin(2*np.pi*1.7*t)>-0.2)
w=wave.open(r"${voice}","wb"); w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
w.writeframes((np.stack([x,x],1)*32767).astype("<i2").tobytes()); w.close()`], { encoding: "utf-8" });
    assert.equal(mk.status, 0, mk.stderr);
    const st = run([path.join(TOOLS, "sfx_mix.py"), cues, voice, mix, "--music-plan", planFile, "--duration", "100", "--music-stem", stem]);
    assert.equal(st.music, "plan");
    assert.equal(st.segments.length, 2);
    assert.ok(st.segments[0].loops >= 1, "a 50 s section loops the 40 s track");
    // bass drop-out: the bed's <150 Hz energy in the last 0.6 s before the switch is far below 3 s earlier
    const lb = run(["-c", `
import numpy as np, wave, json
w=wave.open(r"${stem}","rb"); sr=w.getframerate(); x=np.frombuffer(w.readframes(w.getnframes()),"<i2").astype(float).reshape(-1,2).mean(1); w.close()
def low(a,b):
    s=x[int(a*sr):int(b*sr)]; X=np.fft.rfft(s); f=np.fft.rfftfreq(len(s),1/sr); X[f>150]=0
    return float(10*np.log10(np.mean(np.fft.irfft(X,len(s))**2)+1e-12))
print(json.dumps({"before": low(46,47.2), "end": low(49.4,50), "after": low(50.3,51.5), "n": len(x)/sr}))`]);
    assert.ok(Math.abs(lb.n - 100) < 0.01);
    assert.ok(lb.end < lb.before - 15, `low band ${lb.before.toFixed(1)} -> ${lb.end.toFixed(1)} dB`);
    assert.ok(lb.after > lb.end + 10, "the new bed brings the low end back on the cut");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
