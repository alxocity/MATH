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

console.log('suggest.test.js ok');
