// Self-check for the minigame rules and pool physics: node src/minigames/selftest.mjs
import assert from 'node:assert/strict';
import { payout } from './slots.js';
import { total } from './blackjack.js';
import { returns, ORDER } from './roulette.js';
import { scoreAt } from './darts.js';
import { rack, simulate, L, H, R } from './pool.js';
assert.equal(payout(['v','v','v']), 250); assert.equal(payout(['v','v','tim']), 5); assert.equal(payout(['cherry','tim','cherry']), 2); assert.equal(payout(['tim','cash','ball']), 0);
const c = (...r) => r.map((x) => ({ r: x, s: '♠' }));
assert.deepEqual(total(c('A','K')), { t: 21, soft: true }); assert.equal(total(c('A','A','9')).t, 21); assert.equal(total(c('K','Q','5')).t, 25); assert.equal(total(c('A','6','K')).soft, false);
assert.equal(ORDER.length, 37); assert.equal(new Set(ORDER).size, 37);
assert.equal(returns('n17', 17), 36); assert.equal(returns('red', 0), 0); assert.equal(returns('red', 1), 2); assert.equal(returns('black', 2), 2); assert.equal(returns('d3', 25), 3); assert.equal(returns('even', 0), 0); assert.equal(returns('high', 19), 2);
assert.equal(scoreAt(0, 0).pts, 50); assert.equal(scoreAt(0, -103).label, 'T20'); assert.equal(scoreAt(0, 103).label, 'T3'); assert.equal(scoreAt(166, 0).label, 'D6'); assert.equal(scoreAt(0, 300).label, 'MISS'); assert.equal(scoreAt(-130, 0).pts, 11);
// pool: a hard break and many random shots never lose a ball through another or off the table, and always settle
for (let trial = 0; trial < 200; trial++) {
  const balls = rack(); const cue = balls[0];
  const a = trial === 0 ? 0 : Math.random() * 7, p = 125 * (0.3 + Math.random() * 0.7);
  cue.vx = Math.cos(a) * p; cue.vy = Math.sin(a) * p;
  let t = 0; while (simulate(balls, 1 / 60) && t < 60) t += 1 / 60;
  assert.ok(t < 30, 'settles ' + t);
  for (const b of balls) if (!b.in) { assert.ok(b.x >= R - 1e-6 - 3 && b.x <= L + 3 && b.y >= -3 && b.y <= H + 3, 'on table'); }
  const on = balls.filter((b) => !b.in);
  for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) assert.ok(Math.hypot(on[i].x - on[j].x, on[i].y - on[j].y) > 2 * R - 0.05, 'no overlap');
}
console.log('all minigame self-checks pass');
