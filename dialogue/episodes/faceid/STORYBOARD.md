# faceid storyboard (9:16, iso MG, voice at 1.3x)

Look: the approved colourful iso kit (mg/isokit) on the deep-indigo field. The subject is a FACE RELIEF: a plate of small columns whose heights follow a face
(nose ridge, brow, cheeks, chin, eye sockets), seen from above in iso, so "depth" is literally hills and valleys. A phone stands on a small island at its side and
fires the dots. Camera: fixed iso angle, eased moves between subjects. Glow only on emitters (the dot beam, the dots themselves, the scan ring).
Colour: sky = infrared dots / the phone, mint = match / yours, saffron = the stored copy / the nose peak, coral = a stranger / mismatch, violet = valleys, ember = only for "broken" (flat photo, fooled guard).
Times are global episode seconds (words from shots.json; mg.js looks the words up at run time).
Sound-off test: every card has to show the mechanism moving, not a label.

Card layout (9:16 `float`): card x 54, y 154, 972 x 560. Heads clear (episodes/faceid/headcheck.js). Every text >= 28 px (hud 34 x .85). No card longer than ~7.5 s.
Cards enter and leave on the nearest shot cut. Under cards only MS/CU rigs (no wide2, high34, profile2, tent_wide, low_fire).

| # | Card | On screen | What moves (sound-off read) |
|---|---|---|---|
| 1 | THE DOTS | L4-L5, 5.1-10.2 | Phone on its island at the left, the face relief on a plate at the right (plain cream columns). "Over thirty thousand invisible dots": a sky cone of light opens from the phone and a regular dot grid pours onto the face; a counter runs 0 -> 30,000+ DOTS; chip INFRARED · INVISIBLE. "At your face": the dots settle, covering it. "Like a photo?": the grid stays dots, no picture (the face is plain columns). |
| 2 | THE BEND | L6-L7, 10.3-17.6 | Same world. "A camera watches": an eye/lens on the phone opens. "How the dots bend": each dot slides sideways from its flat position (thin trail) by how high the column under it is, so the grid is straight on the flat plate and bent over the face. Rings pulse over NOSE, CHEEKS, CHIN in turn (chips). "It draws a map": the columns colour by height (violet low -> sky -> mint -> saffron -> coral nose peak), chip DEPTH MAP. |
| 3 | THE MAP | L8, 17.7-24.4 | The coloured map close: "depth": a height scale appears; "hills and valleys": chips HILL (nose peak) and VALLEY (eye socket) pop on it; "the phone stored yours once": the map shrinks into a saffron vault chip on the phone, STORED ON PHONE; "checks it every unlock": a fresh sky scan lands on the stored one three times, the outline snaps over it each time, mint tick, chip MATCH. |
| 4 | NO DEPTH | L9-L10, 24.8-30.6 | Stored map (saffron outline) on the left. A flat printed photo (a small face picture on a thin card) is held in front of the phone's dots: the dots land in a perfectly straight grid on it (no bend). Its map comes out all one flat violet colour, an ember cross over it and chip NO HILLS · NO MAP; the matcher shows MATCH? with ember X. |
| 5 | THE MASK | L11-L12, 30.7-36.1 | A mask relief (same shape as the face, but smoothed) is scanned: the map is almost right, a few columns light coral where it differs (chip HARD TO MAKE). Then a big pair of eyes at the phone: a gaze line from the eyes to the phone; the mask's eye holes stay dark and the check shows an ember cross; the real face's eyes open, the gaze line lights up, mint tick, chip EYES OPEN · LOOKING. |
| 6 | STRANGERS | L13-L14, 36.4-42.2 | YOUR MAP (mint) and a stranger's map (coral, a longer nose, lower cheeks) side by side: "same face, same map": the first overlays the stored map and matches. A stranger's map slides on top and the columns that differ turn coral. "One time in a million": a 1,000-square grid (each square = 1,000 people) with ONE square lighting up; chip 1 IN 1,000,000. |
| 7 | TWINS | L15-L16, 42.5-46.6 | Two maps side by side, YOU and TWIN. "Identical ones": the overlay compares them and almost nothing turns coral (a single column), a mint MATCH forms where a stranger would be rejected. "Can fool it": the lock opens (ember lock icon cracks), chip CAN FOOL IT. |
| - | (no card) | L17-L18 + tail | The twin joke and Walter's dry button are on faces (Leo grin CU, Walter dry CU, wide tail). |

Coverage: dots projected on the face (1), the bend gives depth -> depth map (2), hills and valleys, stored on phone, compared each unlock (3), photo is flat -> no map (4),
mask hard to make + eyes open looking (5), strangers 1 in a million (6), twins are the weak spot (7), twin joke + button (no card, faces).
