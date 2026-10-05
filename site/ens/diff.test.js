const assert = require('assert');
const fs = require('fs');
const path = require('path');
global.ABI = require('../abi');
require('../ens');
const D = require('./diff');

const WALLET = '0x' + 'ab'.repeat(20);
const OTHER = '0x' + '11'.repeat(20);
const OLD = '0x4976fb03c32e5b8cfe2b6ccb31c09ba78ebaba41';
const MATH = '0x6b4fccdd888bb6fd3934a9e49ef64dfd2c0d8e6d';
const URL = 'https://math.alxo.city';
const DESC = 'The MATH contract. Add two token ids.';
const PARENT = ENS.namehash('alxocity.eth');

function chain(over) {
  return Object.assign({
    exists: false,
    owner: '',
    resolver: '',
    addr: '',
    text: {},
    resolverMulticall: false,
    approved: false,
  }, over || {});
}

function spec(over, nameOver, chainOver) {
  const label = (nameOver && nameOver.label) || 'math';
  const name = Object.assign({
    label: label,
    node: ENS.namehash(label + '.alxocity.eth'),
    labelhash: ENS.keccakText(label),
    addr: MATH,
    text: { url: URL, description: DESC },
    takeOwner: false,
    drop: [],
    chain: chain(chainOver),
  }, nameOver || {});
  if (chainOver) name.chain = chain(chainOver);
  return Object.assign({
    parent: 'alxocity.eth',
    wrapped: false,
    parentNode: PARENT,
    wallet: WALLET,
    controlsParent: true,
    parentResolver: OLD,
    parentResolverMulticall: true,
    useNewResolver: false,
    names: [name],
  }, over || {});
}

function roundtrip(s) {
  const plan = D.diff(s);
  assert.ok(plan.txs.length > 0);
  const again = D.diff(D.apply(s, plan));
  assert.strictEqual(again.txs.length, 0, 'second pass');
  const third = D.diff(D.apply(D.apply(s, plan), again));
  assert.strictEqual(third.txs.length, 0, 'third pass');
  return plan;
}

const back = D.decodeMulticall(D.multicallData(['0x1234', '0xabcdef']));
assert.deepStrictEqual(back, ['0x1234', '0xabcdef']);
assert.strictEqual(D.emptyMulticall(), '0xac9650d8' + '0'.repeat(62) + '20' + '0'.repeat(64));

const missing = roundtrip(spec());
assert.strictEqual(missing.txs.length, 2);
assert.strictEqual(missing.txs[0].to, D.REGISTRY);
assert.strictEqual(missing.txs[0].data.slice(0, 10), '0x5ef2c7f0');
assert.ok(missing.txs[0].data.indexOf(ENS.keccakText('math')) > 0);
assert.strictEqual(missing.txs[1].to, OLD);
assert.strictEqual(missing.txs[1].label, 'math.alxocity.eth resolver records');
const created = D.decodeMulticall(missing.txs[1].data);
assert.deepStrictEqual(created.map(function (c) { return c.slice(0, 10); }), ['0xd5fa2b00', '0x10f13a8c', '0x10f13a8c']);
assert.strictEqual(missing.names[0].owner.kind, 'new');
assert.strictEqual(missing.names[0].addr.kind, 'new');
assert.ok(missing.names[0].texts.every(function (t) { return t.kind === 'new'; }));

const partial = roundtrip(spec({}, {}, {
  exists: true,
  owner: WALLET,
  resolver: OLD,
  addr: MATH,
  text: { description: DESC },
  resolverMulticall: true,
}));
assert.strictEqual(partial.txs.length, 1);
assert.strictEqual(partial.txs[0].depends, false);
const partialCalls = D.decodeMulticall(partial.txs[0].data);
assert.strictEqual(partialCalls.length, 1);
assert.strictEqual(partialCalls[0].slice(0, 10), '0x10f13a8c');
assert.ok(partialCalls[0].indexOf('75726c') > 0);
assert.strictEqual(partial.names[0].addr.kind, 'same');
assert.strictEqual(partial.names[0].texts.find(function (t) { return t.key === 'url'; }).kind, 'new');
assert.strictEqual(partial.names[0].texts.find(function (t) { return t.key === 'description'; }).kind, 'same');

