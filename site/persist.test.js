const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function memory() {
  const data = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
  };
}

function element(id) {
  const node = {
    id: id,
    value: '',
    textContent: '',
    innerHTML: '',
    hidden: false,
    className: '',
    checked: false,
    disabled: false,
    dataset: {},
    options: [],
    files: null,
    classList: {
      toggle: function () {},
      add: function () {},
      remove: function () {},
      contains: function () { return false; },
    },
    setAttribute: function () {},
    appendChild: function (child) {
      node.options.push(child);
      return child;
    },
    closest: function () { return null; },
    setPointerCapture: function () {},
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    addEventListener: function (type, fn) {
      const bag = node.listeners[type] || [];
      bag.push(fn);
      node.listeners[type] = bag;
    },
    dispatchEvent: function (ev) {
      (node.listeners[ev.type] || []).forEach(function (fn) { fn(ev); });
      return true;
    },
    listeners: {},
  };
  return node;
}

const els = {};
function get(id) {
  if (!els[id]) els[id] = element(id);
  return els[id];
}

const swatch = element('swatch');
swatch.dataset.ink = 'r';
const page = {
  visibilityState: 'visible',
  documentElement: { dataset: {} },
  activeElement: null,
  createElement: function (tag) {
    const el = element(tag);
    el.value = '';
    return el;
  },
  querySelector: function (sel) {
    const m = /^#([\w-]+)$/.exec(sel);
    return m ? els[m[1]] || null : null;
  },
  querySelectorAll: function (sel) {
    if (sel === '.swatches button') return [swatch];
    return [];
  },
  addEventListener: function () {},
};

const loc = { pathname: '/', search: '', hash: '', origin: 'https://math.alxo.city' };
const store = memory();
global.document = page;
global.localStorage = store;
global.sessionStorage = memory();
global.location = loc;
global.history = { replaceState: function () {} };
global.window = { addEventListener: function () {} };
global.Event = function (type) { this.type = type; };
global.ETH = {
  ADDR: {
    MATH: '0x' + '11'.repeat(20),
    RGB: '0x' + '22'.repeat(20),
    TOON: '0x' + '33'.repeat(20),
    WORD: '0x' + '44'.repeat(20),
    FACE: '0x' + '55'.repeat(20),
    MULTI: '0x' + '66'.repeat(20),
  },
};
global.ENS = {
  want: function () {},
  flush: function () {},
  normAddr: function () { return ''; },
  contractLabel: function () { return ''; },
  contractNames: function () { return []; },
  cached: function () { return ''; },
};
global.TOKEN = {
  sumHtml: function (a, b) { return String(a) + '+' + String(b); },
  idLink: function () { return ''; },
  planesHtml: function () { return ''; },
  parse: function () { return null; },
};
global.LIST = { ownedRows: function () { return []; } };
global.ABI = {};

require('./planner');
require('./rules');
require('./suggest');
require('./query');

function load(name) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, name), 'utf8'), { filename: name });
}

['cells', 'heart', 'shuffle', 'file', 'apply', 'pR', 'pG', 'pB', 'planRgb', 'suggest', 'rgbMeta', 'hintNote', 'rgbTraits', 'a', 'b', 'target', 'mode', 'plan', 'pieces', 'tm', 'tw', 'tf', 'tr'].forEach(get);

load('app.js');
load('mint.js');
load('route.js');
load('toon.js');
load('rgb.js');

const SITE = global.SITE;
const state = SITE.state;
const writes = [];
SITE.rememberQuery = function (patch) {
  writes.push(patch);
  return true;
};

const user = '0xabcabcabcabcabcabcabcabcabcabcabcabcabca';
state.supply = new Map([[1n, user], [2n, user]]);
state.math = [{ id: 1n, owner: user }, { id: 2n, owner: user }];

function tick() {
  return new Promise(function (resolve) { setImmediate(resolve); });
}

