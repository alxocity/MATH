const assert = require('assert');
const RUN = require('./run');

const math = [
  { result: 3n, uses: [] },
  { result: 6n, uses: [3n] },
  { result: 9n, uses: [6n] },
];
const one = RUN.splitCalls(math);
assert.strictEqual(one.length, 1);
assert.strictEqual(one[0].length, 3);

const rgb = RUN.splitCalls([
  { result: 5n, uses: [] },
  { result: null, uses: [5n] },
]);
assert.strictEqual(rgb.length, 1);
assert.strictEqual(rgb[0].length, 2);

const toon = RUN.splitCalls([
  { result: 5n, uses: [] },
  { result: null, uses: [5n] },
  { result: 5n, uses: [999n] },
]);
assert.strictEqual(toon.length, 2);
assert.strictEqual(toon[0].length, 2);
assert.strictEqual(toon[1].length, 1);
assert.strictEqual(toon[1][0].uses[0], 999n);

const seeded = RUN.splitCalls([
  { result: 4n, uses: [] },
  { result: 8n, uses: [3n] },
], ['3']);
assert.strictEqual(seeded.length, 1);
const unseeded = RUN.splitCalls([
  { result: 4n, uses: [] },
  { result: 8n, uses: [3n] },
]);
assert.strictEqual(unseeded.length, 2);

assert.strictEqual(RUN.splitCalls([{ result: null, uses: [1n] }]).length, 1);
assert.strictEqual(RUN.splitCalls([]).length, 0);

assert.strictEqual(RUN.atomicReady({ '0x1': { atomic: { status: 'supported' } } }), true);
assert.strictEqual(RUN.atomicReady({ '0x1': { atomic: { status: 'ready' } } }), true);
assert.strictEqual(RUN.atomicReady({ '0x01': { atomic: { status: 'ready' } } }), true);
assert.strictEqual(RUN.atomicReady({ '1': { atomic: { status: 'supported' } } }), true);
assert.strictEqual(RUN.atomicReady({ '0x1': { atomic: { status: 'unsupported' } } }), false);
assert.strictEqual(RUN.atomicReady({}), false);
assert.strictEqual(RUN.atomicReady(null), false);

const pending = { result: 3n, uses: [], status: 'pending' };
const next = { result: 6n, uses: [3n], status: 'pending' };
const alone = { result: 9n, uses: [3n], status: 'pending' };
assert.strictEqual(RUN.deferSim(next, [pending, next]), true);
assert.strictEqual(RUN.deferSim(pending, [pending, next]), false);
assert.strictEqual(RUN.deferSim(alone, [alone]), false);
pending.status = 'confirmed';
assert.strictEqual(RUN.deferSim(next, [pending, next]), false);
pending.status = 'submitted';
assert.strictEqual(RUN.deferSim(next, [pending, next]), false);
pending.status = 'pending';
assert.strictEqual(RUN.deferSim({ result: 4n, uses: [], status: 'pending' }, [pending]), false);
assert.strictEqual(RUN.batchSimNote(3), "steps 2–3 can't be simulated until step 1 is minted");

assert.strictEqual(RUN.receiptOk('0x1'), true);
assert.strictEqual(RUN.receiptOk('0x01'), true);
assert.strictEqual(RUN.receiptOk('1'), true);
assert.strictEqual(RUN.receiptOk(1), true);
assert.strictEqual(RUN.receiptOk('0x0'), false);
assert.strictEqual(RUN.receiptOk('0x00'), false);
assert.strictEqual(RUN.receiptOk(0), false);
assert.strictEqual(RUN.receiptOk(null), false);

assert.strictEqual(RUN.callsOutcome(100), 'pending');
assert.strictEqual(RUN.callsOutcome('0x64'), 'pending');
assert.strictEqual(RUN.callsOutcome(200), 'confirmed');
assert.strictEqual(RUN.callsOutcome('0xc8'), 'confirmed');
assert.strictEqual(RUN.callsOutcome(400), 'failed');
assert.strictEqual(RUN.callsOutcome(500), 'failed');
assert.strictEqual(RUN.callsOutcome(600), 'failed');
assert.strictEqual(RUN.callsOutcome('nope'), 'pending');

assert.strictEqual(RUN.callsId('abc'), 'abc');
assert.strictEqual(RUN.callsId({ id: 'i' }), 'i');
assert.strictEqual(RUN.callsId({ callsId: 'c' }), 'c');
assert.strictEqual(RUN.callsId(null), '');

assert.strictEqual(RUN.rejected({ code: 4001 }), true);
assert.strictEqual(RUN.rejected({ message: 'User rejected the request' }), true);
assert.strictEqual(RUN.rejected({ message: 'no' }), false);
assert.strictEqual(RUN.unsupported({ code: -32601 }), true);
assert.strictEqual(RUN.unsupported({ code: 4200 }), true);
assert.strictEqual(RUN.unsupported({ message: 'method not found' }), true);
assert.strictEqual(RUN.unsupported({ code: 4001, message: 'user rejected' }), false);

console.log('run.test.js ok');
