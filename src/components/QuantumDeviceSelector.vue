<template>
  <div class="quantum-devices" aria-label="量子计算设备配置">
    <div class="device-controls">
      <div class="device-field">
        <span class="field-label">计算方式</span>
        <el-radio-group v-model="computeMode" class="solve-type-group compute-mode-group" :disabled="disabled" aria-label="计算方式">
          <el-radio-button label="single">单台计算</el-radio-button>
          <el-radio-button label="multi">多台计算</el-radio-button>
        </el-radio-group>
      </div>
      <div class="device-field device-select-field">
      <label class="field-label" for="quantum-device-select">计算设备</label>
      <el-select
        id="quantum-device-select"
        :key="computeMode"
        :model-value="computeMode === 'single' ? singleDevice : multiDevices"
        :multiple="computeMode === 'multi'"
        :disabled="disabled"
        :loading="loading"
        loading-text="正在加载设备状态…"
        :no-data-text="feedbackMessage || '暂未发现计算设备'"
        aria-label="计算设备"
        placeholder="选择计算设备"
        @update:model-value="updateSelection"
        @visible-change="onDropdownVisibleChange"
      >
        <template #label><span class="device-selected-text" :title="selectionLabel">{{ selectionLabel }}</span></template>
        <template #tag><span class="device-selected-text" :title="selectionLabel">{{ selectionLabel }}</span></template>
        <el-option v-if="!feedbackMessage" label="自动分配" value="auto" :disabled="loading" />
        <el-option-group v-if="!feedbackMessage && deviceOptions.length" :label="computeMode === 'single' ? '指定设备' : '指定设备（至少选择两台）'">
          <el-option v-for="option in deviceOptions" :key="option.id" :label="option.name" :value="option.id" :disabled="loading || option.disabled">
            <span>{{ option.name }}</span>
            <span class="option-status">{{ option.status }}</span>
          </el-option>
        </el-option-group>
      </el-select>
      </div>
    </div>
    <p v-if="feedbackMessage" class="device-note has-warning" aria-live="polite">{{ feedbackMessage }}</p>
    <p v-else-if="!loading && !devices.length" class="device-note" aria-live="polite">暂未发现计算设备</p>
    <p v-if="!feedbackMessage && selectionNote" class="device-note" :class="{ 'device-error': computeMode === 'multi' && selectedIds.length < 2 }">{{ selectionNote }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { getQuantumDevices } from '../api';
import { getErrorMessage } from '../utils/error';
import { formatQuantumDeviceName } from '../utils/format';
import type { QuantumDevice, QuantumDeviceSelection } from '../types/api';

defineProps<{ disabled?: boolean }>();
const computeMode = ref<'single' | 'multi'>('single');
const singleDevice = ref<string | number>('auto');
const multiDevices = ref<(string | number)[]>(['auto']);
const selectedIds = computed(() => computeMode.value === 'single'
  ? typeof singleDevice.value === 'number' ? [singleDevice.value] : []
  : multiDevices.value.filter((value): value is number => typeof value === 'number'));
const deviceSelection = computed<'auto' | 'manual'>(() => selectedIds.value.length ? 'manual' : 'auto');
const selectionLabel = computed(() => deviceSelection.value === 'auto' ? '自动分配'
  : selectedIds.value.map(id => devices.value.find(device => device.device_id === id)?.name || formatQuantumDeviceName(id)).join('、'));
const selectionNote = computed(() => {
  if (deviceSelection.value === 'auto') return '';
  if (computeMode.value === 'multi' && selectedIds.value.length < 2) return '多台计算请至少选择两台设备。';
  return `已指定 ${selectedIds.value.length} 台设备${computeMode.value === 'multi' ? '协同计算' : '计算'}，忙碌时排队等待。`;
});
const devices = ref<QuantumDevice[]>([]);
const loading = ref(false);
const errorMessage = ref('');
const selectionSupported = ref(false);
const managerOk = ref(false);
const feedbackMessage = computed(() => loading.value ? '' : errorMessage.value
  || (!selectionSupported.value ? '设备服务暂未就绪，请稍后重试' : !managerOk.value ? '设备管理服务暂不可用，请稍后重试' : ''));
let disposed = false;
let requestVersion = 0;

const isSelectable = (device: QuantumDevice) => device.online && device.enabled !== false && !(device.cooldown_seconds && device.cooldown_seconds > 0);
// A device that became unavailable must still be removable from the selection.
const isOptionDisabled = (device: QuantumDevice) => !selectedIds.value.includes(device.device_id) && !isSelectable(device);
function statusText(device: QuantumDevice) {
  if (device.enabled === false) return '维护中';
  if (!device.online) return '离线';
  if (device.cooldown_seconds && device.cooldown_seconds > 0) return '冷却中';
  return device.busy ? '忙碌 · 可排队' : '空闲';
}
const deviceOptions = computed(() => {
  const options = devices.value.map(device => ({
    id: device.device_id,
    name: device.name,
    status: statusText(device),
    disabled: isOptionDisabled(device),
  }));
  for (const id of selectedIds.value) {
    if (!devices.value.some(device => device.device_id === id)) {
      options.push({ id, name: formatQuantumDeviceName(id), status: '已不可用', disabled: false });
    }
  }
  return options;
});
function updateSelection(value: string | number | (string | number)[]) {
  if (loading.value) return;
  if (computeMode.value === 'single') {
    singleDevice.value = typeof value === 'number' ? value : 'auto';
    return;
  }
  const values = Array.isArray(value) ? value : [];
  const added = values.find(item => !multiDevices.value.includes(item));
  if (added === 'auto') {
    multiDevices.value = [added];
    return;
  }
  const ids = values.filter((value): value is number => typeof value === 'number');
  multiDevices.value = ids.length ? ids : ['auto'];
}
function onDropdownVisibleChange(open: boolean) {
  if (open && !loading.value) return loadDevices();
}
async function loadDevices() {
  const version = ++requestVersion;
  loading.value = true;
  errorMessage.value = '';
  try {
    const data = await getQuantumDevices();
    if (disposed || version !== requestVersion) return;
    devices.value = data.devices.map(device => ({ ...device, name: formatQuantumDeviceName(device.device_id, device.name) }));
    selectionSupported.value = data.selectionSupported;
    managerOk.value = data.managerOk;
  } catch (error) {
    if (disposed || version !== requestVersion) return;
    devices.value = [];
    errorMessage.value = getErrorMessage(error, '设备列表加载失败，请重新打开列表');
  } finally {
    if (!disposed && version === requestVersion) loading.value = false;
  }
}
function getSelection(): QuantumDeviceSelection {
  if (loading.value) throw new Error('设备状态正在加载，请稍后提交');
  if (errorMessage.value) throw new Error(errorMessage.value);
  if (!selectionSupported.value) throw new Error('设备服务尚未支持计算方式选择，请联系管理员更新');
  if (!managerOk.value) throw new Error('设备管理服务暂不可用，请稍后重试');
  const selection: QuantumDeviceSelection = { computeMode: computeMode.value, deviceSelection: deviceSelection.value };
  if (deviceSelection.value === 'manual') {
    if (computeMode.value === 'single' ? selectedIds.value.length !== 1 : selectedIds.value.length < 2) {
      throw new Error(computeMode.value === 'single' ? '请选择一台计算设备' : '请至少选择两台计算设备');
    }
    if (selectedIds.value.some(id => !devices.value.some(device => device.device_id === id && isSelectable(device)))) {
      throw new Error('所选设备当前不可用，请重新选择');
    }
    selection.deviceIds = [...selectedIds.value].sort((a, b) => a - b);
  }
  return selection;
}
onMounted(loadDevices);
onBeforeUnmount(() => { disposed = true; requestVersion += 1; });
defineExpose({ getSelection });
</script>

<style scoped>
.quantum-devices { display: grid; grid-column: span 2; align-content: start; gap: 7px; width: 416px; max-width: 100%; min-width: 0; justify-self: start; }
.device-controls { display: grid; grid-template-columns: 176px minmax(0, 220px); align-items: start; gap: 20px; min-width: 0; }
.device-field { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.field-label { color: #63738a; font-size: var(--app-font-body); font-weight: var(--app-weight-medium); line-height: 22px; }
.device-select-field :deep(.el-select) { width: 100%; }
.device-select-field :deep(.el-select__wrapper) { height: 36px; min-height: 36px; padding: 0 11px; border: 1px solid transparent; border-radius: 7px; background: var(--app-control-bg); box-shadow: none; }
.device-select-field :deep(.el-select__wrapper:hover) { border-color: var(--app-border); }
.device-select-field :deep(.el-select__wrapper.is-focused) { border-color: var(--app-accent); background: var(--el-bg-color); box-shadow: 0 0 0 2px var(--app-accent-soft); }
.device-select-field :deep(.el-select__selection) { min-width: 0; flex-wrap: nowrap; gap: 0; }
.device-select-field :deep(.el-select__selection.is-near) { margin-left: 0; }
.device-select-field :deep(.el-select__input-wrapper) { flex: 0 0 0; min-width: 0; width: 0; }
.device-selected-text { display: block; min-width: 0; overflow: hidden; color: var(--el-text-color-regular); font-size: 14px; line-height: 22px; text-overflow: ellipsis; white-space: nowrap; }
.device-note.has-warning { color: #9a772d; }
.option-status { float: right; margin-left: 24px; color: var(--el-text-color-secondary); font-size: 12px; }
.device-note { margin: 0; font-size: 12px; line-height: 20px; color: #78879b; }
.device-error { color: var(--el-color-danger); }
@media (max-width: 700px) {
  .quantum-devices { grid-column: 1 / -1; }
  .device-controls { grid-template-columns: minmax(0, 1fr); gap: 16px; }
}
</style>
