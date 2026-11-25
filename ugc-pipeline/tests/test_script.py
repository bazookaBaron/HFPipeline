import copy
import json
import re
import unittest
from dataclasses import asdict
from pathlib import Path

from ugc.contract import Broll, Clip, Line, Reel, load_config
from ugc.script import planner, prompt

CFG = load_config()
BRIEF = json.loads((Path(__file__).parent.parent / "projects" / "example" / "brief.json").read_text(encoding="utf8"))

L1 = "Small kitchens often miss fresh herbs. Pebblenook arrives as a complete kit with seed pods, soil and a small tray, ready for your counter."
L2 = "The tray fits on a standard windowsill, so you can place it near the light and keep your worktop tidy."
L3 = "Setup takes about ten minutes, and a printed guide for beginners comes in the box. Find Pebblenook at the link in the description."


def clip(rid: str, i: int, text: str, action: str = "holds up one open palm", **kw) -> Clip:
    return Clip(id=f"{rid}c{i}", reel=rid, index=i, lines=[Line(text, "warmly")], action=action,
                framing=kw.get("framing", "close selfie framing, head and shoulders"), room=kw.get("room", "a bright kitchen with a window"), seed=100 + i)


def good(rid: str = "r01", hook: str = "Small kitchens often miss fresh herbs.") -> Reel:
    l1 = L1.replace("Small kitchens often miss fresh herbs.", hook)
    return Reel(id=rid, title="Herbs on the counter", hook=hook, cta="Find Pebblenook at the link in the description.",
                clips=[clip(rid, 1, l1), clip(rid, 2, L2, "points to the window"), clip(rid, 3, L3, "gives a small nod")],
                broll=[Broll(0, 2.0, "", "watering"), Broll(2, 8.0, "", "sprouts")], claims=["c1", "c2", "c3", "c4"])


def problems(reels, brief=BRIEF):
    return planner.validate(reels, brief, CFG)


def has(ps, *needles):
    return any(all(n.lower() in p.lower() for n in needles) for p in ps)


class Valid(unittest.TestCase):
    def test_good_reel_passes(self):
        self.assertEqual(problems([good()]), [])

    def test_good_reels_with_distinct_hooks(self):
        self.assertEqual(problems([good("r01"), good("r02", "Who has an empty windowsill?")]), [])


