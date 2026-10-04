const assert = require('assert');
require('./planner');
require('./rules');
const P = global.PLAN;
const S = require('./suggest');

const user = '0xabcabcabcabcabcabcabcabcabcabcabcabcabca';
const stranger = '0xdefdefdefdefdefdefdefdefdefdefdefdefdefd';
const blocked = '0xbadbadbadbadbadbadbadbadbadbadbadbadbadb';

function supply(rows) {
  const map = new Map();
  rows.forEach(function (row) { map.set(row[0], row[1]); });
  return map;
}

assert.strictEqual(S.fieldFree('', null), true);
assert.strictEqual(S.fieldFree('  ', '1'), true);
assert.strictEqual(S.fieldFree('4', '4'), true);
assert.strictEqual(S.fieldFree('4', '5'), false);
assert.strictEqual(S.fieldFree('1', null), false);

const gas = 7n;
const owned = {
  supply: supply([
    [1n, user],
    [2n, user],
    [3n, user],
    [8n, stranger],
  ]),
  user: user,
  blocked: new Set(),
  gasWei: gas,
  owned: [1n, 2n, 3n, 8n],
  example: false,
};
const first = S.mathPair(owned, {});
assert.deepStrictEqual([first.a, first.b], [1n, 3n]);
assert.strictEqual(first.net, gas);
assert.strictEqual(S.mathOk(owned, 1n, 3n), true);
assert.strictEqual(S.mathOk(owned, 1n, 2n), false);
const second = S.mathPair(owned, { cursor: first });
assert.deepStrictEqual([second.a, second.b], [2n, 2n]);
assert.ok(second.net < P.fold([1n, 8n], owned).net);

const held = {
  supply: supply([[2n, user], [4n, blocked], [8n, user]]),
  user: user,
  blocked: new Set([blocked]),
  gasWei: gas,
  owned: [2n, 4n, 8n],
  example: false,
};
assert.deepStrictEqual([S.mathPair(held, {}).a, S.mathPair(held, {}).b], [2n, 8n]);
assert.strictEqual(S.mathPair({
  supply: supply([[1n, user], [2n, user]]),
  user: user,
  blocked: new Set(),
  gasWei: 0n,
  owned: [1n],
  example: false,
}, {}), null);

const example = S.mathPair({
  supply: supply([[1n, stranger], [4n, stranger]]),
  user: '0x0000000000000000000000000000000000000000',
  blocked: new Set(),
  gasWei: 0n,
  example: true,
}, {});
assert.deepStrictEqual([example.a, example.b], [1n, 1n]);
assert.strictEqual(S.mathPair({
  supply: supply([[1n, stranger]]),
  user: user,
  blocked: new Set(),
  gasWei: 0n,
  owned: [],
  example: false,
}, {}), null);
const locked = S.mathPair(owned, { lockA: '2' });
assert.deepStrictEqual([locked.a, locked.b], [2n, 2n]);
assert.strictEqual(S.mathPair(owned, { lockA: 'nope' }), null);

const by = {
  r: new Map([[1n, 9n]]),
  g: new Map(),
  b: new Map([[3n, 9n]]),
};
const ids = [1n, 2n, 3n];
let n = 0;
const seq = [0, 0.9, 0];
const triple = S.rgbTriple({
  ids: ids,
  supply: supply([[1n, user], [2n, user], [3n, user]]),
  blocked: new Set(),
  by: by,
}, {
  rand: function () { return seq[n++]; },
});
assert.deepStrictEqual(triple, { r: 2n, g: 3n, b: 1n });
assert.strictEqual(S.rgbTriple({
  ids: [1n],
  supply: supply([[1n, user]]),
  blocked: new Set(),
  by: { r: new Map([[1n, 1n]]), g: new Map(), b: new Map() },
}, {}), null);
const again = S.rgbTriple({
  ids: ids,
  supply: supply([[1n, user], [2n, stranger], [3n, user]]),
  blocked: new Set([stranger]),
  by: { r: new Map(), g: new Map(), b: new Map() },
}, { avoid: { r: 1n, g: 1n, b: 1n }, rand: function () { return 0; } });
assert.deepStrictEqual(again, { r: 3n, g: 3n, b: 3n });

