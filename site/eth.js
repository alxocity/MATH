(function () {
  const ADDR = {
    MATH: '0x6B4fccdd888Bb6fD3934A9e49eF64dfd2c0D8e6D',
    RGB: '0x9355Fb9693ffF9bB6f06721C82fe0B5F49E6c956',
    TOON: '0x026A7D72a448D0E44d441e55F746BF56B843aEDB',
    WORD: '0xAc1AEe5027FCC98d40a26588aC0841a44f53A8Fe',
    FACE: '0x91047Abf3cAb8da5A9515c8750Ab33B4f1560a7A',
    MATH_RENDER: '0xb3cA13A2722CAB48c8d9068bD67656efe2d5e376',
    RGB_RENDER: '0x62FFe75cd9824A2e8855CbC055256De229B5b936',
    TOON_RENDER: '0x1E1a576e4186551e4DEdE58Ccc2DCC34697159Cb',
    MULTI: '0xcA11bde05977b3631167028862bE2a173976CA11',
  };
  const RPCS = [
    'https://ethereum.publicnode.com',
    'https://eth.drpc.org',
    'https://mainnet.gateway.tenderly.co',
  ];
  function extraRpc(raw) {
    const extra = String(raw == null ? '' : raw).trim();
    if (!extra) return '';
    if (!/^https:\/\//i.test(extra)) throw new Error('ETH_RPC_URL');
    return extra;
  }
  if (typeof process !== 'undefined' && process.env && process.env.ETH_RPC_URL) {
    const extra = extraRpc(process.env.ETH_RPC_URL);
    if (extra) RPCS.unshift(extra);
  }
  const CACHE = 'math.site.v1';
  const ABI = globalThis.ABI;

  // Reverts, including out-of-gas, are answers. Fail over only when the node itself failed.
  function rpcRetryable(status, error) {
    if (status === 429 || status >= 500) return true;
    if (!error) return false;
    const msg = String(error.message || '');
    if (error.code === 3 || /execution reverted/i.test(msg)) return false;
    if (error.code === -32603 || error.code === -32005) return true;
    return /rate|limit|timeout|busy|temporarily|internal error|unauthorized|unavailable|overloaded/i.test(msg);
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  async function rpc(method, params) {
    let last;
    const tries = RPCS.length * 2;
    for (let attempt = 0; attempt < tries; attempt++) {
      const url = RPCS[attempt % RPCS.length];
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params }),
          signal: AbortSignal.timeout(8000),
        });
        if (res.status === 429 || res.status >= 500) throw new Error('http ' + res.status);
        const j = await res.json();
        if (rpcRetryable(res.status, j.error)) throw new Error((j.error && j.error.message) || 'rpc');
        return j;
      } catch (e) {
        last = e;
        if (attempt % RPCS.length === RPCS.length - 1) await sleep(280 * (1 + Math.floor(attempt / RPCS.length)));
      }
    }
    throw last;
  }

  async function aggregate(calls) {
    try {
      const data = ABI.encodeAggregate(calls.map(function (c) {
        return { to: c.to, data: c.data, allow: true };
      }));
      const j = await rpc('eth_call', [{ to: ADDR.MULTI, data: data }, 'latest']);
      if (j.error) throw new Error(j.error.message || 'multicall');
      const rows = ABI.decodeAggregate(j.result);
      if (rows.length !== calls.length) throw new Error('len');
      return rows;
    } catch (e) {
      if (calls.length <= 1) throw e;
      const mid = calls.length >> 1;
      const left = await aggregate(calls.slice(0, mid));
      const right = await aggregate(calls.slice(mid));
      return left.concat(right);
    }
  }

  async function multicall(calls, progress, chunk) {
    const size = chunk || 100;
    const out = new Array(calls.length);
    const jobs = [];
    for (let i = 0; i < calls.length; i += size) jobs.push([i, calls.slice(i, i + size)]);
    let cursor = 0;
    let done = 0;
    async function worker() {
      while (cursor < jobs.length) {
        const job = jobs[cursor++];
        const rows = await aggregate(job[1]);
        for (let k = 0; k < rows.length; k++) out[job[0] + k] = rows[k];
        done += job[1].length;
        if (progress) progress(done, calls.length);
      }
    }
    const n = Math.min(4, jobs.length);
    const workers = [];
    for (let i = 0; i < n; i++) workers.push(worker());
    await Promise.all(workers);
    return out;
  }

  async function mapPool(items, n, fn) {
    const out = new Array(items.length);
    let i = 0;
    async function worker() {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k], k);
      }
    }
    const workers = [];
    const c = Math.min(n, items.length);
    for (let k = 0; k < c; k++) workers.push(worker());
    await Promise.all(workers);
    return out;
  }

  function reason(err) {
    if (!err) return '';
    const data = typeof err.data === 'string' ? err.data : (err.data && err.data.data) || '';
    if (typeof data === 'string' && data.indexOf('08c379a0') !== -1) {
      const i = data.indexOf('08c379a0');
      try {
        const text = ABI.decodeString('0x' + data.slice(i + 8));
        if (text) return text;
      } catch (e) { /* fall through */ }
    }
    return String(err.message || 'reverted').replace(/^execution reverted:\s*/i, '');
  }

  async function ethCall(to, data, from) {
    const tx = { to: to, data: data };
    if (from) tx.from = from;
    const j = await rpc('eth_call', [tx, 'latest']);
    if (j.error) throw new Error(reason(j.error));
    return j.result;
  }

  async function readString(to, sel, id) {
    const raw = await ethCall(to, ABI.call(sel, [BigInt(id)]));
    return ABI.decodeString(raw);
  }

  async function ownerOf(contract, id) {
    const j = await rpc('eth_call', [{ to: contract, data: ABI.call(ABI.SEL.ownerOf, [BigInt(id)]) }, 'latest']);
    if (j.error) return null;
    return ABI.decodeAddr(j.result);
  }

  async function gasPrice() {
    const j = await rpc('eth_gasPrice', []);
    if (j.error) throw new Error(j.error.message || 'gas');
    return BigInt(j.result);
  }

  async function loadIds(address, n, progress, label, start) {
    const from = start || 0;
    const calls = [];
    for (let i = from; i < n; i++) calls.push({ to: address, data: ABI.call(ABI.SEL.tokenByIndex, [i]) });
    if (!calls.length) return [];
    const rows = await multicall(calls, function (d, t) { if (progress) progress(label + ' ' + (from + d) + '/' + n); });
    return rows.map(function (row, i) {
      if (!row || !row.success) throw new Error(label + ' index ' + (from + i));
      return ABI.decodeUint(row.data);
    });
  }

  async function loadOwners(address, ids, progress, label) {
    const calls = ids.map(function (id) {
      return { to: address, data: ABI.call(ABI.SEL.ownerOf, [id]) };
    });
    const rows = await multicall(calls, function (d, t) { if (progress) progress(label + ' owner ' + d + '/' + t); });
    return rows.map(function (row, i) {
      if (!row || !row.success) throw new Error(label + ' owner ' + ids[i]);
      return ABI.decodeAddr(row.data);
    });
  }

  async function loadGets(address, ids, progress, label) {
    const calls = ids.map(function (id) {
      return { to: address, data: ABI.call(ABI.SEL.get, [id]) };
    });
    const rows = await multicall(calls, function (d, t) { if (progress) progress(label + ' get ' + d + '/' + t); });
    return rows.map(function (row, i) {
      if (!row || !row.success) throw new Error(label + ' get ' + ids[i]);
      const w = ABI.wordsOf(row.data);
      return w;
    });
  }

  async function loadTexts(address, sel, ids, progress, label) {
    const uniq = [];
    const seen = new Set();
    ids.forEach(function (id) {
      const x = BigInt(id);
      const k = x.toString();
      if (seen.has(k)) return;
      seen.add(k);
      uniq.push(x);
    });
    const map = new Map();
    if (!uniq.length) return map;
    const calls = uniq.map(function (id) {
      return { to: address, data: ABI.call(sel, [id]) };
    });
    const rows = await multicall(calls, function (d, t) {
      if (progress) progress((label || 'text') + ' ' + d + '/' + t);
    });
    rows.forEach(function (row, i) {
      if (!row || !row.success) throw new Error((label || 'text') + ' ' + uniq[i]);
      map.set(uniq[i], ABI.decodeString(row.data));
    });
    return map;
  }

  async function loadInventory(progress) {
    const block = await rpc('eth_blockNumber', []);
    if (block.error) throw new Error(block.error.message || 'block');
    const supplies = await multicall([
      { to: ADDR.MATH, data: '0x' + ABI.SEL.totalSupply },
      { to: ADDR.RGB, data: '0x' + ABI.SEL.totalSupply },
      { to: ADDR.TOON, data: '0x' + ABI.SEL.totalSupply },
    ]);
    const mathN = Number(ABI.decodeUint(supplies[0].data));
    const rgbN = Number(ABI.decodeUint(supplies[1].data));
    const toonN = Number(ABI.decodeUint(supplies[2].data));
    const mathIds = await loadIds(ADDR.MATH, mathN, progress, 'MATH');
    const mathOwners = await loadOwners(ADDR.MATH, mathIds, progress, 'MATH');
    const math = mathIds.map(function (id, i) { return { id: id, owner: mathOwners[i] }; });
    const rgbIds = await loadIds(ADDR.RGB, rgbN, progress, 'RGB');
    const rgbOwners = await loadOwners(ADDR.RGB, rgbIds, progress, 'RGB');
    const rgbGets = await loadGets(ADDR.RGB, rgbIds, progress, 'RGB');
    const rgb = rgbIds.map(function (id, i) {
      return { id: id, owner: rgbOwners[i], r: rgbGets[i][0], g: rgbGets[i][1], b: rgbGets[i][2] };
    });
    const toonIds = await loadIds(ADDR.TOON, toonN, progress, 'TOON');
    const toonOwners = await loadOwners(ADDR.TOON, toonIds, progress, 'TOON');
    const toonGets = await loadGets(ADDR.TOON, toonIds, progress, 'TOON');
    const toon = toonIds.map(function (id, i) {
      return { id: id, owner: toonOwners[i], word: toonGets[i][0], face: toonGets[i][1], rgb: toonGets[i][2] };
    });
    const words = await loadTexts(ADDR.WORD, ABI.SEL.getWord, toon.map(function (t) { return t.word; }), progress, 'WORD');
    const faces = await loadTexts(ADDR.FACE, ABI.SEL.getFace, toon.map(function (t) { return t.face; }), progress, 'FACE');
    return { block: blockNum(block.result), math: math, rgb: rgb, toon: toon, words: words, faces: faces };
  }

  async function appendIds(address, n, have, progress, label, fill) {
    if (n < have) return null;
    if (n === have) return [];
    const ids = await loadIds(address, n, progress, label, have);
    const owners = await loadOwners(address, ids, progress, label);
    const extra = fill ? await fill(ids) : null;
    return ids.map(function (id, i) {
      const row = { id: id, owner: owners[i] };
      if (extra) extra(row, i);
      return row;
    });
  }

  // Newer enumeration indexes only. A shorter supply means the snapshot is stale, so reload.
  async function loadDelta(base, progress, trusted) {
    const block = await rpc('eth_blockNumber', []);
    if (block.error) throw new Error(block.error.message || 'block');
    const supplies = await multicall([
      { to: ADDR.MATH, data: '0x' + ABI.SEL.totalSupply },
      { to: ADDR.RGB, data: '0x' + ABI.SEL.totalSupply },
      { to: ADDR.TOON, data: '0x' + ABI.SEL.totalSupply },
    ]);
    if (!supplies[0] || !supplies[0].success || !supplies[1] || !supplies[1].success || !supplies[2] || !supplies[2].success) {
      throw new Error('supply');
    }
    const mathN = Number(ABI.decodeUint(supplies[0].data));
    const rgbN = Number(ABI.decodeUint(supplies[1].data));
    const toonN = Number(ABI.decodeUint(supplies[2].data));
    if (mathN < base.math.length || rgbN < base.rgb.length || toonN < base.toon.length) {
      return loadInventory(progress);
    }
    const mathMore = await appendIds(ADDR.MATH, mathN, base.math.length, progress, 'MATH');
    const rgbMore = await appendIds(ADDR.RGB, rgbN, base.rgb.length, progress, 'RGB', async function (ids) {
      const gets = await loadGets(ADDR.RGB, ids, progress, 'RGB');
      return function (row, i) {
        row.r = gets[i][0];
        row.g = gets[i][1];
        row.b = gets[i][2];
      };
    });
    const toonMore = await appendIds(ADDR.TOON, toonN, base.toon.length, progress, 'TOON', async function (ids) {
      const gets = await loadGets(ADDR.TOON, ids, progress, 'TOON');
      return function (row, i) {
        row.word = gets[i][0];
        row.face = gets[i][1];
        row.rgb = gets[i][2];
      };
    });
    const mathRows = base.math.concat(mathMore);
    const rgbRows = base.rgb.concat(rgbMore);
    const toonRows = base.toon.concat(toonMore);
    const mathOwners = await loadOwners(ADDR.MATH, mathRows.map(function (t) { return t.id; }), progress, 'MATH');
    const rgbOwners = await loadOwners(ADDR.RGB, rgbRows.map(function (t) { return t.id; }), progress, 'RGB');
    const toonOwners = await loadOwners(ADDR.TOON, toonRows.map(function (t) { return t.id; }), progress, 'TOON');
    const toon = toonRows.map(function (t, i) { return { id: t.id, owner: toonOwners[i], word: t.word, face: t.face, rgb: t.rgb }; });
    const words = await fillTexts(base.words, toon.map(function (t) { return t.word; }), ADDR.WORD, ABI.SEL.getWord, progress, 'WORD', trusted && trusted.words);
    const faces = await fillTexts(base.faces, toon.map(function (t) { return t.face; }), ADDR.FACE, ABI.SEL.getFace, progress, 'FACE', trusted && trusted.faces);
    return {
      block: blockNum(block.result),
      math: mathRows.map(function (t, i) { return { id: t.id, owner: mathOwners[i] }; }),
      rgb: rgbRows.map(function (t, i) { return { id: t.id, owner: rgbOwners[i], r: t.r, g: t.g, b: t.b }; }),
      toon: toon,
      words: words,
      faces: faces,
    };
  }

  function overlayTexts(have, trusted) {
    const out = new Map();
    if (have) have.forEach(function (text, id) { out.set(BigInt(id), text); });
    if (trusted) trusted.forEach(function (text, id) { out.set(BigInt(id), text); });
    return out;
  }

  async function fillTexts(have, ids, address, sel, progress, label, trusted) {
    const prev = overlayTexts(have, trusted);
    const missing = [];
    const seen = new Set();
    ids.forEach(function (id) {
      const x = BigInt(id);
      if (prev.has(x) || seen.has(x.toString())) return;
      seen.add(x.toString());
      missing.push(x);
    });
    const more = await loadTexts(address, sel, missing, progress, label);
    more.forEach(function (text, id) {
      if (!trusted || !trusted.has(id)) prev.set(id, text);
    });
    if (trusted) trusted.forEach(function (text, id) { prev.set(BigInt(id), text); });
    return prev;
  }

  function blockNum(block) {
    let n;
    if (typeof block === 'number') n = block;
    else if (typeof block === 'bigint') n = Number(block);
    else if (typeof block === 'string' && /^0x[0-9a-f]+$/i.test(block)) n = Number(BigInt(block));
    else if (typeof block === 'string' && /^(0|[1-9]\d*)$/.test(block)) n = Number(block);
    else return null;
    if (!Number.isSafeInteger(n) || n < 0) return null;
    return n;
  }

  function pack(inv, blocked) {
    const block = blockNum(inv.block);
    if (block === null) throw new Error('block');
    const owners = [];
    const index = new Map();
    function ownerIndex(addr) {
      const a = String(addr).toLowerCase();
      if (!index.has(a)) {
        index.set(a, owners.length);
        owners.push(a);
      }
      return index.get(a);
    }
    return {
      block: block,
      owners: owners,
      math: inv.math.map(function (t) { return [t.id.toString(), ownerIndex(t.owner)]; }),
      rgb: inv.rgb.map(function (t) { return [t.id.toString(), ownerIndex(t.owner), t.r.toString(), t.g.toString(), t.b.toString()]; }),
      toon: inv.toon.map(function (t) { return [t.id.toString(), ownerIndex(t.owner), t.word.toString(), t.face.toString(), t.rgb.toString()]; }),
      words: packTexts(inv.words),
      faces: packTexts(inv.faces),
      blocked: blocked ? Array.from(blocked).map(function (a) { return String(a).toLowerCase(); }) : [],
      blockedDone: !!blocked,
    };
  }

  function packTexts(map) {
    const o = {};
    if (!map) return o;
    Array.from(map.keys()).sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; }).forEach(function (id) {
      o[id.toString()] = map.get(id);
    });
    return o;
  }

  const OWNER = /^0x[0-9a-f]{40}$/;

  function intIndex(n) {
    return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  }

  function unpack(raw) {
    if (!raw || !Array.isArray(raw.math) || !Array.isArray(raw.rgb) || !Array.isArray(raw.toon)) return null;
    if (!intIndex(raw.block)) return null;
    try {
      const table = raw.owners == null ? null : raw.owners;
      if (table && !Array.isArray(table)) throw new Error('owners');
      function ownerAt(v) {
        if (typeof v === 'number') {
          if (!intIndex(v) || !table || v >= table.length) throw new Error('owner');
          if (!OWNER.test(table[v])) throw new Error('owner');
          return table[v];
        }
        if (typeof v !== 'string' || !OWNER.test(v)) throw new Error('owner');
        return v;
      }
      const math = raw.math.map(function (t) {
        return { id: BigInt(t[0]), owner: ownerAt(t[1]) };
      });
      const rgb = raw.rgb.map(function (t) {
        return { id: BigInt(t[0]), owner: ownerAt(t[1]), r: BigInt(t[2]), g: BigInt(t[3]), b: BigInt(t[4]) };
      });
      const toon = raw.toon.map(function (t) {
        return { id: BigInt(t[0]), owner: ownerAt(t[1]), word: BigInt(t[2]), face: BigInt(t[3]), rgb: BigInt(t[4]) };
      });
      const words = unpackTexts(raw.words);
      const faces = unpackTexts(raw.faces);
      const blocked = [];
      (raw.blocked || []).forEach(function (a) {
        if (!OWNER.test(a)) throw new Error('owner');
        blocked.push(a);
      });
      return {
        block: raw.block,
        math: math,
        rgb: rgb,
        toon: toon,
        words: words,
        faces: faces,
        blocked: new Set(blocked),
        blockedDone: !!raw.blockedDone,
      };
    } catch (e) {
      return null;
    }
  }

  function unpackTexts(raw) {
    const map = new Map();
    if (raw == null) return map;
    if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('texts');
    Object.keys(raw).forEach(function (k) {
      if (!/^(0|[1-9]\d*)$/.test(k) || k.length > 78) throw new Error('text id');
      if (typeof raw[k] !== 'string' || raw[k].length > 256) throw new Error('text');
      map.set(BigInt(k), raw[k]);
    });
    return map;
  }

  function preferIndex(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    if (a.math.length !== b.math.length) return a.math.length > b.math.length ? a : b;
    if (a.rgb.length !== b.rgb.length) return a.rgb.length > b.rgb.length ? a : b;
    if (a.toon.length !== b.toon.length) return a.toon.length > b.toon.length ? a : b;
    if (!!a.blockedDone !== !!b.blockedDone) return a.blockedDone ? a : b;
    return a;
  }

  function readCache() {
    try {
      return unpack(JSON.parse(localStorage.getItem(CACHE)));
    } catch (e) { return null; }
  }

  function writeCache(inv, blocked) {
    try {
      localStorage.setItem(CACHE, JSON.stringify(pack(inv, blocked)));
    } catch (e) { /* quota */ }
  }

  // 1 finney, 23300 gas. MATH.transfer forwards 2300, so out-of-gas here means add() reverts.
  // A node failure throws. Callers must not treat that as "not blocked".
  async function probeHolder(holder) {
    const code = await rpc('eth_getCode', [holder, 'latest']);
    if (code.error || !code.result) throw new Error((code.error && code.error.message) || 'getCode');
    const c = code.result;
    if (c === '0x' || c === '0x0') return false;
    const j = await rpc('eth_call', [{ to: holder, value: '0x38d7ea4c68000', gas: '0x5b04' }, 'latest']);
    return !!j.error;
  }

  async function scanBlocked(owners, progress) {
    const list = Array.from(new Set(owners));
    let done = 0;
    const flags = await mapPool(list, 8, async function (owner) {
      let flag = 'unknown';
      try { flag = (await probeHolder(owner)) ? 'blocked' : 'clear'; } catch (e) { flag = 'unknown'; }
      done++;
      if (progress && done % 10 === 0) progress('holders ' + done + '/' + list.length);
      return flag;
    });
    const blocked = new Set();
    const unknown = new Set();
    flags.forEach(function (flag, i) {
      if (flag === 'blocked') blocked.add(list[i]);
      else if (flag === 'unknown') unknown.add(list[i]);
    });
    if (progress) progress('holders ' + list.length + '/' + list.length);
    return { blocked: blocked, unknown: unknown };
  }

  // Confirmed blocks and failed probes stay apart. Routing merges them; the page does not.
  function scanResult(scan) {
    const blocked = new Set();
    const unknown = new Set();
    (scan.blocked || []).forEach(function (a) { blocked.add(String(a).toLowerCase()); });
    (scan.unknown || []).forEach(function (a) { unknown.add(String(a).toLowerCase()); });
    return { blocked: blocked, unknown: unknown, blockedDone: unknown.size === 0 };
  }

  function cacheScan(inv, result) {
    if (!result || !result.blockedDone) return false;
    writeCache(inv, result.blocked);
    return true;
  }

  async function owned(contract, account, cap) {
    const raw = await ethCall(contract, ABI.call(ABI.SEL.balanceOf, [BigInt(account)]));
    const n = Number(ABI.decodeUint(raw));
    const take = Math.min(n, cap || n);
    const calls = [];
    for (let i = 0; i < take; i++) {
      calls.push({ to: contract, data: ABI.call(ABI.SEL.tokenOfOwnerByIndex, [BigInt(account), i]) });
    }
    const rows = calls.length ? await multicall(calls, null, 150) : [];
    const ids = [];
    rows.forEach(function (row) {
      if (row && row.success) ids.push(ABI.decodeUint(row.data));
    });
    return { ids: ids, total: n, truncated: take < n };
  }

  async function tokenSVGs(render, ids) {
    const calls = ids.map(function (id) {
      return { to: render, data: ABI.call(ABI.SEL.tokenSVG, [BigInt(id)]) };
    });
    const rows = await multicall(calls, null, 4);
    return rows.map(function (row) {
      if (!row || !row.success) return null;
      try { return ABI.decodeString(row.data); } catch (e) { return null; }
    });
  }

  async function simulate(tx) {
    return rpc('eth_call', [tx, 'latest']);
  }

  // One block, calls in order, so a later mint can see an earlier one.
  async function simulateCalls(calls) {
    const j = await rpc('eth_simulateV1', [{
      blockStateCalls: [{ calls: calls }],
      validation: false,
    }, 'latest']);
    if (j.error) {
      const err = new Error(j.error.message || 'simulate');
      err.code = j.error.code;
      throw err;
    }
    const block = Array.isArray(j.result) ? j.result[0] : null;
    const rows = block && block.calls;
    if (!rows || rows.length !== calls.length) throw new Error('simulate');
    return rows;
  }

  // Wallet popup. Callers must simulate and re-check existence first.
  async function send(tx) {
    if (!globalThis.ethereum) throw new Error('no wallet');
    tx.chainId = '0x1';
    return ethereum.request({ method: 'eth_sendTransaction', params: [tx] });
  }

  async function ensureChain() {
    if (!globalThis.ethereum) throw new Error('no wallet');
    let id = await ethereum.request({ method: 'eth_chainId' });
    if (id !== '0x1') {
      await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] });
      id = await ethereum.request({ method: 'eth_chainId' });
    }
    if (id !== '0x1') throw new Error('wrong network');
  }

  async function receipt(hash) {
    const j = await rpc('eth_getTransactionReceipt', [hash]);
    return j.result || null;
  }

  globalThis.ETH = {
    ADDR: ADDR,
    RPCS: RPCS,
    extraRpc: extraRpc,
    rpcRetryable: rpcRetryable,
    reason: reason,
    ownerOf: ownerOf,
    gasPrice: gasPrice,
    loadInventory: loadInventory,
    loadDelta: loadDelta,
    loadTexts: loadTexts,
    fillTexts: fillTexts,
    overlayTexts: overlayTexts,
    pack: pack,
    unpack: unpack,
    preferIndex: preferIndex,
    readCache: readCache,
    writeCache: writeCache,
    probeHolder: probeHolder,
    scanBlocked: scanBlocked,
    scanResult: scanResult,
    cacheScan: cacheScan,
    owned: owned,
    tokenSVGs: tokenSVGs,
    readString: readString,
    ethCall: ethCall,
    simulate: simulate,
    simulateCalls: simulateCalls,
    send: send,
    ensureChain: ensureChain,
    receipt: receipt,
  };
  if (typeof module === 'object' && module.exports) module.exports = globalThis.ETH;
})();