const changed = roundtrip(spec({}, {}, {
  exists: true,
  owner: WALLET,
  resolver: OLD,
  addr: OTHER,
  text: { url: URL, description: DESC },
  resolverMulticall: true,
}));
assert.strictEqual(changed.txs.length, 1);
assert.strictEqual(changed.names[0].addr.kind, 'changed');
assert.strictEqual(changed.names[0].addr.old, OTHER);
assert.strictEqual(changed.names[0].addr.next, MATH);
const changedCalls = D.decodeMulticall(changed.txs[0].data);
assert.deepStrictEqual(changedCalls.map(function (c) { return c.slice(0, 10); }), ['0xd5fa2b00']);

const extra = spec({}, {}, {
  exists: true,
  owner: WALLET,
  resolver: OLD,
  addr: MATH,
  text: { url: URL, description: DESC, avatar: 'https://x' },
  resolverMulticall: true,
});
const kept = D.diff(extra);
assert.strictEqual(kept.txs.length, 0);
assert.strictEqual(kept.names[0].texts.find(function (t) { return t.key === 'avatar'; }).kind, 'extra');
extra.names[0].drop = ['avatar'];
const dropped = roundtrip(extra);
assert.strictEqual(dropped.txs.length, 1);
const dropCalls = D.decodeMulticall(dropped.txs[0].data);
assert.strictEqual(dropCalls.length, 1);
assert.strictEqual(dropCalls[0].slice(0, 10), '0x10f13a8c');
const afterDrop = D.apply(extra, dropped);
assert.strictEqual(afterDrop.names[0].chain.text.avatar, undefined);
assert.strictEqual(afterDrop.names[0].chain.text.url, URL);

const held = spec({}, { takeOwner: false }, {
  exists: true,
  owner: OTHER,
  resolver: OLD,
  addr: OTHER,
  text: {},
  resolverMulticall: true,
});
const blocked = D.diff(held);
assert.strictEqual(blocked.txs.length, 0);
assert.strictEqual(blocked.names[0].note, 'owner');
assert.strictEqual(blocked.names[0].addr.kind, 'changed');
assert.strictEqual(blocked.names[0].owner.kind, 'kept');
held.names[0].takeOwner = true;
const taken = roundtrip(held);
assert.strictEqual(taken.txs[0].data.slice(0, 10), '0x5ef2c7f0');
assert.ok(taken.txs[0].data.indexOf(WALLET.slice(2)) > 0);
assert.strictEqual(taken.names[0].owner.kind, 'changed');

const perRecord = spec({ parentResolverMulticall: false, useNewResolver: false });
const split = roundtrip(perRecord);
assert.strictEqual(split.txs.length, 4);
assert.ok(split.txs.every(function (tx) { return tx.data.slice(0, 10) !== '0xac9650d8'; }));
assert.strictEqual(split.txs.filter(function (tx) { return tx.data.slice(0, 10) === '0x10f13a8c'; }).length, 2);
assert.strictEqual(split.txs.filter(function (tx) { return tx.data.slice(0, 10) === '0xd5fa2b00'; }).length, 1);

const upgraded = spec({ parentResolverMulticall: false, useNewResolver: true });
const moved = roundtrip(upgraded);
assert.strictEqual(moved.txs.length, 2);
assert.ok(moved.txs[0].data.indexOf(D.NEW_RESOLVER.slice(2)) > 0);
assert.strictEqual(moved.txs[1].to, D.NEW_RESOLVER);
assert.strictEqual(moved.txs[1].data.slice(0, 10), '0xac9650d8');
assert.strictEqual(D.decodeMulticall(moved.txs[1].data).length, 3);

const wrapped = roundtrip(spec({ wrapped: true, parentResolver: D.NEW_RESOLVER, parentResolverMulticall: true }));
assert.strictEqual(wrapped.txs[0].to, D.WRAPPER);
assert.strictEqual(wrapped.txs[0].data.slice(0, 10), '0x24c1af44');
assert.strictEqual(parseInt(wrapped.txs[0].data.slice(74, 138), 16), 224);
assert.ok(wrapped.txs[0].data.indexOf('6d617468') > 0);
assert.strictEqual(wrapped.txs[1].to, D.NEW_RESOLVER);

