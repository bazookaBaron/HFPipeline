"""Focused tests for the diagnostic detector's public geometry and event rules."""

import importlib.util
import unittest
from pathlib import Path

import numpy as np

spec = importlib.util.spec_from_file_location("pacing_gate", Path(__file__).with_name("pacing_gate.py"))
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


class PacingGateTests(unittest.TestCase):
    def test_rect_validation_and_exclusion(self):
        rect = gate.rect_arg("0,0.75,1,0.25")
        mask = gate.inclusion([rect])
        self.assertFalse(mask[gate.H - 1].any())
        self.assertTrue(mask[0].all())
        with self.assertRaises(ValueError):
            gate.inclusion([(0, 0, 1, 1)])

    def test_cut_threshold_and_merge(self):
        activity = np.zeros((12, gate.GC * gate.GR))
        scores = np.zeros(12)
        scores[4] = 0.24
        scores[5] = 0.25
        scores[6] = 0.30
        scores[10] = 0.25
        beats, cuts = gate.events(activity, scores, 30)
        self.assertEqual(cuts, [5, 10])
        self.assertEqual([b[0] for b in beats], [5, 10])

    def test_mascot_region_does_not_count_as_content(self):
        mask = gate.inclusion([(0, 0.25, 0.25, 0.5)])
        changed = np.zeros((gate.H, gate.W), bool)
        changed[gate.H // 2, 0:gate.W // 4] = True
        self.assertFalse(gate.cells(changed, mask).any())

    def test_frozen_hold(self):
        self.assertEqual(gate.max_run([False, True, True, False, True], 10), 0.2)


if __name__ == "__main__":
    unittest.main()
