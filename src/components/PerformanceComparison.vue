<template>
  <section class="performance-comparison" aria-label="性能对比">
    <div class="workspace-section-heading"><h2>性能对比</h2></div>
    <div class="comparison-run-panel">
      <div class="comparison-actions">
        <el-button type="primary" size="large" class="comparison-start" :loading="preparing || running" :disabled="disabled" @click="start">
          <Play v-if="!preparing && !running" :size="16" aria-hidden="true" />
          <span>{{ preparing ? '准备中…' : running ? '对比中…' : '开始对比' }}</span>
        </el-button>
        <el-button class="comparison-cancel" :loading="cancelling" :disabled="!running || cancelling" @click="cancel">取消对比</el-button>
      </div>
      <div class="comparison-meta" aria-live="polite">
        <div class="comparison-state" aria-live="polite"><span class="comparison-dot" aria-hidden="true"></span>{{ summary }}</div>
        <p>{{ run ? '本次对比使用提交时的输入参数' : '使用当前输入参数，经典与量子各求解一次' }}</p>
      </div>
      <el-button class="comparison-export" :disabled="!run || running" @click="exportJson">导出 JSON</el-button>
    </div>
    <div class="comparison-lanes">
      <section v-for="model in models" :key="model" class="comparison-lane" :aria-label="`${model === 'classic' ? '经典' : '量子'}计算对比结果`">
        <h3>{{ model === 'classic' ? '经典计算' : '量子计算' }}</h3>
        <div class="comparison-result">
          <div class="comparison-result-heading">
            <span>{{ model === 'classic' ? algorithmLabel : deviceLabel }}</span>
            <span class="comparison-status" :class="`status-${run?.sides[model].status || 'idle'}`">{{ sideStatus(model) }}</span>
          </div>
          <div class="comparison-time"><span>设备求解时间</span><strong>{{ formatSolveTime(run?.sides[model].results?.runtime) }}</strong></div>
          <p v-if="sideMessage(model)" class="comparison-message" :class="{ 'is-error': run?.sides[model].status === 'failed' }" role="status">{{ sideMessage(model) }}</p>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { Play } from "lucide-vue-next";
import { ElMessage } from "element-plus";
import { cancelTask, getTaskStatus, submitTask } from "../api";
import { getMethodTypeText, type MethodType, type ModelType } from "../types/api";
import { formatQuantumDeviceName, formatSolveTime } from "../utils/format";
import { getErrorMessage } from "../utils/error";
import { buildComparisonExport, createPerformanceComparison, type ComparisonInput, type ComparisonRun } from "../utils/performanceComparison";

