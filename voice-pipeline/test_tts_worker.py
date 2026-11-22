"""CPU-only contract tests for the persistent voice worker."""

import math
import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tts_worker import VoiceWorker, main, map_aligned_words, trim_bounds


class WordMappingTests(unittest.TestCase):
    def test_stable_indices_and_sentence_ids(self):
        aligned = [
            {"word": "Hello", "start": 0.2, "end": 0.4},
            {"word": "world.", "start": 0.45, "end": 0.7},
            {"word": "New", "start": 0.85, "end": 1.0},
            {"word": "day!", "start": 1.02, "end": 1.2},
        ]
        result = map_aligned_words("Hello world. New day!", aligned)
        self.assertEqual([w["i"] for w in result], [0, 1, 2, 3])
        self.assertEqual([w["sentenceIndex"] for w in result], [0, 0, 1, 1])

    def test_alignment_split_compound(self):
        result = map_aligned_words("red-black tree", [
            {"word": "red", "start": 0.1, "end": 0.2},
            {"word": "black", "start": 0.21, "end": 0.3},
            {"word": "tree", "start": 0.4, "end": 0.6},
        ])
        self.assertEqual(result[0]["w"], "red-black")
        self.assertEqual((result[0]["s"], result[0]["e"]), (0.1, 0.3))

    def test_refuses_missing_or_nonmonotonic(self):
        with self.assertRaises(ValueError):
            map_aligned_words("one two", [{"word": "one", "start": 0.1, "end": 0.2}])
        with self.assertRaises(ValueError):
            map_aligned_words("one two", [
                {"word": "one", "start": 0.1, "end": 0.4},
                {"word": "two", "start": 0.2, "end": 0.5},
            ])


class TrimTests(unittest.TestCase):
    def test_bounds_keep_word_and_padding(self):
        start, end = trim_bounds(3.0, [{"s": 0.8, "e": 1.1}, {"s": 2.0, "e": 2.5}])
        self.assertTrue(math.isclose(start, 0.74))
        self.assertTrue(math.isclose(end, 2.6))

    def test_bounds_clamp_to_audio(self):
        self.assertEqual(trim_bounds(1.0, [{"s": 0.02, "e": 0.98}]), (0.0, 1.0))


class ProtocolTests(unittest.TestCase):
    def test_numba_cache_is_writable(self):
        cache = Path(os.environ["NUMBA_CACHE_DIR"]).resolve()
        self.assertTrue(cache.is_dir())
        with tempfile.TemporaryFile(dir=cache) as file:
            file.write(b"ok")

    def test_model_chatter_goes_to_stderr_only(self):
        stdin = io.StringIO(json.dumps({"id": 7, "op": "synthesize", "genText": "test"}) + "\n")
        stdout, stderr = io.StringIO(), io.StringIO()

        def fake_synthesize(_self, _request):
            print("model progress")
            return {"wordCount": 1}

        with patch("sys.stdin", stdin), patch("sys.stdout", stdout), patch("sys.stderr", stderr):
            with patch.object(VoiceWorker, "synthesize", fake_synthesize):
                main()
        self.assertEqual(json.loads(stdout.getvalue()), {"id": 7, "ok": True, "result": {"wordCount": 1}})
        self.assertIn("model progress", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
