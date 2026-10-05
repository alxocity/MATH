const assert = require('assert');
const fs = require('fs');
const AGENT = require('./plan');
const IDEAS = require('./ideas');
const ENS = require('./ens');
const MOLD = require('./mold');

const user = '0xabcabcabcabcabcabcabcabcabcabcabcabcabca';
const stranger = '0xdefdefdefdefdefdefdefdefdefdefdefdefdefd';
const ZERO = IDEAS.ZERO;

function snap(extra) {
  return Object.assign({
    block: 42,
    owners: [user, stranger],
    math: [['1', 0], ['2', 0], ['4', 1], ['8', 1], ['16', 0], ['64', 0], ['128', 0], ['256', 0]],
    rgb: [['9', 0, '1', '2', '4'], ['10', 0, '64', '128', '256']],
    toon: [['1', 0, '5', '6', '9']],
    words: { '5': 'hi', '7': 'yo' },
    faces: { '6': ':)', '8': ':(' },
    wordOwners: [stranger, stranger, stranger, stranger, stranger, stranger, stranger, user],
    faceOwners: [stranger, stranger, stranger, stranger, stranger, stranger, stranger, stranger, user],
    blocked: [],
    blockedDone: true,
  }, extra || {});
}

const example = JSON.parse(fs.readFileSync(__dirname + '/agents/example.json', 'utf8'));
const built = IDEAS.ideas(user, snap());
assert.ok(built.length > 0 && built.length <= 3);
built.forEach(function (idea, i) {
  if (!i) return;
  assert.ok(idea.cost > built[i - 1].cost || (idea.cost === built[i - 1].cost && idea.sent >= built[i - 1].sent));
});
assert.deepStrictEqual(built.map(function (idea) { return idea.kind; }), ['toon', 'math', 'rgb']);
const math = built.filter(function (idea) { return idea.kind === 'math'; })[0];
const toon = built.filter(function (idea) { return idea.kind === 'toon'; })[0];
assert.deepStrictEqual(math.plan, example.math);
assert.strictEqual(math.plan.wallet, user);
assert.strictEqual(toon.plan.ok, true);
assert.strictEqual(toon.plan.target, '2,7,8,10');
assert.strictEqual(toon.cost, 0n);
assert.strictEqual(toon.sent, 0n);
assert.ok(math.sent > 0n);
const rgb = built.filter(function (idea) { return idea.kind === 'rgb'; })[0];
assert.ok(rgb.cost > math.cost);

const shown = MOLD.rows(built);
assert.strictEqual(shown.length, built.length);
shown.forEach(function (row, i) {
  assert.strictEqual(row.text, row.text.toLowerCase());
  if (built[i].plan.ok) {
    assert.ok(row.load);
    assert.strictEqual(row.key, 'idea');
  } else {
    assert.strictEqual(row.load, null);
    assert.strictEqual(row.key, 'ideaBad');
  }
});
assert.strictEqual(shown[0].text, 'toon. you hold all four. free.');
assert.deepStrictEqual(shown[0].load, { tab: 'toon', math: '2', word: '7', face: '8', rgb: '10' });
assert.strictEqual(shown[1].text, '1 + 2 = 3. 0.002 out, 0.002 back to you. gas yours.');
assert.deepStrictEqual(shown[1].load, { tab: 'mint', a: '1', b: '2' });
assert.strictEqual(shown[2].load.tab, 'rgb');
assert.ok(shown[2].text.indexOf('0.03') !== -1);

const bad = [{
  kind: 'toon',
  sent: 0n,
  cost: 0n,
  plan: AGENT.plan(stranger, { math: '16', word: '7', face: '8', rgb: '10' }, snap()),
}];
assert.strictEqual(bad[0].plan.ok, false);
const badRows = MOLD.rows(bad);
assert.strictEqual(badRows.length, 1);
assert.strictEqual(badRows[0].load, null);
assert.strictEqual(badRows[0].key, 'ideaBad');
assert.ok(badRows[0].text.indexOf('does not hold word #7') !== -1);
assert.ok(badRows[0].text.indexOf('toon.add') === -1);
assert.ok(badRows[0].text.indexOf('this does not') === -1);
assert.ok(badRows[0].text.indexOf('load') === -1);

const els = {};
function node(tag) {
  const el = { tagName: tag, childNodes: [], hidden: false, value: '', id: '' };
  let text = '';
  Object.defineProperty(el, 'textContent', {
    get: function () { return text; },
    set: function (v) {
      text = String(v);
      el.childNodes = text ? [{ text: text }] : [];
    },
  });
  el.appendChild = function (c) { el.childNodes.push(c); return c; };
  el.addEventListener = function () {};
  return el;
}
global.document = {
  getElementById: function (id) { return els[id] || null; },
  createElement: node,
  createTextNode: function (t) { return { text: t }; },
};
els['mold-line'] = node('p');
els['mold-ideas'] = node('div');
els['mold-look'] = node('input');

