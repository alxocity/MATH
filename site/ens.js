(function (g, f) {
  const api = f();
  if (typeof module === 'object' && module.exports) module.exports = api;
  g.ENS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const UR = '0xeeeeeeee14d718c2b47d9923deab1335e144eeee';
  const COIN = 60n;
  const KEY = 'math.ens.v1';
  const RC = [
    0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
    0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
    0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
    0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
    0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
    0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
  ];
  const RHO = [
    [0, 36, 3, 41, 18],
    [1, 44, 10, 45, 2],
    [62, 6, 43, 15, 61],
    [28, 55, 25, 21, 56],
    [27, 20, 39, 8, 14],
  ];
  const MASK = (1n << 64n) - 1n;

  function rot(x, n) {
    const s = BigInt(n);
    if (s === 0n) return x;
    return ((x << s) | (x >> (64n - s))) & MASK;
  }

  function permute(a) {
    for (let round = 0; round < 24; round++) {
      const c = [0n, 0n, 0n, 0n, 0n];
      for (let x = 0; x < 5; x++) c[x] = a[x] ^ a[x + 5] ^ a[x + 10] ^ a[x + 15] ^ a[x + 20];
      const d = [0n, 0n, 0n, 0n, 0n];
      for (let x = 0; x < 5; x++) d[x] = c[(x + 4) % 5] ^ rot(c[(x + 1) % 5], 1);
      for (let i = 0; i < 25; i++) a[i] = (a[i] ^ d[i % 5]) & MASK;
      const b = new Array(25);
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          b[y + 5 * ((2 * x + 3 * y) % 5)] = rot(a[x + 5 * y], RHO[x][y]);
        }
      }
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          const i = x + 5 * y;
          a[i] = (b[i] ^ ((~b[((x + 1) % 5) + 5 * y]) & b[((x + 2) % 5) + 5 * y])) & MASK;
        }
      }
      a[0] = (a[0] ^ RC[round]) & MASK;
    }
  }

  function keccak(bytes) {
    const a = new Array(25).fill(0n);
    const rate = 136;
    const msg = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const blocks = Math.floor(msg.length / rate);
    for (let i = 0; i < blocks; i++) xorIn(a, msg, i * rate, rate);
    const tail = new Uint8Array(rate);
    const rest = msg.length - blocks * rate;
    tail.set(msg.subarray(blocks * rate));
    tail[rest] ^= 0x01;
    tail[rate - 1] ^= 0x80;
    xorIn(a, tail, 0, rate);
    let hex = '';
    for (let i = 0; i < 4; i++) {
      let v = a[i];
      for (let b = 0; b < 8; b++) {
        hex += Number((v >> BigInt(8 * b)) & 0xffn).toString(16).padStart(2, '0');
      }
    }
    return hex;
  }

  function xorIn(a, bytes, off, n) {
    for (let i = 0; i < n; i++) {
      const lane = Math.floor(i / 8);
      const shift = BigInt((i % 8) * 8);
      a[lane] = (a[lane] ^ (BigInt(bytes[off + i]) << shift)) & MASK;
    }
    permute(a);
  }

  function keccakText(s) {
    return keccak(new TextEncoder().encode(s));
  }

  function namehash(name) {
    let node = '00'.repeat(32);
    if (!name) return node;
    const labels = String(name).split('.');
    for (let i = labels.length - 1; i >= 0; i--) {
      node = keccak(hexBytes(node + keccakText(labels[i])));
    }
    return node;
  }

  function hexBytes(hex) {
    const h = hex.replace(/^0x/, '');
    const out = new Uint8Array(h.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
    return out;
  }

  function dnsEncode(name) {
    let hex = '';
    String(name).split('.').forEach(function (label) {
      const bytes = new TextEncoder().encode(label);
      if (!bytes.length || bytes.length > 63) throw new Error('label');
      hex += bytes.length.toString(16).padStart(2, '0');
      for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
    });
    return hex + '00';
  }

  function word(n) {
    return BigInt(n).toString(16).padStart(64, '0');
  }

  function pad(hex) {
    return hex.padEnd(Math.ceil(hex.length / 64) * 64, '0');
  }

  function normAddr(a) {
    const h = String(a || '').toLowerCase();
    return /^0x[0-9a-f]{40}$/.test(h) ? h : '';
  }

  function isName(q) {
    return /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(String(q || '').trim().toLowerCase());
  }

  function reverseData(addr) {
    const hex = normAddr(addr).slice(2);
    return '0x5d78a217' + word(0x40) + word(COIN) + word(20) + hex.padEnd(64, '0');
  }

  function resolveData(name) {
    const dns = dnsEncode(name);
    const node = namehash(name);
    const payload = '3b3b57de' + node;
    const nameWords = Math.ceil(dns.length / 2 / 32);
    const off2 = 0x40 + 32 + nameWords * 32;
    return '0x9061b923' + word(0x40) + word(off2) + word(dns.length / 2) + pad(dns) + word(payload.length / 2) + pad(payload);
  }

  function mathFlags(used, inToon) {
    const set = used || new Set();
    return {
      free: ['r', 'g', 'b'].filter(function (c) { return !set.has(c); }),
      toon: !inToon,
    };
  }

  function ownerHit(owner, q, name, resolved) {
    const query = String(q || '').trim().toLowerCase();
    if (!query) return true;
    const addr = normAddr(owner);
    if (addr && addr.includes(query)) return true;
    if (name && String(name).toLowerCase().includes(query)) return true;
    if (resolved && addr && addr === normAddr(resolved)) return true;
    return false;
  }

  const names = new Map();
  const namedAt = new Map();
  const forward = new Map();
  const forwardAt = new Map();
  const wait = new Set();
  let flight = null;
  const TTL = 7 * 24 * 60 * 60 * 1000;
  const MISS = 24 * 60 * 60 * 1000;

  function showName(name) {
    const n = String(name || '').trim().toLowerCase();
    if (!n || n.length > 64 || !isName(n)) return '';
    return n;
  }

  // Hardcoded. These names resolve on mainnet; the site does not look them up.
  const CONTRACTS = [
    ['math.alxocity.eth', 'MATH', '0x6B4fccdd888Bb6fD3934A9e49eF64dfd2c0D8e6D'],
    ['rgb.alxocity.eth', 'RGB', '0x9355Fb9693ffF9bB6f06721C82fe0B5F49E6c956'],
    ['toon.alxocity.eth', 'TOON', '0x026A7D72a448D0E44d441e55F746BF56B843aEDB'],
    ['mathrender.alxocity.eth', 'MATH_RENDER', '0xb3cA13A2722CAB48c8d9068bD67656efe2d5e376'],
    ['rgbrender.alxocity.eth', 'RGB_RENDER', '0x62FFe75cd9824A2e8855CbC055256De229B5b936'],
    ['toonrender.alxocity.eth', 'TOON_RENDER', '0x1E1a576e4186551e4DEdE58Ccc2DCC34697159Cb'],
  ];

  function contractNames(addr) {
    const a = addr || {};
    return CONTRACTS.map(function (row) { return [row[0], a[row[1]]]; });
  }

  function contractLabel(addr) {
    const n = normAddr(addr);
    if (!n) return '';
    for (let i = 0; i < CONTRACTS.length; i++) {
      if (normAddr(CONTRACTS[i][2]) === n) return CONTRACTS[i][0];
    }
    return '';
  }

  function matchedName(name, expected, resolved) {
    const n = showName(name);
    const want = normAddr(expected);
    const got = normAddr(resolved);
    if (!n || !want || got !== want) return '';
    return n;
  }

  function fresh(at, now) {
    return typeof at === 'number' && now - at >= 0 && now - at < TTL;
  }

  // A hit lasts a week. A miss lasts a day so an unregistered name is not looked up every visit.
  function forwardFresh(addr, at, now) {
    const t = typeof now === 'number' ? now : Date.now();
    if (typeof at !== 'number' || t - at < 0) return false;
    return t - at < (normAddr(addr) ? TTL : MISS);
  }

  function readStore() {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (!raw) return;
      const now = Date.now();
      Object.keys(raw.names || {}).forEach(function (a) {
        const addr = normAddr(a);
        const rec = raw.names[a];
        const text = typeof rec === 'string' ? rec : rec && rec.n;
        const name = showName(text);
        if (!addr || !name || !fresh(rec && rec.at, now)) return;
        names.set(addr, name);
        namedAt.set(addr, rec.at);
      });
      Object.keys(raw.forward || {}).forEach(function (n) {
        const rec = raw.forward[n];
        const rawAddr = typeof rec === 'string' ? rec : rec && rec.a;
        const addr = normAddr(rawAddr);
        const name = showName(n);
        const at = rec && typeof rec.at === 'number' ? rec.at : 0;
        if (!name || !forwardFresh(addr || rawAddr, at, now)) return;
        forward.set(name, addr);
        forwardAt.set(name, at);
      });
    } catch (e) { /* ignore */ }
  }

  function writeStore() {
    try {
      if (typeof localStorage === 'undefined') return;
      const pack = { names: {}, forward: {} };
      names.forEach(function (n, a) {
        if (n) pack.names[a] = { n: n, at: namedAt.get(a) || Date.now() };
      });
      forward.forEach(function (a, n) {
        pack.forward[n] = { a: a || '', at: forwardAt.get(n) || Date.now() };
      });
      localStorage.setItem(KEY, JSON.stringify(pack));
    } catch (e) { /* ignore */ }
  }

  readStore();

  function cached(addr) {
    const a = normAddr(addr);
    if (!a || !names.has(a)) return '';
    return names.get(a) || '';
  }

  function known(addr) {
    const a = normAddr(addr);
    return !!a && names.has(a);
  }

  function forwardCached(q) {
    const n = String(q || '').trim().toLowerCase();
    return forward.has(n) ? forward.get(n) : '';
  }

  function hasForward(q) {
    return forward.has(String(q || '').trim().toLowerCase());
  }

  function want(addr) {
    const a = normAddr(addr);
    if (!a || names.has(a)) return;
    wait.add(a);
  }

  function label(addr) {
    return cached(addr) || (normAddr(addr) ? normAddr(addr).slice(0, 6) + '…' + normAddr(addr).slice(-4) : '');
  }

  async function callMany(datas) {
    const ETH = globalThis.ETH;
    const ABI = globalThis.ABI;
    const calls = datas.map(function (data) { return { to: UR, data: data, allow: true }; });
    const raw = await ETH.ethCall(ETH.ADDR.MULTI, ABI.encodeAggregate(calls));
    return ABI.decodeAggregate(raw);
  }

  function decodeName(data) {
    try { return globalThis.ABI.decodeString(data); } catch (e) { return ''; }
  }

  function decodeAddr(data) {
    const h = String(data || '').replace(/^0x/, '');
    if (h.length < 128) return '';
    const off = Number(BigInt('0x' + h.slice(0, 64)));
    const pos = off * 2;
    if (!Number.isFinite(off) || pos + 128 > h.length) return '';
    const len = Number(BigInt('0x' + h.slice(pos, pos + 64)));
    const body = h.slice(pos + 64, pos + 64 + len * 2);
    if (body.length < 40) return '';
    return normAddr('0x' + body.slice(-40));
  }

  async function pull(list) {
    let changed = false;
    let rows;
    try { rows = await callMany(list.map(reverseData)); } catch (e) { return false; }
    const found = [];
    rows.forEach(function (row, i) {
      const addr = list[i];
      if (!row || !row.success) {
        names.set(addr, '');
        return;
      }
      const name = showName(decodeName(row.data));
      if (!name) {
        names.set(addr, '');
        return;
      }
      let data;
      try { data = resolveData(name); } catch (e) {
        names.set(addr, '');
        return;
      }
      found.push({ addr: addr, name: name, data: data });
    });
    if (found.length) {
      let checks;
      try { checks = await callMany(found.map(function (f) { return f.data; })); } catch (e) { checks = []; }
      found.forEach(function (f, i) {
        const row = checks[i];
        const got = row && row.success ? decodeAddr(row.data) : '';
        if (got && got === f.addr) {
          const at = Date.now();
          names.set(f.addr, f.name);
          namedAt.set(f.addr, at);
          forward.set(f.name, f.addr);
          forwardAt.set(f.name, at);
          changed = true;
        } else {
          names.set(f.addr, '');
        }
      });
    }
    writeStore();
    return changed;
  }

  function flush(done) {
    if (!wait.size) return Promise.resolve(false);
    if (flight) return flight.then(function () { return flush(done); });
    const list = Array.from(wait).slice(0, 20);
    list.forEach(function (a) { wait.delete(a); });
    flight = pull(list).then(function (changed) {
      flight = null;
      if (done && changed) done();
      if (wait.size) return flush(done);
      return changed;
    }, function () {
      flight = null;
      return false;
    });
    return flight;
  }

  function resolveForwards(list) {
    const out = {};
    const pending = [];
    (list || []).forEach(function (q) {
      const name = showName(q);
      if (!name) return;
      if (forward.has(name)) {
        out[name] = forward.get(name) || '';
        return;
      }
      let data;
      try { data = resolveData(name); } catch (e) {
        out[name] = '';
        return;
      }
      pending.push({ name: name, data: data });
    });
    if (!pending.length) return Promise.resolve(out);
    return callMany(pending.map(function (p) { return p.data; })).then(function (rows) {
      const at = Date.now();
      pending.forEach(function (p, i) {
        const row = rows && rows[i];
        const got = row && row.success ? decodeAddr(row.data) : '';
        forward.set(p.name, got || '');
        forwardAt.set(p.name, at);
        out[p.name] = got || '';
      });
      writeStore();
      return out;
    }, function () { return out; });
  }

  function resolveForward(q) {
    const name = String(q || '').trim().toLowerCase();
    if (!isName(name)) return Promise.resolve('');
    if (forward.has(name)) return Promise.resolve(forward.get(name));
    let data;
    try { data = resolveData(name); } catch (e) { return Promise.resolve(''); }
    return callMany([data]).then(function (rows) {
      const got = rows[0] && rows[0].success ? decodeAddr(rows[0].data) : '';
      forward.set(name, got || '');
      if (got) {
        forwardAt.set(name, Date.now());
        writeStore();
      }
      return got || '';
    }, function () { return ''; });
  }

  return {
    UR: UR,
    keccakText: keccakText,
    namehash: namehash,
    dnsEncode: dnsEncode,
    reverseData: reverseData,
    resolveData: resolveData,
    isName: isName,
    mathFlags: mathFlags,
    ownerHit: ownerHit,
    normAddr: normAddr,
    cached: cached,
    known: known,
    forwardCached: forwardCached,
    hasForward: hasForward,
    want: want,
    contractNames: contractNames,
    contractLabel: contractLabel,
    matchedName: matchedName,
    forwardFresh: forwardFresh,
    resolveForwards: resolveForwards,
    label: label,
    flush: flush,
    resolveForward: resolveForward,
    decodeAddr: decodeAddr,
  };
});
