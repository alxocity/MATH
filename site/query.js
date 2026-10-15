(function () {
  const KEYS = ['a', 'b', 'n', 'R', 'G', 'B', 'math', 'word', 'face', 'rgb', 'preset'];
  const ZERO = { word: true, face: true, R: true, G: true, B: true };

  function digits(raw, allowZero) {
    const s = String(raw == null ? '' : raw).trim();
    if (!/^\d+$/.test(s)) return '';
    if (s.length > 78) return '';
    const n = s.replace(/^0+(?=\d)/, '');
    if (n === '0') return allowZero ? '0' : '';
    if (BigInt(n) >= 2n ** 256n) return '';
    return n;
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

  const GROUPS = {
    mint: ['a', 'b'],
    route: ['n'],
    rgb: ['R', 'G', 'B'],
    toon: ['math', 'word', 'face', 'rgb'],
    ens: ['preset'],
  };
  const URL_KEY = 'math.url.v1';

  function planeBag(q) {
    const bag = asBag(q);
    return { R: bag.R, G: bag.G, B: bag.B };
  }

  function hasPlanes(q) {
    const p = planeBag(q);
    return p.R !== '' || p.G !== '' || p.B !== '';
  }

  function asBag(q) {
    if (typeof q === 'string') return read(q);
    const src = q && typeof q === 'object' ? q : {};
    const raw = blank();
    KEYS.forEach(function (k) {
      if (src[k] == null) return;
      raw[k] = String(src[k]);
    });
    return read(serialize(raw));
  }

  function groupHas(bag, keys) {
    return keys.some(function (k) { return bag[k] !== ''; });
  }

  // Each group is separate. Params already in the URL win for that group.
  // A group with none restores from storage. A shared link is left alone.
  function restoreBag(url, stored) {
    const fromUrl = asBag(url);
    const fromStore = asBag(stored);
    const values = blank();
    const sources = {};
    Object.keys(GROUPS).forEach(function (name) {
      const keys = GROUPS[name];
      const urlHas = groupHas(fromUrl, keys);
      const storeHas = groupHas(fromStore, keys);
      const src = urlHas ? fromUrl : (storeHas ? fromStore : null);
      sources[name] = urlHas ? 'url' : (storeHas ? 'store' : '');
      if (!src) return;
      keys.forEach(function (k) { values[k] = src[k]; });
    });
    return { values: values, sources: sources };
  }

  function storePatch(restored, names) {
    const patch = {};
    const list = names || Object.keys(GROUPS);
    list.forEach(function (name) {
      const keys = GROUPS[name];
      if (!keys || !restored || !restored.sources || restored.sources[name] !== 'store') return;
      keys.forEach(function (k) { patch[k] = restored.values[k]; });
    });
    return patch;
  }

  function mergeStore(prev, patch) {
    const base = asBag(prev);
    Object.keys(patch || {}).forEach(function (k) {
      if (KEYS.indexOf(k) === -1) return;
      base[k] = patch[k] == null ? '' : String(patch[k]);
    });
    return asBag(base);
  }

  function shareHref(loc, patch) {
    const origin = loc && loc.origin ? String(loc.origin) : '';
    return origin + href(loc, patch);
  }

  function choosePlanes(url, saved) {
    const restored = restoreBag(url, saved);
    const planes = planeBag(restored.values);
    if (!hasPlanes(planes)) return { source: '', planes: null };
    return { source: restored.sources.rgb, planes: planes };
  }

  function readStore(storage) {
    try {
      const raw = storage.getItem(URL_KEY);
      const j = raw ? JSON.parse(raw) : null;
      if (!j || typeof j !== 'object') return null;
      return j;
    } catch (e) { return null; }
  }

  function writeStore(storage, patch) {
    if (!storage || !patch) return;
    try {
      const next = mergeStore(readStore(storage), patch);
      storage.setItem(URL_KEY, JSON.stringify(next));
    } catch (e) { /* private mode, or a store that rejects writes */ }
  }

  function copyHtml() {
    return '<button type="button" class="copy-link">copy link</button><span class="copy-note dim"></span>';
  }

  function attachCopy(button, getUrl) {
    if (!button || button.dataset.bound) return;
    button.dataset.bound = '1';
    button.addEventListener('click', function () {
      let url = '';
      try { url = getUrl(); }
      catch (e) { return; }
      const doc = button.ownerDocument;
      const parent = button.parentNode;
      const note = parent && parent.querySelector('.copy-note');
      function mark(text) { if (note) note.textContent = text; }
      function fallback() {
        let field = parent && parent.querySelector('.copy-field');
        if (!field && doc) {
          field = doc.createElement('input');
          field.className = 'copy-field';
          field.type = 'text';
          field.readOnly = true;
          field.setAttribute('aria-label', 'link');
          button.insertAdjacentElement('afterend', field);
        }
        let selected = false;
        if (field) {
          field.value = url;
          try {
            field.focus();
            field.select();
            selected = field.selectionEnd > field.selectionStart;
          } catch (e) { selected = false; }
        }
        if (!selected) {
          const view = doc && doc.defaultView;
          if (view && view.prompt) {
            try { view.prompt('copy link', url); }
            catch (e2) { /* leave the field */ }
          }
        }
        mark('copied');
      }
      const view = doc && doc.defaultView;
      const clip = view && view.navigator && view.navigator.clipboard;
      if (clip && clip.writeText) {
        let pending;
        try { pending = clip.writeText(url); }
        catch (e) { fallback(); return; }
        if (pending && pending.then) pending.then(function () { mark('copied'); }, fallback);
        else mark('copied');
        return;
      }
      fallback();
    });
  }

  const api = {
    KEYS: KEYS,
    GROUPS: GROUPS,
    URL_KEY: URL_KEY,
    digits: digits,
    presetName: presetName,
    read: read,
    write: write,
    href: href,
    hasPlanes: hasPlanes,
    restoreBag: restoreBag,
    storePatch: storePatch,
    mergeStore: mergeStore,
    shareHref: shareHref,
    choosePlanes: choosePlanes,
    readStore: readStore,
    writeStore: writeStore,
    copyHtml: copyHtml,
    attachCopy: attachCopy,
  };
  globalThis.QUERY = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})();
