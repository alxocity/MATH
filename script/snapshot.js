#!/usr/bin/env node
// node script/snapshot.js — rewrite site/index.json from mainnet. Reads only.
const fs = require('fs');
const path = require('path');

global.ABI = require('../site/abi');
const ETH = require('../site/eth');

(async function () {
  const inv = await ETH.loadInventory(function (msg) { console.error(msg); });
  const packed = ETH.pack(inv, null);
  delete packed.blocked;
  delete packed.blockedDone;
  const out = path.join(__dirname, '../site/index.json');
  fs.writeFileSync(out, JSON.stringify(packed));
  console.error('wrote ' + out + ' block ' + packed.block + ' MATH ' + packed.math.length + ' RGB ' + packed.rgb.length + ' TOON ' + packed.toon.length + ' owners ' + packed.owners.length + ' WORD ' + Object.keys(packed.words).length + ' FACE ' + Object.keys(packed.faces).length);
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
