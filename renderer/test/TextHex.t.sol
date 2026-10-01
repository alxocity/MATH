// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Render} from "../src/Render.sol";

contract TextHexTest is Render, Test {
    function _js(uint n) internal returns (string memory) {
        string[] memory cmd = new string[](3);
        cmd[0] = "node";
        cmd[1] = "test/jshex.js";
        cmd[2] = vm.toString(n);
        return vm.ffiString(cmd);
    }

    function test_text_hex_edges() public {
        uint chain = 115792089237316195423570985008687907853269984665640564039457584007913129635824;
        uint[8] memory ns = [uint(0), 4, 5, 2056, uint(1) << 32, uint(1) << 53, uint(1) << 55, type(uint256).max];
        for (uint i; i < ns.length; i++) assertEq(string(textHex(ns[i])), _js(ns[i]));
        assertEq(string(textHex(chain)), _js(chain));
    }

    /// forge-config: default.fuzz.runs = 32
    function test_fuzz_text_hex(uint n) public {
        assertEq(string(textHex(n)), _js(n));
    }
}
