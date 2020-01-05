module.exports = async function (context, req) {
    const { id } = req.query;
    context.res = {
        body: {
            image_data: `<svg width="350" height="350"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="${Math.ceil(350 / id.length)}px">${id}</text></svg>`,
            external_url: `https://etherscan.io/token/0x6b4fccdd888bb6fd3934a9e49ef64dfd2c0d8e6d?a=${id}`,
            attributes: [
                {
                    trait_type: "digit_count",
                    value: id.length
                },
                {
                    trait_type: "0_count",
                    value: (id.match(/0/g) || []).length
                },
                {
                    trait_type: "1_count",
                    value: (id.match(/1/g) || []).length
                },
                {
                    trait_type: "2_count",
                    value: (id.match(/2/g) || []).length
                },
                {
                    trait_type: "3_count",
                    value: (id.match(/3/g) || []).length
                },
                {
                    trait_type: "4_count",
                    value: (id.match(/4/g) || []).length
                },
                {
                    trait_type: "5_count",
                    value: (id.match(/5/g) || []).length
                },
                {
                    trait_type: "6_count",
                    value: (id.match(/6/g) || []).length
                },
                {
                    trait_type: "7_count",
                    value: (id.match(/7/g) || []).length
                },
                {
                    trait_type: "8_count",
                    value: (id.match(/8/g) || []).length
                },
                {
                    trait_type: "9_count",
                    value: (id.match(/9/g) || []).length
                }
            ]
        }
    };
};