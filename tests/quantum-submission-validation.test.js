import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { parse } from '@vue/compiler-sfc';
import ts from 'typescript';

// Execute the actual view submitters, so regressions in validation ordering are
// caught even if the shared device component's own validation tests still pass.
function fixture(view, { message = '多台计算请至少选择两台设备', missing = false, valid = false } = {}) {
  const name = ['Coloring', 'TSP'].includes(view) ? 'submitSolve' : 'startSolve';
  const source = parse(readFileSync(new URL(`../src/views/${view}.vue`, import.meta.url), 'utf8')).descriptor.scriptSetup.content;
  const tree = ts.createSourceFile(`${view}.ts`, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declaration = tree.statements.filter(ts.isVariableStatement)
    .flatMap(statement => [...statement.declarationList.declarations])
    .find(declaration => declaration.name.getText(tree) === name);
  const code = ts.transpileModule(`const submit = ${declaration.initializer.getText(tree)}; exports.submit = submit;`,
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const warnings = [], requests = [];
  let scopes = 0, resets = 0, validations = 0;
  const ctx = { exports: {}, Date,
    taskNameField: { value: { validate: async () => true } },
    solveType: { value: 'quantum' }, methodType: { value: 'sa' }, matrixSize: { value: 2 }, matrix: { value: [[0, 1], [1, 0]] },
    customTaskName: { value: '保留我的任务名称' },
    quantumDeviceSelector: { value: missing ? undefined : { getSelection() {
      validations += 1;
      assert.equal(ctx.solving.value, false, 'validate before entering solve state');
      if (!valid) throw new Error(message);
      return { computeMode: 'multi', deviceSelection: 'manual', deviceIds: [1, 2] };
    } } },
    solveScope: { begin: () => ++scopes, isCurrent: () => true }, resetSolveLogs: () => { resets += 1; },
    getErrorCode: () => undefined, getErrorMessage: error => error.message,
    ElMessage: { warning: message => warnings.push(message), error() {} },
    submitTask: async payload => { requests.push(payload); return { success: false, message: 'Submission captured' }; },
  };
  for (const field of ['resultExportContext', 'stateClass', 'statusClass', 'solveTime', 'candidates',
    'solveTaskResults', 'partition', 'currentTaskId', 'stateText', 'statusText', 'solveCandidates',
    'currentRoute', 'bestRoute', 'coloring', 'conflicts', 'numbers', 'logs']) {
    ctx[field] = { value: `previous-${field}` };
  }
  ctx.solving = { value: false };
  ctx.clearCustomTaskName = () => { ctx.customTaskName.value = ''; };
  const before = Object.fromEntries(Object.entries(ctx).filter(([, value]) => value && Object.hasOwn(value, 'value'))
    .filter(([key]) => key !== 'quantumDeviceSelector').map(([key, value]) => [key, value.value]));
  runInNewContext(code, ctx);
  return { ctx, before, warnings, requests, submit: ctx.exports.submit,
    get scopes() { return scopes; }, get resets() { return resets; }, get validations() { return validations; } };
}

for (const view of ['MaxCut', 'Number', 'Coloring', 'TSP', 'General']) {
  test(`${view}: device validation failures preserve the task name, results and idle state`, async () => {
    for (const options of [
      { message: '多台计算请至少选择两台设备' },
      { message: '设备状态正在加载，请稍后提交' },
      { message: '设备列表暂不可用，请稍后重试' },
      { missing: true },
    ]) {
      const f = fixture(view, options);
      await f.submit();
      assert.equal(f.requests.length, 0);
      assert.equal(f.scopes, 0);
      assert.equal(f.resets, 0);
      for (const [key, value] of Object.entries(f.before)) assert.deepEqual(f.ctx[key].value, value, `${view}: ${key} was cleared`);
      assert.deepEqual(f.warnings, [options.missing ? '设备配置正在初始化，请稍后重试' : options.message]);
    }
  });
}

test('valid selection is captured once before solve state and sent in the payload', async () => {
  const f = fixture('MaxCut', { valid: true });
  await f.submit();
  assert.equal(f.validations, 1);
  assert.equal(f.scopes, 1);
  assert.equal(f.requests.length, 1);
  const payload = JSON.parse(JSON.stringify(f.requests[0]));
  assert.equal(payload.computeMode, 'multi');
  assert.equal(payload.deviceSelection, 'manual');
  assert.deepEqual(payload.deviceIds, [1, 2]);
});
