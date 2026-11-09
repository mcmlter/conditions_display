#!/usr/bin/env python3
"""
Make the display copies of the station photos.

    python maintenance/build_photos.py

Reads the full-size photos in img/station-photos-original/ (any name starting with a station
code, e.g. boym.JPG, ho2m.jpg; "hoem" is accepted for Lake Hoare) and writes
img/station-photos/<code>.jpg: upright (camera rotation applied), at most 2400 px on the
long side and about 0.3-0.8 MB, which stays sharp even on a 3 x 3 video wall.
Point a station's `photo` in config.js at its img/station-photos/ file.

Needs Pillow.
"""

from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "img" / "station-photos-original", ROOT / "img" / "station-photos"
CODES = {"boym", "tarm", "ho2m", "caam", "frlm", "hodm", "cohm", "exem", "brhm", "vaam", "viam"}
ALIASES = {"hoem": "ho2m"}   # Lake Hoare's earlier station code
LONG_EDGE = 2400

OUT.mkdir(exist_ok=True)
for f in sorted(SRC.iterdir()):
    stem = f.stem.lower()
    code = ALIASES.get(stem, stem)
    if code not in CODES or f.suffix.lower() not in {".jpg", ".jpeg", ".png", ".tif", ".tiff"}:
        print(f"  skip {f.name}")
        continue
    im = ImageOps.exif_transpose(Image.open(f)).convert("RGB")
    im.thumbnail((LONG_EDGE, LONG_EDGE), Image.LANCZOS)
    out = OUT / f"{code}.jpg"
    im.save(out, quality=82, optimize=True, progressive=True)
    print(f"  {f.name} -> {out.relative_to(ROOT)}  {im.size[0]} x {im.size[1]}  {out.stat().st_size // 1024} KB")
