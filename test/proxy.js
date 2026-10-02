const http = require('http');
const { tokenJSON } = require('../proxy');

const math = '0xb3cA13A2722CAB48c8d9068bD67656efe2d5e376';
const rgb = '0x62FFe75cd9824A2e8855CbC055256De229B5b936';
const toon = '0x1E1a576e4186551e4DEdE58Ccc2DCC34697159Cb';
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };
let tests = 0;

const listen = handler => new Promise(resolve => {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1', () => resolve(server));
});

const stop = server => new Promise(resolve => {
  server.closeAllConnections();
  server.close(resolve);
});

(async () => {
  delete process.env.RPC_URL;
  process.env.RPC_URL = 'http://127.0.0.1:1';
  for (const id of ['0x1', '0b1', '01', '00', ' 1', '1 ', '', '1\n']) {
    const res = await tokenJSON(math, id);
    assert(res.status == 400 && res.body == '{"error":"bad id"}' && res.headers['Cache-Control'] == 'no-store', '400 ' + JSON.stringify(id));
    tests++;
  }
  for (const id of [undefined, '1'.repeat(80)]) {
    const res = await tokenJSON(math, id);
    assert(res.status == 400 && res.body == '{"error":"bad id"}', '400 ' + id);
    tests++;
  }
  delete process.env.RPC_URL;

  let server = await listen((req, res) => res.destroy());
  process.env.RPC_URL = `http://127.0.0.1:${server.address().port}`;
  let res = await tokenJSON(math, '1');
  assert(res.status == 502 && res.body == '{"error":"rpc"}' && res.headers['Cache-Control'] == 'no-store', '502 destroy');
  tests++;
  delete process.env.RPC_URL;
  await stop(server);

  server = await listen((req, res) => res.end('{"jsonrpc":"2.0","id":1,"error":{"code":-32603,"message":"boom"}}'));
  process.env.RPC_URL = `http://127.0.0.1:${server.address().port}`;
  res = await tokenJSON(math, '1');
  assert(res.status == 502 && res.body == '{"error":"rpc"}' && res.headers['Cache-Control'] == 'no-store', '502 rpc');
  tests++;
  delete process.env.RPC_URL;
  await stop(server);

  server = await listen(() => {});
  process.env.RPC_URL = `http://127.0.0.1:${server.address().port}`;
  res = await tokenJSON(math, '1');
  assert(res.status == 504 && res.body == '{"error":"timeout"}' && res.headers['Cache-Control'] == 'no-store', '504 ' + res.status + ' ' + res.body);
  tests++;
  delete process.env.RPC_URL;
  await stop(server);

  const cases = [
    ['MATH 1', math, '1', 200],
    ['RGB 100', rgb, '100', 200],
    ['TOON 1973', toon, '1973', 200],
    ['MATH 0', math, '0', 404]
  ];
  for (const [name, to, id, status] of cases) {
    res = await tokenJSON(to, id);
    assert(res.status == status, `${name} status ${res.status} ${res.body}`);
    assert(res.headers['Content-Type'] == 'application/json', `${name} content-type`);
    if (status != 200) {
      assert(res.headers['Cache-Control'] == 'no-store' && res.body == '{"error":"not found"}', `${name} 404`);
      console.log(name, res.status, res.body);
      tests++;
      continue;
    }
    assert(res.headers['Cache-Control'] == 'public, max-age=31536000, immutable', `${name} cache`);
    const body = JSON.parse(res.body);
    assert(body.image.startsWith('data:image/svg+xml;base64,'), `${name} image`);
    assert(!('image_data' in body) && !('external_url' in body), `${name} old fields`);
    const svg = Buffer.from(body.image.slice(body.image.indexOf(',') + 1), 'base64').toString();
    assert(svg.includes('viewBox="0 0 350 350"'), `${name} viewBox`);
    console.log(name, res.status, 'image', body.image.length, 'keys', Object.keys(body).join(','));
    if (name == 'MATH 1') assert(body.name == '1' && body.attributes.find(a => a.trait_type == 'digit_mean').value == 1, 'MATH 1 traits');
    if (name == 'RGB 100') assert(body.attributes.map(a => a.trait_type).join() == 'r,g,b', 'RGB traits');
    if (name == 'TOON 1973') assert(body.name && body.attributes.map(a => a.trait_type).join() == 'word,face,rgb' && svg.includes('</text>'), 'TOON traits');
    tests++;
  }
  const handler = require('../MATH/index');
  const context = {};
  await handler(context, { query: { id: '0' } });
  assert(context.res.status == 404 && context.res.body == '{"error":"not found"}', 'handler 404');
  tests++;
  const empty = {};
  await handler(empty, { query: { id: '' } });
  assert(empty.res.status == 400 && empty.res.body == '{"error":"bad id"}', 'handler empty');
  tests++;
  console.log(tests, 'ok');
})().catch(e => { console.error(e); process.exit(1); });
