// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {MATHRender, RGBRender, TOONRender} from "../src/Render.sol";

contract ForkTest is Test {
    using stdJson for string;

    // Used only with an archive MAINNET_RPC_URL. publicnode 403s on old blocks.
    uint constant BLOCK = 26098697;

    MATHRender math;
    RGBRender rgb;
    TOONRender toon;

    function setUp() public {
        if (vm.envExists("MAINNET_RPC_URL")) {
            vm.createSelectFork(vm.envString("MAINNET_RPC_URL"), BLOCK);
        } else {
            vm.createSelectFork("https://ethereum.publicnode.com");
        }
        math = new MATHRender();
        rgb = new RGBRender();
        toon = new TOONRender();
    }

    function _cmp(string memory uri, string memory fixture) internal {
        string[] memory cmd = new string[](4);
        cmd[0] = "python3";
        cmd[1] = "test/compare.py";
        cmd[2] = uri;
        cmd[3] = fixture;
        assertEq(string(vm.ffi(cmd)), "ok");
    }

    function test_math_on_chain() public {
        _cmp(math.tokenURI(1), "test/fixtures/math/1.json");
        _cmp(math.tokenURI(650), "test/fixtures/math/650.json");
        _cmp(math.tokenURI(1000000000000000000), "test/fixtures/math/1000000000000000000.json");
    }

    function test_rgb_on_chain() public {
        _cmp(rgb.tokenURI(1), "test/fixtures/rgb/1.json");
        _cmp(rgb.tokenURI(2), "test/fixtures/rgb/2.json");
        _cmp(rgb.tokenURI(50), "test/fixtures/rgb/50.json");
        _cmp(rgb.tokenURI(100), "test/fixtures/rgb/100.json");
        _cmp(rgb.tokenURI(187), "test/fixtures/rgb/187.json");
    }

    function test_toon_on_chain() public {
        _cmp(toon.tokenURI(1973), "test/fixtures/toon/1973.json");
        _cmp(toon.tokenURI(505), "test/fixtures/toon/505.json");
        _cmp(toon.tokenURI(1993), "test/fixtures/toon/1993.json");
        _cmp(toon.tokenURI(2502), "test/fixtures/toon/2502.json");
        _cmp(toon.tokenURI(101010), "test/fixtures/toon/101010.json");
        _cmp(toon.tokenURI(125467), "test/fixtures/toon/125467.json");
    }

    function test_token_json() public {
        assertEq(_jsonOf(math.tokenURI(1)), math.tokenJSON(1));
        assertEq(_jsonOf(rgb.tokenURI(100)), rgb.tokenJSON(100));
        assertEq(_jsonOf(toon.tokenURI(1973)), toon.tokenJSON(1973));
        vm.expectRevert(bytes("ERC721: owner query for nonexistent token"));
        math.tokenJSON(0);
        vm.expectRevert(bytes("ERC721: owner query for nonexistent token"));
        rgb.tokenJSON(0);
        vm.expectRevert(bytes("ERC721: owner query for nonexistent token"));
        toon.tokenJSON(0);
    }

    function test_token_svg() public {
        assertEq(_svgOf(math.tokenJSON(1)), math.tokenSVG(1));
        assertEq(_svgOf(rgb.tokenJSON(100)), rgb.tokenSVG(100));
        assertEq(_svgOf(toon.tokenJSON(1973)), toon.tokenSVG(1973));
        vm.expectRevert(bytes("ERC721: owner query for nonexistent token"));
        math.tokenSVG(0);
        vm.expectRevert(bytes("ERC721: owner query for nonexistent token"));
        rgb.tokenSVG(0);
        vm.expectRevert(bytes("ERC721: owner query for nonexistent token"));
        toon.tokenSVG(0);
    }

    function _svgOf(string memory jsonStr) internal returns (string memory) {
        string[] memory cmd = new string[](4);
        cmd[0] = "python3";
        cmd[1] = "-c";
        cmd[2] = "import sys,json,base64; u=json.loads(sys.argv[1])['image']; p='data:image/svg+xml;base64,'; sys.stdout.write(base64.b64decode(u[len(p):]).decode())";
        cmd[3] = jsonStr;
        return vm.ffiString(cmd);
    }

    function _jsonOf(string memory uri) internal returns (string memory) {
        string[] memory cmd = new string[](4);
        cmd[0] = "python3";
        cmd[1] = "-c";
        cmd[2] = "import sys,base64; u=sys.argv[1]; p='data:application/json;base64,'; sys.stdout.write(base64.b64decode(u[len(p):]).decode())";
        cmd[3] = uri;
        return vm.ffiString(cmd);
    }

    function test_missing_reverts_like_erc721() public {
        vm.expectRevert(bytes("ERC721: owner query for nonexistent token"));
        math.tokenURI(0);
        vm.expectRevert(bytes("ERC721: owner query for nonexistent token"));
        rgb.tokenURI(0);
        // 0 can never be minted. TOON 1 is only unminted today, so it is not asserted here.
        vm.expectRevert(bytes("ERC721: owner query for nonexistent token"));
        toon.tokenURI(0);
    }

    function test_svg_is_self_contained() public view {
        _svgOk(math.tokenSVG(1));
        _svgOk(math.tokenSVG(650));
        _svgOk(rgb.tokenSVG(1));
        _svgOk(rgb.tokenSVG(100));
        _svgOk(toon.tokenSVG(1973));
        _svgOk(toon.tokenSVG(505));
    }

    // The XML namespace is an identifier, not a fetch. Anything else with a URL is rejected.
    function _svgOk(string memory svg) internal pure {
        bytes memory b = bytes(svg);
        assertTrue(_has(b, bytes('viewBox="0 0 350 350"')));
        assertTrue(_has(b, bytes('shape-rendering="crispEdges"')));
        assertTrue(_has(b, bytes('xmlns="http://www.w3.org/2000/svg"')));
        assertEq(_count(b, bytes("http")), 1);
        assertFalse(_has(b, bytes("https")));
        assertFalse(_has(b, bytes("@import")));
        assertFalse(_has(b, bytes("href")));
        uint u = _find(b, bytes("url("), 0);
        while (u != type(uint256).max) {
            uint k = u + 4;
            while (k < b.length && (b[k] == " " || b[k] == "'" || b[k] == '"')) k++;
            assertTrue(k < b.length && b[k] == "#");
            u = _find(b, bytes("url("), u + 4);
        }
    }

    function _has(bytes memory b, bytes memory needle) internal pure returns (bool) {
        return _find(b, needle, 0) != type(uint256).max;
    }

    function _count(bytes memory b, bytes memory needle) internal pure returns (uint n) {
        uint i;
        while (true) {
            uint j = _find(b, needle, i);
            if (j == type(uint256).max) break;
            n++;
            i = j + needle.length;
        }
    }

    function _find(bytes memory b, bytes memory needle, uint start) internal pure returns (uint) {
        if (needle.length == 0 || b.length < needle.length || start > b.length - needle.length) {
            return type(uint256).max;
        }
        for (uint i = start; i <= b.length - needle.length; i++) {
            bool ok = true;
            for (uint j; j < needle.length; j++) {
                if (b[i + j] != needle[j]) {
                    ok = false;
                    break;
                }
            }
            if (ok) return i;
        }
        return type(uint256).max;
    }

    function test_gas() public view {
        math.tokenSVG(1);
        uint mathSvg = vm.lastFrameGas().gasTotalUsed;
        math.tokenURI(1);
        uint mathGas = vm.lastFrameGas().gasTotalUsed;
        rgb.tokenSVG(100);
        uint rgbSvg = vm.lastFrameGas().gasTotalUsed;
        rgb.tokenURI(100);
        uint rgbGas = vm.lastFrameGas().gasTotalUsed;
        toon.tokenSVG(1973);
        uint toonSvg = vm.lastFrameGas().gasTotalUsed;
        toon.tokenURI(1973);
        uint toonGas = vm.lastFrameGas().gasTotalUsed;
        console2.log("block", block.number);
        console2.log("svg MATH", mathSvg);
        console2.log("render MATH", mathGas);
        console2.log("svg RGB", rgbSvg);
        console2.log("render RGB", rgbGas);
        console2.log("svg TOON", toonSvg);
        console2.log("render TOON", toonGas);
        // Generous eth_call ceiling, plus headroom over the measured figures in the README.
        assertLt(mathGas, 10_000_000);
        assertLt(rgbGas, 10_000_000);
        assertLt(toonGas, 10_000_000);
        assertLt(mathGas, 450_000);
        assertLt(rgbGas, 2_800_000);
        assertLt(toonGas, 2_800_000);
    }

    function test_azure_answers_for_unminted_ids() public view {
        _azureHasImage("test/fixtures/math/0.json");
        _azureHasImage("test/fixtures/rgb/0.json");
        _azureHasImage("test/fixtures/rgb/188.json");
        _azureHasImage("test/fixtures/toon/1.json");
    }

    function _azureHasImage(string memory path) internal view {
        string memory body = vm.readFile(path);
        assertGt(bytes(body.readString(".image_data")).length, 100);
    }

    function _txGas(bytes memory init, uint frame) internal pure returns (uint) {
        uint zeros;
        for (uint i; i < init.length; i++) if (init[i] == 0) zeros++;
        // 21000 base + calldata (4 per zero byte, 16 otherwise) + the create frame.
        return 21000 + zeros * 4 + (init.length - zeros) * 16 + frame;
    }

    function test_deploy_gas() public {
        new MATHRender();
        uint mathDeploy = _txGas(type(MATHRender).creationCode, vm.lastFrameGas().gasTotalUsed);
        new RGBRender();
        uint rgbDeploy = _txGas(type(RGBRender).creationCode, vm.lastFrameGas().gasTotalUsed);
        new TOONRender();
        uint toonDeploy = _txGas(type(TOONRender).creationCode, vm.lastFrameGas().gasTotalUsed);
        console2.log("deploy MATH", mathDeploy);
        console2.log("deploy RGB", rgbDeploy);
        console2.log("deploy TOON", toonDeploy);
        console2.log("deploy sum", mathDeploy + rgbDeploy + toonDeploy);
        console2.log("runtime MATH", type(MATHRender).runtimeCode.length);
        console2.log("runtime RGB", type(RGBRender).runtimeCode.length);
        console2.log("runtime TOON", type(TOONRender).runtimeCode.length);
    }
}
