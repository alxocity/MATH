// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {MATHRender, RGBRender, TOONRender} from "../src/Render.sol";

// Deploy three renderers. Do not broadcast this against a public network
// from CI; the owner deploys when they are ready to repoint metadata.
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        new MATHRender();
        new RGBRender();
        new TOONRender();
        vm.stopBroadcast();
    }
}
