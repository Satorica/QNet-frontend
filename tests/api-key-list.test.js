import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { compileScript, parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import * as vue from 'vue';

const rateLimits = {};
runInNewContext(ts.transpileModule(
  readFileSync(new URL('../src/content/api-rate-limits.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText, { exports: rateLimits });

const { descriptor } = parse(readFileSync(new URL('../src/views/ApiCenter.vue', import.meta.url), 'utf8'));
const source = compileScript(descriptor, { id: 'api-key-list' }).content.replaceAll('import.meta.env', '__testEnv');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function fixture(initialKeys, apiOverrides = {}) {
  let keys = initialKeys;
  const unmountCallbacks = [];
  const mocks = {
    vue: { ...vue, onMounted() {}, onBeforeUnmount: callback => unmountCallbacks.push(callback) },
    'element-plus': { ElMessage: { success() {}, error() {}, warning() {} } },
    '@element-plus/icons-vue': {},
    '../api': { getApiKeys: async () => ({
      enabled: true, maxKeys: 5, limits: { submit: 60, read: 600, cancel: 60 }, keys,
    }), ...apiOverrides },
    '../components/ApiDocumentation.vue': {},
    '../utils/emailSettings': {},
    '../content/api-rate-limits': rateLimits,
  };
  const exports = {};
  runInNewContext(code, { exports, require: name => mocks[name], __testEnv: { VITE_API_BASE_URL: 'https://example.test' } });
  const state = exports.default.setup({}, { expose() {} });
  return { state, unmount: () => unmountCallbacks.forEach(callback => callback()), refreshWith: async next => { keys = next; await state.loadKeys(); } };
}

test('leaving API center clears dialogs and secrets and discards a late creation response', async () => {
  let resolveCreate;
  const f = fixture([{ id: 'active-key', revokedAt: null }], {
    createApiKey: () => new Promise(resolve => { resolveCreate = resolve; }),
  });
  await f.state.loadKeys();
  f.state.managerActive.value = true;
  f.state.keyName.value = 'new key';
  f.state.createOpen.value = true;
  f.state.renameOpen.value = true;
  f.state.deleteOpen.value = true;
  f.state.secret.value = 'previous-secret';
  f.state.secretOpen.value = true;
  const pending = f.state.create();
  f.unmount();
  resolveCreate({ apiKey: 'late-secret' });
  await pending;
  assert.equal(f.state.secret.value, '');
  assert.equal(f.state.secretOpen.value, false);
  assert.equal(f.state.createOpen.value, false);
  assert.equal(f.state.renameOpen.value, false);
  assert.equal(f.state.deleteOpen.value, false);
  assert.equal(f.state.visibleKeys.value.length, 0);
});

test('key list hides revoked records and refreshes after account-wide revocation', async () => {
  const keys = [
    { id: 'valid-a', name: 'script A', revokedAt: null },
    { id: 'revoked-b', name: 'script B', revokedAt: '2026-10-12T09:00:00' },
    { id: 'valid-c', name: 'script C', revokedAt: null },
  ];
  const f = fixture(keys);
  await f.state.loadKeys();
  assert.deepEqual(Array.from(f.state.visibleKeys.value, key => key.id), ['valid-a', 'valid-c']);
  assert.equal(f.state.activeKeys.value, 2);
  // Historical records are preserved; only the displayed list is filtered.
  assert.equal(f.state.overview.value.keys.length, 3);
  await f.refreshWith(keys.map(key => ({ ...key, revokedAt: '2026-10-12T10:00:00' })));
  assert.equal(f.state.visibleKeys.value.length, 0);
  assert.equal(f.state.activeKeys.value, 0);
  assert.equal(f.state.overview.value.keys.length, 3);
});

test('only active keys consume the creation limit and revoked history stays hidden', async () => {
  const keys = Array.from({ length: 5 }, (_, i) => ({ id: String(i), revokedAt: null }));
  const f = fixture([...keys, { id: 'old-key', revokedAt: '2026-10-11T10:00:00' }]);
  await f.state.loadKeys();
  assert.equal(f.state.activeKeys.value, f.state.overview.value.maxKeys);
  await f.refreshWith(keys.slice(1));
  assert.equal(f.state.activeKeys.value, 4);
  assert.deepEqual(Array.from(f.state.visibleKeys.value, key => key.id), ['1', '2', '3', '4']);
});
