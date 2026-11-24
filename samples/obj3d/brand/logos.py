# Channel logos as flat SVG (ink + one red), 800x800. Cuts are real masks, so the transparent SVG has true gaps.
# Writes out/brand/<name>.svg (transparent) and out/brand/work/<name>_paper.svg (paper background, rasterised by raster.mjs).
# partition_logo_1 / powder_logo_1 reuse the end-card marks' geometry (film.html chanMark "partition" / "powder").
import os
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, "..", "out", "brand"); WORK = os.path.join(OUT, "work")
os.makedirs(WORK, exist_ok=True)
INK, RED, PAPER = "#2b2a27", "#c8261d", "#f3eee3"
S = 800; C = S / 2

def svg(body, defs="", bg=False):
    b = f'<rect width="{S}" height="{S}" fill="{PAPER}"/>' if bg else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{S}" height="{S}" viewBox="0 0 {S} {S}"><defs>{defs}</defs>{b}{body}</svg>'

def f(x): return f"{x:.2f}"

# ---- 1. Partition Lines: ink square cut by one slanted line, the far side red (end-card mark, scaled) ----
def partition_square():
    s = 470; h = s / 2; r = s * 0.12; x0, y0 = C - h, C - h
    ax, bx = C + s * 0.16, C - s * 0.08            # cut line top x / bottom x
    lw = s * 0.08
    defs = (f'<clipPath id="sq"><rect x="{f(x0)}" y="{f(y0)}" width="{s}" height="{s}" rx="{f(r)}"/></clipPath>'
            f'<mask id="cut"><rect width="{S}" height="{S}" fill="#fff"/><line x1="{f(ax)}" y1="{f(y0 - 5)}" x2="{f(bx)}" y2="{f(y0 + s + 5)}" stroke="#000" stroke-width="{f(lw)}"/></mask>')
    body = (f'<g mask="url(#cut)" clip-path="url(#sq)"><rect x="{f(x0)}" y="{f(y0)}" width="{s}" height="{s}" fill="{INK}"/>'
            f'<polygon points="{f(ax)},{f(y0 - 5)} {f(x0 + s + 5)},{f(y0 - 5)} {f(x0 + s + 5)},{f(y0 + s + 5)} {f(bx)},{f(y0 + s + 5)}" fill="{RED}"/></g>')
    return body, defs

# ---- 2. Powder Keg: flat ink keg, two cut hoops, a short fuse and a red spark dot (end-card mark, scaled) ----
def powder_keg():
    s = 560; h = s / 2; cx, cy = C - s * 0.02, C + s * 0.02
    bw, bh, by, bulge = s * 0.62, s * 0.7, s * 0.12, s * 0.08
    L, R, T, B, M = cx - bw / 2, cx + bw / 2, cy + by - bh / 2, cy + by + bh / 2, cy + by
    keg = (f'M{f(L)},{f(T)} L{f(R)},{f(T)} Q{f(R + bulge * 2)},{f(M)} {f(R)},{f(B)} L{f(L)},{f(B)} Q{f(L - bulge * 2)},{f(M)} {f(L)},{f(T)} Z')
    hoops = ""
    for k in (-0.22, 0.22):
        yy = M + bh * k; xw = bw / 2 + bulge * 0.9 * (1 - 4 * k * k) + 2
        hoops += f'<line x1="{f(cx - xw - 4)}" y1="{f(yy)}" x2="{f(cx + xw + 4)}" y2="{f(yy)}" stroke="#000" stroke-width="{f(s * 0.055)}"/>'
    defs = f'<mask id="hoop"><rect width="{S}" height="{S}" fill="#fff"/>{hoops}</mask>'
    fuse = f'M{f(cx)},{f(T)} Q{f(cx + s * 0.02)},{f(cy - h + s * 0.02)} {f(cx + s * 0.22)},{f(cy - h + s * 0.1)}'
    body = (f'<path d="{keg}" fill="{INK}" mask="url(#hoop)"/>'
            f'<path d="{fuse}" fill="none" stroke="{INK}" stroke-width="{f(s * 0.06)}" stroke-linecap="round"/>'
            f'<circle cx="{f(cx + s * 0.27)}" cy="{f(cy - h + s * 0.08)}" r="{f(s * 0.085)}" fill="{RED}"/>')
    return body, defs

# ---- 3. Partition Lines alt: geometric "PL" monogram cut by one red slanted line ----
def pl_monogram():
    st = 92                      # stroke weight
    H = 400; top = C - H / 2; bot = C + H / 2
    # P: stem + bowl (outer arc minus inner arc)
    px = 170; bowlH = 240; bw = 210
    P = (f'M{px},{top} H{px + bw - bowlH / 2} A{bowlH / 2},{bowlH / 2} 0 0 1 {px + bw - bowlH / 2},{top + bowlH} H{px + st} V{bot} H{px} Z '
         f'M{px + st},{top + st * 0.82} V{top + bowlH - st * 0.82} H{px + bw - bowlH / 2} A{bowlH / 2 - st * 0.82},{bowlH / 2 - st * 0.82} 0 0 0 {px + bw - bowlH / 2},{top + st * 0.82} Z')
    lx = 452; lw = 190
    Lp = f'M{lx},{top} H{lx + st} V{bot - st * 0.95} H{lx + lw} V{bot} H{lx} Z'
    # the line: slanted, from upper right to lower left, crossing both letters
    x1, y1, x2, y2 = 540, 120, 300, 680
    cutw, redw = 64, 24
    defs = f'<mask id="cutpl"><rect width="{S}" height="{S}" fill="#fff"/><line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#000" stroke-width="{cutw}"/></mask>'
    body = (f'<g mask="url(#cutpl)"><path d="{P}" fill="{INK}" fill-rule="evenodd"/><path d="{Lp}" fill="{INK}"/></g>'
            f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{RED}" stroke-width="{redw}" stroke-linecap="butt"/>')
    return body, defs

LOGOS = {"partition_logo_1": partition_square, "powder_logo_1": powder_keg, "partition_logo_2": pl_monogram}
if __name__ == "__main__":
    for name, fn in LOGOS.items():
        body, defs = fn()
        open(os.path.join(OUT, name + ".svg"), "w").write(svg(body, defs, bg=False))
        open(os.path.join(WORK, name + "_paper.svg"), "w").write(svg(body, defs, bg=True))
        print("wrote", name)
