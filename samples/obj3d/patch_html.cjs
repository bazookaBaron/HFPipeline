const fs = require('fs');
let h = fs.readFileSync('suez.html', 'utf8');
const rep = (a, b) => { if (!h.includes(a)) console.log('MISSING', a.slice(0, 80)); h = h.split(a).join(b); };
rep('const EGS = 15, RY0 = 0.82;', 'const EGS = 15, RY0 = 0.95;');
rep('EXC.position.set(5.7, BANK, -7.1); EXC.rotation.y = -1.9;', 'EXC.position.set(5.0, BANK, -8.3); EXC.rotation.y = -1.97;');
rep('NUMW.position.set(-9, BANK, 15); NUMW.rotation.y = Math.PI;', 'NUMW.position.set(7, BANK, -24); NUMW.rotation.y = 0;');
rep('NUMW.visible = t < 28;', 'NUMW.visible = t < 27;');
rep('n2.position.set(TIME_O.x + 62, 0.6, TIME_O.z - 18); n2.rotation.y = Math.PI;', 'n2.position.set(TIME_O.x + 3, 0.6, TIME_O.z + 26); n2.rotation.y = 0;');
rep('new THREE.BoxGeometry(160, 1.0, 120), WHITE); fl.position.set(TIME_O.x + 28, 0.1, TIME_O.z - 20)', 'new THREE.BoxGeometry(160, 1.0, 90), new THREE.MeshStandardMaterial({ color: 0xc9c7c2, roughness: 0.9 })); fl.position.set(TIME_O.x + 13.5, 0.1, TIME_O.z + 2.5)');
rep('new THREE.BoxGeometry(4, o.hs.y * 2, 4)); m.position.copy(o.c); m.visible = false; gT.add(m); proxy(m, "time", new THREE.Vector3(2.35, o.hs.y + 0.35, 2.35));', 'new THREE.BoxGeometry(2, o.hs.y * 2, 2)); m.position.copy(o.c); m.visible = false; gT.add(m); proxy(m, "time", new THREE.Vector3(1.4, o.hs.y + 0.35, 1.4));');
rep('proxy(m, "board", new THREE.Vector3(o.hs.x + 0.3, o.hs.y + 0.3, 0.7))', 'proxy(m, "board", new THREE.Vector3(o.hs.x + 0.3, o.hs.y + 0.3, 0.7))');
// tilt-shift per region
rep('fy: { value: 0.5 }, amt: { value: 4 } }', 'fy: { value: 0.5 }, amt: { value: 4 }, b0: { value: 0.1 }, b1: { value: 0.42 } }');
rep('uniform float fy, amt;', 'uniform float fy, amt, b0, b1;');
rep('smoothstep(0.10, 0.42, abs(vUv.y-fy))', 'smoothstep(b0, b1, abs(vUv.y-fy))');
rep('tx.uniforms.amt.value = ty.uniforms.amt.value = 3.5 - 2.5 * top;', 'const AMT = { world: 2.8, map: 1.5, time: 2.0, board: 0.6 }[reg], B0 = { world: 0.14, map: 0.22, time: 0.2, board: 0.3 }[reg]; tx.uniforms.amt.value = ty.uniforms.amt.value = AMT * (1 - 0.7 * top); tx.uniforms.b0.value = ty.uniforms.b0.value = B0; tx.uniforms.b1.value = ty.uniforms.b1.value = B0 + 0.34;');
rep('sunOff.z = reg === "time" ? -18 : 18; ', '');
rep('const RUNS = [[0, 8, "world"], [8, 15, "map"], [15, 27.6, "world"], [27.6, 36, "time"], [36, 44, "board"], [44, 60, "world"]];', 'const RUNS = [[0, 8, "world"], [8, 15, "map"], [15, 26.6, "world"], [26.6, 37, "time"], [37, 44, "board"], [44, 60, "world"]];');
rep('(tt > 26.9 && tt < 27.7)', '(tt > 25.8 && tt < 26.7)');
rep('if (reg === "world" && tt > 26.9 && tt < 27.7) continue;', 'if (reg === "world" && tt > 25.8 && tt < 26.7) continue;');
rep('!(reg === "world" && t > 26.9 && t < 27.7) && !(reg === "time" && t < 28.9)', '!(reg === "world" && t > 25.8 && t < 26.7) && !(reg === "time" && t < 28.0)');
rep('texts, figs', 'texts, figs');
// camera segment block
const a = h.indexOf('// 1 WORLD establishing'), b = h.indexOf('SEGS.forEach((s, i) => { if (s.ride');
const blk = fs.readFileSync('cam_block.js', 'utf8');
h = h.slice(0, a) + blk + h.slice(b);
// gates
rep('window.renderAt = t =>', fs.readFileSync('gates_block.js', 'utf8') + '\nwindow.renderAt = t =>');
rep('return { maxFig: +m.toFixed(3),', 'const spd = camStats(), bg = boardGate(); return { speed: spd, board: bg, maxFig: +m.toFixed(3),');
fs.writeFileSync('suez.html', h);
let t = fs.readFileSync('timeline_part.js', 'utf8');
t = t.replace('28.4 + 0.9 * i', '28.2 + 0.85 * i').replace('textPlane(ctx, String(TL.days[i]), 2.0, 1.2,', 'textPlane(ctx, String(TL.days[i]), 2.0, 1.3,').replace('textPlane(ctx, "0", 1.8, 0.95,', 'textPlane(ctx, "0", 1.8, 1.3,').replace('PL + Math.max(0.6, h * rc) - 0.75', 'PL + Math.max(0.9, h * rc) - 0.85').replace('lab.position.set(x, 0.75, 2.31)', 'lab.position.set(x, 0.75, 2.31)');
fs.writeFileSync('timeline_part.js', t);
