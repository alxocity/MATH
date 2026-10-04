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

  function paintQueue() {
    const host = $('#queue');
    if (!host) return;
    host.innerHTML = state.queue.map(function (tx, i) {
      if (tx.kind === 'math') {
        const step = tx.step;
        const note = payNote(step);
        const sendOff = note === RULES.payout() ? ' disabled' : '';
        const noteMark = note === RULES.payout() ? S.mark('ⓘ', S.TIPS.blocked) : note === RULES.unchecked() ? S.mark('ⓘ', S.TIPS.unchecked) : '';
        return '<div class="step">' + (i + 1) + '. ' + step.a + ' + ' + step.b + ' = ' + step.result +
          (note ? ' <span class="' + (note === RULES.unchecked() ? 'dim' : 'bad') + '">' + S.esc(note) + '</span>' + noteMark : '') +
          ' <button type="button" data-sim="' + i + '">simulate</button>' + S.mark('ⓘ', S.TIPS.simulate) +
          '<button type="button" data-send="' + i + '"' + sendOff + '>send</button></div>';
      }
      const why = rgbQueueWhy(tx);
      const used = why && why.indexOf('already used') !== -1 ? S.mark('ⓘ', S.TIPS.used) : '';
      return '<div class="step">' + (i + 1) + '. RGB.add ' + tx.r + ', ' + tx.g + ', ' + tx.b +
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
      const routes = [p.R, p.G, p.B].map(function (n) { return P.plan(n, S.ctx()); });
      const have = new Set(state.supply.keys());
      const queue = [];
      routes.forEach(function (route) {
        route.steps.forEach(function (step) {
          if (step.exists || have.has(step.result)) {
            have.add(step.result);
            return;
          }
          queue.push({ kind: 'math', step: step });
          have.add(step.result);
        });
      });
      queue.push({ kind: 'rgb', r: p.R, g: p.G, b: p.B });
      state.queue = queue;
      let roy = 0n;
      let mathMints = 0;
      queue.forEach(function (item) {
        if (item.kind !== 'math') return;
        roy += item.step.royalty;
        mathMints++;
      });
      [p.R, p.G, p.B].forEach(function (id) {
        const owner = state.supply.get(id);
        const minted = queue.some(function (item) { return item.kind === 'math' && item.step.result === id; });
        if (!(owner === S.me() || minted)) roy += P.RGB_ROY;
      });
      const net = P.G_ADD * state.gasPrice * BigInt(mathMints) + P.G_RGB * state.gasPrice + roy;
      if (meta) meta.textContent = queue.length + ' txs. net ~' + S.fmt(net) + ' ETH. the wallet still shows 0.002 or 0.03 on each send.';
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
    if (item.kind === 'math') {
      await S.sendStep(item.step, really);
      return;
    }
    if (!really) {
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
    const preview = 'RGB.add(' + item.r + ', ' + item.g + ', ' + item.b + ')\nto ' + ADDR.RGB + '\nvalue 0.03 ETH';
    state.preview = preview;
    if ($('#preview')) $('#preview').textContent = preview + '\nre-checking planes.';
    await S.guardSend(async function () {
      const owners = await Promise.all([
        ETH.ownerOf(ADDR.MATH, item.r),
        ETH.ownerOf(ADDR.MATH, item.g),
        ETH.ownerOf(ADDR.MATH, item.b),
      ]);
      if (owners.some(function (o) { return !o; })) throw new Error('a plane is not minted yet');
      const tx = {
        from: state.account,
        to: ADDR.RGB,
        data: ABI.call(ABI.SEL.add3, [item.r, item.g, item.b]),
        value: S.hex(P.MSG_RGB),
      };
      const sim = await ETH.simulate(tx);
      if (sim.error) throw new Error(ETH.reason(sim.error));
      if ($('#preview')) $('#preview').textContent = preview + '\nsimulation ok. confirm in the wallet.';
      const hash = await ETH.send(tx);
      S.noteSent(hash);
    });
  }

  function paintTraits() {
    const traits = $('#rgbTraits');
    if (!traits || !state.planes) return;
    const r = P.popcount(state.planes.R);
    const g = P.popcount(state.planes.G);
    const b = P.popcount(state.planes.B);
    traits.innerHTML = (r || g || b) ? 'r ' + r + ' · g ' + g + ' · b ' + b + S.mark('ⓘ', S.TIPS.planes) : '';
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
      '<div class="row"><button type="button" id="heart">heart</button>' +
      '<button type="button" id="shuffle">shuffle</button>' +
      '<input type="file" id="file" accept="image/*">' +
      '<label><input type="checkbox" id="dither"> dither</label>' +
      '<button type="button" id="apply">apply image</button></div>' +
      '<div class="row"><label>R <input type="range" id="thrR" min="0" max="100" value="50"></label>' +
      '<label>G <input type="range" id="thrG" min="0" max="100" value="50"></label>' +
      '<label>B <input type="range" id="thrB" min="0" max="100" value="50"></label></div>' +
      '<div id="cells"></div>' +
      '<div class="row"><label>R <input id="pR" spellcheck="false" value="' + p.R + '"></label></div>' +
      '<div class="row"><label>G <input id="pG" spellcheck="false" value="' + p.G + '"></label></div>' +
      '<div class="row"><label>B <input id="pB" spellcheck="false" value="' + p.B + '"></label></div>' +
      '<p id="rgbTraits" class="dim"></p><p id="rgbMeta"></p><div id="queue"></div>' +
      '<div class="row"><button type="button" id="planRgb">plan routes</button></div>' +
      '<div class="preview" id="preview">MATH mints, then RGB.add at 0.03 ETH. one click, one signature.' + S.mark('ⓘ', S.TIPS.fees) + '</div>';
    const grid = $('#cells');
    grid.innerHTML = S.cellsHtml(state.grid);
    paintTraits();
    let stroke = '';
    function put(btn, ch) {
      if (!btn || btn.className === ch) return false;
      const i = Number(btn.dataset.i);
      const y = Math.floor(i / 16);
      const x = i % 16;
      const row = state.grid[y].split('');
      row[x] = ch;
      state.grid[y] = row.join('');
      btn.className = ch;
      return true;
    }
    function syncGrid() {
      syncPlanes();
      writePlaneInputs();
      paintTraits();
      const issues = planeIssues(state.planes);
      const meta = $('#rgbMeta');
      if (meta) meta.innerHTML = issuesHtml(issues);
      return issues;
    }
    grid.addEventListener('pointerdown', function (ev) {
      const btn = ev.target.closest('button');
      if (!btn || ev.button > 0) return;
      ev.preventDefault();
      const cur = P.PAL.indexOf(btn.className);
      stroke = P.PAL[(cur + 1) % P.PAL.length];
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
      const cur = P.PAL.indexOf(btn.className);
      put(btn, P.PAL[(cur + 1) % P.PAL.length]);
      const issues = syncGrid();
      const rule = issues.find(function (s) { return RULES.mold(s); });
      S.hit(rule || '');
    });
    $('#heart').onclick = function () { S.applyHeart(false); };
    $('#shuffle').onclick = function () { S.applyHeart(true); };
    $('#file').onchange = function () {
      const file = $('#file').files && $('#file').files[0];
      if (!file) return;
      const img = new Image();
      img.onload = function () {
        state.sample = sampleImage(img);
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(file);
    };
    $('#apply').onclick = function () {
      if (!state.sample) return;
      const px = new Float32Array(state.sample);
      const thr = [Number($('#thrR').value) / 100, Number($('#thrG').value) / 100, Number($('#thrB').value) / 100];
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
      $('#' + id).addEventListener('change', function () {
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
          const rule = issues.find(function (s) { return RULES.mold(s); });
          S.hit(rule || '');
        } catch (e) { /* keep grid */ }
      });
    });
    $('#planRgb').onclick = planRgb;
    const issues = planeIssues(state.planes);
    $('#rgbMeta').innerHTML = issuesHtml(issues);
    paintQueue();
  }

  S.rgb = rgb;
  S.planeIssues = planeIssues;
  S.issuesHtml = issuesHtml;
})();
