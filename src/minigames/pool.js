// 8-ball pool, top-down. Circle physics with substeps (no tunnelling), cushions with pocket mouths,
// a ghost-ball aim guide, drag back to set power, and an AI that picks the easiest pot it can see.
import { canvas, el, money, sfx, gauss, clamp, sleep, PD, BC } from './core.js';
// loaded lazily so the pure game logic can be checked under node (selftest.mjs) without three.js
let drunk = { lvl: 0 };
import('../drunk.js').then((m) => { drunk = m.drunk; }).catch(() => {});

// table units: playing surface L x H, ball radius R
export const L = 100, H = 50, R = 1.25;
const FRICTION = 10, E_BALL = 0.97, E_RAIL = 0.85, CORNER_GAP = 3, SIDE_GAP = 2.4;
export const MAXV = 125, BREAK = 2.5; // the break hits 2.5x a normal full-power shot
// a ball drops once it hangs over the drawn hole (radius + 0.3) by 40% of its width, so nothing rests in the jaws
const LIP = 0.3 + 0.6 * R;
export const POCKETS = [[-0.4, -0.4, 2.9], [L / 2, -1, 2.25], [L + 0.4, -0.4, 2.9], [-0.4, H + 0.4, 2.9], [L / 2, H + 1, 2.25], [L + 0.4, H + 0.4, 2.9]];
const AIMS = [[0.8, 0.8], [L / 2, 0.1], [L - 0.8, 0.8], [0.8, H - 0.8], [L / 2, H - 0.1], [L - 0.8, H - 0.8]];
const COLORS = ['#f4f1e8', '#f2c12e', '#1d4fb8', '#d32a2a', '#5b2a86', '#f07a1a', '#127a3a', '#7a1f1f', '#111'];
const typeOf = (n) => (n === 8 ? 'eight' : n < 8 ? 'solid' : 'stripe');

// ---------- physics (exported for the self-check) ----------
export function step(balls, h, ev) {
  for (const b of balls) {
    if (b.in) continue;
    b.x += b.vx * h; b.y += b.vy * h;
    const s = Math.hypot(b.vx, b.vy);
    if (s > 0) { const ns = Math.max(0, s - FRICTION * h); b.vx *= ns / s; b.vy *= ns / s; if (ns < 0.25) b.vx = b.vy = 0; }
    // cushions, except across the pocket mouths
    const inCornerY = b.y < CORNER_GAP || b.y > H - CORNER_GAP, inCornerX = b.x < CORNER_GAP || b.x > L - CORNER_GAP;
    if (!inCornerY) {
      if (b.x < R) { b.x = R; if (b.vx < 0) { ev.rail?.(-b.vx); b.vx *= -E_RAIL; b.vy *= 0.97; } }
      else if (b.x > L - R) { b.x = L - R; if (b.vx > 0) { ev.rail?.(b.vx); b.vx *= -E_RAIL; b.vy *= 0.97; } }
    }
    if (!inCornerX && Math.abs(b.x - L / 2) > SIDE_GAP) {
      // shortcut: a ball skimming into a side-pocket jaw snaps back onto the rail line; fine at this scale
      if (b.y < R) { b.y = R; if (b.vy < 0) { ev.rail?.(-b.vy); b.vy *= -E_RAIL; b.vx *= 0.97; } }
      else if (b.y > H - R) { b.y = H - R; if (b.vy > 0) { ev.rail?.(b.vy); b.vy *= -E_RAIL; b.vx *= 0.97; } }
    }
    if (POCKETS.some(([px, py, pr]) => Math.hypot(b.x - px, b.y - py) < pr + LIP) || b.x < -3 || b.x > L + 3 || b.y < -3 || b.y > H + 3) {
      b.in = true; b.vx = b.vy = 0; ev.pot?.(b);
    }
  }
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i]; if (a.in) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j]; if (b.in) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      if (d2 >= 4 * R * R || d2 < 1e-9) continue;
      const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, push = (2 * R - d) / 2;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
      const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (rel <= 0) continue;
      const k = (rel * (1 + E_BALL)) / 2;
      a.vx -= k * nx; a.vy -= k * ny; b.vx += k * nx; b.vy += k * ny;
      ev.hit?.(a, b, rel);
    }
  }
}
export function simulate(balls, dt, ev = {}) {
  let vmax = 0; for (const b of balls) if (!b.in) vmax = Math.max(vmax, Math.abs(b.vx), Math.abs(b.vy));
  const n = clamp(Math.ceil((vmax * dt) / (R * 0.4)), 1, 60);
  for (let i = 0; i < n; i++) step(balls, dt / n, ev);
  return balls.some((b) => !b.in && (b.vx || b.vy));
}
export function rack() {
  const balls = [{ n: 0, x: L * 0.25, y: H / 2, vx: 0, vy: 0, in: false }];
  // 8 in the middle, a solid and a stripe in the back corners, the rest shuffled
  const rest = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15].sort(() => Math.random() - 0.5);
  const solid = rest.splice(rest.findIndex((n) => n < 8), 1)[0], stripe = rest.splice(rest.findIndex((n) => n > 8), 1)[0];
  let k = 0;
  for (let row = 0; row < 5; row++) for (let i = 0; i <= row; i++) {
    let n = row === 2 && i === 1 ? 8 : row === 4 && i === 0 ? solid : row === 4 && i === 4 ? stripe : rest[k++];
    balls.push({ n, x: L * 0.72 + row * R * 1.82 + Math.random() * 0.08, y: H / 2 + (i - row / 2) * R * 2.1 + (Math.random() - 0.5) * 0.08, vx: 0, vy: 0, in: false });
  }
  return balls;
}

