(function () {
  const S = globalThis.SITE;
  const ETH = globalThis.ETH;
  const state = S.state;
  const P = globalThis.PLAN;
  const T = globalThis.TOKEN;

  function lookup(kind, id) {
    const list = kind === 'rgb' ? state.rgb : kind === 'toon' ? state.toon : state.math;
    for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    const held = kind === 'rgb' ? state.heldRgb : kind === 'toon' ? state.heldToon : state.heldMath;
    const who = S.me();
    for (let i = 0; i < (held || []).length; i++) {
      if (BigInt(held[i]) === id) return { id: id, owner: who };
    }
    return null;
  }

  function missing() {
    const ready = state.math.length || state.rgb.length || state.toon.length;
    if (!ready && state.indexState === 'error') return 'index not loaded. refresh.';
    if (!ready && state.indexState !== 'ready') return 'loading index…';
    return 'not minted';
  }

  function nameOf(kind, tok) {
    if (kind === 'toon' && tok.word != null) {
      const word = state.wordText.get(tok.word);
      if (word) return word;
    }
    return tok.id.toString();
  }

  function traitsOf(kind, tok) {
    if (kind === 'rgb' && tok.r != null) {
      return [
        { type: 'r', value: tok.r, link: 'math' },
        { type: 'g', value: tok.g, link: 'math' },
        { type: 'b', value: tok.b, link: 'math' },
      ];
    }
    if (kind === 'toon' && tok.word != null) {
      return [
        { type: 'word', value: tok.word },
        { type: 'face', value: tok.face },
        { type: 'rgb', value: tok.rgb, link: 'rgb' },
      ];
    }
    if (kind === 'math') return T.mathTraits(tok.id);
    return [];
  }

  function traitsHtml(rows) {
    if (!rows.length) return '';
    return '<p class="traits">' + rows.map(function (t) {
      const v = t.link ? T.idLink(t.link, t.value) : S.esc(t.value);
      return '<span><b>' + S.esc(t.type) + '</b> ' + v + '</span>';
    }).join(' ') + '</p>';
  }

  function shareBtn(kind, id, title) {
    return '<button type="button" class="share" data-share="' + T.path(kind, id) + '" data-share-title="' + S.esc(title) + '" aria-label="share">share</button>';
  }

  function cells(r, g, b) {
    return S.cellsHtml(P.planesToRows(r, g, b)).replace(/<button/g, '<i').replace(/<\/button>/g, '</i>');
  }

  function contractLine(kind) {
    const c = kind === 'rgb' ? ETH.ADDR.RGB : kind === 'toon' ? ETH.ADDR.TOON : ETH.ADDR.MATH;
    const r = kind === 'rgb' ? ETH.ADDR.RGB_RENDER : kind === 'toon' ? ETH.ADDR.TOON_RENDER : ETH.ADDR.MATH_RENDER;
    return '<p class="dim">' + S.contractLink(c) + ' · ' + S.contractLink(r) + '</p>';
  }

  function token(view) {
    const spec = state.token;
    if (!spec) return;
    const kind = spec.kind;
    const id = BigInt(spec.id);
    const label = kind === 'rgb' ? 'RGB' : kind === 'toon' ? 'TOON' : 'MATH';
    const tok = lookup(kind, id);
    document.title = (tok ? nameOf(kind, tok) : spec.id) + ' · ' + label;
    if (!tok) {
      view.innerHTML = '<h2>' + S.esc(spec.id) + ' ' + shareBtn(kind, id, document.title) + '</h2><p>' + missing() + '</p>' + contractLine(kind);
      return;
    }
    let extra = '';
    let grid = '';
    if (kind === 'rgb' && tok.r != null) {
      extra = '<p class="dim">R ' + T.idLink('math', tok.r, P.channelTag(tok.r)) +
        ' · G ' + T.idLink('math', tok.g, P.channelTag(tok.g)) +
        ' · B ' + T.idLink('math', tok.b, P.channelTag(tok.b)) + '</p>';
      grid = cells(tok.r, tok.g, tok.b);
    } else if (kind === 'toon' && tok.word != null) {
      const face = state.faceText.get(tok.face) || String(tok.face);
      extra = '<p class="face">' + S.esc(face) + '</p>';
      const rgb = state.rgb.find(function (r) { return r.id === tok.rgb; });
      if (rgb) grid = cells(rgb.r, rgb.g, rgb.b);
    } else if (kind === 'math') {
      grid = S.bitHtml(tok.id);
    }
    let made = '';
    if (kind === 'math') {
      const pairs = T.parents(id, Array.from(state.supply.keys()));
      if (pairs.length) {
        const shown = pairs.slice(0, 8);
        made = '<h2>parents</h2>' + shown.map(function (p) {
          return '<div>' + T.idLink('math', p.a) + ' + ' + T.idLink('math', p.b) + '</div>';
        }).join('') + (pairs.length > shown.length ? '<p class="dim">+' + (pairs.length - shown.length) + '</p>' : '');
      }
    }
    const head = kind === 'toon' && tok.word != null
      ? S.esc(nameOf(kind, tok)) + ' <span class="dim">' + id + '</span>'
      : S.esc(id.toString());
    let note = '';
    if (kind === 'math') note = '<p class="dim">A later MATH or RGB mint that uses this pays its holder.</p>';
    else if (kind === 'rgb' && tok.r != null) note = '<p class="dim">The mint paid whoever held these three MATH tokens.</p>';
    else if (kind === 'toon') note = '<p class="dim">No fee. The minter had to hold the MATH, WORD, FACE, and RGB.</p>';
    view.innerHTML =
      '<h2>' + head + ' ' + shareBtn(kind, id, document.title) + '</h2>' +
      '<p class="dim">' + S.addr(tok.owner) + '</p>' +
      note +
      '<img class="token" alt="" data-svg="' + kind + ':' + id + '">' +
      extra + grid + traitsHtml(traitsOf(kind, tok)) +
      '<div class="outs">' + S.links(kind, id) + '</div>' +
      contractLine(kind) +
      made;
    S.loadSvgs([id], kind);
    ENS.want(tok.owner);
    ENS.flush(function () {
      if (state.tab === 'token' && state.token && state.token.id === spec.id && S.$('#view')) token(S.$('#view'));
    });
  }

  S.token = token;
})();
