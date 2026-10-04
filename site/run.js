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

  // A hashless batch whose status reads all timed out. Not a failure: retry would
  // send RGB.add again at 0.03 ETH for a batch that may already have landed.
  const UNKNOWN = 'status unknown — check your wallet';

  function isUnknown(status) {
    return status === UNKNOWN;
  }

  // Skip a lone eth_call only when a used id is still going to be minted by an
  // unsent step in this batch. A mined, submitted, or unheard step is not unsent.
  function deferSim(step, batch) {
    const produced = new Set();
    (batch || []).forEach(function (s) {
      if (!s || s === step || s.result == null) return;
      if (s.status === 'confirmed' || s.status === 'submitted' || s.status === UNKNOWN) return;
      produced.add(String(s.result));
    });
    return (step.uses || []).some(function (id) { return produced.has(String(id)); });
  }

  // After the status watch gives up, hashless calls stay unknown. A heard watch,
  // a real tx hash, or a step with no calls id is left as it is.
  function settleUnheard(steps, heard) {
    if (heard) return steps;
    return (steps || []).map(function (s) {
      if (!s || s.status !== 'submitted') return s;
      if (s.hash && /^0x[0-9a-fA-F]{64}$/.test(s.hash)) return s;
      if (!s.calls) return s;
      return Object.assign({}, s, { status: UNKNOWN, error: '' });
    });
  }

  function shouldResume(step) {
    if (!step) return false;
    if (step.status !== 'submitted' && step.status !== UNKNOWN) return false;
    if (step.hash && /^0x[0-9a-fA-F]{64}$/.test(step.hash)) return true;
    return !!step.calls;
  }

  function rgbMatch(rows, r, g, b) {
    const R = BigInt(r);
    const G = BigInt(g);
    const B = BigInt(b);
    return (rows || []).some(function (row) {
      return row && BigInt(row.r) === R && BigInt(row.g) === G && BigInt(row.b) === B;
    });
  }

  function batchSimNote(n) {
    return 'steps 2–' + n + " can't be simulated until step 1 is minted";
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
    deferSim: deferSim,
    batchSimNote: batchSimNote,
    callsId: callsId,
    receiptOk: receiptOk,
    callsOutcome: callsOutcome,
    rejected: rejected,
    unsupported: unsupported,
    UNKNOWN: UNKNOWN,
    isUnknown: isUnknown,
    settleUnheard: settleUnheard,
    shouldResume: shouldResume,
    rgbMatch: rgbMatch,
  };
  globalThis.RUN = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})();