// distance from point p to segment ab
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

const P = 8.4, M = 44, CW = L * P + M * 2, TRAY = 46, CH = H * P + M * 2 + TRAY;
const px = (x) => M + x * P, py = (y) => M + y * P;

function drawTable() {
  const [c, g] = canvas(CW, CH);
  g.fillStyle = '#0d0a08'; g.fillRect(0, 0, CW, CH);
  const wood = g.createLinearGradient(0, 0, 0, H * P + M * 2); wood.addColorStop(0, '#6b3a1a'); wood.addColorStop(0.5, '#4a2610'); wood.addColorStop(1, '#2e170a');
  g.fillStyle = wood; g.beginPath(); g.roundRect ? g.roundRect(4, 4, CW - 8, H * P + M * 2 - 8, 22) : g.rect(4, 4, CW - 8, H * P + M * 2 - 8); g.fill();
  g.fillStyle = '#0f5a32'; g.fillRect(M - 14, M - 14, L * P + 28, H * P + 28); // cushions
  const cloth = g.createRadialGradient(CW / 2, M + H * P / 2, 40, CW / 2, M + H * P / 2, L * P * 0.6); cloth.addColorStop(0, '#1f8f50'); cloth.addColorStop(1, '#126b3a');
  g.fillStyle = cloth; g.fillRect(M, M, L * P, H * P);
  // cushion noses
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.strokeRect(M, M, L * P, H * P);
  // diamonds
  g.fillStyle = '#e8dcc0';
  for (let i = 1; i < 8; i++) if (i !== 4) for (const y of [M - 28, M + H * P + 28]) { g.beginPath(); g.arc(px((L * i) / 8), y, 3, 0, 7); g.fill(); }
  for (let i = 1; i < 4; i++) for (const x of [M - 28, M + L * P + 28]) { g.beginPath(); g.arc(x, py((H * i) / 4), 3, 0, 7); g.fill(); }
  // head string and foot spot
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(px(L * 0.25), M); g.lineTo(px(L * 0.25), M + H * P); g.stroke(); g.setLineDash([]);
  g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(px(L * 0.72), py(H / 2), 2.5, 0, 7); g.fill();
  // pockets
  for (const [x, y, r] of POCKETS) {
    g.fillStyle = '#050505'; g.beginPath(); g.arc(px(x), py(y), (r + 0.3) * P, 0, 7); g.fill();
    g.strokeStyle = '#8a8a8a'; g.lineWidth = 2; g.stroke();
  }
  return c;
}

