import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/utils/performanceComparison.ts', import.meta.url), 'utf8');
const api = {};
runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
  { exports: api, setTimeout, clearTimeout, Date, Math });
const plain = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settle = () => new Promise(resolve => setImmediate(resolve));
const input = (problemType = 'maxcut') => ({ taskName: '同一输入', problemType, matrixSize: 2,
  adjacencyMatrix: problemType === 'number_partition' ? [3, 7] : [[0, 2], [2, 0]], methodType: 'tabu',
  computeMode: 'multi', deviceSelection: 'manual', deviceIds: [1, 3],
  ...(problemType === 'tsp' ? { cities: [{ id: 0, x: 1, y: 2 }, { id: 1, x: 2, y: 3 }] } : {}),
  ...(problemType === 'general' ? { generalInput: { source: 'expression', variables: ['x1', 'x2'], constraints: [{ rhs: 1 }] } } : {}),
});
function fixture(overrides = {}) {
  const pending = new Map(), submissions = [], cancellations = [];
  let sequence = 0, latest, busy, changedTasks = 0;
  const controller = api.createPerformanceComparison({
    submit: async request => { submissions.push(request); return overrides.submit ? overrides.submit(request) : { success: true, taskId: request.modelType }; },
    status: async id => overrides.status ? overrides.status(id) : ({ taskId: id, state: 'completed', results: { runtime: id === 'classic' ? 0.018612345 : 0.003612345, fpga: id === 'quantum' ? { device_ids: [1, 3] } : undefined } }),
    cancel: async id => { cancellations.push(id); return overrides.cancel ? overrides.cancel(id) : { success: true, cancelled: true, taskStatus: 'cancelled' }; },
    changed: (run, running) => { latest = run; busy = running; },
    tasksChanged: () => { changedTasks += 1; },
    schedule: callback => { pending.set(++sequence, callback); return sequence; },
    unschedule: id => pending.delete(id), now: () => 1794800000000,
  });
  return { controller, submissions, cancellations, pending,
    get run() { return latest; }, get busy() { return busy; }, get changedTasks() { return changedTasks; },
    async poll() { const callbacks = [...pending.values()]; pending.clear(); callbacks.forEach(callback => callback()); await settle(); },
  };
}

for (const problem of ['maxcut', 'number_partition', 'coloring', 'tsp', 'general']) {
  test(`${problem}: one action freezes equal, independent inputs and preserves model-specific parameters`, async () => {
    const f = fixture(); const current = input(problem);
    await f.controller.start(current);
    assert.equal(f.submissions.length, 2);
    const [classic, quantum] = f.submissions;
    assert.deepEqual(plain(classic.adjacencyMatrix), plain(quantum.adjacencyMatrix));
    assert.equal(classic.methodType, 'tabu'); assert.equal(Object.hasOwn(classic, 'deviceIds'), false);
    assert.equal(Object.hasOwn(quantum, 'methodType'), false); assert.deepEqual(plain(quantum.deviceIds), [1, 3]);
    if (problem === 'general') assert.deepEqual(plain(classic.generalInput), plain(quantum.generalInput));
    if (problem === 'tsp') assert.deepEqual(plain(classic.cities), plain(quantum.cities));
    if (Array.isArray(current.adjacencyMatrix[0])) current.adjacencyMatrix[0][0] = 999;
    else current.adjacencyMatrix[0] = 999;
    current.deviceIds.push(5);
    assert.equal(f.run.input.adjacencyMatrix[0]?.[0] ?? f.run.input.adjacencyMatrix[0], problem === 'number_partition' ? 3 : 0);
    classic.adjacencyMatrix[0] = 888;
    assert.notEqual(quantum.adjacencyMatrix[0], 888);
    await f.poll(); assert.equal(f.busy, false);
    assert.equal(f.run.sides.classic.status, 'completed'); assert.equal(f.run.sides.quantum.status, 'completed');
  });
}

test('duplicate clicks submit once; independent side failure does not discard the successful side', async () => {
  const f = fixture({ submit: async request => request.modelType === 'classic' ? { success: false, message: '经典额度不足' } : { success: true, taskId: 'quantum' } });
  await f.controller.start(input()); await f.controller.start(input());
  assert.equal(f.submissions.length, 2); assert.equal(f.busy, true);
  assert.equal(f.run.sides.classic.status, 'failed'); assert.match(f.run.sides.classic.message, /额度不足/);
  await f.poll(); assert.equal(f.busy, false); assert.equal(f.run.sides.quantum.status, 'completed');
});

test('cancelling before submission responses arrive cancels both accepted tasks', async () => {
  const responses = { classic: deferred(), quantum: deferred() };
  const f = fixture({ submit: request => responses[request.modelType].promise });
  const start = f.controller.start(input());
  await f.controller.cancel();
  responses.quantum.resolve({ success: true, taskId: 'q' });
  responses.classic.resolve({ success: true, taskId: 'c' });
  await start;
  assert.deepEqual(f.cancellations.sort(), ['c', 'q']);
  assert.equal(f.busy, false); assert.equal(f.pending.size, 0);
  assert.equal(f.run.sides.classic.status, 'cancelled'); assert.equal(f.run.sides.quantum.status, 'cancelled');
});

