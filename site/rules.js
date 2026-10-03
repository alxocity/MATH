(function (g, f) {
  const api = f();
  if (typeof module === 'object' && module.exports) module.exports = api;
  g.RULES = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function idOf(map, id) {
    if (!map || id == null || id === '') return null;
    let x;
    try { x = BigInt(id); } catch (e) { return null; }
    if (!map.has(x)) return null;
    return map.get(x);
  }

  function channelName(channel) {
    const c = String(channel).toLowerCase();
    if (c === 'r') return 'red';
    if (c === 'g') return 'green';
    if (c === 'b') return 'blue';
    return c;
  }

  function rgbChannel(channel, mathId, byId) {
    const rgb = idOf(byId, mathId);
    if (rgb == null) return '';
    return channelName(channel) + ' already used by RGB #' + rgb;
  }

  function rgbImage(r, g, b, byR, byG, byB) {
    const rr = idOf(byR, r);
    const gg = idOf(byG, g);
    const bb = idOf(byB, b);
    if (rr != null && rr === gg && gg === bb) return 'this image is already RGB #' + rr;
    return '';
  }

  function toonPart(kind, id, byKind) {
    const toon = idOf(byKind, id);
    if (toon == null) return '';
    if (kind === 'math') return 'this MATH already bases TOON #' + toon;
    return kind + ' already in TOON #' + toon;
  }

  function payout() { return "holder can't receive payout"; }
  function notYours() { return "you don't own this"; }

  function mold(reason) {
    if (!reason) return null;
    if (reason.indexOf('already used by RGB') !== -1) {
      return { key: 'rgbTaken', vars: { color: reason.split(' ')[0] } };
    }
    if (reason.indexOf('this image is already RGB') === 0) return { key: 'rgbImage', vars: {} };
    if (reason === payout()) return { key: 'payout', vars: {} };
    if (reason === notYours()) return { key: 'notYours', vars: {} };
    if (reason.indexOf('already bases TOON') !== -1) return { key: 'toonMath', vars: {} };
    if (reason.indexOf('already in TOON') !== -1) return { key: 'toonSpent', vars: { kind: reason.split(' ')[0] } };
    return null;
  }

  function about() {
    return [
      'RGB. Each MATH id is used once per channel. R, G and B are separate, so an identical image is never minted twice. You don\'t need to own the MATH. It costs 0.03 ETH, and each channel\'s owner gets 0.01.',
      'MATH add. 0.002 ETH, with 0.001 to each input owner. A holder who reverts the 2300-gas payout is blocked.',
      'TOON. You must own the MATH, WORD, FACE and RGB. Each WORD, FACE and RGB can go into one TOON. The TOON id is the MATH id, so each MATH bases one TOON. No fee.',
    ];
  }

  return {
    rgbChannel: rgbChannel,
    rgbImage: rgbImage,
    toonPart: toonPart,
    payout: payout,
    notYours: notYours,
    mold: mold,
    about: about,
  };
});
