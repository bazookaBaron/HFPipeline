// 1 OPENING in three clear moves: (a) high wide shot, ship wedged diagonally; (b) the queue behind it; (c) bow in the bank + excavator
absSeg(0, 8, "world", [[0, 54, 44, 20, 0, 0, 0], [2.6, 44, 36, 16, -1, 0, 0], [4.6, 10, 14, 13, -32, 0.8, -1], [5.4, 6, 13, 13, -34, 0.8, -1], [8, 16, 5.5, 3, 5.5, 1, -7.5]]);
// 2 MG MAP (own region): route draws (head-locked, wide), stops at Suez, high overview for the detour round the Cape
const sMapA = rideSeg(8, 11.4, "map", MAP.MR, [[8, 0, 28, 75, 48, 0], [9.8, 0, 26, 80, 46, 0], [11.4, 0, 22, 85, 44, 0]], { sfn: MAP.prog, lead: 0.015, off: MAP_O });
const SZ = MAP.MR.getPointAt(1);
const sMapB = absSeg(11.4, 12.6, "map", [[11.4, "prev"], [12.0, SZ.x + 2, 19, SZ.z + 18, SZ.x - 0.5, 0.5, SZ.z + 1.5], [12.6, "next"]], { off: MAP_O });
const sMapC = absSeg(12.6, 15, "map", [[12.6, -5, 28, 27, -6, 0, 2], [15, -8, 26, 22, -9.5, 0, -1]], { off: MAP_O });
// 3 WORLD: queue ride -> stern + tugs -> bow + excavator -> fly through the numeral "6" (hole faces -z)
absSeg(15, 26.6, "world", [[15, -100, 7, 9, -84, 0.8, -1], [17.7, -67, 7, 9.5, -51, 0.8, -1], [20.2, -38, 7, 10, -22, 1, -1], [22.6, -18, 12, 22, -2, 1, 1], [24.8, 2, 9, 12, 5, 1.5, -6], [25.6, 6.4, 6, -2, 7, 4.5, -14], [26.6, 7, 4.56, -19, 7, 4.56, -31]]);
// 4 MG TIMELINE (numeral flight continues from the world cut; one bar per 0.85 s; pull back to a steady wide hold of the whole chart)
{ const lk = i => 1.5 + TL.h(i) * 0.55, bx = i => TL.x(i), bars = [0, 1, 2, 3, 4, 5, 6].map(i => [TL.tArr[i], bx(i) - 0.3, lk(i) + 3.6, 18.5, bx(i), lk(i), 0]);
  absSeg(26.6, 37, "time", [[26.6, 3, 4.56, 31, 3, 4.56, 22], [27.0, 3, 4.56, 27.4, 3, 4.56, 18.4], [27.6, 3.5, 5.4, 21.8, 5.4, 4.2, 12], ...bars, [34.2, 17, 12.5, 26, 14.5, 6.6, 0], [35.2, 13.8, 16, 44.5, 13.8, 6.4, 0], [37, 13.8, 16.3, 46, 13.8, 6.4, 0]], { off: TIME_O }); }
// 5 MG STRING BOARD: hub, then card by card, then a pulled-back look at the clean web
const bc = id => CARDS.find(c => c.id === id), bk = (t, id, dx, dy, dz, ly = 0) => { const c = bc(id); return [t, BOARD_O.x + c.x + dx, c.y + dy, BOARD_O.z + dz, BOARD_O.x + c.x, c.y + ly, BOARD_O.z + 0.3]; };
absSeg(37, 44, "board", [bk(37, "eg", 0.8, 0.8, 15), bk(38.6, "tr", -0.8, 0.6, 14.5), bk(39.8, "sh", 0.8, 0.6, 14.5), bk(41.0, "oil", -0.8, 0.6, 14.5), bk(42.1, "car", 0.8, 0.6, 14.5),
  [43.4, BOARD_O.x, 10.4, BOARD_O.z + 26.5, BOARD_O.x, 9, BOARD_O.z], [44, BOARD_O.x, 10.5, BOARD_O.z + 27, BOARD_O.x, 9, BOARD_O.z]]);
// 6 WORLD release + finale (top-down rise appended in solver)
absSeg(44, 60, "world", [[44, -24, 10, 20, -2, 1, 0], [50, 2, 13, 26, 1, 1, 0], [54, -4, 17, 26, -12, 0.5, 0], [56, -6, 22, 22, -14, 0, 0], [60, -6, 22, 22, -14, 0, 0]]);
