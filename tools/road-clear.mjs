// Keeps buildings and trees off the road carriageways. Shared by build-map.mjs (a fresh build) and fix-road-overlaps.mjs
// (which post-processes an existing data/ folder), so both make the same call.
//
// A building goes when a road surface covers a real part of it (measured 0.6 m in from the kerb, so one that only
// touches the kerb line stays: OSM road widths are estimates):
//   - 20% or more of its footprint is a through road's carriageway (10% for Microsoft footprints: those carry no tags,
//     and the ones on roads are usually trucks, trailers or a misplaced trace), or
//   - a through road's centre line runs 4 m or more inside it and it's under 2500 m2 (a big plant crossed by a mapped
//     road keeps its building), or
//   - half of it (a quarter for Microsoft footprints) is service road or track and it's under 800 m2. Service roads
//     clip into big buildings all the time (loading docks, hotel drop-offs, ramps): those stay.
// Kept: tunnels / building passages (OSM tunnel tag), roofs, carports and canopies (fuel stations, drive-throughs),
// parking ramps crossed by their own service roads, and anything under a bridge deck that clears its roof.
// A tree goes when its trunk is on the carriageway (0.4 m in from the kerb), unless a bridge deck passes 6 m above it.

const SEG = 25; // segment grid cell (m)

