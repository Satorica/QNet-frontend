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

const expectedLimits = {
  submit: 6000, batchSubmit: 120, status: 18000, batchStatus: 600,
  result: 6000, batchResult: 600, cancel: 6000, batchCancel: 240, read: 600, quota: 120,
};

test('all ten endpoints select independent request budgets with the agreed defaults', () => {
  for (const [endpoint, kind] of Object.entries({
    submit: 'submit', 'batch-submit': 'batchSubmit', status: 'status', 'batch-status': 'batchStatus',
    result: 'result', 'batch-results': 'batchResult', cancel: 'cancel', 'batch-cancel': 'batchCancel',
    list: 'read', quota: 'quota',
  })) assert.equal(rules.apiOperation(endpoint), kind);
  assert.deepEqual({ ...rules.defaultApiLimits }, expectedLimits);
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
const limits = expectedLimits;
const renderLimits = props => renderToString(createSSRApp(componentExports.default, { limits, ...props }));

test('each endpoint renders its own runtime request limit and account sharing rules', async () => {
  for (const operation of Object.keys(limits)) {
    const html = await renderLimits({ operation, operationLimits: { [operation]: { minute: 1234 } } });
    assert.match(html, /1,234 次请求／分钟/);
    assert.ok(html.includes(rules.operationDescriptions[operation].label));
    assert.match(html, /每个 HTTP 请求计 1 次/);
    assert.match(html, /同账号所有 API Key 共享本接口限额/);
    assert.match(html, /分别限流/);
    assert.match(html, /重复请求也计数/);
    assert.match(html, /429.*Retry-After/);
    assert.doesNotMatch(html, /每个任务计|按任务数累计|个任务 ID／分钟|每秒恢复|突发上限/);
  }
});

test('batch docs render request limits independently of item count', async () => {
  for (const [operation, size] of [['batchSubmit', 100], ['batchStatus', 100], ['batchResult', 20], ['batchCancel', 50]]) {
    const html = await renderLimits({ operation });
    assert.ok(html.includes(`${limits[operation].toLocaleString('zh-CN')} 次请求／分钟`));
    assert.ok(html.includes(`每批最多 ${size} 个任务`));
  }
});

test('missing runtime settings fall back to the same endpoint rather than another budget', async () => {
  for (const operation of Object.keys(limits)) {
    const html = await renderLimits({ operation, limits: { ...limits, [operation]: 4321 } });
    assert.match(html, /4,321 次请求／分钟/);
    const fallback = await renderLimits({ operation, limits: {} });
    assert.ok(fallback.includes(`${limits[operation].toLocaleString('zh-CN')} 次请求／分钟`));
  }
});
