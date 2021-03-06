module.exports = async function (context, req) {
  const { id } = req.query;
  const digits = Array.from(Array(10), (x, i) => (id.match(new RegExp(i, 'g')) || []).length);
  const sum = digits.reduce((sum, x, i) => sum + x * i, 0);
  const number = BigInt(id);
  const hex = number.toString(16).padStart(64, 0);
  const utf = k => hex.match(new RegExp(`.{${k / 4}}`, 'g')).map(x => `0x${x}` <= 0x10FFFF ? String.fromCodePoint(`0x${x}`) : '').map(x => JSON.stringify(x).length < 8 ? x : '').join('');
  const colorMax = BigInt(0xffffff);
  const colorNumber = number % (colorMax + 1n);
  const color = n => n.toString(16).padStart(6, 0);
  context.res = {
    body: {
      image_data: `<svg xmlns="http://www.w3.org/2000/svg" width="350" height="350"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="${Math.ceil(350 / id.length)}px" fill="#${color(colorNumber)}">${id}</text></svg>`,
      external_url: `https://etherscan.io/token/0x6b4fccdd888bb6fd3934a9e49ef64dfd2c0d8e6d?a=${id}`,
      description: [
        `0x${hex}`,
        number.toString(2).padStart(256, 0).replace(/0/g, '⬛').replace(/1/g, '⬜').match(/.{16}/g).join('\n'),
        utf(8),
        utf(16),
        utf(32)
      ].join('\n\n'),
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
          value: 'palindromic'
        }] : []),
        ...(id == id.split('').reverse().join('').replace(/6/g, '-').replace(/9/g, 6).replace(/-/g, 9).replace(/2|3|4|5|7/g, '') ? [{
          trait_type: 'fancy',
          value: 'strobogrammatic'
        }] : [])
      ],
      background_color: color(colorMax - colorNumber)
    }
  };
};
