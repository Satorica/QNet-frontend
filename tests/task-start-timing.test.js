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

test('submissions use backend receipt timing without a clock probe or client timestamp', async () => {
  for (const modelType of ['classic', 'quantum']) {
    const requests = [];
    const client = {
      interceptors: { request: { use() {} }, response: { use() {} } },
      async get(url) {
        requests.push({ method: 'GET', url });
        throw new Error('Clock service unavailable');
      },
      async post(url, payload) { requests.push({ method: 'POST', url, payload }); return { data: { taskId: 't1' } }; },
    };
    const mocks = {
      axios: { default: { create: () => client } },
      '../utils/emailSettings': { openEmailSettings() {} },
      '../utils/auth': { tokenManager: {} },
    };
    const exports = {};
    runInNewContext(code, { exports, require: name => mocks[name], Date: { now: () => { throw new Error('Device clock must not affect submission'); } } });
    const input = Object.freeze({ modelType });
    assert.equal((await exports.submitTask(input)).taskId, 't1');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, 'POST');
    assert.equal(requests[0].url, '/api/submit-task');
    assert.equal(Object.hasOwn(requests[0].payload, 'clientTiming'), false);
    assert.equal(Object.hasOwn(input, 'clientTiming'), false);
  }
});
