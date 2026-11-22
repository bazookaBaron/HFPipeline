// _mgtest: the whole episode MG is one call. beats.json is the data list (episodes/<ep>/mg.beats.json in a real episode).
import { addBeats } from '../../mg/templates.js';
export const DATA = {}, CHECKS = [];
const beats = await (await fetch(new URL('./beats.json', import.meta.url))).json();
export default function addCues(mg, ctx = {}) { const r = addBeats(mg, beats, { ...ctx, episode: '_mgtest' }); Object.assign(DATA, r.data); CHECKS.push(...r.checks); window.__tplWarnings = r.warnings; }
