#!/usr/bin/env python3
"""
Build the station-centred satellite maps (img/maps/<code>.jpg) for the map
panel, and print each one's `map:` entry for SITES in config.js.

    python maintenance/build_station_maps.py              # all stations below
    python maintenance/build_station_maps.py mism flmm    # just these
    python maintenance/build_station_maps.py --tif /path/to/MDV_region_highres.tif

Source: maintenance/MDV_region_highres.tif, a 10 m/px true-colour GeoTIFF of
the McMurdo Dry Valleys region (WGS 84 / UTM zone 58S, ~1.5 GB, uncompressed).
It is too big for git, so it is listed in .gitignore; keep a copy outside the
repo and put it back here (or pass --tif) to rebuild the maps.

Needs Python 3.9+ and: pip install numpy pillow tifffile pyproj
"""

import argparse
from pathlib import Path

import numpy as np
import tifffile
from PIL import Image
from pyproj import Transformer

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
TIF = HERE / "MDV_region_highres.tif"
OUT = ROOT / "img" / "maps"

SPAN_KM = 32        # ground width of each map
ASPECT = 1.92       # width : height (about the map panel's shape; the page trims the rest)
WIDTH = 2560        # output width in px (~12.5 m/px: sharp on a 3 x 3 video wall)
CREDIT = "Contains modified Copernicus Sentinel data 2026"

# Station GPS positions (MCM LTER). Add a station here to make its map.
STATIONS = {
    "boym": (-77.71473, 162.4647), "tarm": (-77.74020, 162.1284), "ho2m": (-77.62399, 162.8995),
    "caam": (-77.61315, 162.9647), "frlm": (-77.61130, 163.1701), "hodm": (-77.67108, 163.0784),
    "cohm": (-77.56453, 163.2826), "exem": (-77.58870, 163.4175), "brhm": (-77.43350, 162.7036),
    "vaam": (-77.52567, 161.6913), "viam": (-77.37735, 161.7991),
}


def open_geotiff(path):
    """The image (memory-mapped) and a lat/lon -> (col, row) function."""
    with tifffile.TiffFile(path) as t:
        page = t.pages[0]
        sx, sy = page.tags["ModelPixelScaleTag"].value[:2]
        x0, y0 = page.tags["ModelTiepointTag"].value[3:5]
        epsg = page.geotiff_tags["ProjectedCSTypeGeoKey"]
    to_xy = Transformer.from_crs(4326, int(epsg), always_xy=True)

    def to_px(lat, lon):
        e, n = to_xy.transform(lon, lat)
        return (e - x0) / sx, (y0 - n) / sy
    return tifffile.memmap(path), to_px, sx


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("codes", nargs="*", help="station codes (default: all)")
    ap.add_argument("--tif", default=TIF, type=Path)
    args = ap.parse_args()

    img, to_px, res = open_geotiff(args.tif)
    rows, cols = img.shape[:2]
    cw = round(SPAN_KM * 1000 / res)
    ch = round(cw / ASPECT)
    height = round(WIDTH / ASPECT)
    OUT.mkdir(parents=True, exist_ok=True)
    for code in args.codes or list(STATIONS):
        sx, sy = to_px(*STATIONS[code])
        x0 = int(round(min(max(sx - cw / 2, 0), cols - cw)))
        y0 = int(round(min(max(sy - ch / 2, 0), rows - ch)))
        crop = Image.fromarray(np.ascontiguousarray(img[y0:y0 + ch, x0:x0 + cw, :3]))
        crop = crop.resize((WIDTH, height), Image.LANCZOS)
        out = OUT / f"{code}.jpg"
        crop.save(out, quality=80, optimize=True, progressive=True)
        print(f"    map: {{ src: 'img/maps/{out.name}', size: [{WIDTH}, {height}], "
              f"dot: [{100 * (sx - x0) / cw:.1f}, {100 * (sy - y0) / ch:.1f}], credit: '{CREDIT}' }}"
              f"  # {code}, {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