const wrappedOld = D.diff(spec({ wrapped: true, parentResolverMulticall: true, useNewResolver: false }));
assert.strictEqual(wrappedOld.txs.length, 1);
assert.strictEqual(wrappedOld.txs[0].to, D.WRAPPER);
assert.strictEqual(wrappedOld.names[0].note, 'resolver');
const wrappedNew = roundtrip(spec({ wrapped: true, parentResolverMulticall: true, useNewResolver: true }));
assert.strictEqual(wrappedNew.txs.length, 2);
assert.strictEqual(wrappedNew.txs[1].to, D.NEW_RESOLVER);

const idle = D.diff(spec({}, {}, {
  exists: true,
  owner: WALLET,
  resolver: OLD,
  addr: MATH,
  text: { url: URL, description: DESC, avatar: 'https://x' },
  resolverMulticall: true,
}));
assert.strictEqual(idle.txs.length, 0);
assert.strictEqual(D.diff(D.apply(spec(), missing)).txs.length, 0);

const raw = fs.readFileSync(path.join(__dirname, 'presets/math.json'), 'utf8');
const preset = D.parsePreset(raw);
assert.strictEqual(preset.parent, 'alxocity.eth');
assert.strictEqual(preset.names.length, 6);
assert.deepStrictEqual(preset.names.map(function (n) { return n.label; }), [
  'math', 'rgb', 'toon', 'mathrender', 'rgbrender', 'toonrender',
]);
assert.deepStrictEqual(preset.names.map(function (n) { return n.addr; }), [
  '0x6b4fccdd888bb6fd3934a9e49ef64dfd2c0d8e6d',
  '0x9355fb9693fff9bb6f06721c82fe0b5f49e6c956',
  '0x026a7d72a448d0e44d441e55f746bf56b843aedb',
  '0xb3ca13a2722cab48c8d9068bd67656efe2d5e376',
  '0x62ffe75cd9824a2e8855cbc055256de229b5b936',
  '0x1e1a576e4186551e4dede58ccc2dcc34697159cb',
]);
preset.names.forEach(function (n) {
  assert.strictEqual(n.text.url, URL);
  assert.ok(n.text.description && n.text.description.length < 80);
});
assert.ok(raw.indexOf('0x6B4fccdd888Bb6fD3934A9e49eF64dfd2c0D8e6D') > 0);
assert.ok(raw.indexOf('0x1E1a576e4186551e4DEdE58Ccc2DCC34697159Cb') > 0);
assert.throws(function () { D.parsePreset('{"parent":"eth","names":[]}'); });
assert.throws(function () { D.parsePreset({ parent: 'alxocity.eth', names: [{ label: 'a.b', addr: MATH, text: {} }] }); });
assert.throws(function () {
  D.parsePreset({
    parent: 'alxocity.eth',
    names: [
      { label: 'math', addr: MATH, text: {} },
      { label: 'math', addr: MATH, text: {} },
    ],
  });
});

const filePreset = D.parsePreset(JSON.parse(raw));
const presetSpec = {
  parent: filePreset.parent,
  wrapped: false,
  parentNode: ENS.namehash(filePreset.parent),
  wallet: WALLET,
  controlsParent: true,
  parentResolver: OLD,
  parentResolverMulticall: true,
  useNewResolver: false,
  names: filePreset.names.map(function (n) {
    return {
      label: n.label,
      node: ENS.namehash(n.label + '.' + filePreset.parent),
      labelhash: ENS.keccakText(n.label),
      addr: n.addr,
      text: n.text,
      takeOwner: false,
      drop: [],
      chain: chain(),
    };
  }),
};
const six = roundtrip(presetSpec);
assert.strictEqual(six.txs.length, 12);
assert.strictEqual(D.diff(D.apply(presetSpec, six)).txs.length, 0);

console.log('ens diff ok');
