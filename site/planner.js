(function (g, f) {
  const api = f();
  if (typeof module === 'object' && module.exports) module.exports = api;
  g.PLAN = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const PAL = 'kbgcrmyw';
  const COL = { k: 0, b: 1, g: 2, c: 3, r: 4, m: 5, y: 6, w: 7 };
  const ROY_WEI = 10n ** 15n;
  const MSG_MATH = 2n * ROY_WEI;
  const MSG_RGB = 30n * ROY_WEI;
  const RGB_ROY = 10n * ROY_WEI;
  const G_ADD = 175000n; // estimate, MATH.add
  const G_RGB = 340000n; // estimate, RGB.add, measured ~337k
  const MAX = (1n << 256n) - 1n;
  // Red silhouette only. R, G, and B ids are chosen by pickHeart, never fixed.
  const HEART_SHAPE = [
    'kkkkkkkkkkkkkkkk',
    'kkrrrkkkkkrrrkkk',
    'krrrrrkkkrrrrrkk',
    'rrrrrrrkrrrrrrrk',
    'rrrrrrrrrrrrrrrk',
    'rrrrrrrrrrrrrrrk',
    'krrrrrrrrrrrrrkk',
    'kkrrrrrrrrrrrkkk',
    'kkkrrrrrrrrrkkkk',
    'kkkkrrrrrrrkkkkk',
    'kkkkkrrrrrkkkkkk',
    'kkkkkkrrrkkkkkkk',
    'kkkkkkkrkkkkkkkk',
    'kkkkkkkkkkkkkkkk',
    'kkkkkkkkkkkkkkkk',
    'kkkkkkkkkkkkkkkk',
  ];
  const HEART_MAX_MINTS = 40;
  const HEART_SLACK = 1;

  function popcount(n) {
    let c = 0;
    let x = BigInt(n);
    while (x) {
      x &= x - 1n;
      c++;
    }
    return c;
  }

  function isPow2(n) {
    const x = BigInt(n);
    return x > 0n && (x & (x - 1n)) === 0n;
  }

  function isPal(n) {
    const s = BigInt(n).toString();
    let i = 0;
    let j = s.length - 1;
    while (i < j) {
      if (s[i] !== s[j]) return false;
      i++;
      j--;
    }
    return true;
  }

  // Same rule as MATHRender: 0, 1 and 8 stay, 6 and 9 swap, anything else fails.
  function isStrobo(n) {
    const s = BigInt(n).toString();
    for (let i = 0; i < s.length; i++) {
      const d = s.charCodeAt(i) - 48;
      const e = s.charCodeAt(s.length - 1 - i) - 48;
      const rot = e === 6 ? 9 : e === 9 ? 6 : e;
      if (rot !== d || (e > 1 && e !== 6 && e !== 8 && e !== 9)) return false;
    }
    return true;
  }

  function bitLength(n) {
    const x = BigInt(n);
    return x === 0n ? 0 : x.toString(2).length;
  }

  function gridToPlanes(rows) {
    const s = rows.join('');
    if (s.length !== 256) throw new Error('grid');
    let R = 0n;
    let G = 0n;
    let B = 0n;
    for (let i = 0; i < 256; i++) {
      const v = COL[s[i]];
      if (v === undefined) throw new Error('palette');
      R = (R << 1n) | BigInt((v >> 2) & 1);
      G = (G << 1n) | BigInt((v >> 1) & 1);
      B = (B << 1n) | BigInt(v & 1);
    }
    return { R: R, G: G, B: B };
  }

  function planesToRows(R, G, B) {
    const rows = [];
    for (let y = 0; y < 16; y++) {
      let s = '';
      for (let x = 0; x < 16; x++) {
        const shift = 255n - BigInt(y * 16 + x);
        const r = Number((BigInt(R) >> shift) & 1n);
        const g = Number((BigInt(G) >> shift) & 1n);
        const b = Number((BigInt(B) >> shift) & 1n);
        s += PAL[r * 4 + g * 2 + b];
      }
      rows.push(s);
    }
    return rows;
  }

  function roy(owner, user) {
    if (!owner || !user) return ROY_WEI;
    return owner.toLowerCase() === user.toLowerCase() ? 0n : ROY_WEI;
  }

  function norm(ctx) {
    const supply = new Map();
    ctx.supply.forEach(function (owner, id) {
      supply.set(BigInt(id), String(owner).toLowerCase());
    });
    const blocked = new Set();
    function take(set) {
      if (!set) return;
      set.forEach(function (a) { blocked.add(String(a).toLowerCase()); });
    }
    take(ctx.blocked);
    take(ctx.unknown);
    return {
      supply: supply,
      user: String(ctx.user || '0x0000000000000000000000000000000000000000').toLowerCase(),
      blocked: blocked,
      gasWei: BigInt(ctx.gasWei == null ? G_ADD * 1000000000n : ctx.gasWei),
      mode: ctx.mode === 'fewest' ? 'fewest' : 'cheapest',
    };
  }

  function heapPush(h, item) {
    h.push(item);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (h[p][0] <= h[i][0]) break;
      const t = h[p];
      h[p] = h[i];
      h[i] = t;
      i = p;
    }
  }

  function heapPop(h) {
    const top = h[0];
    const last = h.pop();
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        let s = i;
        const l = i * 2 + 1;
        const r = l + 1;
        if (l < h.length && h[l][0] < h[s][0]) s = l;
        if (r < h.length && h[r][0] < h[s][0]) s = r;
        if (s === i) break;
        const t = h[s];
        h[s] = h[i];
        h[i] = t;
        i = s;
      }
    }
    return top;
  }

  function seedsFor(N, ctx) {
    const all = [];
    ctx.supply.forEach(function (owner, id) {
      if (id > 0n && id <= N && !ctx.blocked.has(owner)) all.push(id);
    });
    if (all.length <= 480) return all;
    const scored = all.filter(function (id) {
      return ctx.supply.get(id) === ctx.user || isPow2(id) || (id & ~N) === 0n;
    });
    scored.sort(function (a, b) {
      const pa = popcount(a);
      const pb = popcount(b);
      if (pa !== pb) return pb - pa;
      return a > b ? -1 : 1;
    });
    return scored.slice(0, 480);
  }

  // v -> v+s (s already minted) or v -> 2v. Skip edges that land on a minted id.
  function planSmall(N, ctx, wRoy) {
    const seeds = seedsFor(N, ctx);
    if (!seeds.length) return null;
    const dist = new Map();
    const prev = new Map();
    const pq = [];
    for (let i = 0; i < seeds.length; i++) {
      dist.set(seeds[i], 0n);
      heapPush(pq, [0n, seeds[i]]);
    }
    const w = BigInt(wRoy);
    const huge = 1n << 200n;
    let seen = 0;
    while (pq.length) {
      const popped = heapPop(pq);
      const c = popped[0];
      const v = popped[1];
      if (c !== dist.get(v)) continue;
      if (v === N) break;
      if (++seen > 250000) return null;
      const nSeed = seeds.length;
      for (let i = 0; i <= nSeed; i++) {
        const s = i === nSeed ? v : seeds[i];
        const nv = v + s;
        if (nv > N || ctx.supply.has(nv)) continue;
        const rv = ctx.supply.has(v) ? roy(ctx.supply.get(v), ctx.user) : 0n;
        const rs = ctx.supply.has(s) ? roy(ctx.supply.get(s), ctx.user) : (s === v ? 0n : null);
        if (rs === null) continue;
        const nc = c + ctx.gasWei + w * (rv + rs);
        if (nc < (dist.has(nv) ? dist.get(nv) : huge)) {
          dist.set(nv, nc);
          prev.set(nv, [v, s]);
          heapPush(pq, [nc, nv]);
        }
      }
    }
    if (!prev.has(N)) return null;
    const rights = [];
    let x = N;
    while (prev.has(x)) {
      const step = prev.get(x);
      rights.push(step[1]);
      x = step[0];
    }
    rights.reverse();
    return [x].concat(rights);
  }

  function pow2(k, ctx) {
    if (k < 0) throw new Error('no seed');
    const bit = 1n << BigInt(k);
    const own = ctx.supply.get(bit);
    if (own !== undefined && !ctx.blocked.has(own)) return [bit];
    let best = null;
    let bestRoy = null;
    ctx.supply.forEach(function (oa, a) {
      if (a <= 0n || a >= bit) return;
      const b = bit - a;
      const ob = ctx.supply.get(b);
      if (ob === undefined || ctx.blocked.has(oa) || ctx.blocked.has(ob)) return;
      const r = roy(oa, ctx.user) + roy(ob, ctx.user);
      if (bestRoy === null || r < bestRoy || (r === bestRoy && (a < best[0] || (a === best[0] && b < best[1])))) {
        bestRoy = r;
        best = [a, b];
      }
    });
    if (best) return best;
    const half = pow2(k - 1, ctx);
    return half.concat(half);
  }

  function planBitmap(N, ctx, wRoy) {
    const cand = [];
    ctx.supply.forEach(function (owner, id) {
      if (id > 0n && (id & ~N) === 0n && !ctx.blocked.has(owner)) cand.push(id);
    });
    let left = N;
    const pieces = [];
    const w = BigInt(wRoy);
    let guard = 0;
    while (left) {
      if (++guard > 520) throw new Error('route too long');
      let best = null;
      let bestPop = 0n;
      let bestCost = 1n;
      for (let i = 0; i < cand.length; i++) {
        const t = cand[i];
        if ((t & ~left) !== 0n) continue;
        let cost = ctx.gasWei + w * roy(ctx.supply.get(t), ctx.user);
        if (cost === 0n) cost = 1n;
        const pop = BigInt(popcount(t));
        if (best === null || pop * bestCost > bestPop * cost || (pop * bestCost === bestPop * cost && t > best)) {
          best = t;
          bestPop = pop;
          bestCost = cost;
        }
      }
      if (best !== null) {
        pieces.push(best);
        left &= ~best;
        continue;
      }
      const k = bitLength(left) - 1;
      const ps = pow2(k, ctx);
      for (let i = 0; i < ps.length; i++) pieces.push(ps[i]);
      left &= ~(1n << BigInt(k));
    }
    pieces.sort(function (a, b) { return a === b ? 0 : a > b ? -1 : 1; });
    return pieces;
  }

  function fold(pieces, ctx0) {
    const ctx = ctx0.supply ? (ctx0.gasWei !== undefined && ctx0.user ? ctx0 : norm(ctx0)) : norm(ctx0);
    const base = ctx.supply;
    if (!pieces.length) throw new Error('empty');
    const supply = new Map(base);
    let acc = BigInt(pieces[0]);
    if (!supply.has(acc)) throw new Error('missing ' + acc);
    let accOwner = supply.get(acc);
    const steps = [];
    let royalty = 0n;
    let mints = 0;
    for (let i = 1; i < pieces.length; i++) {
      const p = BigInt(pieces[i]);
      let pOwner = null;
      if (supply.has(p)) pOwner = supply.get(p);
      else if (p === acc) pOwner = accOwner;
      if (pOwner === null) throw new Error('missing ' + p);
      const nv = acc + p;
      if (nv > MAX) throw new Error('overflow');
      if (supply.has(nv)) {
        steps.push({ a: acc, b: p, result: nv, exists: true, owner: supply.get(nv), royalty: 0n, payTo: [accOwner, pOwner] });
        acc = nv;
        accOwner = supply.get(nv);
        continue;
      }
      const r = roy(accOwner, ctx.user) + roy(pOwner, ctx.user);
      royalty += r;
      mints++;
      steps.push({ a: acc, b: p, result: nv, exists: false, royalty: r, payTo: [accOwner, pOwner] });
      acc = nv;
      accOwner = ctx.user;
      supply.set(nv, ctx.user);
    }
    const gas = ctx.gasWei * BigInt(mints);
    return {
      target: acc,
      exists: pieces.length === 1 && base.has(acc),
      owner: pieces.length === 1 ? base.get(acc) : undefined,
      pieces: pieces.map(function (p) { return BigInt(p); }),
      mints: mints,
      royalty: royalty,
      gas: gas,
      msgValue: MSG_MATH * BigInt(mints),
      net: royalty + gas,
      steps: steps,
    };
  }

  function better(a, b, mode) {
    if (mode === 'fewest') {
      if (a.mints !== b.mints) return a.mints < b.mints;
      return a.net < b.net;
    }
    if (a.net !== b.net) return a.net < b.net;
    return a.mints < b.mints;
  }

  function plan(N, ctx0) {
    const ctx = norm(ctx0);
    N = BigInt(N);
    if (N <= 0n || N > MAX) throw new Error('target');
    if (ctx.supply.has(N)) {
      return {
        target: N,
        exists: true,
        owner: ctx.supply.get(N),
        pieces: [N],
        steps: [],
        mints: 0,
        royalty: 0n,
        gas: 0n,
        msgValue: 0n,
        net: 0n,
      };
    }
    const weights = ctx.mode === 'fewest' ? [0, 1] : [1, 4, 16, 0];
    let best = null;
    for (let i = 0; i < weights.length; i++) {
      try {
        let pieces = null;
        if (N <= 8192n) pieces = planSmall(N, ctx, weights[i]);
        if (!pieces) pieces = planBitmap(N, ctx, weights[i]);
        const route = fold(pieces, ctx);
        if (route.target !== N) continue;
        if (!best || better(route, best, ctx.mode)) best = route;
      } catch (e) { /* next weight */ }
    }
    if (!best) throw new Error('no route');
    return best;
  }

  // Pins are existing submasks. Their bits are cleared, the rest is planned, then folded.
  function planWithPins(N, pins, ctx0) {
    const ctx = norm(ctx0);
    N = BigInt(N);
    let left = N;
    const pinned = [];
    for (let i = 0; i < pins.length; i++) {
      const p = BigInt(pins[i]);
      if (p <= 0n || (p & ~left) !== 0n) throw new Error('pin does not fit');
      if (!ctx.supply.has(p)) throw new Error('pin missing');
      if (ctx.blocked.has(ctx.supply.get(p))) throw new Error('pin blocked');
      pinned.push(p);
      left &= ~p;
    }
    if (left === 0n) {
      const route = fold(pinned, ctx);
      if (route.target !== N) throw new Error('pins do not sum');
      return route;
    }
    const rest = plan(left, ctx);
    const route = fold(pinned.concat(rest.pieces), ctx);
    if (route.target !== N) throw new Error('pins do not sum');
    return route;
  }

  let heartMask = null;
  function maskOfHeart() {
    if (heartMask === null) heartMask = gridToPlanes(HEART_SHAPE).R;
    return heartMask;
  }

  function blockedAddrs(ctx) {
    const out = new Set();
    function add(set) {
      if (!set) return;
      set.forEach(function (a) { out.add(String(a).toLowerCase()); });
    }
    add(ctx.blocked);
    add(ctx.unknown);
    return out;
  }

  function hasClearSubmask(mask, supply, blocked) {
    let ok = false;
    supply.forEach(function (owner, id) {
      if (ok) return;
      const n = BigInt(id);
      if (n > 0n && (n & ~mask) === 0n && !blocked.has(String(owner).toLowerCase())) ok = true;
    });
    return ok;
  }

  function routeClear(route, blocked) {
    if (!route) return false;
    if (route.mints > HEART_MAX_MINTS) return false;
    if (!route.steps.length) {
      return !route.owner || !blocked.has(String(route.owner).toLowerCase());
    }
    for (let i = 0; i < route.steps.length; i++) {
      const pay = route.steps[i].payTo;
      if (blocked.has(String(pay[0]).toLowerCase()) || blocked.has(String(pay[1]).toLowerCase())) return false;
    }
    return true;
  }

  function pickBand(cands, rand, slack) {
    if (!cands.length) return null;
    cands.sort(function (a, b) {
      if (a.mints !== b.mints) return a.mints - b.mints;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    const best = cands[0].mints;
    const band = [];
    for (let i = 0; i < cands.length; i++) {
      if (cands[i].mints <= best + slack) band.push(cands[i]);
    }
    const i = Math.min(band.length - 1, Math.floor(rand() * band.length));
    return band[i];
  }

  // A heart keeps every silhouette pixel red. Margin bits vary R, G, and B
  // so the minted triple is not a fixed id. Short red routes win, then a
  // random pick among that top band.
  function pickHeart(ctx, rand) {
    if (!ctx || !ctx.supply || !ctx.supply.size) return null;
    const rng = rand || Math.random;
    const mask = maskOfHeart();
    const blocked = blockedAddrs(ctx);
    const usedR = ctx.usedR || new Set();
    const usedG = ctx.usedG || new Set();
    const usedB = ctx.usedB || new Set();
    const planCtx = {
      supply: ctx.supply,
      user: ctx.user,
      blocked: blocked,
      gasWei: ctx.gasWei == null ? 0n : ctx.gasWei,
      mode: 'fewest',
    };
    let base = null;
    if (hasClearSubmask(mask, ctx.supply, blocked)) {
      try { base = plan(mask, planCtx); } catch (e) { base = null; }
      if (!routeClear(base, blocked)) base = null;
    }
    const reds = [];
    if (base && !usedR.has(mask)) reds.push({ id: mask, mints: base.mints });
    for (let k = 0; k < 256; k++) {
      const bit = 1n << BigInt(k);
      if ((bit & mask) !== 0n) continue;
      const owner = ctx.supply.get(bit);
      if (owner === undefined || blocked.has(String(owner).toLowerCase())) continue;
      const id = mask | bit;
      if (usedR.has(id)) continue;
      if (ctx.supply.has(id)) {
        const whole = String(ctx.supply.get(id)).toLowerCase();
        if (!blocked.has(whole)) reds.push({ id: id, mints: 0 });
        continue;
      }
      if (!base) continue;
      // The extra bit does not overlap the silhouette, so the route is the
      // base pieces plus that one token: one more mint than the silhouette.
      reds.push({ id: id, mints: base.mints + 1 });
    }
    let red = null;
    while (reds.length) {
      red = pickBand(reds, rng, HEART_SLACK);
      if (!red) break;
      if (red.id === mask || ctx.supply.has(red.id)) break;
      let route = null;
      try { route = fold(base.pieces.concat([red.id ^ mask]), planCtx); } catch (e) { route = null; }
      if (route && route.target === red.id && routeClear(route, blocked)) {
        red.mints = route.mints;
        break;
      }
      const drop = red.id;
      for (let i = reds.length - 1; i >= 0; i--) if (reds[i].id === drop) reds.splice(i, 1);
      red = null;
    }
    if (!red) return null;
    const salt = red.id ^ mask;
    function channel(used, skip) {
      const cands = [];
      for (let k = 0; k < 256; k++) {
        const bit = 1n << BigInt(k);
        if ((bit & mask) !== 0n || (salt !== 0n && bit === salt)) continue;
        if (skip && skip.has(bit)) continue;
        if (used.has(bit)) continue;
        const owner = ctx.supply.get(bit);
        if (owner !== undefined) {
          if (!blocked.has(String(owner).toLowerCase())) cands.push({ id: bit, mints: 0 });
          continue;
        }
        if (k === 0) continue;
        const half = bit >> 1n;
        const ho = ctx.supply.get(half);
        if (ho !== undefined && !blocked.has(String(ho).toLowerCase())) cands.push({ id: bit, mints: 1 });
      }
      return pickBand(cands, rng, 0);
    }
    const g = channel(usedG, null);
    if (!g) return null;
    const b = channel(usedB, new Set([g.id]));
    if (!b) return null;
    const rows = planesToRows(red.id, g.id, b.id);
    return { R: red.id, G: g.id, B: b.id, rows: rows, mints: red.mints };
  }

  return {
    PAL: PAL,
    COL: COL,
    HEART_SHAPE: HEART_SHAPE,
    ROY_WEI: ROY_WEI,
    MSG_MATH: MSG_MATH,
    MSG_RGB: MSG_RGB,
    RGB_ROY: RGB_ROY,
    G_ADD: G_ADD,
    G_RGB: G_RGB,
    MAX: MAX,
    popcount: popcount,
    isPow2: isPow2,
    isPal: isPal,
    isStrobo: isStrobo,
    gridToPlanes: gridToPlanes,
    planesToRows: planesToRows,
    fold: fold,
    plan: plan,
    planWithPins: planWithPins,
    pickHeart: pickHeart,
  };
});
