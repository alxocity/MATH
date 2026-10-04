(function () {
  const S = globalThis.SITE;
  const state = S.state;
  const $ = S.$;
  const ETH = globalThis.ETH;
  const P = globalThis.PLAN;
  const ABI = globalThis.ABI;
  const ADDR = ETH.ADDR;

  function opt(ids, used, label) {
    return ids.map(function (id) {
      const spent = used.has(id);
      return '<option value="' + id + '"' + (spent ? ' disabled' : '') + '>' + S.esc(label(id)) + (spent ? ' used' : '') + '</option>';
    }).join('');
  }

  function toon(view) {
    const m = S.me();
    const maths = state.math.filter(function (t) { return t.owner === m; }).map(function (t) { return t.id; });
    const rgbs = state.rgb.filter(function (t) { return t.owner === m; }).map(function (t) { return t.id; });
    view.innerHTML =
      '<div class="row"><label>MATH <select id="tm"><option value="">—</option>' + opt(maths, state.usedMath, function (id) { return id; }) + '</select></label></div>' +
      '<div class="row"><label>WORD <select id="tw"><option value="">—</option>' + opt(state.words, state.usedWord, function (id) { return state.wordText.get(BigInt(id)) || id; }) + '</select></label>' +
      '<span class="dim">' + S.esc(state.wordNote) + '</span></div>' +
      '<div class="row"><label>FACE <select id="tf"><option value="">—</option>' + opt(state.faces, state.usedFace, function (id) { return state.faceText.get(BigInt(id)) || id; }) + '</select></label>' +
      '<span class="dim">' + S.esc(state.faceNote) + '</span></div>' +
      '<div class="row"><label>RGB <select id="tr"><option value="">—</option>' + opt(rgbs, state.usedRgb, rgbLabel) + '</select></label></div>' +
      '<div id="toonPrev"></div>' +
      '<div class="preview" id="preview">TOON.add has no fee. you must own all four. used word, face, and rgb stay grey.' + S.mark('ⓘ', S.TIPS.fees) + '</div>' +
      '<div class="row"><button type="button" id="simToon">simulate</button>' + S.mark('ⓘ', S.TIPS.simulate) + '<button type="button" id="sendToon">send add</button></div>';
    ['tm', 'tw', 'tf', 'tr'].forEach(function (id) { $('#' + id).addEventListener('change', previewToon); });
    $('#simToon').onclick = function () { sendToon(false); };
    $('#sendToon').onclick = function () { sendToon(true); };
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
    const preview = pick
      ? 'TOON.add(' + pick.math + ', ' + pick.word + ', ' + pick.face + ', ' + pick.rgb + ')\n' +
        (state.wordText.get(pick.word) || pick.word) + ' · ' + (state.faceText.get(pick.face) || pick.face) +
        '\nto ' + ADDR.TOON + '\nvalue 0'
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
