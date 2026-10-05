const assert = require('assert');
const fs = require('fs');
const AGENT = require('./plan');
const ABI = require('./abi');
const PLAN = require('./planner');
const ETH = require('./eth');

const user = '0xabcabcabcabcabcabcabcabcabcabcabcabcabca';
const stranger = '0xdefdefdefdefdefdefdefdefdefdefdefdefdefd';
const KEYS = ['block', 'exists', 'kind', 'note', 'ok', 'owned', 'royalty', 'shares', 'target', 'txs', 'v', 'wallet'];
const TX_KEYS = ['data', 'to', 'value'];
const SHARE_KEYS = ['holder', 'id', 'owned', 'wei'];

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

function keys(o) {
  return Object.keys(o).sort();
}

function check(out) {
  assert.deepStrictEqual(keys(out), KEYS);
  assert.strictEqual(out.v, 1);
  assert.strictEqual(out.wallet, user);
  assert.strictEqual(out.block, 42);
  JSON.parse(JSON.stringify(out));
  out.txs.forEach(function (tx) {
    assert.deepStrictEqual(keys(tx), TX_KEYS);
    assert.ok(!Object.prototype.hasOwnProperty.call(tx, 'from'));
  });
  out.shares.forEach(function (row) { assert.deepStrictEqual(keys(row), SHARE_KEYS); });
  const sum = out.shares.reduce(function (n, row) { return n + BigInt(row.wei); }, 0n);
  assert.strictEqual(sum.toString(), out.royalty);
}

const both = AGENT.plan(user, '3', snap());
check(both);
assert.strictEqual(both.ok, true);
assert.strictEqual(both.kind, 'math');
assert.strictEqual(both.target, '3');
assert.strictEqual(both.exists, false);
assert.strictEqual(both.txs.length, 1);
assert.strictEqual(both.txs[0].to, ETH.ADDR.MATH);
assert.ok(both.txs[0].data === ABI.call(ABI.SEL.add2, [1n, 2n]) || both.txs[0].data === ABI.call(ABI.SEL.add2, [2n, 1n]));
assert.ok(both.txs[0].data.startsWith('0x771602f7'));
assert.strictEqual(both.txs[0].value, '0x' + PLAN.MSG_MATH.toString(16));
assert.strictEqual(both.royalty, '0');
assert.deepStrictEqual(both.owned, ['1', '2']);
assert.deepStrictEqual(both.shares.map(function (row) { return row.id; }).sort(), ['1', '2']);
assert.ok(both.shares.every(function (row) { return row.owned === true && row.wei === '0'; }));
assert.ok(both.note.indexOf('A human signs') === 0);
assert.ok(both.note.indexOf('2300-gas') !== -1);

const cold = '0x' + '11'.repeat(20);
const none = AGENT.plan(cold, { math: '12' }, snap());
assert.strictEqual(none.wallet, cold);
assert.strictEqual(none.txs.length, 1);
assert.strictEqual(none.royalty, (2n * PLAN.ROY_WEI).toString());
assert.deepStrictEqual(none.owned, []);
assert.ok(none.shares.every(function (row) { return row.owned === false && row.wei === PLAN.ROY_WEI.toString(); }));

const part = snap();
part.math = part.math.map(function (row) { return row[0] === '2' ? ['2', 1] : row; });
const half = AGENT.plan(user, '3', part);
check(half);
assert.strictEqual(half.txs.length, 1);
assert.deepStrictEqual(half.owned, ['1']);
assert.strictEqual(half.royalty, PLAN.ROY_WEI.toString());

const have = AGENT.plan(user.toUpperCase(), '1', JSON.stringify(snap()));
check(have);
assert.strictEqual(have.exists, true);
assert.deepStrictEqual(have.txs, []);
assert.strictEqual(have.royalty, '0');
assert.deepStrictEqual(have.owned, ['1']);
assert.strictEqual(have.note, 'Already minted. Nothing to sign.');

