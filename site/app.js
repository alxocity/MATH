(function () {
  const ETH = globalThis.ETH;
  const P = globalThis.PLAN;
  const ABI = globalThis.ABI;
  const ADDR = ETH.ADDR;
  const $ = function (s) { return document.querySelector(s); };

  const state = {
    tab: 'browse',
    account: null,
    chainId: null,
    kind: 'math',
    math: [],
    rgb: [],
    toon: [],
    supply: new Map(),
    usedR: new Set(),
    usedG: new Set(),
    usedB: new Set(),
    usedWord: new Set(),
    usedFace: new Set(),
    usedRgb: new Set(),
    usedMath: new Set(),
    rgbBy: { r: new Map(), g: new Map(), b: new Map() },
    toonBy: { word: new Map(), face: new Map(), rgb: new Map(), math: new Map() },
    channels: new Map(),
    blocked: new Set(),
    unknown: new Set(),
    blockedDone: false,
    heldMath: [],
    heldRgb: [],
    heldToon: [],
    arm: null,
    toonOwn: '',
    indexState: 'loading',
    holdersReady: false,
    heartPick: null,
    block: '',
    gasPrice: 1000000000n,
    page: 0,
    filter: { q: '', popMin: '', popMax: '', pal: false, pow: false, used: 'any', sort: 'index' },
    browseDirty: false,
    rgbLock: false,
    mineKind: 'math',
    minePage: 0,
    mineDirty: false,
    mineFilter: { q: '', popMin: '', popMax: '', pal: false, pow: false, used: 'any', sort: 'index' },
    words: [],
    faces: [],
    wordText: new Map(),
    faceText: new Map(),
    snapWords: new Map(),
    snapFaces: new Map(),
    wordNote: '',
    faceNote: '',
    svgs: new Map(),
    svgGen: 0,
    grid: Array.from({ length: 16 }, function () { return 'kkkkkkkkkkkkkkkk'; }),
    sample: null,
    planes: null,
    queue: [],
    routePieces: [],
    routePinned: [],
    routeBuilt: null,
    routeTarget: '',
    batchKnown: false,
    batchCaps: null,
    batchTimed: false,
    mintQuery: null,
    toonQuery: null,
    routeMode: 'cheapest',
    txLock: null,
    preview: '',
    pendingHash: null,
    pendingOk: null,
    pendingSums: new Map(),
    planesTouched: false,
    planesDirty: false,
    mintDirty: false,
    toonDirty: false,
    routeDirty: false,
    run: null,
    runBusy: false,
    runGen: 0,
    runSend: null,
    runTick: false,
  };

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function links(kind, id) {
    const c = kind === 'rgb' ? ADDR.RGB : kind === 'toon' ? ADDR.TOON : ADDR.MATH;
    const n = id.toString();
    return '<a class="out" href="https://opensea.io/item/ethereum/' + c + '/' + n + '" target="_blank" rel="noopener noreferrer">opensea</a>' +
      '<a class="out" href="https://etherscan.io/nft/' + c + '/' + n + '" target="_blank" rel="noopener noreferrer">etherscan</a>';
  }

  const TIPS = {
    blocked: "can't receive the 0.001 ETH payout. MATH (2019) pays with transfer's 2300 gas. some contract wallets need more, so their MATH is not an input and the plan routes around them.",
    unchecked: "the payout check couldn't reach a node. holder not confirmed. simulate before sending.",
    planes: 'lit pixels per channel. a bit count, not the token id.',
    fees: 'MATH add is 0.002 ETH, 0.001 to each input owner. RGB is 0.03 ETH, 0.01 to each channel owner. TOON is free. Not a cut for this site. Hold the input and that share comes back. You still pay gas.',
    used: 'used as R, G, or B. each MATH id once per channel, ever.',
    simulate: 'dry run via eth_call. no gas, nothing signed. with no wallet it runs from a placeholder address.',
    mints: 'planned steps to build the target from existing tokens.',
  };

  let tipSeq = 0;

  function mark(glyph, label) {
    const t = esc(label);
    const id = 't' + (++tipSeq);
    return '<span class="mark"><button type="button" class="mark-hit" aria-label="info" aria-describedby="' + id + '">' + glyph +
      '</button><span class="tip" id="' + id + '" role="tooltip">' + t + '</span></span>';
  }

  function lead(text, tipKey) {
    return '<p class="dim">' + esc(text) + (tipKey ? mark('ⓘ', TIPS[tipKey]) : '') + '</p>';
  }

  function rememberQuery(patch) {
    if (!globalThis.QUERY) return false;
    try { QUERY.writeStore(localStorage, patch); }
    catch (e) { /* storage can throw; the URL write still runs */ }
    let next;
    try {
      next = QUERY.href({
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      }, patch);
    } catch (e) { return false; }
    const cur = location.pathname + location.search + location.hash;
    if (next === cur) return true;
    try { history.replaceState(null, '', next); }
    catch (e) { return false; }
    try {
      if (location.search === QUERY.hrefSearch(next)) QUERY.writeMark(sessionStorage, next);
    } catch (e) { /* private mode, or replaceState left the address bar unchanged */ }
    return true;
  }

  function livePatch() {
    const r = $('#pR');
    const g = $('#pG');
    const bch = $('#pB');
    const tm = $('#tm');
    return QUERY.livePatch({
      mintOpen: !!($('#a') && $('#b')),
      a: $('#a') && $('#a').value,
      b: $('#b') && $('#b').value,
      mint: state.mintQuery,
      mintDirty: state.mintDirty,
      routeOpen: !!$('#target'),
      n: $('#target') && $('#target').value.trim(),
      routeTarget: state.routeTarget,
      routeDirty: state.routeDirty,
      planesDirty: state.planesDirty,
      rgbInputs: (r && g && bch) ? { R: r.value, G: g.value, B: bch.value } : null,
      planes: state.planes ? {
        R: state.planes.R.toString(),
        G: state.planes.G.toString(),
        B: state.planes.B.toString(),
      } : null,
      toonOpen: !!(tm && $('#tw') && $('#tf') && $('#tr')),
      toonInputs: tm ? {
        math: tm.value,
        word: $('#tw').value,
        face: $('#tf').value,
        rgb: $('#tr').value,
      } : null,
      toon: state.toonQuery,
      toonDirty: state.toonDirty,
    });
  }

  function persistLive() {
    if (!globalThis.QUERY) return;
    try {
      const patch = livePatch();
      if (!Object.keys(patch).length) return;
      QUERY.writeStore(localStorage, patch);
    } catch (e) { /* private mode */ }
  }

  const INTRO_KEY = 'math.intro.v1';

  function introOff() {
    try { return localStorage.getItem(INTRO_KEY) === '1'; }
    catch (e) { return false; }
  }

  function paintIntro() {
    const el = $('#intro');
    if (!el) return;
    el.hidden = introOff();
    const btn = $('#introDismiss');
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', function () {
        try { localStorage.setItem(INTRO_KEY, '1'); } catch (e) { /* ignore */ }
        el.hidden = true;
      });
    }
  }

  function applyQuery() {
    if (!globalThis.QUERY) return;
    let mark = '';
    try { mark = QUERY.readMark(sessionStorage); }
    catch (e) { mark = ''; }
    const marked = QUERY.markedOpen(location.search, mark);
    let stored = null;
    try { stored = QUERY.readStore(localStorage); }
    catch (e) { stored = null; }
    const restored = QUERY.restoreBag(location.search, stored, location.hash);
    const v = restored.values;
    bootLocked = marked ? false : !!restored.locked;
    Object.keys(openedGroup).forEach(function (key) { delete openedGroup[key]; });
    if (marked) {
      const sources = restored.sources || {};
      Object.keys(sources).forEach(function (name) {
        if (sources[name] === 'url') openedGroup[name] = true;
      });
    } else if (!bootLocked && restored.group) openedGroup[restored.group] = true;
    state.mintQuery = { a: v.a, b: v.b };
    state.toonQuery = { math: v.math, word: v.word, face: v.face, rgb: v.rgb };
    if (v.n) state.routeTarget = v.n;
    state.mintDirty = false;
    state.toonDirty = false;
    state.routeDirty = false;
    state.planesDirty = false;
    state.planesTouched = false;
    state.rgbLock = QUERY.pickLock(v.lock, stored && stored.lock, bootLocked);
    applyList('browse', v);
    applyList('mine', v);
    if (QUERY.hasPlanes(v)) {
      try {
        const R = v.R !== '' ? BigInt(v.R) : 0n;
        const G = v.G !== '' ? BigInt(v.G) : 0n;
        const B = v.B !== '' ? BigInt(v.B) : 0n;
        state.planes = { R: R, G: G, B: B };
        state.grid = P.planesToRows(R, G, B);
        state.planesTouched = QUERY.fullPlanes(v);
        state.planesDirty = false;
      } catch (e) { /* leave the grid */ }
    }
  }

  function bindTips() {
    document.addEventListener('click', function (ev) {
      const hit = ev.target.closest('.mark-hit');
      if (!hit) return;
      ev.preventDefault();
      ev.stopPropagation();
      const markEl = hit.closest('.mark');
      document.querySelectorAll('.mark.open').forEach(function (el) {
        if (el !== markEl) el.classList.remove('open');
      });
      markEl.classList.toggle('open');
      if (!markEl.classList.contains('open')) hit.blur();
    }, true);
    document.addEventListener('click', function (ev) {
      if (ev.target.closest('.mark')) return;
      document.querySelectorAll('.mark.open').forEach(function (el) { el.classList.remove('open'); });
      const ae = document.activeElement;
      if (ae && ae.classList && ae.classList.contains('mark-hit')) ae.blur();
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      document.querySelectorAll('.mark.open').forEach(function (el) { el.classList.remove('open'); });
      const ae = document.activeElement;
      if (ae && ae.classList && ae.classList.contains('mark-hit')) ae.blur();
    });
  }

  function fmt(wei) {
    const neg = wei < 0n;
    const v = neg ? -wei : wei;
    const whole = v / (10n ** 18n);
    const frac = (v % (10n ** 18n)).toString().padStart(18, '0').replace(/0+$/, '');
    return (neg ? '-' : '') + whole.toString() + (frac ? '.' + frac : '');
  }

  function hex(wei) { return '0x' + wei.toString(16); }

  function short(a) {
    if (!a) return '';
    return a.slice(0, 6) + '…' + a.slice(-4);
  }

  function contractLink(addr) {
    const name = ENS.contractLabel(addr);
    const title = name ? ' title="' + esc(short(addr)) + '"' : '';
    const text = name || addr;
    return '<a href="https://etherscan.io/address/' + esc(addr) + '"' + title + ' target="_blank" rel="noopener noreferrer">' + esc(text) + '</a>';
  }

  function paintContractNames() {
    let host = $('#contracts');
    if (!host) {
      host = document.createElement('span');
      host.id = 'contracts';
      const tile = $('#tile');
      if (tile && tile.parentNode) tile.parentNode.insertBefore(host, tile);
    }
    host.innerHTML = ENS.contractNames(ADDR).map(function (row) {
      return contractLink(row[1]);
    }).join(' · ');
  }

  function addr(a) {
    const n = ENS.normAddr(a);
    if (!n) return esc(short(a));
    ENS.want(n);
    const text = ENS.cached(n) || short(n);
    return '<button type="button" class="addr" data-addr="' + n + '" data-label="' + esc(text) + '">' + esc(text) + '</button>';
  }

  function paintWho() {
    const who = $('#who');
    if (!who) return;
    if (!state.account) { who.textContent = ''; return; }
    who.innerHTML = addr(state.account);
    ENS.flush(paintWho);
  }

  function syncMine() {
    const b = document.querySelector('[data-tab="mine"]');
    if (b) b.hidden = !state.account;
    if (!state.account && state.tab === 'mine') show('browse');
  }

  function me() {
    return state.account ? state.account.toLowerCase() : '0x0000000000000000000000000000000000000000';
  }

  function ctx() {
    return {
      supply: state.supply,
      user: me(),
      blocked: state.blocked,
      unknown: state.unknown,
      gasWei: P.G_ADD * state.gasPrice,
      mode: state.routeMode,
    };
  }

  function setStatus(t, hint) {
    const el = $('#status');
    if (!el) return;
    if (!t) { el.textContent = ''; return; }
    if (!hint) { el.textContent = t; return; }
    el.innerHTML = esc(t) + mark('ⓘ', hint);
  }

  function onChain(id) {
    state.chainId = id;
    const el = $('#status');
    if (id !== '0x1') setStatus('wrong network');
    else if (el && el.textContent === 'wrong network') setStatus('');
  }

  function indexInventory(inv) {
    state.math = inv.math;
    state.rgb = inv.rgb;
    state.toon = inv.toon;
    state.block = inv.block || '';
    state.supply = new Map();
    state.math.forEach(function (t) { state.supply.set(t.id, t.owner); });
    state.usedR = new Set();
    state.usedG = new Set();
    state.usedB = new Set();
    state.rgbBy = { r: new Map(), g: new Map(), b: new Map() };
    state.channels = new Map();
    state.rgb.forEach(function (t) {
      state.usedR.add(t.r);
      state.usedG.add(t.g);
      state.usedB.add(t.b);
      state.rgbBy.r.set(t.r, t.id);
      state.rgbBy.g.set(t.g, t.id);
      state.rgbBy.b.set(t.b, t.id);
      ['r', 'g', 'b'].forEach(function (ch) {
        const id = t[ch];
        if (!state.channels.has(id)) state.channels.set(id, new Set());
        state.channels.get(id).add(ch);
      });
    });
    state.usedWord = new Set();
    state.usedFace = new Set();
    state.usedRgb = new Set();
    state.usedMath = new Set();
    state.toonBy = { word: new Map(), face: new Map(), rgb: new Map(), math: new Map() };
    state.toon.forEach(function (t) {
      state.usedWord.add(t.word);
      state.usedFace.add(t.face);
      state.usedRgb.add(t.rgb);
      state.usedMath.add(t.id);
      state.toonBy.word.set(t.word, t.id);
      state.toonBy.face.set(t.face, t.id);
      state.toonBy.rgb.set(t.rgb, t.id);
      state.toonBy.math.set(t.id, t.id);
    });
    state.wordText = inv.words || new Map();
    state.faceText = inv.faces || new Map();
    state.inventory = inv;
    state.unknown = new Set();
    if (inv.blocked) state.blocked = inv.blocked;
    if (inv.blockedDone) state.blockedDone = true;
    reapplyPending();
  }

  function persistTexts() {
    state.snapWords.forEach(function (text, id) { state.wordText.set(id, text); });
    state.snapFaces.forEach(function (text, id) { state.faceText.set(id, text); });
    const cached = ETH.readCache();
    if (!cached) return;
    state.wordText.forEach(function (text, id) { cached.words.set(id, text); });
    state.faceText.forEach(function (text, id) { cached.faces.set(id, text); });
    ETH.writeCache(cached, cached.blockedDone ? cached.blocked : null);
  }

  function mineCount() {
    if (!state.account) return 0;
    const m = me();
    let n = 0;
    state.math.forEach(function (t) { if (t.owner === m) n++; });
    return n;
  }

  function bitHtml(n) {
    const x = BigInt(n);
    let html = '<span class="bits">';
    for (let i = 0; i < 256; i++) {
      const on = (x >> (255n - BigInt(i))) & 1n;
      html += on ? '<i class="on"></i>' : '<i></i>';
    }
    return html + '</span>';
  }

  function cellsHtml(rows) {
    let html = '<span class="cells">';
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const ch = rows[y][x];
        html += '<button type="button" class="' + ch + '" data-i="' + (y * 16 + x) + '"></button>';
      }
    }
    return html + '</span>';
  }

  function svgUrl(xml) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  }

  function mathTx(a, b) {
    return {
      from: state.account,
      to: ADDR.MATH,
      data: ABI.call(ABI.SEL.add2, [a, b]),
      value: hex(P.MSG_MATH),
    };
  }

  async function guardSend(fn) {
    if (state.txLock) {
      MOLD.say('wait');
      return;
    }
    if (!state.account) {
      MOLD.say('noWallet');
      return;
    }
    try {
      await ETH.ensureChain();
      await fn();
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      if (e && e.code === 4001) MOLD.say('rejected');
      else MOLD.say('simFail', { err: msg });
      const box = $('#preview');
      if (box) box.textContent = (state.preview ? state.preview + '\n' : '') + msg;
    }
  }

  const RUN_KEY = 'math.run.v1';
  const TX_KEY = 'math.tx.v1';

  function clip(msg) {
    const s = String(msg || 'failed').replace(/\s+/g, ' ').trim();
    return s.length > 160 ? s.slice(0, 160) : s;
  }

  function savePending(hash) {
    try {
      if (hash) sessionStorage.setItem(TX_KEY, hash);
      else sessionStorage.removeItem(TX_KEY);
    } catch (e) { /* ignore */ }
  }

  function loadPending() {
    try { return sessionStorage.getItem(TX_KEY) || ''; } catch (e) { return ''; }
  }

  function paintPending() {
    const old = $('#pending');
    if (old) old.remove();
    const hash = state.pendingHash;
    if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) return;
    const box = $('#preview');
    if (!box || !box.parentNode) return;
    const el = document.createElement('div');
    el.id = 'pending';
    el.className = 'run';
    el.innerHTML = 'submitted <a href="https://etherscan.io/tx/' + hash + '" target="_blank" rel="noopener noreferrer">tx</a> <button type="button" id="checkTx">check</button>';
    box.parentNode.insertBefore(el, box.nextSibling);
    const btn = $('#checkTx');
    if (btn) btn.onclick = function () { checkPending(); };
  }

  function finishWatch(hash, rec, onOk) {
    globalThis.RUN.clearHashLock(state, hash);
    syncNote(state.run);
    if (SITE.paintLock) SITE.paintLock();
    state.pendingHash = null;
    state.pendingOk = null;
    if (state.pendingSums) state.pendingSums.delete(hash);
    saveSums();
    savePending('');
    const ok = globalThis.RUN.receiptOk(rec.status);
    MOLD.say('mined', { status: ok ? 'ok' : 'reverted' });
    if (ok && onOk) onOk();
    const box = $('#preview');
    if (box) box.textContent += '\n' + (ok ? 'confirmed' : 'failed reverted');
    paintPending();
  }

  async function checkPending() {
    const hash = state.pendingHash;
    if (!hash) return;
    let rec = null;
    try { rec = await ETH.receipt(hash); } catch (e) {
      MOLD.say('simFail', { err: clip(e.message || e) });
      return;
    }
    if (!rec) {
      MOLD.say('wait');
      return;
    }
    finishWatch(hash, rec, state.pendingOk);
  }

  function noteSent(hash, onOk) {
    state.txLock = hash;
    syncNote(state.run);
    if (SITE.paintLock) SITE.paintLock();
    state.pendingHash = hash;
    state.pendingOk = onOk || null;
    savePending(hash);
    MOLD.say('sent', { hash: short(hash) });
    const box = $('#preview');
    if (box) box.textContent = (state.preview || '') + '\nsubmitted ' + hash;
    paintPending();
    watch(hash, onOk);
  }

  async function watch(hash, onOk) {
    for (let i = 0; i < 30; i++) {
      await new Promise(function (r) { setTimeout(r, 4000); });
      if (state.txLock !== hash) return;
      let rec = null;
      try { rec = await ETH.receipt(hash); } catch (e) { rec = null; }
      if (!rec) continue;
      finishWatch(hash, rec, onOk);
      return;
    }
    if (state.txLock !== hash) return;
    globalThis.RUN.clearHashLock(state, hash);
    syncNote(state.run);
    if (SITE.paintLock) SITE.paintLock();
    state.pendingHash = hash;
    state.pendingOk = onOk || null;
    savePending(hash);
    MOLD.say('wait');
    const box = $('#preview');
    if (box) box.textContent += '\nstill pending';
    paintPending();
  }

  function readRunStore() {
    try {
      const raw = sessionStorage.getItem(RUN_KEY);
      const j = raw ? JSON.parse(raw) : null;
      if (!j || typeof j !== 'object') return { steps: [], sums: {} };
      return {
        steps: Array.isArray(j.steps) ? j.steps : [],
        sums: j.sums && typeof j.sums === 'object' && !Array.isArray(j.sums) ? j.sums : {},
      };
    } catch (e) { return { steps: [], sums: {} }; }
  }

  function readRun() {
    return readRunStore().steps;
  }

  function writeRunStore(steps, sums) {
    try {
      sessionStorage.setItem(RUN_KEY, JSON.stringify({ steps: steps, sums: sums || {} }));
    } catch (e) { /* ignore */ }
  }

  function saveRun(steps) {
    const cur = readRunStore();
    writeRunStore((steps || []).map(function (s) {
      return {
        label: s.label,
        status: s.status || 'pending',
        hash: s.hash || '',
        calls: s.calls || '',
        error: s.error || '',
      };
    }), cur.sums);
  }

  function freshSum(entry, hash, now) {
    const row = globalThis.SUGGEST.sumEntry(hash, entry, now);
    if (!row && state.pendingSums) state.pendingSums.delete(hash);
    return row;
  }

  function sumsObj() {
    const sums = {};
    const now = Date.now();
    if (state.pendingSums) state.pendingSums.forEach(function (entry, hash) {
      const row = freshSum(entry, hash, now);
      if (row) sums[hash] = row.id.toString();
    });
    return sums;
  }

  function saveSums() {
    const cur = readRunStore();
    const sums = {};
    const now = Date.now();
    if (state.pendingSums) state.pendingSums.forEach(function (entry, hash) {
      const row = freshSum(entry, hash, now);
      if (row) sums[hash] = { id: row.id.toString(), at: row.at };
    });
    writeRunStore(cur.steps, sums);
  }

  function loadSums() {
    const saved = readRunStore();
    const now = Date.now();
    Object.keys(saved.sums).forEach(function (hash) {
      const row = globalThis.SUGGEST.sumEntry(hash, saved.sums[hash], now);
      if (row) state.pendingSums.set(hash, { id: row.id, at: row.at });
    });
  }

  function rememberSum(hash, id) {
    if (!state.pendingSums || !hash || id == null) return;
    const now = Date.now();
    const row = globalThis.SUGGEST.sumEntry(hash, { id: String(id), at: now }, now);
    if (!row) return;
    state.pendingSums.set(hash, { id: row.id, at: row.at });
    saveSums();
  }

  function noteState() {
    return {
      account: state.account,
      hasWallet: !!globalThis.ethereum,
      batchKnown: state.batchKnown,
      batchTimed: state.batchTimed,
      batchCaps: state.batchCaps,
      runBusy: state.runBusy,
      txLock: state.txLock,
    };
  }

  function syncNote(steps) {
    const btn = $('#sendBatch');
    if (!btn) return;
    const note = $('#batchNote');
    const whyEl = $('#batchWhy');
    const why = globalThis.RUN.noteWhy(steps, noteState());
    if (note) note.hidden = !!why;
    if (whyEl) whyEl.textContent = why;
    btn.disabled = !!why;
  }

  function releaseRun(gen) {
    const released = globalThis.RUN.releaseRun(gen, state, function () {
      syncNote(state.run);
      if (SITE.paintLock) SITE.paintLock();
    });
    if (released && state.mintRefresh) {
      state.mintRefresh = false;
      return refreshChain();
    }
    return Promise.resolve(released);
  }

  function showBatchWhy(why) {
    const btn = $('#sendBatch');
    const whyEl = $('#batchWhy');
    if (btn && whyEl) whyEl.textContent = why;
    if (btn) btn.disabled = true;
    const note = $('#batchNote');
    if (note) note.hidden = true;
    const box = $('#preview');
    if (box) box.textContent = why;
    state.preview = why;
  }

  async function probeBatch() {
    if (!globalThis.ethereum || !state.account) {
      state.batchCaps = null;
      state.batchKnown = false;
      state.batchTimed = false;
      syncNote(state.run);
      return;
    }
    const who = state.account;
    state.batchKnown = false;
    state.batchTimed = false;
    syncNote(state.run);
    let caps = null;
    let timed = false;
    try {
      caps = await withTimeout(ethereum.request({
        method: 'wallet_getCapabilities',
        params: [who],
      }), 8000);
    } catch (e) {
      caps = null;
      timed = !!(e && e.message === 'timeout');
    }
    if (who !== state.account) return;
    state.batchCaps = caps;
    state.batchTimed = timed;
    state.batchKnown = true;
    syncNote(state.run);
  }

  function paintRun() {
    const host = $('#run');
    if (!host) return;
    const rows = state.run || [];
    if (!rows.length) {
      host.innerHTML = '';
      decoratePlan([]);
      if (SITE.paintLock) SITE.paintLock();
      return;
    }
    const count = globalThis.RUN.runCount(rows);
    host.innerHTML = '<p class="dim" id="runCount">' + esc(count.text) + '</p>' + rows.map(function (s, i) {
      const hash = s.hash && /^0x[0-9a-fA-F]{64}$/.test(s.hash)
        ? ' <a href="https://etherscan.io/tx/' + s.hash + '" target="_blank" rel="noopener noreferrer">tx</a>'
        : '';
      const err = (s.status === 'failed' || globalThis.RUN.isUnknown(s.status)) && s.error
        ? ' <span class="bad">' + esc(s.error) + '</span>' : '';
      let btn = '';
      if (s.status === 'failed') btn = ' <button type="button" data-retry="1">resume</button>';
      else if (globalThis.RUN.isUnknown(s.status)) {
        btn = ' <button type="button" data-check="1">check</button>';
        if (s.chain !== false) btn += ' <button type="button" data-clear="' + i + '">clear</button>';
      } else if (s.status === 'submitted') btn = ' <button type="button" data-check="1">check</button>';
      const label = globalThis.TOKEN.labelHtml(s.label) || esc(s.label);
      const cls = s.status === 'confirmed' ? ' done' : s.status === 'failed' ? ' failed' : (s.status === 'submitted' || s.status === 'signing') ? ' now' : '';
      return '<div class="run' + cls + '">' + (i + 1) + '/' + rows.length + ' ' + esc(s.status || 'pending') + ' ' + label + hash + err + btn + '</div>';
    }).join('');
    host.querySelectorAll('[data-retry]').forEach(function (b) {
      b.onclick = function () { if (state.runSend) state.runSend(); };
    });
    host.querySelectorAll('[data-check]').forEach(function (b) {
      b.onclick = function () {
        state.runTick = true;
        checkSubmitted().catch(function () {});
      };
    });
    host.querySelectorAll('[data-clear]').forEach(function (b) {
      b.onclick = function () { clearUnknown(rows[Number(b.dataset.clear)]).catch(function () {}); };
    });
    decoratePlan(rows);
    if (SITE.paintLock) SITE.paintLock();
  }

  function decoratePlan(rows) {
    const list = rows || [];
    const prog = globalThis.RUN.progressSummary(list);
    const sum = document.querySelector('#planSum');
    if (sum) {
      sum.setAttribute('role', 'status');
      sum.innerHTML = '';
      if (list.length && prog.focus >= 0 && list[prog.focus]) {
        const id = globalThis.RUN.stepId(list[prog.focus].label);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'plan-jump';
        btn.textContent = prog.text;
        btn.onclick = function (ev) {
          if (ev && ev.preventDefault) ev.preventDefault();
          const el = document.getElementById(id);
          if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center' });
        };
        sum.appendChild(btn);
      } else if (list.length) sum.textContent = prog.text;
    }
    let nodes = [];
    try { nodes = document.querySelectorAll('[data-plan]'); }
    catch (e) { nodes = []; }
    Array.prototype.forEach.call(nodes, function (el) {
      const hit = list.find(function (s) { return s && s.label === el.getAttribute('data-plan'); });
      el.classList.remove('done', 'failed', 'now');
      const old = el.querySelector('.plan-status');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      if (!hit) return;
      const cls = globalThis.RUN.stepClass(hit.status);
      if (cls) el.classList.add(cls);
      const bits = [];
      if (hit.hash && /^0x[0-9a-fA-F]{64}$/.test(hit.hash)) {
        bits.push('<a href="https://etherscan.io/tx/' + hit.hash + '" target="_blank" rel="noopener noreferrer">tx</a>');
      }
      if ((hit.status === 'failed' || globalThis.RUN.isUnknown(hit.status)) && hit.error) {
        bits.push('<span class="bad">' + esc(hit.error) + '</span>');
      }
      if (hit.status === 'failed') bits.push('<button type="button" data-retry="1">resume</button>');
      else if (hit.status === 'submitted' || globalThis.RUN.isUnknown(hit.status)) {
        bits.push('<button type="button" data-check="1">check</button>');
      }
      if (!bits.length) return;
      const note = document.createElement('div');
      note.className = 'plan-status';
      note.innerHTML = bits.join(' ');
      el.appendChild(note);
      const retry = note.querySelector('[data-retry]');
      if (retry) retry.onclick = function () { if (state.runSend) state.runSend(); };
      const check = note.querySelector('[data-check]');
      if (check) check.onclick = function () {
        state.runTick = true;
        checkSubmitted().catch(function () {});
      };
    });
  }

  function markStep(step, patch) {
    if (!step) return;
    Object.keys(patch).forEach(function (k) { step[k] = patch[k]; });
    const row = (state.run || []).find(function (s) { return s.label === step.label; });
    if (row && row !== step) Object.keys(patch).forEach(function (k) { row[k] = patch[k]; });
    paintRun();
    saveRun(state.run);
    syncNote(state.run);
  }

  function asId(v) {
    if (typeof v === 'bigint') return v >= 0n ? v : null;
    if (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0) return BigInt(v);
    if (typeof v === 'string' && /^(0|[1-9]\d*)$/.test(v) && v.length <= 78) {
      try { return BigInt(v); } catch (e) { return null; }
    }
    return null;
  }

  function normOwner(owner) {
    const a = String(owner || '').toLowerCase();
    if (/^0x[0-9a-f]{40}$/.test(a) && !/^0x0{40}$/.test(a)) return a;
    return '';
  }

  function pickOwner(owner) {
    return normOwner(owner) || me();
  }

  function findRow(list, id) {
    const s = id.toString();
    for (let i = 0; i < list.length; i++) {
      if (list[i] && list[i].id != null && list[i].id.toString() === s) return list[i];
    }
    return null;
  }

  function rememberHeld(list, id, owner) {
    if (!state.account || owner !== state.account.toLowerCase()) return;
    const s = id.toString();
    if (list.some(function (x) { return x != null && x.toString() === s; })) return;
    list.push(id);
  }

  function detach(kind) {
    if (state.inventory && state.inventory[kind] === state[kind]) state[kind] = state[kind].slice();
  }

  function noteMath(id, owner) {
    const n = asId(id);
    if (n == null) return;
    const who = pickOwner(owner);
    state.supply.set(n, who);
    const row = findRow(state.math, n);
    if (row) row.owner = who;
    else {
      detach('math');
      state.math.push({ id: n, owner: who });
    }
    rememberHeld(state.heldMath, n, who);
  }

  function indexRgbChannels(row) {
    state.usedR.add(row.r);
    state.usedG.add(row.g);
    state.usedB.add(row.b);
    state.rgbBy.r.set(row.r, row.id);
    state.rgbBy.g.set(row.g, row.id);
    state.rgbBy.b.set(row.b, row.id);
    ['r', 'g', 'b'].forEach(function (ch) {
      const cid = row[ch];
      if (!state.channels.has(cid)) state.channels.set(cid, new Set());
      state.channels.get(cid).add(ch);
    });
  }

  function dropPending(r, g, b) {
    state.pendingRgb = (state.pendingRgb || []).filter(function (p) {
      return !(p.r === r && p.g === g && p.b === b);
    });
  }

  function channelBusy(r, g, b) {
    if (state.rgbBy.r.has(r) || state.rgbBy.g.has(g) || state.rgbBy.b.has(b)) return true;
    return (state.pendingRgb || []).some(function (p) {
      if (p.r === r && p.g === g && p.b === b) return false;
      return p.r === r || p.g === g || p.b === b;
    });
  }

  function reapplyPending() {
    const left = [];
    (state.pendingRgb || []).forEach(function (p) {
      const have = state.rgb.some(function (t) {
        return t && t.r != null && t.g != null && t.b != null && t.r.toString() === p.r.toString() && t.g.toString() === p.g.toString() && t.b.toString() === p.b.toString();
      });
      if (have) return;
      state.usedR.add(p.r);
      state.usedG.add(p.g);
      state.usedB.add(p.b);
      left.push(p);
    });
    state.pendingRgb = left;
  }

  function refreshChain() {
    if (state.runBusy || state.txLock) {
      state.mintRefresh = true;
      return Promise.resolve();
    }
    if (typeof ETH.loadDelta !== 'function') return Promise.resolve();
    return refresh().then(function () { return loadHeld(); }, function () { return null; });
  }

  // A real RGB id comes from the mint Transfer. Without one, the channels are
  // marked used and the chain refresh fills the row. Guessing totalSupply+1
  // would put someone else's token in the held list.
  function noteRgb(r, g, b, owner, id) {
    const rr = asId(r);
    const gg = asId(g);
    const bb = asId(b);
    if (rr == null || gg == null || bb == null) return;
    const who = pickOwner(owner);
    const token = asId(id);
    let row = null;
    for (let i = 0; i < state.rgb.length; i++) {
      const t = state.rgb[i];
      if (t && t.r != null && t.g != null && t.b != null && t.r.toString() === rr.toString() && t.g.toString() === gg.toString() && t.b.toString() === bb.toString()) {
        row = t;
        break;
      }
    }
    if (row) {
      if (token != null && token > 0n && row.id !== token) {
        refreshChain();
        return;
      }
      row.owner = who;
      indexRgbChannels(row);
      rememberHeld(state.heldRgb, row.id, who);
      dropPending(rr, gg, bb);
      return;
    }
    if (channelBusy(rr, gg, bb)) return;
    state.usedR.add(rr);
    state.usedG.add(gg);
    state.usedB.add(bb);
    if (token == null || token <= 0n) {
      state.pendingRgb = state.pendingRgb || [];
      state.pendingRgb.push({ r: rr, g: gg, b: bb });
      refreshChain();
      return;
    }
    if (findRow(state.rgb, token)) {
      refreshChain();
      return;
    }
    detach('rgb');
    row = { id: token, owner: who, r: rr, g: gg, b: bb };
    state.rgb.push(row);
    indexRgbChannels(row);
    rememberHeld(state.heldRgb, token, who);
    dropPending(rr, gg, bb);
  }

  function noteToon(spec, owner) {
    const math = asId(spec.math != null ? spec.math : spec.id);
    const word = asId(spec.word);
    const face = asId(spec.face);
    const rgb = asId(spec.rgb);
    if (math == null || word == null || face == null || rgb == null) return;
    const who = pickOwner(owner);
    let row = findRow(state.toon, math);
    if (row) {
      row.owner = who;
      row.word = word;
      row.face = face;
      row.rgb = rgb;
    } else {
      detach('toon');
      row = { id: math, owner: who, word: word, face: face, rgb: rgb };
      state.toon.push(row);
    }
    state.usedWord.add(word);
    state.usedFace.add(face);
    state.usedRgb.add(rgb);
    state.usedMath.add(math);
    state.toonBy.word.set(word, math);
    state.toonBy.face.set(face, math);
    state.toonBy.rgb.set(rgb, math);
    state.toonBy.math.set(math, math);
    rememberHeld(state.heldToon, math, who);
  }

  function paintHeld() {
    const tab = state.tab;
    if (tab !== 'browse' && tab !== 'mine' && tab !== 'toon' && tab !== 'token') return;
    const view = $('#view');
    if (!view || typeof SITE[tab] !== 'function') return;
    const scroller = document.scrollingElement || document.documentElement;
    const top = scroller && typeof scroller.scrollTop === 'number' ? scroller.scrollTop : 0;
    const left = scroller && typeof scroller.scrollLeft === 'number' ? scroller.scrollLeft : 0;
    const ae = document.activeElement;
    const focusId = ae && ae.id;
    const selStart = ae && typeof ae.selectionStart === 'number' ? ae.selectionStart : null;
    const selEnd = ae && typeof ae.selectionEnd === 'number' ? ae.selectionEnd : null;
    try { SITE[tab](view); }
    catch (e) { return; }
    if (scroller) {
      scroller.scrollTop = top;
      scroller.scrollLeft = left;
    }
    if (focusId) {
      const el = document.getElementById(focusId);
      if (el && el.focus) {
        try { el.focus(); } catch (err) { /* the node was replaced */ }
      }
      if (el && selStart != null && selEnd != null && el.setSelectionRange) {
        try { el.setSelectionRange(selStart, selEnd); } catch (err) { /* ignore */ }
      }
    }
  }

  function takeId(s) {
    if (!/^(0|[1-9]\d*)$/.test(s) || s.length > 78) return null;
    try { return BigInt(s); } catch (e) { return null; }
  }

  function fillStep(step) {
    if (!step || step.result != null || (step.r != null && step.g != null && step.b != null)) return;
    const label = String(step.label || '');
    const math = /^(\d+) \+ (\d+) = (\d+)$/.exec(label);
    if (math) {
      const n = takeId(math[3]);
      if (n != null) step.result = n;
      return;
    }
    const rgb = /^RGB\.add (\d+), (\d+), (\d+)$/.exec(label);
    if (!rgb) return;
    const r = takeId(rgb[1]);
    const g = takeId(rgb[2]);
    const b = takeId(rgb[3]);
    if (r == null || g == null || b == null) return;
    step.r = r;
    step.g = g;
    step.b = b;
  }

  const RGB_TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

  function topicAddr(topic) {
    const h = String(topic || '').toLowerCase().replace(/^0x/, '');
    if (h.length < 40) return '';
    return '0x' + h.slice(-40);
  }

  function rgbMintIds(receipt) {
    const ids = [];
    const logs = receipt && receipt.logs;
    if (!logs || !ADDR.RGB) return ids;
    const want = ADDR.RGB.toLowerCase();
    const zero = '0x' + '0'.repeat(40);
    logs.forEach(function (log) {
      if (!log || String(log.address || '').toLowerCase() !== want) return;
      const topics = log.topics || [];
      if (String(topics[0] || '').toLowerCase() !== RGB_TRANSFER) return;
      if (topicAddr(topics[1]) !== zero) return;
      if (!topics[3] || !/^0x[0-9a-f]+$/i.test(String(topics[3]))) return;
      try { ids.push(BigInt(topics[3])); } catch (e) { /* skip */ }
    });
    return ids;
  }

  function isRgbStep(step) {
    return !!(step && step.r != null && step.g != null && step.b != null && step.result == null);
  }

  function assignRgbIds(group, receipts) {
    const list = receipts || [];
    if (list.length === group.length) {
      group.forEach(function (s, i) {
        if (!isRgbStep(s) || s.rgbId != null) return;
        const ids = rgbMintIds(list[i]);
        if (ids.length === 1) s.rgbId = ids[0];
      });
      return;
    }
    const ids = [];
    list.forEach(function (rec) {
      rgbMintIds(rec).forEach(function (id) { ids.push(id); });
    });
    const steps = group.filter(isRgbStep);
    if (ids.length !== steps.length) return;
    steps.forEach(function (s, i) {
      if (s.rgbId == null) s.rgbId = ids[i];
    });
  }

  // WORD and FACE are not minted from this site. Their catalogs still come from the index.
  // Minted rows stay in memory. They are not written to math.site.v1; a reload reads them
  // back with loadDelta so the cached length still matches the chain.
  function noteStep(step, owner) {
    if (!step) return;
    fillStep(step);
    if (isRgbStep(step)) noteRgb(step.r, step.g, step.b, owner, step.rgbId);
    else if (step.word != null && step.face != null && step.rgb != null && (step.math != null || step.id != null) && step.result == null) noteToon(step, owner);
    else if (step.result != null) noteMath(step.result, owner);
    paintHeld();
  }

  function copyRow(t) {
    return t ? Object.assign({}, t) : t;
  }

  function keepRows(inv, extra) {
    let added = 0;
    function add(src, dst, fields) {
      if (!src || !dst) return;
      const seen = new Set();
      dst.forEach(function (t) {
        if (t && t.id != null) seen.add(t.id.toString());
      });
      src.forEach(function (t) {
        if (!t || t.id == null || seen.has(t.id.toString())) return;
        const row = { id: t.id, owner: t.owner };
        for (let i = 0; i < fields.length; i++) {
          if (t[fields[i]] == null) return;
          row[fields[i]] = t[fields[i]];
        }
        dst.push(row);
        seen.add(t.id.toString());
        added++;
      });
    }
    if (!inv) return 0;
    if (extra) {
      add(extra.math, inv.math, []);
      add(extra.rgb, inv.rgb, ['r', 'g', 'b']);
      add(extra.toon, inv.toon, ['word', 'face', 'rgb']);
    }
    add(state.math, inv.math, []);
    add(state.rgb, inv.rgb, ['r', 'g', 'b']);
    add(state.toon, inv.toon, ['word', 'face', 'rgb']);
    return added;
  }

  function confirm(step, receipt) {
    if (!step || step.status === 'confirmed') return;
    const fn = step.onOk;
    markStep(step, { status: 'confirmed', error: '' });
    if (fn) fn();
    fillStep(step);
    if (isRgbStep(step) && step.rgbId == null) {
      const ids = rgbMintIds(receipt);
      if (ids.length === 1) step.rgbId = ids[0];
    }
    noteStep(step, me());
  }

  async function confirmOwned(step) {
    if (!step || step.status === 'confirmed') return true;
    if (step.result == null) {
      confirm(step);
      return true;
    }
    let owner = null;
    try { owner = await ETH.ownerOf(ADDR.MATH, step.result); }
    catch (e) { return false; }
    if (!owner || /^0x0{40}$/.test(String(owner).toLowerCase())) return false;
    const mine = state.account && String(owner).toLowerCase() === String(state.account).toLowerCase();
    if (mine) confirm(step);
    else {
      markStep(step, { status: 'confirmed', error: '' });
      noteStep(step, owner);
    }
    return true;
  }

  function fail(step, error) {
    const msg = error || 'failed';
    markStep(step, { status: 'failed', error: msg });
    if (msg === 'rejected') MOLD.say('rejected');
    else if (msg === 'reverted') MOLD.say('mined', { status: 'reverted' });
    else MOLD.say('simFail', { err: msg });
  }

  function withTimeout(p, ms) {
    return new Promise(function (resolve, reject) {
      const t = setTimeout(function () { reject(new Error('timeout')); }, ms);
      Promise.resolve(p).then(function (v) {
        clearTimeout(t);
        resolve(v);
      }, function (e) {
        clearTimeout(t);
        reject(e);
      });
    });
  }

  function sleepOrTick(ms) {
    return new Promise(function (resolve) {
      let left = ms;
      const iv = setInterval(function () {
        left -= 200;
        if (state.runTick || left <= 0) {
          state.runTick = false;
          clearInterval(iv);
          resolve();
        }
      }, 200);
    });
  }

  function hydrateRun(steps, quiet) {
    const signing = state.runBusy && (state.run || []).some(function (s) { return s.status === 'signing'; });
    if (signing) {
      paintRun();
      syncNote(state.run);
      return;
    }
    const saved = readRun();
    const prev = {};
    (state.run || []).forEach(function (s) { prev[s.label] = s; });
    saved.forEach(function (s) { if (!prev[s.label]) prev[s.label] = s; });
    const labels = {};
    (steps || []).forEach(function (s) {
      labels[s.label] = true;
      const old = prev[s.label];
      s.hash = (old && old.hash) || '';
      s.calls = (old && old.calls) || '';
      s.error = (old && old.error) || '';
      let st = (old && old.status) || 'pending';
      if (st === 'signing') st = 'pending';
      s.status = st;
    });
    const stuck = (state.run || []).filter(function (s) {
      return (s.status === 'submitted' || globalThis.RUN.isUnknown(s.status)) && s.label && !labels[s.label];
    });
    state.run = stuck.concat(steps || []);
    paintRun();
    syncNote(state.run);
    saveRun(state.run);
    if (!quiet && !state.runBusy) resumeIfSubmitted();
  }

  function paintSavedRun() {
    if (!$('#run')) return;
    if (state.run && state.run.length) {
      paintRun();
      syncNote(state.run);
      return;
    }
    const saved = readRun();
    if (!saved.length) {
      syncNote(state.run);
      return;
    }
    state.run = saved.map(function (s) {
      return {
        label: s.label,
        status: s.status === 'signing' ? 'pending' : (s.status || 'pending'),
        hash: s.hash || '',
        calls: s.calls || '',
        error: s.error || '',
        result: null,
        uses: [],
        chain: false,
        done: async function () { throw new Error('unchecked'); },
      };
    });
    paintRun();
    syncNote(state.run);
    resumeIfSubmitted();
  }

  function giveUpCalls(group) {
    const next = globalThis.RUN.settleUnread(group);
    (group || []).forEach(function (s, i) {
      const row = next[i];
      if (!row || row.status === s.status) return;
      markStep(s, { status: row.status, error: '' });
    });
  }

  async function clearUnknown(step) {
    if (!step || !globalThis.RUN.isUnknown(step.status)) return;
    let done;
    try { done = await step.done(); }
    catch (e) {
      markStep(step, { status: globalThis.RUN.UNKNOWN, error: 'could not read the chain' });
      return;
    }
    const next = globalThis.RUN.clearAnswer(step.status, done);
    if (next === step.status) return;
    markStep(step, { status: next, error: '' });
  }

  async function checkCalls(id, group) {
    if (!globalThis.ethereum) return 'unread';
    let st;
    try {
      st = await withTimeout(ethereum.request({ method: 'wallet_getCallsStatus', params: [id] }), 8000);
    } catch (e) {
      if (globalThis.RUN.unsupported(e)) return 'unread';
      return 'timeout';
    }
    const outcome = globalThis.RUN.callsOutcome(st && st.status);
    const receipts = (st && st.receipts) || [];
    if (receipts.length === group.length) {
      group.forEach(function (s, i) {
        const h = receipts[i] && (receipts[i].transactionHash || receipts[i].hash);
        if (h) markStep(s, { hash: h });
      });
    } else {
      const h = receipts.map(function (r) { return r && (r.transactionHash || r.hash); }).find(Boolean);
      if (h) group.forEach(function (s) { if (!s.hash) markStep(s, { hash: h }); });
    }
    if (outcome === 'pending') {
      group.forEach(function (s) {
        if (globalThis.RUN.isUnknown(s.status)) markStep(s, { status: 'submitted', error: '' });
      });
      return '';
    }
    if (outcome === 'confirmed') {
      assignRgbIds(group, receipts);
      let waiting = false;
      for (let i = 0; i < group.length; i++) {
        const held = await confirmOwned(group[i]);
        if (!held) waiting = true;
      }
      if (!waiting) MOLD.say('mined', { status: 'ok' });
      return '';
    }
    group.forEach(function (s) { markStep(s, { status: 'failed', error: 'reverted' }); });
    MOLD.say('mined', { status: 'reverted' });
    return '';
  }

  function inFlight(step) {
    return !!(step && (step.status === 'submitted' || globalThis.RUN.isUnknown(step.status)));
  }

  async function checkSubmitted() {
    const steps = (state.run || []).filter(inFlight);
    const seen = {};
    let heard = false;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!inFlight(step)) continue;
      if (step.hash && /^0x[0-9a-fA-F]{64}$/.test(step.hash)) {
        let rec = null;
        try { rec = await ETH.receipt(step.hash); } catch (e) { continue; }
        if (!rec) continue;
        if (!globalThis.RUN.receiptOk(rec.status)) {
          fail(step, 'reverted');
          continue;
        }
        confirm(step, rec);
        MOLD.say('mined', { status: 'ok' });
      } else if (step.calls && !seen[step.calls]) {
        seen[step.calls] = true;
        const group = (state.run || []).filter(function (s) { return inFlight(s) && s.calls === step.calls; });
        const how = await checkCalls(step.calls, group);
        if (how === 'unread') giveUpCalls(group);
        else if (how !== 'timeout') heard = true;
      }
    }
    return heard ? 'heard' : '';
  }

  function markUnheard() {
    const next = globalThis.RUN.settleUnheard(state.run, false);
    (state.run || []).forEach(function (s, i) {
      const row = next[i];
      if (!row || row.status === s.status) return;
      markStep(s, { status: row.status, error: '' });
    });
  }

  async function watchOpen(gen) {
    let heard = false;
    for (let i = 0; i < 30; i++) {
      if (gen !== state.runGen) return;
      await sleepOrTick(i === 0 ? 800 : 4000);
      if (gen !== state.runGen) return;
      const how = await checkSubmitted();
      if (how === 'heard') heard = true;
      if (!(state.run || []).some(inFlight)) return;
    }
    if (gen !== state.runGen || heard) return;
    markUnheard();
  }

  function resumeIfSubmitted() {
    if (state.runBusy || state.txLock) return;
    if (!(state.run || []).some(function (s) { return globalThis.RUN.shouldResume(s); })) return;
    state.runGen += 1;
    const gen = state.runGen;
    state.runBusy = true;
    state.txLock = 'run';
    if (SITE.paintLock) SITE.paintLock();
    watchOpen(gen).finally(function () {
      releaseRun(gen);
    });
  }

  async function preflight(step, batch) {
    if (step.blocked) return step.blockWhy || 'blocked holder';
    const exists = await step.done();
    if (exists) return 'skip';
    if (step.ready) {
      const why = await step.ready(batch);
      if (why) return why;
    }
    if (globalThis.RUN.deferSim(step, batch)) return '';
    const tx = step.tx();
    const sim = await ETH.simulate(tx);
    if (sim && sim.error) return ETH.reason(sim.error);
    return '';
  }

  async function prepareBatch(batch) {
    const live = [];
    for (let i = 0; i < batch.length; i++) {
      const step = batch[i];
      let why;
      try { why = await preflight(step, batch); }
      catch (e) {
        fail(step, clip(e && e.message ? e.message : e));
        return null;
      }
      if (why === 'skip') {
        markStep(step, { status: 'confirmed', error: '' });
        continue;
      }
      if (why) {
        fail(step, why);
        return live;
      }
      live.push(step);
    }
    return live;
  }

  async function pollReceipt(hash, gen) {
    for (let i = 0; i < 30; i++) {
      if (gen !== state.runGen) return null;
      await sleepOrTick(4000);
      if (gen !== state.runGen) return null;
      let rec = null;
      try { rec = await ETH.receipt(hash); } catch (e) { rec = null; }
      if (rec) return rec;
    }
    return null;
  }

  function callCost(tx) {
    const to = String(tx && tx.to || '').toLowerCase();
    const gas = to === ADDR.RGB.toLowerCase() ? P.G_RGB : P.G_ADD;
    return { value: tx && tx.value || 0, gas: gas };
  }

  // eth_gasPrice, not maxFee. Rough pre-check before the wallet opens.
  async function afford(live) {
    const price = await ETH.gasPrice();
    state.gasPrice = price;
    const need = globalThis.RUN.batchNeed(live.map(function (s) { return callCost(s.tx()); }), price);
    const bal = await ETH.balance(state.account);
    if (globalThis.RUN.shortBalance(bal, need)) return 'balance too low — rough pre-check';
    return '';
  }

  async function sendSeq(batch, gen) {
    if ((batch || []).some(inFlight)) return;
    const live = await prepareBatch(batch);
    if (!live || !live.length) return;
    if (live.some(inFlight)) return;
    let shortfall;
    try { shortfall = await afford(live); }
    catch (e) {
      fail(live[0], clip(e && e.message ? e.message : e));
      return;
    }
    if (shortfall) {
      fail(live[0], shortfall);
      return;
    }
    for (let i = 0; i < live.length; i++) {
      if (gen !== state.runGen) return;
      const step = live[i];
      let again;
      try { again = await preflight(step, live); }
      catch (e) {
        fail(step, clip(e && e.message ? e.message : e));
        return;
      }
      if (again === 'skip') {
        markStep(step, { status: 'confirmed', error: '' });
        continue;
      }
      if (again) {
        fail(step, again);
        return;
      }
      markStep(step, { status: 'signing', error: '' });
      let hash;
      try { hash = await ETH.send(step.tx()); }
      catch (e) {
        fail(step, globalThis.RUN.rejected(e) ? 'rejected' : clip(e && e.message ? e.message : e));
        return;
      }
      if (gen !== state.runGen) return;
      markStep(step, { status: 'submitted', hash: hash, error: '' });
      MOLD.say('sent', { hash: short(hash) });
      const rec = await pollReceipt(hash, gen);
      if (gen !== state.runGen) return;
      if (!rec) return;
      if (!globalThis.RUN.receiptOk(rec.status)) {
        fail(step, 'reverted');
        return;
      }
      confirm(step, rec);
      MOLD.say('mined', { status: 'ok' });
    }
  }

  async function sendBatch(batch, gen) {
    if ((batch || []).some(inFlight)) return;
    const live = await prepareBatch(batch);
    if (!live) return;
    if (live.some(inFlight)) return;
    if (live.length < 2) return sendSeq(live, gen);
    let shortfall;
    try { shortfall = await afford(live); }
    catch (e) {
      fail(live[0], clip(e && e.message ? e.message : e));
      return;
    }
    if (shortfall) {
      fail(live[0], shortfall);
      return;
    }
    let caps = null;
    try {
      caps = await withTimeout(ethereum.request({ method: 'wallet_getCapabilities', params: [state.account] }), 8000);
    } catch (e) {
      if (globalThis.RUN.rejected(e)) {
        fail(live[0], 'rejected');
        return;
      }
      caps = null;
    }
    if (gen !== state.runGen) return;
    if (!globalThis.RUN.atomicReady(caps)) return sendSeq(live, gen);
    if (live.some(function (s) { return globalThis.RUN.deferSim(s, live); })) {
      let rows = null;
      try {
        rows = await ETH.simulateCalls(live.map(function (s) {
          const tx = s.tx();
          return { from: state.account, to: tx.to, data: tx.data, value: tx.value || '0x0' };
        }));
      } catch (e) {
        if (live.some(inFlight)) return;
        if (globalThis.RUN.simFallback(e)) return sendSeq(live, gen);
        fail(live[0], clip(e && e.message ? e.message : e));
        return;
      }
      if (gen !== state.runGen) return;
      for (let i = 0; i < rows.length; i++) {
        if (globalThis.RUN.receiptOk(rows[i] && rows[i].status)) continue;
        fail(live[i], ETH.reason(rows[i] && rows[i].error) || 'reverted');
        return;
      }
    }
    live.forEach(function (s) { markStep(s, { status: 'signing', error: '' }); });
    let res;
    try {
      res = await ethereum.request({
        method: 'wallet_sendCalls',
        params: [{
          version: '2.0.0',
          from: state.account,
          chainId: '0x1',
          atomicRequired: true,
          calls: live.map(function (s) {
            const tx = s.tx();
            return { to: tx.to, data: tx.data, value: tx.value || '0x0' };
          }),
        }],
      });
    } catch (e) {
      if (globalThis.RUN.unsupported(e)) {
        live.forEach(function (s) { markStep(s, { status: 'pending', error: '' }); });
        return sendSeq(live, gen);
      }
      const msg = globalThis.RUN.rejected(e) ? 'rejected' : clip(e && e.message ? e.message : e);
      live.forEach(function (s) { markStep(s, { status: 'failed', error: msg }); });
      if (msg === 'rejected') MOLD.say('rejected');
      else MOLD.say('simFail', { err: msg });
      return;
    }
    const id = globalThis.RUN.callsId(res);
    if (!id) {
      live.forEach(function (s) { markStep(s, { status: 'failed', error: 'no calls id' }); });
      MOLD.say('simFail', { err: 'no calls id' });
      return;
    }
    live.forEach(function (s) { markStep(s, { status: 'submitted', calls: id, error: '' }); });
    MOLD.say('sent', { hash: short(id) });
    await watchOpen(gen);
  }

  async function runSteps(steps, opt) {
    if (!steps || !steps.length) return;
    if (!globalThis.ethereum || !state.account) {
      MOLD.say('noWallet');
      return;
    }
    if (state.runBusy || state.txLock) {
      MOLD.say('wait');
      return;
    }
    state.runGen += 1;
    const gen = state.runGen;
    state.runBusy = true;
    state.txLock = 'run';
    try {
      if (SITE.paintLock) SITE.paintLock();
      await ETH.ensureChain();
      if (gen !== state.runGen) return;
      hydrateRun(steps, true);
      for (let i = 0; i < state.run.length; i++) {
        const step = state.run[i];
        const flying = inFlight(step);
        let done = false;
        try { done = await step.done(); }
        catch (e) {
          if (flying) continue;
          fail(step, clip(e && e.message ? e.message : e));
          return;
        }
        if (done) markStep(step, { status: 'confirmed', error: '' });
        else if (!flying && step.status === 'confirmed' && step.result != null) markStep(step, { status: 'pending', error: '' });
      }
      if (gen !== state.runGen) return;
      if ((state.run || []).some(inFlight)) {
        MOLD.say('wait');
        await watchOpen(gen);
        return;
      }
      let work;
      if (opt && opt.only) {
        work = state.run.filter(function (s) {
          return s.label === opt.only && s.status !== 'confirmed' && !inFlight(s);
        });
      } else {
        const seeded = state.run.filter(function (s) {
          return (s.status === 'confirmed' || inFlight(s)) && s.result != null;
        }).map(function (s) { return String(s.result); });
        const open = state.run.filter(function (s) { return s.status !== 'confirmed' && !inFlight(s); });
        work = (globalThis.RUN.splitCalls(open, seeded)[0]) || [];
      }
      if (!work.length) return;
      if (work.length > 1) await sendBatch(work, gen);
      else await sendSeq(work, gen);
    } catch (e) {
      const msg = globalThis.RUN.rejected(e) ? 'rejected' : clip(e && e.message ? e.message : e);
      const cur = (state.run || []).find(function (s) { return s.status === 'signing' || s.status === 'pending'; });
      if (cur) fail(cur, msg);
      else if (msg === 'rejected') MOLD.say('rejected');
      else MOLD.say('simFail', { err: msg });
    } finally {
      releaseRun(gen);
    }
  }

  async function sendStep(step, really) {
    const preview = 'MATH.add(' + step.a + ', ' + step.b + ')\nto ' + ADDR.MATH + '\nvalue 0.002 ETH\nmint ' + step.result +
      '\npay ' + step.payTo[0] + '\npay ' + step.payTo[1];
    state.preview = preview;
    const box = $('#preview');
    const note = globalThis.RULES.preferNote(
      globalThis.RULES.holderNote(step.payTo[0], state.blocked, state.unknown),
      globalThis.RULES.holderNote(step.payTo[1], state.blocked, state.unknown)
    );
    if (!really) {
      try {
        const tx = mathTx(step.a, step.b);
        if (!state.account) tx.from = '0x0000000000000000000000000000000000000001';
        const sim = await ETH.simulate(tx);
        if (sim.error) {
          if (box) box.textContent = preview + '\nsimulation reverted: ' + ETH.reason(sim.error);
          MOLD.say('simFail', { err: ETH.reason(sim.error) });
          return;
        }
        if (box) box.textContent = preview + '\nsimulation ok.';
        MOLD.say('simOk');
      } catch (e) {
        if (box) box.textContent = preview + '\n' + e.message;
      }
      return;
    }
    if (note === globalThis.RULES.payout()) {
      hit(note);
      if (box) box.textContent = preview + '\n' + note;
      return;
    }
    if (box) box.textContent = preview + '\nre-checking owners and existence.';
    await guardSend(async function () {
      const oa = await ETH.ownerOf(ADDR.MATH, step.a);
      const ob = await ETH.ownerOf(ADDR.MATH, step.b);
      const exists = await ETH.ownerOf(ADDR.MATH, step.result);
      if (!oa || !ob) throw new Error('an input is not minted yet');
      if (exists) throw new Error('already minted');
      const tx = mathTx(step.a, step.b);
      const sim = await ETH.simulate(tx);
      if (sim.error) throw new Error(ETH.reason(sim.error));
      if ($('#preview')) $('#preview').textContent = preview + '\nsimulation ok. confirm in the wallet.';
      const hash = await ETH.send(tx);
      noteSent(hash, function () { noteStep({ result: step.result }); });
    });
  }

  let lastRule = '';

  function hit(reason) {
    const next = reason || '';
    if (next === lastRule) return;
    lastRule = next;
    if (!next) return;
    const said = globalThis.RULES.mold(next);
    if (said) MOLD.say(said.key, said.vars);
  }

  const TABS = ['browse', 'mint', 'route', 'rgb', 'toon', 'about', 'mine'];
  let bootLocked = false;
  const openedGroup = {};

  function groupDirty(name) {
    if (name === 'mint') return !!state.mintDirty;
    if (name === 'route') return !!state.routeDirty;
    if (name === 'rgb') return !!state.planesDirty;
    if (name === 'toon') return !!state.toonDirty;
    if (name === 'browse') return !!state.browseDirty;
    if (name === 'mine') return !!state.mineDirty;
    return false;
  }

  function applyList(which, v) {
    const row = QUERY.listState(v, which);
    const filter = which === 'mine' ? state.mineFilter : state.filter;
    filter.popMin = row.popMin;
    filter.popMax = row.popMax;
    filter.pal = row.pal;
    filter.pow = row.pow;
    filter.used = row.used;
    filter.sort = row.sort;
    if (which === 'mine') {
      state.mineKind = row.kind;
      state.minePage = row.page;
      state.mineDirty = false;
      return;
    }
    state.kind = row.kind;
    state.page = row.page;
    state.browseDirty = false;
  }

  function rememberList(which) {
    if (!globalThis.QUERY) return;
    if (which === 'mine') state.mineDirty = true;
    else state.browseDirty = true;
    const mine = which === 'mine';
    rememberQuery(QUERY.listPatch(
      which,
      mine ? state.mineKind : state.kind,
      mine ? state.minePage : state.page,
      mine ? state.mineFilter : state.filter
    ));
  }

  function takeGroup(name, v) {
    if (name === 'mint') {
      state.mintQuery = { a: v.a || '', b: v.b || '' };
      state.mintDirty = false;
      return;
    }
    if (name === 'route') {
      state.routeTarget = v.n || '';
      state.routeDirty = false;
      return;
    }
    if (name === 'toon') {
      state.toonQuery = {
        math: v.math || '',
        word: v.word || '',
        face: v.face || '',
        rgb: v.rgb || '',
      };
      state.toonDirty = false;
      return;
    }
    if (name === 'browse' || name === 'mine') {
      applyList(name, v);
      return;
    }
    if (name === 'lock') {
      state.rgbLock = QUERY.lockOn(v.lock);
      return;
    }
    if (name !== 'rgb' || !QUERY.hasPlanes(v)) return;
    try {
      const R = v.R !== '' ? BigInt(v.R) : 0n;
      const G = v.G !== '' ? BigInt(v.G) : 0n;
      const B = v.B !== '' ? BigInt(v.B) : 0n;
      state.planes = { R: R, G: G, B: B };
      state.grid = P.planesToRows(R, G, B);
      state.planesTouched = QUERY.fullPlanes(v);
      state.planesDirty = false;
    } catch (e) { /* leave the grid */ }
  }

  // First visit to a tab after an unlocked open. A marked search keeps the
  // groups it names and leaves the others for this path. A shared link stays
  // locked, and saved values stay out of the address bar.
  function lazyRestore(tab) {
    if (bootLocked || !globalThis.QUERY) return;
    const name = QUERY.namedGroup(tab);
    if (!name || openedGroup[name]) return;
    openedGroup[name] = true;
    if (groupDirty(name)) return;
    let stored = null;
    try { stored = QUERY.readStore(localStorage); }
    catch (e) { stored = null; }
    const restored = QUERY.restoreBag('', stored, name);
    if (!restored.sources || restored.sources[name] !== 'store') return;
    takeGroup(name, restored.values);
  }

  function show(tab, quiet) {
    const prev = state.tab;
    const ae = document.activeElement;
    const focusId = ae && ae.id;
    const selStart = ae && typeof ae.selectionStart === 'number' ? ae.selectionStart : null;
    const selEnd = ae && typeof ae.selectionEnd === 'number' ? ae.selectionEnd : null;
    if (tab === 'mine' && !state.account) tab = 'browse';
    if (TABS.indexOf(tab) === -1) tab = 'browse';
    lazyRestore(tab);
    const same = tab === prev;
    state.tab = tab;
    state.token = null;
    document.title = '1 + 1 = 2';
    document.querySelectorAll('nav button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.tab === tab);
    });
    const view = $('#view');
    SITE[tab](view);
    paintPending();
    const nextHash = '#' + tab;
    if (location.hash !== nextHash) {
      if (!location.hash || location.hash === '#') {
        try { history.replaceState(null, '', location.pathname + location.search + nextHash); }
        catch (e) {}
      } else location.hash = tab;
    }
    if (same && focusId) {
      const next = document.getElementById(focusId);
      if (next && next !== ae) {
        next.focus();
        if (selStart != null && next.setSelectionRange) {
          try { next.setSelectionRange(selStart, selEnd); } catch (e) { /* ignore */ }
        }
      }
    }
    if (tab === 'toon') ensureParts().catch(function () {});
    if (quiet) return;
    if (tab === 'browse') MOLD.say('browse');
    if (tab === 'mint') MOLD.say('mint');
    if (tab === 'route') MOLD.say('routeOpen');
    if (tab === 'rgb') MOLD.say('rgb');
    if (tab === 'toon') MOLD.say('toon');
  }

  function openToken(tok) {
    const id = BigInt(tok.id).toString();
    state.tab = 'token';
    state.token = { kind: tok.kind, id: id };
    document.querySelectorAll('nav button').forEach(function (b) { b.classList.remove('on'); });
    const view = $('#view');
    if (view && SITE.token) SITE.token(view);
    paintPending();
    const next = '#' + tok.kind + '/' + id;
    if (location.hash !== next) {
      try { history.replaceState(null, '', location.pathname + location.search + next); }
      catch (e) {}
    }
  }

  function onHash() {
    const tok = globalThis.TOKEN.parse(location.hash);
    if (tok) {
      const next = '#' + tok.kind + '/' + tok.id.toString();
      if (state.tab === 'token' && state.token && state.token.kind === tok.kind && state.token.id === tok.id.toString()) {
        if (location.hash !== next) {
          try { history.replaceState(null, '', location.pathname + location.search + next); }
          catch (e) {}
        }
        return;
      }
      openToken(tok);
      return;
    }
    const raw = location.hash ? location.hash.slice(1) : '';
    if (raw.indexOf('step-') === 0) return;
    let name = raw || 'rgb';
    if (TABS.indexOf(name) === -1) name = 'browse';
    if (state.tab === name && !state.token) {
      if (location.hash !== '#' + name) {
        try { history.replaceState(null, '', location.pathname + location.search + '#' + name); }
        catch (e) {}
      }
      return;
    }
    show(name);
  }

  function openMints() {
    const saved = readRunStore();
    const run = state.run && state.run.length ? state.run : saved.steps;
    return globalThis.SUGGEST.flightSums((state.queue || []).concat(run), sumsObj());
  }

  const SITE = {
    state: state,
    $: $,
    esc: esc,
    links: links,
    mark: mark,
    TIPS: TIPS,
    fmt: fmt,
    hex: hex,
    short: short,
    contractLink: contractLink,
    addr: addr,
    me: me,
    ctx: ctx,
    setStatus: setStatus,
    bitHtml: bitHtml,
    cellsHtml: cellsHtml,
    svgUrl: svgUrl,
    mathTx: mathTx,
    guardSend: guardSend,
    noteSent: noteSent,
    noteMint: noteStep,
    confirmMint: confirm,
    confirmOwned: confirmOwned,
    keepRows: keepRows,
    releaseRun: releaseRun,
    resumeIfSubmitted: resumeIfSubmitted,
    ensureParts: ensureParts,
    checkSubmitted: checkSubmitted,
    checkPending: checkPending,
    decoratePlan: decoratePlan,
    onHash: onHash,
    refresh: refresh,
    sendStep: sendStep,
    runSteps: runSteps,
    rememberQuery: rememberQuery,
    rememberList: rememberList,
    openToken: openToken,
    showBatchWhy: showBatchWhy,
    lead: lead,
    hydrateRun: hydrateRun,
    paintRun: paintRun,
    paintSavedRun: paintSavedRun,
    show: show,
    hit: hit,
    persistTexts: persistTexts,
    openMints: openMints,
    rememberSum: rememberSum,
  };
  globalThis.SITE = SITE;

  let boundEth = null;

  function bindEthereum() {
    const eth = globalThis.ethereum;
    if (!eth || eth === boundEth) return;
    boundEth = eth;
    eth.request({ method: 'eth_chainId' }).then(onChain).catch(function () {});
    eth.request({ method: 'eth_accounts' }).then(function (acc) {
      if (!acc || !acc[0]) return;
      state.account = acc[0];
      paintWho();
      syncMine();
      noteAccount();
      loadWallet();
      probeBatch();
    }).catch(function () {});
    if (eth.on) {
      eth.on('accountsChanged', function (acc) {
        state.account = acc && acc[0] ? acc[0] : null;
        paintWho();
        syncMine();
        noteAccount();
        state.batchKnown = false;
        state.batchCaps = null;
        state.batchTimed = false;
        if (state.account) {
          loadWallet();
          probeBatch();
        } else syncNote(state.run);
        paintAccount(['toon', 'mine', 'browse']);
      });
      eth.on('chainChanged', onChain);
    }
  }

  function watchEthereum() {
    bindEthereum();
    window.addEventListener('ethereum#initialized', bindEthereum);
    setTimeout(bindEthereum, 1000);
  }

  async function connect() {
    if (!globalThis.ethereum) {
      MOLD.say('noWallet');
      setStatus('no wallet');
      return;
    }
    bindEthereum();
    const acc = await ethereum.request({ method: 'eth_requestAccounts' });
    if (!acc || !acc[0]) {
      setStatus('no wallet');
      return;
    }
    state.account = acc[0];
    paintWho();
    syncMine();
    noteAccount();
    MOLD.say('connect', { addr: ENS.label(state.account), mine: mineCount(), math: state.math.length });
    loadWallet();
    probeBatch();
    paintAccount(['toon', 'mine']);
  }

  function paintAccount(showTabs) {
    if (state.tab === 'mint' && SITE.fillMint) SITE.fillMint(false);
    else if (state.tab === 'rgb' && SITE.fillRgb) SITE.fillRgb(false);
    else if (showTabs.indexOf(state.tab) !== -1) show(state.tab);
  }

  async function loadHeld() {
    try {
      const mathHeld = await ETH.owned(ADDR.MATH, state.account, 2500);
      const rgbHeld = await ETH.owned(ADDR.RGB, state.account, 2500);
      const toonHeld = await ETH.owned(ADDR.TOON, state.account, 2500);
      state.heldMath = mathHeld.ids;
      state.heldRgb = rgbHeld.ids;
      state.heldToon = toonHeld.ids;
    } catch (e) { /* index list still stands */ }
  }

  async function loadWallet() {
    if (!state.account) return;
    let word;
    let face;
    try {
      word = await ETH.owned(ADDR.WORD, state.account, 2500);
      face = await ETH.owned(ADDR.FACE, state.account, 2500);
      state.words = word.ids;
      state.faces = face.ids;
      state.wordNote = word.truncated ? word.ids.length + ' of ' + word.total : String(word.total);
      state.faceNote = face.truncated ? face.ids.length + ' of ' + face.total : String(face.total);
    } catch (e) {
      state.wordNote = e.message;
      await loadHeld();
      paintWho();
      if (state.tab === 'toon' || state.tab === 'mine') show(state.tab);
      return;
    }
    try {
      const missingW = word.ids.filter(function (id) {
        return !state.snapWords.has(id) && !state.wordText.has(id);
      });
      const gotW = await ETH.loadTexts(ADDR.WORD, ABI.SEL.getWord, missingW);
      gotW.forEach(function (text, id) {
        if (!state.snapWords.has(id)) state.wordText.set(id, text);
      });
    } catch (e) {
      state.wordNote += ' · text unavailable';
    }
    try {
      const missingF = face.ids.filter(function (id) {
        return !state.snapFaces.has(id) && !state.faceText.has(id);
      });
      const gotF = await ETH.loadTexts(ADDR.FACE, ABI.SEL.getFace, missingF);
      gotF.forEach(function (text, id) {
        if (!state.snapFaces.has(id)) state.faceText.set(id, text);
      });
    } catch (e) {
      state.faceNote += ' · text unavailable';
    }
    state.snapWords.forEach(function (text, id) { state.wordText.set(id, text); });
    state.snapFaces.forEach(function (text, id) { state.faceText.set(id, text); });
    persistTexts();
    await loadHeld();
    paintWho();
    if (state.tab === 'toon' || state.tab === 'mine') show(state.tab);
    else if (state.tab === 'mint' && SITE.fillMint) SITE.fillMint(false);
  }

  let loadGen = 0;

  async function readSnapshot() {
    const res = await fetch('index.json', { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('index ' + res.status);
    const inv = ETH.unpack(await res.json());
    if (!inv) throw new Error('index');
    return inv;
  }

  function paintIndex() {
    setStatus('block ' + state.block);
    if (state.tab === 'token' && state.token && SITE.token) SITE.token($('#view'));
    else if (state.tab === 'mint' && SITE.fillMint) SITE.fillMint(false);
    else if (state.tab === 'rgb' && SITE.fillRgb) SITE.fillRgb(false);
    else if (state.tab === 'browse' || state.tab === 'toon' || state.tab === 'mine') show(state.tab);
  }

  function heartCtx() {
    return {
      supply: state.supply,
      usedR: state.usedR,
      usedG: state.usedG,
      usedB: state.usedB,
      blocked: state.blocked,
      unknown: state.unknown,
      user: me(),
      gasWei: 0n,
      mode: 'fewest',
    };
  }

  function heartFresh(pick) {
    return pick && !state.usedR.has(pick.R) && !state.usedG.has(pick.G) && !state.usedB.has(pick.B);
  }

  function prepareHeart() {
    if (!state.holdersReady || !state.supply.size) {
      state.heartPick = null;
      return;
    }
    state.heartPick = P.pickHeart(heartCtx(), Math.random);
  }

  function applyHeart(reshuffle) {
    if (state.rgbLock) return;
    if (!state.holdersReady) {
      show('rgb', true);
      MOLD.say('heartWait');
      return;
    }
    if (reshuffle || !heartFresh(state.heartPick)) state.heartPick = P.pickHeart(heartCtx(), Math.random);
    if (!state.heartPick) {
      show('rgb', true);
      MOLD.say('heartNone');
      return;
    }
    show('rgb', true);
    const before = SITE.planeSnap ? SITE.planeSnap() : '';
    state.planesTouched = true;
    state.planesDirty = true;
    state.grid = state.heartPick.rows.slice();
    show('rgb', true);
    if (SITE.noteEdit) SITE.noteEdit(before);
    const p = state.heartPick;
    MOLD.say('heart', {
      r: p.R.toString(),
      g: p.G.toString(),
      b: p.B.toString(),
      mints: String(p.mints),
    });
  }

  async function refresh() {
    const gen = ++loadGen;
    const kept = {
      math: state.math.slice(),
      rgb: state.rgb.map(copyRow),
      toon: state.toon.map(copyRow),
    };
    state.holdersReady = false;
    let base = null;
    let snap = null;
    let snapFailed = false;
    try {
      snap = await readSnapshot();
      base = ETH.preferIndex(ETH.readCache(), snap);
    } catch (e) {
      snapFailed = true;
      base = ETH.readCache();
    }
    state.snapWords = snap && snap.words ? snap.words : new Map();
    state.snapFaces = snap && snap.faces ? snap.faces : new Map();
    if (base) {
      base.words = ETH.overlayTexts(base.words, state.snapWords);
      base.faces = ETH.overlayTexts(base.faces, state.snapFaces);
    }
    if (gen !== loadGen) return;
    if (base) {
      state.indexState = 'ready';
      indexInventory(base);
      paintIndex();
      MOLD.say('loaded', { block: state.block, math: state.math.length, rgb: state.rgb.length, toon: state.toon.length });
    } else if (snapFailed) {
      state.indexState = 'error';
      setStatus('index not loaded. refresh.');
      if (state.tab === 'browse') show('browse');
    } else {
      setStatus('loading index…');
    }
    try {
      const gp = await ETH.gasPrice();
      if (gen === loadGen) state.gasPrice = gp;
    } catch (e) { /* keep last */ }
    try {
      const progress = function (msg) {
        if (gen === loadGen) setStatus(msg);
      };
      const before = base ? { math: base.math.length, rgb: base.rgb.length, toon: base.toon.length, texts: (base.words ? base.words.size : 0) + (base.faces ? base.faces.size : 0) } : null;
      const inv = base ? await ETH.loadDelta(base, progress, { words: state.snapWords, faces: state.snapFaces }) : await ETH.loadInventory(progress);
      if (gen !== loadGen) return;
      state.indexState = 'ready';
      chainIndex = {
        block: inv.block,
        math: inv.math.map(copyRow),
        rgb: inv.rgb.map(copyRow),
        toon: inv.toon.map(copyRow),
        words: inv.words,
        faces: inv.faces,
        wordOwners: inv.wordOwners,
        faceOwners: inv.faceOwners,
      };
      keepRows(inv, kept);
      indexInventory(inv);
      const grew = !before || inv.math.length !== before.math || inv.rgb.length !== before.rgb || inv.toon.length !== before.toon;
      const texts = !before || inv.words.size + inv.faces.size !== before.texts;
      if (grew || texts) paintIndex();
      if (grew) MOLD.say('loaded', { block: state.block, math: state.math.length, rgb: state.rgb.length, toon: state.toon.length });
      if (state.account) MOLD.say('connect', { addr: short(state.account), mine: mineCount(), math: state.math.length });
      const owners = state.math.map(function (t) { return t.owner; });
      const scan = ETH.scanResult(await ETH.catchHolders(owners, base, progress, inv.block));
      if (gen !== loadGen) return;
      state.blocked = scan.blocked;
      state.unknown = scan.unknown;
      state.blockedDone = scan.blockedDone;
      state.holdersReady = true;
      prepareHeart();
      const saved = ETH.cacheScan(chainIndex, scan);
      if (saved) {
        MOLD.say('blocked', { n: scan.blocked.size });
        setStatus('block ' + state.block + ' · ' + scan.blocked.size + ' blocked', TIPS.blocked);
      } else {
        setStatus('block ' + state.block + ' · holder unchecked', TIPS.unchecked);
      }
    } catch (e) {
      if (gen !== loadGen) return;
      const host = state.inventory && Array.isArray(state.inventory.math) ? state.inventory : null;
      if (host && keepRows(host, kept)) indexInventory(host);
      setStatus(e.message);
    }
  }

  function applyTile(mode) {
    const dark = mode === 'dark';
    document.documentElement.dataset.tile = dark ? 'dark' : 'light';
    const b = $('#tile');
    if (!b) return;
    b.textContent = dark ? 'dark' : 'light';
    b.setAttribute('aria-pressed', dark ? 'true' : 'false');
    b.setAttribute('aria-label', dark ? 'dark tile' : 'light tile');
  }

  let lookWallet = '';

  function noteAccount() {
    if (globalThis.MOLD && MOLD.setAccount) MOLD.setAccount(state.account);
  }

  function ideaSnap() {
    if (!state.inventory) return null;
    return Object.assign({}, state.inventory, {
      blocked: state.blocked,
      blockedDone: !!state.blockedDone,
    });
  }

  let partsFlight = null;
  let chainIndex = null;

  function partsCache(next) {
    const src = chainIndex;
    if (!src) return next;
    return {
      block: src.block,
      math: (src.math || []).map(copyRow),
      rgb: (src.rgb || []).map(copyRow),
      toon: (src.toon || []).map(copyRow),
      words: src.words,
      faces: src.faces,
      wordOwners: next.wordOwners,
      faceOwners: next.faceOwners,
    };
  }

  function ensureParts() {
    const inv = state.inventory;
    if (!inv || (Array.isArray(inv.wordOwners) && Array.isArray(inv.faceOwners))) return Promise.resolve(inv);
    if (partsFlight && partsFlight.inv === inv) return partsFlight.p;
    const p = ETH.ensurePartOwners(inv, function (msg) { setStatus(msg); }).then(function (next) {
      if (partsFlight && partsFlight.inv === inv) partsFlight = null;
      if (state.inventory !== inv) return state.inventory;
      state.inventory = next;
      if (state.blockedDone && chainIndex) ETH.cacheScan(partsCache(next), { blocked: state.blocked, unknown: state.unknown, blockedDone: true });
      return next;
    }, function (e) {
      if (partsFlight && partsFlight.inv === inv) partsFlight = null;
      throw e;
    });
    partsFlight = { inv: inv, p: p };
    return p;
  }

  async function askIdeas(pasted) {
    const raw = String(pasted || '').trim();
    let who = '';
    if (raw) who = await MOLD.resolveLook(raw, function (name) { return ENS.resolveForward(name); });
    else who = IDEAS.walletOf(state.account);
    lookWallet = who || '';
    if (!lookWallet || !ideaSnap()) {
      MOLD.showIdeas([]);
      return;
    }
    await ensureParts();
    if (!ideaSnap()) {
      MOLD.showIdeas([]);
      return;
    }
    MOLD.showIdeas(IDEAS.ideas(lookWallet, ideaSnap()));
  }

  function applyLoad(load) {
    if (!load) return;
    if (load.tab === 'mint') {
      show('mint', true);
      if (SITE.loadMint) SITE.loadMint(load);
      return;
    }
    if (load.tab === 'rgb') {
      if (state.rgbLock && SITE.setRgbLock) SITE.setRgbLock(false);
      if (state.rgbLock) {
        MOLD.say('wait');
        return;
      }
      show('rgb', true);
      const before = SITE.planeSnap ? SITE.planeSnap() : '';
      let R = null;
      let G = null;
      let B = null;
      try {
        R = BigInt(load.r);
        G = BigInt(load.g);
        B = BigInt(load.b);
      } catch (e) { return; }
      state.planesTouched = true;
      state.planesDirty = true;
      state.planes = { R: R, G: G, B: B };
      state.grid = P.planesToRows(R, G, B);
      const r = $('#pR');
      const g = $('#pG');
      const b = $('#pB');
      if (r && g && b) {
        r.value = String(load.r);
        g.value = String(load.g);
        b.value = String(load.b);
        r.dispatchEvent(new Event('change'));
      }
      if (SITE.noteEdit) SITE.noteEdit(before);
      if (SITE.clearPlan) SITE.clearPlan();
      return;
    }
    if (load.tab === 'toon') {
      show('toon', true);
      if (SITE.loadToon) SITE.loadToon(load);
    }
  }

  function bindPersist(target, doc) {
    const win = target || window;
    const page = doc || document;
    win.addEventListener('pagehide', function () {
      if (globalThis.QUERY && QUERY.hideWrite('pagehide', page.visibilityState)) persistLive();
    });
    page.addEventListener('visibilitychange', function () {
      if (globalThis.QUERY && QUERY.hideWrite('visibility', page.visibilityState)) persistLive();
    });
  }

  function boot() {
    let tile = 'light';
    try {
      const saved = localStorage.getItem('math.tile.v1');
      if (saved === 'dark' || saved === 'light') tile = saved;
    } catch (e) { /* ignore */ }
    applyTile(tile);
    const tileBtn = $('#tile');
    if (tileBtn) tileBtn.onclick = function () {
      const next = document.documentElement.dataset.tile === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('math.tile.v1', next); } catch (e) { /* ignore */ }
      applyTile(next);
    };
    bindTips();
    paintIntro();
    applyQuery();
    bindPersist();
    document.querySelectorAll('nav button').forEach(function (b) {
      b.onclick = function () { show(b.dataset.tab); };
    });
    window.addEventListener('hashchange', onHash);
    document.addEventListener('click', function (ev) {
      const b = ev.target.closest('[data-share]');
      if (!b) return;
      ev.preventDefault();
      const url = location.origin + location.pathname + '#' + b.dataset.share;
      function copied() {
        const old = b.textContent;
        const next = b.closest('.card') ? '✓' : 'copied';
        b.textContent = next;
        setTimeout(function () { if (b.isConnected && b.textContent === next) b.textContent = old; }, 1200);
      }
      function copy() {
        if (!navigator.clipboard || !navigator.clipboard.writeText) return;
        navigator.clipboard.writeText(url).then(copied, function () {});
      }
      if (navigator.share) {
        navigator.share({ title: b.dataset.shareTitle || document.title, url: url }).catch(function (e) {
          if (e && e.name === 'AbortError') return;
          copy();
        });
        return;
      }
      copy();
    });
    document.addEventListener('click', function (ev) {
      const b = ev.target.closest('.addr');
      if (!b) return;
      const full = b.dataset.addr;
      if (b.classList.contains('open')) {
        b.classList.remove('open');
        b.textContent = b.dataset.label;
        return;
      }
      b.classList.add('open');
      b.textContent = full;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(full).catch(function () {});
      }
    });
    $('#connect').onclick = function () { connect().catch(function (e) { setStatus(e.message); }); };
    $('#refresh').onclick = function () { refresh(); };
    MOLD.mount($('#mold'), function (s) {
      if (s.act === 'ideas') {
        askIdeas(s.pasted);
        return;
      }
      if (s.act === 'load' && s.load) {
        applyLoad(s.load);
        return;
      }
      if (s.act === 'mint11') {
        show('mint');
        const a = $('#a');
        const b = $('#b');
        if (a && b) { a.value = '1'; b.value = '1'; SITE.paintMint(false); }
        return;
      }
      if (s.act === 'heart') {
        applyHeart(false);
        return;
      }
      if (s.act === 'route15') {
        state.routeTarget = '15';
        show('route');
        const input = $('#target');
        if (input) input.value = '15';
        return;
      }
      if (s.act === 'pal') {
        state.filter.pal = true;
        state.kind = 'math';
        show('browse');
        return;
      }
      show(s.tab);
    });
    noteAccount();
    const cached = ETH.readCache();
    if (cached) {
      indexInventory(cached);
      state.indexState = 'ready';
      setStatus('cached block ' + state.block);
    } else {
      state.indexState = 'loading';
      setStatus('loading index…');
    }
    const pending = loadPending();
    if (pending && /^0x[0-9a-fA-F]{64}$/.test(pending)) state.pendingHash = pending;
    loadSums();
    const tok = globalThis.TOKEN.parse(location.hash);
    if (tok) openToken(tok);
    else {
      const raw = location.hash ? location.hash.slice(1) : '';
      const tab = raw ? (TABS.indexOf(raw) === -1 ? 'browse' : raw) : 'rgb';
      show(tab);
    }
    ETH.gasPrice().then(function (g) { state.gasPrice = g; }).catch(function () {});
    paintContractNames();
    watchEthereum();
    refresh();
  }

  SITE.applyHeart = applyHeart;
  SITE.applyLoad = applyLoad;
  SITE.applyQuery = applyQuery;
  SITE.persistLive = persistLive;
  SITE.bindPersist = bindPersist;
  SITE.boot = boot;
})();
