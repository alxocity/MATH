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

assert.deepStrictEqual(P.SWATCHES.map(function (sw) { return sw.name; }), [
  'black', 'red', 'green', 'blue', 'yellow', 'magenta', 'cyan', 'white',
]);
assert.strictEqual(P.SWATCHES.length, 8);
const seenBits = {};
P.SWATCHES.forEach(function (sw) {
  assert.strictEqual(typeof P.COL[sw.ch], 'number');
  assert.strictEqual(seenBits[P.COL[sw.ch]], undefined);
  seenBits[P.COL[sw.ch]] = sw.name;
});
assert.strictEqual(Object.keys(seenBits).length, 8);
const blank = Array.from({ length: 16 }, function () { return 'kkkkkkkkkkkkkkkk'; });
P.SWATCHES.forEach(function (sw) {
  const rows = P.paintCell(blank, 0, sw.ch);
  const bit = P.COL[sw.ch];
  const planes = P.gridToPlanes(rows);
  assert.strictEqual(rows[0][0], sw.ch);
  assert.strictEqual(blank[0][0], 'k');
  assert.strictEqual(planes.R, (bit & 4) ? 1n << 255n : 0n);
  assert.strictEqual(planes.G, (bit & 2) ? 1n << 255n : 0n);
  assert.strictEqual(planes.B, (bit & 1) ? 1n << 255n : 0n);
  assert.strictEqual(P.paintCell(rows, 0, sw.ch), rows);
});
assert.throws(function () { P.paintCell(blank, 0, 'q'); }, /palette/);
assert.throws(function () { P.paintCell(blank, 256, 'r'); }, /grid/);
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
assert.strictEqual(P.popcount(2n), 1);
assert.strictEqual(P.popcount(4n), 1);
assert.strictEqual(P.popcount(8n), 1);
assert.strictEqual(P.channelTag(1n), '1');
assert.strictEqual(P.channelTag(2n), '2');
assert.strictEqual(P.channelTag(4n), '4');
assert.strictEqual(P.channelTag(8n), '8');
assert.strictEqual(P.channelTag(100000000n), '100000000');
const nearA = 101331771248505046160055760990721661926188008979951677663145697618389970780160n;
const nearB = 101331771248505046160055760990721661926188010277708979948948604697532247900160n;
assert.strictEqual(P.channelTag(nearA), '10133…80160');
assert.strictEqual(P.channelTag(nearB), '10133…00160');
assert.notStrictEqual(P.channelTag(nearA), P.channelTag(nearB));

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

function chainOk(steps, supply) {
  const have = new Set();
  supply.forEach(function (_, id) { have.add(id.toString()); });
  const seen = new Set();
  steps.forEach(function (s) {
    const key = s.result.toString();
    assert.strictEqual(s.exists, false);
    assert.ok(have.has(s.a.toString()), 'missing input ' + s.a);
    assert.ok(have.has(s.b.toString()), 'missing input ' + s.b);
    assert.strictEqual(have.has(key), false, 'remint ' + key);
    assert.strictEqual(seen.has(key), false, 'duplicate ' + key);
    seen.add(key);
    have.add(key);
  });
}

function looseRgb(ids, c) {
  const have = new Set();
  c.supply.forEach(function (_, id) { have.add(id); });
  const steps = [];
  ids.forEach(function (id) {
    P.plan(id, c).steps.forEach(function (step) {
      if (step.exists || have.has(step.result)) {
        have.add(step.result);
        return;
      }
      steps.push(step);
      have.add(step.result);
    });
  });
  return steps;
}

function looseNet(steps, ids, c) {
  let royalty = 0n;
  const minted = new Set();
  steps.forEach(function (s) {
    royalty += s.royalty;
    minted.add(s.result);
  });
  let rgbRoyalty = 0n;
  ids.forEach(function (id) {
    const owner = c.supply.get(id);
    const held = owner && String(owner).toLowerCase() === c.user.toLowerCase();
    if (!held && !minted.has(id)) rgbRoyalty += P.RGB_ROY;
  });
  const gas = c.gasWei * BigInt(steps.length);
  const rgbGas = (c.gasWei * P.G_RGB) / P.G_ADD;
  return royalty + rgbRoyalty + gas + rgbGas;
}

// User holds 8. Strangers hold 1, 2, and 4. 11 alone pays both 1 and 2.
// Minting 3 first makes 11 = 8 + 3, so that royalty is not paid again.
const stackSupply = new Map([
  [1n, stranger],
  [2n, stranger],
  [4n, stranger],
  [8n, user],
]);
const stackIds = [11n, 3n, 8n];
['cheapest', 'fewest'].forEach(function (mode) {
  const c = { mode: mode, user: user, gasWei: 0n, blocked: new Set(), supply: stackSupply };
  const built = P.planRgb(stackIds, c);
  const alone = looseRgb(stackIds, c);
  chainOk(built.steps, stackSupply);
  assert.ok(built.net < looseNet(alone, stackIds, c));
  assert.ok(built.mints < alone.length);
  assert.strictEqual(built.royalty, 2n * P.ROY_WEI);
  assert.ok(looseNet(alone, stackIds, c) - built.net >= 2n * P.ROY_WEI);
  assert.deepStrictEqual(built.names, ['G', 'R', 'B']);
  assert.strictEqual(built.reordered, true);
  assert.strictEqual(built.tried, 6);
  const why = mode === 'fewest' ? 'shorter' : 'cheaper';
  assert.strictEqual(built.note, 'order G, R, B is ' + why + '.');
  assert.deepStrictEqual(built.steps.map(function (s) { return s.result; }), [3n, 11n]);
  const hop = built.steps[1];
  assert.strictEqual(hop.a + hop.b, 11n);
  assert.ok(hop.a === 3n || hop.b === 3n);
  assert.strictEqual(hop.royalty, 0n);
  assert.strictEqual(hop.payTo[0], user);
  assert.strictEqual(hop.payTo[1], user);
  [3n, 11n, 8n].forEach(function (id) {
    const held = stackSupply.get(id) === user || built.steps.some(function (s) { return s.result === id; });
    assert.strictEqual(held, true);
  });
});