const rgb = AGENT.plan(user, { r: '8', g: '16', b: '32' }, snap());
check(rgb);
assert.strictEqual(rgb.kind, 'rgb');
assert.strictEqual(rgb.target, '8,16,32');
assert.strictEqual(rgb.ok, true);
assert.strictEqual(rgb.exists, false);
const rgbTx = rgb.txs[rgb.txs.length - 1];
assert.strictEqual(rgbTx.to, ETH.ADDR.RGB);
assert.strictEqual(rgbTx.data, ABI.call(ABI.SEL.add3, [8n, 16n, 32n]));
assert.ok(rgbTx.data.startsWith('0x505fb46c'));
assert.strictEqual(rgbTx.value, '0x' + PLAN.MSG_RGB.toString(16));
assert.ok(rgb.owned.indexOf('16') !== -1);
assert.ok(rgb.owned.indexOf('8') === -1);
const channel = rgb.shares.slice(-3);
assert.deepStrictEqual(channel.map(function (row) { return row.id; }), ['8', '16', '32']);
assert.strictEqual(channel[0].wei, PLAN.RGB_ROY.toString());
assert.strictEqual(channel[0].owned, false);
assert.strictEqual(channel[1].wei, '0');
assert.strictEqual(channel[1].owned, true);
assert.strictEqual(channel[2].wei, '0');
assert.strictEqual(channel[2].holder, user);

const taken = AGENT.plan(user, { r: '1', g: '2', b: '8' }, snap());
check(taken);
assert.strictEqual(taken.ok, false);
assert.ok(taken.note.indexOf('Red already used by RGB #9.') !== -1);
assert.ok(taken.note.indexOf('Green already used by RGB #9.') !== -1);
assert.strictEqual(taken.txs[taken.txs.length - 1].to, ETH.ADDR.RGB);

const image = AGENT.plan(user, { r: '1', g: '2', b: '4' }, snap());
check(image);
assert.strictEqual(image.exists, true);
assert.deepStrictEqual(image.txs, []);
assert.deepStrictEqual(image.owned, ['1', '2']);

const toon = AGENT.plan(user, { math: '16', word: '7', face: '8', rgb: '10' }, snap());
check(toon);
assert.strictEqual(toon.kind, 'toon');
assert.strictEqual(toon.ok, true);
assert.strictEqual(toon.shares[1].owned, true);
assert.strictEqual(toon.shares[1].holder, user);
assert.strictEqual(toon.shares[2].owned, true);
assert.strictEqual(toon.shares[2].holder, user);
assert.deepStrictEqual(toon.owned, ['7', '8', '10', '16']);
assert.strictEqual(toon.target, '16,7,8,10');
assert.strictEqual(toon.txs.length, 1);
assert.strictEqual(toon.txs[0].to, ETH.ADDR.TOON);
assert.strictEqual(toon.txs[0].data, ABI.call(ABI.SEL.add4, [16n, 7n, 8n, 10n]));
assert.ok(toon.txs[0].data.startsWith('0xe022d77c'));
assert.strictEqual(toon.txs[0].value, '0x0');
assert.strictEqual(toon.royalty, '0');
assert.ok(toon.note.indexOf('free') !== -1);
assert.ok(toon.note.indexOf('not in the snapshot') === -1);

const spent = AGENT.plan(user, { math: '16', word: '5', face: '8', rgb: '9' }, snap());
check(spent);
assert.strictEqual(spent.ok, false);
assert.ok(spent.note.indexOf('word already in TOON #1.') !== -1);
assert.strictEqual(spent.txs.length, 1);
assert.strictEqual(spent.txs[0].value, '0x0');

const missing = AGENT.plan(stranger, { math: '16', word: '7', face: '8', rgb: '10' }, snap());
assert.strictEqual(missing.ok, false);
assert.ok(missing.note.indexOf('does not hold MATH #16') !== -1);
assert.ok(missing.note.indexOf('does not hold RGB #10') !== -1);
assert.strictEqual(missing.wallet, stranger);

const same = AGENT.plan(user, { math: '1', word: '5', face: '6', rgb: '9' }, snap());
check(same);
assert.strictEqual(same.exists, true);
assert.deepStrictEqual(same.txs, []);
assert.deepStrictEqual(same.owned, ['1', '9']);

assert.throws(function () { AGENT.plan('0x1234', '3', snap()); }, /wallet/);
assert.throws(function () { AGENT.plan(user, { r: '1', g: '2' }, snap()); }, /target/);
assert.throws(function () { AGENT.plan(user, { math: '1', word: '2' }, snap()); }, /target/);
assert.throws(function () { AGENT.plan(user, '0', snap()); }, /target/);
assert.throws(function () { AGENT.plan(user, { math: '0', word: '0', face: '0', rgb: '10' }, snap()); }, /target/);
assert.throws(function () { AGENT.plan(user, { r: '0', g: '2', b: '4' }, snap()); }, /target/);
assert.throws(function () { AGENT.plan(user, { math: '16', word: '-1', face: '0', rgb: '10' }, snap()); }, /target/);

