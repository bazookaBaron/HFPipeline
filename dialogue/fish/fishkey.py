"""Load FISH_API_KEY from .vendor-assets/.env (never printed)."""
from pathlib import Path
def key():
    for l in (Path(__file__).resolve().parents[2]/".vendor-assets"/".env").read_text().splitlines():
        if l.startswith("FISH_API_KEY="): return l.split("=",1)[1].strip().strip('"')
