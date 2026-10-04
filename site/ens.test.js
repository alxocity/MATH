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

(async function () {
  ENS.want(vitalik);
  await ENS.flush();
  assert.strictEqual(ENS.cached(vitalik), 'vitalik.eth');
  const fwd = await ENS.resolveForward('Vitalik.eth');
  assert.strictEqual(fwd, vitalik);
  console.log('ens.test.js ok');
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
