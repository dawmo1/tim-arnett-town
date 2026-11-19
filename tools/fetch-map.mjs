// Downloads the raw map data for Davenport once and caches it in tools/cache/.
//   - OpenStreetMap features via the Overpass API (© OpenStreetMap contributors, ODbL)
//   - Elevation from the open AWS Terrain Tiles (terrarium PNGs)
// Run: cd tools && npm run fetch
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BBOX } from './map-config.mjs';

const CACHE = fileURLToPath(new URL('./cache/', import.meta.url));
mkdirSync(CACHE, { recursive: true });
const UA = { 'User-Agent': 'TimArnettTown-mapbuilder/1.0 (hobby browser game)' };
const { s, w, n, e } = BBOX;
const bb = `${s},${w},${n},${e}`;

const QUERIES = {
  roads: `[out:json][timeout:180];(way["highway"](${bb}););out geom tags;`,
  buildings: `[out:json][timeout:240];(way["building"](${bb});relation["building"](${bb}););out geom tags;`,
  areas: `[out:json][timeout:240];(
    way["landuse"](${bb});way["leisure"](${bb});way["natural"](${bb});way["amenity"="parking"](${bb});way["waterway"="riverbank"](${bb});
    relation["natural"="water"](${bb});relation["landuse"](${bb});relation["leisure"](${bb});relation["amenity"="parking"](${bb});
  );out geom tags;`,
  rail: `[out:json][timeout:120];(way["railway"~"rail|abandoned|disused"](${bb}););out geom tags;`,
  points: `[out:json][timeout:120];(
    node["highway"~"traffic_signals|stop|crossing|bus_stop"](${bb});
    node["place"~"neighbourhood|suburb|quarter"](${bb});
    nwr["amenity"~"police|hospital|fire_station|fuel|bar|pub|restaurant|cafe|fast_food|bank|pharmacy|cinema|theatre|college|university|school|place_of_worship|casino"](${bb});
    nwr["shop"](${bb});nwr["tourism"](${bb});nwr["leisure"~"stadium|park|pitch"](${bb});nwr["man_made"~"pier|water_tower"](${bb});
  );out center tags;`,
};

async function overpass(name, q) {
  const file = `${CACHE}${name}.json`;
  if (existsSync(file)) { console.log(`cached  ${name}`); return; }
  for (let attempt = 1; attempt <= 4; attempt++) {
    console.log(`fetch   ${name} (try ${attempt})`);
    const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) });
    if (res.ok) { const t = await res.text(); writeFileSync(file, t); console.log(`saved   ${name} ${(t.length / 1e6).toFixed(1)} MB`); return; }
    console.log(`  status ${res.status}, waiting…`);
    await new Promise((r) => setTimeout(r, 15000 * attempt));
  }
  throw new Error(`Overpass failed for ${name}`);
}

// Terrain tiles (slippy-map tile math)
const Z = 14;
const tx = (lon) => Math.floor(((lon + 180) / 360) * 2 ** Z);
const ty = (lat) => { const r = (lat * Math.PI) / 180; return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** Z); };
async function terrain() {
  mkdirSync(`${CACHE}terrain`, { recursive: true });
  for (let x = tx(w); x <= tx(e); x++) for (let y = ty(n); y <= ty(s); y++) {
    const file = `${CACHE}terrain/${Z}_${x}_${y}.png`;
    if (existsSync(file)) continue;
    const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`, { headers: UA });
    if (!res.ok) throw new Error(`terrain tile ${x},${y}: ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log(`terrain ${x},${y}`);
  }
}

for (const [name, q] of Object.entries(QUERIES)) await overpass(name, q);
await terrain();
console.log('done');
