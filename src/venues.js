// Bars and the Arnett Belle casino floor: what E does inside them, and each bar's regulars.
// The rooms themselves are built by interiors.js (it hands us R.spots and R.seats); main.js calls useVenue() on E
// inside a room and updateVenues() each frame after updateWalkers().
// Games run through src/minigames/index.js start(kind, { bet }); the minigame takes the bet and pays out.
import * as interior from './interiors.js';
import * as minigames from './minigames/index.js';
import { stores } from './economy.js';
import { drink } from './drunk.js';
import { addScripted, dropScripted, say } from './npc.js';
import * as ui from './ui.js';

let hooks = { openShop() {} };
export function initVenues(h) { hooks = { ...hooks, ...h }; }

// ---------- games ----------
const BET = { pool: 20, darts: 10, slots: 5, blackjack: 25, roulette: 25 };
let gaming = false;
async function play(kind, R) {
  if (gaming) return;
  gaming = true;
  const sub = R.kind === 'casino' ? R.store.name + (kind === 'roulette' ? ' · European wheel' : '') : undefined; // which casino you're in
  try { await minigames.start(kind, { bet: BET[kind], sub }); }
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

// ---------- counters in the landmark halls (arena concessions, the mall food court, the airport, the dinner theatre) ----------
// [label, sub, price, health, booze]
const MENUS = {
  concessions: [['Hot dog', 'Ballpark style, extra mustard', 6, 25], ['Nachos', 'Cheese from a pump', 7, 20], ['Pretzel', 'The size of your head', 6, 20], ['Beer', 'Twelve dollars of foam. Well, eight', 8, 0, 0.15], ['Pop', 'Bottomless, allegedly', 4, 5]],
  pretzel: [['Pretzel', 'Buttered, salted, folded', 5, 20], ['Pretzel bites', 'With cheese dip', 6, 22], ['Lemonade', 'Hand-shaken', 4, 5]],
  chinese: [['Orange chicken', 'Two entrees and fried rice', 9, 45], ['Free sample', 'On a toothpick. Take two', 0, 3], ['Egg roll', '', 3, 10]],
  burgers: [["McDuffy's meal", 'Burger, fries and a pop', 9, 45], ['Fries', '', 3, 12], ['Shake', 'Vanilla', 4, 10]],
  pizza: [['Slice', 'Pepperoni, the size of a hubcap', 5, 25], ['Two slices and a pop', '', 9, 45], ['Garlic knots', '', 4, 12]],
  cookies: [['Giant cookie', 'Chocolate chip', 4, 15], ['Cookie cake slice', 'Says HAPPY BIRTH on it', 5, 18]],
  coffee: [['Coffee', 'Black, like the runway at night', 3, 5], ['Latte', 'Oat milk costs extra. It is included', 5, 8], ['Muffin', 'Blueberry', 4, 15]],
  airport: [['Turkey sandwich', 'Twelve dollars because airport', 12, 35], ['Bottled water', 'Seven dollars because airport', 7, 5], ['Beer', 'Pre-flight nerves', 9, 0, 0.15], ['Bloody Mary', "It's 5 o'clock somewhere", 11, 5, 0.25]],
  dinner: [['Dinner buffet', "Pork loin, chicken, the works. Bootleggers' choice", 35, 100], ['Dessert', 'Chocolate cake from the show menu', 8, 20], ['Cocktail', 'The show special', 10, 0, 0.2], ['Coffee', '', 3, 5]],
  cafe: [['Coffee', 'From the student-run cafe', 3, 5], ['Bagel', '', 3, 15], ['Energy drink', 'Finals week fuel', 4, 5]],
};
function menuItems(key, me) {
  return (MENUS[key] || MENUS.concessions).map(([label, sub, price, hp = 0, booze = 0]) => ({
    label, sub: sub + (hp >= 100 ? ' · full health' : hp ? ` · +${hp} health` : ''), price,
    ok: () => booze > 0 || hp === 0 || me.hp < 100,
    buy: () => { if (hp) me.hp = Math.min(100, me.hp + hp); if (booze) drink(booze); },
  }));
}

// E inside a bar or the casino: the counter, a table or a machine. Returns true if something opened.
export function useVenue(me) {
  const R = interior.room;
  if (!R || !R.spots) return false;
  let best = null, bd = Infinity;
  for (const s of R.spots) { const d = Math.hypot(s.x - me.x, s.z - me.z); if (d < s.r && d < bd) { bd = d; best = s; } }
  if (!best) return false;
  if (best.act === 'menu') hooks.openShop(best.title, menuItems(best.menu, me));
  else if (best.act === 'clothes') hooks.openShop(best.title, hooks.clothingItems ? hooks.clothingItems() : []);
  else if (best.act !== 'drinks') play(best.act, R);
  else if (R.kind === 'bar' && (R.store.alarmed || R.store.cooldown > 0)) ui.flashPrompt("The bartender won't serve you");
  else hooks.openShop(R.kind === 'casino' ? (R.hall ? 'Lone Wolf Bar' : 'Belle Bar') : R.store.name, drinkMenu(R));
  return true;
}

// a free seat (booth seat or bar stool) within reach of the player in the room they're in, or null
export function seatNear(me) {
  const R = interior.room;
  if (!R?.seats) return null;
  const regs = regulars.get(R.store) || [];
  let best = null, bd = 1.3;
  for (const s of R.seats) {
    if (s.pose !== 'sit' && s.pose !== 'coffee') continue; // ('chat' spots are for standing about)
    const d = Math.hypot(s.x - me.x, s.z - me.z);
    if (d < bd && !regs.some((w) => !w.dead && Math.hypot(w.x - s.x, w.z - s.z) < 0.6)) { bd = d; best = s; }
  }
  return best;
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
  updateCrowds(me, px, pz);
}

// ---------- the people in the landmark halls (fans, shoppers, travellers, diners, students) ----------
// Each hall's crowd ([x, z, heading, pose, up, role]) is filled while you're near the hall and emptied when you leave.
// pose 'walk' paces back and forth along the heading; up stands them on a raised floor (the arena's seats).
const crowds = new Map(); // hall room -> [walker]
const CROWD_LINES = {
  fan: ['LET\'S GO STORM!', 'Ref, you\'re blind!', 'Down in front!', 'Is that the Zamboni?', 'Twelve bucks for a beer...', 'DEE-FENSE!', 'I can see myself on the big screen!'],
  shopper: ['Is this on sale?', 'Meet you at the food court', 'I just need one thing', 'This mall used to be packed', 'Where did the arcade go?', 'Do they still have the fountain?'],
  traveller: ['My flight is delayed. Again.', 'Is this gate 7?', 'Allegiant to Vegas, baby!', 'Did you pack the chargers?', 'I just need a coffee', 'Boarding group C... of course'],
  diner: ['The pork loin is to die for', 'I love this show', 'Our waiter sings!', 'Best seats in the house', 'Save room for dessert'],
  student: ['Did you do the reading?', 'Go Vikings!', 'Class in the dome room', 'I have a midterm tomorrow', 'Who wants coffee?'],
  office: ['Meeting in five', 'Nothing runs like a Deere', 'Did you see the new combine?', 'Badge in, please', 'Lunch?'],
  visitor: ['Look at the old tractor!', 'Take my picture by it', 'My grandpa had one of these', 'Is the gift shop open?', 'Read the plaque'],
};
const LINE_FOR = { fan: 'fan', shopper: 'shopper', traveller: 'traveller', diner: 'diner', student: 'student', office: 'office', visitor: 'visitor', vendor: 'visitor' };
const ROLE_OF = { fan: 'walk', traveller: 'walk', diner: 'walk', visitor: 'walk' };
function fillCrowd(R) {
  const out = [], list = R.crowd.length > 32 ? R.crowd.slice().sort(() => Math.random() - 0.5).slice(0, 32) : R.crowd; // a busy day, not a riot
  for (const [x, z, h, pose, up = 0, role = 'walk'] of list) {
    const w = addScripted(ROLE_OF[role] || role, x, z, h);
    const lines = CROWD_LINES[LINE_FOR[role]] || null;
    w.mode = 'fixed'; w.fixed = { x, z, h, pose: pose === 'walk' ? 'stand' : pose, lines: lines && Math.random() < 0.5 ? lines : null };
    if (pose === 'walk') w.mow = { x, z, ax: Math.sin(h), az: Math.cos(h), t: Math.random() * 25 }; // the lawn-mower pacing, without the mower
    w.floorY = R.y + up; w.up = up; w.hall = R;
    out.push(w);
  }
  return out;
}
function updateCrowds(me, px, pz) {
  for (const [R, ws] of crowds) {
    const far = !interior.halls.has(R) || Math.hypot(R.x - px, R.z - pz) > (R.w + R.d) / 2 + 120;
    if (far) { for (const w of ws) dropScripted(w); crowds.delete(R); continue; }
    for (const w of ws) if (w.floorY !== undefined && (w.mode !== 'fixed' || !inside(R, w.x, w.z))) { if (w.up && inside(R, w.x, w.z)) { w.floorY = R.y; w.up = 0; } else if (!inside(R, w.x, w.z)) delete w.floorY; } // got up and ran
  }
  for (const R of interior.halls) {
    if (!R.crowd || crowds.has(R) || crowds.size >= 3) continue;
    if (Math.hypot(R.x - px, R.z - pz) < (R.w + R.d) / 2 + 50) crowds.set(R, fillCrowd(R));
  }
}
