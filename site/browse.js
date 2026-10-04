(function () {
  const S = globalThis.SITE;
  const state = S.state;
  const $ = S.$;
  const ETH = globalThis.ETH;
  const P = globalThis.PLAN;
  const ADDR = ETH.ADDR;
  const PAGE = 24;

  function pass(tok) {
    const f = state.filter;
    const id = tok.id;
    if (f.q) {
      if (/^\d+$/.test(f.q)) {
        if (!id.toString().includes(f.q)) return false;
      } else {
        const word = tok.word != null && state.wordText.get(tok.word) || '';
        const face = tok.face != null && state.faceText.get(tok.face) || '';
        const q = f.q.toLowerCase();
        const text = (word + ' ' + face).toLowerCase();
        const resolved = ENS.isName(q) ? ENS.forwardCached(q) : '';
        if (!text.includes(q) && !ENS.ownerHit(tok.owner, q, ENS.cached(tok.owner), resolved)) return false;
      }
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
      const tags = [];
      const marks = [];
      if (ch && ch.size) {
        tags.push(Array.from(ch).join(''));
        marks.push(S.mark('ⓘ', S.TIPS.used));
      }
      if (state.kind === 'math') {
        if (P.isPal(t.id)) marks.push(S.mark('⇌', 'palindrome, reads the same backwards'));
        if (P.isStrobo(t.id)) marks.push(S.mark('↻', 'strobogrammatic, reads the same upside down'));
      }
      let title = String(t.id);
      let extra = '';
      let grid = S.bitHtml(t.id);
      if (state.kind === 'rgb') {
        extra = '<div class="dim">R ' + P.channelTag(t.r) + ' · G ' + P.channelTag(t.g) + ' · B ' + P.channelTag(t.b) + '</div>';
        grid = S.cellsHtml(P.planesToRows(t.r, t.g, t.b)).replace(/<button/g, '<i').replace(/<\/button>/g, '</i>');
      }
      if (state.kind === 'toon') {
        const word = state.wordText.get(t.word) || String(t.word);
        const face = state.faceText.get(t.face) || String(t.face);
        title = S.esc(word) + ' <span class="dim">' + t.id + '</span>';
        extra = '<div class="face">' + S.esc(face) + '</div>';
        const rgb = state.rgb.find(function (r) { return r.id === t.rgb; });
        grid = rgb ? S.cellsHtml(P.planesToRows(rgb.r, rgb.g, rgb.b)).replace(/<button/g, '<i').replace(/<\/button>/g, '</i>') : '';
      }
      const tag = tags.filter(Boolean).join(' ');
      return '<article class="card"><div>' + (state.kind === 'toon' ? title : t.id) + (tag ? ' <span class="dim">' + S.esc(tag) + '</span>' : '') + marks.join('') + '</div>' +
        '<div class="dim">' + S.addr(t.owner) + '</div>' + extra + grid +
        '<img alt="" data-svg="' + state.kind + ':' + t.id + '"></article>';
    }).join('') || '<p class="dim">' + (state.math.length || state.rgb.length || state.toon.length ? 'nothing in this filter.' : (state.indexState === 'error' ? 'index not loaded. refresh.' : 'loading index…')) + '</p>';
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
    slice.forEach(function (t) { ENS.want(t.owner); });
    ENS.flush(function () { if (state.tab === 'browse' && $('#cards')) paintCards(); });
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
        if (img) img.src = S.svgUrl(xml);
      });
    }
    ids.forEach(function (id) {
      const xml = state.svgs.get(kind + ':' + id);
      const img = document.querySelector('img[data-svg="' + kind + ':' + id + '"]');
      if (img && xml) img.src = S.svgUrl(xml);
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
      '<input id="q" placeholder="id, owner, name" value="' + S.esc(f.q) + '">' +
      '<label>pop <input id="popMin" size="4" value="' + S.esc(f.popMin) + '"></label>' +
      '<label>..<input id="popMax" size="4" value="' + S.esc(f.popMax) + '"></label>' +
      '<label><input type="checkbox" id="pal"' + (f.pal ? ' checked' : '') + '> pal</label>' +
      '<label><input type="checkbox" id="pow"' + (f.pow ? ' checked' : '') + '> 2^k</label>' +
      '<label>used ' + S.mark('ⓘ', S.TIPS.used) + ' <select id="used">' +
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
      b.onclick = function () { state.kind = b.dataset.kind; state.page = 0; S.show('browse'); };
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
    let nameWait = 0;
    function readSoon() {
      read();
      const q = state.filter.q.trim().toLowerCase();
      if (!ENS.isName(q) || ENS.hasForward(q)) return;
      clearTimeout(nameWait);
      nameWait = setTimeout(function () {
        ENS.resolveForward(q).then(function () {
          if (state.tab === 'browse' && state.filter.q.trim().toLowerCase() === q) paintCards();
        });
      }, 250);
    }
    ['q', 'popMin', 'popMax'].forEach(function (id) { $('#' + id).addEventListener('input', readSoon); });
    ['pal', 'pow', 'used', 'sort'].forEach(function (id) { $('#' + id).addEventListener('change', read); });
    paintCards();
  }

  S.browse = browse;
})();
