// Blackjack: 6-deck shoe, dealer peeks on A/10 and stands on all 17s, blackjack pays 3:2,
// hit / stand / double on the first two cards.
import { el, money, sfx, shuffle, sleep } from './core.js';

const SUITS = ['♠', '♥', '♦', '♣'], RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const DEALERS = ['Rosa', 'Marcus', 'Jolene', 'Dwayne', 'Priya'];
const cardVal = (c) => (c.r === 'A' ? 11 : ['J', 'Q', 'K'].includes(c.r) ? 10 : +c.r);
export function total(hand) {
  let t = 0, aces = 0;
  for (const c of hand) { t += cardVal(c); if (c.r === 'A') aces++; }
  while (t > 21 && aces) { t -= 10; aces--; }
  return { t, soft: aces > 0 && t <= 21 };
}
const isBJ = (h) => h.length === 2 && total(h).t === 21;

export default function blackjack(ctx) {
  const dealer = DEALERS[Math.floor(Math.random() * DEALERS.length)];
  const felt = el('div', 'mg-felt', `
    <div class="mg-bj-row"><div class="mg-bj-label">Dealer · ${dealer} <b class="mg-bj-tot" data-d></b></div><div class="mg-hand" data-dh></div></div>
    <div class="mg-bj-rules">Blackjack pays 3 to 2 · Dealer stands on all 17s</div>
    <div class="mg-bj-row"><div class="mg-hand" data-ph></div><div class="mg-bj-label">You <b class="mg-bj-tot" data-p></b> <span class="mg-chipstack" data-stake></span></div></div>`);
  const side = el('div', 'mg-side mg-actions');
  const btn = (label, key, fn) => { const b = el('button', 'mg-btn', `${label} <kbd>${key}</kbd>`); b.type = 'button'; b.addEventListener('click', fn); side.append(b); return b; };
  const dealB = btn('Deal', 'Space', deal), hitB = btn('Hit', 'H', hit), standB = btn('Stand', 'S', () => stand()), dblB = btn('Double', 'D', double);
  ctx.body.append(felt, side);
  ctx.keys('<kbd>Space</kbd> Deal <kbd>H</kbd> Hit <kbd>S</kbd> Stand <kbd>D</kbd> Double <kbd>←</kbd><kbd>→</kbd> Bet');
  const $ = (s) => felt.querySelector(s);
  const dh = $('[data-dh]'), ph = $('[data-ph]');

  let shoe = [], phase = 'bet', player = [], dealerH = [], stake = 0, holeEl = null;
  function fillShoe() { shoe = shuffle(Array.from({ length: 6 }, () => SUITS.flatMap((s) => RANKS.map((r) => ({ r, s })))).flat()); }
  fillShoe();

  function cardEl(c, down) {
    const red = c.s === '♥' || c.s === '♦';
    const e = el('div', `mg-card${red ? ' red' : ''}${down ? ' down' : ''}`,
      `<div class="mg-card-in"><div class="mg-face"><b>${c.r}<i>${c.s}</i></b><span>${['J', 'Q', 'K'].includes(c.r) ? c.r : c.s}</span><b class="br">${c.r}<i>${c.s}</i></b></div><div class="mg-back"><span>V</span></div></div>`);
    return e;
  }
  async function give(hand, box, down = false) {
    const c = shoe.pop(); hand.push(c);
    const e = cardEl(c, down); box.append(e); sfx.card();
    if (down) holeEl = e;
    showTotals(); await sleep(330);
    return c;
  }
  function showTotals() {
    const p = total(player), d = total(holeEl ? dealerH.slice(0, 1) : dealerH);
    $('[data-p]').textContent = player.length ? (p.soft && p.t < 21 ? `${p.t - 10} / ${p.t}` : p.t) : '';
    $('[data-d]').textContent = dealerH.length ? d.t : '';
    $('[data-stake]').textContent = stake ? money(stake) : '';
  }
  function buttons() {
    dealB.disabled = phase !== 'bet';
    hitB.disabled = standB.disabled = phase !== 'play';
    dblB.disabled = phase !== 'play' || player.length !== 2 || ctx.cash() < stake;
  }
  async function reveal() { if (!holeEl) return; holeEl.classList.remove('down'); holeEl = null; sfx.card(); showTotals(); await sleep(450); }

  async function deal() {
    if (phase !== 'bet' || ctx.closed) return;
    if (!ctx.charge(ctx.bet)) return;
    if (shoe.length < 60) { fillShoe(); ctx.say('Fresh shoe, six decks shuffled', '', 1600); }
    stake = ctx.bet; player = []; dealerH = []; holeEl = null; dh.innerHTML = ''; ph.innerHTML = '';
    phase = 'deal'; ctx.busy = true; ctx.lockBet(true); buttons(); sfx.chip(); ctx.say('');
    await give(player, ph); await give(dealerH, dh); await give(player, ph); await give(dealerH, dh, true);
    if (ctx.closed) return;
    const up = dealerH[0];
    if (cardVal(up) >= 10 && isBJ(dealerH)) { // dealer peeks
      ctx.say(`${dealer} checks the hole card…`); await sleep(600); await reveal();
      return end(isBJ(player) ? 'push' : 'lose', 'Dealer has blackjack');
    }
    if (isBJ(player)) { await reveal(); return end('bj'); }
    phase = 'play'; ctx.busy = false; buttons();
    ctx.say(`${dealer} shows ${up.r}. Hit, stand or double?`);
  }
  async function hit() {
    if (phase !== 'play') return;
    phase = 'deal'; ctx.busy = true; buttons();
    await give(player, ph);
    const t = total(player).t;
    if (t > 21) { await reveal(); return end('lose', 'Bust'); }
    if (t === 21) return stand(true);
    phase = 'play'; ctx.busy = false; buttons();
  }
  async function double() {
    if (phase !== 'play' || player.length !== 2) return;
    if (!ctx.charge(stake)) return;
    stake *= 2; sfx.chip(); phase = 'deal'; ctx.busy = true; buttons();
    await give(player, ph);
    if (total(player).t > 21) { await reveal(); return end('lose', 'Bust'); }
    return stand(true);
  }
  async function stand(auto) {
    if (phase !== 'play' && !auto) return;
    phase = 'dealer'; ctx.busy = true; buttons();
    await reveal();
    while (total(dealerH).t < 17 && !ctx.closed) await give(dealerH, dh);
    const p = total(player).t, d = total(dealerH).t;
    if (d > 21) return end('win', `${dealer} busts with ${d}`);
    end(p > d ? 'win' : p < d ? 'lose' : 'push', `${p} vs ${d}`);
  }
  function end(res, why = '') {
    if (ctx.closed) return;
    const back = res === 'bj' ? stake * 2.5 : res === 'win' ? stake * 2 : res === 'push' ? stake : 0;
    if (res === 'push') ctx.pay(back); else ctx.pay(back, 'Blackjack');
    const head = { bj: 'Blackjack!', win: 'You win', lose: 'You lose', push: 'Push' }[res];
    ctx.say(`<b>${head}</b>${why ? ` · ${why}` : ''}${back ? ` · <b class="mg-money">${money(back)}</b>` : ''}`, res === 'lose' ? 'bad' : res === 'push' ? '' : 'good');
    (res === 'lose' ? sfx.lose : res === 'push' ? sfx.click : sfx.win)();
    stake = 0; phase = 'bet'; ctx.busy = false; ctx.lockBet(false); buttons(); showTotals();
  }

  buttons();
  ctx.say(`${dealer} nods. Pick a bet and deal.`);
  return {
    key(e) {
      if (e.code === 'Space' || e.key === 'Enter') { deal(); return true; }
      if (e.code === 'KeyH') { hit(); return true; }
      if (e.code === 'KeyS') { stand(); return true; }
      if (e.code === 'KeyD') { double(); return true; }
      return false;
    },
  };
}
