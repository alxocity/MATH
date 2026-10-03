(function () {
  const ETH = globalThis.ETH;
  const P = globalThis.PLAN;
  const ABI = globalThis.ABI;
  const ADDR = ETH.ADDR;
  const $ = function (s) { return document.querySelector(s); };
  const PAGE = 24;

  const state = {
    tab: 'browse',
    account: null,
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

  function show(tab) {
    state.tab = tab;
    location.hash = tab;
    document.querySelectorAll('nav button').forEach(function (b) {
      b.classList.toggle('on', b.dataset.tab === tab);
    });
    const view = $('#view');
    if (tab === 'browse') browse(view);
    else if (tab === 'mint') mint(view);
    else if (tab === 'route') route(view);
    else if (tab === 'rgb') rgb(view);
    else if (tab === 'toon') toon(view);
    else about(view);
    if (tab === 'browse') MOLD.say('browse');
    if (tab === 'rgb') MOLD.say('rgb');
    if (tab === 'toon') MOLD.say('toon');
  }

  function pass(tok) {
    const f = state.filter;
    const id = tok.id;
    if (f.q) {
      if (/^\d+$/.test(f.q)) {
        if (!id.toString().includes(f.q)) return false;
      } else if (!tok.owner.includes(f.q.toLowerCase())) return false;
    }
    const pop = P.popcount(id > P.MAX ? id & P.MAX : id);
    if (f.popMin !== '' && pop < Number(f.popMin)) return false;
    if (f.popMax !== '' && pop > Number(f.popMax)) return false;
    if (f.pal && !P.isPal(id)) return false;
    if (f.pow && !P.isPow2(id)) return false;
    if (state.kind === 'math' && f.used !== 'any') {
      const ch = state.channels.get(id);
      if (f.used === 'free') {
        if (ch && ch.size) return false;
      } else if (!ch || !ch.has(f.used)) return false;
    }
    return true;
  }

  function currentList() {
    const src = state.kind === 'rgb' ? state.rgb : state.kind === 'toon' ? state.toon : state.math;
    let list = src.filter(pass);
    if (state.filter.sort === 'id') {
      list = list.slice().sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    } else if (state.filter.sort === 'pop') {
      list = list.slice().sort(function (a, b) { return P.popcount(b.id) - P.popcount(a.id); });
    }
    return list;
  }

  function paintCards() {
    const list = currentList();
    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    if (state.page >= pages) state.page = pages - 1;
    if (state.page < 0) state.page = 0;
    const slice = list.slice(state.page * PAGE, state.page * PAGE + PAGE);
    const cards = $('#cards');
    const pager = $('#pager');
    if (!cards) return;
    cards.innerHTML = slice.map(function (t) {
      const ch = state.kind === 'math' ? state.channels.get(t.id) : null;
      const tags = ch ? Array.from(ch).join('') : '';
      let extra = '';
      let grid = bitHtml(t.id);
      if (state.kind === 'rgb') {
        extra = '<div class="dim">r ' + t.r + '</div>';
        grid = cellsHtml(P.planesToRows(t.r, t.g, t.b)).replace(/<button/g, '<i').replace(/<\/button>/g, '</i>');
      }
      if (state.kind === 'toon') extra = '<div class="dim">word ' + t.word + ' face ' + t.face + ' rgb ' + t.rgb + '</div>';
      return '<article class="card"><div>' + t.id + (tags ? ' <span class="dim">' + tags + '</span>' : '') + '</div>' +
        '<div class="dim">' + short(t.owner) + '</div>' + extra + grid +
        '<img alt="" data-svg="' + state.kind + ':' + t.id + '"></article>';
    }).join('') || '<p class="dim">' + (state.math.length || state.rgb.length || state.toon.length ? 'nothing in this filter.' : 'index not loaded. refresh.') + '</p>';
    if (pager) {
      pager.innerHTML = '<button type="button" id="prev"' + (state.page ? '' : ' disabled') + '>prev</button> ' +
        (state.page + 1) + '/' + pages + ' <span class="dim">' + list.length + '</span> ' +
        '<button type="button" id="next"' + (state.page + 1 < pages ? '' : ' disabled') + '>next</button>';
      const prev = $('#prev');
      const next = $('#next');
      if (prev) prev.onclick = function () { state.page--; paintCards(); };
      if (next) next.onclick = function () { state.page++; paintCards(); };
    }
    loadSvgs(slice.map(function (t) { return t.id; }));
  }

  async function loadSvgs(ids) {
    const gen = ++state.svgGen;
    const kind = state.kind;
    const render = kind === 'rgb' ? ADDR.RGB_RENDER : kind === 'toon' ? ADDR.TOON_RENDER : ADDR.MATH_RENDER;
    const keep = {};
    ids.forEach(function (id) { keep[kind + ':' + id] = 1; });
    if (state.svgs.size > 60) {
      Array.from(state.svgs.keys()).forEach(function (key) {
        if (!keep[key]) state.svgs.delete(key);
      });
    }
    const todo = ids.filter(function (id) { return !state.svgs.has(kind + ':' + id); });
    for (let i = 0; i < todo.length; i += 4) {
      if (gen !== state.svgGen) return;
      let xmls = [];
      try { xmls = await ETH.tokenSVGs(render, todo.slice(i, i + 4)); } catch (e) { return; }
      if (gen !== state.svgGen) return;
      xmls.forEach(function (xml, j) {
        const id = todo[i + j];
        if (!xml) return;
        const key = kind + ':' + id;
        state.svgs.set(key, xml);
        const img = document.querySelector('img[data-svg="' + key + '"]');
        if (img) img.src = svgUrl(xml);
      });
    }
    ids.forEach(function (id) {
      const xml = state.svgs.get(kind + ':' + id);
      const img = document.querySelector('img[data-svg="' + kind + ':' + id + '"]');
      if (img && xml) img.src = svgUrl(xml);
    });
  }

  function browse(view) {
    const f = state.filter;
    view.innerHTML =
      '<div class="row">' +
      '<button type="button" data-kind="math"' + (state.kind === 'math' ? ' class="on"' : '') + '>MATH ' + state.math.length + '</button>' +
      '<button type="button" data-kind="rgb"' + (state.kind === 'rgb' ? ' class="on"' : '') + '>RGB ' + state.rgb.length + '</button>' +
      '<button type="button" data-kind="toon"' + (state.kind === 'toon' ? ' class="on"' : '') + '>TOON ' + state.toon.length + '</button>' +
      '</div>' +
      '<div class="row">' +
      '<input id="q" placeholder="id or owner" value="' + esc(f.q) + '">' +
      '<label>pop <input id="popMin" size="4" value="' + esc(f.popMin) + '"></label>' +
      '<label>..<input id="popMax" size="4" value="' + esc(f.popMax) + '"></label>' +
      '<label><input type="checkbox" id="pal"' + (f.pal ? ' checked' : '') + '> pal</label>' +
      '<label><input type="checkbox" id="pow"' + (f.pow ? ' checked' : '') + '> 2^k</label>' +
      '<label>used <select id="used">' +
      ['any', 'r', 'g', 'b', 'free'].map(function (u) {
        return '<option' + (f.used === u ? ' selected' : '') + '>' + u + '</option>';
      }).join('') + '</select></label>' +
      '<label>sort <select id="sort">' +
      ['index', 'id', 'pop'].map(function (u) {
        return '<option' + (f.sort === u ? ' selected' : '') + '>' + u + '</option>';
      }).join('') + '</select></label>' +
      '</div>' +
      '<div id="cards"></div><p id="pager" class="row"></p>' +
      '<p class="dim">low 256 bits. pictures from the renderer, this page only.</p>';
    view.querySelectorAll('[data-kind]').forEach(function (b) {
      b.onclick = function () { state.kind = b.dataset.kind; state.page = 0; show('browse'); };
    });
    function read() {
      state.filter.q = $('#q').value.trim();
      state.filter.popMin = $('#popMin').value.trim();
      state.filter.popMax = $('#popMax').value.trim();
      state.filter.pal = $('#pal').checked;
      state.filter.pow = $('#pow').checked;
      state.filter.used = $('#used').value;
      state.filter.sort = $('#sort').value;
      state.page = 0;
      paintCards();
    }
    ['q', 'popMin', 'popMax'].forEach(function (id) { $('#' + id).addEventListener('input', read); });
    ['pal', 'pow', 'used', 'sort'].forEach(function (id) { $('#' + id).addEventListener('change', read); });
    paintCards();
  }

  function mint(view) {
    view.innerHTML =
      '<div class="row"><label>a <input id="a" value="1" spellcheck="false"></label>' +
      '<label>b <input id="b" value="1" spellcheck="false"></label></div>' +
      '<div class="eq" id="eq">1 + 1 = 2</div>' +
      '<div id="grid"></div>' +
      '<p id="mintMeta"></p>' +
      '<div class="preview" id="preview">simulate, then send. this page does not sign.</div>' +
      '<div class="row"><button type="button" id="sim">simulate</button><button type="button" id="send">send add</button></div>';
    const draw = function () { paintMint(false); };
    $('#a').addEventListener('input', draw);
    $('#b').addEventListener('input', draw);
    $('#sim').onclick = function () { paintMint(true); };
    $('#send').onclick = function () { sendMath(); };
    paintMint(false);
  }

  function readPair() {
    let a, b;
    try { a = BigInt($('#a').value.trim()); b = BigInt($('#b').value.trim()); }
    catch (e) { return null; }
    if (a <= 0n || b <= 0n) return null;
    return { a: a, b: b, n: a + b };
  }

  function mintPreview(a, b, n, oa, ob) {
    const roy = [];
    if (oa) roy.push('0.001 ETH → ' + oa);
    if (ob) roy.push('0.001 ETH → ' + ob);
    return 'MATH.add(' + a + ', ' + b + ')\nto ' + ADDR.MATH + '\nvalue 0.002 ETH\nmint ' + n + '\n' +
      (roy.join('\n') || 'owners unknown') + '\nwallet signs this. the page cannot.';
  }

  function paintMint(doSim) {
    const pair = readPair();
    const eq = $('#eq');
    const meta = $('#mintMeta');
    const grid = $('#grid');
    if (!pair) {
      if (eq) eq.textContent = 'a + b = ?';
      return;
    }
    const overflow = pair.n > P.MAX;
    if (eq) eq.textContent = pair.a + ' + ' + pair.b + ' = ' + (overflow ? 'overflow' : pair.n);
    if (grid) grid.innerHTML = overflow ? '' : bitHtml(pair.n);
    const oa = state.supply.get(pair.a);
    const ob = state.supply.get(pair.b);
    const exists = state.supply.has(pair.n);
    const lines = [];
    if (!oa) lines.push('a is not in the loaded index');
    if (!ob) lines.push('b is not in the loaded index');
    if (exists) lines.push('exists, owner ' + state.supply.get(pair.n));
    if (oa && state.blocked.has(oa)) lines.push('a holder blocked');
    if (ob && state.blocked.has(ob)) lines.push('b holder blocked');
    const net = (oa && oa === me() ? 0n : P.ROY_WEI) + (ob && ob === me() ? 0n : P.ROY_WEI) + P.G_ADD * state.gasPrice;
    lines.push('pays ' + (oa ? short(oa) : '?') + ' and ' + (ob ? short(ob) : '?'));
    lines.push('msg.value 0.002, net about ' + fmt(net) + ' ETH after refunds and gas');
    if (meta) meta.innerHTML = lines.map(function (l) { return esc(l); }).join('<br>');
    const preview = mintPreview(pair.a, pair.b, pair.n, oa, ob);
    state.preview = preview;
    if ($('#preview')) $('#preview').textContent = preview;
    if (doSim) runSim(pair, preview);
  }

  async function runSim(pair, preview) {
    const box = $('#preview');
    try {
      const tx = mathTx(pair.a, pair.b);
      if (!state.account) tx.from = '0x0000000000000000000000000000000000000001';
      const sim = await ETH.simulate(tx);
      const who = state.account ? '' : '\nstand-in sender 0x1. connect before send.';
      if (sim.error) {
        box.textContent = preview + who + '\nsimulation reverted: ' + ETH.reason(sim.error);
        MOLD.say('simFail', { err: ETH.reason(sim.error) });
        return;
      }
      box.textContent = preview + who + '\nsimulation ok.';
      if (state.supply.has(pair.n)) MOLD.say('exists', { n: pair.n, owner: short(state.supply.get(pair.n)) });
      else MOLD.say('simOk');
    } catch (e) {
      box.textContent = preview + '\n' + e.message;
    }
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

  async function sendMath() {
    const pair = readPair();
    if (!pair || pair.n > P.MAX) return;
    const preview = mintPreview(pair.a, pair.b, pair.n, state.supply.get(pair.a), state.supply.get(pair.b));
    state.preview = preview;
    if ($('#preview')) $('#preview').textContent = preview + '\nre-checking, then the wallet.';
    await guardSend(async function () {
      const oa = await ETH.ownerOf(ADDR.MATH, pair.a);
      const ob = await ETH.ownerOf(ADDR.MATH, pair.b);
      const exists = await ETH.ownerOf(ADDR.MATH, pair.n);
      if (!oa || !ob) throw new Error('an input is not minted');
      if (exists) throw new Error('already minted by ' + exists);
      const tx = mathTx(pair.a, pair.b);
      const sim = await ETH.simulate(tx);
      if (sim.error) throw new Error(ETH.reason(sim.error));
      if ($('#preview')) $('#preview').textContent = preview + '\nsimulation ok. confirm in the wallet.';
      const hash = await ETH.send(tx);
      noteSent(hash, function () {
        state.supply.set(pair.n, me());
      });
    });
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

  function route(view) {
    view.innerHTML =
      '<div class="row"><label>n <input id="target" spellcheck="false" value="' + esc(state.routeTarget) + '"></label>' +
      '<button type="button" id="mode" class="on">' + state.routeMode + '</button>' +
      '<button type="button" id="plan">plan</button></div>' +
      '<p class="dim" id="routeMeta"></p><div id="pieces"></div><div id="steps"></div>' +
      '<div class="preview" id="preview">' + esc(state.preview || 'each send is one wallet confirmation.') + '</div>';
    $('#mode').onclick = function () {
      state.routeMode = state.routeMode === 'fewest' ? 'cheapest' : 'fewest';
      $('#mode').textContent = state.routeMode;
    };
    $('#plan').onclick = planRoute;
    $('#target').addEventListener('change', function () { state.routeTarget = $('#target').value.trim(); });
    paintRoute();
  }

  function paintRoute() {
    const host = $('#pieces');
    const steps = $('#steps');
    const meta = $('#routeMeta');
    if (!host) return;
    const built = state.routeBuilt;
    host.innerHTML = state.routePieces.map(function (p, i) {
      const pin = state.routePinned.some(function (x) { return x === p; });
      return '<div class="piece"><input type="text" data-i="' + i + '" value="' + p + '" spellcheck="false">' +
        '<label><input type="checkbox" class="pin" data-i="' + i + '"' + (pin ? ' checked' : '') + '> pin</label>' +
        '<button type="button" data-up="' + i + '">up</button>' +
        '<button type="button" data-dn="' + i + '">down</button>' +
        '<button type="button" data-rm="' + i + '">drop</button></div>';
    }).join('');
    host.querySelectorAll('input[type="text"]').forEach(function (input) {
      input.addEventListener('change', function () {
        try { state.routePieces[Number(input.dataset.i)] = BigInt(input.value.trim()); }
        catch (e) { return; }
        reflow();
      });
    });
    host.querySelectorAll('.pin').forEach(function (box) {
      box.addEventListener('change', function () {
        const p = state.routePieces[Number(box.dataset.i)];
        state.routePinned = state.routePinned.filter(function (x) { return x !== p; });
        if (box.checked) state.routePinned.push(p);
      });
    });
    host.querySelectorAll('[data-up]').forEach(function (b) {
      b.onclick = function () { movePiece(Number(b.dataset.up), -1); };
    });
    host.querySelectorAll('[data-dn]').forEach(function (b) {
      b.onclick = function () { movePiece(Number(b.dataset.dn), 1); };
    });
    host.querySelectorAll('[data-rm]').forEach(function (b) {
      b.onclick = function () {
        state.routePieces.splice(Number(b.dataset.rm), 1);
        reflow();
      };
    });
    if (!built) {
      if (meta) meta.textContent = state.blockedDone ? state.blocked.size + ' blocked holders' : 'holder scan still running';
      if (steps) steps.innerHTML = '';
      return;
    }
    const warn = built.target.toString() === state.routeTarget ? '' : ' sums to ' + built.target + ', not the target.';
    if (meta) meta.textContent = built.mints + ' mints, royalty ' + fmt(built.royalty) + ' ETH, gas ~' + fmt(built.gas) +
      ', msg.value ' + fmt(built.msgValue) + ', net ~' + fmt(built.net) + warn;
    if (steps) {
      steps.innerHTML = built.steps.map(function (s, i) {
        const blocked = state.blocked.has(s.payTo[0]) || state.blocked.has(s.payTo[1]);
        return '<div class="step">' + s.a + ' + ' + s.b + ' = ' + s.result +
          (s.exists ? ' <span class="dim">exists</span>' : '') +
          (blocked ? ' <span class="bad">blocked holder</span>' : '') +
          '<div class="dim">pay ' + short(s.payTo[0]) + ' ' + short(s.payTo[1]) + ' royalty ' + fmt(s.royalty) + '</div>' +
          (s.exists ? '' : '<button type="button" data-step="' + i + '">simulate + send</button>') +
          '</div>';
      }).join('') || '<p class="dim">already minted.</p>';
      steps.querySelectorAll('[data-step]').forEach(function (b) {
        b.onclick = function () { sendStep(built.steps[Number(b.dataset.step)]); };
      });
    }
    const box = $('#preview');
    if (box && state.preview) box.textContent = state.preview;
  }

  function movePiece(i, d) {
    const j = i + d;
    if (j < 0 || j >= state.routePieces.length) return;
    const t = state.routePieces[i];
    state.routePieces[i] = state.routePieces[j];
    state.routePieces[j] = t;
    reflow();
  }

  function reflow() {
    try {
      state.routeBuilt = state.routePieces.length ? P.fold(state.routePieces, ctx()) : null;
      if (state.routeBuilt) state.preview = '';
    } catch (e) {
      state.routeBuilt = null;
      state.preview = e.message;
    }
    if (state.tab === 'route') paintRoute();
  }

  function planRoute() {
    state.routeTarget = $('#target').value.trim();
    let n;
    try { n = BigInt(state.routeTarget); } catch (e) { return; }
    try {
      const built = state.routePinned.length ? P.planWithPins(n, state.routePinned, ctx()) : P.plan(n, ctx());
      state.routePieces = built.pieces.slice();
      state.routeBuilt = built;
      state.preview = '';
      MOLD.say('route', { mints: built.mints, net: fmt(built.net) });
    } catch (e) {
      state.routeBuilt = null;
      state.routePieces = [];
      state.preview = e.message;
    }
    paintRoute();
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

  function syncPlanes() {
    try { state.planes = P.gridToPlanes(state.grid); } catch (e) { state.planes = null; }
  }

  function planeIssues(p) {
    if (!p) return ['grid'];
    const out = [];
    [['R', p.R, state.usedR], ['G', p.G, state.usedG], ['B', p.B, state.usedB]].forEach(function (row) {
      if (row[1] === 0n) out.push(row[0] + ' is 0');
      else if (row[2].has(row[1])) out.push(row[0] + ' already used');
    });
    return out;
  }

  function rgb(view) {
    syncPlanes();
    const p = state.planes || { R: 0n, G: 0n, B: 0n };
    view.innerHTML =
      '<div class="row"><button type="button" id="heart">heart</button>' +
      '<input type="file" id="file" accept="image/*">' +
      '<label><input type="checkbox" id="dither"> dither</label>' +
      '<button type="button" id="apply">apply image</button></div>' +
      '<div class="row"><label>R <input type="range" id="thrR" min="0" max="100" value="50"></label>' +
      '<label>G <input type="range" id="thrG" min="0" max="100" value="50"></label>' +
      '<label>B <input type="range" id="thrB" min="0" max="100" value="50"></label></div>' +
      '<div id="cells"></div>' +
      '<div class="row"><label>R <input id="pR" spellcheck="false" value="' + p.R + '"></label></div>' +
      '<div class="row"><label>G <input id="pG" spellcheck="false" value="' + p.G + '"></label></div>' +
      '<div class="row"><label>B <input id="pB" spellcheck="false" value="' + p.B + '"></label></div>' +
      '<p id="rgbMeta"></p><div id="queue"></div>' +
      '<div class="row"><button type="button" id="planRgb">plan routes</button></div>' +
      '<div class="preview" id="preview">MATH mints, then RGB.add at 0.03 ETH. one click, one signature.</div>';
    $('#cells').innerHTML = cellsHtml(state.grid);
    $('#cells').onclick = function (ev) {
      const btn = ev.target.closest('button');
      if (!btn) return;
      const i = Number(btn.dataset.i);
      const y = Math.floor(i / 16);
      const x = i % 16;
      const cur = P.PAL.indexOf(state.grid[y][x]);
      const next = P.PAL[(cur + 1) % P.PAL.length];
      const row = state.grid[y].split('');
      row[x] = next;
      state.grid[y] = row.join('');
      btn.className = next;
      syncPlanes();
      writePlaneInputs();
      $('#rgbMeta').textContent = planeIssues(state.planes).join(', ');
    };
    $('#heart').onclick = function () {
      state.grid = P.HEART.slice();
      show('rgb');
    };
    $('#file').onchange = function () {
      const file = $('#file').files && $('#file').files[0];
      if (!file) return;
      const img = new Image();
      img.onload = function () {
        state.sample = sampleImage(img);
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    };
    $('#apply').onclick = function () {
      if (!state.sample) return;
      const px = new Float32Array(state.sample);
      const thr = [Number($('#thrR').value) / 100, Number($('#thrG').value) / 100, Number($('#thrB').value) / 100];
      const dither = $('#dither').checked;
      const chars = new Array(256);
      for (let i = 0; i < 256; i++) {
        const y = Math.floor(i / 16);
        const x = i % 16;
        let bits = 0;
        for (let c = 0; c < 3; c++) {
          const v = px[i * 3 + c];
          const on = v >= thr[c] ? 1 : 0;
          bits |= on << (2 - c);
          if (dither) {
            const err = v - on;
            [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]].forEach(function (d) {
              const xx = x + d[0];
              const yy = y + d[1];
              if (xx < 0 || xx > 15 || yy > 15) return;
              const j = yy * 16 + xx;
              px[j * 3 + c] += err * d[2] / 16;
            });
          }
        }
        chars[i] = P.PAL[bits];
      }
      state.grid = [];
      for (let y = 0; y < 16; y++) state.grid.push(chars.slice(y * 16, y * 16 + 16).join(''));
      show('rgb');
    };
    ['pR', 'pG', 'pB'].forEach(function (id) {
      $('#' + id).addEventListener('change', function () {
        try {
          const R = BigInt($('#pR').value.trim());
          const G = BigInt($('#pG').value.trim());
          const B = BigInt($('#pB').value.trim());
          state.grid = P.planesToRows(R, G, B);
          state.planes = { R: R, G: G, B: B };
          show('rgb');
        } catch (e) { /* keep grid */ }
      });
    });
    $('#planRgb').onclick = planRgb;
    const issues = planeIssues(state.planes);
    $('#rgbMeta').textContent = issues.join(', ');
    paintQueue();
  }

  function writePlaneInputs() {
    if (!state.planes || !$('#pR')) return;
    $('#pR').value = state.planes.R.toString();
    $('#pG').value = state.planes.G.toString();
    $('#pB').value = state.planes.B.toString();
  }

  function sampleImage(img) {
    const canvas = document.createElement('canvas');
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const data = g.getImageData(0, 0, w, h).data;
    const src = new Float32Array(256 * 3);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const x0 = Math.floor(x * w / 16);
        const x1 = Math.max(x0 + 1, Math.floor((x + 1) * w / 16));
        const y0 = Math.floor(y * h / 16);
        const y1 = Math.max(y0 + 1, Math.floor((y + 1) * h / 16));
        let r = 0, gc = 0, b = 0, n = 0;
        for (let yy = y0; yy < y1; yy++) {
          for (let xx = x0; xx < x1; xx++) {
            const i = (yy * w + xx) * 4;
            r += data[i];
            gc += data[i + 1];
            b += data[i + 2];
            n++;
          }
        }
        const o = (y * 16 + x) * 3;
        src[o] = r / n / 255;
        src[o + 1] = gc / n / 255;
        src[o + 2] = b / n / 255;
      }
    }
    return src;
  }

  function planRgb() {
    syncPlanes();
    const issues = planeIssues(state.planes);
    const meta = $('#rgbMeta');
    if (issues.length) {
      if (meta) meta.textContent = issues.join(', ');
      MOLD.say('rgbBad', { why: issues[0] });
      state.queue = [];
      paintQueue();
      return;
    }
    const p = state.planes;
    try {
      const routes = [p.R, p.G, p.B].map(function (n) { return P.plan(n, ctx()); });
      const have = new Set(state.supply.keys());
      const queue = [];
      routes.forEach(function (route) {
        route.steps.forEach(function (step) {
          if (step.exists || have.has(step.result)) {
            have.add(step.result);
            return;
          }
          queue.push({ kind: 'math', step: step });
          have.add(step.result);
        });
      });
      queue.push({ kind: 'rgb', r: p.R, g: p.G, b: p.B });
      state.queue = queue;
      let roy = 0n;
      let mathMints = 0;
      queue.forEach(function (item) {
        if (item.kind !== 'math') return;
        roy += item.step.royalty;
        mathMints++;
      });
      [p.R, p.G, p.B].forEach(function (id) {
        const owner = state.supply.get(id);
        const minted = queue.some(function (item) { return item.kind === 'math' && item.step.result === id; });
        if (!(owner === me() || minted)) roy += P.RGB_ROY;
      });
      const net = P.G_ADD * state.gasPrice * BigInt(mathMints) + P.G_RGB * state.gasPrice + roy;
      if (meta) meta.textContent = queue.length + ' txs. net ~' + fmt(net) + ' ETH. the wallet still shows 0.002 or 0.03 on each send.';
    } catch (e) {
      state.queue = [];
      if (meta) meta.textContent = e.message;
    }
    paintQueue();
  }

  function paintQueue() {
    const host = $('#queue');
    if (!host) return;
    host.innerHTML = state.queue.map(function (tx, i) {
      if (tx.kind === 'math') {
        const s = tx.step;
        return '<div class="step">' + (i + 1) + '. ' + s.a + ' + ' + s.b + ' = ' + s.result +
          ' <button type="button" data-q="' + i + '">simulate + send</button></div>';
      }
      return '<div class="step">' + (i + 1) + '. RGB.add ' + tx.r + ', ' + tx.g + ', ' + tx.b +
        ' value 0.03 <button type="button" data-q="' + i + '">simulate + send</button></div>';
    }).join('');
    host.querySelectorAll('[data-q]').forEach(function (b) {
      b.onclick = function () { sendQueue(Number(b.dataset.q)); };
    });
  }

  async function sendQueue(i) {
    const item = state.queue[i];
    if (!item) return;
    if (item.kind === 'math') {
      await sendStep(item.step);
      return;
    }
    const preview = 'RGB.add(' + item.r + ', ' + item.g + ', ' + item.b + ')\nto ' + ADDR.RGB + '\nvalue 0.03 ETH';
    state.preview = preview;
    if ($('#preview')) $('#preview').textContent = preview + '\nre-checking planes.';
    await guardSend(async function () {
      const owners = await Promise.all([
        ETH.ownerOf(ADDR.MATH, item.r),
        ETH.ownerOf(ADDR.MATH, item.g),
        ETH.ownerOf(ADDR.MATH, item.b),
      ]);
      if (owners.some(function (o) { return !o; })) throw new Error('a plane is not minted yet');
      const tx = {
        from: state.account,
        to: ADDR.RGB,
        data: ABI.call(ABI.SEL.add3, [item.r, item.g, item.b]),
        value: hex(P.MSG_RGB),
      };
      const sim = await ETH.simulate(tx);
      if (sim.error) throw new Error(ETH.reason(sim.error));
      if ($('#preview')) $('#preview').textContent = preview + '\nsimulation ok. confirm in the wallet.';
      const hash = await ETH.send(tx);
      noteSent(hash);
    });
  }

  function opt(ids, used, label) {
    return ids.map(function (id) {
      const spent = used.has(id);
      return '<option value="' + id + '"' + (spent ? ' disabled' : '') + '>' + label(id) + (spent ? ' used' : '') + '</option>';
    }).join('');
  }

  function toon(view) {
    const m = me();
    const maths = state.math.filter(function (t) { return t.owner === m; }).map(function (t) { return t.id; });
    const rgbs = state.rgb.filter(function (t) { return t.owner === m; }).map(function (t) { return t.id; });
    view.innerHTML =
      '<div class="row"><label>MATH <select id="tm"><option value="">—</option>' + opt(maths, state.usedMath, function (id) { return id; }) + '</select></label></div>' +
      '<div class="row"><label>WORD <select id="tw"><option value="">—</option>' + opt(state.words, state.usedWord, function (id) { return id; }) + '</select></label>' +
      '<span class="dim">' + esc(state.wordNote) + '</span></div>' +
      '<div class="row"><label>FACE <select id="tf"><option value="">—</option>' + opt(state.faces, state.usedFace, function (id) { return id; }) + '</select></label>' +
      '<span class="dim">' + esc(state.faceNote) + '</span></div>' +
      '<div class="row"><label>RGB <select id="tr"><option value="">—</option>' + opt(rgbs, state.usedRgb, function (id) { return id; }) + '</select></label></div>' +
      '<div id="toonPrev"></div>' +
      '<div class="preview" id="preview">TOON.add has no fee. you must own all four. used word, face, and rgb stay grey.</div>' +
      '<div class="row"><button type="button" id="simToon">simulate</button><button type="button" id="sendToon">send add</button></div>';
    ['tm', 'tw', 'tf', 'tr'].forEach(function (id) { $('#' + id).addEventListener('change', previewToon); });
    $('#simToon').onclick = function () { sendToon(false); };
    $('#sendToon').onclick = function () { sendToon(true); };
    if (!state.account) MOLD.say('noWallet');
  }

  async function previewToon() {
    const word = $('#tw').value;
    const face = $('#tf').value;
    const rgb = $('#tr').value;
    const math = $('#tm').value;
    const host = $('#toonPrev');
    if (!host) return;
    let wordText = '';
    let faceText = '';
    try {
      if (word) wordText = await ETH.readString(ADDR.WORD, ABI.SEL.getWord, word);
      if (face) faceText = await ETH.readString(ADDR.FACE, ABI.SEL.getFace, face);
    } catch (e) {
      host.textContent = e.message;
      return;
    }
    let grid = '';
    if (rgb) {
      const tok = state.rgb.find(function (t) { return t.id.toString() === rgb; });
      if (tok) grid = cellsHtml(P.planesToRows(tok.r, tok.g, tok.b)).replace(/<button/g, '<i').replace(/<\/button>/g, '</i>');
    }
    host.innerHTML = '<p>' + esc(wordText || '…') + '</p><div class="face">' + esc(faceText || '') + '</div>' +
      (math ? bitHtml(math) : '') + grid;
  }

  function toonPick() {
    const math = $('#tm') && $('#tm').value;
    const word = $('#tw') && $('#tw').value;
    const face = $('#tf') && $('#tf').value;
    const rgb = $('#tr') && $('#tr').value;
    if (!math || !word || !face || !rgb) return null;
    return { math: BigInt(math), word: BigInt(word), face: BigInt(face), rgb: BigInt(rgb) };
  }

  async function sendToon(really) {
    const pick = toonPick();
    const preview = pick
      ? 'TOON.add(' + pick.math + ', ' + pick.word + ', ' + pick.face + ', ' + pick.rgb + ')\nto ' + ADDR.TOON + '\nvalue 0'
      : 'pick four tokens.';
    state.preview = preview;
    if ($('#preview')) $('#preview').textContent = preview;
    if (!pick) return;
    if (!really) {
      if (!state.account) { MOLD.say('noWallet'); return; }
      try {
        const tx = toonTx(pick);
        const sim = await ETH.simulate(tx);
        if (sim.error) {
          $('#preview').textContent = preview + '\nsimulation reverted: ' + ETH.reason(sim.error);
          MOLD.say('simFail', { err: ETH.reason(sim.error) });
          return;
        }
        $('#preview').textContent = preview + '\nsimulation ok.';
        MOLD.say('simOk');
      } catch (e) {
        $('#preview').textContent = preview + '\n' + e.message;
      }
      return;
    }
    await guardSend(async function () {
      const owners = await Promise.all([
        ETH.ownerOf(ADDR.MATH, pick.math),
        ETH.ownerOf(ADDR.WORD, pick.word),
        ETH.ownerOf(ADDR.FACE, pick.face),
        ETH.ownerOf(ADDR.RGB, pick.rgb),
      ]);
      const who = me();
      if (owners.some(function (o) { return o !== who; })) throw new Error('you do not own all four');
      const tx = toonTx(pick);
      const sim = await ETH.simulate(tx);
      if (sim.error) throw new Error(ETH.reason(sim.error));
      if ($('#preview')) $('#preview').textContent = preview + '\nsimulation ok. confirm in the wallet.';
      const hash = await ETH.send(tx);
      noteSent(hash);
    });
  }

  function toonTx(pick) {
    return {
      from: state.account,
      to: ADDR.TOON,
      data: ABI.call(ABI.SEL.add4, [pick.math, pick.word, pick.face, pick.rgb]),
    };
  }

  function about(view) {
    view.innerHTML =
      '<p>1 + 1 = 2</p>' +
      '<p>Reads use Multicall3 against a public Ethereum node. Writes go through the injected wallet. Nothing on this page can sign, and it holds no key.</p>' +
      '<p>Drawing with MATH started with <a href="https://kaigani.medium.com/drawing-with-math-64965b3f0fae">kaigani, 2019</a>.</p>' +
      '<p class="dim">GitHub Pages serves <span>site/</span>. A CNAME for math.alxo.city is a follow-up, not set here.</p>' +
      '<p class="dim">MATH ' + ADDR.MATH + '<br>RGB ' + ADDR.RGB + '<br>TOON ' + ADDR.TOON +
      '<br>WORD ' + ADDR.WORD + '<br>FACE ' + ADDR.FACE +
      '<br>render ' + ADDR.MATH_RENDER + '<br>' + ADDR.RGB_RENDER + '<br>' + ADDR.TOON_RENDER + '</p>' +
      '<div class="row"><label>rpc <input id="rpc" size="42" spellcheck="false" value="' + esc(ETH.rpcUrl()) + '"></label>' +
      '<button type="button" id="saveRpc">save</button></div>';
    $('#saveRpc').onclick = function () {
      const u = $('#rpc').value.trim();
      if (!/^https:\/\//.test(u)) return;
      localStorage.setItem('math.site.rpc', u);
      setStatus('rpc saved');
    };
  }

  async function connect() {
    if (!globalThis.ethereum) {
      MOLD.say('noWallet');
      setStatus('no wallet');
      return;
    }
    const acc = await ethereum.request({ method: 'eth_requestAccounts' });
    state.account = acc[0];
    $('#who').textContent = short(state.account);
    try { await ETH.ensureChain(); } catch (e) { setStatus(e.message); }
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
        const issues = planeIssues(state.planes);
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
        if (a && b) { a.value = '1'; b.value = '1'; paintMint(false); }
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
      ethereum.request({ method: 'eth_accounts' }).then(function (acc) {
        if (acc && acc[0]) {
          state.account = acc[0];
          $('#who').textContent = short(state.account);
          loadWallet();
        }
      }).catch(function () {});
      ethereum.on && ethereum.on('accountsChanged', function (acc) {
        state.account = acc && acc[0] ? acc[0] : null;
        $('#who').textContent = state.account ? short(state.account) : '';
        if (state.account) loadWallet();
      });
    }
    if (!cached) refresh();
  }

  boot();
})();
