const n = BigInt(process.argv[2]);
// Leading J is not hex, so `vm.ffi` returns the digits instead of decoding them.
process.stdout.write("J" + (Number(n) - 5).toString(16).padStart(6, "0"));
