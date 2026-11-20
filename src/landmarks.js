// The Quad Cities' landmarks and the moving river/rail world, hand-built on top of the map data:
// the Centennial and Government bridge structures (every real bridge is drivable from the road data), the lit Skybridge, Modern Woodmen Park with its
// Ferris wheel and light towers, the LeClaire Park bandshell, the Vander Veer fountain, the Adler
// marquee, the Hotel Blackhawk sign, NorthPark's sign, "Re-elect Mayor Tim Arnett" billboards,
// a made-up riverboat casino, barge tows on the Mississippi up to Le Claire, freight trains on the real lines with
// crossing gates, the Channel Cat water taxi, "Welcome to ___" signs at the real town limits, speedboats, and a
// helicopter on a downtown rooftop (stairs from the street).
// Trains, barges and the Channel Cat run on the shared clock, so every player sees them in the same place.
import * as THREE from 'three';
import * as W from './world.js';
import { G, D, pointOnEdge, terrainHeight, WATER_Y, lots } from './city/data.js';
import { addBoxes, makeBox } from './city/collide.js';
import { mat } from './character.js';
import { textTexture } from './util.js';
import { loadLazy, dropLazy } from './assets.js';
import { addHall, removeHall } from './interiors.js';

let scene, ctx;
const night = [];  // [material, max emissive] lit at night
const built = new Set();
let ferris = null, wheelT = 0, fountain = null;
export const doors = []; // {x, y, z, to: {x, y, z, h}, label}

export function initLandmarks(s, c) {
  scene = s; ctx = c;
  initTrain(); initRiver(); initFerry(); initBillboards(); initModels();
  W.onStream('built', (t) => tryBuild(t));
  for (const rec of W.builtTiles.values()) tryBuild(rec.t);
}
const box = (g, c, sx, sy, sz, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m || mat(c)); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
const glow = (color, k = 1) => { const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0, roughness: 0.4 }); night.push([m, k]); return m; };
const group = (x, y, z, h = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = h; scene.add(g); return g; };
function signMesh(lines, w, h, opts) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: textTexture(lines, opts), side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: 0, emissiveMap: textTexture(lines, opts) })); night.push([m.material, opts.glow ?? 0.6]); return m; }
const near = (t, x, z) => Math.abs(t.ox + 100 - x) < 260 && Math.abs(t.oz + 100 - z) < 260;

// Build each landmark once, when the tiles around it have loaded (so it sits on real ground).
function tryBuild(t) {
  const todo = [
    ...(D.index.crossings || []).map((cr, i) => ['crossing' + i, () => t.ox + TILE_M > cr.box[0] - 300 && t.ox < cr.box[2] + 300 && t.oz + TILE_M > cr.box[1] - 300 && t.oz < cr.box[3] + 300 && buildCrossing(cr)]),
    ['skybridge', () => near(t, 225, 390) && buildSkybridge()],
    ['ballpark', () => near(t, -372, 559) && buildBallpark(-372, 559)],
    ['fountain', () => near(t, 197, -2183) && buildFountain(197, -2183)],
    ['casino', () => near(t, 520, 330) && buildCasino(520)],
    ['northpark', () => near(t, 290, -4413) && buildRoofSign(290, -4413, 'NORTHPARK', '#ffffff', 22)],
    ['helipad', () => near(t, 150, 120) && buildHelipad()],
    ['marina', () => near(t, 2605, -561) && buildMarina(2605, -561)],
    ['leclaire-boats', () => near(t, -60, 520) && buildMarina(-60, 470)],
  ];
  for (const [k, fn] of todo) if (!built.has(k) && fn()) built.add(k);
  buildSigns(t);
}
const TILE_M = 200;
// first water when walking from (x, z) in direction (dx, dz)
function waterFrom(x, z, dx, dz, max = 800) { for (let d = 0; d < max; d += 4) if (!W.isLand(x + dx * d, z + dz * d)) return { x: x + dx * d, z: z + dz * d }; return null; }