test('a completion that wins cancellation is fetched with its real device timing', async () => {
  const f = fixture({ cancel: async id => id === 'classic' ? { success: false, taskStatus: 'completed', message: '已完成' } : { success: true, cancelled: true, taskStatus: 'cancelled' } });
  await f.controller.start(input()); await f.controller.cancel(); await f.poll();
  assert.equal(f.run.sides.classic.status, 'completed'); assert.equal(f.run.sides.classic.results.runtime, 0.018612345);
  assert.equal(f.run.sides.quantum.status, 'cancelled'); assert.equal(f.busy, false);
});

test('late poll cannot resurrect a task after successful cancellation', async () => {
  const response = deferred(); const f = fixture({ status: () => response.promise });
  await f.controller.start(input()); await f.poll(); await f.controller.cancel();
  response.resolve({ state: 'processing' }); await settle();
  assert.equal(f.busy, false); assert.equal(f.run.sides.classic.status, 'cancelled'); assert.equal(f.pending.size, 0);
});

test('transient status errors retry without declaring the running task failed', async () => {
  let fail = true;
  const f = fixture({ status: async id => { if (fail) throw new Error('网络中断'); return { taskId: id, state: 'completed', results: { runtime: 0.01 } }; } });
  await f.controller.start(input()); await f.poll();
  assert.equal(f.run.sides.classic.status, 'queued'); assert.match(f.run.sides.classic.pollError, /正在重试/); assert.equal(f.busy, true);
  fail = false; await f.poll(); assert.equal(f.busy, false); assert.equal(f.run.sides.classic.pollError, '');
});

test('new comparison after cancellation reruns both sides without inheriting the cancellation flag', async () => {
  const f = fixture(); await f.controller.start(input()); await f.controller.cancel();
  await f.controller.start(input()); assert.equal(f.submissions.length, 4); assert.equal(f.cancellations.length, 2);
  await f.poll(); assert.equal(f.run.sides.quantum.status, 'completed');
});

test('when completion wins cancellation, the actual completed result is fetched before unlocking', async () => {
  const f = fixture({ cancel: async () => ({ success: false, taskStatus: 'completed', message: '任务已完成' }) });
  await f.controller.start(input()); await f.controller.cancel();
  assert.equal(f.busy, true);
  assert.equal(f.run.sides.classic.results, null);
  await f.poll();
  assert.equal(f.busy, false); assert.equal(f.run.sides.quantum.status, 'completed');
  assert.equal(f.run.sides.quantum.results.runtime, 0.003612345);
});

test('a stale processing response cannot resurrect a task after cancellation', async () => {
  const late = deferred();
  const f = fixture({ status: async id => id === 'classic' ? late.promise : { state: 'completed', results: { runtime: 0.1 } } });
  await f.controller.start(input()); await f.poll(); await f.controller.cancel();
  assert.deepEqual(f.cancellations, ['classic']); assert.equal(f.busy, false);
  late.resolve({ state: 'processing' }); await settle();
  assert.equal(f.run.sides.classic.status, 'cancelled'); assert.equal(f.pending.size, 0);
});

test('transient polling failure retries without failing the running side or discarding the other result', async () => {
  let attempts = 0;
  const f = fixture({ status: async id => {
    if (id === 'quantum' && attempts++ === 0) throw new Error('网络中断');
    return { state: 'completed', results: { runtime: 0.01 } };
  } });
  await f.controller.start(input()); await f.poll();
  assert.equal(f.run.sides.classic.status, 'completed'); assert.equal(f.run.sides.quantum.status, 'queued');
  assert.equal(f.busy, true); assert.match(f.run.sides.quantum.pollError, /正在重试/);
  await f.poll(); assert.equal(f.busy, false); assert.equal(f.run.sides.quantum.pollError, '');
});

test('unmount disposes timers and suppresses late response writes', async () => {
  const response = deferred(); const f = fixture({ status: () => response.promise });
  await f.controller.start(input()); await f.poll(); const previous = f.run;
  f.controller.dispose(); response.resolve({ state: 'completed', results: { runtime: 1 } }); await settle();
  assert.equal(f.run, previous); assert.equal(f.pending.size, 0);
});

test('JSON export retains precise ms, input and IDs, and excludes objectives, ratios and candidate vectors', async () => {
  const f = fixture(); const current = input('general'); await f.controller.start(current); await f.poll();
  current.generalInput.constraints[0].rhs = 999;
  const exported = api.buildComparisonExport(f.run);
  assert.equal(exported.timing.unit, 'ms'); assert.equal(exported.input.generalInput.constraints[0].rhs, 1);
  assert.equal(exported.classic.deviceSolveTimeMs, 0.018612345 * 1000);
  assert.equal(exported.quantum.taskId, 'quantum'); assert.deepEqual(plain(exported.quantum.actualDeviceIds), [1, 3]);
  assert.doesNotMatch(JSON.stringify(exported), /bestValue|candidate|ratio|maxcut_value/i);
  assert.equal(api.deviceSolveTimeMs(null), null); assert.equal(api.deviceSolveTimeMs({ runtime: NaN }), null);
  assert.equal(api.deviceSolveTimeMs({ runtime: -1 }), null); assert.equal(api.deviceSolveTimeMs({ runtime: 0 }), 0);
});

test('comparison task names are distinct and obey the existing 64-character limit', () => {
  const current = { ...input(), taskName: '名称'.repeat(32) };
  const requests = api.buildComparisonRequests(current, 'unique-comparison');
  assert.ok(requests.classic.taskName.length <= 64); assert.ok(requests.quantum.taskName.length <= 64);
  assert.notEqual(requests.classic.taskName, requests.quantum.taskName);
});
