import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { compileScript, parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import * as vue from 'vue';

const source = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');
const transpile = text => ts.transpileModule(text, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const component = path => transpile(compileScript(parse(source(path)).descriptor, { id: path }).content);
const topBarCode = component('components/TopBar.vue');
const emailCode = component('components/EmailSettings.vue');
const makeStorage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
};
const failure = (url, status, code) => ({
  isAxiosError: true, config: { url }, response: { status, data: { code, message: '请求失败' } },
});

// Execute the real interceptor, auth store and both component setups together.
function fixture(t, { loggedIn = true, verificationError = failure('/auth/verify', 401) } = {}) {
  const localStorage = makeStorage(), sessionStorage = makeStorage();
  const auth = {}, authApi = {}, api = {}, emailSettings = {};
  const navigation = [], disposers = [];
  const scope = vue.effectScope();
  const window = { location: { pathname: '/maxcut' } };
  let rejectResponse;
  const cloud = {
    interceptors: { request: { use() {} }, response: { use: (_ok, fail) => { rejectResponse = fail; } } },
    get: async () => rejectResponse(verificationError),
  };
  const mocks = {
    vue: { ...vue, onMounted() {}, onUnmounted: callback => disposers.push(callback) },
    axios: { default: { create: () => cloud, isAxiosError: error => error?.isAxiosError === true } },
    'element-plus': { ElMessage: { success() {} } },
    'vue-router': { useRouter: () => ({ replace: path => navigation.push(path) }) },
    '../utils/auth': auth,
    '../api/auth': authApi,
    './index': api,
    '../utils/emailSettings': emailSettings,
    '../utils/validation': { EMAIL_REGEX: /.+@.+\..+/ },
    '../api/profile': { profileApi: { get: async () => ({ nickname: '用户', avatarUrl: '', gender: '保密', birthday: '' }) } },
  };
  function execute(code, exports = {}) {
    runInNewContext(code, { exports, require: name => mocks[name] || {}, localStorage, sessionStorage, window, setInterval, clearInterval });
    return exports;
  }
  execute(transpile(source('utils/emailSettings.ts')), emailSettings);
  execute(transpile(source('api/index.ts').replaceAll('import.meta.env.DEV', 'true').replaceAll('import.meta.env.VITE_API_BASE_URL', "''")), api);
  execute(transpile(source('api/auth.ts')), authApi);
  execute(transpile(source('utils/auth.ts')), auth);
  mocks['../utils/error'] = execute(transpile(source('utils/error.ts')));
  if (loggedIn) {
    localStorage.setItem('rememberMe', 'true');
    auth.userManager.setUserInfo({ id: 'user-1', nickname: '用户', maskedEmail: '', hasPassword: false }, true);
  }
  const setup = code => scope.run(() => execute(code).default.setup({}, { expose() {}, emit() {} }));
  const topBar = setup(topBarCode);
  const email = setup(emailCode);
  t.after(() => { scope.stop(); disposers.forEach(dispose => dispose()); });
  return { auth, topBar, email, emailSettings, localStorage, navigation, rejectResponse, window };
}

test('expired verification in email settings clears reactive auth, closes dialogs and returns to login', async t => {
  const f = fixture(t);
  // Prime the same computed caches used by the rendered top bar.
  assert.equal(f.topBar.isLoggedIn.value, true);
  assert.equal(f.topBar.userInfo.value.id, 'user-1');
  f.emailSettings.openEmailSettings();
  await vue.nextTick();
  await f.email.loadUser();
  await vue.nextTick();
  assert.equal(f.topBar.isLoggedIn.value, false);
  assert.equal(f.topBar.userInfo.value, null);
  assert.equal(f.auth.serverSessionManager.getStatus(), 'unknown');
  assert.equal(f.localStorage.getItem('rememberMe'), null);
  assert.equal(f.emailSettings.emailSettingsVisible.value, false);
  assert.equal(f.topBar.profileEditorVisible.value, false);
  assert.deepEqual(f.navigation, ['/login']);
});

test('network failure leaves email settings open with a retryable error and keeps the session', async t => {
  const f = fixture(t, { verificationError: { isAxiosError: true, config: { url: '/auth/verify' }, message: '网络连接失败' } });
  f.emailSettings.openEmailSettings();
  await f.email.loadUser();
  await vue.nextTick();
  assert.equal(f.topBar.isLoggedIn.value, true);
  assert.equal(f.emailSettings.emailSettingsVisible.value, true);
  assert.equal(f.email.loadError.value, '网络连接失败');
  assert.deepEqual(f.navigation, []);
});

test('expired link tickets keep the reactive session and email dialog intact', async t => {
  const f = fixture(t);
  f.emailSettings.openEmailSettings();
  await assert.rejects(() => f.rejectResponse(failure('/auth/email/confirm-link', 401, 'TICKET_EXPIRED')));
  await vue.nextTick();
  assert.equal(f.topBar.isLoggedIn.value, true);
  assert.equal(f.emailSettings.emailSettingsVisible.value, true);
  assert.equal(f.auth.serverSessionManager.getStatus(), 'authenticated');
  assert.deepEqual(f.navigation, []);
});

test('initial unauthenticated top bar waits for session restoration without redirecting', async t => {
  const f = fixture(t, { loggedIn: false });
  await vue.nextTick();
  assert.equal(f.topBar.isLoggedIn.value, false);
  assert.deepEqual(f.navigation, []);
  f.auth.userManager.setUserInfo({ id: 'restored-user', nickname: '用户' });
  await vue.nextTick();
  assert.equal(f.topBar.isLoggedIn.value, true);
  assert.deepEqual(f.navigation, []);
});
