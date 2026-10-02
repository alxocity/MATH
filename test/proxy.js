const { tokenJSON } = require('../proxy');

const math = '0xb3cA13A2722CAB48c8d9068bD67656efe2d5e376';
const rgb = '0x62FFe75cd9824A2e8855CbC055256De229B5b936';
const toon = '0x1E1a576e4186551e4DEdE58Ccc2DCC34697159Cb';

const assert = (ok, msg) => { if (!ok) throw new Error(msg); };

(async () => {
  const cases = [
    ['MATH 1', math, '1', 200],
    ['RGB 100', rgb, '100', 200],
    ['TOON 1973', toon, '1973', 200],
    ['MATH 0', math, '0', 404]
  ];
  for (const [name, to, id, status] of cases) {
    const res = await tokenJSON(to, id);
    assert(res.status == status, `${name} status ${res.status}`);
    assert(res.headers['Content-Type'] == 'application/json', `${name} content-type`);
    if (status != 200) {
      assert(res.headers['Cache-Control'] == 'no-store', `${name} cache`);
      console.log(name, res.status);
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
  }
  const handler = require('../MATH/index');
  const context = {};
  await handler(context, { query: { id: '0' } });
  assert(context.res.status == 404, 'handler 404');
  console.log('ok');
})().catch(e => { console.error(e); process.exit(1); });
