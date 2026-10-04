(function (g, f) {
  const api = f();
  if (typeof module === 'object' && module.exports) module.exports = api;
  g.SUGGEST = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const P = globalThis.PLAN;
  const RULES = globalThis.RULES;

  function fieldFree(value, suggested) {
    const v = String(value == null ? '' : value).trim();
    if (!v) return true;
    return suggested != null && v === String(suggested);
  }

  // Zero is a blank channel until the grid is drawn, typed, or filled from a picture.
  function channelFree(value, suggested, touched) {
    const v = String(value == null ? '' : value).trim();
    if (!touched && v === '0') return true;
    return fieldFree(value, suggested);
  }

  // Connecting drops the example flag. Those numbers are still ours when they match.
  function hintFree(value, hint, own, exampleNow) {
    if (hint && hint.example !== exampleNow) {
      return String(value == null ? '' : value).trim() === String(hint.value);
    }
    return fieldFree(value, hint && own ? hint.value : null);
  }

  function asId(v) {
    if (v == null || String(v).trim() === '') return null;
    try {
      const x = BigInt(String(v).trim());
      return x > 0n ? x : null;
    } catch (e) { return null; }
  }

  function blocked(set, owner) {
    if (!set || owner == null) return false;
    return set.has(String(owner).toLowerCase());
  }

  function byId(a, b) {
    return a < b ? -1 : a > b ? 1 : 0;
  }

  // One MATH.add. Owned inputs refund both royalties, so they tie and the smallest ids win.
  function mathRoute(ctx, a, b) {
    if (a <= 0n || b <= 0n || b > P.MAX - a) return null;
    const sum = a + b;
    if (ctx.supply.has(sum) || (ctx.skip && ctx.skip.has(sum))) return null;
    const oa = ctx.supply.get(a);
    const ob = ctx.supply.get(b);
    if (oa == null || ob == null) return null;
    if (blocked(ctx.blocked, oa) || blocked(ctx.blocked, ob)) return null;
    let route;
    try { route = P.fold([a, b], ctx); } catch (e) { return null; }
    if (!route.steps.length || route.mints !== 1 || route.steps[0].exists) return null;
    return route;
  }

  let examplePool = null;

  function mathPool(ctx) {
    const ids = [];
    const seen = new Set();
    const user = String(ctx.user || '').toLowerCase();
    function add(id) {
      const x = asId(id);
      if (x == null) return;
      const k = x.toString();
      if (seen.has(k)) return;
      const owner = ctx.supply.get(x);
      if (owner == null || blocked(ctx.blocked, owner)) return;
      if (!ctx.example && String(owner).toLowerCase() !== user) return;
      seen.add(k);
      ids.push(x);
    }
    if (ctx.example) {
      const size = ctx.supply.size;
      if (examplePool && examplePool.supply === ctx.supply && examplePool.blocked === ctx.blocked && examplePool.size === size) {
        return examplePool.ids;
      }
      ctx.supply.forEach(function (owner, id) { add(id); });
      ids.sort(byId);
      examplePool = { supply: ctx.supply, blocked: ctx.blocked, size: size, ids: ids };
      return ids;
    }
    (ctx.owned || []).forEach(add);
    ids.sort(byId);
    return ids;
  }

  function mathPair(ctx, opt) {
    opt = opt || {};
    if (!ctx || !ctx.supply) return null;
    const lockA = opt.lockA != null && String(opt.lockA).trim() !== '' ? opt.lockA : null;
    const lockB = opt.lockB != null && String(opt.lockB).trim() !== '' ? opt.lockB : null;
    if (lockA != null && asId(lockA) == null) return null;
    if (lockB != null && asId(lockB) == null) return null;
    const ids = mathPool(ctx);
    const left = lockA != null ? [asId(lockA)] : ids;
    const right = lockB != null ? [asId(lockB)] : ids;
    const ordered = lockA == null && lockB == null;
    const cursor = opt.cursor;
    for (let i = 0; i < left.length; i++) {
      for (let j = 0; j < right.length; j++) {
        const a = left[i];
        const b = right[j];
        if (ordered && b < a) continue;
        if (cursor) {
          if (a < cursor.a || (a === cursor.a && b <= cursor.b)) continue;
        }
        const route = mathRoute(ctx, a, b);
        if (!route) continue;
        return { a: a, b: b, net: route.net };
      }
    }
    return null;
  }

  function mathOk(ctx, a, b) {
    const x = asId(a);
    const y = asId(b);
    if (x == null || y == null) return false;
    return !!mathRoute(ctx, x, y);
  }

  function channelIds(ctx, channel, by, lock) {
    if (lock != null && String(lock).trim() !== '' && asId(lock) == null) return [];
    const only = lock != null && String(lock).trim() !== '' ? asId(lock) : null;
    const out = [];
    const seen = new Set();
    (ctx.ids || []).forEach(function (id) {
      const x = asId(id);
      if (x == null) return;
      if (only != null && x !== only) return;
      if (ctx.skip && ctx.skip.has(x)) return;
      const owner = ctx.supply && ctx.supply.get(x);
      if (owner == null || blocked(ctx.blocked, owner)) return;
      if (RULES.rgbChannel(channel, x, by)) return;
      const k = x.toString();
      if (seen.has(k)) return;
      seen.add(k);
      out.push(x);
    });
    return out;
  }

  function rgbTriple(ctx, opt) {
    opt = opt || {};
    if (!ctx) return null;
    const by = ctx.by || {};
    const lock = opt.lock || {};
    const R = channelIds(ctx, 'r', by.r, lock.r);
    const G = channelIds(ctx, 'g', by.g, lock.g);
    const B = channelIds(ctx, 'b', by.b, lock.b);
    if (!R.length || !G.length || !B.length) return null;
    const rand = opt.rand || Math.random;
    const avoid = opt.avoid;
    function same(r, g, b) {
      return avoid && r === avoid.r && g === avoid.g && b === avoid.b;
    }
    function distinct(r, g, b) {
      return r !== g && g !== b && r !== b;
    }
    function at(list, locked, salt) {
      if (locked != null && String(locked).trim() !== '') return list[0];
      const i = (Math.floor(rand() * list.length) + salt) % list.length;
      return list[i];
    }
    let loose = null;
    for (let n = 0; n < 48; n++) {
      const r = at(R, lock.r, n);
      const g = at(G, lock.g, n);
      const b = at(B, lock.b, n);
      if (same(r, g, b)) continue;
      const row = { r: r, g: g, b: b };
      if (distinct(r, g, b)) return row;
      if (!loose) loose = row;
    }
    const cap = Math.min(64, R.length * G.length * B.length);
    let bi = 0;
    let gi = 0;
    let ri = 0;
    for (let n = 0; n < cap; n++) {
      const r = R[ri];
      const g = G[gi];
      const b = B[bi];
      if (++bi >= B.length) { bi = 0; if (++gi >= G.length) { gi = 0; ri++; } }
      if (ri >= R.length) break;
      if (same(r, g, b)) continue;
      const row = { r: r, g: g, b: b };
      if (distinct(r, g, b)) return row;
      if (!loose) loose = row;
    }
    return loose;
  }

  function partList(ids, kind, by, lock) {
    if (lock != null && String(lock).trim() !== '' && asId(lock) == null) return [];
    const only = lock != null && String(lock).trim() !== '' ? asId(lock) : null;
    const out = [];
    const seen = new Set();
    (ids || []).forEach(function (id) {
      const x = asId(id);
      if (x == null || (only != null && x !== only)) return;
      const k = x.toString();
      if (seen.has(k)) return;
      if (RULES.toonPart(kind, x, by)) return;
      seen.add(k);
      out.push(x);
    });
    out.sort(byId);
    return out;
  }

  function toonLater(row, cursor) {
    const keys = ['math', 'word', 'face', 'rgb'];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (row[k] > cursor[k]) return true;
      if (row[k] < cursor[k]) return false;
    }
    return false;
  }

  function toonTuple(ctx, opt) {
    opt = opt || {};
    if (!ctx) return null;
    const lock = opt.lock || {};
    const used = ctx.used || {};
    const maths = partList(ctx.maths, 'math', used.math, lock.math);
    const words = partList(ctx.words, 'word', used.word, lock.word);
    const faces = partList(ctx.faces, 'face', used.face, lock.face);
    const rgbs = partList(ctx.rgbs, 'rgb', used.rgb, lock.rgb);
    if (!maths.length || !words.length || !faces.length || !rgbs.length) return null;
    const cursor = opt.cursor;
    for (let m = 0; m < maths.length; m++) {
      for (let w = 0; w < words.length; w++) {
        for (let f = 0; f < faces.length; f++) {
          for (let r = 0; r < rgbs.length; r++) {
            const row = { math: maths[m], word: words[w], face: faces[f], rgb: rgbs[r] };
            if (cursor && !toonLater(row, cursor)) continue;
            return row;
          }
        }
      }
    }
    return null;
  }

  function settled(status) {
    return status === 'confirmed' || status === 'failed' || status === 'reverted';
  }

  function busyIds(rows) {
    const skip = new Set();
    function add(v) {
      const id = asId(v);
      if (id != null) skip.add(id);
    }
    (rows || []).forEach(function (row) {
      if (!row || settled(row.status)) return;
      add(row.result);
      add(row.sum);
      add(row.r);
      add(row.g);
      add(row.b);
      if (row.step) add(row.step.result);
      const label = String(row.label || '');
      const math = /^(\d+) \+ (\d+) = (\d+)$/.exec(label);
      if (math) add(math[3]);
      const rgb = /^RGB\.add (\d+), (\d+), (\d+)$/.exec(label);
      if (rgb) {
        add(rgb[1]);
        add(rgb[2]);
        add(rgb[3]);
      }
    });
    return skip;
  }

  return {
    fieldFree: fieldFree,
    channelFree: channelFree,
    hintFree: hintFree,
    busyIds: busyIds,
    mathPair: mathPair,
    mathOk: mathOk,
    rgbTriple: rgbTriple,
    toonTuple: toonTuple,
  };
});
