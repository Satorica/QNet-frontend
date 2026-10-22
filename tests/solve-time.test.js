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
const { formatDeviceOverheadTime, formatSolveTime } = exports;

test('solve times round half up to two millisecond decimals and convert seconds to milliseconds', () => {
  for (const [input, expected] of [
    ['0.0044s', '4.40ms'], ['0.0045s', '4.50ms'],
    ['1.2345s', '1234.50ms'], ['1.0005s', '1000.50ms'],
    ['9.9995s', '9999.50ms'], ['12.34567s', '12345.67ms'],
    ['0.03494s', '34.94ms'], ['34.94ms', '34.94ms'],
    ['0.000005s', '0.01ms'], ['9.999995s', '10000.00ms'],
    ['0.13949499999999998s', '139.49ms'], ['0s', '0.00ms'], ['2s', '2000.00ms'],
    [0, '0.00ms'], [1.2345, '1234.50ms'], [' 0.0045s ', '4.50ms'],
  ]) assert.equal(formatSolveTime(input), expected, String(input));
});

test('missing and invalid solve times stay empty instead of becoming zero', () => {
  for (const input of [null, undefined, '', ' ', '--', 's', 'ms', '-1s', NaN, Infinity, true]) {
    assert.equal(formatSolveTime(input), '--', String(input));
  }
});

test('completed classic tasks show zero for device overhead timings', () => {
  assert.equal(formatDeviceOverheadTime(undefined, 'classic', true), '0.00ms');
  assert.equal(formatDeviceOverheadTime(null, 'classic', true), '0.00ms');
  assert.equal(formatDeviceOverheadTime(undefined, 'classic', false), '--');
});

test('quantum device overhead timings preserve API values and missing placeholders', () => {
  assert.equal(formatDeviceOverheadTime('0.00036s', 'quantum', true), '0.36ms');
  assert.equal(formatDeviceOverheadTime(undefined, 'quantum', true), '--');
});
