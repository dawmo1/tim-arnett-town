// Placement scan: builds a sample of tiles with the game's own tile builder (headless) and counts street props, signs,
// poles, yard items, lights, trees and parked cars that sit on a road carriageway, inside a junction, or inside a building.
// The tests here are independent of the builder's own placement checks (src/city/detail.js), so they check them.
//   node scan-placement.mjs                      ~25 tiles round each town centre
//   node scan-placement.mjs --box x0,z0,x1,z1    every tile in a box (game metres)   (--region <id>: a region's bounds)
//   node scan-placement.mjs --per 3              3x3 tiles per town instead of 5x5
// Also prints triangle / draw-call counts for the densest tile built (full detail and the far LOD version).
import { ROOT } from './headless.mjs';
const { loadData, D, G, fetchTile, tiles, edgesNear, closestOnEdge, terrainHeight } = await import(ROOT + 'src/city/data.js');
const tileMod = await import(ROOT + 'src/city/tile.js');
const { buildTile } = tileMod;

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
await loadData();
let want = [];
if (arg('--box') || arg('--region')) {
  let b;
  if (arg('--box')) b = arg('--box').split(',').map(Number);
  else { const { REGIONS } = await import(ROOT + 'src/regions/index.js'); b = REGIONS.find((r) => r[0] === arg('--region'))?.slice(1); if (!b) throw new Error('no region ' + arg('--region')); }
  for (let tz = Math.floor(b[1] / 200); tz <= Math.floor(b[3] / 200); tz++) for (let tx = Math.floor(b[0] / 200); tx <= Math.floor(b[2] / 200); tx++) want.push([tx, tz, 'box']);
} else {
  const per = +(arg('--per') || 5), h = Math.floor(per / 2);
  const TOWNS = ['Davenport', 'Bettendorf', 'Le Claire', 'Port Byron', 'Rapids City', 'Hampton', 'Rock Island', 'Milan', 'Moline', 'East Moline', 'Silvis', 'Carbon Cliff', 'Colona', 'Coal Valley', 'Geneseo', 'Riverdale'];
  for (const n of TOWNS) { const t = D.index.towns.find((q) => q.name === n); if (!t) continue; const cx = Math.floor(t.x / 200), cz = Math.floor(t.z / 200); for (let dz = -h; dz <= h; dz++) for (let dx = -h; dx <= h; dx++) want.push([cx + dx, cz + dz, n]); }
}
want = want.filter(([tx, tz]) => D.tileSet.has(`${tx}_${tz}`));
const ROOFY = new Set(['ac', 'tank', 'fesc', 'banner']);
const LINEAR = new Set(['picket', 'chainlink', 'hedge']);
const pip = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) if ((p[i + 1] > z) !== (p[j + 1] > z) && x < ((p[j] - p[i]) * (z - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) c = !c; return c; };
function onRoad(x, z, slack) { // inside a carriageway (slack metres in from its edge) or a junction
  for (const id of edgesNear(x, z, 25)) {
    const e = G.edges[id]; if (!e || (e.flags & 1)) continue;
    const q = closestOnEdge(e, x, z); if (q.d < e.width / 2 - slack && !(e.bridge && q.y - terrainHeight(x, z) > 3)) return e.cls; // (under a high deck is fine)
  }
  for (const id of edgesNear(x, z, 25)) {
    const e = G.edges[id]; if (!e) continue;
    for (const k of [e.a, e.b]) {
      if (G.adj[k].length < 3) continue;
      let hw = 0; for (const a of G.adj[k]) if (G.edges[a]) hw = Math.max(hw, G.edges[a].width / 2);
      if (Math.hypot(G.nodes.x[k] - x, G.nodes.z[k] - z) < hw - 0.3) return 'junction';
    }
  }
  return null;
}
function inBuilding(x, z) {
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const t = tiles.get(`${Math.floor(x / 200) + dx}_${Math.floor(z / 200) + dz}`); if (!t) continue;
    for (const rec of t.b) { if (rec.arch?.canopy) continue; if (pip(x - t.ox, z - t.oz, rec[0])) return true; }
  }
  return false;
}
const V = { items: 0, road: 0, junction: 0, building: 0, byKind: {}, byTown: {}, examples: [] };
const bad = (kind, why, x, z, town) => { V[why === 'building' ? 'building' : why === 'junction' ? 'junction' : 'road']++; V.byKind[kind] = (V.byKind[kind] || 0) + 1; V.byTown[town] = (V.byTown[town] || 0) + 1; if (V.examples.length < 25) V.examples.push(`${kind} ${why} @ ${x.toFixed(1)},${z.toFixed(1)} (${town})`); };
let dense = null, built = 0;
for (const [tx, tz, town] of want) {
  await Promise.all([-1, 0, 1].flatMap((dz) => [-1, 0, 1].map((dx) => (D.tileSet.has(`${tx + dx}_${tz + dz}`) ? fetchTile(tx + dx, tz + dz).catch(() => null) : null))));
  const t = tiles.get(`${tx}_${tz}`); if (!t) continue;
  const rec = buildTile(t); built++;
  let tris = 0, draws = 0; rec.group.traverse((m) => { if (m.geometry) { draws++; tris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; } });
  if (!dense || t.b.length > dense.n) dense = { key: t.key, n: t.b.length, tris, draws, t, junk: rec.junk.length };
  const check = (kind, x, z, slack, bld = true) => {
    if (x < t.ox || x >= t.ox + 200 || z < t.oz || z >= t.oz + 200) return; // counted with its own tile
    V.items++;
    const r = onRoad(x, z, slack); if (r) return bad(kind, r === 'junction' ? 'junction' : 'road:' + r, x, z, town);
    if (bld && inBuilding(x, z)) bad(kind, 'building', x, z, town);
  };
  for (const j of rec.junk) if (!ROOFY.has(j.kind)) check(j.kind, j.x, j.z, LINEAR.has(j.kind) ? 0.3 : 0.05, j.kind !== 'corral');
  for (const l of rec.lights) check(l.lot ? 'lotlight' : l.mapped ? 'lamp(osm)' : 'streetlight', l.x, l.z, 0.05);
  for (const p of rec.posts || []) check(p.kind, p.x, p.z, 0.05);
  for (const tr of rec.trees) check('tree', tr.x, tr.z, 0.4, false); // trunks (OSM trees, tree rows, generated ones)
  for (let i = 0; i < t.k.length; i += 4) check(t.k[i + 3] ? 'car(lot/drive)' : 'car(kerb)', t.k[i] + t.ox, t.k[i + 1] + t.oz, t.k[i + 3] ? 0.3 : 1.6);
}
console.log(`tiles built ${built} (${want.length} wanted); items checked ${V.items}; violations: road ${V.road}, junction ${V.junction}, building ${V.building}`);
console.log('by kind', V.byKind);
console.log('by town', V.byTown);
for (const s of V.examples) console.log('  ', s);
if (dense) {
  console.log(`densest tile ${dense.key}: ${dense.n} buildings, full detail ${Math.round(dense.tris)} triangles in ${dense.draws} draw calls (+${dense.junk} instanced props)`);
  if (tileMod.buildTileLite) { const lr = tileMod.buildTileLite(dense.t); let tr = 0, dr = 0; lr.group.traverse((m) => { if (m.geometry) { dr++; tr += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; } }); console.log(`  far LOD version: ${Math.round(tr)} triangles in ${dr} draw calls`); }
}
