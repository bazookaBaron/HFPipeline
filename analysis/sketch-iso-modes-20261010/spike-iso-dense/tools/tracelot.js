const fs=require('fs'),path=require('path'),vm=require('vm');const D=path.join(__dirname,'..');
const ctx={console,performance:{now:()=>0},queueMicrotask,Math,Float32Array,Float64Array,Uint8Array,Int32Array};ctx.window=ctx;vm.createContext(ctx);
['vendor/hl-geom.js','world-kit.js','worlds.js'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(D,f),'utf8').replace(/^var HLG/m,'window.HLG'),ctx));
ctx.WORLDS.parking(7,{dur:+(process.argv[2]||12),cars:58,buses:1,heroAt:-7,debug:1,traceLot:process.argv[3]?0:1,trace:process.argv[3]?process.argv[3].split(",").map(Number):null});
