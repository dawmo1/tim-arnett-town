// Second pass: multipolygon relations with member geometry, clipped to the bbox.
import { writeFileSync } from 'node:fs';
import { BBOX } from './map-config.mjs';
const { s, w, n, e } = BBOX, bb = `${s},${w},${n},${e}`;
const q = `[out:json][timeout:240];(relation["natural"="water"](${bb});relation["landuse"](${bb});relation["leisure"](${bb});relation["amenity"="parking"](${bb});relation["building"](${bb});relation["natural"="wood"](${bb}););out geom(${bb});`;
const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'User-Agent': 'TimArnettTown-mapbuilder/1.0 (hobby browser game)', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) });
if (!res.ok) throw new Error('overpass ' + res.status);
const t = await res.text(); writeFileSync(new URL('./cache/relations.json', import.meta.url), t);
console.log('saved relations', (t.length / 1e6).toFixed(1), 'MB');
