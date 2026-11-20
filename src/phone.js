// GTA V-style phone. Up arrow raises it (bottom-right) while the game keeps running.
// Arrows move, Enter picks, Backspace / Esc go back (Down on the bottom row of the home screen puts it away). Mouse works too.
// Apps: Contacts (mechanic, taxi, 911, Arnett Auto, funny locals), Messages (people text you and react to what you do),
// Internet (parody Davenport sites). Other systems can send texts with phone.text(from, msg).
import * as ui from './ui.js';
import * as fx from './fx.js';
import * as W from './world.js';
import { eco, spend } from './economy.js';
import { wanted } from './wanted.js';
import { drunk } from './drunk.js';
import { TYPES } from './vehicles.js';
import { clockText } from './daynight.js';
import { dispatch } from './emergency.js';
import { fmtDist } from './util.js';

let ctx, root, scr, head, body;
let open = false;
const stack = []; // [{ fn, sel }] screens; fn() => { title, color, rows } or { home: true }
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const later = (f, ms) => setTimeout(f, ms);
// garage.js (car customization agent) may not exist yet
let garageP = null;
const garage = () => (garageP ||= import('./garage.js').catch(() => null));

// ---------- people ----------
const CHARS = {
  'Mayor Tim Arnett': { color: '#2f7de1', calls: [
    "This is Mayor Tim Arnett. Did you vote for me? Doesn't matter, I counted it anyway.",
    "Tim Arnett here. I'm cutting a ribbon right now, can't talk. These scissors are huge.",
    "You've reached the Mayor. If this is about the potholes, they're a historic landmark now.",
    "Davenport loves you. Davenport also has your license plate. Have a great day!",
    "I'm naming a bridge after myself. Which one? All of them.",
    "Hello, citizen! Remember: the Mississippi is free to look at. Swimming is a misdemeanor.",
  ], texts: [
    'Reminder: Tim Arnett Day is every day. Act accordingly.',
    "Big announcement tomorrow. It's me. I'm the announcement.",
    'Please stop parking on the levee. The river needs it.',
    'Just approved a statue of me holding a smaller statue of me.',
    "Town hall at 7. There'll be snacks. Snacks are also me.",
    'New city slogan: "Davenport: We Have A River." Thoughts?',
    "If you see a pothole, that's not a pothole. That's a Tim Arnett Commemorative Dip.",
    'Did you know Davenport has the best sunsets in the Quad Cities? I signed an order.',
    'Vote Tim. Or else. (Or else nothing, that was a joke. Mostly.)',
    "My approval rating is 104%. Nobody can explain it. I won't.",
    'The Skybridge lights are paid for by your parking tickets. You are welcome.',
    'I am not actually the mayor. Yet. Delete this text.',
  ] },
  'Uncle Dale': { color: '#8a6d3b', calls: [
    "Can't talk long. They're listening. The pigeons. Every one of them.",
    "The Quad Cities are actually FIVE cities. They don't want you knowing about the other one.",
    "The river flows south because Minnesota is pushing it. Think about it.",
    "Don't trust the corn. Corn has ears.",
    "Dale here. I put tinfoil on the truck. Now the radio only plays polka. Worth it.",
    "Ever notice nobody's ever seen Bettendorf and a UFO at the same time? Ever?",
  ], texts: [
    'Wake up. The Skybridge is a radio tower. For the birds.',
    "Why is it called Rock Island if it isn't an island. Oh wait. It is. Doesn't matter. Suspicious.",
    "The John Deere logo is a deer. Deer can't drive tractors. Who's driving them??",
    "Bought 400 cans of beans. Don't ask. You'll thank me.",
    "The barges aren't carrying coal. They're carrying MORE BARGES.",
    "Mayor Arnett has never been seen blinking. Look it up.",
    "If the cops pull you over, tell them you're a sovereign citizen of Moline. Works every time. (Hasn't worked yet.)",
    'Saw a helicopter. It saw me. We have an understanding now.',
    'Fluoride is why the Cubs never win. Pass it on.',
    'Daylight savings is a corn industry scam. Extra hour of sunlight = extra corn. Follow the corn.',
    "My mailman is the same guy as the weatherman. Different mustache. Same eyes.",
    "Don't eat at the casino buffet on Tuesdays. You know why.",
  ] },
  "Sal's Pre-Owned": { color: '#d6a82f', calls: [
    "Sal here. Got a Buick, one previous owner. He's not using it anymore. Don't ask why.",
    "No, the VIN numbers aren't scratched off. They're 'minimalist'.",
    "Sal's Pre-Owned, where every car has a story. Most of them end in court.",
    "You want a warranty? Sure. I warranty it's a car.",
    "I got a van that's never been in a crash. It's been in several fires, but never a crash.",
    "Cash only, no questions, no refunds, no eye contact.",
  ], texts: [
    'Got a minivan in today. Smells like crayons and regret. $900 OBO.',
    "Don't worry about where I get my cars. Worry about where YOU get a better deal. (Nowhere.)",
    'Flash sale: anything with a steering wheel, 20% off. Steering wheel sold separately.',
    "If anyone asks, you've never met me and that sedan was always blue.",
    'New on the lot: a Sports car with only one bullet hole. Character!',
    "Tow trucks are just cars that hug other cars. Got two. Cheap.",
    'Trade-ins welcome. Even ones that aren\'t technically yours.',
    'Monster truck for sale. Previous owner was a monster. Kidding. Mostly.',
    "The 'check engine' light is decorative. Like a Christmas light. Festive.",
    'Remember: a car is only stolen if they can prove it.',
  ] },
  Grandma: { color: '#c86ab0', calls: [
    "Hello sweetie! Are you eating? You sound thin.",
    "Is this the internet? I'm calling the internet.",
    "I made a casserole. It's for you. It's also a doorstop. Come get it.",
    "Your grandfather says hi. He's asleep, but he'd say hi.",
    "Don't forget to wear a coat. It's Iowa. It's always about to be cold.",
    "I saw a boy on the news who looked just like you! He was running from the police. Very handsome.",
  ], texts: [
    'Call your grandmother. This is your grandmother.',
    'I learned how to text!!! How do I stop the capitals',
    'Are you warm enough? Iowa is cold. Even in July. Especially in July.',
    'I put $5 in a birthday card for you. Your birthday was in March. Still counts.',
    "Bingo at St. Ambrose tonight. I'm going to win. I'm going to destroy them.",
    'Did you know they put the casino ON A BOAT? Your grandfather would have loved that.',
    'Eat a vegetable. Corn counts. Corn dogs do not.',
    "I'm so proud of you, whatever it is you do.",
    'Who is Siri and why does she keep interrupting me',
    'Remember to say please and thank you. Even to the police.',
  ] },
  Brittany: { color: '#e5484d', calls: [
    "Why are you calling me? ...No, keep talking, I'm screenshotting this.",
    "I'm not mad. I'm just telling everyone.",
    "New phone, who dis? ...Oh. It's you. Ew.",
    "I'm at the mall with Kyle. He has a jet ski. Do you have a jet ski? Didn't think so.",
    "If this is about the hoodie, I'm keeping it. It's emotional support.",
  ], texts: [
    'saw u at the gas station. u looked tired lol',
    "not that i care but are u ok",
    'my mom still asks about u. i told her u moved to moline',
    "Kyle got me a puppy. what have u done lately",
    'k',
    'ur playlist is still on my spotify and it is BAD',
    'heard u got arrested. jk. unless??',
    "dont text me. unless u have a jet ski",
    "lol who even lives in davenport anymore. me. i do",
    'returning ur stuff: one sock and a grudge',
  ] },
};
const NAMES = Object.keys(CHARS);
const colorOf = (n) => CHARS[n]?.color || { 'Quad City Cab': '#f5c400', Mechanic: '#e8833a', 'Arnett Auto': '#e5484d', Dispatch: '#2f7de1', 'Quad City Tattler': '#888' }[n] || '#7a7a7a';

