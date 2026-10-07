(function () {
  const S = globalThis.SITE;
  const state = S.state;
  const $ = S.$;
  const ETH = globalThis.ETH;
  const P = globalThis.PLAN;
  const ABI = globalThis.ABI;
  const ADDR = ETH.ADDR;
  const RULES = globalThis.RULES;

  function syncPlanes() {
    try { state.planes = P.gridToPlanes(state.grid); } catch (e) { state.planes = null; }
  }

  function planeIssues(p) {
    if (!p) return ['grid'];
    const zero = [];
    if (p.R === 0n) zero.push('R is 0');
    if (p.G === 0n) zero.push('G is 0');
    if (p.B === 0n) zero.push('B is 0');
    if (zero.length) return zero;
    const image = RULES.rgbImage(p.R, p.G, p.B, state.rgbBy.r, state.rgbBy.g, state.rgbBy.b);
    if (image) return [image];
    const out = [];
    [['r', p.R, state.rgbBy.r], ['g', p.G, state.rgbBy.g], ['b', p.B, state.rgbBy.b]].forEach(function (row) {
      const reason = RULES.rgbChannel(row[0], row[1], row[2]);
      if (reason) out.push(reason);
    });
    return out;
  }

  function issuesHtml(issues) {
    const used = issues.some(function (s) { return s.indexOf('already used') !== -1; });
    return S.esc(issues.join(', ')) + (used ? S.mark('ⓘ', S.TIPS.used) : '');
  }

  function payNote(step) {
    return RULES.preferNote(
      RULES.holderNote(step.payTo[0], state.blocked, state.unknown),
      RULES.holderNote(step.payTo[1], state.blocked, state.unknown)
    );
  }

  function rgbQueueWhy(item) {
    const image = RULES.rgbImage(item.r, item.g, item.b, state.rgbBy.r, state.rgbBy.g, state.rgbBy.b);
    if (image) return image;
    let why = '';
    [['r', item.r, state.rgbBy.r], ['g', item.g, state.rgbBy.g], ['b', item.b, state.rgbBy.b]].forEach(function (row) {
      if (!why) why = RULES.rgbChannel(row[0], row[1], row[2]);
    });
    return why;
  }

  function writePlaneInputs() {
    if (!state.planes || !$('#pR')) return;
    $('#pR').value = state.planes.R.toString();
    $('#pG').value = state.planes.G.toString();
    $('#pB').value = state.planes.B.toString();
  }

  function sampleImage(img) {
    const canvas = document.createElement('canvas');
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const data = g.getImageData(0, 0, w, h).data;
    const src = new Float32Array(256 * 3);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const x0 = Math.floor(x * w / 16);
        const x1 = Math.max(x0 + 1, Math.floor((x + 1) * w / 16));
        const y0 = Math.floor(y * h / 16);
        const y1 = Math.max(y0 + 1, Math.floor((y + 1) * h / 16));
        let r = 0, gc = 0, b = 0, n = 0;
        for (let yy = y0; yy < y1; yy++) {
          for (let xx = x0; xx < x1; xx++) {
            const i = (yy * w + xx) * 4;
            r += data[i];
            gc += data[i + 1];
            b += data[i + 2];
            n++;
          }
        }
        const o = (y * 16 + x) * 3;
        src[o] = r / n / 255;
        src[o + 1] = gc / n / 255;
        src[o + 2] = b / n / 255;
      }
    }
    return src;
  }

  function mathRun(step, produced) {
    const uses = [step.a, step.b].filter(function (id) {
      return produced.some(function (p) { return p === id; });
    });
    produced.push(step.result);
    const note = payNote(step);
    return {
      label: step.a + ' + ' + step.b + ' = ' + step.result,
      result: step.result,
      uses: uses,
      blocked: note === RULES.payout(),
      blockWhy: note,
      tx: function () { return S.mathTx(step.a, step.b); },
      done: async function () { return !!(await ETH.ownerOf(ADDR.MATH, step.result)); },
      ready: async function (batch) {
        const producedNow = {};
        (batch || []).forEach(function (row) {
          if (row.result != null) producedNow[String(row.result)] = true;
        });
        async function need(id) {
          if (producedNow[String(id)]) return true;
          return !!(await ETH.ownerOf(ADDR.MATH, id));
        }
        if (!(await need(step.a)) || !(await need(step.b))) return 'an input is not minted yet';
        return '';
      },
      onOk: function () { state.supply.set(step.result, S.me()); },
    };
  }

  function queueRuns() {
    const produced = [];
    return state.queue.map(function (item) {
      if (item.kind === 'math') return mathRun(item.step, produced);
      const uses = [item.r, item.g, item.b].filter(function (id) {
        return produced.some(function (p) { return p === id; });
      });
      return {
        label: 'RGB.add ' + item.r + ', ' + item.g + ', ' + item.b,
        result: null,
        r: item.r,
        g: item.g,
        b: item.b,
        uses: uses,
        tx: function () {
          return {
            from: state.account,
            to: ADDR.RGB,
            data: ABI.call(ABI.SEL.add3, [item.r, item.g, item.b]),
            value: S.hex(P.MSG_RGB),
          };
        },
        done: async function () { return ETH.rgbMinted(item.r, item.g, item.b); },
        ready: async function (batch) {
          const producedNow = {};
          (batch || []).forEach(function (row) {
            if (row.result != null) producedNow[String(row.result)] = true;
          });
          const ids = [item.r, item.g, item.b];
          for (let k = 0; k < ids.length; k++) {
            if (producedNow[String(ids[k])]) continue;
            if (!(await ETH.ownerOf(ADDR.MATH, ids[k]))) return 'a plane is not minted yet';
          }
          const used = await ETH.rgbUsed(item.r, item.g, item.b);
          if (used) return used;
          const why = rgbQueueWhy(item);
          if (why) return why;
          return '';
        },
      };
    });
  }

  function sendAllQueue() {
    state.runSend = function () { sendAllQueue(); };
    S.runSteps(queueRuns());
  }

  function paintQueue() {
    const host = $('#queue');
    if (!host) return;
    host.innerHTML = state.queue.map(function (tx, i) {
      if (tx.kind === 'math') {
        const step = tx.step;
        const note = payNote(step);
        const sendOff = note === RULES.payout() ? ' disabled' : '';
        const noteMark = note === RULES.payout() ? S.mark('ⓘ', S.TIPS.blocked) : note === RULES.unchecked() ? S.mark('ⓘ', S.TIPS.unchecked) : '';
        return '<div class="step">' + (i + 1) + '. ' + globalThis.TOKEN.sumHtml(step.a, step.b, step.result) +
          (note ? ' <span class="' + (note === RULES.unchecked() ? 'dim' : 'bad') + '">' + S.esc(note) + '</span>' + noteMark : '') +
          ' <button type="button" data-sim="' + i + '">simulate</button>' + S.mark('ⓘ', S.TIPS.simulate) +
          '<button type="button" data-send="' + i + '"' + sendOff + '>send</button></div>';
      }
      const why = rgbQueueWhy(tx);
      const used = why && why.indexOf('already used') !== -1 ? S.mark('ⓘ', S.TIPS.used) : '';
      return '<div class="step">' + (i + 1) + '. RGB.add ' + globalThis.TOKEN.planesHtml(tx.r, tx.g, tx.b) +
        ' value 0.03' + S.mark('ⓘ', S.TIPS.fees) +
        (why ? ' <span class="bad">' + S.esc(why) + '</span>' + used :
          ' <button type="button" data-sim="' + i + '">simulate</button>' + S.mark('ⓘ', S.TIPS.simulate) +
          '<button type="button" data-send="' + i + '">send</button>') +
        '</div>';
    }).join('');
    host.querySelectorAll('[data-sim]').forEach(function (b) {
      b.onclick = function () { sendQueue(Number(b.dataset.sim), false); };
    });
    host.querySelectorAll('[data-send]').forEach(function (b) {
      b.onclick = function () { sendQueue(Number(b.dataset.send), true); };
    });
    const btn = $('#sendQueueAll');
    if (state.queue.length) S.hydrateRun(queueRuns());
    else S.paintSavedRun();
    if (btn) {
      const open = (state.run || []).filter(function (s) {
        return s.tx && s.status !== 'confirmed' && s.status !== 'submitted' && !globalThis.RUN.isUnknown(s.status);
      });
      const flying = (state.run || []).some(function (s) {
        return s.status === 'submitted' || globalThis.RUN.isUnknown(s.status);
      });
      btn.disabled = !state.queue.length || flying || !open.length || !!(open[0] && open[0].blocked);
      btn.onclick = sendAllQueue;
    }
    const bulk = $('#sendBatch');
    if (bulk) bulk.onclick = sendAllQueue;
  }

  function rememberPlanes() {
    if (!state.planesTouched || !state.planes || !globalThis.QUERY) return;
    S.rememberQuery({
      R: state.planes.R.toString(),
      G: state.planes.G.toString(),
      B: state.planes.B.toString(),
    });
  }

  function planRgb() {
    syncPlanes();
    const issues = planeIssues(state.planes);
    const meta = $('#rgbMeta');
    if (issues.length) {
      if (meta) meta.innerHTML = issuesHtml(issues);
      state.queue = [];
      paintQueue();
      const rule = issues.find(function (s) { return RULES.mold(s); });
      if (rule) S.hit(rule);
      else MOLD.say('rgbBad', { why: issues[0] });
      return;
    }
    const p = state.planes;
    try {
      const built = P.planRgb([p.R, p.G, p.B], S.ctx());
      const queue = built.steps.map(function (step) { return { kind: 'math', step: step }; });
      queue.push({ kind: 'rgb', r: p.R, g: p.G, b: p.B });
      state.queue = queue;
      if (meta) {
        const line = queue.length + ' txs. net ~' + S.fmt(built.net) + ' ETH. the wallet still shows 0.002 or 0.03 on each send. inputs you own are free, so collecting can make future builds cheaper.';
        if (built.note) meta.innerHTML = S.esc(line) + ' <span class="dim">' + S.esc(built.note) + '</span>';
        else meta.textContent = line;
      }
    } catch (e) {
      state.queue = [];
      if (meta) meta.textContent = e.message;
    }
    paintQueue();
    let qWhy = '';
    state.queue.forEach(function (item) {
      if (qWhy) return;
      if (item.kind === 'math' && payNote(item.step) === RULES.payout()) qWhy = RULES.payout();
      else if (item.kind === 'rgb') qWhy = rgbQueueWhy(item);
    });
    if (qWhy) S.hit(qWhy);
  }

  async function sendQueue(i, really) {
    const item = state.queue[i];
    if (!item) return;
    if (!really) {
      if (item.kind === 'math') {
        await S.sendStep(item.step, false);
        return;
      }
      const preview = 'RGB.add(' + item.r + ', ' + item.g + ', ' + item.b + ')\nto ' + ADDR.RGB + '\nvalue 0.03 ETH';
      state.preview = preview;
      try {
        const tx = {
          from: state.account || '0x0000000000000000000000000000000000000001',
          to: ADDR.RGB,
          data: ABI.call(ABI.SEL.add3, [item.r, item.g, item.b]),
          value: S.hex(P.MSG_RGB),
        };
        const sim = await ETH.simulate(tx);
        if (sim.error) {
          if ($('#preview')) $('#preview').textContent = preview + '\nsimulation reverted: ' + ETH.reason(sim.error);
          MOLD.say('simFail', { err: ETH.reason(sim.error) });
          return;
        }
        if ($('#preview')) $('#preview').textContent = preview + '\nsimulation ok.';
        MOLD.say('simOk');
      } catch (e) {
        if ($('#preview')) $('#preview').textContent = preview + '\n' + e.message;
      }
      return;
    }
    const runs = queueRuns();
    state.runSend = function () { sendAllQueue(); };
    const label = runs[i] && runs[i].label;
    await S.runSteps(runs, { only: label });
  }

  function paintTraits() {
    const traits = $('#rgbTraits');
    if (!traits || !state.planes) return;
    const r = P.popcount(state.planes.R);
    const g = P.popcount(state.planes.G);
    const b = P.popcount(state.planes.B);
    traits.innerHTML = (r || g || b) ? 'r ' + r + ' · g ' + g + ' · b ' + b + S.mark('ⓘ', S.TIPS.planes) : '';
  }

  let rgbHint = null;

  function rgbFree(value, suggested) {
    return SUGGEST.channelFree(value, suggested, state.planesTouched);
  }

  function rgbReady(hint) {
    if (!hint) return false;
    const by = state.rgbBy;
    try {
      return !RULES.rgbChannel('r', hint.r, by.r) &&
        !RULES.rgbChannel('g', hint.g, by.g) &&
        !RULES.rgbChannel('b', hint.b, by.b);
    } catch (e) { return false; }
  }

  function paintRgbHint(example, note) {
    const el = $('#hintNote');
    if (el) el.textContent = note || (example ? 'example' : '');
  }

  function fillRgb(advance) {
    const rEl = $('#pR');
    const gEl = $('#pG');
    const bEl = $('#pB');
    if (!rEl || !gEl || !bEl) return;
    const example = !state.account;
    const rFree = rgbFree(rEl.value, rgbHint && rgbHint.ownR ? rgbHint.r : null);
    const gFree = rgbFree(gEl.value, rgbHint && rgbHint.ownG ? rgbHint.g : null);
    const bFree = rgbFree(bEl.value, rgbHint && rgbHint.ownB ? rgbHint.b : null);
    if (!rFree && !gFree && !bFree) {
      paintRgbHint(false, '');
      const meta = $('#rgbMeta');
      if (meta) meta.innerHTML = issuesHtml(planeIssues(state.planes));
      return;
    }
    const shown = rgbHint && {
      r: rgbHint.ownR ? rgbHint.r : rEl.value,
      g: rgbHint.ownG ? rgbHint.g : gEl.value,
      b: rgbHint.ownB ? rgbHint.b : bEl.value,
    };
    const rgbValues = { r: rEl.value, g: gEl.value, b: bEl.value };
    const rgbOwns = rgbHint && { r: !!rgbHint.ownR, g: !!rgbHint.ownG, b: !!rgbHint.ownB };
    const rgbFilled = shown && String(shown.r).trim() && String(shown.g).trim() && String(shown.b).trim();
    if (!advance && SUGGEST.keepParts(rgbHint, rgbValues, rgbOwns, rgbFilled && rgbReady(shown))) {
      if (rgbHint.ownR && rFree) rEl.value = String(rgbHint.r);
      if (rgbHint.ownG && gFree) gEl.value = String(rgbHint.g);
      if (rgbHint.ownB && bFree) bEl.value = String(rgbHint.b);
      const pure = rEl.value === String(rgbHint.r) && gEl.value === String(rgbHint.g) && bEl.value === String(rgbHint.b);
      paintRgbHint(example && pure, '');
      rEl.dispatchEvent(new Event('change'));
      return;
    }
    const ids = [];
    state.supply.forEach(function (owner, id) { ids.push(id); });
    let avoid = null;
    if (advance && rgbHint &&
      (rFree || rEl.value === String(rgbHint.r)) &&
      (gFree || gEl.value === String(rgbHint.g)) &&
      (bFree || bEl.value === String(rgbHint.b))) {
      try { avoid = { r: BigInt(rgbHint.r), g: BigInt(rgbHint.g), b: BigInt(rgbHint.b) }; }
      catch (e) { avoid = null; }
    }
    const next = SUGGEST.rgbTriple({
      ids: ids,
      supply: state.supply,
      blocked: state.blocked,
      by: state.rgbBy,
      skip: S.openMints(),
    }, {
      rand: Math.random,
      avoid: avoid,
      lock: {
        r: rFree ? null : rEl.value,
        g: gFree ? null : gEl.value,
        b: bFree ? null : bEl.value,
      },
    });
    if (!next) {
      if (rgbHint && !rgbReady(rgbHint)) {
        if (rFree) rEl.value = '';
        if (gFree) gEl.value = '';
        if (bFree) bEl.value = '';
        rgbHint = null;
      }
      paintRgbHint(false, advance && rgbHint ? 'nothing else' : 'nothing to suggest');
      const meta = $('#rgbMeta');
      if (meta) meta.innerHTML = issuesHtml(planeIssues(state.planes));
      return;
    }
    if (rFree) rEl.value = next.r.toString();
    if (gFree) gEl.value = next.g.toString();
    if (bFree) bEl.value = next.b.toString();
    rgbHint = {
      r: rEl.value,
      g: gEl.value,
      b: bEl.value,
      ownR: !!rFree,
      ownG: !!gFree,
      ownB: !!bFree,
      example: example,
    };
    paintRgbHint(example && rFree && gFree && bFree, '');
    rEl.dispatchEvent(new Event('change'));
  }

  function swatchHtml() {
    if (!P.COL[state.ink]) state.ink = 'w';
    return '<p class="dim">Each channel is on or off per pixel.</p>' +
      '<div class="swatches" role="group" aria-label="color">' +
      P.SWATCHES.map(function (sw) {
        const on = sw.ch === state.ink;
        return '<button type="button" class="swatch ' + sw.ch + (on ? ' on' : '') + '" data-ink="' + sw.ch + '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + sw.name + '"></button>';
      }).join('') +
      '</div>';
  }

  function rgb(view) {
    if (state.arm && state.arm.kind === 'rgb') {
      syncPlanes();
      const next = state.planes || { R: 0n, G: 0n, B: 0n };
      next[state.arm.ch] = state.arm.id;
      state.planes = next;
      state.grid = P.planesToRows(next.R, next.G, next.B);
      state.arm = null;
    }
    syncPlanes();
    const p = state.planes || { R: 0n, G: 0n, B: 0n };
    view.innerHTML =
      S.lead('Paint three channels. Each one is a MATH id.', 'planes') +
      '<div class="row"><button type="button" id="heart">heart</button>' +
      '<button type="button" id="shuffle">shuffle</button>' +
      '<input type="file" id="file" accept="image/*">' +
      '<label><input type="checkbox" id="dither"> dither</label>' +
      '<button type="button" id="apply">apply image</button></div>' +
      swatchHtml() +
      '<div id="cells"></div>' +
      '<div class="row"><label class="num">R <input id="pR" spellcheck="false" inputmode="numeric" value="' + p.R + '"></label></div>' +
      '<div class="row"><label class="num">G <input id="pG" spellcheck="false" inputmode="numeric" value="' + p.G + '"></label></div>' +
      '<div class="row"><label class="num">B <input id="pB" spellcheck="false" inputmode="numeric" value="' + p.B + '"></label></div>' +
      '<div class="row"><button type="button" id="suggest">suggest another</button><span id="hintNote" class="dim"></span></div>' +
      '<p id="rgbTraits" class="dim"></p><p id="rgbMeta"></p><div id="queue"></div>' +
      '<p class="dim" id="batchNote" hidden>A batch may ask MetaMask for a one-time smart account upgrade (EIP-7702). That delegates this address for the calls. You approve it in the wallet. This page does not sign by itself.</p>' +
      '<div id="run"></div>' +
      '<div class="row"><button type="button" id="planRgb">plan routes</button><button type="button" id="sendQueueAll">send</button>' +
      '<button type="button" id="sendBatch" disabled>send as one batch</button>' +
      '<span id="batchWhy" class="dim"></span></div>' +
      '<div class="preview" id="preview">MATH mints, then RGB.add at 0.03 ETH, paid to the channel owners. send signs the next batch.' + S.mark('ⓘ', S.TIPS.fees) + '</div>';
    const grid = $('#cells');
    grid.innerHTML = S.cellsHtml(state.grid);
    paintTraits();
    let stroke = '';
    function put(btn, ch) {
      if (!btn || !btn.closest('#cells')) return false;
      const i = Number(btn.dataset.i);
      const next = P.paintCell(state.grid, i, ch);
      if (next === state.grid) return false;
      state.planesTouched = true;
      state.grid = next;
      btn.className = ch;
      return true;
    }
    function syncGrid() {
      syncPlanes();
      writePlaneInputs();
      paintTraits();
      rememberPlanes();
      const issues = planeIssues(state.planes);
      const meta = $('#rgbMeta');
      if (meta) meta.innerHTML = issuesHtml(issues);
      return issues;
    }
    grid.addEventListener('pointerdown', function (ev) {
      const btn = ev.target.closest('button');
      if (!btn || ev.button > 0) return;
      ev.preventDefault();
      stroke = state.ink;
      put(btn, stroke);
      const issues = syncGrid();
      const rule = issues.find(function (s) { return RULES.mold(s); });
      S.hit(rule || '');
      try { grid.setPointerCapture(ev.pointerId); } catch (e) { /* already gone */ }
    }, { passive: false });
    grid.addEventListener('pointermove', function (ev) {
      if (!stroke) return;
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const btn = el && el.closest && el.closest('#cells button');
      if (put(btn, stroke)) syncGrid();
    });
    function endStroke() { stroke = ''; }
    grid.addEventListener('pointerup', endStroke);
    grid.addEventListener('pointercancel', endStroke);
    grid.addEventListener('click', function (ev) {
      if (ev.detail !== 0) return;
      const btn = ev.target.closest('button');
      if (!btn) return;
      put(btn, state.ink);
      const issues = syncGrid();
      const rule = issues.find(function (s) { return RULES.mold(s); });
      S.hit(rule || '');
    });
    document.querySelectorAll('.swatches button').forEach(function (b) {
      b.onclick = function () {
        state.ink = b.dataset.ink;
        document.querySelectorAll('.swatches button').forEach(function (el) {
          const on = el === b;
          el.classList.toggle('on', on);
          el.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      };
    });
    $('#heart').onclick = function () { S.applyHeart(false); };
    $('#shuffle').onclick = function () { S.applyHeart(true); };
    $('#file').onchange = function () {
      const file = $('#file').files && $('#file').files[0];
      if (!file) return;
      state.planesTouched = true;
      const img = new Image();
      img.onload = function () {
        state.sample = sampleImage(img);
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    };
    $('#apply').onclick = function () {
      if (!state.sample) return;
      state.planesTouched = true;
      const px = new Float32Array(state.sample);
      const thr = [0.5, 0.5, 0.5];
      const dither = $('#dither').checked;
      const chars = new Array(256);
      for (let i = 0; i < 256; i++) {
        const y = Math.floor(i / 16);
        const x = i % 16;
        let bits = 0;
        for (let c = 0; c < 3; c++) {
          const v = px[i * 3 + c];
          const on = v >= thr[c] ? 1 : 0;
          bits |= on << (2 - c);
          if (dither) {
            const err = v - on;
            [[1, 0, 7], [-1, 1, 3], [0, 1, 5], [1, 1, 1]].forEach(function (d) {
              const xx = x + d[0];
              const yy = y + d[1];
              if (xx < 0 || xx > 15 || yy > 15) return;
              const j = yy * 16 + xx;
              px[j * 3 + c] += err * d[2] / 16;
            });
          }
        }
        chars[i] = P.PAL[bits];
      }
      state.grid = [];
      for (let y = 0; y < 16; y++) state.grid.push(chars.slice(y * 16, y * 16 + 16).join(''));
      S.show('rgb');
    };
    ['pR', 'pG', 'pB'].forEach(function (id) {
      $('#' + id).addEventListener('input', function (ev) {
        if (ev.isTrusted) state.planesTouched = true;
      });
      $('#' + id).addEventListener('change', function (ev) {
        if (ev.isTrusted) state.planesTouched = true;
        try {
          const R = BigInt($('#pR').value.trim());
          const G = BigInt($('#pG').value.trim());
          const B = BigInt($('#pB').value.trim());
          state.grid = P.planesToRows(R, G, B);
          state.planes = { R: R, G: G, B: B };
          $('#cells').innerHTML = S.cellsHtml(state.grid);
          paintTraits();
          const issues = planeIssues(state.planes);
          $('#rgbMeta').innerHTML = issuesHtml(issues);
          const note = $('#hintNote');
          if (note && note.textContent === 'example' && rgbHint &&
            ($('#pR').value !== String(rgbHint.r) || $('#pG').value !== String(rgbHint.g) || $('#pB').value !== String(rgbHint.b))) {
            note.textContent = '';
          }
          const rule = issues.find(function (s) { return RULES.mold(s); });
          S.hit(rule || '');
          rememberPlanes();
        } catch (e) { /* keep grid */ }
      });
    });
    rememberPlanes();
    state.runSend = function () { sendAllQueue(); };
    $('#planRgb').onclick = planRgb;
    $('#suggest').onclick = function () { fillRgb(true); };
    const issues = planeIssues(state.planes);
    $('#rgbMeta').innerHTML = issuesHtml(issues);
    paintQueue();
    fillRgb(false);
  }

  S.rgb = rgb;
  S.fillRgb = fillRgb;
  S.planeIssues = planeIssues;
  S.issuesHtml = issuesHtml;
})();
