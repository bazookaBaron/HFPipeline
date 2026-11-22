const fs=require("fs"),path=require("path");
const {synthesizeScene}=require("C:/Repos/HFPipleine/orchestrator/lib/video/voiceSynth");
const dir="C:/Repos/HFPipleine/voice-pipeline/voices/narrator";const prof=JSON.parse(fs.readFileSync(dir+"/profile.json","utf8"));
const brand=JSON.parse(fs.readFileSync("C:/Repos/HFPipleine/orchestrator/brand.json","utf8")).endcard;
synthesizeScene({genText:brand.spoken,outAudio:path.resolve("raw.wav"),outTiming:path.resolve("raw.json"),refAudio:path.join(dir,prof.reference_audio),refText:prof.reference_text,log:()=>{}}).then(r=>console.log(r.durationSeconds.toFixed(2),r.wordCount));
