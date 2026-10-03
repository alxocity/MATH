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
    channels: new Map(),
    blocked: new Set(),
    blockedDone: false,
    block: '',
    gasPrice: 1000000000n,
    page: 0,
    filter: { q: '', popMin: '', popMax: '', pal: false, pow: false, used: 'any', sort: 'index' },
    words: [],
    faces: [],
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

  function me() {
    return state.account ? state.account.toLowerCase() : '0x0000000000000000000000000000000000000000';
  }

  function ctx() {
    return {
      supply: state.supply,
      user: me(),
      blocked: state.blocked,
      gasWei: P.G_ADD * state.gasPrice,
      mode: state.routeMode,
    };
  }

  function setStatus(t) {
    const el = $('#status');
    if (el) el.textContent = t || '';
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
    state.channels = new Map();
    state.rgb.forEach(function (t) {
      state.usedR.add(t.r);
      state.usedG.add(t.g);
      state.usedB.add(t.b);
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
    state.toon.forEach(function (t) {
      state.usedWord.add(t.word);
      state.usedFace.add(t.face);
      state.usedRgb.add(t.rgb);
      state.usedMath.add(t.id);
    });
    if (inv.blocked) state.blocked = inv.blocked;
    if (inv.blockedDone) state.blockedDone = true;
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
        html += '<button type="button" class="' + ch + '" data-i="' + (y * 16 + x) + '" title="' + ch + '"></button>';
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

  async function sendStep(step) {
    const preview = 'MATH.add(' + step.a + ', ' + step.b + ')\nto ' + ADDR.MATH + '\nvalue 0.002 ETH\nmint ' + step.result +
      '\npay ' + step.payTo[0] + '\npay ' + step.payTo[1];
    state.preview = preview;
    const box = $('#preview');
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

  function show(tab) {
    state.tab = tab;
    location.hash = tab;
    document.querySelectorAll('nav button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.tab === tab);
    });
    const view = $('#view');
    SITE[tab](view);
    if (tab === 'browse') MOLD.say('browse');
    if (tab === 'rgb') MOLD.say('rgb');
    if (tab === 'toon') MOLD.say('toon');
  }

  const SITE = {
    state: state,
    $: $,
    esc: esc,
    fmt: fmt,
    hex: hex,
    short: short,
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
  };
  globalThis.SITE = SITE;

  async function connect() {
    if (!globalThis.ethereum) {
      MOLD.say('noWallet');
      setStatus('no wallet');
      return;
    }
    const acc = await ethereum.request({ method: 'eth_requestAccounts' });
    state.account = acc[0];
    $('#who').textContent = short(state.account);
    MOLD.say('connect', { addr: short(state.account), mine: mineCount(), math: state.math.length });
    loadWallet();
    if (state.tab === 'toon' || state.tab === 'mint') show(state.tab);
  }

  async function loadWallet() {
    if (!state.account) return;
    try {
      const word = await ETH.owned(ADDR.WORD, state.account, 2500);
      const face = await ETH.owned(ADDR.FACE, state.account, 2500);
      state.words = word.ids;
      state.faces = face.ids;
      state.wordNote = word.truncated ? word.ids.length + ' of ' + word.total : String(word.total);
      state.faceNote = face.truncated ? face.ids.length + ' of ' + face.total : String(face.total);
      if (state.tab === 'toon') show('toon');
    } catch (e) {
      state.wordNote = e.message;
    }
  }

  let loadGen = 0;

  async function refresh() {
    const gen = ++loadGen;
    setStatus('loading');
    try {
      const gp = await ETH.gasPrice();
      state.gasPrice = gp;
    } catch (e) { /* keep last */ }
    try {
      const inv = await ETH.loadInventory(function (msg) {
        if (gen !== loadGen) return;
        setStatus(msg);
      });
      if (gen !== loadGen) return;
      indexInventory(inv);
      ETH.writeCache(inv, null);
      state.blockedDone = false;
      setStatus('block ' + state.block);
      MOLD.say('loaded', { block: state.block, math: state.math.length, rgb: state.rgb.length, toon: state.toon.length });
      if (state.account) MOLD.say('connect', { addr: short(state.account), mine: mineCount(), math: state.math.length });
      if (state.tab === 'browse' || state.tab === 'toon') show(state.tab);
      else if (state.tab === 'rgb' && $('#rgbMeta') && state.planes) {
        const issues = SITE.planeIssues(state.planes);
        $('#rgbMeta').textContent = issues.join(', ');
      }
      const owners = state.math.map(function (t) { return t.owner; });
      const blocked = await ETH.scanBlocked(owners, function (msg) {
        if (gen === loadGen) setStatus(msg);
      });
      if (gen !== loadGen) return;
      state.blocked = blocked;
      state.blockedDone = true;
      ETH.writeCache({ block: state.block, math: state.math, rgb: state.rgb, toon: state.toon }, blocked);
      MOLD.say('blocked', { n: blocked.size });
      setStatus('block ' + state.block + ' · ' + blocked.size + ' blocked');
    } catch (e) {
      setStatus(e.message);
    }
  }

  function boot() {
    document.querySelectorAll('nav button').forEach(function (b) {
      b.onclick = function () { show(b.dataset.tab); };
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
        state.grid = P.HEART.slice();
        show('rgb');
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
      setStatus('cached block ' + state.block);
    }
    const tab = (location.hash || '#browse').slice(1);
    show(['browse', 'mint', 'route', 'rgb', 'toon', 'about'].indexOf(tab) === -1 ? 'browse' : tab);
    ETH.gasPrice().then(function (g) { state.gasPrice = g; }).catch(function () {});
    if (globalThis.ethereum) {
      ethereum.request({ method: 'eth_chainId' }).then(onChain).catch(function () {});
      ethereum.request({ method: 'eth_accounts' }).then(function (acc) {
        if (acc && acc[0]) {
          state.account = acc[0];
          $('#who').textContent = short(state.account);
          loadWallet();
        }
      }).catch(function () {});
      if (ethereum.on) {
        ethereum.on('accountsChanged', function (acc) {
          state.account = acc && acc[0] ? acc[0] : null;
          $('#who').textContent = state.account ? short(state.account) : '';
          if (state.account) loadWallet();
        });
        ethereum.on('chainChanged', onChain);
      }
    }
    if (!cached) refresh();
  }

  SITE.boot = boot;
})();