const toonCtx = {
  maths: [5n, 9n, 4n],
  words: [2n, 1n],
  faces: [3n],
  rgbs: [4n, 7n],
  used: {
    math: new Map([[4n, 4n]]),
    word: new Map([[2n, 4n]]),
    face: new Map(),
    rgb: new Map([[4n, 4n]]),
  },
};
const toon = S.toonTuple(toonCtx, {});
assert.deepStrictEqual(toon, { math: 5n, word: 1n, face: 3n, rgb: 7n });
const toon2 = S.toonTuple(toonCtx, { cursor: toon });
assert.deepStrictEqual(toon2, { math: 9n, word: 1n, face: 3n, rgb: 7n });
assert.strictEqual(S.toonTuple(toonCtx, { cursor: toon2 }), null);
assert.strictEqual(S.toonTuple(toonCtx, { lock: { word: '2' } }), null);

assert.strictEqual(S.channelFree('0', null, false), true);
assert.strictEqual(S.channelFree('0', null, true), false);
assert.strictEqual(S.channelFree('1084', null, false), false);
assert.strictEqual(S.channelFree('', null, true), true);

const exampleHint = { value: '1', example: true };
assert.strictEqual(S.hintFree('1', exampleHint, true, false), true);
assert.strictEqual(S.hintFree('536', { value: '536', example: true }, true, false), true);
assert.strictEqual(S.hintFree('9', exampleHint, true, false), false);
assert.strictEqual(S.hintFree('1', exampleHint, false, true), false);
assert.strictEqual(S.hintFree('5', { value: '5', example: true }, false, false), false);

const armed = { r: '65537', g: '6', b: '7' };
const armedOwns = { r: false, g: true, b: true };
assert.strictEqual(S.keepParts(armed, { r: '65537', g: '6', b: '7' }, armedOwns, true), true);
assert.strictEqual(S.keepParts(armed, { r: '9', g: '6', b: '7' }, armedOwns, true), true);
assert.strictEqual(S.keepParts(armed, { r: '65537', g: '1', b: '7' }, armedOwns, true), false);
assert.strictEqual(S.keepParts(armed, armed, armedOwns, false), false);
assert.strictEqual(S.keepParts(null, armed, armedOwns, true), false);
assert.strictEqual(S.hintFree('1', exampleHint, true, true), true);
assert.strictEqual(S.hintFree('1', null, false, false), false);

const skipped = Object.assign({}, owned, { skip: new Set([4n]) });
assert.deepStrictEqual([S.mathPair(skipped, {}).a, S.mathPair(skipped, {}).b], [2n, 3n]);
const planeSkip = S.rgbTriple({
  ids: ids,
  supply: supply([[1n, user], [2n, user], [3n, user]]),
  blocked: new Set(),
  by: { r: new Map(), g: new Map(), b: new Map() },
  skip: new Set([1n]),
}, { rand: function () { return 0; } });
assert.ok(planeSkip.r !== 1n && planeSkip.g !== 1n && planeSkip.b !== 1n);

const busy = S.busyIds([
  { kind: 'math', step: { result: 4n } },
  { kind: 'rgb', r: 8n, g: 9n, b: 10n },
  { status: 'submitted', result: 11n },
  { status: 'confirmed', result: 12n },
  { status: 'failed', result: 18n },
  { label: '1 + 2 = 13', status: 'pending' },
  { label: 'RGB.add 14, 15, 16', status: 'submitted' },
  { sum: 17n },
]);
[4n, 8n, 9n, 10n, 11n, 13n, 14n, 15n, 16n, 17n].forEach(function (id) {
  assert.ok(busy.has(id), String(id));
});
assert.strictEqual(busy.has(12n), false);
assert.strictEqual(busy.has(18n), false);
const flight = S.flightSums([
  { label: '1 + 2 = 13', status: 'submitted', hash: '0x' + 'ab'.repeat(32) },
  { label: '4 + 4 = 8', status: 'confirmed' },
  { label: 'RGB.add 14, 15, 16', status: 'pending' },
], { '0x11': '99' });
assert.ok(flight.has(13n));
assert.ok(flight.has(99n));
assert.ok(flight.has(14n) && flight.has(15n) && flight.has(16n));
assert.strictEqual(flight.has(8n), false);

let scans = 0;
const wide = supply([[1n, stranger], [4n, stranger], [6n, stranger]]);
const origEach = wide.forEach.bind(wide);
wide.forEach = function (fn) { scans++; return origEach(fn); };
const wideCtx = {
  supply: wide,
  user: '0x0000000000000000000000000000000000000000',
  blocked: new Set(),
  gasWei: 0n,
  example: true,
};
S.mathPair(wideCtx, {});
S.mathPair(wideCtx, { cursor: { a: 1n, b: 1n } });
assert.strictEqual(scans, 1);
wide.set(8n, stranger);
S.mathPair(wideCtx, {});
assert.strictEqual(scans, 2);

console.log('suggest.test.js ok');
