// node runtime/lf_outro.js <themeId> <out.mp4> [--prep]
// Reusable long-form "like & subscribe" outro (1920x1080, 30 fps, ~11.5 s).
// Injects the theme + words into runtime/lf-outro, renders it with hyperframes, mixes the voice with a soft CC-BY music bed
// (-21 dB, 1.5 s fade out, loudnorm -14 LUFS) and muxes AAC 48k (mono, like the long-form masters, so ffmpeg concat works).
// --prep only writes the support files (theme/verbs/puppet/fonts/inject.js) so `check` / strays.js can run on the dir.
const fs = require("fs"), path = require("path"), cp = require("child_process");
const R = __dirname, D = path.join(R, "lf-outro"), A = path.join(R, "assets", "lf-outro");
const args = process.argv.slice(2), prep = args.includes("--prep"), pos = args.filter((a) => !a.startsWith("--"));
const themeId = pos[0] || "tomato", outMp4 = path.resolve(pos[1] || path.join(D, "outro.mp4"));
const Theme = require(path.join(R, "theme.js"));
const th = Theme.get(themeId);
const words = JSON.parse(fs.readFileSync(path.join(A, "words.json"), "utf8"));
const voice = path.join(A, "vo", "voice.wav");
const voiceDur = parseFloat(cp.execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${voice}"`).toString());
const DUR = +(voiceDur + 1.4).toFixed(2);
for (const f of ["theme.js", "verbs.js", "puppet.js"]) fs.copyFileSync(path.join(R, f), path.join(D, f));
fs.mkdirSync(path.join(D, "fonts"), { recursive: true });
for (const f of ["anton-latin-400-normal.woff2", "inter-latin-500-normal.woff2", "inter-latin-800-normal.woff2", "JetBrainsMono-Bold.woff2"]) fs.copyFileSync(path.join(R, "assets", "fonts", f), path.join(D, "fonts", f));
const w = words.map((x) => ({ w: x.w, s: +x.s.toFixed(3), e: +x.e.toFixed(3), line: x.line }));
fs.writeFileSync(path.join(D, "inject.js"), `window.THEME=${JSON.stringify(th)};window.WORDS=${JSON.stringify(w)};window.DUR=${DUR};\n`);
let html = fs.readFileSync(path.join(D, "index.html"), "utf8").replace(/data-duration="[\d.]+"/, `data-duration="${DUR}"`);
fs.writeFileSync(path.join(D, "index.html"), html);
console.log("prepared", themeId, "DUR", DUR);
if (prep) process.exit(0);

const sh = (c, o) => cp.execSync(c, Object.assign({ stdio: ["ignore", "inherit", "inherit"] }, o));
const vid = path.join(D, "outro-video.mp4");
sh(`npx --yes hyperframes@0.8.46 render -o "${vid}"`, { cwd: D });

// music bed: calm CC-BY track from the shared library
const lib = path.join(R, "..", "video-engine", "assets", "music-lib");
const idx = JSON.parse(fs.readFileSync(path.join(lib, "index.json"), "utf8"));
const tr = idx.tracks.find((t) => t.file === "calm/Wallpaper.mp3") || idx.tracks.find((t) => t.kind === "music" && t.licensed);
const music = path.join(lib, tr.file), start = tr.entry || 0;
fs.writeFileSync(path.join(path.dirname(outMp4), "outro-credits.txt"), tr.credit + "\n");
const fc = `[0:a]apad=whole_dur=${DUR},atrim=0:${DUR}[v];[1:a]volume=-21dB,afade=t=in:d=0.5,afade=t=out:st=${(DUR - 1.5).toFixed(2)}:d=1.5,atrim=0:${DUR}[m];` +
  `[v][m]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,aformat=channel_layouts=mono[a]`;
sh(`ffmpeg -y -v error -i "${voice}" -ss ${start} -i "${music}" -i "${vid}" -filter_complex "${fc}" -map 2:v -map "[a]" -c:v copy -c:a aac -b:a 205k -ar 48000 -ac 1 -t ${DUR} -movflags +faststart "${outMp4}"`);
fs.unlinkSync(vid);
console.log("wrote", outMp4);
