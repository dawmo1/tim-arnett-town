// Scans the built map (../data) for buildings and trees standing on a road carriageway, with the same test a fresh
// build uses (road-clear.mjs), and with --write takes them out of the tile files in place. The 4 m ground cells a
// removed building covered go back to road (or lawn) so no grey building pad is left under the street.
//   node --max-old-space-size=1024 fix-road-overlaps.mjs            report only
//   node --max-old-space-size=1024 fix-road-overlaps.mjs --write    edit data/tiles
//   --list out.json   save every hit (tile, kind, x, z, why ...) for screenshots / review
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { roadIndex, inRing } from './road-clear.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const DATA = process.env.MAP_OUT || here('../data/');
const WRITE = process.argv.includes('--write');
const listAt = process.argv.indexOf('--list'), LIST = listAt > 0 ? process.argv[listAt + 1] : null;
const I = JSON.parse(fs.readFileSync(DATA + 'index.json'));
const CLASSES = I.roads.classes;
const C_ROAD = 9, C_BUILDING = 11, C_LAWN = 0;

// the road graph, all chunks (edges repeat across chunks: keep the first)
const nodeY = new Map(), raw = new Map();
for (const f of fs.readdirSync(DATA + 'roads')) {
  const r = JSON.parse(fs.readFileSync(DATA + 'roads/' + f));
  for (let i = 0; i < r.n.length; i += 6) nodeY.set(r.n[i], r.n[i + 3]);
  for (const e of r.e) if (!raw.has(e[0])) raw.set(e[0], e);
}
const edges = [];
for (const [, a, b, cls, , , , , bridge, width, flat, flags = 0, , , , rise = 0] of raw.values()) {
  const pts = []; for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
  edges.push({ pts, width, flags, bridge: !!bridge, ya: nodeY.get(a) ?? 0, yb: nodeY.get(b) ?? 0, rise, cls: CLASSES[cls] });
}
raw.clear();
const R = roadIndex(edges);
console.log(`road edges ${edges.length}`);

// tile ground heights (src/city/data.js decodeHeights), metres
function heights(j) {
  if (typeof j.h === 'number') return new Float32Array(676).fill(j.h / 100);
  const out = new Float32Array(676);
  if (!j.hd) { const u = Buffer.from(j.h, 'base64'); for (let k = 0; k < 676; k++) out[k] = u.readInt16LE(k * 2) / 100; return out; }
  const u = Buffer.from(j.hd, 'base64'), i16 = (p) => ((u[p] | (u[p + 1] << 8)) << 16) >> 16;
  let q = i16(0), p = 2; out[0] = q * 2 / 100;
  for (let k = 1; k < 676; k++) { const d = u[p++]; if (d === 128) { q = i16(p); p += 2; } else q += (d << 24) >> 24; out[k] = q * 2 / 100; }
  return out;
}
const hAt = (H, lx, lz) => { const fx = Math.max(0, Math.min(24.999, lx / 8)), fz = Math.max(0, Math.min(24.999, lz / 8)), i = Math.floor(fx), j = Math.floor(fz), ax = fx - i, az = fz - j; return (H[j * 26 + i] * (1 - ax) + H[j * 26 + i + 1] * ax) * (1 - az) + (H[j * 26 + 26 + i] * (1 - ax) + H[j * 26 + 27 + i] * ax) * az; };
const classes = (j) => { if (j.c) return Uint8Array.from(Buffer.from(j.c, 'base64')); const u = Buffer.from(j.cr, 'base64'), out = new Uint8Array(2500); for (let p = 0, k = 0; p < u.length; p += 2) { out.fill(u[p], k, k + u[p + 1]); k += u[p + 1]; } return out; };
function encodeClasses(CL) { // build-map.mjs encodeClasses
  const rle = []; for (let k = 0; k < CL.length;) { let n = 1; while (k + n < CL.length && CL[k + n] === CL[k] && n < 255) n++; rle.push(CL[k], n); k += n; }
  return rle.length < CL.length ? { cr: Buffer.from(rle).toString('base64') } : { c: Buffer.from(CL).toString('base64') };
}