// ---------- Blender landmarks (assets/src/landmarks.py -> assets/models/landmarks/<file>.glb) ----------
// Each model is built around its anchor (game x/z), base at y, facing as in the city. The OSM buildings
// under `clear` ([cx, cz, half x, half z]) are dropped from the tile data (city/data.js lots), `solid`
// ([cx, cz, half x, half z, height, base above y, heading (default the model's)]) are its walls. Models stream in within LOAD m and out past DROP m.
const MODELS = [
  { file: 'blackhawk', x: 451.6, z: 96.5, y: 7.5, clear: [[451.6, 96.5, 21, 18]], solid: [[448.25, 86.9, 21.15, 12.7, 50], [472.75, 91, 3.35, 8.6, 50], [433.35, 109.2, 6.25, 9.6, 10],
    [469.85, 109.2, 6.25, 9.6, 10], [451.6, 109.2, 24.5, 9.6, 40, 10], ...roomWalls(451.6, 109.2, 0, 24, 18.4, 10, [['s', -2, 2]])] }, // lobby (blackhawk_int) behind the 3rd St doors
  { file: 'adler', x: 342.4, z: 91.2, y: 8.6, clear: [[342.4, 91.2, 18, 16.5]], solid: [[342.4, 104.7, 19.7, 5.2, 21, 6.8], [342.4, 86, 19.7, 13.5, 10, 18.5], [327.35, 104.7, 4.65, 5.2, 7],
    [357.45, 104.7, 4.65, 5.2, 7], ...roomWalls(342.4, 104.7, 0, 20, 9.4, 7, [['s', -3, 3], ['n', -4, 4]]), ...roomWalls(342.4, 86.05, 0, 37.8, 25.1, 19, [['s', -4, 4]]),
    [342.4, 77.5, 18.9, 4.5, 1.1]] }, // lobby + auditorium (adler_int); the stage
  { file: 'figge', x: 109, z: 340, y: 3.4, clear: [[109, 340, 46, 18]], solid: [[109, 340, 46, 18, 19, 7], [66, 340, 4, 18, 7], [152, 340, 4, 18, 7],
    ...roomWalls(109, 340, 0, 78, 36, 7, [['n', -3, 3]]), [141.5, 350, 2.5, 6, 3, 0]] }, // grand lobby (figge_int) from 2nd St; the stair
  { file: 'banktower', x: 141, z: 164.7, y: 8.0, clear: [[141, 164.7, 13.5, 21]], solid: [[141, 164.7, 15.2, 22.9, 68, 14], [141, 179, 15.2, 8.6, 14],
    ...roomWalls(141, 157, 0, 27, 26, 14, [['n', -2, 2]])] }, // banking hall (banktower_int) from 3rd St
  { file: 'putnam', x: 189.5, z: 215.7, y: 6.3, clear: [[189.5, 215.7, 8.5, 20.5]], solid: [[189.5, 215.7, 10.2, 22.1, 49]] },
  { file: 'cityhall', x: 81.5, z: -27.5, y: 12.6, clear: [[81.7, -27.5, 21, 15]], solid: [[81.7, -27.5, 22.9, 17.2, 46, 5], [81.5, -12.85, 3.8, 3.8, 31, 5], [60.2, -27.5, 1.4, 17.2, 6],
    [103, -27.5, 1.6, 17.2, 6], [81.7, -43, 22.9, 1.7, 6], [68.55, -13.4, 9.75, 3.1, 6], [94.65, -13.4, 9.95, 3.1, 6],
    ...roomWalls(81.5, -12.85, 0, 5.6, 7.3, 6, [['s', -1.5, 1.5], ['n', -1.5, 1.5]]), ...roomWalls(81.5, -28.75, 0, 39, 24.5, 6, [['s', -1.5, 1.5]]), [81.5, -38.5, 9, 2, 1.2]] }, // tower door -> council chambers (cityhall_int)
  { file: 'bandshell', x: -180, z: 530, y: 2.7, clear: [[-180, 530, 3, 6]], solid: [[-187.5, 530, 1.6, 4, 5]] }, // Bix bandshell, opens east to the lawn
  // Modern Woodmen Park grandstand: one box per stretch of the curved bowl, from just outside the brick wall to just
  // short of the field wall (made from the outer/field outlines in landmarks.py; 7th value = box heading)
  { file: 'ballpark', x: -400, z: 520, y: 3.0, clear: [[-431, 530, 3, 10], [-414, 545, 3, 8]], solid: [[-427.2, 541.1, 6.1, 13.8, 14.5, 0, 1.836], [-426.5, 533.1, 6.2, 15.5, 14.5, 0, 1.571],
    [-425.1, 524.3, 6.2, 16.1, 14.5, 0, 1.395], [-421.8, 517.7, 6.2, 17.3, 14.5, 0, 1.126], [-416.9, 510.8, 6.2, 17.9, 14.5, 0, 0.937], [-411.4, 506.2, 6.2, 18.8, 14.5, 0, 0.687],
    [-405, 502.3, 6.2, 18.9, 14.5, 0, 0.46], [-397.3, 499.1, 6.2, 18.7, 14.5, 0, 0.278], [-391.7, 497.5, 6.2, 17.8, 14.5, 0, -0.049], [-379.8, 496.8, 6.2, 16.6, 14.5, 0, -0.03],
    [-368.1, 495.5, 6.2, 14.9, 14.5, 0, -0.03], [-356.4, 493.9, 6.2, 13, 14.5, 0, -0.032], [-344.8, 493.1, 6.2, 11.8, 14.5, 0, -0.038], [-333.2, 492.5, 6.2, 10.8, 14.5, 0, -0.038]] },
  { file: 'ambrose', x: -287, z: -1693, y: 45.7, clear: [[-287, -1693, 3, 3]], solid: [[-286.6, -1688, 42.5, 12, 20, 4.8], [-292.15, -1706.1, 2.7, 5.2, 25, 4.8], [-261, -1702, 17, 7, 16],
    [-314.9, -1691.25, 14.1, 3.25, 5], [-297.6, -1679.5, 31.5, 3.5, 5], [-249.4, -1683, 5.2, 6, 16], [-272.25, -1682.5, 5.75, 5.5, 16],
    ...roomWalls(-292.15, -1706.1, 0, 4.5, 10.4, 5, [['n', -1, 1], ['s', -1, 1]]), ...roomWalls(-289.4, -1694.45, 0, 21.8, 12.9, 5, [['n', -3.75, -1.75], ['s', -2, 2]]),
    ...roomWalls(-297.55, -1685.75, 0, 62.1, 4.5, 5, [['n', 6.15, 10.15]])] }, // tower door -> entry hall -> corridor (ambrose_int)
  { file: 'conservatory', x: 196, z: -2394, y: 37.4, clear: [[196, -2394, 15, 8]], solid: [[173, -2394, 14, 12, 4, 4.4], [200, -2394, 12, 12, 6, 9.5], [221.5, -2394, 8.5, 8, 4, 3.9],
    ...roomWalls(173, -2394, 0, 26, 22, 5, [['e', -2, 2]]), ...roomWalls(200, -2394, 0, 22, 22, 10, [['w', -2, 2], ['e', -2, 2]]), ...roomWalls(221.5, -2394, 0, 15, 14, 5, [['w', -2, 2], ['e', -1.5, 1.5]]),
    [200, -2394, 3.2, 3.2, 0.5]] }, // east door -> wings and the palm house (conservatory_int)
  { file: 'northpark', x: 132, z: -4257, y: 36.9, h: -0.277, clear: [], solid: [[130.6, -4252.2, 15, 5, 17]] }, // the mall's south entrance (the mall is OSM)
  { file: 'rivercenter', x: 461, z: 172, y: 5.1, clear: [[461, 172, 40, 20], [513, 157, 8, 12]], solid: [[415.75, 185.5, 14.75, 16.5, 20], [465, 172, 35, 27, 8, 12], [513, 157, 10, 14, 20],
    [421, 130, 2.2, 11.6, 4.2, 6], ...roomWalls(415.5, 155.25, 0, 29, 25.5, 19, [['n', -3, 3], ['e', -3, 3]]), ...roomWalls(465, 172, 0, 70, 54, 13, [['w', -19.75, -13.75]])] }, // atrium + Great River Hall (rivercenter_int)
];
// Solid entries for a hall's four walls, in the room frame interiors.js uses (game x = cx + u cos + v sin,
// z = cz - u sin + v cos): doors [[side, a, b]] leave gaps, side 'n' (v = -d/2), 's' (+d/2), 'w' (u = -w/2), 'e';
// a..b run along the wall (u on n/s, v on e/w).
function roomWalls(cx, cz, rot, w, d, h, doors = []) {
  const c = Math.cos(rot), s = Math.sin(rot), out = [];
  const at = (u, v) => [cx + u * c + v * s, cz - u * s + v * c];
  for (const [side, len, fixed, alongU] of [['n', w, -d / 2, true], ['s', w, d / 2, true], ['w', d, -w / 2, false], ['e', d, w / 2, false]]) {
    const off = fixed + Math.sign(fixed) * 0.4;
    let t = -len / 2;
    for (const [, a, b] of [...doors.filter((g) => g[0] === side).sort((p, q) => p[1] - q[1]), [side, len / 2, len / 2]]) {
      if (a - t > 0.1) {
        const m = (t + a) / 2, [x, z] = alongU ? at(m, off) : at(off, m);
        out.push(alongU ? [x, z, (a - t) / 2, 0.4, h, 0, rot] : [x, z, 0.4, (a - t) / 2, h, 0, rot]);
      }
      t = b;
    }
  }
  return out;
}
// Davenport interiors (assets/src/landmarks.py *_int): the rooms modelled inside the landmarks above, walked into
// through their real doors; each landmark's solid above leaves the room and its doors open.
const INT = (file, x, z, y, halls) => ({ file, x, z, y, load: 160, solid: [], clear: [], halls: halls.map(([name, cx, cz, w, d, ly]) => ({ name, kind: 'hall', x: cx, z: cz, w, d, rot: 0, ly })) });
MODELS.push(
  INT('blackhawk_int', 451.6, 96.5, 7.5, [['Hotel Blackhawk', 451.6, 109.2, 24, 18.4, 8.5]]),
  INT('adler_int', 342.4, 91.2, 8.6, [['Adler Theatre', 342.4, 104.7, 20, 9.4, 5.8], ['Adler Theatre', 342.4, 86.05, 37.8, 25.1, 14]]),
  INT('figge_int', 109, 340, 3.4, [['Figge Art Museum', 109, 340, 78, 36, 6]]),
  INT('banktower_int', 141, 164.7, 8.0, [['Davenport Bank', 141, 157, 27, 26, 11]]),
  INT('cityhall_int', 81.5, -27.5, 12.6, [['City Hall', 81.5, -12.85, 5.6, 7.3, 4], ['City Hall', 81.5, -28.75, 39, 24.5, 4]]),
  INT('rivercenter_int', 461, 172, 5.1, [['RiverCenter', 415.5, 155.25, 29, 25.5, 12], ['RiverCenter', 465, 172, 70, 54, 10]]),
  INT('ambrose_int', -287, -1693, 45.7, [['Ambrose Hall', -292.15, -1706.1, 4.5, 10.4, 4], ['Ambrose Hall', -289.4, -1694.45, 21.8, 12.9, 4], ['Ambrose Hall', -297.55, -1685.75, 62.1, 4.5, 3.8]]),
  INT('conservatory_int', 196, -2394, 37.4, [['Vander Veer Conservatory', 173, -2394, 26, 22, 4], ['Vander Veer Conservatory', 200, -2394, 22, 22, 8], ['Vander Veer Conservatory', 221.5, -2394, 15, 14, 3.5]]),
);
// collision for the big irregular footprints (OSM outlines rasterised into 6-8 m strips by the build script)
const BOXES_ARENA = [[4787.8,1667.8,4.0,4.0,26],[4795.8,1675.8,12.0,4.0,26],[4779.8,1683.8,36.0,4.0,26],[4767.8,1691.8,56.0,4.0,26],[4767.8,1699.8,56.0,4.0,26],[4767.8,1707.8,56.0,4.0,26],[4767.8,1715.8,64.0,4.0,26],[4767.8,1723.8,64.0,4.0,26],[4767.8,1731.8,64.0,4.0,26],[4767.8,1739.8,64.0,4.0,26],[4763.8,1747.8,52.0,4.0,26],[4827.8,1747.8,4.0,4.0,26],[4763.8,1755.8,52.0,4.0,26],[4759.8,1763.8,48.0,4.0,26],[4771.8,1771.8,28.0,4.0,26],[4779.8,1779.8,4.0,4.0,26]];
const BOXES_DEERE = [[12760.4,5160.4,21.0,3.0,11],[12760.4,5166.4,27.0,3.0,11],[12757.4,5172.4,30.0,3.0,11],[12754.4,5178.4,27.0,3.0,11],[12742.4,5184.4,15.0,3.0,11],[12739.4,5190.4,12.0,3.0,11],[12739.4,5196.4,12.0,3.0,11],[12739.4,5202.4,12.0,3.0,11],[12736.4,5208.4,15.0,3.0,11],[12736.4,5214.4,15.0,3.0,11],[12736.4,5220.4,15.0,3.0,11],[12736.4,5226.4,15.0,3.0,11],[12730.4,5232.4,9.0,3.0,11],[12724.4,5238.4,3.0,3.0,11]];
const BOXES_MLI = [...[[5863.1,7631.4,4.0,4.0,12],[5867.1,7639.4,16.0,4.0,12],[5871.1,7647.4,20.0,4.0,12],[5871.1,7655.4,28.0,4.0,12],[5879.1,7663.4,28.0,4.0,12],[5895.1,7671.4,28.0,4.0,12],[5903.1,7679.4,28.0,4.0,12],[5911.1,7687.4,28.0,4.0,12],[5927.1,7695.4,28.0,4.0,12],[5935.1,7703.4,28.0,4.0,12],[5951.1,7711.4,36.0,4.0,12],[5975.1,7719.4,44.0,4.0,12],[5979.1,7727.4,40.0,4.0,12],[5979.1,7735.4,40.0,4.0,12],[5975.1,7743.4,44.0,4.0,12],[5975.1,7751.4,44.0,4.0,12],[5939.1,7759.4,8.0,4.0,12],[5999.1,7759.4,20.0,4.0,12],[5935.1,7767.4,4.0,4.0,12],[5931.1,7775.4,8.0,4.0,12],[5927.1,7783.4,4.0,4.0,12],[5923.1,7791.4,8.0,4.0,12],[5923.1,7799.4,16.0,4.0,12],[5911.1,7807.4,20.0,4.0,12],[5911.1,7815.4,20.0,4.0,12],[5903.1,7823.4,20.0,4.0,12],[5903.1,7831.4,12.0,4.0,12],[5911.1,7839.4,4.0,4.0,12]], ...[[5927.3,7829.3,3.0,3.0,8],[5927.3,7835.3,9.0,3.0,8],[5927.3,7841.3,15.0,3.0,8],[5933.3,7847.3,15.0,3.0,8],[5942.3,7853.3,18.0,3.0,8],[5948.3,7859.3,18.0,3.0,8],[5957.3,7865.3,15.0,3.0,8],[5963.3,7871.3,15.0,3.0,8],[5963.3,7877.3,9.0,3.0,8]], ...[[5800.2,7738.7,6.0,3.0,8],[5806.2,7744.7,12.0,3.0,8],[5806.2,7750.7,18.0,3.0,8],[5809.2,7756.7,21.0,3.0,8],[5818.2,7762.7,18.0,3.0,8],[5824.2,7768.7,18.0,3.0,8],[5830.2,7774.7,18.0,3.0,8],[5842.2,7780.7,18.0,3.0,8],[5848.2,7786.7,18.0,3.0,8],[5854.2,7792.7,18.0,3.0,8],[5860.2,7798.7,18.0,3.0,8],[5872.2,7804.7,18.0,3.0,8],[5875.2,7810.7,15.0,3.0,8],[5875.2,7816.7,9.0,3.0,8]]];
const BOXES_LOCK = [[1147.4,597.8,111.5,3.1,13,0,0.775],[1119.3,569.2,121.5,3.3,13,0,0.775],[1127.7,505.2,70.8,3.0,13,0,0.775]]; // river wall, middle wall, auxiliary land wall
// Quad Cities landmarks (roadmap 2). ground: base height from the terrain once the anchor's tile is in (y + dy);
// halls: walk-in interiors modelled in the GLB (<file>_int) that interiors.js treats as rooms
// ({name, kind, x, z, w, d, rot, fx, fz}: centre, size along the room's own x/z, heading; fx/fz: where the casino
// furniture and the pooled light go). Positions are game x/z projected from OSM (docs/landmarks-references.md).
MODELS.push(
  { file: 'isle', x: 5862, z: 36, ground: true, load: 900, clear: [[5850, 40, 78, 72], [5950.5, -13, 9, 29], [5922, 105, 20, 5]],
    solid: [[5874, -4.5, 42, 0.5, 9], [5874, 38.5, 42, 0.5, 9], [5831.5, 17, 0.5, 21, 9], [5916.5, 10, 0.5, 14, 9], [5916.5, 35, 0.5, 3, 9], // casino hall walls (door: east, z 24..32)
      [5850, -17.5, 78, 12.5, 10], [5801.5, 32.5, 29.5, 37.5, 10], [5795.5, 91, 30.5, 21, 10], [5838.5, 56.5, 33.5, 13.5, 10], [5878, 67.5, 6.5, 20, 10],
      [5859.5, 100, 32.5, 13, 34], [5897, 100, 6, 13, 10], [5896, 45.5, 12, 3.3, 10], [5925.5, 4, 9.5, 9, 14], [5920, 13.3, 4, 0.7, 10], [5911, 41, 4, 3, 10],
      [5950.5, -12.5, 9.5, 29.5, 46], [5920.5, -5, 7.5, 7.5, 14],
      [5844, 4.5, 6.2, 1.1, 2.3], [5844, 13.5, 6.2, 1.1, 2.3], [5844, 22.5, 6.2, 1.1, 2.3], [5844, 31.5, 6.2, 1.1, 2.3], [5864, -1.2, 8, 1.6, 1.2]], // slot banks, Lone Wolf bar
    halls: [{ name: 'Isle Casino', kind: 'casino', x: 5874, z: 17, w: 42, d: 84, rot: -Math.PI / 2, fx: 5898, fz: 17 }] },
  { file: 'tbk', x: 9457, z: -7690, ground: true, load: 900, clear: [[9457, -7690, 90, 61], [9421.7, -7605, 35, 26]],
    solid: [...roomWalls(9456.5, -7689.8, 0, 175, 118.4, 15, [['s', -46.5, -30.5]]), ...roomWalls(9421.5, -7605.5, 0, 67, 50, 9.5, [['n', -11.5, 4.5], ['s', -7.5, 7.5]]),
      [9452, -7599.5, 0.6, 11, 1.2], [9421.7, -7598, 4, 0.6, 1.2]],
    halls: [{ name: 'TBK Bank Sports Complex', kind: 'hall', x: 9456.5, z: -7689.8, w: 175, d: 118.4, rot: 0, ly: 11, light: [0xffffff, 0] },
      { name: 'TBK Bank Sports Complex', kind: 'hall', x: 9421.5, z: -7605.5, w: 67, d: 50, rot: 0, ly: 6.5, light: [0xfff4e0, 14] }] },
  { file: 'buffalobill', x: 19588, z: -8275, ground: true, clear: [[19588, -8275, 13, 42]],
    solid: [...roomWalls(19587, -8257, -0.11, 12.6, 41, 7, [['w', -1.5, 2.5], ['n', -3, 3]]), ...roomWalls(19590.5, -8297, -0.11, 14, 34, 11, [['s', -3, 3]])],
    halls: [{ name: 'Buffalo Bill Museum', kind: 'hall', x: 19587, z: -8257, w: 12.6, d: 41, rot: -0.11, ly: 3.6 },
      { name: 'Buffalo Bill Museum', kind: 'hall', x: 19590.5, z: -8297, w: 14, d: 34, rot: -0.11, ly: 8 }] },
  { file: 'antique', x: 19429, z: -7973.5, ground: true, clear: [[19429, -7973.5, 5.5, 8]],
    solid: roomWalls(19428.9, -7973.5, 0, 8.6, 13.8, 8, [['s', -1.3, 0.7]]),
    halls: [{ name: 'Antique Archaeology', kind: 'hall', x: 19428.9, z: -7973.5, w: 8.6, d: 13.8, rot: 0, ly: 3 }] },
  // Moline / Rock Island
  { file: 'pavilion', x: 4980, z: 1778, ground: true, clear: [[4980, 1778, 20, 12]], solid: roomWalls(4980.05, 1778.1, 0.4545, 49, 32.2, 12, [['n', -3, 3]]),
    halls: [{ name: 'John Deere Pavilion', kind: 'hall', x: 4980.05, z: 1778.1, w: 49, d: 32.2, rot: 0.4545, ly: 9, light: [0xffffff, 16] }] },
  { file: 'arena', x: 4770, z: 1725, ground: true, load: 1000, clear: [[4770, 1725, 40, 40]], solid: [...BOXES_ARENA, [4832, 1740, 7, 7, 12]] },
  { file: 'oldmain', x: 2333, z: 2126.5, ground: true, clear: [[2333, 2126.5, 10, 6]], solid: [[2333, 2126.5, 27, 12, 20]] },
  { file: 'circa21', x: 337, z: 1545, ground: true, clear: [[337, 1545, 10, 15], [315, 1533, 6, 8]], solid: [[337, 1545, 13.5, 22.5, 18], [315.5, 1533, 8.2, 11, 9]] },
  { file: 'deerehq', x: 12637, z: 5202, ground: true, load: 900, clear: [[12637, 5202, 40, 12], [12755, 5195, 15, 20]], solid: [[12637.2, 5202.5, 51.5, 17.2, 30], ...BOXES_DEERE] },
  // Arsenal Island: the Clock Tower building, Lock and Dam 15 (roller dam + locks, on the water)
  { file: 'clocktower', x: 1140, z: 778, ground: true, load: 900, clear: [[1147, 778, 12, 12], [1138, 765, 4, 4]],
    solid: [[1140.9, 778, 28, 9.15, 22, 0, 0.624], [1133.9, 768.3, 3.8, 3.8, 36, 0, 0.624], [1161.8, 769.9, 9, 9, 13, 0, 0.624]] },
  { file: 'lockdam', x: 728.65, z: 549.55, y: WATER_Y, load: 1200, clear: [], solid: [[728.65, 549.55, 189.2, 9, 20, 0, -0.683]] },
  { file: 'lock15', x: 1133.45, z: 583.55, y: WATER_Y, load: 1000, clear: [], solid: BOXES_LOCK },
  // Quad Cities International Airport: terminal + concourses, the tower and the Elliott hangar
  { file: 'mli', x: 5930, z: 7740, ground: true, load: 1500, clear: [[5930, 7735, 60, 60], [5945, 7855, 20, 15], [5835, 7780, 30, 25]], solid: [...BOXES_MLI] },
  { file: 'mlitower', x: 5698, z: 8971, ground: true, load: 1500, clear: [[5698, 8971, 5, 5], [5904, 8990, 30, 60]], solid: [[5698, 8971, 5.2, 5.2, 39], [5904, 8990, 35.5, 65.5, 20]] },
);
const LOAD = 700, DROP = 900;
for (const L of MODELS) for (const [x, z, hw, hd] of L.clear) lots.extra.push({ x, z, fx: 0, fz: 1, hw, hd });
let LM = null; // the four shared landmark materials, swapped in by name
function lmMats() {
  if (LM) return LM;
  const base = { vertexColors: true, flatShading: true };
  const lit = new THREE.MeshStandardMaterial({ ...base, roughness: 0.25, emissive: 0xffc77a, emissiveIntensity: 0 });
  const neon = new THREE.MeshStandardMaterial({ ...base, roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0 });
  neon.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor.rgb;'); };
  night.push([lit, 1.2], [neon, 2.5]);
  LM = { lm_body: new THREE.MeshStandardMaterial({ ...base, roughness: 0.85 }), lm_glass: new THREE.MeshStandardMaterial({ ...base, roughness: 0.12 }), lm_lit: lit, lm_neon: neon };
  return LM;
}
function initModels() {
  // the I-74 twin basket-handle arches over the main span (landmarks/i74.glb): centre and heading from OSM (the
  // carriageways cross the main span at x 5482 / 5520, z 455, bearing 169 deg), deck height from the crossing data
  const i74 = D.index.crossings?.find((c) => /\b74\b/.test(c.name));
  MODELS.push({ file: 'i74', x: 5501, z: 455, y: i74 ? i74.deck : 21, h: 0.1888, load: 2500 });
  for (const L of MODELS) if (!L.ground) solidify(L);
}
function solidify(L) {
  if (!L.solid) return;
  addBoxes('lm-' + L.file, L.solid.map(([x, z, hx, hz, h, up = 0, a = L.h || 0]) => {
    const ux = Math.cos(a), uz = -Math.sin(a);
    return up ? makeBox(x, z, ux, uz, hx, hz, L.y + up, h) : makeBox(x, z, ux, uz, hx, hz, L.y - 3, h + 3);
  }));
}
// L.h: heading (rotation.y); L.len: stretch a 100 m bridge module to this length; L.load: own load radius.
function placeModel(L, g) {
  const M = lmMats(), root = new THREE.Group(), lod = new THREE.LOD(), sc = g.scene.clone();
  root.position.set(L.x, L.y, L.z); root.rotation.y = L.h || 0; if (L.len) root.scale.z = L.len / 100; root.add(lod);
  sc.traverse((o) => { if (o.isMesh) { o.material = M[o.material.name] || M.lm_body; o.castShadow = o.receiveShadow = /_lod0/.test(o.name) || /_lod0/.test(o.parent?.name); } });
  const lod0 = sc.children.find((o) => o.name.endsWith('_lod0'));
  for (const o of [...sc.children]) {
    if (o === lod0) lod.addLevel(o, 0);
    else if (o.name.endsWith('_lod1')) lod.addLevel(o, 260);
    else if (o.name.endsWith('_int') && lod0) { lod0.add(o); o.traverse((m) => { m.castShadow = false; }); } // interiors hide with the detailed level
    else root.add(o); // moving parts
  }
  scene.add(root); L.obj = root;
  L.rooms = L.halls?.map((h) => addHall({ ...h, y: L.y + 0.02 }));
  L.onLoad?.(root);
}
let modelT = 0;
function updateModels(dt, focus) {
  if ((modelT -= dt) > 0 || !focus) return; modelT = 0.5;
  for (const L of MODELS) {
    const d = Math.hypot(L.x - focus.x, L.z - focus.z), file = `landmarks/${L.file}.glb`, load = L.load || LOAD;
    if (d < load && !L.obj && !L.loading) {
      if (L.y === undefined) { // ground: wait for the anchor's tile so the base sits on the detailed terrain
        if (!W.tiles.has(`${Math.floor(L.x / 200)}_${Math.floor(L.z / 200)}`)) continue;
        L.y = terrainHeight(L.x, L.z) + (L.dy || 0); solidify(L);
      }
      L.loading = true;
      loadLazy(file).then((g) => { L.loading = false; if (g && !L.obj) placeModel(L, g); });
    } else if (d > load + DROP - LOAD && L.obj) {
      scene.remove(L.obj); L.obj = null; L.onUnload?.();
      for (const R of L.rooms || []) removeHall(R);
      L.rooms = null;
      // bridge modules share one file: free it when the last copy goes
      if (!MODELS.some((o) => o.file === L.file && (o.obj || o.loading))) loadLazy(file).then((g) => { g?.scene.traverse((o) => o.geometry?.dispose()); dropLazy(file); });
    }
  }
}

