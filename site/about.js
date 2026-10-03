(function () {
  const S = globalThis.SITE;
  const ETH = globalThis.ETH;
  const ADDR = ETH.ADDR;

  function about(view) {
    view.innerHTML =
      '<p>1 + 1 = 2</p>' +
      '<p>Reads use Multicall3 against public Ethereum nodes. Writes go through the injected wallet. Nothing on this page can sign, and it holds no key.</p>' +
      '<p>Drawing with MATH started with <a href="https://kaigani.medium.com/drawing-with-math-64965b3f0fae">kaigani, 2019</a>.</p>' +
      '<p class="dim">GitHub Pages serves <span>site/</span>. A CNAME for math.alxo.city is a follow-up, not set here.</p>' +
      '<p class="dim">MATH ' + ADDR.MATH + '<br>RGB ' + ADDR.RGB + '<br>TOON ' + ADDR.TOON +
      '<br>WORD ' + ADDR.WORD + '<br>FACE ' + ADDR.FACE +
      '<br>render ' + ADDR.MATH_RENDER + '<br>' + ADDR.RGB_RENDER + '<br>' + ADDR.TOON_RENDER + '</p>';
  }

  S.about = about;
})();