// texts sent when something happens (sender, line)
const REACT = {
  wanted: [['Grandma', "Sweetie, why is there a police car behind you on Channel 6?"], ['Uncle Dale', 'COPS ARE LIZARDS. Head for the river. Lizards hate current.'], ['Mayor Tim Arnett', 'Please stop doing crimes in my town. It looks bad on the brochure.'], ['Brittany', 'lmaooo ur on the police scanner'], ["Sal's Pre-Owned", 'If you need a new car with a new color, real fast, you know where I am.']],
  kill: [['Uncle Dale', "Whoever that was, they were probably a government plant. Probably."], ['Grandma', "I heard something terrible happened downtown. Please stay inside, sweetie."], ['Mayor Tim Arnett', 'Murder is NOT on the list of approved city activities.']],
  robbery: [["Sal's Pre-Owned", 'Nice score. I can launder that for 40%. Car-wash joke. Mostly.'], ['Uncle Dale', 'Cash is the only currency they can\'t track. Except serial numbers. Burn the serial numbers.'], ['Brittany', 'so ur a robber now?? kinda hot ngl. no. forget i said that']],
  death: [['Grandma', 'The hospital called. They said you were "fine" and "billed". Call me.'], ['Brittany', 'heard u died. can i have my hoodie back. my hoodie u have'], ['Mayor Tim Arnett', 'On behalf of the city: get well soon. On behalf of the hospital: please pay.'], ['Uncle Dale', "Death is just the government's way of saying you knew too much."]],
  crash: [["Sal's Pre-Owned", "Heard you totaled one. I got a guy. The guy is also me."], ['Uncle Dale', 'Cars are tracked by satellites anyway. Good riddance.'], ['Grandma', 'Were you in an accident?? Wear your seatbelt. And clean underwear.'], ['Mayor Tim Arnett', 'Whoever hit that light pole: that was a historic light pole.']],
  drunk: [['Brittany', 'r u drunk?? u havent even texted yet and i can tell'], ['Grandma', 'Drink some water, sweetie. And eat some bread.'], ['Uncle Dale', "Beer is liquid bread. Bread is a cover-up. Keep drinking, it's research."]],
  cop: [['Uncle Dale', "Hurting cops?? Okay that's too far even for me. Mostly."], ['Mayor Tim Arnett', "The police union is going to make me buy them a new boat. Thanks a lot."]],
};