async function main() {
  QUERY.writeStore(store, { R: '1', G: '2', B: '3', a: '8', b: '9', preset: 'math' });
  loc.search = '?R=5&G=3&B=2';
  loc.hash = '';
  get('pR').value = '5';
  get('pG').value = '3';
  get('pB').value = '2';
  get('a').value = '4';
  get('b').value = '6';
  get('target').value = '15';
  SITE.applyQuery();
  assert.strictEqual(state.planesTouched, true);
  assert.strictEqual(state.planesDirty, false);
  assert.strictEqual(state.mintDirty, false);
  assert.strictEqual(state.toonDirty, false);
  assert.strictEqual(state.routeDirty, false);
  assert.strictEqual(state.planes.R, 5n);
  assert.strictEqual(state.planes.G, 3n);
  assert.strictEqual(state.planes.B, 2n);
  assert.strictEqual(state.mintQuery.a, '');
  assert.strictEqual(writes.length, 0);

  const seen = {};
  const fakeDoc = {
    visibilityState: 'visible',
    addEventListener: function (type, fn) { seen[type] = fn; },
  };
  const fakeWin = {
    addEventListener: function (type, fn) { seen[type] = fn; },
  };
  SITE.bindPersist(fakeWin, fakeDoc);
  const savedRaw = store.getItem(QUERY.URL_KEY);
  seen.pagehide();
  assert.strictEqual(store.getItem(QUERY.URL_KEY), savedRaw);
  assert.strictEqual(QUERY.readStore(store).R, '1');
  assert.strictEqual(QUERY.readStore(store).G, '2');
  assert.strictEqual(QUERY.readStore(store).a, '8');
  assert.strictEqual(QUERY.readStore(store).preset, 'math');
  seen.visibilitychange();
  assert.strictEqual(QUERY.readStore(store).R, '1');
  fakeDoc.visibilityState = 'hidden';
  seen.visibilitychange();
  assert.strictEqual(QUERY.readStore(store).R, '1');
  assert.strictEqual(QUERY.readStore(store).a, '8');

  state.planesDirty = true;
  get('pR').value = '9';
  get('pG').value = '8';
  get('pB').value = '7';
  seen.pagehide();
  assert.strictEqual(QUERY.readStore(store).R, '9');
  assert.strictEqual(QUERY.readStore(store).G, '8');
  assert.strictEqual(QUERY.readStore(store).B, '7');
  assert.strictEqual(QUERY.readStore(store).a, '8');
  assert.strictEqual(QUERY.readStore(store).preset, 'math');
  state.planesDirty = false;

  const view = element('view');
  const copy = element('copy');
  view.querySelector = function (sel) {
    return sel === '.copy-link' ? copy : null;
  };
  const beforeRgb = writes.length;
  SITE.rgb(view);
  assert.strictEqual(state.planesDirty, false);
  assert.strictEqual(writes.length, beforeRgb);

  get('pR').value = '5';
  get('pG').value = '3';
  get('pB').value = '2';
  get('pR').dispatchEvent({ type: 'input' });
  assert.strictEqual(state.planesTouched, true);
  assert.strictEqual(state.planesDirty, false);
  assert.strictEqual(writes.length, beforeRgb);

  SITE.signalPlanes(get('pR'), false);
  assert.strictEqual(state.planesDirty, false);
  assert.strictEqual(state.planesTouched, true);
  assert.strictEqual(writes.length, beforeRgb);
  assert.strictEqual(state.planes.R, 5n);

  SITE.signalPlanes(get('pR'), true);
  assert.strictEqual(state.planesDirty, true);
  assert.strictEqual(state.planesTouched, true);
  assert.strictEqual(writes.length, beforeRgb + 1);
  assert.strictEqual(writes[writes.length - 1].R, '5');
  assert.strictEqual(writes[writes.length - 1].G, '3');
  assert.strictEqual(writes[writes.length - 1].B, '2');

  state.planesDirty = false;
  state.planesTouched = false;
  const beforeSwatch = writes.length;
  swatch.onclick();
  assert.strictEqual(writes.length, beforeSwatch);
  assert.strictEqual(state.planesDirty, false);
  state.planesTouched = true;
  swatch.onclick();
  assert.strictEqual(writes.length, beforeSwatch);
  assert.strictEqual(state.planesDirty, false);

  state.account = null;
  state.mintDirty = false;
  get('a').value = '';
  get('b').value = '';
  const beforeMint = writes.length;
  SITE.fillMint(false);
  assert.strictEqual(state.mintDirty, false);
  assert.strictEqual(writes.length, beforeMint);
  assert.strictEqual(get('a').value, '1');
  assert.strictEqual(get('b').value, '2');
  SITE.fillMint(true);
  assert.strictEqual(state.mintDirty, true);
  assert.ok(writes.length > beforeMint);
  assert.ok(writes[writes.length - 1].a);
  state.mintDirty = false;

  state.account = user;
  state.toonDirty = false;
  get('tm').value = '';
  get('tw').value = '';
  get('tf').value = '';
  get('tr').value = '';
  const beforeToon = writes.length;
  SITE.fillToon(false);
  await tick();
  assert.notStrictEqual(state.toonDirty, true);
  assert.strictEqual(writes.length, beforeToon);
  SITE.fillToon(true);
  await tick();
  assert.strictEqual(state.toonDirty, true);
  assert.ok(writes.length > beforeToon);
  state.toonDirty = false;

  state.routeDirty = false;
  state.routeTarget = '';
  state.routeBuilt = null;
  state.routePieces = [];
  const beforeRoute = writes.length;
  SITE.route(view);
  assert.strictEqual(writes.length, beforeRoute);
  assert.strictEqual(state.routeDirty, false);
  get('target').value = '15';
  get('target').dispatchEvent({ type: 'input' });
  assert.strictEqual(state.routeDirty, true);
  assert.strictEqual(writes[writes.length - 1].n, '15');

  QUERY.writeStore(store, { R: '1', G: '2', B: '3', a: '8', b: '9' });
  state.planesDirty = false;
  state.mintDirty = false;
  state.toonDirty = false;
  get('pR').value = '5';
  get('pG').value = '3';
  get('pB').value = '2';
  fakeDoc.visibilityState = 'hidden';
  seen.visibilitychange();
  assert.strictEqual(QUERY.readStore(store).R, '1');
  assert.strictEqual(QUERY.readStore(store).n, '15');
  assert.strictEqual(QUERY.readStore(store).a, '8');

  get('view');
  get('sim');
  get('send');
  state.account = null;
  state.mintDirty = false;
  state.routeDirty = false;
  state.toonDirty = false;
  state.planesDirty = false;
  QUERY.writeStore(store, { R: '5', G: '3', B: '2', a: '4', b: '6', n: '15' });
  loc.search = '';
  loc.hash = '#mint';
  state.planes = { R: 0n, G: 0n, B: 0n };
  state.grid = global.PLAN.planesToRows(0n, 0n, 0n);
  SITE.applyQuery();
  assert.strictEqual(state.mintQuery.a, '4');
  assert.strictEqual(state.mintQuery.b, '6');
  assert.strictEqual(state.planes.R, 0n);
  const beforeLazy = writes.length;
  SITE.show('mint', true);
  assert.strictEqual(state.mintQuery.a, '4');
  assert.strictEqual(writes.length, beforeLazy);
  assert.strictEqual(loc.search, '');
  get('pR').value = '5';
  get('pG').value = '3';
  get('pB').value = '2';
  SITE.show('rgb', true);
  assert.strictEqual(state.planes.R, 5n);
  assert.strictEqual(state.planes.G, 3n);
  assert.strictEqual(state.planes.B, 2n);
  assert.strictEqual(state.planesDirty, false);
  assert.strictEqual(state.planesTouched, true);
  assert.strictEqual(writes.length, beforeLazy);
  assert.strictEqual(loc.search, '');
  state.planes = { R: 9n, G: 9n, B: 9n };
  state.grid = global.PLAN.planesToRows(9n, 9n, 9n);
  state.planesDirty = false;
  get('pR').value = '9';
  get('pG').value = '9';
  get('pB').value = '9';
  SITE.show('rgb', true);
  assert.strictEqual(state.planes.R, 9n);
  assert.strictEqual(state.planes.G, 9n);
  assert.strictEqual(state.planes.B, 9n);
  assert.strictEqual(writes.length, beforeLazy);
  assert.strictEqual(loc.search, '');

  loc.search = '?a=9';
  loc.hash = '#mint';
  QUERY.writeStore(store, { R: '5', G: '3', B: '2', a: '4', b: '6' });
  state.planes = { R: 1n, G: 1n, B: 1n };
  state.grid = global.PLAN.planesToRows(1n, 1n, 1n);
  state.planesDirty = false;
  state.routeTarget = '7';
  SITE.applyQuery();
  assert.strictEqual(state.mintQuery.a, '9');
  assert.strictEqual(state.mintQuery.b, '');
  state.planes = { R: 1n, G: 1n, B: 1n };
  state.grid = global.PLAN.planesToRows(1n, 1n, 1n);
  state.routeTarget = '7';
  state.routeDirty = false;
  get('pR').value = '1';
  get('pG').value = '1';
  get('pB').value = '1';
  const beforeLocked = writes.length;
  SITE.show('rgb', true);
  assert.strictEqual(state.planes.R, 1n);
  assert.strictEqual(state.planes.G, 1n);
  assert.strictEqual(state.planes.B, 1n);
  assert.strictEqual(writes.length, beforeLocked);
  assert.strictEqual(loc.search, '?a=9');
  SITE.show('route', true);
  assert.strictEqual(state.routeTarget, '7');
  assert.strictEqual(writes.length, beforeLocked);
  assert.strictEqual(loc.search, '?a=9');

  global.MOLD = { say: function () {}, showIdeas: function () {}, setAccount: function () {}, mount: function () {} };
  QUERY.writeStore(store, {
    R: '5', G: '3', B: '2', a: '4', b: '6', n: '15', math: '7', word: '0', face: '2', rgb: '9',
  });
  loc.search = '';
  loc.hash = '#rgb';
  state.routeTarget = '7';
  state.mintDirty = false;
  state.routeDirty = false;
  state.toonDirty = false;
  state.planesDirty = false;
  state.account = user;
  get('simToon');
  get('sendToon');
  SITE.applyQuery();
  assert.strictEqual(state.mintQuery.a, '');
  assert.strictEqual(state.mintQuery.b, '');
  assert.strictEqual(state.toonQuery.math, '');
  assert.strictEqual(state.routeTarget, '7');
  assert.strictEqual(state.planes.R, 5n);
  const beforeGroups = writes.length;
  SITE.show('mint', true);
  assert.strictEqual(state.mintQuery.a, '4');
  assert.strictEqual(state.mintQuery.b, '6');
  assert.strictEqual(state.mintDirty, false);
  SITE.show('route', true);
  assert.strictEqual(state.routeTarget, '15');
  assert.strictEqual(state.routeDirty, false);
  SITE.show('toon', true);
  assert.strictEqual(state.toonQuery.math, '7');
  assert.strictEqual(state.toonQuery.word, '0');
  assert.strictEqual(state.toonQuery.face, '2');
  assert.strictEqual(state.toonQuery.rgb, '9');
  assert.strictEqual(state.toonDirty, false);
  assert.strictEqual(writes.length, beforeGroups);
  assert.strictEqual(loc.search, '');

  loc.search = '';
  loc.hash = '#rgb';
  state.mintDirty = false;
  state.routeDirty = false;
  state.toonDirty = false;
  state.planesDirty = false;
  SITE.applyQuery();
  state.mintQuery = { a: '8', b: '9' };
  state.mintDirty = true;
  SITE.show('mint', true);
  assert.strictEqual(state.mintQuery.a, '8');
  assert.strictEqual(state.mintQuery.b, '9');
  assert.strictEqual(state.mintDirty, true);
  assert.strictEqual(loc.search, '');

  QUERY.writeStore(store, { R: '1', G: '1', B: '1', math: '7', word: '0', face: '2', rgb: '9' });
  state.planesDirty = false;
  state.mintDirty = false;
  state.routeDirty = false;
  state.toonDirty = false;
  get('tm').value = '4';
  get('tw').value = '5';
  get('tf').value = '6';
  get('tr').value = '8';
  const toonRaw = store.getItem(QUERY.URL_KEY);
  fakeDoc.visibilityState = 'hidden';
  seen.visibilitychange();
  assert.strictEqual(store.getItem(QUERY.URL_KEY), toonRaw);
  assert.strictEqual(QUERY.readStore(store).math, '7');
  state.toonDirty = true;
  seen.visibilitychange();
  assert.strictEqual(QUERY.readStore(store).math, '4');
  assert.strictEqual(QUERY.readStore(store).word, '5');
  assert.strictEqual(QUERY.readStore(store).face, '6');
  assert.strictEqual(QUERY.readStore(store).rgb, '8');
  assert.strictEqual(QUERY.readStore(store).R, '1');

  console.log('persist.test.js ok');
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
