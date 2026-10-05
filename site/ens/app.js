(function () {
  const D = globalThis.ENSDIFF;
  const REG = D.REGISTRY;
  const state = {
    wallet: '',
    batch: false,
    busy: false,
    names: [],
    byLabel: {},
    parentChain: null,
    simHash: '',
    logsNote: '',
  };

  const parentEl = document.getElementById('parent');
  const whoEl = document.getElementById('who');
  const statusEl = document.getElementById('status');
  const namesEl = document.getElementById('names');

  function setStatus(text) {
    statusEl.textContent = text || '';
  }

  function brief(addr) {
    const h = D.normAddr(addr);
    if (!h) return 'none';
    return h.slice(0, 6) + '…' + h.slice(-4);
  }

  function checksumAddr(addr) {
    const h = D.normAddr(addr).slice(2);
    if (!h) return '';
    const hash = ENS.keccakText(h);
    let out = '0x';
    for (let i = 0; i < h.length; i++) out += parseInt(hash[i], 16) >= 8 ? h[i].toUpperCase() : h[i];
    return out;
  }

  function clip(s) {
    const t = String(s || 'failed');
    return t.length > 180 ? t.slice(0, 180) : t;
  }

  function rejected(e) {
    if (!e) return false;
    if (e.code === 4001) return true;
    const msg = String(e.message || '').toLowerCase();
    return msg.indexOf('user rejected') !== -1 || msg.indexOf('user denied') !== -1;
  }

  function atomicReady(caps) {
    if (!caps) return false;
    const row = caps['0x1'] || caps['0x01'] || caps['1'];
    const status = row && row.atomic && row.atomic.status;
    return status === 'ready' || status === 'supported';
  }

  function receiptOk(s) {
    const h = String(s == null ? '' : s).toLowerCase();
    return h === '0x1' || h === '0x01' || h === '1';
  }

  function simFallback(e) {
    if (!e) return true;
    if (e.code === 3) return false;
    return !/execution reverted/i.test(String(e.message || ''));
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function validLabel(label) {
    return /^[a-z0-9-]+$/.test(label);
  }

  function validParent(name) {
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(name);
  }

  async function batch(calls) {
    try {
      const data = ABI.encodeAggregate(calls.map(function (c) {
        return { to: c.to, data: c.data, allow: true };
      }));
      const raw = await ETH.ethCall(ETH.ADDR.MULTI, data);
      const rows = ABI.decodeAggregate(raw);
      if (rows.length !== calls.length) throw new Error('len');
      return rows;
    } catch (e) {
      const out = [];
      for (let i = 0; i < calls.length; i++) {
        try {
          out.push({ success: true, data: await ETH.ethCall(calls[i].to, calls[i].data) });
        } catch (err) {
          out.push({ success: false, data: '0x' });
        }
      }
      return out;
    }
  }

  function addrOf(row) {
    if (!row || !row.success || !row.data || row.data === '0x') return '';
    try { return D.normAddr(ABI.decodeAddr(row.data)); } catch (e) { return ''; }
  }

  function strOf(row) {
    if (!row || !row.success) return '';
    try { return ABI.decodeString(row.data); } catch (e) { return ''; }
  }

  function boolOf(row) {
    if (!row || !row.success || !row.data) return false;
    try { return ABI.decodeUint(row.data) === 1n; } catch (e) { return false; }
  }

  function multiOf(row) {
    return !!(row && row.success && row.data && row.data.length > 2);
  }

  function blankName() {
    return { label: '', addr: '', text: { url: '', description: '' }, drop: [], takeOwner: false };
  }

  function readForm() {
    const names = [];
    const seen = new Set();
    namesEl.querySelectorAll('.name').forEach(function (section) {
      const label = section.querySelector('[data-f="label"]').value.trim().toLowerCase();
      const text = {};
      const drop = [];
      section.querySelectorAll('.textrow').forEach(function (row) {
        const key = row.querySelector('[data-k]').value.trim();
        const value = row.querySelector('[data-v]').value;
        const extra = row.dataset.extra === '1';
        const del = row.querySelector('[data-drop]').checked;
        if (!key) return;
        if (extra) {
          if (del) drop.push(key);
          return;
        }
        if (value) text[key] = value;
        else if (del) drop.push(key);
      });
      const dup = !!(label && seen.has(label));
      if (label) seen.add(label);
      names.push({
        label: label,
        addr: section.querySelector('[data-f="addr"]').value.trim(),
        text: text,
        drop: drop,
        takeOwner: section.querySelector('[data-f="take"]').checked,
        dup: dup,
        badAddr: !!(section.querySelector('[data-f="addr"]').value.trim() && !D.normAddr(section.querySelector('[data-f="addr"]').value)),
      });
    });
    return names;
  }

  function textRows(name) {
    const text = name.text || {};
    const keys = ['url', 'description'];
    Object.keys(text).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
    const chain = state.byLabel[name.label];
    const chainText = chain && chain.text || {};
    Object.keys(chainText).forEach(function (k) {
      if (chainText[k] && keys.indexOf(k) < 0) keys.push(k);
    });
    return keys.map(function (k) {
      const inForm = Object.prototype.hasOwnProperty.call(text, k);
      const extra = !inForm && !!chainText[k];
      return {
        key: k,
        value: inForm ? String(text[k] == null ? '' : text[k]) : '',
        extra: extra,
        shown: extra ? String(chainText[k] || '') : (inForm ? String(text[k] == null ? '' : text[k]) : ''),
        drop: (name.drop || []).indexOf(k) !== -1,
      };
    });
  }

  function render() {
    namesEl.textContent = '';
    state.names.forEach(function (name) { namesEl.appendChild(nameSection(name)); });
    refresh();
  }

  function nameSection(name) {
    const section = document.createElement('section');
    section.className = 'name';
    const h2 = document.createElement('h2');
    section.appendChild(h2);
    section.appendChild(field('label', 'label', name.label || ''));
    section.appendChild(field('addr', 'addr', name.addr ? checksumAddr(name.addr) || name.addr : ''));
    const texts = document.createElement('div');
    texts.className = 'texts';
    textRows(name).forEach(function (row) { texts.appendChild(textRow(row)); });
    section.appendChild(texts);
    const add = document.createElement('button');
    add.type = 'button';
    add.dataset.act = 'addkey';
    add.textContent = 'add text';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.dataset.act = 'remove';
    remove.textContent = 'remove';
    const take = document.createElement('label');
    take.className = 'take';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.dataset.f = 'take';
    box.checked = !!name.takeOwner;
    take.appendChild(box);
    take.appendChild(document.createTextNode(' set owner to this wallet'));
    const status = document.createElement('div');
    status.className = 'status';
    section.appendChild(add);
    section.appendChild(remove);
    section.appendChild(take);
    section.appendChild(status);
    return section;
  }

  function field(key, label, value) {
    const lab = document.createElement('label');
    lab.className = 'field';
    const span = document.createElement('span');
    span.textContent = label;
    const input = document.createElement('input');
    input.type = 'text';
    input.dataset.f = key;
    input.value = value;
    input.autocomplete = 'off';
    input.spellcheck = false;
    lab.appendChild(span);
    lab.appendChild(input);
    return lab;
  }

  function textRow(row) {
    const line = document.createElement('div');
    line.className = 'textrow';
    if (row.extra) line.dataset.extra = '1';
    const key = document.createElement('input');
    key.type = 'text';
    key.dataset.k = '1';
    key.value = row.key;
    key.placeholder = 'key';
    key.autocomplete = 'off';
    key.spellcheck = false;
    if (row.extra || row.key === 'url' || row.key === 'description') key.readOnly = true;
    const value = document.createElement('input');
    value.type = 'text';
    value.dataset.v = '1';
    value.value = row.shown || '';
    value.placeholder = 'value';
    value.autocomplete = 'off';
    if (row.extra) value.readOnly = true;
    const drop = document.createElement('label');
    drop.className = 'drop';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.dataset.drop = '1';
    box.checked = !!row.drop;
    drop.appendChild(box);
    drop.appendChild(document.createTextNode(' delete'));
    drop.hidden = !row.extra;
    line.appendChild(key);
    line.appendChild(value);
    line.appendChild(drop);
    return line;
  }

  function parentName() {
    return parentEl.value.trim().toLowerCase();
  }

  function offerOpen() {
    const el = document.getElementById('offer');
    return el && !el.hidden;
  }

  function buildSpec(form) {
    const parent = parentName();
    const seen = new Set();
    const names = [];
    (form || readForm()).forEach(function (n) {
      if (!validLabel(n.label) || n.dup || n.badAddr || seen.has(n.label)) return;
      if (state.parentChain && !state.byLabel[n.label]) return;
      seen.add(n.label);
      const chain = state.byLabel[n.label] || {
        exists: false,
        owner: '',
        resolver: '',
        addr: '',
        text: {},
        resolverMulticall: false,
        approved: false,
      };
      names.push({
        label: n.label,
        node: ENS.namehash(n.label + '.' + parent),
        labelhash: ENS.keccakText(n.label),
        addr: n.addr,
        text: n.text,
        takeOwner: n.takeOwner,
        drop: n.drop,
        chain: chain,
      });
    });
    const p = state.parentChain || {};
    return {
      parent: parent,
      wrapped: !!p.wrapped,
      parentNode: validParent(parent) ? ENS.namehash(parent) : ENS.namehash(''),
      wallet: D.normAddr(state.wallet),
      controlsParent: !!p.controls,
      parentResolver: p.resolver || '',
      parentResolverMulticall: !!p.resolverMulticall,
      useNewResolver: offerOpen() && document.getElementById('newres').checked,
      names: names,
    };
  }

  function planHash(txs) {
    return (txs || []).map(function (tx) { return tx.to + tx.data; }).join('|');
  }

  function kindWord(kind) {
    if (kind === 'same') return 'already set';
    if (kind === 'new') return 'new';
    if (kind === 'changed') return 'changed';
    if (kind === 'extra') return 'extra';
    if (kind === 'kept') return 'left as is';
    return kind;
  }

  function showVal(v) {
    if (!v) return 'none';
    if (D.normAddr(v)) return brief(v);
    return String(v);
  }

  function paintParent() {
    const el = document.getElementById('parent-state');
    const p = state.parentChain;
    el.className = '';
    if (!p) {
      el.textContent = '';
      return;
    }
    const bits = [
      p.name,
      p.wrapped ? 'wrapped' : 'unwrapped',
      'owner ' + brief(p.owner),
      p.resolver ? 'resolver ' + brief(p.resolver) : 'no resolver',
      p.resolver ? ('multicall ' + (p.resolverMulticall ? 'yes' : 'no')) : '',
    ].filter(Boolean);
    let text = bits.join(', ');
    if (!state.wallet) text += '. connect a wallet that controls it';
    else if (!p.controls) {
      text += '. this wallet does not control ' + p.name;
      el.className = 'bad';
    } else text += '. this wallet controls it';
    if (state.logsNote) text += '. ' + state.logsNote;
    el.textContent = text;
    el.title = (p.owner || '') + ' ' + (p.resolver || '');
  }

  function paintOffer() {
    const el = document.getElementById('offer');
    const p = state.parentChain;
    const noMulti = !!(p && p.resolver && !p.resolverMulticall);
    const wrappedOld = !!(p && p.wrapped && p.resolver && D.normAddr(p.resolver) !== D.NEW_RESOLVER);
    el.hidden = !noMulti && !wrappedOld;
    const parts = [];
    if (noMulti) parts.push('This resolver has no multicall. New names can keep it (one transaction per record) or use the new public resolver ' + checksumAddr(D.NEW_RESOLVER) + ' (one transaction per name).');
    if (wrappedOld) parts.push('This resolver cannot write records on a wrapped name. New names can use the new public resolver ' + checksumAddr(D.NEW_RESOLVER) + '.');
    document.getElementById('offer-note').textContent = parts.join(' ');
  }

  function line(box, f, label) {
    const p = document.createElement('p');
    p.className = 'rec ' + (f.kind || '');
    let text = label + ' ' + kindWord(f.kind);
    if (f.kind === 'changed') text += ' ' + showVal(f.old) + ' → ' + showVal(f.next);
    else if (f.kind === 'new') { if (f.next) text += ' ' + showVal(f.next); }
    else if (f.kind === 'extra') text += ' ' + showVal(f.old) + (f.next ? ', keep' : ', delete');
    else text += ' ' + showVal(f.old || f.next);
    p.textContent = text;
    box.appendChild(p);
  }

  function refresh() {
    const form = namesEl.querySelectorAll('.name').length ? readForm() : state.names;
    if (namesEl.querySelectorAll('.name').length) state.names = form;
    const spec = validParent(parentName()) ? buildSpec(form) : null;
    const plan = spec ? D.diff(spec) : { names: [], txs: [], blocked: '' };
    const byName = {};
    plan.names.forEach(function (row) { byName[row.label] = row; });
    namesEl.querySelectorAll('.name').forEach(function (section, i) {
      const n = form[i];
      const row = n && byName[n.label];
      const parent = parentName();
      section.querySelector('h2').textContent = n && n.label && validParent(parent) ? (n.label + '.' + parent) : 'name';
      const take = section.querySelector('.take');
      const chain = n && state.byLabel[n.label];
      const other = !!(chain && chain.exists && D.normAddr(chain.owner) && D.normAddr(chain.owner) !== D.normAddr(state.wallet));
      take.hidden = !other;
      const box = section.querySelector('.status');
      box.textContent = '';
      if (!n || !n.label) return;
      if (!validLabel(n.label)) {
        box.textContent = 'label needs letters, digits, or a hyphen';
        return;
      }
      if (n.dup) {
        box.textContent = 'duplicate label';
        return;
      }
      if (n.badAddr) {
        box.textContent = 'bad address';
        return;
      }
      if (state.parentChain && !state.byLabel[n.label]) {
        box.textContent = 'read again';
        return;
      }
      section.querySelectorAll('.textrow').forEach(function (lineEl) {
        const key = lineEl.querySelector('[data-k]').value.trim();
        const value = lineEl.querySelector('[data-v]').value;
        const extra = lineEl.dataset.extra === '1';
        const chainVal = chain && chain.text ? chain.text[key] : '';
        const show = extra || (!value && !!chainVal);
        lineEl.querySelector('.drop').hidden = !show;
      });
      if (!row) return;
      if (row.note === 'owner') {
        const p = document.createElement('p');
        p.className = 'bad';
        p.textContent = 'this wallet does not own ' + row.name;
        box.appendChild(p);
      } else if (row.note === 'resolver') {
        const p = document.createElement('p');
        p.className = 'bad';
        p.textContent = 'records on a wrapped name need the new public resolver';
        box.appendChild(p);
      } else if (!state.parentChain) {
        const p = document.createElement('p');
        p.className = 'dim';
        p.textContent = 'not read yet';
        box.appendChild(p);
      }
      if (!state.parentChain) return;
      line(box, row.owner, 'owner');
      line(box, row.resolver, 'resolver');
      line(box, row.addr, 'addr');
      row.texts.forEach(function (t) { line(box, t, t.key); });
    });
    paintParent();
    paintOffer();
    paintTxs(plan);
    paintActions(plan);
    return plan;
  }

  function paintTxs(plan) {
    const ol = document.getElementById('steps');
    const count = document.getElementById('count');
    ol.textContent = '';
    const txs = plan && plan.txs || [];
    if (!state.parentChain) {
      count.textContent = '';
      return;
    }
    if (!txs.length) {
      const work = (plan.names || []).some(function (n) {
        if (n.owner.kind === 'new' || n.owner.kind === 'changed') return true;
        if (n.resolver.kind === 'new' || n.resolver.kind === 'changed') return true;
        if (n.addr.kind === 'new' || n.addr.kind === 'changed') return true;
        return (n.texts || []).some(function (t) {
          return t.kind === 'new' || t.kind === 'changed' || (t.kind === 'extra' && !t.next);
        });
      });
      if (work && !state.wallet) count.textContent = 'connect a wallet to build the transactions';
      else if (work) count.textContent = 'nothing to send';
      else count.textContent = 'already set. nothing to sign.';
      return;
    }
    let summary = txs.length + (txs.length === 1 ? ' transaction' : ' transactions');
    if (state.wallet && !state.parentChain.controls) summary += '. this wallet cannot send them';
    count.textContent = summary;
    txs.forEach(function (tx, i) {
      const li = document.createElement('li');
      li.textContent = tx.label;
      li.title = tx.to;
      li.dataset.i = String(i);
      ol.appendChild(li);
    });
  }

  function paintActions(plan) {
    const txs = plan && plan.txs || [];
    const controls = !!(state.parentChain && state.parentChain.controls);
    const ready = txs.length > 0 && !!state.wallet && controls && !state.busy;
    document.getElementById('simulate').disabled = !ready;
    const signed = ready && state.simHash && state.simHash === planHash(txs);
    document.getElementById('sign').disabled = !signed || state.busy;
    const batchBtn = document.getElementById('batch');
    batchBtn.hidden = !state.batch;
    batchBtn.disabled = !signed || state.busy;
    document.getElementById('read').disabled = !!state.busy;
    document.getElementById('connect').disabled = !!state.busy;
  }

  function capture() {
    if (namesEl.querySelectorAll('.name').length) state.names = readForm();
  }

  async function loadChain(form) {
    const parent = parentName();
    if (!validParent(parent)) throw new Error('parent name');
    const parentNode = ENS.namehash(parent);
    const items = [];
    const seen = new Set();
    form.forEach(function (n) {
      if (!validLabel(n.label) || n.dup || seen.has(n.label)) return;
      seen.add(n.label);
      items.push({
        label: n.label,
        node: ENS.namehash(n.label + '.' + parent),
        text: n.text || {},
      });
    });
    const calls = [
      { to: REG, data: D.ownerData(parentNode) },
      { to: REG, data: D.resolverData(parentNode) },
    ];
    items.forEach(function (n) {
      calls.push({ to: REG, data: D.ownerData(n.node) });
      calls.push({ to: REG, data: D.resolverData(n.node) });
    });
    const rows = await batch(calls);
    const regOwner = addrOf(rows[0]);
    const parentResolver = addrOf(rows[1]);
    if (!regOwner) throw new Error('this name is not registered');
    const wrapped = regOwner === D.WRAPPER;
    items.forEach(function (n, i) {
      n.regOwner = addrOf(rows[2 + i * 2]);
      n.resolver = addrOf(rows[3 + i * 2]);
    });

    const follow = [];
    function push(to, data, tag) {
      follow.push({ to: to, data: data, tag: tag });
    }
    if (wrapped) push(D.WRAPPER, D.ownerOfData(parentNode), { kind: 'parent-owner' });
    const resolvers = [];
    if (parentResolver) resolvers.push(parentResolver);
    items.forEach(function (n) {
      if (n.regOwner === D.WRAPPER) push(D.WRAPPER, D.ownerOfData(n.node), { kind: 'owner', label: n.label });
      if (n.resolver && resolvers.indexOf(n.resolver) < 0) resolvers.push(n.resolver);
    });
    resolvers.forEach(function (resolver) {
      push(resolver, D.emptyMulticall(), { kind: 'multi', resolver: resolver });
    });
    const followed = follow.length ? await batch(follow.map(function (c) { return { to: c.to, data: c.data }; })) : [];
    const multi = {};
    let parentController = wrapped ? '' : regOwner;
    followed.forEach(function (row, i) {
      const tag = follow[i].tag;
      if (tag.kind === 'parent-owner') parentController = addrOf(row);
      if (tag.kind === 'owner') {
        const item = items.filter(function (n) { return n.label === tag.label; })[0];
        if (item) item.controller = addrOf(row);
      }
      if (tag.kind === 'multi') multi[tag.resolver] = multiOf(row);
    });
    items.forEach(function (n) {
      if (n.regOwner !== D.WRAPPER) n.controller = n.regOwner;
      n.exists = !!n.controller;
    });

    const wallet = D.normAddr(state.wallet);
    const approve = [];
    if (wallet && parentController && wallet !== parentController) {
      approve.push({
        to: wrapped ? D.WRAPPER : REG,
        data: D.approvedData(parentController, wallet),
        tag: { kind: 'parent' },
      });
    }
    items.forEach(function (n) {
      if (wallet && n.controller && wallet !== n.controller) {
        approve.push({
          to: n.regOwner === D.WRAPPER ? D.WRAPPER : REG,
          data: D.approvedData(n.controller, wallet),
          tag: { kind: 'name', label: n.label },
        });
      }
    });
    let parentApproved = false;
    const nameApproved = {};
    if (approve.length) {
      const arows = await batch(approve.map(function (c) { return { to: c.to, data: c.data }; }));
      arows.forEach(function (row, i) {
        if (approve[i].tag.kind === 'parent') parentApproved = boolOf(row);
        else nameApproved[approve[i].tag.label] = boolOf(row);
      });
    }

    const reads = [];
    items.forEach(function (n) {
      if (!n.resolver) return;
      const keys = Object.keys(n.text || {});
      if (keys.indexOf('url') < 0) keys.push('url');
      if (keys.indexOf('description') < 0) keys.push('description');
      reads.push({ to: n.resolver, data: D.addrData(n.node), tag: { kind: 'addr', label: n.label } });
      keys.forEach(function (key) {
        reads.push({ to: n.resolver, data: D.textData(n.node, key), tag: { kind: 'text', label: n.label, key: key } });
      });
    });
    const rrows = reads.length ? await batch(reads.map(function (c) { return { to: c.to, data: c.data }; })) : [];
    const byLabel = {};
    items.forEach(function (n) {
      byLabel[n.label] = {
        exists: n.exists,
        owner: n.controller || '',
        resolver: n.resolver || '',
        addr: '',
        text: {},
        resolverMulticall: !!(n.resolver && multi[n.resolver]),
        approved: !!nameApproved[n.label],
      };
    });
    rrows.forEach(function (row, i) {
      const tag = reads[i].tag;
      const chain = byLabel[tag.label];
      if (!chain) return;
      if (tag.kind === 'addr') chain.addr = addrOf(row);
      if (tag.kind === 'text') {
        const value = strOf(row);
        if (value) chain.text[tag.key] = value;
      }
    });

    let logsFailed = false;
    const logJobs = items.filter(function (n) { return n.resolver; });
    const found = await pool(logJobs, 3, function (n) { return extraKeys(n.resolver, n.node); });
    const extraReads = [];
    found.forEach(function (res, i) {
      if (!res || res.failed) logsFailed = true;
      const n = logJobs[i];
      (res && res.keys || []).forEach(function (key) {
        if (byLabel[n.label].text[key]) return;
        extraReads.push({ to: n.resolver, data: D.textData(n.node, key), tag: { label: n.label, key: key } });
      });
    });
    if (extraReads.length) {
      const erows = await batch(extraReads.map(function (c) { return { to: c.to, data: c.data }; }));
      erows.forEach(function (row, i) {
        const value = strOf(row);
        if (!value) return;
        byLabel[extraReads[i].tag.label].text[extraReads[i].tag.key] = value;
      });
    }

    return {
      parent: {
        name: parent,
        wrapped: wrapped,
        owner: parentController,
        resolver: parentResolver,
        resolverMulticall: !!(parentResolver && multi[parentResolver]),
        controls: !!(wallet && (wallet === parentController || parentApproved)),
      },
      names: byLabel,
      logsFailed: logsFailed,
    };
  }

  async function extraKeys(resolver, node) {
    const topics = [
      '0x' + ENS.keccakText('TextChanged(bytes32,string,string)'),
      '0x' + ENS.keccakText('TextChanged(bytes32,string,string,string)'),
    ];
    try {
      const logs = await getLogs({
        address: resolver,
        fromBlock: '0x895440',
        toBlock: 'latest',
        topics: [topics, '0x' + node],
      });
      const keys = new Set();
      logs.forEach(function (log) {
        try {
          const key = ABI.decodeString(log.data);
          if (key && key.length < 65) keys.add(key);
        } catch (e) { /* skip a log we cannot decode */ }
      });
      return { keys: Array.from(keys), failed: false };
    } catch (e) {
      return { keys: [], failed: true };
    }
  }

  async function getLogs(filter) {
    const urls = ETH.RPCS.filter(function (u) { return u.indexOf('tenderly') !== -1; })
      .concat(ETH.RPCS.filter(function (u) { return u.indexOf('tenderly') === -1; }));
    let last;
    for (let i = 0; i < urls.length; i++) {
      try {
        const res = await fetch(urls[i], {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getLogs', params: [filter] }),
          signal: AbortSignal.timeout(12000),
        });
        const j = await res.json();
        if (j.result) return j.result;
        last = j.error && j.error.message;
      } catch (e) {
        last = e.message;
      }
    }
    throw new Error(last || 'logs');
  }

  async function pool(items, n, fn) {
    const out = new Array(items.length);
    let i = 0;
    async function worker() {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k], k);
      }
    }
    const jobs = [];
    const c = Math.min(n, items.length);
    for (let k = 0; k < c; k++) jobs.push(worker());
    await Promise.all(jobs);
    return out;
  }

  async function read() {
    capture();
    state.busy = true;
    state.simHash = '';
    setStatus('reading');
    paintActions({ txs: [] });
    try {
      const snap = await loadChain(state.names);
      state.parentChain = snap.parent;
      state.byLabel = snap.names;
      state.logsNote = snap.logsFailed ? 'extra text records could not be listed' : '';
      render();
      setStatus('read');
    } catch (e) {
      setStatus(clip(e.message || e));
      refresh();
    } finally {
      state.busy = false;
      refresh();
    }
  }

  async function runSimulate(txs) {
    let ordered = false;
    try {
      const rows = await ETH.simulateCalls(txs.map(function (tx) {
        return { from: state.wallet, to: tx.to, data: tx.data, value: '0x0' };
      }));
      ordered = true;
      for (let i = 0; i < rows.length; i++) {
        if (receiptOk(rows[i] && rows[i].status)) continue;
        throw new Error(txs[i].label + ': ' + (ETH.reason(rows[i] && rows[i].error) || 'reverted'));
      }
    } catch (e) {
      if (ordered || !simFallback(e)) throw e;
    }
    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      if (tx.depends && ordered) continue;
      if (tx.depends) throw new Error(tx.label + ': ordered simulation unavailable');
      const call = { from: state.wallet, to: tx.to, data: tx.data, value: '0x0' };
      const probed = await ETH.simulate(call);
      if (probed.error) throw new Error(tx.label + ': ' + ETH.reason(probed.error));
      const gas = await ETH.estimateGas(call);
      if (gas.error) throw new Error(tx.label + ': ' + ETH.reason(gas.error));
    }
  }

  async function simulate() {
    const plan = refresh();
    if (!plan.txs.length || !state.parentChain || !state.parentChain.controls) return;
    state.busy = true;
    state.simHash = '';
    setStatus('simulating');
    paintActions(plan);
    try {
      await runSimulate(plan.txs);
      state.simHash = planHash(plan.txs);
      setStatus('simulation passed. ' + plan.txs.length + (plan.txs.length === 1 ? ' transaction' : ' transactions'));
    } catch (e) {
      state.simHash = '';
      setStatus(clip(e.message || e));
    } finally {
      state.busy = false;
      refresh();
    }
  }

  async function waitReceipt(hash) {
    for (let i = 0; i < 30; i++) {
      const rec = await ETH.receipt(hash);
      if (rec && rec.blockNumber) {
        if (String(rec.status).toLowerCase() === '0x0') throw new Error('reverted');
        return rec;
      }
      await sleep(2000);
    }
    const err = new Error('submitted, receipt not in yet. read again before sending the rest');
    err.pending = true;
    throw err;
  }

  function markStep(i, text) {
    const li = document.querySelector('#steps li[data-i="' + i + '"]');
    if (!li) return;
    li.textContent = text;
    li.className = 'now';
  }

  async function sendSeq(txs) {
    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];
      const prefix = (i + 1) + '/' + txs.length + ' ';
      setStatus(prefix + tx.label);
      markStep(i, prefix + tx.label);
      let hash;
      try {
        hash = await ETH.send({ from: state.wallet, to: tx.to, data: tx.data, value: '0x0' });
      } catch (e) {
        if (rejected(e)) {
          setStatus('rejected ' + prefix + tx.label);
          markStep(i, 'rejected ' + tx.label);
          return;
        }
        throw e;
      }
      setStatus(prefix + 'waiting ' + tx.label);
      markStep(i, prefix + 'waiting ' + hash);
      await waitReceipt(hash);
      markStep(i, prefix + 'confirmed ' + hash);
    }
    setStatus('confirmed ' + txs.length + '/' + txs.length);
  }

  async function sendBatch(txs) {
    setStatus('batch 1/1, ' + txs.length + ' calls');
    const res = await ethereum.request({
      method: 'wallet_sendCalls',
      params: [{
        version: '2.0.0',
        chainId: '0x1',
        from: state.wallet,
        atomicRequired: true,
        calls: txs.map(function (tx) { return { to: tx.to, data: tx.data, value: '0x0' }; }),
      }],
    });
    const id = typeof res === 'string' ? res : (res && (res.id || res.callsId)) || '';
    setStatus(id ? 'batch submitted ' + id : 'batch submitted');
  }

  async function sign(batchMode) {
    const plan = refresh();
    if (!plan.txs.length || state.simHash !== planHash(plan.txs)) {
      setStatus('simulate again');
      return;
    }
    if (!state.parentChain || !state.parentChain.controls) {
      setStatus('this wallet does not control ' + parentName());
      return;
    }
    state.busy = true;
    paintActions(plan);
    try {
      await ETH.ensureChain();
      if (batchMode) await sendBatch(plan.txs);
      else await sendSeq(plan.txs);
      state.simHash = '';
    } catch (e) {
      if (rejected(e)) setStatus('rejected');
      else setStatus(clip(e.message || e));
    } finally {
      state.busy = false;
      refresh();
    }
  }

  async function connect() {
    if (!globalThis.ethereum) {
      setStatus('no wallet');
      return;
    }
    state.busy = true;
    paintActions({ txs: [] });
    try {
      await ETH.ensureChain();
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      state.wallet = accounts && accounts[0] || '';
      whoEl.textContent = state.wallet ? brief(state.wallet) : '';
      whoEl.title = state.wallet || '';
      try {
        const caps = await ethereum.request({ method: 'wallet_getCapabilities', params: [state.wallet] });
        state.batch = atomicReady(caps);
      } catch (e) {
        state.batch = false;
      }
    } catch (e) {
      if (!rejected(e)) setStatus(clip(e.message || e));
      state.busy = false;
      refresh();
      return;
    }
    state.busy = false;
    await read();
  }

  function applyPreset(preset) {
    parentEl.value = preset.parent;
    state.names = preset.names.map(function (n) {
      return {
        label: n.label,
        addr: checksumAddr(n.addr),
        text: Object.assign({}, n.text),
        drop: [],
        takeOwner: false,
      };
    });
    state.byLabel = {};
    state.parentChain = null;
    state.simHash = '';
    state.logsNote = '';
    render();
    read();
  }

  function pageDir() {
    const u = new URL(location.href);
    if (u.pathname.endsWith('/')) return u;
    if (/\.html?$/i.test(u.pathname)) u.pathname = u.pathname.replace(/[^/]*$/, '');
    else u.pathname += '/';
    return u;
  }

  function presetUrl(value) {
    return new URL(D.presetPath(value), pageDir()).href;
  }

  async function loadPresetParam(value) {
    try {
      setStatus('loading preset');
      const res = await fetch(presetUrl(value));
      if (!res.ok) throw new Error('preset');
      applyPreset(D.parsePreset(await res.json()));
    } catch (e) {
      setStatus(clip(e.message || e));
    }
  }

  function onEdit() {
    state.simHash = '';
    refresh();
  }

  function bind() {
    document.getElementById('connect').addEventListener('click', connect);
    document.getElementById('read').addEventListener('click', read);
    document.getElementById('simulate').addEventListener('click', simulate);
    document.getElementById('sign').addEventListener('click', function () { sign(false); });
    document.getElementById('batch').addEventListener('click', function () { sign(true); });
    document.getElementById('add').addEventListener('click', function () {
      capture();
      state.names.push(blankName());
      state.simHash = '';
      render();
    });
    document.getElementById('newres').addEventListener('change', onEdit);
    parentEl.addEventListener('input', function () {
      state.parentChain = null;
      state.byLabel = {};
      state.simHash = '';
      state.logsNote = '';
      refresh();
    });
    namesEl.addEventListener('input', onEdit);
    namesEl.addEventListener('change', onEdit);
    namesEl.addEventListener('click', function (e) {
      const btn = e.target.closest('button');
      if (!btn) return;
      const section = btn.closest('.name');
      if (btn.dataset.act === 'addkey') {
        const line = textRow({ key: '', value: '', extra: false, shown: '', drop: false });
        line.querySelector('[data-k]').readOnly = false;
        section.querySelector('.texts').appendChild(line);
        state.simHash = '';
        refresh();
      }
      if (btn.dataset.act === 'remove') {
        section.remove();
        capture();
        state.simHash = '';
        refresh();
      }
    });
    document.getElementById('file').addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        try { applyPreset(D.parsePreset(String(reader.result))); }
        catch (err) { setStatus(clip(err.message || err)); }
      };
      reader.readAsText(file);
    });
    if (globalThis.ethereum && ethereum.on) {
      ethereum.on('accountsChanged', function (accounts) {
        state.wallet = accounts && accounts[0] || '';
        whoEl.textContent = state.wallet ? brief(state.wallet) : '';
        whoEl.title = state.wallet || '';
        state.simHash = '';
        if (state.wallet) read();
        else refresh();
      });
    }
  }

  bind();
  state.names = [blankName()];
  render();
  const preset = new URLSearchParams(location.search).get('preset');
  if (preset) loadPresetParam(preset);
})();