// ---------- river crossings: the bridges' structures ----------
// Every real bridge is drivable straight from the road graph (decks come from the map data). This adds the steel on top:
// Centennial's five tied arches and the Government Bridge's swing span + truss. Agent-built models of the other
// crossings (I-74 arches, I-280, I-80) go in MODELS and can use D.index.crossings ({name, river, box, deck, lines}).
function buildCrossing(cr) {
  if (!/Centennial|Government/.test(cr.name)) return true;
  // the longest carriageway, Iowa (north) end first
  let L = cr.lines.reduce((a, b) => (b.length > a.length ? b : a));
  if (L[1] > L[L.length - 1]) { const r = []; for (let i = L.length - 2; i >= 0; i -= 2) r.push(L[i], L[i + 1]); L = r; }
  const pts = []; for (let i = 0; i < L.length; i += 2) pts.push([L[i], L[i + 1]]);
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const P = { pts, cum, len: cum[cum.length - 1] };
  // the stretch over the water
  let s0 = -1, s1 = -1;
  for (let s = 0; s <= P.len; s += 6) { const q = pathPose(P, s); if (terrainHeight(q.x, q.z) <= WATER_Y + 0.05) { if (s0 < 0) s0 = s; s1 = s; } }
  if (s0 < 0) { s0 = P.len * 0.15; s1 = P.len * 0.85; }
  const deckY = cr.deck, wet = s1 - s0;
  if (/Centennial/.test(cr.name)) {
    const spans = 5, sl = (wet + 60) / spans;
    for (let k = 0; k < spans; k++) { const q = pathPose(P, s0 - 30 + sl * k); MODELS.push({ file: 'centennial', x: q.x, z: q.z, y: deckY, h: q.h, len: sl, load: 1500 }); }
  } else {
    // the swing span over the lock by the Iowa shore, then 60 m truss panels (landmarks/govswing.glb, govtruss.glb)
    const q0 = pathPose(P, s0); MODELS.push({ file: 'govswing', x: q0.x, z: q0.z, y: deckY, h: q0.h, load: 1500 });
    for (let s = 102; s < wet; s += 60) { const q = pathPose(P, s0 + s); MODELS.push({ file: 'govtruss', x: q.x, z: q.z, y: deckY, h: q.h, load: 1500 }); }
  }
  return true;
}

