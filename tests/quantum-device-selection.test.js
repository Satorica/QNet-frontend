import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { compileScript, parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import * as vue from 'vue';

const source = readFileSync(new URL('../src/components/QuantumDeviceSelector.vue', import.meta.url), 'utf8');
const code = ts.transpileModule(compileScript(parse(source).descriptor, { id: 'quantum-selection' }).content,
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const format = {};
const formatSource = readFileSync(new URL('../src/utils/format.ts', import.meta.url), 'utf8');
runInNewContext(ts.transpileModule(formatSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: format });
const list = () => ({ maxDevices: 6, managerOk: true, selectionSupported: true, devices: [1, 2, 3, 4, 5, 6].map(id => ({
  device_id: id, name: `FPGA-${id}`, online: id !== 5, enabled: id !== 6, busy: id === 4,
  schedulable: id < 4, cooldown_seconds: id === 3 ? 10 : 0,
})) });

function fixture(read = async () => list()) {
  const exports = {}, cleanup = [];
  const mocks = {
    vue: { ...vue, onMounted() {}, onBeforeUnmount: cb => cleanup.push(cb) },
    '../api': { getQuantumDevices: read },
    '../utils/format': format,
    '../utils/error': { getErrorMessage: (error, fallback) => error.message || fallback },
  };
  runInNewContext(code, { exports, require: name => mocks[name] });
  return { state: exports.default.setup({}, { expose() {} }), dispose: () => cleanup.forEach(cb => cb()) };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('four selections and busy devices retain user intent', async () => {
  const { state: s } = fixture();
  await s.loadDevices();
  assert.deepEqual(plain(s.devices.value.map(device => device.name)), [1, 2, 3, 4, 5, 6].map(id => `Ising-${id}`));
  assert.deepEqual(plain(s.getSelection()), { computeMode: 'single', deviceSelection: 'auto' });
  s.updateSelection(4);
  assert.equal(s.selectionLabel.value, 'Ising-4');
  assert.deepEqual(plain(s.getSelection()), { computeMode: 'single', deviceSelection: 'manual', deviceIds: [4] });
  s.computeMode.value = 'multi';
  assert.deepEqual(plain(s.getSelection()), { computeMode: 'multi', deviceSelection: 'auto' });
  s.updateSelection(['auto', 2]);
  assert.throws(() => s.getSelection(), /至少选择两台/);
  s.updateSelection([2, 1]);
  assert.equal(s.selectionLabel.value, 'Ising-2、Ising-1');
  assert.deepEqual(plain(s.getSelection()), { computeMode: 'multi', deviceSelection: 'manual', deviceIds: [1, 2] });
  s.updateSelection([2, 1, 'auto']);
  assert.deepEqual(plain(s.getSelection()), { computeMode: 'multi', deviceSelection: 'auto' });
  s.updateSelection([]);
  assert.deepEqual(plain(s.multiDevices.value), ['auto']);
  s.computeMode.value = 'single';
  assert.deepEqual(plain(s.getSelection()), { computeMode: 'single', deviceSelection: 'manual', deviceIds: [4] });
});

test('offline, maintenance and cooldown devices cannot be submitted', async () => {
  const { state: s } = fixture();
  await s.loadDevices();
  for (const id of [3, 5, 6]) {
    s.updateSelection(id);
    assert.throws(() => s.getSelection(), /不可用/);
  }
});

test('selected unavailable devices remain removable, but cannot be selected again', async () => {
  for (const unavailable of [{ online: false }, { enabled: false }, { cooldown_seconds: 30 }]) {
    let data = list();
    const { state: s } = fixture(async () => data);
    await s.loadDevices();
    s.computeMode.value = 'multi';
    s.updateSelection(['auto', 1]);
    s.updateSelection([1, 2]);
    data = { ...data, devices: data.devices.map(device => device.device_id === 2 ? { ...device, ...unavailable } : device) };
    await s.onDropdownVisibleChange(false);
    assert.equal(s.devices.value.find(device => device.device_id === 2).online, true);
    await s.onDropdownVisibleChange(true);
    const device = s.devices.value.find(device => device.device_id === 2);
    assert.equal(s.isOptionDisabled(device), false, 'selected device can be unchecked');
    assert.throws(() => s.getSelection(), /不可用/, 'selection is still rejected until repaired');
    s.updateSelection([1]);
    assert.equal(s.isOptionDisabled(device), true, 'unavailable device cannot be added back');
    s.updateSelection([1, 4]);
    assert.deepEqual(plain(s.getSelection()), { computeMode: 'multi', deviceSelection: 'manual', deviceIds: [1, 4] });
  }
});

test('a device missing from a new list can be removed without losing the other selections', async () => {
  let data = list();
  const { state: s } = fixture(async () => data);
  await s.loadDevices();
  s.computeMode.value = 'multi';
  s.updateSelection([1, 2]);
  data = { ...data, devices: data.devices.filter(device => device.device_id !== 2) };
  await s.onDropdownVisibleChange(true);

  assert.deepEqual(plain(s.deviceOptions.value.find(option => option.id === 2)),
    { id: 2, name: 'Ising-2', status: '已不可用', disabled: false });
  s.updateSelection([1, 2, 4]);
  assert.throws(() => s.getSelection(), /不可用/);
  s.updateSelection([1, 4]);
  assert.equal(s.deviceOptions.value.some(option => option.id === 2), false);
  assert.deepEqual(plain(s.getSelection().deviceIds), [1, 4]);
});

test('loading, network failures, old protocol and manager failures block submission', async () => {
  let finish;
  const f = fixture(() => new Promise(resolve => { finish = resolve; }));
  const pending = f.state.loadDevices();
  f.state.updateSelection(1);
  assert.equal(f.state.singleDevice.value, 'auto');
  assert.throws(() => f.state.getSelection(), /正在加载/);
  finish(list());
  await pending;
  for (const data of [{ ...list(), selectionSupported: false }, { ...list(), managerOk: false }]) {
    const { state: s } = fixture(async () => data);
    await s.loadDevices();
    assert.throws(() => s.getSelection(), /尚未支持|暂不可用/);
  }
  const { state: s } = fixture(async () => { throw new Error('连接失败'); });
  await s.loadDevices();
  assert.throws(() => s.getSelection(), /连接失败/);
});

test('unmount and newer refresh discard late device responses', async () => {
  const resolvers = [];
  const f = fixture(() => new Promise(resolve => resolvers.push(resolve)));
  const first = f.state.loadDevices();
  const second = f.state.loadDevices();
  resolvers[1](list());
  await second;
  resolvers[0]({ ...list(), selectionSupported: false });
  await first;
  assert.equal(f.state.selectionSupported.value, true);
  const third = f.state.loadDevices();
  f.dispose();
  resolvers[2]({ ...list(), devices: [] });
  await third;
  assert.equal(f.state.devices.value.length, 6);
});