const S = { tiles: 0, changed: 0, bld: 0, bldMs: 0, bldOsm: 0, why: {}, byCls: {}, trees: 0, cells: 0, bytesBefore: 0, bytesAfter: 0 };
const hits = [];
for (const f of fs.readdirSync(DATA + 'tiles')) {
  const [tx, tz] = f.slice(0, -5).split('_').map(Number), ox = tx * 200, oz = tz * 200;
  const txt = fs.readFileSync(DATA + 'tiles/' + f, 'utf8'), j = JSON.parse(txt); S.tiles++;
  if (!j.b?.length && !j.t?.length) continue;
  const H = heights(j);
  const gone = [];
  const keep = (j.b || []).filter((rec) => {
    const [rel, base, h, , , name, kind, x = {}] = rec, ring = [];
    for (let i = 0; i < rel.length; i += 2) ring.push([rel[i] + ox, rel[i + 1] + oz]);
    const hit = R.buildingHit(ring, base, h, { type: x.t, kind, ms: !!x.ms });
    if (!hit) return true;
    let cx = 0, cz = 0; for (const [a, b] of ring) { cx += a; cz += b; } cx /= ring.length; cz /= ring.length;
    S.bld++; x.ms ? S.bldMs++ : S.bldOsm++; S.why[hit.why] = (S.why[hit.why] || 0) + 1; S.byCls[hit.cls] = (S.byCls[hit.cls] || 0) + 1;
    hits.push({ tile: f.slice(0, -5), what: 'building', x: Math.round(cx), z: Math.round(cz), y: base, h, ms: !!x.ms, id: x.id, type: x.t, name, ...hit });
    gone.push(ring);
    return false;
  });
  const T = j.t || [], tOut = [];
  for (let i = 0; i < T.length; i += 4) {
    const x = T[i] + ox, z = T[i + 1] + oz, e = R.pointHit(x, z, 0.4, hAt(H, T[i], T[i + 1]));
    if (e) { S.trees++; hits.push({ tile: f.slice(0, -5), what: 'tree', x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, cls: e.cls }); continue; }
    tOut.push(T[i], T[i + 1], T[i + 2], T[i + 3]);
  }
  if (!gone.length && tOut.length === T.length) continue;
  S.changed++;
  if (gone.length) { // building cells under a removed footprint, outside every kept one: road where the road is, else lawn
    const CL = classes(j); let n = 0;
    const kept = keep.map((rec) => { const r = []; for (let i = 0; i < rec[0].length; i += 2) r.push([rec[0][i] + ox, rec[0][i + 1] + oz]); return r; });
    for (let cj = 0; cj < 50; cj++) for (let ci = 0; ci < 50; ci++) {
      const k = cj * 50 + ci; if (CL[k] !== C_BUILDING) continue;
      const x = ox + ci * 4 + 2, z = oz + cj * 4 + 2;
      if (!gone.some((r) => inRing(x, z, r)) || kept.some((r) => inRing(x, z, r))) continue;
      CL[k] = R.pointHit(x, z, -1, null) ? C_ROAD : C_LAWN; n++;
    }
    if (n) { delete j.c; delete j.cr; Object.assign(j, encodeClasses(CL)); S.cells += n; }
  }
  j.b = keep; j.t = tOut;
  // keep the key order build-map writes (h/hd, c/cr, b, t, k, e, p, l, a)
  const order = ['h', 'hd', 'c', 'cr', 'b', 't', 'k', 'e', 'p', 'l', 'a'], o = {};
  for (const k of order) if (k in j) o[k] = j[k];
  for (const k of Object.keys(j)) if (!(k in o)) o[k] = j[k];
  const out = JSON.stringify(o);
  S.bytesBefore += txt.length; S.bytesAfter += out.length;
  if (WRITE) fs.writeFileSync(DATA + 'tiles/' + f, out);
}
console.log(`tiles ${S.tiles}, changed ${S.changed}${WRITE ? ' (written)' : ' (dry run)'}`);
console.log(`buildings on roads: ${S.bld} (OSM ${S.bldOsm}, Microsoft ${S.bldMs}) by reason ${JSON.stringify(S.why)} by road class ${JSON.stringify(S.byCls)}`);
console.log(`trees on roads: ${S.trees}; ground cells repainted ${S.cells}; changed tiles ${(S.bytesBefore / 1e6).toFixed(2)} MB -> ${(S.bytesAfter / 1e6).toFixed(2)} MB`);
if (LIST) fs.writeFileSync(LIST, JSON.stringify(hits, null, 0));
