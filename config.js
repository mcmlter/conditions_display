/* =============================================================
   MCM Conditions Display — config.js
   Everything you're likely to want to tweak lives here.
   ============================================================= */

'use strict';

const CONFIG = {
  // Cloudflare worker that serves the logger files as CSV.
  // Production origin is https://mcmlter.github.io (see CORS_HEADERS in proxy.js).
  proxyBase: 'https://mcm-proxy.uwcfl.workers.dev',

  rotateSeconds: 60,          // how long each site stays on screen

  // ?site=random shows one of these (picked at random on each page load) and
  // stays on it, like ?site=<code>.
  randomSites: ['tarm', 'viam', 'boym'],
  freshHours: 12,             // skip sites whose newest record is older than this

  // When to ask the proxy for a site again (see fetchDue in app.js). The
  // loggers upload every 6 hours, so a site that has data isn't re-fetched
  // until 6 h 10 min after its newest observation; if that upload is late,
  // it's re-asked every lateRecheckMinutes until new data arrives.
  updateHours: 6,
  updateGraceMinutes: 10,
  lateRecheckMinutes: 30,
  noDataRecheckHours: 3,      // nothing within freshHours, or the proxy returned an error: recheck this often
  errorRecheckMinutes: 10,    // no answer at all (network drop / timeout): try again after this
  fetchTimeoutSeconds: 10,    // give up on a request (and try the next site) after this
  trendHours: 24,             // sparkline + range window, back from the site's latest observation

  // Display zone for observation times and the header clock. Fixed UTC+13 to
  // match the logger clocks year-round. (IANA "Etc/GMT-13" means UTC+13;
  // the sign is inverted by convention.) Use 'Antarctica/McMurdo' instead to
  // follow NZ daylight saving.
  timeZone: 'Etc/GMT-13',
  timeZoneLabel: 'UTC+13',

  // Loggers record in fixed UTC+13. The proxy stamps rows with "+13:00";
  // this is used only if a timestamp arrives without an offset.
  loggerUtcOffset: '+13:00',

  // Pre-computed historical averages / records (maintenance/build_climatology.py).
  // Set to null to turn the average lines and records off.
  climatologyPath: 'climatology',

  // Wind-direction arrows along the wind trend line (one per time block,
  // averaged, pointing the way the wind blows). Blocks are sized so arrows sit
  // about `spacingRem` apart (scales with the display, like the arrows
  // themselves); screens narrower than `minScreenPx` get none.
  // Set to null to turn them off.
  windArrows: { spacingRem: 2.2, minScreenPx: 701 },

  // Optional live satellite map tiles (Web Mercator x / y / z) for the map
  // panel instead of the images in SITES, centred on each station's lat / lon
  // and about `spanKm` across, e.g.
  //   { url: 'https://…/{z}/{x}/{y}', spanKm: 32, maxZoom: 15, credit: '…' }
  // If the tile under a station fails to load, that station uses its image.
  satelliteTiles: null,

  // Bottom row: credit line, "Learn more" QR code and partner logos.
  footer: {
    credit: 'These data brought to you by the McMurdo Dry Valleys Long-Term Ecological Research Project',
    learnMore: { url: 'https://mcm.lternet.edu/', qr: 'img/qr-learn-more.svg' },
    logos: [
      { src: 'img/logos/mcm-lter-white.png', alt: 'McMurdo Dry Valleys LTER' },
      { src: 'img/logos/instaar.png', alt: 'INSTAAR, University of Colorado Boulder' },
      { src: 'img/logos/nsf.png', alt: 'U.S. National Science Foundation' },
      { src: 'img/logos/lter-network-square.png', alt: 'LTER Network' },
    ],
  },
};

const MS_TO_KT = 1.94384;

// ─── Tiles, in display order (2 × 2: air temperature, solar / wind, pressure) ───
// field  = column name in the proxy CSV
// scale  = optional multiplier applied to the raw value
// digits = decimals shown
// series = optional list of {field, name} to show several readings in one tile
// wide   = span two columns (3-column desktop grid: 3 tiles on top, wide + 1 below)
// minSpan = smallest y-range the sparkline draws (keeps sensor noise flat)
// clim    = climatology key for a dashed historical-average line (air_temp, rh, solar)
// records = climatology key for the record high/low at this date + hour (air_temp)
// badIfAllZero = treat as no data if every reading in the trend window is exactly 0
// windChill = { windField, veryCold, warm }: show "Feels like" from this wind column
//             (m/s, same row). The box is solid blue at or below `veryCold`, red
//             above `warm` (°C), pale blue in between.
// tendency  = { hours, steady }: Rising/Falling vs. the reading `hours` earlier;
//             changes smaller than `steady` (in display units) count as Steady
const VARIABLES = {
  met: [
    { id: 'air_temp', field: 'air_temp_3m', label: 'Air Temperature', unit: '°C', digits: 1, minSpan: 2, windChill: { windField: 'wind_spd_avg', veryCold: -25, warm: 0 }, clim: 'air_temp', records: 'air_temp' },
    // Relative humidity isn't on the display layout; to bring it back, add this line
    // (and give .tiles-panel .tiles a third column or row in style.css):
    // { id: 'rh', field: 'rel_hum_3m', label: 'Relative Humidity', unit: '%', digits: 0, minSpan: 10, badIfAllZero: true, clim: 'rh' },
    { id: 'solar', field: 'sw_rad_in', label: 'Solar Radiation', unit: 'W/m²', digits: 0, minSpan: 50, clim: 'solar' },
    { id: 'wind', field: 'wind_spd_avg', label: 'Wind', unit: 'kt', digits: 1, minSpan: 5, scale: MS_TO_KT, dirField: 'wind_direction', gustField: 'wind_spd_max', dirArrows: true },
    { id: 'pressure', field: 'barom_pres', label: 'Pressure', unit: 'hPa', digits: 1, minSpan: 2, tendency: { hours: 3, steady: 1 } },
  ],
};

