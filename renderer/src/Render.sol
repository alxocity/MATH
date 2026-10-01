// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

// Companion metadata for the frozen MATH / RGB / TOON contracts.
// No owner, no setters. A bad render is fixed by deploying a new one.

interface IERC721 {
    function ownerOf(uint id) external view returns (address);
}

interface IRGB {
    function get(uint id) external view returns (uint r, uint g, uint b);
}

interface ITOON {
    function get(uint id) external view returns (uint word, uint face, uint rgb);
}

interface IWORD {
    function getWord(uint id) external view returns (string memory);
}

interface IFACE {
    function getFace(uint id) external view returns (string memory);
    function getTextColor(uint id) external view returns (uint);
    function getBackgroundColor(uint id) external view returns (uint);
}

abstract contract Render {
    function uri(bytes memory json) internal pure returns (string memory) {
        return string(abi.encodePacked("data:application/json;base64,", b64(json)));
    }

    function image(bytes memory svg) internal pure returns (bytes memory) {
        return abi.encodePacked("data:image/svg+xml;base64,", b64(svg));
    }

    // Assembly: a Solidity loop over a 15KB SVG is too slow for eth_call.
    function b64(bytes memory data) internal pure returns (bytes memory result) {
        uint len = data.length;
        if (len == 0) return "";
        result = new bytes(4 * ((len + 2) / 3));
        assembly {
            let alpha := mload(0x40)
            mstore(0x40, add(alpha, 64))
            mstore(alpha, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef")
            mstore(add(alpha, 32), "ghijklmnopqrstuvwxyz0123456789+/")

            let src := add(data, 32)
            let dst := add(result, 32)
            let end := add(src, sub(len, mod(len, 3)))

            for {} lt(src, end) { src := add(src, 3) } {
                let n := shr(232, mload(src))
                mstore8(dst, byte(0, mload(add(alpha, shr(18, n)))))
                mstore8(add(dst, 1), byte(0, mload(add(alpha, and(shr(12, n), 63)))))
                mstore8(add(dst, 2), byte(0, mload(add(alpha, and(shr(6, n), 63)))))
                mstore8(add(dst, 3), byte(0, mload(add(alpha, and(n, 63)))))
                dst := add(dst, 4)
            }

            let left := mod(len, 3)
            if eq(left, 1) {
                let n := byte(0, mload(src))
                mstore8(dst, byte(0, mload(add(alpha, shr(2, n)))))
                mstore8(add(dst, 1), byte(0, mload(add(alpha, shl(4, and(n, 3))))))
                mstore8(add(dst, 2), 0x3d)
                mstore8(add(dst, 3), 0x3d)
            }
            if eq(left, 2) {
                let n := shr(240, mload(src))
                mstore8(dst, byte(0, mload(add(alpha, shr(10, n)))))
                mstore8(add(dst, 1), byte(0, mload(add(alpha, and(shr(4, n), 63)))))
                mstore8(add(dst, 2), byte(0, mload(add(alpha, shl(2, and(n, 15))))))
                mstore8(add(dst, 3), 0x3d)
            }
        }
    }

    function dec(uint n) internal pure returns (bytes memory) {
        if (n == 0) return "0";
        uint j = n;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory b = new bytes(len);
        while (n != 0) {
            len--;
            b[len] = bytes1(uint8(48 + (n % 10)));
            n /= 10;
        }
        return b;
    }

    // JS Number#toString(16).padStart(width, "0"), for values that fit.
    function hexPad(uint n, uint width) internal pure returns (bytes memory) {
        bytes16 H = "0123456789abcdef";
        uint len;
        uint x = n;
        if (x == 0) len = 1;
        else {
            while (x != 0) {
                len++;
                x >>= 4;
            }
        }
        if (len < width) len = width;
        bytes memory b = new bytes(len);
        for (uint i = len; i != 0;) {
            i--;
            b[i] = H[n & 0xf];
            n >>= 4;
        }
        return b;
    }

    // Azure: Number(n - 5).toString(16).padStart(6, "0").
    // ChainFaces colors are either small or a uint underflow next to 2**256,
    // and Number() of those underflows is 2**256.
    function textHex(uint n) internal pure returns (bytes memory) {
        if (n < 5) {
            bytes memory s = "0000-0";
            s[5] = bytes1(uint8(53 - n));
            return s;
        }
        if (n > 0xffffffff) {
            return "10000000000000000000000000000000000000000000000000000000000000000";
        }
        return hexPad(n - 5, 6);
    }

    // Azure clamps a background above 0xd8b49f to white before formatting.
    function toneHex(uint n) internal pure returns (bytes memory) {
        if (n > 0xd8b49f) n = 0xffffff;
        return hexPad(n, 6);
    }

    // Six-decimal digit_mean. Exact when the fraction terminates; otherwise
    // rounded, not the full IEEE string JSON.stringify prints.
    function mean(uint sum, uint len) internal pure returns (bytes memory) {
        uint ip = sum / len;
        uint rem = sum % len;
        if (rem == 0) return dec(ip);
        uint scaled = (rem * 10000000) / len;
        uint frac = scaled / 10;
        if (scaled % 10 >= 5) frac++;
        if (frac >= 1000000) return dec(ip + 1);
        bytes memory f = new bytes(6);
        for (uint i = 6; i != 0;) {
            i--;
            f[i] = bytes1(uint8(48 + (frac % 10)));
            frac /= 10;
        }
        uint width = 6;
        while (width > 1 && f[width - 1] == bytes1("0")) width--;
        assembly {
            mstore(f, width)
        }
        return abi.encodePacked(dec(ip), ".", f);
    }

    function w(bytes memory o, uint p, bytes32 s, uint n) internal pure returns (uint) {
        assembly {
            mstore(add(o, add(32, p)), s)
        }
        return p + n;
    }

    function wDec(bytes memory o, uint p, uint n) internal pure returns (uint) {
        if (n == 0) {
            o[p] = "0";
            return p + 1;
        }
        uint j = n;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        uint end = p + len;
        while (n != 0) {
            end--;
            o[end] = bytes1(uint8(48 + (n % 10)));
            n /= 10;
        }
        return p + len;
    }

    // 16x16, one bit per channel. Same rects as the Azure functions.
    function pixels(uint r, uint g, uint b, uint x0, uint step) internal pure returns (bytes memory o) {
        bytes32 tail = step == 16
            ? bytes32('" width="16" height="16" fill="#')
            : bytes32('" width="12" height="12" fill="#');
        o = new bytes(256 * 58 + 64);
        uint p;
        for (uint i; i < 256; i++) {
            uint shift = 255 - i;
            p = w(o, p, '<rect x="', 9);
            p = wDec(o, p, x0 + step * (i & 15));
            p = w(o, p, '" y="', 5);
            p = wDec(o, p, 47 + step * (i >> 4));
            p = w(o, p, tail, 32);
            o[p] = (r >> shift) & 1 == 1 ? bytes1("f") : bytes1("0");
            o[p + 1] = (g >> shift) & 1 == 1 ? bytes1("f") : bytes1("0");
            o[p + 2] = (b >> shift) & 1 == 1 ? bytes1("f") : bytes1("0");
            p += 3;
            p = w(o, p, '"/>', 3);
        }
        assembly {
            mstore(o, p)
        }
    }

    function xml(string memory s) internal pure returns (bytes memory) {
        bytes memory b = bytes(s);
        bytes memory o = new bytes(b.length * 5 + 32);
        uint p;
        for (uint i; i < b.length; i++) {
            bytes1 c = b[i];
            if (c == "&") p = w(o, p, "&amp;", 5);
            else if (c == "<") p = w(o, p, "&lt;", 4);
            else if (c == ">") p = w(o, p, "&gt;", 4);
            else o[p++] = c;
        }
        assembly {
            mstore(o, p)
        }
        return o;
    }

    function jesc(string memory s) internal pure returns (bytes memory) {
        bytes memory b = bytes(s);
        bytes memory o = new bytes(b.length * 6 + 32);
        uint p;
        bytes16 H = "0123456789abcdef";
        for (uint i; i < b.length; i++) {
            bytes1 c = b[i];
            if (c == '"' || c == "\\") {
                o[p++] = "\\";
                o[p++] = c;
            } else if (c == "\n") {
                o[p++] = "\\";
                o[p++] = "n";
            } else if (c == "\r") {
                o[p++] = "\\";
                o[p++] = "r";
            } else if (c == "\t") {
                o[p++] = "\\";
                o[p++] = "t";
            } else if (uint8(c) < 0x20) {
                p = w(o, p, "\\u00", 4);
                o[p++] = H[uint8(c) >> 4];
                o[p++] = H[uint8(c) & 0xf];
            } else {
                o[p++] = c;
            }
        }
        assembly {
            mstore(o, p)
        }
        return o;
    }

    // 16x16 of the id, ⬛/⬜, with newlines already escaped for JSON.
    function bitmapJson(uint id) internal pure returns (bytes memory) {
        bytes memory o = new bytes(16 * 48 + 30);
        uint p;
        for (uint i; i < 256; i++) {
            bytes3 cell = (id >> (255 - i)) & 1 == 1 ? bytes3(hex"e2ac9c") : bytes3(hex"e2ac9b");
            o[p] = cell[0];
            o[p + 1] = cell[1];
            o[p + 2] = cell[2];
            p += 3;
            if ((i & 15) == 15 && i != 255) {
                o[p++] = "\\";
                o[p++] = "n";
            }
        }
        return o;
    }
}

contract MATHRender is Render {
    IERC721 constant NFT = IERC721(0x6B4fccdd888Bb6fD3934A9e49eF64dfd2c0D8e6D);

    function tokenURI(uint id) external view returns (string memory) {
        NFT.ownerOf(id);
        return uri(_json(id));
    }

    function _json(uint id) internal pure returns (bytes memory) {
        bytes memory digits = dec(id);
        uint n = digits.length;
        uint[10] memory c;
        uint sum;
        bool pal = true;
        bool stro = true;
        for (uint i; i < n; i++) {
            uint d = uint8(digits[i]) - 48;
            c[d]++;
            sum += d;
            uint e = uint8(digits[n - 1 - i]) - 48;
            if (d != e) pal = false;
            uint rot = e == 6 ? 9 : e == 9 ? 6 : e;
            if (rot != d || (e > 1 && e != 6 && e != 8 && e != 9)) stro = false;
        }
        uint color = id % 0x1000000;
        bytes memory svg = abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="350" height="350"><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="',
            dec((349 + n) / n),
            'px" fill="#',
            hexPad(color, 6),
            '">',
            digits,
            "</text></svg>"
        );
        bytes memory attrs = _attrs(c, n, sum, id, pal, stro);
        return abi.encodePacked(
            '{"name":"',
            digits,
            '","description":"0x',
            hexPad(id, 64),
            "\\n\\n",
            bitmapJson(id),
            '","image":"',
            image(svg),
            '","attributes":',
            attrs,
            ',"background_color":"',
            hexPad(0xffffff - color, 6),
            '"}'
        );
    }

    function _attrs(uint[10] memory c, uint n, uint sum, uint id, bool pal, bool stro)
        internal
        pure
        returns (bytes memory a)
    {
        for (uint i; i < 10; i++) {
            a = abi.encodePacked(
                a,
                i == 0 ? bytes("") : bytes(","),
                '{"trait_type":"',
                dec(i),
                '_count","value":',
                dec(c[i]),
                "}"
            );
        }
        a = abi.encodePacked(
            "[",
            a,
            ',{"trait_type":"digit_count","value":',
            dec(n),
            '},{"trait_type":"digit_mean","value":',
            mean(sum, n),
            '},{"trait_type":"digit_sum","value":',
            dec(sum),
            '},{"trait_type":"parity","value":"',
            id % 2 == 0 ? bytes("even") : bytes("odd"),
            '"}'
        );
        if (pal) a = abi.encodePacked(a, ',{"trait_type":"fancy","value":"palindromic"}');
        if (stro) a = abi.encodePacked(a, ',{"trait_type":"fancy","value":"strobogrammatic"}');
        return abi.encodePacked(a, "]");
    }
}

