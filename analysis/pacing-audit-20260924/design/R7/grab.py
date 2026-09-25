import sys; from util import *; from PIL import Image
for t in sys.argv[1:]:
    t=float(t); Image.fromarray(frame(t)).save(f'fr_{t:07.3f}.png')