function drawBall(g, n, x, y, rad, ghost) {
  g.save();
  if (!ghost) { g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(x + rad * 0.25, y + rad * 0.3, rad, 0, 7); g.fill(); }
  g.beginPath(); g.arc(x, y, rad, 0, 7); g.clip();
  g.fillStyle = n > 8 ? '#f4f1e8' : COLORS[n]; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  if (n > 8) { g.fillStyle = COLORS[n - 8]; g.fillRect(x - rad, y - rad * 0.55, rad * 2, rad * 1.1); }
  if (n > 0) {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, rad * 0.5, 0, 7); g.fill();
    g.fillStyle = '#111'; g.font = `600 ${Math.round(rad * 0.85)}px ${BC}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, x, y + 0.5);
  }
  const sh = g.createRadialGradient(x - rad * 0.4, y - rad * 0.45, rad * 0.05, x, y, rad * 1.1);
  sh.addColorStop(0, 'rgba(255,255,255,.75)'); sh.addColorStop(0.25, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.4)');
  g.fillStyle = sh; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  g.restore();
}

export default function pool(ctx) {
  const [cv, g] = canvas(CW, CH, 'mg-pool');
  const tableImg = drawTable();
  ctx.body.append(cv);
  ctx.keys('<kbd>Mouse</kbd> Aim <kbd>Drag back</kbd> Power, release to shoot <kbd>Space</kbd> New rack');
  const opp = ['Shark Sal', 'Two-Ton Teddy', 'Lucky Lou', 'Minnie the Cue', 'Mitch'][Math.floor(Math.random() * 5)];

  let balls = rack(), phase = 'ready', turn = 0, breaker = 0, groups = [null, null], isBreak = true, stake = 0, gen = 0;
  let rollT = 0, ang = 0, mouse = [L / 2, H / 2], drag = null, power = 0, firstHit = null, potted = [], ai = null, guideT = 0, lastSnd = 0, banner = null;
  const cue = () => balls[0];
  const left = (grp) => balls.filter((b) => !b.in && typeOf(b.n) === grp).length;
  const legalFor = (who) => (b) => {
    if (b.in || b.n === 0) return false;
    const grp = groups[who];
    if (!grp) return b.n !== 8;
    return left(grp) ? typeOf(b.n) === grp : b.n === 8;
  };

  const toTable = (e) => { const b = cv.getBoundingClientRect(), k = CW / b.width; return [((e.clientX - b.left) * k - M) / P, ((e.clientY - b.top) * k - M) / P]; };
  ctx.root.addEventListener('mousemove', (e) => { // on the overlay so a drag can leave the table
    mouse = toTable(e);
    if (phase === 'aim' && !drag) ang = Math.atan2(mouse[1] - cue().y, mouse[0] - cue().x);
    if (drag) power = clamp(Math.hypot(mouse[0] - drag[0], mouse[1] - drag[1]) / 22, 0, 1);
  });
  cv.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (phase === 'place') return placeCue(...mouse);
    if (phase === 'aim') { drag = [...mouse]; power = 0; }
  });
  ctx.root.addEventListener('mouseup', onUp);
  function onUp(e) {
    if (e.button !== 0 || !drag) return;
    drag = null;
    if (phase === 'aim' && power > 0.04) shoot(ang + gauss() * 0.012 * drunk.lvl, power); else power = 0;
  }

  // ---------- turns ----------
  const who = (t) => (t ? opp : 'You');
  function say() {
    const tag = (t) => (groups[t] ? `${groups[t] === 'solid' ? 'Solids' : 'Stripes'} (${left(groups[t])} left)` : 'Open table');
    ctx.say(`<b>${turn ? opp : 'Your'}${turn ? "'s" : ''} shot</b> · You: ${tag(0)} · ${opp}: ${tag(1)}`);
  }
  function newRack() {
    if (phase !== 'ready' && phase !== 'over') return;
    if (!ctx.charge(ctx.bet)) return;
    stake = ctx.bet; gen++; balls = rack(); groups = [null, null]; isBreak = true; turn = breaker; breaker = 1 - breaker;
    ctx.lockBet(true); sfx.chip(); banner = null;
    ctx.say(stake ? `${opp} matches your ${money(stake)}. Winner takes ${money(stake * 2)}.` : `Friendly game against ${opp}.`, '', 2500);
    beginTurn(true);
  }
  function beginTurn(inHand) {
    if (turn === 0) { phase = inHand ? 'place' : 'aim'; if (inHand) cue().in = true; ang = Math.atan2(H / 2 - cue().y, L * 0.72 - cue().x) || 0; }
    else { phase = 'ai'; aiTurn(inHand, gen); }
    if (!isBreak) say(); else if (turn === 0) ctx.say('Place the cue ball behind the line and break', '');
  }
  function placeOk(x, y) {
    if (x < R || x > L - R || y < R || y > H - R || (isBreak && x > L * 0.25) || POCKETS.some(([qx, qy, pr]) => Math.hypot(x - qx, y - qy) < pr + LIP + 0.2)) return false;
    return balls.every((b) => b.in || b.n === 0 || Math.hypot(b.x - x, b.y - y) > 2 * R + 0.05);
  }
  function placeCue(x, y) {
    if (!placeOk(x, y)) { sfx.click(); return; }
    Object.assign(cue(), { x, y, vx: 0, vy: 0, in: false }); sfx.clack(0.3); phase = 'aim';
    ang = Math.atan2(mouse[1] - y, mouse[0] - x);
  }
  function shoot(a, p) {
    const v = p * MAXV * (isBreak ? BREAK : 1); // the break gets the whole body behind it
    Object.assign(cue(), { vx: Math.cos(a) * v, vy: Math.sin(a) * v });
    firstHit = null; potted = []; power = 0; rollT = 0; phase = 'roll'; ctx.busy = true; sfx.clack(0.4 + p * 0.6);
  }
  const ev = {
    hit(a, b, rel) {
      if (firstHit == null && (a.n === 0 || b.n === 0)) firstHit = a.n === 0 ? b.n : a.n;
      const now = performance.now(); if (now - lastSnd > 25) { lastSnd = now; sfx.clack(Math.min(1, rel / 70)); }
    },
    rail(v) { if (v > 4) sfx.rail(Math.min(1, v / 70)); },
    pot(b) { potted.push(b.n); sfx.pocket(); },
  };
  function settle() {
    ctx.busy = false;
    const me = turn, them = 1 - turn, objs = potted.filter((n) => n > 0), scratch = potted.includes(0);
    const grp = groups[me], onEight = !!grp && left(grp) + objs.filter((n) => typeOf(n) === grp).length === 0;
    let foul = scratch || firstHit == null, why = scratch ? 'Scratch' : firstHit == null ? 'No ball hit' : '';
    if (!foul && !isBreak) {
      const ok = grp ? (onEight ? firstHit === 8 : typeOf(firstHit) === grp) : firstHit !== 8;
      if (!ok) { foul = true; why = `Hit the ${firstHit === 8 ? '8' : typeOf(firstHit)} first`; }
    }
    if (objs.includes(8)) {
      if (isBreak) { respot8(); } else return over(onEight && !foul ? me : them, onEight && !foul ? '8-ball down' : foul ? 'Fouled on the 8' : '8-ball potted early');
    }
    if (!grp && !foul && !isBreak) {
      const first = objs.find((n) => n !== 8);
      if (first) { groups[me] = typeOf(first); groups[them] = groups[me] === 'solid' ? 'stripe' : 'solid'; banner = { text: `${who(me)}: ${groups[me]}s`, t: 0 }; }
    }
    const potOwn = objs.some((n) => n !== 8 && (!groups[me] || typeOf(n) === groups[me]));
    isBreak = false;
    if (foul) { turn = them; banner = { text: `Foul · ${why}`, t: 0, bad: true }; sfx.lose(); if (scratch) cue().in = true; return beginTurn(true); }
    if (!potOwn) turn = them;
    beginTurn(false);
  }
  function respot8() {
    const b = balls.find((x) => x.n === 8); let x = L * 0.72;
    while (balls.some((o) => o !== b && !o.in && Math.hypot(o.x - x, o.y - H / 2) < 2 * R + 0.05)) x += 0.5;
    Object.assign(b, { in: false, x, y: H / 2, vx: 0, vy: 0 });
  }
  function over(winner, why) {
    phase = 'over'; ctx.lockBet(false); ctx.result(winner === 0);
    if (winner === 0) { if (stake) ctx.pay(stake * 2, 'Pool'); ctx.say(`<b>You win!</b> ${why}${stake ? ` · <b class="mg-money">${money(stake * 2)}</b>` : ''}`, 'good'); sfx.win(); }
    else { ctx.say(`<b>${opp} wins.</b> ${why}${stake ? ` · you lose ${money(stake)}` : ''}`, 'bad'); sfx.lose(); }
    banner = { text: winner === 0 ? 'Winner' : 'Game over', t: 0, bad: winner !== 0 };
    stake = 0;
  }

  // ---------- AI ----------
  function blocked(ax, ay, bx, by, skip) {
    return balls.some((o) => !o.in && !skip.includes(o) && segDist(o.x, o.y, ax, ay, bx, by) < 2 * R - 0.05);
  }
  function bestShot(cx, cy, legal) {
    let best = null;
    const c = { x: cx, y: cy };
    for (const t of balls.filter(legal)) for (let p = 0; p < 6; p++) {
      const [ax, ay] = AIMS[p], dTP = Math.hypot(ax - t.x, ay - t.y), ux = (ax - t.x) / dTP, uy = (ay - t.y) / dTP;
      if ((p === 1 || p === 4) && Math.abs(uy) < 0.45) continue; // too shallow for a side pocket
      const gx = t.x - ux * 2 * R, gy = t.y - uy * 2 * R, dCG = Math.hypot(gx - cx, gy - cy);
      if (dCG < 0.01) continue;
      const vx = (gx - cx) / dCG, vy = (gy - cy) / dCG, cos = vx * ux + vy * uy;
      if (cos < 0.3 || blocked(cx, cy, gx, gy, [cue(), t]) || blocked(t.x, t.y, ax, ay, [t])) continue;
      const score = cos * cos * 2 - dCG / 120 - dTP / 90;
      // speed so the object ball gets there with some to spare (v^2 = 2 f d)
      const vo = Math.sqrt(2 * FRICTION * dTP) * 1.35 + 6, vc = Math.sqrt((vo / cos) ** 2 + 2 * FRICTION * dCG);
      if (!best || score > best.score) best = { ang: Math.atan2(vy, vx), power: clamp(vc / MAXV, 0.2, 1), score, c };
    }
    return best;
  }
  async function aiTurn(inHand, my) {
    const legal = legalFor(1);
    await sleep(600); if (ctx.closed || my !== gen) return;
    let shot = null;
    if (inHand) {
      let bestPos = null;
      for (let i = 0; i < 60; i++) {
        const x = isBreak ? 10 + Math.random() * 14 : R + Math.random() * (L - 2 * R), y = R + Math.random() * (H - 2 * R);
        if (!placeOk(x, y)) continue;
        const s = isBreak ? { score: 0, ang: Math.atan2(H / 2 - y, L * 0.72 - x), power: 1 } : bestShot(x, y, legal);
        if (s && (!bestPos || s.score > bestPos.s.score)) bestPos = { x, y, s };
      }
      const pos = bestPos || { x: L * 0.25, y: H / 2 };
      if (!placeOk(pos.x, pos.y)) { pos.x = L * 0.2; pos.y = H / 2; }
      Object.assign(cue(), { x: pos.x, y: pos.y, vx: 0, vy: 0, in: false }); sfx.clack(0.3);
      shot = bestPos?.s;
      await sleep(400); if (ctx.closed || my !== gen) return;
    }
    if (isBreak) shot = { ang: Math.atan2(H / 2 - cue().y, L * 0.72 - cue().x) + gauss() * 0.01, power: 1 };
    shot = shot || bestShot(cue().x, cue().y, legal);
    if (!shot) { // safety: just hit the nearest legal ball
      const t = balls.filter(legal).sort((a, b) => Math.hypot(a.x - cue().x, a.y - cue().y) - Math.hypot(b.x - cue().x, b.y - cue().y))[0];
      shot = { ang: t ? Math.atan2(t.y - cue().y, t.x - cue().x) : Math.random() * 7, power: 0.45 };
    }
    ai = { from: ang, to: shot.ang + gauss() * 0.008, power: clamp(shot.power * (1 + gauss() * 0.05), 0.15, 1), t: 0 };
  }

  // ---------- loop ----------
  function frame(dt) {
    guideT += dt;
    if (banner) { banner.t += dt; if (banner.t > 2.2) banner = null; }
    if (phase === 'roll') {
      if ((rollT += dt) > 25) for (const b of balls) b.vx = b.vy = 0; // never let a jittering ball hold the table
      if (!simulate(balls, dt, ev)) settle();
    }
    if (phase === 'ai' && ai) {
      ai.t += dt;
      let d = ai.to - ai.from; d = Math.atan2(Math.sin(d), Math.cos(d));
      ang = ai.from + d * Math.min(1, ai.t / 0.9);
      power = ai.t > 0.9 ? ai.power * Math.min(1, (ai.t - 0.9) / 0.5) : 0;
      if (ai.t > 1.55) { const a = ai; ai = null; shoot(a.to, a.power); }
    }
    draw();
  }
  function guide(x, y, a, gfx) {
    const dx = Math.cos(a), dy = Math.sin(a);
    let s = Infinity, hit = null;
    for (const b of balls) {
      if (b.in || b.n === 0) continue;
      const mx = x - b.x, my = y - b.y, bb = mx * dx + my * dy, c = mx * mx + my * my - 4 * R * R, disc = bb * bb - c;
      if (disc > 0) { const t = -bb - Math.sqrt(disc); if (t > 0 && t < s) { s = t; hit = b; } }
    }
    for (const t of [dx > 0 ? (L - R - x) / dx : (R - x) / dx, dy > 0 ? (H - R - y) / dy : (R - y) / dy]) if (t > 0 && t < s) { s = t; hit = null; }
    const gx = x + dx * s, gy = y + dy * s;
    gfx.strokeStyle = 'rgba(255,255,255,.7)'; gfx.lineWidth = 1.5; gfx.setLineDash([5, 5]); gfx.lineDashOffset = -guideT * 20;
    gfx.beginPath(); gfx.moveTo(px(x), py(y)); gfx.lineTo(px(gx), py(gy)); gfx.stroke(); gfx.setLineDash([]);
    gfx.beginPath(); gfx.arc(px(gx), py(gy), R * P, 0, 7); gfx.stroke();
    if (hit) {
      const nx = (hit.x - gx) / (2 * R), ny = (hit.y - gy) / (2 * R);
      gfx.strokeStyle = 'rgba(255,255,255,.9)'; gfx.beginPath(); gfx.moveTo(px(hit.x), py(hit.y)); gfx.lineTo(px(hit.x + nx * 9), py(hit.y + ny * 9)); gfx.stroke();
    }
  }
  function drawCue(x, y, a, pull) {
    const dx = Math.cos(a), dy = Math.sin(a), s0 = R + 0.6 + pull * 7, s1 = s0 + 58;
    const x0 = px(x - dx * s0), y0 = py(y - dy * s0), x1 = px(x - dx * s1), y1 = py(y - dy * s1);
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 9; g.beginPath(); g.moveTo(x0 + 4, y0 + 5); g.lineTo(x1 + 4, y1 + 5); g.stroke();
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, '#5ab0ff'); gr.addColorStop(0.012, '#f3ecd8'); gr.addColorStop(0.06, '#f3ecd8'); gr.addColorStop(0.07, '#d9b27a'); gr.addColorStop(0.62, '#b07a3c'); gr.addColorStop(0.64, '#1b1b1b'); gr.addColorStop(1, '#3a1d0c');
    g.strokeStyle = gr; g.lineWidth = 7; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.lineCap = 'butt';
  }
  function draw() {
    g.drawImage(tableImg, 0, 0, CW, CH);
    for (const b of balls) if (!b.in) drawBall(g, b.n, px(b.x), py(b.y), R * P);
    const c = cue();
    if (phase === 'place') {
      const ok = placeOk(...mouse);
      g.globalAlpha = 0.6; drawBall(g, 0, px(clamp(mouse[0], R, L - R)), py(clamp(mouse[1], R, H - R)), R * P, true); g.globalAlpha = 1;
      if (!ok) { g.strokeStyle = '#ff5a5a'; g.lineWidth = 2; g.beginPath(); g.arc(px(clamp(mouse[0], R, L - R)), py(clamp(mouse[1], R, H - R)), R * P + 3, 0, 7); g.stroke(); }
    }
    if ((phase === 'aim' || (phase === 'ai' && ai)) && !c.in) {
      if (phase === 'aim') guide(c.x, c.y, ang, g);
      drawCue(c.x, c.y, ang, power);
    }
    if (phase === 'aim' || phase === 'ai') { // power meter
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(CW - 30, M, 14, H * P);
      const pg = g.createLinearGradient(0, M + H * P, 0, M); pg.addColorStop(0, '#72c472'); pg.addColorStop(0.6, '#ffd24a'); pg.addColorStop(1, '#e5484d');
      g.fillStyle = pg; g.fillRect(CW - 28, M + H * P * (1 - power), 10, H * P * power);
    }
    // tray: what each side still has to pot
    const ty = H * P + M * 2 + TRAY / 2;
    g.fillStyle = '#000'; g.fillRect(0, H * P + M * 2, CW, TRAY);
    g.font = `600 17px ${BC}`; g.textBaseline = 'middle';
    for (const t of [0, 1]) {
      const grp = groups[t], x0 = t ? CW - 20 : 20, dir = t ? -1 : 1;
      g.textAlign = t ? 'right' : 'left'; g.fillStyle = turn === t && phase !== 'over' && phase !== 'ready' ? '#fff' : '#9aa';
      const label = `${t ? opp : 'You'}${grp ? ' · ' + grp.toUpperCase() + 'S' : ''}`;
      g.fillText(label, x0, ty);
      const w = g.measureText(label).width;
      const own = grp ? balls.filter((b) => !b.in && typeOf(b.n) === grp).map((b) => b.n) : [];
      own.sort((a, b) => a - b).forEach((n, i) => drawBall(g, n, x0 + dir * (w + 22 + i * 24), ty, 10, true));
    }
    if (banner || phase === 'ready') {
      const text = banner ? banner.text : 'Space to rack them up';
      g.globalAlpha = banner ? Math.min(1, (2.2 - banner.t) * 3) : 1;
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, py(H / 2) - 34, CW, 68);
      g.font = `44px ${PD}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 5; g.strokeStyle = '#000'; g.strokeText(text, CW / 2, py(H / 2) + 2);
      g.fillStyle = banner?.bad ? '#ff6b6b' : '#fff'; g.fillText(text, CW / 2, py(H / 2) + 2);
      g.globalAlpha = 1;
    }
    if (phase === 'over' && !banner) { g.fillStyle = '#fff'; g.font = `600 20px ${BC}`; g.textAlign = 'center'; g.fillText('Space for a new rack', CW / 2, py(H / 2)); }
    g.textBaseline = 'alphabetic';
  }

  ctx.say(`${opp} chalks a cue. Pick a bet, then Space to rack.`);
  return {
    frame,
    key(e) { if (e.code === 'Space' || e.key === 'Enter') { newRack(); return true; } return false; },
    close(forced) { gen++; if (phase !== 'ready' && phase !== 'over') forced ? ctx.pay(stake) : ctx.result(false); },
  };
}
