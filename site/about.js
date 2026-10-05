(function () {
  const S = globalThis.SITE;
  const ETH = globalThis.ETH;
  const ADDR = ETH.ADDR;

  function scan(addr) {
    return '<a href="https://etherscan.io/address/' + addr + '" target="_blank" rel="noopener noreferrer">' + S.namedAddr(addr) + '</a>';
  }

  function about(view) {
    view.innerHTML =
      '<p>1 + 1 = 2</p>' +
      '<p>Reads use Multicall3 against public Ethereum nodes. Writes go through the injected wallet. Nothing on this page can sign, and it holds no key.</p>' +
      '<p>Drawing with MATH started with <a href="https://kaigani.medium.com/drawing-with-math-64965b3f0fae">kaigani, 2019</a>.</p>' +
      '<p>Fees on MATH and RGB are royalties to whoever holds the inputs, not a cut for this site. Hold those inputs and that share comes back to you (some contract wallets can\'t take MATH\'s payout). You still pay gas.</p>' +
      '<p>Every MATH after #1 is the sum of two others. RGB and TOON are built from parts. A MATH or RGB mint pays the holders it builds on, and a later mint can build on yours.</p>' +
      '<p>MATH, RGB, TOON, and the renderers have no admin key and no upgrade. The renderers draw the pictures on mainnet.</p>' +
      '<h2>rules</h2>' +
      globalThis.RULES.about().map(function (line) { return '<p>' + S.esc(line) + '</p>'; }).join('') +
      '<p class="dim">served from site/ at math.alxo.city.</p>' +
      '<p class="dim"><a href="https://github.com/alxocity/MATH" target="_blank" rel="noopener noreferrer">source</a> &amp; <a href="https://github.com/alxocity/MATH/issues/new" target="_blank" rel="noopener noreferrer">feedback</a></p>' +
      '<p class="dim">MATH ' + scan(ADDR.MATH) + '<br>RGB ' + scan(ADDR.RGB) + '<br>TOON ' + scan(ADDR.TOON) +
      '<br>WORD ' + scan(ADDR.WORD) + '<br>FACE ' + scan(ADDR.FACE) +
      '<br>render ' + scan(ADDR.MATH_RENDER) + '<br>' + scan(ADDR.RGB_RENDER) + '<br>' + scan(ADDR.TOON_RENDER) + '</p>';
  }

  S.about = about;
})();
