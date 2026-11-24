"""Timeline solver: decides, in whole frames, where every clip, cutaway and the end card sit so the reel is exactly `seconds` long.

Layout (time runs left to right)
    [slot 1][tail 1][slot 2][tail 2]...[slot n][tail n][end card]
    slot  = one AI clip trimmed to [first word - handle, last word + handle], retimed by `speed`.
    tail  = part of a cutaway that runs past the end of the clip's voice, over room tone.
    A cutaway after clip k also covers the last `cover` frames of slot k (the voice keeps going under the picture).
    A cutaway "after clip 0" opens the reel over the first words of clip 1 (no tail: a silent open loses the viewer).

One elasticity parameter lam moves the soft quantities in stages; total length is non-decreasing in lam, so bisection finds the lam
whose total is `seconds`:
    lam -2..-1 : b-roll tails shrink x0.4 -> 0 (b-roll lives entirely over the voice)
    lam -1..0  : handles 0.15->0.25 s, speed 1+smax -> 1, end card 2.0->2.5 s, tails x0.4 -> x1
    lam  0..1  : handles ->0.60 s, speed -> 1-smax (slower), end card -> 3.0 s, tails -> x2 (never past the footage: no looping)
    lam  1..2  : tails grow to the cutaway's full `seconds`, and to 2x that only if the footage is long enough
    lam  2..3  : handles grow to the whole source clip (first 0.15 s and last 0.10 s excluded), about 3/4 of the growth at the tail end
    lam  3..4  : text cards (cutaways with no footage) grow from 0 to 3.0 s each, evenly, at most one after each clip but the last
    lam  4..5  : end card -> 4.0 s
Only real footage ever covers the presenter's voice. A cutaway with no usable footage is a text card: it sits in the silence after a
clip (cover 0), is dropped if it would open the reel or follow the last clip, and is never longer than 3.0 s. If everything is still
short, TimelineError says to add b-roll or a fourth clip. Over-fill raises TimelineError with the seconds over.
Boundaries are rounded to frames (cumulative rounding, so the sum is exact) and speeds are recomputed and verified within 5%.
A word is never cut: the source window always contains [first word start, last word end].
"""
from __future__ import annotations
from dataclasses import dataclass, field

from .errors import TimelineError

FPS = 30            # default only; callers pass cfg["reel"]["fps"]
H_MIN, H_NOM, H_MAX = 0.15, 0.25, 0.60
END_MIN, END_NOM, END_MAX, END_EXT = 2.0, 2.5, 3.0, 4.0
SPEED_LIMIT = 0.05
HEAD_SKIP, TAIL_SKIP = 0.15, 0.10
LAM_MIN, LAM_MAX = -2.0, 5.0
CARD_MAX = 3.0


class UnderfillError(TimelineError):
    def __init__(self, msg: str, deficit: float):
        super().__init__(msg)
        self.deficit = deficit


@dataclass(frozen=True)
class Span:
    clip: str
    length: float     # source clip duration, seconds
    first: float      # start of the first word, seconds from clip start
    last: float       # end of the last word


@dataclass(frozen=True)
class Cut:
    after: int        # 0 = opens the reel; k = after clip k (1-based)
    seconds: float
    avail: float | None = None   # footage length, None when unlimited (text card, still image)
    auto: bool = False           # added by the solver as a text card
    card: bool = False           # no usable footage: a short text card, never over the voice


@dataclass
class Slot:
    clip: str
    a: float          # source window start
    b: float          # source window end
    speed: float
    start: int        # first frame on the reel timeline
    frames: int
    h_in: float
    h_out: float
    cover_head: int = 0   # frames of the slot start hidden by the opening cutaway
    cover_tail: int = 0   # frames of the slot end hidden by the cutaway that follows


@dataclass
class CutPlan:
    after: int
    start: int        # first frame of the cutaway picture
    frames: int
    cover: int        # frames that sit over the presenter's voice
    tail: int         # frames beyond the voice, over room tone
    auto: bool = False
    card: bool = False


@dataclass
class Plan:
    reel: str
    fps: int
    total: int
    slots: list[Slot]
    cuts: list[CutPlan]
    end_start: int
    end_frames: int
    lam: float = 0.0
    auto: list[int] = field(default_factory=list)   # positions of text cards the solver added
    dropped: list[int] = field(default_factory=list)  # footage-less cutaways that were not placed


def _lerp(nom: float, lo: float, hi: float, lam: float) -> float:
    return nom + lam * ((nom - lo) if lam < 0 else (hi - nom))


def _speech(sp: Span) -> float:
    return sp.last - sp.first


