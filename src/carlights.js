// Car lights. Every lamp in town (headlights, tail and brake lights, reverse lights, turn signals and
// police/ambulance light bars) is one camera-facing flare in a single instanced draw call; a flare is
// brightest when you look straight into the lamp, like GTA. At night each car also paints a pool of
// light on the road ahead (one more draw call). A small, fixed set of real lights goes to the cars
// nearest the camera so they actually light up the street, walls and people; the count never changes
// while playing, so shaders don't recompile.
import * as THREE from 'three';
import * as W from './world.js';

const MAX_FLARES = 900, MAX_POOLS = 90, MAX_STREAKS = 300;
let scene, flares, glows, pools, streaks, spots = [], bars = [], quality = 'medium';
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
const up = new THREE.Vector3(0, 1, 0);

function radialTex(size, stops) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, a] of stops) gr.addColorStop(o, `rgba(255,255,255,${a})`);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}

// flare: hot core + soft halo + a faint horizontal streak (anamorphic glare)
function flareTex() {
  const n = 128, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d');
  let gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.08, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.22, 'rgba(255,255,255,0.35)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.08)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, n, n);
  gr = g.createLinearGradient(0, 0, n, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, n / 2 - 1.5, n, 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}

const flareMat = (map) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  uniforms: { map: { value: map } },
  vertexShader: `
    varying vec2 vUv; varying vec3 vCol; varying float vA;
    void main() {
      vUv = uv;
      vec4 c = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      vec3 fwd = normalize(mat3(modelMatrix * instanceMatrix) * vec3(0.0, 0.0, 1.0));
      float size = length(instanceMatrix[0].xyz);
      vec3 toCam = cameraPosition - c.xyz; float d = length(toCam);
      float face = dot(fwd, toCam / d);
      float omni = clamp(length(instanceMatrix[1].xyz) - 1.0, 0.0, 1.0); // y-scale > 1 marks light bars (seen from all sides)
      float k = mix(smoothstep(-0.15, 0.85, face), 1.0, omni);
      vCol = instanceColor; vA = k;
      // grow a little with distance so far lamps still read as points of light
      float sz = size * (0.3 + 0.7 * k) * (1.0 + clamp(d / 90.0, 0.0, 2.0));
      vec4 mv = viewMatrix * c;
      mv.xyz += normalize(-mv.xyz) * 0.4; // nudge toward the camera so the lamp's own body doesn't hide it
      mv.xy += position.xy * sz;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform sampler2D map; varying vec2 vUv; varying vec3 vCol; varying float vA;
    void main() { float a = texture2D(map, vUv).r * vA; if (a < 0.004) discard; gl_FragColor = vec4(vCol * a, a); }`,
});

// Wet-road reflections: a soft streak on the ground under a light, stretched toward the camera
// (instance scale x = width, z = length; color = brightness). Used for headlights and streetlights.
export const wetUniform = { value: 0 };
export function makeStreakMesh(count, tint = null) {
  const g = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
    polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -10,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { tint: { value: new THREE.Color(tint ?? 0xffffff) } }]),
    vertexShader: `
      #include <fog_pars_vertex>
      uniform float wet; varying vec2 vUv; varying vec3 vCol;
      void main() {
        vUv = uv;
        vec3 c = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float w = length(instanceMatrix[0].xyz), len = length(instanceMatrix[2].xyz);
        vec2 d = cameraPosition.xz - c.xz; float dl = max(length(d), 0.001); d /= dl;
        vec2 side = vec2(-d.y, d.x);
        vec3 p = vec3(c.x + side.x * position.x * w + d.x * position.y * min(len, dl * 0.8), c.y, c.z + side.y * position.x * w + d.y * position.y * min(len, dl * 0.8));
        #ifdef USE_INSTANCING_COLOR
        vCol = instanceColor;
        #else
        vCol = vec3(1.0);
        #endif
        vec4 mvPosition = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      #include <fog_pars_fragment>
      uniform float wet; uniform vec3 tint; varying vec2 vUv; varying vec3 vCol;
      void main() {
        float a = (1.0 - abs(vUv.x * 2.0 - 1.0)); a = a * a * smoothstep(0.0, 0.08, vUv.y) * pow(1.0 - vUv.y, 1.5) * wet;
        if (a < 0.003) discard;
        gl_FragColor = vec4(vCol * tint * a, a);
        #include <fog_fragment>
      }`,
  });
  m.uniforms.wet = wetUniform;
  const mesh = new THREE.InstancedMesh(g, m, count);
  mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = 4;
  return mesh;
}