// ---------- news log (the Tattler's front page) ----------
const news = [];
const HEAD = {
  kill: ['Body Found in {a}; Police "Pretty Sure" It Was Murder', 'Deadly Attack in {a} Ruins Everyone\'s Tuesday', '{a} Neighbors Report Killing, Also Loud Music'],
  gunfire: ['Shots Fired in {a}. Again.', 'Gunfire Startles {a}; Local Dog Unimpressed', 'Residents of {a} Now Recognize Gun Models By Sound'],
  assault: ['Local Punched in {a}, Demands Apology', 'Fistfight Breaks Out in {a} Over Nothing', 'Man in {a} Slapped So Hard He Saw Moline'],
  carjack: ['Driver Yanked From Car in {a}: "I Just Got It Detailed"', 'Carjacking in {a}; Victim Mostly Upset About Playlist', 'Car Stolen in {a} With Dog Still Inside (Dog Fine, Was Navigator)'],
  steal: ['Car Vanishes From {a} Curb; Owner Blames Uncle', 'Another Car Stolen in {a}. Locks, People.'],
  hitcop: ['Officer Assaulted in {a}; Donut Shop Holds Vigil', 'Police Under Attack in {a}, Request "Bigger Hats"'],
  robbery: ['Store Robbed at Gunpoint in {a}; Clerk Takes Rest of Day Off', 'Armed Robbery in {a}. Thief Also Took a Slushie.', 'Masked Bandit Hits {a} Shop, Leaves One-Star Review'],
  crash: ['Wreck in {a} Leaves Traffic Light Emotionally Shaken', 'Car Crash in {a}: Witnesses Say Driver Was "Going Like Heck"', 'Speeding Driver Rearranges {a} Street Furniture'],
  death: ['Local Resident Hospitalized in {a}, Billed Immediately', 'Person Collapses in {a}; Paramedics Charge Extra for Stairs'],
  drunk: ['Man Seen Arguing With Mailbox in {a}', 'Drunk Local in {a} Proposes to Parking Meter'],
  wanted: ['Police Chase Tears Through {a}; Footage Goes Viral', 'Wanted Suspect Last Seen in {a}, Described As "Fast"'],
};
const FILLER = ['Mississippi River Reported "Still Wet"', 'Mayor Arnett Cuts Ribbon; Ribbon Files Complaint', 'Bix 7 Runners Still Unsure Why They Do It', 'Local Man Finds Parking Spot Downtown, Weeps', 'Quad Cities Agree on Nothing, Again', 'Corn Prices Up; Corn Unavailable for Comment', 'Skybridge Lights Change Color; Residents Change Opinions', 'River Bandits Mascot Denies Being an Actual Bandit'];
// main.js report() and update() below call this for crimes, robberies, deaths, crashes...
export function log(type, x, z) {
  const area = (x !== undefined && W.areaAt(x, z)[0]) || 'Davenport', last = news[0], now = performance.now();
  if (last && last.type === type && last.area === area && now - last.at < 30000) { last.n++; last.at = now; return; }
  news.unshift({ type, area, n: 1, at: now, time: clockText() });
  news.length = Math.min(news.length, 20);
  const rk = type === 'hitcop' || type === 'killcop' ? 'cop' : type;
  if (REACT[rk]) react(rk);
}

