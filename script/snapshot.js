#!/usr/bin/env node
// node script/snapshot.js — refresh site/index.json from mainnet. Reads only.
// Incremental from the snapshot's supply. A short or partial read throws and does not write.
const fs = require('fs');
const path = require('path');

global.ABI = require('../site/abi');
const ETH = require('../site/eth');

const OWNER = /^0x[0-9a-f]{40}$/;

function assertInventory(inv, prev) {
  if (!inv || !Number.isInteger(inv.block) || inv.block < 0) throw new Error('block');
  ['math', 'rgb', 'toon'].forEach(function (k) {
    if (!Array.isArray(inv[k]) || !inv[k].length) throw new Error('short ' + k);
  });
  if (prev) {
    if (inv.math.length < prev.math.length) throw new Error('short MATH');
    if (inv.rgb.length < prev.rgb.length) throw new Error('short RGB');
    if (inv.toon.length < prev.toon.length) throw new Error('short TOON');
  }
  inv.math.forEach(function (t) {
    if (t.id == null || !OWNER.test(t.owner)) throw new Error('MATH ' + t.id);
  });
  inv.rgb.forEach(function (t) {
    if (t.r == null || t.g == null || t.b == null || !OWNER.test(t.owner)) throw new Error('RGB ' + t.id);
  });
  inv.toon.forEach(function (t) {
    if (t.word == null || t.face == null || t.rgb == null || !OWNER.test(t.owner)) throw new Error('TOON ' + t.id);
    if (!inv.words || !inv.words.has(t.word)) throw new Error('WORD ' + t.word);
    if (!inv.faces || !inv.faces.has(t.face)) throw new Error('FACE ' + t.face);
  });
}

function sameBody(a, b) {
  function slim(p) {
    const c = JSON.parse(JSON.stringify(p));
    delete c.block;
    return JSON.stringify(c);
  }
  return slim(a) === slim(b);
}

async function main() {
  const out = path.join(__dirname, '../site/index.json');
  const raw = JSON.parse(fs.readFileSync(out, 'utf8'));
  const prev = ETH.unpack(raw);
  if (!prev) throw new Error('snapshot');
  const inv = await ETH.loadDelta(prev, function (msg) { console.error(msg); });
  assertInventory(inv, prev);
  const packed = ETH.pack(inv, null);
  delete packed.blocked;
  delete packed.blockedDone;
  if (sameBody(raw, packed)) {
    console.error('unchanged block ' + raw.block);
    return;
  }
  const tmp = out + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(packed));
  try {
    const check = ETH.unpack(JSON.parse(fs.readFileSync(tmp, 'utf8')));
    assertInventory(check, prev);
    fs.renameSync(tmp, out);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (ignore) { /* leave the old snapshot */ }
    throw e;
  }
  console.error('wrote ' + out + ' block ' + packed.block + ' MATH ' + packed.math.length + ' RGB ' + packed.rgb.length + ' TOON ' + packed.toon.length + ' owners ' + packed.owners.length + ' WORD ' + Object.keys(packed.words).length + ' FACE ' + Object.keys(packed.faces).length);
}

if (require.main === module) {
  main().catch(function (e) {
    console.error(e);
    process.exit(1);
  });
} else {
  module.exports = { assertInventory: assertInventory, sameBody: sameBody };
}
