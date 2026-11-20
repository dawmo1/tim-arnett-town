// Builds a person from the Blender model (assets/models/people.glb): the shared skinned body with
// body-type morphs, a merged mesh of their hair/hat/beard/glasses on the same skeleton, and one
// material that colours everything from the shared atlas (paint.js). About two draw calls a person.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { gltf } from '../assets.js';
import { paintAtlas, CELL } from './paint.js';
import { normLook, SKIN, HAIRC, CLOTH, HAIRS, HATS, GLASSES, BEARDS, MASKS, TOPS, BOTTOMS, BODIES } from './looks.js';

export let T = null; // template
const accGeoCache = new Map();

export function initPeople(quality = 'medium') {
  if (T) return T;
  const g = gltf('people'); if (!g) return null;
  g.scene.updateMatrixWorld(true);
  let rig = null, body = null;
  const acc = new Map();
  g.scene.traverse((o) => {
    if (o.isSkinnedMesh && o.name === 'body') body = o;
    else if (o.isMesh && !o.isSkinnedMesh) acc.set(o.name, o);
  });
  rig = body.parent;
  while (rig.parent && rig.parent !== g.scene) rig = rig.parent;
  const bones = body.skeleton.bones, bi = new Map(bones.map((b, i) => [b.name, i]));
  const inv = body.matrixWorld.clone().invert();
  // accessory geometry in the body's bind space, rigidly skinned to one bone
  const accGeo = new Map();
  for (const [name, o] of acc) {
    const geo = o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld).applyMatrix4(inv);
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    geo.morphAttributes = {};
    if (!geo.index) geo.setIndex([...Array(geo.attributes.position.count).keys()]);
    accGeo.set(name, geo);
  }
  const atlas = paintAtlas(quality === 'low' ? 1024 : 2048);
  T = { rig, body, bones, bi, accGeo, atlas, morph: body.morphTargetDictionary };
  return T;
}

