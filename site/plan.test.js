const assert = require('assert');
const fs = require('fs');
const AGENT = require('./plan');
const ABI = require('./abi');
const PLAN = require('./planner');
const ETH = require('./eth');

const user = '0xabcabcabcabcabcabcabcabcabcabcabcabcabca';
const stranger = '0xdefdefdefdefdefdefdefdefdefdefdefdefdefd';
const KEYS = ['block', 'exists', 'kind', 'note', 'ok', 'owned', 'royalty', 'shares', 'target', 'txs', 'v', 'wallet'];
const TX_KEYS = ['data', 'to', 'value'];
const SHARE_KEYS = ['holder', 'id', 'owned', 'wei'];

function snap(extra) {
  return Object.assign({
    block: 42,
    owners: [user, stranger],
    math: [['1', 0], ['2', 0], ['4', 1], ['8', 1], ['16', 0], ['64', 0], ['128', 0], ['256', 0]],
    rgb: [['9', 0, '1', '2', '4'], ['10', 0, '64', '128', '256']],
    toon: [['1', 0, '5', '6', '9']],
    words: { '5': 'hi', '7': 'yo' },
    faces: { '6': ':)', '8': ':(' },
  }, extra || {});
}

function keys(o) {
  return Object.keys(o).sort();
}

function check(out) {
  assert.deepStrictEqual(keys(out), KEYS);
  assert.strictEqual(out.v, 1);
  assert.strictEqual(out.wallet, user);
  assert.strictEqual(out.block, 42);
  JSON.parse(JSON.stringify(out));
  out.txs.forEach(function (tx) {
    assert.deepStrictEqual(keys(tx), TX_KEYS);
    assert.ok(!Object.prototype.hasOwnProperty.call(tx, 'from'));
  });
  out.shares.forEach(function (row) { assert.deepStrictEqual(keys(row), SHARE_KEYS); });
  const sum = out.shares.reduce(function (n, row) { return n + BigInt(row.wei); }, 0n);
  assert.strictEqual(sum.toString(), out.royalty);
}

const both = AGENT.plan(user, '3', snap());
check(both);
assert.strictEqual(both.ok, true);
assert.strictEqual(both.kind, 'math');
assert.strictEqual(both.target, '3');
assert.strictEqual(both.exists, false);
assert.strictEqual(both.txs.length, 1);
assert.strictEqual(both.txs[0].to, ETH.ADDR.MATH);
assert.ok(both.txs[0].data === ABI.call(ABI.SEL.add2, [1n, 2n]) || both.txs[0].data === ABI.call(ABI.SEL.add2, [2n, 1n]));
assert.ok(both.txs[0].data.startsWith('0x771602f7'));
assert.strictEqual(both.txs[0].value, '0x' + PLAN.MSG_MATH.toString(16));
assert.strictEqual(both.royalty, '0');
assert.deepStrictEqual(both.owned, ['1', '2']);
assert.deepStrictEqual(both.shares.map(function (row) { return row.id; }).sort(), ['1', '2']);
assert.ok(both.shares.every(function (row) { return row.owned === true && row.wei === '0'; }));
assert.ok(both.note.indexOf('A human signs') === 0);
assert.ok(both.note.indexOf('2300-gas') !== -1);

const cold = '0x' + '11'.repeat(20);
const none = AGENT.plan(cold, { math: '12' }, snap());
assert.strictEqual(none.wallet, cold);
assert.strictEqual(none.txs.length, 1);
assert.strictEqual(none.royalty, (2n * PLAN.ROY_WEI).toString());
assert.deepStrictEqual(none.owned, []);
assert.ok(none.shares.every(function (row) { return row.owned === false && row.wei === PLAN.ROY_WEI.toString(); }));

const part = snap();
part.math = part.math.map(function (row) { return row[0] === '2' ? ['2', 1] : row; });
const half = AGENT.plan(user, '3', part);
check(half);
assert.strictEqual(half.txs.length, 1);
assert.deepStrictEqual(half.owned, ['1']);
assert.strictEqual(half.royalty, PLAN.ROY_WEI.toString());

const have = AGENT.plan(user.toUpperCase(), '1', JSON.stringify(snap()));
check(have);
assert.strictEqual(have.exists, true);
assert.deepStrictEqual(have.txs, []);
assert.strictEqual(have.royalty, '0');
assert.deepStrictEqual(have.owned, ['1']);
assert.strictEqual(have.note, 'Already minted. Nothing to sign.');

const rgb = AGENT.plan(user, { r: '8', g: '16', b: '32' }, snap());
check(rgb);
assert.strictEqual(rgb.kind, 'rgb');
assert.strictEqual(rgb.target, '8,16,32');
assert.strictEqual(rgb.ok, true);
assert.strictEqual(rgb.exists, false);
const rgbTx = rgb.txs[rgb.txs.length - 1];
assert.strictEqual(rgbTx.to, ETH.ADDR.RGB);
assert.strictEqual(rgbTx.data, ABI.call(ABI.SEL.add3, [8n, 16n, 32n]));
assert.ok(rgbTx.data.startsWith('0x505fb46c'));
assert.strictEqual(rgbTx.value, '0x' + PLAN.MSG_RGB.toString(16));
assert.ok(rgb.owned.indexOf('16') !== -1);
assert.ok(rgb.owned.indexOf('8') === -1);
const channel = rgb.shares.slice(-3);
assert.deepStrictEqual(channel.map(function (row) { return row.id; }), ['8', '16', '32']);
assert.strictEqual(channel[0].wei, PLAN.RGB_ROY.toString());
assert.strictEqual(channel[0].owned, false);
assert.strictEqual(channel[1].wei, '0');
assert.strictEqual(channel[1].owned, true);
assert.strictEqual(channel[2].wei, '0');
assert.strictEqual(channel[2].holder, user);

