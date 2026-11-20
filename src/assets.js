// 3D models made in Blender (assets/src/*.py builds them; the .glb files live in assets/models/).
// Everything listed in assets/manifest.json loads once, behind the loading screen, before you play.
// Models carry geometry, UVs, skeletons and named attach points; most textures are painted at runtime
// (see paint.js) so colours and outfits can be mixed freely.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const store = new Map();

export async function loadAssets(onProgress) {
  let list = [];
  try { list = await (await fetch('assets/manifest.json', { cache: 'no-cache' })).json(); } catch (e) { console.warn('no asset manifest', e); return; }
  let done = 0;
  const total = list.reduce((t, a) => t + (a.kb || 100), 0) || 1;
  await Promise.all(list.map((a) => new Promise((res) => {
    loader.load(`assets/models/${a.file}`, (g) => {
      store.set(a.name, g);
      done += a.kb || 100; onProgress?.(done / total); res();
    }, undefined, (err) => { console.warn('asset failed', a.file, err); done += a.kb || 100; res(); });
  })));
}
// Models fetched on demand (landmarks near you), not behind the loading screen. Resolves to the gltf, or null.
const lazy = new Map();
export function loadLazy(file) {
  if (!lazy.has(file)) lazy.set(file, new Promise((res) => loader.load(`assets/models/${file}`, res, undefined, (err) => { console.warn('asset failed', file, err); lazy.delete(file); res(null); })));
  return lazy.get(file);
}
export const dropLazy = (file) => lazy.delete(file);
export const hasAsset = (name) => store.has(name);
export const gltf = (name) => store.get(name);
// a fresh copy of a model (skinned meshes get their own skeleton)
export function cloneAsset(name) {
  const g = store.get(name); if (!g) return null;
  return SkeletonUtils.clone(g.scene);
}
// find a named node anywhere inside a model
export function node(root, name) { let f = null; root.traverse((o) => { if (!f && o.name === name) f = o; }); return f; }
// all mesh children with a name prefix (e.g. 'lamp_')
export function nodes(root, prefix) { const out = []; root.traverse((o) => { if (o.name.startsWith(prefix)) out.push(o); }); return out; }
// geometry of one named mesh in a model, for instancing
export function geometryOf(name, meshName) {
  const g = store.get(name); if (!g) return null;
  let geo = null; g.scene.traverse((o) => { if (!geo && o.isMesh && (!meshName || o.name === meshName)) geo = o.geometry; });
  return geo;
}
export { THREE };