def _cut_shape(spans: list[Span], cut: Cut) -> tuple[float, float]:
    """(cover seconds in output time before handles, nominal tail seconds)."""
    if cut.after == 0:
        return min(cut.seconds, 0.45 * _speech(spans[0])), 0.0
    cover = min(0.5 * cut.seconds, 0.4 * _speech(spans[cut.after - 1]), 3.0)
    return cover, max(0.0, cut.seconds - cover)


def _tail(spans, c: Cut, lam: float) -> float:
    if c.card:
        return CARD_MAX * max(0.0, min(lam - 3, 1.0))
    cover, nom = _cut_shape(spans, c)
    if c.after == 0 or nom <= 0:
        return 0.0
    if lam <= -1:
        f = 0.4 * (lam - LAM_MIN)
    elif lam <= 0:
        f = 1 + 0.6 * lam
    else:
        f = 1 + min(lam, 1.0)
    t = nom * f
    if lam > 1:
        ta = 2 * c.seconds if (c.avail is not None and c.avail >= 2 * c.seconds) else max(2 * nom, c.seconds)
        t = 2 * nom + (max(ta, 2 * nom) - 2 * nom) * min(lam - 1, 1.0)
    if c.avail is not None:
        t = min(t, max(nom, c.avail - cover))          # no looping past the footage
    return t


def _at(spans: list[Span], cuts: list[Cut], lam: float, smax: float):
    s1 = max(-1.0, min(lam, 1.0))
    h = _lerp(H_NOM, H_MIN, H_MAX, s1)
    speed = 1.0 - smax * s1
    sb = max(0.0, min(lam - 2, 1.0))
    slots = []
    for sp in spans:
        h_in = min(h, max(sp.first, 0.0))
        h_out = min(h, max(sp.length - sp.last, 0.0))
        if sb > 0:
            h0_in, h0_out = min(H_MAX, max(sp.first, 0.0)), min(H_MAX, max(sp.length - sp.last, 0.0))
            av_in, av_out = max(h0_in, sp.first - HEAD_SKIP), max(h0_out, sp.length - TAIL_SKIP - sp.last)
            e_in, e_out = av_in - h0_in, av_out - h0_out
            tot = e_in + e_out
            head = min(e_in, max(0.25 * tot, tot - e_out))
            h_in, h_out = h0_in + head * sb, h0_out + (tot - head) * sb
        src = _speech(sp) + h_in + h_out
        slots.append((sp.first - h_in, sp.first - h_in + src, h_in, h_out, src / speed))
    tails = {c.after: _tail(spans, c, lam) for c in cuts}
    end = _lerp(END_NOM, END_MIN, END_MAX, s1) + max(0.0, min(lam - 4, 1.0)) * (END_EXT - END_MAX)
    return slots, tails, end, speed


def _total(spans, cuts, lam, smax) -> float:
    slots, tails, end, _ = _at(spans, cuts, lam, smax)
    return sum(s[4] for s in slots) + sum(tails.values()) + end


def plan(reel: str, spans: list[Span], cuts: list[Cut], seconds: float, fps: int = FPS) -> Plan:
    n = len(spans)
    kept, dropped = [], []
    for c in cuts:
        if c.seconds <= 0:
            continue
        if c.card and (c.after == 0 or c.after >= n):
            dropped.append(c.after)
        else:
            kept.append(c)
    have = {c.after for c in kept}
    kept += [Cut(k, CARD_MAX, None, True, True) for k in range(1, n) if k not in have]   # fillers, 0 s unless the reel needs them
    p = _plan(reel, spans, kept, seconds, fps)
    p.auto = [c.after for c in p.cuts if c.auto]
    p.dropped = dropped
    return p


