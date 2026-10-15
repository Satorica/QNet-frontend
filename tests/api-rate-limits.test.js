import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { compileScript, parse } from '@vue/compiler-sfc';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';
import ts from 'typescript';

const source = readFileSync(new URL('../src/content/api-rate-limits.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const rules = {};
runInNewContext(code, { exports: rules });

test('each public endpoint selects its own budget and documented unit', () => {
  for (const [kind, endpoints, unit] of [
    ['submit', ['submit', 'batch-submit'], '个任务'],
    ['status', ['status', 'batch-status'], '个任务 ID'],
    ['result', ['result', 'batch-results'], '个任务 ID'],
    ['cancel', ['cancel', 'batch-cancel'], '个任务 ID'],
    ['read', ['list', 'quota'], '次请求'],
  ]) {
    for (const endpoint of endpoints) assert.equal(rules.apiOperation(endpoint), kind);
    assert.equal(rules.operationDescriptions[kind].unit, unit);
  }
});

const componentUrl = new URL('../src/components/ApiRateLimits.vue', import.meta.url);
const { descriptor } = parse(readFileSync(componentUrl, 'utf8'), { filename: componentUrl.pathname });
const componentSource = compileScript(descriptor, {
  id: 'api-rate-limits', inlineTemplate: true, templateOptions: { ssr: true },
}).content;
const componentCode = ts.transpileModule(componentSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const componentExports = {};
const require = createRequire(import.meta.url);
runInNewContext(componentCode, {
  exports: componentExports,
  require: name => name === '../content/api-rate-limits' ? rules : require(name),
});
const limits = { submit: 6000, status: 18000, result: 6000, read: 600, cancel: 6000 };
const submissionLimits = {
  account: { rate: 81, burst: 101 }, global: { rate: 207, burst: 307 },
  classic: { rate: 153, burst: 103 }, quantum: { rate: 157, burst: 107 },
};
const renderLimits = props => renderToString(createSSRApp(componentExports.default, { limits, ...props }));

test('submit documentation renders actual account and shared budgets with retry instructions', async () => {
  const html = await renderLimits({ operation: 'submit', submissionLimits,
    operationLimits: { submit: { minute: 4800, rate: 80, burst: 100 } } });
  assert.match(html, /4,800 个任务／分钟/);
  assert.match(html, /80 \/ 100 个任务/);
  for (const [label, rate, burst] of [
    ['所有公开 API 账号合计', 207, 307], ['公开 API 经典通道', 153, 103], ['公开 API 量子通道', 157, 107],
  ]) assert.match(html, new RegExp(`<td[^>]*>${label}</td><td[^>]*>${rate}</td><td[^>]*>${burst}</td>`));
  assert.match(html, /同账号全部 API Key/);
  assert.match(html, /低于账号限额时仍可能收到 429/);
  assert.match(html, /429 RATE_LIMITED/);
  assert.match(html, /Retry-After/);
  assert.match(html, /等待指定秒数后重试/);
  assert.match(html, /Idempotency-Key/);
  assert.match(html, /idempotencyKey/);
});

test('non-submit documentation uses its own budget and does not show submission pools', async () => {
  for (const operation of ['status', 'result', 'read', 'cancel']) {
    const html = await renderLimits({ operation, submissionLimits,
      operationLimits: { [operation]: { minute: 1234, rate: 23, burst: 123 } } });
    assert.match(html, /1,234/);
    assert.match(html, /23 \/ 123/);
    assert.match(html, /Retry-After/);
    assert.match(html, /HTTP 请求次数/);
    assert.doesNotMatch(html, /跨账号共享提交限额|Idempotency-Key/);
  }
});

test('missing shared configuration is explicit and account fallback remains usable', async () => {
  const missing = await renderLimits({ operation: 'submit' });
  assert.match(missing, /6,000 个任务／分钟/);
  assert.match(missing, /共享限额配置暂不可用/);
  assert.doesNotMatch(missing, /<table/);
  const fallback = await renderLimits({ operation: 'submit', submissionLimits });
  assert.match(fallback, /81 \/ 101 个任务/);
});
