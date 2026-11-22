# Audio sources and licences

- **Ambiences (`ambience.py`) and SFX (`sfx.py`)**: 100 % procedurally synthesised in this repo with
  numpy/scipy (noise shaping, formant-filtered babble, modal metal/wood models, convolution reverb from
  synthesised impulse responses). No sampled or downloaded audio is used, so there is nothing to attribute.
- **Music pad**: tracks from `video-engine/assets/music-lib` (Kevin MacLeod, incompetech.com, CC BY 4.0).
  `docmix.py` writes the track's credit line to `<project>/credits.txt` whenever the pad plays; that line
  must go into the video description.
