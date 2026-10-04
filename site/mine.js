(function () {
  const S = globalThis.SITE;
  const state = S.state;
  const P = globalThis.PLAN;

  function rowsOf(list, held) {
    const m = S.me();
    const out = [];
    const seen = new Set();
    (list || []).forEach(function (t) {
      if (t.owner !== m) return;
      const s = t.id.toString();
      if (seen.has(s)) return;
      seen.add(s);
      out.push(t);
    });
    (held || []).forEach(function (id) {
      const s = id.toString();
      if (seen.has(s)) return;
      seen.add(s);
      out.push({ id: id });
    });
    return out;
  }

  function mine(view) {
    if (!state.account) {
      S.show('browse');
      return;
    }
    const maths = rowsOf(state.math, state.heldMath);
    const rgbs = rowsOf(state.rgb, state.heldRgb);
    const toons = rowsOf(state.toon, state.heldToon);
    function mathRow(t) {
      const flags = ENS.mathFlags(state.channels.get(t.id), state.usedMath.has(t.id));
      const channels = flags.free.map(function (c) {
        return '<button type="button" data-go="rgb" data-ch="' + c + '" data-id="' + t.id + '">' + c + '</button>';
      }).join('');
      const toon = flags.toon ? '<button type="button" data-go="toon" data-slot="tm" data-id="' + t.id + '">toon</button>' : '';
      const note = channels || toon ? '' : ' <span class="dim">used</span>';
      const free = channels ? '<span class="dim">free</span>' : '';
      return '<div class="mine"><span>' + t.id + '</span>' + note + free + '<span class="row">' + channels + toon + '</span></div>';
    }
    function rgbRow(t) {
      const pop = t.r != null ? ' <span class="dim">r ' + P.popcount(t.r) + ' g ' + P.popcount(t.g) + ' b ' + P.popcount(t.b) + '</span>' : '';
      const used = state.usedRgb.has(t.id);
      const toon = used ? '' : '<button type="button" data-go="toon" data-slot="tr" data-id="' + t.id + '">toon</button>';
      return '<div class="mine"><span>' + t.id + '</span>' + pop + (used ? ' <span class="dim">used</span>' : '') + '<span class="row">' + toon + '</span></div>';
    }
    function toonRow(t) {
      const word = t.word != null ? (state.wordText.get(t.word) || String(t.word)) : '';
      const face = t.face != null ? (state.faceText.get(t.face) || '') : '';
      return '<div class="mine"><span>' + t.id + (word ? ' ' + S.esc(word) : '') + '</span>' +
        (face ? '<span class="face">' + S.esc(face) + '</span>' : '') + '</div>';
    }
    view.innerHTML =
      '<h2>my collection</h2>' +
      '<p class="dim">' + S.addr(state.account) + '</p>' +
      '<h2>MATH ' + maths.length + '</h2>' +
      (maths.map(mathRow).join('') || '<p class="dim">none</p>') +
      '<h2>RGB ' + rgbs.length + '</h2>' +
      (rgbs.map(rgbRow).join('') || '<p class="dim">none</p>') +
      '<h2>TOON ' + toons.length + '</h2>' +
      (toons.map(toonRow).join('') || '<p class="dim">none</p>');
    view.querySelectorAll('[data-go]').forEach(function (b) {
      b.onclick = function () {
        const id = BigInt(b.dataset.id);
        if (b.dataset.go === 'rgb') {
          state.arm = { kind: 'rgb', id: id, ch: b.dataset.ch.toUpperCase() };
          S.show('rgb');
          return;
        }
        state.arm = { kind: 'toon', id: id, slot: b.dataset.slot };
        S.show('toon');
      };
    });
    ENS.flush(function () { if (state.tab === 'mine') mine(view); });
  }

  S.mine = mine;
})();
