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

const heart = P.gridToPlanes(P.HEART);
assert.strictEqual(heart.R, 388020662578203110061909499714095932521374137981715049621480747944640512n);
assert.strictEqual(heart.G, 256n);
assert.strictEqual(heart.B, 512n);
assert.deepStrictEqual(P.planesToRows(heart.R, heart.G, heart.B), P.HEART);
assert.strictEqual(P.popcount(heart.R), P.HEART.join('').split('').filter(function (c) { return 'rymw'.includes(c); }).length);
assert.strictEqual(P.isPow2(8n), true);
assert.strictEqual(P.isPow2(6n), false);
assert.strictEqual(P.isPal(121n), true);
assert.strictEqual(P.isPal(12n), false);
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
assert.strictEqual(supply.has(heart.R), false);
assert.strictEqual(usedR.has(heart.R), false);
assert.strictEqual(supply.has(heart.G), true);
assert.strictEqual(supply.has(heart.B), true);
assert.strictEqual(usedR.has(heart.G) || usedG.has(heart.G) || usedB.has(heart.G), false);
assert.strictEqual(usedR.has(heart.B) || usedG.has(heart.B) || usedB.has(heart.B), false);
const heartCtx = {
  mode: 'fewest',
  user: '0x0000000000000000000000000000000000000001',
  gasWei: 0n,
  blocked: new Set(),
  supply: supply,
};
const heartRoute = P.plan(heart.R, heartCtx);
assert.strictEqual(heartRoute.exists, false);
assert.strictEqual(heartRoute.pieces.reduce(function (s, n) { return s + n; }, 0n), heart.R);
assert.ok(heartRoute.mints > 0);
assert.strictEqual(P.plan(heart.G, heartCtx).exists, true);
assert.strictEqual(P.plan(heart.B, heartCtx).exists, true);

console.log('planner.test.js ok');
