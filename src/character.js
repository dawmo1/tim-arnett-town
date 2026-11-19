import * as THREE from 'three';

const box = new THREE.BoxGeometry(1, 1, 1);
const mats = new Map();
export function mat(c) {
  let m = mats.get(c);
  if (!m) { m = new THREE.MeshLambertMaterial({ color: c }); mats.set(c, m); }
  return m;
}
function part(parent, c, sx, sy, sz, x, y, z) {
  const m = new THREE.Mesh(box, mat(c));
  m.scale.set(sx, sy, sz); m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0x5c3a1e];
const SHIRT = [0xe74c3c, 0x3498db, 0xf1c40f, 0x2ecc71, 0xffffff, 0x9b59b6, 0xff7f50, 0x1abc9c, 0xff69b4, 0x222222, 0xf39c12];
const PANTS = [0x2c3e50, 0x34495e, 0x1f3a93, 0x7f8c8d, 0x8b5a2b, 0x111111, 0xd2b48c];
const HAIR = [0x111111, 0x3b2314, 0x8b4513, 0xd4a017, 0xb22222, 0x777777];
// look = [skin, shirt, pants, hair, style]; style is a number whose bits pick hats, shorts, shades etc.
export function randomLook(r = Math.random) {
  const pick = (a) => a[Math.floor(r() * a.length)];
  return [pick(SKIN), pick(SHIRT), pick(PANTS), pick(HAIR), Math.floor(r() * 4096)];
}
const SHOES = [0x111111, 0xf5f5f5, 0x8b4513, 0xd32f2f, 0x1565c0];
const HATS = [0xd32f2f, 0x1565c0, 0x111111, 0xf5f5f5, 0x2e7d32, 0xffb300];

export function makeCharacter(look, opts = {}) {
  const [skin, shirt, pants, hair] = look;
  const style = look[4] | 0;
  const hatType = opts.hat === 'cop' ? 9 : style & 3;          // 0 none, 1 cap, 2 beanie, 3 none
  const shorts = !opts.hat && (style >> 2) & 1;
  const shades = !opts.hat && ((style >> 3) & 3) === 0;
  const longHair = (style >> 5) & 1;
  const tank = !opts.hat && ((style >> 6) & 3) === 0;
  const shoe = opts.hat ? 0x111111 : SHOES[(style >> 8) % SHOES.length];
  const hatColor = HATS[(style >> 9) % HATS.length];
  const hand = new THREE.Color(skin).multiplyScalar(0.88).getHex();

  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const leg = (x) => {
    const hip = new THREE.Group(); hip.position.set(x, 0.85, 0); body.add(hip);
    if (shorts) { part(hip, pants, 0.24, 0.42, 0.28, 0, -0.2, 0); part(hip, skin, 0.18, 0.4, 0.2, 0, -0.6, 0); }
    else part(hip, pants, 0.22, 0.8, 0.26, 0, -0.4, 0);
    part(hip, shoe, 0.24, 0.12, 0.36, 0, -0.8, 0.05);
    return hip;
  };
  const hipL = leg(-0.14), hipR = leg(0.14);
  part(body, shirt, 0.56, 0.62, 0.32, 0, 1.22, 0);
  part(body, 0x2b2b2b, 0.58, 0.08, 0.34, 0, 0.9, 0); // belt
  if (opts.hat === 'cop') { part(body, 0xffd54f, 0.1, 0.1, 0.02, -0.15, 1.38, 0.17); part(body, 0x111111, 0.1, 0.2, 0.36, 0.22, 0.98, 0); }
  else if (!tank) part(body, new THREE.Color(shirt).multiplyScalar(0.85).getHex(), 0.3, 0.06, 0.33, 0, 1.52, 0); // collar
  const head = new THREE.Group(); head.position.set(0, 1.53, 0); body.add(head);
  part(head, skin, 0.14, 0.1, 0.14, 0, 0.0, 0); // neck
  part(head, skin, 0.34, 0.36, 0.34, 0, 0.22, 0);
  part(head, hand, 0.06, 0.08, 0.06, 0, 0.2, 0.19); // nose
  part(head, 0x7a3b3b, 0.12, 0.03, 0.02, 0, 0.1, 0.17); // mouth
  if (shades) part(head, 0x0d0d0d, 0.3, 0.07, 0.03, 0, 0.27, 0.18);
  else { part(head, 0xffffff, 0.08, 0.06, 0.02, -0.08, 0.27, 0.17); part(head, 0xffffff, 0.08, 0.06, 0.02, 0.08, 0.27, 0.17); part(head, 0x1a1a1a, 0.04, 0.05, 0.025, -0.08, 0.27, 0.175); part(head, 0x1a1a1a, 0.04, 0.05, 0.025, 0.08, 0.27, 0.175); }
  if (hatType === 9) { part(head, 0x0d1b4a, 0.38, 0.14, 0.38, 0, 0.44, 0); part(head, 0x0d1b4a, 0.36, 0.04, 0.16, 0, 0.38, 0.24); part(head, 0xffd54f, 0.08, 0.07, 0.02, 0, 0.45, 0.2); }
  else if (hatType === 1) { part(head, hatColor, 0.37, 0.12, 0.37, 0, 0.44, 0); part(head, hatColor, 0.34, 0.04, 0.18, 0, 0.39, 0.25); }
  else if (hatType === 2) part(head, hatColor, 0.38, 0.18, 0.38, 0, 0.45, 0);
  else part(head, hair, 0.36, 0.1, 0.36, 0, 0.42, -0.01);
  if (longHair && hatType !== 9) part(head, hair, 0.36, 0.34, 0.1, 0, 0.24, -0.17);
  const arm = (x) => {
    const sh = new THREE.Group(); sh.position.set(x, 1.48, 0); body.add(sh);
    part(sh, tank ? skin : shirt, 0.18, 0.3, 0.2, 0, -0.1, 0);
    part(sh, skin, 0.15, 0.36, 0.17, 0, -0.42, 0);
    part(sh, hand, 0.14, 0.12, 0.16, 0, -0.66, 0);
    return sh;
  };
  const shL = arm(-0.37), shR = arm(0.37);
  const gun = new THREE.Group(); shR.add(gun);
  part(gun, 0x1d1d1d, 0.09, 0.14, 0.45, 0, -0.7, 0.16); part(gun, 0x3a3a3a, 0.07, 0.16, 0.08, 0, -0.78, 0.02);
  const bat = part(shR, 0x9c6b3a, 0.08, 0.08, 1.0, 0, -0.7, 0.5);
  gun.visible = false; bat.visible = false;
  return { g, body, hipL, hipR, shL, shR, head, gun, bat, walk: 0, deadT: 0, roll: (Math.random() - 0.5) * 0.8 };
}

