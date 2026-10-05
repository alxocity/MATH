// AGENT.plan(wallet, target, snapshot) -> unsigned txs. No key, no send.
// Browser: load abi.js, planner.js, eth.js, then this file. Node: require('./plan').
(function (g, f) {
  const api = f(g);
  if (typeof module === 'object' && module.exports) module.exports = api;
  g.AGENT = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (g) {
  const SIGN = 'A human signs. This does not.';
  const NOTES = {
    math: SIGN + ' MATH.add value is 0.002 ETH: 0.001 to each input holder, sent with a 2300-gas transfer, so some contract wallets cannot receive it. Hold an input and that share is 0. You still pay gas.',
    rgb: SIGN + ' RGB.add value is 0.03 ETH: 0.01 to each MATH channel holder. Hold a channel, or mint it earlier in this plan, and that share is 0. You still pay gas.',
    toon: SIGN + ' TOON.add is free. It reverts unless the signer holds the MATH, WORD, FACE, and RGB. WORD and FACE owners are not in the snapshot.',
    exists: 'Already minted. Nothing to sign.',
  };

  function libs() {
    if (!g.ABI && typeof require === 'function') require('./abi');
    if (!g.PLAN && typeof require === 'function') require('./planner');
    if (!g.ETH && typeof require === 'function') require('./eth');
    if (!g.ABI || !g.PLAN || !g.ETH) throw new Error('deps');
    return { ABI: g.ABI, PLAN: g.PLAN, ETH: g.ETH };
  }

  function idOf(v) {
    const MAX = g.PLAN ? g.PLAN.MAX : ((1n << 256n) - 1n);
    if (typeof v === 'bigint') {
      if (v <= 0n || v > MAX) throw new Error('target');
      return v;
    }
    if (typeof v === 'number') {
      if (!Number.isSafeInteger(v) || v <= 0) throw new Error('target');
      return BigInt(v);
    }
    const s = String(v == null ? '' : v).trim();
    if (!/^[1-9]\d*$/.test(s) || s.length > 78) throw new Error('target');
    const n = BigInt(s);
    if (n <= 0n || n > MAX) throw new Error('target');
    return n;
  }

  function parseTarget(target) {
    if (typeof target === 'string' || typeof target === 'number' || typeof target === 'bigint') {
      return { kind: 'math', id: idOf(target) };
    }
    if (!target || typeof target !== 'object' || Array.isArray(target)) throw new Error('target');
    const rgb = target.r != null || target.g != null || target.b != null;
    const toon = target.word != null || target.face != null || target.rgb != null;
    if (rgb && toon) throw new Error('target');
    if (rgb) {
      if (target.r == null || target.g == null || target.b == null) throw new Error('target');
      return { kind: 'rgb', r: idOf(target.r), g: idOf(target.g), b: idOf(target.b) };
    }
    if (toon) {
      if (target.math == null || target.word == null || target.face == null || target.rgb == null) throw new Error('target');
      return {
        kind: 'toon',
        math: idOf(target.math),
        word: idOf(target.word),
        face: idOf(target.face),
        rgb: idOf(target.rgb),
      };
    }
    if (target.math == null) throw new Error('target');
    return { kind: 'math', id: idOf(target.math) };
  }

  function walletOf(v) {
    const s = String(v == null ? '' : v).trim().toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(s)) throw new Error('wallet');
    return s;
  }

  function readSnap(ETH, snapshot) {
    let raw = snapshot;
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch (e) { throw new Error('snapshot'); }
    }
    const inv = ETH.unpack(raw);
    if (!inv) throw new Error('snapshot');
    return inv;
  }

  function hex(wei) {
    return '0x' + BigInt(wei).toString(16);
  }

  function sortIds(set) {
    return Array.from(set).sort(function (a, b) {
      const x = BigInt(a);
      const y = BigInt(b);
      return x < y ? -1 : x > y ? 1 : 0;
    });
  }

  function holds(supply, id, wallet) {
    if (!supply.has(id)) return false;
    return String(supply.get(id)).toLowerCase() === wallet;
  }

  function share(id, holder, wei, owned) {
    return {
      id: id.toString(),
      holder: holder ? String(holder).toLowerCase() : '',
      wei: wei.toString(),
      owned: owned,
    };
  }

  function index(inv) {
    const supply = new Map();
    inv.math.forEach(function (t) { supply.set(t.id, t.owner); });
    const used = { r: new Map(), g: new Map(), b: new Map() };
    const rgbById = new Map();
    inv.rgb.forEach(function (t) {
      used.r.set(t.r, t.id);
      used.g.set(t.g, t.id);
      used.b.set(t.b, t.id);
      rgbById.set(t.id, t);
    });
    const toonBy = { math: new Map(), word: new Map(), face: new Map(), rgb: new Map() };
    inv.toon.forEach(function (t) {
      const row = { id: t.id, word: t.word, face: t.face, rgb: t.rgb };
      toonBy.math.set(t.id, row);
      toonBy.word.set(t.word, t.id);
      toonBy.face.set(t.face, t.id);
      toonBy.rgb.set(t.rgb, t.id);
    });
    return { supply: supply, used: used, rgbById: rgbById, toonBy: toonBy };
  }

  function done(inv, wallet, fields) {
    return {
      v: 1,
      ok: fields.ok,
      kind: fields.kind,
      target: fields.target,
      block: inv.block,
      wallet: wallet,
      exists: fields.exists,
      txs: fields.txs,
      royalty: fields.royalty,
      shares: fields.shares,
      owned: fields.owned,
      note: fields.note,
    };
  }

  function mathTx(ABI, ADDR, PLAN, step) {
    return {
      to: ADDR.MATH,
      data: ABI.call(ABI.SEL.add2, [step.a, step.b]),
      value: hex(PLAN.MSG_MATH),
    };
  }

  function mathShares(PLAN, step, supply, wallet, already) {
    let sum = 0n;
    const rows = [[step.a, step.payTo[0]], [step.b, step.payTo[1]]].map(function (pair) {
      const id = pair[0];
      const holder = pair[1];
      const had = holds(supply, id, wallet);
      if (had) already.add(id.toString());
      const back = holder && String(holder).toLowerCase() === wallet;
      const wei = back ? 0n : PLAN.ROY_WEI;
      sum += wei;
      return share(id, holder, wei, had);
    });
    if (sum !== step.royalty) throw new Error('royalty');
    return rows;
  }

  function ctx(supply, wallet, blocked) {
    return { supply: supply, user: wallet, blocked: blocked, gasWei: 0n, mode: 'cheapest' };
  }

  // Prefer a route that skips blocked holders. If none exists, return the reverting one.
  function routeFor(PLAN, id, supply, wallet, blocked) {
    const list = blocked && blocked.size ? blocked : new Set();
    try {
      return PLAN.plan(id, ctx(supply, wallet, list));
    } catch (e) {
      if (String(e && e.message) !== 'no route' || !list.size) throw e;
      return PLAN.plan(id, ctx(supply, wallet, new Set()));
    }
  }

  function blockedPays(steps, blocked) {
    const reasons = [];
    const seen = new Set();
    if (!blocked || !blocked.size) return reasons;
    (steps || []).forEach(function (step) {
      if (!step || step.exists) return;
      (step.payTo || []).forEach(function (holder) {
        const h = holder ? String(holder).toLowerCase() : '';
        if (!h || !blocked.has(h) || seen.has(h)) return;
        seen.add(h);
        reasons.push('Holder ' + h + ' cannot take the 2300-gas payout. The mint would revert.');
      });
    });
    return reasons;
  }

  function noteWith(inv, note, reasons) {
    let text = note;
    if (reasons.length) text += ' ' + reasons.join(' ');
    if (!inv.blockedDone) text += ' The snapshot has no payout blocklist. A named holder may still revert the 2300-gas transfer.';
    return text;
  }

  function planMath(L, inv, ix, wallet, id) {
    const target = id.toString();
    if (ix.supply.has(id)) {
      return done(inv, wallet, {
        ok: true,
        kind: 'math',
        target: target,
        exists: true,
        txs: [],
        royalty: '0',
        shares: [],
        owned: holds(ix.supply, id, wallet) ? [target] : [],
        note: NOTES.exists,
      });
    }
    const route = routeFor(L.PLAN, id, ix.supply, wallet, inv.blocked);
    const txs = [];
    const shares = [];
    const already = new Set();
    route.steps.forEach(function (step) {
      if (step.exists) return;
      txs.push(mathTx(L.ABI, L.ETH.ADDR, L.PLAN, step));
      mathShares(L.PLAN, step, ix.supply, wallet, already).forEach(function (row) { shares.push(row); });
    });
    const royalty = shares.reduce(function (sum, row) { return sum + BigInt(row.wei); }, 0n);
    const reasons = blockedPays(route.steps, inv.blocked);
    return done(inv, wallet, {
      ok: reasons.length === 0,
      kind: 'math',
      target: target,
      exists: false,
      txs: txs,
      royalty: royalty.toString(),
      shares: shares,
      owned: sortIds(already),
      note: noteWith(inv, NOTES.math, reasons),
    });
  }

  function sameImage(used, r, g, b) {
    const id = used.r.get(r);
    if (id == null) return null;
    if (used.g.get(g) === id && used.b.get(b) === id) return id;
    return null;
  }

  function planRgb(L, inv, ix, wallet, spec) {
    const r = spec.r;
    const g = spec.g;
    const b = spec.b;
    const target = r.toString() + ',' + g.toString() + ',' + b.toString();
    const image = sameImage(ix.used, r, g, b);
    if (image != null) {
      const already = new Set();
      [r, g, b].forEach(function (id) {
        if (holds(ix.supply, id, wallet)) already.add(id.toString());
      });
      return done(inv, wallet, {
        ok: true,
        kind: 'rgb',
        target: target,
        exists: true,
        txs: [],
        royalty: '0',
        shares: [],
        owned: sortIds(already),
        note: NOTES.exists,
      });
    }
    const routes = [r, g, b].map(function (n) { return routeFor(L.PLAN, n, ix.supply, wallet, inv.blocked); });
    const have = new Set(ix.supply.keys());
    const minted = new Set();
    const txs = [];
    const shares = [];
    const already = new Set();
    const mathSteps = [];
    routes.forEach(function (route) {
      route.steps.forEach(function (step) {
        if (step.exists || have.has(step.result)) {
          have.add(step.result);
          return;
        }
        mathSteps.push(step);
        txs.push(mathTx(L.ABI, L.ETH.ADDR, L.PLAN, step));
        mathShares(L.PLAN, step, ix.supply, wallet, already).forEach(function (row) { shares.push(row); });
        minted.add(step.result);
        have.add(step.result);
      });
    });
    txs.push({
      to: L.ETH.ADDR.RGB,
      data: L.ABI.call(L.ABI.SEL.add3, [r, g, b]),
      value: hex(L.PLAN.MSG_RGB),
    });
    [r, g, b].forEach(function (id) {
      const had = holds(ix.supply, id, wallet);
      const made = minted.has(id);
      if (had) already.add(id.toString());
      const holder = made ? wallet : (ix.supply.get(id) || '');
      const wei = (had || made) ? 0n : L.PLAN.RGB_ROY;
      shares.push(share(id, holder, wei, had));
    });
    const reasons = blockedPays(mathSteps, inv.blocked);
    [['Red', r, ix.used.r], ['Green', g, ix.used.g], ['Blue', b, ix.used.b]].forEach(function (part) {
      const id = part[2].get(part[1]);
      if (id != null) reasons.push(part[0] + ' already used by RGB #' + id + '.');
    });
    const royalty = shares.reduce(function (sum, row) { return sum + BigInt(row.wei); }, 0n);
    return done(inv, wallet, {
      ok: reasons.length === 0,
      kind: 'rgb',
      target: target,
      exists: false,
      txs: txs,
      royalty: royalty.toString(),
      shares: shares,
      owned: sortIds(already),
      note: noteWith(inv, NOTES.rgb, reasons),
    });
  }

  function planToon(L, inv, ix, wallet, spec) {
    const target = [spec.math, spec.word, spec.face, spec.rgb].map(function (n) { return n.toString(); }).join(',');
    const row = ix.toonBy.math.get(spec.math);
    if (row && row.word === spec.word && row.face === spec.face && row.rgb === spec.rgb) {
      const already = new Set();
      if (holds(ix.supply, spec.math, wallet)) already.add(spec.math.toString());
      const rgb = ix.rgbById.get(spec.rgb);
      if (rgb && rgb.owner.toLowerCase() === wallet) already.add(spec.rgb.toString());
      return done(inv, wallet, {
        ok: true,
        kind: 'toon',
        target: target,
        exists: true,
        txs: [],
        royalty: '0',
        shares: [],
        owned: sortIds(already),
        note: NOTES.exists,
      });
    }
    const reasons = [];
    if (row) reasons.push('This MATH already bases TOON #' + row.id + '.');
    if (ix.toonBy.word.has(spec.word)) reasons.push('word already in TOON #' + ix.toonBy.word.get(spec.word) + '.');
    if (ix.toonBy.face.has(spec.face)) reasons.push('face already in TOON #' + ix.toonBy.face.get(spec.face) + '.');
    if (ix.toonBy.rgb.has(spec.rgb)) reasons.push('rgb already in TOON #' + ix.toonBy.rgb.get(spec.rgb) + '.');
    if (!ix.supply.has(spec.math)) reasons.push('MATH #' + spec.math + ' is not in the snapshot.');
    else if (!holds(ix.supply, spec.math, wallet)) reasons.push('This address does not hold MATH #' + spec.math + '.');
    const rgb = ix.rgbById.get(spec.rgb);
    if (!rgb) reasons.push('RGB #' + spec.rgb + ' is not in the snapshot.');
    else if (rgb.owner.toLowerCase() !== wallet) reasons.push('This address does not hold RGB #' + spec.rgb + '.');
    const already = new Set();
    if (holds(ix.supply, spec.math, wallet)) already.add(spec.math.toString());
    if (rgb && rgb.owner.toLowerCase() === wallet) already.add(spec.rgb.toString());
    const shares = [
      share(spec.math, ix.supply.get(spec.math) || '', 0n, holds(ix.supply, spec.math, wallet)),
      share(spec.word, '', 0n, null),
      share(spec.face, '', 0n, null),
      share(spec.rgb, rgb ? rgb.owner : '', 0n, rgb ? rgb.owner.toLowerCase() === wallet : false),
    ];
    if (shares.some(function (row) { return row.owned === null; })) {
      reasons.push('WORD/FACE owners are not in the snapshot; confirm the signer holds them before sending.');
    }
    let note = NOTES.toon;
    if (reasons.length) note = note + ' ' + reasons.join(' ');
    return done(inv, wallet, {
      ok: reasons.length === 0,
      kind: 'toon',
      target: target,
      exists: false,
      txs: [{
        to: L.ETH.ADDR.TOON,
        data: L.ABI.call(L.ABI.SEL.add4, [spec.math, spec.word, spec.face, spec.rgb]),
        value: '0x0',
      }],
      royalty: '0',
      shares: shares,
      owned: sortIds(already),
      note: note,
    });
  }

  function plan(wallet, target, snapshot) {
    const L = libs();
    const who = walletOf(wallet);
    const spec = parseTarget(target);
    const inv = readSnap(L.ETH, snapshot);
    const ix = index(inv);
    if (spec.kind === 'math') return planMath(L, inv, ix, who, spec.id);
    if (spec.kind === 'rgb') return planRgb(L, inv, ix, who, spec);
    return planToon(L, inv, ix, who, spec);
  }

  return { plan: plan };
});
