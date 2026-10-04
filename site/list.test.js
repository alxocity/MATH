const assert = require('assert');
const P = require('./planner');
const LIST = require('./list');

function filt(q, extra) {
  return Object.assign({ q: q || '', popMin: '', popMax: '', pal: false, pow: false, used: 'any', sort: 'index' }, extra || {});
}

function ctx(extra) {
  return Object.assign({
    max: P.MAX,
    pop: P.popcount,
    pal: P.isPal,
    pow: P.isPow2,
    channels: function () { return null; },
    word: function (id) { return id === 7n ? 'nftcryptonews' : ''; },
    face: function (id) { return id === 9n ? '{ಥ.ಠ}' : ''; },
    ownerHit: function (owner, q) { return !!(owner && String(owner).includes(q)); },
    cached: function () { return ''; },
    isName: function () { return false; },
    forward: function () { return ''; },
  }, extra || {});
}

assert.strictEqual(LIST.match({ id: 1500n, owner: '0xabc' }, 'math', filt('150'), ctx()), true);
assert.strictEqual(LIST.match({ id: 1500n, owner: '0xabc' }, 'math', filt('999'), ctx()), false);

const rgb = { id: 92n, r: 100n, g: 200n, b: 300n, owner: '0xabc' };
assert.strictEqual(LIST.match(rgb, 'rgb', filt('200'), ctx()), true);
assert.strictEqual(LIST.match(rgb, 'rgb', filt('92'), ctx()), true);
assert.strictEqual(LIST.match(rgb, 'rgb', filt('999'), ctx()), false);

const toon = { id: 1500n, word: 7n, face: 9n, rgb: 92n, owner: '0xabc' };
assert.strictEqual(LIST.match(toon, 'toon', filt('nft'), ctx()), true);
assert.strictEqual(LIST.match(toon, 'toon', filt('92'), ctx()), true);
assert.strictEqual(LIST.match(toon, 'toon', filt('9'), ctx()), true);

assert.strictEqual(LIST.match({ id: 7n }, 'math', filt('', { popMin: '2', popMax: '3' }), ctx()), true);
assert.strictEqual(LIST.match({ id: 7n }, 'math', filt('', { popMin: '4' }), ctx()), false);
assert.strictEqual(LIST.match({ id: 121n }, 'math', filt('', { pal: true }), ctx()), true);
assert.strictEqual(LIST.match({ id: 12n }, 'math', filt('', { pal: true }), ctx()), false);
assert.strictEqual(LIST.match({ id: 8n }, 'math', filt('', { pow: true }), ctx()), true);
assert.strictEqual(LIST.match({ id: 6n }, 'math', filt('', { pow: true }), ctx()), false);

const used = ctx({ channels: function () { return new Set(['r']); } });
assert.strictEqual(LIST.match({ id: 1n }, 'math', filt('', { used: 'free' }), used), false);
assert.strictEqual(LIST.match({ id: 1n }, 'math', filt('', { used: 'r' }), used), true);
assert.strictEqual(LIST.match({ id: 1n }, 'math', filt('', { used: 'g' }), used), false);
assert.strictEqual(LIST.match({ id: 1n }, 'rgb', filt('', { used: 'r' }), used), true);

const items = [{ id: 8n }, { id: 1n }, { id: 7n }];
const byId = LIST.order(items, 'id', P.popcount, P.MAX);
assert.deepStrictEqual(byId.map(function (t) { return t.id; }), [1n, 7n, 8n]);
assert.strictEqual(items[0].id, 8n);
const byPop = LIST.order(items, 'pop', P.popcount, P.MAX);
assert.strictEqual(byPop[0].id, 7n);
assert.strictEqual(items[0].id, 8n);

function helpers() {
  return {
    esc: function (s) { return String(s); },
    addr: function (a) { return a || ''; },
    links: function () { return 'opensea etherscan'; },
    mark: function (g) { return '[' + g + ']'; },
    usedTip: 'used',
    bits: function (id) { return '<span class="bits">' + id + '</span>'; },
    cells: function () { return '<span class="cells"><button class="r"></button></span>'; },
    rows: function () { return []; },
    tag: function (n) { return String(n); },
    isPal: P.isPal,
    isStrobo: P.isStrobo,
    channels: function () { return null; },
    word: function (id) { return id === 7n ? 'nftcryptonews' : String(id); },
    face: function () { return '{ಥ.ಠ}'; },
    rgb: function () { return { id: 92n, r: 1n, g: 2n, b: 3n }; },
  };
}

const rgbHtml = LIST.cardHtml('rgb', rgb, helpers());
assert.ok(rgbHtml.includes('R 100 · G 200 · B 300'));
assert.ok(rgbHtml.includes('class="cells"'));
assert.ok(!/r \d+ g \d+ b \d+/.test(rgbHtml));
assert.ok(rgbHtml.includes('opensea'));
assert.ok(rgbHtml.includes('etherscan'));
assert.ok(rgbHtml.includes('data-svg="rgb:92"'));

const bare = LIST.cardHtml('rgb', { id: 5n, owner: '0x' }, helpers());
assert.ok(!bare.includes('class="cells"'));
assert.ok(bare.includes('>5</div>'));

const mathHtml = LIST.cardHtml('math', { id: 1500n, owner: '0x' }, helpers());
assert.ok(mathHtml.includes('class="bits"'));
assert.ok(mathHtml.includes('1500'));
const palHtml = LIST.cardHtml('math', { id: 121n, owner: '0x' }, helpers());
assert.ok(palHtml.includes('⇌'));

const toonHtml = LIST.cardHtml('toon', toon, helpers());
assert.ok(toonHtml.includes('nftcryptonews'));
assert.ok(toonHtml.includes('{ಥ.ಠ}'));
assert.ok(toonHtml.includes('class="cells"'));

const acted = LIST.cardHtml('math', { id: 1n, owner: '0x' }, helpers(), '<div class="row">GO</div>');
assert.ok(acted.indexOf('class="outs"') < acted.indexOf('>GO<') );
assert.ok(acted.indexOf('>GO<') < acted.indexOf('class="bits"'));

const bar = LIST.barHtml('rgb', filt(''), { math: 3, rgb: 2, toon: 1 }, function (s) { return s; }, function () { return ''; }, 'tip');
assert.ok(bar.includes('MATH 3'));
assert.ok(bar.includes('RGB 2'));
assert.ok(bar.includes('TOON 1'));
assert.ok(bar.includes('class="on"'));
assert.ok(bar.includes('id, value, name'));
assert.ok(bar.includes('id="sort"'));
assert.ok(bar.includes('id="used"'));
assert.ok(bar.includes('id="popMin"'));

const pager = LIST.pagerHtml(0, 2, 30);
assert.ok(pager.includes('disabled'));
assert.ok(pager.includes('1/2'));
assert.ok(pager.includes('>30<'));
assert.strictEqual(LIST.PAGE, 24);
