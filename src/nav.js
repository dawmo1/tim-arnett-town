// Navigation: a walkable-area mesh (buildings cut out), plus a "crowd" that
// steers people around walls and each other. Used whenever an NPC leaves its normal route
// (fleeing, fighting, cops on foot, yanked drivers).

let crowd = null, query = null; const ready = false;
export const navReady = () => ready;

// The island's baked navmesh is gone; city pedestrians walk the sidewalk network instead.
// Until a city navmesh exists every caller falls back to steering straight with wall push-out.
export async function initNav() { return false; }

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
  // position(), not interpolatedPosition: the interpolated value only updates in fixed-step mode
  const p = a.position(), v = a.velocity();
  return { x: p.x, z: p.z, vx: v.x, vz: v.z, speed: Math.hypot(v.x, v.z) };
}
export function updateNav(dt) { if (ready) crowd.update(Math.min(dt, 0.1)); }
