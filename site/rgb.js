(function () {
  const S = globalThis.SITE;
  const state = S.state;
  const $ = S.$;
  const ETH = globalThis.ETH;
  const P = globalThis.PLAN;
  const ABI = globalThis.ABI;
  const ADDR = ETH.ADDR;

  function syncPlanes() {
    try { state.planes = P.gridToPlanes(state.grid); } catch (e) { state.planes = null; }
  }

  function planeIssues(p) {
    if (!p) return ['grid'];
    const out = [];
    [['R', p.R, state.usedR], ['G', p.G, state.usedG], ['B', p.B, state.usedB]].forEach(function (row) {
      if (row[1] === 0n) out.push(row[0] + ' is 0');
      else if (row[2].has(row[1])) out.push(row[0] + ' already used');
    });
    return out;
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
        return '<div class="step">' + (i + 1) + '. ' + step.a + ' + ' + step.b + ' = ' + step.result +
          ' <button type="button" data-q="' + i + '">simulate + send</button></div>';
      }
      return '<div class="step">' + (i + 1) + '. RGB.add ' + tx.r + ', ' + tx.g + ', ' + tx.b +
        ' value 0.03 <button type="button" data-q="' + i + '">simulate + send</button></div>';
    }).join('');
    host.querySelectorAll('[data-q]').forEach(function (b) {
      b.onclick = function () { sendQueue(Number(b.dataset.q)); };
    });
  }

  function planRgb() {
    syncPlanes();
    const issues = planeIssues(state.planes);
    const meta = $('#rgbMeta');
    if (issues.length) {
      if (meta) meta.textContent = issues.join(', ');
      MOLD.say('rgbBad', { why: issues[0] });
      state.queue = [];
      paintQueue();
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
  }

  async function sendQueue(i) {
    const item = state.queue[i];
    if (!item) return;
    if (item.kind === 'math') {
      await S.sendStep(item.step);
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
    traits.textContent = (r || g || b) ? 'r ' + r + ' · g ' + g + ' · b ' + b : '';
  }

  function rgb(view) {
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
      '<div class="preview" id="preview">MATH mints, then RGB.add at 0.03 ETH. one click, one signature.</div>';
    $('#cells').innerHTML = S.cellsHtml(state.grid);
    paintTraits();
    $('#cells').onclick = function (ev) {
      const btn = ev.target.closest('button');
      if (!btn) return;
      const i = Number(btn.dataset.i);
      const y = Math.floor(i / 16);
      const x = i % 16;
      const cur = P.PAL.indexOf(state.grid[y][x]);
      const next = P.PAL[(cur + 1) % P.PAL.length];
      const row = state.grid[y].split('');
      row[x] = next;
      state.grid[y] = row.join('');
      btn.className = next;
      syncPlanes();
      writePlaneInputs();
      paintTraits();
      $('#rgbMeta').textContent = planeIssues(state.planes).join(', ');
    };
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
          S.show('rgb');
        } catch (e) { /* keep grid */ }
      });
    });
    $('#planRgb').onclick = planRgb;
    const issues = planeIssues(state.planes);
    $('#rgbMeta').textContent = issues.join(', ');
    paintQueue();
  }

  S.rgb = rgb;
  S.planeIssues = planeIssues;
})();
