const assert = require('assert');
const fs = require('fs');
global.ABI = require('./abi');
const store = {};
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
};
eval(fs.readFileSync(__dirname + '/eth.js', 'utf8'));
global.PLAN = require('./planner');
const AGENT = require('./plan');

const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ZERO = '0x0000000000000000000000000000000000000000';
const alice = '0x' + '11'.repeat(20);
const bob = '0x' + '22'.repeat(20);
const carol = '0x' + '33'.repeat(20);
const dave = '0x' + '44'.repeat(20);
const user = '0x' + 'ab'.repeat(20);

function jsonResponse(payload) {
  return { status: 200, json: function () { return Promise.resolve(payload); } };
}

function encodeReturn(datas) {
  const heads = [];
  const bodies = [];
  let cursor = datas.length * 32;
  datas.forEach(function (data) {
    const bytes = String(data).replace(/^0x/, '').toLowerCase();
    const len = bytes.length / 2;
    const pad = bytes.padEnd(Math.ceil(bytes.length / 64) * 64, '0');
    const body = ABI.word(1) + ABI.word(0x40) + ABI.word(len) + pad;
    heads.push(ABI.word(cursor));
    bodies.push(body);
    cursor += body.length / 2;
  });
  return '0x' + ABI.word(0x20) + ABI.word(datas.length) + heads.join('') + bodies.join('');
}

