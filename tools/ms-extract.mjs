// Microsoft US Building Footprints (github.com/microsoft/USBuildingFootprints, ODbL): the buildings OSM hasn't mapped yet.
// Streams the state GeoJSON zips one line (= one footprint) at a time, keeps the footprints whose centre is in the map BBOX
// and writes them projected to local metres: cache/ms/qc.json = [[x, z, x, z, ...], ...] (open rings, 0.1 m).
// build-map.mjs merges them with OSM (OSM wins where they overlap). Memory stays small: nothing but the kept rings is held.
// Download once (approved, ~245 MB, git-ignored):
//   curl -L -o cache/ms/Iowa.geojson.zip https://minedbuildings.z5.web.core.windows.net/legacy/usbuildings-v2/Iowa.geojson.zip
//   curl -L -o cache/ms/Illinois.geojson.zip https://minedbuildings.z5.web.core.windows.net/legacy/usbuildings-v2/Illinois.geojson.zip
// Run: cd tools && npm run ms
import fs from 'node:fs';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { BBOX, project } from './map-config.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const FILES = ['Iowa', 'Illinois'].map((s) => here(`cache/ms/${s}.geojson.zip`)).filter((f) => fs.existsSync(f));
if (!FILES.length) throw new Error('no footprint zips in tools/cache/ms/ (see the header for the download links)');
const M = 0.002; // a little margin for the first-vertex prefilter
const out = [];
let seen = 0;
for (const f of FILES) {
  const unz = spawn('unzip', ['-p', f], { stdio: ['ignore', 'pipe', 'inherit'] });
  const rl = readline.createInterface({ input: unz.stdout, crlfDelay: Infinity });
  for await (const line of rl) {
    const i = line.indexOf('[[['); if (i < 0) continue;
    seen++;
    // cheap prefilter on the first vertex before parsing the line
    const m = /^\[\[\[(-?[\d.]+),(-?[\d.]+)/.exec(line.slice(i)); if (!m) continue;
    const lon = +m[1], lat = +m[2];
    if (lat < BBOX.s - M || lat > BBOX.n + M || lon < BBOX.w - M || lon > BBOX.e + M) continue;
    let g;
    try { g = JSON.parse(line.trim().replace(/,$/, '')).geometry; } catch { continue; }
    const ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0][0] : null;
    if (!ring || ring.length < 4) continue;
    let clat = 0, clon = 0; for (const [x, y] of ring) { clon += x; clat += y; } clat /= ring.length; clon /= ring.length;
    if (clat < BBOX.s || clat > BBOX.n || clon < BBOX.w || clon > BBOX.e) continue;
    const r = []; for (let k = 0; k < ring.length - 1; k++) { const [x, z] = project(ring[k][1], ring[k][0]); r.push(Math.round(x * 10) / 10, Math.round(z * 10) / 10); }
    out.push(r);
  }
  console.log(`${f.split('/').pop()}: ${seen} footprints read, ${out.length} kept so far`);
}
const fd = fs.openSync(here('cache/ms/qc.json'), 'w');
fs.writeSync(fd, '[\n'); out.forEach((r, i) => fs.writeSync(fd, (i ? ',\n' : '') + JSON.stringify(r))); fs.writeSync(fd, '\n]\n'); fs.closeSync(fd);
console.log(`wrote cache/ms/qc.json: ${out.length} footprints, ${(fs.statSync(here('cache/ms/qc.json')).size / 1e6).toFixed(1)} MB`);
