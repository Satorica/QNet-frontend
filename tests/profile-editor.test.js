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
const transpile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { descriptor } = parse(readFileSync(new URL('../src/components/ProfileEditor.vue', import.meta.url), 'utf8'));
const componentCode = transpile(compileScript(descriptor, { id: 'profile-editor' }).content);
const initialProfile = { nickname: '原昵称', avatarUrl: '', gender: '保密', birthday: '' };
const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};

function fixture(api = {}) {
  const events = [], writes = [], unmounted = [], revoked = [];
  const profileApi = {
    get: async () => ({ ...initialProfile }),
    uploadAvatar: async () => ({ ...initialProfile, avatarUrl: '/media/avatars/new.jpg' }),
    update: async payload => { writes.push({ ...payload }); return { ...initialProfile, ...payload }; },
    ...api,
  };
  const mocks = {
    vue: { ...vue, onMounted() {}, onUnmounted: callback => unmounted.push(callback) },
    'element-plus': { ElMessage: { success() {}, error() {} } },
    '@element-plus/icons-vue': {},
    '../api/profile': { profileApi },
    '../utils/error': { getErrorMessage: (error, fallback) => error.message || fallback },
    '../assets/default-avatar.png': 'default-avatar.png',
  };
  const exports = {};
  runInNewContext(componentCode, {
    exports,
    require: name => mocks[name],
    URL: { createObjectURL: () => 'blob:avatar', revokeObjectURL: value => revoked.push(value) },
  });
  const state = exports.default.setup({ userId: 'user-1' }, { expose() {}, emit: (...args) => events.push(args) });
  state.formRef.value = { validate: () => new Schema(state.rules).validate(state.draft).then(() => true) };
  return {
    state, events, writes, revoked,
    dispose: () => unmounted.forEach(callback => callback()),
    selectAvatar: () => state.selectAvatar({ target: { files: [{ name: 'avatar.png', type: 'image/png', size: 100 }], value: '' } }),
  };
}

test('avatar-only save preserves nickname, gender and birthday updated from another client', async () => {
  const uploads = [];
  const serverProfile = { nickname: '小程序新昵称', gender: '女', birthday: '2000-01-01', avatarUrl: '/media/avatars/new.jpg' };
  const f = fixture({ uploadAvatar: async (_file, nickname) => { uploads.push(nickname); return serverProfile; } });
  await f.state.loadProfile();
  f.selectAvatar();
  await f.state.save();
  assert.deepEqual(uploads, [undefined]);
  assert.equal(f.writes.length, 0);
  assert.equal(f.state.draft.nickname, serverProfile.nickname);
  assert.equal(f.state.draft.gender, serverProfile.gender);
  assert.equal(f.state.draft.birthday, serverProfile.birthday);
  assert.deepEqual(f.revoked, ['blob:avatar']);
  assert.equal(f.events.at(-1)[0], 'close');
});

test('partial failure retries only pending local changes without reuploading or reverting remote updates', async () => {
  let uploadCount = 0, fail = true;
  const writes = [];
  const serverProfile = { ...initialProfile, nickname: '新昵称', birthday: '2000-01-01', avatarUrl: '/media/avatars/new.jpg' };
  const f = fixture({
    uploadAvatar: async (_file, nickname) => { uploadCount++; assert.equal(nickname, '新昵称'); return serverProfile; },
    update: async changes => {
      writes.push({ ...changes });
      if (fail) throw new Error('暂时无法保存');
      return { ...serverProfile, ...changes };
    },
  });
  await f.state.loadProfile();
  f.selectAvatar();
  Object.assign(f.state.draft, { nickname: ' 新昵称 ', gender: '男' });
  await f.state.save();
  assert.match(f.state.saveError.value, /头像和昵称已保存/);
  assert.equal(f.events.some(([name]) => name === 'close'), false);
  assert.equal(f.state.draft.birthday, '2000-01-01');
  fail = false;
  await f.state.save();
  assert.equal(uploadCount, 1);
  assert.deepEqual(writes, [{ gender: '男' }, { gender: '男' }]);
  assert.equal(f.events.at(-1)[0], 'close');
});