function buttons(el) {
  const out = [];
  (el.childNodes || []).forEach(function (n) {
    if (n.tagName === 'button' && n.textContent === 'load it') out.push(n);
    if (n.childNodes) buttons(n).forEach(function (b) { out.push(b); });
  });
  return out;
}
MOLD.showIdeas(bad);
assert.strictEqual(buttons(els['mold-ideas']).length, 0);
assert.strictEqual(els['mold-ideas'].childNodes.length, 1);
assert.ok(els['mold-ideas'].childNodes[0].textContent.indexOf('does not hold') !== -1);
MOLD.showIdeas(built);
assert.strictEqual(buttons(els['mold-ideas']).length, shown.filter(function (row) { return row.load; }).length);
MOLD.showIdeas([]);
assert.strictEqual(buttons(els['mold-ideas']).length, 0);
assert.strictEqual(els['mold-line'].textContent, 'nothing you can build from here.');

assert.deepStrictEqual(IDEAS.ideas(ZERO, snap()), []);
assert.strictEqual(IDEAS.signer(ZERO, ''), '');
assert.strictEqual(IDEAS.signer(ZERO, user), user);
assert.strictEqual(IDEAS.signer(null, ''), '');
assert.deepStrictEqual(IDEAS.ideas(IDEAS.signer(ZERO, ''), snap()), []);
assert.deepStrictEqual(IDEAS.ideas('0x' + '11'.repeat(20), {
  block: 1,
  owners: [],
  math: [],
  rgb: [],
  toon: [],
  blocked: [],
  blockedDone: true,
}), []);

let forwardCalls = 0;
let nativeForward = 0;
let reverseCalls = 0;
const oldForward = ENS.resolveForward;
const oldFlush = ENS.flush;
ENS.resolveForward = function () { nativeForward++; return Promise.resolve(user); };
ENS.flush = function () { reverseCalls++; return Promise.resolve(false); };
MOLD.resolveLook(user.toUpperCase(), function () { forwardCalls++; throw new Error('forward'); }).then(function (got) {
  assert.strictEqual(got, user);
  assert.strictEqual(forwardCalls, 0);
  return MOLD.resolveLook('alxo.eth', function (name) {
    forwardCalls++;
    assert.strictEqual(name, 'alxo.eth');
    return user;
  });
}).then(function (got) {
  assert.strictEqual(got, user);
  assert.strictEqual(forwardCalls, 1);
  assert.strictEqual(nativeForward, 0);
  assert.strictEqual(reverseCalls, 0);
  return MOLD.resolveLook('missing.eth', function () { return ZERO; });
}).then(function (got) {
  assert.strictEqual(got, '');
  return MOLD.resolveLook('not a name', function () { throw new Error('forward'); });
}).then(function (got) {
  assert.strictEqual(got, '');
  ENS.resolveForward = oldForward;
  ENS.flush = oldFlush;

  const zeroFace = snap();
  zeroFace.wordOwners = zeroFace.wordOwners.slice();
  zeroFace.faceOwners = zeroFace.faceOwners.slice();
  zeroFace.wordOwners[0] = user;
  zeroFace.faceOwners[0] = user;
  const withZero = IDEAS.ideas(user, zeroFace).filter(function (idea) { return idea.kind === 'toon'; })[0];
  assert.strictEqual(withZero.plan.ok, true);
  assert.strictEqual(withZero.plan.target, '2,0,0,10');
  assert.deepStrictEqual(MOLD.loadOf(withZero), { tab: 'toon', math: '2', word: '0', face: '0', rgb: '10' });

  const app = fs.readFileSync(__dirname + '/app.js', 'utf8');
  const ask = app.slice(app.indexOf('async function askIdeas'), app.indexOf('function applyLoad'));
  assert.ok(ask.indexOf('lookWallet') !== -1);
  assert.strictEqual(ask.indexOf('me()'), -1);
  assert.ok(ask.indexOf('resolveLook') !== -1);
  assert.ok(ask.indexOf('IDEAS.walletOf') !== -1);
  assert.ok(app.indexOf('let lookWallet') !== -1);
  console.log('ideas.test.js ok');
}).catch(function (e) {
  ENS.resolveForward = oldForward;
  ENS.flush = oldFlush;
  console.error(e);
  process.exit(1);
});
