(function (g, f) {
  const api = f();
  if (typeof module === 'object' && module.exports) module.exports = api;
  g.TOONR = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // TOONRender.tokenSVG. The contract takes an id, not the four parts.
  function toneHex(n) {
    let x = BigInt(n);
    if (x > 0xd8b49fn) x = 0xffffffn;
    return x.toString(16).padStart(6, '0');
  }

  function textHex(n) {
    return (Number(BigInt(n)) - 5).toString(16).padStart(6, '0');
  }

  function xml(s) {
    return String(s).replace(/[&<>]/g, function (c) {
      return c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;';
    });
  }

  function pixels(r, g, b, x0, step) {
    const R = BigInt(r);
    const G = BigInt(g);
    const B = BigInt(b);
    const tail = step === 16
      ? '" width="16" height="16" fill="#'
      : '" width="12" height="12" fill="#';
    const parts = new Array(256);
    for (let i = 0; i < 256; i++) {
      const shift = BigInt(255 - i);
      const cr = (R >> shift) & 1n ? 'f' : '0';
      const cg = (G >> shift) & 1n ? 'f' : '0';
      const cb = (B >> shift) & 1n ? 'f' : '0';
      parts[i] = '<rect x="' + (x0 + step * (i & 15)) + '" y="' + (47 + step * (i >> 4)) + tail + cr + cg + cb + '"/>';
    }
    return parts.join('');
  }

  function svg(r, g, b, face, bg, fg) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 350 350" shape-rendering="crispEdges" width="350" height="350"><rect x="47" y="235" width="256" height="72" fill="#' +
      toneHex(bg) + '"/>' +
      pixels(r, g, b, 79, 12) +
      '<text x="50%" y="271" dominant-baseline="middle" text-anchor="middle" font-size="72px" fill="#' +
      textHex(fg) + '">' +
      xml(face) +
      '</text></svg>';
  }

  return { toneHex: toneHex, textHex: textHex, xml: xml, pixels: pixels, svg: svg };
});
