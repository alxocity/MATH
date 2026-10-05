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
  const HOLDERS = 'math.holders.v1';
  const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  const ZERO = '0x0000000000000000000000000000000000000000';
  const LOG_SPAN = 2000;
  const ABI = globalThis.ABI;

  // Reverts, including out-of-gas, are answers. Fail over only when the node itself failed.
  function rpcRetryable(status, error) {
    if (status === 429 || status >= 500) return true;
    if (!error) return false;
    const msg = String(error.message || '');
    if (error.code === 3 || /execution reverted/i.test(msg)) return false;
    if (error.code === -32603 || error.code === -32005 || error.code === -32601) return true;
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
        if (rpcRetryable(res.status, j.error)) {
          const err = new Error((j.error && j.error.message) || 'rpc');
          if (j.error && j.error.code != null) err.code = j.error.code;
          throw err;
        }
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

  async function balance(account) {
    const j = await rpc('eth_getBalance', [account, 'latest']);
    if (j.error) throw new Error(j.error.message || 'balance');
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
    const wordOwners = await loadPartOwners(ADDR.WORD, progress, 'WORD');
    const faceOwners = await loadPartOwners(ADDR.FACE, progress, 'FACE');
    return { block: blockNum(block.result), math: math, rgb: rgb, toon: toon, words: words, faces: faces, wordOwners: wordOwners, faceOwners: faceOwners };
  }

  // WORD and FACE ids are 0..supply-1. The array index is the token id.
  async function loadPartOwners(address, progress, label) {
    const raw = await ethCall(address, '0x' + ABI.SEL.totalSupply);
    const n = Number(ABI.decodeUint(raw));
    if (!Number.isSafeInteger(n) || n < 1) throw new Error(label + ' supply');
    const ids = await loadIds(address, n, progress, label);
    if (ids.length !== n) throw new Error(label + ' supply');
    for (let i = 0; i < ids.length; i++) {
      if (ids[i] !== BigInt(i)) throw new Error(label + ' id ' + i);
    }
    return loadOwners(address, ids, progress, label);
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

  function logRangeError(error) {
    if (!error) return false;
    const msg = String(error.message || '');
    return /more than|too many results|block range|query timeout|response size|10000|too large|max(?:imum)? block|logs? limited/i.test(msg);
  }

  function hexQty(n) {
    return '0x' + BigInt(n).toString(16);
  }

  function topicAddr(topic) {
    const h = String(topic || '').toLowerCase().replace(/^0x/, '');
    if (h.length < 40) return null;
    const a = '0x' + h.slice(-40);
    if (!/^0x[0-9a-f]{40}$/.test(a)) return null;
    return a;
  }

  function topicUint(topic) {
    const h = String(topic || '');
    if (!/^0x[0-9a-f]+$/i.test(h)) return null;
    try { return BigInt(h); } catch (e) { return null; }
  }

  function parseTransfer(log) {
    const topics = log && log.topics;
    if (!topics || topics.length < 4) return null;
    if (String(topics[0]).toLowerCase() !== TRANSFER) return null;
    const from = topicAddr(topics[1]);
    const to = topicAddr(topics[2]);
    const id = topicUint(topics[3]);
    if (!from || !to || id == null) return null;
    return { from: from, to: to, id: id };
  }

  function logOrder(v) {
    if (v == null) return 0;
    try { return Number(BigInt(v)); } catch (e) { return 0; }
  }

  function compareLogs(a, b) {
    const block = logOrder(a.blockNumber) - logOrder(b.blockNumber);
    if (block) return block;
    return logOrder(a.logIndex) - logOrder(b.logIndex);
  }

  // Mutates rows. A mint from 0x0 of an unknown id is appended. Later logs win.
  function applyTransfers(rows, logs, opt) {
    const allowMint = !opt || opt.mint !== false;
    const byId = new Map();
    rows.forEach(function (row, i) { byId.set(String(row.id), i); });
    logs.slice().sort(compareLogs).forEach(function (log) {
      const ev = parseTransfer(log);
      if (!ev) return;
      const key = ev.id.toString();
      if (byId.has(key)) {
        rows[byId.get(key)].owner = ev.to;
        return;
      }
      if (!allowMint || ev.from !== ZERO) return;
      byId.set(key, rows.length);
      rows.push({ id: ev.id, owner: ev.to });
    });
    return rows;
  }

  async function postRpc(url, method, params, timeout) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params }),
      signal: AbortSignal.timeout(timeout || 20000),
    });
    if (res.status === 429 || res.status >= 500) {
      const err = new Error('http ' + res.status);
      err.retry = true;
      throw err;
    }
    return res.json();
  }

  // One pass over the RPC list. A range rejection is marked so the caller can split.
  // It does not go through rpc(), which would sleep and retry a query the node will keep refusing.
  async function rpcLogs(params) {
    let last;
    for (let i = 0; i < RPCS.length; i++) {
      try {
        const j = await postRpc(RPCS[i], 'eth_getLogs', params);
        if (j.error) {
          const err = new Error(j.error.message || 'logs');
          if (j.error.code != null) err.code = j.error.code;
          if (logRangeError(j.error)) err.range = true;
          else if (!rpcRetryable(200, j.error)) throw err;
          last = err;
          continue;
        }
        if (!Array.isArray(j.result)) throw new Error('logs');
        return j.result;
      } catch (e) {
        if (e.range) throw e;
        last = e;
      }
    }
    throw last || new Error('logs');
  }

  async function collectLogs(address, from, to) {
    if (from > to) return [];
    if (to - from + 1 > LOG_SPAN) {
      const mid = from + LOG_SPAN - 1;
      const left = await collectLogs(address, from, mid);
      const right = await collectLogs(address, mid + 1, to);
      return left.concat(right);
    }
    const params = [{
      address: address,
      fromBlock: hexQty(from),
      toBlock: hexQty(to),
      topics: [TRANSFER],
    }];
    try {
      return await rpcLogs(params);
    } catch (e) {
      if (!e.range || from >= to) throw e;
      const mid = from + Math.floor((to - from) / 2);
      const left = await collectLogs(address, from, mid);
      const right = await collectLogs(address, mid + 1, to);
      return left.concat(right);
    }
  }

  async function getTransferLogs(address, from, to) {
    const logs = await collectLogs(address, from, to);
    logs.sort(compareLogs);
    return logs;
  }

  function cloneRow(t, fields) {
    const row = { id: t.id, owner: t.owner };
    fields.forEach(function (k) { row[k] = t[k]; });
    return row;
  }

  async function syncRows(address, rows, fromBlock, head, progress, label, allowMint) {
    if (!(head > fromBlock)) return rows;
    if (progress) progress(label + ' logs');
    try {
      const logs = await getTransferLogs(address, fromBlock + 1, head);
      applyTransfers(rows, logs, { mint: allowMint });
      return rows;
    } catch (e) {
      const owners = await loadOwners(address, rows.map(function (t) { return t.id; }), progress, label);
      rows.forEach(function (row, i) { row.owner = owners[i]; });
      return rows;
    }
  }

  // WORD/FACE arrays are indexed by token id. Logs move owners; holes get one ownerOf.
  async function syncPartOwners(address, list, fromBlock, head, progress, label) {
    if (!Array.isArray(list)) return null;
    if (!(head > fromBlock)) return list.slice();
    try {
      if (progress) progress(label + ' logs');
      const rows = list.map(function (owner, i) {
        return { id: BigInt(i), owner: String(owner || '').toLowerCase() };
      });
      const logs = await getTransferLogs(address, fromBlock + 1, head);
      applyTransfers(rows, logs);
      const raw = await ethCall(address, '0x' + ABI.SEL.totalSupply);
      const supply = Number(ABI.decodeUint(raw));
      if (!Number.isSafeInteger(supply) || supply < 1) throw new Error(label + ' supply');
      if (supply < list.length) throw new Error(label + ' supply');
      const out = new Array(supply).fill('');
      rows.forEach(function (row) {
        const i = Number(row.id);
        if (Number.isSafeInteger(i) && i >= 0 && i < supply) out[i] = row.owner;
      });
      const missing = [];
      for (let i = 0; i < supply; i++) {
        if (!/^0x[0-9a-f]{40}$/.test(String(out[i] || ''))) missing.push(BigInt(i));
      }
      if (missing.length) {
        const got = await loadOwners(address, missing, progress, label);
        missing.forEach(function (id, i) { out[Number(id)] = got[i]; });
      }
      return out;
    } catch (e) {
      return loadPartOwners(address, progress, label);
    }
  }

  async function ensurePartOwners(inv, progress) {
    if (!inv) return inv;
    const wordOwners = Array.isArray(inv.wordOwners) ? inv.wordOwners : await loadPartOwners(ADDR.WORD, progress, 'WORD');
    const faceOwners = Array.isArray(inv.faceOwners) ? inv.faceOwners : await loadPartOwners(ADDR.FACE, progress, 'FACE');
    if (wordOwners === inv.wordOwners && faceOwners === inv.faceOwners) return inv;
    return Object.assign({}, inv, { wordOwners: wordOwners, faceOwners: faceOwners });
  }

  // Newer enumeration indexes, then Transfer logs from the snapshot block.
  // A shorter supply, or a head behind the snapshot, reloads. WORD/FACE stay
  // unset until something asks, when the base has no index for them.
  async function loadDelta(base, progress, trusted) {
    const block = await rpc('eth_blockNumber', []);
    if (block.error) throw new Error(block.error.message || 'block');
    const head = blockNum(block.result);
    if (head === null) throw new Error('block');
    const from = blockNum(base.block);
    if (from === null || head < from) return loadInventory(progress);
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
    const math = await syncRows(ADDR.MATH, base.math.map(function (t) { return cloneRow(t, []); }).concat(mathMore), from, head, progress, 'MATH', true);
    const rgb = await syncRows(ADDR.RGB, base.rgb.map(function (t) { return cloneRow(t, ['r', 'g', 'b']); }).concat(rgbMore), from, head, progress, 'RGB', false);
    const toon = await syncRows(ADDR.TOON, base.toon.map(function (t) { return cloneRow(t, ['word', 'face', 'rgb']); }).concat(toonMore), from, head, progress, 'TOON', false);
    const words = await fillTexts(base.words, toon.map(function (t) { return t.word; }), ADDR.WORD, ABI.SEL.getWord, progress, 'WORD', trusted && trusted.words);
    const faces = await fillTexts(base.faces, toon.map(function (t) { return t.face; }), ADDR.FACE, ABI.SEL.getFace, progress, 'FACE', trusted && trusted.faces);
    const wordOwners = await syncPartOwners(ADDR.WORD, base.wordOwners, from, head, progress, 'WORD');
    const faceOwners = await syncPartOwners(ADDR.FACE, base.faceOwners, from, head, progress, 'FACE');
    return {
      block: head,
      math: math,
      rgb: rgb,
      toon: toon,
      words: words,
      faces: faces,
      wordOwners: wordOwners,
      faceOwners: faceOwners,
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
      wordOwners: packOwnerList(inv.wordOwners, ownerIndex),
      faceOwners: packOwnerList(inv.faceOwners, ownerIndex),
      blocked: blocked ? Array.from(blocked).map(function (a) { return String(a).toLowerCase(); }) : [],
      blockedDone: !!blocked,
    };
  }

  function packOwnerList(list, ownerIndex) {
    if (list == null) return undefined;
    return list.map(function (addr) { return ownerIndex(addr); });
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
      const wordOwners = unpackOwnerList(raw.wordOwners, ownerAt);
      const faceOwners = unpackOwnerList(raw.faceOwners, ownerAt);
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
        wordOwners: wordOwners,
        faceOwners: faceOwners,
        blocked: new Set(blocked),
        blockedDone: !!raw.blockedDone,
      };
    } catch (e) {
      return null;
    }
  }

  function unpackOwnerList(raw, ownerAt) {
    if (raw == null) return null;
    if (!Array.isArray(raw)) throw new Error('owners');
    return raw.map(ownerAt);
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

  function hasPartOwners(inv) {
    return Array.isArray(inv.wordOwners) && Array.isArray(inv.faceOwners);
  }

  // After the WORD/FACE index ships, an old cache lacks it. Keep the side that has it.
  // Same length: the higher block is newer.
  function preferIndex(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    const aParts = hasPartOwners(a);
    const bParts = hasPartOwners(b);
    if (aParts !== bParts) return aParts ? a : b;
    if (a.math.length !== b.math.length) return a.math.length > b.math.length ? a : b;
    if (a.rgb.length !== b.rgb.length) return a.rgb.length > b.rgb.length ? a : b;
    if (a.toon.length !== b.toon.length) return a.toon.length > b.toon.length ? a : b;
    const aBlock = blockNum(a.block);
    const bBlock = blockNum(b.block);
    if (aBlock !== bBlock) {
      if (aBlock == null) return b;
      if (bBlock == null) return a;
      return aBlock > bBlock ? a : b;
    }
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

  function holderStorage() {
    try {
      if (typeof localStorage === 'undefined' || !localStorage || typeof localStorage.getItem !== 'function') return null;
      return localStorage;
    } catch (e) { return null; }
  }

  function readHolders() {
    const store = holderStorage();
    if (!store) return { block: 0, holders: {} };
    try {
      const raw = JSON.parse(store.getItem(HOLDERS));
      if (!raw || typeof raw !== 'object' || !raw.holders || typeof raw.holders !== 'object' || Array.isArray(raw.holders)) {
        return { block: 0, holders: {} };
      }
      return { block: blockNum(raw.block) || 0, holders: raw.holders };
    } catch (e) { return { block: 0, holders: {} }; }
  }

  function writeHolders(cache) {
    const store = holderStorage();
    if (!store) return;
    try { store.setItem(HOLDERS, JSON.stringify({ block: cache.block, holders: cache.holders })); } catch (e) { /* quota */ }
  }

  function holderFlag(entry) {
    if (!entry || typeof entry !== 'object') return '';
    if (entry.flag === 'blocked' || entry.flag === 'clear') return entry.flag;
    return '';
  }

  // Holders already in a finished snapshot are not probed again. New ones are,
  // and a clear or blocked answer is kept under math.holders.v1 by address and block.
  async function catchHolders(owners, base, progress, block) {
    const list = [];
    const seen = new Set();
    (owners || []).forEach(function (a) {
      const x = String(a || '').toLowerCase();
      if (!/^0x[0-9a-f]{40}$/.test(x) || seen.has(x)) return;
      seen.add(x);
      list.push(x);
    });
    const known = new Set();
    const knownBlocked = new Set();
    if (base && base.blockedDone && Array.isArray(base.math)) {
      base.math.forEach(function (t) {
        const a = String(t.owner || '').toLowerCase();
        if (/^0x[0-9a-f]{40}$/.test(a)) known.add(a);
      });
      if (base.blocked && typeof base.blocked.forEach === 'function') {
        base.blocked.forEach(function (a) {
          const x = String(a).toLowerCase();
          if (/^0x[0-9a-f]{40}$/.test(x)) knownBlocked.add(x);
        });
      }
    }
    const cache = readHolders();
    const fresh = [];
    list.forEach(function (a) {
      if (known.has(a)) return;
      if (holderFlag(cache.holders[a])) return;
      fresh.push(a);
    });
    const scan = fresh.length ? await scanBlocked(fresh, progress) : { blocked: new Set(), unknown: new Set() };
    const blocked = new Set();
    const unknown = new Set();
    const at = blockNum(block);
    const stamp = at == null ? ((base && blockNum(base.block)) || 0) : at;
    list.forEach(function (a) {
      if (known.has(a) && knownBlocked.has(a)) blocked.add(a);
      if (holderFlag(cache.holders[a]) === 'blocked') blocked.add(a);
    });
    scan.blocked.forEach(function (a) {
      const x = String(a).toLowerCase();
      blocked.add(x);
      cache.holders[x] = { flag: 'blocked', block: stamp };
    });
    scan.unknown.forEach(function (a) { unknown.add(String(a).toLowerCase()); });
    fresh.forEach(function (a) {
      if (scan.blocked.has(a) || unknown.has(a)) return;
      cache.holders[a] = { flag: 'clear', block: stamp };
    });
    if (base && base.blockedDone) {
      known.forEach(function (a) {
        if (holderFlag(cache.holders[a])) return;
        cache.holders[a] = { flag: knownBlocked.has(a) ? 'blocked' : 'clear', block: blockNum(base.block) || stamp };
      });
    }
    cache.block = stamp;
    writeHolders(cache);
    return { blocked: blocked, unknown: unknown };
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

  // Supply and get(id) share one multicall. A later split would let a lagging node
  // answer get(id) with (0,0,0) for a token it has not seen yet.
  async function rgbRows() {
    const supply = '0x' + ABI.SEL.totalSupply;
    const probed = await ethCall(ADDR.RGB, supply);
    const n = Number(ABI.decodeUint(probed));
    if (!Number.isSafeInteger(n) || n < 0) throw new Error('RGB supply');
    const calls = [{ to: ADDR.RGB, data: supply }];
    for (let i = 1; i <= n; i++) calls.push({ to: ADDR.RGB, data: ABI.call(ABI.SEL.get, [BigInt(i)]) });
    const data = ABI.encodeAggregate(calls.map(function (c) {
      return { to: c.to, data: c.data, allow: true };
    }));
    const j = await rpc('eth_call', [{ to: ADDR.MULTI, data: data }, 'latest']);
    if (j.error) throw new Error('RGB get');
    const rows = ABI.decodeAggregate(j.result);
    if (rows.length !== calls.length || !rows[0] || !rows[0].success) throw new Error('RGB get');
    const seen = Number(ABI.decodeUint(rows[0].data));
    if (seen !== n) throw new Error('RGB get');
    if (!n) return [];
    if (!globalThis.RUN || typeof globalThis.RUN.rgbWord !== 'function') throw new Error('RGB get');
    const out = [];
    for (let i = 1; i <= n; i++) {
      const row = rows[i];
      if (!row || !row.success) throw new Error('RGB get');
      out.push(globalThis.RUN.rgbWord(ABI.wordsOf(row.data)));
    }
    return out;
  }

  async function rgbMinted(r, g, b) {
    if (!globalThis.RUN || typeof globalThis.RUN.rgbMatch !== 'function') throw new Error('RGB match');
    return globalThis.RUN.rgbMatch(await rgbRows(), r, g, b);
  }

  async function rgbUsed(r, g, b) {
    if (!globalThis.RUN || typeof globalThis.RUN.rgbPlane !== 'function') throw new Error('RGB plane');
    return globalThis.RUN.rgbPlane(await rgbRows(), r, g, b);
  }

  async function simulate(tx) {
    return rpc('eth_call', [tx, 'latest']);
  }

  async function estimateGas(tx) {
    return rpc('eth_estimateGas', [tx]);
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
    balance: balance,
    loadInventory: loadInventory,
    loadDelta: loadDelta,
    applyTransfers: applyTransfers,
    getTransferLogs: getTransferLogs,
    ensurePartOwners: ensurePartOwners,
    catchHolders: catchHolders,
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
    rgbMinted: rgbMinted,
    rgbUsed: rgbUsed,
    simulate: simulate,
    estimateGas: estimateGas,
    simulateCalls: simulateCalls,
    send: send,
    ensureChain: ensureChain,
    receipt: receipt,
  };
  if (typeof module === 'object' && module.exports) module.exports = globalThis.ETH;
})();