// ---------- messages ----------
const threads = new Map(); // from -> { msgs: [{ msg, time }], unread }
export function text(from, msg) {
  if (!threads.has(from)) threads.set(from, { msgs: [], unread: 0 });
  const th = threads.get(from);
  th.msgs.push({ msg: String(msg), time: clockText() }); th.unread++; th.at = performance.now();
  if (th.msgs.length > 40) th.msgs.shift();
  card(from, msg);
  if (open) render();
}
let reactAt = -1e9;
function react(kind) {
  const now = performance.now();
  if (now - reactAt < 45000 || Math.random() > 0.6) return;
  reactAt = now;
  const [from, msg] = pick(REACT[kind]);
  later(() => text(from, msg), 2500 + Math.random() * 5000);
}
// GTA-style notification card in the feed, with a ping
function card(from, msg) {
  if (!ui.el.feed) return;
  const li = document.createElement('li'); li.className = 'phCard';
  const av = document.createElement('span'); av.className = 'phAv'; av.style.background = colorOf(from); av.textContent = from[0];
  const d = document.createElement('div'), b = document.createElement('b'), p = document.createElement('p');
  b.textContent = from; p.textContent = msg; d.append(b, p); li.append(av, d);
  ui.el.feed.prepend(li);
  later(() => li.remove(), 8000);
  beep([[1320, 0], [1760, 0.1]], 0.1);
}
function beep(notes, vol, len = 0.22) {
  const { ac, out } = fx.audio();
  if (!ac || !out) return;
  for (const [f, d] of notes) {
    const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + d;
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + len + 0.05);
  }
}
const ring = () => beep([[440, 0], [480, 0], [440, 0.5], [480, 0.5]], 0.05, 0.4);

// ---------- calls ----------
let call = null;
function dial(name, answer) {
  const c = (call = { name, text: 'Calling...' });
  push(callScreen, 1); ring();
  later(async () => {
    if (call !== c) return;
    c.text = (await answer()) || '...';
    if (call === c && open) render();
  }, 1400);
}
function callScreen() { return { title: call ? call.name : '', color: call ? colorOf(call.name) : '#333', rows: [{ label: call ? call.text : '', big: true }, { label: 'Hang up', act: back, cls: 'hang' }] }; }
// hang up, put the phone away, then act (so overlays like the mechanic's menu aren't covered)
const thenClose = (f, ms = 1100) => later(() => { close(); if (!ctx.player().dead) f(); }, ms);

function mechanic() { thenClose(() => ctx.mechanic()); return 'Mechanic here. Which ride do you want dropped off?'; }
async function arnettAuto() {
  const g = await garage();
  if (g && g.deliver) {
    if (!g.cars().length) return 'No personal vehicle yet: save one at Arnett Auto';
    if (g.blips().length) return "Your car is already out — it's on your map";
    thenClose(() => g.deliver()); return "Arnett Auto. Your car's on the way, follow the GPS.";
  }
  return "Arnett Auto: Garage coming soon. We're still sweeping the floor.";
}
function taxi() {
  const p = ctx.player(), wp = ctx.waypoint();
  if (!wp) return 'Quad City Cab. Set a waypoint first, then call back.';
  if (p.inVeh) return "You're already in a car, pal. Get out and call me back.";
  if (p.inRoom) return "I can't drive into a building. Step outside first.";
  if (wanted.stars > 0) return 'Not with the cops on your tail. Call me when it\'s quiet.';
  const d = Math.hypot(wp.x - p.x, wp.z - p.z);
  if (d < 60) return "That's right next to you. Walk.";
  const fare = Math.round(10 + (d / 1609) * 4);
  if (!spend(fare)) return `That's $${fare} for ${fmtDist(d)}. Cash only, and you're short.`;
  fx.soundCash();
  thenClose(() => ctx.taxi(wp.x, wp.z), 1600);
  return `${fmtDist(d)} to your waypoint, that's $${fare}. Hop in.`;
}
// 911: a real unit drives to you. Calling for no reason just gets a lecture.
const busy = {};
function emergency(kind) {
  const now = performance.now();
  if (busy[kind] && now - busy[kind] < 60000) return 'Dispatch: A unit is already on the way. Please hold still.';
  if (kind === 'cop' && wanted.stars > 0) return "Dispatch: Oh, we know where you are. They're coming.";
  const here = (done) => ({ get x() { return ctx.player().x; }, get z() { return ctx.player().z; }, h: 0, dead: true, burnAt: 1, call: done });
  const t = here(() => {
    busy[kind] = 0;
    if (kind === 'amb') {
      const p = ctx.player();
      if (p.dead) return;
      ctx.heal();
      const bill = Math.min(eco.cash, 50); eco.cash -= bill;
      text('Dispatch', `Paramedics patched you up.${bill ? ` Bill: $${bill}.` : ''}`);
    } else if (kind === 'cop') text('Dispatch', pick(['Officer: "Everything looks fine here. Stop calling."', 'Officer: "We checked. The only suspicious thing is you."', 'Officer: "Nothing to report. Except your outfit."']));
    else text('Dispatch', pick(['Fire crew: "No fire. We sprayed your shoes anyway."', 'Fire crew: "False alarm. Nice to get out of the station though."']));
  });
  if (!dispatch(kind, t)) return 'Dispatch: No units available. Try yelling.';
  busy[kind] = now;
  return { cop: 'Dispatch: Police are on the way.', amb: 'Dispatch: An ambulance is on the way.', fire: 'Dispatch: A fire truck is on the way.' }[kind];
}
const CONTACTS = () => [
  { name: 'Arnett Auto', answer: arnettAuto },
  { name: 'Mechanic', answer: mechanic },
  { name: 'Quad City Cab', answer: taxi },
  { name: '911 Emergency', menu: () => push(nineOneOne) },
  ...NAMES.map((n) => ({ name: n, answer: () => pick(CHARS[n].calls) })),
];
function contacts() {
  return { title: 'Contacts', color: '#3b8a4a', rows: CONTACTS().map((c) => ({ label: c.name, av: c.name, act: () => (c.menu ? c.menu() : dial(c.name, c.answer)) })) };
}
function nineOneOne() {
  const row = (label, kind) => ({ label, act: () => dial('Dispatch', () => emergency(kind)) });
  return { title: '911', color: '#d23c30', rows: [row('Police', 'cop'), row('Ambulance', 'amb'), row('Fire', 'fire')] };
}