def _plan(reel: str, spans: list[Span], cuts: list[Cut], seconds: float, fps: int) -> Plan:
    if not spans:
        raise TimelineError(f"reel {reel}: no clips to place")
    for sp in spans:
        if not (0 <= sp.first < sp.last <= sp.length + 1e-6):
            raise TimelineError(f"reel {reel}: clip {sp.clip} has word times {sp.first:.2f}-{sp.last:.2f} s outside its {sp.length:.2f} s length")
    cuts = [c for c in cuts if c.seconds > 0]
    for c in cuts:
        if not 0 <= c.after <= len(spans):
            raise TimelineError(f"reel {reel}: a cutaway is after clip {c.after} but the reel has {len(spans)} clips")
    if len({c.after for c in cuts}) != len(cuts):
        raise TimelineError(f"reel {reel}: two cutaways share the same position; merge them in reels.jsonl")

    shortest = min((_speech(s) + 2 * H_MIN) / (1 + SPEED_LIMIT) for s in spans)
    smax = SPEED_LIMIT - 1.2 / fps / shortest
    if smax <= 0:
        raise TimelineError(f"reel {reel}: the shortest clip slot is {shortest:.2f} s, too short to retime within 5%; use longer speech")
    smax = min(smax, SPEED_LIMIT - 0.002)

    lo, hi = _total(spans, cuts, LAM_MIN, smax), _total(spans, cuts, LAM_MAX, smax)
    if seconds > hi + 1e-9:
        raise UnderfillError(f"reel {reel}: {seconds - hi:.1f} s under: the longest layout is {hi:.1f} s but the reel must be {seconds:g} s. "
                             f"Add b-roll or a fourth clip.", seconds - hi)
    if seconds < lo - 1e-9:
        raise TimelineError(f"reel {reel}: {lo - seconds:.1f} s over: the shortest layout is {lo:.1f} s but the reel must be {seconds:g} s. "
                            f"Shorten b-roll or the script.")
    a, b = LAM_MIN, LAM_MAX
    for _ in range(80):
        m = (a + b) / 2
        if _total(spans, cuts, m, smax) < seconds:
            a = m
        else:
            b = m
    lam = (a + b) / 2
    slots_f, tails_f, end_f, _ = _at(spans, cuts, lam, smax)

    order: list[tuple[str, int, float]] = []
    for i, s in enumerate(slots_f, start=1):
        order.append(("slot", i, s[4]))
        if i in tails_f:
            order.append(("tail", i, tails_f[i]))
    order.append(("end", 0, end_f))
    total = round(seconds * fps)
    bounds, acc = [0], 0.0
    for _, _, d in order:
        acc += d
        bounds.append(round(acc * fps))
    bounds[-1] = total
    frames = {(k, i): bounds[j + 1] - bounds[j] for j, (k, i, _) in enumerate(order)}
    starts = {(k, i): bounds[j] for j, (k, i, _) in enumerate(order)}

    out_slots: list[Slot] = []
    for i, (sp, s) in enumerate(zip(spans, slots_f), start=1):
        n = frames[("slot", i)]
        speed = (s[1] - s[0]) / (n / fps)
        if not (1 - SPEED_LIMIT - 1e-9 <= speed <= 1 + SPEED_LIMIT + 1e-9):
            raise TimelineError(f"reel {reel}: clip {sp.clip} would be retimed {speed:.3f}x after frame rounding; this is a planner bug")
        out_slots.append(Slot(sp.clip, s[0], s[1], speed, starts[("slot", i)], n, s[2], s[3]))

    out_cuts: list[CutPlan] = []
    for c in sorted(cuts, key=lambda c: c.after):
        if c.card:
            sl = out_slots[c.after - 1]
            tail = frames[("tail", c.after)]
            if tail > 0:
                out_cuts.append(CutPlan(c.after, sl.start + sl.frames, tail, 0, tail, c.auto, True))
            continue
        cover_s, _ = _cut_shape(spans, c)
        if c.after == 0:
            sl = out_slots[0]
            cover = min(round((cover_s + min(sl.h_in, H_NOM) / sl.speed) * fps), sl.frames - fps // 2)
            sl.cover_head = max(cover, 1)
            out_cuts.append(CutPlan(0, 0, sl.cover_head, sl.cover_head, 0, c.auto))
        else:
            sl = out_slots[c.after - 1]
            tail = frames[("tail", c.after)]
            cover = max(1, min(round((cover_s + min(sl.h_out, H_NOM) / sl.speed) * fps), sl.frames - fps // 2))
            sl.cover_tail = cover
            out_cuts.append(CutPlan(c.after, sl.start + sl.frames - cover, cover + tail, cover, tail, c.auto))
    for sl in out_slots:
        room = sl.frames - fps // 2          # the presenter keeps at least half a second
        if sl.cover_head + sl.cover_tail > room:
            k = room / (sl.cover_head + sl.cover_tail)
            sl.cover_head, sl.cover_tail = int(sl.cover_head * k), int(sl.cover_tail * k)
    for cp in out_cuts:
        if cp.card:
            continue
        sl = out_slots[max(cp.after, 1) - 1]
        cp.cover = sl.cover_head if cp.after == 0 else sl.cover_tail
        if cp.after:
            cp.start = sl.start + sl.frames - cp.cover
        cp.frames = cp.cover + cp.tail
    return Plan(reel, fps, total, out_slots, out_cuts, starts[("end", 0)], frames[("end", 0)], lam)
