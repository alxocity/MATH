(function () {
  const S = globalThis.SITE;
  const $ = S.$;
  const ETH = globalThis.ETH;
  const ADDR = ETH.ADDR;

  function about(view) {
    view.innerHTML =
      '<p>1 + 1 = 2</p>' +
      '<p>Reads use Multicall3 against a public Ethereum node. Writes go through the injected wallet. Nothing on this page can sign, and it holds no key.</p>' +
      '<p>Drawing with MATH started with <a href="https://kaigani.medium.com/drawing-with-math-64965b3f0fae">kaigani, 2019</a>.</p>' +
      '<p class="dim">GitHub Pages serves <span>site/</span>. A CNAME for math.alxo.city is a follow-up, not set here.</p>' +
      '<p class="dim">MATH ' + ADDR.MATH + '<br>RGB ' + ADDR.RGB + '<br>TOON ' + ADDR.TOON +
      '<br>WORD ' + ADDR.WORD + '<br>FACE ' + ADDR.FACE +
      '<br>render ' + ADDR.MATH_RENDER + '<br>' + ADDR.RGB_RENDER + '<br>' + ADDR.TOON_RENDER + '</p>' +
      '<div class="row"><label>rpc <input id="rpc" size="42" spellcheck="false" value="' + S.esc(ETH.rpcUrl()) + '"></label>' +
      '<button type="button" id="saveRpc">save</button></div>';
    $('#saveRpc').onclick = function () {
      const u = $('#rpc').value.trim();
      if (!/^https:\/\//.test(u)) return;
      localStorage.setItem('math.site.rpc', u);
      S.setStatus('rpc saved');
    };
  }

  S.about = about;
})();