export function initCarLights(s0) {
  scene = s0;
  const mk = (map) => {
    const m = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), flareMat(map), MAX_FLARES);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_FLARES * 3), 3);
    m.frustumCulled = false; m.count = 0; m.renderOrder = 5; m.userData.n = 0; scene.add(m); return m;
  };
  flares = mk(flareTex());
  // tail, brake, reverse and signal lamps: a tight glow hugging the lens (no halo, no streak); the lit lens does the rest
  glows = mk(radialTex(64, [[0, 1], [0.12, 0.85], [0.3, 0.25], [0.55, 0.04], [1, 0]]));
  // pool of light on the road: long soft oval, brighter near the car
  const pt = radialTex(128, [[0, 0.9], [0.35, 0.45], [0.7, 0.12], [1, 0]]);
  const pg = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  pools = new THREE.InstancedMesh(pg, new THREE.MeshBasicMaterial({ map: pt, color: 0xfff1cc, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8, fog: true }), MAX_POOLS);
  pools.frustumCulled = false; pools.count = 0; pools.renderOrder = 4;
  scene.add(pools);
  streaks = makeStreakMesh(MAX_STREAKS);
  streaks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_STREAKS * 3), 3);
  scene.add(streaks);
  setLightQuality(quality);
}

// Real lights by graphics level: two spots per car (one per headlamp). Low: only your own car, no light-bar lights.
export function setLightQuality(qq) {
  quality = qq;
  if (!scene) return;
  const ns = qq === 'low' ? 2 : qq === 'medium' ? 6 : 8, nb = qq === 'low' ? 0 : qq === 'medium' ? 2 : 3;
  for (const l of spots) { scene.remove(l, l.target); l.dispose(); }
  for (const l of bars) { scene.remove(l); l.dispose(); }
  spots = []; bars = [];
  for (let i = 0; i < ns; i++) { const l = new THREE.SpotLight(0xfff0d0, 0, 48, 0.5, 0.55, 1.6); l.position.set(0, -999, 0); scene.add(l, l.target); spots.push(l); }
  for (let i = 0; i < nb; i++) { const l = new THREE.PointLight(0xff2030, 0, 30, 1.6); l.position.set(0, -999, 0); scene.add(l); bars.push(l); }
}

// Lamp layout for a vehicle: from its model if it has one, else from its size.
export function lampsOf(v) {
  const ud = v.mesh.userData;
  if (ud.lamps) return ud.lamps;
  const T = v.T, fz = T.len / 2 + 0.04, y = T.bike ? 0.95 : T.cabbed || T.truck || T.bus ? 0.78 : 0.3 + T.hgt * 0.32;
  const xs = T.bike ? [0] : [T.wid / 2 - 0.32, -T.wid / 2 + 0.32];
  const L = { head: xs.map((x) => [x, y, fz]), tail: xs.map((x) => [x, y + 0.02, -fz]), bar: null, size: T.bike ? 0.9 : 1.25 };
  if (ud.lights) L.bar = [[0.35, T.hgt + 0.12, T.cabbed ? T.len / 2 - 1.1 : -0.1], [-0.35, T.hgt + 0.12, T.cabbed ? T.len / 2 - 1.1 : -0.1]];
  ud.lamps = L;
  return L;
}

