"""python -m ugc <command> --help   (run from ugc-pipeline/; nothing rents a machine except `pilot` and `batch`, and both ask first)"""
from __future__ import annotations
import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from .contract import ROOT, Project, env, load_config, write_atomic


def project(name: str) -> Project:
    p = Project(ROOT / "projects" / name)
    if not p.path.exists():
        sys.exit(f"no project '{name}'. Create it with: python -m ugc init {name}")
    return p


def ask(text: str) -> bool:
    """Only a typed yes rents a machine. No flag and no environment variable bypasses this."""
    print(text)
    if not sys.stdin.isatty():
        print("not an interactive terminal: refusing to rent")
        return False
    return input("Type 'rent' to continue: ").strip() == "rent"


def missing_inputs(p: Project, cfg: dict) -> list[str]:
    from .script import planner
    out = [f"missing {p.path / f}" for f in ("brief.json", "reels.jsonl", "cast/sheet.png", "voice/ref.wav") if not (p.path / f).exists()]
    if not out:
        out = planner.validate(p.reels(), p.brief(), cfg)
    return out


def clips_of(p: Project) -> list:
    return [c for r in p.reels() for c in r.clips]


def judge_for(p: Project, cfg: dict):
    from .checks import gates
    return lambda clip, take: gates.judge(p, cfg, clip, take)


def keep_awake() -> None:
    """A sleeping Mac drops the tunnel and the dead-man switch then ends the run."""
    if sys.platform == "darwin":
        subprocess.Popen(["caffeinate", "-i", "-w", str(os.getpid())])


def best_offer(vast, cfg: dict, interruptible: bool):
    from .compute import pick
    offers = vast.search(cfg, interruptible)
    good = pick.choose(offers, cfg)
    if not good:
        why = sorted(set(pick.rejections(offers, cfg).values()))[:6]
        print(f"no machine passes the rules right now ({len(offers)} seen): " + "; ".join(why))
        return None
    return good[0]


def rent_and(p: Project, cfg: dict, offer, pilot: bool, work, confirm=ask, vast=None, take_seconds=None, session_kw=None) -> int:
    """Rent `offer`, run work(comfy, tick), and always give the machine back (Session guarantees it)."""
    from .compute import session
    from .generate import comfy as comfy_mod, queue
    try:
        with session.Session(vast, p, cfg, confirm, offer=offer, interruptible=offer.interruptible, pilot=pilot,
                             take_seconds=take_seconds, **(session_kw or {})) as s:
            keep_awake()
            return work(comfy_mod.Comfy(s.url), s.tick)
    except session.Declined as e:
        print(e)
        return 5
    except session.BudgetStop as e:
        print(f"stopped by the budget guard: {e}. Finished takes are saved.")
        return 2
    except queue.InfraStop as e:
        print(f"the machine failed: {e}")
        return 4
    except session.Interrupted as e:
        print(f"the machine was lost: {e}. Finished takes are saved; run the same command to continue.")
        return 3
    except session.DestroyFailed as e:
        print(f"\n*** {e}\n*** CHECK https://cloud.vast.ai/instances/ NOW, then run: python -m ugc reap {p.path.name}")
        return 9
    except session.ComputeError as e:
        print(f"could not run: {e}")
        return 1


def ready(p: Project, cfg: dict) -> bool:
    bad = missing_inputs(p, cfg)
    if bad:
        print(f"not ready to rent, {len(bad)} problems:\n  " + "\n  ".join(bad[:20]))
    return not bad


