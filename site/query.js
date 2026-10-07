(function () {
  const KEYS = ['a', 'b', 'n', 'R', 'G', 'B', 'math', 'word', 'face', 'rgb', 'preset'];
  const ZERO = { word: true, face: true, R: true, G: true, B: true };

  function digits(raw, allowZero) {
    const s = String(raw == null ? '' : raw).trim();
    if (!/^\d+$/.test(s)) return '';
    if (s === '0') return allowZero ? '0' : '';
    return s.replace(/^0+(?=\d)/, '');
  }

  function presetName(raw) {
    const s = String(raw == null ? '' : raw).trim().toLowerCase();
    return /^[a-z0-9-]+$/.test(s) ? s : '';
  }

  function blank() {
    return { a: '', b: '', n: '', R: '', G: '', B: '', math: '', word: '', face: '', rgb: '', preset: '' };
  }

  function read(search) {
    const q = new URLSearchParams(String(search || '').replace(/^\?/, ''));
    const out = blank();
    KEYS.forEach(function (k) {
      if (k === 'preset') out[k] = presetName(q.get(k));
      else out[k] = digits(q.get(k), !!ZERO[k]);
    });
    return out;
  }

  function serialize(obj) {
    const parts = [];
    KEYS.forEach(function (k) {
      if (!obj[k]) return;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]));
    });
    return parts.length ? '?' + parts.join('&') : '';
  }

  function write(search, patch) {
    const next = read(search);
    Object.keys(patch || {}).forEach(function (k) {
      if (KEYS.indexOf(k) === -1) return;
      const v = patch[k];
      next[k] = v == null ? '' : String(v);
    });
    return serialize(read(serialize(next)));
  }

  function href(loc, patch) {
    const search = write(loc && loc.search, patch);
    return (loc && loc.pathname || '') + search + (loc && loc.hash || '');
  }

  const api = {
    KEYS: KEYS,
    digits: digits,
    presetName: presetName,
    read: read,
    write: write,
    href: href,
  };
  globalThis.QUERY = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})();
