<template>
  <p
    class="usage-user-count"
    title="按平台注册账号数统计，排除后台管理员和已合并的重复账号。"
    aria-live="polite"
    aria-atomic="true"
  >
    <span>累计使用用户</span>
    <Transition name="usage-count-change" mode="out-in">
      <strong :key="totalUsers ?? 'loading'" class="usage-user-total">{{ formattedTotal }}</strong>
    </Transition>
    <span>人</span>
  </p>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { getRegisteredUserTotal } from "../api/usageStats";

const totalUsers = ref<number | null>(null);
const formattedTotal = computed(() => totalUsers.value === null ? "—" : totalUsers.value.toLocaleString("zh-CN"));
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
    const total = await getRegisteredUserTotal(controller.signal);
    if (!disposed && !controller.signal.aborted) {
      totalUsers.value = total;
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
.usage-user-count {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  margin: 0 0 16px;
  color: #bec2cc;
  font-size: 14px;
  line-height: 1.5;
  white-space: nowrap;
}
.usage-user-total {
  color: #f1f3f7;
  font-size: 26px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -.02em;
}
.usage-count-change-enter-active, .usage-count-change-leave-active { transition: opacity .16s, transform .16s; }
.usage-count-change-enter-from { opacity: 0; transform: translateY(4px); }
.usage-count-change-leave-to { opacity: 0; transform: translateY(-4px); }
@media (max-width: 768px) {
  .usage-user-count { gap: 6px; font-size: 12px; margin-bottom: 12px; }
  .usage-user-total { font-size: 23px; }
}
@media (prefers-reduced-motion: reduce) {
  .usage-count-change-enter-active, .usage-count-change-leave-active { transition: none; }
}
</style>
