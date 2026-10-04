(function () {
  const S = globalThis.SITE;
  const state = S.state;
  const LIST = globalThis.LIST;

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
      out.push({ id: id, owner: m });
    });
    return out;
  }

  function owned(kind) {
    if (kind === 'rgb') return rowsOf(state.rgb, state.heldRgb);
    if (kind === 'toon') return rowsOf(state.toon, state.heldToon);
    return rowsOf(state.math, state.heldMath);
  }

  function actions(kind, tok) {
    if (kind === 'math') {
      const flags = ENS.mathFlags(state.channels.get(tok.id), state.usedMath.has(tok.id));
      const channels = flags.free.map(function (c) {
        return '<button type="button" data-go="rgb" data-ch="' + c + '" data-id="' + tok.id + '">' + c + '</button>';
      }).join('');
      const toon = flags.toon ? '<button type="button" data-go="toon" data-slot="tm" data-id="' + tok.id + '">toon</button>' : '';
      const note = channels || toon ? '' : '<span class="dim">used</span>';
      const free = channels ? '<span class="dim">free</span>' : '';
      return '<div class="row">' + note + free + channels + toon + '</div>';
    }
    if (kind === 'rgb') {
      if (state.usedRgb.has(tok.id)) return '<div class="row"><span class="dim">used</span></div>';
      return '<div class="row"><button type="button" data-go="toon" data-slot="tr" data-id="' + tok.id + '">toon</button></div>';
    }
    return '';
  }

  function bindGo(root) {
    root.querySelectorAll('[data-go]').forEach(function (b) {
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
  }

  function emptyCopy(n) {
    if (n) return 'nothing in this filter.';
    if (state.indexState === 'error') return 'index not loaded. refresh.';
    if (state.indexState === 'loading' && !state.math.length && !state.rgb.length && !state.toon.length) return 'loading index…';
    return 'none';
  }

  function paintMine() {
    const kind = state.mineKind;
    const src = owned(kind);
    const who = S.$('#mineWho');
    if (who && state.account) who.innerHTML = S.addr(state.account);
    const ctx = S.matchCtx();
    const list = LIST.order(src.filter(function (t) {
      return LIST.match(t, kind, state.mineFilter, ctx);
    }), state.mineFilter.sort, ctx.pop, ctx.max);
    const pages = Math.max(1, Math.ceil(list.length / LIST.PAGE));
    if (state.minePage >= pages) state.minePage = pages - 1;
    if (state.minePage < 0) state.minePage = 0;
    const slice = list.slice(state.minePage * LIST.PAGE, state.minePage * LIST.PAGE + LIST.PAGE);
    const cards = S.$('#cards');
    const pager = S.$('#pager');
    if (!cards) return;
    const h = S.cardHelpers();
    cards.innerHTML = slice.map(function (t) {
      return LIST.cardHtml(kind, t, h, actions(kind, t));
    }).join('') || '<p class="dim">' + emptyCopy(src.length) + '</p>';
    if (pager) {
      pager.innerHTML = LIST.pagerHtml(state.minePage, pages, list.length);
      const prev = S.$('#prev');
      const next = S.$('#next');
      if (prev) prev.onclick = function () { state.minePage--; paintMine(); };
      if (next) next.onclick = function () { state.minePage++; paintMine(); };
    }
    bindGo(cards);
    S.loadSvgs(slice.map(function (t) { return t.id; }), kind);
    slice.forEach(function (t) { ENS.want(t.owner); });
    ENS.flush(function () { if (state.tab === 'mine' && S.$('#cards')) paintMine(); });
  }

  function mine(view) {
    if (!state.account) {
      S.show('browse');
      return;
    }
    const counts = { math: owned('math').length, rgb: owned('rgb').length, toon: owned('toon').length };
    view.innerHTML =
      '<h2>my collection</h2>' +
      '<p class="dim" id="mineWho">' + S.addr(state.account) + '</p>' +
      LIST.barHtml(state.mineKind, state.mineFilter, counts, S.esc, S.mark, S.TIPS.used) +
      '<div id="cards"></div><p id="pager" class="row"></p>' +
      '<p class="dim">low 256 bits. pictures from the renderer, this page only.</p>';
    view.querySelectorAll('[data-kind]').forEach(function (b) {
      b.onclick = function () { state.mineKind = b.dataset.kind; state.minePage = 0; S.show('mine'); };
    });
    function read() {
      state.mineFilter.q = S.$('#q').value.trim();
      state.mineFilter.popMin = S.$('#popMin').value.trim();
      state.mineFilter.popMax = S.$('#popMax').value.trim();
      state.mineFilter.pal = S.$('#pal').checked;
      state.mineFilter.pow = S.$('#pow').checked;
      state.mineFilter.used = S.$('#used').value;
      state.mineFilter.sort = S.$('#sort').value;
      state.minePage = 0;
      paintMine();
    }
    let nameWait = 0;
    function readSoon() {
      read();
      const q = state.mineFilter.q.trim().toLowerCase();
      if (!ENS.isName(q) || ENS.hasForward(q)) return;
      clearTimeout(nameWait);
      nameWait = setTimeout(function () {
        ENS.resolveForward(q).then(function () {
          if (state.tab === 'mine' && state.mineFilter.q.trim().toLowerCase() === q) paintMine();
        });
      }, 250);
    }
    LIST.bindBar(read, readSoon);
    paintMine();
  }

  S.mine = mine;
})();