let np = 0, ns = 0;
function flare(mesh, lx, ly, lz, back, size, r, g, b, omni = false, im = flares) {
  const n = im.userData.n; if (n >= MAX_FLARES) return;
  p.set(lx, ly, lz).applyMatrix4(mesh.matrixWorld);
  q.setFromRotationMatrix(mesh.matrixWorld); if (back) q.multiply(flipY);
  s.set(size, omni ? 2 : 1, size);
  m4.compose(p, q, s); im.setMatrixAt(n, m4);
  col.setRGB(r, g, b); im.setColorAt(n, col); im.userData.n = n + 1;
}
const glow = (mesh, lx, ly, lz, back, size, r, g, b) => flare(mesh, lx, ly, lz, back, size, r, g, b, false, glows);
function streak(mesh, v, h, r, g, b) {
  if (ns >= MAX_STREAKS) return;
  p.set(h[0], h[1], h[2]).applyMatrix4(mesh.matrixWorld); p.y = v.y + 0.05;
  m4.makeScale(0.55, 1, 7); m4.setPosition(p); streaks.setMatrixAt(ns, m4);
  col.setRGB(r, g, b); streaks.setColorAt(ns++, col);
}
const flipY = new THREE.Quaternion().setFromAxisAngle(up, Math.PI);

