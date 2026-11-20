// Downloads the raw map data for the Quad Cities region once and caches it in tools/cache/.
//   - OpenStreetMap features via the Overpass API (© OpenStreetMap contributors, ODbL), in a grid of chunks
//     (cache/chunks/{query}_{col}_{row}.json). Ways come with their full geometry, so nothing is cut at a chunk
//     edge; build-map.mjs merges the chunks and drops duplicates by OSM id.
//   - Elevation from the open AWS Terrain Tiles (terrarium PNGs, zoom 14)
// Run: cd tools && npm run fetch   (safe to re-run: finished chunks are skipped; `node fetch-map.mjs --terrain` = elevation only)
import { mkdirSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BBOX, FETCH_GRID } from './map-config.mjs';

const CACHE = fileURLToPath(new URL('./cache/', import.meta.url));
mkdirSync(CACHE + 'chunks', { recursive: true });
const UA = { 'User-Agent': 'TimArnettTown-mapbuilder/2.0 (hobby browser game)' };
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const head = '[out:json][timeout:300][maxsize:1073741824];';

const QUERIES = {
  // every highway way (roads, service, tracks, paths); build-map picks what's drivable/walkable
  roads: (bb) => `${head}(way["highway"](${bb});way["railway"~"^(rail|tram|light_rail|abandoned|disused|siding|spur|yard)$"](${bb}););out geom;`,
  buildings: (bb) => `${head}(way["building"](${bb});relation["building"](${bb});way["building:part"](${bb}););out geom;`,
  areas: (bb) => `${head}(
    way["landuse"](${bb});way["leisure"](${bb});way["natural"](${bb});way["amenity"~"^(parking|grave_yard|school|college|university|hospital|marketplace)$"](${bb});
    way["waterway"~"^(riverbank|dock)$"](${bb});way["water"](${bb});way["man_made"~"^(pier|breakwater|bridge)$"](${bb});way["aeroway"](${bb});way["golf"](${bb});way["place"="island"](${bb});
    relation["natural"](${bb});relation["landuse"](${bb});relation["leisure"](${bb});relation["amenity"~"^(parking|grave_yard|school|college|university|hospital)$"](${bb});
    relation["waterway"="riverbank"](${bb});relation["water"](${bb});relation["aeroway"](${bb});relation["man_made"~"^(pier|bridge)$"](${bb});
  );out geom;`,
  lines: (bb) => `${head}(
    way["barrier"](${bb});way["power"~"^(line|minor_line|cable)$"](${bb});way["waterway"~"^(river|stream|canal|ditch|drain|dam|weir|lock_gate)$"](${bb});
    way["man_made"~"^(embankment|dyke|pipeline)$"](${bb});way["route"="ferry"](${bb});
  );out geom;`,
  points: (bb) => `${head}(
    node["natural"~"^(tree|peak|spring|cliff)$"](${bb});
    node["highway"~"^(street_lamp|traffic_signals|stop|give_way|crossing|bus_stop|turning_circle|motorway_junction|speed_camera|milestone)$"](${bb});
    node["amenity"](${bb});node["emergency"](${bb});node["power"~"^(pole|tower|transformer|substation)$"](${bb});node["man_made"](${bb});
    node["advertising"](${bb});node["railway"~"^(level_crossing|crossing|station|halt|signal|switch|buffer_stop|stop)$"](${bb});
    node["barrier"](${bb});node["leisure"](${bb});node["tourism"](${bb});node["shop"](${bb});node["office"](${bb});node["craft"](${bb});node["historic"](${bb});node["sport"](${bb});
    node["traffic_sign"](${bb});node["lock"="yes"](${bb});node["waterway"](${bb});node["public_transport"](${bb});node["aeroway"](${bb});
    way["amenity"](${bb});way["shop"](${bb});way["tourism"](${bb});way["leisure"~"^(stadium|park|pitch|golf_course|marina|slipway|sports_centre|nature_reserve)$"](${bb});
    way["man_made"~"^(pier|water_tower|silo|tower|chimney|lighthouse|storage_tank|works)$"](${bb});way["historic"](${bb});way["office"](${bb});way["craft"](${bb});
    relation["amenity"](${bb});relation["shop"](${bb});relation["tourism"](${bb});relation["leisure"~"^(stadium|park|golf_course|nature_reserve)$"](${bb});
  );out center tags;`,
};
// once for the whole region: town limits (admin level 8) + place nodes (towns, neighbourhoods, hamlets)
const REGION = {
  places: (bb) => `${head}(node["place"](${bb}););out body;`,
  towns: (bb) => `${head}(relation["boundary"="administrative"]["admin_level"="8"](${bb}););out geom;`,
  counties: (bb) => `${head}(relation["boundary"="administrative"]["admin_level"="6"](${bb}););out geom(${bb.split(',').map((v, i) => (+v + (i < 2 ? -0.05 : 0.05)).toFixed(3)).join(',')});`,
};

