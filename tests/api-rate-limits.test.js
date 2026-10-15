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
const renderLimits = props => renderToString(createSSRApp(componentExports.default, { limits, ...props }));

test('submit documentation renders only the configured per-minute account limit', async () => {
  const html = await renderLimits({ operation: 'submit',
    operationLimits: { submit: { minute: 4800 } } });
  assert.match(html, /4,800 个任务／分钟/);
  assert.match(html, /账号限流/);
  assert.doesNotMatch(html, /每秒恢复|突发上限|共享|Retry-After|idempotencyKey|<table|<p[ >]/);
});

test('non-submit documentation renders its own per-minute limit and unit', async () => {
  for (const operation of ['status', 'result', 'read', 'cancel']) {
    const html = await renderLimits({ operation,
      operationLimits: { [operation]: { minute: 1234 } } });
    assert.ok(html.includes(`1,234 ${rules.operationDescriptions[operation].unit}／分钟`));
    assert.doesNotMatch(html, /每秒恢复|突发上限|共享|Retry-After|<table|<p[ >]/);
  }
});

test('missing operation configuration falls back to the corresponding account limit', async () => {
  for (const operation of Object.keys(limits)) {
    const html = await renderLimits({ operation });
    assert.ok(html.includes(`${limits[operation].toLocaleString('zh-CN')} ${rules.operationDescriptions[operation].unit}／分钟`));
  }
});
