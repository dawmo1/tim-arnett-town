// Bars and the Arnett Belle casino floor: what E does inside them, and each bar's regulars.
// The rooms themselves are built by interiors.js (it hands us R.spots and R.seats); main.js calls useVenue() on E
// inside a room and updateVenues() each frame after updateWalkers().
// Games run through src/minigames/index.js start(kind, { bet }); the minigame takes the bet and pays out.
// Until that module exists a machine or table just says "Out of order".
import * as interior from './interiors.js';
import { stores } from './economy.js';
import { drink } from './drunk.js';
import { addScripted, dropScripted, say } from './npc.js';
import * as ui from './ui.js';

let hooks = { openShop() {} };
export function initVenues(h) { hooks = { ...hooks, ...h }; }

// ---------- games ----------
const BET = { pool: 20, darts: 10, slots: 5, blackjack: 25, roulette: 25 };
let gaming = false;
async function play(kind) {
  if (gaming) return;
  gaming = true;
  try { const mg = await import('./minigames/index.js'); await mg.start(kind, { bet: BET[kind] }); }
  catch (e) { console.warn('minigame', kind, e); ui.flashPrompt('Out of order'); }
  gaming = false;
}

// ---------- drinks ----------
const DRINKS = [
  ['Beer', 'Domestic, on tap', 5, 0.15], ['Whiskey', 'Neat. The cheap stuff', 12, 0.35], ['Tequila shot', 'Salt, lime, regret', 7, 0.25],
  ['Cocktail', 'Something blue with an umbrella in it', 14, 0.2], ['Mississippi Mud Bomb', 'The house special. Nobody knows what is in it', 18, 0.5],
];
function drinkMenu(R) {
  const items = DRINKS.map(([label, sub, price, add]) => ({ label, sub, price, buy: () => drink(add) }));
  const regs = regulars.get(R.store);
  if (regs) items.push({ label: 'A round for the bar', sub: 'Everyone loves you. For a minute', price: 40, ok: () => regs.some((w) => !w.dead), buy: () => { drink(0.15); for (const w of regs) say(w, pick(CHEERS), 2.5); } });
  return items;
}

// E inside a bar or the casino: the counter, a table or a machine. Returns true if something opened.
export function useVenue(me) {
  const R = interior.room;
  if (!R || !R.spots) return false;
  let best = null, bd = Infinity;
  for (const s of R.spots) { const d = Math.hypot(s.x - me.x, s.z - me.z); if (d < s.r && d < bd) { bd = d; best = s; } }
  if (!best) return false;
  if (best.act !== 'drinks') play(best.act);
  else if (R.kind === 'bar' && (R.store.alarmed || R.store.cooldown > 0)) ui.flashPrompt("The bartender won't serve you");
  else hooks.openShop(R.kind === 'casino' ? (R.hall ? 'Lone Wolf Bar' : 'Belle Bar') : R.store.name, drinkMenu(R));
  return true;
}

// ---------- regulars ----------
// 3-6 townspeople per bar, from npc.js (so bumping, insulting (H) or hitting them starts a fight like on the street).
// Friends share a group, and npc.js pulls a whole group into a fight; brawlers nearby may join too.
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const LINES = ["Another round!", 'This jukebox only has one song', "I'm not drunk, you're drunk", 'Hawks are going all the way this year', 'What are YOU looking at?',
  'My ex lives in Bettendorf. Figures.', 'Nice shirt. Did your mom pick it?', 'I could beat you at darts blindfolded', 'Barkeep! BARKEEP!', 'I used to be somebody, man',
  'The river took my boat. And my wife.', "You smell like Rock Island", 'Who invited this guy?', 'Last call is a social construct', 'I know Tim Arnett personally'];
const CHEERS = ['Cheers!', 'Legend!', 'To Davenport!', 'You alright!', 'Bottoms up!'];
const regulars = new Map(); // bar store -> [walker]
const MAX_BARS = 2; // regulars live in at most this many bars at once (the nearest)
function fill(R) {
  const seats = R.seats.slice().sort(() => Math.random() - 0.5).slice(0, 3 + Math.floor(Math.random() * 4));
  const out = [];
  let grp = null;
  for (const st of seats) {
    if (!grp || Math.random() < 0.45) grp = { members: [], props: [], x: st.x, z: st.z }; // drinking buddies
    const w = addScripted('bar', st.x, st.z, st.h);
    w.mode = 'fixed'; w.fixed = { x: st.x, z: st.z, h: st.h, pose: st.pose, lines: LINES };
    w.grp = grp; grp.members.push(w);
    w.floorY = R.y; // npc.js stands them on the bar floor instead of the ground under it
    w.drunk = Math.random() < 0.55; w.ph = Math.random() * 6;
    if (w.drunk && w.temper === 'normal' && Math.random() < 0.4) w.temper = 'brawler'; // liquid courage
    out.push(w);
  }
  return out;
}
const inside = (R, x, z) => { const dx = x - R.x, dz = z - R.z; return Math.abs(dx * R.cs - dz * R.sn) < R.w / 2 + 0.5 && Math.abs(dx * R.sn + dz * R.cs) < R.d / 2 + 0.5; };
let t = 0;
// Per frame, after updateWalkers: fill bars you walk up to, empty the ones you leave, make the drunk ones sway.
export function updateVenues(dt, me) {
  t += dt;
  const px = me.veh ? me.veh.x : me.x, pz = me.veh ? me.veh.z : me.z;
  for (const s of stores) {
    if (s.kind !== 'bar') continue;
    const regs = regulars.get(s), d = Math.hypot(s.cx - px, s.cz - pz);
    if (!regs && s.room && d < 45 && regulars.size < MAX_BARS) regulars.set(s, fill(s.room));
    else if (regs && (d > 90 || !s.room)) { for (const w of regs) dropScripted(w); regulars.delete(s); }
  }
  for (const [s, regs] of regulars) for (const w of regs) {
    if (w.floorY !== undefined && !inside(s.room, w.x, w.z)) delete w.floorY; // ran out the door
    if (w.drunk && !w.dead && w.mode === 'fixed' && w.ch.g.visible && !w.ch.rag) w.ch.g.rotation.z = Math.sin(t * 1.3 + w.ph) * 0.06 + Math.sin(t * 3.1 + w.ph) * 0.02;
  }
}
