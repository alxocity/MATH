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

function match(node, sel) {
  if (!node || sel == null) return false;
  if (sel.charAt(0) === '.') return String(node.className || '').split(/\s+/).indexOf(sel.slice(1)) !== -1;
  const valued = /^\[data-([A-Za-z]+)="([^"]+)"\]$/.exec(sel);
  if (valued) return node.dataset && node.dataset[valued[1]] === valued[2];
  const bare = /^\[data-([A-Za-z]+)\]$/.exec(sel);
  if (bare) return !!(node.dataset && node.dataset[bare[1]] != null && node.dataset[bare[1]] !== '');
  return node.tag === sel;
}

function element(tag) {
  const node = {
    tag: tag || 'div',
    className: '',
    id: '',
    value: '',
    type: '',
    checked: false,
    hidden: false,
    disabled: false,
    readOnly: false,
    dataset: {},
    style: {},
    children: [],
    parentNode: null,
    listeners: {},
    _text: '',
    appendChild: function (child) {
      child.parentNode = node;
      node.children.push(child);
      return child;
    },
    addEventListener: function (type, fn) {
      const bag = node.listeners[type] || [];
      bag.push(fn);
      node.listeners[type] = bag;
    },
    dispatchEvent: function (ev) {
      (node.listeners[ev.type] || []).forEach(function (fn) { fn(ev); });
    },
    querySelector: function (sel) {
      return node.querySelectorAll(sel)[0] || null;
    },
    querySelectorAll: function (sel) {
      const out = [];
      function walk(n) {
        (n.children || []).forEach(function (child) {
          if (match(child, sel)) out.push(child);
          walk(child);
        });
      }
      walk(node);
      return out;
    },
    setAttribute: function () {},
  };
  Object.defineProperty(node, 'textContent', {
    get: function () { return node._text; },
    set: function (v) {
      node._text = String(v == null ? '' : v);
      node.children = [];
    },
  });
  return node;
}

const ids = {};
const listeners = { window: {}, document: {} };
function listen(bag, type, fn) {
  const list = bag[type] || [];
  list.push(fn);
  bag[type] = list;
}

const doc = {
  visibilityState: 'visible',
  getElementById: function (id) {
    if (!ids[id]) ids[id] = element(id);
    ids[id].id = id;
    return ids[id];
  },
  createElement: function (tag) { return element(tag); },
  createTextNode: function (text) {
    const node = element('text');
    node.textContent = text;
    return node;
  },
  addEventListener: function (type, fn) { listen(listeners.document, type, fn); },
  querySelector: function () { return null; },
  querySelectorAll: function () { return []; },
};

const loc = {
  pathname: '/ens/',
  search: '?preset=math',
  hash: '',
  origin: 'https://math.alxo.city',
  href: 'https://math.alxo.city/ens/?preset=math',
};
const store = memory();
global.document = doc;
global.window = { addEventListener: function (type, fn) { listen(listeners.window, type, fn); } };
global.localStorage = store;
global.location = loc;
global.history = { replaceState: function () {} };
global.ENS = { keccakText: function () { return '0'.repeat(64); } };
global.RUN = {
  batchHold: function () { return ''; },
  bulkWhy: function () { return ''; },
};
global.fetch = function () { return Promise.reject(new Error('no preset')); };

require('../query');
require('./diff');
QUERY.writeStore(store, { preset: 'mine', R: '1', G: '2', B: '3' });
vm.runInThisContext(fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8'), { filename: 'ens/app.js' });

function fire(kind) {
  const bag = kind === 'pagehide' ? listeners.window : listeners.document;
  (bag[kind] || []).forEach(function (fn) { fn(); });
}

const saved = QUERY.readStore(store);
assert.strictEqual(saved && saved.preset, 'mine');
doc.visibilityState = 'hidden';
fire('pagehide');
assert.strictEqual(QUERY.readStore(store).preset, 'mine');
fire('visibilitychange');
assert.strictEqual(QUERY.readStore(store).preset, 'mine');

doc.getElementById('parent').dispatchEvent({ type: 'input' });
assert.strictEqual(QUERY.readStore(store).preset, '');
QUERY.writeStore(store, { preset: 'kept', R: '1', G: '2', B: '3' });
fire('pagehide');
assert.strictEqual(QUERY.readStore(store).preset, '');
assert.strictEqual(QUERY.readStore(store).R, '1');

global.sessionStorage = memory();
global.sessionStorage.setItem(QUERY.MARK_KEY, '?preset=math');
const written = [];
global.history.replaceState = function (_s, _t, next) {
  written.push(next);
  const s = String(next);
  const q = s.indexOf('?');
  const h = s.indexOf('#');
  loc.search = q === -1 ? '' : (h > q ? s.slice(q, h) : s.slice(q));
  loc.hash = h === -1 ? '' : s.slice(h);
};
doc.getElementById('add').dispatchEvent({ type: 'click' });
assert.strictEqual(written.length, 1);
assert.strictEqual(loc.search, '');
assert.strictEqual(global.sessionStorage.getItem(QUERY.MARK_KEY), null);
loc.search = '?preset=math';
global.sessionStorage.setItem(QUERY.MARK_KEY, '?preset=math');
global.history.replaceState = function () {};
doc.getElementById('add').dispatchEvent({ type: 'click' });
assert.strictEqual(loc.search, '?preset=math');
assert.strictEqual(global.sessionStorage.getItem(QUERY.MARK_KEY), '?preset=math');
global.history.replaceState = function () { throw new Error('no history'); };
assert.doesNotThrow(function () { doc.getElementById('add').dispatchEvent({ type: 'click' }); });
assert.strictEqual(global.sessionStorage.getItem(QUERY.MARK_KEY), '?preset=math');

console.log('ens/hide.test.js ok');
