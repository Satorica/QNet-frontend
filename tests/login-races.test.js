import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { compileScript, parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import * as vue from 'vue';

const require = createRequire(import.meta.url);
const Schema = require('async-validator').default;
const validationExports = {};
const validationSource = readFileSync(new URL('../src/utils/validation.ts', import.meta.url), 'utf8');
new Function('exports', ts.transpileModule(validationSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText)(validationExports);
const compiled = new Map();
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = () => new Promise(setImmediate);

// Compile the real SFC setup functions; only external I/O and lifecycle
// registration are mocked so response ordering can be controlled precisely.
function setupComponent(relativePath, mocks, emit = () => {}) {
  if (!compiled.has(relativePath)) {
    const filename = new URL(relativePath, import.meta.url).pathname;
    const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
    const { descriptor } = parse(source, { filename });
    const script = compileScript(descriptor, { id: relativePath });
    compiled.set(relativePath, ts.transpileModule(script.content, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText);
  }
  const mounted = [], unmounted = [], timers = [];
  const exports = {};
  runInNewContext(compiled.get(relativePath), {
    exports,
    require: name => name === 'vue'
      ? { ...vue, onMounted: fn => mounted.push(fn), onUnmounted: fn => unmounted.push(fn), onBeforeUnmount: fn => unmounted.push(fn) }
      : Object.hasOwn(mocks, name) ? mocks[name] : require(name),
    localStorage: { setItem() {}, removeItem() {} },
    setTimeout: fn => { timers.push(fn); return timers.length; },
    clearTimeout() {},
  });
  const state = exports.default.setup({}, { expose() {}, emit });
  return { state, mounted, unmounted, timers };
}

function registrationFixture() {
  const calls = [];
  const { state } = setupComponent('../src/views/Register.vue', {
    '../components/LoginBackground.vue': {},
    'vue-router': { useRouter: () => ({ push() {} }) },
    'element-plus': { ElMessage: { success() {}, error() {} } },
    '../api/auth': { authApi: { register: async payload => { calls.push(payload); return { success: true }; } } },
    '../utils/validation': validationExports,
    '../utils/error': { getErrorCode: () => '', getErrorMessage: (_error, fallback) => fallback },
    '../assets/brand-logo.svg': 'brand-logo.svg',
  });
  Object.assign(state.registerForm, {
    nickname: '  量子少年 🌟  ', email: 'user@example.com', emailCode: '123456',
    password: 'Example123', confirmPassword: 'Example123', agree: true,
  });
  state.registerFormRef.value = {
    validate: async callback => {
      const valid = await new Schema(state.registerRules.value).validate(state.registerForm)
        .then(() => true, () => false);
      await callback(valid);
    },
  };
  return { state, calls };
}

test('registration submits the trimmed nickname and email without a login username', async () => {
  const f = registrationFixture();
  await f.state.handleRegister();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].nickname, '量子少年 🌟');
  assert.equal(f.calls[0].email, 'user@example.com');
  assert.equal(Object.hasOwn(f.calls[0], 'username'), false);
});

test('registration accepts 1–30 Unicode characters and rejects empty or oversized nicknames', async () => {
  for (const [nickname, accepted] of [['昵', true], ['🌟'.repeat(30), true], ['', false], ['  ', false], ['昵'.repeat(31), false], ['🌟'.repeat(31), false]]) {
    const f = registrationFixture();
    f.state.registerForm.nickname = nickname;
    await f.state.handleRegister();
    assert.equal(f.calls.length, accepted ? 1 : 0, nickname);
  }
});

function loginFixture(mode = 'password') {
  const validation = deferred(), passwordResponse = deferred();
  const calls = [], saved = [], navigation = [];
  let leave;
  const login = setupComponent('../src/views/Login.vue', {
    'vue-router': {
      onBeforeRouteLeave: guard => { leave = guard; },
      useRouter: () => ({
        currentRoute: { value: { query: { mode } } },
        push: path => { assert.equal(leave(), true); navigation.push(path); },
      }),
    },
    'element-plus': { ElMessage: { success() {}, error() {} } },
    '@element-plus/icons-vue': {},
    '../api/auth': { authApi: { login: (...args) => { calls.push(args); return passwordResponse.promise; } } },
    '../utils/auth': { userManager: { setUserInfo: user => saved.push(user) } },
    '../utils/error': { getErrorMessage: (_error, fallback) => fallback },
    '../utils/validation': validationExports,
    '../components/QrLoginPanel.vue': {},
    '../components/LoginBackground.vue': {},
    '../assets/brand-logo.svg': 'brand-logo.svg',
  }).state;
  login.loginFormRef.value = { validate: () => validation.promise };
  return { login, validation, passwordResponse, calls, saved, navigation, canLeave: () => leave() };
}

test('email login rejects usernames, phone numbers, and malformed addresses before sending requests', async () => {
  for (const account of ['web_user', 'wx_existing', '13800138000', 'a@b', '', '  ']) {
    const f = loginFixture();
    f.login.loginForm.account = account;
    f.login.loginForm.password = 'Example123';
    f.login.loginFormRef.value = {
      validate: async () => {
        await new Schema(f.login.loginRules.value).validate(f.login.loginForm);
        return true;
      },
    };
    await f.login.handleLogin();
    assert.equal(f.calls.length, 0, account);
    assert.equal(f.login.loading.value, false);
  }
});

test('email login trims and normalizes the address while preserving password and remember choice', async () => {
  const f = loginFixture();
  f.login.loginForm.account = '  User@Example.COM  ';
  f.login.loginForm.password = 'Example123';
  f.login.loginForm.remember = true;
  f.login.loginFormRef.value = {
    validate: async () => {
      await new Schema(f.login.loginRules.value).validate(f.login.loginForm);
      return true;
    },
  };
  const pending = f.login.handleLogin();
  await flush();
  assert.deepEqual(f.calls, [['user@example.com', 'Example123', true]]);
  f.passwordResponse.resolve({ success: true, data: { user: { id: 'email-user' } } });
  await pending;
  assert.equal(f.saved[0].id, 'email-user');
});

test('password validation and submission block QR switching, duplicate login, and early navigation', async () => {
  const f = loginFixture();
  const pending = f.login.handleLogin();
  f.login.switchLoginMode('qr');
  await f.login.handleLogin();
  f.login.goToRegister();
  f.login.goToForgotPassword();
  assert.equal(f.login.loginMode.value, 'password');
  assert.equal(f.canLeave(), false);
  assert.equal(f.calls.length, 0);
  assert.deepEqual(f.navigation, []);

  f.validation.resolve(true);
  await flush();
  f.login.switchLoginMode('qr');
  await f.login.handleLogin();
  assert.equal(f.login.loginMode.value, 'password');
  assert.equal(f.calls.length, 1);
  assert.equal(f.canLeave(), false);

  f.passwordResponse.resolve({ success: true, data: { user: { id: 'password-user' } } });
  await pending;
  assert.equal(f.saved[0].id, 'password-user');
  assert.deepEqual(f.navigation, ['/maxcut']);
  assert.equal(f.canLeave(), true);
});

for (const failure of ['validation', 'request']) {
  test(`password ${failure} failure unlocks mode switching and navigation`, async () => {
    const f = loginFixture();
    const pending = f.login.handleLogin();
    if (failure === 'validation') f.validation.reject(new Error('Invalid form'));
    else {
      f.validation.resolve(true);
      await flush();
      f.passwordResponse.reject(new Error('Network failure'));
    }
    await pending;
    f.login.switchLoginMode('qr');
    assert.equal(f.login.loginMode.value, 'qr');
    assert.equal(f.canLeave(), true);
    assert.equal(f.saved.length, 0);
  });
}

function qrFixture(f) {
  const redemption = deferred(), status = deferred();
  const calls = [];
  const panel = setupComponent('../src/components/QrLoginPanel.vue', {
    '../api': { cloudApi: {
      get: () => status.promise,
      post: url => {
        calls.push(url);
        if (url.endsWith('/redeem')) {
          assert.equal(f.login.loginPending.value, true);
          return redemption.promise;
        }
        return Promise.resolve({ data: { success: true, data: {
          requestId: 'qr-id', image: 'image', expiresAt: Date.now() / 1000 + 180,
        } } });
      },
    } },
    '../utils/error': { getErrorMessage: (_error, fallback) => fallback },
  }, (event, value) => {
    if (event === 'redeeming') f.login.qrRedeeming.value = value;
    if (event === 'logged-in') f.login.finishQrLogin(value);
  });
  return { ...panel, redemption, status, calls };
}

for (const succeeds of [true, false]) {
  test(`QR redemption blocks password login until it settles (success=${succeeds})`, async () => {
    const f = loginFixture('qr');
    const qr = qrFixture(f);
    await qr.mounted[0]();
    qr.status.resolve({ data: { success: true, data: { state: 'confirmed' } } });
    const pending = qr.timers.shift()();
    await flush();
    f.login.switchLoginMode('password');
    await f.login.handleLogin();
    assert.equal(f.login.loginMode.value, 'qr');
    assert.equal(f.canLeave(), false);
    assert.equal(f.calls.length, 0);
    assert.equal(qr.calls.filter(url => url.endsWith('/redeem')).length, 1);

    if (succeeds) qr.redemption.resolve({ data: { success: true, data: { user: { id: 'qr-user' } } } });
    else qr.redemption.reject(new Error('Network failure'));
    await pending;
    assert.equal(f.login.loginPending.value, false);
    assert.equal(f.canLeave(), true);
    if (succeeds) {
      assert.equal(f.saved[0].id, 'qr-user');
      assert.deepEqual(f.navigation, ['/maxcut']);
    } else {
      f.login.switchLoginMode('password');
      assert.equal(f.login.loginMode.value, 'password');
      assert.equal(f.saved.length, 0);
    }
  });
}

test('switching away before QR confirmation prevents a delayed poll from redeeming', async () => {
  const f = loginFixture('qr');
  const qr = qrFixture(f);
  await qr.mounted[0]();
  const pending = qr.timers.shift()();
  f.login.switchLoginMode('password');
  qr.unmounted[0]();
  qr.status.resolve({ data: { success: true, data: { state: 'confirmed' } } });
  await pending;
  assert.equal(f.login.loginMode.value, 'password');
  assert.equal(qr.calls.some(url => url.endsWith('/redeem')), false);
  assert.equal(f.login.loginPending.value, false);
});
