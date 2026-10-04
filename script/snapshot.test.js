const assert = require('assert');
const fs = require('fs');
global.ABI = require('../site/abi');
const store = {};
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
};
eval(fs.readFileSync(__dirname + '/../site/eth.js', 'utf8'));
const snap = require('./snapshot');

const owner = '0x' + 'ab'.repeat(20);
function inv(extra) {
  const words = new Map([[4n, 'cow']]);
  const faces = new Map([[5n, ':-)']]);
  return Object.assign({
    block: 9,
    math: [{ id: 1n, owner: owner }],
    rgb: [{ id: 2n, owner: owner, r: 1n, g: 1n, b: 1n }],
    toon: [{ id: 3n, owner: owner, word: 4n, face: 5n, rgb: 2n }],
    words: words,
    faces: faces,
  }, extra || {});
}

snap.assertInventory(inv());
assert.throws(function () { snap.assertInventory(inv({ block: null })); }, /block/);
assert.throws(function () {
  const bad = inv();
  bad.words = new Map();
  snap.assertInventory(bad);
}, /WORD/);
assert.throws(function () {
  snap.assertInventory(inv(), { math: [{}, {}], rgb: [{}], toon: [{}] });
}, /short MATH/);
assert.throws(function () {
  const bad = inv();
  bad.rgb[0].g = null;
  snap.assertInventory(bad);
}, /RGB/);

const packed = ETH.pack(inv(), null);
delete packed.blocked;
delete packed.blockedDone;
const later = JSON.parse(JSON.stringify(packed));
later.block = packed.block + 10;
assert.strictEqual(snap.sameBody(packed, later), true);
later.math.push(['9', 0]);
assert.strictEqual(snap.sameBody(packed, later), false);

const raw = JSON.parse(fs.readFileSync(__dirname + '/../site/index.json', 'utf8'));
const round = ETH.pack(ETH.unpack(raw), null);
delete round.blocked;
delete round.blockedDone;
assert.strictEqual(snap.sameBody(raw, round), true);

console.log('snapshot.test.js ok');
