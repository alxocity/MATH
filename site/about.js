(function () {
  const S = globalThis.SITE;
  const ETH = globalThis.ETH;
  const ADDR = ETH.ADDR;

  function about(view) {
    view.innerHTML =
      '<p>1 + 1 = 2</p>' +
      '<p>Reads use Multicall3 against public Ethereum nodes. Writes go through the injected wallet. Nothing on this page can sign, and it holds no key.</p>' +
      '<p>Drawing with MATH started with <a href="https://kaigani.medium.com/drawing-with-math-64965b3f0fae">kaigani, 2019</a>.</p>' +
      '<h2>rules</h2>' +
      globalThis.RULES.about().map(function (line) { return '<p>' + S.esc(line) + '</p>'; }).join('') +
      '<p class="dim">served from site/ at math.alxo.city.</p>' +
      '<p class="dim"><a href="https://github.com/alxocity/MATH" target="_blank" rel="noopener">source</a> &amp; <a href="https://github.com/alxocity/MATH/issues/new" target="_blank" rel="noopener">feedback</a></p>' +
      '<p class="dim">MATH ' + ADDR.MATH + '<br>RGB ' + ADDR.RGB + '<br>TOON ' + ADDR.TOON +
      '<br>WORD ' + ADDR.WORD + '<br>FACE ' + ADDR.FACE +
      '<br>render ' + ADDR.MATH_RENDER + '<br>' + ADDR.RGB_RENDER + '<br>' + ADDR.TOON_RENDER + '</p>';
  }

  S.about = about;
})();
