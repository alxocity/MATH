(function () {
  const S = globalThis.SITE;
  const state = S.state;
  const $ = S.$;
  const ETH = globalThis.ETH;
  const P = globalThis.PLAN;
  const ABI = globalThis.ABI;
  const ADDR = ETH.ADDR;
  const RULES = globalThis.RULES;

  function mintNote(pair) {
    if (!pair) return '';
    const oa = state.supply.get(pair.a);
    const ob = state.supply.get(pair.b);
    const aNote = RULES.holderNote(oa, state.blocked, state.unknown);
    const bNote = RULES.holderNote(ob, state.blocked, state.unknown);
    const hold = RULES.preferNote(aNote, bNote);
    if (hold === RULES.payout()) return hold;
    if (pair.n > P.MAX) return 'overflow';
    if (state.supply.has(pair.n)) return 'already minted';
    return hold;
  }

  function mintClosed(note) {
    return note === RULES.payout() || note === 'overflow' || note === 'already minted';
  }

  function readPair() {
    let a, b;
    try { a = BigInt($('#a').value.trim()); b = BigInt($('#b').value.trim()); }
    catch (e) { return null; }
    if (a <= 0n || b <= 0n) return null;
    return { a: a, b: b, n: a + b };
  }

  function mintPreview(a, b, n, oa, ob) {
    const roy = [];
    if (oa) roy.push('0.001 ETH → ' + oa);
    if (ob) roy.push('0.001 ETH → ' + ob);
    return 'MATH.add(' + a + ', ' + b + ')\nto ' + ADDR.MATH + '\nvalue 0.002 ETH\nmint ' + n + '\n' +
      (roy.join('\n') || 'owners unknown') + '\nwallet signs this. the page cannot.';
  }

  function paintMint(doSim, speak) {
    const pair = readPair();
    const eq = $('#eq');
    const meta = $('#mintMeta');
    const grid = $('#grid');
    const send = $('#send');
    const whyEl = $('#sendWhy');
    if (!pair) {
      if (eq) eq.textContent = 'a + b = ?';
      if (send) send.disabled = false;
      if (whyEl) whyEl.textContent = '';
      if (speak) S.hit('');
      return;
    }
    const overflow = pair.n > P.MAX;
    if (eq) eq.textContent = pair.a + ' + ' + pair.b + ' = ' + (overflow ? 'overflow' : pair.n);
    if (grid) grid.innerHTML = overflow ? '' : S.bitHtml(pair.n);
    const oa = state.supply.get(pair.a);
    const ob = state.supply.get(pair.b);
    const exists = state.supply.has(pair.n);
    const note = mintNote(pair);
    const lines = [];
    if (!oa) lines.push('a is not in the loaded index');
    if (!ob) lines.push('b is not in the loaded index');
    const existsLine = exists ? 'exists, owner ' + S.addr(state.supply.get(pair.n)) + '<br>' : '';
    if (note === RULES.payout() || note === RULES.unchecked()) lines.push(note);
    const net = (oa && oa === S.me() ? 0n : P.ROY_WEI) + (ob && ob === S.me() ? 0n : P.ROY_WEI) + P.G_ADD * state.gasPrice;
    const pay = 'pays ' + (oa ? S.addr(oa) : '?') + ' and ' + (ob ? S.addr(ob) : '?');
    lines.push('msg.value 0.002, net about ' + S.fmt(net) + ' ETH after refunds and gas');
    if (meta) meta.innerHTML = lines.map(function (l) {
      let html = S.esc(l);
      if (l === RULES.payout()) html += S.mark('ⓘ', S.TIPS.blocked);
      if (l === RULES.unchecked()) html += S.mark('ⓘ', S.TIPS.unchecked);
      return html;
    }).join('<br>') + '<br>' + existsLine + pay + S.mark('ⓘ', S.TIPS.fees);
    if (oa) ENS.want(oa);
    if (ob) ENS.want(ob);
    if (exists) ENS.want(state.supply.get(pair.n));
    ENS.flush(function () { if (state.tab === 'mint' && $('#mintMeta')) paintMint(false); });
    const preview = mintPreview(pair.a, pair.b, pair.n, oa, ob);
    state.preview = preview;
    if ($('#preview')) $('#preview').textContent = preview;
    if (send) send.disabled = mintClosed(note);
    if (whyEl) whyEl.textContent = note;
    if (speak) S.hit(note);
    if (doSim && !overflow) runSim(pair, preview);
  }

  async function runSim(pair, preview) {
    const box = $('#preview');
    try {
      const tx = S.mathTx(pair.a, pair.b);
      if (!state.account) tx.from = '0x0000000000000000000000000000000000000001';
      const sim = await ETH.simulate(tx);
      const who = state.account ? '' : '\nstand-in sender 0x1. connect before send.';
      if (sim.error) {
        box.textContent = preview + who + '\nsimulation reverted: ' + ETH.reason(sim.error);
        MOLD.say('simFail', { err: ETH.reason(sim.error) });
        return;
      }
      box.textContent = preview + who + '\nsimulation ok.';
      if (state.supply.has(pair.n)) MOLD.say('exists', { n: pair.n, owner: S.short(state.supply.get(pair.n)) });
      else MOLD.say('simOk');
    } catch (e) {
      box.textContent = preview + '\n' + e.message;
    }
  }

  async function sendMath() {
    const pair = readPair();
    if (!pair || pair.n > P.MAX) return;
    const preview = mintPreview(pair.a, pair.b, pair.n, state.supply.get(pair.a), state.supply.get(pair.b));
    state.preview = preview;
    if ($('#preview')) $('#preview').textContent = preview + '\nre-checking, then the wallet.';
    await S.guardSend(async function () {
      const oa = await ETH.ownerOf(ADDR.MATH, pair.a);
      const ob = await ETH.ownerOf(ADDR.MATH, pair.b);
      const exists = await ETH.ownerOf(ADDR.MATH, pair.n);
      if (!oa || !ob) throw new Error('an input is not minted');
      if (exists) throw new Error('already minted by ' + exists);
      const tx = S.mathTx(pair.a, pair.b);
      const sim = await ETH.simulate(tx);
      if (sim.error) throw new Error(ETH.reason(sim.error));
      if ($('#preview')) $('#preview').textContent = preview + '\nsimulation ok. confirm in the wallet.';
      const hash = await ETH.send(tx);
      state.pendingSums.set(hash, pair.n);
      S.noteSent(hash, function () {
        state.supply.set(pair.n, S.me());
      });
    });
  }

  function ownedMath() {
    const who = S.me();
    const ids = [];
    const seen = new Set();
    function add(id) {
      let x;
      try { x = BigInt(id); } catch (e) { return; }
      const k = x.toString();
      if (seen.has(k)) return;
      seen.add(k);
      ids.push(x);
    }
    state.math.forEach(function (t) {
      if (t.owner && t.owner.toLowerCase() === who) add(t.id);
    });
    state.heldMath.forEach(add);
    return ids;
  }

  function mathCtx() {
    return {
      supply: state.supply,
      user: S.me(),
      blocked: state.blocked,
      gasWei: P.G_ADD * state.gasPrice,
      owned: ownedMath(),
      example: !state.account,
      skip: S.openMints(),
    };
  }

  let mathHint = null;

  function paintHint(example, note) {
    const el = $('#hintNote');
    if (!el) return;
    el.textContent = note || (example ? 'example' : '');
  }

  function fillMint(advance) {
    const aEl = $('#a');
    const bEl = $('#b');
    if (!aEl || !bEl) return;
    const example = !state.account;
    const dropped = !!(mathHint && mathHint.example !== example);
    const aFree = SUGGEST.hintFree(aEl.value, mathHint && { value: mathHint.a, example: mathHint.example }, !!(mathHint && mathHint.ownA), example);
    const bFree = SUGGEST.hintFree(bEl.value, mathHint && { value: mathHint.b, example: mathHint.example }, !!(mathHint && mathHint.ownB), example);
    if (dropped) mathHint = null;
    const ctx = mathCtx();
    if (!aFree && !bFree) {
      paintHint(false, '');
      paintMint(false);
      return;
    }
    if (!advance && mathHint && mathHint.ownA && mathHint.ownB && SUGGEST.mathOk(ctx, mathHint.a, mathHint.b)) {
      if (aFree) aEl.value = String(mathHint.a);
      if (bFree) bEl.value = String(mathHint.b);
      paintHint(example, '');
      paintMint(false);
      return;
    }
    let cursor = null;
    if (advance && mathHint &&
      (aFree || aEl.value === String(mathHint.a)) &&
      (bFree || bEl.value === String(mathHint.b))) {
      try { cursor = { a: BigInt(mathHint.a), b: BigInt(mathHint.b) }; } catch (e) { cursor = null; }
    }
    const next = SUGGEST.mathPair(ctx, {
      cursor: cursor,
      lockA: aFree ? null : aEl.value,
      lockB: bFree ? null : bEl.value,
    });
    if (!next) {
      const stale = mathHint && !SUGGEST.mathOk(ctx, mathHint.a, mathHint.b);
      if (stale || dropped) {
        if (aFree) aEl.value = '';
        if (bFree) bEl.value = '';
        mathHint = null;
      }
      paintHint(false, advance && mathHint ? 'nothing else' : 'nothing to suggest');
      paintMint(false);
      return;
    }
    if (aFree) aEl.value = next.a.toString();
    if (bFree) bEl.value = next.b.toString();
    mathHint = {
      a: aEl.value,
      b: bEl.value,
      ownA: aFree,
      ownB: bFree,
      example: example,
    };
    paintHint(example && aFree && bFree, '');
    paintMint(false);
  }

  function mint(view) {
    view.innerHTML =
      '<div class="row"><label class="num">a <input id="a" spellcheck="false" inputmode="numeric"></label>' +
      '<label class="num">b <input id="b" spellcheck="false" inputmode="numeric"></label></div>' +
      '<div class="row"><button type="button" id="suggest">suggest another</button>' +
      '<span id="hintNote" class="dim"></span></div>' +
      '<div class="eq" id="eq">a + b = ?</div>' +
      '<div id="grid"></div>' +
      '<p id="mintMeta"></p>' +
      '<div class="preview" id="preview">simulate, then send. this page does not sign.</div>' +
      '<div class="row"><button type="button" id="sim">simulate</button>' + S.mark('ⓘ', S.TIPS.simulate) + '<button type="button" id="send">send add</button>' +
      '<span id="sendWhy" class="bad"></span></div>';
    const draw = function () {
      paintMint(false, true);
      const el = $('#hintNote');
      if (!el || el.textContent !== 'example' || !mathHint) return;
      if ($('#a').value !== String(mathHint.a) || $('#b').value !== String(mathHint.b)) el.textContent = '';
    };
    $('#a').addEventListener('input', draw);
    $('#b').addEventListener('input', draw);
    $('#suggest').onclick = function () { fillMint(true); };
    $('#sim').onclick = function () { paintMint(true, true); };
    $('#send').onclick = function () {
      const pair = readPair();
      const note = mintNote(pair);
      S.hit(note);
      if (mintClosed(note)) return;
      sendMath();
    };
    fillMint(false);
  }

  S.mint = mint;
  S.paintMint = paintMint;
  S.fillMint = fillMint;
})();
