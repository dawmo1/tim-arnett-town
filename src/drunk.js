// Booze: drunk level 0..1 (a little over 1 means "about to black out"), wears off in ~2.5 min.
// Drives a screen-warp pass, camera sway, wobbly walking and lazy steering. The pass is off while sober, so it costs nothing.
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import * as ui from './ui.js';

export const drunk = { lvl: 0, t: 0, lurch: 0, dir: 1, steer: 0, out: 0 }; // out = performance.now() the blackout ends
export const blackedOut = () => performance.now() < drunk.out;
const SOBER_RATE = 1 / 150; // 1.0 -> 0 in 150 s
const LEVELS = [[0.25, 'You feel tipsy'], [0.5, "You're drunk"], [0.8, "You're wasted. Maybe stop?"]];

export const drunkPass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, amt: { value: 0 }, time: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float amt, time; varying vec2 vUv;
    void main() {
      float pulse = 0.5 + 0.5 * sin(time * 1.6);
      vec2 uv = vUv + amt * 0.008 * vec2(sin(vUv.y * 8.0 + time * 1.9), cos(vUv.x * 6.0 + time * 1.4)); // wavy warp
      float b = 0.004 * amt; // cheap 4-tap blur
      vec4 c = mix(texture2D(tDiffuse, uv), 0.25 * (texture2D(tDiffuse, uv + vec2(b, 0.0)) + texture2D(tDiffuse, uv - vec2(b, 0.0)) + texture2D(tDiffuse, uv + vec2(0.0, b)) + texture2D(tDiffuse, uv - vec2(0.0, b))), 0.6 * amt);
      vec2 ghost = amt * (0.01 + 0.012 * pulse) * vec2(cos(time * 0.7), sin(time * 0.9)); // double vision
      c = mix(c, texture2D(tDiffuse, uv + ghost), 0.4 * amt);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = max(mix(vec3(l), c.rgb, 1.0 + 0.6 * amt), 0.0) * vec3(1.0 + 0.08 * amt, 1.0, 1.0 - 0.08 * amt); // oversaturated, warm
      c.rgb *= 1.0 - amt * (0.2 + 0.15 * pulse) * smoothstep(0.35, 0.95, length(vUv - 0.5) * 1.5); // pulsing vignette
      gl_FragColor = c;
    }`,
});
drunkPass.enabled = false;

export function drink(add) {
  const was = drunk.lvl;
  drunk.lvl = Math.min(1.2, drunk.lvl + add); // headroom over 1 = time to stumble outside before blacking out
  const hit = LEVELS.filter(([v]) => was < v && drunk.lvl >= v).pop();
  if (hit) ui.addFeed(hit[1]);
}
// beer and whiskey for the corner-store / gas-station / liquor-store counter
export const drinkItems = () => [
  { label: 'Beer', sub: 'A cheap buzz', price: 6, buy: () => drink(0.2) },
  { label: 'Whiskey', sub: 'Hits hard', price: 20, buy: () => drink(0.45) },
];

export function resetDrunk() { drunk.lvl = 0; drunk.lurch = 0; drunk.steer = 0; drunk.out = 0; drunkPass.enabled = false; }

export function updateDrunk(dt) {
  if (drunk.lvl <= 0) return;
  drunk.t += dt;
  drunk.lvl = Math.max(0, drunk.lvl - dt * SOBER_RATE);
  if (drunk.lvl === 0) ui.addFeed('You sobered up');
  drunkPass.enabled = drunk.lvl > 0;
  drunkPass.uniforms.amt.value = Math.min(1, drunk.lvl);
  drunkPass.uniforms.time.value = drunk.t;
}

// lateral drift (-1..1-ish): slow sway plus a random lurch now and then
export function wobble(dt) {
  const k = Math.min(1, drunk.lvl);
  if (drunk.lurch > 0) drunk.lurch -= dt;
  else if (Math.random() < dt * k * 0.35) { drunk.lurch = 0.45; drunk.dir = Math.random() < 0.5 ? -1 : 1; }
  return k * (Math.sin(drunk.t * 1.1) * 0.45 + Math.sin(drunk.t * 2.9) * 0.2 + (drunk.lurch > 0 ? drunk.dir * 1.1 : 0));
}

// drunk hands: steering lags the keys and drifts on its own
export function drunkSteer(dt, s) {
  if (drunk.lvl <= 0) return (drunk.steer = s);
  const k = Math.min(1, drunk.lvl);
  drunk.steer += (s - drunk.steer) * Math.min(1, dt * (12 - 10 * k));
  return Math.max(-1, Math.min(1, drunk.steer + wobble(dt) * 0.3));
}

// call after camera.lookAt: roll and yaw sway (also makes aiming unsteady, since shots follow the camera)
export function swayCamera(camera) {
  if (drunk.lvl <= 0) return;
  const k = Math.min(1, drunk.lvl), t = drunk.t;
  camera.rotateZ(k * (Math.sin(t * 0.8) * 0.07 + Math.sin(t * 2.1) * 0.015));
  camera.rotateY(k * Math.sin(t * 0.55) * 0.025);
  camera.rotateX(k * Math.sin(t * 1.3) * 0.012);
}
