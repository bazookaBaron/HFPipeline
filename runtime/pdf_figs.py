"""runtime/pdf_figs.py: crop "Figure N" regions out of a paper PDF as PNGs (real figures for carousel slides).

    python runtime/pdf_figs.py <paper.pdf> <outDir> <prefix> [--max 4] [--pages 14]

For every caption block that starts with "Figure N" / "Fig. N", the figure is the union of drawings and images
between the previous long body paragraph and the caption. Rendered at 3x into <outDir>/img/<prefix>-pfigN.png;
prints JSON [{src, caption, page}]. Also writes <prefix>-page1.png (top half of page 1: title + authors).
Heuristic: always look at the crops before using one."""
import json, os, re, sys
import pymupdf

a = sys.argv[1:]
pdf, out, prefix = a[0], a[1], a[2]
opt = lambda k, d: int(a[a.index("--" + k) + 1]) if "--" + k in a else d
MAX, PAGES = opt("max", 4), opt("pages", 14)
img_dir = os.path.join(out, "img"); os.makedirs(img_dir, exist_ok=True)
doc = pymupdf.open(pdf)
res = []
cap_re = re.compile(r"^\s*(Figure|Fig\.)\s*(\d+)\s*[:.|]", re.I)

for pno in range(min(PAGES, len(doc))):
    page = doc[pno]
    W = page.rect.width
    blocks = [b for b in page.get_text("blocks") if b[6] == 0]  # (x0,y0,x1,y1,text,no,type)
    gfx = [d["rect"] for d in page.get_drawings() if d["rect"].width > 2 or d["rect"].height > 2]
    gfx += [page.get_image_bbox(i) for i in page.get_images(full=True) if not page.get_image_bbox(i).is_empty]
    for b in blocks:
        m = cap_re.match(b[4])
        if not m or len(res) >= MAX: continue
        cap_top = b[1]
        # body paragraphs above the caption bound the figure from the top
        paras = [p for p in blocks if p[3] <= cap_top - 1 and len(p[4]) > 220 and (p[2] - p[0]) > W * 0.35]
        top = max([p[3] for p in paras] + [page.rect.height * 0.075])  # skip running header + its rule
        parts = [r for r in gfx if r.y0 >= top - 2 and r.y1 <= cap_top + 2 and r.height < page.rect.height * 0.9]
        if not parts: continue
        box = pymupdf.Rect(parts[0])
        for r in parts[1:]: box |= r
        # include small text labels inside the figure area
        for t in blocks:
            if t is not b and t[1] >= top - 2 and t[3] <= cap_top + 2 and len(t[4]) < 220:
                box |= pymupdf.Rect(t[:4])
        box = (box + (-6, -6, 6, 6)) & page.rect
        if box.width < W * 0.25 or box.height < 60: continue
        f = os.path.join(img_dir, f"{prefix}-pfig{m.group(2)}.png")
        page.get_pixmap(matrix=pymupdf.Matrix(3, 3), clip=box).save(f)
        res.append({"src": os.path.relpath(f, out).replace(os.sep, "/"), "caption": " ".join(b[4].split())[:220], "page": pno + 1})

p1 = doc[0]
f = os.path.join(img_dir, f"{prefix}-page1.png")
p1.get_pixmap(matrix=pymupdf.Matrix(3, 3), clip=pymupdf.Rect(0, 0, p1.rect.width, p1.rect.height * 0.55)).save(f)
print(json.dumps({"page1": os.path.relpath(f, out).replace(os.sep, "/"), "figures": res}, indent=1))
