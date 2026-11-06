import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/api/index.ts', import.meta.url), 'utf8')
  .replaceAll('import.meta.env.DEV', 'true')
  .replaceAll('import.meta.env.VITE_API_BASE_URL', "''");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function fixture({ getError, getResponse } = {}) {
  const requests = [];
  const client = {
    interceptors: { request: { use() {} }, response: { use() {} } },
    async post(url, payload) {
      requests.push({ url, payload });
      return { data: { success: true, taskId: 'test-task' } };
    },
    async get(url) {
      requests.push({ url });
      if (getError) throw getError;
      return { data: getResponse };
    },
  };
  const mocks = {
    axios: { default: { create: () => client, isAxiosError: value => value?.isAxiosError === true } },
    '../utils/emailSettings': { openEmailSettings() {} },
    '../utils/auth': { tokenManager: {} },
  };
  const exports = {};
  runInNewContext(code, { exports, require: name => mocks[name] });
  return { submitTask: exports.submitTask, getQuantumDevices: exports.getQuantumDevices, requests };
}

test('device list translates missing endpoint and network errors into actionable Chinese messages', async () => {
  for (const [getError, message] of [
    [{ isAxiosError: true, response: { status: 404 }, message: 'Request failed with status code 404' }, /设备服务暂未就绪/],
    [{ isAxiosError: true, message: 'Network Error' }, /检查网络/],
    [{ isAxiosError: true, response: { status: 503, data: { message: '设备连接中断，请稍后重试' } } }, /设备连接中断/],
  ]) {
    const f = fixture({ getError });
    await assert.rejects(f.getQuantumDevices(), message);
    assert.equal(f.requests[0].url, '/api/quantum/devices');
  }
});

const methods = ['sa', 'tabu', 'genetic', 'hill_climb', 'ils', 'random_search'];
test('classical submission strips quantum-only selection without mutating the caller', async () => {
  const f = fixture();
  const input = Object.freeze({ modelType: 'classic', computeMode: 'multi', deviceSelection: 'manual', deviceIds: [1, 2], deviceCount: 2 });
  await f.submitTask(input);
  assert.deepEqual(JSON.parse(JSON.stringify(f.requests[0].payload)), { modelType: 'classic' });
  assert.equal(input.computeMode, 'multi');
});

test('all four quantum selection modes reach the backend unchanged', async () => {
  const f = fixture();
  for (const choice of [
    { computeMode: 'single', deviceSelection: 'auto' },
    { computeMode: 'single', deviceSelection: 'manual', deviceIds: [3] },
    { computeMode: 'multi', deviceSelection: 'auto', deviceCount: 2 },
    { computeMode: 'multi', deviceSelection: 'manual', deviceIds: [1, 3, 5] },
  ]) {
    await f.submitTask({ modelType: 'quantum', methodType: 'sa', ...choice });
    assert.deepEqual(JSON.parse(JSON.stringify(f.requests.at(-1).payload)), { modelType: 'quantum', ...choice });
  }
});
for (const problemType of ['maxcut', 'number_partition', 'coloring', 'tsp', 'general']) {
  const base = {
    taskName: `${problemType} submission`,
    problemType,
    matrixSize: 2,
    adjacencyMatrix: problemType === 'number_partition' ? [1, 2] : [[0, 1], [1, 0]],
    ...(problemType === 'general' ? { generalInput: { source: 'matrix', variables: ['x1', 'x2'] } } : {}),
  };

  test(`${problemType}: classical submissions retain every selected algorithm and problem input`, async () => {
    const f = fixture();
    for (const methodType of methods) {
      const input = Object.freeze({ ...base, modelType: 'classic', methodType });
      const response = await f.submitTask(input);
      const { url, payload } = f.requests.at(-1);
      assert.equal(url, '/api/submit-task');
      assert.deepEqual(JSON.parse(JSON.stringify(payload)), input);
      assert.equal(response.taskId, 'test-task');
      assert.equal(response.usePolling, true);
    }
  });

  test(`${problemType}: quantum submissions omit the algorithm without mutating the selected value`, async () => {
    const f = fixture();
    for (const methodType of [...methods, undefined]) {
      const input = Object.freeze({ ...base, modelType: 'quantum', methodType });
      await f.submitTask(input);
      const { url, payload } = f.requests.at(-1);
      assert.equal(url, '/api/submit-task');
      assert.equal(Object.hasOwn(payload, 'methodType'), false);
      assert.deepEqual(JSON.parse(JSON.stringify(payload)), { ...base, modelType: 'quantum' });
      assert.equal(input.methodType, methodType);
    }
  });
}
