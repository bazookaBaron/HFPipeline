# fetch_photos.py - China v4 real evidence photos (MINIATURE-LESSONS 16-18).
# Licence + author read from Commons file metadata through the en.wikipedia API (commons.wikimedia.org is blocked here);
# images downloaded only from upload.wikimedia.org (1600 px thumbnails), converted to greyscale JPEG, cropped to the card aspect.
# Two document cards are retyped word for word from the official text (doc: true).
# usage (from anywhere):  python -I fetch_photos.py [--raw <dir for untrusted downloads>] [--only id,id]
import json, os, re, subprocess, sys, time, urllib.parse, html
from PIL import Image, ImageOps, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "photos")
UA = "evidence-card-fetcher/1.0 (generic research script)"
API = "https://en.wikipedia.org/w/api.php"
TODAY = "2026-11-15"
CHECKED = f"{TODAY} via Commons file metadata (en.wikipedia.org API; commons.wikimedia.org unreachable on this network)"

# id: (Commons file, crop box as fractions (l,t,r,b) or None, target aspect "4:3"/"1:1"/None, suggest line, caption, author override, pos)
CARDS = [
    ("sz_skyline",   "Skyline of Futian District in 2018.5.jpg", None, "4:3", 1, "Shenzhen today", None, None),
    ("sz_factory",   "Electronics factory in Shenzhen.jpg", None, "4:3", 3, "Electronics factory, Shenzhen", "Steve Jurvetson", None),
    ("lowu_1982",    "Lo Wu Station (1982).jpg", None, "4:3", 5, "Lo Wu border station, 1982", "dave massie", None),
    ("sz_river",     "Shenzhen-Hong Kong border.jpg", None, "4:3", 5, "Shenzhen River, the HK border", "Payton Chung", None),
    ("deng_board",   "Deng Xiaoping billboard 03.JPG", None, "4:3", 6, "Deng Xiaoping billboard, Shenzhen", None, None),
    ("hqb_street",   "Huaqiangbei walking street.jpg", None, "4:3", 7, "Huaqiangbei, Shenzhen", None, None),
    ("seg_market",   "Inside SEG Plaza (Bobbie Johnson) - Flickr.jpg", None, "4:3", 8, "Inside SEG electronics market", "Bobbie Johnson", None),
    ("fake_phone",   "2009-11-23 Fake N97 with iPhone OS -- all kinds of wrong.jpg", None, "4:3", 10, "A knock-off phone, 2009", "Andrew Currie", None),
    ("mtk_chip",     "Nokia 1 Plus - board 1 - MediaTek MT6739V-3111.jpg", None, "4:3", 11, "A MediaTek phone chip", None, None),
    ("tv_phone",     "Anycool V876 mobile phone.jpg", None, "1:1", 13, "Chinese phone with a TV tuner", None, None),
    ("santana",      "1983 Volkswagen Santana -- Shanghai Automobile Museum 2012-05-26.JPG", None, "4:3", 18, "1983 VW Santana, Shanghai", None, None),
    ("saic_vw",      "SAIC-Volkswagen Headquarter 20260515.jpg", None, "4:3", 20, "SAIC Volkswagen HQ, Shanghai", None, None),
    ("wto_geneva",   "Cwr main entrance.jpg", None, "4:3", 21, "WTO headquarters, Geneva", "Lamerica (English Wikipedia)", None),
    ("mofcom",       "Ministry of Commerce of the People's Republic of China.jpg", None, "4:3", 23, "China's commerce ministry, Beijing", None, None),
    ("sinovel",      "Sinovel SL-3000.jpg", None, "1:1", 29, "A Sinovel wind turbine", None, None),
    ("madison_ct",   "Robert W. Kastenmeier United States Courthouse.jpg", None, "1:1", 32, "US courthouse, Madison, Wisconsin", "Chris Phan", None),
    ("doj",          "Front of Department of Justice Building.JPG", None, "4:3", 33, "US Justice Department", None, None),
    ("micron_sj",    "MicronSanJose.png", None, "4:3", 34, "Micron, San Jose", None, None),
    ("umc_tower",    "UMC UT Tower.jpg", None, "4:3", 35, "UMC building, Hsinchu, Taiwan", None, None),
    ("sf_court",     "Phillip Burton Federal Building & United States Courthouse.jpg", None, "4:3", 36, "US federal court, San Francisco", None, None),
    ("fbi_pla",      "FBI20140519.jpg", None, None, 37, "FBI: five officers charged, 2014", "FBI", None),
    ("us_steel",     "U. S. Steel Tower, 2025-04-23.jpg", None, "1:1", 38, "U.S. Steel Tower, Pittsburgh", None, None),
    ("crh2",         "CRH2A Hexie EMU.jpg", None, "4:3", 43, "CRH2, from the 2004 deals", "Samson Ng", None),
    ("e2_shinkansen","Series-E2-1000-J70.jpg", None, "4:3", 44, "Japan's E2 Shinkansen", None, None),
    ("crh3",         "CRH3C Hexie EMU.jpg", None, "4:3", 45, "CRH3, built on Siemens' Velaro", "Samson Ng", None),
    ("kawasaki_hq",  "Kawasaki Heavy Industries.jpg", None, "1:1", 46, "Kawasaki HQ, Kobe", None, None),
    ("cr400",        "Century Kiss of CR400 series (20170225103539).jpg", None, "4:3", 48, "CR400 Fuxing trains", None, None),
    ("hsr_map",      "Growth of China's high-speed rail network, 2017.jpg", None, None, 49, "China's fast rail, 2017 (World Bank)", "World Bank (Lawrence, Bullock, Liu)", None),
    ("nvidia_hq",    "NVIDIA Headquarters.jpg", None, "4:3", 55, "Nvidia HQ, Santa Clara", None, None),
    ("openai_sf",    "Pioneer Building, San Francisco (2019) -1.jpg", None, "4:3", 56, "OpenAI's former HQ, San Francisco", None, None),
    ("ft_london",    "Financial Times building One Southwark Bridge.jpg", None, "4:3", 57, "Financial Times, London", "Financial Times", None),
    ("nyt",          "New York Times Building - Bottom Portion (48193462432).jpg", None, "4:3", 62, "The New York Times, New York", "Ajay Suresh", None),
    ("byd_battery",  "BaByliss for Men T47 - battery BYD Rechargeable AAA-92292.jpg", None, "4:3", 65, "A BYD rechargeable battery", None, None),
    ("byd_plant",    "比亚迪深圳坑梓厂区.jpg", None, "4:3", 66, "BYD's Kengzi plant, Shenzhen", None, None),
    ("tesla_fremont","New Teslas at the factory.jpg", None, "4:3", 67, "New Teslas, Fremont factory", "Steve Jurvetson", None),
    ("catl_plant",   "CATL Arnstadt 2crop 2020-04.jpg", None, "4:3", 69, "CATL battery plant, Germany", None, None),
    ("ford_hq",      "Ford World Headquarters from sidewalk, against sun.jpg", None, "4:3", 70, "Ford HQ, Dearborn, Michigan", None, None),
    ("catl_cell",    "CATL Lifepo4 302Ah.jpg", None, "1:1", 71, "A CATL LFP battery cell", None, None),
    ("water_frame",  "Waterframe.jpg", None, "1:1", 73, "Model of a water frame", "Markus Schweiß (German Wikipedia)", None),
    ("slater",       "Samuel Slater industrialist.jpg", None, "1:1", 74, "Samuel Slater", "National Biographical Publishing Co. (1881)", None),
    ("slater_mill",  "Slater Mill, Pawtucket, Rhode Island.jpg", None, "4:3", 75, "Slater Mill, Pawtucket, R.I.", None, None),
    ("lowell",       "Francis Cabot Lowell.jpg", None, "1:1", 77, "Francis Cabot Lowell", "US National Park Service", None),
    ("bmc_waltham",  "BMC Mill Waltham.jpg", None, "4:3", 77, "Boston Manufacturing Co., Waltham", "Marc N. Belanger", None),
    ("dickens",      "Francis Alexander - Charles Dickens 1842.jpeg", None, "1:1", 78, "Charles Dickens, 1842", "Francis Alexander", None),
    ("made_in_de",   "FAG made in Germany pic1.JPG", None, "4:3", 79, "Made in Germany", None, None),
    ("chang",        "Ha-Joon Chang profile cropped.jpg", None, "1:1", 80, "Economist Ha-Joon Chang", None, None),
    ("hqb_payoff",   "华强电子世界 1.jpg", None, "4:3", 83, "Huaqiang Electronics World", None, None),
]

