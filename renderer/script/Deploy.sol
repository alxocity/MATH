// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {MATHRender, RGBRender, TOONRender} from "../src/Render.sol";

// Deploy the three renderers. The mainnet addresses are in the README.
// Verify the source after a new deploy; the README has the commands.
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        new MATHRender();
        new RGBRender();
        new TOONRender();
        vm.stopBroadcast();
    }
}
