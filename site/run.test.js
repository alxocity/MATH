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
pending.status = RUN.UNKNOWN;
assert.strictEqual(RUN.deferSim(next, [pending, next]), false);
pending.status = 'pending';
assert.strictEqual(RUN.batchSimNote(3), "steps 2–3 can't be simulated until step 1 is minted");

assert.strictEqual(RUN.UNKNOWN, 'status unknown — check your wallet');
assert.notStrictEqual(RUN.UNKNOWN, 'failed');
assert.strictEqual(RUN.isUnknown(RUN.UNKNOWN), true);
assert.strictEqual(RUN.isUnknown('failed'), false);
assert.strictEqual(RUN.isUnknown('submitted'), false);

const callsOnly = { status: 'submitted', calls: '0xbatch', hash: '', error: 'old' };
const unheard = RUN.settleUnheard([callsOnly], false);
assert.notStrictEqual(unheard[0], callsOnly);
assert.strictEqual(unheard[0].status, RUN.UNKNOWN);
assert.notStrictEqual(unheard[0].status, 'failed');
assert.strictEqual(unheard[0].error, '');
assert.strictEqual(callsOnly.status, 'submitted');
assert.strictEqual(RUN.settleUnheard([callsOnly], true)[0].status, 'submitted');
const hashed = { status: 'submitted', calls: '0xbatch', hash: '0x' + 'ab'.repeat(32) };
assert.strictEqual(RUN.settleUnheard([hashed], false)[0].status, 'submitted');
assert.strictEqual(RUN.settleUnheard([{ status: 'submitted', hash: '', calls: '' }], false)[0].status, 'submitted');
assert.strictEqual(RUN.settleUnheard([{ status: 'failed', calls: '0xbatch' }], false)[0].status, 'failed');

assert.strictEqual(RUN.shouldResume({ status: 'submitted', calls: 'id' }), true);
assert.strictEqual(RUN.shouldResume({ status: RUN.UNKNOWN, calls: 'id' }), true);
assert.strictEqual(RUN.shouldResume({ status: 'submitted', hash: '0x' + '11'.repeat(32) }), true);
assert.strictEqual(RUN.shouldResume({ status: 'failed', calls: 'id' }), false);
assert.strictEqual(RUN.shouldResume({ status: 'submitted', hash: '', calls: '' }), false);
assert.strictEqual(RUN.shouldResume(null), false);

assert.strictEqual(RUN.rgbMatch([{ r: 1n, g: 2n, b: 3n }], 1n, 2n, 3n), true);
assert.strictEqual(RUN.rgbMatch([{ r: 9n, g: 9n, b: 9n }, { r: '1', g: '2', b: '3' }], 1, 2, 3), true);
assert.strictEqual(RUN.rgbMatch([{ r: 1n, g: 2n, b: 4n }], 1n, 2n, 3n), false);
assert.strictEqual(RUN.rgbMatch([], 1n, 2n, 3n), false);
assert.strictEqual(RUN.rgbMatch(null, 1n, 2n, 3n), false);

const unread = { status: 'submitted', calls: '0xbatch', hash: '', error: 'old' };
const gaveUp = RUN.settleUnread([unread]);
assert.strictEqual(gaveUp[0].status, RUN.UNKNOWN);
assert.notStrictEqual(gaveUp[0].status, 'failed');
assert.strictEqual(gaveUp[0].error, '');
assert.strictEqual(unread.status, 'submitted');
assert.strictEqual(RUN.settleUnread([{ status: 'submitted', calls: '0xbatch', hash: '0x' + 'ab'.repeat(32) }])[0].status, 'submitted');
assert.strictEqual(RUN.clearAnswer(RUN.UNKNOWN, true), 'confirmed');
assert.strictEqual(RUN.clearAnswer(RUN.UNKNOWN, false), 'pending');
assert.strictEqual(RUN.clearAnswer(RUN.UNKNOWN, undefined), RUN.UNKNOWN);
assert.strictEqual(RUN.clearAnswer('failed', false), 'failed');

