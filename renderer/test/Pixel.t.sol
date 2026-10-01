// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Render} from "../src/Render.sol";

contract PixelTest is Render, Test {
    function test_fuzz_pixels(uint r, uint g, uint b, bool wide) public pure {
        uint x0 = wide ? 47 : 79;
        uint step = wide ? 16 : 12;
        assertEq(pixels(r, g, b, x0, step), oldPixels(r, g, b, x0, step));
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

    // Previous pixels(), kept so the assembly rewrite stays byte-identical.
    function oldPixels(uint r, uint g, uint b, uint x0, uint step) internal pure returns (bytes memory o) {
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
}
