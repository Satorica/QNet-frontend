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

test('task start includes pre-submit time and network estimate despite client clock skew', async () => {
  for (const skew of [-28_800_000, 39_600_000]) {
    const times = [1000 + skew, 1200 + skew];
    let sent;
    const client = {
      interceptors: { request: { use() {} }, response: { use() {} } },
      async get(url) {
        assert.equal(url, '/api/tasks/clock');
        return { data: { data: { receivedAtMs: 1100, sentAtMs: 1100 } } };
      },
      async post(_url, payload) { sent = payload; return { data: { taskId: 't1' } }; },
    };
    const mocks = {
      axios: { default: { create: () => client } },
      '../utils/emailSettings': { openEmailSettings() {} },
      '../utils/auth': { tokenManager: {} },
    };
    const exports = {};
    runInNewContext(code, { exports, require: name => mocks[name], Date: { now: () => times.shift() } });
    const input = Object.freeze({ modelType: 'quantum' });
    await exports.submitTask(input, 900 + skew);
    assert.equal(sent.clientTiming.startedAtServerMs, 900);
    assert.equal(sent.clientTiming.uncertaintyMs, 100);
    assert.equal(Object.hasOwn(input, 'clientTiming'), false);
  }
});
