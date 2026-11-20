// Bundles the third-party libraries into ../vendor so the game loads nothing from CDNs.
// Run: cd tools && npm install && npm run vendor
import { build } from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const out = fileURLToPath(new URL('../vendor/', import.meta.url));
mkdirSync(out, { recursive: true });
for (const name of ['rapier', 'recast']) {
  await build({ entryPoints: [`entries/${name}.js`], bundle: true, format: 'esm', minify: true, outfile: `${out}${name}.js`, logLevel: 'info' });
}
// three.js and the post-processing add-ons we use (kept as-is; they import "three" through the import map)
cpSync('node_modules/three/build/three.module.min.js', `${out}three.module.js`);
for (const f of ['postprocessing/EffectComposer.js', 'postprocessing/RenderPass.js', 'postprocessing/ShaderPass.js', 'postprocessing/MaskPass.js', 'postprocessing/Pass.js',
  'postprocessing/UnrealBloomPass.js', 'postprocessing/OutputPass.js', 'shaders/CopyShader.js', 'shaders/LuminosityHighPassShader.js', 'shaders/OutputShader.js',
  'loaders/GLTFLoader.js', 'utils/BufferGeometryUtils.js', 'utils/SkeletonUtils.js']) {
  mkdirSync(`${out}addons/${f.split('/')[0]}`, { recursive: true });
  cpSync(`node_modules/three/examples/jsm/${f}`, `${out}addons/${f}`);
}
console.log('vendor ready');
