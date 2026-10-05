// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {MATHRender, IERC721} from "../src/Render.sol";
import {Py} from "./Py.sol";

contract MathTest is Py {
    MATHRender math = new MATHRender();
    address constant NFT = 0x6B4fccdd888Bb6fD3934A9e49eF64dfd2c0D8e6D;

    function _cmp(uint id, string memory fixture) internal {
        vm.mockCall(NFT, abi.encodeWithSelector(IERC721.ownerOf.selector, id), abi.encode(address(1)));
        _ffi(math.tokenURI(id), fixture);
    }

    function _ffi(string memory uri, string memory fixture) internal {
        assertEq(_pyOut("test/compare.py", uri, fixture), "ok");
    }

    function test_math_samples() public {
        _cmp(1, "test/fixtures/math/1.json");
        _cmp(11, "test/fixtures/math/11.json");
        _cmp(69, "test/fixtures/math/69.json");
        _cmp(101, "test/fixtures/math/101.json");
        _cmp(650, "test/fixtures/math/650.json");
        _cmp(5851, "test/fixtures/math/5851.json");
        _cmp(8184, "test/fixtures/math/8184.json");
        _cmp(123456789, "test/fixtures/math/123456789.json");
        _cmp(999999999, "test/fixtures/math/999999999.json");
        _cmp(1000000000000000000, "test/fixtures/math/1000000000000000000.json");
    }

    // id 0 is not minted. Azure still answers; the pure render matches that
    // body. The fork test checks the real ownerOf revert.
    function test_math_unminted_body() public {
        _cmp(0, "test/fixtures/math/0.json");
    }

    function test_math_reverts_without_owner() public {
        vm.expectRevert();
        math.tokenURI(1);
        vm.expectRevert();
        math.tokenJSON(1);
    }
}
