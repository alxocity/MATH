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
  const DEFAULT_RPC = 'https://ethereum.publicnode.com';
  const CACHE = 'math.site.v1';
  const ABI = globalThis.ABI;

  function rpcUrl() {
    try {
      const u = localStorage.getItem('math.site.rpc');
      if (u && /^https:\/\//.test(u)) return u;
    } catch (e) { /* private mode */ }
    return DEFAULT_RPC;
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  async function rpc(method, params) {
    let last;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(rpcUrl(), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params }),
        });
        if (res.status === 429 || res.status >= 500) throw new Error('http ' + res.status);
        const j = await res.json();
        if (j.error) {
          const msg = j.error.message || '';
          if (/rate|limit|timeout|busy|temporarily/i.test(msg) && attempt < 3) throw new Error(msg);
        }
        return j;
      } catch (e) {
        last = e;
        await sleep(280 * (attempt + 1));
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

  async function loadIds(address, n, progress, label) {
    const calls = [];
    for (let i = 0; i < n; i++) calls.push({ to: address, data: ABI.call(ABI.SEL.tokenByIndex, [i]) });
    const rows = await multicall(calls, function (d, t) { if (progress) progress(label + ' ' + d + '/' + t); });
    return rows.map(function (row, i) {
      if (!row || !row.success) throw new Error(label + ' index ' + i);
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
      const w = ABI.decodeWords(row.data);
      return w;
    });
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
    return { block: BigInt(block.result).toString(), math: math, rgb: rgb, toon: toon };
  }

  function pack(inv, blocked) {
    return {
      block: inv.block,
      math: inv.math.map(function (t) { return [t.id.toString(), t.owner]; }),
      rgb: inv.rgb.map(function (t) { return [t.id.toString(), t.owner, t.r.toString(), t.g.toString(), t.b.toString()]; }),
      toon: inv.toon.map(function (t) { return [t.id.toString(), t.owner, t.word.toString(), t.face.toString(), t.rgb.toString()]; }),
      blocked: blocked ? Array.from(blocked) : [],
      blockedDone: !!blocked,
    };
  }

  function unpack(raw) {
    if (!raw || !raw.math) return null;
    return {
      block: raw.block,
      math: raw.math.map(function (t) { return { id: BigInt(t[0]), owner: t[1] }; }),
      rgb: raw.rgb.map(function (t) { return { id: BigInt(t[0]), owner: t[1], r: BigInt(t[2]), g: BigInt(t[3]), b: BigInt(t[4]) }; }),
      toon: raw.toon.map(function (t) { return { id: BigInt(t[0]), owner: t[1], word: BigInt(t[2]), face: BigInt(t[3]), rgb: BigInt(t[4]) }; }),
      blocked: new Set(raw.blocked || []),
      blockedDone: !!raw.blockedDone,
    };
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

  // Empty call with 1 finney and a 23300 gas cap.
  // Out-of-gas is not a revert: WETH dies that way and must stay usable until add() is simulated.
  // A real revert (no receive, or receive that reverts) marks the holder blocked for MATH.transfer.
  async function probeHolder(holder) {
    const code = await rpc('eth_getCode', [holder, 'latest']);
    if (code.error) return false;
    const c = code.result || '0x';
    if (c === '0x' || c === '0x0') return false;
    const j = await rpc('eth_call', [{ to: holder, value: '0x38d7ea4c68000', gas: '0x5b04' }, 'latest']);
    if (!j.error) return false;
    const msg = String(j.error.message || '').toLowerCase();
    if (j.error.code === -32003 || msg.includes('out of gas') || msg.includes('gas required exceeds')) return false;
    return true;
  }

  async function scanBlocked(owners, progress) {
    const list = Array.from(new Set(owners));
    let done = 0;
    const flags = await mapPool(list, 8, async function (owner) {
      let blocked = false;
      try { blocked = await probeHolder(owner); } catch (e) { blocked = false; }
      done++;
      if (progress && done % 10 === 0) progress('holders ' + done + '/' + list.length);
      return blocked;
    });
    const set = new Set();
    flags.forEach(function (flag, i) { if (flag) set.add(list[i]); });
    if (progress) progress('holders ' + list.length + '/' + list.length);
    return set;
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

  // Wallet popup. Callers must simulate and re-check existence first.
  async function send(tx) {
    if (!globalThis.ethereum) throw new Error('no wallet');
    return ethereum.request({ method: 'eth_sendTransaction', params: [tx] });
  }

  async function ensureChain() {
    if (!globalThis.ethereum) throw new Error('no wallet');
    const id = await ethereum.request({ method: 'eth_chainId' });
    if (id === '0x1') return;
    await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] });
  }

  async function receipt(hash) {
    const j = await rpc('eth_getTransactionReceipt', [hash]);
    return j.result || null;
  }

  globalThis.ETH = {
    ADDR: ADDR,
    DEFAULT_RPC: DEFAULT_RPC,
    rpcUrl: rpcUrl,
    reason: reason,
    ownerOf: ownerOf,
    gasPrice: gasPrice,
    loadInventory: loadInventory,
    readCache: readCache,
    writeCache: writeCache,
    scanBlocked: scanBlocked,
    owned: owned,
    tokenSVGs: tokenSVGs,
    readString: readString,
    simulate: simulate,
    send: send,
    ensureChain: ensureChain,
    receipt: receipt,
  };
})();
