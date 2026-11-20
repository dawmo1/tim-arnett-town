// Slots: three Davenport-themed reels, eased stops reel by reel, a paytable that follows the bet.
import { canvas, el, money, sfx, PD, BC, shuffle } from './core.js';

// symbol, weight on each reel, pay for three on the line (x bet). RTP is about 95%.
const SYMS = [
  { id: 'cherry', w: 6, pay: 8, name: 'Cherries' },
  { id: 'cash', w: 5, pay: 10, name: 'Cash' },
  { id: 'ball', w: 4, pay: 15, name: 'Ballpark' },
  { id: 'bridge', w: 3, pay: 25, name: 'Centennial Bridge' },
  { id: 'tim', w: 2, pay: 50, name: 'Tim' },
  { id: 'v', w: 1, pay: 250, name: 'Jackpot' },
];
const PAIRS = [{ id: 'v', pay: 5 }, { id: 'cherry', pay: 2 }]; // any two on the line
export function payout(line) {
  if (line[0] === line[1] && line[1] === line[2]) return SYMS.find((s) => s.id === line[0]).pay;
  for (const p of PAIRS) if (line.filter((s) => s === p.id).length === 2) return p.pay;
  return 0;
}

// ---------- symbol art ----------
function drawSym(g, id, cx, cy, s) {
  g.save(); g.translate(cx, cy); g.scale(s / 100, s / 100);
  g.lineJoin = 'round'; g.lineCap = 'round';
  if (id === 'cherry') {
    g.strokeStyle = '#2f7d2a'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(-18, 14); g.quadraticCurveTo(-10, -20, 10, -36); g.moveTo(20, 18); g.quadraticCurveTo(18, -12, 10, -36); g.stroke();
    g.fillStyle = '#49a83c'; g.beginPath(); g.ellipse(22, -36, 16, 7, -0.4, 0, 7); g.fill();
    for (const [x, y] of [[-20, 22], [20, 26]]) {
      const gr = g.createRadialGradient(x - 6, y - 7, 2, x, y, 21); gr.addColorStop(0, '#ff8a8a'); gr.addColorStop(0.4, '#e01b24'); gr.addColorStop(1, '#7a0610');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, 20, 0, 7); g.fill();
    }
  } else if (id === 'cash') {
    g.rotate(-0.12);
    g.fillStyle = '#1d6b2c'; roundRect(g, -44, -27, 88, 54, 6); g.fill();
    g.strokeStyle = '#9be59a'; g.lineWidth = 3; roundRect(g, -38, -21, 76, 42, 4); g.stroke();
    g.fillStyle = '#2f8f40'; g.beginPath(); g.arc(0, 0, 17, 0, 7); g.fill();
    g.fillStyle = '#d9ffd5'; g.font = `44px ${PD}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 0, 3);
  } else if (id === 'ball') {
    const gr = g.createRadialGradient(-10, -12, 4, 0, 0, 38); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#c9c4b8');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 36, 0, 7); g.fill();
    g.strokeStyle = '#d0282e'; g.lineWidth = 2.5;
    for (const d of [-1, 1]) {
      const cx = d * 58, a0 = d < 0 ? 0 : Math.PI; // seams bulge in from each side
      g.beginPath(); g.arc(cx, 0, 40, a0 - 0.9, a0 + 0.9); g.stroke();
      for (let k = -3; k <= 3; k++) { const a = a0 + k * 0.24, x = cx + Math.cos(a) * 40, y = Math.sin(a) * 40, nx = Math.cos(a), ny = Math.sin(a); g.beginPath(); g.moveTo(x - nx * 5 - ny * 2, y - ny * 5 + nx * 2); g.lineTo(x + nx * 5 - ny * 2, y + ny * 5 + nx * 2); g.stroke(); }
    }
  } else if (id === 'bridge') {
    g.fillStyle = '#1b3550'; g.fillRect(-48, 22, 96, 6); // deck
    g.strokeStyle = '#6fd0d8'; g.lineWidth = 4;
    for (const x0 of [-48, -16, 16]) {
      g.beginPath(); g.moveTo(x0, 22); g.quadraticCurveTo(x0 + 16, -26, x0 + 32, 22); g.stroke();
      g.lineWidth = 1.5; for (let k = 1; k < 4; k++) { const x = x0 + k * 8; g.beginPath(); g.moveTo(x, 22); g.lineTo(x, 22 - 34 * (1 - Math.pow((k - 2) / 2, 2))); g.stroke(); } g.lineWidth = 4;
    }
    g.fillStyle = '#2d6fa8'; g.fillRect(-48, 30, 96, 10);
    g.strokeStyle = '#7fb6e0'; g.lineWidth = 1.5; for (let x = -40; x < 48; x += 16) { g.beginPath(); g.moveTo(x, 35); g.lineTo(x + 7, 35); g.stroke(); }
  } else if (id === 'tim') {
    const gr = g.createLinearGradient(0, -34, 0, 34); gr.addColorStop(0, '#ffe58a'); gr.addColorStop(1, '#c88a12');
    g.fillStyle = gr; roundRect(g, -46, -30, 92, 60, 14); g.fill();
    g.strokeStyle = '#6b4300'; g.lineWidth = 3; g.stroke();
    g.font = `40px ${PD}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 6; g.strokeStyle = '#000'; g.strokeText('TIM', 0, 3); g.fillStyle = '#fff'; g.fillText('TIM', 0, 3);
  } else if (id === 'v') {
    g.font = `96px ${PD}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#ffcc33'; g.shadowBlur = 16;
    g.lineWidth = 9; g.strokeStyle = '#ffcc33'; g.strokeText('V', 0, 6);
    g.shadowBlur = 0; g.lineWidth = 4; g.strokeStyle = '#000'; g.strokeText('V', 0, 6);
    const gr = g.createLinearGradient(0, -40, 0, 40); gr.addColorStop(0, '#ff5a4a'); gr.addColorStop(1, '#a50d12');
    g.fillStyle = gr; g.fillText('V', 0, 6);
  }
  g.restore();
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }

const CW = 540, CH = 380, RW = 140, RH = 100, GAP = 14, X0 = (CW - (3 * RW + 2 * GAP)) / 2, Y0 = 30;

export default function slots(ctx) {
  const [cv, g] = canvas(CW, CH, 'mg-slots-cv');
  const table = el('div', 'mg-side mg-paytable');
  ctx.body.append(cv, table);
  ctx.keys('<kbd>Space</kbd> Spin <kbd>←</kbd><kbd>→</kbd> Bet');
  const spinBtn = el('button', 'mg-btn mg-big', 'Spin <kbd>Space</kbd>'); spinBtn.type = 'button';
  spinBtn.addEventListener('click', spin);

  // each reel is a weighted strip in shuffled order, so the stop index is a fair weighted draw
  const strip = () => shuffle(SYMS.flatMap((s) => Array(s.w).fill(s.id)));
  const reels = [0, 1, 2].map(() => ({ strip: strip(), pos: Math.random() * 21, from: 0, to: 0, t: 0, dur: 0, done: true, lastI: 0 }));
  const symAt = (r, k) => r.strip[((k % r.strip.length) + r.strip.length) % r.strip.length];
  let spinning = false, flash = 0, winLine = false, jackpot = false, lightT = 0, lastTick = 0;

  function renderTable() {
    table.innerHTML = '<h3>Paytable</h3>';
    const rows = [...SYMS].reverse().map((s) => [[s.id, s.id, s.id], s.pay, s.name]).concat(PAIRS.map((p) => [[p.id, p.id, null], p.pay, 'Any two']));
    for (const [ids, pay, name] of rows) {
      const r = el('div', 'mg-pay-row');
      const icons = el('span', 'mg-pay-icons');
      for (const id of ids) { const [c, cg] = canvas(30, 30); c.style.width = '30px'; if (id) drawSym(cg, id, 15, 15, 30); icons.append(c); }
      r.append(icons, el('span', 'mg-pay-name', name), el('b', 'mg-money', money(pay * Math.max(10, ctx.bet))));
      table.append(r);
    }
    table.append(spinBtn);
  }
  renderTable();
  ctx.onBet = renderTable;
  ctx.say('Line up three on the middle row. Three <b>V</b> is the jackpot.');

  function spin() {
    if (spinning || ctx.closed) return;
    if (!ctx.charge(ctx.bet)) return;
    sfx.chip(); spinning = true; ctx.busy = true; ctx.lockBet(true); spinBtn.disabled = true;
    winLine = false; jackpot = false; ctx.say('');
    const stops = reels.map((r) => Math.floor(Math.random() * r.strip.length));
    const tease = symAt(reels[0], stops[0]) === symAt(reels[1], stops[1]); // same on 1 and 2: last reel spins longer
    reels.forEach((r, i) => {
      const n = r.strip.length, base = Math.ceil(r.pos);
      r.from = r.pos; r.to = base + n * (3 + i * 2 + (tease && i === 2 ? 2 : 0)) + (((stops[i] - base) % n) + n) % n;
      r.t = 0; r.dur = 1.1 + i * 0.5 + (tease && i === 2 ? 0.9 : 0); r.done = false;
    });
    if (tease) setTimeout(() => !ctx.closed && sfx.suspense(), 1500);
  }

  function settle() {
    spinning = false; ctx.busy = false; ctx.lockBet(false); spinBtn.disabled = false;
    const line = reels.map((r) => symAt(r, Math.round(r.to)));
    const mult = payout(line);
    if (!mult) { ctx.say('No win. Spin again?', ''); return; }
    const win = mult * ctx.bet; winLine = true; flash = 0; jackpot = line[0] === 'v' && line[1] === 'v' && line[2] === 'v';
    ctx.pay(win, jackpot ? 'JACKPOT' : 'Slots');
    ctx.say(`${jackpot ? 'JACKPOT! ' : ''}You win <b class="mg-money">${money(win)}</b> <small>(${mult}x)</small>`, 'good');
    if (jackpot) sfx.jackpot(); else { sfx.win(); for (let i = 0; i < Math.min(8, mult); i++) sfx.coin(0.35 + i * 0.09); }
  }

  // easeOutBack with a small overshoot so each reel kicks past and settles
  const ease = (u) => { const s = 0.4; u -= 1; return 1 + (s + 1) * u * u * u + s * u * u; };

  function frame(dt, now) {
    lightT += dt * (winLine ? 9 : spinning ? 5 : 1.6); flash += dt;
    let moving = false;
    reels.forEach((r) => {
      if (r.done) return;
      r.t += dt; const u = Math.min(1, r.t / r.dur);
      r.pos = r.from + (r.to - r.from) * ease(u);
      const i = Math.floor(r.pos);
      if (i !== r.lastI && now - lastTick > 0.035) { sfx.tick(); lastTick = now; }
      r.lastI = i;
      if (u >= 1) { r.done = true; r.pos = r.to; sfx.thud(); } else moving = true;
    });
    if (spinning && !moving) settle();
    draw();
  }

  function draw() {
    // cabinet
    const bg = g.createLinearGradient(0, 0, 0, CH); bg.addColorStop(0, '#3a0d4f'); bg.addColorStop(1, '#14051d');
    g.fillStyle = bg; g.fillRect(0, 0, CW, CH);
    // chasing bulbs around the edge
    const bulbs = 34;
    for (let i = 0; i < bulbs; i++) {
      const p = i / bulbs, per = 2 * (CW + CH) - 40;
      let d = p * per, x, y;
      if (d < CW - 20) { x = 10 + d; y = 10; } else if ((d -= CW - 20) < CH - 20) { x = CW - 10; y = 10 + d; } else if ((d -= CH - 20) < CW - 20) { x = CW - 10 - d; y = CH - 10; } else { d -= CW - 20; x = 10; y = CH - 10 - d; }
      const on = (i + Math.floor(lightT * 3)) % 3 === 0;
      g.fillStyle = on ? (jackpot ? '#fff36b' : '#ffd24a') : '#5a3a14';
      g.shadowColor = '#ffcc33'; g.shadowBlur = on ? 10 : 0;
      g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill();
    }
    g.shadowBlur = 0;
    // reels
    for (let i = 0; i < 3; i++) {
      const r = reels[i], x = X0 + i * (RW + GAP);
      g.save(); g.beginPath(); g.rect(x, Y0, RW, RH * 3); g.clip();
      const rg = g.createLinearGradient(0, Y0, 0, Y0 + RH * 3); rg.addColorStop(0, '#9a9a9a'); rg.addColorStop(0.18, '#fff'); rg.addColorStop(0.82, '#fff'); rg.addColorStop(1, '#9a9a9a');
      g.fillStyle = rg; g.fillRect(x, Y0, RW, RH * 3);
      const base = Math.floor(r.pos), blur = r.done ? 0 : Math.min(1, (r.to - r.pos) / 6);
      for (let k = base - 2; k <= base + 2; k++) {
        const cy = Y0 + RH * 1.5 + (r.pos - k) * RH; // pos grows -> symbols move down
        if (cy < Y0 - RH || cy > Y0 + RH * 4) continue;
        g.globalAlpha = 1 - blur * 0.45;
        const hit = winLine && k === Math.round(r.to) && Math.floor(flash * 4) % 2 === 0;
        drawSym(g, symAt(r, k), x + RW / 2, cy, hit ? 90 : 78);
        if (blur > 0.2) { g.globalAlpha = blur * 0.35; drawSym(g, symAt(r, k), x + RW / 2, cy - RH * 0.25, 78); }
      }
      g.globalAlpha = 1;
      // shading on the curved reel
      const sh = g.createLinearGradient(0, Y0, 0, Y0 + RH * 3); sh.addColorStop(0, 'rgba(0,0,0,.55)'); sh.addColorStop(0.3, 'rgba(0,0,0,0)'); sh.addColorStop(0.7, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.55)');
      g.fillStyle = sh; g.fillRect(x, Y0, RW, RH * 3);
      g.restore();
      g.strokeStyle = '#d4a017'; g.lineWidth = 3; g.strokeRect(x - 1.5, Y0 - 1.5, RW + 3, RH * 3 + 3);
    }
    // pay line
    const ly = Y0 + RH * 1.5;
    g.strokeStyle = winLine ? (Math.floor(flash * 6) % 2 ? '#fff' : '#ff3b3b') : 'rgba(255,59,59,.7)'; g.lineWidth = winLine ? 4 : 2;
    g.beginPath(); g.moveTo(X0 - 16, ly); g.lineTo(CW - X0 + 16, ly); g.stroke();
    g.fillStyle = '#ff3b3b';
    for (const [x, d] of [[X0 - 16, 1], [CW - X0 + 16, -1]]) { g.beginPath(); g.moveTo(x, ly - 8); g.lineTo(x + 10 * d, ly); g.lineTo(x, ly + 8); g.fill(); }
    // bet on the cabinet
    g.font = `600 17px ${BC}`; g.textAlign = 'center'; g.fillStyle = '#e8d6ff';
    g.fillText(`BET ${money(ctx.bet)}  ·  JACKPOT ${money(ctx.bet * 250)}`, CW / 2, CH - 22);
  }

  return {
    frame,
    key(e) { if (e.code === 'Space' || e.key === 'Enter') { spin(); return true; } return false; },
    close() { if (spinning) ctx.pay(ctx.bet); }, // only a forced close can interrupt a spin: the bet comes back
  };
}