const zeroSnap = snap();
zeroSnap.wordOwners = zeroSnap.wordOwners.slice();
zeroSnap.faceOwners = zeroSnap.faceOwners.slice();
zeroSnap.wordOwners[0] = user;
zeroSnap.faceOwners[0] = user;
const wordZero = AGENT.plan(user, { math: '16', word: '0', face: '8', rgb: '10' }, zeroSnap);
check(wordZero);
assert.strictEqual(wordZero.ok, true);
assert.strictEqual(wordZero.exists, false);
assert.strictEqual(wordZero.txs.length, 1);
assert.strictEqual(wordZero.txs[0].data, ABI.call(ABI.SEL.add4, [16n, 0n, 8n, 10n]));
assert.strictEqual(wordZero.shares[1].id, '0');
assert.strictEqual(wordZero.shares[1].owned, true);
const faceZeroMint = AGENT.plan(user, { math: '16', word: '7', face: '0', rgb: '10' }, zeroSnap);
check(faceZeroMint);
assert.strictEqual(faceZeroMint.ok, true);
assert.strictEqual(faceZeroMint.exists, false);
assert.strictEqual(faceZeroMint.txs.length, 1);
assert.strictEqual(faceZeroMint.txs[0].data, ABI.call(ABI.SEL.add4, [16n, 7n, 0n, 10n]));
assert.strictEqual(faceZeroMint.shares[2].id, '0');
assert.strictEqual(faceZeroMint.shares[2].owned, true);
assert.throws(function () { AGENT.plan(user, '3', { math: [] }); }, /snapshot/);

const FACE_REASON = 'WORD/FACE owners are not in the snapshot; confirm the signer holds them before sending.';
const unlistParts = snap();
delete unlistParts.wordOwners;
delete unlistParts.faceOwners;
const unknownParts = AGENT.plan(user, { math: '16', word: '7', face: '8', rgb: '10' }, unlistParts);
check(unknownParts);
assert.strictEqual(unknownParts.ok, false);
assert.strictEqual(unknownParts.shares[1].owned, null);
assert.strictEqual(unknownParts.shares[2].owned, null);
assert.strictEqual(unknownParts.txs.length, 1);
assert.strictEqual(unknownParts.txs[0].value, '0x0');
assert.ok(unknownParts.note.indexOf(FACE_REASON) !== -1);

const notWord = AGENT.plan(stranger, { math: '8', word: '7', face: '8', rgb: '9' }, snap());
assert.strictEqual(notWord.ok, false);
assert.strictEqual(notWord.shares[1].owned, false);
assert.strictEqual(notWord.shares[1].holder, user);
assert.ok(notWord.note.indexOf('does not hold WORD #7') !== -1);
assert.strictEqual(notWord.txs.length, 1);

const unlist = snap();
delete unlist.blocked;
delete unlist.blockedDone;
const warned = AGENT.plan(user, '3', unlist);
check(warned);
assert.strictEqual(warned.ok, true);
assert.ok(warned.note.indexOf('no payout blocklist') !== -1);

const blockedHolder = '0xbadbadbadbadbadbadbadbadbadbadbadbadbadb';
const trapped = snap();
trapped.owners = [user, blockedHolder];
trapped.math = [['1', 0], ['4', 1]];
trapped.blocked = [blockedHolder];
trapped.blockedDone = true;
const revert = AGENT.plan(user, '5', trapped);
assert.strictEqual(revert.ok, false);
assert.ok(revert.txs.length > 0);
assert.ok(revert.txs[0].data.startsWith('0x771602f7'));
assert.ok(revert.note.indexOf('Holder ' + blockedHolder + ' cannot take the 2300-gas payout. The mint would revert.') !== -1);

const around = AGENT.plan(user, '3', snap());
check(around);
assert.strictEqual(around.ok, true);
assert.ok(around.shares.every(function (row) { return row.holder !== blockedHolder; }));

