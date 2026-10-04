(function () {
  const S = globalThis.SITE;
  const state = S.state;
  const $ = S.$;
  const ETH = globalThis.ETH;
  const P = globalThis.PLAN;
  const LIST = globalThis.LIST;
  const ADDR = ETH.ADDR;

  function cardHelpers() {
    return {
      esc: S.esc,
      addr: S.addr,
      links: S.links,
      mark: S.mark,
      usedTip: S.TIPS.used,
      bits: S.bitHtml,
      cells: S.cellsHtml,
      rows: P.planesToRows,
      tag: P.channelTag,
      isPal: P.isPal,
      isStrobo: P.isStrobo,
      channels: function (id) { return state.channels.get(id); },
      word: function (id) { return state.wordText.get(id); },
      face: function (id) { return state.faceText.get(id); },
      rgb: function (id) {
        return state.rgb.find(function (r) { return r.id === id; }) || null;
      },
    };
  }

  function matchCtx() {
    return {
      max: P.MAX,
      pop: P.popcount,
      pal: P.isPal,
      pow: P.isPow2,
      channels: function (id) { return state.channels.get(id); },
      word: function (id) { return state.wordText.get(id); },
      face: function (id) { return state.faceText.get(id); },
      ownerHit: ENS.ownerHit,
      cached: ENS.cached,
      isName: ENS.isName,
      forward: ENS.forwardCached,
    };
  }

  function currentList() {
    const src = state.kind === 'rgb' ? state.rgb : state.kind === 'toon' ? state.toon : state.math;
    const ctx = matchCtx();
    const list = src.filter(function (t) { return LIST.match(t, state.kind, state.filter, ctx); });
    return LIST.order(list, state.filter.sort, ctx.pop, ctx.max);
  }

  function paintCards() {
    const list = currentList();
    const pages = Math.max(1, Math.ceil(list.length / LIST.PAGE));
    if (state.page >= pages) state.page = pages - 1;
    if (state.page < 0) state.page = 0;
    const slice = list.slice(state.page * LIST.PAGE, state.page * LIST.PAGE + LIST.PAGE);
    const cards = $('#cards');
    const pager = $('#pager');
    if (!cards) return;
    const h = cardHelpers();
    cards.innerHTML = slice.map(function (t) {
      return LIST.cardHtml(state.kind, t, h);
    }).join('') || '<p class="dim">' + (state.math.length || state.rgb.length || state.toon.length ? 'nothing in this filter.' : (state.indexState === 'error' ? 'index not loaded. refresh.' : 'loading index…')) + '</p>';
    if (pager) {
      pager.innerHTML = LIST.pagerHtml(state.page, pages, list.length);
      const prev = $('#prev');
      const next = $('#next');
      if (prev) prev.onclick = function () { state.page--; paintCards(); };
      if (next) next.onclick = function () { state.page++; paintCards(); };
    }
    loadSvgs(slice.map(function (t) { return t.id; }));
    slice.forEach(function (t) { ENS.want(t.owner); });
    ENS.flush(function () { if (state.tab === 'browse' && $('#cards')) paintCards(); });
  }

  async function loadSvgs(ids, kind) {
    const gen = ++state.svgGen;
    kind = kind || state.kind;
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
    const counts = { math: state.math.length, rgb: state.rgb.length, toon: state.toon.length };
    view.innerHTML = LIST.barHtml(state.kind, state.filter, counts, S.esc, S.mark, S.TIPS.used) +
      '<div id="cards"></div><p id="pager" class="row"></p>' +
      '<p class="dim">low 256 bits. pictures from the renderer, this page only.</p>';
    view.querySelectorAll('[data-kind]').forEach(function (b) {
      b.onclick = function () { state.kind = b.dataset.kind; state.page = 0; S.show('browse'); };
    });
    LIST.bindSearch(state.filter, function () {
      state.page = 0;
      paintCards();
    }, paintCards, function () { return state.tab === 'browse'; }, ENS);
    paintCards();
  }

  S.browse = browse;
  S.cardHelpers = cardHelpers;
  S.matchCtx = matchCtx;
  S.loadSvgs = loadSvgs;
})();
