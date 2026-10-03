(function () {
  const S = globalThis.SITE;
  const state = S.state;
  const $ = S.$;
  const ETH = globalThis.ETH;
  const P = globalThis.PLAN;
  const ABI = globalThis.ABI;
  const ADDR = ETH.ADDR;
  const RULES = globalThis.RULES;

  function mintWhy(pair) {
    if (!pair) return '';
    const oa = state.supply.get(pair.a);
    const ob = state.supply.get(pair.b);
    if ((oa && state.blocked.has(oa)) || (ob && state.blocked.has(ob))) return RULES.payout();
    if (pair.n > P.MAX) return 'overflow';
    if (state.supply.has(pair.n)) return 'already minted';
    return '';
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
    const why = mintWhy(pair);
    const lines = [];
    if (!oa) lines.push('a is not in the loaded index');
    if (!ob) lines.push('b is not in the loaded index');
    if (exists) lines.push('exists, owner ' + state.supply.get(pair.n));
    if (why === RULES.payout()) lines.push(why);
    const net = (oa && oa === S.me() ? 0n : P.ROY_WEI) + (ob && ob === S.me() ? 0n : P.ROY_WEI) + P.G_ADD * state.gasPrice;
    lines.push('pays ' + (oa ? S.short(oa) : '?') + ' and ' + (ob ? S.short(ob) : '?'));
    lines.push('msg.value 0.002, net about ' + S.fmt(net) + ' ETH after refunds and gas');
    if (meta) meta.innerHTML = lines.map(function (l) { return S.esc(l); }).join('<br>');
    const preview = mintPreview(pair.a, pair.b, pair.n, oa, ob);
    state.preview = preview;
    if ($('#preview')) $('#preview').textContent = preview;
    if (send) send.disabled = !!why;
    if (whyEl) whyEl.textContent = why;
    if (speak) S.hit(why);
    if (doSim && !overflow && !(why && RULES.mold(why))) runSim(pair, preview);
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
      S.noteSent(hash, function () {
        state.supply.set(pair.n, S.me());
      });
    });
  }

  function mint(view) {
    view.innerHTML =
      '<div class="row"><label>a <input id="a" value="1" spellcheck="false"></label>' +
      '<label>b <input id="b" value="1" spellcheck="false"></label></div>' +
      '<div class="eq" id="eq">1 + 1 = 2</div>' +
      '<div id="grid"></div>' +
      '<p id="mintMeta"></p>' +
      '<div class="preview" id="preview">simulate, then send. this page does not sign.</div>' +
      '<div class="row"><button type="button" id="sim">simulate</button><button type="button" id="send">send add</button>' +
      '<span id="sendWhy" class="bad"></span></div>';
    const draw = function () { paintMint(false, true); };
    $('#a').addEventListener('input', draw);
    $('#b').addEventListener('input', draw);
    $('#sim').onclick = function () { paintMint(true, true); };
    $('#send').onclick = function () {
      const pair = readPair();
      const why = mintWhy(pair);
      S.hit(why);
      if (why) return;
      sendMath();
    };
    paintMint(false);
  }

  S.mint = mint;
  S.paintMint = paintMint;
})();
