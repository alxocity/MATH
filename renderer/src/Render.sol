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

    // Scratch table, one mstore per quartet. The table is shifted so mload(i)'s
    // last byte is the alphabet character.
    function b64(bytes memory data) internal pure returns (bytes memory result) {
        if (data.length == 0) return "";
        assembly {
            let len := mload(data)
            let outLen := shl(2, div(add(len, 2), 3))
            result := mload(0x40)
            mstore(0x1f, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef")
            mstore(0x3f, "ghijklmnopqrstuvwxyz0123456789+/")

            let ptr := add(result, 32)
            let end := add(ptr, outLen)
            let dataEnd := add(data, add(32, len))
            let saved := mload(dataEnd)
            mstore(dataEnd, 0)

            for {} 1 {} {
                data := add(data, 3)
                let v := mload(data)
                mstore8(0, mload(and(shr(18, v), 63)))
                mstore8(1, mload(and(shr(12, v), 63)))
                mstore8(2, mload(and(shr(6, v), 63)))
                mstore8(3, mload(and(v, 63)))
                mstore(ptr, mload(0))
                ptr := add(ptr, 4)
                if iszero(lt(ptr, end)) { break }
            }

            mstore(dataEnd, saved)
            // EVM div by zero is 0, which is the no-padding case.
            mstore(sub(ptr, div(2, mod(len, 3))), shl(240, 0x3d3d))
            mstore(result, outLen)
            mstore(end, 0)
            mstore(0x40, add(end, 32))
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

    // Azure: Number(n - 5).toString(16).padStart(6, "0"), for every uint256.
    function textHex(uint n) internal pure returns (bytes memory) {
        if (n < 5) {
            bytes memory s = "0000-0";
            s[5] = bytes1(uint8(53 - n));
            return s;
        }
        if (n < 1 << 53) return hexPad(n - 5, 6);
        (uint v, bool big) = round53(n);
        if (!big) (v, big) = round53(v - 5);
        if (big) return "10000000000000000000000000000000000000000000000000000000000000000";
        return hexPad(v, 6);
    }

    // Nearest float64 (ties to even). `big` means the value is 2**256.
    function round53(uint n) internal pure returns (uint v, bool big) {
        uint bits = bitlen(n);
        if (bits <= 53) return (n, false);
        uint shift = bits - 53;
        uint mant = n >> shift;
        uint half = uint(1) << (shift - 1);
        uint rest = n & ((uint(1) << shift) - 1);
        if (rest > half || (rest == half && (mant & 1) == 1)) mant += 1;
        if (mant == 1 << 53) {
            if (bits == 256) return (0, true);
            return (uint(1) << bits, false);
        }
        return (mant << shift, false);
    }

    function bitlen(uint n) internal pure returns (uint r) {
        assembly {
            if gt(shr(128, n), 0) {
                n := shr(128, n)
                r := 128
            }
            if gt(shr(64, n), 0) {
                n := shr(64, n)
                r := add(r, 64)
            }
            if gt(shr(32, n), 0) {
                n := shr(32, n)
                r := add(r, 32)
            }
            if gt(shr(16, n), 0) {
                n := shr(16, n)
                r := add(r, 16)
            }
            if gt(shr(8, n), 0) {
                n := shr(8, n)
                r := add(r, 8)
            }
            if gt(shr(4, n), 0) {
                n := shr(4, n)
                r := add(r, 4)
            }
            if gt(shr(2, n), 0) {
                n := shr(2, n)
                r := add(r, 2)
            }
            if gt(shr(1, n), 0) { r := add(r, 1) }
            r := add(r, 1)
        }
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

    // Left-aligned ascii of n (at most 3 digits) with the length in the low byte.
    function d32(uint n) internal pure returns (bytes32) {
        uint c1 = 48 + (n / 10) % 10;
        uint c2 = 48 + n % 10;
        if (n > 99) return bytes32(((48 + n / 100) << 248) | (c1 << 240) | (c2 << 232) | 3);
        if (n > 9) return bytes32((c1 << 248) | (c2 << 240) | 2);
        return bytes32((c2 << 248) | 1);
    }

    function xyTable(uint x0, uint step) private pure returns (bytes32[32] memory xy) {
        for (uint i; i < 16;) {
            xy[i] = d32(x0 + step * i);
            xy[i + 16] = d32(47 + step * i);
            unchecked { ++i; }
        }
    }

    // 16x16, one bit per channel. Same rects as the Azure functions.
    function pixels(uint r, uint g, uint b, uint x0, uint step) internal pure returns (bytes memory o) {
        bytes32 tail = step == 16
            ? bytes32('" width="16" height="16" fill="#')
            : bytes32('" width="12" height="12" fill="#');
        bytes32[32] memory xy = xyTable(x0, step);
        o = new bytes(256 * 58 + 64);
        assembly {
            let data := add(o, 32)
            let p := 0
            for { let i := 0 } lt(i, 256) { i := add(i, 1) } {
                let t := mload(add(xy, shl(5, and(i, 15))))
                mstore(add(data, p), '<rect x="')
                p := add(p, 9)
                mstore(add(data, p), t)
                p := add(p, and(t, 255))
                mstore(add(data, p), '" y="')
                p := add(p, 5)
                t := mload(add(xy, add(512, shl(5, shr(4, i)))))
                mstore(add(data, p), t)
                p := add(p, and(t, 255))
                mstore(add(data, p), tail)
                p := add(p, 32)
                t := sub(255, i)
                t := shl(248, add(48, mul(and(shr(t, r), 1), 54)))
                t := or(t, shl(240, add(48, mul(and(shr(sub(255, i), g), 1), 54))))
                t := or(t, shl(232, add(48, mul(and(shr(sub(255, i), b), 1), 54))))
                t := or(t, shl(208, 0x222f3e))
                mstore(add(data, p), t)
                p := add(p, 6)
            }
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

    function tokenJSON(uint id) public view returns (string memory) {
        NFT.ownerOf(id);
        return string(_json(id));
    }

    function tokenURI(uint id) external view returns (string memory) {
        return uri(bytes(tokenJSON(id)));
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

    function tokenJSON(uint id) public view returns (string memory) {
        NFT.ownerOf(id);
        (uint r, uint g, uint b) = DATA.get(id);
        bytes memory svg = abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="350" height="350">',
            pixels(r, g, b, 47, 16),
            "</svg>"
        );
        return string(
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

    function tokenURI(uint id) external view returns (string memory) {
        return uri(bytes(tokenJSON(id)));
    }
}

contract TOONRender is Render {
    IERC721 constant NFT = IERC721(0x026A7D72a448D0E44d441e55F746BF56B843aEDB);
    ITOON constant DATA = ITOON(0x026A7D72a448D0E44d441e55F746BF56B843aEDB);
    IWORD constant WORD = IWORD(0xAc1AEe5027FCC98d40a26588aC0841a44f53A8Fe);
    IFACE constant FACE = IFACE(0x91047Abf3cAb8da5A9515c8750Ab33B4f1560a7A);
    IRGB constant RGB = IRGB(0x9355Fb9693ffF9bB6f06721C82fe0B5F49E6c956);

    function tokenJSON(uint id) public view returns (string memory) {
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
        return string(
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

    function tokenURI(uint id) external view returns (string memory) {
        return uri(bytes(tokenJSON(id)));
    }
}
