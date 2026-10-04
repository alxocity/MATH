(function () {
  // Split a route into batches. `uses` lists ids produced earlier in this run
  // that the calldata needs. A null result is an id we cannot know yet (RGB.add).
  function splitCalls(steps, seeded) {
    const batches = [];
    let batch = [];
    const known = new Set((seeded || []).map(function (id) { return String(id); }));
    (steps || []).forEach(function (s) {
      const wait = (s.uses || []).some(function (id) { return !known.has(String(id)); });
      if (wait && batch.length) {
        batches.push(batch);
        batch = [];
      }
      batch.push(s);
      if (s.result == null) {
        batches.push(batch);
        batch = [];
      } else known.add(String(s.result));
    });
    if (batch.length) batches.push(batch);
    return batches;
  }

  function atomicReady(caps) {
    if (!caps) return false;
    const row = caps['0x1'] || caps['0x01'] || caps['1'];
    const status = row && row.atomic && row.atomic.status;
    return status === 'ready' || status === 'supported';
  }

  function callsId(res) {
    if (!res) return '';
    if (typeof res === 'string') return res;
    return res.id || res.callsId || '';
  }

  function receiptOk(s) {
    const h = String(s == null ? '' : s).toLowerCase();
    return h === '0x1' || h === '0x01' || h === '1';
  }

  function callsOutcome(status) {
    let n = Number(status);
    if (typeof status === 'string' && status.indexOf('0x') === 0) {
      try { n = Number(BigInt(status)); } catch (e) { n = NaN; }
    }
    if (n === 100) return 'pending';
    if (n === 200) return 'confirmed';
    if (n >= 400) return 'failed';
    return 'pending';
  }

  function rejected(e) {
    if (!e) return false;
    if (e.code === 4001) return true;
    const msg = String(e.message || '').toLowerCase();
    return msg.indexOf('user rejected') !== -1 || msg.indexOf('user denied') !== -1;
  }

  function unsupported(e) {
    if (!e) return false;
    if (e.code === -32601 || e.code === 4200) return true;
    const msg = String(e.message || '').toLowerCase();
    return msg.indexOf('not support') !== -1 ||
      msg.indexOf('method not found') !== -1 ||
      msg.indexOf('does not exist') !== -1;
  }

  const api = {
    splitCalls: splitCalls,
    atomicReady: atomicReady,
    callsId: callsId,
    receiptOk: receiptOk,
    callsOutcome: callsOutcome,
    rejected: rejected,
    unsupported: unsupported,
  };
  globalThis.RUN = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})();
