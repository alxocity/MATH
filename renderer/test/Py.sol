// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {VmSafe} from "forge-std/Vm.sol";

// Python 3 on PATH. Windows usually has `python` or `py`, not `python3`.
// `PYTHON` overrides the name when it is set to an interpreter that runs.
abstract contract Py is Test {
    string internal pyBin;

    function _python() internal returns (string memory bin) {
        if (bytes(pyBin).length != 0) return pyBin;
        if (vm.envExists("PYTHON")) {
            bin = vm.envString("PYTHON");
            if (bytes(bin).length != 0 && _pyOk(bin)) {
                pyBin = bin;
                return bin;
            }
        }
        string[3] memory names = [string("python3"), "python", "py"];
        for (uint i; i < names.length; i++) {
            if (_pyOk(names[i])) {
                pyBin = names[i];
                return names[i];
            }
        }
        revert("python");
    }

    function _pyOk(string memory bin) internal returns (bool) {
        string[] memory cmd = new string[](2);
        cmd[0] = bin;
        cmd[1] = "--version";
        try this.pyProbe(cmd) returns (bool ok) {
            return ok;
        } catch {
            return false;
        }
    }

    // External so a missing executable reverts the probe, not the test.
    function pyProbe(string[] calldata cmd) external returns (bool) {
        VmSafe.FfiResult memory r = vm.tryFfi(cmd);
        return r.exitCode == 0;
    }

    function _pyOut(string memory a, string memory b, string memory c) internal returns (string memory) {
        string[] memory cmd = new string[](4);
        cmd[0] = _python();
        cmd[1] = a;
        cmd[2] = b;
        cmd[3] = c;
        return string(vm.ffi(cmd));
    }
}
