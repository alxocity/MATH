(function () {
  const S = globalThis.SITE;
  const state = S.state;
  const $ = S.$;
  const ETH = globalThis.ETH;
  const P = globalThis.PLAN;
  const ABI = globalThis.ABI;
  const ADDR = ETH.ADDR;
  const RULES = globalThis.RULES;

  function opt(ids, kind, label) {
    return ids.map(function (id) {
      const reason = RULES.toonPart(kind, id, state.toonBy[kind]);
      return '<option value="' + id + '"' + (reason ? ' class="spent"' : '') + '>' +
        S.esc(label(id)) + (reason ? ' — ' + S.esc(reason) : '') + '</option>';
    }).join('');
  }

  function spentReason() {
    const rows = [['tm', 'math'], ['tw', 'word'], ['tf', 'face'], ['tr', 'rgb']];
    for (let i = 0; i < rows.length; i++) {
      const el = $('#' + rows[i][0]);
      if (!el || !el.value) continue;
      const reason = RULES.toonPart(rows[i][1], el.value, state.toonBy[rows[i][1]]);
      if (reason) return reason;
    }
    return '';
  }

  function listed(rows, held) {
    const m = S.me();
    const ids = [];
    const seen = new Set();
    rows.forEach(function (t) {
      if (t.owner !== m) return;
      const s = t.id.toString();
      if (seen.has(s)) return;
      seen.add(s);
      ids.push(t.id);
    });
    (held || []).forEach(function (id) {
      const s = id.toString();
      if (seen.has(s)) return;
      seen.add(s);
      ids.push(id);
    });
    return ids;
  }

  let ownGen = 0;

  function toonWhy(pick) {
    const spent = spentReason();
    if (spent) return spent;
    if (!state.account) return RULES.connectWallet();
    if (!pick) return '';
    if (state.toonOwn) return state.toonOwn;
    return RULES.toonPart('math', pick.math, state.toonBy.math) ||
      RULES.toonPart('word', pick.word, state.toonBy.word) ||
      RULES.toonPart('face', pick.face, state.toonBy.face) ||
      RULES.toonPart('rgb', pick.rgb, state.toonBy.rgb);
  }

  async function confirmOwn(pick) {
    const gen = ++ownGen;
    let owners;
    try {
      owners = await Promise.all([
        ETH.ownerOf(ADDR.MATH, pick.math),
        ETH.ownerOf(ADDR.WORD, pick.word),
        ETH.ownerOf(ADDR.FACE, pick.face),
        ETH.ownerOf(ADDR.RGB, pick.rgb),
      ]);
    } catch (e) {
      return;
    }
    if (gen !== ownGen) return;
    const who = S.me();
    state.toonOwn = owners.every(function (o) { return o === who; }) ? '' : RULES.notYours();
    paintToonWhy();
    if (state.toonOwn) S.hit(state.toonOwn);
  }

  function paintToonWhy() {
    const why = toonWhy(toonPick());
    const btn = $('#sendToon');
    const el = $('#toonWhy');
    if (btn) btn.disabled = !!why;
    if (el) el.textContent = why;
  }

  let toonHint = null;
  let catalog = null;
  let catalogJob = null;
  let toonFillGen = 0;

  function paintToonHint(example, note) {
    const el = $('#hintNote');
    if (el) el.textContent = note || (example ? 'example' : '');
  }

  function pullIds(address) {
    return ETH.ethCall(address, '0x' + ABI.SEL.totalSupply).then(function (raw) {
      const n = Number(ABI.decodeUint(raw));
      if (!Number.isSafeInteger(n) || n <= 0) return [];
      const take = Math.min(n, 48);
      const calls = [];
      const seen = new Set();
      for (let i = 0; i < take; i++) {
        const idx = Math.min(n - 1, Math.floor(i * n / take));
        if (seen.has(idx)) continue;
        seen.add(idx);
        calls.push({ to: address, data: ABI.call(ABI.SEL.tokenByIndex, [idx]), allow: true });
      }
      return ETH.ethCall(ADDR.MULTI, ABI.encodeAggregate(calls)).then(function (res) {
        const ids = [];
        ABI.decodeAggregate(res).forEach(function (row) {
          if (row && row.success) ids.push(ABI.decodeUint(row.data));
        });
        return ids;
      });
    });
  }

  function loadCatalog() {
    if (catalog) return Promise.resolve(catalog);
    if (catalogJob) return catalogJob;
    catalogJob = Promise.all([pullIds(ADDR.WORD), pullIds(ADDR.FACE)]).then(function (pair) {
      catalog = { words: pair[0], faces: pair[1] };
      return catalog;
    }, function () {
      catalogJob = null;
      return { words: [], faces: [] };
    });
    return catalogJob;
  }

  function choose(el, id) {
    const v = id.toString();
    let has = false;
    for (let i = 0; i < el.options.length; i++) if (el.options[i].value === v) has = true;
    if (!has) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = v;
      el.appendChild(o);
    }
    el.value = v;
  }

  function toonCtx() {
    const maths = state.account ? listed(state.math, state.heldMath) : state.math.map(function (t) { return t.id; });
    const rgbs = state.account ? listed(state.rgb, state.heldRgb) : state.rgb.map(function (t) { return t.id; });
    return {
      maths: maths,
      words: state.account ? state.words.slice() : (catalog ? catalog.words : []),
      faces: state.account ? state.faces.slice() : (catalog ? catalog.faces : []),
      rgbs: rgbs,
      used: state.toonBy,
    };
  }

  function hintLock(hint) {
    return { math: hint.math, word: hint.word, face: hint.face, rgb: hint.rgb };
  }

  function applyToon(advance) {
    const tm = $('#tm');
    const tw = $('#tw');
    const tf = $('#tf');
    const tr = $('#tr');
    if (!tm || !tw || !tf || !tr) return;
    const example = !state.account;
    const free = {
      math: SUGGEST.fieldFree(tm.value, toonHint && toonHint.ownMath ? toonHint.math : null),
      word: SUGGEST.fieldFree(tw.value, toonHint && toonHint.ownWord ? toonHint.word : null),
      face: SUGGEST.fieldFree(tf.value, toonHint && toonHint.ownFace ? toonHint.face : null),
      rgb: SUGGEST.fieldFree(tr.value, toonHint && toonHint.ownRgb ? toonHint.rgb : null),
    };
    if (!free.math && !free.word && !free.face && !free.rgb) {
      paintToonHint(false, '');
      return;
    }
    const ctx = toonCtx();
    if (!advance && toonHint && toonHint.ownMath && toonHint.ownWord && toonHint.ownFace && toonHint.ownRgb &&
      SUGGEST.toonTuple(ctx, { lock: hintLock(toonHint) })) {
      if (free.math) choose(tm, toonHint.math);
      if (free.word) choose(tw, toonHint.word);
      if (free.face) choose(tf, toonHint.face);
      if (free.rgb) choose(tr, toonHint.rgb);
      const pure = tm.value === String(toonHint.math) && tw.value === String(toonHint.word) &&
        tf.value === String(toonHint.face) && tr.value === String(toonHint.rgb);
      paintToonHint(example && pure, '');
      if (free.math || free.word || free.face || free.rgb) previewToon();
      return;
    }
    let cursor = null;
    if (advance && toonHint &&
      (free.math || tm.value === String(toonHint.math)) &&
      (free.word || tw.value === String(toonHint.word)) &&
      (free.face || tf.value === String(toonHint.face)) &&
      (free.rgb || tr.value === String(toonHint.rgb))) {
      try {
        cursor = {
          math: BigInt(toonHint.math),
          word: BigInt(toonHint.word),
          face: BigInt(toonHint.face),
          rgb: BigInt(toonHint.rgb),
        };
      } catch (e) { cursor = null; }
    }
    const next = SUGGEST.toonTuple(ctx, {
      cursor: cursor,
      lock: {
        math: free.math ? null : tm.value,
        word: free.word ? null : tw.value,
        face: free.face ? null : tf.value,
        rgb: free.rgb ? null : tr.value,
      },
    });
    if (!next) {
      const stale = toonHint && !SUGGEST.toonTuple(ctx, { lock: hintLock(toonHint) });
      if (stale) {
        if (free.math) tm.value = '';
        if (free.word) tw.value = '';
        if (free.face) tf.value = '';
        if (free.rgb) tr.value = '';
        toonHint = null;
      }
      paintToonHint(false, advance && toonHint ? 'nothing else' : 'nothing to suggest');
      return;
    }
    if (free.math) choose(tm, next.math);
    if (free.word) choose(tw, next.word);
    if (free.face) choose(tf, next.face);
    if (free.rgb) choose(tr, next.rgb);
    toonHint = {
      math: tm.value,
      word: tw.value,
      face: tf.value,
      rgb: tr.value,
      ownMath: !!free.math,
      ownWord: !!free.word,
      ownFace: !!free.face,
      ownRgb: !!free.rgb,
      example: example,
    };
    paintToonHint(example && free.math && free.word && free.face && free.rgb, '');
    previewToon();
  }

  function fillToon(advance) {
    const gen = ++toonFillGen;
    const example = !state.account;
    if (toonHint && toonHint.example !== example) toonHint = null;
    const job = example ? loadCatalog() : Promise.resolve(null);
    job.then(function () {
      if (gen !== toonFillGen || !$('#tm')) return;
      applyToon(advance);
    }, function () {
      if (gen !== toonFillGen || !$('#tm')) return;
      applyToon(advance);
    });
  }

  function toon(view) {
    const maths = listed(state.math, state.heldMath);
    const rgbs = listed(state.rgb, state.heldRgb);
    view.innerHTML =
      '<div class="row"><label class="num">MATH <select id="tm"><option value="">—</option>' + opt(maths, 'math', function (id) { return id; }) + '</select></label></div>' +
      '<div class="row"><label class="num">WORD <select id="tw"><option value="">—</option>' + opt(state.words, 'word', function (id) { return state.wordText.get(BigInt(id)) || id; }) + '</select></label>' +
      '<span class="dim">' + S.esc(state.wordNote) + '</span></div>' +
      '<div class="row"><label class="num">FACE <select id="tf"><option value="">—</option>' + opt(state.faces, 'face', function (id) { return state.faceText.get(BigInt(id)) || id; }) + '</select></label>' +
      '<span class="dim">' + S.esc(state.faceNote) + '</span></div>' +
      '<div class="row"><label class="num">RGB <select id="tr"><option value="">—</option>' + opt(rgbs, 'rgb', rgbLabel) + '</select></label></div>' +
      '<div class="row"><button type="button" id="suggest">suggest another</button><span id="hintNote" class="dim"></span></div>' +
      '<div id="toonPrev"><p class="dim toon-wait">pick four.</p></div>' +
      '<div class="preview" id="preview">TOON.add has no fee. you must own all four. grey picks say why.' + S.mark('ⓘ', S.TIPS.fees) + '</div>' +
      '<div class="row"><button type="button" id="simToon">simulate</button>' + S.mark('ⓘ', S.TIPS.simulate) + '<button type="button" id="sendToon">send add</button>' +
      '<span id="toonWhy" class="bad"></span></div>';
    ['tm', 'tw', 'tf', 'tr'].forEach(function (id) {
      $('#' + id).addEventListener('change', function () {
        const el = $('#hintNote');
        if (el && el.textContent === 'example' && toonHint &&
          ($('#tm').value !== toonHint.math || $('#tw').value !== toonHint.word ||
           $('#tf').value !== toonHint.face || $('#tr').value !== toonHint.rgb)) el.textContent = '';
        previewToon();
      });
    });
    $('#suggest').onclick = function () { fillToon(true); };
    $('#simToon').onclick = function () { sendToon(false); };
    $('#sendToon').onclick = function () { sendToon(true); };
    paintToonWhy();
    if (state.arm && state.arm.kind === 'toon') {
      const el = $('#' + state.arm.slot);
      const v = String(state.arm.id);
      state.arm = null;
      if (el) {
        let has = false;
        for (let i = 0; i < el.options.length; i++) if (el.options[i].value === v) has = true;
        if (!has) {
          const o = document.createElement('option');
          o.value = v;
          o.textContent = v;
          el.appendChild(o);
        }
        el.value = v;
        previewToon();
      }
    }
    if (!state.account) MOLD.say('noWallet');
    fillToon(false);
  }

  function rgbLabel(id) {
    const tok = state.rgb.find(function (t) { return t.id.toString() === String(id); });
    if (!tok) return String(id);
    return id + ' · r' + P.popcount(tok.r) + ' g' + P.popcount(tok.g) + ' b' + P.popcount(tok.b);
  }

  async function cachedText(map, address, sel, id) {
    const key = BigInt(id);
    if (map.has(key)) return map.get(key);
    const text = await ETH.readString(address, sel, key);
    map.set(key, text);
    S.persistTexts();
    return text;
  }

  const tones = new Map();
  const toneWait = new Map();
  let prevGen = 0;

  function rgbPlanes(id) {
    const s = String(id);
    const tok = state.rgb.find(function (t) { return t.id.toString() === s; });
    if (!tok) return null;
    return { r: tok.r, g: tok.g, b: tok.b };
  }

  function readPlanes(id) {
    return ETH.ethCall(ADDR.RGB, ABI.call(ABI.SEL.get, [BigInt(id)])).then(function (raw) {
      const w = ABI.wordsOf(raw);
      if (w.length < 3) throw new Error('rgb');
      return { r: w[0], g: w[1], b: w[2] };
    });
  }

  function readTone(id) {
    const key = BigInt(id);
    if (tones.has(key)) return Promise.resolve(tones.get(key));
    const pending = toneWait.get(key);
    if (pending) return pending;
    const job = Promise.all([
      ETH.ethCall(ADDR.FACE, ABI.call(ABI.SEL.getBackgroundColor, [key])),
      ETH.ethCall(ADDR.FACE, ABI.call(ABI.SEL.getTextColor, [key])),
    ]).then(function (pair) {
      const tone = { bg: ABI.decodeUint(pair[0]), fg: ABI.decodeUint(pair[1]) };
      tones.set(key, tone);
      return tone;
    });
    job.then(function () { toneWait.delete(key); }, function () { toneWait.delete(key); });
    toneWait.set(key, job);
    return job;
  }

  function quiet(p) {
    return Promise.resolve(p).then(function (v) { return v; }, function () { return null; });
  }

  function showSvg(host, planes, face, tone) {
    const fg = tone ? tone.fg : 0n;
    let xml = TOONR.svg(planes.r, planes.g, planes.b, face || '', tone ? tone.bg : 0n, fg);
    if (!tone) xml = xml.replace('#' + TOONR.textHex(fg), '#' + TOONR.lightHex(fg));
    host.innerHTML = '<img class="toon" alt="toon" src="' + S.svgUrl(xml) + '">' +
      (tone ? '' : '<p class="dim">colors unavailable</p>');
  }

  async function previewToon() {
    const gen = ++prevGen;
    state.toonOwn = '';
    const pick = toonPick();
    if (pick && state.account && !spentReason()) confirmOwn(pick);
    paintToonWhy();
    S.hit(toonWhy(pick));
    const host = $('#toonPrev');
    if (!host) return;
    if (!pick) {
      host.innerHTML = '<p class="dim toon-wait">pick four.</p>';
      return;
    }
    const known = rgbPlanes(pick.rgb);
    const got = await Promise.all([
      quiet(cachedText(state.wordText, ADDR.WORD, ABI.SEL.getWord, pick.word)),
      quiet(cachedText(state.faceText, ADDR.FACE, ABI.SEL.getFace, pick.face)),
      known ? known : quiet(readPlanes(pick.rgb)),
      quiet(readTone(pick.face)),
    ]);
    if (gen !== prevGen) return;
    const wordText = got[0];
    const faceText = got[1];
    const planes = got[2];
    const tone = got[3];
    if (wordText || faceText) MOLD.say('toonPick', { word: wordText || '…', face: faceText || '…' });
    if (!planes) {
      host.textContent = 'rgb unavailable';
      return;
    }
    showSvg(host, planes, faceText || '', tone);
  }

  function toonPick() {
    const math = $('#tm') && $('#tm').value;
    const word = $('#tw') && $('#tw').value;
    const face = $('#tf') && $('#tf').value;
    const rgb = $('#tr') && $('#tr').value;
    if (!math || !word || !face || !rgb) return null;
    return { math: BigInt(math), word: BigInt(word), face: BigInt(face), rgb: BigInt(rgb) };
  }

  function toonTx(pick) {
    return {
      from: state.account,
      to: ADDR.TOON,
      data: ABI.call(ABI.SEL.add4, [pick.math, pick.word, pick.face, pick.rgb]),
    };
  }

  async function sendToon(really) {
    const pick = toonPick();
    if (pick && state.account && !spentReason()) await confirmOwn(pick);
    const why = toonWhy(pick);
    S.hit(why);
    const preview = pick
      ? 'TOON.add(' + pick.math + ', ' + pick.word + ', ' + pick.face + ', ' + pick.rgb + ')\n' +
        (state.wordText.get(pick.word) || pick.word) + ' · ' + (state.faceText.get(pick.face) || pick.face) +
        '\nto ' + ADDR.TOON + '\nvalue 0'
      : 'pick four tokens.';
    state.preview = preview;
    if ($('#preview')) $('#preview').textContent = why ? preview + '\n' + why : preview;
    if (why || !pick) return;
    if (!really) {
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
    await S.guardSend(async function () {
      const owners = await Promise.all([
        ETH.ownerOf(ADDR.MATH, pick.math),
        ETH.ownerOf(ADDR.WORD, pick.word),
        ETH.ownerOf(ADDR.FACE, pick.face),
        ETH.ownerOf(ADDR.RGB, pick.rgb),
      ]);
      const who = S.me();
      if (owners.some(function (o) { return o !== who; })) throw new Error('you do not own all four');
      const tx = toonTx(pick);
      const sim = await ETH.simulate(tx);
      if (sim.error) throw new Error(ETH.reason(sim.error));
      if ($('#preview')) $('#preview').textContent = preview + '\nsimulation ok. confirm in the wallet.';
      const hash = await ETH.send(tx);
      S.noteSent(hash);
    });
  }

  S.toon = toon;
  S.fillToon = fillToon;
})();
