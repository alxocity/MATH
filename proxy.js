const reply = (status, body, cache) => ({
  status,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': cache || 'no-store'
  },
  body: status == 200 ? body : JSON.stringify({ error: body })
});

const decode = hex => {
  const h = hex.replace(/^0x/, '');
  const o = Number(BigInt('0x' + h.slice(0, 64))) * 2;
  const n = Number(BigInt('0x' + h.slice(o, o + 64)));
  return Buffer.from(h.slice(o + 64, o + 64 + n * 2), 'hex').toString();
};

async function tokenJSON(to, id) {
  if (typeof id != 'string' || !/^[0-9]+$/.test(id) || /^0\d/.test(id)) return reply(400, 'bad id');
  const n = BigInt(id);
  if (n >> 256n) return reply(400, 'bad id');
  let out;
  try {
    const res = await fetch(process.env.RPC_URL || 'https://ethereum.publicnode.com', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to, data: '0x8f7bb179' + n.toString(16).padStart(64, '0') }, 'latest']
      }),
      signal: AbortSignal.timeout(10000)
    });
    out = await res.json();
  } catch (e) {
    return reply(e.name == 'TimeoutError' ? 504 : 502, e.name == 'TimeoutError' ? 'timeout' : 'rpc');
  }
  if (out.error) {
    const data = out.error.data || '';
    const revert = out.error.code == 3 || /^0x08c379a0/i.test(data) || /revert/i.test(out.error.message || '');
    return reply(revert ? 404 : 502, revert ? 'not found' : 'rpc');
  }
  try {
    return reply(200, decode(out.result), 'public, max-age=31536000, immutable');
  } catch {
    return reply(502, 'rpc');
  }
}

module.exports = async (context, req, to) => {
  context.res = await tokenJSON(to, req.query && req.query.id);
};
module.exports.tokenJSON = tokenJSON;