// ---------- messages app ----------
function messages() {
  const list = [...threads.entries()].sort((a, b) => b[1].at - a[1].at);
  if (!list.length) return { title: 'Messages', color: '#2f7de1', rows: [{ label: 'No messages yet', sub: 'People will text you. Eventually.' }] };
  return { title: 'Messages', color: '#2f7de1', rows: list.map(([from, th]) => ({ label: from, av: from, sub: th.msgs[th.msgs.length - 1].msg, right: th.unread ? '●' : '', act: () => openThread(from) })) };
}
function openThread(from) {
  const th = threads.get(from); th.unread = 0;
  push(() => ({ title: from, color: colorOf(from), rows: th.msgs.map((m) => ({ label: m.msg, sub: m.time, wrap: true })) }), th.msgs.length - 1);
}

// ---------- internet ----------
const SITES = [
  { name: 'Quad City Tattler', url: 'quadcitytattler.com', color: '#7a1f1f', fn: tattler },
  { name: "Tim's Discount Wheels", url: 'timsdiscountwheels.com', color: '#d6a82f', fn: dealer },
  { name: 'Arnett Arms', url: 'arnettarms.com', color: '#a3261f', fn: arms },
  { name: 'Is The Bridge Open?', url: 'isthebridgeopen.com', color: '#2b6f8f', fn: bridge },
  { name: "Uncle Dale's Truth Zone", url: 'daletruth.net', color: '#4b6b2b', fn: dale },
  { name: 'Arnett 2028', url: 'arnett2028.gov', color: '#2f7de1', fn: campaign },
];
function internet() { return { title: 'Internet', color: '#5a5a5a', rows: SITES.map((s) => ({ label: s.name, sub: s.url, act: () => push(s.fn) })) }; }
function tattler() {
  const rows = news.slice(0, 12).map((e) => ({ label: pick2(HEAD[e.type] || HEAD.assault, e).replace('{a}', e.area) + (e.n > 1 ? ` (x${e.n})` : ''), sub: `${e.area} · ${e.time}`, wrap: true }));
  for (const f of FILLER.slice(0, Math.max(2, 6 - rows.length))) rows.push({ label: f, sub: 'In other news', wrap: true });
  return { title: 'Quad City Tattler', color: '#7a1f1f', rows };
}
// same headline each time you open the page for the same entry
function pick2(a, e) { return a[(e.time.charCodeAt(4) + e.area.length) % a.length]; }
const CARS = TYPES.map((T, ti) => ({ T, ti })).filter(({ T }) => !T.police && !T.boat && !T.heli);
const priceOf = (T) => Math.round((T.max * 30 + T.acc * 40 + T.hp * 4) / 50) * 50;
function dealer() {
  return { title: "Tim's Discount Wheels", color: '#d6a82f', rows: CARS.map(({ T, ti }) => {
    const price = priceOf(T);
    return { label: T.name, sub: eco.cash < price ? 'Not enough cash' : 'Delivered today. No refunds. No questions.', right: '$' + price.toLocaleString('en-US'), dim: eco.cash < price, act: () => buyCar(ti, T.name, price) };
  }) };
}
async function buyCar(ti, name, price) {
  if (!spend(price)) { note('Not enough cash'); return; }
  fx.soundCash();
  const g = await garage();
  if (g && g.addCar && g.addCar(ti) >= 0) { text("Tim's Discount Wheels", `Your ${name} is in your garage at Arnett Auto. Thanks for buying from Tim!`); }
  else { ctx.deliver(ti, name); text("Tim's Discount Wheels", `Your ${name} has been dropped off nearby. Follow the GPS. Thanks for buying from Tim!`); }
  render();
}
function arms() {
  return { title: 'Arnett Arms', color: '#a3261f', rows: ctx.ammoItems().map((it) => {
    const no = eco.cash < it.price || (it.ok && !it.ok());
    return { label: it.label, sub: it.sub, right: '$' + it.price, dim: no, act: () => { if (it.ok && !it.ok()) return note('You already have that'); if (!spend(it.price)) return note('Not enough cash'); it.buy(); fx.soundCash(); note('Shipped straight to your pockets'); render(); } };
  }) };
}
function bridge() {
  return { title: 'Is The Bridge Open?', color: '#2b6f8f', rows: [{ label: 'MAYBE.', big: true }, { label: pick(['Updated 4 minutes ago by a guy on the bridge.', 'Our reporter is on the bridge. Our reporter is also stuck on the bridge.', 'Barge sighted. Assume no.', "Tip: if you can see it, it's probably there."]), wrap: true }] };
}
function dale() {
  return { title: "Dale's Truth Zone", color: '#4b6b2b', rows: ['The Skybridge Is A Radio Tower (For Birds)', 'Five Quad Cities: The Proof They Buried', 'Is Corn Listening? (Yes)', 'Barges Carrying More Barges: A Photo Essay', 'Why Has Nobody Seen The Mayor Blink?', 'Bettendorf: Real Town Or Hologram?'].map((t) => ({ label: t, sub: 'Visitors: 3 (two are Dale)', wrap: true })) };
}
function campaign() {
  return { title: 'Arnett 2028', color: '#2f7de1', rows: [
    { label: 'A River For Every Citizen', wrap: true }, { label: 'Free Parking (Somewhere)', wrap: true }, { label: 'Make Davenport Davenport Again', wrap: true },
    { label: 'Donate $20', sub: 'Every donation gets a commemorative button.', right: '$20', act: () => { if (!spend(20)) return note('Not enough cash'); fx.soundCash(); text('Mayor Tim Arnett', 'Thank you for your donation! Your button is in the mail. The mail is also me.'); } },
  ] };
}

