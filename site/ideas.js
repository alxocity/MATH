// ideas(wallet, inv) -> up to three unsigned targets. No chain calls.
// Browser: load suggest.js, eth.js, plan.js, then this file. Node: require('./ideas').
(function (g, f) {
  const api = f(g);
  if (typeof module === 'object' && module.exports) module.exports = api;
  g.IDEAS = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (g) {
  const ZERO = '0x0000000000000000000000000000000000000000';

  function libs() {
    if (!g.PLAN && typeof require === 'function') require('./planner');
    if (!g.RULES && typeof require === 'function') require('./rules');
    if (!g.SUGGEST && typeof require === 'function') require('./suggest');
    if (!g.ABI && typeof require === 'function') require('./abi');
    if (!g.ETH && typeof require === 'function') require('./eth');
    if (!g.AGENT && typeof require === 'function') require('./plan');
    if (!g.SUGGEST || !g.ETH || !g.AGENT) throw new Error('deps');
    return { SUGGEST: g.SUGGEST, ETH: g.ETH, AGENT: g.AGENT };
  }

  function walletOf(v) {
    const s = String(v == null ? '' : v).trim().toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(s) || s === ZERO) return '';
    return s;
  }

  // Pasted text wins. Otherwise the connected account. Never the zero address.
  function signer(account, pasted) {
    const look = walletOf(pasted);
    if (look) return look;
    return walletOf(account);
  }

  function readInv(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return null;
    const row = snapshot.math && snapshot.math[0];
    if (row && !Array.isArray(row) && row.id != null) return snapshot;
    if (snapshot.blocked && typeof snapshot.blocked.has === 'function') return snapshot;
    return libs().ETH.unpack(snapshot);
  }

  function isPacked(snapshot) {
    if (!snapshot) return false;
    const row = snapshot.math && snapshot.math[0];
    if (row && Array.isArray(row)) return true;
    return Array.isArray(snapshot.owners);
  }

  function supplyMap(inv) {
    const map = new Map();
    (inv.math || []).forEach(function (t) { map.set(t.id, t.owner); });
    return map;
  }

  function usedMaps(inv) {
    const r = new Map();
    const gg = new Map();
    const b = new Map();
    (inv.rgb || []).forEach(function (t) {
      r.set(t.r, t.id);
      gg.set(t.g, t.id);
      b.set(t.b, t.id);
    });
    const word = new Map();
    const face = new Map();
    const rgb = new Map();
    const math = new Map();
    (inv.toon || []).forEach(function (t) {
      word.set(t.word, t.id);
      face.set(t.face, t.id);
      rgb.set(t.rgb, t.id);
      math.set(t.id, t.id);
    });
    return { rgbBy: { r: r, g: gg, b: b }, toonBy: { word: word, face: face, rgb: rgb, math: math } };
  }

  function heldParts(list, wallet) {
    const out = [];
    if (!list) return out;
    list.forEach(function (owner, i) {
      if (String(owner).toLowerCase() === wallet) out.push(BigInt(i));
    });
    return out;
  }

  function sentOf(plan) {
    let n = 0n;
    (plan.txs || []).forEach(function (tx) { n += BigInt(tx.value); });
    return n;
  }

  function pushPlan(out, kind, plan) {
    if (!plan || plan.exists) return;
    out.push({
      kind: kind,
      target: plan.target,
      ok: !!plan.ok,
      cost: BigInt(plan.royalty || '0'),
      sent: sentOf(plan),
      plan: plan,
    });
  }

  function ideas(wallet, snapshot) {
    const L = libs();
    const who = walletOf(wallet);
    if (!who) return [];
    const inv = readInv(snapshot);
    if (!inv || !Array.isArray(inv.math)) return [];
    const supply = supplyMap(inv);
    const blocked = inv.blocked || new Set();
    const used = usedMaps(inv);
    const owned = [];
    const ids = [];
    supply.forEach(function (owner, id) {
      ids.push(id);
      if (String(owner).toLowerCase() === who) owned.push(id);
    });
    const packed = isPacked(snapshot) ? snapshot : L.ETH.pack(inv, inv.blockedDone ? inv.blocked : null);
    const out = [];
    const pair = L.SUGGEST.mathPair({
      supply: supply,
      user: who,
      blocked: blocked,
      gasWei: 0n,
      owned: owned,
      example: false,
    }, {});
    if (pair) {
      try { pushPlan(out, 'math', L.AGENT.plan(who, (pair.a + pair.b).toString(), packed)); }
      catch (e) { /* no math */ }
    }
    const triple = L.SUGGEST.rgbTriple({
      ids: ids,
      supply: supply,
      blocked: blocked,
      by: used.rgbBy,
    }, { rand: function () { return 0; } });
    if (triple) {
      try { pushPlan(out, 'rgb', L.AGENT.plan(who, { r: triple.r, g: triple.g, b: triple.b }, packed)); }
      catch (e) { /* no rgb */ }
    }
    const rgbs = [];
    (inv.rgb || []).forEach(function (t) {
      if (String(t.owner).toLowerCase() === who) rgbs.push(t.id);
    });
    const tuple = L.SUGGEST.toonTuple({
      maths: owned,
      words: heldParts(inv.wordOwners, who),
      faces: heldParts(inv.faceOwners, who),
      rgbs: rgbs,
      used: used.toonBy,
    }, {});
    if (tuple) {
      try { pushPlan(out, 'toon', L.AGENT.plan(who, tuple, packed)); }
      catch (e) { /* no toon */ }
    }
    out.sort(function (a, b) {
      if (a.cost < b.cost) return -1;
      if (a.cost > b.cost) return 1;
      if (a.sent < b.sent) return -1;
      if (a.sent > b.sent) return 1;
      return 0;
    });
    return out.slice(0, 3);
  }

  return { ideas: ideas, walletOf: walletOf, signer: signer, ZERO: ZERO };
});
