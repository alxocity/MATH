module.exports = async function (context, req) {
  const { id } = req.query;
  const digits = Array.from(Array(10), (x, i) => (id.match(new RegExp(i, 'g')) || []).length);
  const sum = digits.reduce((sum, x, i) => sum + x * i, 0);
  const bigInt = BigInt(id);
  context.res = {
    body: {
      image_data: `<svg width="350" height="350"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="${Math.ceil(350 / id.length)}px">${id}</text></svg>`,
      external_url: `https://etherscan.io/token/0x6b4fccdd888bb6fd3934a9e49ef64dfd2c0d8e6d?a=${id}`,
      description: bigInt.toString(2).padStart(256, '0'),
      name: id,
      attributes: [
        ...Array.from(digits, (value, i) => ({ trait_type: `${i}_count`, value })),
        {
          trait_type: 'digit_count',
          value: id.length
        },
        {
          trait_type: 'digit_mean',
          value: sum / id.length
        },
        {
          trait_type: 'digit_sum',
          value: sum
        }
      ]
    }
  };
};