const raw = JSON.parse(fs.readFileSync(__dirname + '/index.json', 'utf8'));
const live = AGENT.plan('0x' + '11'.repeat(20), '3', raw);
assert.strictEqual(live.v, 1);
assert.strictEqual(live.kind, 'math');
assert.strictEqual(live.target, '3');
assert.strictEqual(typeof live.block, 'number');
JSON.stringify(live);
if (live.exists) assert.strictEqual(live.txs.length, 0);
else {
  assert.ok(live.txs.length > 0);
  assert.strictEqual(live.txs[0].to, ETH.ADDR.MATH);
  assert.ok(live.txs[0].data.startsWith('0x771602f7'));
  assert.strictEqual(live.txs[0].value, '0x' + PLAN.MSG_MATH.toString(16));
}
const row = raw.rgb[0];
const hit = AGENT.plan(user, { r: row[2], g: row[3], b: row[4] }, raw);
assert.strictEqual(hit.exists, true);
assert.strictEqual(hit.txs.length, 0);
const toonRow = raw.toon[0];
const toonHit = AGENT.plan(user, { math: toonRow[0], word: toonRow[2], face: toonRow[3], rgb: toonRow[4] }, raw);
assert.strictEqual(toonHit.exists, true);
assert.strictEqual(toonHit.txs.length, 0);
const row8421504 = raw.toon.find(function (row) { return row[0] === '8421504'; });
assert.ok(row8421504);
assert.strictEqual(row8421504[3], '0');
const faceZeroExists = AGENT.plan(user, { math: row8421504[0], word: row8421504[2], face: '0', rgb: row8421504[4] }, raw);
assert.strictEqual(faceZeroExists.exists, true);
assert.strictEqual(faceZeroExists.ok, true);
assert.deepStrictEqual(faceZeroExists.txs, []);
assert.strictEqual(faceZeroExists.target, '8421504,8373,0,114');
const liveWallet = '0x7891f796a5d43466fc29f102069092aef497a290';
const liveWordZero = AGENT.plan(liveWallet, { math: '65537', word: '0', face: '3', rgb: '23' }, raw);
assert.strictEqual(liveWordZero.exists, false);
assert.strictEqual(liveWordZero.txs.length, 1);
assert.strictEqual(liveWordZero.txs[0].value, '0x0');
assert.strictEqual(liveWordZero.shares[1].id, '0');
const foreign = AGENT.plan(liveWallet, { math: '65537', word: '1', face: '2', rgb: '23' }, raw);
assert.strictEqual(foreign.ok, false);
assert.strictEqual(foreign.txs.length, 1);
assert.strictEqual(foreign.txs[0].value, '0x0');
assert.strictEqual(foreign.shares[1].owned, false);
assert.strictEqual(foreign.shares[2].owned, false);
assert.notStrictEqual(foreign.shares[1].holder, liveWallet);
assert.notStrictEqual(foreign.shares[2].holder, liveWallet);
assert.ok(foreign.note.indexOf('does not hold WORD #1') !== -1);
assert.ok(foreign.note.indexOf('does not hold FACE #2') !== -1);
assert.strictEqual(raw.blockedDone, true);
assert.strictEqual(raw.blocked.length, 7);
assert.ok(Array.isArray(raw.wordOwners) && raw.wordOwners.length > 2);
assert.ok(Array.isArray(raw.faceOwners) && raw.faceOwners.length > 2);
const liveInv = ETH.unpack(raw);
const usedWord = new Set();
const usedFace = new Set();
const usedRgb = new Set();
const usedMath = new Set();
liveInv.toon.forEach(function (t) {
  usedWord.add(t.word.toString());
  usedFace.add(t.face.toString());
  usedRgb.add(t.rgb.toString());
  usedMath.add(t.id.toString());
});
const bags = new Map();
function bag(owner) {
  const a = String(owner).toLowerCase();
  if (!bags.has(a)) bags.set(a, { math: [], word: [], face: [], rgb: [] });
  return bags.get(a);
}
liveInv.math.forEach(function (t) { bag(t.owner).math.push(t.id.toString()); });
liveInv.wordOwners.forEach(function (owner, i) { bag(owner).word.push(String(i)); });
liveInv.faceOwners.forEach(function (owner, i) { bag(owner).face.push(String(i)); });
liveInv.rgb.forEach(function (t) { bag(t.owner).rgb.push(t.id.toString()); });
let heldBy = null;
bags.forEach(function (parts, addr) {
  if (heldBy) return;
  const math = parts.math.find(function (id) { return !usedMath.has(id); });
  const word = parts.word.find(function (id) { return !usedWord.has(id); });
  const face = parts.face.find(function (id) { return !usedFace.has(id); });
  const rgb = parts.rgb.find(function (id) { return !usedRgb.has(id); });
  if (math && word && face && rgb) heldBy = { addr: addr, math: math, word: word, face: face, rgb: rgb };
});
assert.ok(heldBy);
const held = AGENT.plan(heldBy.addr, { math: heldBy.math, word: heldBy.word, face: heldBy.face, rgb: heldBy.rgb }, raw);
assert.strictEqual(held.ok, true);
assert.strictEqual(held.exists, false);
assert.strictEqual(held.txs.length, 1);
assert.strictEqual(held.txs[0].value, '0x0');
assert.ok(held.shares.every(function (row) { return row.owned === true; }));

