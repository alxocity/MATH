const assert = require('assert');
const fs = require('fs');
const RULES = require('./rules');

const byR = new Map([[5n, 45n]]);
assert.strictEqual(RULES.rgbChannel('r', 5n, byR), 'red already used by RGB #45');
assert.strictEqual(RULES.rgbChannel('R', 5, byR), 'red already used by RGB #45');
assert.strictEqual(RULES.rgbChannel('g', 5n, new Map([[8n, 3n]])), '');
assert.strictEqual(RULES.rgbChannel('b', 9n, new Map()), '');

const same = new Map([[1n, 45n], [2n, 45n], [3n, 45n]]);
assert.strictEqual(RULES.rgbImage(1n, 2n, 3n, same, same, same), 'this image is already RGB #45');
assert.strictEqual(RULES.rgbImage(1n, 2n, 9n, same, same, same), '');

const faces = new Map([[9n, 812n]]);
assert.strictEqual(RULES.toonPart('face', 9n, faces), 'face already in TOON #812');
assert.strictEqual(RULES.toonPart('word', 1n, faces), '');
assert.strictEqual(RULES.toonPart('math', 812n, new Map([[812n, 812n]])), 'this MATH already bases TOON #812');
assert.strictEqual(RULES.payout(), "holder can't receive payout");
assert.strictEqual(RULES.unchecked(), 'holder unchecked');
assert.strictEqual(RULES.notYours(), "you don't own this");
assert.strictEqual(RULES.connectWallet(), 'connect a wallet');
const blocked = new Set(['0xabcabcabcabcabcabcabcabcabcabcabcabcabca']);
const unknown = new Set(['0xdefdefdefdefdefdefdefdefdefdefdefdefdefd']);
assert.strictEqual(RULES.holderNote(blocked.values().next().value, blocked, unknown), RULES.payout());
assert.strictEqual(RULES.holderNote('0xDEFDEFDEFDEFDEFDEFDEFDEFDEFDEFDEFDEFDEFD', blocked, unknown), RULES.unchecked());
assert.strictEqual(RULES.holderNote('0x1111111111111111111111111111111111111111', blocked, unknown), '');
assert.strictEqual(RULES.holderNote('0xabcabcabcabcabcabcabcabcabcabcabcabcabca', blocked, unknown), RULES.payout());
assert.strictEqual(RULES.preferNote(RULES.unchecked(), RULES.payout()), RULES.payout());
assert.strictEqual(RULES.preferNote('', RULES.unchecked()), RULES.unchecked());
assert.strictEqual(RULES.mold(RULES.unchecked()), null);
assert.strictEqual(RULES.mold(RULES.connectWallet()).key, 'noWallet');

assert.deepStrictEqual(RULES.mold('red already used by RGB #45'), { key: 'rgbTaken', vars: { color: 'red' } });
assert.strictEqual(RULES.mold('this image is already RGB #45').key, 'rgbImage');
assert.strictEqual(RULES.mold(RULES.payout()).key, 'payout');
assert.strictEqual(RULES.mold(RULES.notYours()).key, 'notYours');
assert.strictEqual(RULES.mold('face already in TOON #812').key, 'toonSpent');
assert.strictEqual(RULES.mold('face already in TOON #812').vars.kind, 'face');
assert.strictEqual(RULES.mold('this MATH already bases TOON #812').key, 'toonMath');
assert.strictEqual(RULES.mold('already minted'), null);
assert.strictEqual(RULES.mold(''), null);

const copy = RULES.about();
assert.strictEqual(copy.length, 3);
assert.ok(copy[0].indexOf('0.03 ETH') !== -1 && copy[0].indexOf('0.01') !== -1);
assert.ok(copy[0].indexOf('existing MATH tokens') !== -1);
assert.ok(copy[1].indexOf('0.002 ETH') !== -1 && copy[1].indexOf('0.001') !== -1 && copy[1].indexOf('2300-gas') !== -1);
assert.ok(copy[2].indexOf('No fee') !== -1 && copy[2].indexOf('TOON id is the MATH id') !== -1);

const mold = fs.readFileSync(__dirname + '/mold.js', 'utf8');
[
  "that {color}'s taken. forever. pick another.",
  "that picture already exists. rgb doesn't do sequels.",
  "that holder can't take the cut. the mint stays shut.",
  "you don't own that. toon only takes what you hold.",
  'that {kind} is already in a toon. one use. then never.',
  'that math already grew a toon. the id is taken.',
].forEach(function (line) { assert.ok(mold.indexOf(line) !== -1, line); });

const about = fs.readFileSync(__dirname + '/about.js', 'utf8');
assert.ok(about.indexOf('rules') !== -1 && about.indexOf('RULES.about') !== -1);
assert.ok(about.indexOf('inputs you own are free') !== -1);
assert.ok(about.indexOf('route shorter') !== -1);
['mint.js', 'rgb.js', 'route.js'].forEach(function (name) {
  const src = fs.readFileSync(__dirname + '/' + name, 'utf8');
  assert.ok(src.indexOf('inputs you own are free, so every token you hold makes the next build cheaper.') !== -1, name);
});
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
assert.ok(html.indexOf('rules.js') !== -1);
