module.exports = async function (context, req) {
  const { id } = req.query;
  const digits = Array.from(Array(10), (x, i) => (id.match(new RegExp(i, 'g')) || []).length);
  const sum = digits.reduce((sum, x, i) => sum + x * i, 0);
  const number = BigInt(id);
  const colorMax = BigInt('0xffffff');
  const colorNumber = number % (colorMax + 1n);
  const color = n => n.toString(16).padStart(6, '0');
  context.res = {
    body: {
      image_data: `<svg xmlns="http://www.w3.org/2000/svg" width="350" height="350"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="${Math.ceil(350 / id.length)}px" fill="#${color(colorNumber)}">${id}</text></svg>`,
      external_url: `https://etherscan.io/token/0x6b4fccdd888bb6fd3934a9e49ef64dfd2c0d8e6d?a=${id}`,
      description: number.toString(2).padStart(256, '0'),
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
        },
        {
          trait_type: 'parity',
          value: number % 2n ? 'odd' : 'even'
        },
        ...(id == id.split('').reverse().join('') ? [{
          trait_type: 'fancy',
          value: 'palindrome'
        }] : [])
      ],
      background_color: color(colorMax - colorNumber)
    }
  };
};
