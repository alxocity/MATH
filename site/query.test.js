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
assert.strictEqual(fromStore.group, 'rgb');
assert.strictEqual(fromStore.sources.rgb, 'store');
assert.strictEqual(fromStore.sources.mint, '');
assert.strictEqual(fromStore.sources.ens, '');
assert.strictEqual(fromStore.sources.route, '');
assert.strictEqual(fromStore.sources.toon, '');
assert.strictEqual(fromStore.values.R, '5');
assert.strictEqual(fromStore.values.G, '3');
assert.strictEqual(fromStore.values.a, '');
assert.strictEqual(fromStore.values.preset, '');
assert.strictEqual(fromStore.writeUrl, false);
const mintOnly = QUERY.restoreBag('', saved, '#mint');
assert.strictEqual(mintOnly.group, 'mint');
assert.strictEqual(mintOnly.sources.mint, 'store');
assert.strictEqual(mintOnly.sources.rgb, '');
assert.strictEqual(mintOnly.values.a, '1');
assert.strictEqual(mintOnly.values.b, '2');
assert.strictEqual(mintOnly.values.R, '');
assert.strictEqual(mintOnly.values.preset, '');
assert.strictEqual(mintOnly.writeUrl, false);
assert.strictEqual(QUERY.restoreBag('', saved, 'mint').sources.mint, 'store');
assert.strictEqual(QUERY.restoreBag('', saved, '#browse').sources.rgb, '');
assert.strictEqual(QUERY.restoreBag('', saved, '#browse').sources.mint, '');
assert.strictEqual(QUERY.restoreBag('', saved, '#math/1').group, '');
assert.strictEqual(QUERY.namedGroup('constructor'), '');
assert.strictEqual(QUERY.namedGroup('#constructor'), '');
assert.strictEqual(QUERY.namedGroup('toString'), '');
assert.strictEqual(QUERY.namedGroup('#rgb'), 'rgb');
const urlWins = QUERY.restoreBag('?R=9&G=1&B=4', saved, '#mint');
assert.strictEqual(urlWins.sources.rgb, 'url');
assert.strictEqual(urlWins.values.R, '9');
assert.strictEqual(urlWins.values.G, '1');
assert.strictEqual(urlWins.sources.mint, '');
assert.strictEqual(urlWins.sources.ens, '');
assert.strictEqual(urlWins.sources.route, '');
assert.strictEqual(urlWins.sources.toon, '');
assert.strictEqual(urlWins.values.a, '');
assert.strictEqual(urlWins.values.preset, '');
assert.deepStrictEqual(QUERY.storePatch(urlWins, ['mint', 'route', 'rgb', 'toon', 'ens']), {});
assert.strictEqual(urlWins.writeUrl, false);
assert.strictEqual(urlWins.sources.mint, '');
assert.strictEqual(urlWins.values.a, '');
const onlyMint = QUERY.restoreBag('?a=1', saved, '#rgb');
assert.strictEqual(onlyMint.sources.mint, 'url');
assert.strictEqual(onlyMint.values.a, '1');
assert.strictEqual(onlyMint.values.b, '');
assert.strictEqual(onlyMint.sources.rgb, '');
assert.strictEqual(onlyMint.values.R, '');
assert.deepStrictEqual(QUERY.storePatch(onlyMint, ['mint', 'route', 'rgb', 'toon', 'ens']), {});
assert.strictEqual(QUERY.restoreBag('', saved, '#rgb').sources.rgb, 'store');
assert.strictEqual(QUERY.restoreBag('', saved, '#rgb').values.a, '');
assert.strictEqual(QUERY.restoreBag('', saved, '#rgb').writeUrl, false);
const zeroLock = QUERY.restoreBag('?R=0', { R: '5', G: '3', B: '2', a: '4', b: '6' });
assert.strictEqual(zeroLock.sources.rgb, 'url');
assert.strictEqual(zeroLock.values.R, '0');
assert.strictEqual(zeroLock.values.G, '');
assert.strictEqual(zeroLock.sources.mint, '');
assert.strictEqual(QUERY.fullPlanes(zeroLock.values), false);
assert.strictEqual(QUERY.fullPlanes({ R: '5', G: '0', B: '2' }), true);
assert.deepStrictEqual(QUERY.storePatch(QUERY.restoreBag('', saved, 'ens'), ['ens']), { preset: 'math' });
const bareEns = QUERY.ensBoot('', { preset: 'math', a: '4', b: '6', R: '5', G: '3', B: '2' });
assert.strictEqual(bareEns.preset, 'math');
assert.strictEqual(bareEns.group, 'ens');
assert.strictEqual(bareEns.writeUrl, false);
assert.strictEqual(QUERY.restoreBag('', { preset: 'math', a: '4', R: '5', G: '3', B: '2' }, 'ens').values.a, '');
assert.strictEqual(QUERY.restoreBag('', { preset: 'math', a: '4', R: '5', G: '3', B: '2' }, 'ens').values.R, '');
assert.strictEqual(QUERY.ensBoot('', { preset: 'math' }, '#rgb').preset, '');
assert.strictEqual(QUERY.ensBoot('', { preset: 'math' }, '#rgb').writeUrl, false);
assert.strictEqual(QUERY.ensBoot('', { preset: 'math', a: '4', b: '6' }, '#mint').preset, '');
assert.strictEqual(QUERY.ensBoot('', { preset: 'math', a: '4', b: '6' }, '#mint').group, 'mint');
const linked = QUERY.ensBoot('?R=5&G=3&B=2', { preset: 'math' });
assert.strictEqual(linked.preset, '');
assert.strictEqual(linked.writeUrl, false);
assert.strictEqual(QUERY.ensBoot('?preset=math', { preset: 'other' }).preset, 'math');
assert.strictEqual(QUERY.ensBoot('?preset=math', { preset: 'other' }).writeUrl, false);
assert.strictEqual(
  QUERY.shareHref({ origin: 'https://math.alxo.city', pathname: '/', search: '', hash: '#rgb' }, drawn),
  'https://math.alxo.city/?R=5&G=3&B=2#rgb'
);
assert.strictEqual(
  QUERY.shareTab(
    { origin: 'https://math.alxo.city', pathname: '/', search: '?a=1&n=9', hash: '#rgb' },
    'rgb',
    { R: '5', G: '0', B: '2', a: '8' }
  ),
  'https://math.alxo.city/?R=5&G=0&B=2#rgb'
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

const presetOk = 'a'.repeat(64);
const presetBad = 'a'.repeat(65);
assert.strictEqual(QUERY.presetName(presetOk), presetOk);
assert.strictEqual(QUERY.presetName(presetBad), '');
assert.strictEqual(QUERY.read('?preset=' + presetBad).preset, '');
assert.strictEqual(QUERY.presetName('m'.repeat(200000)), '');

const hostile = memory();
hostile.setItem(QUERY.URL_KEY, '{"__proto__":{"admin":1},"R":"nope","G":"' + '1'.repeat(80) + '","B":["1"],"preset":"' + presetBad + '","a":"12","n":{"evil":true},"constructor":{"prototype":{"pwn":1}}}');
const hostileBag = QUERY.restoreBag('', QUERY.readStore(hostile), '#mint');
assert.strictEqual(hostileBag.values.a, '12');
assert.strictEqual(QUERY.restoreBag('', QUERY.readStore(hostile)).values.a, '');
assert.strictEqual(hostileBag.values.R, '');
assert.strictEqual(hostileBag.values.G, '');
assert.strictEqual(hostileBag.values.B, '');
assert.strictEqual(hostileBag.values.preset, '');
assert.strictEqual(hostileBag.values.n, '');
assert.strictEqual(Object.prototype.admin, undefined);
assert.strictEqual(Object.prototype.pwn, undefined);
const listed = memory();
listed.setItem(QUERY.URL_KEY, '[1,2,3]');
assert.strictEqual(QUERY.restoreBag('', QUERY.readStore(listed)).sources.rgb, '');

assert.strictEqual(QUERY.planeFields({ R: '5', G: 'nope', B: '2' }), null);
assert.deepStrictEqual(QUERY.planeFields({ R: '5', G: '03', B: '0' }), { R: '5', G: '3', B: '0' });
assert.deepStrictEqual(QUERY.livePatch({
  planesTouched: true,
  planesDirty: false,
  rgbInputs: { R: '9', G: '8', B: '7' },
  mint: { a: '4', b: '6' },
  routeTarget: '15',
  toon: { math: '1', word: '0', face: '0', rgb: '2' },
}), {});
assert.deepStrictEqual(QUERY.livePatch({
  planesDirty: true,
  rgbInputs: { R: '5', G: 'nope', B: '2' },
}), {});
assert.deepStrictEqual(QUERY.livePatch({
  planesDirty: true,
  rgbInputs: { R: '5', G: '3', B: '2' },
}), { R: '5', G: '3', B: '2' });
const sharedHide = memory();
QUERY.writeStore(sharedHide, { R: '1', G: '2', B: '3', a: '8', b: '9', preset: 'math' });
const friend = QUERY.livePatch({
  planesTouched: true,
  planesDirty: false,
  rgbInputs: { R: '5', G: '3', B: '2' },
  mintDirty: false,
  mint: { a: '4', b: '6' },
  routeDirty: false,
  routeTarget: '15',
  toonDirty: false,
  toon: { math: '1', word: '0', face: '0', rgb: '2' },
});
if (QUERY.hideWrite('pagehide', 'visible')) QUERY.writeStore(sharedHide, friend);
assert.strictEqual(QUERY.readStore(sharedHide).R, '1');
assert.strictEqual(QUERY.readStore(sharedHide).a, '8');
assert.strictEqual(QUERY.readStore(sharedHide).preset, 'math');
const editedHide = QUERY.livePatch({
  planesDirty: true,
  rgbInputs: { R: '9', G: '8', B: '7' },
});
if (QUERY.hideWrite('pagehide', 'visible')) QUERY.writeStore(sharedHide, editedHide);
assert.strictEqual(QUERY.readStore(sharedHide).R, '9');
assert.strictEqual(QUERY.readStore(sharedHide).G, '8');
assert.strictEqual(QUERY.readStore(sharedHide).a, '8');
assert.strictEqual(QUERY.hideWrite('pagehide', 'visible'), true);
assert.strictEqual(QUERY.hideWrite('visibility', 'hidden'), true);
assert.strictEqual(QUERY.hideWrite('visibility', 'visible'), false);
const hideStore = memory();
QUERY.writeStore(hideStore, { R: '1', G: '1', B: '1' });
const hiddenPatch = QUERY.livePatch({ planesDirty: true, rgbInputs: { R: '9', G: '', B: '2' } });
if (QUERY.hideWrite('pagehide', 'visible')) QUERY.writeStore(hideStore, hiddenPatch);
assert.strictEqual(QUERY.readStore(hideStore).R, '1');
const keptPatch = QUERY.livePatch({ planesDirty: true, rgbInputs: { R: '9', G: '3', B: '2' } });
if (QUERY.hideWrite('pagehide', 'visible')) QUERY.writeStore(hideStore, keptPatch);
assert.strictEqual(QUERY.readStore(hideStore).R, '9');
assert.strictEqual(QUERY.readStore(hideStore).G, '3');

assert.strictEqual(QUERY.userCommit('fill', { advance: false }), false);
assert.strictEqual(QUERY.userCommit('fill', { advance: true }), true);
assert.strictEqual(QUERY.userCommit('change', { fromUser: false }), false);
assert.strictEqual(QUERY.userCommit('change', { fromUser: true }), true);
assert.strictEqual(QUERY.userCommit('swatch', { touched: false }), false);
assert.strictEqual(QUERY.userCommit('swatch', { touched: true }), true);
assert.strictEqual(QUERY.userCommit('plan'), true);
assert.strictEqual(QUERY.userCommit('paint'), true);
assert.strictEqual(QUERY.userCommit('edit'), true);
assert.strictEqual(QUERY.userCommit('load'), true);

function copyHarness(opt) {
  opt = opt || {};
  const note = { textContent: '' };
  let field = null;
  let prompted = null;
  const button = {
    dataset: {},
    ownerDocument: {
      createElement: function () {
        field = {
          className: '',
          type: '',
          readOnly: false,
          value: '',
          selectionStart: 0,
          selectionEnd: 0,
          setAttribute: function () {},
          focus: function () {},
          select: function () {
            if (opt.selectThrows) throw new Error('no select');
            this.selectionStart = 0;
            this.selectionEnd = String(this.value).length;
          },
        };
        return field;
      },
      defaultView: {
        navigator: opt.navigator == null ? {} : opt.navigator,
        prompt: function (_label, url) { prompted = url; },
      },
    },
    parentNode: {
      querySelector: function (sel) {
        if (sel === '.copy-note') return note;
        if (sel === '.copy-field') return field;
        return null;
      },
    },
    insertAdjacentElement: function (_where, el) { field = el; },
    addEventListener: function (_type, fn) { button.fire = fn; },
  };
  QUERY.attachCopy(button, function () {
    if (opt.throwGet) throw new Error('no url');
    return opt.url || 'https://math.alxo.city/?R=5#rgb';
  });
  return {
    fire: function () { button.fire(); },
    note: note,
    prompted: function () { return prompted; },
    field: function () { return field; },
  };
}

const missingClip = copyHarness({});
missingClip.fire();
assert.strictEqual(missingClip.note.textContent, 'press copy');
assert.strictEqual(missingClip.field().value, 'https://math.alxo.city/?R=5#rgb');
assert.strictEqual(missingClip.prompted(), null);

const denied = copyHarness({
  navigator: {
    clipboard: {
      writeText: function () {
        return { then: function (_ok, bad) { bad(new Error('denied')); } };
      },
    },
  },
});
denied.fire();
assert.strictEqual(denied.note.textContent, 'press copy');

let copied = '';
const okClip = copyHarness({
  navigator: {
    clipboard: {
      writeText: function (url) {
        copied = url;
        return { then: function (done) { done(); } };
      },
    },
  },
});
okClip.fire();
assert.strictEqual(okClip.note.textContent, 'copied');
assert.strictEqual(copied, 'https://math.alxo.city/?R=5#rgb');

const thrown = copyHarness({
  navigator: { clipboard: { writeText: function () { throw new Error('no'); } } },
  selectThrows: true,
});
thrown.fire();
assert.strictEqual(thrown.note.textContent, 'press copy');
assert.strictEqual(thrown.prompted(), 'https://math.alxo.city/?R=5#rgb');

let syncCopied = '';
const syncClip = copyHarness({
  navigator: {
    clipboard: {
      writeText: function (url) { syncCopied = url; },
    },
  },
});
syncClip.fire();
assert.strictEqual(syncClip.note.textContent, 'copied');
assert.strictEqual(syncCopied, 'https://math.alxo.city/?R=5#rgb');
assert.strictEqual(syncClip.prompted(), null);

const quiet = copyHarness({ throwGet: true });
assert.doesNotThrow(function () { quiet.fire(); });
assert.strictEqual(quiet.note.textContent, '');
assert.strictEqual(quiet.field(), null);
assert.strictEqual(quiet.prompted(), null);

console.log('query.test.js ok');
