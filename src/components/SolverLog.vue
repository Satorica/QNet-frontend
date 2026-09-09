<template>
  <el-card class="log-card solver-log" :class="{ 'is-empty': !entries.length }">
    <template #header>
      <div class="solver-log-heading">
        <span>求解日志</span>
        <span v-if="entries.length" class="solver-log-caption">最近 {{ entries.length }} 条 · 最新在前</span>
      </div>
    </template>
    <div class="log-entries" role="log" aria-label="求解日志" aria-live="polite">
      <SolverEmptyState v-if="!entries.length" icon="log" title="暂无求解日志" description="开始求解后，任务进度将在这里展示。" />
      <div v-for="(entry, index) in entries" :key="index" class="log-entry solver-log-row" :class="{ 'is-latest': index === 0 }">
        <span class="solver-log-dot" aria-hidden="true"></span>
        <time class="solver-log-time">{{ entry.time || '—' }}</time>
        <span class="solver-log-message">{{ entry.message }}</span>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import SolverEmptyState from "./SolverEmptyState.vue";
import { SOLVE_LOG_IDLE_MESSAGE } from "../utils/solveLog";

const props = defineProps<{ logs: string[] }>();
const entries = computed(() => props.logs
  .filter(log => log !== SOLVE_LOG_IDLE_MESSAGE)
  .map(log => {
    const match = log.match(/^(\d{1,2}:\d{2}:\d{2}) - (.*)$/s);
    return match ? { time: match[1], message: match[2] } : { time: "", message: log };
  }));
</script>