const stackSnap = snap({
  math: [['1', 1], ['2', 1], ['4', 1], ['8', 0]],
  rgb: [],
  toon: [],
  words: {},
  faces: {},
  wordOwners: [],
  faceOwners: [],
});
const stacked = AGENT.plan(user, { r: '11', g: '3', b: '8' }, stackSnap);
check(stacked);
assert.strictEqual(stacked.ok, true);
assert.strictEqual(stacked.txs.length, 3);
assert.strictEqual(stacked.txs[0].data, ABI.call(ABI.SEL.add2, [1n, 2n]));
assert.ok(stacked.txs[1].data === ABI.call(ABI.SEL.add2, [8n, 3n]) || stacked.txs[1].data === ABI.call(ABI.SEL.add2, [3n, 8n]));
assert.strictEqual(stacked.txs[2].to, ETH.ADDR.RGB);
assert.strictEqual(stacked.txs[2].data, ABI.call(ABI.SEL.add3, [11n, 3n, 8n]));
assert.strictEqual(stacked.royalty, (2n * PLAN.ROY_WEI).toString());
const mintedInput = stacked.shares.filter(function (row) { return row.id === '3' && row.owned === false; });
assert.ok(mintedInput.length >= 1);
assert.ok(mintedInput.every(function (row) { return row.holder === user && row.wei === '0'; }));
const stackChannels = stacked.shares.slice(-3);
assert.deepStrictEqual(stackChannels.map(function (row) { return row.id; }), ['11', '3', '8']);
assert.strictEqual(stackChannels[0].holder, user);
assert.strictEqual(stackChannels[0].wei, '0');
assert.strictEqual(stackChannels[1].holder, user);
assert.strictEqual(stackChannels[1].wei, '0');
assert.strictEqual(stackChannels[2].owned, true);
assert.strictEqual(stackChannels[2].wei, '0');
const seenMint = new Set();
stacked.txs.slice(0, -1).forEach(function (tx) {
  assert.strictEqual(seenMint.has(tx.data), false);
  seenMint.add(tx.data);
});

const rgbTrap = snap({
  owners: [user, blockedHolder],
  math: [['1', 1]],
  rgb: [],
  toon: [],
  words: {},
  faces: {},
  wordOwners: [],
  faceOwners: [],
  blocked: [blockedHolder],
  blockedDone: true,
});
const rgbRevert = AGENT.plan(user, { r: '3', g: '1', b: '1' }, rgbTrap);
check(rgbRevert);
assert.strictEqual(rgbRevert.ok, false);
assert.ok(rgbRevert.note.indexOf('Holder ' + blockedHolder) !== -1);
assert.strictEqual(rgbRevert.txs[rgbRevert.txs.length - 1].data, ABI.call(ABI.SEL.add3, [3n, 1n, 1n]));
assert.ok(rgbRevert.txs.length > 1);

const example = {
  math: AGENT.plan(user, '3', snap()),
  rgb: AGENT.plan(user, { r: '8', g: '16', b: '32' }, snap()),
  toon: AGENT.plan(user, { math: '16', word: '7', face: '8', rgb: '10' }, snap()),
};
assert.deepStrictEqual(JSON.parse(fs.readFileSync(__dirname + '/agents/example.json', 'utf8')), example);

console.log('plan.test.js ok');