// ---------- home ----------
const APPS = [
  { name: 'Contacts', icon: '☎', fn: contacts },
  { name: 'Messages', icon: '✉', fn: messages },
  { name: 'Internet', icon: '◎', fn: internet },
  { name: 'Taxi', icon: '🚕', act: () => dial('Quad City Cab', taxi) },
  { name: '911', icon: '✚', fn: nineOneOne },
  { name: 'Mechanic', icon: '🔧', act: () => dial('Mechanic', mechanic) },
];
const COLS = 3;

// ---------- DOM ----------
const CSS = `
#phone { position: absolute; right: max(24px, 4vw); bottom: 18px; width: 250px; height: min(470px, 66vh); padding: 12px 9px 14px; box-sizing: border-box; background: #0d0d0e; border-radius: 30px; box-shadow: 0 0 0 2px #2a2a2c, 0 18px 40px rgba(0,0,0,.6); pointer-events: auto; transform: translateY(calc(100% + 30px)); transition: transform .3s cubic-bezier(.2,.8,.25,1), visibility 0s .3s; font: 500 16px/1.2 var(--hud); text-shadow: none; color: #fff; visibility: hidden; }
#phone.on { transform: none; visibility: visible; transition: transform .3s cubic-bezier(.2,.8,.25,1); }
@media (prefers-reduced-motion: reduce) { #phone { transition: none; } }
#phone .scr { position: relative; height: 100%; border-radius: 20px; overflow: hidden; display: grid; grid-template-rows: auto auto 1fr auto; background: #222 center / cover; }
#phone .bar { display: flex; justify-content: space-between; align-items: center; padding: 5px 12px; font-size: 13px; background: rgba(0,0,0,.55); letter-spacing: .5px; }
#phone .bar i { font-style: normal; opacity: .85; }
#phone .hd { padding: 7px 12px 6px; font: 22px/1 var(--display); letter-spacing: .5px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#phone .bd { overflow-y: auto; scrollbar-width: none; display: grid; align-content: start; gap: 2px; padding: 2px 0; }
#phone .bd::-webkit-scrollbar { display: none; }
#phone .row { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; width: 100%; text-align: left; border: 0; padding: 7px 11px; background: rgba(0,0,0,.65); color: #fff; font: inherit; cursor: pointer; }
#phone .row > span { min-width: 0; }
#phone .row b { display: block; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#phone .row.wrap b { white-space: normal; font-weight: 500; }
#phone .row small { display: block; color: rgba(255,255,255,.62); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#phone .row.wrap small { white-space: normal; }
#phone .row.big b { font: 26px/1.1 var(--display); white-space: normal; text-align: center; padding: 14px 0; }
#phone .row em { font-style: normal; font-weight: 600; color: #72c472; font-variant-numeric: tabular-nums; }
#phone .row.dim { color: rgba(255,255,255,.45); }
#phone .row.dim em { color: rgba(114,196,114,.5); }
#phone .row.hang em, #phone .row.hang b { color: #ff6b5e; }
#phone .row.sel { background: #fff; color: #000; }
#phone .row.sel small { color: rgba(0,0,0,.6); }
#phone .row.sel em { color: #1f7a2a; }
#phone .row.sel.hang b { color: #b3261e; }
#phone .av, .phCard .phAv { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-weight: 600; font-size: 15px; color: #fff; flex: none; }
#phone .home { display: grid; grid-template-columns: repeat(${COLS}, 1fr); gap: 8px; padding: 10px; align-content: end; }
#phone .app { display: grid; justify-items: center; gap: 4px; padding: 10px 2px 7px; border: 0; border-radius: 12px; background: rgba(0,0,0,.6); color: #fff; font: 500 13px/1 var(--hud); cursor: pointer; }
#phone .app span { font-size: 26px; line-height: 1; }
#phone .app.sel { background: #fff; color: #000; }
#phone .clock { text-align: center; padding: 22px 0 0; font: 600 54px/1 var(--hud); text-shadow: 0 2px 8px rgba(0,0,0,.6); }
#phone .note { padding: 6px 11px; font-size: 13px; background: rgba(0,0,0,.8); color: #ffd23f; }
#feed li.phCard { display: grid; grid-template-columns: auto 1fr; gap: 9px; align-items: start; padding-right: 12px; }
#feed li.phCard::after { display: none; }
.phCard b { display: block; font-weight: 600; }
.phCard p { margin: 1px 0 0; font-size: 15px; color: rgba(255,255,255,.85); }
`;

