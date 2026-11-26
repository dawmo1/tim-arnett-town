// People on screen: built from the Blender model (people/rig.js), dressed from the shared atlas
// (people/paint.js) and animated by people/pose.js. This file keeps the small API the rest of the
// game uses: makeCharacter, placeCharacter, animateCharacter, disposeCharacter, nameTag, mat.
import * as THREE from 'three';
import { initPeople, buildPerson, propMesh, setExpression, T } from './people/rig.js';
import { initPose, animate, snapPose } from './people/pose.js';
import { randomLook as rl, roleLook, normLook } from './people/looks.js';
import { gltf } from './assets.js';

const mats = new Map();
export function mat(c) {
  let m = mats.get(c);
  if (!m) { m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.82, metalness: 0 }); mats.set(c, m); }
  return m;
}
export const randomLook = (r = Math.random) => rl(r);
export { roleLook, normLook };

let ready = false;
export function initCharacters(quality) { if (!ready) { initPeople(quality); initPose(); ready = true; } }

// Held weapons come from assets/models/weapons.glb (grip at the origin, barrel forward). In the
// hand's canonical frame the arm hangs down, so the barrel goes along -Y and the grip's top faces +Z.
const WEAPON_SRC = new Map();
export function weaponModel(name) {
  if (!name) return null;
  let src = WEAPON_SRC.get(name);
  if (src === undefined) {
    const g = gltf('weapons'); src = null;
    if (g) g.scene.traverse((o) => { if (!src && o.name === 'w_' + name) src = o; });
    WEAPON_SRC.set(name, src);
  }
  if (!src) return null;
  const m = src.clone(true);
  m.position.set(0, 0, 0); m.rotation.set(0, 0, 0);
  m.traverse((o) => { if (o.isMesh) o.castShadow = true; if (o.name.startsWith('muzzle')) m.userData.muzzle = o; });
  return m;
}
export function holdWeapon(ch, name) {
  if (ch.heldName === name) return ch.held;
  if (ch.held) ch.held.visible = false;
  ch.heldName = name; ch.held = null;
  if (!name) return null;
  let m = ch.weapons[name];
  if (!m) {
    m = weaponModel(name); if (!m) return null;
    const twoHanded = ['bat', 'crowbar'].includes(name);
    canonicalChild(ch.bones.handR, 'handR', m, [0, -0.085, 0.015], [Math.PI / 2, 0, 0]);
    ch.weapons[name] = m;
    if (twoHanded) m.position.y -= 0.02;
  }
  m.visible = true; ch.held = m;
  return m;
}
const MUZ = new THREE.Vector3();
// where bullets leave the gun (world space), or null
export function muzzleOf(ch) { const m = ch.held && ch.held.userData.muzzle; if (!m) return null; m.getWorldPosition(MUZ); return MUZ; }
function canonicalChild(bone, name, obj, pos, rot = [0, 0, 0]) {
  // place obj at `pos` (character space at the canonical pose, relative to the bone) and orient it
  const r = boneRest(name), q = r.Ci;
  obj.position.copy(new THREE.Vector3(...pos).applyQuaternion(q));
  obj.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)));
  bone.add(obj);
  return obj;
}
let REST_CACHE = null;
function boneRest(name) {
  if (!REST_CACHE) REST_CACHE = {};
  if (!REST_CACHE[name]) { const { REST } = POSE; REST_CACHE[name] = { Ci: REST[name].C.clone().invert() }; }
  return REST_CACHE[name];
}
import * as POSE from './people/pose.js';

export function makeCharacter(look, opts = {}) {
  if (!ready) initCharacters();
  let L = look;
  if (opts.hat === 'cop') L = roleLook('police');
  else if (opts.role) L = roleLook(opts.role);
  const p = buildPerson(L);
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body); body.add(p.rig);
  const seed = Math.random() * 100;
  const female = p.look[1] === 3;
  p.rig.scale.setScalar((female ? 0.95 : 1.0) * (0.96 + (seed % 1) * 0.08));
  const B = p.bones;
  const ch = { g, body, rig: p.rig, mesh: p.body, acc: p.acc, mat: p.mat, bones: B, look: p.look, weapons: {}, held: null, heldName: null, props: {}, seed, roll: (Math.random() - 0.5) * 2, walk: 0, deadT: 0 };
  ch.armOut = [3, 10, 0, 2, 8][p.look[1]] ?? 3; // arms clear of the hips and belly, by build
  // walk style (people/pose.js): heavy people waddle, women sway, grey-haired people shuffle; npc.js sets 'gang'
  ch.style = p.look[1] === 1 ? 'fat' : female ? 'woman' : p.look[5] === 7 || p.look[5] === 8 ? 'old' : null;
  return ch;
}

