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

  function noteSent(hash, onOk) {
    state.txLock = hash;
    MOLD.say('sent', { hash: short(hash) });
    const box = $('#preview');
    if (box) box.textContent = (state.preview || '') + '\nsubmitted ' + hash;
    watch(hash, onOk);
  }

  async function watch(hash, onOk) {
    for (let i = 0; i < 40; i++) {
      await new Promise(function (r) { setTimeout(r, 4000); });
      if (state.txLock !== hash) return;
      let rec = null;
      try { rec = await ETH.receipt(hash); } catch (e) { rec = null; }
      if (!rec) continue;
      state.txLock = null;
      const ok = rec.status === '0x1';
      MOLD.say('mined', { status: ok ? 'ok' : 'reverted' });
      if (ok && onOk) onOk();
      const box = $('#preview');
      if (box) box.textContent += '\nmined ' + (ok ? 'ok' : 'reverted');
      return;
    }
    if (state.txLock === hash) state.txLock = null;
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
    const tab = (location.hash || '#browse').slice(1);
    show(['browse', 'mint', 'route', 'rgb', 'toon', 'about', 'mine'].indexOf(tab) === -1 ? 'browse' : tab);
    ETH.gasPrice().then(function (g) { state.gasPrice = g; }).catch(function () {});
    watchEthereum();
    refresh();
  }

  SITE.applyHeart = applyHeart;
  SITE.boot = boot;
})();