// one material per person: their colours, outfit cells, face and tattoos
const tmpC = new THREE.Color();
const col = (pal, i) => new THREE.Color(pal[((i % pal.length) + pal.length) % pal.length]);
function makeMaterial(L) {
  const cells = new Float32Array(8), tA = [], tB = [];
  for (let i = 0; i < 8; i++) { tA.push(new THREE.Color(1, 1, 1)); tB.push(new THREE.Color(1, 1, 1)); }
  const U = { pCell: { value: cells }, pTA: { value: tA }, pTB: { value: tB }, pSkin: { value: new THREE.Color() }, pTat: { value: -1 } };
  const m = new THREE.MeshStandardMaterial({ map: T.atlas, roughness: 0.78, metalness: 0, envMapIntensity: 0.6 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float pCell[8]; uniform vec3 pTA[8]; uniform vec3 pTB[8]; uniform vec3 pSkin; uniform float pTat;')
      .replace('#include <map_fragment>', `
        #ifdef USE_MAP
        int ri = int(clamp(floor(vMapUv.x), 0.0, 7.0));
        vec2 lc = vec2(fract(vMapUv.x), 1.0 - clamp(vMapUv.y, 0.0, 1.0)); // glTF stores v flipped
        float pc = pCell[ri];
        vec2 cuv = (vec2(mod(pc, 8.0), 7.0 - floor(pc / 8.0)) + 0.025 + lc * 0.95) / 8.0;
        vec4 tx = texture2D(map, cuv);
        float a = tx.a;
        vec3 tint = a > 0.9 ? pTA[ri] : a > 0.7 ? pTB[ri] : a > 0.5 ? pSkin : vec3(1.0);
        vec3 pcol = tx.rgb * tint;
        if (pTat >= 0.0 && ri == 2 && a > 0.5 && a < 0.7) {
          vec2 tu = (vec2(mod(pTat, 8.0), 7.0 - floor(pTat / 8.0)) + 0.025 + lc * 0.95) / 8.0;
          vec4 tt = texture2D(map, tu);
          pcol = mix(pcol, tt.rgb, step(0.3, tt.a) * 0.85);
        }
        diffuseColor.rgb *= pcol;
        #endif`);
  };
  m.customProgramCacheKey = () => 'person1';
  m.userData.U = U;
  applyLook(m, L);
  return m;
}
export function applyLook(m, L, scared = false) {
  const U = m.userData.U, c = U.pCell.value, A = U.pTA.value, Bv = U.pTB.value;
  const mask = MASKS[L[18]];
  c[0] = mask === 'ski' ? CELL.ski : mask === 'tim' ? CELL.tim : mask === 'mascot' ? CELL.mascotFace : CELL.face(L[2] % 10, scared);
  c[1] = CELL.skin; c[2] = CELL.top(L[6]); c[3] = CELL.bottom(L[9]); c[4] = CELL.shoe(L[11]); c[5] = CELL.hair;
  c[6] = HATS[L[13]] === 'police' ? CELL.hatPolice : CELL.hat; c[7] = CELL.fixed;
  U.pSkin.value.copy(col(SKIN, L[3]));
  A[0].copy(U.pSkin.value); Bv[0].copy(col(HAIRC, L[5])); // face: brows/stubble use the hair colour
  A[2].copy(col(CLOTH, L[7])); Bv[2].copy(col(CLOTH, L[8]));
  A[3].copy(col(CLOTH, L[10])); Bv[3].copy(col(CLOTH, L[19]));
  A[4].copy(col(CLOTH, L[12])); Bv[4].copy(col(CLOTH, 0));
  A[5].copy(col(HAIRC, L[5])); Bv[5].copy(A[5]);
  A[6].copy(col(CLOTH, L[14])); Bv[6].copy(col(CLOTH, L[14] === 0 ? 1 : 0));
  U.pTat.value = L[17] ? CELL.tattoo : -1;
  m.userData.scared = scared;
}
export function setExpression(ch, scared) {
  if (!ch.mat || ch.mat.userData.scared === scared) return;
  const U = ch.mat.userData.U, L = ch.look;
  if (MASKS[L[18]]) return;
  U.pCell.value[0] = CELL.face(L[2] % 10, scared); ch.mat.userData.scared = scared;
}

// hair + hat + beard + glasses merged into one geometry, skinned rigidly to the head bone
function accessoryGeometry(L) {
  const mask = MASKS[L[18]];
  const hat = HATS[L[13]];
  let hair = mask ? null : HAIRS[L[4]];
  if (hat && hair && ['afro', 'mohawk', 'bun', 'dreads'].includes(hair)) hair = 'short';
  if (hat === 'swat' || hat === 'fire' || hat === 'hard' || hat === 'police') hair = hair && ['long', 'shoulder', 'pony'].includes(hair) ? hair : hair ? 'buzz' : null;
  const parts = [hair && 'hair_' + hair, hat && 'hat_' + hat, !mask && BEARDS[L[16]] && 'beard_' + BEARDS[L[16]], GLASSES[L[15]] && 'glasses_' + GLASSES[L[15]]].filter(Boolean);
  if (!parts.length) return null;
  const key = parts.join('|');
  let geo = accGeoCache.get(key);
  if (geo) return geo;
  const list = parts.map((n) => T.accGeo.get(n)).filter(Boolean);
  if (!list.length) return null;
  geo = list.length === 1 ? list[0].clone() : mergeGeometries(list, false);
  const n = geo.attributes.position.count, head = T.bi.get('head');
  const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { si[i * 4] = head; sw[i * 4] = 1; }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  geo.computeBoundingSphere();
  accGeoCache.set(key, geo);
  return geo;
}

// A prop (bag, phone, cane...) held on a bone: shares the person's material.
export function propMesh(name, m) {
  const geo = T.accGeo.get('acc_' + name); if (!geo) return null;
  const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true;
  return mesh;
}

export function buildPerson(look) {
  const L = normLook(look);
  const rig = SkeletonUtils.clone(T.rig);
  let body = null; rig.traverse((o) => { if (o.isSkinnedMesh && o.name === 'body') body = o; });
  const mat = makeMaterial(L);
  body.material = mat; body.castShadow = true; body.receiveShadow = false;
  // body type
  const infl = body.morphTargetInfluences; infl.fill(0);
  const bt = BODIES[L[1]]; if (bt !== 'base' && T.morph[bt] !== undefined) infl[T.morph[bt]] = 1;
  const bones = {};
  for (const b of body.skeleton.bones) bones[b.name] = b;
  let acc = null;
  const ageo = accessoryGeometry(L);
  if (ageo) {
    acc = new THREE.SkinnedMesh(ageo, mat);
    acc.name = 'acc'; acc.castShadow = true;
    body.parent.add(acc);
    acc.bind(body.skeleton, body.bindMatrix);
  }
  return { rig, body, acc, mat, bones, look: L };
}
