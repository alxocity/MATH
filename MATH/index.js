module.exports = async function (context, req) {
    const { id } = req.query;
    context.res = {
        body: {
            image_data: require('text-to-svg').loadSync().getSVG(id),
            external_url: `https://etherscan.io/token/0x6b4fccdd888bb6fd3934a9e49ef64dfd2c0d8e6d?a=${id}`,
            name: id
        }
    };
};