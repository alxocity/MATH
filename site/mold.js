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

  function mount(host, onPick) {
    host.innerHTML = '<p class="who">moldemort</p><p id="mold-line"></p><div id="mold-sug"></div>';
    const box = host.querySelector('#mold-sug');
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

  globalThis.MOLD = { say: say, mount: mount };
})();
