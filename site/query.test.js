const assert = require('assert');
const QUERY = require('./query');

const raw = '?a=1&b=02&n=15&R=0&G=4&B=5&math=7&word=0&face=2&rgb=9&preset=Math&extra=no';
const q = QUERY.read(raw);
assert.strictEqual(q.a, '1');
assert.strictEqual(q.b, '2');
assert.strictEqual(q.n, '15');
assert.strictEqual(q.R, '0');
assert.strictEqual(q.G, '4');
assert.strictEqual(q.B, '5');
assert.strictEqual(q.math, '7');
assert.strictEqual(q.word, '0');
assert.strictEqual(q.face, '2');
assert.strictEqual(q.rgb, '9');
assert.strictEqual(q.preset, 'math');
assert.strictEqual(QUERY.write('', q), '?a=1&b=2&n=15&R=0&G=4&B=5&math=7&word=0&face=2&rgb=9&preset=math');

assert.strictEqual(QUERY.read('?a=0&b=-1&n=x&preset=../math').a, '');
assert.strictEqual(QUERY.read('?a=0').b, '');
assert.strictEqual(QUERY.read('?preset=../math').preset, '');
assert.strictEqual(QUERY.write('?a=1&b=2', { b: '', n: '3' }), '?a=1&n=3');
assert.strictEqual(QUERY.write('?a=1', { a: 'nope' }), '');
assert.strictEqual(QUERY.href({ pathname: '/', search: '?a=1', hash: '#mint' }, { b: '2' }), '/?a=1&b=2#mint');
assert.strictEqual(QUERY.href({ pathname: '/ens/', search: '', hash: '' }, { preset: 'math' }), '/ens/?preset=math');

const maxUint = (2n ** 256n - 1n).toString();
assert.strictEqual(maxUint.length, 78);
assert.strictEqual(QUERY.digits(maxUint), maxUint);
assert.strictEqual(QUERY.digits((2n ** 256n).toString()), '');
assert.strictEqual(QUERY.digits('1' + maxUint), '');
assert.strictEqual(QUERY.read('?n=' + maxUint).n, maxUint);
assert.strictEqual(QUERY.read('?a=' + (2n ** 256n).toString()).a, '');
assert.strictEqual(QUERY.read('?b=' + ('1'.repeat(79))).b, '');
assert.strictEqual(QUERY.digits(''), '');
assert.strictEqual(QUERY.digits(null), '');
assert.strictEqual(QUERY.digits('00'), '');
assert.strictEqual(QUERY.digits('00', true), '0');
assert.strictEqual(QUERY.digits('0'), '');
assert.strictEqual(QUERY.digits('007'), '7');
assert.strictEqual(QUERY.read('?a=00').a, '');
assert.strictEqual(QUERY.read('?R=00').R, '0');
assert.strictEqual(QUERY.read('?n=').n, '');

console.log('query.test.js ok');
