// Counts what the built map data holds per town: buildings (OSM / Microsoft footprints), road edges and their length,
// and the data sizes. `node map-stats.mjs <label>` saves cache/stats-<label>.json; `node map-stats.mjs <label> <before>`
// also prints the change from an earlier run. Reads ../data one file at a time (small memory).
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const DATA = process.env.MAP_OUT || here('../data/');
const [label = 'now', before] = process.argv.slice(2);
const I = JSON.parse(fs.readFileSync(DATA + 'index.json'));
const inRing = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) if ((p[i + 1] > z) !== (p[j + 1] > z) && x < ((p[j] - p[i]) * (z - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) c = !c; return c; };
const cache = new Map();
const townAt = (x, z) => {
  const k = Math.floor(x / 100) * 100000 + Math.floor(z / 100); if (cache.has(k)) return cache.get(k);
  const cx = Math.floor(x / 100) * 100 + 50, cz = Math.floor(z / 100) * 100 + 50;
  const t = I.towns.find((tw) => (tw.rings.length ? tw.rings.some((r) => inRing(cx, cz, r)) : Math.hypot(tw.x - cx, tw.z - cz) < tw.r));
  const n = t ? t.name : '(country)'; cache.set(k, n); return n;
};
const S = { towns: {}, tiles: 0, tileBytes: 0, tileMax: 0, tileMaxKey: '', roadBytes: 0, roadMax: 0, buildings: 0, ms: 0, edges: 0, km: 0 };
const T = (n) => (S.towns[n] = S.towns[n] || { b: 0, ms: 0, edges: 0, km: 0 });
for (const f of fs.readdirSync(DATA + 'tiles')) {
  const s = fs.readFileSync(DATA + 'tiles/' + f, 'utf8'), j = JSON.parse(s), [tx, tz] = f.replace('.json', '').split('_').map(Number);
  S.tiles++; S.tileBytes += s.length; if (s.length > S.tileMax) { S.tileMax = s.length; S.tileMaxKey = f; }
  for (const b of j.b || []) {
    const r = b[0]; let cx = 0, cz = 0; for (let i = 0; i < r.length; i += 2) { cx += r[i]; cz += r[i + 1]; } cx = cx / (r.length / 2) + tx * 200; cz = cz / (r.length / 2) + tz * 200;
    const t = T(townAt(cx, cz)), ms = b[7] && b[7].ms ? 1 : 0; t.b++; t.ms += ms; S.buildings++; S.ms += ms;
  }
}
const seen = new Set();
for (const f of fs.readdirSync(DATA + 'roads')) {
  const s = fs.readFileSync(DATA + 'roads/' + f, 'utf8'), j = JSON.parse(s); S.roadBytes += s.length; S.roadMax = Math.max(S.roadMax, s.length);
  for (const e of j.e) {
    if (seen.has(e[0])) continue; seen.add(e[0]);
    const p = e[10]; let L = 0; for (let i = 2; i < p.length; i += 2) L += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
    const t = T(townAt(p[0], p[1])); t.edges++; t.km += L / 1000; S.edges++; S.km += L / 1000;
  }
}
for (const t of Object.values(S.towns)) t.km = Math.round(t.km * 10) / 10;
S.km = Math.round(S.km);
fs.writeFileSync(here(`cache/stats-${label}.json`), JSON.stringify(S, null, 1));
const B = before ? JSON.parse(fs.readFileSync(here(`cache/stats-${before}.json`))) : null;
const d = (a, b) => (B ? `${b ?? 0} -> ${a}` : `${a}`);
const order = Object.keys(S.towns).sort((a, b) => S.towns[b].b - S.towns[a].b);
console.log('town'.padEnd(18), 'buildings (ms)'.padEnd(26), 'road edges'.padEnd(18), 'road km');
for (const n of order) { const t = S.towns[n], o = B?.towns[n]; console.log(n.padEnd(18), `${d(t.b, o?.b)} (${t.ms})`.padEnd(26), d(t.edges, o?.edges).padEnd(18), d(t.km, o?.km)); }
console.log(`total buildings ${d(S.buildings, B?.buildings)} (ms ${S.ms}), edges ${d(S.edges, B?.edges)}, road km ${d(S.km, B?.km)}`);
console.log(`tiles ${S.tiles}: ${d((S.tileBytes / 1e6).toFixed(1), B && (B.tileBytes / 1e6).toFixed(1))} MB, biggest ${d((S.tileMax / 1e3).toFixed(0), B && (B.tileMax / 1e3).toFixed(0))} KB (${S.tileMaxKey}); roads ${d((S.roadBytes / 1e6).toFixed(1), B && (B.roadBytes / 1e6).toFixed(1))} MB, biggest chunk ${(S.roadMax / 1e3).toFixed(0)} KB`);