export function initPhone(c) {
  ctx = c;
  const st = document.createElement('style'); st.textContent = CSS; document.head.append(st);
  root = document.createElement('div'); root.id = 'phone'; root.setAttribute('aria-label', 'Phone');
  root.innerHTML = '<div class="scr"><div class="bar"><i>▂▄▆█ DAV</i><i class="t"></i><i>▮▮▮▯</i></div><div class="hd"></div><div class="bd"></div><div class="note" hidden></div></div>';
  scr = root.querySelector('.scr'); head = root.querySelector('.hd'); body = root.querySelector('.bd');
  scr.style.backgroundImage = `url(assets/load/art${1 + Math.floor(Math.random() * 7)}.jpg)`;
  const hud = document.getElementById('hud'), shop = document.getElementById('shop');
  if (shop && shop.parentNode === hud) hud.insertBefore(root, shop); else (hud || document.body).append(root); // under the pause menu
  root.addEventListener('mousedown', (e) => e.preventDefault()); // keep keyboard focus on the game
}

function push(fn, sel = 0) { stack.push({ fn, sel }); render(); }
function back() {
  if (stack.length && stack[stack.length - 1].fn === callScreen) call = null;
  stack.pop();
  if (!stack.length) close(); else render();
}
function openPhone() {
  open = true; stack.length = 0; call = null; stack.push({ fn: () => ({ home: true }), sel: 0 });
  root.classList.add('on'); render(); fx.soundClick();
}
function close() { open = false; call = null; root.classList.remove('on'); }
let noteT = 0;
function note(t) { const n = root.querySelector('.note'); n.textContent = t; n.hidden = false; clearTimeout(noteT); noteT = setTimeout(() => { n.hidden = true; }, 2200); }

