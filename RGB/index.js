const address = '0x9355fb9693fff9bb6f06721c82fe0b5f49e6c956';
const contract = new (new (require('web3'))('https://mainnet.infura.io/v3/c24754efadc94bb991951f94161f2c55')).eth.Contract([{
  inputs: [{ name: 'id', type: 'uint256' }],
  name: 'get',
  outputs: [{ name: 'r', type: 'uint256' }, { name: 'g', type: 'uint256' }, { name: 'b', type: 'uint256' }],
  type: 'function'
}], address);
module.exports = async function (context, req) {
  const { id } = req.query;
  const { r, g, b } = await contract.methods.get(id).call();
  const rBits = BigInt(r).toString(2).padStart(256, 0).replace(/1/g, 'f');
  const gBits = BigInt(g).toString(2).padStart(256, 0).replace(/1/g, 'f');
  const bBits = BigInt(b).toString(2).padStart(256, 0).replace(/1/g, 'f');
  let image_data = '<svg xmlns="http://www.w3.org/2000/svg" width="350" height="350">';
  for (let i = 0; i < 256; i++)
    image_data += `<rect x="${47 + 16 * (i % 16)}" y="${47 + 16 * Math.floor(i / 16)}" width="16" height="16" fill="#${rBits[i]}${gBits[i]}${bBits[i]}"/>`;
  image_data += '</svg>';
  context.res = {
    body: {
      image_data,
      external_url: `https://etherscan.io/token/${address}?a=${id}`,
      attributes: [{ trait_type: 'r', value: r }, { trait_type: 'g', value: g }, { trait_type: 'b', value: b }]
    }
  };
};