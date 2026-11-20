// Crimes to stop. Each one plays out on its own (the crook doesn't wait for you), so you see it from
// down the street and step in: hit them, run them down, chase the car, or hold them at gunpoint.
// Killing a crook still counts as a kill (the wanted system may give you a star for it).
import { provoke, walkers } from '../npc.js';
import { V } from '../vehicles.js';
import { K, pick, rnd, chance, dP, money, fresh, shout, chatter, THANKS, HELP, spot, lane, frontOf, placeNear, storeNear, storefront, person, pose, face, move, goTo, runFrom, free, caught, beaten, live, stopped,
  car, drive, carGone, carStopped, carSide, prop, PROPS, win, fail, fx, W, dropScripted, say } from './kit.js';
import { setProp, roleLook } from '../character.js';
import { dropCash } from '../economy.js';

const BEG = ['Please!', "Don't hurt me!", 'Take it, just take it!', "I don't have much!", 'OK, OK!', 'Please, I have kids!', "Here, it's all I've got!", 'Not again...'];
const RUN = ['Later, sucker!', 'See ya!', 'Ha!', 'Gotta go!', "Can't catch me!", 'Peace out!', 'Too slow!'];
const FIGHT = ['You want some too?!', 'Mind your business!', 'Big mistake, hero!', 'Walk away!', "You're next!", 'Back off!'];
const sedan = () => pick([V.SEDAN, V.HATCH, V.SUV, V.MINIVAN, V.PICKUP, V.SEDAN]);
const nicer = () => pick([V.SPORTS, V.MUSCLE, V.CONVERTIBLE, V.SUV, V.SEDAN]);

// the crook runs for it; out of reach (or after a minute) they got away
function getaway(ev, c, dt, speed = 6.3) {
  ev.x = c.x; ev.z = c.z;
  if (c.mode === 'script') runFrom(c, K.P.x, K.P.z, speed, dt);
  if (dP(c.x, c.z) > 130 || ev.t - ev.run > 60) fail(ev, ev.V.away || 'They got away.');
}
function nab(ev, vic, text, cash = ev.V.cash) {
  win(ev, money(cash * 0.85, cash * 1.15), text);
  if (live(vic) && vic.mode === 'script') { shout(vic, THANKS); pose(vic, { wave: true }, 0); }
}
// armed crooks sometimes turn on you instead of running
function maybeFight(ev, c, odds) { if (dP(c.x, c.z) < 14 && chance(odds)) { provoke(c); shout(c, FIGHT); return true; } return false; }
// the car drives off: stop it before it's gone
function carChase(ev, v, dt, text, cash) {
  ev.x = v.x; ev.z = v.z;
  if (carStopped(ev, v, dt)) { win(ev, money(cash * 0.85, cash * 1.15), text); return; }
  if (carGone(v) || dP(v.x, v.z) > 420 || ev.t > 240) fail(ev, ev.V.away || 'They got away.');
}