const props = defineProps<{
  prepareTask: () => Promise<ComparisonInput | null>;
  methodType: MethodType;
  disabled?: boolean;
}>();
const emit = defineEmits<{ 'busy-change': [busy: boolean]; 'tasks-changed': []; submitted: [] }>();
const models: ModelType[] = ["classic", "quantum"];
const run = ref<ComparisonRun | null>(null);
const running = ref(false);
const preparing = ref(false);
const cancelling = ref(false);
let disposed = false;
let submittedId: string | null = null;
const controller = createPerformanceComparison({
  submit: submitTask, status: getTaskStatus, cancel: cancelTask,
  changed(value, busy) {
    run.value = value;
    running.value = busy;
    emit('busy-change', busy);
    if (submittedId !== value.id && models.some(model => value.sides[model].taskId)) {
      submittedId = value.id;
      emit('submitted');
    }
  },
  tasksChanged: () => emit('tasks-changed'),
});
const algorithmLabel = computed(() => getMethodTypeText(run.value?.input.methodType || props.methodType));
const deviceLabel = computed(() => {
  const ids = run.value?.sides.quantum.results?.fpga?.device_ids;
  if (ids?.length) return `${ids.map(id => formatQuantumDeviceName(id)).join('、')} · ${ids.length > 1 ? `${ids.length} 台` : '单设备'}`;
  const requested = run.value?.input.deviceIds as number[] | undefined;
  return requested?.length ? requested.map(id => formatQuantumDeviceName(id)).join('、') : '自动分配';
});
const summary = computed(() => {
  if (preparing.value) return '正在校验输入';
  if (!run.value) return '等待对比';
  const sides = models.map(model => run.value!.sides[model]);
  const completed = sides.filter(side => side.status === 'completed').length;
  if (running.value) return completed ? `已完成 ${completed} / 2` : '对比中';
  if (completed === 2) return '对比完成';
  const failed = sides.filter(side => side.status === 'failed').length;
  return failed === 2 ? '对比失败' : failed ? '对比结束（部分失败）' : '对比已取消';
});
function sideStatus(model: ModelType) {
  const side = run.value?.sides[model];
  if (!side) return '待开始';
  return { submitting: '提交中', queued: '排队中', processing: '求解中', completed: '已完成', failed: '失败', cancelled: '已取消' }[side.status];
}
function sideMessage(model: ModelType) {
  const side = run.value?.sides[model];
  if (!side) return '';
  if (side.pollError) return side.pollError;
  if (side.status === 'queued' && side.queuePosition) return `队列第 ${side.queuePosition} 位`;
  return side.status === 'failed' || side.status === 'cancelled' || side.message.startsWith('取消未成功') ? side.message : '';
}
async function start() {
  if (props.disabled || preparing.value || running.value) return;
  preparing.value = true;
  try {
    // Start name validation before disabling its field, then reserve the page
    // while it is pending so a normal solve cannot submit in parallel.
    const preparation = props.prepareTask();
    emit('busy-change', true);
    const input = await preparation;
    if (!input || disposed || props.disabled) return;
    preparing.value = false;
    await controller.start(input);
  } catch (error) {
    if (!disposed) ElMessage.warning(getErrorMessage(error, '请检查当前输入参数'));
  } finally {
    preparing.value = false;
    if (!disposed) emit('busy-change', running.value);
  }
}
async function cancel() {
  cancelling.value = true;
  try { await controller.cancel(); }
  finally { cancelling.value = false; }
}
function exportJson() {
  if (!run.value || running.value) return;
  const blob = new Blob([JSON.stringify(buildComparisonExport(run.value), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `comparison-${run.value.id}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
onBeforeUnmount(() => { disposed = true; controller.dispose(); });
</script>

<style scoped>
.performance-comparison { display: flex; flex-direction: column; gap: 22px; min-width: 0; }
.comparison-run-panel { display: flex; align-items: center; flex-wrap: wrap; gap: 16px 24px; }
.comparison-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
.comparison-actions .el-button { margin-left: 0; }
.comparison-start { min-width: 132px; height: 40px; gap: 7px; border-radius: 6px; }
.comparison-start :deep(> span) { display: flex; align-items: center; gap: 7px; }
.comparison-cancel { border: 0; background: transparent; color: #63738a; }
.comparison-cancel.is-disabled { background: transparent; color: #a0abba; }
.comparison-meta { border-left: 1px solid #e5eaf1; padding-left: 20px; color: #63738a; font-size: 13px; }
.comparison-state { display: flex; align-items: center; gap: 7px; }
.comparison-dot { flex: 0 0 5px; height: 5px; border-radius: 50%; background: #8c93a7; }
.comparison-meta p { margin: 7px 0 0; }
.comparison-export { margin-left: auto; border-radius: 6px; }
.comparison-lanes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.comparison-lane { min-width: 0; }
.comparison-lane h3 { margin: 0 0 12px; color: #526177; font-size: var(--app-font-subtitle, 14px); font-weight: 500; }
.comparison-result { padding: 20px; border-radius: 8px; background: #f8fafc; }
.comparison-result-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-bottom: 15px; border-bottom: 1px solid #e5eaf1; color: #29394f; font-size: 14px; overflow-wrap: anywhere; }
.comparison-status { flex-shrink: 0; padding: 2px 8px; border-radius: 5px; font-size: 12px; color: #63738a; background: #eef1f6; }
.status-completed { color: #278263; background: #e8f5ed; }
.status-processing, .status-submitting { color: var(--app-accent); background: var(--app-accent-soft); }
.status-failed { color: var(--el-color-danger); background: var(--el-color-danger-light-9); }
.comparison-time { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-top: 15px; color: #63738a; font-size: 14px; }
.comparison-time strong { color: #29394f; font-weight: 500; font-size: 20px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.comparison-message { margin: 12px 0 0; color: #63738a; font-size: 12px; overflow-wrap: anywhere; }
.comparison-message.is-error { color: var(--el-color-danger); }
@media (max-width: 760px) { .comparison-meta { flex: 1 1 220px; } }
@media (max-width: 560px) {
  .comparison-lanes { grid-template-columns: minmax(0, 1fr); }
  .comparison-meta { border-left: 0; padding-left: 0; flex-basis: 100%; }
  .comparison-export { margin-left: 0; }
}
</style>
