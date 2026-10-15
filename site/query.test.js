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
assert.strictEqual(QUERY.write('', { R: '0', G: '0', B: '0' }), '?R=0&G=0&B=0');
assert.strictEqual(QUERY.read('?R=0&G=&B=4').G, '');
assert.strictEqual(QUERY.hasPlanes({ R: '0', G: '0', B: '0' }), true);
assert.strictEqual(QUERY.hasPlanes({ R: '', G: '', B: '' }), false);

const blank = { R: '', G: '', B: '' };
const drawn = { R: '5', G: '3', B: '2' };
assert.deepStrictEqual(QUERY.choosePlanes(blank, null), { source: '', planes: null });
assert.deepStrictEqual(QUERY.choosePlanes(blank, { R: '5', G: '3', B: '2' }), { source: 'store', planes: drawn });
assert.deepStrictEqual(QUERY.choosePlanes(drawn, null), { source: 'url', planes: drawn });
assert.deepStrictEqual(QUERY.choosePlanes(drawn, { R: '9', G: '3', B: '2' }), { source: 'url', planes: drawn });
assert.deepStrictEqual(QUERY.choosePlanes({ R: '0', G: '0', B: '0' }, null).planes, { R: '0', G: '0', B: '0' });

function memory() {
  const data = {};
  return {
    data: data,
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
  };
}
const mem = memory();
QUERY.writeStore(mem, { R: '5', G: '03', B: '2' });
QUERY.writeStore(mem, { a: '1', b: '2', preset: 'Math' });
const saved = QUERY.readStore(mem);
assert.strictEqual(JSON.parse(mem.data[QUERY.URL_KEY]).G, '3');
assert.strictEqual(JSON.parse(mem.data[QUERY.URL_KEY]).preset, 'math');
const fromStore = QUERY.restoreBag('', saved);
assert.strictEqual(fromStore.sources.rgb, 'store');
assert.strictEqual(fromStore.sources.mint, 'store');
assert.strictEqual(fromStore.sources.ens, 'store');
assert.strictEqual(fromStore.sources.route, '');
assert.strictEqual(fromStore.values.R, '5');
assert.strictEqual(fromStore.values.G, '3');
assert.strictEqual(fromStore.values.a, '1');
assert.strictEqual(fromStore.values.preset, 'math');
const urlWins = QUERY.restoreBag('?R=9&G=1&B=4', saved);
assert.strictEqual(urlWins.sources.rgb, 'url');
assert.strictEqual(urlWins.values.R, '9');
assert.strictEqual(urlWins.values.G, '1');
assert.strictEqual(urlWins.sources.mint, 'store');
assert.strictEqual(urlWins.values.a, '1');
assert.deepStrictEqual(QUERY.storePatch(urlWins, ['mint', 'route', 'rgb', 'toon']), { a: '1', b: '2' });
assert.deepStrictEqual(QUERY.storePatch(fromStore, ['ens']), { preset: 'math' });
assert.strictEqual(
  QUERY.shareHref({ origin: 'https://math.alxo.city', pathname: '/', search: '', hash: '#rgb' }, drawn),
  'https://math.alxo.city/?R=5&G=3&B=2#rgb'
);
assert.strictEqual(
  QUERY.shareHref({ origin: 'https://math.alxo.city', pathname: '/', search: '?a=1', hash: '#rgb' }, { R: '5', G: '0', B: '2' }),
  'https://math.alxo.city/?a=1&R=5&G=0&B=2#rgb'
);
assert.strictEqual(
  QUERY.shareHref({ origin: 'https://math.alxo.city', pathname: '/ens/', search: '', hash: '' }, { preset: 'math' }),
  'https://math.alxo.city/ens/?preset=math'
);
const zeros = memory();
QUERY.writeStore(zeros, { R: '0', G: '0', B: '0' });
const zeroBag = QUERY.restoreBag('', QUERY.readStore(zeros));
assert.strictEqual(zeroBag.sources.rgb, 'store');
assert.strictEqual(zeroBag.values.R, '0');
QUERY.writeStore(mem, { a: '', n: '15' });
const merged = QUERY.readStore(mem);
assert.strictEqual(merged.a, '');
assert.strictEqual(merged.b, '2');
assert.strictEqual(merged.n, '15');
assert.strictEqual(merged.R, '5');
assert.doesNotThrow(function () {
  QUERY.writeStore({
    getItem: function () { throw new Error('no'); },
    setItem: function () { throw new Error('no'); },
  }, { R: '1' });
});
assert.strictEqual(QUERY.readStore({ getItem: function () { throw new Error('no'); } }), null);
assert.strictEqual(QUERY.copyHtml(), '<button type="button" class="copy-link">copy link</button><span class="copy-note dim"></span>');

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
