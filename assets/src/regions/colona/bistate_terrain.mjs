// Samples the game terrain (src/city/data.js terrainHeight) on the 8 m grid round Bi-State Sportsman's for colona.py:
//   node --max-old-space-size=1024 assets/src/regions/colona/bistate_terrain.mjs assets/src/regions/colona/bistate_terrain.json
import fs from 'node:fs';
import { ROOT } from '/Users/dainmoens/Documents/Tim Arnett Town/tools/headless.mjs';
const { loadData, fetchTile, terrainHeight } = await import(ROOT + 'src/city/data.js');
await loadData();
const [x0, z0, x1, z1, out] = [19184, 3624, 19504, 4392, process.argv[2]];
for (let tz = Math.floor(z0 / 200); tz <= Math.floor(z1 / 200); tz++) for (let tx = Math.floor(x0 / 200); tx <= Math.floor(x1 / 200); tx++) await fetchTile(tx, tz).catch(() => null);
const w = (x1 - x0) / 8 + 1, h = (z1 - z0) / 8 + 1, H = [];
for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) H.push(Math.round(terrainHeight(x0 + i * 8, z0 + j * 8) * 100) / 100);
fs.writeFileSync(out, JSON.stringify({ x0, z0, step: 8, w, h, H }));
console.log(w, h, Math.min(...H), Math.max(...H));
