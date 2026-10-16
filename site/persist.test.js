const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function memory() {
  const data = {};
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
    removeItem: function (k) { delete data[k]; },
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
    attrs: {},
    classList: {
      toggle: function (c, on) { if (on) node.classList.names[c] = true; else delete node.classList.names[c]; },
      add: function (c) { node.classList.names[c] = true; },
      remove: function (c) { delete node.classList.names[c]; },
      contains: function (c) { return !!node.classList.names[c]; },
      names: {},
    },
    setAttribute: function (k, v) { node.attrs[k] = String(v); },
    getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(node.attrs, k) ? node.attrs[k] : null; },
    scrollIntoView: function (opts) { node.scrolled = opts; },
    focus: function () { page.activeElement = node; },
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
    if (sel === '[data-plan]') return page.planNodes || [];
    return [];
  },
  getElementById: function (id) { return els[id] || null; },
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
const rememberQuery = SITE.rememberQuery;
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

  const urlSnap = store.getItem(QUERY.URL_KEY);
  const historySnap = global.history.replaceState;
  const calls = [];
  function takeUrl(_s, _t, next) {
    calls.push(next);
    const s = String(next);
    const q = s.indexOf('?');
    const h = s.indexOf('#');
    loc.search = q === -1 ? '' : (h > q ? s.slice(q, h) : s.slice(q));
    loc.hash = h === -1 ? '' : s.slice(h);
  }
  global.history.replaceState = takeUrl;
  loc.pathname = '/';
  loc.search = '';
  loc.hash = '#rgb';
  rememberQuery({ R: '5', G: '3', B: '2' });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(loc.search, '?R=5&G=3&B=2');
  assert.strictEqual(QUERY.readMark(sessionStorage), '?R=5&G=3&B=2');
  global.history.replaceState = function () {};
  loc.search = '';
  loc.hash = '#rgb';
  sessionStorage.removeItem(QUERY.MARK_KEY);
  rememberQuery({ R: '9', G: '8', B: '7' });
  assert.strictEqual(loc.search, '');
  assert.strictEqual(QUERY.readMark(sessionStorage), '');
  sessionStorage.setItem(QUERY.MARK_KEY, '?R=5&G=3&B=2');
  global.history.replaceState = function () { throw new Error('no history'); };
  loc.search = '?R=5&G=3&B=2';
  loc.hash = '#rgb';
  rememberQuery({ R: '9', G: '8', B: '7' });
  assert.strictEqual(QUERY.readMark(sessionStorage), '?R=5&G=3&B=2');
  loc.search = '?a=9';
  loc.hash = '';
  sessionStorage.setItem(QUERY.MARK_KEY, 'sentinel');
  global.history.replaceState = function () { throw new Error('should not write'); };
  rememberQuery({ a: '9' });
  assert.strictEqual(sessionStorage.getItem(QUERY.MARK_KEY), 'sentinel');
  sessionStorage.removeItem(QUERY.MARK_KEY);
  loc.search = '?a=9';
  loc.hash = '';
  global.history.replaceState = historySnap;
  SITE.show('mint', true);
  assert.strictEqual(sessionStorage.getItem(QUERY.MARK_KEY), null);
  if (urlSnap == null) store.removeItem(QUERY.URL_KEY);
  else store.setItem(QUERY.URL_KEY, urlSnap);
  loc.pathname = '/';
  loc.hash = '#rgb';

  const painted = '?R=5&G=3&B=2';
  QUERY.writeStore(store, {
    R: '5', G: '3', B: '2', a: '4', b: '6', n: '15', math: '7', word: '0', face: '2', rgb: '9',
  });
  function bootPaint(search, mark) {
    if (mark == null) sessionStorage.removeItem(QUERY.MARK_KEY);
    else sessionStorage.setItem(QUERY.MARK_KEY, mark);
    loc.search = search;
    loc.hash = '#rgb';
    state.routeTarget = '7';
    state.mintDirty = false;
    state.routeDirty = false;
    state.toonDirty = false;
    state.planesDirty = false;
    SITE.applyQuery();
    state.routeTarget = '7';
  }
  bootPaint(painted, painted);
  assert.strictEqual(state.planes.R, 5n);
  assert.strictEqual(state.mintQuery.a, '');
  assert.strictEqual(state.toonQuery.math, '');
  const beforeOwn = writes.length;
  SITE.show('mint', true);
  assert.strictEqual(state.mintQuery.a, '4');
  assert.strictEqual(state.mintQuery.b, '6');
  assert.strictEqual(state.mintDirty, false);
  SITE.show('route', true);
  assert.strictEqual(state.routeTarget, '15');
  SITE.show('toon', true);
  assert.strictEqual(state.toonQuery.math, '7');
  assert.strictEqual(writes.length, beforeOwn);
  assert.strictEqual(loc.search, painted);

  bootPaint(painted, null);
  const beforeNone = writes.length;
  SITE.show('mint', true);
  assert.strictEqual(state.mintQuery.a, '');
  SITE.show('route', true);
  assert.strictEqual(state.routeTarget, '7');
  assert.strictEqual(writes.length, beforeNone);
  assert.strictEqual(loc.search, painted);

  bootPaint(painted, '?R=1&G=1&B=1');
  SITE.show('mint', true);
  assert.strictEqual(state.mintQuery.a, '');
  SITE.show('toon', true);
  assert.strictEqual(state.toonQuery.math, '');
  assert.strictEqual(loc.search, painted);

  bootPaint(painted + '&admin=1', painted + '&admin=1');
  SITE.show('mint', true);
  assert.strictEqual(state.mintQuery.a, '');
  bootPaint(painted, '?__proto__=1&constructor=1&R=5');
  SITE.show('route', true);
  assert.strictEqual(state.routeTarget, '7');
  bootPaint(painted, '?R=nope');
  SITE.show('toon', true);
  assert.strictEqual(state.toonQuery.math, '');
  bootPaint(painted, '?' + 'R=1&'.repeat(400));
  SITE.show('mint', true);
  assert.strictEqual(state.mintQuery.a, '');
  assert.strictEqual(Object.prototype.admin, undefined);

  const realSession = global.sessionStorage;
  global.sessionStorage = {
    getItem: function () { throw new Error('denied'); },
    setItem: function () { throw new Error('denied'); },
  };
  loc.search = painted;
  loc.hash = '#rgb';
  state.routeTarget = '7';
  state.mintDirty = false;
  state.routeDirty = false;
  state.toonDirty = false;
  state.planesDirty = false;
  assert.doesNotThrow(function () { SITE.applyQuery(); });
  state.routeTarget = '7';
  SITE.show('mint', true);
  assert.strictEqual(state.mintQuery.a, '');
  assert.strictEqual(loc.search, painted);
  global.sessionStorage = realSession;
  sessionStorage.removeItem(QUERY.MARK_KEY);

  const markedMint = '?a=4&b=6';
  QUERY.writeStore(store, { a: '9', b: '9', R: '5', G: '3', B: '2' });
  sessionStorage.setItem(QUERY.MARK_KEY, markedMint);
  loc.search = markedMint;
  loc.hash = '#mint';
  state.planes = { R: 1n, G: 1n, B: 1n };
  state.grid = global.PLAN.planesToRows(1n, 1n, 1n);
  state.mintDirty = false;
  state.routeDirty = false;
  state.toonDirty = false;
  state.planesDirty = false;
  SITE.applyQuery();
  assert.strictEqual(state.mintQuery.a, '4');
  assert.strictEqual(state.mintQuery.b, '6');
  assert.strictEqual(state.planes.R, 1n);
  const beforeMarked = writes.length;
  SITE.show('mint', true);
  assert.strictEqual(state.mintQuery.a, '4');
  assert.strictEqual(state.mintQuery.b, '6');
  SITE.show('rgb', true);
  assert.strictEqual(state.planes.R, 5n);
  assert.strictEqual(state.planes.G, 3n);
  assert.strictEqual(state.planes.B, 2n);
  assert.strictEqual(writes.length, beforeMarked);
  assert.strictEqual(loc.search, markedMint);

  const markedBoth = '?a=4&b=6&R=8&G=8&B=8';
  sessionStorage.setItem(QUERY.MARK_KEY, markedBoth);
  loc.search = markedBoth;
  loc.hash = '#rgb';
  state.mintDirty = false;
  state.planesDirty = false;
  SITE.applyQuery();
  assert.strictEqual(state.mintQuery.a, '4');
  assert.strictEqual(state.mintQuery.b, '6');
  assert.strictEqual(state.planes.R, 8n);
  SITE.show('mint', true);
  assert.strictEqual(state.mintQuery.a, '4');
  assert.strictEqual(state.mintQuery.b, '6');
  assert.strictEqual(loc.search, markedBoth);
  assert.strictEqual(writes.length, beforeMarked);

  store.removeItem(QUERY.URL_KEY);
  sessionStorage.setItem(QUERY.MARK_KEY, painted);
  loc.search = painted;
  loc.hash = '#rgb';
  state.planes = null;
  state.mintQuery = { a: '1', b: '1' };
  state.mintDirty = false;
  state.planesDirty = false;
  SITE.applyQuery();
  assert.ok(state.planes);
  assert.strictEqual(state.planes.R, 5n);
  assert.strictEqual(state.planes.G, 3n);
  assert.strictEqual(state.planes.B, 2n);
  assert.strictEqual(state.mintQuery.a, '');
  assert.strictEqual(state.mintQuery.b, '');
  SITE.show('mint', true);
  assert.strictEqual(state.mintQuery.a, '');
  assert.strictEqual(loc.search, painted);

  QUERY.writeStore(store, { a: '4', b: '6', R: '5', G: '3', B: '2' });
  sessionStorage.setItem(QUERY.MARK_KEY, '?R=5&G=3&B=2');
  loc.search = '?utm=1';
  loc.hash = '#rgb';
  state.planes = { R: 1n, G: 1n, B: 1n };
  state.grid = global.PLAN.planesToRows(1n, 1n, 1n);
  state.mintQuery = { a: '', b: '' };
  state.mintDirty = false;
  state.routeDirty = false;
  state.toonDirty = false;
  state.planesDirty = false;
  SITE.applyQuery();
  assert.strictEqual(state.planes.R, 5n);
  assert.strictEqual(state.mintQuery.a, '');
  const beforeUnknown = writes.length;
  SITE.show('mint', true);
  assert.strictEqual(state.mintQuery.a, '4');
  assert.strictEqual(state.mintQuery.b, '6');
  assert.strictEqual(writes.length, beforeUnknown);
  assert.strictEqual(loc.search, '?utm=1');
  sessionStorage.setItem(QUERY.MARK_KEY, '?utm=1');
  loc.hash = '#rgb';
  state.planes = { R: 1n, G: 1n, B: 1n };
  state.grid = global.PLAN.planesToRows(1n, 1n, 1n);
  state.mintQuery = { a: '', b: '' };
  state.mintDirty = false;
  SITE.applyQuery();
  assert.strictEqual(state.planes.R, 5n);
  SITE.show('mint', true);
  assert.strictEqual(state.mintQuery.a, '4');
  assert.strictEqual(loc.search, '?utm=1');

  const newTab = memory();
  global.sessionStorage = newTab;
  QUERY.writeStore(store, { a: '9', b: '9', R: '5', G: '3', B: '2' });
  loc.search = markedMint;
  loc.hash = '#mint';
  state.planes = { R: 1n, G: 1n, B: 1n };
  state.grid = global.PLAN.planesToRows(1n, 1n, 1n);
  state.mintDirty = false;
  state.routeDirty = false;
  state.toonDirty = false;
  state.planesDirty = false;
  SITE.applyQuery();
  assert.strictEqual(state.mintQuery.a, '4');
  assert.strictEqual(state.mintQuery.b, '6');
  assert.strictEqual(QUERY.readMark(newTab), '');
  const beforeTab = writes.length;
  SITE.show('rgb', true);
  assert.strictEqual(state.planes.R, 1n);
  assert.strictEqual(state.planes.G, 1n);
  assert.strictEqual(state.planes.B, 1n);
  assert.strictEqual(writes.length, beforeTab);
  assert.strictEqual(loc.search, markedMint);
  global.sessionStorage = realSession;

  loc.search = '';
  loc.hash = '#rgb';
  sessionStorage.removeItem(QUERY.MARK_KEY);
  QUERY.writeStore(store, { lock: '1', bk: '2', pg: '3', R: '5', G: '3', B: '2' });
  state.planes = { R: 1n, G: 1n, B: 1n };
  SITE.applyQuery();
  assert.strictEqual(state.rgbLock, true);
  assert.strictEqual(state.kind, 'math');
  assert.strictEqual(state.page, 0);
  SITE.browse = function () {};
  SITE.show('browse', true);
  assert.strictEqual(state.kind, 'toon');
  assert.strictEqual(state.page, 3);
  assert.strictEqual(loc.search, '');

  loc.search = '?R=5&G=3&B=2';
  loc.hash = '#rgb';
  sessionStorage.removeItem(QUERY.MARK_KEY);
  state.rgbLock = true;
  SITE.applyQuery();
  assert.strictEqual(state.rgbLock, false);
  assert.strictEqual(state.planes.R, 5n);

  const markedLock = '?R=5&G=3&B=2';
  sessionStorage.setItem(QUERY.MARK_KEY, markedLock);
  loc.search = markedLock;
  QUERY.writeStore(store, { lock: '1', a: '4', b: '6' });
  state.mintDirty = false;
  SITE.applyQuery();
  assert.strictEqual(state.rgbLock, true);
  assert.strictEqual(state.planes.R, 5n);
  assert.strictEqual(state.mintQuery.a, '');
  SITE.show('mint', true);
  assert.strictEqual(state.mintQuery.a, '4');
  assert.strictEqual(loc.search, markedLock);

  loc.search = '?lock=1&bk=1&pg=2&so=2&pal=1&us=2&mk=2&mp=1';
  loc.hash = '#browse';
  sessionStorage.removeItem(QUERY.MARK_KEY);
  QUERY.writeStore(store, { lock: '', R: '9', G: '9', B: '9', bk: '2' });
  SITE.applyQuery();
  assert.strictEqual(state.rgbLock, true);
  assert.strictEqual(state.kind, 'rgb');
  assert.strictEqual(state.page, 2);
  assert.strictEqual(state.filter.sort, 'pop');
  assert.strictEqual(state.filter.pal, true);
  assert.strictEqual(state.filter.used, 'g');
  assert.strictEqual(state.filter.q, '');
  assert.strictEqual(state.mineKind, 'toon');
  assert.strictEqual(state.minePage, 1);
  SITE.show('rgb', true);
  assert.notStrictEqual(state.planes && state.planes.R, 9n);

  state.planes = { R: 1n, G: 1n, B: 1n };
  state.grid = global.PLAN.planesToRows(1n, 1n, 1n);
  state.rgbLock = false;
  const beforeHist = writes.length;
  global.history.pushState = function () { throw new Error('push'); };
  SITE.noteEdit('9,9,9');
  SITE.undoPlanes();
  assert.strictEqual(state.planes.R, 9n);
  assert.ok(writes.length > beforeHist);
  SITE.redoPlanes();
  assert.strictEqual(state.planes.R, 1n);
  state.planes = { R: 4n, G: 4n, B: 4n };
  SITE.noteEdit('1,1,1');
  SITE.redoPlanes();
  assert.strictEqual(state.planes.R, 4n);
  const ink = state.ink;
  SITE.setRgbLock(true);
  assert.strictEqual(SITE.pickInk('r'), false);
  assert.strictEqual(state.ink, ink);
  assert.strictEqual(SITE.paintCell(0, 'r'), false);
  SITE.undoPlanes();
  assert.strictEqual(state.planes.R, 4n);
  SITE.setRgbLock(false);
  assert.strictEqual(QUERY.read('?lock=1').lock, '1');

  SITE.openToken({ kind: 'math', id: 536n });
  assert.strictEqual(state.tab, 'token');
  assert.strictEqual(state.token.kind, 'math');
  assert.strictEqual(state.token.id, '536');
  SITE.openToken({ kind: 'rgb', id: 12n });
  assert.strictEqual(state.token.kind, 'rgb');
  assert.strictEqual(state.token.id, '12');
  SITE.openToken({ kind: 'toon', id: 1973n });
  assert.strictEqual(state.token.kind, 'toon');
  assert.strictEqual(state.token.id, '1973');

  state.rgbLock = true;
  state.planes = { R: 0n, G: 0n, B: 0n };
  state.grid = global.PLAN.planesToRows(0n, 0n, 0n);
  SITE.planRgb();
  assert.strictEqual(state.rgbLock, false);
  state.planes = { R: 1n, G: 1n, B: 1n };
  state.grid = global.PLAN.planesToRows(1n, 1n, 1n);
  state.supply.set(1n, user);
  SITE.planRgb();
  assert.strictEqual(state.rgbLock, true);
  assert.ok(state.queue.length);

  const savedEth = global.ETH;
  const savedAbi = global.ABI;
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, 'eth.js'), 'utf8'), { filename: 'eth.js' });
  const realEth = global.ETH;
  global.ETH = savedEth;
  global.ABI = savedAbi;
  savedEth.readCache = realEth.readCache;
  savedEth.writeCache = realEth.writeCache;
  store.removeItem('math.site.v1');

  const other = '0x' + '12'.repeat(20);
  state.account = user;
  state.block = 12;
  state.math = [{ id: 1n, owner: user }, { id: 2n, owner: user }];
  state.rgb = [];
  state.toon = [];
  state.heldMath = [];
  state.heldRgb = [];
  state.heldToon = [];
  state.supply = new Map([[1n, user], [2n, user]]);
  state.usedR = new Set();
  state.usedG = new Set();
  state.usedB = new Set();
  state.usedWord = new Set();
  state.usedFace = new Set();
  state.usedRgb = new Set();
  state.usedMath = new Set();
  state.rgbBy = { r: new Map(), g: new Map(), b: new Map() };
  state.toonBy = { word: new Map(), face: new Map(), rgb: new Map(), math: new Map() };
  state.channels = new Map();
  state.inventory = {
    block: 12,
    math: state.math,
    rgb: state.rgb,
    toon: state.toon,
    words: state.wordText,
    faces: state.faceText,
    blockedDone: false,
  };
  const planCtx = {
    supply: state.supply,
    user: user,
    blocked: new Set(),
    unknown: new Set(),
    gasWei: 0n,
    mode: 'fewest',
  };
  const beforePlan = global.PLAN.plan(3n, planCtx);
  assert.ok(beforePlan.mints > 0);
  assert.ok(!beforePlan.exists);

  const searchBefore = loc.search;
  const writesBefore = writes.length;
  state.runBusy = true;
  state.txLock = 'run';
  const runGen = state.runGen;
  let ownedOk = 0;
  const minted = { label: '1 + 2 = 3', result: 3n, status: 'submitted', onOk: function () { ownedOk++; } };
  const image = { label: 'RGB.add 8, 16, 32', result: null, r: 8n, g: 16n, b: 32n, status: 'submitted' };
  const foreign = { label: '2 + 7 = 9', result: 9n, status: 'submitted', onOk: function () { throw new Error('foreign onOk'); } };
  state.run = [minted, image, foreign];
  savedEth.ownerOf = async function (addr, id) { return id === 9n ? other : user; };
  savedEth.writeCache({
    block: 12,
    math: [{ id: 1n, owner: user }, { id: 2n, owner: user }],
    rgb: [],
    toon: [],
    words: new Map(),
    faces: new Map(),
  }, null);
  const cacheBytes = store.getItem('math.site.v1');
  await SITE.confirmOwned(minted);
  await SITE.confirmOwned(image);
  await SITE.confirmOwned(foreign);
  assert.strictEqual(ownedOk, 1);
  assert.strictEqual(minted.status, 'confirmed');
  assert.strictEqual(image.status, 'confirmed');
  assert.strictEqual(foreign.status, 'confirmed');
  assert.strictEqual(state.supply.get(3n), user);
  assert.strictEqual(state.supply.get(9n), other);
  assert.ok(state.math.some(function (t) { return t.id === 3n && t.owner === user; }));
  assert.ok(state.math.some(function (t) { return t.id === 9n && t.owner === other; }));
  assert.ok(state.heldMath.some(function (id) { return id === 3n; }));
  assert.ok(!state.heldMath.some(function (id) { return id === 9n; }));
  assert.ok(!state.inventory.math.some(function (t) { return t.id === 3n; }));
  assert.strictEqual(state.rgb.length, 0);
  assert.ok(!state.heldRgb.length);
  assert.ok(!state.rgbBy.r.has(8n));
  assert.ok(state.usedR.has(8n));
  assert.ok(state.usedG.has(16n));
  assert.ok(state.usedB.has(32n));
  assert.ok((state.pendingRgb || []).some(function (p) { return p.r === 8n && p.g === 16n && p.b === 32n; }));
  assert.ok(SITE.planeIssues({ R: 8n, G: 16n, B: 32n }).length);
  const afterPlan = global.PLAN.plan(3n, planCtx);
  assert.strictEqual(afterPlan.exists, true);
  assert.strictEqual(afterPlan.mints, 0);

  const mathCount = state.math.length;
  SITE.noteMint({ label: 'RGB.add 8, 16, 32', r: 8n, g: 16n, b: 32n, rgbId: 7n });
  assert.strictEqual(state.rgb.length, 1);
  assert.strictEqual(state.rgb[0].id, 7n);
  assert.strictEqual(state.rgb[0].owner, user);
  assert.strictEqual(state.rgbBy.r.get(8n), 7n);
  assert.ok(state.heldRgb.some(function (id) { return id === 7n; }));
  assert.ok(!state.heldRgb.some(function (id) { return id === 1n; }));
  assert.ok(global.RULES.rgbChannel('r', 8n, state.rgbBy.r));
  assert.ok(!(state.pendingRgb || []).some(function (p) { return p.r === 8n; }));
  const rgbCount = state.rgb.length;
  await SITE.confirmOwned(minted);
  SITE.noteMint({ r: 8n, g: 16n, b: 32n, rgbId: 7n });
  SITE.noteMint({ r: 8n, g: 1n, b: 1n });
  assert.strictEqual(state.math.length, mathCount);
  assert.strictEqual(state.rgb.length, rgbCount);

  SITE.noteMint({ math: 3n, word: 0n, face: 1n, rgb: 1n });
  assert.ok(state.toon.some(function (t) { return t.id === 3n && t.word === 0n && t.face === 1n && t.rgb === 1n && t.owner === user; }));
  assert.strictEqual(state.toonBy.word.get(0n), 3n);
  assert.strictEqual(state.toonBy.math.get(3n), 3n);
  assert.ok(state.usedWord.has(0n));
  assert.ok(state.heldToon.some(function (id) { return id === 3n; }));
  assert.ok(global.RULES.toonPart('math', 3n, state.toonBy.math));

  SITE.noteMint({ result: 4n });
  SITE.noteMint({ r: 30n, g: 31n, b: 33n });
  assert.strictEqual(store.getItem('math.site.v1'), cacheBytes);
  const cached = savedEth.readCache();
  assert.ok(cached);
  assert.ok(!cached.math.some(function (t) { return t.id === 3n || t.id === 4n || t.id === 9n; }));
  assert.strictEqual(cached.rgb.length, 0);
  assert.strictEqual(cached.toon.length, 0);
  assert.ok(state.usedR.has(30n));
  assert.ok(state.usedB.has(33n));
  assert.strictEqual(state.rgb.filter(function (t) { return t.r === 30n; }).length, 0);
  assert.ok(!state.heldRgb.some(function (id) { return id !== 7n; }));

  const stale = { math: [{ id: 1n, owner: user }], rgb: [], toon: [] };
  const added = SITE.keepRows(stale, null);
  assert.ok(added >= 3);
  assert.ok(stale.math.some(function (t) { return t.id === 3n; }));
  assert.ok(stale.rgb.some(function (t) { return t.id === 7n && t.r === 8n; }));
  assert.ok(stale.toon.some(function (t) { return t.id === 3n; }));
  assert.strictEqual(SITE.keepRows(stale, null), 0);

  assert.strictEqual(state.runBusy, true);
  assert.strictEqual(state.txLock, 'run');
  assert.strictEqual(state.runGen, runGen);
  assert.strictEqual(state.run.length, 3);
  assert.strictEqual(writes.length, writesBefore);
  assert.strictEqual(loc.search, searchBefore);

  const transfer = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  function topicWord(n) { return '0x' + BigInt(n).toString(16).padStart(64, '0'); }
  function topicAddr(a) { return '0x' + String(a).toLowerCase().replace(/^0x/, '').padStart(64, '0'); }
  const mintedRgb = { label: 'RGB.add 40, 41, 42', result: null, status: 'submitted' };
  SITE.confirmMint(mintedRgb, {
    logs: [{
      address: global.ETH.ADDR.RGB,
      topics: [transfer, topicWord(0), topicAddr(user), topicWord(9)],
    }],
  });
  assert.strictEqual(mintedRgb.rgbId, 9n);
  assert.ok(state.rgb.some(function (t) { return t.id === 9n && t.r === 40n && t.g === 41n && t.b === 42n; }));
  assert.ok(state.heldRgb.some(function (id) { return id === 9n; }));
  assert.ok(!state.heldRgb.some(function (id) { return id === 6n; }));

  const named = { label: '4 + 7 = 11', result: null, status: 'submitted' };
  await SITE.confirmOwned(named);
  assert.strictEqual(named.result, 11n);
  assert.strictEqual(state.supply.get(11n), user);
  assert.ok(state.math.some(function (t) { return t.id === 11n && t.owner === user; }));
  const rgbNamed = { label: 'RGB.add 20, 21, 22', result: null, status: 'submitted' };
  const rgbNamedCount = state.rgb.length;
  SITE.confirmMint(rgbNamed);
  assert.strictEqual(rgbNamed.r, 20n);
  assert.strictEqual(state.rgb.length, rgbNamedCount);
  assert.ok(state.usedR.has(20n));
  assert.ok(!state.heldRgb.some(function (id) { return id === 20n; }));

  load('run.js');
  state.tab = 'rgb';
  state.token = null;
  loc.hash = '#step-1-2-3';
  SITE.onHash();
  assert.strictEqual(state.tab, 'rgb');
  assert.strictEqual(loc.hash, '#step-1-2-3');

  const sum = get('planSum');
  sum.options = [];
  sum.innerHTML = '';
  sum.textContent = '';
  const jump = get('step-1-2-3');
  SITE.decoratePlan([{ label: '1 + 2 = 3', status: 'pending' }]);
  assert.strictEqual(sum.getAttribute('role'), 'status');
  assert.strictEqual(sum.options.length, 1);
  assert.strictEqual(sum.options[0].className, 'plan-jump');
  let prevented = false;
  sum.options[0].onclick({ preventDefault: function () { prevented = true; } });
  assert.strictEqual(prevented, true);
  assert.deepStrictEqual(jump.scrolled, { block: 'center' });
  assert.strictEqual(loc.hash, '#step-1-2-3');
  const planRow = element('plan-row');
  planRow.attrs['data-plan'] = '1 + 2 = 3';
  page.planNodes = [planRow];
  SITE.decoratePlan([{ label: '1 + 2 = 3', status: 'failed', error: 'reverted' }]);
  assert.ok(planRow.classList.contains('failed'));
  assert.ok(planRow.options.some(function (n) { return n.className === 'plan-status'; }));
  page.planNodes = [];

  state.runBusy = false;
  state.txLock = null;
  state.run = [];
  state.rgbLock = false;
  state.planesTouched = true;
  state.planes = { R: 1n, G: 1n, B: 1n };
  state.grid = global.PLAN.planesToRows(1n, 1n, 1n);
  [state.usedR, state.usedG, state.usedB].forEach(function (set) { set.delete(1n); });
  state.rgbBy.r.delete(1n);
  state.rgbBy.g.delete(1n);
  state.rgbBy.b.delete(1n);
  get('queue');
  sum.options = [];
  sum.textContent = '';
  sum.innerHTML = '';
  SITE.planRgb();
  assert.ok(state.queue.length);
  assert.ok(sum.options.length);
  assert.ok(sum.options[sum.options.length - 1].textContent.indexOf('0 of') === 0);

  get('rgbLock');
  state.rgbLock = true;
  state.run = [{ status: 'pending', label: '1 + 1 = 2' }];
  SITE.setRgbLock(false);
  assert.strictEqual(state.rgbLock, false);
  state.rgbLock = true;
  state.run = [{ status: 'submitted', label: '1 + 1 = 2' }];
  state.queue = [{ kind: 'keep' }];
  SITE.setRgbLock(false);
  assert.strictEqual(state.rgbLock, true);
  assert.strictEqual(get('rgbLock').textContent, 'lock');
  assert.strictEqual(get('rgbLock').getAttribute('aria-pressed'), 'true');
  assert.strictEqual(get('rgbLock').disabled, true);
  assert.strictEqual(get('planRgb').disabled, true);
  SITE.planRgb();
  assert.strictEqual(state.rgbLock, true);
  assert.strictEqual(state.queue[0].kind, 'keep');
  state.run = [];
  state.runBusy = true;
  SITE.planRgb();
  assert.strictEqual(state.rgbLock, true);
  assert.strictEqual(state.queue[0].kind, 'keep');
  state.runBusy = false;
  state.txLock = 'run';
  SITE.planRgb();
  assert.strictEqual(state.rgbLock, true);
  assert.strictEqual(state.queue[0].kind, 'keep');
  state.txLock = null;
  state.run = [{ status: 'status unknown — check your wallet', label: '1 + 1 = 2' }];
  SITE.setRgbLock(false);
  assert.strictEqual(state.rgbLock, true);
  state.run = [];
  SITE.setRgbLock(false);
  assert.strictEqual(state.rgbLock, false);

  state.rgbLock = true;
  state.tab = 'rgb';
  state.planesTouched = true;
  state.planes = { R: 1n, G: 2n, B: 3n };
  state.grid = global.PLAN.planesToRows(1n, 2n, 3n);
  get('pR').value = '1';
  get('pG').value = '2';
  get('pB').value = '3';
  get('pR').disabled = true;
  const oldCells = SITE.cellsHtml(state.grid);
  get('cells').innerHTML = oldCells;
  SITE.applyLoad({ tab: 'rgb', r: '8', g: '9', b: '10' });
  assert.strictEqual(state.rgbLock, false);
  assert.strictEqual(state.planes.R, 8n);
  assert.strictEqual(state.planes.G, 9n);
  assert.strictEqual(state.planes.B, 10n);
  assert.strictEqual(get('pR').value, '8');
  assert.strictEqual(get('pG').value, '9');
  assert.strictEqual(get('pB').value, '10');
  assert.strictEqual(get('cells').innerHTML, SITE.cellsHtml(global.PLAN.planesToRows(8n, 9n, 10n)));
  assert.notStrictEqual(get('cells').innerHTML, oldCells);
  SITE.undoPlanes();
  assert.strictEqual(state.planes.R, 1n);
  assert.strictEqual(state.planes.G, 2n);
  assert.strictEqual(state.planes.B, 3n);

  state.rgbLock = false;
  state.planes = { R: 1n, G: 1n, B: 1n };
  state.grid = global.PLAN.planesToRows(1n, 1n, 1n);
  SITE.noteEdit('9,9,9');
  SITE.undoPlanes();
  assert.strictEqual(state.planes.R, 9n);
  SITE.setRgbLock(true);
  SITE.redoPlanes();
  assert.strictEqual(state.planes.R, 9n);
  SITE.setRgbLock(false);
  SITE.redoPlanes();
  assert.strictEqual(state.planes.R, 1n);

  state.rgbLock = true;
  state.holdersReady = true;
  state.grid = global.PLAN.planesToRows(4n, 4n, 4n);
  state.planes = { R: 4n, G: 4n, B: 4n };
  state.heartPick = { rows: global.PLAN.planesToRows(1n, 1n, 1n), R: 1n, G: 1n, B: 1n, mints: 0 };
  SITE.applyHeart(false);
  assert.strictEqual(state.planes.R, 4n);
  assert.strictEqual(state.grid[0], global.PLAN.planesToRows(4n, 4n, 4n)[0]);

  state.rgbLock = false;
  state.planesTouched = true;
  state.usedR.delete(1n);
  state.usedG.delete(1n);
  state.usedB.delete(1n);
  state.grid = global.PLAN.planesToRows(5n, 3n, 2n);
  state.planes = { R: 0n, G: 0n, B: 0n };
  get('pR').value = '5';
  get('pG').value = '3';
  get('pB').value = '2';
  state.heartPick = { rows: global.PLAN.planesToRows(1n, 1n, 1n).slice(), R: 1n, G: 1n, B: 1n, mints: 0 };
  SITE.applyHeart(false);
  assert.strictEqual(state.planes.R, 1n);
  SITE.undoPlanes();
  assert.strictEqual(state.planes.R, 5n);
  assert.strictEqual(state.planes.G, 3n);
  assert.strictEqual(state.planes.B, 2n);

  state.rgbLock = false;
  state.grid = global.PLAN.planesToRows(1n, 1n, 1n);
  state.planes = { R: 1n, G: 1n, B: 1n };
  const paintSnap = SITE.planeSnap();
  assert.strictEqual(SITE.paintCell(0, 'r'), true);
  assert.notStrictEqual(SITE.planeSnap(), paintSnap);
  SITE.undoPlanes();
  assert.strictEqual(SITE.planeSnap(), paintSnap);

  let drained = 0;
  while (drained < 80) {
    const snap = SITE.planeSnap();
    SITE.undoPlanes();
    if (SITE.planeSnap() === snap) break;
    drained++;
  }
  state.rgbLock = false;
  state.planes = { R: 0n, G: 0n, B: 0n };
  state.grid = global.PLAN.planesToRows(0n, 0n, 0n);
  for (let i = 1; i <= 70; i++) {
    const before = SITE.planeSnap();
    state.planes = { R: BigInt(i), G: 0n, B: 0n };
    SITE.noteEdit(before);
  }
  assert.strictEqual(state.planes.R, 70n);
  for (let i = 0; i < 80; i++) SITE.undoPlanes();
  assert.strictEqual(state.planes.R, 6n);

  state.browseDirty = false;
  state.mineDirty = false;
  SITE.rememberList('browse');
  assert.strictEqual(state.browseDirty, true);
  assert.strictEqual(state.mineDirty, false);
  state.browseDirty = false;
  SITE.rememberList('mine');
  assert.strictEqual(state.mineDirty, true);
  assert.strictEqual(state.browseDirty, false);

  const baseInv = {
    block: 10,
    math: [{ id: 1n, owner: user }, { id: 2n, owner: user }],
    rgb: [],
    toon: [],
    words: new Map(),
    faces: new Map(),
  };
  savedEth.readCache = function () {
    return {
      block: baseInv.block,
      math: baseInv.math.map(function (t) { return { id: t.id, owner: t.owner }; }),
      rgb: [],
      toon: [],
      words: new Map(),
      faces: new Map(),
    };
  };
  savedEth.preferIndex = function (a, b) { return a || b; };
  savedEth.overlayTexts = function (a) { return a || new Map(); };
  let scanned = null;
  savedEth.loadDelta = async function (base) {
    return {
      block: 11,
      math: base.math.map(function (t) { return { id: t.id, owner: t.owner }; }),
      rgb: [],
      toon: [],
      words: new Map(),
      faces: new Map(),
    };
  };
  savedEth.gasPrice = async function () { return 1n; };
  savedEth.catchHolders = async function () { return { blocked: [], unknown: [] }; };
  savedEth.scanResult = function () { return { blocked: new Set(), unknown: new Set(), blockedDone: false }; };
  savedEth.cacheScan = function (inv) { scanned = inv; return false; };
  global.fetch = function () { return Promise.reject(new Error('no snapshot')); };
  state.tab = 'rgb';
  state.runBusy = false;
  state.txLock = null;
  state.math = [{ id: 1n, owner: user }, { id: 700n, owner: user }];
  state.rgb = [];
  state.toon = [];
  await SITE.refresh();
  assert.ok(state.math.some(function (t) { return t.id === 700n; }));
  assert.ok(scanned);
  assert.ok(scanned.math.some(function (t) { return t.id === 1n; }));
  assert.ok(!scanned.math.some(function (t) { return t.id === 700n; }));

  savedEth.loadDelta = async function () { throw new Error('rpc down'); };
  state.math = [{ id: 1n, owner: user }, { id: 9n, owner: user }];
  state.rgb = [];
  state.toon = [];
  await SITE.refresh();
  assert.ok(state.math.some(function (t) { return t.id === 9n && t.owner === user; }));

  console.log('persist.test.js ok');
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
