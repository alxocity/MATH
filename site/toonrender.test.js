const assert = require('assert');
const fs = require('fs');
global.ABI = require('./abi');
const store = {};
global.localStorage = {
  getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  setItem: function (k, v) { store[k] = String(v); },
};
eval(fs.readFileSync(__dirname + '/eth.js', 'utf8'));
const TOONR = require('./toonrender');

assert.strictEqual(TOONR.xml('a&b<c>d'), 'a&amp;b&lt;c&gt;d');
assert.strictEqual(TOONR.toneHex(0xd8b49fn), 'd8b49f');
assert.strictEqual(TOONR.toneHex(0xd8b4a0n), 'ffffff');
assert.strictEqual(TOONR.toneHex(0n), '000000');
assert.strictEqual(TOONR.textHex(0n), '0000-5');
assert.strictEqual(TOONR.textHex(5n), '000000');
assert.strictEqual(TOONR.lightHex(0n), 'e7e2d4');
assert.strictEqual(TOONR.lightHex(5n), '000000');
assert.ok(TOONR.svg(1n, 0n, 0n, 'x', 0n, 0n).indexOf('#0000-5') !== -1);
assert.ok(TOONR.svg(1n, 0n, 0n, 'a&b', 0xffffffn, 5n).indexOf('a&amp;b') !== -1);
assert.ok(TOONR.svg(1n, 0n, 0n, 'x', 1n, 5n).indexOf('viewBox="0 0 350 350"') !== -1);

function diffAt(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return n;
}

async function chainSvg(id) {
  const raw = await ETH.ethCall(ETH.ADDR.TOON_RENDER, ABI.call(ABI.SEL.tokenSVG, [id]));
  return ABI.decodeString(raw);
}

async function parts(id) {
  const got = ABI.wordsOf(await ETH.ethCall(ETH.ADDR.TOON, ABI.call(ABI.SEL.get, [id])));
  const face = got[1];
  const rgb = got[2];
  const planes = ABI.wordsOf(await ETH.ethCall(ETH.ADDR.RGB, ABI.call(ABI.SEL.get, [rgb])));
  const text = await ETH.readString(ETH.ADDR.FACE, ABI.SEL.getFace, face);
  const bg = ABI.decodeUint(await ETH.ethCall(ETH.ADDR.FACE, ABI.call(ABI.SEL.getBackgroundColor, [face])));
  const fg = ABI.decodeUint(await ETH.ethCall(ETH.ADDR.FACE, ABI.call(ABI.SEL.getTextColor, [face])));
  return { r: planes[0], g: planes[1], b: planes[2], face: text, bg: bg, fg: fg };
}

(async function () {
  const ids = [1973n, 505n, 1993n];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const p = await parts(id);
    const mine = TOONR.svg(p.r, p.g, p.b, p.face, p.bg, p.fg);
    const chain = await chainSvg(id);
    if (mine !== chain) {
      const at = diffAt(mine, chain);
      throw new Error('toon ' + id + ' at ' + at + ' ' +
        JSON.stringify(mine.slice(Math.max(0, at - 24), at + 24)) + ' vs ' +
        JSON.stringify(chain.slice(Math.max(0, at - 24), at + 24)) +
        ' len ' + mine.length + '/' + chain.length);
    }
  }
  console.log('toonrender.test.js ok');
})().catch(function (e) {
  console.error(e);
  process.exit(1);
});