def cmd_pilot(p: Project, cfg: dict, interruptible: bool, vast=None, confirm=ask, session_kw=None, judge=None) -> int:
    from .compute import api
    from .generate import pilot
    if not ready(p, cfg):
        return 1
    vast = vast or api.Vast(env("VAST_API_KEY"))
    offer = best_offer(vast, cfg, interruptible)
    if offer is None:
        return 1
    mfile = p.path / "pilot_machine.json"
    if mfile.exists() and json.loads(mfile.read_text())["gpu"] != offer.gpu:
        print(f"the pilot so far ran on a {json.loads(mfile.read_text())['gpu']}, but the best machine now is a {offer.gpu}; move pilot.json and pilot_machine.json away to measure afresh")
        return 1

    def work(comfy, tick):
        write_atomic(p.p("pilot_machine.json"), json.dumps({"gpu": offer.gpu, "dlperf": offer.dlperf}))
        m = pilot.run(p, cfg, comfy, judge or judge_for(p, cfg), tick)
        print(json.dumps(m, indent=1))
        print(f"now watch {p.path / 'pilot'} and, if you like it: python -m ugc approve-pilot {p.path.name}")
        return 0 if m else 1
    return rent_and(p, cfg, offer, True, work, confirm, vast, None, session_kw)


def measured_for(p: Project, offer) -> dict[str, float]:
    """Pilot seconds per tier, rescaled (and padded 15%) when the machine is not the one the pilot ran on."""
    data = json.loads((p.path / "pilot.json").read_text())
    # an unfinished tier has no time, and a tier whose clips all failed is not worth buying
    m = {k: v["seconds"] for k, v in data.items() if v.get("seconds") and v.get("passed")}
    f = p.path / "pilot_machine.json"
    was = json.loads(f.read_text()) if f.exists() else None
    if was and was["gpu"] != offer.gpu:
        k = 1.15 * was["dlperf"] / offer.dlperf
        print(f"note: the pilot ran on a {was['gpu']}; times are rescaled x{k:.2f} for a {offer.gpu}")
        m = {t: s * k for t, s in m.items()}
    return m


