(function (g, f) {
  const api = f();
  if (typeof module === 'object' && module.exports) module.exports = api;
  g.ABI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SEL = {
    totalSupply: '18160ddd',
    tokenByIndex: '4f6ccce7',
    ownerOf: '6352211e',
    balanceOf: '70a08231',
    tokenOfOwnerByIndex: '2f745c59',
    get: '9507d39a',
    getWord: '43503fac',
    getFace: '6275e9f2',
    getBackgroundColor: '4671059f',
    getTextColor: '81fcb66a',
    tokenSVG: '9bac5f7a',
    add2: '771602f7',
    add3: '505fb46c',
    add4: 'e022d77c',
  };

  function word(n) {
    const x = BigInt(n);
    if (x < 0n) throw new Error('neg');
    return x.toString(16).padStart(64, '0');
  }

  function addr(a) {
    const h = String(a).toLowerCase().replace(/^0x/, '');
    if (!/^[0-9a-f]{40}$/.test(h)) throw new Error('addr');
    return h.padStart(64, '0');
  }

  function call(sel, args) {
    return '0x' + sel + (args || []).map(word).join('');
  }

  // Multicall3.aggregate3((address,bool,bytes)[])
  function encodeAggregate(calls) {
    const blobs = calls.map(function (c) {
      const data = String(c.data).replace(/^0x/, '').toLowerCase();
      if (data.length % 2) throw new Error('odd');
      const len = data.length / 2;
      const pad = data.padEnd(Math.ceil(data.length / 64) * 64, '0');
      return addr(c.to) + word(c.allow ? 1 : 0) + word(0x60) + word(len) + pad;
    });
    let cursor = calls.length * 32;
    const offsets = blobs.map(function (b) {
      const o = word(cursor);
      cursor += b.length / 2;
      return o;
    });
    return '0x82ad56cb' + word(0x20) + word(calls.length) + offsets.join('') + blobs.join('');
  }

  function wordsOf(hex) {
    const h = String(hex).replace(/^0x/, '');
    const out = [];
    for (let i = 0; i + 64 <= h.length; i += 64) out.push(BigInt('0x' + h.slice(i, i + 64)));
    return out;
  }

  function decodeAggregate(hex) {
    const w = wordsOf(hex);
    const arrayPos = Number(w[0] / 32n);
    const n = Number(w[arrayPos]);
    const head = arrayPos + 1;
    const out = [];
    for (let i = 0; i < n; i++) {
      const el = head + Number(w[head + i] / 32n);
      const success = w[el] === 1n;
      const bytesPos = el + Number(w[el + 1] / 32n);
      const len = Number(w[bytesPos]);
      const h = String(hex).replace(/^0x/, '');
      const data = h.slice((bytesPos + 1) * 64, (bytesPos + 1) * 64 + len * 2);
      out.push({ success: success, data: '0x' + data });
    }
    return out;
  }

  function decodeUint(data) {
    const h = String(data).replace(/^0x/, '');
    if (!h) return 0n;
    return BigInt('0x' + h.slice(0, 64));
  }

  function decodeAddr(data) {
    const h = String(data).replace(/^0x/, '').padStart(64, '0');
    return '0x' + h.slice(-40).toLowerCase();
  }

  function decodeString(data) {
    const h = String(data).replace(/^0x/, '');
    if (!h) return '';
    if (h.length < 64 || h.length % 2) throw new Error('string');
    const offset = Number(BigInt('0x' + h.slice(0, 64)));
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('string');
    const pos = offset * 2;
    if (pos + 64 > h.length) throw new Error('string');
    const len = Number(BigInt('0x' + h.slice(pos, pos + 64)));
    if (!Number.isSafeInteger(len) || len < 0) throw new Error('string');
    const end = pos + 64 + len * 2;
    if (end > h.length) throw new Error('string');
    const bytes = h.slice(pos + 64, end);
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = parseInt(bytes.slice(i * 2, i * 2 + 2), 16);
    return new TextDecoder().decode(arr);
  }

  return {
    SEL: SEL,
    word: word,
    addr: addr,
    call: call,
    encodeAggregate: encodeAggregate,
    decodeAggregate: decodeAggregate,
    decodeUint: decodeUint,
    wordsOf: wordsOf,
    decodeAddr: decodeAddr,
    decodeString: decodeString,
  };
});
