const n = BigInt(process.argv[2]);
process.stdout.write((Number(n) - 5).toString(16).padStart(6, "0"));