// ---------- "Welcome to ___" at the real town limits (D.index.signs: [x, z, heading in, town index, interstate]) ----------
const signDone = new Set();
function buildSigns(t) {
  const S = D.index.signs || [];
  for (let i = 0; i < S.length; i++) {
    const [x, z, h, ti, big] = S[i];
    if (signDone.has(i) || x < t.ox || x >= t.ox + TILE_M || z < t.oz || z >= t.oz + TILE_M) continue;
    signDone.add(i);
    const town = D.index.towns[ti]; if (!town) continue;
    const y = terrainHeight(x, z), g = group(x, y, z, h + Math.PI); // faces drivers coming in
    const w = big ? 7 : 4.2, ht = big ? 2.6 : 1.9, post = big ? 3.2 : 1.6;
    const sg = signMesh(['WELCOME TO', town.name.toUpperCase()], w, ht, big ? { bg: '#1b5e20', fg: '#ffffff', size: 70, border: '#ffffff', glow: 0.15 } : { bg: '#4e342e', fg: '#fff3d6', size: 64, border: '#d7b98e', glow: 0.15 });
    sg.position.set(0, post + ht / 2, 0.08); g.add(sg);
    box(g, big ? 0x9e9e9e : 0x5d4037, w + 0.2, ht + 0.2, 0.12, 0, post + ht / 2, 0);
    for (const sx of [-w / 2 + 0.3, w / 2 - 0.3]) box(g, big ? 0x9e9e9e : 0x3e2723, 0.18, post + 0.1, 0.18, sx, post / 2, 0);
    addBoxes('welcome' + i, [makeBox(x, z, Math.cos(h), -Math.sin(h), w / 2, 0.25, y - 1, post + ht + 1)]);
  }
}

