const assert = require('assert');
const fs = require('fs');
global.ABI = require('./abi');
const store = {};
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
};
eval(fs.readFileSync(__dirname + '/eth.js', 'utf8'));

const owner = '0x' + 'ab'.repeat(20);
const raw = {
  block: '1',
  math: [['1', owner]],
  rgb: [['2', owner, '1', '1', '1']],
  toon: [['3', owner, '4', '5', '2']],
  blocked: [owner],
  blockedDone: true,
};
localStorage.setItem('math.site.v1', JSON.stringify(raw));
const inv = ETH.readCache();
assert.strictEqual(inv.math[0].owner, owner);
assert.strictEqual(inv.math[0].id, 1n);
assert.ok(inv.blocked.has(owner));

raw.math[0][1] = '<img src=x>';
localStorage.setItem('math.site.v1', JSON.stringify(raw));
assert.strictEqual(ETH.readCache(), null);

raw.math[0][1] = '0x' + 'AB'.repeat(20);
localStorage.setItem('math.site.v1', JSON.stringify(raw));
assert.strictEqual(ETH.readCache(), null);

raw.math[0][1] = owner;
raw.blocked = ['not-an-address'];
localStorage.setItem('math.site.v1', JSON.stringify(raw));
assert.strictEqual(ETH.readCache(), null);

assert.ok(ETH.RPCS.length >= 2);
ETH.RPCS.forEach(function (u) { assert.ok(/^https:\/\//.test(u)); });
assert.strictEqual(ETH.rpcRetryable(200, { code: 3, message: 'execution reverted' }), false);
assert.strictEqual(ETH.rpcRetryable(200, { code: -32003, message: 'out of gas: gas required exceeds: 23300' }), false);
assert.strictEqual(ETH.rpcRetryable(429, null), true);
assert.strictEqual(ETH.rpcRetryable(200, { code: -32603, message: 'Internal error' }), true);

const longer = { math: [1, 2], rgb: [], toon: [], blockedDone: false };
const scanned = { math: [1], rgb: [], toon: [], blockedDone: true };
assert.strictEqual(ETH.preferIndex(longer, scanned), longer);
assert.strictEqual(ETH.preferIndex(null, scanned), scanned);
assert.strictEqual(ETH.preferIndex(scanned, { math: [1], rgb: [], toon: [], blockedDone: false }), scanned);

const snap = ETH.unpack(JSON.parse(fs.readFileSync(__dirname + '/index.json', 'utf8')));
assert.ok(snap);
assert.ok(snap.math.length > 8000);
assert.ok(snap.rgb.length > 0);
assert.ok(snap.toon.length > 0);
assert.strictEqual(snap.blockedDone, false);
assert.strictEqual(snap.blocked.size, 0);

console.log('eth.test.js ok');
