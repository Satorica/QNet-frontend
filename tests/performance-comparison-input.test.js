import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { parse } from '@vue/compiler-sfc';
import ts from 'typescript';

const transpile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
function loadUtility(name) { const exports = {}; runInNewContext(transpile(readFileSync(new URL(`../src/utils/${name}.ts`, import.meta.url), 'utf8')), { exports }); return exports; }
const validators = loadUtility('validation');
const { assertComparisonMatrix } = loadUtility('performanceComparison');
const plain = value => JSON.parse(JSON.stringify(value));
function fixture(page) {
  const source = parse(readFileSync(new URL(`../src/views/${page}.vue`, import.meta.url), 'utf8')).descriptor.scriptSetup.content;
  const tree = ts.createSourceFile(page, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const declarations = tree.statements.filter(ts.isVariableStatement).flatMap(statement => [...statement.declarationList.declarations]);
  const names = page === 'Number' ? ['parseNumberInput', 'assertMatchedNumberSize', 'prepareComparisonTask'] : ['prepareComparisonTask'];
  const code = names.map(name => `const ${name} = ${declarations.find(item => item.name.getText(tree) === name).initializer.getText(tree)};`).join('\n');
  let conversions = 0, selections = 0;
  const ctx = {
    exports: {}, ...validators, assertComparisonMatrix,
    isBusy: { value: false }, solving: { value: false }, importing: { value: false },
    taskNameField: { value: { validate: async () => true } },
    quantumDeviceSelector: { value: { getSelection: () => { selections++; return { computeMode: 'multi', deviceSelection: 'manual', deviceIds: [1, 3] }; } } },
    customTaskName: { value: '当前任务' }, methodType: { value: 'genetic' },
    matrixSize: { value: 2 }, nodeCount: { value: 2 }, cityCount: { value: 2 }, numberSize: { value: 2 },
    matrix: { value: [[0, 8], [8, 0]] }, adjacencyMatrix: { value: [[0, 9], [9, 0]] },
    distanceMatrix: { value: [[0, 13], [13, 0]] }, cities: { value: [{ id: 0, x: 1, y: 2 }, { id: 1, x: 9, y: 4 }] },
    numberInput: { value: '31, 47' }, numbers: { value: [1, 2] },
    inputMode: { value: 'expression' }, expressionForm: { value: 'scalar' }, variableNames: { value: ['x1', 'x2'] },
    matrixVariableNames: { value: ['x1', 'x2'] }, variableDomain: { value: 'spin' }, objectiveSense: { value: 'maximize' },
    objectiveExpression: { value: 'x1*x2' }, matrixObjectiveKind: { value: 'quadratic' }, weightMatrixText: { value: '' },
    linearVectorText: { value: '' }, constantText: { value: '0' },
    buildExpressionQubo: () => { conversions++; return { matrix: [[-1, 2], [2, -1]], slackVariableNames: [], activeConstraints: [{ coefficients: 'x1', operator: '==', rhs: '1', penalty: 20 }] }; },
    copyDirectQuboMatrix: () => [[7, 0], [0, 7]],
  };
  runInNewContext(transpile(code + '\nexports.prepare = prepareComparisonTask;'), ctx);
  return { ctx, prepare: ctx.exports.prepare, get conversions() { return conversions; }, get selections() { return selections; } };
}

const componentSource = parse(readFileSync(new URL('../src/components/PerformanceComparison.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content;
const componentTree = ts.createSourceFile('PerformanceComparison.ts', componentSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const startSource = componentTree.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name.text === 'start').getText(componentTree);
function startFixture(prepareTask, busyChanged = () => {}) {
  const submissions = [], warnings = [];
  const ctx = {
    exports: {}, props: { prepareTask, disabled: false },
    preparing: { value: false }, running: { value: false }, disposed: false,
    emit(name, busy) { if (name === 'busy-change') busyChanged(busy); },
    controller: { async start(input) { submissions.push(input); ctx.running.value = true; } },
    ElMessage: { warning: message => warnings.push(message) }, getErrorMessage: error => error.message,
  };
  runInNewContext(transpile(startSource + '\nexports.start = start;'), ctx);
  return { ctx, start: ctx.exports.start, submissions, warnings };
}

for (const page of ['MaxCut', 'Number', 'Coloring', 'TSP', 'General']) {
  test(`${page}: comparison prepares current editor values and current settings without resubmitting input`, async () => {
    const f = fixture(page); const prepared = plain(await f.prepare());
    assert.equal(prepared.taskName, '当前任务'); assert.equal(prepared.methodType, 'genetic');
    assert.deepEqual(prepared.deviceIds, [1, 3]); assert.equal(f.selections, 1);
    const expected = { MaxCut: [[0, 8], [8, 0]], Number: [31, 47], Coloring: [[0, 9], [9, 0]], TSP: [[0, 13], [13, 0]], General: [[-1, 2], [2, -1]] }[page];
    assert.deepEqual(prepared.adjacencyMatrix, expected);
    assert.equal(prepared.matrixSize, 2);
    if (page === 'TSP') assert.deepEqual(prepared.cities, f.ctx.cities.value);
    if (page === 'General') {
      assert.equal(f.conversions, 1);
      assert.equal(prepared.generalInput.expression, 'x1*x2'); assert.equal(prepared.generalInput.domain, 'spin');
      assert.equal(prepared.generalInput.constraints[0].penalty, 20);
    }
  });
  test(`${page}: busy or invalid task name prevents preparation`, async () => {
    const f = fixture(page); f.ctx.isBusy.value = true;
    assert.equal(await f.prepare(), null); assert.equal(f.selections, 0);
    f.ctx.isBusy.value = false; f.ctx.taskNameField.value.validate = async () => false;
    assert.equal(await f.prepare(), null); assert.equal(f.selections, 0);
  });
  test(`${page}: comparison reserves the page during name validation without blocking its own preparation`, async () => {
    const f = fixture(page); let resolveValidation;
    const validation = new Promise(resolve => { resolveValidation = resolve; });
    f.ctx.taskNameField.value.validate = () => {
      assert.equal(f.ctx.isBusy.value, false, 'name validation must start before the name field is disabled');
      return validation;
    };
    const component = startFixture(f.prepare, busy => { f.ctx.isBusy.value = busy; });
    const pending = component.start();
    assert.equal(f.ctx.isBusy.value, true, 'normal solve and input edits must be locked while validation is pending');
    await component.start();
    assert.equal(component.submissions.length, 0);
    resolveValidation(true); await pending;
    assert.equal(component.submissions.length, 1);
    assert.equal(component.submissions[0].taskName, '当前任务');
    assert.equal(component.ctx.preparing.value, false);
    assert.equal(f.ctx.isBusy.value, true, 'the running comparison must keep the page locked');
  });
}

test('invalid or rejected preparation releases the page and permits another attempt', async () => {
  const busy = [];
  const component = startFixture(async () => null, value => busy.push(value));
  await component.start();
  assert.deepEqual(busy, [true, false]); assert.equal(component.submissions.length, 0);
  component.ctx.props.prepareTask = async () => { throw new Error('输入不完整'); };
  await component.start();
  assert.deepEqual(busy, [true, false, true, false]); assert.deepEqual(component.warnings, ['输入不完整']);
  assert.equal(component.ctx.preparing.value, false);
});
test('number comparison validates the text actually shown, including size and integer constraints', async () => {
  const f = fixture('Number');
  for (const value of ['3', '3,4,5', '3,-4', 'NaN,4', '1.5,4']) {
    f.ctx.numberInput.value = value; await assert.rejects(f.prepare());
  }
});
test('general matrix mode captures direct QUBO without evaluating an inactive expression draft', async () => {
  const f = fixture('General'); f.ctx.inputMode.value = 'matrix';
  const prepared = plain(await f.prepare());
  assert.equal(f.conversions, 0); assert.deepEqual(prepared.adjacencyMatrix, [[7, 0], [0, 7]]);
  assert.equal(prepared.generalInput.source, 'matrix'); assert.equal(prepared.generalInput.domain, 'binary');
  assert.equal(prepared.generalInput.expression, ''); assert.deepEqual(prepared.generalInput.constraints, []);
});
