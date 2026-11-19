// Navigation: a walkable-area mesh built from the island (buildings cut out), plus a "crowd" that
// steers people around walls and each other. Used whenever an NPC leaves its normal route
// (fleeing, fighting, cops on foot, yanked drivers).
import { init, Crowd, NavMeshQuery, generateTiledNavMesh } from '../vendor/recast.js';
import * as W from './world.js';

let crowd = null, query = null, ready = false;
export const navReady = () => ready;

function boxTris(pos, idx, b) {
  const base = pos.length / 3;
  for (const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) for (const y of [0, b.h]) {
    pos.push(b.cx + b.ux * b.hu * a + b.vx * b.hv * c, y, b.cz + b.uz * b.hu * a + b.vz * b.hv * c);
  }
  // corners 0..3 bottom/top pairs: (i*2) bottom, (i*2+1) top
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4, b0 = base + i * 2, b1 = base + j * 2;
    idx.push(b0, b1, b1 + 1, b0, b1 + 1, b0 + 1);
  }
  idx.push(base + 1, base + 3, base + 5, base + 1, base + 5, base + 7);
}

export async function initNav() {
  await init();
  const t0 = performance.now();
  const pos = [...W.navSource.pos], idx = [...W.navSource.idx];
  // the visible ground is drawn double-sided with downward-facing triangles; Recast needs them facing up
  for (let t = 0; t < idx.length; t += 3) { const k = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = k; }
  for (const b of W.colliders) if (b.h > 0.6) boxTris(pos, idx, b);
  // built in 48 m tiles: a single piece would be too big for the island (and later for the city)
  const { success, navMesh, error } = generateTiledNavMesh(pos, idx, {
    tileSize: 80,
    cs: 0.6, ch: 0.2, walkableSlopeAngle: 40, walkableHeight: 9, walkableClimb: 3, walkableRadius: 1,
    maxEdgeLen: 20, maxSimplificationError: 1.3, minRegionArea: 8, mergeRegionArea: 20,
    maxVertsPerPoly: 6, detailSampleDist: 6, detailSampleMaxError: 1,
  });
  if (!success) { console.warn('navmesh failed', error); return false; }
  query = new NavMeshQuery(navMesh);
  crowd = new Crowd(navMesh, { maxAgents: 90, maxAgentRadius: 0.6 });
  ready = true;
  console.info(`navmesh ready in ${Math.round(performance.now() - t0)} ms`);
  return true;
}

export function addAgent(x, z, speed = 5) {
  if (!ready) return null;
  const p = query.findClosestPoint({ x, y: 0.5, z }, { halfExtents: { x: 4, y: 4, z: 4 } });
  if (!p.success) return null;
  return crowd.addAgent(p.point, { radius: 0.45, height: 1.8, maxAcceleration: 24, maxSpeed: speed, collisionQueryRange: 4, pathOptimizationRange: 15, separationWeight: 2.5 });
}
export function removeAgent(a) { if (a && ready) crowd.removeAgent(a); }
export function setSpeed(a, speed) { if (a) a.updateParameters({ maxSpeed: speed }); }
export function moveTo(a, x, z) {
  if (!a) return false;
  const p = query.findClosestPoint({ x, y: 0.5, z }, { halfExtents: { x: 8, y: 4, z: 8 } });
  return p.success && a.requestMoveTarget(p.point);
}
// A reachable spot roughly `dist` metres away from (fx, fz), as seen from (x, z).
export function fleeTarget(a, x, z, fx, fz, dist = 35) {
  const dx = x - fx, dz = z - fz, l = Math.hypot(dx, dz) || 1;
  const tx = x + (dx / l) * dist, tz = z + (dz / l) * dist;
  const r = query.findRandomPointAroundCircle({ x: tx, y: 0.5, z: tz }, 12, { halfExtents: { x: 10, y: 4, z: 10 } });
  if (r.success) a.requestMoveTarget(r.randomPoint); else moveTo(a, tx, tz);
}
export function agentState(a) {
  const p = a.interpolatedPosition, v = a.velocity();
  return { x: p.x, z: p.z, vx: v.x, vz: v.z, speed: Math.hypot(v.x, v.z) };
}
export function updateNav(dt) { if (ready) crowd.update(Math.min(dt, 0.1)); }
