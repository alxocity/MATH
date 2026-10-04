(function (g, f) {
  const api = f();
  if (typeof module === 'object' && module.exports) module.exports = api;
  g.LIST = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const PAGE = 24;

  function norm(id, max) {
    const n = BigInt(id);
    return n > max ? n & max : n;
  }

  function hitNum(tok, q) {
    if (tok.id.toString().includes(q)) return true;
    if (tok.r != null) {
      if (tok.r.toString().includes(q) || tok.g.toString().includes(q) || tok.b.toString().includes(q)) return true;
    }
    if (tok.word != null) {
      if (tok.word.toString().includes(q) || (tok.face != null && tok.face.toString().includes(q))) return true;
      if (tok.rgb != null && tok.rgb.toString().includes(q)) return true;
    }
    return false;
  }

  function match(tok, kind, filter, ctx) {
    const f = filter;
    if (f.q) {
      if (/^\d+$/.test(f.q)) {
        if (!hitNum(tok, f.q)) return false;
      } else {
        const word = tok.word != null && ctx.word(tok.word) || '';
        const face = tok.face != null && ctx.face(tok.face) || '';
        const q = f.q.toLowerCase();
        const text = (word + ' ' + face).toLowerCase();
        const resolved = ctx.isName(q) ? ctx.forward(q) : '';
        if (!text.includes(q) && !ctx.ownerHit(tok.owner, q, ctx.cached(tok.owner), resolved)) return false;
      }
    }
    const low = norm(tok.id, ctx.max);
    const pop = ctx.pop(low);
    if (f.popMin !== '' && pop < Number(f.popMin)) return false;
    if (f.popMax !== '' && pop > Number(f.popMax)) return false;
    if (f.pal && !ctx.pal(low)) return false;
    if (f.pow && !ctx.pow(low)) return false;
    if (kind === 'math' && f.used !== 'any') {
      const ch = ctx.channels(tok.id);
      if (f.used === 'free') {
        if (ch && ch.size) return false;
      } else if (!ch || !ch.has(f.used)) return false;
    }
    return true;
  }

  function order(list, sort, pop, max) {
    const out = list.slice();
    if (sort === 'id') {
      out.sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    } else if (sort === 'pop') {
      out.sort(function (a, b) { return pop(norm(b.id, max)) - pop(norm(a.id, max)); });
    }
    return out;
  }

  function gridOf(h, r, g, b) {
    return h.cells(h.rows(r, g, b)).replace(/<button/g, '<i').replace(/<\/button>/g, '</i>');
  }

  function href(kind, id) {
    return '#' + kind + '/' + BigInt(id).toString();
  }

  function link(kind, id, text) {
    return '<a href="' + href(kind, id) + '">' + text + '</a>';
  }

  function shareBtn(kind, id) {
    return '<button type="button" class="share" data-share="' + kind + '/' + BigInt(id).toString() + '" aria-label="share">↗</button>';
  }

  function cardHtml(kind, tok, h, actions) {
    const ch = kind === 'math' ? h.channels(tok.id) : null;
    const tags = [];
    const marks = [];
    if (ch && ch.size) {
      tags.push(Array.from(ch).join(''));
      marks.push(h.mark('ⓘ', h.usedTip));
    }
    if (kind === 'math') {
      if (h.isPal(tok.id)) marks.push(h.mark('⇌', 'palindrome, reads the same backwards'));
      if (h.isStrobo(tok.id)) marks.push(h.mark('↻', 'strobogrammatic, reads the same upside down'));
    }
    let title = link(kind, tok.id, String(tok.id));
    let extra = '';
    let grid = '';
    if (kind === 'rgb') {
      if (tok.r != null) {
        extra = '<div class="dim">R ' + link('math', tok.r, h.tag(tok.r)) + ' · G ' + link('math', tok.g, h.tag(tok.g)) + ' · B ' + link('math', tok.b, h.tag(tok.b)) + '</div>';
        grid = gridOf(h, tok.r, tok.g, tok.b);
      }
    } else if (kind === 'toon') {
      if (tok.word != null) {
        const word = h.word(tok.word) || String(tok.word);
        const face = h.face(tok.face) || String(tok.face);
        title = link('toon', tok.id, h.esc(word)) + ' <span class="dim">' + link('toon', tok.id, String(tok.id)) + '</span>';
        extra = '<div class="face">' + h.esc(face) + '</div>';
        const rgb = h.rgb(tok.rgb);
        if (rgb) grid = gridOf(h, rgb.r, rgb.g, rgb.b);
      }
    } else {
      grid = h.bits(tok.id);
    }
    const tag = tags.filter(Boolean).join(' ');
    const head = title + (tag ? ' <span class="dim">' + h.esc(tag) + '</span>' : '') + marks.join('');
    return '<article class="card"><div>' + head + '</div>' +
      '<div class="dim">' + h.addr(tok.owner) + '</div>' +
      '<div class="outs">' + h.links(kind, tok.id) + shareBtn(kind, tok.id) + '</div>' +
      (actions || '') + extra + grid +
      '<img alt="" data-svg="' + kind + ':' + tok.id + '"></article>';
  }

  function barHtml(kind, filter, counts, esc, mark, tip) {
    const f = filter;
    return '<div class="row">' +
      '<button type="button" data-kind="math"' + (kind === 'math' ? ' class="on"' : '') + '>MATH ' + counts.math + '</button>' +
      '<button type="button" data-kind="rgb"' + (kind === 'rgb' ? ' class="on"' : '') + '>RGB ' + counts.rgb + '</button>' +
      '<button type="button" data-kind="toon"' + (kind === 'toon' ? ' class="on"' : '') + '>TOON ' + counts.toon + '</button>' +
      '</div>' +
      '<div class="row">' +
      '<input id="q" placeholder="id, value, name" value="' + esc(f.q) + '">' +
      '<label>pop <input id="popMin" size="4" value="' + esc(f.popMin) + '"></label>' +
      '<label>..<input id="popMax" size="4" value="' + esc(f.popMax) + '"></label>' +
      '<label><input type="checkbox" id="pal"' + (f.pal ? ' checked' : '') + '> pal</label>' +
      '<label><input type="checkbox" id="pow"' + (f.pow ? ' checked' : '') + '> 2^k</label>' +
      '<label>used ' + mark('ⓘ', tip) + ' <select id="used">' +
      ['any', 'r', 'g', 'b', 'free'].map(function (u) {
        return '<option' + (f.used === u ? ' selected' : '') + '>' + u + '</option>';
      }).join('') + '</select></label>' +
      '<label>sort <select id="sort">' +
      ['index', 'id', 'pop'].map(function (u) {
        return '<option' + (f.sort === u ? ' selected' : '') + '>' + u + '</option>';
      }).join('') + '</select></label>' +
      '</div>';
  }

  function pagerHtml(page, pages, count) {
    return '<button type="button" id="prev"' + (page ? '' : ' disabled') + '>prev</button> ' +
      (page + 1) + '/' + pages + ' <span class="dim">' + count + '</span> ' +
      '<button type="button" id="next"' + (page + 1 < pages ? '' : ' disabled') + '>next</button>';
  }

  function bindBar(read, soon) {
    const on = soon || read;
    ['q', 'popMin', 'popMax'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', on);
    });
    ['pal', 'pow', 'used', 'sort'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', read);
    });
  }

  return {
    PAGE: PAGE,
    match: match,
    order: order,
    cardHtml: cardHtml,
    barHtml: barHtml,
    pagerHtml: pagerHtml,
    bindBar: bindBar,
  };
});