// ---------- Skybridge: the glass footbridge over River Drive, lit up at night ----------
function buildSkybridge() { // glass tube over River Drive with lift towers (landmarks/skybridge.glb, 161 m along +z)
  const x = 225, z0 = 310, z1 = 471, y = Math.max(terrainHeight(x, z0), terrainHeight(x, z1));
  MODELS.push({ file: 'skybridge', x, z: z0, y });
  return true;
}

// ---------- Modern Woodmen Park: field, grandstand, light towers, Ferris wheel ----------
function buildBallpark(cx, cz) {
  const y = terrainHeight(cx, cz) + 0.15, h = -0.6; // home plate up-river, outfield toward the bridge
  const g = group(cx, y, cz, h), wg = group(0, 0, 0); // wg: placed in world x/z
  // (the grandstand is landmarks/ballpark.glb, MODELS above: home plate ~(-390, 535), the bowl wraps it to the
  // north-west, foul lines run south and east). Light towers stand outside the field like the real park's: two
  // behind the stands along the baselines, two past the outfield corners, two in the power alleys.
  const towers = [[-447, 538], [-345, 475], [-387, 645], [-281, 516], [-335, 647], [-266, 566]];
  for (const [x, z] of towers) {
    const ty = terrainHeight(x, z);
    box(wg, 0x777777, 0.6, 33, 0.6, x, ty + 16.5, z);
    const bank = box(wg, 0, 4, 2.4, 0.6, x, ty + 33, z, glow(0xfff8e1, 2)); bank.lookAt(-343, y, 573); // aimed at the middle of the field
  }
  addBoxes('ballpark-towers', towers.map(([x, z]) => makeBox(x, z, 1, 0, 0.45, 0.45, terrainHeight(x, z) - 1, 34)));
  // Ferris wheel in foul ground past the third-base stands, clear of the bridge ramp to the west
  const fy = terrainHeight(-438, 600) - y; // group-local (-31, 71) = world (-438, 600)
  const fw = new THREE.Group(); fw.position.set(-31, 18 + fy, 71); g.add(fw);
  box(g, 0x9e9e9e, 0.5, 19, 0.5, -33, 9 + fy, 69).rotation.z = 0.25; box(g, 0x9e9e9e, 0.5, 19, 0.5, -29, 9 + fy, 73).rotation.z = -0.25;
  const wheel = new THREE.Group(); fw.add(wheel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(15, 0.35, 6, 40), glow(0xffeb3b, 1.5)); wheel.add(rim);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 15, 0.2), mat(0xbdbdbd)); sp.position.set(Math.cos(a) * 7.5, Math.sin(a) * 7.5, 0); sp.rotation.z = a - Math.PI / 2; wheel.add(sp);
    const car = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), mat([0xe53935, 0x1e88e5, 0xfdd835, 0x43a047][i % 4])); car.position.set(Math.cos(a) * 15, Math.sin(a) * 15 - 1, 0); wheel.add(car); car.userData.gondola = true;
  }
  ferris = wheel;
  // the name over the arches on the grandstand's straight north wall, facing River Drive
  const sg = signMesh(['MODERN WOODMEN PARK'], 18, 2.2, { bg: '#0d2a4a', fg: '#ffffff', size: 60, w: 1024, h: 128 }); sg.position.set(-369.5, 3.0 + 11.5, 481.1); sg.rotation.y = Math.PI; wg.add(sg);
  return true;
}
function buildFountain(x, z) {
  const y = terrainHeight(x, z), g = group(x, y, z);
  const pool = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.4, 0.8, 32), mat(0xbcaaa4)); pool.position.y = 0.4; g.add(pool);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 0.1, 32), new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.1 })); water.position.y = 0.75; g.add(water);
  box(g, 0xbcaaa4, 1.2, 3, 1.2, 0, 1.5, 0);
  fountain = new THREE.Mesh(new THREE.ConeGeometry(1.4, 6, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xe1f5fe, transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 0.1 }));
  fountain.position.y = 3.2; g.add(fountain);
  addBoxes('fountain', [makeBox(x, z, 1, 0, 9, 9, y - 1, 1.8)]);
  return true;
}

// ---------- the Arnett Belle: a made-up riverboat casino by the riverfront ----------
export const casino = { door: null, x: 0, z: 0 };
function buildCasino(x0) {
  const w = waterFrom(x0, 150, 0, 1); if (!w) return false;
  const x = w.x, z = w.z + 34, h = Math.PI / 2; // moored along the bank
  // the boat (landmarks/belle.glb): sternwheeler parallel to the bank, boarding door mid-ship facing the shore
  MODELS.push({ file: 'belle', x, z, y: WATER_Y - 0.6, load: 900, onLoad: (r) => { casino.wheel = r.getObjectByName('belle_wheel'); }, onUnload: () => { casino.wheel = null; } });
  // hull walls (boats bump into it), and a gangway to the bank
  const hx = Math.sin(h), hz = Math.cos(h);
  addBoxes('casino', [makeBox(x, z, hz, -hx, 9, 35, WATER_Y - 3, 6)].map((b) => b));
  const gw = group(x, WATER_Y + 1.2, w.z + 12, 0); box(gw, 0x8d6e63, 3, 0.3, 26, 0, 0, 0); box(gw, 0x5d4037, 0.1, 1, 26, 1.4, 0.6, 0); box(gw, 0x5d4037, 0.1, 1, 26, -1.4, 0.6, 0);
  casino.x = x; casino.z = z; casino.door = { x: w.x, z: w.z - 3 };
  ctx.onCasino?.(casino.door, Math.PI);
  return true;
}