// cars: [{ v, on, braking, reversing, signal, bar }], camPos: camera position, night 0..1, mine: your vehicle
export function updateCarLights(cars, camPos, night, mine, t) {
  flares.userData.n = glows.userData.n = 0; np = 0; ns = 0;
  const blink = Math.floor(t * 2.6) % 2 === 0, flash = Math.floor(t * 7) % 2;
  const lit = night > 0.05;
  const cand = [];
  for (const c of cars) {
    const v = c.v, mesh = v.mesh;
    if (!mesh.visible || v.exploded || v.hp <= 0) continue;
    const dx = v.x - camPos.x, dz = v.z - camPos.z, d2 = dx * dx + dz * dz;
    if (d2 > 260 * 260) continue;
    mesh.updateMatrixWorld();
    const L = lampsOf(v), sz = L.size, on = c.on;
    if (on && wetUniform.value > 0.02 && d2 < 120 * 120) for (const h of L.head) streak(mesh, v, h, 0.6 * (0.3 + night), 0.56 * (0.3 + night), 0.46 * (0.3 + night));
    if (on && !v.brokenHead) for (const h of L.head) flare(mesh, h[0], h[1], h[2], false, sz * (0.28 + night * 0.27), 0.33 + night * 0.3, 0.31 + night * 0.28, 0.27 + night * 0.23);
    const tailK = v.brokenTail ? 0 : (on ? 0.35 + night * 0.4 : 0) + (c.braking ? 0.9 : 0);
    if (tailK > 0.6 && wetUniform.value > 0.02 && d2 < 90 * 90) for (const h of L.tail) streak(mesh, v, h, 0.8 * tailK, 0.03, 0.02);
    // small and tight, dimmer by day (the lens itself glows; braking brightens it, see setCarLamps)
    const tk = c.braking ? 0.5 + night * 0.4 : 0.22 + night * 0.33;
    if (tailK > 0) for (const h of L.tail) glow(mesh, h[0], h[1], h[2], true, sz * (c.braking ? 0.17 + night * 0.12 : 0.12 + night * 0.1), tk, 0.03 * tk, 0.02 * tk);
    if (c.reversing) for (const h of L.tail) glow(mesh, h[0] * 0.6, h[1], h[2], true, sz * (0.13 + night * 0.09), 0.45 + night * 0.35, 0.45 + night * 0.35, 0.42 + night * 0.32);
    if (c.signal && blink) {
      const side = c.signal === 2 ? 0 : c.signal > 0 ? -1 : 1; // + = right turn; car-local +x is the left side; 2 = hazards
      const sk = 0.6 + night * 0.4, ss = sz * (0.15 + night * 0.08);
      for (const h of L.head) if (!side || Math.sign(h[0]) === side) glow(mesh, h[0] + side * 0.12, h[1] - 0.08, h[2], false, ss, 1 * sk, 0.48 * sk, 0.04 * sk);
      for (const h of L.tail) if (!side || Math.sign(h[0]) === side) glow(mesh, h[0] + side * 0.12, h[1] + 0.06, h[2], true, ss, 1 * sk, 0.48 * sk, 0.04 * sk);
    }
    if (c.bar && L.bar) {
      flare(mesh, L.bar[0][0], L.bar[0][1], L.bar[0][2], false, 1.0, flash ? 0.9 : 0.08, flash ? 0.03 : 0.01, flash ? 0.05 : 0.01, true);
      flare(mesh, L.bar[1][0], L.bar[1][1], L.bar[1][2], false, 1.0, flash ? 0.03 : 0.08, flash ? 0.09 : 0.16, flash ? 0.24 : 1.0, true);
    }
    if (on && lit) cand.push({ c, v, d2, mine: v === mine });
  }
  // real lights: your car first, then the nearest cars in front of the camera
  cand.sort((a, b) => (b.mine - a.mine) || a.d2 - b.d2);
  let si = 0;
  for (const k of cand) {
    const v = k.v, fx = Math.sin(v.h), fz = Math.cos(v.h), L = lampsOf(v), mw = v.mesh.matrixWorld;
    const real = si + L.head.length <= spots.length && (k.mine || quality !== 'low') && k.d2 < 140 * 140;
    if (real) for (const h of L.head) {
      // one spot per headlamp, just ahead of the lens, aimed down the road and a little outward
      const l = spots[si++], out = Math.sign(h[0]) * 2.5;
      l.position.set(h[0], h[1] + 0.05, h[2] + 0.3).applyMatrix4(mw);
      l.target.position.set(h[0] + out, h[1] - 1.8, h[2] + 22).applyMatrix4(mw);
      l.intensity = 260 * night * (k.mine ? 1.2 : 1);
    } else if (!v.T.boat && !v.T.heli && k.d2 < 200 * 200) for (const h of L.head) {
      // painted pools for the rest: one narrow oval per headlamp, overlapping in the middle
      if (np >= MAX_POOLS) break;
      const lx = h[0] * 1.5, cx = v.x + fx * (v.T.len / 2 + 6) + fz * lx, cz = v.z + fz * (v.T.len / 2 + 6) - fx * lx;
      const gy = W.isLand(cx, cz) ? W.groundHeight(cx, cz) : v.y;
      p.set(cx, Math.max(gy, v.y - 0.6) + 0.06, cz);
      q.setFromAxisAngle(up, v.h); s.set(v.T.bike ? 3 : 3.4, 1, 11);
      m4.compose(p, q, s); pools.setMatrixAt(np++, m4);
    }
  }
  for (let i = si; i < spots.length; i++) spots[i].intensity = 0;
  // light bars light the street around them (nearest first)
  const barCars = cars.filter((c) => c.bar && c.v.mesh.visible && !c.v.exploded).map((c) => ({ v: c.v, d2: (c.v.x - camPos.x) ** 2 + (c.v.z - camPos.z) ** 2 })).sort((a, b) => a.d2 - b.d2);
  for (let i = 0; i < bars.length; i++) {
    const l = bars[i], b = barCars[i];
    if (!b || b.d2 > 120 * 120) { l.intensity = 0; continue; }
    l.position.set(b.v.x, b.v.y + b.v.T.hgt + 0.6, b.v.z);
    const red = (flash + i) % 2 === 0;
    l.color.setHex(red ? 0xff1a2a : 0x2a5bff);
    l.intensity = 35 + night * 130;
  }
  for (const im of [flares, glows]) { im.count = im.userData.n; im.instanceMatrix.needsUpdate = true; if (im.count) im.instanceColor.needsUpdate = true; }
  pools.count = np; pools.instanceMatrix.needsUpdate = true;
  streaks.count = ns; streaks.instanceMatrix.needsUpdate = true; if (ns) streaks.instanceColor.needsUpdate = true;
  pools.material.opacity = Math.min(1, night * 0.42); // two ovals overlap in the middle, so each is a bit fainter
}