class Validate(unittest.TestCase):
    def mut(self, fn, reel=None):
        r = reel or good()
        fn(r)
        return problems([r])

    def test_word_counts(self):
        ps = self.mut(lambda r: setattr(r.clips[1].lines[0], "text", "Too short here."))
        self.assertTrue(has(ps, "r01 r01c2", "3 spoken words", "add"))
        ps = self.mut(lambda r: setattr(r.clips[1].lines[0], "text", " ".join(["word"] * 30) + "."))
        self.assertTrue(has(ps, "r01c2", "30 spoken words", "cut"))

    def test_clip_count(self):
        self.assertTrue(has(self.mut(lambda r: r.clips.pop()), "r01", "2 clips", "exactly 3"))

    def test_broll_total(self):
        self.assertTrue(has(self.mut(lambda r: setattr(r.broll[1], "seconds", 3.0)), "B-roll", "5.0 s"))

    def test_unknown_claim(self):
        self.assertTrue(has(self.mut(lambda r: r.claims.append("c99")), "unknown claim", "c99"))

    def test_untraceable_facts(self):
        def f(r):
            r.clips[1].lines[0].text = "The tray fits on a standard windowsill and grows basil in 5 days, so you can place it near the light for a while."
        self.assertTrue(has(self.mut(f), "r01c2", "factual"))
        for text in ("This is the best herb kit for any small kitchen, and it sits on a windowsill beside your favourite mug of tea.",
                     "Most people find that seed pods and soil in a small tray are the easiest way to start growing something tasty at home.",
                     "It costs fifty dollars and arrives as a complete kit with seed pods, soil and a small tray for your counter today."):
            ps = self.mut(lambda r, t=text: setattr(r.clips[1].lines[0], "text", t))
            self.assertTrue(has(ps, "r01c2", "factual"), text)

    def test_claimed_fact_is_traceable(self):
        r = good()
        r.clips[2].lines[0].text = "Setup takes about ten minutes and a printed guide for beginners comes in the box. Find Pebblenook at the link in the description."
        self.assertEqual(problems([r]), [])

    def test_fact_needs_the_claim_to_be_cited(self):
        r = good()
        r.claims = ["c1", "c2", "c4"]
        self.assertTrue(has(problems([r]), "r01c3", "factual"))

    def test_personal_experience(self):
        for phrase in ("I used it every morning", "I've been using it for a while", "It changed my life", "I noticed my skin looking different",
                       "I saved so much time", "Trust me, I tried it", "It worked for me", "My hair loves it", "I switched last spring"):
            def f(r, p=phrase):
                r.clips[1].lines[0].text = f"{p}. The tray fits on a standard windowsill so you can place it near the light and keep your worktop tidy for a bit."
            ps = self.mut(f)
            self.assertTrue(has(ps, "r01c2", "fake testimonial"), phrase)

    def test_you_statements_are_allowed(self):
        r = good()
        r.clips[1].lines[0].text = "You can place the tray on a standard windowsill near the light, and you keep your worktop tidy while the little seeds wake up."
        self.assertEqual(problems([r]), [])

    def test_guarantees(self):
        def f(r):
            r.clips[1].lines[0].text = "This kit is risk-free and will cure boredom, so place the tray on a standard windowsill near the light and keep the worktop tidy."
        self.assertTrue(has(self.mut(f), "medical or financial"))

    def test_forbidden_words(self):
        def f(r):
            r.clips[1].lines[0].text = "A miracle windowsill tray fits on a standard sill, so place it near the light and keep your worktop tidy while the little seeds wake up."
        self.assertTrue(has(self.mut(f), "forbidden word", "miracle"))

    def test_forbidden_matches_whole_words(self):
        r = good()
        r.clips[1].lines[0].text = "The tray fits on a standard windowsill, so place it near the light and keep your worktop tidy while the little seeds wake up, bestowing calm."
        self.assertFalse(has(problems([r]), "forbidden"))

    def test_duplicate_hooks(self):
        ps = problems([good("r01"), good("r02")])
        self.assertTrue(has(ps, "r02", "duplicates", "r01"))
        ps = problems([good("r01"), good("r02", "Small kitchens often miss fresh herbs!")])
        self.assertTrue(has(ps, "r02", "duplicates"))

    def test_two_gestures(self):
        for action in ("waves and then points at the window", "raises a hand; taps the table", "nods twice"):
            self.assertTrue(has(self.mut(lambda r, a=action: setattr(r.clips[0], "action", a)), "r01c1", "more than one gesture"), action)

    def test_onscreen_things(self):
        for kw in ({"action": "holds up a phone screen showing the website"}, {"framing": "a laptop screen in the background"}, {"room": "a kitchen with a logo on the wall"}):
            def f(r, kw=kw):
                for k, v in kw.items():
                    setattr(r.clips[0], k, v)
            self.assertTrue(has(self.mut(f), "r01c1", "on-screen text"), kw)

    def test_minors_and_real_people(self):
        self.assertTrue(has(self.mut(lambda r: setattr(r.clips[0], "room", "a kitchen where a child plays")), "minor"))
        self.assertTrue(has(self.mut(lambda r: setattr(r.clips[0], "framing", "looks like a famous actor")), "real person"))
        b = copy.deepcopy(BRIEF)
        b["presenter"]["description"] = "a 15 year old girl with dark hair"
        self.assertTrue(has(problems([good()], b), "brief presenter", "minor"))
        b["presenter"]["description"] = "a woman named Sarah with dark hair"
        self.assertTrue(has(problems([good()], b), "brief presenter", "named or real"))
        b["presenter"]["description"] = "a woman with smooth glowing skin"
        self.assertTrue(has(problems([good()], b), "skin adjectives"))

    def test_written_out_ages(self):
        for desc in ("a sixteen-year-old with dark hair", "a girl aged fifteen", "a 16yo with dark hair", "a teenager with dark hair", "a schoolgirl in a kitchen"):
            b = copy.deepcopy(BRIEF)
            b["presenter"]["description"] = desc
            self.assertTrue(has(problems([good()], b), "minor"), desc)
        for field, val in (("action", "a seventeen year old waves"), ("room", "a room with a teen"), ("framing", "aged twelve, close selfie")):
            self.assertTrue(has(self.mut(lambda r, f=field, v=val: setattr(r.clips[0], f, v)), "r01c1", "minor"), field)
        def f(r):
            r.clips[1].lines[0].text = "My sixteen-year-old cousin loves it, so place the tray on a standard windowsill near the light and keep your worktop tidy."
        self.assertTrue(has(self.mut(f), "r01c2", "minor"))

    def test_adult_age_is_required(self):
        b = copy.deepcopy(BRIEF)
        b["presenter"]["description"] = "a woman with wavy dark hair"
        self.assertTrue(has(problems([good()], b), "adult age"))
        for ok in ("an adult woman with wavy hair", "a man aged 40 with short hair", "a woman in her late twenties"):
            b["presenter"]["description"] = ok
            self.assertFalse(has(problems([good()], b), "adult age"), ok)

    def test_plain_small_counts_are_not_facts(self):
        for text in ("Follow two steps: place the tray on a standard windowsill near the light, then keep your worktop tidy and wait for green shoots.",
                     "The tray fits on a standard windowsill, so you can place it near the light and keep three small pots tidy on your worktop."):
            ps = self.mut(lambda r, t=text: setattr(r.clips[1].lines[0], "text", t))
            self.assertFalse(has(ps, "factual"), text)
        for text in ("The tray fits on a standard windowsill and works three times better than a pot, so place it near the light and keep it tidy.",
                     "The tray fits on a standard windowsill and the seeds sprout within 3 days, so place it near the light and keep it tidy."):
            ps = self.mut(lambda r, t=text: setattr(r.clips[1].lines[0], "text", t))
            self.assertTrue(has(ps, "factual"), text)

    def test_experience_false_positives(self):
        for phrase in ("My life is busy", "I used to think herbs were hard", "Many people think herbs are hard"):
            def f(r, p=phrase):
                r.clips[1].lines[0].text = f"{p}. The tray fits on a standard windowsill so you can place it near the light and keep your worktop tidy for a bit."
            self.assertFalse(has(self.mut(f), "fake testimonial"), phrase)
        for phrase in ("I used it every day", "I used Pebblenook for weeks", "I've used this kit"):
            def f(r, p=phrase):
                r.clips[1].lines[0].text = f"{p}. The tray fits on a standard windowsill so you can place it near the light and keep your worktop tidy for a bit."
            self.assertTrue(has(self.mut(f), "fake testimonial"), phrase)

    def test_onscreen_words_only_matter_in_scene_fields(self):
        r = good()
        r.clips[1].lines[0].text = "Send me a text if you want the app, and place the tray on a standard windowsill near the light to keep your worktop tidy."
        self.assertFalse(has(problems([r]), "on-screen"))
        r.clips[1].room = "a kitchen with an app open"
        self.assertTrue(has(problems([r]), "r01c2", "on-screen"))

    def test_presenter_name_in_dialogue(self):
        def f(r):
            r.clips[1].lines[0].text = "Hi, my name is Anna, and the tray fits on a standard windowsill so you can place it near the light and keep things tidy."
        self.assertTrue(has(self.mut(f), "personal name"))

    def test_markup_and_endings(self):
        def f(r):
            r.clips[1].lines[0].text = 'The tray "fits" on a <b>standard</b> windowsill, so you can place it near the light and keep your worktop tidy for good'
        ps = self.mut(f)
        self.assertTrue(has(ps, "break the <d> tag"))
        self.assertTrue(has(ps, "does not end with"))

    def test_cta_and_hook_placement(self):
        self.assertTrue(has(self.mut(lambda r: setattr(r, "cta", "")), "cta is empty"))
        self.assertTrue(has(self.mut(lambda r: setattr(r, "cta", "Visit the shop today")), "does not speak the cta"))
        self.assertTrue(has(self.mut(lambda r: setattr(r, "hook", "A hook that is not spoken")), "hook"))


