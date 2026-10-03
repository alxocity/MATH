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

console.log('eth.test.js ok');
