# Maintenance

Developer notes for the MCM Conditions Display. Nothing in this folder is loaded by
the page; it's the source material and scripts for the pre-built files the page
uses (station maps, the QR code, `climatology/`).

| Path | What it's for |
|---|---|
| `maintenance/README.md` | This file |
| `maintenance/build_station_maps.py` | Builds the station-centred relief maps in `img/maps/` |
| `maintenance/RossIsland_DryValleys_250kDRG_HighRes.gif` | Source map for `build_station_maps.py` (USGS, 3.7 MB) |
| `maintenance/make_qr.py` | Makes the "Learn more" QR code, `img/qr-learn-more.svg` |
| `maintenance/build_climatology.py` | Builds the historical averages and records in `climatology/` |
| `climatology_sources.json` (repository root) | EDI package for each station, read by `build_climatology.py` |

Run every command below from the repository root.

## Running the page locally

    python3 -m http.server 8000

Then open <http://localhost:8000/>. The layout is sized for a 16:9 screen of any
resolution, from a 1080p TV up to a 3 × 3 wall of 1080p screens (5760 × 3240). Add `?demo` to the URL for synthetic data
if the data proxy isn't reachable from your machine, and `?site=boym` (any station
code) to stay on one station. Settings (timing, the 12-hour freshness window, the
24-hour trend window, tiles, stations, footer text and logos) are in `config.js`.

## Station photos

Drop the original photos in `img/station-photos-original/`, named by station code (e.g. `boym.jpg`;
`hoem` is treated as `ho2m`), then run

    python maintenance/build_photos.py

It turns them the right way up, scales them to 2400 px on the long edge (sharp even on a
3 × 3 video wall) and writes `img/station-photos/<code>.jpg`. Point the station's `photo` in
config.js at that file; `photo: null` shows a "photo coming soon" placeholder.

- Landscape photos fill the panel and are cropped top and bottom. If the station gets cut
  off, add `photoFocus` (a CSS position: `'50% 10%'` keeps the top, `'50% 90%'` the bottom).
- Portrait photos (much taller than the panel) are shown whole, over a blurred copy of
  themselves, so the mast isn't cropped.

`img/station-photos-original/` holds full-size originals; the site only uses `img/station-photos/`, so the
originals can be moved out of the repo to keep it small.

## Station maps

Each station's `map` is an image plus where the station is on it:

    map: { src: 'img/maps/boym-relief.jpg', size: [680, 354], dot: [49.9, 50.1], credit: 'Map: USGS 1:250,000 shaded relief' }

- `size` is the image's width and height in pixels.
- `dot` is the station's position, as a percentage of the width and height.
- `credit` is shown in small text in the map's corner.

The page shows as much of the image as fits the panel, keeping the dot and its label
in view, so images a little wider and taller than the panel (about 2 : 1) work best.

Every station uses a crop of the USGS 1:250,000 shaded-relief map centred on the
station (about 24 × 12 km). The scan is about 70 m per pixel, so on a very large
screen (e.g. a 3 × 3 video wall) the maps are soft but still read well; a sharper
source would be needed to improve on that. To use a different image for a station,
save it in `img/maps/` and change that station's `map` entry, with the image's own
credit.

To rebuild the relief maps, e.g. after adding a station to the list at the top of
the script (needs numpy and Pillow):

    python maintenance/build_station_maps.py           # all stations
    python maintenance/build_station_maps.py mism      # just one

It prints each station's `map:` entry for config.js.

## "Learn more" QR code

`img/qr-learn-more.svg` points at <https://mcm.lternet.edu/>. To point it elsewhere
(needs `pip install qrcode`), run the script, then change
`CONFIG.footer.learnMore.url` in config.js to match:

    python maintenance/make_qr.py https://example.org/

## Updating the historical data

The averages and records are pre-computed into `climatology/<station>/<MM>.json`
(one small file per station per month) by `maintenance/build_climatology.py`, from the
MCM LTER met data on EDI. To build or refresh them (needs Python 3.9+ and pandas):

1. `climatology_sources.json` (repository root) already lists each station's EDI
   package (from <https://mcm.lternet.edu/meteorology-datasets/>) and its
   "high-frequency data" table. Edit it only to add a station, e.g.
   `"mism": { "edi": "knb-lter-mcm.7020", "entity": "high-frequency" }`, or to use
   downloaded CSVs instead: `"csv": ["path/to/file.csv"]`.
2. If EDI asks for an API key, create one in EDI's IAM (avatar menu → Access Keys)
   and either `export EDI_API_KEY=...` or save it in `maintenance/.edi_key` (git-ignored).
   The script adds it to each request; without one it connects anonymously.
3. Check the columns are found: `python maintenance/build_climatology.py --check`
4. Build: `python maintenance/build_climatology.py`, then commit the `climatology/` folder.

Source timestamps are assumed to be UTC+13, like the loggers (`--utc-offset` changes
that). Values carrying a data flag are left out. Stations without files simply show
no average line or records. The script's header lists the optional per-station
settings (`entity`, `station`, `columns`, `time_format`).
