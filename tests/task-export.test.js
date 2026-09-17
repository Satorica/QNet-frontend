import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const typeExports = {};
runInNewContext(compile('../src/types/api.ts'), { exports: typeExports });
const code = compile('../src/utils/resultExport.ts');

test('task lists display no algorithm for quantum models', () => {
  assert.equal(typeExports.getTaskListMethodTypeText('quantum', 'sa'), '-');
  assert.equal(typeExports.getTaskListMethodTypeText('quantum', 'tabu'), '-');
  assert.equal(typeExports.getTaskListMethodTypeText('classic', 'sa'), '模拟退火');
  assert.equal(typeExports.getTaskListMethodTypeText('classic', 'tabu'), '禁忌搜索');
});

function fixture() {
  let downloaded;
  const clicks = [], revoked = [];
  const exports = {};
  runInNewContext(code, {
    exports,
    require: name => {
      assert.equal(name, '../types/api');
      return typeExports;
    },
    Blob,
    URL: {
      createObjectURL: blob => { downloaded = blob; return 'blob:export-test'; },
      revokeObjectURL: url => revoked.push(url),
    },
    document: {
      createElement: () => ({ click() { clicks.push({ href: this.href, download: this.download }); } }),
    },
  });
  return {
    async download(taskInfo, input, results, derivedResult = null) {
      exports.downloadTaskResultExport(taskInfo, input, results, derivedResult);
      assert.equal(downloaded.type, 'application/json');
      assert.equal(clicks.at(-1).download, `task-${taskInfo.taskId}-result.json`);
      assert.equal(revoked.at(-1), 'blob:export-test');
      return JSON.parse(await downloaded.text());
    },
  };
}

const baseInfo = {
  taskId: 'export-test', taskName: 'Export test', matrixSize: 2,
  timestamp: '2026-09-16T02:00:00Z', status: 'completed',
};
const results = Object.freeze({ candidates: [{ value: 1, solution: [1, -1] }], runtime: 0.1 });
for (const problemType of ['maxcut', 'number_partition', 'coloring', 'tsp', 'general']) {
  test(`${problemType}: quantum exports remove algorithm metadata from current and historical snapshots`, async () => {
    for (const methodType of ['tabu', 'sa']) {
      const taskInfo = Object.freeze({ ...baseInfo, problemType, modelType: 'quantum', methodType, methodTypeText: 'stale algorithm' });
      const input = Object.freeze({ adjacencyMatrix: [[0, 1], [1, 0]], methodType, methodTypeText: 'stale algorithm', generalInput: { source: 'matrix' } });
      const data = await fixture().download(taskInfo, input, results);
      assert.equal(Object.hasOwn(data.taskInfo, 'methodType'), false);
      assert.equal(Object.hasOwn(data.taskInfo, 'methodTypeText'), false);
      assert.equal(Object.hasOwn(data.input, 'methodType'), false);
      assert.equal(Object.hasOwn(data.input, 'methodTypeText'), false);
      assert.equal(data.taskInfo.modelType, 'quantum');
      assert.deepEqual(data.input, { adjacencyMatrix: input.adjacencyMatrix, generalInput: input.generalInput });
      assert.deepEqual(data.results, results);
      assert.equal(taskInfo.methodType, methodType);
      assert.equal(input.methodType, methodType);
    }
  });
  test(`${problemType}: classical exports retain the selected algorithm and other export fields`, async () => {
    const taskInfo = Object.freeze({ ...baseInfo, problemType, modelType: 'classic', methodType: 'tabu' });
    const input = Object.freeze({ methodType: 'tabu', numbers: [1, 2] });
    const data = await fixture().download(taskInfo, input, results, { difference: 1 });
    assert.equal(data.taskInfo.methodType, 'tabu');
    assert.equal(data.taskInfo.methodTypeText, '禁忌搜索');
    assert.equal(data.taskInfo.timestamp, '2026-09-16 10:00:00');
    assert.deepEqual(data.input, input);
    assert.deepEqual(data.results, results);
    assert.deepEqual(data.derivedResult, { difference: 1 });
  });
}

test('quantum exports preserve array and null inputs and accept missing algorithm metadata', async () => {
  const taskInfo = { ...baseInfo, problemType: 'number_partition', modelType: 'quantum' };
  for (const input of [null, [1, 2], [[0, 1], [1, 0]]]) {
    const data = await fixture().download(taskInfo, input, results);
    assert.deepEqual(data.input, input);
    assert.equal(Object.hasOwn(data.taskInfo, 'methodType'), false);
    assert.equal(Object.hasOwn(data.taskInfo, 'methodTypeText'), false);
  }
});