contract RGBRender is Render {
    IERC721 constant NFT = IERC721(0x9355Fb9693ffF9bB6f06721C82fe0B5F49E6c956);
    IRGB constant DATA = IRGB(0x9355Fb9693ffF9bB6f06721C82fe0B5F49E6c956);

    function tokenURI(uint id) external view returns (string memory) {
        NFT.ownerOf(id);
        (uint r, uint g, uint b) = DATA.get(id);
        bytes memory svg = abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="350" height="350">',
            pixels(r, g, b, 47, 16),
            "</svg>"
        );
        return uri(
            abi.encodePacked(
                '{"image":"',
                image(svg),
                '","attributes":[{"trait_type":"r","value":"',
                dec(r),
                '"},{"trait_type":"g","value":"',
                dec(g),
                '"},{"trait_type":"b","value":"',
                dec(b),
                '"}]}'
            )
        );
    }
}

contract TOONRender is Render {
    IERC721 constant NFT = IERC721(0x026A7D72a448D0E44d441e55F746BF56B843aEDB);
    ITOON constant DATA = ITOON(0x026A7D72a448D0E44d441e55F746BF56B843aEDB);
    IWORD constant WORD = IWORD(0xAc1AEe5027FCC98d40a26588aC0841a44f53A8Fe);
    IFACE constant FACE = IFACE(0x91047Abf3cAb8da5A9515c8750Ab33B4f1560a7A);
    IRGB constant RGB = IRGB(0x9355Fb9693ffF9bB6f06721C82fe0B5F49E6c956);

    function tokenURI(uint id) external view returns (string memory) {
        NFT.ownerOf(id);
        (uint word, uint face, uint rgb) = DATA.get(id);
        (uint r, uint g, uint b) = RGB.get(rgb);
        bytes memory glyph = xml(FACE.getFace(face));
        bytes memory svg = abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="350" height="350"><rect x="47" y="235" width="256" height="72" fill="#',
            toneHex(FACE.getBackgroundColor(face)),
            '"/>',
            pixels(r, g, b, 79, 12),
            '<text x="50%" y="271" dominant-baseline="middle" text-anchor="middle" font-size="72px" fill="#',
            textHex(FACE.getTextColor(face)),
            '">',
            glyph,
            "</text></svg>"
        );
        return uri(
            abi.encodePacked(
                '{"name":"',
                jesc(WORD.getWord(word)),
                '","image":"',
                image(svg),
                '","attributes":[{"trait_type":"word","value":"',
                dec(word),
                '"},{"trait_type":"face","value":"',
                dec(face),
                '"},{"trait_type":"rgb","value":"',
                dec(rgb),
                '"}]}'
            )
        );
    }
}