class Parse(unittest.TestCase):
    def lines(self):
        return [json.dumps(asdict(good(f"r0{i}"))) for i in (1, 2)]

    def test_roundtrip_with_fences(self):
        text = "```jsonl\n" + "\n".join(self.lines()) + "\n```\n"
        reels = planner.parse(text, CFG)
        self.assertEqual([r.id for r in reels], ["r01", "r02"])
        self.assertEqual(reels[0].clips[0].lines[0].text, L1)

    def test_bad_line_number(self):
        text = "\n".join([self.lines()[0], "", "{oops", self.lines()[1]])
        with self.assertRaises(ValueError) as cm:
            planner.parse(text, CFG)
        self.assertIn("line 3", str(cm.exception))

    def test_wrong_shape(self):
        with self.assertRaises(ValueError) as cm:
            planner.parse('{"id": "r01"}', CFG)
        self.assertIn("line 1", str(cm.exception))

    def test_template_has_exact_format_and_rules(self):
        t = planner.template(BRIEF, CFG, n=30)
        self.assertIn("30 lines", t)
        self.assertIn("r30", t)
        self.assertIn("18-24 words", t)
        self.assertIn("c3: Setup takes about ten minutes.", t)
        self.assertIn("pebble nook", t)
        first_json = next(l for l in t.splitlines() if l.startswith('{"id"'))
        r = Reel.from_dict(json.loads(first_json))
        self.assertEqual(len(r.clips), 3)


