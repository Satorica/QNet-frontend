<template>
  <el-card class="log-card solver-log" :class="{ 'is-empty': !entries.length }">
    <template #header>
      <div class="solver-log-heading">
        <span>求解日志</span>
        <span v-if="entries.length" class="solver-log-caption">最近 {{ entries.length }} 条 · 最新在前</span>
      </div>
    </template>
    <div class="log-entries" role="log" aria-label="求解日志" aria-live="polite">
      <SolverEmptyState v-if="!entries.length" icon="log" title="暂无求解日志" description="后端返回任务日志后将在这里展示。" />
      <div v-for="(entry, index) in entries" :key="entry.sequence" class="log-entry solver-log-row" :class="{ 'is-latest': index === 0 }">
        <span class="solver-log-dot" aria-hidden="true"></span>
        <time class="solver-log-time" :datetime="entry.timestamp" :title="entry.timestamp">{{ entry.timestamp?.slice(11, 25) || '--' }}</time>
        <span class="solver-log-message">{{ entry.message }}</span>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from "vue";
import SolverEmptyState from "./SolverEmptyState.vue";
import type { TaskSolveLog } from "../types/api";

const props = defineProps<{ logs: TaskSolveLog[] }>();
const entries = computed(() => props.logs);
</script>