assert.strictEqual(RUN.rgbPlane([{ r: 1n, g: 9n, b: 9n }], 1n, 2n, 3n), 'R already used');
assert.strictEqual(RUN.rgbPlane([{ r: 9n, g: 2n, b: 9n }], 1n, 2n, 3n), 'G already used');
assert.strictEqual(RUN.rgbPlane([{ r: 9n, g: 9n, b: 3n }], 1n, 2n, 3n), 'B already used');
assert.strictEqual(RUN.rgbPlane([{ r: 4n, g: 5n, b: 6n }], 1n, 2n, 3n), '');
assert.strictEqual(RUN.rgbPlane([{ r: 8n, g: 8n, b: 3n }, { r: 1n, g: 2n, b: 8n }], 1n, 2n, 3n), 'R already used');
assert.deepStrictEqual(RUN.rgbWord([1n, 2n, 3n]), { r: 1n, g: 2n, b: 3n });
assert.throws(function () { RUN.rgbWord([0n, 1n, 2n]); }, /RGB get/);
assert.throws(function () { RUN.rgbWord([1n, 0n, 2n]); }, /RGB get/);
assert.throws(function () { RUN.rgbWord([1n, 2n, 0n]); }, /RGB get/);
assert.throws(function () { RUN.rgbWord([1n, 2n]); }, /RGB get/);

const price = 1000000000n;
const need = RUN.batchNeed([
  { value: 2000000000000000n, gas: 175000n },
  { value: 30000000000000000n, gas: 340000n },
], price);
assert.strictEqual(need, 2000000000000000n + 175000n * price + 30000000000000000n + 340000n * price);
assert.strictEqual(RUN.shortBalance(need - 1n, need), true);
assert.strictEqual(RUN.shortBalance(need, need), false);
assert.strictEqual(RUN.simFallback({ code: -32601, message: 'Method not found' }), true);
assert.strictEqual(RUN.simFallback({ code: -32603, message: 'Internal error' }), true);
assert.strictEqual(RUN.simFallback(new Error('timeout')), true);
assert.strictEqual(RUN.simFallback({ code: 3, message: 'execution reverted' }), false);
assert.strictEqual(RUN.simFallback({ message: 'execution reverted' }), false);

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

assert.strictEqual(RUN.bulkWhy(0, 'ready'), 'nothing to send');
assert.strictEqual(RUN.bulkWhy(1, 'ready'), 'only one transaction');
assert.strictEqual(RUN.bulkWhy(1, 'ready', 'change'), "there's only one change");
assert.strictEqual(RUN.bulkWhy(3, 'none'), 'connect a wallet to batch');
assert.strictEqual(RUN.bulkWhy(3, 'checking'), 'checking whether this wallet can batch');
assert.strictEqual(RUN.bulkWhy(3, 'unsupported'), "the wallet doesn't support batched sends");
assert.strictEqual(RUN.bulkWhy(3, 'timeout'), "couldn't check batch support");
assert.strictEqual(RUN.bulkWhy(3, 'timeout', 'change'), "couldn't check batch support");
assert.strictEqual(RUN.bulkWhy(3, 'ready'), '');
assert.strictEqual(RUN.bulkWhy(3, 'ready', 'change'), '');

const tx = function () { return {}; };
const restored = [
  { status: 'failed', label: '1 + 1 = 2' },
  { status: 'pending', label: '2 + 2 = 4' },
];
assert.deepStrictEqual(RUN.openBatch(restored), []);
assert.strictEqual(RUN.batchWhy(restored, { phase: 'ready' }), 'plan routes first');
assert.strictEqual(RUN.PLAN_FIRST, 'plan routes first');