// st: { speed, aim, swim, sit, dead, swing (0..1), weapon: 'gun'|'bat'|'none' }
export function animateCharacter(c, dt, st) {
  c.gun.visible = st.weapon === 'gun';
  c.bat.visible = st.weapon === 'bat';
  if (st.dead) {
    c.deadT = Math.min(1, c.deadT + dt * 3);
    const e = 1 - (1 - c.deadT) * (1 - c.deadT);
    c.body.rotation.set(-Math.PI / 2 * e, 0, c.roll * e);
    c.body.position.y = 0.17 * e;
    c.shL.rotation.set(0, 0, -1.3 * e); c.shR.rotation.set(0, 0, 1.3 * e);
    c.hipL.rotation.set(0, 0, -0.3 * e); c.hipR.rotation.set(0, 0, 0.3 * e);
    return;
  }
  c.deadT = 0;
  c.body.rotation.set(0, 0, 0);
  c.body.position.y = 0;
  c.hipL.rotation.z = 0; c.hipR.rotation.z = 0; c.shL.rotation.z = 0; c.shR.rotation.z = 0;
  if (st.sit) {
    c.hipL.rotation.x = -1.4; c.hipR.rotation.x = -1.4;
    c.shL.rotation.x = -1.2; c.shR.rotation.x = -1.2;
    return;
  }
  if (st.reach || st.pull !== undefined) {
    // reaching for a car door / dragging a driver out
    const k = st.pull !== undefined ? Math.sin(Math.min(1, st.pull) * Math.PI) : 0;
    c.shL.rotation.x = c.shR.rotation.x = -1.4 + k * 0.6;
    c.hipL.rotation.x = 0.3 * k; c.hipR.rotation.x = -0.2 * k;
    c.body.rotation.x = -0.25 * k;
    return;
  }
  const sp = st.speed || 0;
  c.walk += dt * (st.swim ? 4 : sp * 2.2);
  const amp = st.swim ? 1.4 : Math.min(1, sp / 4) * 0.75;
  const s = Math.sin(c.walk) * amp;
  c.hipL.rotation.x = st.swim ? s * 0.4 : s;
  c.hipR.rotation.x = st.swim ? -s * 0.4 : -s;
  c.shL.rotation.x = st.swim ? -Math.PI / 2 + Math.sin(c.walk) * 1.2 : -s * 0.8;
  if (st.swing > 0) c.shR.rotation.x = -Math.PI / 2 - Math.sin(st.swing * Math.PI) * 1.4 + 0.6;
  else if (st.aim) c.shR.rotation.x = -Math.PI / 2;
  else c.shR.rotation.x = st.swim ? -Math.PI / 2 + Math.sin(c.walk + Math.PI) * 1.2 : s * 0.8;
  if (st.phone) { c.shL.rotation.x = -2.6; c.shL.rotation.z = -0.5; }
}

export function nameTag(text, color = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = 'bold 34px system-ui, sans-serif';
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
