/* Spike scene: "how inflation loops" — board 1600x860 (card interior). Colours are theme TOKENS only. */
const INK = { brush: "pen", weight: 3, bw: 7 }, MK = { brush: "marker", weight: 1.6, colorToken: "marker", bw: 16, gain: 2.4 };
const box = (id, x, y, seed) => ({ id, kind: "rect", x, y, w: 320, h: 150, seed, ...INK });
module.exports = {
  theme: "cobalt", W: 1600, H: 860, scaleBrushes: 5,
  elements: [
    // washes first (layer 0), hatch (layer 1), ink (layer 2)
    { id: "washB", kind: "wash", pts: [[884, 124], [1176, 120], [1180, 248], [880, 252]], colorToken: "marker", opacity: 170, seed: 31 },
    { id: "washD", kind: "wash", pts: [[164, 604], [456, 600], [460, 728], [160, 732]], colorToken: "pale", opacity: 200, seed: 32 },
    { id: "washMid", kind: "wash", cx: 670, cy: 425, r: 118, colorToken: "pale", opacity: 190, seed: 33 },
    { id: "hatchC", kind: "hatch", pts: [[876, 596], [1184, 596], [1184, 734], [876, 734]], dist: 15, angle: 40, brush: "pen", weight: 1.3, seed: 34 },
    box("boxA", 150, 110, 1), box("boxB", 870, 110, 2), box("boxC", 870, 590, 3), box("boxD", 150, 590, 4),
    { id: "arrAB", kind: "arrow", pts: [[495, 165], [670, 92], [845, 160]], head: 28, seed: 5, ...INK },
    { id: "arrBC", kind: "arrow", pts: [[1215, 280], [1250, 425], [1212, 572]], head: 28, seed: 6, ...INK },
    { id: "arrCD", kind: "arrow", pts: [[848, 700], [670, 778], [492, 702]], head: 28, seed: 7, ...INK },
    { id: "arrDA", kind: "arrow", pts: [[205, 572], [168, 425], [205, 278]], head: 28, seed: 8, ...INK },
    { id: "loop", kind: "arrow", pts: [[740, 360], [670, 335], [592, 380], [588, 470], [670, 515], [748, 478]], head: 24, seed: 9, brush: "pen", weight: 2.6, bw: 7 },
    { id: "coin1", kind: "circle", cx: 382, cy: 330, r: 30, seed: 10, ...INK },
    { id: "coin1i", kind: "circle", cx: 382, cy: 330, r: 17, seed: 11, brush: "pen", weight: 2, bw: 5 },
    { id: "coin2", kind: "circle", cx: 446, cy: 350, r: 30, seed: 12, ...INK },
    { id: "coin2i", kind: "line", a: [446, 334], b: [446, 366], seed: 13, brush: "pen", weight: 2, bw: 5 },
    { id: "save", kind: "circle", cx: 600, cy: 600, r: 32, seed: 14, ...INK },
    { id: "savei", kind: "circle", cx: 600, cy: 600, r: 19, seed: 15, brush: "pen", weight: 2, bw: 5 },
    { id: "tag", kind: "polygon", pts: [[1300, 410], [1372, 410], [1398, 440], [1372, 470], [1300, 470]], seed: 16, ...INK },
    { id: "tagHole", kind: "circle", cx: 1376, cy: 440, r: 6, seed: 17, brush: "pen", weight: 1.8, bw: 5 },
    { id: "upArr", kind: "arrow", pts: [[1336, 380], [1340, 320], [1336, 262]], head: 22, seed: 18, ...INK },
    { id: "pHead", kind: "circle", cx: 1340, cy: 585, r: 24, seed: 19, ...INK },
    { id: "pBody", kind: "line", a: [1340, 610], b: [1342, 700], seed: 20, ...INK },
    { id: "pArms", kind: "spline", pts: [[1300, 668], [1320, 640], [1342, 632], [1366, 640], [1386, 664]], seed: 21, ...INK },
    { id: "pLegs", kind: "spline", pts: [[1312, 770], [1328, 735], [1342, 700], [1356, 735], [1372, 770]], seed: 22, ...INK },
    { id: "ulC", kind: "underline", x1: 905, x2: 1155, y: 712, seed: 23, ...MK },
    { id: "ringC", kind: "ring", cx: 1030, cy: 665, rx: 212, ry: 112, seed: 24, ...MK },
    { id: "xSave", kind: "cross", cx: 600, cy: 600, s: 44, seed: 25, brush: "pen", weight: 2, colorToken: "alert", bw: 8 },
    { id: "ulA", kind: "underline", x1: 200, x2: 420, y: 246, seed: 26, ...MK },
  ],
};
