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
    routeMode: 'cheapest',
    txLock: null,
    preview: '',
    pendingHash: null,
    pendingOk: null,
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
    fees: 'MATH add is 0.002 ETH, 0.001 to each input owner. RGB is 0.03 ETH, 0.01 to each channel owner. TOON is free.',
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
    state.unknown = new Set();
    if (inv.blocked) state.blocked = inv.blocked;
    if (inv.blockedDone) state.blockedDone = true;
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
    state.txLock = null;
    state.pendingHash = null;
    state.pendingOk = null;
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
    state.txLock = null;
    state.pendingHash = hash;
    state.pendingOk = onOk || null;
    savePending(hash);
    MOLD.say('wait');
    const box = $('#preview');
    if (box) box.textContent += '\nstill pending';
    paintPending();
  }

  function readRun() {
    try {
      const raw = sessionStorage.getItem(RUN_KEY);
      const j = raw ? JSON.parse(raw) : null;
      return j && Array.isArray(j.steps) ? j.steps : [];
    } catch (e) { return []; }
  }

  function saveRun(steps) {
    try {
      sessionStorage.setItem(RUN_KEY, JSON.stringify({
        steps: (steps || []).map(function (s) {
          return {
            label: s.label,
            status: s.status || 'pending',
            hash: s.hash || '',
            calls: s.calls || '',
            error: s.error || '',
          };
        }),
      }));
    } catch (e) { /* ignore */ }
  }

  function syncNote(steps) {
    const note = $('#batchNote');
    if (!note) return;
    const list = steps || [];
    const seeded = list.filter(function (s) {
      return (s.status === 'confirmed' || s.status === 'submitted' || globalThis.RUN.isUnknown(s.status)) && s.result != null;
    }).map(function (s) { return String(s.result); });
    const open = list.filter(function (s) {
      return s.status !== 'confirmed' && s.status !== 'submitted' && !globalThis.RUN.isUnknown(s.status);
    });
    const first = (globalThis.RUN.splitCalls(open, seeded)[0]) || [];
    note.hidden = first.length < 2;
  }

  function paintRun() {
    const host = $('#run');
    if (!host) return;
    const rows = state.run || [];
    host.innerHTML = rows.map(function (s, i) {
      const hash = s.hash && /^0x[0-9a-fA-F]{64}$/.test(s.hash)
        ? ' <a href="https://etherscan.io/tx/' + s.hash + '" target="_blank" rel="noopener noreferrer">tx</a>'
        : '';
      const err = (s.status === 'failed' || globalThis.RUN.isUnknown(s.status)) && s.error
        ? ' <span class="bad">' + esc(s.error) + '</span>' : '';
      let btn = '';
      if (s.status === 'failed') btn = ' <button type="button" data-retry="1">retry</button>';
      else if (globalThis.RUN.isUnknown(s.status)) {
        btn = ' <button type="button" data-check="1">check</button>';
        if (s.chain !== false) btn += ' <button type="button" data-clear="' + i + '">clear</button>';
      } else if (s.status === 'submitted') btn = ' <button type="button" data-check="1">check</button>';
      return '<div class="run">' + (i + 1) + '/' + rows.length + ' ' + esc(s.status || 'pending') + ' ' + esc(s.label) + hash + err + btn + '</div>';
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

  function confirm(step) {
    if (!step || step.status === 'confirmed') return;
    const fn = step.onOk;
    markStep(step, { status: 'confirmed', error: '' });
    if (fn) fn();
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
      state.supply.set(step.result, owner);
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
    if (!saved.length) return;
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
        confirm(step);
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
    watchOpen(gen).finally(function () {
      if (gen !== state.runGen) return;
      state.runBusy = false;
      if (state.txLock === 'run') state.txLock = null;
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
    let short;
    try { short = await afford(live); }
    catch (e) {
      fail(live[0], clip(e && e.message ? e.message : e));
      return;
    }
    if (short) {
      fail(live[0], short);
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
      confirm(step);
      MOLD.say('mined', { status: 'ok' });
    }
  }

  async function sendBatch(batch, gen) {
    if ((batch || []).some(inFlight)) return;
    const live = await prepareBatch(batch);
    if (!live) return;
    if (live.some(inFlight)) return;
    if (live.length < 2) return sendSeq(live, gen);
    let short;
    try { short = await afford(live); }
    catch (e) {
      fail(live[0], clip(e && e.message ? e.message : e));
      return;
    }
    if (short) {
      fail(live[0], short);
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
      if (gen === state.runGen) {
        state.runBusy = false;
        if (state.txLock === 'run') state.txLock = null;
      }
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
      noteSent(hash, function () { state.supply.set(step.result, me()); });
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

  function show(tab, quiet) {
    if (tab === 'mine' && !state.account) tab = 'browse';
    state.tab = tab;
    location.hash = tab;
    document.querySelectorAll('nav button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.tab === tab);
    });
    const view = $('#view');
    SITE[tab](view);
    paintPending();
    if (quiet) return;
    if (tab === 'browse') MOLD.say('browse');
    if (tab === 'rgb') MOLD.say('rgb');
    if (tab === 'toon') MOLD.say('toon');
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
    sendStep: sendStep,
    runSteps: runSteps,
    hydrateRun: hydrateRun,
    paintRun: paintRun,
    paintSavedRun: paintSavedRun,
    show: show,
    hit: hit,
    persistTexts: persistTexts,
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
      loadWallet();
    }).catch(function () {});
    if (eth.on) {
      eth.on('accountsChanged', function (acc) {
        state.account = acc && acc[0] ? acc[0] : null;
        paintWho();
        syncMine();
        if (state.account) loadWallet();
        if (state.tab === 'toon' || state.tab === 'mint' || state.tab === 'mine' || state.tab === 'browse') show(state.tab);
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
    MOLD.say('connect', { addr: ENS.label(state.account), mine: mineCount(), math: state.math.length });
    loadWallet();
    if (state.tab === 'toon' || state.tab === 'mint' || state.tab === 'mine') show(state.tab);
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
    if (state.tab === 'browse' || state.tab === 'toon') show(state.tab);
    else if (state.tab === 'mint' && $('#send')) SITE.paintMint(false);
    else if (state.tab === 'rgb' && $('#rgbMeta') && state.planes) {
      $('#rgbMeta').innerHTML = SITE.issuesHtml(SITE.planeIssues(state.planes));
    }
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
    state.grid = state.heartPick.rows.slice();
    show('rgb', true);
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
      indexInventory(inv);
      const grew = !before || inv.math.length !== before.math || inv.rgb.length !== before.rgb || inv.toon.length !== before.toon;
      const texts = !before || inv.words.size + inv.faces.size !== before.texts;
      if (grew || texts) paintIndex();
      if (grew) MOLD.say('loaded', { block: state.block, math: state.math.length, rgb: state.rgb.length, toon: state.toon.length });
      if (state.account) MOLD.say('connect', { addr: short(state.account), mine: mineCount(), math: state.math.length });
      const owners = state.math.map(function (t) { return t.owner; });
      const scan = ETH.scanResult(await ETH.scanBlocked(owners, progress));
      if (gen !== loadGen) return;
      state.blocked = scan.blocked;
      state.unknown = scan.unknown;
      state.blockedDone = scan.blockedDone;
      state.holdersReady = true;
      prepareHeart();
      const saved = ETH.cacheScan({
        block: state.block,
        math: state.math,
        rgb: state.rgb,
        toon: state.toon,
        words: state.wordText,
        faces: state.faceText,
      }, scan);
      if (saved) {
        MOLD.say('blocked', { n: scan.blocked.size });
        setStatus('block ' + state.block + ' · ' + scan.blocked.size + ' blocked', TIPS.blocked);
      } else {
        setStatus('block ' + state.block + ' · holder unchecked', TIPS.unchecked);
      }
    } catch (e) {
      if (gen === loadGen) setStatus(e.message);
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
    document.querySelectorAll('nav button').forEach(function (b) {
      b.onclick = function () { show(b.dataset.tab); };
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
    const tab = (location.hash || '#browse').slice(1);
    show(['browse', 'mint', 'route', 'rgb', 'toon', 'about', 'mine'].indexOf(tab) === -1 ? 'browse' : tab);
    ETH.gasPrice().then(function (g) { state.gasPrice = g; }).catch(function () {});
    watchEthereum();
    refresh();
  }

  SITE.applyHeart = applyHeart;
  SITE.boot = boot;
})();
