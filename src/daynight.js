// Time of day and weather, both driven by the shared clock so every player sees the same sky.
// One game day = 24 real minutes. Weather changes every 6 minutes.
import * as THREE from 'three';
import { env } from './world.js';

export const DAY_SECONDS = 24 * 60;
export const sky = {
  hour: 12, day: 1, night: 0, dusk: 0, wet: 0, rain: 0, cloud: 0, storm: false, flash: 0, weather: 'clear', grip: 1,
  sunDir: new THREE.Vector3(0.45, 0.85, 0.25),
};
let R, stars, rain, rainPos, moon;
const RAIN_N = 1400, RAIN_BOX = 60;
const C = (h) => new THREE.Color(h);
const SKY = { // night is a deep blue, not black, so you can still see the street

  day: { top: C(0x2f8fe0), bot: C(0xa8def2) },
  dusk: { top: C(0x3b4a8c), bot: C(0xff9a5c) },
  night: { top: C(0x060d24), bot: C(0x22325a) },
  storm: { top: C(0x4a5260), bot: C(0x7d8794) },
};
const WEATHERS = ['clear', 'clear', 'clear', 'cloudy', 'cloudy', 'rain', 'rain', 'storm'];
const hash = (n) => { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
export function weatherAt(nowMs) { return WEATHERS[Math.floor(hash(Math.floor(nowMs / 1000 / 360)) * WEATHERS.length)]; }

// The sky also lights the world: a tiny copy of the sky (plus the ground's bounce color) is turned into
// an environment map every couple of seconds, so shadows and dark sides get soft, colored fill light.
let pmrem = null, envScene = null, envRT = null, envGround = null, envT = 0;
function initEnvLight() {
  pmrem = new THREE.PMREMGenerator(R.renderer);
  envScene = new THREE.Scene();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 12), R.skyMat);
  envScene.add(dome);
  envGround = new THREE.Mesh(new THREE.CircleGeometry(9.5, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5f7a55, side: THREE.DoubleSide }));
  envGround.position.y = -0.5; envScene.add(envGround);
}
function refreshEnvLight() {
  if (!pmrem) return;
  envGround.material.color.copy(C(0x6f8a60).lerp(C(0x1a2236), sky.night).lerp(C(0x555a60), sky.cloud * 0.5));
  const rt = pmrem.fromScene(envScene, 0, 0.1, 50);
  R.scene.environment = rt.texture;
  if (envRT) envRT.dispose();
  envRT = rt;
}

// refs: { scene, sun, hemi, skyMat, renderer }
export function initDayNight(refs) {
  R = refs;
  if (R.renderer) initEnvLight();
  const sp = [];
  for (let i = 0; i < 700; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, y = Math.abs(u) * 0.9 + 0.1;
    const r = Math.sqrt(1 - y * y);
    sp.push(Math.cos(a) * r * 330, y * 330, Math.sin(a) * r * 330);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  stars.renderOrder = -1;
  R.scene.add(stars);
  moon = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), new THREE.MeshBasicMaterial({ color: 0xf2f4ff, fog: false, transparent: true, opacity: 0 }));
  R.scene.add(moon);
  rainPos = new Float32Array(RAIN_N * 6);
  for (let i = 0; i < RAIN_N; i++) resetDrop(i, 0, 0, Math.random() * 30);
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xaecbe6, transparent: true, opacity: 0.55, depthWrite: false }));
  rain.frustumCulled = false; rain.visible = false;
  R.scene.add(rain);
}
function resetDrop(i, cx, cz, y) {
  const x = cx + (Math.random() - 0.5) * RAIN_BOX, z = cz + (Math.random() - 0.5) * RAIN_BOX;
  rainPos.set([x, y, z, x + 0.15, y + 0.9, z + 0.05], i * 6);
}
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const tmp = new THREE.Color(), tmp2 = new THREE.Color();

