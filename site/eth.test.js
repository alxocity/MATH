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
  block: 1,
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
assert.strictEqual(inv.block, 1);
assert.ok(inv.blocked.has(owner));

const stringBlock = JSON.parse(localStorage.getItem('math.site.v1'));
stringBlock.block = '1';
localStorage.setItem('math.site.v1', JSON.stringify(stringBlock));
assert.strictEqual(ETH.readCache(), null);
localStorage.setItem('math.site.v1', JSON.stringify(raw));

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
assert.strictEqual(typeof rawSnap.block, 'number');
assert.ok(Number.isSafeInteger(rawSnap.block) && rawSnap.block > 0);
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
assert.strictEqual(packed.block, 9);
assert.strictEqual(typeof packed.math[0][1], 'number');
assert.strictEqual(ETH.unpack(packed).math[1].owner, other);
assert.strictEqual(ETH.unpack(packed).block, 9);
packed.block = '9';
assert.strictEqual(ETH.unpack(packed), null);
packed.block = 9.5;
assert.strictEqual(ETH.unpack(packed), null);
packed.block = -1;
assert.strictEqual(ETH.unpack(packed), null);
packed.block = NaN;
assert.strictEqual(ETH.unpack(packed), null);
packed.block = Infinity;
assert.strictEqual(ETH.unpack(packed), null);
packed.block = 9;
const index = packed.math[0][1];
packed.math[0][1] = String(index);
assert.strictEqual(ETH.unpack(packed), null);
packed.math[0][1] = 1.5;
assert.strictEqual(ETH.unpack(packed), null);
packed.math[0][1] = -1;
assert.strictEqual(ETH.unpack(packed), null);
packed.math[0][1] = index;
assert.strictEqual(ETH.unpack(packed).words.size, 0);
assert.strictEqual(ETH.unpack(packed).faces.size, 0);
const named = ETH.pack({
  block: 9,
  math: [],
  rgb: [],
  toon: [{ id: 3n, owner: owner, word: 951n, face: 2131n, rgb: 2n }],
  words: new Map([[951n, 'kaigani'], [4558n, 'golden'], [114n, 'coin']]),
  faces: new Map([[2131n, '|x|']]),
}, null);
const namedInv = ETH.unpack(named);
assert.strictEqual(namedInv.words.get(951n), 'kaigani');
assert.strictEqual(namedInv.words.get(4558n), 'golden');
assert.strictEqual(namedInv.words.get(114n), 'coin');
assert.strictEqual(namedInv.faces.get(2131n), '|x|');
named.words['951'] = 1;
assert.strictEqual(ETH.unpack(named), null);
const limited = ETH.pack({
  block: 1,
  math: [],
  rgb: [],
  toon: [],
  words: new Map([[1n, 'a']]),
  faces: new Map(),
}, null);
const fit = JSON.parse(JSON.stringify(limited));
fit.words['1'] = 'x'.repeat(256);
assert.strictEqual(ETH.unpack(fit).words.get(1n).length, 256);
const id78 = '9'.repeat(78);
fit.words[id78] = 'z';
assert.strictEqual(ETH.unpack(fit).words.get(BigInt(id78)), 'z');
const longText = JSON.parse(JSON.stringify(limited));
longText.words['1'] = 'x'.repeat(257);
assert.strictEqual(ETH.unpack(longText), null);
const longKey = JSON.parse(JSON.stringify(limited));
longKey.words['1' + '0'.repeat(78)] = 'z';
assert.strictEqual(ETH.unpack(longKey), null);

const down = [
  '0x074068d4690c2ae7dfe5ffd9cb85575745b6c55c',
  '0x1ded2d5bb13205833a7ad2c65e28c578a172b5ae',
];

function jsonResponse(payload) {
  return { status: 200, json: function () { return Promise.resolve(payload); } };
}

(async function () {
  const realFetch = global.fetch;
  const merged = await ETH.fillTexts(
    new Map([[951n, 'poison'], [114n, 'coin']]),
    [951n, 114n],
    ETH.ADDR.WORD,
    ABI.SEL.getWord,
    null,
    'WORD',
    new Map([[951n, 'kaigani']])
  );
  assert.strictEqual(merged.get(951n), 'kaigani');
  assert.strictEqual(merged.get(114n), 'coin');

  global.fetch = function () { return Promise.resolve(jsonResponse({ error: { code: -32000, message: 'header not found' } })); };
  const failed = await ETH.scanBlocked(down);
  assert.strictEqual(failed.blocked.size, 0);
  assert.strictEqual(failed.unknown.size, 2);
  const failedResult = ETH.scanResult(failed);
  assert.strictEqual(failedResult.blockedDone, false);
  assert.strictEqual(failedResult.blocked.size, 0);
  down.forEach(function (a) {
    assert.ok(!failedResult.blocked.has(a));
    assert.ok(failedResult.unknown.has(a));
  });
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
  const knownWords = [[951n, 'kaigani'], [4558n, 'golden'], [114n, 'coin']];
  for (let i = 0; i < knownWords.length; i++) {
    const id = knownWords[i][0];
    const text = await ETH.readString(ETH.ADDR.WORD, ABI.SEL.getWord, id);
    assert.strictEqual(text, knownWords[i][1]);
    assert.strictEqual(snap.words.get(id), knownWords[i][1]);
  }
  const face = await ETH.readString(ETH.ADDR.FACE, ABI.SEL.getFace, 2131n);
  assert.ok(face.length > 0);
  assert.strictEqual(snap.faces.get(2131n), face);
  console.log('eth.test.js ok');
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