// ─── Sites, in rotation order ─────────────────────────────────
// prep  = word before the name in the title ("Current Conditions at Lake Bonney")
// photo = station photo (display copy from maintenance/build_photos.py), or null
//         for a "photo coming soon" placeholder. Landscape photos fill the panel,
//         cropped around the centre (or `photoFocus`, e.g. '70% 50%' to keep the
//         right-hand side); portrait photos are shown whole over a blurred copy.
// map   = the little map: image, its pixel size, the station's position on it
//         (% of width / height, red dot) and the credit shown in its corner.
//         Each is a 32 km, station-centred crop of the 10 m satellite GeoTIFF
//         (maintenance/build_station_maps.py).
const SITES = [
  { code: 'boym', type: 'met', name: 'Lake Bonney', prep: 'at', photo: 'img/station-photos/boym.jpg',
    lat: -77.71473, lon: 162.4647,
    map: { src: 'img/maps/boym.jpg', size: [2560, 1333], dot: [50.0, 50.0], credit: 'Contains modified Copernicus Sentinel data 2026' } },
  { code: 'tarm', type: 'met', name: 'Taylor Glacier', prep: 'on', photo: 'img/station-photos/tarm.jpg',
    lat: -77.7402, lon: 162.1284,
    map: { src: 'img/maps/tarm.jpg', size: [2560, 1333], dot: [50.0, 50.0], credit: 'Contains modified Copernicus Sentinel data 2026' } },
  { code: 'ho2m', type: 'met', name: 'Lake Hoare', prep: 'at', photo: 'img/station-photos/ho2m.jpg', photoFocus: '50% 10%',
    lat: -77.62399, lon: 162.8995,
    map: { src: 'img/maps/ho2m.jpg', size: [2560, 1333], dot: [50.0, 50.0], credit: 'Contains modified Copernicus Sentinel data 2026' } },
  { code: 'caam', type: 'met', name: 'Canada Glacier', prep: 'on', photo: 'img/station-photos/caam.jpg', photoFocus: '50% 90%',
    lat: -77.61315, lon: 162.9647,
    map: { src: 'img/maps/caam.jpg', size: [2560, 1333], dot: [50.0, 50.0], credit: 'Contains modified Copernicus Sentinel data 2026' } },
  { code: 'frlm', type: 'met', name: 'Lake Fryxell', prep: 'at', photo: 'img/station-photos/frlm.jpg',
    lat: -77.6113, lon: 163.1701,
    map: { src: 'img/maps/frlm.jpg', size: [2560, 1333], dot: [50.0, 50.0], credit: 'Contains modified Copernicus Sentinel data 2026' } },
  { code: 'hodm', type: 'met', name: 'Howard Glacier', prep: 'on', photo: null,
    lat: -77.67108, lon: 163.0784,
    map: { src: 'img/maps/hodm.jpg', size: [2560, 1333], dot: [50.0, 50.0], credit: 'Contains modified Copernicus Sentinel data 2026' } },
  { code: 'cohm', type: 'met', name: 'Commonwealth Glacier', prep: 'on', photo: null,
    lat: -77.56453, lon: 163.2826,
    map: { src: 'img/maps/cohm.jpg', size: [2560, 1333], dot: [50.0, 50.0], credit: 'Contains modified Copernicus Sentinel data 2026' } },
  { code: 'exem', type: 'met', name: "Explorer's Cove", prep: 'at', photo: null,
    lat: -77.5887, lon: 163.4175,
    map: { src: 'img/maps/exem.jpg', size: [2560, 1333], dot: [50.0, 50.0], credit: 'Contains modified Copernicus Sentinel data 2026' } },
  { code: 'brhm', type: 'met', name: 'Lake Brownworth', prep: 'at', photo: null,
    lat: -77.4335, lon: 162.7036,
    map: { src: 'img/maps/brhm.jpg', size: [2560, 1333], dot: [50.0, 50.0], credit: 'Contains modified Copernicus Sentinel data 2026' } },
  { code: 'vaam', type: 'met', name: 'Lake Vanda', prep: 'at', photo: 'img/station-photos/vaam.jpg', photoFocus: '50% 80%',
    lat: -77.52567, lon: 161.6913,
    map: { src: 'img/maps/vaam.jpg', size: [2560, 1333], dot: [50.0, 50.0], credit: 'Contains modified Copernicus Sentinel data 2026' } },
  { code: 'viam', type: 'met', name: 'Lake Vida', prep: 'at', photo: 'img/station-photos/viam.jpg',
    lat: -77.37735, lon: 161.7991,
    map: { src: 'img/maps/viam.jpg', size: [2560, 1333], dot: [50.0, 50.0], credit: 'Contains modified Copernicus Sentinel data 2026' } },
];
