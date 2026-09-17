import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(
  readFileSync(new URL('../src/utils/format.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const exports = {};
runInNewContext(code, { exports });
const { formatSolveTime } = exports;

test('solve times round half up to five decimals and retain the seconds suffix', () => {
  for (const [input, expected] of [
    ['0.0044s', '0.00440s'], ['0.0045s', '0.00450s'],
    ['1.2345s', '1.23450s'], ['1.0005s', '1.00050s'],
    ['9.9995s', '9.99950s'], ['12.34567s', '12.34567s'],
    ['0.000005s', '0.00001s'], ['9.999995s', '10.00000s'],
    ['0.13949499999999998s', '0.13949s'], ['0s', '0.00000s'], ['2s', '2.00000s'],
    [0, '0.00000'], [1.2345, '1.23450'], [' 0.0045s ', '0.00450s'],
  ]) assert.equal(formatSolveTime(input), expected, String(input));
});

test('missing and invalid solve times stay empty instead of becoming zero', () => {
  for (const input of [null, undefined, '', ' ', '--', 's', NaN, Infinity, true]) {
    assert.equal(formatSolveTime(input), '--', String(input));
  }
});
