const web3 = new (require('web3'))('https://mainnet.infura.io/v3/c24754efadc94bb991951f94161f2c55');
const address = '0x026a7d72a448d0e44d441e55f746bf56b843aedb';
const contract = new web3.eth.Contract([{
  inputs: [{ name: 'id', type: 'uint256' }],
  name: 'get',
  outputs: [{ name: 'word', type: 'uint256' }, { name: 'face', type: 'uint256' }, { name: 'rgb', type: 'uint256' }],
  type: 'function'
}], address);
const wordContract = new web3.eth.Contract([{
  inputs: [{ name: 'id', type: 'uint256' }],
  name: 'getWord',
  outputs: [{ name: 'word', type: 'string' }],
  type: 'function'
}], '0xac1aee5027fcc98d40a26588ac0841a44f53a8fe');
const faceContract = new web3.eth.Contract([{
  inputs: [{ name: 'id', type: 'uint256' }],
  name: 'getFace',
  outputs: [{ name: 'face', type: 'string' }],
  type: 'function'
}], '0x91047abf3cab8da5a9515c8750ab33b4f1560a7a');
const rgbContract = new web3.eth.Contract([{
  inputs: [{ name: 'id', type: 'uint256' }],
  name: 'get',
  outputs: [{ name: 'r', type: 'uint256' }, { name: 'g', type: 'uint256' }, { name: 'b', type: 'uint256' }],
  type: 'function'
}], '0x9355fb9693fff9bb6f06721c82fe0b5f49e6c956');
module.exports = async function (context, req) {
  const { id } = req.query;
  const { word, face, rgb } = await contract.methods.get(id).call();
  const name = await wordContract.methods.getWord(word).call();
  const faceValue = await faceContract.methods.getFace(face).call();
  const { r, g, b } = await rgbContract.methods.get(rgb).call();
  const bits = x => BigInt(x).toString(2).padStart(256, 0).replace(/1/g, 'f');
  const rBits = bits(r), gBits = bits(g), bBits = bits(b);
  context.res = {
    body: {
      image_data: `<svg xmlns="http://www.w3.org/2000/svg" width="350" height="350">${Array(256).fill().reduce((a, _, i) => `${a}<rect x="${79 + 12 * (i % 16)}" y="${47 + 12 * Math.floor(i / 16)}" width="12" height="12" fill="#${rBits[i]}${gBits[i]}${bBits[i]}"/>`, '')}<text x="50%" y="271" dominant-baseline="middle" text-anchor="middle" font-size="72px">${faceValue}</text></svg>`,
      external_url: `https://etherscan.io/token/${address}?a=${id}`,
      name,
      attributes: [{ trait_type: 'word', value: word }, { trait_type: 'face', value: face }, { trait_type: 'rgb', value: rgb }]
    }
  };
};