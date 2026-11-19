// The world: Davenport, Iowa, streamed in 200 m tiles (see src/city/). This file keeps the small API
// the rest of the game uses: ground height, land/water, walls, line of sight, places and area names.
import { D, G, tiles, loadData, groundHeight, terrainHeight, isLand, offMap, WATER_Y, hoodAt, nearestEdge, edgesNear, sidewalkSpot, nearestHospital, route, district, classAt, C } from './city/data.js';
import { pushOutCircle, rayBuildings, rayGround, lineOfSight, boxesNear } from './city/collide.js';
import { initStream, updateStream, preload, setDetailRadius, footprintsNear, builtTiles, on as onStream } from './city/stream.js';
import { M } from './city/mats.js';

export { sidewalkSpot, edgesNear, tiles };
export { D, G, groundHeight, terrainHeight, isLand, offMap, WATER_Y, pushOutCircle, rayBuildings, rayGround, lineOfSight, boxesNear, nearestEdge, route, district, classAt, C, preload, footprintsNear, builtTiles, onStream, setDetailRadius };
export const SWIM_Y = WATER_Y - 0.8; // where a swimmer's feet are
// Materials the day/night + weather system tweaks at runtime.
export const env = { glowSpots: [] };
export const places = {};

export async function initWorld(scene) {
  await loadData();
  initStream(scene);
  env.buildings = M.building; env.ground = M.terrain; env.roads = M.road; env.water = M.water; env.lampMat = M.lamp; env.farBox = M.farBox;
  places.hospitals = D.index.hospitals; places.police = D.index.police; places.fire = D.index.fire;
  places.menu = { x: -40, z: 120 }; // looking over the riverfront downtown
}
export function updateWorld(px, pz, dt) { updateStream(px, pz, dt); }

// A random sidewalk spot somewhere in the playable city.
export function randomSpawn() { return sidewalkSpot(); }
// Outside the hospital nearest to (x, z).
export function hospitalSpawn(x, z) {
  const h = nearestHospital(x, z) || { x: 0, z: -150 };
  const s = sidewalkSpot({ x: h.x, z: h.z, r: 70 });
  return { ...s, name: h.name };
}

// [area, street] for the HUD.
export function areaAt(x, z) {
  if (!isLand(x, z)) return ['Mississippi River', ''];
  const e = nearestEdge(x, z, 16);
  return [hoodAt(x, z), e && e.e.name ? e.e.name : ''];
}
