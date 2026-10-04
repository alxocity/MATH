const assert = require('assert');
const T = require('./token');

assert.deepStrictEqual(T.parse('#math/536'), { kind: 'math', id: 536n });
assert.deepStrictEqual(T.parse('#rgb/12'), { kind: 'rgb', id: 12n });
assert.deepStrictEqual(T.parse('#toon/1973'), { kind: 'toon', id: 1973n });
assert.deepStrictEqual(T.parse('math/536'), { kind: 'math', id: 536n });
assert.strictEqual(T.parse('#browse'), null);
assert.strictEqual(T.parse('#math/'), null);
assert.strictEqual(T.parse('#math/nope'), null);
assert.strictEqual(T.parse('#foo/1'), null);
assert.strictEqual(T.parse(''), null);

assert.strictEqual(T.href('math', 536n), '#math/536');
assert.strictEqual(T.path('rgb', '12'), 'rgb/12');
assert.strictEqual(T.idLink('math', 4n), '<a href="#math/4">4</a>');
assert.strictEqual(T.sumHtml(1n, 3n, 4n), '<a href="#math/1">1</a> + <a href="#math/3">3</a> = <a href="#math/4">4</a>');
assert.strictEqual(T.planesHtml(8n, 9n, 10n), '<a href="#math/8">8</a>, <a href="#math/9">9</a>, <a href="#math/10">10</a>');
assert.strictEqual(T.labelHtml('1 + 3 = 4'), T.sumHtml(1, 3, 4));
assert.strictEqual(T.labelHtml('RGB.add 8, 9, 10'), 'RGB.add ' + T.planesHtml(8, 9, 10));
assert.strictEqual(T.labelHtml('pending'), '');

assert.strictEqual(T.mean(15n, 2n), '7.5');
assert.strictEqual(T.mean(2n, 2n), '1');
const one = T.mathTraits(1n);
assert.strictEqual(one.find(function (t) { return t.type === '1_count'; }).value, '1');
assert.strictEqual(one.find(function (t) { return t.type === '0_count'; }).value, '0');
assert.strictEqual(one.find(function (t) { return t.type === 'digit_count'; }).value, '1');
assert.strictEqual(one.find(function (t) { return t.type === 'digit_mean'; }).value, '1');
assert.strictEqual(one.find(function (t) { return t.type === 'digit_sum'; }).value, '1');
assert.strictEqual(one.find(function (t) { return t.type === 'parity'; }).value, 'odd');
assert.deepStrictEqual(one.filter(function (t) { return t.type === 'fancy'; }).map(function (t) { return t.value; }), ['palindromic', 'strobogrammatic']);
const sixty = T.mathTraits(69n);
assert.strictEqual(sixty.find(function (t) { return t.type === 'digit_mean'; }).value, '7.5');
assert.strictEqual(sixty.find(function (t) { return t.type === 'parity'; }).value, 'odd');
assert.deepStrictEqual(sixty.filter(function (t) { return t.type === 'fancy'; }).map(function (t) { return t.value; }), ['strobogrammatic']);

const pairs = T.parents(4n, [1n, 2n, 3n, 4n, 8n]);
assert.deepStrictEqual(pairs, [{ a: 1n, b: 3n }, { a: 2n, b: 2n }]);
assert.deepStrictEqual(T.parents(1n, [1n]), []);
assert.deepStrictEqual(T.parents(5n, [2n, 2n]), []);

console.log('token.test.js ok');
