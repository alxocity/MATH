(function (g, f) {
  const api = f();
  if (typeof module === 'object' && module.exports) module.exports = api;
  g.TOKEN = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function parse(hash) {
    const m = /^#?(math|rgb|toon)\/(\d+)$/.exec(String(hash || ''));
    if (!m) return null;
    try { return { kind: m[1], id: BigInt(m[2]) }; }
    catch (e) { return null; }
  }

  function path(kind, id) {
    const k = kind === 'rgb' || kind === 'toon' ? kind : 'math';
    return k + '/' + BigInt(id).toString();
  }

  function href(kind, id) {
    return '#' + path(kind, id);
  }

  function idLink(kind, id, text) {
    const n = BigInt(id).toString();
    return '<a href="' + href(kind, id) + '">' + (text == null ? n : text) + '</a>';
  }

  function sumHtml(a, b, result) {
    return idLink('math', a) + ' + ' + idLink('math', b) + ' = ' + (result == null ? 'overflow' : idLink('math', result));
  }

  function planesHtml(r, g, b) {
    return idLink('math', r) + ', ' + idLink('math', g) + ', ' + idLink('math', b);
  }

  function labelHtml(label) {
    const s = String(label || '');
    const math = /^(\d+) \+ (\d+) = (\d+)$/.exec(s);
    if (math) return sumHtml(math[1], math[2], math[3]);
    const rgb = /^RGB\.add (\d+), (\d+), (\d+)$/.exec(s);
    if (rgb) return 'RGB.add ' + planesHtml(rgb[1], rgb[2], rgb[3]);
    return '';
  }

  function mean(sum, len) {
    const ip = sum / len;
    const rem = sum % len;
    if (rem === 0n) return ip.toString();
    const scaled = (rem * 10000000n) / len;
    let frac = scaled / 10n;
    if (scaled % 10n >= 5n) frac += 1n;
    if (frac >= 1000000n) return (ip + 1n).toString();
    let f = frac.toString().padStart(6, '0');
    while (f.length > 1 && f[f.length - 1] === '0') f = f.slice(0, -1);
    return ip.toString() + '.' + f;
  }

  function mathTraits(id) {
    const s = BigInt(id).toString();
    const c = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let sum = 0n;
    let pal = true;
    let stro = true;
    for (let i = 0; i < s.length; i++) {
      const d = s.charCodeAt(i) - 48;
      c[d]++;
      sum += BigInt(d);
      const e = s.charCodeAt(s.length - 1 - i) - 48;
      if (d !== e) pal = false;
      const rot = e === 6 ? 9 : e === 9 ? 6 : e;
      if (rot !== d || (e > 1 && e !== 6 && e !== 8 && e !== 9)) stro = false;
    }
    const rows = [];
    for (let i = 0; i < 10; i++) rows.push({ type: i + '_count', value: String(c[i]) });
    rows.push({ type: 'digit_count', value: String(s.length) });
    rows.push({ type: 'digit_mean', value: mean(sum, BigInt(s.length)) });
    rows.push({ type: 'digit_sum', value: sum.toString() });
    rows.push({ type: 'parity', value: (BigInt(id) % 2n) === 0n ? 'even' : 'odd' });
    if (pal) rows.push({ type: 'fancy', value: 'palindromic' });
    if (stro) rows.push({ type: 'fancy', value: 'strobogrammatic' });
    return rows;
  }

  function parents(id, ids) {
    const n = BigInt(id);
    if (n <= 1n) return [];
    const have = new Set();
    const list = [];
    (ids || []).forEach(function (x) {
      const a = BigInt(x);
      if (a <= 0n || a >= n) return;
      const k = a.toString();
      if (have.has(k)) return;
      have.add(k);
      list.push(a);
    });
    list.sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const b = n - a;
      if (a > b) break;
      if (have.has(b.toString())) out.push({ a: a, b: b });
    }
    return out;
  }

  return {
    parse: parse,
    path: path,
    href: href,
    idLink: idLink,
    sumHtml: sumHtml,
    planesHtml: planesHtml,
    labelHtml: labelHtml,
    mean: mean,
    mathTraits: mathTraits,
    parents: parents,
  };
});
