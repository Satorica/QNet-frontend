<template>
  <div class="task-timings">
    <div v-for="item in items" :key="item.label" class="timing-item">
      <span class="timing-label">{{ item.label }}：</span>
      <span class="timing-value">{{ item.value }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { TaskResults } from "../types/api";
import { formatSolveTime } from "../utils/format";

const props = defineProps<{
  results?: TaskResults | null;
  deviceTime?: string | null;
}>();
const duration = (value: unknown) =>
  typeof value === "number" ? formatSolveTime(`${value}s`) : "--";
const items = computed(() => [
  { label: "总时间", value: duration(props.results?.total_time) },
  { label: "设备求解时间", value: props.results?.runtime == null
    ? formatSolveTime(props.deviceTime) : duration(props.results.runtime) },
  { label: "设备通信时间", value: duration(props.results?.device_communication_time) },
  { label: "后处理时间", value: duration(props.results?.postprocess_time) },
]);
</script>

<style scoped>
.task-timings { display: flex; flex-wrap: wrap; gap: 10px 24px; width: 100%; margin: 8px 0; font-size: 14px; }
.timing-item { display: flex; flex-wrap: wrap; gap: 4px; }
.timing-label { color: var(--el-text-color-secondary); }
.timing-value { color: var(--el-text-color-primary); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
</style>