// ---------- signs on real landmarks ----------
function buildRoofSign(x, z, text, color, size = 14) { // big letters on the roof of the tallest building at (x, z)
  let top = W.roofAt(x, z); if (!isFinite(top)) top = terrainHeight(x, z) + 12;
  const g = group(x, top, z, 0);
  const s = signMesh([text], size, size / 7, { w: 1024, h: 146, bg: 'rgba(0,0,0,0)', fg: color, size: 110, glow: 1.6 }); s.position.y = size / 14 + 1.2; s.material.transparent = true; g.add(s);
  const s2 = s.clone(); s2.rotation.y = Math.PI / 2; g.add(s2);
  box(g, 0x424242, size, 0.2, 0.2, 0, 1, 0);
  return true;
}

// ---------- rooftop helicopter (stairs from the street) ----------
export const helipad = { x: 0, z: 0, y: 0, ready: false };
function buildHelipad() {
  // the tallest flat roof downtown
  let best = null;
  for (const t of W.tiles.values()) {
    if (t.ox < -300 || t.ox > 500 || t.oz < -300 || t.oz > 300) continue;
    for (const [rel, by, h, pitched] of t.b) {
      if (pitched || h < 25) continue;
      let cx = 0, cz = 0; const n = rel.length / 2; for (let i = 0; i < rel.length; i += 2) { cx += rel[i]; cz += rel[i + 1]; } cx = cx / n + t.ox; cz = cz / n + t.oz;
      if (!best || by + h > best.top) best = { x: cx, z: cz, top: by + h };
    }
  }
  if (!best || W.roofAt(best.x, best.z) < best.top - 0.5) return false;
  const g = group(best.x, best.top + 0.05, best.z);
  const pad = new THREE.Mesh(new THREE.CircleGeometry(7, 32).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: textTexture('H', { w: 256, h: 256, bg: '#3b4048', fg: '#ffc94a', size: 200, border: '#ffc94a' }) }));
  g.add(pad);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const l = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 5), glow(0x76ff03, 3)); l.position.set(Math.cos(a) * 7.2, 0.1, Math.sin(a) * 7.2); g.add(l); }
  helipad.x = best.x; helipad.z = best.z; helipad.y = best.top + 0.05; helipad.ready = true;
  ctx.addHeli(best.x, helipad.y, best.z);
  // stairwell: a door at street level on the side facing the nearest road, and a door hut on the roof
  const q = W.nearestEdge(best.x, best.z, 120);
  if (q) {
    const dx = q.x - best.x, dz = q.z - best.z, l = Math.hypot(dx, dz) || 1;
    let sx = best.x, sz = best.z; for (let d = 0; d < l; d += 0.5) { sx = best.x + (dx / l) * d; sz = best.z + (dz / l) * d; if (W.roofAt(sx, sz) < best.top - 1) break; }
    sx += (dx / l) * 1.2; sz += (dz / l) * 1.2;
    const rx = best.x + (dx / l) * 7.5, rz = best.z + (dz / l) * 7.5;
    if (W.roofAt(rx, rz) >= best.top - 0.5) {
      const hut = group(rx + (dx / l) * 1.5, best.top, rz + (dz / l) * 1.5, Math.atan2(dx, dz)); box(hut, 0x9e9e9e, 2.6, 2.6, 2.2, 0, 1.3, 0); box(hut, 0x37474f, 1, 2, 0.05, 0, 1, -1.11);
      const door = group(sx, terrainHeight(sx, sz), sz, Math.atan2(-dx, -dz)); box(door, 0x37474f, 1.2, 2.2, 0.1, 0, 1.1, 0); const sg = signMesh(['ROOF ACCESS'], 1.4, 0.35, { w: 256, h: 64, bg: '#b71c1c', fg: '#fff', size: 36 }); sg.position.set(0, 2.5, 0.06); door.add(sg);
      doors.push({ x: sx, z: sz, y: terrainHeight(sx, sz), to: { x: rx, z: rz, y: best.top + 0.05, h: Math.atan2(-dx, -dz) }, label: 'Take the stairs to the roof' });
      doors.push({ x: rx, z: rz, y: best.top, to: { x: sx + (dx / l) * 1.5, z: sz + (dz / l) * 1.5, y: terrainHeight(sx, sz), h: Math.atan2(dx, dz) }, label: 'Take the stairs down' });
    }
  }
  return true;
}

// ---------- speedboats tied up by the bank ----------
function buildMarina(x, z) {
  const w = waterFrom(x, z, 0, 1, 400) || waterFrom(x, z, 0, -1, 400) || waterFrom(x, z, 1, 0, 400);
  if (!w) return false;
  const dock = group(w.x, WATER_Y + 0.25, w.z + 8, 0);
  box(dock, 0x8d6e63, 3, 0.3, 22, 0, 0, 0);
  for (let i = 0; i < 3; i++) ctx.addBoat(w.x + (i % 2 ? 4.5 : -4.5), w.z + 4 + i * 6, Math.PI / 2);
  return true;
}

// ---------- billboards: Re-elect Mayor Tim Arnett, on Brady and Kimberly ----------
const SLOGANS = ['He fixed one pothole. Probably.', "Davenport's favourite Tim.", 'Vote Tim. He is already here.', 'Tim Arnett: Mayor of the Mississippi.'];
function initBillboards() {
  const spots = [['Brady Street', 30, -1600], ['Brady Street', 30, -2700], ['Kimberly Road', -700, -3950], ['Kimberly Road', 800, -3970]];
  spots.forEach(async ([name, x, z], i) => {
    await W.ensureRoads(x - 500, z - 500, x + 500, z + 500);
    const q = W.nearestEdge(x, z, 400, (e) => e.name.includes(name)); if (!q) return;
    for (const side of [1, -1]) {
      const off = q.e.width / 2 + 7, bx = q.x - Math.cos(q.h) * off * side, bz = q.z + Math.sin(q.h) * off * side;
      if (!W.isLand(bx, bz)) continue;
      const y = terrainHeight(bx, bz), g = group(bx, y, bz, q.h + (side > 0 ? -Math.PI / 2 : Math.PI / 2));
      box(g, 0x5d5d5d, 0.4, 7, 0.4, -4, 3.5, 0); box(g, 0x5d5d5d, 0.4, 7, 0.4, 4, 3.5, 0);
      const s = signMesh(['RE-ELECT MAYOR TIM ARNETT', SLOGANS[i % SLOGANS.length]], 13, 5, { w: 1024, h: 394, bg: '#fff59d', fg: '#c62828', size: 74, border: '#c62828', glow: 0.5 });
      s.position.set(0, 8.5, 0.25); g.add(s);
      box(g, 0x424242, 13.4, 5.4, 0.3, 0, 8.5, 0);
      addBoxes('billboard' + i, [makeBox(bx, bz, Math.cos(q.h), -Math.sin(q.h), 0.4, 4.2, y - 1, 6)]);
      break;
    }
  });
}