const taken = AGENT.plan(user, { r: '1', g: '2', b: '8' }, snap());
check(taken);
assert.strictEqual(taken.ok, false);
assert.ok(taken.note.indexOf('Red already used by RGB #9.') !== -1);
assert.ok(taken.note.indexOf('Green already used by RGB #9.') !== -1);
assert.strictEqual(taken.txs[taken.txs.length - 1].to, ETH.ADDR.RGB);

const image = AGENT.plan(user, { r: '1', g: '2', b: '4' }, snap());
check(image);
assert.strictEqual(image.exists, true);
assert.deepStrictEqual(image.txs, []);
assert.deepStrictEqual(image.owned, ['1', '2']);

const toon = AGENT.plan(user, { math: '16', word: '7', face: '8', rgb: '10' }, snap());
check(toon);
assert.strictEqual(toon.kind, 'toon');
assert.strictEqual(toon.ok, true);
assert.strictEqual(toon.target, '16,7,8,10');
assert.strictEqual(toon.txs.length, 1);
assert.strictEqual(toon.txs[0].to, ETH.ADDR.TOON);
assert.strictEqual(toon.txs[0].data, ABI.call(ABI.SEL.add4, [16n, 7n, 8n, 10n]));
assert.ok(toon.txs[0].data.startsWith('0xe022d77c'));
assert.strictEqual(toon.txs[0].value, '0x0');
assert.strictEqual(toon.royalty, '0');
assert.deepStrictEqual(toon.owned, ['10', '16']);
assert.strictEqual(toon.shares[1].owned, null);
assert.strictEqual(toon.shares[1].holder, '');
assert.strictEqual(toon.shares[2].owned, null);
assert.ok(toon.note.indexOf('free') !== -1);
assert.ok(toon.note.indexOf('WORD and FACE') !== -1);

const spent = AGENT.plan(user, { math: '16', word: '5', face: '8', rgb: '9' }, snap());
check(spent);
assert.strictEqual(spent.ok, false);
assert.ok(spent.note.indexOf('word already in TOON #1.') !== -1);
assert.strictEqual(spent.txs.length, 1);
assert.strictEqual(spent.txs[0].value, '0x0');

const missing = AGENT.plan(stranger, { math: '16', word: '7', face: '8', rgb: '10' }, snap());
assert.strictEqual(missing.ok, false);
assert.ok(missing.note.indexOf('does not hold MATH #16') !== -1);
assert.ok(missing.note.indexOf('does not hold RGB #10') !== -1);
assert.strictEqual(missing.wallet, stranger);

const same = AGENT.plan(user, { math: '1', word: '5', face: '6', rgb: '9' }, snap());
check(same);
assert.strictEqual(same.exists, true);
assert.deepStrictEqual(same.txs, []);
assert.deepStrictEqual(same.owned, ['1', '9']);

assert.throws(function () { AGENT.plan('0x1234', '3', snap()); }, /wallet/);
assert.throws(function () { AGENT.plan(user, { r: '1', g: '2' }, snap()); }, /target/);
assert.throws(function () { AGENT.plan(user, { math: '1', word: '2' }, snap()); }, /target/);
assert.throws(function () { AGENT.plan(user, '0', snap()); }, /target/);
assert.throws(function () { AGENT.plan(user, '3', { math: [] }); }, /snapshot/);

const raw = JSON.parse(fs.readFileSync(__dirname + '/index.json', 'utf8'));
const live = AGENT.plan('0x' + '11'.repeat(20), '3', raw);
assert.strictEqual(live.v, 1);
assert.strictEqual(live.kind, 'math');
assert.strictEqual(live.target, '3');
assert.strictEqual(typeof live.block, 'number');
JSON.stringify(live);
if (live.exists) assert.strictEqual(live.txs.length, 0);
else {
  assert.ok(live.txs.length > 0);
  assert.strictEqual(live.txs[0].to, ETH.ADDR.MATH);
  assert.ok(live.txs[0].data.startsWith('0x771602f7'));
  assert.strictEqual(live.txs[0].value, '0x' + PLAN.MSG_MATH.toString(16));
}
const row = raw.rgb[0];
const hit = AGENT.plan(user, { r: row[2], g: row[3], b: row[4] }, raw);
assert.strictEqual(hit.exists, true);
assert.strictEqual(hit.txs.length, 0);
const toonRow = raw.toon[0];
const toonHit = AGENT.plan(user, { math: toonRow[0], word: toonRow[2], face: toonRow[3], rgb: toonRow[4] }, raw);
assert.strictEqual(toonHit.exists, true);
assert.strictEqual(toonHit.txs.length, 0);

const example = {
  math: AGENT.plan(user, '3', snap()),
  rgb: AGENT.plan(user, { r: '8', g: '16', b: '32' }, snap()),
  toon: AGENT.plan(user, { math: '16', word: '7', face: '8', rgb: '10' }, snap()),
};
assert.deepStrictEqual(JSON.parse(fs.readFileSync(__dirname + '/agents/example.json', 'utf8')), example);

console.log('plan.test.js ok');
