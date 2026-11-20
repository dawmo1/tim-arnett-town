// Live text atlas for anything that needs a real name: street-name blades (real OSM street names), stop signs,
// shop and pylon signs (real local names; national chains get a parody name), ghost signs and neon blades.
// One 1024 x 2048 canvas texture (128 slots of 256 x 64); tiles hold slots while built and free them on unload.
import * as THREE from 'three';

const W = 1024, H = 2048, SW = 256, SH = 64, COLS = W / SW, N = COLS * (H / SH);
let canvas = null, g = null;
export const NAMES = { tex: null, dirty: false };
const slots = new Map(); // key -> {i, refs:Set}
const lru = []; // keys with no refs, oldest first (still drawn, so they can come back for free)
let next = 0;
function init() {
  if (canvas) return;
  canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  g = canvas.getContext('2d');
  NAMES.tex = new THREE.CanvasTexture(canvas); NAMES.tex.colorSpace = THREE.SRGBColorSpace; NAMES.tex.anisotropy = 4;
}
export const nameTexture = () => { init(); return NAMES.tex; };

// Chains -> parody names (no real logos). Local QC names are kept as they are.
const PARODY = [
  [/mcdonald/i, "McDuffy's"], [/burger king/i, 'Burger Baron'], [/wendy/i, "Windy's"], [/taco bell/i, 'Taco Bill'], [/kfc|kentucky fried/i, "Colonel Cluck's"],
  [/subway/i, 'Subwave'], [/hy-?vee/i, 'Hi-Vue'], [/walmart|wal-mart/i, 'ValuMart'], [/target/i, 'Bullseye'], [/casey/i, "Cassie's"], [/kwik ?star|kwik ?trip/i, 'Quik Starr'],
  [/quik ?trip/i, 'QuickTrek'], [/menards/i, "Menardo's"], [/hobby lobby/i, 'Hobby Hut'], [/kohl/i, "Cole's"], [/culver/i, "Culvert's"], [/panera/i, 'Panero Bread'],
  [/applebee/i, "Applebottom's"], [/buffalo wild/i, 'Bison Wild Wings'], [/dairy queen/i, 'Dairy Duchess'], [/fareway/i, 'Fairaway'], [/starbucks/i, 'Starbeans'],
  [/dunkin/i, "Dunkem'"], [/arby/i, "Artie's"], [/sonic/i, 'Sonik'], [/pizza hut/i, 'Pizza Hutch'], [/domino/i, "Dom's Pizza"], [/papa john/i, "Papa Juan's"],
  [/jimmy john/i, "Jimmy Jim's"], [/chick-?fil/i, 'Chick-n-Fil'], [/walgreen/i, 'Walgrove'], [/\bcvs\b/i, 'CVX Pharmacy'], [/home depot/i, 'Home Deport'], [/lowe'?s/i, 'Lowe-Down'],
  [/best buy/i, 'Best Bye'], [/kum ?& ?go|maverik/i, 'Come & Go'], [/aldi/i, 'Alde'], [/costco/i, 'Costwho'], [/sam'?s club/i, "Stan's Club"], [/dollar general/i, 'Dollar Generic'],
  [/dollar tree/i, 'Dollar Shrub'], [/autozone/i, 'AutoZoned'], [/o'?reilly/i, "O'Really Auto"], [/advance auto/i, 'Advanced Auto'], [/shell\b/i, 'Shellco'], [/\bbp\b/i, 'B&P Gas'],
  [/marathon/i, 'Sprint Gas'], [/mobil/i, 'Mobile Gas'], [/olive garden/i, 'Olive Yard'], [/red lobster/i, 'Red Crawdad'], [/texas roadhouse/i, 'Iowa Roadhouse'], [/old navy/i, 'Old Army'],
  [/petsmart/i, 'PetSmarts'], [/petco/i, 'PetCo-op'], [/ulta/i, 'Ultra Beauty'], [/tj ?maxx/i, 'TJ Maxed'], [/goodwill/i, 'Goodwell'], [/ihop/i, 'IHOB'], [/denny/i, "Lenny's"],
  [/perkins/i, "Perky's"], [/hardee/i, "Hardy's"], [/popeyes/i, "Poppa's Chicken"], [/five guys/i, 'Six Guys'], [/qdoba/i, 'Qbodo'], [/chipotle/i, 'Chipotlé'], [/jersey mike/i, "Jersey Mick's"],
  [/u\.?s\.? bank/i, 'U.S. Vault'], [/wells fargo/i, 'Wells Cargo'], [/verizon/i, 'Verizone'], [/at&t/i, 'AT&Tea'], [/t-mobile/i, 'Tea-Mobile'], [/menards/i, "Menardo's"],
];
export function displayName(name) {
  if (!name) return '';
  for (const [re, p] of PARODY) if (re.test(name)) return p;
  return name;
}
// generic parody chains for pads with no name in the data (fast food along the strips)
export const STRIP_FOOD = ["McDuffy's", 'Burger Baron', "Windy's", 'Taco Bill', "Culvert's", 'Dairy Duchess', "Artie's", 'Subwave', "Colonel Cluck's", "Hardy's", 'Sonik', 'Pizza Hutch'];
// period ads painted on old brick walls (made-up and parody, no real brands)
export const GHOST = ['ARNETT DRY GOODS', 'BIX BEER - ON TAP', 'HOTEL  ROOMS $1', 'FURNITURE & STOVES', 'MISSISSIPPI FLOUR', 'FINE CIGARS 5¢', 'HARDWARE  PAINTS', 'LIVERY & FEED',
  'RIVER CITY BAKERY', 'DRINK QUAD COLA', 'BLUFF CITY LUMBER', 'PHOTOGRAPHS', 'STEAMBOAT COFFEE', 'GROCERIES MEATS', 'TIM ARNETT & SONS', 'HARNESS SHOP', 'OPERA HOUSE', 'DRUGS  SODA'];
const ABBR = [[/\bStreet\b/g, 'St'], [/\bAvenue\b/g, 'Ave'], [/\bRoad\b/g, 'Rd'], [/\bDrive\b/g, 'Dr'], [/\bBoulevard\b/g, 'Blvd'], [/\bCourt\b/g, 'Ct'], [/\bPlace\b/g, 'Pl'], [/\bLane\b/g, 'Ln'],
  [/\bParkway\b/g, 'Pkwy'], [/\bCircle\b/g, 'Cir'], [/\bTerrace\b/g, 'Ter'], [/\bHighway\b/g, 'Hwy'], [/^East\b/, 'E'], [/^West\b/, 'W'], [/^North\b/, 'N'], [/^South\b/, 'S']];
export const streetLabel = (n) => ABBR.reduce((s, [re, r]) => s.replace(re, r), n);

const PAL = [['#b71c1c', '#fff'], ['#0d47a1', '#fff'], ['#1b5e20', '#fff'], ['#212121', '#ffd54f'], ['#4a148c', '#fff'], ['#f9a825', '#212121'], ['#004d40', '#ffeb3b'], ['#e65100', '#fff'], ['#fafafa', '#c62828'], ['#263238', '#80deea']];
const NEON = ['#ff3d6e', '#3df2ff', '#ffe14d', '#7dff6a', '#ff8af0', '#ff9a3d'];
const hashS = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
function fitText(text, x, y, w, maxPx, weight = 'bold', fam = 'Arial Black, Arial') {
  let px = maxPx; g.font = `${weight} ${px}px ${fam}`;
  while (px > 10 && g.measureText(text).width > w) { px -= 2; g.font = `${weight} ${px}px ${fam}`; }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x, y);
}
function draw(i, style, text) {
  const x = (i % COLS) * SW, y = Math.floor(i / COLS) * SH, cx = x + SW / 2, cy = y + SH / 2, r = hashS(text);
  g.save(); g.beginPath(); g.rect(x, y, SW, SH); g.clip(); g.clearRect(x, y, SW, SH);
  if (style === 'street') {
    g.fillStyle = '#0d6b3c'; g.fillRect(x, y + 6, SW, SH - 12); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(x + 4, y + 9, SW - 8, SH - 18);
    g.fillStyle = '#fff'; fitText(streetLabel(text), cx, cy + 1, SW - 22, 34, 'bold', 'Arial');
  } else if (style === 'stop' || style === 'stopback') {
    // octagon in the middle 64 x 64 of the slot
    const R = 31, ox = cx, oy = cy; g.beginPath();
    for (let k = 0; k < 8; k++) { const a = Math.PI / 8 + (k * Math.PI) / 4; g.lineTo(ox + Math.cos(a) * R, oy + Math.sin(a) * R); }
    g.closePath(); g.fillStyle = style === 'stop' ? '#c8102e' : '#9a9a9a'; g.fill();
    if (style === 'stop') { g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.stroke(); g.fillStyle = '#fff'; fitText('STOP', ox, oy + 1, 46, 17, 'bold', 'Arial'); }
  } else if (style === 'shop' || style === 'pole') {
    const [bg, fg] = PAL[Math.floor(r * PAL.length)];
    g.fillStyle = bg; g.fillRect(x + 2, y + 2, SW - 4, SH - 4); g.strokeStyle = fg; g.lineWidth = 3; g.strokeRect(x + 6, y + 6, SW - 12, SH - 12);
    g.fillStyle = fg; fitText(text.toUpperCase(), cx, cy + 1, SW - 24, 32);
  } else if (style === 'blade') {
    const c = NEON[Math.floor(r * NEON.length)];
    g.fillStyle = '#141414'; g.fillRect(x + 2, y + 4, SW - 4, SH - 8); g.strokeStyle = c; g.lineWidth = 3; g.strokeRect(x + 8, y + 9, SW - 16, SH - 18);
    g.shadowColor = c; g.shadowBlur = 8; g.fillStyle = c; fitText(text.toUpperCase(), cx, cy + 1, SW - 30, 28, 'bold', 'Arial');
  } else if (style === 'bigbox') {
    // channel letters straight on the facade (transparent between them)
    const bg = PAL[Math.floor(r * PAL.length)][0];
    g.fillStyle = bg === '#fafafa' || bg === '#212121' || bg === '#263238' ? '#c62828' : bg; fitText(text.toUpperCase(), cx, cy, SW - 10, 44);
  } else if (style === 'xbuck') {
    g.fillStyle = '#f4f4f4'; g.fillRect(x + 2, y + 8, SW - 4, SH - 16); g.strokeStyle = '#111'; g.lineWidth = 2; g.strokeRect(x + 5, y + 11, SW - 10, SH - 22);
    g.fillStyle = '#111'; fitText(text, cx, cy + 1, SW - 20, 26, 'bold', 'Arial');
  } else if (style === 'tower') {
    // a town's name painted on its water tower (transparent around the letters)
    g.fillStyle = '#1d3f73'; fitText(text, cx, cy + 2, SW - 8, 46, 'bold', 'Arial Black, Arial');
  } else if (style === 'ghost') {
    // faded paint on brick: cream letters in a frame, worn away in patches
    g.fillStyle = 'rgba(232,224,200,1)'; g.fillRect(x + 4, y + 4, SW - 8, 4); g.fillRect(x + 4, y + SH - 8, SW - 8, 4);
    fitText(text, cx, cy, SW - 20, 30, 'bold', 'Georgia, serif');
    g.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 140; k++) { const rr = hashS(text + k), r2 = hashS(k + text); g.fillStyle = `rgba(0,0,0,${0.5 + rr * 0.5})`; g.fillRect(x + rr * SW, y + r2 * SH, 2 + r2 * 9, 1 + rr * 4); }
  }
  g.restore();
}
// Get the uv box for a piece of text in a style, held by `owner` (a tile key). Returns [u0, v0, u1, v1] or null.
export function nameUV(style, text, owner) {
  init();
  const key = style + '|' + text;
  let s = slots.get(key);
  if (!s) {
    let i;
    if (next < N) i = next++;
    else { const old = lru.shift(); if (old === undefined) return null; i = slots.get(old).i; slots.delete(old); }
    s = { i, refs: new Set() }; slots.set(key, s);
    draw(i, style, text); NAMES.dirty = true;
  }
  if (!s.refs.size) { const k = lru.indexOf(key); if (k >= 0) lru.splice(k, 1); }
  s.refs.add(owner);
  const x = (s.i % COLS) * SW, y = Math.floor(s.i / COLS) * SH, e = 0.5; // half-texel inset
  return [(x + e) / W, 1 - (y + SH - e) / H, (x + SW - e) / W, 1 - (y + e) / H];
}
export function releaseNames(owner) {
  for (const [key, s] of slots) if (s.refs.delete(owner) && !s.refs.size) lru.push(key);
}
// upload the canvas at most this often (a whole-texture upload; slots change only when tiles build)
export function flushNames() { if (NAMES.dirty && NAMES.tex) { NAMES.tex.needsUpdate = true; NAMES.dirty = false; } }