// ---------- the river: barge tows going up and down, Le Claire to the bottom of the map ----------
const barges = [];
let riverPath = null;
function initRiver() {
  // the real channel centre line (OSM waterway=river, chained by the map build)
  if (D.index.river?.length > 4) { riverPath = pathOf(D.index.river); addTows(); return; }
  // older data: from the coarse land/water grid, one wet run per 100 m column, following the main channel
  const c = D.coarse, pts = [];
  let prevZ = null;
  const x0 = D.index.tx0 * TILE_M + 300, x1 = (D.index.tx1 + 1) * TILE_M - 300;
  for (let x = x0; x <= x1; x += 100) {
    const i = Math.round((x - c.x0) / c.step); if (i < 0 || i >= c.w) continue;
    let runs = [], start = null;
    for (let j = 0; j < c.h; j++) { const wet = c.kind[j * c.w + i] === 1; if (wet && start === null) start = j; if ((!wet || j === c.h - 1) && start !== null) { runs.push([start, j]); start = null; } }
    runs = runs.filter(([a, b]) => (b - a) * c.step > 150);
    if (!runs.length) continue;
    // the widest run to begin with, then whichever continues the channel
    const pickRun = prevZ === null ? runs.reduce((a, b) => (b[1] - b[0] > a[1] - a[0] ? b : a)) : runs.reduce((a, b) => (Math.abs(c.z0 + ((b[0] + b[1]) / 2) * c.step - prevZ) < Math.abs(c.z0 + ((a[0] + a[1]) / 2) * c.step - prevZ) ? b : a));
    const z = c.z0 + ((pickRun[0] + pickRun[1]) / 2) * c.step;
    if (prevZ !== null && Math.abs(z - prevZ) > 600) continue; // a side channel or the Rock River: skip the column
    pts.push([x, z]); prevZ = z;
  }
  for (let k = 0; k < 4; k++) for (let i = 1; i < pts.length - 1; i++) pts[i][1] = (pts[i - 1][1] + pts[i][1] * 2 + pts[i + 1][1]) / 4;
  if (pts.length < 3) return;
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  riverPath = { pts, cum, len: cum[cum.length - 1] };
  addTows();
}
function addTows() {
  // three tows (through Lock & Dam 15 at the Arsenal and Lock & Dam 14 below Le Claire)
  for (const [off, side] of [[0, -1], [0.37, 1], [0.71, -1]]) {
    const g = new THREE.Group(); scene.add(g); g.visible = false;
    for (let r = 0; r < 3; r++) for (let cI = 0; cI < 2; cI++) { box(g, 0x8d3b2a, 10.5, 2.4, 59, (cI - 0.5) * 10.8, 0.6, 24 + r * 60); box(g, 0x5d2a1e, 9.5, 0.6, 57, (cI - 0.5) * 10.8, 2, 24 + r * 60); }
    box(g, 0xf5f5f5, 12, 3, 22, 0, 1.2, -10); box(g, 0xf5f5f5, 8, 3, 10, 0, 4, -14); box(g, 0x263238, 8.1, 1, 10.1, 0, 4.6, -14); box(g, 0xf5f5f5, 5, 2.4, 5, 0, 7, -16); box(g, 0x1a237e, 5.1, 0.8, 5.1, 0, 7.4, -16);
    box(g, 0x212121, 0.8, 4, 0.8, 1.8, 9, -18); box(g, 0x212121, 0.8, 4, 0.8, -1.8, 9, -18);
    barges.push({ g, off, side, len: 200 });
  }
}
function pathPose(P, s) {
  s = Math.max(0, Math.min(P.len, s));
  let i = 1; while (i < P.cum.length - 1 && P.cum[i] < s) i++;
  const k = (s - P.cum[i - 1]) / (P.cum[i] - P.cum[i - 1] || 1), a = P.pts[i - 1], b = P.pts[i];
  return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, h: Math.atan2(b[0] - a[0], b[1] - a[1]) };
}
const pathOf = (flat) => { const pts = []; for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]); const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, cum, len: cum[cum.length - 1] }; };

// ---------- the Channel Cat water taxi: Moline, Bettendorf and the Village of East Davenport ----------
// OSM's ferry route when the map has it; otherwise the real landings (approximate) linked across the river.
const ferry = { path: null, g: null, stops: [], x: 0, z: 0, h: 0 };
const CAT_LANDINGS = [[41.5104, -90.5156], [41.5180, -90.5010], [41.5262, -90.5466], [41.5240, -90.5130]]; // John Deere Commons, Ben Butterworth Pkwy, Lindsay Park, Leach Park
function initFerry() {
  const osm = (D.index.ferries || []).filter((f) => /Channel Cat/i.test(f.name)).sort((a, b) => b.pts.length - a.pts.length)[0];
  let flat = osm ? osm.pts : null;
  if (!flat) {
    const M_LAT = 110574, M_LON = 111320 * Math.cos((41.5236 * Math.PI) / 180);
    const ll = ([lat, lon]) => [(lon + 90.5776) * M_LON, -(lat - 41.5236) * M_LAT];
    const [a, b, c2, d] = CAT_LANDINGS.map(ll);
    flat = [...a, ...b, ...d, ...c2]; // Moline -> Moline east -> back across to Bettendorf -> down to East Davenport
  }
  ferry.path = pathOf(flat);
  if (ferry.path.len < 200) { ferry.path = null; return; }
  // stops: the route's ends and corners
  ferry.stops = [0, ...ferry.path.cum.slice(1, -1).filter((s, i) => { const P = ferry.path.pts, a = P[i], b = P[i + 1], c3 = P[i + 2]; return Math.abs(Math.atan2(b[0] - a[0], b[1] - a[1]) - Math.atan2(c3[0] - b[0], c3[1] - b[1])) > 1.2; }), ferry.path.len];
  const g = new THREE.Group(); scene.add(g); g.visible = false; ferry.g = g;
  box(g, 0xfafafa, 4.6, 1.2, 14, 0, 0.4, 0); box(g, 0x1565c0, 4.7, 0.3, 14.1, 0, 1.0, 0); box(g, 0xfff59d, 4, 0.15, 10, 0, 3.2, -0.5);
  for (const [px, pz] of [[-1.9, -5], [1.9, -5], [-1.9, 4], [1.9, 4]]) box(g, 0xeeeeee, 0.12, 2.1, 0.12, px, 2.1, pz);
  const sg = signMesh(['CHANNEL CAT'], 4, 0.6, { w: 512, h: 80, bg: '#1565c0', fg: '#ffffff', size: 56 }); sg.position.set(0, 3.6, 0); sg.rotation.y = Math.PI / 2; g.add(sg);
  const sg2 = sg.clone(); sg2.rotation.y = -Math.PI / 2; g.add(sg2);
}
function updateFerry(tSec, focus) {
  const P = ferry.path; if (!P) return;
  // runs the route out and back at 4 m/s, 45 s at each stop
  const legs = []; for (let i = 1; i < ferry.stops.length; i++) legs.push([ferry.stops[i - 1], ferry.stops[i]]);
  const all = [...legs, ...legs.slice().reverse().map(([a, b]) => [b, a])], dur = all.map(([a, b]) => Math.abs(b - a) / 4 + 45), T = dur.reduce((a, b) => a + b, 0);
  let t = tSec % T, k = 0; while (t > dur[k]) t -= dur[k++];
  const [a, b] = all[k], move = Math.max(0, t - 45) * 4, s = a + Math.sign(b - a) * Math.min(Math.abs(b - a), move), q = pathPose(P, s);
  ferry.x = q.x; ferry.z = q.z; ferry.h = b > a ? q.h : q.h + Math.PI;
  ferry.g.visible = !!focus && Math.hypot(q.x - focus.x, q.z - focus.z) < 1200;
  if (ferry.g.visible) { ferry.g.position.set(q.x, WATER_Y, q.z); ferry.g.rotation.y = ferry.h; }
}

