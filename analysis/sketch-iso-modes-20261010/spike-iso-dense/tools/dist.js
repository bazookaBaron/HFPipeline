const fs=require('fs'),path=require('path'),vm=require('vm');const D=path.join(__dirname,'..');
const ctx={console,performance:{now:()=>0},queueMicrotask,Math,Float32Array,Float64Array,Uint8Array,Int32Array};ctx.window=ctx;vm.createContext(ctx);
['vendor/hl-geom.js','world-kit.js','worlds.js'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(D,f),'utf8').replace(/^var HLG/m,'window.HLG'),ctx));
const w=ctx.WORLDS.parking(7,{dur:1,cars:5,buses:0,heroAt:2.5});
const E=w.net.edges, d=w.net.dist; const inf=E.filter(e=>!isFinite(d[e.id]));
const k={}; inf.forEach(e=>k[e.kind]=(k[e.kind]||0)+1); console.log('edges',E.length,'inf',inf.length,k);
inf.filter(e=>e.kind==='lane').slice(0,8).forEach(e=>console.log(e.id,e.kind,JSON.stringify(e.pts.map(p=>p.map(v=>+v.toFixed(1)))),'next',e.next.map(n=>E[n].kind+n+':'+(isFinite(d[n])?d[n].toFixed(0):'inf')).join(',')));
