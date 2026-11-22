// gps episode MG: whole episode = one addBeats call (mg/templates.js). beats.json = template list (global episode seconds, 1.5x track).
import { addBeats } from '../../mg/templates.js';
export const DATA = {}, CHECKS = [];
const beats = await (await fetch(new URL('./beats.json', import.meta.url))).json();
export default function addCues(mg, ctx = {}) { const r = addBeats(mg, beats, { ...ctx, episode: 'gps' }); Object.assign(DATA, r.data); CHECKS.push(...r.checks); window.__tplWarnings = r.warnings; }