// carried things on the right bone, in the canonical frame (arms hanging down)
const PROP_AT = {
  backpack: ['chest', [0, 0.05, -0.2], [0, 0, 0]],
  bag: ['handL', [0.02, -0.12, 0], [0, 0, 0]],
  mailbag: ['hips', [-0.22, -0.05, 0.02], [0, 0, 0]],
  guitar: ['chest', [0, -0.05, 0.17], [0, 0, 0.9]],
  cane: ['handR', [0, -0.05, 0.02], [0, 0, 0]],
  phone: ['handL', [0, -0.08, 0.03], [0, 0, 0]],
  cig: ['handR', [0, -0.1, 0.02], [0, 0, 0]],
  coffee: ['handL', [0, -0.09, 0.03], [0, 0, 0]],
  sign: ['handR', [0, -0.04, 0], [Math.PI, 0, 0]],
  // held during actions (src/anim.js)
  cash: ['handR', [0, -0.1, 0.03], [0, 0, 0]],
  moneybag: ['handL', [0, -0.1, 0], [0, 0, 0]],
  cue: ['handR', [0, -0.09, 0.01], [0, Math.PI, 0]],
  dart: ['handR', [0, -0.11, 0.02], [0, 0, 0]],
  cards: ['handL', [0, -0.1, 0.03], [0, 0, 0]],
  hotdog: ['handR', [0, -0.1, 0.05], [0, 0, Math.PI / 2]],
  beer: ['handR', [0, -0.09, 0.04], [0, 0, 0]],
};
export function setProp(ch, name, on = true) {
  if (!ch.bones) return null;
  let o = ch.props[name];
  if (on && !o) {
    const at = PROP_AT[name]; if (!at) return null;
    o = propMesh(name, ch.mat); if (!o) return null;
    canonicalChild(ch.bones[at[0]], at[0], o, at[1], at[2]);
    ch.props[name] = o;
  }
  if (o) o.visible = on;
  return o;
}

export function disposeCharacter(c) { c.mat?.dispose(); }

export function placeCharacter(c, x, y, z, h) {
  if (c.rag) return;
  c.g.position.set(x, y, z);
  c.g.rotation.set(0, h, 0);
}
export function animateCharacter(c, dt, st) {
  if (c.rag) return;
  // st.wmodel names the model; older callers just say weapon: 'gun' | 'bat'
  holdWeapon(c, st.wmodel !== undefined ? st.wmodel : st.weapon === 'gun' ? 'pistol' : st.weapon === 'bat' ? 'bat' : null);
  c.animSpeed = st.speed || 0;
  setExpression(c, !!(st.cower || st.handsUp || st.beg || st.scared || st.flee));
  animate(c, dt, st);
  // long guns point where the person faces (and aims), not along the forearm
  if (c.held && LONG.has(c.heldName)) {
    c.g.updateMatrixWorld(true);
    const tilt = st.aim ? -(st.pitch || 0) * DEG : 0.55;
    LQ.copy(c.g.quaternion).multiply(LE.setFromEuler(LEU.set(tilt, 0, 0)));
    c.held.parent.getWorldQuaternion(LQ2);
    c.held.quaternion.copy(LQ2.invert().multiply(LQ));
  }
}
const LONG = new Set(['smg', 'shotgun', 'rifle', 'sniper', 'rpg']), DEG = Math.PI / 180;
const LQ = new THREE.Quaternion(), LQ2 = new THREE.Quaternion(), LE = new THREE.Quaternion(), LEU = new THREE.Euler();
export { snapPose };

export function nameTag(text, color = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = '38px "Pricedown Bl", Impact, sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,.75)';
  x.strokeText(text, 128, 32);
  x.fillStyle = color; x.fillText(text, 128, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(2, 0.5, 1);
  s.position.y = 2.35;
  s.renderOrder = 10;
  return s;
}
