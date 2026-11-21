// The world: the Quad Cities (Davenport, Bettendorf, Rock Island, Moline and the towns round them), streamed in 200 m tiles (see src/city/). This file keeps the small API
// the rest of the game uses: ground height, land/water, walls, line of sight, places and area names.
import { D, G, tiles, loadData, roofAt, surfaceHeight, buildingKindAt, groundHeight, terrainHeight, isLand, offMap, WATER_Y, hoodAt, nearestEdge, edgesNear, sidewalkSpot, nearestHospital, route, district, classAt, C, ensureRoads, roadsReady, townAt } from './city/data.js';
import { pushOutCircle, rayBuildings, rayGround, lineOfSight, boxesNear, wallNormal } from './city/collide.js';
import { initStream, updateStream, preload, prefetch, setDetailRadius, setPropQuality, footprintsNear, builtTiles, on as onStream } from './city/stream.js';
import { M } from './city/mats.js';

export { sidewalkSpot, edgesNear, tiles, roofAt, surfaceHeight, buildingKindAt, ensureRoads, roadsReady, townAt };
export { wallNormal, D, G, groundHeight, terrainHeight, isLand, offMap, WATER_Y, pushOutCircle, rayBuildings, rayGround, lineOfSight, boxesNear, nearestEdge, route, district, classAt, C, preload, prefetch, footprintsNear, builtTiles, onStream, setDetailRadius, setPropQuality };
export const SWIM_Y = WATER_Y - 0.8; // where a swimmer's feet are
// Materials the day/night + weather system tweaks at runtime.
export const env = { glowSpots: [] };
export const places = {};

export async function initWorld(scene, quality) {
  await loadData();
  initStream(scene, quality);
  env.buildings = M.building; env.signs = M.signs; env.ground = M.terrain; env.roads = M.road; env.water = M.water; env.lampMat = M.lamp; env.poolMat = M.lpool; env.farBox = M.farBox;
  places.hospitals = D.index.hospitals; places.police = D.index.police; places.fire = D.index.fire;
  places.menu = { x: -40, z: 120 }; // looking over the riverfront downtown
  places.towns = D.index.towns;
  await ensureRoads(-1000, -900, 1000, 900); // downtown Davenport's streets: the menu view and the first stores
}
// keep the road chunks round you loaded (and the nearest hospital's, so a respawn there has its streets)
let roadT = 0;
export function updateWorld(px, pz, dt) {
  updateStream(px, pz, dt);
  if ((roadT -= dt) <= 0) {
    roadT = 2;
    ensureRoads(px - 1200, pz - 1200, px + 1200, pz + 1200);
    const h = nearestHospital(px, pz); if (h) ensureRoads(h.x - 300, h.z - 300, h.x + 300, h.z + 300);
  }
}

// The towns you can start in (main menu "Start in"), biggest first.
export const START_TOWNS = ['Davenport', 'Bettendorf', 'Rock Island', 'Moline', 'East Moline', 'Le Claire', 'Port Byron', 'Milan', 'Silvis', 'Colona', 'Coal Valley', 'Geneseo'];
export const startTowns = () => START_TOWNS.filter((n) => D.index.towns.some((t) => t.name === n));
// A sidewalk spot near the middle of a town ('Random' = any of them); loads that town's streets first.
export async function spawnIn(name = 'Random') {
  const list = startTowns(), pickName = name === 'Random' || !list.includes(name) ? list[Math.floor(Math.random() * list.length)] : name;
  const t = D.index.towns.find((tw) => tw.name === pickName);
  if (!t) return sidewalkSpot();
  // the busy middle: near the town's place node, a bit further out in the big cities
  const r = t.name === 'Davenport' ? 1500 : Math.min(500, Math.max(200, t.r * 0.35));
  await ensureRoads(t.x - r - 500, t.z - r - 500, t.x + r + 500, t.z + r + 500);
  let sp = null;
  for (let i = 0; i < 12 && (!sp || townAt(sp.x, sp.z) !== t); i++) sp = t.name === 'Davenport' ? sidewalkSpot() : sidewalkSpot({ x: t.x, z: t.z, r }); // inside the town limits
  return { ...sp, town: t.name };
}
// Where you left off (saved profile): that exact spot on foot, else (car, water, a shop inside) the nearest sidewalk.
export async function spawnNear(x, z, h = 0, exact = true) {
  await ensureRoads(x - 500, z - 500, x + 500, z + 500);
  if (exact && isLand(x, z) && !offMap(x, z)) return { x, z, h };
  return sidewalkSpot({ x, z, r: 60 });
}
// A random sidewalk spot somewhere in the loaded streets (downtown Davenport at start).
export function randomSpawn() { return sidewalkSpot(); }
// Outside the hospital nearest to (x, z).
export function hospitalSpawn(x, z) {
  const h = nearestHospital(x, z) || { x: 0, z: -150 };
  const s = sidewalkSpot({ x: h.x, z: h.z, r: 70 });
  return { ...s, name: h.name };
}

// [area, street] for the HUD.
export function areaAt(x, z) {
  if (!isLand(x, z)) { let best = null; for (const w of D.index.waters || []) if (x > w.box[0] && x < w.box[2] && z > w.box[1] && z < w.box[3] && (!best || w.a < best.a)) best = w; return [best ? best.name : 'Mississippi River', '']; }
  const e = nearestEdge(x, z, 16);
  return [hoodAt(x, z), e && e.e.name ? e.e.name : ''];
}

// A spot in the right-hand lane of a road minD..maxD from (x, z), facing toward it.
export function roadSpot(x, z, minD, maxD) {
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, d = minD + Math.random() * (maxD - minD);
    const q = nearestEdge(x + Math.cos(a) * d, z + Math.sin(a) * d, 50, (e) => e.cls !== 'service' && !e.bridge && e.cls !== 'motor');
    if (!q) continue;
    const dd = Math.hypot(q.x - x, q.z - z); if (dd < minD * 0.7 || dd > maxD * 1.3) continue;
    return laneFacing(q, x, z);
  }
  return null;
}
// The road next to a building (a station, a hospital), in the lane heading toward (tx, tz).
export function roadNear(px, pz, tx, tz) {
  const q = nearestEdge(px, pz, 120, (e) => e.cls !== 'motor' && !e.bridge);
  return q ? laneFacing(q, tx, tz) : null;
}
function laneFacing(q, tx, tz) {
  let h = q.h; if (Math.sin(h) * (tx - q.x) + Math.cos(h) * (tz - q.z) < 0) h += Math.PI;
  const lane = q.e.width / 4;
  return { x: q.x - Math.cos(h) * lane, z: q.z + Math.sin(h) * lane, h };
}

