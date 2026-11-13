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
import { formatQuantumDeviceName, formatSolveTime } from "../utils/format";

const props = defineProps<{
  results?: TaskResults | null;
  deviceTime?: string | null;
}>();
const duration = (value: unknown) =>
  typeof value === "number" ? formatSolveTime(`${value}s`) : "--";
const items = computed(() => {
  const rows = [{ label: "设备求解时间", value: props.results?.runtime == null
    ? formatSolveTime(props.deviceTime) : duration(props.results.runtime) }];
  const ids = props.results?.fpga?.device_ids;
  if (Array.isArray(ids) && ids.length) {
    rows.push({ label: "实际计算设备", value: ids.map(id => formatQuantumDeviceName(id)).join("、") });
  }
  return rows;
});
</script>

<style scoped>
.task-timings { display: flex; flex-wrap: wrap; gap: 10px 24px; width: 100%; margin: 8px 0; font-size: 14px; }
.timing-item { display: flex; flex-wrap: wrap; gap: 4px; }
.timing-label { color: var(--el-text-color-secondary); }
.timing-value { color: var(--el-text-color-primary); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
</style>