test('closing during profile load discards the late response', async () => {
  const request = deferred();
  const f = fixture({ get: () => request.promise });
  const loading = f.state.loadProfile();
  f.dispose();
  request.resolve(initialProfile);
  await loading;
  assert.deepEqual(f.events, []);
});

test('unmounting during validation prevents any save request', async () => {
  const validation = deferred();
  const f = fixture();
  await f.state.loadProfile();
  f.state.draft.nickname = '新昵称';
  f.state.formRef.value = { validate: () => validation.promise };
  const saving = f.state.save();
  f.dispose();
  validation.resolve(true);
  await saving;
  assert.equal(f.writes.length, 0);
  assert.equal(f.events.some(([name]) => name === 'close'), false);
});

test('pending validation prevents duplicate saves and re-enables editing on invalid input', async () => {
  const validation = deferred();
  const f = fixture();
  await f.state.loadProfile();
  f.state.draft.nickname = '新昵称';
  f.state.formRef.value = { validate: () => validation.promise };
  const saving = f.state.save();
  await f.state.save();
  f.state.close();
  assert.equal(f.events.some(([name]) => name === 'close'), false);
  validation.resolve(false);
  await saving;
  assert.equal(f.writes.length, 0);
  assert.equal(f.state.saving.value, false);
});

test('whitespace and overlong Unicode nicknames cannot be saved', async () => {
  for (const nickname of ['   ', '🌟'.repeat(31)]) {
    const f = fixture();
    await f.state.loadProfile();
    f.state.draft.nickname = nickname;
    await f.state.save();
    assert.equal(f.writes.length, 0);
    assert.equal(f.events.some(([name]) => name === 'close'), false);
  }
});

test('avatar API omits unchanged nickname and resolves relative media URLs against API host', async () => {
  const calls = [];
  const cloudApi = {
    defaults: { baseURL: 'https://api.example.test/' },
    post: async (_url, form, config) => {
      calls.push({ nickname: form.get('nickname'), filename: form.get('avatar').name, config });
      return { data: { success: true, data: { profile: { ...initialProfile, avatarUrl: '/media/avatars/new.jpg' } } } };
    },
  };
  const exports = {};
  runInNewContext(transpile(readFileSync(new URL('../src/api/profile.ts', import.meta.url), 'utf8')), {
    exports, FormData, require: () => ({ cloudApi }),
  });
  const file = new File(['test'], 'avatar.png', { type: 'image/png' });
  const result = await exports.profileApi.uploadAvatar(file);
  await exports.profileApi.uploadAvatar(file, '新昵称');
  assert.equal(calls[0].nickname, null);
  assert.equal(calls[1].nickname, '新昵称');
  assert.equal(calls[0].filename, 'avatar.png');
  assert.equal(result.avatarUrl, 'https://api.example.test/media/avatars/new.jpg');
});

test('profile nickname updates preserve login storage and react to login/logout', () => {
  for (const remember of [false, true]) {
    const makeStorage = () => {
      const values = new Map();
      return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
    };
    const localStorage = makeStorage(), sessionStorage = makeStorage(), exports = {};
    const mocks = { vue, axios: {}, 'element-plus': {}, '../api/auth': { authApi: {} } };
    runInNewContext(transpile(readFileSync(new URL('../src/utils/auth.ts', import.meta.url), 'utf8')), {
      exports, localStorage, sessionStorage, require: name => mocks[name],
    });
    const user = vue.computed(() => exports.userManager.getUserInfo());
    const loggedIn = vue.computed(() => exports.userManager.isLoggedIn());
    assert.equal(loggedIn.value, false);
    assert.equal(user.value, null);
    exports.userManager.setUserInfo({ id: 'user-1', nickname: '原昵称', maskedEmail: 't***@example.test' }, remember);
    assert.equal(loggedIn.value, true);
    exports.userManager.updateNickname('新昵称');
    assert.equal(user.value.nickname, '新昵称');
    const active = remember ? localStorage : sessionStorage, inactive = remember ? sessionStorage : localStorage;
    assert.equal(JSON.parse(active.getItem('userInfo')).maskedEmail, 't***@example.test');
    assert.equal(inactive.getItem('userInfo'), null);
    exports.tokenManager.clearTokens();
    assert.equal(loggedIn.value, false);
    assert.equal(user.value, null);
  }
});