async function overpass(file, q) {
  let ep = 0;
  if (existsSync(file)) return false;
  for (let attempt = 1; attempt <= 30; attempt++) {
    const url = ENDPOINTS[ep % ENDPOINTS.length];
    try {
      const res = await fetch(url, { method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(420000) });
      const t = res.ok ? await res.text() : '';
      // Overpass reports timeouts / out-of-memory inside a 200 response as a "remark"
      if (res.ok && !/"remark"\s*:\s*"[^"]*(runtime error|timed out|out of memory)/i.test(t.slice(-2000))) { writeFileSync(file, t); return t.length; }
      console.log(`  ${url.split('/')[2]} status ${res.status}${res.ok ? ' (runtime error)' : ''}, retrying…`);
    } catch (e) { console.log(`  ${url.split('/')[2]} ${e.message}, retrying…`); }
    ep++; // try the next mirror
    await sleep(Math.min(120000, 15000 * attempt));
  }
  throw new Error(`Overpass failed for ${file}`);
}

const { s, w, n, e } = BBOX, { cols, rows } = FETCH_GRID;
// --terrain: elevation only (the OSM data came from the Geofabrik extracts: npm run pbf)
const osm = !process.argv.includes('--terrain');
if (osm) for (const [name, q] of Object.entries(REGION)) {
  const got = await overpass(`${CACHE}chunks/${name}.json`, q(`${s},${w},${n},${e}`));
  console.log(got === false ? `cached  ${name}` : `saved   ${name} ${(got / 1e6).toFixed(1)} MB`);
}
// two at a time (the public server gives each client two slots)
const jobs = [];
if (osm) for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
  const cs = s + ((n - s) * r) / rows, cn = s + ((n - s) * (r + 1)) / rows, cw = w + ((e - w) * c) / cols, ce = w + ((e - w) * (c + 1)) / cols;
  const bb = `${cs.toFixed(5)},${cw.toFixed(5)},${cn.toFixed(5)},${ce.toFixed(5)}`;
  for (const [name, q] of Object.entries(QUERIES)) jobs.push([`${CACHE}chunks/${name}_${c}_${r}.json`, q(bb), `${name} ${c},${r}`]);
}
await Promise.all([0, 1].map(async () => {
  for (let job; (job = jobs.shift());) {
    const got = await overpass(job[0], job[1]);
    if (got === false) continue;
    console.log(`saved   ${job[2]} ${(got / 1e6).toFixed(1)} MB  (${jobs.length} left)`);
    await sleep(3000); // be polite to the public server
  }
}));

// Terrain tiles (slippy-map tile math), a few at a time
const Z = 14;
const tx = (lon) => Math.floor(((lon + 180) / 360) * 2 ** Z);
const ty = (lat) => { const r = (lat * Math.PI) / 180; return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** Z); };
mkdirSync(`${CACHE}terrain`, { recursive: true });
const todo = [];
for (let x = tx(w) - 1; x <= tx(e) + 1; x++) for (let y = ty(n) - 1; y <= ty(s) + 1; y++) if (!existsSync(`${CACHE}terrain/${Z}_${x}_${y}.png`)) todo.push([x, y]);
async function getTerrain([x, y]) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`, { headers: UA }).catch(() => null);
    if (res && res.ok) { writeFileSync(`${CACHE}terrain/${Z}_${x}_${y}.png`, Buffer.from(await res.arrayBuffer())); return; }
    await sleep(3000 * attempt);
  }
  throw new Error(`terrain tile ${x},${y} failed`);
}
while (todo.length) await Promise.all(todo.splice(0, 6).map(getTerrain));
console.log(`terrain tiles: ${readdirSync(`${CACHE}terrain`).length}`);
console.log('done');