ALLOWED = re.compile(r"^(cc0|public domain|pd|cc by(-sa)? \d\.\d( igo)?|cc by(-sa)?-\d\.\d)", re.I)

def curl(url, out=None):
    for i in range(6):
        time.sleep(2)
        args = ["curl", "-sSL", "-A", UA, url] + (["-o", out, "-w", "%{http_code}"] if out else [])
        r = subprocess.run(args, capture_output=True, timeout=180)
        if out:
            if r.stdout.decode().strip() == "200": return True
        else:
            try: return json.loads(r.stdout)
            except Exception: pass
        time.sleep(15 + 15 * i)
    raise SystemExit(f"failed: {url}")

def strip(s): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", s or ""))).strip()

def meta(files):
    res = {}
    for k in range(0, len(files), 40):
        chunk = files[k:k + 40]
        q = dict(action="query", titles="|".join("File:" + f for f in chunk), prop="imageinfo",
                 iiprop="url|extmetadata|size", iiurlwidth=1600, format="json")
        r = curl(API + "?" + urllib.parse.urlencode(q))
        norm = {n["to"]: n["from"] for n in r["query"].get("normalized", [])}
        for p in r["query"]["pages"].values():
            ii = (p.get("imageinfo") or [{}])[0]; m = ii.get("extmetadata", {})
            g = lambda key: strip(m.get(key, {}).get("value"))
            name = norm.get(p["title"], p["title"])[5:]
            res[name] = dict(lic=g("LicenseShortName"), licUrl=g("LicenseUrl") or None, artist=g("Artist"), nonfree=g("NonFree"),
                             url=ii.get("url"), thumb=ii.get("thumburl"), w=ii.get("width"), h=ii.get("height"),
                             page=ii.get("descriptionurl"), desc=g("ImageDescription")[:200])
    return res

