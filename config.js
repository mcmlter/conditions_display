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
  freshHours: 12,             // skip sites whose newest record is older than this
  recheckStaleMinutes: 10,    // after a site is stale/unreachable, wait this long before asking again
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

  // Bottom row: credit line, "Learn more" QR code and partner logos.
  footer: {
    credit: 'These data brought to you by the McMurdo Dry Valleys Long-Term Ecological Research Project',
    learnMore: { url: 'https://mcm.lternet.edu/', qr: 'img/qr-learn-more.svg' },
    logos: [
      { src: 'img/logos/mcm-lter-white.png', alt: 'McMurdo Dry Valleys LTER' },
      { src: 'img/logos/nsf.png', alt: 'U.S. National Science Foundation' },
      { src: 'img/logos/instaar.png', alt: 'INSTAAR, University of Colorado Boulder' },
      { src: 'img/logos/lter-network.png', alt: 'NSF LTER Network', wide: true },
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
//         All stations use a station-centred crop of the USGS 1:250,000
//         shaded-relief map (maintenance/build_station_maps.py).
const SITES = [
  { code: 'boym', type: 'met', name: 'Lake Bonney', prep: 'at', photo: 'img/station-photos/boym.jpg',
    map: { src: 'img/maps/boym-relief.jpg', size: [680, 354], dot: [49.9, 50.1], credit: 'Map: USGS 1:250,000 shaded relief' } },
  { code: 'tarm', type: 'met', name: 'Taylor Glacier', prep: 'on', photo: 'img/station-photos/tarm.jpg',
    map: { src: 'img/maps/tarm-relief.jpg', size: [680, 354], dot: [50.1, 50.2], credit: 'Map: USGS 1:250,000 shaded relief' } },
  { code: 'ho2m', type: 'met', name: 'Lake Hoare', prep: 'at', photo: 'img/station-photos/ho2m.jpg', photoFocus: '50% 10%',
    map: { src: 'img/maps/ho2m-relief.jpg', size: [680, 354], dot: [50.1, 49.9], credit: 'Map: USGS 1:250,000 shaded relief' } },
  { code: 'caam', type: 'met', name: 'Canada Glacier', prep: 'on', photo: 'img/station-photos/caam.jpg', photoFocus: '50% 90%',
    map: { src: 'img/maps/caam-relief.jpg', size: [680, 354], dot: [50.0, 50.1], credit: 'Map: USGS 1:250,000 shaded relief' } },
  { code: 'frlm', type: 'met', name: 'Lake Fryxell', prep: 'at', photo: 'img/station-photos/frlm.jpg',
    map: { src: 'img/maps/frlm-relief.jpg', size: [680, 354], dot: [50.0, 49.8], credit: 'Map: USGS 1:250,000 shaded relief' } },
  { code: 'hodm', type: 'met', name: 'Howard Glacier', prep: 'on', photo: null,
    map: { src: 'img/maps/hodm-relief.jpg', size: [680, 354], dot: [50.1, 50.2], credit: 'Map: USGS 1:250,000 shaded relief' } },
  { code: 'cohm', type: 'met', name: 'Commonwealth Glacier', prep: 'on', photo: null,
    map: { src: 'img/maps/cohm-relief.jpg', size: [680, 354], dot: [49.9, 50.1], credit: 'Map: USGS 1:250,000 shaded relief' } },
  { code: 'exem', type: 'met', name: "Explorer's Cove", prep: 'at', photo: null,
    map: { src: 'img/maps/exem-relief.jpg', size: [680, 354], dot: [50.0, 50.2], credit: 'Map: USGS 1:250,000 shaded relief' } },
  { code: 'brhm', type: 'met', name: 'Lake Brownworth', prep: 'at', photo: null,
    map: { src: 'img/maps/brhm-relief.jpg', size: [680, 354], dot: [50.0, 50.1], credit: 'Map: USGS 1:250,000 shaded relief' } },
  { code: 'vaam', type: 'met', name: 'Lake Vanda', prep: 'at', photo: 'img/station-photos/vaam.jpg', photoFocus: '50% 80%',
    map: { src: 'img/maps/vaam-relief.jpg', size: [680, 354], dot: [50.1, 49.8], credit: 'Map: USGS 1:250,000 shaded relief' } },
  { code: 'viam', type: 'met', name: 'Lake Vida', prep: 'at', photo: null,
    map: { src: 'img/maps/viam-relief.jpg', size: [680, 354], dot: [50.0, 49.8], credit: 'Map: USGS 1:250,000 shaded relief' } },
];
