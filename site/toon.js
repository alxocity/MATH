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

  function toon(view) {
    const maths = listed(state.math, state.heldMath);
    const rgbs = listed(state.rgb, state.heldRgb);
    view.innerHTML =
      '<div class="row"><label>MATH <select id="tm"><option value="">—</option>' + opt(maths, 'math', function (id) { return id; }) + '</select></label></div>' +
      '<div class="row"><label>WORD <select id="tw"><option value="">—</option>' + opt(state.words, 'word', function (id) { return state.wordText.get(BigInt(id)) || id; }) + '</select></label>' +
      '<span class="dim">' + S.esc(state.wordNote) + '</span></div>' +
      '<div class="row"><label>FACE <select id="tf"><option value="">—</option>' + opt(state.faces, 'face', function (id) { return state.faceText.get(BigInt(id)) || id; }) + '</select></label>' +
      '<span class="dim">' + S.esc(state.faceNote) + '</span></div>' +
      '<div class="row"><label>RGB <select id="tr"><option value="">—</option>' + opt(rgbs, 'rgb', rgbLabel) + '</select></label></div>' +
      '<div id="toonPrev"></div>' +
      '<div class="preview" id="preview">TOON.add has no fee. you must own all four. grey picks say why.</div>' +
      '<div class="row"><button type="button" id="simToon">simulate</button><button type="button" id="sendToon">send add</button>' +
      '<span id="toonWhy" class="bad"></span></div>';
    ['tm', 'tw', 'tf', 'tr'].forEach(function (id) { $('#' + id).addEventListener('change', previewToon); });
    $('#simToon').onclick = function () { sendToon(false); };
    $('#sendToon').onclick = function () { sendToon(true); };
    paintToonWhy();
    if (!state.account) MOLD.say('noWallet');
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

  async function previewToon() {
    const pick = toonPick();
    state.toonOwn = '';
    if (pick && state.account && !spentReason()) confirmOwn(pick);
    const why = toonWhy(pick);
    paintToonWhy();
    S.hit(why);
    if (why) return;
    const word = $('#tw').value;
    const face = $('#tf').value;
    const rgb = $('#tr').value;
    const math = $('#tm').value;
    const host = $('#toonPrev');
    if (!host) return;
    let wordText = '';
    let faceText = '';
    try {
      if (word) wordText = await cachedText(state.wordText, ADDR.WORD, ABI.SEL.getWord, word);
      if (face) faceText = await cachedText(state.faceText, ADDR.FACE, ABI.SEL.getFace, face);
    } catch (e) {
      host.textContent = e.message;
      return;
    }
    if (wordText || faceText) MOLD.say('toonPick', { word: wordText || '…', face: faceText || '…' });
    let grid = '';
    if (rgb) {
      const tok = state.rgb.find(function (t) { return t.id.toString() === rgb; });
      if (tok) grid = S.cellsHtml(P.planesToRows(tok.r, tok.g, tok.b)).replace(/<button/g, '<i').replace(/<\/button>/g, '</i>');
    }
    host.innerHTML = '<p>' + S.esc(wordText || '…') + '</p><div class="face">' + S.esc(faceText || '') + '</div>' +
      (math ? S.bitHtml(math) : '') + grid;
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
})();