def crop_aspect(im, aspect, pos):
    if not aspect: return im, False
    a = {"4:3": 4 / 3, "1:1": 1.0, "3:2": 1.5}[aspect]; w, h = im.size; fx, fy = pos or (0.5, 0.5)
    if abs(w / h - a) < 0.02: return im, False
    if w / h > a: nw = round(h * a); x = round((w - nw) * fx); return im.crop((x, 0, x + nw, h)), True
    nh = round(w / a); y = round((h - nh) * fy); return im.crop((0, y, w, y + nh)), True

def lic_url(lic, url):
    if url: return url.replace("http://", "https://")
    return None

def main():
    raw = sys.argv[sys.argv.index("--raw") + 1] if "--raw" in sys.argv else os.path.join(os.environ.get("TEMP", HERE), "china_v4_raw")
    only = set(sys.argv[sys.argv.index("--only") + 1].split(",")) if "--only" in sys.argv else None
    os.makedirs(raw, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    pj = os.path.join(HERE, "photos.json")
    photos = json.load(open(pj, encoding="utf-8")) if os.path.exists(pj) else {}
    cards = [c for c in CARDS if not only or c[0] in only]
    M = meta([c[1] for c in cards])
    for cid, src, box, aspect, line, cap, author, pos in cards:
        m = M.get(src)
        if not m or not m["url"]: print("NO META", cid, src); continue
        if m["nonfree"] or not ALLOWED.match(m["lic"]): print("REJECT licence", cid, m["lic"]); continue
        dl = m["thumb"] if (m["w"] or 0) > 1600 and m["thumb"] else m["url"]
        if not dl.startswith("https://upload.wikimedia.org/"): print("REJECT host", cid, dl); continue
        ext = os.path.splitext(urllib.parse.urlparse(dl).path)[1].lower() or ".jpg"
        rp = os.path.join(raw, cid + ext)
        if not os.path.exists(rp): curl(dl, rp)
        im = Image.open(rp); im = ImageOps.exif_transpose(im).convert("L")
        mods = ["greyscale"]; cropped = False
        if box:
            w, h = im.size; im = im.crop((round(box[0] * w), round(box[1] * h), round(box[2] * w), round(box[3] * h))); cropped = True
        im, c2 = crop_aspect(im, aspect, pos); cropped = cropped or c2
        if im.width > 1600: im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
        if cropped: mods.append("cropped")
        im.save(os.path.join(OUT, cid + ".jpg"), quality=90)
        lic = m["lic"]; lic = "Public domain" if lic.lower() in ("public domain", "pd") else lic
        auth = author or m["artist"]
        mod = ", ".join(mods)
        photos[cid] = {
            "file": f"photos/{cid}.jpg", "page": m["page"], "licence": lic, "licenceUrl": lic_url(lic, m["licUrl"]), "author": auth,
            "credit": f"Photo: {auth} / Wikimedia Commons · {lic} (modified: {mod})",
            "cardCredit": f"{auth} / Wikimedia Commons · {lic}",
            "w": im.width, "h": im.height, "modified": True, "source": src,
            "suggest": {"line": line, "caption": cap}, "checked": CHECKED,
        }
        if pos: photos[cid]["pos"] = list(pos)
        print(f"ok {cid:14s} {im.width}x{im.height} {lic:14s} {auth[:40]}")
    json.dump(photos, open(pj, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# ---- document excerpt cards: text retyped WORD FOR WORD from the official source (no paraphrase) ----
FONTS = "C:/Windows/Fonts/"
DOCS = {
    "ustr301": dict(
        line=22, caption="US trade report, 22 Mar 2018",
        page="https://ustr.gov/sites/default/files/Section%20301%20FINAL.PDF",
        licence="Public domain (US government work)", author="Office of the United States Trade Representative",
        credit="Document: USTR Section 301 report, 22 Mar 2018 · public domain (title page retyped verbatim, greyscale)",
        cardCredit="USTR (US government) · public domain",
        note="title page of the official USTR PDF, every word retyped verbatim at card size (the PDF page itself is unreadable when shown small)",
        blocks=[("arialbd.ttf", 40, "OFFICE of the UNITED STATES TRADE REPRESENTATIVE", 18),
                ("arial.ttf", 30, "EXECUTIVE OFFICE OF THE PRESIDENT", 56),
                ("timesbd.ttf", 58, "FINDINGS OF THE INVESTIGATION INTO CHINA'S ACTS, POLICIES, AND PRACTICES RELATED TO TECHNOLOGY TRANSFER, INTELLECTUAL PROPERTY, AND INNOVATION UNDER SECTION 301 OF THE TRADE ACT OF 1974", 50),
                ("times.ttf", 44, "March 22, 2018", 0)]),
    "fil_art22": dict(
        line=25, caption="Foreign Investment Law, Art. 22",
        page="https://english.www.gov.cn/services/investment/202102/24/content_WS6035aa38c6d0719374af9609.html",
        licence="Public domain (PRC law text, not copyrightable: PRC Copyright Law Art. 5)", author="Foreign Investment Law of the PRC (official English text, gov.cn)",
        credit="Document: Foreign Investment Law of the PRC, Art. 22 (official English text, english.www.gov.cn) · not copyrightable (excerpt retyped verbatim, greyscale)",
        cardCredit="PRC Foreign Investment Law (gov.cn) · public domain",
        note="title, adoption line and last sentence of Art. 22 retyped verbatim from the State Council portal English text; [...] marks the omitted earlier sentences of Art. 22",
        blocks=[("timesbd.ttf", 50, "Foreign Investment Law of the People's Republic of China", 14),
                ("timesi.ttf", 32, "(Adopted at the Second Session of the 13th National People's Congress on March 15, 2019)", 46),
                ("arialbd.ttf", 46, "Article 22", 18),
                ("times.ttf", 44, "[...]", 14),
                ("times.ttf", 56, "No administrative department or its staff member shall force any transfer of technology by administrative means.", 0)]),
}

def wrap(draw, text, font, maxw):
    out, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=font) <= maxw or not cur: cur = t
        else: out.append(cur); cur = w
    if cur: out.append(cur)
    return out

def make_docs():
    pj = os.path.join(HERE, "photos.json"); photos = json.load(open(pj, encoding="utf-8")) if os.path.exists(pj) else {}
    W, H, M = 1440, 1050, 90
    for cid, d in DOCS.items():
        im = Image.new("L", (W, H), 246); g = ImageDraw.Draw(im); y = M
        for fnt, size, text, after in d["blocks"]:
            f = ImageFont.truetype(FONTS + fnt, size)
            for ln in wrap(g, text, f, W - 2 * M):
                tw = g.textlength(ln, font=f); g.text(((W - tw) / 2, y), ln, font=f, fill=20); y += round(size * 1.25)
            y += after
        if y > H - 40: raise SystemExit(f"{cid}: text overflows ({y}px)")
        im = im.crop((0, 0, W, max(round(W / 1.6), y + M)))
        im.save(os.path.join(OUT, cid + ".jpg"), quality=92)
        photos[cid] = {"file": f"photos/{cid}.jpg", "page": d["page"], "licence": d["licence"], "licenceUrl": None, "author": d["author"],
                       "credit": d["credit"], "cardCredit": d["cardCredit"], "w": im.width, "h": im.height, "modified": True, "doc": True,
                       "note": d["note"], "pos": [0.5, 0.0], "source": d["page"], "suggest": {"line": d["line"], "caption": d["caption"]}, "checked": TODAY}
        print("doc", cid, im.size)
    json.dump(photos, open(pj, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

if __name__ == "__main__":
    make_docs() if "--docs" in sys.argv else main()