const seededBatch = RUN.openBatch([
  { status: 'confirmed', result: 3n },
  { status: 'pending', result: 4n, uses: [], tx: tx },
  { status: 'pending', result: 8n, uses: [3n], tx: tx },
]);
assert.strictEqual(seededBatch.length, 2);
assert.strictEqual(RUN.batchWhy([
  { status: 'pending', result: 2n, uses: [], tx: tx },
  { status: 'pending', result: 3n, uses: [], tx: tx },
], { phase: 'ready' }), '');

assert.strictEqual(RUN.batchWhy([
  { status: 'submitted', result: 1n, tx: tx },
  { status: 'pending', result: 2n, uses: [], tx: tx },
  { status: 'pending', result: 3n, uses: [], tx: tx },
], { phase: 'ready' }), 'a transaction is still in flight');
assert.strictEqual(RUN.batchWhy([
  { status: 'pending', result: 2n, uses: [], tx: tx, blocked: true, blockWhy: "holder can't receive payout" },
  { status: 'pending', result: 3n, uses: [], tx: tx },
], { phase: 'ready' }), "holder can't receive payout");

assert.strictEqual(RUN.batchHold('', { controls: false, signed: true }), 'this wallet does not control the parent');
assert.strictEqual(RUN.batchHold('', { controls: true, signed: false }), 'simulate first');
assert.strictEqual(RUN.batchHold('', { controls: true, signed: '' }), 'simulate first');
assert.strictEqual(RUN.batchHold('', { controls: true, signed: true }), '');
assert.strictEqual(RUN.batchHold("there's only one change", { controls: false, signed: false }), "there's only one change");
assert.strictEqual(RUN.batchHold('', { busy: true, controls: false, signed: false }), 'working…');
assert.strictEqual(RUN.batchHold('', { busy: true, controls: undefined, wallet: true, signed: false }), 'working…');
assert.strictEqual(RUN.batchHold('', { controls: undefined, wallet: true, signed: false }), 'read the parent first');
assert.strictEqual(RUN.batchHold('', { controls: undefined, wallet: false, signed: true }), '');
assert.strictEqual(RUN.batchHold('nothing to send', { busy: true, wallet: true }), 'nothing to send');

const two = [
  { status: 'pending', result: 2n, uses: [], tx: tx },
  { status: 'pending', result: 3n, uses: [], tx: tx },
];
assert.strictEqual(RUN.batchWhy(two, { phase: 'none' }), 'connect a wallet to batch');
assert.strictEqual(RUN.batchWhy(two, { phase: 'checking' }), 'checking whether this wallet can batch');
assert.strictEqual(RUN.batchWhy(two, { phase: 'ready', busy: true }), 'a send is already running');
assert.strictEqual(RUN.batchWhy(two.concat([
  { status: RUN.UNKNOWN, result: 1n, tx: tx },
]), { phase: 'ready' }), 'check your wallet');
assert.strictEqual(RUN.batchWhy(two, { phase: 'none', busy: true }), 'connect a wallet to batch');

let said = '';
assert.strictEqual(RUN.emptyPlan([], function (why) { said = why; }), true);
assert.strictEqual(said, 'plan routes first');
said = '';
assert.strictEqual(RUN.emptyPlan(two, function (why) { said = why; }), false);
assert.strictEqual(said, '');

const readyCaps = { '0x1': { atomic: { status: 'ready' } } };
const live = {
  account: '0xabc',
  hasWallet: true,
  batchKnown: true,
  batchTimed: false,
  batchCaps: readyCaps,
  runGen: 4,
  runBusy: true,
  txLock: 'run',
};
assert.strictEqual(RUN.noteWhy(two, live), 'a send is already running');
let noted = 0;
assert.strictEqual(RUN.releaseRun(4, live, function () { noted += 1; }), true);
assert.strictEqual(noted, 1);
assert.strictEqual(live.runBusy, false);
assert.strictEqual(live.txLock, null);
assert.strictEqual(RUN.noteWhy(two, live), '');