def cmd_batch(p: Project, cfg: dict, interruptible: bool, tier_id: str | None, vast=None, confirm=ask, session_kw=None, judge=None) -> int:
    from .compute import api, budget, ledger
    from .generate import queue
    if not (p.path / "pilot.json").exists():
        print("run the pilot first: the batch needs measured seconds per take")
        return 1
    if not (p.path / "pilot.approved").exists():
        print(f"watch the pilot clips in {p.path / 'pilot'}, then approve with: python -m ugc approve-pilot {p.path.name}")
        return 1
    if not ready(p, cfg):
        return 1
    vast = vast or api.Vast(env("VAST_API_KEY"))
    offer = best_offer(vast, cfg, interruptible)
    if offer is None:
        return 1
    measured = measured_for(p, offer)
    if not measured:
        print("no quality level has both a measured time and a clip that passed the checks; look at pilot.json")
        return 1
    spent = ledger.Ledger(p.p("ledger.jsonl")).spent(time.time())
    # only real takes count: the pilot judges clips under the same names
    tried: dict[str, int] = {}
    passed = set()
    for t in p.takes():
        tried[t.clip] = tried.get(t.clip, 0) + 1
        if (k := p.check(t.clip, t.take)) and k.passed:
            passed.add(t.clip)
    ids = [c.id for c in clips_of(p)]
    spent_out = [i for i in ids if i not in passed and tried.get(i, 0) >= cfg["takes"]["max_per_clip"]]
    todo = len(ids) - len(passed & set(ids)) - len(spent_out)
    if spent_out:
        print(f"{len(spent_out)} clips used all {cfg['takes']['max_per_clip']} takes without passing: {', '.join(spent_out)}. Review them, or change their text to try again.")
    if not todo:
        print("nothing left to generate")
        return 0
    real = {"download_usd": offer.download_usd, "storage_per_h": offer.storage_per_h(cfg["compute"]["disk_gb"])}
    if tier_id:
        tier = next((t for t in cfg["tiers"] if t.id == tier_id), None)
        if tier is None or tier.id not in measured:
            print(f"quality level {tier_id} does not exist or was not measured (have: {', '.join(measured)})")
            return 1
    else:
        tier = budget.best_tier(measured, todo, offer.dph, cfg, spent, interruptible, **real)
    if tier is None:
        print(f"no measured quality level fits ${cfg['budget']['cap_usd']:.2f} at ${offer.dph:.3f}/h with ${spent:.2f} spent. Try --interruptible or fewer reels.")
        return 1
    pr = budget.project(measured[tier.id], todo, offer.dph, cfg, spent, interruptible, **real)
    print(f"quality {tier.id}: {tier.width}x{tier.height}, {tier.steps} steps; {todo} clips to make; about {pr.hours:.1f} h and ${pr.usd:.2f} more, ${spent:.2f} already spent")
    if not pr.fits:
        print("that does not fit the cap")
        return 1

    def work(comfy, tick):
        res = queue.run(p, cfg, tier, comfy, judge or judge_for(p, cfg), tick)
        print(f"passed {len(res['passed'])}, failed {len(res['failed'])}, unjudged {len(res['unjudged'])}, average {res['seconds']:.0f} s a take")
        return 0
    return rent_and(p, cfg, offer, False, work, confirm, vast, measured[tier.id], session_kw)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="ugc", description=__doc__)
    sub = ap.add_subparsers(dest="cmd", required=True)

    def add(name, help_, proj=True):
        q = sub.add_parser(name, help=help_)
        if proj:
            q.add_argument("project")
        return q
    add("init", "create a project from the example brief")
    q = add("template", "print the writing instructions for the reels"); q.add_argument("-n", type=int, default=30)
    q = add("import", "load reels written from the template"); q.add_argument("file", type=Path)
    add("validate", "list every problem in the reels")
    q = add("prompt", "print the H3 prompt of one clip"); q.add_argument("clip")
    q = add("offers", "live Vast.ai offers that pass every rule (no key needed)", proj=False); q.add_argument("--interruptible", action="store_true")
    q = add("cost", "project the cost from a seconds-per-take figure", proj=False)
    q.add_argument("--seconds", type=float, required=True); q.add_argument("--dph", type=float, required=True); q.add_argument("--reels", type=int, default=30); q.add_argument("--interruptible", action="store_true")
    q = add("pilot", "RENTS: measure speed and quality per tier"); q.add_argument("--interruptible", action="store_true")
    add("approve-pilot", "record that a person watched and approved the pilot clips")
    q = add("batch", "RENTS: generate every clip"); q.add_argument("--interruptible", action="store_true"); q.add_argument("--tier")
    add("reap", "destroy any machine of ours that is still alive")
    add("check", "re-run the quality gates on all takes"); add("select", "pick the best take per clip")
    q = add("edit", "cut the finished reels"); q.add_argument("--reel"); q.add_argument("--allow", default="", help="comma separated clip ids a person approved despite failing a gate")
    add("status", "what exists, what is missing, what was spent")
    a = ap.parse_args(argv)
    cfg = load_config()

    if a.cmd == "init":
        dst = ROOT / "projects" / a.project
        if dst.exists():
            sys.exit(f"{dst} already exists")
        (dst / "cast").mkdir(parents=True)
        for d in ("voice", "broll", "takes"):
            (dst / d).mkdir()
        shutil.copy(ROOT / "projects/example/brief.json", dst / "brief.json")
        print(f"{dst}\n1. edit brief.json  2. add cast/sheet.png and voice/ref.wav  3. python -m ugc template {a.project}")
        return 0
    if a.cmd == "offers":
        from .compute import api, pick
        offers = api.Vast("").search(cfg, a.interruptible)
        good = pick.choose(offers, cfg)
        for o in good[:10]:
            print(o.summary())
        if not good:
            for r in sorted(set(pick.rejections(offers, cfg).values()))[:15]:
                print(r)
        print(f"{len(good)} of {len(offers)} offers pass")
        return 0
    if a.cmd == "cost":
        from .compute import budget
        r = budget.project(a.seconds, a.reels * cfg["reel"]["ai_clips"], a.dph, cfg, 0.0, a.interruptible)
        print(f"{r.hours:.1f} h, ${r.usd:.2f}, {'fits' if r.fits else 'DOES NOT FIT'} ${cfg['budget']['cap_usd']:.2f}")
        return 0

    p = project(a.project)
    if a.cmd == "template":
        from .script import planner
        print(planner.template(p.brief(), cfg, a.n))
    elif a.cmd == "import":
        from .script import planner
        reels = planner.parse(a.file.read_text(encoding="utf8"), cfg)
        bad = planner.validate(reels, p.brief(), cfg)
        p.save_reels(reels)
        print(f"{len(reels)} reels saved" + (f"; {len(bad)} problems:\n  " + "\n  ".join(bad[:40]) if bad else ", no problems"))
        return 1 if bad else 0
    elif a.cmd == "validate":
        from .script import planner
        bad = planner.validate(p.reels(), p.brief(), cfg)
        print("\n".join(bad) or "no problems")
        return 1 if bad else 0
    elif a.cmd == "prompt":
        from .script import prompt
        clip = next((c for c in clips_of(p) if c.id == a.clip), None)
        if clip is None:
            sys.exit(f"no clip {a.clip}")
        print(prompt.render(clip, p.brief(), cfg))
    elif a.cmd == "pilot":
        return cmd_pilot(p, cfg, a.interruptible)
    elif a.cmd == "approve-pilot":
        if not (p.path / "pilot.json").exists():
            sys.exit("there is no pilot to approve")
        write_atomic(p.p("pilot.approved"), time.strftime("%Y-%m-%dT%H:%M:%S\n"))
        print("approved")
    elif a.cmd == "batch":
        return cmd_batch(p, cfg, a.interruptible, a.tier)
    elif a.cmd == "reap":
        from .compute import api, session
        print("destroyed:", session.reap(api.Vast(env("VAST_API_KEY")), p, ask) or "nothing to destroy")
    elif a.cmd == "check":
        from .checks import gates
        by = {c.id: c for c in clips_of(p)}
        for t in p.takes():
            c = gates.judge(p, cfg, by[t.clip], t)
            print(f"{t.clip} t{t.take} {'pass' if c.passed else 'FAIL ' + ', '.join(k for k, g in c.gates.items() if not g['pass'])}")
    elif a.cmd == "select":
        from .checks import gates
        s = gates.select(p)
        print(f"{sum(v['passed'] for v in s.values())} of {len(s)} clips have a passing take")
    elif a.cmd == "edit":
        from .edit import assemble, audit
        allow, rc = frozenset(x for x in a.allow.split(",") if x), 0
        for r in p.reels():
            if a.reel and r.id != a.reel:
                continue
            try:
                f = assemble.reel(p, cfg, r, allow=allow)
                bad = audit.final(f, cfg)
                print(f"{r.id} {'ok' if not bad else 'PROBLEMS: ' + '; '.join(bad)} {f}")
                rc |= bool(bad)
            except (ValueError, RuntimeError, FileNotFoundError, KeyError) as e:
                print(f"{r.id} not cut: {e}")
                rc = 1
        return int(rc)
    elif a.cmd == "status":
        from .compute import ledger
        L = ledger.Ledger(p.p("ledger.jsonl"))
        has = lambda f: "yes" if (p.path / f).exists() else "MISSING"
        print(f"brief {has('brief.json')}, reels {has('reels.jsonl')}, sheet {has('cast/sheet.png')}, voice {has('voice/ref.wav')}, pilot {has('pilot.json')}, approved {has('pilot.approved')}")
        print(f"takes {len(p.takes())}, selected {len(p.selects())}, finished {len(list((p.path / 'final').glob('*.mp4'))) if (p.path / 'final').exists() else 0}")
        print(f"spent ${L.spent(time.time()):.2f} of ${cfg['budget']['cap_usd']:.2f}; open machines: {L.open_ids() or 'none'}")
    return 0
