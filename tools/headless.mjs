// Runs the game's city code (src/city/*) in Node, without a browser, for the map checks (scan-placement.mjs):
// maps the bare 'three' import to vendor/three.module.js like index.html's import map, serves fetch() of the data
// files from disk, and stubs the 2D canvas the sign-text atlas draws on. Import this before any src/ module.
import fs from 'node:fs';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const three = pathToFileURL(root + 'vendor/three.module.js').href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, next) { if (s === 'three') return { url: ${JSON.stringify(three)}, shortCircuit: true }; return next(s, c); }`));
globalThis.fetch = async (u) => {
  const p = fileURLToPath(String(u));
  if (!fs.existsSync(p)) return { ok: false, status: 404, json: async () => null };
  return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) };
};
const ctx2d = new Proxy({}, { get: (o, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {}), set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d, style: {} }) };
globalThis.window = globalThis;
export const ROOT = root;
