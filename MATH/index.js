module.exports = async function (context, req) {
    const { id } = req.query;
    context.res = {
        body: {
            image_data: `<svg width="350" height="350"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="${Math.ceil(350 / id.length)}px">${id}</text></svg>`,
            external_url: `https://etherscan.io/token/0x6b4fccdd888bb6fd3934a9e49ef64dfd2c0d8e6d?a=${id}`
        }
    };
};