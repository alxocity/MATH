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

  // No wallet_getCallsStatus, or the wallet is gone. Same non-retryable state as a timeout.
  function settleUnread(steps) {
    return (steps || []).map(function (s) {
      if (!s || s.status !== 'submitted') return s;
      if (s.hash && /^0x[0-9a-fA-F]{64}$/.test(s.hash)) return s;
      if (!s.calls) return s;
      return Object.assign({}, s, { status: UNKNOWN, error: '' });
    });
  }

  // A definite on-chain answer clears the stuck row. Anything else stays unknown.
  function clearAnswer(status, done) {
    if (status !== UNKNOWN) return status;
    if (done === true) return 'confirmed';
    if (done === false) return 'pending';
    return status;
  }

  function rgbWord(words) {
    if (!words || words.length < 3 || words[0] === 0n || words[1] === 0n || words[2] === 0n) {
      throw new Error('RGB get');
    }
    return { r: words[0], g: words[1], b: words[2] };
  }

  function rgbPlane(rows, r, g, b) {
    const R = BigInt(r);
    const G = BigInt(g);
    const B = BigInt(b);
    let rHit = false;
    let gHit = false;
    let bHit = false;
    (rows || []).forEach(function (row) {
      if (!row) return;
      if (BigInt(row.r) === R) rHit = true;
      if (BigInt(row.g) === G) gHit = true;
      if (BigInt(row.b) === B) bHit = true;
    });
    if (rHit) return 'R already used';
    if (gHit) return 'G already used';
    if (bHit) return 'B already used';
    return '';
  }

  function batchNeed(calls, gasPrice) {
    const price = BigInt(gasPrice || 0);
    let need = 0n;
    (calls || []).forEach(function (c) {
      need += BigInt((c && c.value) || 0) + price * BigInt((c && c.gas) || 0);
    });
    return need;
  }

  function shortBalance(balance, need) {
    return BigInt(balance) < BigInt(need);
  }

  // A revert is an answer. Any other simulate error, including a last hop that is not -32601, falls back.
  function simFallback(e) {
    if (!e) return true;
    if (e.code === 3) return false;
    return !/execution reverted/i.test(String(e.message || ''));
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

  const PLAN_FIRST = 'plan routes first';

  // Why a bulk send stays disabled. Empty means the wallet can batch this plan.
  // `phase` is none, checking, ready, unsupported, or timeout. ENS uses the noun "change".
  function bulkWhy(count, phase, noun) {
    const n = Number(count);
    const c = n !== n ? 0 : Math.max(0, Math.floor(n));
    const one = noun === 'change' ? "there's only one change" : 'only one transaction';
    if (c < 1) return 'nothing to send';
    if (c < 2) return one;
    if (phase === 'ready') return '';
    if (phase === 'checking') return 'checking whether this wallet can batch';
    if (phase === 'timeout') return "couldn't check batch support";
    if (phase === 'unsupported') return "the wallet doesn't support batched sends";
    return 'connect a wallet to batch';
  }

  // Fill a blank bulk reason. Omitted flags are left alone, so a route call
  // does not pick up the ENS "simulate first" line. `busy` is ENS work in
  // progress. `sending` is a route or RGB send that has not marked a row yet.
  function batchHold(why, flags) {
    if (why) return why;
    const f = flags || {};
    if (f.busy) return 'working…';
    if (f.unknown) return 'check your wallet';
    if (f.flying) return 'a transaction is still in flight';
    if (f.sending) return 'a send is already running';
    if (f.blocked) return f.blockWhy || "holder can't receive payout";
    if (f.controls === undefined && f.wallet) return 'read the parent first';
    if (f.controls != null && !f.controls) return 'this wallet does not control the parent';
    if (f.signed != null && !f.signed) return 'simulate first';
    return '';
  }

  // No plan loaded. Tell the batch control instead of sending an empty list.
  function emptyPlan(runs, show) {
    if (runs && runs.length) return false;
    if (show) show(PLAN_FIRST);
    return true;
  }

  // First sendable batch. Restored rows have no tx, so they cannot be sent.
  function openBatch(steps) {
    const list = steps || [];
    const seeded = list.filter(function (s) {
      return s && (s.status === 'confirmed' || s.status === 'submitted' || isUnknown(s.status)) && s.result != null;
    }).map(function (s) { return String(s.result); });
    const open = list.filter(function (s) {
      return s && typeof s.tx === 'function' &&
        s.status !== 'confirmed' && s.status !== 'submitted' && !isUnknown(s.status);
    });
    return (splitCalls(open, seeded)[0]) || [];
  }

  // Wallet and run flags that syncNote turns into a batch reason.
  function noteWhy(steps, src) {
    const s = src || {};
    let phase = 'none';
    if (s.hasWallet && s.account) {
      if (!s.batchKnown) phase = 'checking';
      else if (s.batchTimed) phase = 'timeout';
      else if (atomicReady(s.batchCaps)) phase = 'ready';
      else phase = 'unsupported';
    }
    return batchWhy(steps, {
      phase: phase,
      busy: !!(s.runBusy || s.txLock),
    });
  }

  // A finished run drops its busy flags, then refreshes the note. A tx-hash
  // lock is left in place. A stale generation does nothing.
  function releaseRun(gen, box, note) {
    if (!box || gen !== box.runGen) return false;
    box.runBusy = false;
    if (box.txLock === 'run') box.txLock = null;
    if (typeof note === 'function') note();
    return true;
  }

  // A single-send watch may end after a batch has taken the lock. Only the
  // matching hash is cleared, so a live run stays busy.
  function clearHashLock(box, hash) {
    if (!box || !hash || box.txLock !== hash) return false;
    box.txLock = null;
    return true;
  }

  // Route and RGB: why the batch button is disabled. Empty means it can be pressed.
  function batchWhy(steps, flags) {
    const f = flags || {};
    const list = steps || [];
    const waiting = list.filter(function (s) {
      return s && s.status !== 'confirmed' && s.status !== 'submitted' && !isUnknown(s.status);
    });
    const first = openBatch(list);
    const unknown = list.some(function (s) { return s && isUnknown(s.status); });
    const flying = list.some(function (s) {
      return s && (s.status === 'submitted' || s.status === 'signing');
    });
    const blocked = !!(first[0] && first[0].blocked);
    const why = (waiting.length && !first.length) ? PLAN_FIRST : bulkWhy(first.length, f.phase, f.noun);
    return batchHold(why, {
      unknown: unknown,
      flying: flying,
      sending: !!f.busy,
      blocked: blocked,
      blockWhy: blocked ? first[0].blockWhy : '',
      controls: f.controls,
      signed: f.signed,
      wallet: f.wallet,
    });
  }

  function stepId(label) {
    const slug = String(label || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return 'step-' + (slug || 'x');
  }

  function stepClass(status) {
    if (status === 'confirmed') return 'done';
    if (status === 'failed') return 'failed';
    if (status === 'submitted' || status === 'signing') return 'now';
    return '';
  }

  function progressSummary(rows) {
    const count = runCount(rows);
    let text = count.done + ' of ' + count.n + ' done';
    if (count.failed) text += ', ' + count.failed + ' failed';
    const list = rows || [];
    let focus = -1;
    for (let i = 0; i < list.length; i++) {
      if (list[i] && list[i].status === 'failed') { focus = i; break; }
    }
    if (focus < 0) {
      for (let i = 0; i < list.length; i++) {
        const st = list[i] && list[i].status;
        if (st && st !== 'confirmed') { focus = i; break; }
      }
    }
    return { text: text, focus: focus, done: count.done, failed: count.failed, n: count.n };
  }

  function runCount(rows) {
    let done = 0;
    let failed = 0;
    let pending = 0;
    (rows || []).forEach(function (s) {
      if (!s) return;
      if (s.status === 'confirmed') done += 1;
      else if (s.status === 'failed') failed += 1;
      else pending += 1;
    });
    const n = done + failed + pending;
    const text = n + (n === 1 ? ' step' : ' steps') + '. ' + done + ' done, ' + pending + ' pending, ' + failed + ' failed';
    return { n: n, done: done, pending: pending, failed: failed, text: text };
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
    PLAN_FIRST: PLAN_FIRST,
    bulkWhy: bulkWhy,
    batchHold: batchHold,
    emptyPlan: emptyPlan,
    openBatch: openBatch,
    noteWhy: noteWhy,
    releaseRun: releaseRun,
    clearHashLock: clearHashLock,
    batchWhy: batchWhy,
    runCount: runCount,
    stepId: stepId,
    stepClass: stepClass,
    progressSummary: progressSummary,
    callsId: callsId,
    receiptOk: receiptOk,
    callsOutcome: callsOutcome,
    rejected: rejected,
    unsupported: unsupported,
    UNKNOWN: UNKNOWN,
    isUnknown: isUnknown,
    settleUnheard: settleUnheard,
    settleUnread: settleUnread,
    shouldResume: shouldResume,
    clearAnswer: clearAnswer,
    rgbMatch: rgbMatch,
    rgbWord: rgbWord,
    rgbPlane: rgbPlane,
    batchNeed: batchNeed,
    shortBalance: shortBalance,
    simFallback: simFallback,
  };
  globalThis.RUN = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})();
