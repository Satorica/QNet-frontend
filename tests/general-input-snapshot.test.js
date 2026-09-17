import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/views/General.vue', import.meta.url), 'utf8');
const start = source.indexOf('const generalInput: GeneralInputSnapshot =');
const end = source.indexOf('const payload: TaskSubmitRequest =', start);
assert.ok(start >= 0 && end > start);
const code = ts.transpileModule(`${source.slice(start, end)}\ngeneralInput;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText;

for (const mode of ['scalar', 'vector', 'matrix']) {
  test(`general ${mode} snapshot retains active inputs and discards inactive drafts at size 256`, () => {
    const names = Array.from({ length: 256 }, (_, i) => `x${i + 1}`);
    const weight = 'W = [' + Array(256).fill('[' + Array(256).fill('0').join(',') + ']').join(',') + ']';
    const vector = 'c = [' + Array(256).fill('0').join(',') + ']';
    const constraints = [{ coefficients: 'x1', operator: '==', rhs: '1', penalty: 1 }];
    const context = {
      submittedInputMode: mode === 'matrix' ? 'matrix' : 'expression',
      expressionForm: { value: mode === 'vector' ? 'vector' : 'scalar' },
      submittedVariables: names, expressionResult: { slackVariableNames: [], activeConstraints: constraints },
      variableDomain: { value: 'spin' }, objectiveSense: { value: 'maximize' },
      objectiveExpression: { value: 'x1' }, matrixObjectiveKind: { value: 'maxcut' },
      weightMatrixText: { value: weight }, linearVectorText: { value: vector }, constantText: { value: '7' },
    };
    const snapshot = JSON.parse(JSON.stringify(runInNewContext(code, context)));
    assert.deepEqual(snapshot.variables, names);
    assert.equal(snapshot.expression, mode === 'scalar' ? 'x1' : '');
    assert.deepEqual(snapshot.matrixObjective, mode === 'vector'
      ? { kind: 'maxcut', weightMatrix: weight, linearVector: vector, constant: '7' }
      : { kind: 'quadratic', weightMatrix: '', linearVector: '', constant: '0' });
    assert.deepEqual(snapshot.constraints, mode === 'matrix' ? [] : constraints);
    assert.equal(snapshot.domain, mode === 'matrix' ? 'binary' : 'spin');
    assert.equal(snapshot.sense, mode === 'matrix' ? 'minimize' : 'maximize');
  });
}