live.txLock = '0xhash';
assert.strictEqual(RUN.noteWhy(two, live), 'a send is already running');
assert.strictEqual(RUN.releaseRun(4, live, function () { noted += 1; }), true);
assert.strictEqual(live.txLock, '0xhash');
assert.strictEqual(noted, 2);
live.txLock = null;
assert.strictEqual(RUN.noteWhy(two, live), '');

live.runBusy = true;
live.txLock = 'run';
assert.strictEqual(RUN.releaseRun(3, live, function () { noted += 1; }), false);
assert.strictEqual(noted, 2);
assert.strictEqual(live.runBusy, true);
assert.strictEqual(live.txLock, 'run');
assert.strictEqual(RUN.noteWhy(two, live), 'a send is already running');

const busyRun = { runBusy: true, txLock: 'run', runGen: 9 };
assert.strictEqual(RUN.clearHashLock(busyRun, '0xold'), false);
assert.strictEqual(busyRun.txLock, 'run');
assert.strictEqual(busyRun.runBusy, true);
assert.strictEqual(RUN.noteWhy(two, {
  account: '0xabc',
  hasWallet: true,
  batchKnown: true,
  batchTimed: false,
  batchCaps: readyCaps,
  runBusy: busyRun.runBusy,
  txLock: busyRun.txLock,
}), 'a send is already running');
const ended = { runBusy: false, txLock: '0xold' };
assert.strictEqual(RUN.clearHashLock(ended, '0xold'), true);
assert.strictEqual(ended.txLock, null);
assert.strictEqual(ended.runBusy, false);
assert.strictEqual(RUN.noteWhy(two, {
  account: '0xabc',
  hasWallet: true,
  batchKnown: true,
  batchTimed: false,
  batchCaps: readyCaps,
  runBusy: ended.runBusy,
  txLock: ended.txLock,
}), '');

const counted = RUN.runCount([
  { status: 'confirmed' },
  { status: 'pending' },
  { status: 'submitted' },
  { status: 'failed' },
]);
assert.strictEqual(counted.n, 4);
assert.strictEqual(counted.done, 1);
assert.strictEqual(counted.pending, 2);
assert.strictEqual(counted.failed, 1);
assert.strictEqual(counted.text, '4 steps. 1 done, 2 pending, 1 failed');
assert.strictEqual(RUN.runCount([{ status: 'confirmed' }]).text, '1 step. 1 done, 0 pending, 0 failed');

const plan = [
  { label: '1 + 1 = 2', status: 'confirmed', hash: '0x' + 'ab'.repeat(32) },
  { label: '2 + 1 = 3', status: 'confirmed' },
  { label: '3 + 1 = 4', status: 'failed', error: 'reverted' },
  { label: '4 + 1 = 5', status: 'pending' },
  { label: '5 + 1 = 6', status: 'pending' },
  { label: '6 + 1 = 7', status: 'submitted' },
  { label: 'RGB.add 1, 2, 3', status: 'pending' },
];
const prog = RUN.progressSummary(plan);
assert.strictEqual(prog.text, '2 of 7 done, 1 failed');
assert.strictEqual(prog.focus, 2);
assert.strictEqual(RUN.stepClass('confirmed'), 'done');
assert.strictEqual(RUN.stepClass('failed'), 'failed');
assert.strictEqual(RUN.stepClass('submitted'), 'now');
assert.strictEqual(RUN.stepClass('signing'), 'now');
assert.strictEqual(RUN.stepClass('pending'), '');
assert.strictEqual(RUN.stepId(plan[2].label), 'step-3-1-4');
const quiet = RUN.progressSummary([
  { status: 'confirmed' },
  { status: 'pending' },
  { status: 'pending' },
]);
assert.strictEqual(quiet.text, '1 of 3 done');
assert.strictEqual(quiet.focus, 1);

console.log('run.test.js ok');
