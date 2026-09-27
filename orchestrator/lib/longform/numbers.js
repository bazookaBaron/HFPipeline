"use strict";

/**
 * Spoken-number parsing and the dossier number gate.
 *
 * Long-form narration spells numbers out for TTS ("nine thousand crore", "forty percent",
 * "twenty twelve"). parseSpokenNumbers() turns every number phrase in a sentence into a value;
 * numberGate() checks each against the dossier: a fact value (after its scale word), a fact /
 * timeline year, or a declared calculation over fact values (`calc`, verified here, never trusted).
 */

const UNITS = {
  zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES = {
  thousand: 1e3, thousands: 1e3, lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, crore: 1e7, crores: 1e7,
  million: 1e6, millions: 1e6, billion: 1e9, billions: 1e9, trillion: 1e12, trillions: 1e12,
};
const ORDINALS = new Set([
  "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth",
  "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth",
  "eighteenth", "nineteenth", "twentieth", "thirtieth", "fortieth", "fiftieth", "sixtieth",
  "seventieth", "eightieth", "ninetieth", "hundredth", "thousandth", "millionth", "billionth",
]);
const FRACTIONS = { half: 0.5, quarter: 0.25 };
const MONTHS = new Set(["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december", "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec"]);

/** Scale word -> multiplier, used both for spoken phrases and for fact units ("INR crore"). */
function unitScale(unit) {
  // product of the scale words present: "INR lakh crore" -> 1e12, "USD billion" -> 1e9
  const u = String(unit || "").toLowerCase();
  let s = 1;
  if (/\btrillions?\b|\btn\b/.test(u)) s *= 1e12;
  if (/\bbillions?\b|\bbn\b/.test(u)) s *= 1e9;
  if (/\bcrores?\b|\bcr\b/.test(u)) s *= 1e7;
  if (/\bmillions?\b|\bmn\b/.test(u)) s *= 1e6;
  if (/\blakhs?\b|\blacs?\b/.test(u)) s *= 1e5;
  if (/\bthousands?\b/.test(u)) s *= 1e3;
  return s;
}
const isPercentUnit = (unit) => /%|percent|per cent|pct/i.test(String(unit || ""));

function tokenize(text) {
  // keep sentence punctuation as boundary tokens: "in twenty twelve, nine banks" is two numbers
  return String(text || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/(\d),(?=\d)/g, "$1") // 9,000 -> 9000
    .replace(/(\d)\s*%/g, "$1 percent")
    .replace(/-/g, " ")
    .match(/\d+(?:\.\d+)?|[a-z]+|[^\sa-z\d]/g) || [];
}

const isNumWord = (w) => w in UNITS || w in TENS || w === "hundred" || w === "hundreds" || w in SCALES;

/**
 * Parse all number phrases. Returns [{text, value, percent, year, scaled, ordinal, digits, start, end}].
 * value is absolute (scale applied): "nine thousand crore" -> 9e10.
 */
function parseSpokenNumbers(text) {
  const toks = tokenize(text);
  const out = [];
  let i = 0;
  while (i < toks.length) {
    const w = toks[i];
    const startsWithA = (w === "a" || w === "an") && (toks[i + 1] === "hundred" || toks[i + 1] in SCALES) && !/s$/.test(toks[i + 1]);
    const isDigit = /^\d/.test(w);
    // "oh" only counts inside a year ("nineteen oh five")
    if (!(isDigit || startsWithA || (isNumWord(w) && w !== "oh"))) { i++; continue; }
    const start = i;
    let total = 0, current = 0, maxScale = 1, sawScale = false, any = false, yearHigh = null, lastKind = null;
    let digits = false, decimal = null, plural = false;
    if (startsWithA) { current = 1; any = true; i++; lastKind = "unit"; }
    for (; i < toks.length; i++) {
      const t = toks[i];
      if (/^\d/.test(t)) {
        if (any) break;
        current = parseFloat(t); any = true; digits = true; lastKind = "digit";
        continue;
      }
      if (t in UNITS || t in TENS) {
        const v = t in UNITS ? UNITS[t] : TENS[t];
        if (lastKind === "digit") break;
        if (t === "oh") {
          if (yearHigh !== null || sawScale || current < 10 || current >= 100) break;
          yearHigh = current; current = 0; lastKind = "oh"; continue;
        }
        if (lastKind === "oh") { if (v > 9) break; current = v; lastKind = "unit"; continue; }
        if (decimal !== null) { if (v > 9) break; decimal += String(v); continue; }
        if (lastKind === "tens" && t in UNITS && v < 10 && current % 10 === 0) { current += v; lastKind = "unit"; continue; }
        if ((lastKind === "tens" || lastKind === "unit" || lastKind === "teen") && !sawScale && yearHigh === null && current >= 10 && current < 100) {
          // "nineteen ninety one", "twenty twelve", "twenty twenty four": a year
          yearHigh = current; current = v; lastKind = t in TENS ? "tens" : v >= 10 ? "teen" : "unit"; continue;
        }
        if (lastKind === "unit" || lastKind === "teen" || (lastKind === "tens" && !(t in UNITS && v < 10))) break; // "two three" = two numbers
        current += v; any = true;
        lastKind = t in TENS ? "tens" : v >= 10 ? "teen" : "unit";
        continue;
      }
      if (t === "hundred" || t === "hundreds") {
        if (t === "hundreds" && !any) { plural = true; any = true; current = 100; lastKind = "scale"; i++; break; }
        current = (current || 1) * 100; any = true; lastKind = "hundred"; continue;
      }
      if (t in SCALES) {
        const s = SCALES[t];
        if (/s$/.test(t) && !any) { plural = true; any = true; current = s; lastKind = "scale"; i++; break; }
        if (decimal !== null) { current = parseFloat(`${current}.${decimal}`); decimal = null; }
        const base = current || (total ? 0 : 1);
        if (s > maxScale) { total = (total + base) * s; maxScale = s; }
        else total += base * s;
        current = 0; sawScale = true; any = true; lastKind = "scale"; continue;
      }
      if (t === "point" && any && decimal === null && (toks[i + 1] in UNITS)) { decimal = ""; continue; }
      if (t === "." && digits && /^\d/.test(toks[i + 1] || "")) { current = parseFloat(`${current}.${toks[i + 1]}`); i++; continue; }
      if (t === "and" && any && (toks[i + 1] === "a" || toks[i + 1] === "an") && toks[i + 2] in FRACTIONS) {
        current += FRACTIONS[toks[i + 2]]; i += 2; continue;
      }
      if (t === "and" && any && !digits && (toks[i + 1] in UNITS || toks[i + 1] in TENS) && (lastKind === "hundred" || lastKind === "scale")) continue;
      break;
    }
    if (!any) { i = start + 1; continue; }
    if (decimal !== null && decimal !== "") current = parseFloat(`${current}.${decimal}`);
    let value = yearHigh !== null ? yearHigh * 100 + current : total + current;
    let end = i;
    // trailing scale in digits form: "9000 crore"
    let percent = false, ordinal = false;
    const nxt = toks[end], nxt2 = toks[end + 1];
    if (nxt === "percent" || nxt === "pc") { percent = true; end += 1; }
    else if (nxt === "per" && nxt2 === "cent") { percent = true; end += 2; }
    else if (nxt && ORDINALS.has(nxt)) ordinal = true;
    else if (nxt && /^(st|nd|rd|th)$/.test(nxt)) ordinal = true;
    const year = !percent && !plural && maxScale <= 1e3 && Number.isInteger(value) && value >= 1900 && value <= 2100;
    // "October twenty, twenty twelve": a day of the month, not a figure
    const date = !percent && !sawScale && Number.isInteger(value) && value >= 1 && value <= 31 && MONTHS.has(toks[start - 1]);
    out.push({
      text: toks.slice(start, end).join(" "), value, percent, year, yearForm: yearHigh !== null,
      scaled: sawScale, plural, ordinal, date, digits, start, end,
    });
    i = Math.max(end, start + 1);
  }
  return out;
}

/** A spoken number that needs no dossier backing: small counting words, ordinals, vague plurals. */
function isExempt(n) {
  if (n.ordinal || n.plural || n.date) return true;
  if (!n.percent && !n.scaled && !n.year && Number.isInteger(n.value) && n.value <= 10) return true;
  return false;
}

// ---------- calc: arithmetic over fact values, verified deterministically ----------

/** Evaluate "F3 / F7 * 100" with fact values (absolute, scale applied). Only + - * / ( ) numbers and fact ids. */
function evalCalc(expr, factValues) {
  const src = String(expr || "");
  const toks = src.match(/[A-Za-z][A-Za-z0-9_-]*|\d+(?:\.\d+)?|[()+\-*/]|\S/g) || [];
  let p = 0;
  const peek = () => toks[p];
  function atom() {
    const t = toks[p++];
    if (t === undefined) throw new Error("unexpected end");
    if (t === "(") { const v = add(); if (toks[p++] !== ")") throw new Error("missing )"); return v; }
    if (t === "-") return -atom();
    if (/^\d/.test(t)) return parseFloat(t);
    if (/^[A-Za-z]/.test(t)) {
      if (!(t in factValues)) throw new Error(`unknown fact ${t}`);
      return factValues[t];
    }
    throw new Error(`bad token ${t}`);
  }
  function mul() { let v = atom(); while (peek() === "*" || peek() === "/") { const op = toks[p++]; const r = atom(); v = op === "*" ? v * r : v / r; } return v; }
  function add() { let v = mul(); while (peek() === "+" || peek() === "-") { const op = toks[p++]; const r = mul(); v = op === "+" ? v + r : v - r; } return v; }
  const v = add();
  if (p !== toks.length) throw new Error(`trailing token ${toks[p]}`);
  if (!Number.isFinite(v)) throw new Error("not finite");
  return v;
}

/** Spoken value vs a reference: 6 % relative, or equal to the reference rounded to 1-2 significant figures. */
function close(spoken, ref) {
  if (!Number.isFinite(spoken) || !Number.isFinite(ref)) return false;
  if (spoken === ref) return true;
  if (ref === 0) return Math.abs(spoken) < 1e-9;
  if (Math.abs(spoken - ref) / Math.abs(ref) <= 0.06) return true;
  for (const sig of [1, 2]) {
    const mag = 10 ** (Math.floor(Math.log10(Math.abs(ref))) - sig + 1);
    if (Math.round(ref / mag) * mag === spoken) return true;
  }
  return false;
}

/** Candidate absolute values a fact may be spoken as. */
function factCandidates(f) {
  const v = Number(f.value);
  if (!Number.isFinite(v)) return claimNumbers(f).map((n) => n.value);
  const s = unitScale(f.unit);
  const c = [v * s, ...claimNumbers(f).map((n) => n.value)];
  if (s !== 1) c.push(v); // "nine thousand" said while the screen says crore: still the same figure
  return c;
}

/** Secondary figures stated in the fact's own sourced claim ("EBITDA of Rs 140 crore against interest of Rs 1,313 crore"). */
function claimNumbers(f) {
  return parseSpokenNumbers(f.claim || "").filter((n) => !n.year && !n.ordinal && !isExempt(n));
}

/**
 * Check one sentence. calc: [{expr, result}] declared by the writer; the result is recomputed
 * here and only a correct calc licenses its number.
 * Returns {problems: string[], factIds: string[], numbers: [...]}.
 */
function checkSentenceNumbers(sentence, dossier) {
  const facts = (dossier && dossier.facts) || [];
  const years = new Set();
  facts.forEach((f) => {
    if (f.year) years.add(Number(String(f.year).slice(0, 4)));
    parseSpokenNumbers(f.claim || "").filter((n) => n.year).forEach((n) => years.add(n.value));
  });
  ((dossier && dossier.timeline) || []).forEach((t) => { if (t.year) years.add(Number(String(t.year).slice(0, 4))); });
  const factValues = {};
  facts.forEach((f) => { if (Number.isFinite(Number(f.value))) factValues[f.id] = Number(f.value) * unitScale(f.unit); });

  const problems = [];
  const factIds = new Set();
  const licensed = [];
  const figureHits = [];
  for (const c of sentence.calc || []) {
    try {
      const v = evalCalc(c.expr, factValues);
      (String(c.expr).match(/[A-Za-z][A-Za-z0-9_-]*/g) || []).forEach((id) => factIds.add(id));
      licensed.push(v, Math.abs(v));
      // the writer's own `result` is informational only: the spoken number must match the recomputed value
    } catch (err) {
      problems.push(`calc "${c.expr}" is invalid (${err.message})`);
    }
  }
  const cited = new Set(sentence.factIds || []);
  const nums = parseSpokenNumbers(sentence.text);
  for (const n of nums) {
    if (n.digits) problems.push(`"${n.text}" is written in digits; spell numbers out as words for the voice`);
    if (isExempt(n)) continue;
    let hit = null;
    if (n.year && years.has(n.value)) { hit = "year"; facts.filter((f) => Number(String(f.year).slice(0, 4)) === n.value).slice(0, 1).forEach((f) => factIds.add(f.id)); }
    // "less than one percent" / "over two hundred percent": a bound is licensed by a fact on the right side of it
    const bound = numberBound(sentence.text, n);
    const within = (c) => (bound === "below" ? Math.abs(c) < n.value : bound === "above" ? Math.abs(c) > n.value : close(n.value, c));
    const fits = (f) => (!n.percent || isPercentUnit(f.unit) || /ratio|share|rate|growth/i.test(f.unit || "") || /%|percent/i.test(f.claim || "")) &&
      factCandidates(f).some(within);
    if (!hit) {
      const f = facts.find((x) => cited.has(x.id) && fits(x));
      if (f) {
        hit = f.id;
        factIds.add(f.id);
        scopeProblems(sentence.text, f, n).forEach((x) => problems.push(x));
        figureHits.push({ n, f });
      }
    }
    if (!hit && licensed.some((v) => close(n.value, v))) hit = "calc";
    if (!hit) {
      // a match on a fact the sentence does not cite is often a coincidence ("sixty percent" of a different fact)
      const f = facts.find(fits);
      if (f) { problems.push(`"${n.text}" matches ${f.id} ("${String(f.claim).slice(0, 60)}"), which this sentence does not cite; cite it in factIds if that is the figure meant, or derive the number with calc`); continue; }
    }
    if (!hit) problems.push(`"${n.text}" (${fmt(n.value)}${n.percent ? "%" : ""}) matches no dossier fact, year or verified calc`);
  }
  // one figure + one year in a sentence: the year must be the figure's own year (a 2025 value is not "in 2023")
  // (only when the year clearly dates the figure: right after it, or a leading "In/By <year>,")
  const yearNums = nums.filter((x) => x.year);
  if (figureHits.length === 1 && yearNums.length === 1 && figureHits[0].f.year && Number(figureHits[0].f.year) !== yearNums[0].value) {
    const { n, f } = figureHits[0];
    const t = String(sentence.text).toLowerCase();
    const fi = t.indexOf(n.text.split(" ")[0]), yi = t.indexOf(yearNums[0].text.split(" ")[0], fi + 1);
    const after = fi >= 0 && yi > fi && t.slice(fi, yi).split(/\s+/).length <= n.text.split(" ").length + 4;
    const leading = new RegExp(`^(?:in|by|since|back in)\\s+${yearNums[0].text.replace(/[-\s]+/g, "[-\\s]+")}\\s*,`, "i").test(String(sentence.text).trim());
    if (after || leading) problems.push(`"${n.text}" is ${f.id}'s ${f.year} value but the sentence dates it ${yearNums[0].value}; say the fact's own year`);
  }
  return { problems, factIds: [...factIds], numbers: nums };
}

/**
 * Scope qualifiers that change what a figure measures. When the fact's claim carries one, a sentence that says the
 * figure must carry it too: "US debt held by the public: 31 trillion" said as "US debt: 31 trillion" is a different,
 * wrong number (gross debt was ~36 trillion). Each entry: [claim pattern, accepted wordings in the sentence, label].
 */
const SCOPES = [
  [/\bheld by the public\b|\bpublic(?:ly held)? debt\b/i, /\bpublic\b|\binvestors\b|\bmarkets?\b/i, "held by the public"],
  [/\bnet\b/i, /\bnet\b|\bafter\b|\bminus\b/i, "net"],
  [/\bper (?:capita|person|head)\b/i, /\bper (?:capita|person|head)\b|\beach (?:person|citizen)\b|\bfor every (?:person|citizen)\b|\bthe average (?:person|citizen)\b/i, "per person"],
  [/\bper working[- ]age\b/i, /\bper (?:working|worker)|\bworking[- ]age\b|\bfor every worker\b|\beach worker\b|\bper adult\b|\bworking adult\b/i, "per working-age adult"],
  [/\bhousehold\b/i, /\bhouseholds?\b|\bfamil(?:y|ies)\b|\bhomes?\b/i, "household"],
  [/\bcore\b/i, /\bcore\b|\bexcluding\b|\bwithout (?:food|fuel|energy)\b/i, "core"],
];
/** "less than / under / below / not even X" -> "below"; "more than / over / above X" -> "above"; else null. */
function numberBound(text, n) {
  const t = String(text || "").toLowerCase().replace(/[-–]/g, " ");
  const at = t.indexOf(String(n.text).toLowerCase().replace(/[-–]/g, " ").split(" ")[0]);
  if (at < 0) return null;
  const before = t.slice(Math.max(0, at - 20), at);
  if (/(?:less than|fewer than|under|below|not even|barely)\s+(?:a |an |about )?$/.test(before)) return "below";
  if (/(?:more than|over|above|upwards of)\s+(?:a |an |about )?$/.test(before)) return "above";
  return null;
}

function scopeProblems(text, f, n) {
  return SCOPES.filter(([inClaim, said]) => inClaim.test(f.claim || "") && !said.test(text))
    .map(([, , label]) => `"${n.text}" is ${f.id}'s figure for "${label}" (${String(f.claim).slice(0, 70)}); say that scope or the listener hears a different number`);
}

function fmt(v) {
  if (Math.abs(v) >= 1e7) return v.toExponential(3);
  return String(Math.round(v * 1000) / 1000);
}

module.exports = { claimNumbers, parseSpokenNumbers, isExempt, unitScale, evalCalc, close, checkSentenceNumbers, tokenize, scopeProblems, numberBound, SCOPES };