// Returns { thunder: delaySeconds } when lightning strikes (so main can play the sound), else null.
export function updateDayNight(dt, nowMs, cam) {
  const tod = (nowMs / 1000 / DAY_SECONDS + 0.33) % 1; // 0 = midnight
  sky.hour = tod * 24;
  const ang = (tod - 0.25) * Math.PI * 2; // sunrise at 6:00, noon overhead, sunset 18:00
  const sunY = Math.sin(ang);
  sky.day = sm(-0.1, 0.25, sunY);
  sky.night = 1 - sm(-0.25, 0.05, sunY);
  sky.dusk = Math.max(0, 1 - Math.abs(sunY) / 0.3) * (1 - sky.night * 0.6);
  sky.sunDir.set(Math.cos(ang) * 0.9, Math.max(0.05, sunY), 0.35).normalize();

  // weather eases toward the current period's type
  sky.weather = weatherAt(nowMs);
  const wantRain = sky.weather === 'rain' ? 0.7 : sky.weather === 'storm' ? 1 : 0;
  const wantCloud = sky.weather === 'cloudy' ? 0.5 : wantRain ? 0.85 : 0;
  sky.rain += (wantRain - sky.rain) * Math.min(1, dt * 0.08);
  sky.cloud += (wantCloud - sky.cloud) * Math.min(1, dt * 0.08);
  sky.wet = Math.min(1, Math.max(sky.rain > 0.15 ? sky.wet + dt * 0.05 : sky.wet - dt * 0.01, 0));
  sky.storm = sky.weather === 'storm' && sky.rain > 0.5;
  sky.grip = 1 - 0.35 * sky.wet;

  let thunder = null;
  if (sky.storm && Math.random() < dt * 0.07) { sky.flash = 1; thunder = 0.4 + Math.random() * 3; }
  sky.flash = Math.max(0, sky.flash - dt * 3.5);

  // sky colors
  const top = tmp.copy(SKY.day.top).lerp(SKY.dusk.top, sky.dusk).lerp(SKY.night.top, sky.night).lerp(SKY.storm.top, sky.cloud * sky.day * 0.8);
  const bot = tmp2.copy(SKY.day.bot).lerp(SKY.dusk.bot, sky.dusk).lerp(SKY.night.bot, sky.night).lerp(SKY.storm.bot, sky.cloud * sky.day * 0.8);
  if (sky.flash > 0) { top.lerp(C(0xdde6ff), sky.flash * 0.7); bot.lerp(C(0xdde6ff), sky.flash * 0.7); }
  R.skyMat.uniforms.top.value.copy(top);
  R.skyMat.uniforms.bottom.value.copy(bot);
  R.scene.fog.color.copy(bot);
  R.scene.background.copy(bot);
  R.scene.fog.near = 140 - 80 * sky.rain; R.scene.fog.far = 345 - 140 * sky.rain;

  // lights
  // the same light is the sun by day and the moon by night (cool, soft, still casting shadows)
  const moonLight = sky.night * (1 - sky.cloud * 0.7);
  const sunCol = C(0xfff4e0).lerp(C(0xff8a3d), sky.dusk).lerp(C(0x9fb6ff), sky.night);
  R.sun.color.copy(sunCol);
  R.sun.intensity = 2.4 * sky.day * (1 - 0.6 * sky.cloud) + 0.55 * moonLight;
  R.sun.castShadow = (sky.day > 0.25 && sky.cloud < 0.6) || moonLight > 0.5;
  if (sky.night > 0.5) sky.sunDir.set(-sky.sunDir.x, Math.max(0.35, -Math.sin(ang)), sky.sunDir.z).normalize();
  R.hemi.intensity = 0.55 + 0.55 * sky.day * (1 - 0.3 * sky.cloud) + sky.flash * 3;
  R.hemi.color.copy(C(0xffffff).lerp(C(0x8ea2e0), sky.night));
  R.hemi.groundColor.copy(C(0x99bb99).lerp(C(0x2a3550), sky.night));

  // night lighting in the town
  const n = sky.night;
  if (env.buildings) env.buildings.emissiveIntensity = n * 0.95;
  if (env.lampMat) env.lampMat.color.setScalar(0.75 + n * 0.25).multiply(C(0xfff3c4));
  if (env.poolMat) env.poolMat.opacity = n * 0.32;
  if (env.beam) { env.beam.material.opacity = n * 0.16; env.beam.rotation.y += dt * 0.9; }
  if (env.water) env.water.color.copy(C(0x29b6d6).lerp(C(0x0b2a3c), n * 0.85).lerp(C(0x4b6b78), sky.cloud * 0.4));
  if (env.ground) env.ground.color.setScalar(1 - 0.28 * sky.wet);

  stars.material.opacity = Math.max(0, n - sky.cloud) * 0.9;
  stars.position.set(cam.x, 0, cam.z);
  moon.material.opacity = n * (1 - sky.cloud * 0.8);
  moon.position.set(cam.x - sky.sunDir.x * 300, 40 + Math.max(0, -Math.sin(ang)) * 220, cam.z - sky.sunDir.z * 300);

  envT -= dt;
  if (envT <= 0) { envT = 2.5; refreshEnvLight(); }

  // rain streaks around the camera
  rain.visible = sky.rain > 0.05;
  if (rain.visible) {
    const count = Math.floor(RAIN_N * sky.rain);
    rain.geometry.setDrawRange(0, count * 2);
    const fall = 28 * dt;
    for (let i = 0; i < count; i++) {
      const o = i * 6;
      rainPos[o + 1] -= fall; rainPos[o + 4] -= fall;
      rainPos[o] -= fall * 0.15; rainPos[o + 3] -= fall * 0.15;
      if (rainPos[o + 1] < cam.y - 8 || Math.abs(rainPos[o] - cam.x) > RAIN_BOX / 2 + 4 || Math.abs(rainPos[o + 2] - cam.z) > RAIN_BOX / 2 + 4) resetDrop(i, cam.x, cam.z, cam.y + 10 + Math.random() * 15);
    }
    rain.geometry.attributes.position.needsUpdate = true;
  }
  return thunder;
}

export function clockText() {
  const h = Math.floor(sky.hour), m = Math.floor((sky.hour - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
