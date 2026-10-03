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

const rawSnap = JSON.parse(fs.readFileSync(__dirname + '/index.json', 'utf8'));
assert.ok(Array.isArray(rawSnap.owners) && rawSnap.owners.length > 0 && rawSnap.owners.length < 200);
assert.strictEqual(typeof rawSnap.math[0][1], 'number');
assert.ok(/^\d+$/.test(rawSnap.block));
const snap = ETH.unpack(rawSnap);
assert.ok(snap);
assert.ok(snap.math.length > 8000);
assert.ok(snap.rgb.length > 0);
assert.ok(snap.toon.length > 0);
assert.strictEqual(snap.blockedDone, false);
assert.strictEqual(snap.blocked.size, 0);
assert.ok(/^0x[0-9a-f]{40}$/.test(snap.math[0].owner));

const other = '0x' + 'cd'.repeat(20);
const packed = ETH.pack({
  block: '9',
  math: [{ id: 1n, owner: owner }, { id: 2n, owner: other }],
  rgb: [],
  toon: [],
}, null);
assert.strictEqual(packed.owners.length, 2);
assert.strictEqual(typeof packed.math[0][1], 'number');
assert.strictEqual(ETH.unpack(packed).math[1].owner, other);
packed.block = 'nope';
assert.strictEqual(ETH.unpack(packed), null);
packed.block = '';
assert.strictEqual(ETH.unpack(packed), null);

const down = [
  '0x074068d4690c2ae7dfe5ffd9cb85575745b6c55c',
  '0x1ded2d5bb13205833a7ad2c65e28c578a172b5ae',
];

function jsonResponse(payload) {
  return { status: 200, json: function () { return Promise.resolve(payload); } };
}

(async function () {
  const realFetch = global.fetch;

  global.fetch = function () { return Promise.resolve(jsonResponse({ error: { code: -32000, message: 'header not found' } })); };
  const failed = await ETH.scanBlocked(down);
  assert.strictEqual(failed.blocked.size, 0);
  assert.strictEqual(failed.unknown.size, 2);
  const failedResult = ETH.scanResult(failed);
  assert.strictEqual(failedResult.blockedDone, false);
  down.forEach(function (a) { assert.ok(failedResult.blocked.has(a)); });
  const before = localStorage.getItem('math.site.v1');
  assert.strictEqual(ETH.cacheScan({
    block: '1',
    math: down.map(function (o, i) { return { id: BigInt(i + 1), owner: o }; }),
    rgb: [],
    toon: [],
  }, failedResult), false);
  assert.strictEqual(localStorage.getItem('math.site.v1'), before);

  global.fetch = function () { return Promise.reject(new Error('offline')); };
  const thrown = await ETH.scanBlocked(down);
  assert.strictEqual(thrown.unknown.size, 2);
  assert.strictEqual(thrown.blocked.size, 0);
  assert.strictEqual(ETH.scanResult(thrown).blockedDone, false);

  global.fetch = function (url, opts) {
    const body = JSON.parse(opts.body);
    if (body.method === 'eth_getCode') return Promise.resolve(jsonResponse({ result: '0x60016000' }));
    return Promise.resolve(jsonResponse({ error: { code: -32003, message: 'out of gas: gas required exceeds: 23300' } }));
  };
  const oog = await ETH.scanBlocked([down[0]]);
  assert.ok(oog.blocked.has(down[0]));
  assert.strictEqual(oog.unknown.size, 0);
  assert.strictEqual(ETH.scanResult(oog).blockedDone, true);

  global.fetch = function () { return Promise.resolve(jsonResponse({ result: '0x' })); };
  const eoa = await ETH.scanBlocked([down[0]]);
  assert.strictEqual(eoa.blocked.size, 0);
  assert.strictEqual(eoa.unknown.size, 0);
  const eoaResult = ETH.scanResult(eoa);
  assert.strictEqual(eoaResult.blockedDone, true);
  assert.strictEqual(ETH.cacheScan({
    block: '1',
    math: [{ id: 1n, owner: down[0] }],
    rgb: [],
    toon: [],
  }, eoaResult), true);
  const cached = ETH.readCache();
  assert.strictEqual(cached.blockedDone, true);
  assert.strictEqual(cached.blocked.size, 0);

  global.fetch = realFetch;
  console.log('eth.test.js ok');
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
