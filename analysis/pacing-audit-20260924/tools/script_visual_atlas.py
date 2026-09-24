"""Rebuild the sentence/visual alignment from the six immutable evidence pairs.

Run from the repository root: python analysis/pacing-audit-20260924/tools/script_visual_atlas.py
Only SCRIPT_VISUAL_ATLAS.md and SCRIPT_VISUAL_ATLAS.json are written.
"""

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "evidence"
KEYS = [
    "R1_DdEedoQM6j3", "R2_DdG-RuwsDRc", "R3_DdSc-I9IqNC",
    "R4_DdT5wzdsQWV", "R5_DdIM0QoiZre", "OURS",
]
TITLES = [
    "DDoS attack", "Blue-green deployment", "Git worktrees",
    "File upload service", "Palantir ontology", "Hash collision / HashDOS",
]
TIME = re.compile(r"^\s*(\d+(?:\.\d+)?)(?:\s*[–-]\s*(\d+(?:\.\d+)?))?\s*$")


def sentences(key):
    segments = json.loads((EVIDENCE / f"{key}.asr.json").read_text(encoding="utf-8"))
    result, pending = [], []
    for seg_no, segment in enumerate(segments, 1):
        for word in segment["words"]:
            pending.append({"text": word["w"], "start": word["s"], "end": word["e"], "segment": seg_no})
            # Only terminal punctuation in the ASR's timed word stream defines a
            # sentence. Decimal/version dots inside a word cannot be terminals.
            if re.search(r"[.!?][\"'’”)]*$", word["w"]):
                result.append(pending)
                pending = []
    if pending:
        result.append(pending)
    return [
        {
            "id": i, "start": round(words[0]["start"], 3),
            "end": round(words[-1]["end"], 3),
            "text": " ".join(w["text"] for w in words),
            "asr_segments": sorted(set(w["segment"] for w in words)),
            "word_count": len(words),
        }
        for i, words in enumerate(result, 1)
    ], len(segments)


def beats(key):
    path = EVIDENCE / f"{key}.visual_log.md"
    lines = path.read_text(encoding="utf-8").splitlines()
    start = next(i for i, line in enumerate(lines) if re.match(r"## 1\.\s*(?:BEAT|Beat)", line))
    rows, in_table = [], False
    for line_no, line in enumerate(lines[start + 1:], start + 2):
        if not line.startswith("|"):
            if in_table:
                break
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if key == "OURS":
            time_cell, offset = cells[0], 0
        elif key.startswith("R1_"):
            time_cell, offset = cells[0], 0
        else:
            time_cell, offset = cells[1], 1
        match = TIME.fullmatch(time_cell)
        if not match:
            continue
        in_table = True
        t0, t1 = float(match[1]), float(match[2]) if match[2] else None
        if key in ("OURS", "R1_DdEedoQM6j3", "R3_DdSc-I9IqNC"):
            kind = None
            description, region, duration, cue, sync = cells[offset + 1:offset + 6]
            anchor = None
        else:
            kind, description, region, duration, cue, sync = cells[offset + 1:offset + 7]
            anchor = cells[offset + 7] if key.startswith("R5_") and len(cells) > offset + 7 else None
        rows.append({
            "id": len(rows) + 1, "start": t0, "end": t1,
            "kind": kind, "description": description,
            "region": region, "duration": duration,
            "narration_cue": cue, "sync": sync, "anchor_word": anchor,
            "source_line": line_no,
        })
    return rows


def esc(value):
    return str(value).replace("|", "\\|").replace("\n", " ")


def event_md(event, continuing=False):
    times = f"{event['start']:.3f}"
    if event["end"] is not None:
        times += f"–{event['end']:.3f}"
    tag = "continuing from prior sentence; " if continuing else ""
    kind = f"{event['kind']} · " if event["kind"] else ""
    anchor = f"; anchor {event['anchor_word']}" if event["anchor_word"] else ""
    return esc(
        f"{times}s [log line {event['source_line']}]: {tag}{kind}{event['description']} "
        f"[region {event['region']}; motion {event['duration']}; cue {event['narration_cue']}; "
        f"sync {event['sync']}{anchor}]"
    )