function render() {
  if (!open) return;
  const top = stack[stack.length - 1], s = top.fn();
  body.innerHTML = '';
  root.querySelector('.t').textContent = clockText();
  if (s.home) {
    head.innerHTML = ''; head.style.background = 'none';
    const clk = document.createElement('div'); clk.className = 'clock'; clk.textContent = clockText(); head.append(clk);
    body.className = 'bd home';
    top.sel = Math.min(top.sel, APPS.length - 1);
    APPS.forEach((a, i) => {
      const b = document.createElement('button'); b.className = 'app' + (i === top.sel ? ' sel' : '');
      const unread = a.name === 'Messages' ? [...threads.values()].reduce((n, t) => n + t.unread, 0) : 0;
      b.innerHTML = `<span>${a.icon}</span>${a.name}${unread ? ` (${unread})` : ''}`;
      b.addEventListener('click', () => { top.sel = i; choose(); });
      body.append(b);
    });
    return;
  }
  body.className = 'bd';
  head.textContent = s.title; head.style.background = s.color;
  top.rows = s.rows;
  top.sel = Math.max(0, Math.min(top.sel, s.rows.length - 1));
  s.rows.forEach((r, i) => {
    const b = document.createElement('button');
    b.className = 'row' + (r.wrap ? ' wrap' : '') + (r.big ? ' big' : '') + (r.dim ? ' dim' : '') + (r.cls ? ' ' + r.cls : '') + (i === top.sel ? ' sel' : '');
    if (r.av) { const a = document.createElement('span'); a.className = 'av'; a.style.background = colorOf(r.av); a.textContent = r.av[0]; b.append(a); } else b.append(document.createElement('i'));
    const t = document.createElement('span'), l = document.createElement('b'); l.textContent = r.label; t.append(l);
    if (r.sub) { const sm = document.createElement('small'); sm.textContent = r.sub; t.append(sm); }
    const em = document.createElement('em'); em.textContent = r.right || '';
    b.append(t, em);
    b.addEventListener('click', () => { top.sel = i; choose(); });
    body.append(b);
  });
  body.children[top.sel]?.scrollIntoView({ block: 'nearest' });
}
function choose() {
  const top = stack[stack.length - 1];
  if (top.fn().home) { const a = APPS[top.sel]; if (a.fn) push(a.fn); else a.act(); return; }
  const r = top.rows && top.rows[top.sel];
  if (r && r.act) r.act();
  else render();
}
function move(d) {
  const top = stack[stack.length - 1], n = top.fn().home ? APPS.length : (top.rows || []).length;
  top.sel = Math.max(0, Math.min(n - 1, top.sel + d));
  render();
}

// main.js keydown hook: returns true when the phone used the key (so it doesn't drive or walk)
// Esc with the mouse captured: the browser frees the pointer (and may or may not send the keydown).
// key() and unlocked() both see that one Esc; whichever comes first backs the phone, the other just swallows it.
let escAt = -1e9;
const sameEsc = () => performance.now() - escAt < 300;
export function key(e) {
  if (e.key === 'Escape' && sameEsc()) return true;
  if (!open) {
    if (e.key !== 'ArrowUp' || e.repeat || ctx.player().dead || ctx.busy()) return false;
    openPhone(); return true;
  }
  const home = stack.length === 1;
  switch (e.key) {
    case 'ArrowUp': move(home ? -COLS : -1); return true;
    case 'ArrowDown':
      if (home && stack[0].sel + COLS >= APPS.length) { if (!e.repeat) close(); return true; }
      move(home ? COLS : 1); return true;
    case 'ArrowLeft': if (home) move(-1); return true;
    case 'ArrowRight': if (home) move(1); return true;
    case 'Enter': if (!e.repeat) choose(); return true;
    case 'Backspace': case 'Escape': if (e.key === 'Escape') escAt = performance.now(); if (!e.repeat) back(); return true;
  }
  return false;
}
export const isOpen = () => open;
// main.js pointerlockchange: true = the phone took this unlock, don't open the pause menu
export function unlocked() {
  if (sameEsc()) return true;
  if (!open) return false;
  escAt = performance.now(); back(); return true;
}

// per-frame from main.js: random texts over time and reactions to what you do
let textT = 60 + Math.random() * 90, clockT = 0, last = null;
export function update(dt) {
  const p = ctx.player(), busy = ctx.busy(); // pause menu, shop, minigame or loading screen up
  if (!busy) textT -= dt;
  if (textT <= 0) { textT = 120 + Math.random() * 180; const n = pick(NAMES); text(n, pick(CHARS[n].texts)); }
  if (open && (clockT -= dt) <= 0) { clockT = 1; root.querySelector('.t').textContent = clockText(); }
  if (open && (p.dead || busy)) close();
  const now = { stars: wanted.stars, robbed: eco.robbed, dead: p.dead, drunk: drunk.lvl > 0.75, speed: p.inVeh ? p.speed : 0 };
  if (last) {
    if (now.stars > 0 && last.stars === 0) log('wanted', p.x, p.z);
    if (now.robbed > last.robbed) log('robbery', p.x, p.z);
    if (now.dead && !last.dead) log('death', p.x, p.z);
    if (now.drunk && !last.drunk) log('drunk', p.x, p.z);
    if (last.speed - now.speed > 12 && p.inVeh) log('crash', p.x, p.z); // lost 12 m/s in one frame: hit something hard
  }
  last = now;
}
