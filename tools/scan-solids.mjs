// Landmark collision check: every region model's `solid` box (src/regions/*.js) that reaches into a road carriageway
// or a junction, so a car would stop dead on an open road. Prints each offender with how far it pokes in.
//   node scan-solids.mjs [--min 0.3]   (metres of overlap to report)
import { ROOT } from './headless.mjs';
const { loadData, G, edgesNear, closestOnEdge, terrainHeight, ensureRoads, fetchTile, D } = await import(ROOT + 'src/city/data.js');
await loadData();
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const MIN = +(arg('--min') || 0.3);
const fs = await import('node:fs');
const files = fs.readdirSync(ROOT + 'src/regions').filter((f) => f.endsWith('.js') && f !== 'index.js');
let bad = 0, total = 0;
for (const f of files) {
  const mod = await import(ROOT + 'src/regions/' + f);
  const R = mod.default || Object.values(mod).find((v) => v && v.models);
  if (!R?.models) continue;
  for (const L of R.models) for (const s of L.solid || []) {
    total++;
    await ensureRoads(s[0] - 60, s[1] - 60, s[0] + 60, s[1] + 60);
    { const tx = Math.floor(s[0] / 200), tz = Math.floor(s[1] / 200); if (D.tileSet.has(tx + '_' + tz)) await fetchTile(tx, tz).catch(() => null); }
    const [cx, cz, hx, hz, h, base = 0, rot = L.h || 0] = s; void base; if (h < 1.2) continue; // kerbs and low steps don't stop a car
    const c = Math.cos(rot), sn = Math.sin(rot);
    // sample the box's footprint on a 0.5 m grid; worst penetration into a carriageway (distance in from the road edge)
    let worst = 0, cls = ''; const hitU = [], hitV = [];
    for (let u = -hx; u <= hx + 1e-6; u += Math.max(0.25, Math.min(0.5, hx))) for (let v = -hz; v <= hz + 1e-6; v += Math.max(0.25, Math.min(0.5, hz))) {
      const x = cx + u * c + v * sn, z = cz - u * sn + v * c;
      for (const id of edgesNear(x, z, 30)) {
        const e = G.edges[id]; if (!e || (e.flags & 1)) continue;
        const q = closestOnEdge(e, x, z); const pen = e.width / 2 - q.d;
        if (pen > 0.05 && !(e.bridge && q.y - terrainHeight(x, z) > 3)) { hitU.push(u); hitV.push(v); if (pen > worst) { worst = pen; cls = e.cls + ' ' + (e.name || '') + ' #' + id; } }
      }
    }
    if (worst > MIN) { bad++; console.log(`${f} ${L.file}: [${s.join(', ')}] pokes ${worst.toFixed(2)} m into ${cls}; on-road part u ${Math.min(...hitU).toFixed(1)}..${Math.max(...hitU).toFixed(1)} v ${Math.min(...hitV).toFixed(1)}..${Math.max(...hitV).toFixed(1)}`); }
  }
}
console.log(`${bad} of ${total} solid boxes reach more than ${MIN} m into a carriageway`);
