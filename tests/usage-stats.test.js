import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { compileScript, parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import * as vue from 'vue';

const flush = () => new Promise(setImmediate);
const deferred = () => {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { promise, resolve };
};
function compile(source) {
  return ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
  } }).outputText;
}

test('public API rejects malformed totals and never uses authenticated interceptors', async () => {
  let payload;
  const requests = [];
  const exports = {};
  const apiCode = readFileSync(new URL('../src/api/usageStats.ts', import.meta.url), 'utf8')
    .replaceAll('import.meta.env.DEV', 'true').replaceAll('import.meta.env.VITE_API_BASE_URL', "''");
  runInNewContext(compile(apiCode), {
    exports,
    require: () => ({ default: { create: () => ({
      get: async (url, options) => { requests.push([url, options]); return { data: payload }; },
    }) } }),
  });
  const signal = new AbortController().signal;
  for (const total of [-1, '23', null, undefined, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    payload = { success: true, data: { totalUsers: total } };
    await assert.rejects(exports.getRegisteredUserTotal(signal));
  }
  payload = { success: false, data: { totalUsers: 23 } };
  await assert.rejects(exports.getRegisteredUserTotal(signal));
  payload = { success: true, data: { totalUsers: 0 } };
  assert.equal(await exports.getRegisteredUserTotal(signal), 0);
  assert.equal(requests.at(-1)[0], '/api/usage-stats');
  assert.equal(requests.at(-1)[1].signal, signal);
});

const source = readFileSync(new URL('../src/components/UsageUserCount.vue', import.meta.url), 'utf8');
const componentCode = compile(compileScript(parse(source).descriptor, { id: 'usage-user-count' }).content);
function counter({ hidden = false, read = async () => 128639 } = {}) {
  const mounted = [], cleanup = [], timers = new Map(), listeners = new Map(), calls = [];
  const document = {
    hidden,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
  };
  let nextTimer = 0;
  const exports = {};
  runInNewContext(componentCode, {
    exports, document, AbortController,
    setTimeout: (fn, delay) => { timers.set(++nextTimer, { fn, delay }); return nextTimer; },
    clearTimeout: key => timers.delete(key),
    require: name => name === 'vue'
      ? { ...vue, onMounted: fn => mounted.push(fn), onBeforeUnmount: fn => cleanup.push(fn) }
      : { getRegisteredUserTotal: signal => { calls.push(signal); return read(signal); } },
  });
  const state = exports.default.setup({}, { expose() {} });
  const result = {
    state, calls, timers, document, listeners,
    mount: async () => { mounted.forEach(fn => fn()); await flush(); },
    unmount: () => cleanup.forEach(fn => fn()),
    tick: async () => {
      const [key, timer] = [...timers.entries()][0];
      timers.delete(key); timer.fn(); await flush();
    },
    visibility: async hidden => { document.hidden = hidden; listeners.get('visibilitychange')(); await flush(); },
  };
  return result;
}

test('counter loads immediately, formats totals, polls at 30 seconds and cleans up', async () => {
  const f = counter();
  assert.equal(f.state.formattedTotal.value, '—');
  await f.mount();
  assert.equal(f.state.formattedTotal.value, '128,639');
  assert.equal(f.calls.length, 1);
  assert.equal([...f.timers.values()][0].delay, 30000);
  await f.tick();
  assert.equal(f.calls.length, 2);
  f.unmount();
  assert.equal(f.timers.size, 0);
  assert.equal(f.listeners.size, 0);
});

test('hidden pages pause; becoming visible immediately refreshes without overlapping requests', async () => {
  const wait = deferred();
  let count = 0;
  const f = counter({ read: () => ++count === 1 ? wait.promise : Promise.resolve(2) });
  await f.mount();
  assert.equal(f.timers.size, 0);
  await f.visibility(true);
  assert.equal(f.calls[0].aborted, true);
  await f.visibility(false);
  assert.equal(f.calls.length, 2);
  assert.equal(f.state.totalUsers.value, 2);
  wait.resolve(999);
  await flush();
  assert.equal(f.state.totalUsers.value, 2);
  assert.equal(f.timers.size, 1);
  f.unmount();
});

test('polling failures retain the last total and account merges can correct it downward', async () => {
  const values = [42, new Error('offline'), 40, 45];
  const f = counter({ read: async () => { const value = values.shift(); if (value instanceof Error) throw value; return value; } });
  await f.mount();
  await f.tick();
  assert.equal(f.state.totalUsers.value, 42);
  await f.tick();
  assert.equal(f.state.totalUsers.value, 40);
  await f.tick();
  assert.equal(f.state.totalUsers.value, 45);
  f.unmount();
});

test('initial hidden state and unmount suppress requests, late writes and timers', async () => {
  const wait = deferred();
  const f = counter({ hidden: true, read: () => wait.promise });
  await f.mount();
  assert.equal(f.calls.length, 0);
  await f.visibility(false);
  f.unmount();
  assert.equal(f.calls[0].aborted, true);
  wait.resolve(123);
  await flush();
  assert.equal(f.state.totalUsers.value, null);
  assert.equal(f.timers.size, 0);
});
