(function () {
  const S = globalThis.SITE;
  const state = S.state;
  const $ = S.$;
  const P = globalThis.PLAN;
  const ETH = globalThis.ETH;
  const RULES = globalThis.RULES;

  function stepNote(s) {
    return RULES.preferNote(
      RULES.holderNote(s.payTo[0], state.blocked, state.unknown),
      RULES.holderNote(s.payTo[1], state.blocked, state.unknown)
    );
  }

  function routeRuns() {
    const built = state.routeBuilt;
    if (!built) return [];
    const produced = [];
    return built.steps.filter(function (s) { return !s.exists; }).map(function (s) {
      const uses = [s.a, s.b].filter(function (id) {
        return produced.some(function (p) { return p === id; });
      });
      produced.push(s.result);
      const note = stepNote(s);
      return {
        label: s.a + ' + ' + s.b + ' = ' + s.result,
        result: s.result,
        uses: uses,
        blocked: note === RULES.payout(),
        blockWhy: note,
        tx: function () { return S.mathTx(s.a, s.b); },
        done: async function () { return !!(await ETH.ownerOf(ETH.ADDR.MATH, s.result)); },
        ready: async function (batch) {
          const producedNow = {};
          (batch || []).forEach(function (row) {
            if (row.result != null) producedNow[String(row.result)] = true;
          });
          async function need(id) {
            if (producedNow[String(id)]) return true;
            return !!(await ETH.ownerOf(ETH.ADDR.MATH, id));
          }
          if (!(await need(s.a)) || !(await need(s.b))) return 'an input is not minted yet';
          return '';
        },
        onOk: function () { state.supply.set(s.result, S.me()); },
      };
    });
  }

  function sendRoute(only) {
    const runs = routeRuns();
    state.runSend = function () { sendRoute(); };
    S.runSteps(runs, only ? { only: only } : null);
  }

  function paintRoute() {
    const host = $('#pieces');
    const steps = $('#steps');
    const meta = $('#routeMeta');
    if (!host) return;
    const built = state.routeBuilt;
    host.innerHTML = state.routePieces.map(function (p, i) {
      const pin = state.routePinned.some(function (x) { return x === p; });
      return '<div class="piece"><input type="text" data-i="' + i + '" value="' + p + '" spellcheck="false">' +
        globalThis.TOKEN.idLink('math', p) +
        '<label><input type="checkbox" class="pin" data-i="' + i + '"' + (pin ? ' checked' : '') + '> pin</label>' +
        '<button type="button" data-up="' + i + '">up</button>' +
        '<button type="button" data-dn="' + i + '">down</button>' +
        '<button type="button" data-rm="' + i + '">drop</button></div>';
    }).join('');
    host.querySelectorAll('input[type="text"]').forEach(function (input) {
      input.addEventListener('change', function () {
        try { state.routePieces[Number(input.dataset.i)] = BigInt(input.value.trim()); }
        catch (e) { return; }
        reflow();
      });
    });
    host.querySelectorAll('.pin').forEach(function (box) {
      box.addEventListener('change', function () {
        const p = state.routePieces[Number(box.dataset.i)];
        state.routePinned = state.routePinned.filter(function (x) { return x !== p; });
        if (box.checked) state.routePinned.push(p);
      });
    });
    host.querySelectorAll('[data-up]').forEach(function (b) {
      b.onclick = function () { movePiece(Number(b.dataset.up), -1); };
    });
    host.querySelectorAll('[data-dn]').forEach(function (b) {
      b.onclick = function () { movePiece(Number(b.dataset.dn), 1); };
    });
    host.querySelectorAll('[data-rm]').forEach(function (b) {
      b.onclick = function () {
        state.routePieces.splice(Number(b.dataset.rm), 1);
        reflow();
      };
    });
    if (!built) {
      if (meta) {
        if (state.blockedDone) meta.innerHTML = state.blocked.size + ' blocked' + S.mark('ⓘ', S.TIPS.blocked);
        else if (state.holdersReady) meta.innerHTML = 'holder unchecked' + S.mark('ⓘ', S.TIPS.unchecked);
        else meta.textContent = 'holder scan still running';
      }
      if (steps) steps.innerHTML = '';
      const sendAll = $('#sendRoute');
      if (sendAll) sendAll.disabled = true;
      S.paintSavedRun();
      return;
    }
    const warn = built.target.toString() === state.routeTarget ? '' : ' sums to ' + built.target + ', not the target.';
    if (meta) meta.innerHTML = built.mints + ' mints' + S.mark('ⓘ', S.TIPS.mints) + S.esc(', royalty ' + S.fmt(built.royalty) + ' ETH, gas ~' + S.fmt(built.gas) +
      ', msg.value ' + S.fmt(built.msgValue) + ', net ~' + S.fmt(built.net) + warn) +
      '<br>inputs you own are free, so every token you hold makes the next build cheaper.';
    if (steps) {
      steps.innerHTML = built.steps.map(function (s, i) {
        const note = stepNote(s);
        const sendOff = note === RULES.payout() ? ' disabled' : '';
        const buttons = s.exists ? '' :
          '<button type="button" data-sim="' + i + '">simulate</button>' + S.mark('ⓘ', S.TIPS.simulate) +
          '<button type="button" data-send="' + i + '"' + sendOff + '>send</button>';
        const noteMark = note === RULES.payout() ? S.mark('ⓘ', S.TIPS.blocked) : note === RULES.unchecked() ? S.mark('ⓘ', S.TIPS.unchecked) : '';
        return '<div class="step">' + globalThis.TOKEN.sumHtml(s.a, s.b, s.result) +
          (s.exists ? ' <span class="dim">exists</span>' : '') +
          (note ? ' <span class="' + (note === RULES.unchecked() ? 'dim' : 'bad') + '">' + S.esc(note) + '</span>' + noteMark : '') +
          '<div class="dim">pay ' + S.addr(s.payTo[0]) + ' ' + S.addr(s.payTo[1]) + ' royalty ' + S.fmt(s.royalty) + '</div>' +
          buttons +
          '</div>';
      }).join('') || '<p class="dim">already minted.</p>';
      steps.querySelectorAll('[data-sim]').forEach(function (b) {
        b.onclick = function () { S.sendStep(built.steps[Number(b.dataset.sim)], false); };
      });
      steps.querySelectorAll('[data-send]').forEach(function (b) {
        b.onclick = function () {
          const s = built.steps[Number(b.dataset.send)];
          sendRoute(s.a + ' + ' + s.b + ' = ' + s.result);
        };
      });
    }
    const runs = routeRuns();
    state.runSend = function () { sendRoute(); };
    S.hydrateRun(runs);
    const sendAll = $('#sendRoute');
    if (sendAll) {
      const open = (state.run || []).filter(function (s) {
        return s.tx && s.status !== 'confirmed' && s.status !== 'submitted' && !globalThis.RUN.isUnknown(s.status);
      });
      const flying = (state.run || []).some(function (s) {
        return s.status === 'submitted' || globalThis.RUN.isUnknown(s.status);
      });
      sendAll.disabled = flying || !open.length || !!(open[0] && open[0].blocked);
      sendAll.onclick = function () { sendRoute(); };
    }
    const box = $('#preview');
    if (box && state.preview) box.textContent = state.preview;
    if (built) {
      built.steps.forEach(function (s) { ENS.want(s.payTo[0]); ENS.want(s.payTo[1]); });
      ENS.flush(function () { if (state.tab === 'route' && $('#steps')) paintRoute(); });
    }
  }

  function movePiece(i, d) {
    const j = i + d;
    if (j < 0 || j >= state.routePieces.length) return;
    const t = state.routePieces[i];
    state.routePieces[i] = state.routePieces[j];
    state.routePieces[j] = t;
    reflow();
  }

  function reflow() {
    try {
      state.routeBuilt = state.routePieces.length ? P.fold(state.routePieces, S.ctx()) : null;
      if (state.routeBuilt) state.preview = '';
    } catch (e) {
      state.routeBuilt = null;
      state.preview = e.message;
    }
    if (state.tab === 'route') paintRoute();
  }

  function planRoute() {
    state.routeTarget = $('#target').value.trim();
    let n;
    try { n = BigInt(state.routeTarget); } catch (e) { return; }
    try {
      const built = state.routePinned.length ? P.planWithPins(n, state.routePinned, S.ctx()) : P.plan(n, S.ctx());
      state.routePieces = built.pieces.slice();
      state.routeBuilt = built;
      state.preview = '';
      MOLD.say('route', { mints: built.mints, net: S.fmt(built.net) });
      if (built.steps.some(function (s) { return stepNote(s) === RULES.payout(); })) S.hit(RULES.payout());
    } catch (e) {
      state.routeBuilt = null;
      state.routePieces = [];
      state.preview = e.message;
    }
    paintRoute();
  }

  function route(view) {
    view.innerHTML =
      '<div class="row"><label>n <input id="target" spellcheck="false" value="' + S.esc(state.routeTarget) + '"></label>' +
      '<button type="button" id="mode" class="on">' + state.routeMode + '</button>' +
      '<button type="button" id="plan">plan</button></div>' +
      '<p class="dim" id="routeMeta"></p><div id="pieces"></div><div id="steps"></div>' +
      '<p class="dim" id="batchNote" hidden>A batch may ask MetaMask for a one-time smart account upgrade (EIP-7702). That delegates this address for the calls. You approve it in the wallet. This page does not sign by itself.</p>' +
      '<div id="run"></div>' +
      '<div class="row"><button type="button" id="sendRoute">send</button></div>' +
      '<div class="preview" id="preview">' + S.esc(state.preview || 'send signs the next batch. this page does not sign by itself.') + '</div>';
    $('#mode').onclick = function () {
      state.routeMode = state.routeMode === 'fewest' ? 'cheapest' : 'fewest';
      $('#mode').textContent = state.routeMode;
    };
    state.runSend = function () { sendRoute(); };
    $('#plan').onclick = planRoute;
    $('#target').addEventListener('change', function () { state.routeTarget = $('#target').value.trim(); });
    paintRoute();
  }

  S.route = route;
})();
