<template>
  <div
    class="usage-stats"
    aria-live="polite"
    aria-atomic="true"
  >
    <p v-for="metric in metrics" :key="metric.label" class="usage-stat" :title="metric.title">
      <span class="usage-stat-label">{{ metric.label }}</span>
      <span class="usage-stat-value">
        <Transition name="usage-count-change" mode="out-in">
          <strong :key="metric.total ?? 'loading'" class="usage-stat-total">{{ formatTotal(metric.total) }}</strong>
        </Transition>
        <span>{{ metric.unit }}</span>
      </span>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { getUsageStats, type UsageStats } from "../api/usageStats";

const stats = ref<UsageStats | null>(null);
const metrics = computed(() => [
  { label: "累计使用用户", total: stats.value?.totalUsers ?? null, unit: "人",
    title: "按平台注册账号数统计，排除后台管理员和已合并的重复账号。" },
  { label: "经典算力调用次数", total: stats.value?.classicCalls ?? null, unit: "次",
    title: "累计已提交的经典算力任务，包含所有状态；删除任务详情后仍保留统计。" },
  { label: "量子算力调用次数", total: stats.value?.quantumCalls ?? null, unit: "次",
    title: "累计已提交的量子算力任务，包含所有状态及历史模型名称；删除任务详情后仍保留统计。" },
]);
const formatTotal = (total: number | null) => total === null ? "—" : total.toLocaleString("zh-CN");
const POLL_INTERVAL = 30_000;
let timer: ReturnType<typeof setTimeout> | undefined;
let activeRequest: AbortController | undefined;
let disposed = false;

function pause() {
  clearTimeout(timer);
  timer = undefined;
  activeRequest?.abort();
  activeRequest = undefined;
}

async function refresh() {
  if (disposed || document.hidden || activeRequest) return;
  const controller = new AbortController();
  activeRequest = controller;
  try {
    const totals = await getUsageStats(controller.signal);
    if (!disposed && !controller.signal.aborted) {
      stats.value = totals;
    }
  } catch {
    // Preserve the last real value and retry silently; never interrupt login.
  } finally {
    if (activeRequest === controller) {
      activeRequest = undefined;
      if (!disposed && !document.hidden) timer = setTimeout(refresh, POLL_INTERVAL);
    }
  }
}

function onVisibilityChange() {
  pause();
  if (!document.hidden) void refresh();
}

onMounted(() => {
  document.addEventListener("visibilitychange", onVisibilityChange);
  void refresh();
});
onBeforeUnmount(() => {
  disposed = true;
  pause();
  document.removeEventListener("visibilitychange", onVisibilityChange);
});
</script>

<style scoped>
.usage-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
  max-width: 680px;
  margin: 0 auto 16px;
  color: #bec2cc;
  font-size: 14px;
  line-height: 1.5;
}
.usage-stat { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.usage-stat-label { white-space: nowrap; }
.usage-stat-value {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
}
.usage-stat-total {
  color: #f1f3f7;
  font-size: 26px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -.02em;
  overflow-wrap: anywhere;
  min-width: 0;
}
.usage-count-change-enter-active, .usage-count-change-leave-active { transition: opacity .16s, transform .16s; }
.usage-count-change-enter-from { opacity: 0; transform: translateY(4px); }
.usage-count-change-leave-to { opacity: 0; transform: translateY(-4px); }
@media (max-width: 768px) {
  .usage-stats { gap: 8px; font-size: 11px; margin-bottom: 12px; }
  .usage-stat-value { gap: 4px; }
  .usage-stat-total { font-size: 23px; }
}
@media (prefers-reduced-motion: reduce) {
  .usage-count-change-enter-active, .usage-count-change-leave-active { transition: none; }
}
</style>
