// Chaos and funny stuff: a car on fire, runaway carts, a loose dog, a drunk picking fights, a flash
// mob, dueling street preachers, a Tim Arnett rally, the ice cream truck, a food fight, a breakup,
// a mascot mobbed by fans, an escaped farm animal, someone stranded on a car roof, a fender-bender.
// Each has something to do (step in, catch it, break it up) and a small reward for doing it.
import { provoke } from '../npc.js';
import { V, damageZone } from '../vehicles.js';
import { setProp } from '../character.js';
import { K, pick, rnd, chance, dP, money, fresh, shout, chatter, THANKS, spot, lane, placeNear, storefront, person, pose, face, move, goTo, runFrom, live, beaten, stopped,
  car, drive, carSide, prop, PROPS, critter, stepCritter, stay, passerBy, mission, timer, win, fail, text, jingle, fx, W, say } from './kit.js';

// an open patch of ground near p (a plaza, a lawn) for crowds; p itself if nothing better
function plaza(p, r = 3.5) {
  for (let i = 0; i < 10; i++) { const a = Math.random() * 6.28, d = 4 + Math.random() * 10, x = p.x + p.nx * d * 0.6 + Math.cos(a) * d * 0.5, z = p.z + p.nz * d * 0.6 + Math.sin(a) * d * 0.5; if (W.isLand(x, z) && !W.pushOutCircle(x, z, r).hit) return { x, z }; }
  return { x: p.x, z: p.z };
}
const ring = (ev, n, cx, cz, r, role, look = null, mask = 0) => Array.from({ length: n }, (_, i) => { const a = (i / n) * 6.28, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; return person(ev, role, x, z, Math.atan2(cx - x, cz - z), look, mask); });
const leave = (w) => { if (w) w.leaveNow = true; };
const sedan = () => pick([V.SEDAN, V.HATCH, V.SUV, V.MINIVAN, V.PICKUP]);

// runaway things rolling down the street (shopping carts, vendor carts): catch it before it's gone
function runaway(id, name, weight, variants) {
  return {
    id, theme: 'chaos', name, weight, variants,
    start(ev) {
      const p = spot(60, 140); if (!p) return false;
      // roll downhill along the street
      const fwd = W.groundHeight(p.x + Math.sin(p.h) * 12, p.z + Math.cos(p.h) * 12) < W.groundHeight(p.x - Math.sin(p.h) * 12, p.z - Math.cos(p.h) * 12);
      const h = p.h + (fwd ? 0 : Math.PI);
      ev.c = { g: prop(ev, PROPS[ev.V.p], p.x, p.z, h), x: p.x, z: p.z, h, v: 1.5 };
      ev.owner = person(ev, ev.V.owner, p.x - Math.sin(h) * 7, p.z - Math.cos(h) * 7, h);
      ev.x = p.x; ev.z = p.z; ev.goal = `Stop the runaway *${ev.V.what}*.`;
      return true;
    },
    update(ev, dt) {
      const c = ev.c, o = ev.owner;
      if (ev.st < 0 && ev.t < 60) { // waits at the top of the hill until you're around
        if (live(o)) { goTo(o, c.x - Math.sin(c.h) * 1.2, c.z - Math.cos(c.h) * 1.2, 1.3, dt, 0.8); pose(o, {}); }
        return;
      }
      c.v = Math.min(ev.V.max || 6.5, c.v + dt * 0.9);
      const p = W.pushOutCircle(c.x + Math.sin(c.h) * c.v * dt, c.z + Math.cos(c.h) * c.v * dt, 0.6);
      if (p.hit || !W.isLand(p.x, p.z)) { c.h += (Math.random() < 0.5 ? 1 : -1) * (0.6 + Math.random()); c.v *= 0.5; fx.sparks(c.x, W.groundHeight(c.x, c.z) + 0.4, c.z, 6); fx.soundCrunch(0.25, dP(c.x, c.z)); }
      else { c.x = p.x; c.z = p.z; }
      c.g.position.set(c.x, W.groundHeight(c.x, c.z), c.z); c.g.rotation.y = c.h; c.g.rotation.z = Math.sin(ev.t * 9) * 0.04;
      ev.x = c.x; ev.z = c.z;
      if (live(o) && o.mode === 'script') { goTo(o, c.x, c.z, 3.6, dt, 1); chatter(o, ev.V.lines, dt, 0.7); }
      const d = dP(c.x, c.z);
      if ((K.P.foot && d < 1.7) || (K.P.veh && d < 3.4)) {
        if (live(o)) shout(o, THANKS);
        return win(ev, money(ev.V.cash * 0.8, ev.V.cash * 1.2), `You stopped the runaway ${ev.V.what}`);
      }
      if (ev.st > 40) { c.g.rotation.z = 1.4; fx.sparks(c.x, W.groundHeight(c.x, c.z) + 0.3, c.z, 12); fx.soundCrunch(0.6, d); fail(ev, `The ${ev.V.what} got away. Crunch.`); }
    },
  };
}

