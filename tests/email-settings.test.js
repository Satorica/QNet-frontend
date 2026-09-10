import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { compileScript, parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import * as vue from 'vue';

const transpile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { descriptor } = parse(readFileSync(new URL('../src/components/EmailSettings.vue', import.meta.url), 'utf8'));
const componentCode = transpile(compileScript(descriptor, { id: 'email-settings' }).content);
const baseUser = { id: 'user-1', nickname: '用户', maskedEmail: '', hasPassword: false, status: 'active', is_verified: false };
const link = { requiresConfirmation: true, linkTicket: 'ticket', preview: { nickname: '已有用户' } };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

function fixture({ initial = baseUser, verify, ...api } = {}) {
  let stored = { ...initial };
  const events = [], writes = [], disposers = [], calls = [];
  const accountApi = {
    sendEmailCode: async email => calls.push(['send', email]),
    changeEmail: async email => ({ user: { ...stored, maskedEmail: email, emailVerified: true } }),
    confirmEmailLink: async ticket => { calls.push(['confirm', ticket]); return { user: { ...stored, maskedEmail: 'linked@example.com' } }; },
    setPassword: async () => ({ hasPassword: true }),
    ...api,
  };
  const mocks = {
    vue: { ...vue, onMounted() {}, onUnmounted: cb => disposers.push(cb) },
    'element-plus': { ElMessage: { success() {} } },
    '@element-plus/icons-vue': {},
    '../api/account': { accountApi },
    '../api/auth': { authApi: { verifyToken: verify || (async () => ({ success: true, data: { user: stored } })) } },
    '../utils/auth': { userManager: { getUserInfo: () => stored, setUserInfo: (user, remember) => { writes.push({ user, remember }); stored = user; } } },
    '../utils/error': { getErrorCode: e => e.code, getErrorMessage: (e, fallback) => e.message || fallback },
    '../utils/validation': { EMAIL_REGEX: /^[^\s@]+@(?:[^\s@.]+\.)+[^\s@.]+$/ },
  };
  const exports = {};
  runInNewContext(componentCode, {
    exports, require: name => mocks[name], localStorage: { getItem: () => 'true' },
    setInterval: () => 1, clearInterval() {},
  });
  const state = exports.default.setup({}, { expose() {}, emit: (...args) => events.push(args) });
  return { state, events, writes, calls, get stored() { return stored; }, switchUser: () => { stored = { ...baseUser, id: 'user-2' }; }, dispose: () => disposers.forEach(cb => cb()) };
}

test('opening refreshes cross-device email/password state and keeps remember preference', async () => {
  const f = fixture({ verify: async () => ({ success: true, data: { user: { ...baseUser, maskedEmail: 'old@example.com', hasPassword: true } } }) });
  await f.state.loadUser();
  assert.equal(f.state.hasEmail.value, true);
  assert.equal(f.state.user.value.hasPassword, true);
  assert.equal(f.writes[0].remember, true);
});

test('initial binding updates user cache and allows optional password setup', async () => {
  const f = fixture();
  await f.state.loadUser();
  f.state.email.value = ' New@Example.com ';
  f.state.code.value = '123456';
  await f.state.submit();
  assert.equal(f.stored.maskedEmail, 'new@example.com');
  assert.equal(f.state.successMessage.value, '邮箱已绑定');
  assert.equal(f.state.completed.value, true);
  f.state.startPasswordSetup();
  f.state.password.value = f.state.passwordAgain.value = 'Example123';
  await f.state.savePassword();
  assert.equal(f.stored.hasPassword, true);
  assert.equal(f.events.at(-1)[0], 'close');
});

test('existing email conflict displays the same backend message and never confirms a merge', async () => {
  const f = fixture({ initial: { ...baseUser, maskedEmail: 'old@example.com' }, changeEmail: async () => { throw Object.assign(new Error('该邮箱已被其他账号使用，请更换邮箱'), { code: 'EMAIL_ALREADY_REGISTERED' }); } });
  await f.state.loadUser();
  f.state.email.value = 'taken@example.com'; f.state.code.value = '123456';
  await f.state.submit();
  assert.equal(f.state.actionError.value, '该邮箱已被其他账号使用，请更换邮箱');
  assert.equal(f.stored.maskedEmail, 'old@example.com');
  assert.equal(f.state.pendingLink.value, null);
  assert.equal(f.calls.length, 0);
});

test('even an unexpected association preview cannot merge an account with an existing email', async () => {
  const f = fixture({ initial: { ...baseUser, maskedEmail: 'old@example.com' }, changeEmail: async () => link });
  await f.state.loadUser();
  f.state.email.value = 'taken@example.com'; f.state.code.value = '123456';
  await f.state.submit();
  assert.equal(f.state.pendingLink.value, null);
  assert.match(f.state.actionError.value, /该邮箱已被其他账号使用/);
  assert.equal(f.calls.length, 0);
});

test('unbound account requires an explicit second action before association', async () => {
  const f = fixture({ changeEmail: async () => link });
  await f.state.loadUser();
  f.state.email.value = 'taken@example.com'; f.state.code.value = '123456';
  await f.state.submit();
  assert.equal(f.calls.length, 0);
  assert.equal(f.state.pendingLink.value.linkTicket, 'ticket');
  await f.state.submit();
  assert.deepEqual(f.calls, [['confirm', 'ticket']]);
  assert.equal(f.state.completed.value, true);
});

test('expired association ticket resets verification without changing the logged-in user', async () => {
  const f = fixture({ changeEmail: async () => link, confirmEmailLink: async () => { throw Object.assign(new Error('expired'), { code: 'TICKET_EXPIRED' }); } });
  await f.state.loadUser();
  f.state.email.value = 'taken@example.com'; f.state.code.value = '123456';
  await f.state.submit(); await f.state.submit();
  assert.equal(f.state.pendingLink.value, null);
  assert.match(f.state.actionError.value, /重新获取邮箱验证码/);
  assert.equal(f.stored.id, 'user-1');
});

test('changing mailbox invalidates verification and countdown', async () => {
  const f = fixture();
  await f.state.loadUser();
  f.state.email.value = 'one@example.com';
  await f.state.sendCode();
  assert.equal(f.state.countdown.value, 60);
  await f.state.sendCode();
  assert.equal(f.calls.length, 1);
  f.state.code.value = '123456'; f.state.pendingLink.value = link;
  f.state.changeAddress('two@example.com');
  assert.equal(f.state.code.value, '');
  assert.equal(f.state.countdown.value, 0);
  assert.equal(f.state.pendingLink.value, null);
});

test('duplicate submit and close are blocked while a request is pending', async () => {
  const request = deferred(); let count = 0;
  const f = fixture({ changeEmail: () => { count++; return request.promise; } });
  await f.state.loadUser();
  f.state.email.value = 'new@example.com'; f.state.code.value = '123456';
  const pending = f.state.submit();
  await f.state.submit(); f.state.close();
  assert.equal(count, 1); assert.equal(f.events.length, 0);
  request.resolve({ user: { ...baseUser, maskedEmail: 'new@example.com' } }); await pending;
});

test('late account responses cannot restore an old user after closing or switching accounts', async () => {
  for (const action of ['dispose', 'switchUser']) {
    const request = deferred();
    const f = fixture({ changeEmail: () => request.promise });
    await f.state.loadUser();
    f.state.email.value = 'new@example.com'; f.state.code.value = '123456';
    const pending = f.state.submit(); f[action]();
    request.resolve({ user: { ...baseUser, maskedEmail: 'new@example.com' } }); await pending;
    assert.equal(f.writes.length, 1);
    assert.equal(f.state.completed.value, false);
  }
});

test('only expired email confirmation tickets bypass the auth failure handler; solve errors open binding', async () => {
  let rejectResponse;
  const removed = [], opened = [];
  const instance = { interceptors: { request: { use() {} }, response: { use: (_ok, fail) => { rejectResponse = fail; } } } };
  const source = readFileSync(new URL('../src/api/index.ts', import.meta.url), 'utf8')
    .replaceAll('import.meta.env.DEV', 'true').replaceAll('import.meta.env.VITE_API_BASE_URL', "''");
  runInNewContext(transpile(source), {
    exports: {}, require: name => name === 'axios' ? { default: { create: () => instance } }
      : name === '../utils/auth' ? { tokenManager: { clearTokens: () => removed.push('auth-state') } }
        : { openEmailSettings: message => opened.push(message) },
    sessionStorage: { removeItem: key => removed.push(key) }, localStorage: { removeItem: key => removed.push(key) },
    window: { location: { pathname: '/maxcut' } },
  });
  const failure = (url, code, status = 401) => ({ config: { url }, response: { status, data: { code, message: code } } });
  await assert.rejects(() => rejectResponse(failure('/auth/email/confirm-link', 'TICKET_EXPIRED')));
  assert.equal(removed.length, 0);
  await assert.rejects(() => rejectResponse(failure('/api/submit-task', 'EMAIL_BINDING_REQUIRED', 403)));
  assert.equal(opened.length, 1);
  await assert.rejects(() => rejectResponse(failure('/auth/email/change', 'LOGIN_REQUIRED')));
  assert.ok(removed.length > 0);
});