export default [
  { // ---------- mugging: knife, gun or bat ----------
    id: 'mugging', theme: 'crime', name: 'Mugging', weight: 1.3, when: (c) => (c.night ? 1.6 : 0.8),
    variants: [
      { pose: { aim: true, weapon: 'gun' }, temper: 'gunman', fight: 0.3, cash: 180, lines: ['Wallet. Now.', 'Empty your pockets!', 'Nobody has to get hurt.', "Don't be a hero.", 'Hands where I can see them!'] },
      { pose: { wmodel: 'knife', point: true }, temper: 'brawler', fight: 0.45, cash: 150, lines: ['Give me the phone.', 'Nice and slow...', 'Watch, wallet, phone. Go!', "Don't make me use this!", 'Keep quiet!'] },
      { pose: { weapon: 'bat', aim: true }, temper: 'brawler', fight: 0.55, cash: 140, lines: ['Pay up, pal.', 'Toll road. Cough it up.', 'Nice shoes. Hand em over.', 'Wallet. Or else.', 'You lost? That costs extra.'] },
      { pose: { aim: true, weapon: 'gun' }, temper: 'gunman', fight: 0.15, cash: 220, mask: 1, lines: ['This is a stickup!', 'Everything. Now!', "Don't look at my face!", 'Move and you regret it!'] },
    ],
    start(ev) {
      const p = spot(); if (!p) return false;
      ev.vic = person(ev, pick(['walk', 'office', 'shopper', 'student', 'elderly']), p.x, p.z, p.h);
      ev.crook = person(ev, 'crook', p.x + Math.sin(p.h) * 1.1, p.z + Math.cos(p.h) * 1.1, p.h + Math.PI, null, ev.V.mask || (chance(0.2) ? 1 : 0));
      ev.crook.temper = ev.V.temper;
      ev.x = p.x; ev.z = p.z; ev.goal = 'Stop the #mugger#.';
      return true;
    },
    update(ev, dt) {
      const { vic: v, crook: c } = ev;
      if (caught(c, dt)) return nab(ev, v, 'You stopped a mugging');
      if (!ev.run) {
        face(c, v.x, v.z, dt); pose(c, ev.V.pose); pose(v, { handsUp: true });
        chatter(c, ev.V.lines, dt, 0.5); chatter(v, BEG, dt, 0.4);
        if (dP(c.x, c.z) < 24 || ev.t > 45) {
          ev.run = ev.t;
          if (!maybeFight(ev, c, ev.V.fight)) { shout(c, RUN); pose(c, {}); free(v, c.x, c.z); shout(v, HELP); }
        }
      } else getaway(ev, c, dt);
    },
  },
  { // ---------- purse / phone snatch on foot ----------
    id: 'snatch', theme: 'crime', name: 'Purse snatcher', weight: 1.2, when: (c) => (c.night ? 0.7 : 1.3),
    variants: [
      { item: 'bag', role: 'shopper', yell: ['My purse!', 'Hey! My bag!', 'He took my purse!', 'Stop! Thief!'], cash: 120, away: 'The purse snatcher got away.' },
      { item: 'phone', role: 'student', yell: ['My phone!', 'Hey! My phone!', 'He grabbed my phone!', 'Give it back!'], cash: 110, away: 'The phone thief got away.' },
      { item: 'bag', role: 'office', yell: ['My laptop!', 'Hey! That has my presentation!', 'My bag! Stop him!', 'Not my laptop!'], cash: 160, away: 'The thief got away with the laptop.' },
      { item: 'coffee', role: 'office', yell: ['MY LATTE?!', 'Did he just take my coffee?!', 'That was a seven dollar coffee!'], cash: 60, away: 'The coffee thief got away. Monster.' },
    ],
    start(ev) {
      const p = spot(); if (!p) return false;
      ev.vic = person(ev, ev.V.role, p.x, p.z, p.h); setProp(ev.vic.ch, ev.V.item);
      ev.crook = person(ev, 'crook', p.x - Math.sin(p.h) * 9, p.z - Math.cos(p.h) * 9, p.h);
      ev.x = p.x; ev.z = p.z; ev.h = p.h; ev.goal = 'Catch the #thief#.';
      return true;
    },
    update(ev, dt) {
      const { vic: v, crook: c } = ev;
      if (caught(c, dt)) { if (live(c)) setProp(c.ch, ev.V.item, false); return nab(ev, v, 'You caught the thief'); }
      if (!ev.grab) { // victim strolls, the crook closes in from behind
        move(v, ev.h, 1.2, dt);
        if (dP(v.x, v.z) < 55 || ev.t > 40) { if (goTo(c, v.x, v.z, 3.2, dt, 0.9) < 1) { ev.grab = true; ev.run = ev.t; setProp(v.ch, ev.V.item, false); setProp(c.ch, ev.V.item, true); shout(v, ev.V.yell); } }
        else move(c, Math.atan2(v.x - c.x, v.z - c.z), 1.3, dt);
      } else {
        if (v.mode === 'script') { if (ev.t - ev.run < 4) goTo(v, c.x, c.z, 3, dt, 2); else { free(v, c.x, c.z); } chatter(v, HELP, dt, 0.8); }
        getaway(ev, c, dt, 6.5);
      }
    },
  },
  { // ---------- snatch and ride off: scooter or motorbike ----------
    id: 'snatchride', theme: 'crime', name: 'Bag snatcher', weight: 0.9,
    variants: [{ ti: V.SCOOTER, cash: 170 }, { ti: V.BIKE, cash: 200 }, { ti: V.SCOOTER, cash: 150, item: 'phone' }],
    start(ev) {
      const p = spot(70, 140); if (!p) return false;
      const along = (k) => ({ x: p.x + Math.sin(p.h) * k, z: p.z + Math.cos(p.h) * k });
      const b = along(6);
      ev.bike = car(ev, ev.V.ti, b.x - p.nx * 2.2, b.z - p.nz * 2.2, p.h);
      ev.vic = person(ev, pick(['shopper', 'walk', 'office']), p.x, p.z, p.h); setProp(ev.vic.ch, ev.V.item || 'bag');
      ev.crook = person(ev, 'crook', b.x, b.z, p.h + Math.PI);
      ev.x = p.x; ev.z = p.z; ev.goal = 'Stop the #thief#.';
      return true;
    },
    update(ev, dt) {
      const { vic: v, crook: c, bike: b } = ev;
      if (ev.rode) return carChase(ev, b, dt, 'You stopped the bag snatcher', ev.V.cash);
      if (caught(c, dt)) return nab(ev, v, 'You caught the bag snatcher');
      if (!ev.grab) {
        pose(c, { phone: true }); face(c, v.x, v.z, dt);
        if (dP(c.x, c.z) < 60 || ev.t > 40) { if (goTo(c, v.x, v.z, 3.5, dt, 0.9) < 1) { ev.grab = true; ev.run = ev.t; setProp(v.ch, ev.V.item || 'bag', false); setProp(c.ch, 'bag', true); shout(v, ['My bag!', 'HEY!', 'Thief!', 'He took my bag!']); } }
      } else if (goTo(c, b.x, b.z, 6.5, dt, 1.2) < 1.3) { // on the bike and gone
        dropScripted(c); b.npcDriver = true;
        if (!drive(b, 60)) return fail(ev, '');
        ev.rode = true; free(v, b.x, b.z);
      }
    },
  },
  { // ---------- carjacking in progress ----------
    id: 'carjack', theme: 'crime', name: 'Carjacking', weight: 1, when: (c) => (c.night ? 1.4 : 0.8),
    variants: [
      { pose: { aim: true, weapon: 'gun' }, lines: ['Out of the car!', 'Keys! Now!', 'Get out! Get out!', 'Move it!'], cash: 260 },
      { pose: { wmodel: 'knife', point: true }, lines: ['Out. Slowly.', 'Leave the keys!', 'Walk away, pal.'], cash: 230 },
      { pose: { aim: true, weapon: 'gun' }, mask: 1, lines: ['This is mine now!', 'Out! Out! Out!', "Don't look at me!"], cash: 300, nice: true },
    ],
    start(ev) {
      const L = lane(70, 150); if (!L) return false;
      ev.v = car(ev, ev.V.nice ? nicer() : sedan(), L.x, L.z, L.h); ev.v.doorOpen = 1;
      const d = carSide(ev.v, 1, 0.6), c = carSide(ev.v, 1, 1.6);
      ev.vic = person(ev, pick(['office', 'walk', 'elderly']), d.x, d.z, L.h - Math.PI / 2);
      ev.crook = person(ev, 'crook', c.x, c.z, L.h + Math.PI / 2, null, ev.V.mask || 0); ev.crook.temper = 'gunman';
      ev.x = L.x; ev.z = L.z; ev.goal = 'Stop the #carjacker#.';
      return true;
    },
    update(ev, dt) {
      const { vic: w, crook: c, v } = ev;
      if (ev.drove) return carChase(ev, v, dt, 'You stopped the carjacker', ev.V.cash);
      if (caught(c, dt)) return nab(ev, w, 'You stopped a carjacking');
      face(c, w.x, w.z, dt); pose(c, ev.V.pose); pose(w, { handsUp: true }); chatter(c, ev.V.lines, dt, 0.6); chatter(w, BEG, dt, 0.4);
      if (!ev.out && (dP(v.x, v.z) < 45 || ev.t > 35)) { ev.out = ev.t; free(w, c.x, c.z); shout(w, ['My car!', 'Somebody stop him!', 'Not my car!', 'Help!']); ev.fought = maybeFight(ev, c, 0.15); }
      if (ev.out && !ev.fought && ev.t - ev.out > 1.5) {
        dropScripted(c); v.npcDriver = true; v.doorOpen = 0;
        if (!drive(v, 60)) return fail(ev, '');
        ev.drove = true; ev.run = ev.t;
      }
    },
  },
  { // ---------- store holdup: a crook bursts out of a corner store with the cash ----------
    id: 'holdup', theme: 'crime', name: 'Store robbery', weight: 0.9, seeR: 75,
    variants: [{ mask: 1, cash: 300 }, { mask: 2, cash: 320 }, { mask: 0, cash: 260 }, { mask: 1, cash: 380, wheels: true }],
    start(ev) {
      const s = storeNear('rob', 80, 220) || storefront(['convenience', 'fuel', 'alcohol', 'supermarket', 'variety_store'], 70, 200, 'corner store'); if (!s) return false;
      ev.crook = person(ev, 'crook', s.doorX ?? s.x, s.doorZ ?? s.z, s.face + Math.PI, null, ev.V.mask);
      setProp(ev.crook.ch, 'bag'); ev.crook.temper = 'gunman';
      ev.vic = person(ev, 'vendor', s.x + Math.cos(s.face) * 1.5, s.z - Math.sin(s.face) * 1.5, s.face + Math.PI);
      if (ev.V.wheels) { const L = lane(0, 30, { x: s.x, z: s.z }); if (L) { ev.v = car(ev, sedan(), L.x, L.z, L.h); ev.v.npcDriver = true; } }
      ev.x = s.x; ev.z = s.z; ev.name = s.name; ev.goal = `Stop the #robber#.`;
      return true;
    },
    update(ev, dt) {
      const { crook: c, vic: w, v } = ev;
      if (ev.drove) return carChase(ev, v, dt, `You stopped the ${ev.name} robbery`, ev.V.cash);
      if (caught(c, dt)) { if (!ev.done) dropCash(c.x, c.z, 60 + Math.floor(Math.random() * 120)); return nab(ev, w, `You stopped the ${ev.name} robbery`); }
      if (ev.st < 0) return; // they burst out once you're around
      if (!ev.run) ev.run = ev.t;
      if (live(w) && w.mode === 'script') { pose(w, { point: true }); face(w, c.x, c.z, dt); chatter(w, ['Stop him! He robbed us!', 'Thief!', 'Somebody call the cops!', 'Get back here!', 'That was the whole till!'], dt, 0.8); }
      if (v && !carGone(v) && v.mode === 'parked') {
        if (goTo(c, v.x, v.z, 6.3, dt, 1.6) < 1.7 && ev.t > 2) { dropScripted(c); if (!drive(v, 60)) return fail(ev, ''); ev.drove = true; }
        ev.x = c.x; ev.z = c.z;
      } else getaway(ev, c, dt, 6.6);
    },
  },
  { // ---------- armored truck robbery: guards vs crooks; stop it, or help yourself to the cash ----------
    id: 'armored', theme: 'crime', name: 'Armored truck robbery', weight: 0.6,
    variants: [{ crooks: 2, cash: 500 }, { crooks: 3, cash: 650 }, { crooks: 3, cash: 700, mask: 2 }],
    start(ev) {
      const f = storefront(['bank', 'department_store', 'supermarket'], 70, 260, 'the bank'); if (!f) return false;
      const q = W.nearestEdge(f.x, f.z, 30); if (!q) return false;
      const h = q.h, kx = f.x - Math.sin(f.face) * 2.6, kz = f.z - Math.cos(f.face) * 2.6;
      ev.v = car(ev, V.VAN, kx, kz, h, 0x5f6b73); ev.v.doorOpen = 1;
      ev.guards = [0, 1].map((i) => { const g = person(ev, 'police', f.x + Math.sin(h) * (i ? 3 : -3), f.z + Math.cos(h) * (i ? 3 : -3), f.face + Math.PI); g.temper = 'gunman'; return g; });
      ev.crooks = [];
      for (let i = 0; i < ev.V.crooks; i++) { const a = (i - 1) * 0.7, c = person(ev, 'crook', f.x + Math.sin(f.face + Math.PI + a) * 8, f.z + Math.cos(f.face + Math.PI + a) * 8, f.face, null, ev.V.mask || 1); c.temper = 'gunman'; ev.crooks.push(c); }
      ev.crooks.forEach((c, i) => { c.enemy = ev.guards[i % 2]; ev.guards[i % 2].enemy = c; }); // gunfire turns them on each other, not on you
      ev.x = f.x; ev.z = f.z; ev.goal = 'Stop the #robbers#. Or take the *cash*.';
      return true;
    },
    update(ev, dt) {
      if (!ev.fight) {
        for (const c of ev.crooks) { const g = ev.guards[ev.crooks.indexOf(c) % 2]; face(c, g.x, g.z, dt); pose(c, { aim: true, weapon: 'gun' }); chatter(c, ['On the ground!', 'Open the truck!', 'Nobody move!', 'Bags! Now!'], dt, 0.5); }
        for (const g of ev.guards) pose(g, { handsUp: true });
        if (dP(ev.x, ev.z) < 45 || ev.t > 50 || ev.crooks.some((c) => c.mode !== 'script')) { // it kicks off
          ev.fight = true;
          ev.crooks.forEach((c, i) => { if (c.mode === 'script') { c.enemy = live(ev.guards[i % 2]) ? ev.guards[i % 2] : null; provoke(c); } });
          ev.guards.forEach((g, i) => { if (g.mode === 'script') { g.enemy = ev.crooks[i % ev.crooks.length]; provoke(g); } });
        }
        return;
      }
      if (!ev.spilled && (ev.crooks.every(beaten) || ev.guards.every(beaten))) { // the back of the truck is open
        ev.spilled = true;
        for (let i = 0; i < 3; i++) dropCash(ev.v.x - Math.sin(ev.v.h) * (3.5 + i * 0.6), ev.v.z - Math.cos(ev.v.h) * (3.5 + i * 0.6), 60 + Math.floor(Math.random() * 90));
      }
      if (dP(ev.x, ev.z) < 60) ev.near = true;
      if (ev.crooks.every(beaten)) return ev.near ? win(ev, money(ev.V.cash * 0.85, ev.V.cash * 1.15), 'You stopped the armored truck robbery') : fail(ev, '');
      if (ev.guards.every(beaten) && dP(ev.x, ev.z) > 150) fail(ev, 'The robbers got the cash.');
      if (ev.t > 200) fail(ev, '');
    },
  },
  { // ---------- motorbike / scooter thief ----------
    id: 'bikethief', theme: 'crime', name: 'Bike thief', weight: 0.8,
    variants: [{ ti: V.BIKE, cash: 160 }, { ti: V.SCOOTER, cash: 120 }, { ti: V.BIKE, cash: 200, owner: true }],
    start(ev) {
      const p = spot(60, 140); if (!p) return false;
      ev.bike = car(ev, ev.V.ti, p.x - p.nx * 2.2, p.z - p.nz * 2.2, p.h);
      ev.crook = person(ev, 'crook', p.x - p.nx * 1.2, p.z - p.nz * 1.2, p.h + Math.PI / 2);
      if (ev.V.owner) ev.vic = person(ev, pick(['office', 'walk']), p.x + Math.sin(p.h) * 25, p.z + Math.cos(p.h) * 25, p.h + Math.PI);
      ev.x = p.x; ev.z = p.z; ev.goal = 'Stop the #bike thief#.';
      return true;
    },
    update(ev, dt) {
      const { crook: c, bike: b, vic: w } = ev;
      if (ev.rode) return carChase(ev, b, dt, 'You stopped the bike thief', ev.V.cash);
      if (caught(c, dt)) return nab(ev, w, 'You caught the bike thief');
      face(c, b.x, b.z, dt); pose(c, { crouch: true, reach: true });
      if (w && live(w) && w.mode === 'script') { if (goTo(w, b.x, b.z, 1.3, dt, 5) < 6) { pose(w, { point: true }); chatter(w, ['Hey! That\'s my bike!', 'Get away from my bike!', 'Thief!'], dt, 1); } }
      if (ev.t > 12 && (dP(c.x, c.z) < 30 || ev.t > 40)) { dropScripted(c); b.npcDriver = true; if (!drive(b, 60)) return fail(ev, ''); ev.rode = true; }
    },
  },
  { // ---------- drunk driver weaving down the street ----------
    id: 'drunkdriver', theme: 'crime', name: 'Drunk driver', weight: 0.8, when: (c) => (c.hour > 20 || c.hour < 4 ? 2 : 0.25), seeR: 70,
    variants: [{ ti: V.PICKUP, cash: 200 }, { ti: V.SEDAN, cash: 180 }, { ti: V.LIMO, cash: 260 }, { ti: V.MUSCLE, cash: 220 }],
    start(ev) {
      const L = lane(100, 180); if (!L) return false;
      ev.v = car(ev, ev.V.ti, L.x, L.z, L.h); ev.v.npcDriver = true;
      if (!drive(ev.v, 0, true)) return false;
      ev.x = L.x; ev.z = L.z; ev.goal = 'Stop the #drunk driver#.';
      return true;
    },
    update(ev, dt) {
      const v = ev.v;
      if (v.ag) { v.ag.drunk = true; v.ag.panicT = 0; v.ag.temper = 1.35; if (Math.random() < dt * 0.25) fx.soundHorn(dP(v.x, v.z)); }
      ev.x = v.x; ev.z = v.z;
      ev.stillT = v.mode !== 'traffic' && Math.abs(v.speed || 0) < 1.5 ? (ev.stillT || 0) + dt : 0;
      if (v.exploded || v.hp <= 0 || v === K.P.veh || ev.stillT > 1.6) return win(ev, money(ev.V.cash * 0.9, ev.V.cash * 1.1), 'You took a drunk driver off the road');
      if (carGone(v) || dP(v.x, v.z) > 420 || ev.t > 240) fail(ev, ev.seen ? 'The drunk driver got away.' : '');
    },
  },
  { // ---------- graffiti tagger ----------
    id: 'tagger', theme: 'crime', name: 'Graffiti tagger', weight: 0.8, when: (c) => (c.night ? 1.6 : 0.6),
    variants: [{ cash: 90, lines: ['Art is not a crime!', 'Banksy who?', 'Masterpiece...', "One more letter..."] }, { cash: 110, lines: ['TIM ARNETT WAS HERE', 'Signing my work...', 'Hold still, wall.'] }, { cash: 80, lines: ['Tagging for the culture!', "Don't tell my mom.", 'This wall needed color.'] }],
    start(ev) {
      for (let i = 0; i < 6; i++) {
        const p = spot(60, 140); if (!p) return false;
        const t = W.rayBuildings(p.x, W.groundHeight(p.x, p.z) + 1, p.z, p.nx, 0, p.nz, 8);
        if (t > 7.5) continue;
        const x = p.x + p.nx * (t - 0.7), z = p.z + p.nz * (t - 0.7);
        ev.crook = person(ev, 'crook', x, z, Math.atan2(p.nx, p.nz), null, chance(0.4) ? 1 : 0);
        ev.wall = { x: x + p.nx * 0.6, z: z + p.nz * 0.6 };
        ev.x = x; ev.z = z; ev.goal = 'Catch the #tagger#.';
        return true;
      }
      return false;
    },
    update(ev, dt) {
      const c = ev.crook;
      if (caught(c, dt)) return win(ev, money(ev.V.cash * 0.8, ev.V.cash * 1.2), 'You caught a graffiti tagger');
      if (!ev.run) {
        pose(c, { reach: true }); chatter(c, ev.V.lines, dt, 0.25);
        if (Math.random() < dt * 3) fx.smokePuff(ev.wall.x + (Math.random() - 0.5) * 0.6, W.groundHeight(ev.x, ev.z) + 1.5, ev.wall.z, true, 0.25);
        if (dP(c.x, c.z) < 18 || ev.t > 70) { ev.run = ev.t; shout(c, ['Cheese it!', 'Run!', 'Oh no, the fuzz!', 'Abort!']); }
      } else getaway(ev, c, dt, 6.8);
    },
  },
  { // ---------- ATM skimmer ----------
    id: 'skimmer', theme: 'crime', name: 'ATM skimmer', weight: 0.6,
    variants: [{ cash: 160 }, { cash: 200, mask: 1 }],
    start(ev) {
      const f = storefront(['bank', 'convenience', 'fuel', 'supermarket'], 60, 220, 'the ATM'); if (!f) return false;
      const ax = f.doorX + Math.cos(f.face) * 1.6, az = f.doorZ - Math.sin(f.face) * 1.6;
      prop(ev, PROPS.atm, ax, az, f.face + Math.PI);
      ev.crook = person(ev, 'crook', ax - Math.sin(f.face) * 0.9, az - Math.cos(f.face) * 0.9, f.face, null, ev.V.mask || 0);
      ev.x = ax; ev.z = az; ev.goal = 'Stop the #ATM skimmer#.';
      return true;
    },
    update(ev, dt) {
      const c = ev.crook;
      if (caught(c, dt)) return win(ev, money(ev.V.cash * 0.85, ev.V.cash * 1.15), 'You busted an ATM skimmer');
      if (!ev.run) { pose(c, { reach: true }); if (Math.random() < dt * 0.3) { c.h += (Math.random() - 0.5) * 1.6; } if (dP(c.x, c.z) < 14 || ev.t > 75) { ev.run = ev.t; shout(c, ['Nothing to see here!', 'Uh... bye!', 'Wrong ATM!']); } }
      else getaway(ev, c, dt);
    },
  },
  { // ---------- vandal smashing a parked car ----------
    id: 'vandal', theme: 'crime', name: 'Vandal', weight: 0.8,
    variants: [{ w: 'bat', cash: 140, lines: ['Take that!', 'Cheated on me, huh?!', "That's for parking in my spot!", 'Nice car. WAS.'] }, { w: 'crowbar', cash: 150, lines: ['Hope you have insurance!', 'Ha!', 'Smash!', 'This is for the dent you left!'] }],
    start(ev) {
      const cars = K.ctx.vehicles().filter((v) => v.mode === 'parked' && !v.T.bike && !v.T.boat && !v.T.heli && dP(v.x, v.z) > 55 && dP(v.x, v.z) < 140);
      const v = pick(cars); if (!v) return false;
      const s = carSide(v, chance(0.5) ? 1 : -1, 0.9);
      ev.crook = person(ev, 'crook', s.x, s.z, Math.atan2(v.x - s.x, v.z - s.z)); ev.crook.temper = 'brawler';
      ev.v = v; ev.x = v.x; ev.z = v.z; ev.goal = 'Stop the #vandal#.';
      return true;
    },
    update(ev, dt) {
      const c = ev.crook, v = ev.v;
      if (caught(c, dt)) return win(ev, money(ev.V.cash * 0.85, ev.V.cash * 1.15), 'You stopped a vandal');
      if (!ev.run) {
        ev.sw = ((ev.sw || 0) + dt * 1.3) % 1;
        face(c, v.x, v.z, dt); pose(c, { weapon: 'bat', wmodel: ev.V.w, swing: ev.sw });
        if (ev.sw < dt * 1.3 && dP(v.x, v.z) < 150) { fx.glass(v.x, v.y + 1.1, v.z, 6); fx.soundCrunch(0.4, dP(v.x, v.z)); if (!ev.alarm) { ev.alarm = true; K.ctx.alarm(v); } }
        chatter(c, ev.V.lines, dt, 0.4);
        if (dP(c.x, c.z) < 16 || ev.t > 60) { ev.run = ev.t; if (!maybeFight(ev, c, 0.4)) shout(c, RUN); }
      } else getaway(ev, c, dt);
    },
  },
  { // ---------- dognapper ----------
    id: 'dognapper', theme: 'crime', name: 'Dognapper', weight: 0.7, when: (c) => (c.night ? 0.3 : 1.2),
    variants: [{ name: 'Biscuit', cash: 170 }, { name: 'Sir Barksalot', cash: 190 }, { name: 'Princess', cash: 160 }, { name: 'Tater Tot', cash: 180 }, { name: 'Chief', cash: 170 }],
    start(ev) {
      const p = spot(60, 130); if (!p) return false;
      ev.vic = person(ev, pick(['walk', 'elderly', 'jogger', 'office']), p.x, p.z, p.h);
      ev.crook = person(ev, 'dog', p.x + Math.sin(p.h) * 5, p.z + Math.cos(p.h) * 5, p.h, roleLook('crook'));
      ev.x = p.x; ev.z = p.z; ev.h = p.h; ev.goal = `Get @${ev.V.name}@ back from the #dognapper#.`;
      return true;
    },
    update(ev, dt) {
      const { vic: v, crook: c } = ev;
      if (caught(c, dt)) return nab(ev, v, `You got ${ev.V.name} back`);
      if (live(v) && v.mode === 'script') { const d = goTo(v, c.x, c.z, 2.6, dt, 4); if (d < 5) pose(v, { point: true }); chatter(v, [`${ev.V.name}!`, 'He took my dog!', `Come back, ${ev.V.name}!`, 'Dognapper!', 'Somebody stop him!'], dt, 0.7); }
      if (!ev.run) { move(c, ev.h, 2.4, dt); ev.x = c.x; ev.z = c.z; if (dP(c.x, c.z) < 25 || ev.t > 50) { ev.run = ev.t; shout(c, ["He's mine now!", 'Good boy... RUN!', 'Finders keepers!']); } }
      else getaway(ev, c, dt, 5.8);
    },
  },
  { // ---------- gang shakedown of a shopkeeper ----------
    id: 'shakedown', theme: 'crime', name: 'Shakedown', weight: 0.7, when: (c) => (c.night ? 1.3 : 0.8),
    variants: [{ n: 2, cash: 260 }, { n: 3, cash: 340 }, { n: 3, cash: 380, gun: true }],
    start(ev) {
      const f = storefront(['convenience', 'restaurant', 'fast_food', 'hairdresser', 'variety_store', 'laundry', 'tobacco'], 60, 220, pick(['the laundromat', 'the barber shop', 'the corner store', 'the taco shop', 'the pawn shop'])); if (!f) return false;
      ev.vic = person(ev, 'vendor', f.doorX - Math.sin(f.face) * 0.6, f.doorZ - Math.cos(f.face) * 0.6, f.face + Math.PI);
      ev.crooks = [];
      for (let i = 0; i < ev.V.n; i++) { const a = f.face + Math.PI + (i - (ev.V.n - 1) / 2) * 0.8, c = person(ev, 'crook', ev.vic.x + Math.sin(a) * 2, ev.vic.z + Math.cos(a) * 2, a + Math.PI); c.temper = ev.V.gun && i === 0 ? 'gunman' : 'brawler'; ev.crooks.push(c); }
      ev.x = f.x; ev.z = f.z; ev.name = f.name; ev.goal = `Run the #thugs# off from ${f.name}.`;
      return true;
    },
    update(ev, dt) {
      const w = ev.vic;
      if (ev.crooks.every(beaten)) { if (live(w) && w.mode === 'script') { shout(w, THANKS); pose(w, { wave: true }); } return win(ev, money(ev.V.cash * 0.85, ev.V.cash * 1.15), `You ran the thugs off from ${ev.name}`); }
      if (!ev.fight) {
        pose(w, { beg: ev.t % 10 > 6 });
        ev.crooks.forEach((c, i) => { face(c, w.x, w.z, dt); pose(c, i % 2 ? { point: true } : { chat: true }); chatter(c, ['Nice shop you got here.', 'Shame if something happened to it.', 'Protection money. Weekly.', "You're late, pal.", 'We look after this block.', 'Pay up or close up.'], dt, 0.15); });
        if (dP(ev.x, ev.z) < 14 || ev.crooks.some((c) => c.mode !== 'script')) { ev.fight = true; for (const c of ev.crooks) if (c.mode === 'script') provoke(c); shout(ev.crooks[0], FIGHT); }
      }
      if (ev.t > 150 && dP(ev.x, ev.z) > 100) fail(ev, '');
    },
  },
  { // ---------- getaway car: a car tears off from a robbery ----------
    id: 'getaway', theme: 'crime', name: 'Getaway car', weight: 0.8, seeR: 80,
    variants: [{ ti: V.SEDAN, cash: 350, what: 'bank robbers' }, { ti: V.MUSCLE, cash: 380, what: 'jewel thieves' }, { ti: V.VAN, cash: 330, what: 'burglars' }, { ti: V.SUV, cash: 360, what: 'robbers' }],
    start(ev) {
      const L = lane(90, 170); if (!L) return false;
      ev.v = car(ev, ev.V.ti, L.x, L.z, L.h, pick([0x1c1d20, 0x4a4f55, 0x8e1c1c, 0xf2f2f0])); ev.v.npcDriver = true;
      if (!drive(ev.v, 300)) return false;
      ev.x = L.x; ev.z = L.z; ev.goal = `Stop the #getaway car#.`;
      return true;
    },
    update(ev, dt) {
      const v = ev.v;
      if (Math.random() < dt * 0.4 && dP(v.x, v.z) < 120) fx.soundSqueal(dP(v.x, v.z));
      ev.x = v.x; ev.z = v.z;
      if (carStopped(ev, v, dt)) { dropCash(v.x + 2, v.z, 80 + Math.floor(Math.random() * 150)); return win(ev, money(ev.V.cash * 0.85, ev.V.cash * 1.15), `You stopped the ${ev.V.what}`); }
      if (carGone(v) || dP(v.x, v.z) > 420 || ev.t > 200) fail(ev, ev.seen ? `The ${ev.V.what} got away.` : '');
    },
  },
  { // ---------- someone breaking into a parked car ----------
    id: 'breakin', theme: 'crime', name: 'Car thief', weight: 1,
    variants: [{ cash: 150 }, { cash: 170, mask: 1 }, { cash: 140, crowbar: true }],
    start(ev) {
      const cars = K.ctx.vehicles().filter((v) => v.mode === 'parked' && !v.T.bike && !v.T.boat && !v.T.heli && dP(v.x, v.z) > 50 && dP(v.x, v.z) < 130);
      const v = pick(cars); if (!v) return false;
      const d = carSide(v, 1, 0.6);
      ev.crook = person(ev, 'crook', d.x, d.z, v.h - Math.PI / 2, null, ev.V.mask || 0);
      ev.v = v; ev.x = v.x; ev.z = v.z; ev.goal = 'Stop the #car thief#.';
      return true;
    },
    update(ev, dt) {
      const c = ev.crook, v = ev.v;
      if (ev.drove) return carChase(ev, v, dt, 'You stopped a car thief', ev.V.cash);
      if (caught(c, dt)) return win(ev, money(ev.V.cash * 0.85, ev.V.cash * 1.15), 'You stopped a car thief');
      if (v.mode !== 'parked') { dropScripted(c); return fail(ev, ''); } // someone (you) took it first
      pose(c, ev.V.crowbar ? { reach: true, wmodel: 'crowbar' } : { reach: true }); c.h = v.h - Math.PI / 2;
      if (ev.t > 3 && !ev.alarm) { ev.alarm = true; K.ctx.alarm(v); }
      if (ev.t > 14) { dropScripted(c); v.npcDriver = true; if (!drive(v, 60)) return fail(ev, ''); ev.drove = true; }
    },
  },
];