class Prompt(unittest.TestCase):
    def render(self, c=None):
        r = good()
        return prompt.render(c or r.clips[0], BRIEF, CFG)

    def test_field_order_and_lines(self):
        out = self.render().split("\n")
        self.assertEqual([l.split(":")[0] for l in out], ["subject_definitions", "summary", "retention_analysis", "detailed_description", "overall_soundscape", "non_diegetic_music"])
        self.assertEqual(out[-1], "non_diegetic_music: N/A")

    def test_required_phrases(self):
        out = self.render()
        d = next(l for l in out.split("\n") if l.startswith("detailed_description"))
        self.assertTrue(d.startswith("detailed_description: [Shot 1] Create a photorealistic video with an f/16 aperture look and deep depth of field."))
        self.assertEqual(out.count("Facial Realism"), 1)
        for s in ("<Subject 1>", "<Picture 1>", "<Audio 1>", "character sheet", "fully_preserved", "voice timbre only", "(S1) says: <d>[English] ", "9:16", "eye contact"):
            self.assertIn(s, out)
        self.assertLess(len(out), 5000)
        self.assertNotIn("headless", out)
        self.assertNotIn("Beat", out)
        self.assertIsNone(re.search(r"\d\.\d s\)", out))

    def test_dialogue_is_clean_and_respelled(self):
        out = self.render()
        tags = re.findall(r"<d>(.*?)</d>", out)
        self.assertEqual(len(tags), 1)
        self.assertIn("pebble nook", tags[0])
        self.assertTrue(re.fullmatch(r"\[English\] [\w ,.?!']+[.?!]", tags[0]), tags[0])

    def test_markup_is_stripped_from_dialogue(self):
        c = good().clips[0]
        c.lines = [Line('Wait: "this" is <great> - 50% done; really…', "calmly"), Line("Is it?", "")]
        tags = re.findall(r"<d>(.*?)</d>", prompt.render(c, BRIEF, CFG))
        self.assertEqual(tags[0], "[English] Wait, this is great 50 percent done, really.")
        self.assertEqual(tags[1], "[English] Is it?")

    def test_one_gesture_once_and_beats_in_order(self):
        c = good().clips[0]
        c.lines = [Line("First line here.", "warmly"), Line("Second line follows.", "with a small laugh"), Line("Third one ends it!", "")]
        out = self.render(c)
        self.assertEqual(out.count("one gesture, once: holds up one open palm"), 1)
        stamps = re.findall(r"At (\d\d:\d\d\.\d{3}),", out)
        self.assertEqual(len(stamps), 2)
        self.assertEqual(stamps, sorted(stamps))
        self.assertLess(out.index("First line"), out.index(stamps[0]))
        self.assertNotIn("At 00:00", out)
        self.assertIn("with a small laugh, (S1) says: <d>", out)

    def test_positive_phrasing_and_no_skin_words(self):
        out = re.sub(r"<d>.*?</d>", "", self.render())
        self.assertIsNone(re.search(r"\b(no|not|never|without|don't|avoid|cannot)\b", out, re.I), out)
        self.assertIsNone(re.search(planner.SKIN, out, re.I))

    def test_soundscape_is_neutral(self):
        out = self.render()
        self.assertIn("quiet indoor room tone", out)
        sound = next(l for l in out.split("\n") if l.startswith("overall_soundscape"))
        self.assertNotIn("kitchen", sound)
        c = good().clips[0]
        c.room = "a sunny balcony"
        self.assertIn("outdoor ambience", prompt.render(c, BRIEF, CFG))

    def test_too_long_is_an_error(self):
        c = good().clips[0]
        c.room = "x " * 3000
        with self.assertRaises(ValueError):
            prompt.render(c, BRIEF, CFG)


if __name__ == "__main__":
    unittest.main()