// ---------- freight trains on the real lines (D.rail.lines: the long ones; crossings precomputed by the map build) ----------
const trains = [];
export const trainCars = []; // every car of every train (c.active when it's on the track)
function initTrain() {
  if (!D.rail || !D.rail.lines.length) return;
  const lines = D.rail.lines.slice(0, 5);
  lines.forEach((flat, li) => {
    const line = pathOf(flat);
    const tr = { line, cars: [], crossings: [], speed: li === 0 ? 9 : 11 + (li % 3), phase: li * 0.37, built: false };
    // two locomotives and a string of boxcars, hoppers and tankers (meshes are made the first time the train comes near)
    const kinds = ['loco', ...Array.from({ length: 16 + (li % 3) * 6 }, (_, i) => ['box', 'hopper', 'tank', 'box', 'hopper'][(i + li) % 5]), 'loco'];
    let off = 0;
    for (const k of kinds) { const len = k === 'loco' ? 21 : 16; const c = { k, g: null, len, off: off + len / 2, T: { len, wid: 3.1, hgt: 4.5, mass: 400 }, x: 0, z: 0, y: 0, h: 0, vx: 0, vz: 0, w: 0, li }; tr.cars.push(c); trainCars.push(c); off += len + 1; }
    tr.length = off;
    for (const [cl, s, x, z, rh, width] of D.rail.crossings || []) if (cl === li) tr.crossings.push({ x, z, s, e: { width }, rh, down: 0, g: null });
    trains.push(tr);
  });
}
function carMesh(c) {
  const g = new THREE.Group(); scene.add(g); g.visible = false;
  const k = c.k, len = c.len, col = k === 'loco' ? [0xd32f2f, 0xf9a825, 0x1565c0][c.li % 3] : k === 'box' ? [0x8d3b2a, 0x546e7a, 0x6d4c41][Math.floor(Math.random() * 3)] : k === 'hopper' ? 0x9e9e9e : 0x263238;
  box(g, 0x212121, 3, 0.8, len, 0, 0.9, 0);
  if (k === 'loco') { box(g, col, 3, 3.2, len * 0.75, 0, 2.9, -len * 0.1); box(g, 0xfafafa, 3.05, 0.4, len * 0.75, 0, 2.2, -len * 0.1); box(g, col, 3, 3.8, 3.5, 0, 3.2, len / 2 - 2.4); box(g, 0x1c2a33, 2.6, 0.9, 0.05, 0, 4.2, len / 2 - 0.62); }
  else if (k === 'tank') { const tk = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, len - 1, 12), mat(col)); tk.rotation.x = Math.PI / 2; tk.position.y = 2.8; g.add(tk); }
  else box(g, col, 3, k === 'hopper' ? 3 : 3.8, len - 0.6, 0, k === 'hopper' ? 2.8 : 3.2, 0);
  for (const zz of [len / 2 - 2, -len / 2 + 2]) box(g, 0x111111, 2.6, 0.9, 2.4, 0, 0.45, zz);
  return g;
}
function trainHead(tr, tSec) {
  const L = tr.line, d = (((tSec + tr.phase * 2 * L.len / tr.speed) * tr.speed) % (2 * L.len) + 2 * L.len) % (2 * L.len);
  return d <= L.len ? { s: d, dir: 1 } : { s: 2 * L.len - d, dir: -1 };
}
function buildGates(c) {
  const g = new THREE.Group(); scene.add(g); c.g = g; c.arms = []; c.lamps = [];
  const y = terrainHeight(c.x, c.z);
  for (const side of [-1, 1]) {
    // one gate on each side of the track, on the right-hand side of each lane of traffic
    const off = c.e.width / 2 + 0.7, along = 4.5 * side;
    const rx = -Math.cos(c.rh), rz = Math.sin(c.rh), fx = Math.sin(c.rh), fz = Math.cos(c.rh);
    const px = c.x + fx * along + rx * off * -side, pz = c.z + fz * along + rz * off * -side;
    const post = new THREE.Group(); post.position.set(px, y, pz); post.rotation.y = c.rh + (side > 0 ? 0 : Math.PI); g.add(post);
    box(post, 0xeeeeee, 0.25, 3.4, 0.25, 0, 1.7, 0);
    const cross = box(post, 0xffffff, 1.6, 0.25, 0.05, 0, 3.1, 0); cross.rotation.z = 0.7; const cross2 = box(post, 0xffffff, 1.6, 0.25, 0.05, 0, 3.1, 0); cross2.rotation.z = -0.7;
    for (const lx of [-0.35, 0.35]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), glow(0xff1744, 4)); l.position.set(lx, 2.5, 0.15); post.add(l); c.lamps.push(l.material); }
    const arm = new THREE.Group(); arm.position.set(0, 1.1, 0); post.add(arm);
    const bar = box(arm, 0xffffff, c.e.width / 2 + 0.6, 0.18, 0.12, (c.e.width / 2 + 0.6) / 2 * side * -1 + 0, 0, 0);
    bar.position.x = -(c.e.width / 2 + 0.6) / 2;
    for (let k = 0; k < 4; k++) box(arm, 0xe53935, 0.4, 0.2, 0.14, -(k * 1.2 + 0.8), 0, 0);
    c.arms.push(arm);
  }
}
// Which crossings have their gates down right now (traffic stops there).
export function closedCrossings() { const out = []; for (const tr of trains) for (const c of tr.crossings) if (c.down > 0.5) out.push(c); return out; }

// ---------- per frame ----------
export function updateLandmarks(dt, tSec, focus, n) {
  updateModels(dt, focus);
  for (const [m, k] of night) m.emissiveIntensity = n * k;
  if (ferris) { ferris.rotation.z += dt * 0.12; for (const c of ferris.children) if (c.userData.gondola) c.rotation.z = -ferris.rotation.z; }
  if (fountain) { fountain.scale.y = 0.85 + Math.sin(tSec * 2.1) * 0.15; }
  if (casino.wheel) casino.wheel.rotation.z += dt * 0.6;
  updateFerry(tSec, focus);
  // barges
  if (riverPath) for (const b of barges) {
    const span = riverPath.len - b.len - 50, period = (2 * span) / 2.4;
    const d = ((tSec / period + b.off) % 1) * 2 * span, s = d <= span ? d : 2 * span - d, dirF = d <= span ? 1 : -1;
    const p = pathPose(riverPath, s + 25), nx = -Math.cos(p.h), nz = Math.sin(p.h);
    b.g.position.set(p.x + nx * 60 * b.side, WATER_Y - 0.8, p.z + nz * 60 * b.side);
    b.g.rotation.y = dirF > 0 ? p.h : p.h + Math.PI;
    b.x = b.g.position.x; b.z = b.g.position.z; b.h = b.g.rotation.y;
    b.g.visible = !!focus && Math.hypot(b.x - focus.x, b.z - focus.z) < 2500;
  }
  // trains
  const near2 = (x, z, r = 650) => focus && Math.hypot(x - focus.x, z - focus.z) < r;
  for (const tr of trains) {
    const head = trainHead(tr, tSec), L = tr.line;
    for (const c of tr.cars) {
      const s = head.s - c.off * head.dir;
      if (s <= 0 || s >= L.len) { if (c.g) c.g.visible = false; c.active = false; continue; }
      const p = pathPose(L, s);
      c.x = p.x; c.z = p.z; c.h = head.dir > 0 ? p.h : p.h + Math.PI; c.y = terrainHeight(p.x, p.z) + 0.25;
      c.vx = Math.sin(c.h) * tr.speed; c.vz = Math.cos(c.h) * tr.speed; c.active = true;
      const vis = near2(c.x, c.z);
      if (vis && !c.g) c.g = carMesh(c);
      if (c.g) { c.g.visible = vis; if (vis) { c.g.position.set(c.x, c.y, c.z); c.g.rotation.y = c.h; } }
    }
    // gates come down when the train is within 160 m of the crossing (or on it)
    const tail = head.s - tr.length * head.dir, lo = Math.min(head.s, tail) - 160, hi = Math.max(head.s, tail) + 160;
    for (const c of tr.crossings) {
      const want = c.s > lo && c.s < hi ? 1 : 0;
      c.down += Math.sign(want - c.down) * Math.min(Math.abs(want - c.down), dt * 0.5);
      if (near2(c.x, c.z, 400)) {
        if (!c.g) buildGates(c);
        c.g.visible = true;
        for (const a of c.arms) a.rotation.z = (1 - c.down) * 1.45;
        const lit = c.down > 0.05 && Math.floor(tSec * 3) % 2;
        c.lamps.forEach((m, i) => { m.emissiveIntensity = c.down > 0.05 ? ((i % 2) === (lit ? 1 : 0) ? 4 : 0.1) : 0; });
        // horn when the train nears a crossing close to you
        const ds = Math.abs(c.s - head.s);
        if (ds < 90 && ds > 60 && near2(c.x, c.z, 350) && (!c.hornT || tSec - c.hornT > 20)) { c.hornT = tSec; ctx.horn(c.x, c.z); }
      } else if (c.g) c.g.visible = false;
    }
  }
}
export function bargeList() { return barges.filter((b) => b.x !== undefined).map((b) => ({ x: b.x - Math.sin(b.h) * -60, z: b.z - Math.cos(b.h) * -60, h: b.h, T: { len: 200, wid: 22, hgt: 6, mass: 2000 }, vx: 0, vz: 0, w: 0, y: WATER_Y })); }
// The Channel Cat's position (for collisions / boarding later).
export const channelCat = () => (ferry.g ? { x: ferry.x, z: ferry.z, h: ferry.h, T: { len: 14, wid: 4.6, hgt: 3.5, mass: 120 }, vx: 0, vz: 0, w: 0, y: WATER_Y } : null);