function topicAddr(a) {
  return '0x' + String(a).toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

function topicId(id) {
  return '0x' + BigInt(id).toString(16).padStart(64, '0');
}

function transferLog(from, to, id, block, index) {
  return {
    blockNumber: '0x' + Number(block).toString(16),
    logIndex: '0x' + Number(index).toString(16),
    topics: [TRANSFER, topicAddr(from), topicAddr(to), topicId(id)],
  };
}

function supplies(mathN, rgbN, toonN) {
  return encodeReturn(['0x' + ABI.word(mathN), '0x' + ABI.word(rgbN), '0x' + ABI.word(toonN)]);
}

const sample = ABI.decodeAggregate(encodeReturn(['0x' + ABI.word(1), '0x' + ABI.word(2)]));
assert.strictEqual(sample[0].success, true);
assert.strictEqual(ABI.decodeUint(sample[0].data), 1n);
assert.strictEqual(ABI.decodeUint(sample[1].data), 2n);
assert.strictEqual(ABI.decodeAddr('0x' + ABI.addr(user)), user);

const rows = [{ id: 7n, owner: alice }];
ETH.applyTransfers(rows, [
  transferLog(ZERO, bob, 8, 2, 0),
  transferLog(alice, bob, 7, 1, 1),
]);
assert.strictEqual(rows[0].owner, bob);
assert.strictEqual(rows.length, 2);
assert.strictEqual(rows[1].id, 8n);
assert.strictEqual(rows[1].owner, bob);

const rgb = [{ id: 1n, owner: alice, r: 1n, g: 2n, b: 3n }];
ETH.applyTransfers(rgb, [transferLog(ZERO, bob, 9, 1, 0)], { mint: false });
assert.strictEqual(rgb.length, 1);
assert.strictEqual(rgb[0].owner, alice);
assert.strictEqual(rgb[0].r, 1n);

(async function () {
  const seen = [];
  global.fetch = function (url, opts) {
    const body = JSON.parse(opts.body);
    assert.strictEqual(body.method, 'eth_getLogs');
    const p = body.params[0];
    const from = Number(BigInt(p.fromBlock));
    const to = Number(BigInt(p.toBlock));
    seen.push([from, to]);
    assert.strictEqual(p.topics[0], TRANSFER);
    if (to - from > 10) {
      return Promise.resolve(jsonResponse({ error: { code: -32005, message: 'block range too large' } }));
    }
    const id = from === 1 ? 7 : 8;
    const holder = from === 1 ? alice : bob;
    return Promise.resolve(jsonResponse({ result: [transferLog(ZERO, holder, id, from, 0)] }));
  };
  const logs = await ETH.getTransferLogs(ETH.ADDR.MATH, 1, 21);
  assert.ok(seen.some(function (p) { return p[0] === 1 && p[1] === 11; }));
  assert.ok(seen.some(function (p) { return p[0] === 12 && p[1] === 21; }));
  assert.ok(seen.some(function (p) { return p[1] - p[0] > 10; }));
  assert.strictEqual(logs.length, 2);
  assert.strictEqual(logs[0].topics[3], topicId(7));
  assert.strictEqual(logs[1].topics[3], topicId(8));

  seen.length = 0;
  global.fetch = function (url, opts) {
    const body = JSON.parse(opts.body);
    const p = body.params[0];
    const from = Number(BigInt(p.fromBlock));
    const to = Number(BigInt(p.toBlock));
    seen.push(to - from + 1);
    if (to - from + 1 > 2000) {
      return Promise.resolve(jsonResponse({ error: { message: 'block range too large' } }));
    }
    return Promise.resolve(jsonResponse({ result: [] }));
  };
  const wide = await ETH.getTransferLogs(ETH.ADDR.MATH, 1, 4001);
  assert.strictEqual(wide.length, 0);
  assert.ok(seen.length >= 2);
  seen.forEach(function (span) { assert.ok(span <= 2000); });

  const word = '0x' + '55'.repeat(20);
  const face = '0x' + '66'.repeat(20);
  const base = {
    block: 100,
    math: [{ id: 7n, owner: alice }],
    rgb: [{ id: 1n, owner: alice, r: 1n, g: 2n, b: 3n }],
    toon: [{ id: 4n, owner: alice, word: 0n, face: 0n, rgb: 1n }],
    words: new Map([[0n, 'yo']]),
    faces: new Map([[0n, ':)']]),
    wordOwners: [word],
    faceOwners: [face],
  };
  const bodies = [];
  global.fetch = function (url, opts) {
    const body = JSON.parse(opts.body);
    bodies.push(JSON.stringify(body));
    if (body.method === 'eth_blockNumber') return Promise.resolve(jsonResponse({ result: '0x65' }));
    if (body.method === 'eth_getLogs') {
      const addr = String(body.params[0].address).toLowerCase();
      if (addr === ETH.ADDR.MATH.toLowerCase()) {
        return Promise.resolve(jsonResponse({ result: [
          transferLog(alice, bob, 7, 101, 1),
          transferLog(ZERO, bob, 8, 101, 0),
        ] }));
      }
      if (addr === ETH.ADDR.WORD.toLowerCase()) {
        return Promise.resolve(jsonResponse({ result: [transferLog(word, bob, 0, 101, 0)] }));
      }
      return Promise.resolve(jsonResponse({ result: [] }));
    }
    if (body.method === 'eth_call') {
      const to = String(body.params[0].to).toLowerCase();
      const data = String(body.params[0].data || '');
      if (to === ETH.ADDR.MULTI.toLowerCase()) return Promise.resolve(jsonResponse({ result: supplies(1, 1, 1) }));
      if (data === '0x' + ABI.SEL.totalSupply) return Promise.resolve(jsonResponse({ result: '0x' + ABI.word(1) }));
    }
    throw new Error('unexpected ' + body.method);
  };
  const inv = await ETH.loadDelta(base);
  assert.strictEqual(base.math[0].owner, alice);
  assert.strictEqual(base.wordOwners[0], word);
  assert.strictEqual(inv.math[0].id, 7n);
  assert.strictEqual(inv.math[0].owner, bob);
  assert.strictEqual(inv.math[1].id, 8n);
  assert.strictEqual(inv.math[1].owner, bob);
  assert.strictEqual(inv.rgb[0].owner, alice);
  assert.strictEqual(inv.rgb[0].r, 1n);
  assert.strictEqual(inv.toon[0].word, 0n);
  assert.deepStrictEqual(inv.wordOwners, [bob]);
  assert.deepStrictEqual(inv.faceOwners, [face]);
  assert.strictEqual(inv.block, 101);
  const blob = bodies.join('\n');
  assert.strictEqual(blob.indexOf(ABI.SEL.ownerOf), -1);
  assert.strictEqual(blob.indexOf(ABI.SEL.tokenByIndex), -1);

  const bare = {
    block: 100,
    math: [['1', user]],
    rgb: [['2', user, '3', '4', '5']],
    toon: [],
  };
  const missing = AGENT.plan(user, { math: '1', word: '0', face: '0', rgb: '2' }, bare);
  assert.strictEqual(missing.ok, false);
  assert.ok(missing.note.indexOf('WORD/FACE owners are not in the snapshot') !== -1);
  const unpacked = ETH.unpack(bare);
  assert.strictEqual(unpacked.wordOwners, null);
  assert.strictEqual(unpacked.faceOwners, null);
  global.fetch = function (url, opts) {
    const body = JSON.parse(opts.body);
    if (body.method === 'eth_blockNumber') return Promise.resolve(jsonResponse({ result: '0x64' }));
    if (body.method === 'eth_call') {
      const to = String(body.params[0].to).toLowerCase();
      if (to === ETH.ADDR.WORD.toLowerCase() || to === ETH.ADDR.FACE.toLowerCase()) throw new Error('part read');
      if (to === ETH.ADDR.MULTI.toLowerCase()) return Promise.resolve(jsonResponse({ result: supplies(1, 1, 0) }));
    }
    if (body.method === 'eth_getLogs') throw new Error('logs');
    throw new Error('unexpected ' + body.method);
  };
  const quiet = await ETH.loadDelta(unpacked);
  assert.strictEqual(quiet.wordOwners, null);
  assert.strictEqual(quiet.faceOwners, null);
  assert.strictEqual(quiet.math[0].owner, user);

  let step = 0;
  global.fetch = function (url, opts) {
    const body = JSON.parse(opts.body);
    const data = String(body.params[0].data || '');
    if (data === '0x' + ABI.SEL.totalSupply) return Promise.resolve(jsonResponse({ result: '0x' + ABI.word(1) }));
    step++;
    if (step % 2 === 1) return Promise.resolve(jsonResponse({ result: encodeReturn(['0x' + ABI.word(0)]) }));
    return Promise.resolve(jsonResponse({ result: encodeReturn(['0x' + ABI.addr(user)]) }));
  };
  const filled = await ETH.ensurePartOwners(quiet);
  assert.deepStrictEqual(filled.wordOwners, [user]);
  assert.deepStrictEqual(filled.faceOwners, [user]);
  const packed = ETH.pack(filled, new Set());
  const ready = AGENT.plan(user, { math: '1', word: '0', face: '0', rgb: '2' }, packed);
  assert.strictEqual(ready.ok, true);
  assert.strictEqual(ready.kind, 'toon');
  assert.strictEqual(ready.target, '1,0,0,2');

  const siteKey = 'math.site.v1';
  localStorage.setItem(siteKey, '{"keep":true}');
  const before = localStorage.getItem(siteKey);
  let codes = 0;
  global.fetch = function (url, opts) {
    const body = JSON.parse(opts.body);
    assert.strictEqual(body.method, 'eth_getCode');
    codes++;
    assert.strictEqual(String(body.params[0]).toLowerCase(), bob);
    return Promise.resolve(jsonResponse({ result: '0x' }));
  };
  const held = {
    block: 50,
    blockedDone: true,
    blocked: new Set([carol]),
    math: [{ id: 1n, owner: alice }, { id: 2n, owner: carol }],
  };
  const first = ETH.scanResult(await ETH.catchHolders([alice, carol, bob], held, null, 60));
  assert.strictEqual(codes, 1);
  assert.strictEqual(first.blockedDone, true);
  assert.ok(first.blocked.has(carol));
  assert.ok(!first.blocked.has(alice));
  assert.ok(!first.blocked.has(bob));
  const second = await ETH.catchHolders([alice, carol, bob], held, null, 61);
  assert.strictEqual(codes, 1);
  assert.ok(second.blocked.has(carol));
  assert.strictEqual(localStorage.getItem(siteKey), before);
  const cached = JSON.parse(localStorage.getItem('math.holders.v1'));
  assert.strictEqual(cached.holders[bob].flag, 'clear');
  assert.strictEqual(cached.holders[bob].block, 60);
  assert.strictEqual(cached.holders[carol].flag, 'blocked');
  assert.strictEqual(cached.block, 61);

  let misses = 0;
  global.fetch = function () {
    misses++;
    return Promise.resolve(jsonResponse({ error: { code: -32000, message: 'header not found' } }));
  };
  const failed = ETH.scanResult(await ETH.catchHolders([dave], { block: 1, blockedDone: false, math: [], blocked: new Set() }, null, 9));
  assert.strictEqual(failed.blockedDone, false);
  assert.ok(failed.unknown.has(dave));
  const again = await ETH.catchHolders([dave], { block: 1, blockedDone: false, math: [], blocked: new Set() }, null, 9);
  assert.ok(again.unknown.has(dave));
  assert.ok(misses >= 2);
  const afterFail = JSON.parse(localStorage.getItem('math.holders.v1'));
  assert.ok(!afterFail.holders[dave]);

  console.log('delta.test.js ok');
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
