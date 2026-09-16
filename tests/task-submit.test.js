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

function fixture() {
  const requests = [];
  const client = {
    interceptors: { request: { use() {} }, response: { use() {} } },
    async post(url, payload) {
      requests.push({ url, payload });
      return { data: { success: true, taskId: 'test-task' } };
    },
  };
  const mocks = {
    axios: { default: { create: () => client } },
    '../utils/emailSettings': { openEmailSettings() {} },
    '../utils/auth': { tokenManager: {} },
  };
  const exports = {};
  runInNewContext(code, { exports, require: name => mocks[name] });
  return { submitTask: exports.submitTask, requests };
}

const methods = ['sa', 'tabu', 'genetic', 'hill_climb', 'ils', 'random_search'];
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