def main():
    data = {}
    md = [
        "# Script → visual atlas (2026-09-24)", "",
        "Scope: the five references and the sped-up 70.2 s hash-collision render. This is evidence analysis only; no production change is proposed or made here.", "",
        "## Method and limits", "",
        "- Sentences are split at terminal punctuation in the word-timed Whisper ASR, even when they cross ASR segment boundaries. The displayed range runs from the first to last timed word. Spoken text retains ASR wording and possible recognition errors. `ASR seg` identifies the original utterance segment(s).",
        "- A visual event belongs to the sentence whose spoken-word range contains the event **onset**. An explicitly logged time range that starts earlier and overlaps a sentence is also shown as `continuing`. Events in speech gaps appear in the unassigned-event count and JSON; they are not silently moved to a nearby sentence. There is no invented event for an unlogged interval.",
        "- Each visual entry repeats the log's description, region, measured/estimated motion duration, narration cue, and sync assessment. `log line` is a one-based line number in that video's `visual_log.md`. The motion mechanism is only as specific as the log permits. Caption behavior and persistent chrome logged once are summarized below, not fabricated as per-word events.",
        "- `Sentences with onset` is a coverage measure of this mapping, not a judgment of whether a frame was visually static: content may persist or ambient motion may continue without a new row. Holds, empty frames, cuts and end markers count as timestamped log rows here, not necessarily as motion beats. ASR timings and visual measurements have the precision/uncertainty stated in the source logs.", "",
        "## Source pairs and coverage", "",
        "| Video | ASR evidence | Visual evidence | ASR segments | Sentences | Log rows | Onsets in speech | Onsets in gaps | Sentences with onset |",
        "|---|---|---|---:|---:|---:|---:|---:|---:|",
    ]
    for key, title in zip(KEYS, TITLES):
        ss, segment_count = sentences(key)
        es = beats(key)
        if not es:
            raise ValueError(f"No beat table parsed for {key}")
        assigned = set()
        for s in ss:
            s["visual_event_ids"] = []
            s["continuing_event_ids"] = []
            for e in es:
                if s["start"] <= e["start"] <= s["end"]:
                    s["visual_event_ids"].append(e["id"])
                    assigned.add(e["id"])
                elif e["end"] is not None and e["start"] < s["start"] and e["end"] >= s["start"]:
                    s["continuing_event_ids"].append(e["id"])
        gap_ids = [e["id"] for e in es if e["id"] not in assigned]
        with_onset = sum(bool(s["visual_event_ids"]) for s in ss)
        data[key] = {
            "title": title, "asr_path": f"evidence/{key}.asr.json",
            "visual_log_path": f"evidence/{key}.visual_log.md",
            "asr_segments": segment_count, "sentences": ss,
            "events": es, "unassigned_event_ids": gap_ids,
            "coverage": {"sentences": len(ss), "sentences_with_event_onset": with_onset,
                         "event_rows": len(es), "event_onsets_in_speech": len(assigned),
                         "event_onsets_in_gaps": len(gap_ids)},
        }
        md.append(
            f"| {key} ({title}) | `{key}.asr.json` | `{key}.visual_log.md` | "
            f"{segment_count} | {len(ss)} | {len(es)} | {len(assigned)} | {len(gap_ids)} | {with_onset}/{len(ss)} |"
        )
    md += [
        "", "All source paths in the table are under `analysis/pacing-audit-20260924/evidence/`. The JSON companion contains every source row, including event onsets in speech gaps. R3 has 156 numbered beats plus one timestamped end marker (157 rows here); OURS has 55 timestamped entries including holds/empty frames, versus 37 counted visual beats in `MOTION_PACING_PLAN.md`. These are different denominators, not revised beat measurements.", "",
        "## Continuous visual grammar logged outside the beat tables", "",
        "| Video | Captions and persistent motion documented in the visual log |",
        "|---|---|",
        "| R1 | Near-black cyan-outlined caption box at ~80% height; one active word cyan, chunks mostly 3–4 words with ~33–67 ms swaps. Road traffic flows and counters change during holds; mascot and HUD persist across many content cuts. |",
        "| R2 | One-line dark caption at ~74–80% height; active word blue, 2–5 words per chunk, ~67 ms swaps. The router/BLUE/GREEN scaffold persists through much of the story; mascot mouth flaps and blinks where present. |",
        "| R3 | White caption pill near 76% height; current word red, prior words dark, upcoming grey, ~67 ms chunk swaps. Mascot mouth changes every 1–2 frames during speech; some diagrams type or move cursors. |",
        "| R4 | Packet loops are described in its visual log. Packets continue travelling on connectors through diagram holds; scaffold changes use ~150 ms crossfades. The caption pill and mascot blink are contextual, not reproduced as per-sentence event rows. |",
        "| R5 | Dark dashboard with mascot and caption near 78% height. The source logs chapter/sub-scaffold swaps, labels and node changes as beats; caption and occasional blink are contextual, not separately aligned to every ASR word. |",
        "| OURS | Caption box at ~72–76% height, 2–4 words per chunk, one static blue keyword per chunk. The box briefly disappears between chunks; mascot is static after 0.43 s. A 0.80–5.50 s title hold illustrates that a logged `HOLD` row is not an additional graphic change. |",
        "", "These are persistent or repeated conventions stated by the logs. They should be read alongside the individual event rows, not multiplied into inferred timestamps.", "",
        "## Opening and ending construction", "",
        "| Video | Opening: first spoken move → logged picture | Ending: final spoken move → logged payoff |",
        "|---|---|---|",
        "| R1 | `How a DDoS attack works` 0.00–1.42: mascot/HUD 0.10, title 0.33, browser 0.60; two failed refresh sentences 1.64–5.24 bring a spinner at 2.75 and amber latency at 4.63. | `Traffic jam` 172.60–176.52: road cut 172.88, red cars 173.63, barrier/OFFLINE 174.38, user car 175.00, `THEY BLOCK THE ROAD` 175.75, black 176.25. |",
        "| R2 | `How blue-green deployment works` 0.00–1.44: BLUE/GREEN cards 0.23/0.63. The outage question 1.62–4.86 cuts to browser 1.68 and 503 at 4.30. | `One live, one ready ... switch` 142.90–145.30: one-switch layout 142.13, LIVE/READY headlines 143.00/143.63, connector draws 144.38, black 145.38. |",
        "| R3 | `Git worktrees explained` 0.00–1.02: repo/app/auth cards and bracket build at 0.03–0.63; `two parts` 1.32–3.02 cuts to database/working-tree cards. | `AI agents ... reason to use` 129.06–134.10: terminal cut 129.27, cleanup command types 129.63–130.87, retained-branch result 131.13, final `One repo. Many places to work.` annotation 133.17, end marker 134.53. |",
        "| R4 | `Let's design a file upload service` 0.00–2.54: upload window at 0.00 and MP4 file 0.53; simple path at 4.13 crossfades to upload/backend diagram. | `Server controls who ... without carrying bytes` 163.94–169.16: `API = who + what / S3 = bytes` layout at 162.73, icons 164.73, closing note 167.23. |",
        "| R5 | `What does Palantir actually do?` 0.00–1.68: mascot 0.233, logo 0.600, node links 0.633; public descriptions become sequential chips from 2.00. | `One operating picture` 160.12–164.26: scattered nodes 160.033, teal links draw 161.375, nodes snap into a linked row 163.183, underline 163.283, final title 163.450. |",
        "| OURS | Hook 0.00–4.76: placeholder at 0.00, mascot 0.13–0.43, title 0.67–0.80, then title-only hold 0.80–5.50. | Mailroom analogy 62.64–67.82: only underline 62.60–65.63; takeaway headline 65.63–65.80 arrives during `Stuffing...` and holds through final `Uniform hashing...` 68.38–69.96. |",
        "", "Times are visual-log onsets and ASR spoken ranges. The detailed sentence rows below preserve the precise source wording, including ASR errors.", "",
        "## Storyboard grammar and comparison with ours", "",
        "| Story function | References: spoken move → logged visual mechanism | Ours: analogous spoken move → logged mechanism | Reading |",
        "|---|---|---|---|",
        "| Opening hook | R1 begins with site refresh/failure, building browser/error states before the DDoS explanation; R2 starts BLUE/GREEN cards then cuts to a failed deploy browser; R3 opens with repo + worktree cards; R4 opens on the upload window and file; R5 opens with Palantir logo, then replaces labels with a question box. | `Why does your hash table's O(1) ... crawl at O(N)?` 0.00–5.24: mascot 0.13–0.43, title 0.67–0.80, then a title-only hold to 5.50. | The references put the question or object in a changing causal picture during the hook; ours states the hook while its card remains largely unchanged. |",
        "| Establish model | R1 uses the highway/traffic scaffold; R2 keeps router + BLUE/GREEN cards; R3 decomposes repository/database/working tree across numbered cuts; R4 builds browser→API→Postgres; R5 uses a node/data map with successive labels. | Ideal hash function/array paragraph 6.90–13.13, then problem/solution cards 13.77–19.97. Marker wipes at 9.83 and 10.13; the second leads `fixed array` by ~2.4 s. | Ours often presents explanatory text before its target phrase and has long unchanged intervals; reference model pieces arrive on or near their named words. |",
        "| Mechanism / sequence | R1 moves cars/counters through a shared road; R2 changes traffic percentages and version pills on its persistent router; R3 draws branches and types commands; R4 redraws connectors and moves packets; R5 lights nodes and swaps data sub-states. | Linked-list nodes 21.67–22.10 and edges 22.17–22.50 precede `linked list` at 25.86; stepper fires every 0.5 s at 30.50–32.50. | Our sequence is front-loaded or metronomic, so later spoken steps inherit a completed picture. |",
        "| Escalation / cost | R1 recolors health state and runs request/latency counters; R2 snaps to 503 and later shifts load; R3 uses successive branch/task cards; R4 replaces the diagram with `Big bytes`/capacity callouts; R5 applies stamps, strikes, and state swaps. | O(N) 35.97–36.10 precedes its spoken name at 41.50; attack swarm 43.30–44.40, 100,000 counter 47.27–48.27, CPU gauge 50.43–51.30 then a 3.83 s fixed 100% hold. | Ours has the right causal objects, but several reveal before the claim or finish moving before the explanation ends. |",
        "| Resolution / ending | The reference endings are documented sentence by sentence below; they continue to use state changes, a payoff label, or a final return to the core scaffold near the last claim. | Tree conversion wipe 57.97–58.37; near-empty mailroom analogy 62.60–65.63; takeaway headline 65.63–65.80 then a hold to 70.20. | The mailroom analogy has no logged mailroom visual. The takeaway appears during `Stuffing all mail...`, before its own wording at 68.38. |",
        "", "These function labels are editorial comparisons of the spoken/visual evidence, not classifications supplied by the logs. Cross-topic analogy does not imply that all six videos have identical plot stages.", "",
        "## Per-sentence alignment", "",
    ]
    for key in KEYS:
        item = data[key]
        lookup = {e["id"]: e for e in item["events"]}
        md += [
            f"### {key} — {item['title']}", "",
            f"Evidence: [`{key}.asr.json`](evidence/{key}.asr.json) · [`{key}.visual_log.md`](evidence/{key}.visual_log.md). "
            f"{item['coverage']['sentences_with_event_onset']}/{item['coverage']['sentences']} sentences have a logged event onset during speech; "
            f"{item['coverage']['event_onsets_in_gaps']} event onsets fall between timed sentences.", "",
            "| # / ASR seg | Spoken range and text | Logged visual events (time, mechanism, region, motion, cue) |",
            "|---|---|---|",
        ]
        for s in item["sentences"]:
            events = [event_md(lookup[i]) for i in s["visual_event_ids"]]
            events += [event_md(lookup[i], True) for i in s["continuing_event_ids"]]
            visual = "<br>".join(events) if events else "No new event onset logged in spoken range."
            segs = ",".join(map(str, s["asr_segments"]))
            md.append(f"| {s['id']} / {segs} | {s['start']:.3f}–{s['end']:.3f}s · {esc(s['text'])} | {visual} |")
        md += ["", "Event onsets between timed sentences (IDs and timestamps): " + (
            ", ".join(f"{i}@{lookup[i]['start']:.3f}s" for i in item["unassigned_event_ids"])
            if item["unassigned_event_ids"] else "none") + ".", ""]
    (ROOT / "SCRIPT_VISUAL_ATLAS.json").write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "SCRIPT_VISUAL_ATLAS.md").write_text("\n".join(md), encoding="utf-8")
    print("Wrote atlas with", sum(len(x["sentences"]) for x in data.values()), "sentences and", sum(len(x["events"]) for x in data.values()), "visual rows")
    for key in KEYS:
        print(key, data[key]["coverage"])


if __name__ == "__main__":
    main()