// edges: [{pts: [[x, z], ...], width, flags, bridge, ya, yb, rise, cls}]  (cls: 'motor' ... 'service', 'track')
export function roadIndex(edges) {
  const grid = new Map(), E = [];
  for (const e of edges) {
    if (!e || e.flags & 1 || !e.pts || e.pts.length < 2) continue; // tunnels are underground
    const cum = [0]; for (let i = 1; i < e.pts.length; i++) cum.push(cum[i - 1] + Math.hypot(e.pts[i][0] - e.pts[i - 1][0], e.pts[i][1] - e.pts[i - 1][1]));
    const ei = E.length; E.push({ ...e, cum, len: cum[cum.length - 1] || 1 });
    const pad = e.width / 2 + 1;
    for (let i = 1; i < e.pts.length; i++) {
      const [ax, az] = e.pts[i - 1], [bx, bz] = e.pts[i];
      for (let gx = Math.floor((Math.min(ax, bx) - pad) / SEG); gx <= Math.floor((Math.max(ax, bx) + pad) / SEG); gx++)
        for (let gz = Math.floor((Math.min(az, bz) - pad) / SEG); gz <= Math.floor((Math.max(az, bz) + pad) / SEG); gz++) {
          const k = gx * 1e6 + gz; let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(ei, i);
        }
    }
  }
  // segments near a box: [edgeIndex, segIndex, ...] (deduped)
  function segsIn(x0, z0, x1, z1) {
    const out = [], seen = new Set();
    for (let gx = Math.floor(x0 / SEG); gx <= Math.floor(x1 / SEG); gx++) for (let gz = Math.floor(z0 / SEG); gz <= Math.floor(z1 / SEG); gz++) {
      const a = grid.get(gx * 1e6 + gz); if (!a) continue;
      for (let q = 0; q < a.length; q += 2) { const key = a[q] * 65536 + a[q + 1]; if (seen.has(key)) continue; seen.add(key); out.push(a[q], a[q + 1]); }
    }
    return out;
  }
  // deck height of a bridge edge at distance s along it (src/city/data.js edgeY)
  const deckY = (e, s) => { const k = Math.max(0, Math.min(1, s / e.len)); return e.ya + (e.yb - e.ya) * (k * k * (3 - 2 * k)) + (e.rise ? e.rise * 4 * k * (1 - k) : 0); };
  // distance from (x, z) to segment i of e, and the distance along e there
  function segDist(e, i, x, z) {
    const [ax, az] = e.pts[i - 1], [bx, bz] = e.pts[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    return [Math.hypot(ax + dx * t - x, az + dz * t - z), e.cum[i - 1] + t * Math.sqrt(L2)];
  }
  // is (x, z) on a carriageway, `inset` metres in from its kerb? clear(e, s): skip this edge here (a deck high above)
  function onRoad(x, z, inset, segs, clear) {
    for (let q = 0; q < segs.length; q += 2) {
      const e = E[segs[q]], [d, s] = segDist(e, segs[q + 1], x, z);
      if (d < e.width / 2 - inset && !(e.bridge && clear && clear(e, s))) return e;
    }
    return null;
  }

  // ring: [[x, z], ...] world metres; base: footprint base height; h: height; info: {type, kind, ms, area}
  // -> null (keep) or {why, frac, area, cross, cls}
  function buildingHit(ring, base, h, info = {}) {
    if (info.type === 'roof' || info.type === 'carport' || info.type === 'canopy') return null;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of ring) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    const segs = segsIn(x0 - 20, z0 - 20, x1 + 20, z1 + 20); if (!segs.length) return null;
    const top = base + Math.max(3, h || 0) + 0.5;
    const clear = (e, s) => deckY(e, s) > top; // a deck over the roof
    const minor = (e) => e.cls === 'service' || e.cls === 'track';
    const ok = (e) => !(info.kind === 1 && (e.cls === 'service' || e.cls === 'track')); // a ramp's own drive
    let area = info.area; if (!area) { area = 0; for (let i = 0; i < ring.length; i++) { const [a, b] = ring[i], [c, d] = ring[(i + 1) % ring.length]; area += a * d - c * b; } area = Math.abs(area) / 2; }
    const st = Math.max(0.7, Math.sqrt(area / 400));
    let n = 0, hitT = 0, hitS = 0, cls = null, scls = null;
    for (let z = z0 + st / 2; z < z1; z += st) for (let x = x0 + st / 2; x < x1; x += st) {
      if (!inRing(x, z, ring)) continue;
      n++; const e = onRoad(x, z, 0.6, segs, clear); if (!e || !ok(e)) continue;
      if (minor(e)) { hitS++; scls = scls || e.cls; } else { hitT++; cls = cls || e.cls; }
    }
    if (!n) return null;
    const fT = hitT / n, fS = (hitT + hitS) / n;
    // centre line of a through road inside the footprint (1 m steps, 1 m in from its outline)
    let cross = 0;
    for (let q = 0; q < segs.length; q += 2) {
      const e = E[segs[q]]; if (minor(e)) continue;
      const i = segs[q + 1], [ax, az] = e.pts[i - 1], [bx, bz] = e.pts[i], L = Math.hypot(bx - ax, bz - az);
      for (let s = 0; s <= L; s += 1) {
        const x = ax + (bx - ax) * s / L, z = az + (bz - az) * s / L;
        if (x < x0 || x > x1 || z < z0 || z > z1 || !inRing(x, z, ring) || ringDist(x, z, ring) < 1) continue;
        if (e.bridge && clear(e, e.cum[i - 1] + s)) continue;
        cross++; cls = cls || e.cls;
      }
    }
    const why = fT >= (info.ms ? 0.1 : 0.2) ? 'through-road' : cross >= 4 && area < 2500 ? 'centre-line'
      : fS >= (info.ms ? 0.25 : 0.5) && area < 800 ? 'service-road' : null;
    const frac = Math.round((why === 'service-road' ? fS : fT) * 100) / 100;
    return why ? { why, frac, area: Math.round(area), cross, cls: why === 'service-road' ? scls || cls : cls } : null;
  }
  // a tree trunk at (x, z) on ground height y: on a carriageway (inset metres in from the kerb)? -> the edge or null
  function pointHit(x, z, inset = 0.4, y = null) {
    const segs = segsIn(x - 20, z - 20, x + 20, z + 20); if (!segs.length) return null;
    return onRoad(x, z, inset, segs, (e, s) => y != null && deckY(e, s) > y + 6);
  }
  return { buildingHit, pointHit, edges: E };
}

export function inRing(x, z, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) if ((P[i][1] > z) !== (P[j][1] > z) && x < ((P[j][0] - P[i][0]) * (z - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c;
  return c;
}
function ringDist(x, z, P) {
  let best = Infinity;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [ax, az] = P[j], [bx, bz] = P[i], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    best = Math.min(best, Math.hypot(ax + dx * t - x, az + dz * t - z));
  }
  return best;
}