const sameOrder = P.planRgb([3n, 11n, 8n], {
  mode: 'cheapest',
  user: user,
  gasWei: 0n,
  blocked: new Set(),
  supply: stackSupply,
});
assert.strictEqual(sameOrder.reordered, false);
assert.strictEqual(sameOrder.note, '');
assert.deepStrictEqual(sameOrder.steps.map(function (s) { return s.result; }), [3n, 11n]);

// G == B. The second Y is not minted again, and the repeated value drops two orders.
const yy = P.planRgb([6n, 6n, 3n], {
  mode: 'cheapest',
  user: user,
  gasWei: 1n,
  blocked: new Set(),
  supply: new Map([[1n, user]]),
});
chainOk(yy.steps, new Map([[1n, user]]));
assert.strictEqual(yy.tried, 3);
assert.strictEqual(yy.mints, 3);
assert.deepStrictEqual(yy.steps.map(function (s) { return s.result; }), [2n, 3n, 6n]);
const yyy = P.planRgb([6n, 6n, 6n], {
  mode: 'fewest',
  user: user,
  gasWei: 1n,
  blocked: new Set(),
  supply: new Map([[1n, user]]),
});
assert.strictEqual(yyy.tried, 1);
assert.deepStrictEqual(yyy.steps.map(function (s) { return s.result; }), [2n, 3n, 6n]);

// 3 is already minted. A later channel may use it, and must not mint it again.
const have3 = new Map([[1n, user], [2n, user], [3n, user]]);
const reused = P.planRgb([3n, 6n, 7n], {
  mode: 'cheapest',
  user: user,
  gasWei: 1n,
  blocked: new Set(),
  supply: have3,
});
chainOk(reused.steps, have3);
assert.ok(reused.steps.every(function (s) { return s.result !== 3n; }));
assert.ok(reused.steps.some(function (s) { return s.a === 3n || s.b === 3n; }));

// 2 already exists, so the route's 1+1=2 step is not a mint. 4 then reuses 3.
const throughSupply = new Map([[1n, user], [2n, blockedOwner]]);
const through = P.planRgb([3n, 4n, 1n], {
  mode: 'cheapest',
  user: user,
  gasWei: 0n,
  blocked: new Set([blockedOwner]),
  supply: throughSupply,
});
chainOk(through.steps, throughSupply);
assert.ok(through.steps.every(function (s) { return s.result !== 2n && s.exists === false; }));
assert.ok(through.steps.some(function (s) { return s.result === 3n; }));
assert.ok(through.steps.some(function (s) { return s.a === 3n || s.b === 3n; }));

assert.throws(function () {
  P.planRgb([7n, 2n, 8n], {
    mode: 'fewest',
    user: user,
    gasWei: 0n,
    blocked: new Set(),
    supply: new Map([[8n, user], [6n, user]]),
  });
}, /no route/);

// fewest pays the stranger for one mint of 7. cheapest builds 7 from the 3 it just minted.
const splitSupply = new Map([[1n, user], [6n, stranger]]);
const splitGas = P.ROY_WEI / 10n;
const splitIds = [3n, 7n, 1n];
const cheapSplit = P.planRgb(splitIds, {
  mode: 'cheapest',
  user: user,
  gasWei: splitGas,
  blocked: new Set(),
  supply: splitSupply,
});
const fewSplit = P.planRgb(splitIds, {
  mode: 'fewest',
  user: user,
  gasWei: splitGas,
  blocked: new Set(),
  supply: splitSupply,
});
chainOk(cheapSplit.steps, splitSupply);
chainOk(fewSplit.steps, splitSupply);
assert.strictEqual(cheapSplit.royalty, 0n);
assert.strictEqual(fewSplit.royalty, P.ROY_WEI);
assert.ok(fewSplit.mints < cheapSplit.mints);
assert.ok(cheapSplit.net < fewSplit.net);
assert.ok(fewSplit.steps.some(function (s) { return s.a === 6n || s.b === 6n; }));
assert.ok(cheapSplit.steps.every(function (s) { return s.a !== 6n && s.b !== 6n; }));
const cheapAlone = looseRgb(splitIds, {
  mode: 'cheapest',
  user: user,
  gasWei: splitGas,
  blocked: new Set(),
  supply: splitSupply,
});
assert.ok(cheapSplit.net < looseNet(cheapAlone, splitIds, {
  user: user,
  gasWei: splitGas,
  supply: splitSupply,
}));

console.log('planner.test.js ok');
