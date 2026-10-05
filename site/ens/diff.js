(function (g, f) {
  const api = f();
  if (typeof module === 'object' && module.exports) module.exports = api;
  g.ENSDIFF = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const REGISTRY = '0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e';
  const WRAPPER = '0xd4416b13d2b3a9abae7acd5d6c2bbdbe25686401';
  const NEW_RESOLVER = '0x231b0ee14048e9dccd1d247744d114a4eb5e8e63';
  const ZERO = '0x' + '0'.repeat(40);

  function abi() {
    const lib = globalThis.ABI;
    if (!lib) throw new Error('abi');
    return lib;
  }

  function normAddr(a) {
    const h = String(a || '').trim().toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(h)) return '';
    if (h === ZERO) return '';
    return h;
  }

  function node32(h) {
    const x = String(h || '').replace(/^0x/, '').toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(x)) throw new Error('node');
    return x;
  }

  function hexOf(text) {
    const bytes = new TextEncoder().encode(String(text));
    let h = '';
    for (let i = 0; i < bytes.length; i++) h += bytes[i].toString(16).padStart(2, '0');
    return h;
  }

  function encodeBytes(hex) {
    const h = String(hex || '').replace(/^0x/, '').toLowerCase();
    if (h.length % 2) throw new Error('odd');
    if (h && !/^[0-9a-f]*$/.test(h)) throw new Error('hex');
    const pad = h.padEnd(Math.ceil(h.length / 64) * 64, '0');
    return abi().word(h.length / 2) + pad;
  }

  function encodeString(text) {
    return encodeBytes(hexOf(text));
  }

  function encodeBytesArray(blobs) {
    const bodies = blobs.map(encodeBytes);
    let cursor = 32 * blobs.length;
    const offsets = bodies.map(function (body) {
      const off = abi().word(cursor);
      cursor += body.length / 2;
      return off;
    });
    return abi().word(blobs.length) + offsets.join('') + bodies.join('');
  }

  function multicallData(calls) {
    const blobs = (calls || []).map(function (c) { return String(c).replace(/^0x/, ''); });
    return '0xac9650d8' + abi().word(0x20) + encodeBytesArray(blobs);
  }

  function decodeMulticall(data) {
    const h = String(data || '').replace(/^0x/, '').toLowerCase();
    if (h.slice(0, 8) !== 'ac9650d8') throw new Error('multicall');
    const body = h.slice(8);
    const off = Number(BigInt('0x' + body.slice(0, 64)));
    if (off !== 32) throw new Error('offset');
    const array = body.slice(off * 2);
    const n = Number(BigInt('0x' + array.slice(0, 64)));
    const tail = array.slice(64);
    const out = [];
    for (let i = 0; i < n; i++) {
      const rel = Number(BigInt('0x' + tail.slice(i * 64, (i + 1) * 64)));
      const start = rel * 2;
      const len = Number(BigInt('0x' + tail.slice(start, start + 64)));
      out.push('0x' + tail.slice(start + 64, start + 64 + len * 2));
    }
    return out;
  }

  function emptyMulticall() {
    return '0xac9650d8' + abi().word(0x20) + abi().word(0);
  }

  function ownerData(node) {
    return '0x02571be3' + node32(node);
  }

  function resolverData(node) {
    return '0x0178b8bf' + node32(node);
  }

  function addrData(node) {
    return '0x3b3b57de' + node32(node);
  }

  function textData(node, key) {
    return '0x59d1d43c' + node32(node) + abi().word(0x40) + encodeString(key);
  }

  function approvedData(owner, operator) {
    return '0xe985e9c5' + abi().addr(owner) + abi().addr(operator);
  }

  function ownerOfData(node) {
    return abi().call('6352211e', [BigInt('0x' + node32(node))]);
  }

  function setAddrData(node, addr) {
    return '0xd5fa2b00' + node32(node) + abi().addr(addr);
  }

  function setTextData(node, key, value) {
    const k = encodeString(key);
    const v = encodeString(value);
    return '0x10f13a8c' + node32(node) + abi().word(0x60) + abi().word(0x60 + k.length / 2) + k + v;
  }

  function setSubnodeUnwrapped(parentNode, labelhash, owner, resolver) {
    return '0x5ef2c7f0' + node32(parentNode) + node32(labelhash) + abi().addr(owner) + abi().addr(resolver) + abi().word(0);
  }

  function setSubnodeWrapped(parentNode, label, owner, resolver) {
    const lab = encodeString(label);
    return '0x24c1af44' + node32(parentNode) + abi().word(0xe0) + abi().addr(owner) + abi().addr(resolver) + abi().word(0) + abi().word(0) + abi().word(0) + lab;
  }

  function parsePreset(raw) {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || typeof data !== 'object') throw new Error('preset');
    const parent = String(data.parent || '').trim().toLowerCase();
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(parent)) throw new Error('parent');
    if (!Array.isArray(data.names)) throw new Error('names');
    const seen = new Set();
    const names = data.names.map(function (row, i) {
      if (!row || typeof row !== 'object') throw new Error('name ' + i);
      const label = String(row.label || '').trim().toLowerCase();
      if (!/^[a-z0-9-]+$/.test(label)) throw new Error('label ' + label);
      if (seen.has(label)) throw new Error('duplicate ' + label);
      seen.add(label);
      const addr = normAddr(row.addr);
      if (!addr) throw new Error('addr ' + label);
      const text = {};
      const src = row.text || {};
      if (typeof src !== 'object' || Array.isArray(src)) throw new Error('text ' + label);
      Object.keys(src).forEach(function (k) {
        const key = String(k).trim();
        if (!key || key.length > 64 || /[^\x20-\x7e]/.test(key)) throw new Error('key ' + label);
        text[key] = String(src[k] == null ? '' : src[k]);
      });
      return { label: label, addr: addr, text: text };
    });
    return { parent: parent, names: names };
  }

  function ids(parent, label) {
    const ens = globalThis.ENS;
    if (!ens) throw new Error('ens');
    return {
      parentNode: ens.namehash(parent),
      node: ens.namehash(label + '.' + parent),
      labelhash: ens.keccakText(label),
    };
  }

  function field(kind, old, next) {
    return { kind: kind, old: old == null ? '' : String(old), next: next == null ? '' : String(next) };
  }

  function sameAddr(a, b) {
    return normAddr(a) === normAddr(b);
  }

  function wrapperAware(resolver) {
    return normAddr(resolver) === NEW_RESOLVER;
  }

  function diffName(spec, name) {
    const wallet = normAddr(spec.wallet);
    const parent = String(spec.parent || '').trim().toLowerCase();
    const label = String(name.label || '').trim().toLowerCase();
    const found = name.node && name.labelhash ? {
      parentNode: spec.parentNode,
      node: node32(name.node),
      labelhash: node32(name.labelhash),
    } : ids(parent, label);
    const chain = name.chain || {};
    const chainOwner = normAddr(chain.owner);
    const chainResolver = normAddr(chain.resolver);
    const exists = !!chain.exists && !!chainOwner;
    const desiredAddr = normAddr(name.addr);
    const desiredText = name.text || {};
    const drop = {};
    (name.drop || []).forEach(function (k) { drop[String(k)] = true; });
    const chainText = chain.text || {};

    const parentResolver = normAddr(spec.parentResolver);
    let nextResolver = chainResolver;
    let nextResolverMulticall = !!chain.resolverMulticall;
    let writeResolver = false;
    if (!exists || !chainResolver) {
      if (spec.useNewResolver && (!spec.parentResolverMulticall || (spec.wrapped && !wrapperAware(parentResolver)))) {
        nextResolver = NEW_RESOLVER;
        nextResolverMulticall = true;
      } else {
        nextResolver = parentResolver;
        nextResolverMulticall = !!spec.parentResolverMulticall && !!parentResolver;
      }
      writeResolver = !!nextResolver;
    }

    const nextOwner = !exists ? wallet : (name.takeOwner && wallet ? wallet : chainOwner);
    const writeOwner = !!wallet && (!exists || (!!name.takeOwner && chainOwner !== wallet));
    const needSubnode = (writeOwner || writeResolver) && !!wallet && !!nextOwner && !!nextResolver;

    const ownerKind = !exists ? 'new' : (writeOwner ? 'changed' : (chainOwner === wallet ? 'same' : 'kept'));
    const resolverKind = !exists || !chainResolver ? (nextResolver ? 'new' : 'same') : (chainResolver === nextResolver ? 'same' : 'changed');

    let addrKind = 'same';
    if (desiredAddr) {
      if (!normAddr(chain.addr)) addrKind = 'new';
      else if (!sameAddr(chain.addr, desiredAddr)) addrKind = 'changed';
    }
    const writeAddr = addrKind === 'new' || addrKind === 'changed';

    const texts = [];
    const textWrites = [];
    Object.keys(desiredText).sort().forEach(function (key) {
      const next = String(desiredText[key] == null ? '' : desiredText[key]);
      if (!next) return;
      const old = chainText[key] == null ? '' : String(chainText[key]);
      let kind = 'same';
      if (!old) kind = 'new';
      else if (old !== next) kind = 'changed';
      texts.push(field(kind, old, next));
      texts[texts.length - 1].key = key;
      if (kind !== 'same') textWrites.push({ key: key, value: next });
    });
    Object.keys(chainText).sort().forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(desiredText, key) && String(desiredText[key] || '')) return;
      const old = String(chainText[key] || '');
      if (!old) return;
      texts.push(Object.assign(field('extra', old, drop[key] ? '' : old), { key: key }));
      if (drop[key]) textWrites.push({ key: key, value: '' });
    });

    const ownerAfter = needSubnode ? nextOwner : chainOwner;
    const canWrite = !!wallet && (ownerAfter === wallet || (!!chain.approved && ownerAfter === chainOwner && !writeOwner));
    const recordsOk = canWrite && !!nextResolver && (!spec.wrapped || wrapperAware(nextResolver));
    let note = '';
    if (!wallet) note = 'connect';
    else if (exists && ownerAfter !== wallet && !chain.approved) note = 'owner';
    else if (spec.wrapped && nextResolver && !wrapperAware(nextResolver) && (writeAddr || textWrites.length)) note = 'resolver';

    const recordCalls = [];
    if (recordsOk) {
      if (writeAddr) recordCalls.push(setAddrData(found.node, desiredAddr));
      textWrites.forEach(function (w) { recordCalls.push(setTextData(found.node, w.key, w.value)); });
    }
    const wroteRecords = recordCalls.length > 0;
    const full = label + '.' + parent;
    const txs = [];
    if (needSubnode) {
      const data = spec.wrapped
        ? setSubnodeWrapped(found.parentNode || spec.parentNode, label, nextOwner, nextResolver)
        : setSubnodeUnwrapped(found.parentNode || spec.parentNode, found.labelhash, nextOwner, nextResolver);
      txs.push({
        to: spec.wrapped ? WRAPPER : REGISTRY,
        data: data,
        value: '0x0',
        label: full + (exists ? ' owner and resolver' : ' create'),
        depends: false,
      });
    }
    if (wroteRecords) {
      if (nextResolverMulticall) {
        txs.push({
          to: nextResolver,
          data: multicallData(recordCalls),
          value: '0x0',
          label: full + ' resolver records',
          depends: needSubnode,
          calls: recordCalls,
        });
      } else {
        recordCalls.forEach(function (data) {
          const sel = data.slice(0, 10);
          const what = sel === '0xd5fa2b00' ? 'addr' : 'text';
          txs.push({
            to: nextResolver,
            data: data,
            value: '0x0',
            label: full + ' ' + what,
            depends: needSubnode,
          });
        });
      }
    }

    return {
      label: label,
      name: full,
      exists: exists,
      note: note,
      owner: field(ownerKind, chainOwner, nextOwner),
      resolver: field(resolverKind, chainResolver, nextResolver),
      addr: Object.assign(field(addrKind, normAddr(chain.addr), desiredAddr), {}),
      texts: texts,
      wroteOwner: needSubnode && writeOwner,
      wroteResolver: needSubnode && writeResolver,
      wroteAddr: wroteRecords && writeAddr,
      nextOwner: needSubnode ? nextOwner : chainOwner,
      nextResolver: nextResolver,
      nextResolverMulticall: nextResolverMulticall,
      nextAddr: wroteRecords && writeAddr ? desiredAddr : normAddr(chain.addr),
      textWrites: wroteRecords ? textWrites : [],
      txs: txs,
    };
  }

  function diff(spec) {
    const names = (spec.names || []).map(function (name) { return diffName(spec, name); });
    const txs = [];
    names.forEach(function (name) { name.txs.forEach(function (tx) { txs.push(tx); }); });
    return {
      names: names,
      txs: txs,
      blocked: spec.controlsParent ? '' : 'parent',
    };
  }

  function apply(spec, plan) {
    const by = new Map();
    (plan.names || []).forEach(function (name) { by.set(name.label, name); });
    return {
      parent: spec.parent,
      wrapped: spec.wrapped,
      parentNode: spec.parentNode,
      wallet: spec.wallet,
      controlsParent: spec.controlsParent,
      parentResolver: spec.parentResolver,
      parentResolverMulticall: spec.parentResolverMulticall,
      useNewResolver: spec.useNewResolver,
      names: (spec.names || []).map(function (name) {
        const row = by.get(String(name.label || '').trim().toLowerCase());
        const chain = {
          exists: !!(name.chain && name.chain.exists),
          owner: name.chain ? name.chain.owner : '',
          resolver: name.chain ? name.chain.resolver : '',
          addr: name.chain ? name.chain.addr : '',
          text: Object.assign({}, name.chain && name.chain.text),
          resolverMulticall: !!(name.chain && name.chain.resolverMulticall),
          approved: !!(name.chain && name.chain.approved),
        };
        if (row) {
          if (row.wroteOwner) {
            chain.exists = true;
            chain.owner = row.nextOwner;
          }
          if (row.wroteResolver) {
            chain.exists = true;
            chain.resolver = row.nextResolver;
            chain.resolverMulticall = row.nextResolverMulticall;
          }
          if (row.wroteAddr) chain.addr = row.nextAddr;
          (row.textWrites || []).forEach(function (w) {
            if (!w.value) delete chain.text[w.key];
            else chain.text[w.key] = w.value;
          });
        }
        return {
          label: name.label,
          node: name.node,
          labelhash: name.labelhash,
          addr: name.addr,
          text: Object.assign({}, name.text),
          takeOwner: !!name.takeOwner,
          drop: (name.drop || []).slice(),
          chain: chain,
        };
      }),
    };
  }

  return {
    REGISTRY: REGISTRY,
    WRAPPER: WRAPPER,
    NEW_RESOLVER: NEW_RESOLVER,
    ZERO: ZERO,
    normAddr: normAddr,
    parsePreset: parsePreset,
    diff: diff,
    apply: apply,
    multicallData: multicallData,
    decodeMulticall: decodeMulticall,
    emptyMulticall: emptyMulticall,
    ownerData: ownerData,
    resolverData: resolverData,
    addrData: addrData,
    textData: textData,
    approvedData: approvedData,
    ownerOfData: ownerOfData,
    setTextData: setTextData,
    setAddrData: setAddrData,
  };
});
