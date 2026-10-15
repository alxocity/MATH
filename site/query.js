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
    if (s.length > 64) return '';
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
  const MARK_KEY = 'math.url.mark.v1';
  const MARK_MAX = 1024;

  function searchPart(value) {
    const s = String(value == null ? '' : value);
    const q = s.indexOf('?');
    if (q === -1) return '';
    const hash = s.indexOf('#', q);
    return hash === -1 ? s.slice(q) : s.slice(q, hash);
  }

  function canonicalSearch(search) {
    const s = String(search || '');
    if (s.length > MARK_MAX) return '';
    return write('', read(s));
  }

  // The marker is only the serialized known-key search. Anything else is ignored.
  function acceptMark(raw) {
    if (typeof raw !== 'string') return '';
    if (!raw || raw.length > MARK_MAX || raw.charAt(0) !== '?') return '';
    return raw === canonicalSearch(raw) ? raw : '';
  }

  function readMark(storage) {
    try {
      if (!storage || typeof storage.getItem !== 'function') return '';
      return acceptMark(storage.getItem(MARK_KEY));
    } catch (e) { return ''; }
  }

  function writeMark(storage, hrefOrSearch) {
    try {
      if (!storage || typeof storage.setItem !== 'function') return;
      const canon = canonicalSearch(searchPart(hrefOrSearch));
      if (!canon) {
        if (typeof storage.removeItem === 'function') storage.removeItem(MARK_KEY);
        return;
      }
      storage.setItem(MARK_KEY, canon);
    } catch (e) { /* private mode */ }
  }

  function markedOpen(urlSearch, mark) {
    const accepted = acceptMark(mark);
    if (!accepted) return false;
    return String(urlSearch || '') === accepted;
  }

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
      if (!Object.prototype.hasOwnProperty.call(src, k)) return;
      const v = src[k];
      if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'bigint') return;
      raw[k] = String(v);
    });
    return read(serialize(raw));
  }

  function urlLocked(bag) {
    return KEYS.some(function (k) { return bag[k] !== ''; });
  }

  function groupHas(bag, keys) {
    return keys.some(function (k) { return bag[k] !== ''; });
  }

  // Empty and '#' are the main site's default tab. A hash that names a group
  // restores that group. Any other hash restores nothing.
  function namedGroup(tab) {
    if (tab == null || tab === '' || tab === '#') return 'rgb';
    const raw = String(tab);
    const name = (raw.charAt(0) === '#' ? raw.slice(1) : raw).toLowerCase();
    return Object.prototype.hasOwnProperty.call(GROUPS, name) ? name : '';
  }

  // A known query key uses the URL alone. A bare or hash-only address restores
  // storage for one group, and that restore is never written back into the URL.
  function restoreBag(url, stored, tab) {
    const fromUrl = asBag(url);
    const fromStore = asBag(stored);
    const values = blank();
    const sources = {};
    const locked = urlLocked(fromUrl);
    const group = namedGroup(tab);
    Object.keys(GROUPS).forEach(function (name) {
      const keys = GROUPS[name];
      if (locked) {
        const urlHas = groupHas(fromUrl, keys);
        sources[name] = urlHas ? 'url' : '';
        if (!urlHas) return;
        keys.forEach(function (k) { values[k] = fromUrl[k]; });
        return;
      }
      if (name !== group) {
        sources[name] = '';
        return;
      }
      const storeHas = groupHas(fromStore, keys);
      sources[name] = storeHas ? 'store' : '';
      if (!storeHas) return;
      keys.forEach(function (k) { values[k] = fromStore[k]; });
    });
    return { values: values, sources: sources, writeUrl: false, group: group, locked: locked };
  }

  function ensBoot(search, stored, hash) {
    const group = (hash == null || hash === '' || hash === '#') ? 'ens' : hash;
    const restored = restoreBag(search, stored, group);
    return { preset: restored.values.preset || '', writeUrl: false, group: restored.group };
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

  function shareTab(loc, tab, patch) {
    const keys = GROUPS[tab] || [];
    const only = {};
    keys.forEach(function (k) {
      if (!patch || patch[k] == null) return;
      only[k] = patch[k];
    });
    return shareHref({
      origin: loc && loc.origin || '',
      pathname: loc && loc.pathname || '',
      search: '',
      hash: loc && loc.hash || '',
    }, only);
  }

  function fullPlanes(q) {
    const p = planeBag(q);
    return p.R !== '' && p.G !== '' && p.B !== '';
  }

  function planeFields(raw) {
    const R = digits(raw && raw.R, true);
    const G = digits(raw && raw.G, true);
    const B = digits(raw && raw.B, true);
    if (R === '' || G === '' || B === '') return null;
    return { R: R, G: G, B: B };
  }

  // A hide write keeps groups the visitor edited. Loaded URL values are not edits.
  function livePatch(view) {
    const src = view || {};
    const patch = {};
    if (src.mintDirty) {
      if (src.mintOpen) {
        patch.a = digits(src.a);
        patch.b = digits(src.b);
      } else if (src.mint) {
        patch.a = src.mint.a || '';
        patch.b = src.mint.b || '';
      }
    }
    if (src.routeDirty) {
      if (src.routeOpen) patch.n = digits(src.n);
      else patch.n = digits(src.routeTarget);
    }
    if (src.planesDirty) {
      const planes = src.rgbInputs ? planeFields(src.rgbInputs) : planeFields(src.planes);
      if (planes) {
        patch.R = planes.R;
        patch.G = planes.G;
        patch.B = planes.B;
      }
    }
    if (src.toonDirty) {
      if (src.toonOpen) {
        const t = src.toonInputs || {};
        patch.math = digits(t.math);
        patch.word = digits(t.word, true);
        patch.face = digits(t.face, true);
        patch.rgb = digits(t.rgb);
      } else if (src.toon) {
        patch.math = src.toon.math || '';
        patch.word = src.toon.word || '';
        patch.face = src.toon.face || '';
        patch.rgb = src.toon.rgb || '';
      }
    }
    return patch;
  }

  function hideWrite(kind, visibility) {
    return kind === 'pagehide' || visibility === 'hidden';
  }

  function userCommit(reason, opt) {
    const o = opt || {};
    if (reason === 'paint' || reason === 'plan' || reason === 'edit' || reason === 'load') return true;
    if (reason === 'fill') return !!o.advance;
    if (reason === 'change') return !!o.fromUser;
    if (reason === 'swatch') return !!o.touched;
    return false;
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
        mark('press copy');
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
    MARK_KEY: MARK_KEY,
    readMark: readMark,
    writeMark: writeMark,
    markedOpen: markedOpen,
    digits: digits,
    presetName: presetName,
    read: read,
    write: write,
    href: href,
    hasPlanes: hasPlanes,
    fullPlanes: fullPlanes,
    planeFields: planeFields,
    livePatch: livePatch,
    hideWrite: hideWrite,
    userCommit: userCommit,
    namedGroup: namedGroup,
    restoreBag: restoreBag,
    ensBoot: ensBoot,
    storePatch: storePatch,
    mergeStore: mergeStore,
    shareHref: shareHref,
    shareTab: shareTab,
    choosePlanes: choosePlanes,
    readStore: readStore,
    writeStore: writeStore,
    copyHtml: copyHtml,
    attachCopy: attachCopy,
  };
  globalThis.QUERY = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})();
