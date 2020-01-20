module.exports = async function (context, req) {
  const { id } = req.query;
  const rgb = { r: '15297492', g: '15000000', b: '1097621870' };
  const r = BigInt(rgb.r).toString(2).padStart(256, 0);
  const g = BigInt(rgb.g).toString(2).padStart(256, 0);
  const b = BigInt(rgb.b).toString(2).padStart(256, 0);
  let image_data = '<svg xmlns="http://www.w3.org/2000/svg" width="350" height="350">';
  for (let i = 0; i < 256; i++)
    image_data += `<rect x="${47 + 16 * (i % 16)}" y="${47 + 16 * Math.floor(i / 16)}" width="16" height="16" fill="#${parseInt(r[i]) ? 'ff' : '00'}${parseInt(g[i]) ? 'ff' : '00'}${parseInt(b[i]) ? 'ff' : '00'}"/>`;
  image_data += '</svg>';
  context.res = {
    body: {
      image_data,
      external_url: `https://etherscan.io/token/0x9355fb9693fff9bb6f06721c82fe0b5f49e6c956?a=${id}`,
      attributes: [
        {
          trait_type: 'r',
          value: rgb.r
        },
        {
          trait_type: 'g',
          value: rgb.g
        },
        {
          trait_type: 'b',
          value: rgb.b
        }
      ]
    }
  };
};
