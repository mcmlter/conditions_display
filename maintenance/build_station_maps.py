#!/usr/bin/env python3
"""
Build the station-centred relief maps (img/maps/<code>-relief.jpg) used for
stations that don't have a satellite image yet, and print each one's `map:`
entry for SITES in config.js.

    python maintenance/build_station_maps.py              # all stations below
    python maintenance/build_station_maps.py mism flmm    # just these

Source: the USGS Ross Island & Dry Valleys 1:250,000 shaded-relief map in this
folder (3400 x 2199 px, ~70 m/px, not georeferenced). The scan is a conic
projection, so meridians are straight lines through one centre point and
parallels are circles around it; the graticule tick marks on the map frame
(measured once, below) pin that down to well under a pixel.

Needs Python 3.9+, numpy and Pillow.
"""

import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SRC = HERE / "RossIsland_DryValleys_250kDRG_HighRes.gif"
OUT = ROOT / "img" / "maps"

CROP = (340, 177)   # source px (~24 x 12 km), about the map panel's shape
SCALE = 2           # output is CROP x SCALE px

# Station GPS positions (MCM LTER). Add a station here to make its map.
STATIONS = {
    "boym": (-77.71473, 162.4647), "tarm": (-77.74020, 162.1284), "ho2m": (-77.62399, 162.8995),
    "caam": (-77.61315, 162.9647), "frlm": (-77.61130, 163.1701), "hodm": (-77.67108, 163.0784),
    "cohm": (-77.56453, 163.2826), "exem": (-77.58870, 163.4175), "brhm": (-77.43350, 162.7036),
    "vaam": (-77.52567, 161.6913), "viam": (-77.37735, 161.7991),
}

# Graticule ticks on the map frame (source pixels).
TOP, BOTTOM, LEFT, RIGHT = 162, 2055.5, 114, 3265.5
TICK_LON = np.arange(161, 170)
TICK_TOP = np.array([286.0, 644.0, 1001.0, 1358.5, 1715.0, 2072.0, 2429.5, 2787.0, 3145.5])
TICK_BOTTOM = np.array([399.5, 724.5, 1049.5, 1374.5, 1699.0, 2023.5, 2348.5, 2674.0, 2999.5])
TICK_LAT = np.array([-77, -77.25, -77.5, -77.75, -78])
TICK_LEFT = np.array([354.0, 749.0, 1143.5, 1538.0, 1932.5])
TICK_RIGHT = np.array([377.5, 773.0, 1168.0, 1562.5, 1957.5])


def projection():
    """Fit the conic projection: centre, angle(lon) and radius(lat)."""
    d = np.c_[TICK_BOTTOM - TICK_TOP, np.full(len(TICK_LON), BOTTOM - TOP)]
    n = np.c_[d[:, 1], -d[:, 0]] / np.sqrt((d ** 2).sum(1))[:, None]
    cc = np.linalg.lstsq(n, (n * np.c_[TICK_TOP, np.full(len(TICK_LON), TOP)]).sum(1), rcond=None)[0]
    fa = np.polyfit(TICK_LON, np.arctan2(TICK_TOP - cc[0], cc[1] - TOP), 1)
    rad = (np.hypot(LEFT - cc[0], TICK_LEFT - cc[1]) + np.hypot(RIGHT - cc[0], TICK_RIGHT - cc[1])) / 2
    fr = np.polyfit(TICK_LAT, rad, 2)

    def to_px(lat, lon):
        a, r = np.polyval(fa, lon), np.polyval(fr, lat)
        return cc[0] + r * math.sin(a), cc[1] - r * math.cos(a)
    return to_px


def main():
    codes = sys.argv[1:] or list(STATIONS)
    to_px = projection()
    src = Image.open(SRC).convert("RGB")
    OUT.mkdir(parents=True, exist_ok=True)
    cw, ch = CROP
    for code in codes:
        sx, sy = to_px(*STATIONS[code])
        x0 = int(round(min(max(sx - cw / 2, LEFT + 1), RIGHT - 1 - cw)))
        y0 = int(round(min(max(sy - ch / 2, TOP + 1), BOTTOM - 1 - ch)))
        img = src.crop((x0, y0, x0 + cw, y0 + ch)).resize((cw * SCALE, ch * SCALE), Image.LANCZOS)
        out = OUT / f"{code}-relief.jpg"
        img.save(out, quality=84, optimize=True)
        print(f"  {code}: map: {{ src: 'img/maps/{out.name}', size: [{cw * SCALE}, {ch * SCALE}], "
              f"dot: [{100 * (sx - x0) / cw:.1f}, {100 * (sy - y0) / ch:.1f}], "
              f"credit: 'Map: USGS 1:250,000 shaded relief' }}")


if __name__ == "__main__":
    main()
