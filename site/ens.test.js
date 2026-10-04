const assert = require('assert');
const fs = require('fs');
global.ABI = require('./abi');
const store = {};
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
};
eval(fs.readFileSync(__dirname + '/eth.js', 'utf8'));
const ENS = require('./ens');

assert.strictEqual(ENS.keccakText(''), 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
assert.strictEqual(ENS.namehash(''), '0'.repeat(64));
assert.strictEqual(ENS.namehash('eth'), '93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae');
assert.strictEqual(ENS.namehash('foo.eth'), 'de9b09fd7c5f901e23a3f19fecc54828e9c848539801e86591bd9801b019f84f');
assert.strictEqual(ENS.namehash('vitalik.eth'), 'ee6c4522aab0003e8d14cd40a6af439055fd2577951148c14b6cea9a53475835');
assert.strictEqual(ENS.dnsEncode('vitalik.eth'), '07766974616c696b0365746800');
assert.ok(ENS.reverseData('0xd8da6bf26964af9d7eed9e03e53415d37aa96045').indexOf('5d78a217') === 2);
assert.strictEqual(ENS.isName('vitalik.eth'), true);
assert.strictEqual(ENS.isName('vita'), false);
assert.strictEqual(ENS.isName('1.5'), false);

const vitalik = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045';
assert.strictEqual(ENS.ownerHit(vitalik, 'd8da', '', ''), true);
assert.strictEqual(ENS.ownerHit(vitalik, 'vita', 'vitalik.eth', ''), true);
assert.strictEqual(ENS.ownerHit(vitalik, 'vitalik.eth', '', vitalik), true);
assert.strictEqual(ENS.ownerHit(vitalik, 'other.eth', 'vitalik.eth', ''), false);
assert.deepStrictEqual(ENS.mathFlags(new Set(['r']), false), { free: ['g', 'b'], toon: true });
assert.deepStrictEqual(ENS.mathFlags(new Set(['r', 'g', 'b']), true), { free: [], toon: false });

function hexWord(n) {
  return BigInt(n).toString(16).padStart(64, '0');
}

function strReturn(s) {
  const bytes = Buffer.from(s, 'utf8').toString('hex');
  const body = hexWord(bytes.length / 2) + bytes.padEnd(Math.ceil(bytes.length / 64) * 64, '0');
  return '0x' + hexWord(0x60) + hexWord(1) + hexWord(2) + body;
}

function addrReturn(addr) {
  return '0x' + hexWord(0x40) + hexWord(1) + hexWord(32) + addr.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}

function agg(items) {
  const blobs = items.map(function (it) {
    const h = it.data.replace(/^0x/, '');
    const len = h.length / 2;
    const pad = h.padEnd(Math.ceil(h.length / 64) * 64, '0');
    return hexWord(it.ok ? 1 : 0) + hexWord(0x40) + hexWord(len) + pad;
  });
  let cursor = items.length * 32;
  const offsets = blobs.map(function (b) {
    const o = hexWord(cursor);
    cursor += b.length / 2;
    return o;
  });
  return '0x' + hexWord(0x20) + hexWord(items.length) + offsets.join('') + blobs.join('');
}

assert.strictEqual(ABI.decodeString(strReturn('ok.eth')), 'ok.eth');
assert.strictEqual(ENS.decodeAddr(addrReturn(vitalik)), vitalik);

(async function () {
  const realCall = ETH.ethCall;
  const victim = '0x1111111111111111111111111111111111111111';
  const zw = '0x2222222222222222222222222222222222222222';
  const huge = '0x3333333333333333333333333333333333333333';
  const long = '0x4444444444444444444444444444444444444444';
  const good = '0x5555555555555555555555555555555555555555';
  let step = 0;
  ETH.ethCall = async function () {
    step += 1;
    if (step === 1) return agg([{ ok: true, data: addrReturn(victim) }]);
    if (step === 2) {
      return agg([
        { ok: true, data: strReturn('bad\u200b.eth') },
        { ok: true, data: strReturn('a'.repeat(100000) + '.eth') },
        { ok: true, data: strReturn('b'.repeat(64) + '.eth') },
        { ok: true, data: strReturn('v\u0456talik.eth') },
        { ok: true, data: strReturn('ok-name.eth') },
      ]);
    }
    if (step === 3) return agg([{ ok: true, data: addrReturn(good) }]);
    throw new Error('unexpected eth_call ' + step);
  };

  const fwd = await ENS.resolveForward('scam-support.eth');
  assert.strictEqual(fwd, victim);
  assert.strictEqual(ENS.cached(victim), '');
  assert.strictEqual(ENS.known(victim), false);
  assert.strictEqual(ENS.forwardCached('scam-support.eth'), victim);
  const saved = JSON.parse(store['math.ens.v1'] || '{}');
  assert.strictEqual(JSON.stringify(saved.names || {}).indexOf('scam-support'), -1);

  const cyr = '0x6666666666666666666666666666666666666666';
  ENS.want(zw);
  ENS.want(huge);
  ENS.want(long);
  ENS.want(cyr);
  ENS.want(good);
  await ENS.flush();
  assert.strictEqual(step, 3);
  assert.strictEqual(ENS.cached(zw), '');
  assert.strictEqual(ENS.cached(huge), '');
  assert.strictEqual(ENS.cached(long), '');
  assert.strictEqual(ENS.cached(cyr), '');
  assert.strictEqual(ENS.cached(good), 'ok-name.eth');
  assert.ok(ENS.label(zw).indexOf('bad') === -1);
  assert.ok(ENS.label(huge).indexOf('aaaa') === -1);

  ETH.ethCall = realCall;

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const ok = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const big = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const hid = '0xcccccccccccccccccccccccccccccccccccccccc';
  const homo = '0xdddddddddddddddddddddddddddddddddddddddd';
  const old = '0xabababababababababababababababababababab';
  const legacy = '0xcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd';
  store['math.ens.v1'] = JSON.stringify({
    names: {
      [ok]: { n: 'ok.eth', at: now },
      [big]: { n: 'a'.repeat(100000) + '.eth', at: now },
      [hid]: { n: 'bad\u200b.eth', at: now },
      [homo]: { n: 'v\u0456talik.eth', at: now },
      [old]: { n: 'old.eth', at: now - 8 * day },
      [legacy]: 'legacy.eth',
    },
    forward: {
      'ok.eth': { a: ok, at: now },
      'old.eth': { a: old, at: now - 8 * day },
    },
  });
  delete require.cache[require.resolve('./ens')];
  const ENS2 = require('./ens');
  assert.strictEqual(ENS2.cached(ok), 'ok.eth');
  assert.strictEqual(ENS2.cached(big), '');
  assert.strictEqual(ENS2.known(big), false);
  assert.strictEqual(ENS2.cached(hid), '');
  assert.strictEqual(ENS2.cached(homo), '');
  assert.strictEqual(ENS2.cached(old), '');
  assert.strictEqual(ENS2.known(old), false);
  assert.strictEqual(ENS2.cached(legacy), '');
  assert.strictEqual(ENS2.forwardCached('ok.eth'), ok);
  assert.strictEqual(ENS2.hasForward('old.eth'), false);

  ENS.want(vitalik);
  await ENS.flush();
  assert.strictEqual(ENS.cached(vitalik), 'vitalik.eth');
  const live = await ENS.resolveForward('Vitalik.eth');
  assert.strictEqual(live, vitalik);
  console.log('ens.test.js ok');
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
