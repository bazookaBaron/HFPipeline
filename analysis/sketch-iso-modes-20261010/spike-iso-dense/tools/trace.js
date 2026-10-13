const fs=require('fs'),path=require('path'),vm=require('vm');const D=path.join(__dirname,'..');
const ctx={console,performance:{now:()=>0},queueMicrotask,Math,Float32Array,Float64Array,Uint8Array,Int32Array};ctx.window=ctx;vm.createContext(ctx);
['vendor/hl-geom.js','world-kit.js','worlds.js'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(D,f),'utf8').replace(/^var HLG/m,'window.HLG'),ctx));
const ids=process.argv[2].split(',').map(Number);
ctx.WORLDS.city(20261010,{blocksX:5,blocksY:4,cars:84,buses:4,dur:+(process.argv[3]||1),heroBlock:9,park:16,trace:ids});