export default [
  { // ---------- car on fire with the driver stuck inside ----------
    id: 'carfire', theme: 'chaos', name: 'Car fire', weight: 0.8,
    variants: [{ secs: 22, cash: 240 }, { secs: 18, cash: 280 }, { secs: 26, cash: 220, ti: V.MINIVAN }, { secs: 20, cash: 260, ti: V.TAXI }],
    start(ev) {
      const L = lane(70, 150); if (!L) return false;
      const v = (ev.v = car(ev, ev.V.ti ?? sedan(), L.kx ?? L.x, L.kz ?? L.z, L.h));
      v.npcDriver = true; v.hp = -v.T.hp * 0.2; v.burnAt = K.ctx.now(); v.burnBy = '';
      const s = carSide(v, -1, 4.5);
      ev.by = person(ev, pick(['walk', 'office', 'jogger']), s.x, s.z, Math.atan2(v.x - s.x, v.z - s.z));
      ev.x = v.x; ev.z = v.z; ev.goal = 'Pull the @driver@ out of the burning car.';
      return true;
    },
    update(ev, dt) {
      const v = ev.v;
      if (!v.burnAt || v.exploded) return fail(ev, v.exploded ? 'The car went up in flames.' : ''); // the fire crew beat you to it
      v.burnAt = K.ctx.now(); // keeps burning until we say so
      if (live(ev.by)) { face(ev.by, v.x, v.z, dt); pose(ev.by, { point: true }); chatter(ev.by, ["He's stuck in there!", 'Somebody get him out!', 'The door is jammed!', 'Call 911!', "It's gonna blow!"], dt, 0.6); }
      if (Math.random() < dt * 0.6 && dP(v.x, v.z) < 90) say(v.yeller || (v.yeller = { ch: { g: v.mesh } }), fresh(['Help! HELP!', "I can't get out!", 'Get me out of here!', "My seatbelt's stuck!"]));
      if (ev.st < 0) return;
      const left = ev.V.secs - ev.st;
      timer(ev, left);
      const d = carSide(v, 1, 0.8);
      if (stay(ev, d.x, d.z, 2.6, 1.0, dt)) { // yanked out
        v.npcDriver = false; v.doorOpen = 1;
        const w = person(ev, 'walk', d.x, d.z, v.h + Math.PI / 2); w.limp = 20; shout(w, ['*cough* Thank you!', 'You saved my life!', 'I owe you everything!', '*cough cough*']);
        leave(w);
        return win(ev, money(ev.V.cash * 0.85, ev.V.cash * 1.15), 'You pulled a driver from a burning car', 'HERO');
      }
      if (left <= 0) { v.burnAt = K.ctx.now() - 15200; v.npcDriver = false; fail(ev, 'The car went up in flames.'); }
    },
  },
  runaway('cart', 'Runaway cart', 0.8, [
    { p: 'cart', what: 'shopping cart', owner: 'shopper', cash: 60, lines: ['My groceries!', 'Stop that cart!', 'My eggs are in there!', 'Somebody grab it!', 'NOT THE WINE!'] },
    { p: 'bin', what: 'trash can', owner: 'worker', cash: 40, lines: ["It's trash day!", 'Come back, trash!', 'Somebody stop the bin!', 'That bin is city property!'] },
    { p: 'chair', what: 'office chair', owner: 'office', cash: 70, lines: ['My chair!', 'That chair was ergonomic!', 'Stop that chair!', 'I was just moving offices!'] },
  ]),
  runaway('vendorcart', 'Runaway vendor cart', 0.7, [
    { p: 'hotdog', what: 'hot dog cart', owner: 'vendor', cash: 90, max: 5.5, lines: ['My hot dogs!', 'My livelihood!', 'Stop that cart!', 'Free hot dogs if you stop it!', "There's relish everywhere!"] },
    { p: 'coffee', what: 'coffee cart', owner: 'vendor', cash: 80, max: 5.5, lines: ['My espresso machine!', 'Stop the coffee!', "That's a $4000 grinder!", 'Oat milk everywhere!'] },
    { p: 'pretzel', what: 'pretzel cart', owner: 'vendor', cash: 75, max: 5.5, lines: ['My pretzels!', 'Come back, pretzels!', 'Somebody stop it!', 'Salted, rolling, gone!'] },
  ]),
  { // ---------- loose dog chasing someone ----------
    id: 'loosedog', theme: 'chaos', name: 'Loose dog', weight: 0.9, when: (c) => (c.night ? 0.3 : 1.2),
    variants: [{ name: 'Biscuit', cash: 80 }, { name: 'Tank', cash: 100 }, { name: 'Noodle', cash: 70 }, { name: 'Bandit', cash: 90 }, { name: 'Mr. Fluffington', cash: 110 }],
    start(ev) {
      const p = spot(60, 140); if (!p) return false;
      ev.vic = person(ev, 'dog', p.x, p.z, p.h); // a 'dog' walker's dog runs right behind them: the dog chasing its target
      ev.owner = person(ev, pick(['walk', 'elderly', 'office']), p.x - Math.sin(p.h) * 14, p.z - Math.cos(p.h) * 14, p.h);
      ev.h = p.h; ev.x = p.x; ev.z = p.z; ev.goal = `Catch the loose dog, @${ev.V.name}@.`;
      return true;
    },
    update(ev, dt) {
      const { vic: v, owner: o } = ev;
      if (!live(v) || v.mode !== 'script') return fail(ev, '');
      ev.h += Math.sin(ev.t * 0.9) * dt * 1.4;
      ev.h = move(v, ev.h, ev.st < 0 ? 2.2 : 4.4, dt); pose(v, ev.st < 0 ? {} : { scared: true }); chatter(v, ['AAAH!', 'Get it off me!', 'Nice doggy! NICE DOGGY!', 'Whose dog is this?!', 'It wants my sandwich!', 'Help!'], dt, 0.9);
      if (live(o) && o.mode === 'script') { goTo(o, v.x, v.z, 3.4, dt, 3); chatter(o, [`${ev.V.name}! Heel!`, `${ev.V.name}, NO!`, 'He just wants to play!', 'Somebody grab his collar!', "He's friendly! Mostly!"], dt, 0.6); }
      ev.x = v.x; ev.z = v.z;
      if (stay(ev, v.x - Math.sin(v.h) * 1.1, v.z - Math.cos(v.h) * 1.1, 2.6, 0.4, dt, false)) { pose(v, {}, 0); shout(v, THANKS); if (live(o)) shout(o, [`Good boy, ${ev.V.name}...`, 'Thank you! Bad dog!', 'Sorry about that!']); return win(ev, money(ev.V.cash * 0.8, ev.V.cash * 1.2), `You caught ${ev.V.name}`); }
      if (ev.st > 55) fail(ev, `${ev.V.name} ran off.`);
    },
  },
  { // ---------- drunk picking fights ----------
    id: 'drunkguy', theme: 'chaos', name: 'Drunk', weight: 0.9, when: (c) => (c.hour > 19 || c.hour < 4 ? 2 : 0.35),
    variants: [
      { cash: 90, lines: ['You lookin at me?!', 'I can take ALL of you!', "I'm not drunk, YOU'RE drunk!", 'Who wants some?!', 'I used to box, ya know!'] },
      { cash: 80, lines: ['I love you, man.', 'Wait... where is my car?', "Let's FIGHT. Then hug.", 'I was a quarterback!', 'This town is MINE!'] },
      { cash: 100, lines: ['Hawkeyes rule! Fight me!', 'One more round!', 'My wife left me for a Cyclone fan!', 'Hold my drink.'] },
    ],
    start(ev) {
      const p = spot(60, 140); if (!p) return false;
      ev.d = person(ev, 'bar', p.x, p.z, p.h); ev.d.temper = 'brawler'; setProp(ev.d.ch, 'coffee');
      ev.h = p.h; ev.x = p.x; ev.z = p.z; ev.goal = 'Calm down the #drunk#.';
      return true;
    },
    update(ev, dt) {
      const d = ev.d;
      if (ev.fight && beaten(d)) return ev.near ? win(ev, money(ev.V.cash * 0.8, ev.V.cash * 1.2), 'You calmed down a drunk') : fail(ev, '');
      if (dP(d.x, d.z) < 20) ev.near = true;
      if (!ev.fight) {
        if (d.mode !== 'script') { ev.fight = true; return; } // you hit him first
        ev.h += Math.sin(ev.t * 1.7) * dt * 1.6;
        ev.h = move(d, ev.h, 0.9, dt); pose(d, { drink: true, limp: true }); chatter(d, ev.V.lines, dt, 0.45);
        ev.x = d.x; ev.z = d.z;
        if (dP(d.x, d.z) < 5) { ev.fight = true; setProp(d.ch, 'coffee', false); provoke(d); }
        else if (ev.st > 6 && Math.random() < dt * 0.3) { const t = passerBy(d.x, d.z, 18); if (t) { ev.fight = true; d.enemy = t; setProp(d.ch, 'coffee', false); shout(d, ev.V.lines); provoke(d); } }
      }
      if (ev.t > 160) fail(ev, '');
    },
  },
  { // ---------- flash mob ----------
    id: 'flashmob', theme: 'chaos', name: 'Flash mob', weight: 0.7, when: (c) => (c.night || c.rain ? 0.3 : 1.2),
    variants: [{ n: 6, cash: 70 }, { n: 8, cash: 90 }, { n: 10, cash: 120 }, { n: 8, cash: 100, mask: 2 }],
    start(ev) {
      const p = spot(70, 150); if (!p) return false;
      const c = plaza(p, 4); ev.cx = c.x; ev.cz = c.z;
      ev.crew = ring(ev, ev.V.n, c.x, c.z, 3.4, pick(['walk', 'student', 'office']), null, ev.V.mask || 0);
      ev.x = c.x; ev.z = c.z; ev.goal = 'Join the *flash mob*.';
      return true;
    },
    update(ev, dt) {
      const go = ev.st > 2;
      ev.crew.forEach((w, i) => { pose(w, go ? { dance: true } : i % 2 ? { phone: true } : { text: true }); if (go) chatter(w, ['Everybody now!', 'Five, six, seven, eight!', 'Woo!', 'Davenport, DANCE!', 'Join in!', 'Feel it!'], dt, 0.08); });
      if (go && stay(ev, ev.cx, ev.cz, 7, 6, dt)) { ev.crew.forEach((w) => pose(w, { clap: true })); return win(ev, money(ev.V.cash * 0.8, ev.V.cash * 1.2), 'The flash mob crowd threw you tips', 'SICK MOVES'); }
      if (ev.st > 55) { ev.crew.forEach(leave); fail(ev, 'The flash mob broke up.'); }
    },
  },
  { // ---------- two street preachers face off ----------
    id: 'preachers', theme: 'chaos', name: 'Preacher face-off', weight: 0.6, when: (c) => (c.night ? 0.2 : 1),
    variants: [
      { a: ['The end is near!', 'Repent!', 'The river will rise!', 'Turn back from sin!'], b: ['The end is NOT near!', 'Relax, people!', 'Everything is fine!', 'Have a sandwich!'], cash: 60 },
      { a: ['Corn is life!', 'Bless the harvest!', 'Iowa is the promised land!'], b: ['Soybeans are the future!', 'Corn is a lie!', 'Rotate your crops, sinners!'], cash: 70 },
      { a: ['Mayor Tim sees all!', 'Tim Arnett is the way!', 'All hail the mayor!'], b: ['Tim Arnett is a lizard!', 'Wake up, Davenport!', 'The mayor is three raccoons in a suit!'], cash: 80 },
      { a: ['Hawkeyes forever!', 'Black and gold, brothers!', 'Kinnick is holy ground!'], b: ['Go Cyclones!', 'Cardinal and gold!', 'Ames will rise!'], cash: 70 },
    ],
    start(ev) {
      const p = spot(60, 140); if (!p) return false;
      const ax = Math.sin(p.h) * 3, az = Math.cos(p.h) * 3;
      ev.A = person(ev, 'preacher', p.x - ax, p.z - az, p.h); ev.B = person(ev, 'preacher', p.x + ax, p.z + az, p.h + Math.PI);
      ev.fa = [0, 1].map((i) => person(ev, 'walk', p.x - ax * (1.8 + i * 0.4) + p.nx * (i ? 1 : -1), p.z - az * (1.8 + i * 0.4) + p.nz * (i ? 1 : -1), p.h));
      ev.fb = [0, 1].map((i) => person(ev, 'walk', p.x + ax * (1.8 + i * 0.4) + p.nx * (i ? 1 : -1), p.z + az * (1.8 + i * 0.4) + p.nz * (i ? 1 : -1), p.h + Math.PI));
      ev.x = p.x; ev.z = p.z; ev.goal = 'Pick a *side*.';
      return true;
    },
    update(ev, dt) {
      const { A, B } = ev;
      face(A, B.x, B.z, dt); face(B, A.x, A.z, dt); pose(A, { preach: true }); pose(B, { preach: true });
      chatter(A, ev.V.a, dt, 0.4); chatter(B, ev.V.b, dt, 0.4);
      for (const w of [...ev.fa, ...ev.fb]) pose(w, { handsUp: Math.sin(ev.t * 2 + w.x) > 0.8 });
      if (!live(A) || !live(B) || A.mode !== 'script' || B.mode !== 'script') return fail(ev, '');
      for (const [me, them, mine, theirs] of [[A, B, ev.fa, ev.fb], [B, A, ev.fb, ev.fa]]) {
        if (dP(me.x, me.z) < 2.6 && stay(ev, me.x, me.z, 2.6, 2, dt)) {
          mine.forEach((w) => pose(w, { clap: true })); shout(me, ['A believer!', 'You see the truth!', 'Bless you, friend!', 'Victory!']);
          shout(them, ['Fine! I know when I am beat.', 'This is not over!', 'Hmph!', 'You will regret this!']); leave(them); theirs.forEach(leave);
          return win(ev, money(ev.V.cash * 0.8, ev.V.cash * 1.2), 'You settled the preacher face-off', 'DONATION');
        }
      }
      if (ev.st > 80) fail(ev, '');
    },
  },
  { // ---------- Tim Arnett campaign rally, with protesters ----------
    id: 'rally', theme: 'chaos', name: 'Tim Arnett rally', weight: 0.7, when: (c) => (c.night ? 0.2 : c.district === 'downtown' ? 1.8 : 0.8),
    variants: [{ n: 4, m: 3, cash: 150 }, { n: 6, m: 3, cash: 180 }, { n: 5, m: 4, cash: 200 }],
    start(ev) {
      const p = spot(70, 150); if (!p) return false;
      const c = plaza(p, 4), ax = Math.sin(p.h), az = Math.cos(p.h);
      ev.tim = person(ev, 'preacher', c.x, c.z, Math.atan2(p.nx, p.nz) + Math.PI, null, 2);
      ev.fans = Array.from({ length: ev.V.n }, (_, i) => { const w = person(ev, 'protest', c.x + ax * (i - ev.V.n / 2) * 1.1 - p.nx * 3, c.z + az * (i - ev.V.n / 2) * 1.1 - p.nz * 3, Math.atan2(p.nx, p.nz), null, i % 2 ? 2 : 0); setProp(w.ch, 'sign'); return w; });
      ev.foes = Array.from({ length: ev.V.m }, (_, i) => { const w = person(ev, 'protest', c.x + ax * (i - ev.V.m / 2 + 6) * 1.1 - p.nx * 2, c.z + az * (i - ev.V.m / 2 + 6) * 1.1 - p.nz * 2, Math.atan2(p.nx, p.nz)); setProp(w.ch, 'sign'); w.temper = 'brawler'; return w; });
      ev.fans[0].temper = 'brawler';
      ev.x = c.x; ev.z = c.z; ev.goal = 'Tim Arnett is holding a *rally*.';
      return true;
    },
    update(ev, dt) {
      const { tim, fans, foes } = ev;
      pose(tim, { preach: true }); chatter(tim, ['Davenport deserves better!', "I'll fix the potholes. Eventually.", 'A bridge for every family!', 'Vote Tim, vote often!', 'Four more years!', 'Make Davenport Arnett again!'], dt, 0.35);
      fans.forEach((w, i) => { if (!(ev.scuffle && i === 0)) { pose(w, { sign: true }); chatter(w, ['Tim! Tim! Tim!', 'Four more years!', 'Arnett for mayor!', 'We love you, Tim!'], dt, 0.1); } });
      foes.forEach((w, i) => { if (!(ev.scuffle && i === 0)) { pose(w, { sign: true }); chatter(w, ['Fix the potholes!', "Tim's a fraud!", 'No more statues!', 'Where did the bridge money go?!', 'Recount!'], dt, 0.12); } });
      if (!ev.scuffle && ev.st > 8) { ev.scuffle = ev.t; mission(ev, 'Break up the #scuffle#.'); }
      if (!ev.scuffle) return;
      const a = fans[0], b = foes[0];
      if (!live(a) || !live(b) || a.mode !== 'script' || b.mode !== 'script') return fail(ev, '');
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      goTo(a, b.x, b.z, 2, dt, 1.1); goTo(b, a.x, a.z, 2, dt, 1.1);
      const k = (ev.t * 1.4) % 1; pose(a, { shove: k }); pose(b, { shove: (k + 0.5) % 1 }); chatter(a, ['Say that again!', 'Back off!', 'Loser!'], dt, 0.5); chatter(b, ['Make me!', 'Sellout!', 'Get your hands off me!'], dt, 0.5);
      ev.x = mx; ev.z = mz;
      if (stay(ev, mx, mz, 3.2, 1.6, dt)) { leave(b); shout(a, 'Sorry. Got carried away.'); text('Tim Arnett Campaign', 'Thanks for keeping the peace at the rally. Vote Tim!'); return win(ev, money(ev.V.cash * 0.8, ev.V.cash * 1.2), 'The Arnett campaign thanks you'); }
      if (ev.t - ev.scuffle > 25) { a.enemy = b; b.enemy = a; provoke(a); provoke(b); fail(ev, 'The rally turned into a brawl.'); }
    },
  },
  { // ---------- ice cream truck ----------
    id: 'icecream', theme: 'chaos', name: 'Ice cream truck', weight: 0.7, when: (c) => (c.night || c.rain ? 0.15 : c.hour > 11 && c.hour < 19 ? 1.6 : 0.6),
    variants: [{ col: 0xf8bbd0, n: 4, cash: 100 }, { col: 0xb3e5fc, n: 5, cash: 80 }, { col: 0xfff9c4, n: 3, cash: 120 }],
    start(ev) {
      const p = spot(60, 140); if (!p) return false;
      ev.v = car(ev, V.VAN, p.x - p.nx * 2.4, p.z - p.nz * 2.4, p.h, ev.V.col);
      ev.man = person(ev, 'vendor', p.x - Math.sin(p.h) * 1.2, p.z - Math.cos(p.h) * 1.2, p.h + Math.PI);
      ev.q = Array.from({ length: ev.V.n }, (_, i) => person(ev, pick(['walk', 'student', 'shopper', 'office']), ev.man.x - Math.sin(p.h) * (1.4 + i * 0.9), ev.man.z - Math.cos(p.h) * (1.4 + i * 0.9), p.h));
      ev.h = p.h; ev.x = p.x; ev.z = p.z; ev.goal = 'Get in *line* at the ice cream truck.'; ev.jT = 0; ev.serveT = 5;
      return true;
    },
    update(ev, dt) {
      const m = ev.man;
      if ((ev.jT -= dt) <= 0) { ev.jT = 7; jingle(dP(ev.x, ev.z)); }
      pose(m, { chat: true }); chatter(m, ['Ice cream! Get your ice cream!', 'Two scoops, one price!', 'Rocky Road, folks!', 'Cold treats, hot day!', 'Sprinkles are free today!'], dt, 0.15);
      ev.q = ev.q.filter((w) => live(w) && w.mode === 'script' && !w.leaveNow);
      ev.q.forEach((w, i) => { goTo(w, m.x - Math.sin(ev.h) * (1.4 + i * 0.9), m.z - Math.cos(ev.h) * (1.4 + i * 0.9), 1.2, dt, 0.3); if (w.script.speed === 0) { face(w, m.x, m.z, dt); pose(w, i ? { phone: i % 2 === 1 } : {}); } });
      if ((ev.serveT -= dt) <= 0 && ev.q.length) { ev.serveT = 5; const w = ev.q[0]; setProp(w.ch, 'coffee'); shout(w, ['Yum!', 'Brain freeze!', 'Perfect.', 'Mint chip, baby!']); leave(w); }
      if (stay(ev, m.x, m.z, 3, 1.5, dt) && ev.q.length <= 1) { shout(m, ["You're our 100th customer!", 'Winner winner!', 'Congratulations!']); return win(ev, money(ev.V.cash * 0.8, ev.V.cash * 1.2), "You were the ice cream truck's 100th customer", 'LUCKY DAY'); }
      if (ev.st > 80 || ev.t > 150) { drive(ev.v, 0); leave(m); fail(ev, ''); }
    },
  },
  { // ---------- food fight outside a restaurant ----------
    id: 'foodfight', theme: 'chaos', name: 'Food fight', weight: 0.6, when: (c) => (c.night ? 0.5 : 1),
    variants: [{ n: 4, cash: 100 }, { n: 6, cash: 130 }],
    start(ev) {
      const f = storefront(['restaurant', 'fast_food', 'cafe', 'pastry'], 60, 220, pick(['the diner', 'the burger joint', 'the pizza place', 'the buffet'])); if (!f) return false;
      const ax = Math.cos(f.face), az = -Math.sin(f.face);
      ev.crew = Array.from({ length: ev.V.n }, (_, i) => { const side = i % 2 ? 1 : -1, k = Math.floor(i / 2) - (ev.V.n / 4 - 0.5); return person(ev, pick(['walk', 'student', 'office']), f.x + ax * side * 2.2 + Math.sin(f.face) * k * 1.4, f.z + az * side * 2.2 + Math.cos(f.face) * k * 1.4, Math.atan2(-ax * side, -az * side)); });
      ev.boss = person(ev, 'vendor', f.doorX, f.doorZ, f.face + Math.PI);
      ev.x = f.x; ev.z = f.z; ev.name = f.name; ev.goal = `Break up the *food fight* outside ${f.name}.`;
      return true;
    },
    update(ev, dt) {
      ev.crew.forEach((w, i) => { pose(w, { swing: (ev.t * 1.1 + i * 0.37) % 1 }); chatter(w, ['Take that!', 'Mashed potato to the face!', 'FOOD FIGHT!', 'Not the guacamole!', 'My shirt!', 'Eat THIS!', 'Was that... a meatball?!'], dt, 0.12); });
      if (Math.random() < dt * 4 && dP(ev.x, ev.z) < 80) { const w = pick(ev.crew); fx.smokePuff(w.x + Math.sin(w.h) * 1.5, W.groundHeight(w.x, w.z) + 1.4, w.z + Math.cos(w.h) * 1.5, true, 0.2); }
      if (live(ev.boss)) { pose(ev.boss, { point: true }); chatter(ev.boss, ['Not on my patio!', 'Who is paying for this?!', 'STOP THROWING THE BREADSTICKS!', 'I just mopped!'], dt, 0.4); }
      if (stay(ev, ev.x, ev.z, 2.6, 1.5, dt)) { ev.crew.forEach(leave); if (live(ev.boss)) shout(ev.boss, THANKS); return win(ev, money(ev.V.cash * 0.8, ev.V.cash * 1.2), `You broke up a food fight at ${ev.name}`); }
      if (ev.st > 70) { ev.crew.forEach(leave); fail(ev, ''); }
    },
  },
  { // ---------- couple breaking up in the street ----------
    id: 'breakup', theme: 'chaos', name: 'Couple fighting', weight: 0.6,
    variants: [
      { a: ['You forgot my birthday!', 'Again?!', 'I saw the texts!', 'Who is Brenda?!'], b: ['It was ONE time!', 'Brenda is my cousin!', "I'm sorry, OK?!", 'Can we not do this here?'], makeup: true, cash: 50 },
      { a: ['We are DONE!', 'Here, take your stupid ring!', 'Enjoy your fantasy football!'], b: ['Fine!', "You'll be back!", 'At least give me my hoodie back!'], makeup: false, cash: 40 },
      { a: ['You sold my car for a boat?!', 'We live in IOWA!', 'Where would we even sail?!'], b: ['The river is RIGHT THERE!', "It's an investment!", 'Captain and First Mate, babe!'], makeup: true, cash: 60 },
      { a: ['You voted for Tim Arnett?!', 'How could you?!', 'I know what I saw!'], b: ['He promised a bridge!', 'He has great hair!', "It's a secret ballot!"], makeup: false, cash: 45 },
    ],
    start(ev) {
      const p = spot(60, 140); if (!p) return false;
      const ax = Math.sin(p.h) * 0.9, az = Math.cos(p.h) * 0.9;
      ev.A = person(ev, 'walk', p.x - ax, p.z - az, p.h); ev.B = person(ev, 'walk', p.x + ax, p.z + az, p.h + Math.PI);
      ev.x = p.x; ev.z = p.z; ev.goal = 'Help the @couple@ sort it out.';
      return true;
    },
    update(ev, dt) {
      const { A, B } = ev;
      if (!live(A) || !live(B) || A.mode !== 'script' || B.mode !== 'script') return fail(ev, '');
      face(A, B.x, B.z, dt); face(B, A.x, A.z, dt); pose(A, { chat: true }); pose(B, { chat: true }); chatter(A, ev.V.a, dt, 0.45); chatter(B, ev.V.b, dt, 0.45);
      if (stay(ev, ev.x, ev.z, 3, 3, dt)) {
        if (ev.V.makeup) { shout(A, ["...you're right. I'm sorry.", 'Fine. Tacos?', 'I love you, you idiot.']); shout(B, ['Thanks, stranger.', 'Love you too.', 'Group hug?']); leave(A); leave(B); }
        else { shout(A, ['WE ARE DONE.', 'Goodbye forever!', "Don't call me!"]); leave(A); shout(B, ['Thanks for... listening, I guess.', 'Want to get a drink?', '...anyone need a ring?']); }
        return win(ev, money(ev.V.cash * 0.8, ev.V.cash * 1.2), ev.V.makeup ? 'You helped a couple make up' : 'You were there for someone', 'RELATIONSHIP GURU');
      }
      if (ev.st > 60) { leave(A); fail(ev, ''); }
    },
  },
  { // ---------- mascot mobbed by fans ----------
    id: 'mascot', theme: 'chaos', name: 'Mascot on the run', weight: 0.6, when: (c) => (c.night ? 0.4 : 1),
    variants: [{ who: 'Rocky the River Rat', n: 4, cash: 140 }, { who: 'Corny the Cob', n: 5, cash: 150 }, { who: 'Bix the Bison', n: 6, cash: 170 }, { who: 'Big Tim', n: 5, cash: 200, mask: 2 }],
    start(ev) {
      const p = spot(70, 150); if (!p) return false;
      ev.m = person(ev, 'mascot', p.x, p.z, p.h, null, ev.V.mask || 0);
      ev.fans = Array.from({ length: ev.V.n }, (_, i) => person(ev, pick(['walk', 'student', 'jogger']), p.x - Math.sin(p.h) * (7 + i), p.z - Math.cos(p.h) * (7 + i) + (i % 2 ? 1 : -1), p.h));
      ev.x = p.x; ev.z = p.z; ev.goal = `Help @${ev.V.who}@ get away from the fans.`;
      return true;
    },
    update(ev, dt) {
      const m = ev.m;
      if (!live(m) || m.mode !== 'script') return fail(ev, '');
      const cx = ev.fans.reduce((s, w) => s + w.x, 0) / ev.fans.length, cz = ev.fans.reduce((s, w) => s + w.z, 0) / ev.fans.length;
      if (!ev.caught) {
        runFrom(m, cx, cz, ev.st < 0 ? 3 : 4.3, dt); pose(m, {}); chatter(m, ['No more selfies!', 'I just want to go home!', 'My head is HOT in here!', 'Not the tail!', 'Help!'], dt, 0.5);
        ev.fans.forEach((w) => { if (w.mode === 'script') { goTo(w, m.x, m.z, ev.st < 0 ? 2.8 : 4.0, dt, 1.2); pose(w, { film: true }); chatter(w, ['SELFIE!', `${ev.V.who}!!`, 'Sign my shirt!', 'One picture!', 'I love you!'], dt, 0.12); } });
        ev.x = m.x; ev.z = m.z;
        if (stay(ev, m.x, m.z, 4, 1, dt, false)) { ev.fans.forEach((w) => { shout(w, ['Aww!', 'Boo!', 'Fine...', 'Worth it.']); leave(w); }); shout(m, THANKS); return win(ev, money(ev.V.cash * 0.8, ev.V.cash * 1.2), `You rescued ${ev.V.who}`); }
        if (ev.st > 45) { ev.caught = true; pose(m, { cower: true }, 0); fail(ev, `The fans mobbed ${ev.V.who}.`); }
      }
    },
  },
  { // ---------- escaped farm animal ----------
    id: 'animal', theme: 'chaos', name: 'Escaped animal', weight: 0.7, when: (c) => (c.night ? 0.4 : 1),
    variants: [{ kind: 'goat', name: 'goat', cash: 140 }, { kind: 'llama', name: 'llama', cash: 180 }, { kind: 'pig', name: 'pig', cash: 120 }, { kind: 'sheep', name: 'sheep', cash: 110 }, { kind: 'emu', name: 'emu', cash: 200 }],
    start(ev) {
      const p = spot(60, 140); if (!p) return false;
      ev.c = critter(ev, ev.V.kind, p.x, p.z); ev.ch = p.h;
      ev.owner = person(ev, pick(['worker', 'walk']), p.x - Math.sin(p.h) * 12, p.z - Math.cos(p.h) * 12, p.h);
      ev.x = p.x; ev.z = p.z; ev.goal = `Catch the escaped *${ev.V.name}*.`; ev.turnT = 0;
      return true;
    },
    update(ev, dt) {
      const c = ev.c, d = dP(c.x, c.z);
      if ((ev.turnT -= dt) <= 0) { ev.turnT = 0.8 + Math.random() * 1.8; ev.ch = d < 9 ? Math.atan2(c.x - K.P.x, c.z - K.P.z) + (Math.random() - 0.5) * 1.4 : ev.ch + (Math.random() - 0.5) * 2.5; }
      ev.ch = stepCritter(c, ev.ch, d < 9 ? 5.2 : ev.st < 0 ? 1.2 : 3.2, dt);
      if (Math.random() < dt * 0.4 && d < 60) say(c.talk || (c.talk = { ch: { g: c.g } }), fresh({ goat: ['MEHHH!', 'Baaah!', 'MEEEH!'], llama: ['*spits*', 'Hmmmm.', 'MWAAH!'], pig: ['OINK!', 'Oink oink!', 'SQUEEE!'], sheep: ['Baa!', 'BAAAA!'], emu: ['*boom boom*', 'SKRAAA!', '*judging you*'] }[ev.V.kind]));
      if (live(ev.owner) && ev.owner.mode === 'script') { goTo(ev.owner, c.x, c.z, 3.4, dt, 2); chatter(ev.owner, [`Come back here, you ${ev.V.name}!`, "She's escaped again!", 'Somebody grab her!', "She's worth more than my truck!", 'Not the flower beds!'], dt, 0.5); }
      ev.x = c.x; ev.z = c.z;
      if ((K.P.foot && d < 1.9) || (K.P.veh && d < 3.5 && K.P.speed < 8)) { if (live(ev.owner)) shout(ev.owner, THANKS); return win(ev, money(ev.V.cash * 0.8, ev.V.cash * 1.2), `You caught the escaped ${ev.V.name}`); }
      if (ev.st > 75) fail(ev, `The ${ev.V.name} got away.`);
    },
  },
  { // ---------- someone stranded on a car roof ----------
    id: 'roofstuck', theme: 'chaos', name: 'Stranded on a car', weight: 0.6,
    variants: [{ kind: 'raccoon', cash: 90, lines: ['Get it away from me!', 'It hissed at me!', 'It took my sandwich!', 'Those little hands!'] }, { kind: 'goose', cash: 100, lines: ['THE GOOSE!', 'It wants blood!', 'Honk if you hate geese!', 'Not again, Gerald!'] }, { kind: 'emu', cash: 140, lines: ['Is that an EMU?!', 'Why is there an emu in Iowa?!', 'It keeps staring!'] }],
    start(ev) {
      const cars = K.ctx.vehicles().filter((v) => v.mode === 'parked' && !v.T.bike && !v.T.boat && !v.T.heli && v.T.hgt < 2 && dP(v.x, v.z) > 55 && dP(v.x, v.z) < 140);
      const v = pick(cars); if (!v) return false;
      ev.v = v; ev.w = person(ev, pick(['walk', 'office', 'mail', 'elderly']), v.x, v.z, v.h);
      ev.c = critter(ev, ev.V.kind, v.x + 3, v.z); ev.a = 0;
      ev.x = v.x; ev.z = v.z; ev.goal = `Shoo the *${ev.V.kind}* away.`;
      return true;
    },
    update(ev, dt) {
      const v = ev.v, w = ev.w, c = ev.c;
      if (!live(w) || w.mode !== 'script') return fail(ev, '');
      if (!ev.shoo) {
        if (w.ch.g.visible) w.ch.g.position.y = v.y + v.T.hgt + 0.02; // up on the roof (drawn after the walkers)
        pose(w, Math.sin(ev.t * 1.3) > 0 ? { handsUp: true } : { point: true }); face(w, c.x, c.z, dt); chatter(w, ev.V.lines, dt, 0.4);
        ev.a += dt * 1.3; const r = v.T.len / 2 + 1.3;
        stepCritter(c, Math.atan2(v.x + Math.cos(ev.a) * r - c.x, v.z + Math.sin(ev.a) * r - c.z), 2.2, dt);
        if (dP(c.x, c.z) < 4 && K.P.foot) { ev.shoo = ev.t; ev.ch = Math.atan2(c.x - K.P.x, c.z - K.P.z); }
      } else {
        ev.ch = stepCritter(c, ev.ch, 5, dt);
        if (ev.t - ev.shoo > 2) { const s = carSide(v, 1, 0.8); w.x = s.x; w.z = s.z; shout(w, THANKS); return win(ev, money(ev.V.cash * 0.8, ev.V.cash * 1.2), `You saved someone from a ${ev.V.kind}`); }
      }
      if (ev.st > 90) fail(ev, '');
    },
  },
  { // ---------- fender-bender: two drivers yelling in the street ----------
    id: 'fender', theme: 'chaos', name: 'Fender-bender', weight: 0.8,
    variants: [{ cash: 60 }, { cash: 80, big: true }],
    start(ev) {
      const L = lane(70, 140); if (!L) return false;
      const q = L.q, e = q.e; if (e.width < 7) return false;
      const hx = Math.sin(L.h), hz = Math.cos(L.h);
      const a = car(ev, sedan(), L.x, L.z, L.h + 0.25), b = car(ev, ev.V.big ? pick([V.PICKUP, V.VAN, V.SUV]) : sedan(), L.x + hx * 4.6, L.z + hz * 4.6, L.h - 0.15);
      for (const v of [a, b]) v.mode = 'free';
      damageZone(a, a.x + hx * 2.2, a.z + hz * 2.2, 25); damageZone(b, b.x - hx * 2.2, b.z - hz * 2.2, 25);
      const off = e.width / 2 + 1.2, k = (s) => ({ x: q.x - Math.cos(L.h) * off + hx * s, z: q.z + Math.sin(L.h) * off + hz * s }); // the sidewalk on the right
      const p1 = k(1.5), p2 = k(2.6);
      ev.d1 = person(ev, 'walk', p1.x, p1.z, 0); ev.d2 = person(ev, 'walk', p2.x, p2.z, 0);
      ev.x = (p1.x + p2.x) / 2; ev.z = (p1.z + p2.z) / 2; ev.goal = 'Settle the *argument*.';
      return true;
    },
    update(ev, dt) {
      const { d1, d2 } = ev;
      if (!live(d1) || !live(d2) || d1.mode !== 'script' || d2.mode !== 'script') return fail(ev, '');
      face(d1, d2.x, d2.z, dt); face(d2, d1.x, d1.z, dt); pose(d1, { chat: true }); pose(d2, { point: Math.sin(ev.t) > 0.3, chat: true });
      const L = ['Learn to drive!', 'You hit ME!', "I'm calling my insurance!", 'Are you blind?!', 'Unbelievable!', 'You brake-checked me!', 'Nice signal, genius!', 'This is a lease!'];
      chatter(d1, L, dt, 0.35); chatter(d2, L, dt, 0.35);
      if (stay(ev, ev.x, ev.z, 3.5, 2.5, dt)) { shout(d1, ["Fine. Let's swap insurance.", 'OK, OK. My bad.', 'Truce.']); shout(d2, ['Yeah... sorry.', 'Thanks, stranger.', 'We good.']); leave(d1); leave(d2); return win(ev, money(ev.V.cash * 0.8, ev.V.cash * 1.2), 'You settled a fender-bender', 'PEACEMAKER'); }
      if (ev.st > 50) { d1.temper = d2.temper = 'brawler'; d1.enemy = d2; d2.enemy = d1; provoke(d1); provoke(d2); fail(ev, 'The fender-bender turned into a fistfight.'); }
    },
  },
];
