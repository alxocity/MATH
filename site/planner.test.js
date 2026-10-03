const assert = require('assert');
const fs = require('fs');
const ABI = require('./abi');
const P = require('./planner');

const MATH = '0x6B4fccdd888Bb6fD3934A9e49eF64dfd2c0D8e6D';
const RGB = '0x9355Fb9693ffF9bB6f06721C82fe0B5F49E6c956';

const ONE = '0x82ad56cb0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000006b4fccdd888bb6fd3934a9e49ef64dfd2c0d8e6d00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000418160ddd00000000000000000000000000000000000000000000000000000000';
const TWO = '0x82ad56cb00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000e00000000000000000000000006b4fccdd888bb6fd3934a9e49ef64dfd2c0d8e6d00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000418160ddd000000000000000000000000000000000000000000000000000000000000000000000000000000009355fb9693fff9bb6f06721c82fe0b5f49e6c95600000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000418160ddd00000000000000000000000000000000000000000000000000000000';
const RET = '0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000001f6d';

const supplyCall = { to: MATH, allow: true, data: '0x18160ddd' };
assert.strictEqual(ABI.encodeAggregate([supplyCall]), ONE);
assert.strictEqual(ABI.encodeAggregate([supplyCall, { to: RGB, allow: true, data: '0x18160ddd' }]), TWO);
const decoded = ABI.decodeAggregate(RET);
assert.strictEqual(decoded.length, 1);
assert.strictEqual(decoded[0].success, true);
assert.strictEqual(ABI.decodeUint(decoded[0].data), 8045n);

function hexWord(n) {
  return BigInt(n).toString(16).padStart(64, '0');
}
assert.strictEqual(ABI.decodeString('0x' + hexWord(32) + hexWord(2) + Buffer.from('hi').toString('hex').padEnd(64, '0')), 'hi');
assert.strictEqual(ABI.decodeString('0x' + hexWord(64) + hexWord(0) + hexWord(3) + Buffer.from('yes').toString('hex').padEnd(64, '0')), 'yes');
assert.strictEqual(ABI.decodeString('0x' + hexWord(32) + hexWord(0)), '');
assert.strictEqual(ABI.decodeString('0x'), '');
assert.throws(function () { ABI.decodeString('0x' + hexWord(32) + hexWord(10)); }, /string/);

const shape = P.gridToPlanes(P.HEART_SHAPE);
assert.strictEqual(shape.R, 388020662578203110061909499714095932521374137981715049621480747944640512n);
assert.strictEqual(shape.G, 0n);
assert.strictEqual(shape.B, 0n);
assert.deepStrictEqual(P.planesToRows(shape.R, 0n, 0n), P.HEART_SHAPE);
assert.strictEqual(P.popcount(shape.R), P.HEART_SHAPE.join('').split('').filter(function (c) { return c === 'r'; }).length);
assert.strictEqual(P.isPow2(8n), true);
assert.strictEqual(P.isPow2(6n), false);
assert.strictEqual(P.isPal(121n), true);
assert.strictEqual(P.isPal(12n), false);
assert.strictEqual(P.isStrobo(1n), true);
assert.strictEqual(P.isStrobo(8n), true);
assert.strictEqual(P.isStrobo(69n), true);
assert.strictEqual(P.isStrobo(96n), true);
assert.strictEqual(P.isStrobo(609n), true);
assert.strictEqual(P.isStrobo(2n), false);
assert.strictEqual(P.isStrobo(121n), false);
assert.strictEqual(P.isStrobo(10n), false);
assert.strictEqual(P.popcount(7n), 3);

const user = '0xabcabcabcabcabcabcabcabcabcabcabcabcabca';
const stranger = '0xdefdefdefdefdefdefdefdefdefdefdefdefdefd';
const blockedOwner = '0xbadbadbadbadbadbadbadbadbadbadbadbadbadb';

function ctx(mode) {
  return {
    mode: mode,
    user: user,
    gasWei: 0n,
    blocked: new Set([blockedOwner]),
    supply: new Map([
      [1n, user],
      [2n, user],
      [4n, blockedOwner],
      [8n, stranger],
    ]),
  };
}

function leavesOk(route) {
  assert.strictEqual(route.target, 15n);
  assert.strictEqual(route.exists, false);
  assert.ok(!route.pieces.includes(4n));
  assert.strictEqual(route.pieces.reduce(function (s, n) { return s + n; }, 0n), 15n);
  route.steps.forEach(function (s) {
    assert.notStrictEqual(s.payTo[0], blockedOwner);
    assert.notStrictEqual(s.payTo[1], blockedOwner);
  });
}

const few15 = P.plan(15n, ctx('fewest'));
leavesOk(few15);
assert.strictEqual(few15.mints, 4);
assert.strictEqual(few15.royalty, P.ROY_WEI);
assert.ok(few15.pieces.includes(8n));

const viaUnknown = P.plan(15n, Object.assign(ctx('fewest'), {
  blocked: new Set(),
  unknown: new Set([blockedOwner]),
}));
leavesOk(viaUnknown);

const cheap15 = P.plan(15n, ctx('cheapest'));
leavesOk(cheap15);
assert.strictEqual(cheap15.royalty, 0n);
assert.ok(cheap15.mints > few15.mints);

