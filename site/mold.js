(function () {
  // Every spoken line lives here. No network, no model.
  const LINES = {
    boot: [
      'spores on the glass. the numbers are already underneath.',
      '1 + 1 = 2. carry is just rot moving house.',
      'math, rgb, toon, and the renderers. no admin key. no upgrade. they just sit.',
    ],
    connect: [
      'wallet {addr}. {mine} of {math} MATH tokens answer to you.',
    ],
    noWallet: [
      'no injected wallet. the books still open. nothing here can sign.',
    ],
    browse: [
      'filter the fruiting bodies. popcount, palindrome, a power of two.',
      'after the first, every MATH is a sum. hold one and a later mint can pay you.',
    ],
    loading: [
      'pulling the index. {n}',
    ],
    loaded: [
      'block {block}. MATH {math}, RGB {rgb}, TOON {toon}.',
    ],
    exists: [
      '{n} already fruited. owner {owner}. do not mint it again.',
    ],
    mintReady: [
      '{a} + {b} = {n}. {roy}. simulate, then the wallet signs.',
      'own the inputs and the royalty comes back. some contract wallets can\'t take math\'s payout.',
    ],
    route: [
      '{mints} mints. net about {net} ETH. pin a piece if the path smells wrong.',
    ],
    blocked: [
      '{n} holders revert a 2300-gas stipend. their tokens stay out of the plan.',
    ],
    rgb: [
      'pixel i is bit 255-i. the first cell is the high bit. three planes, then one add.',
      'the 0.03 goes to the three channel holders. hold them and it comes back. gas stays.',
    ],
    heart: [
      'red heart. R {r}, {mints} mints. green {g}, blue {b}. a fresh triple, still the same shape.',
    ],
    heartNone: [
      'no fresh heart. every short red route is spent, or green and blue have nowhere clean to sit.',
    ],
    heartWait: [
      'holders are still unknown. no heart until that count finishes.',
    ],
    rgbBad: [
      '{why}. the channel is closed.',
    ],
    toon: [
      'four tokens you already hold. grey picks say why.',
      'toon is free. math and rgb pay the holders they are built on.',
    ],
    rgbTaken: [
      "that {color}'s taken. forever. pick another.",
    ],
    rgbImage: [
      "that picture already exists. rgb doesn't do sequels.",
    ],
    payout: [
      "that holder can't take the cut. the mint stays shut.",
    ],
    notYours: [
      "you don't own that. toon only takes what you hold.",
    ],
    toonSpent: [
      'that {kind} is already in a toon. one use. then never.',
    ],
    toonMath: [
      'that math already grew a toon. the id is taken.',
    ],
    toonPick: [
      '{word} on {face}.',
    ],
    simOk: [
      'simulation held. the wallet is next, and only if you press send.',
    ],
    simFail: [
      'simulation reverted: {err}. nothing was sent.',
    ],
    sent: [
      'tx {hash}. you signed it. i only watched.',
    ],
    rejected: [
      'the wallet closed. nothing left this page.',
    ],
    wait: [
      'that tx is still in the dark. wait for the receipt before the next send.',
    ],
    mined: [
      'receipt {status}. the next send is unlocked.',
    ],
    idea: {
      math: [
        '{a} + {b} = {n}. {out} out, {back} back to you. gas yours.',
        '{a} + {b} = {n}. {out} leaves. {back} comes home. gas yours.',
        'mint {n}. {a} and {b}. net {net}. gas yours.',
      ],
      rgb: [
        'rgb {r},{g},{b}. {fee} to three holders. {stake}.',
        'rgb {r},{g},{b}. {fee} out to the channels. {stake}.',
        'picture {r} {g} {b}. {fee}. {stake}. gas yours.',
      ],
      toon: [
        'toon. you hold all four. free.',
        'toon {math},{word},{face},{rgb}. free.',
        'four parts, one toon. no fee.',
      ],
    },
    ideaBad: [
      '{why}.',
      'no. {why}.',
      'that one stays shut. {why}.',
    ],
    noIdeas: [
      'nothing you can build from here.',
      'empty hands. no mint, no picture, no toon.',
      'the index has nothing for this address.',
    ],
  };

  const SUGGEST = [
    { label: '1 + 1', key: 'mintReady', tab: 'mint', act: 'mint11', vars: { a: '1', b: '1', n: '2', roy: 'check the owners' } },
    { label: 'heart', key: 'heart', tab: 'rgb', act: 'heart', quiet: true },
    { label: 'route 15', key: 'route', tab: 'route', act: 'route15', vars: { mints: '?', net: '?' } },
    { label: 'palindromes', key: 'browse', tab: 'browse', act: 'pal' },
    { label: 'credits', key: 'boot', tab: 'about', act: 'about' },
  ];

  const cursor = {};

  function fill(s, vars) {
    return s.replace(/\{(\w+)\}/g, function (_, k) {
      return vars && vars[k] != null ? String(vars[k]) : '…';
    });
  }

  function say(key, vars) {
    const list = LINES[key] || LINES.boot;
    const i = cursor[key] || 0;
    cursor[key] = i + 1;
    const line = fill(list[i % list.length], vars);
    const el = document.getElementById('mold-line');
    if (el) el.textContent = line;
    return line;
  }

  function wei(n) {
    const v = BigInt(n);
    const whole = v / (10n ** 18n);
    const frac = (v % (10n ** 18n)).toString().padStart(18, '0').replace(/0+$/, '');
    return whole.toString() + (frac ? '.' + frac : '');
  }

  function whyOf(plan) {
    const parts = String(plan && plan.note || '').split(/(?<=\.)\s+/);
    const kept = [];
    parts.forEach(function (s) {
      const low = s.trim().replace(/\.$/, '').toLowerCase();
      if (!low) return;
      const reason = low.indexOf('does not hold') !== -1 ||
        low.indexOf('not in the snapshot') !== -1 ||
        low.indexOf('already') !== -1 ||
        low.indexOf('cannot take') !== -1 ||
        low.indexOf('confirm the signer') !== -1;
      if (reason) kept.push(low);
    });
    return kept.join('. ') || 'not from this address';
  }

  function sentOf(idea) {
    if (idea && idea.sent != null) return BigInt(idea.sent);
    let n = 0n;
    ((idea && idea.plan && idea.plan.txs) || []).forEach(function (tx) { n += BigInt(tx.value); });
    return n;
  }

  function stakeOf(n) {
    if (n <= 0) return 'you hold none';
    if (n === 1) return "you're one";
    if (n === 2) return "you're two";
    return 'all three yours';
  }

  function varsFor(idea) {
    const plan = idea.plan || {};
    if (!plan.ok) return { why: whyOf(plan) };
    if (idea.kind === 'math') {
      const sent = sentOf(idea);
      const back = sent - BigInt(plan.royalty || '0');
      return {
        a: plan.shares && plan.shares[0] ? plan.shares[0].id : '',
        b: plan.shares && plan.shares[1] ? plan.shares[1].id : '',
        n: plan.target,
        out: wei(sent),
        back: wei(back < 0n ? 0n : back),
        net: wei(BigInt(plan.royalty || '0')),
      };
    }
    if (idea.kind === 'rgb') {
      const parts = String(plan.target || '').split(',');
      const channels = (plan.shares || []).slice(-3);
      let mine = 0;
      channels.forEach(function (row) { if (row.owned) mine++; });
      return { r: parts[0] || '', g: parts[1] || '', b: parts[2] || '', fee: '0.03', stake: stakeOf(mine) };
    }
    const parts = String(plan.target || '').split(',');
    return { math: parts[0] || '', word: parts[1] || '', face: parts[2] || '', rgb: parts[3] || '' };
  }

  function template(idea, ok) {
    if (!ok) return LINES.ideaBad[0];
    const list = LINES.idea[idea.kind] || LINES.idea.math;
    return list[0];
  }

  function loadOf(idea) {
    const plan = idea.plan;
    if (!plan || !plan.ok || plan.exists) return null;
    if (idea.kind === 'math') {
      if (!plan.shares || plan.shares.length < 2) return null;
      return { tab: 'mint', a: plan.shares[0].id, b: plan.shares[1].id };
    }
    if (idea.kind === 'rgb') {
      const p = String(plan.target || '').split(',');
      if (p.length < 3) return null;
      return { tab: 'rgb', r: p[0], g: p[1], b: p[2] };
    }
    const p = String(plan.target || '').split(',');
    if (p.length < 4) return null;
    return { tab: 'toon', math: p[0], word: p[1], face: p[2], rgb: p[3] };
  }

  function rows(list) {
    if (!list || !list.length) return [];
    return list.map(function (idea) {
      const ok = !!(idea.plan && idea.plan.ok && !idea.plan.exists);
      return {
        key: ok ? 'idea' : 'ideaBad',
        text: fill(template(idea, ok), varsFor(idea)),
        load: ok ? loadOf(idea) : null,
      };
    });
  }

  // Forward resolver is passed in. This does not read a reverse name.
  function resolveLook(text, forward) {
    const IDEAS = globalThis.IDEAS;
    const ENS = globalThis.ENS;
    const raw = String(text || '').trim();
    const direct = IDEAS ? IDEAS.walletOf(raw) : '';
    if (direct) return Promise.resolve(direct);
    const name = raw.toLowerCase();
    if (!ENS || !ENS.isName(name) || typeof forward !== 'function') return Promise.resolve('');
    return Promise.resolve(forward(name)).then(function (got) {
      return IDEAS ? IDEAS.walletOf(got) : '';
    }, function () { return ''; });
  }

  let onLoad = function () {};

  function showIdeas(list) {
    const built = rows(list);
    const host = document.getElementById('mold-ideas');
    const line = document.getElementById('mold-line');
    if (!built.length) {
      if (host) host.textContent = '';
      say('noIdeas');
      return built;
    }
    if (line) line.textContent = '';
    if (!host) return built;
    host.textContent = '';
    built.forEach(function (row) {
      const p = document.createElement('p');
      p.textContent = row.text;
      if (row.load) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = 'load it';
        b.addEventListener('click', function () { onLoad(row.load); });
        p.appendChild(document.createTextNode(' '));
        p.appendChild(b);
      }
      host.appendChild(p);
    });
    return built;
  }

  function setAccount(account) {
    const look = document.getElementById('mold-look');
    if (!look) return;
    look.hidden = !!account;
  }

  function mount(host, onPick) {
    host.innerHTML = '<p class="who">moldemort</p><p id="mold-line"></p><div id="mold-ideas"></div><div id="mold-sug"></div>';
    const box = host.querySelector('#mold-sug');
    const look = document.createElement('input');
    look.id = 'mold-look';
    look.type = 'text';
    look.spellcheck = false;
    look.autocomplete = 'off';
    look.placeholder = 'address or .eth';
    look.hidden = true;
    box.appendChild(look);
    const ask = document.createElement('button');
    ask.type = 'button';
    ask.textContent = 'what can i build';
    ask.addEventListener('click', function () {
      onPick({ act: 'ideas', pasted: look.hidden ? '' : look.value });
    });
    box.appendChild(ask);
    onLoad = function (load) { onPick({ act: 'load', load: load }); };
    SUGGEST.forEach(function (s) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = s.label;
      b.addEventListener('click', function () {
        if (!s.quiet) say(s.key, s.vars);
        onPick(s);
      });
      box.appendChild(b);
    });
    say('boot');
  }

  globalThis.MOLD = {
    say: say,
    mount: mount,
    rows: rows,
    showIdeas: showIdeas,
    setAccount: setAccount,
    resolveLook: resolveLook,
    loadOf: loadOf,
  };
  if (typeof module === 'object' && module.exports) module.exports = globalThis.MOLD;
})();