const pricey = P.plan(15n, Object.assign(ctx('cheapest'), { gasWei: 10n ** 16n }));
leavesOk(pricey);
assert.strictEqual(pricey.mints, 4);
assert.strictEqual(pricey.royalty, P.ROY_WEI);

const again = P.plan(1n, ctx('fewest'));
assert.strictEqual(again.exists, true);
assert.strictEqual(again.owner, user);
assert.strictEqual(again.mints, 0);
assert.deepStrictEqual(again.steps, []);

const pinned = P.planWithPins(15n, [8n], ctx('fewest'));
assert.strictEqual(pinned.target, 15n);
assert.strictEqual(pinned.pieces[0], 8n);
assert.ok(!pinned.pieces.includes(4n));

const wide = P.plan(8193n, {
  mode: 'fewest',
  user: user,
  gasWei: 0n,
  blocked: new Set(),
  supply: new Map([[1n, user], [8192n, user]]),
});
assert.deepStrictEqual(wide.pieces, [8192n, 1n]);
assert.strictEqual(wide.mints, 1);
assert.strictEqual(wide.royalty, 0n);

const rich = {
  mode: 'cheapest',
  user: user,
  gasWei: 1n,
  blocked: new Set(),
  supply: new Map([
    [1n, user],
    [2n, user],
    [4n, stranger],
    [5n, stranger],
  ]),
};
const cheap = P.plan(6n, rich);
const few = P.plan(6n, Object.assign({}, rich, { mode: 'fewest' }));
assert.strictEqual(cheap.mints, 2);
assert.strictEqual(cheap.royalty, 0n);
assert.strictEqual(few.mints, 1);
assert.ok(few.royalty > 0n);

const owned = P.fold([1n, 2n], { supply: new Map([[1n, user], [2n, user]]), user: user, gasWei: 0n, blocked: new Set() });
assert.strictEqual(owned.target, 3n);
assert.strictEqual(owned.mints, 1);
assert.strictEqual(owned.royalty, 0n);
assert.strictEqual(owned.steps[0].exists, false);

global.ABI = ABI;
const ETH = require('./eth');
const snap = ETH.unpack(JSON.parse(fs.readFileSync(__dirname + '/index.json', 'utf8')));
assert.ok(snap);
const supply = new Map();
const usedR = new Set();
const usedG = new Set();
const usedB = new Set();
snap.math.forEach(function (t) { supply.set(t.id, t.owner); });
snap.rgb.forEach(function (t) {
  usedR.add(t.r);
  usedG.add(t.g);
  usedB.add(t.b);
});
function heartCtx(extra) {
  return Object.assign({
    mode: 'fewest',
    user: '0x0000000000000000000000000000000000000001',
    gasWei: 0n,
    blocked: new Set(),
    unknown: new Set(),
    supply: supply,
    usedR: usedR,
    usedG: usedG,
    usedB: usedB,
  }, extra || {});
}

function assertHeart(pick) {
  assert.ok(pick);
  assert.strictEqual(pick.R & shape.R, shape.R);
  assert.strictEqual(pick.G & shape.R, 0n);
  assert.strictEqual(pick.B & shape.R, 0n);
  assert.notStrictEqual(pick.G, pick.B);
  assert.strictEqual(P.popcount(pick.G), 1);
  assert.strictEqual(P.popcount(pick.B), 1);
  assert.strictEqual(usedR.has(pick.R), false);
  assert.strictEqual(usedG.has(pick.G), false);
  assert.strictEqual(usedB.has(pick.B), false);
  assert.ok(pick.mints <= 40);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (P.HEART_SHAPE[y][x] === 'r') assert.strictEqual(pick.rows[y][x], 'r');
    }
  }
}

const low = P.pickHeart(heartCtx(), function () { return 0; });
const high = P.pickHeart(heartCtx(), function () { return 0.999; });
assertHeart(low);
assertHeart(high);
assert.ok(low.R !== high.R || low.G !== high.G || low.B !== high.B);

const blockedBit = 256n;
const blockedHolder = supply.get(blockedBit);
assert.ok(blockedHolder);
const avoided = P.pickHeart(heartCtx({
  blocked: new Set([blockedHolder]),
  unknown: new Set([String(supply.get(512n)).toLowerCase()]),
}), function () { return 0.4; });
assertHeart(avoided);
assert.strictEqual(avoided.G === blockedBit || avoided.B === blockedBit, false);
assert.strictEqual((avoided.R & blockedBit) === 0n, true);
assert.strictEqual(avoided.G === 512n || avoided.B === 512n, false);
assert.strictEqual((avoided.R & 512n) === 0n, true);

assert.strictEqual(P.pickHeart(heartCtx({ usedR: { has: function () { return true; } } }), Math.random), null);
assert.strictEqual(P.pickHeart(heartCtx({ usedG: { has: function () { return true; } } }), Math.random), null);

const everyone = new Set();
supply.forEach(function (owner) { everyone.add(owner); });
assert.strictEqual(P.pickHeart(heartCtx({ blocked: everyone }), Math.random), null);

console.log('planner.test.js ok');
