<template>
  <SolverEmptyState
    class="candidates-placeholder"
    role="status"
    :class="{ 'is-solving': solving }"
    icon="result"
    :title="solving ? '正在生成候选方案' : '暂无候选结果'"
    :description="description"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import SolverEmptyState from "./SolverEmptyState.vue";

const props = defineProps<{ solving: boolean; status: string }>();
const description = computed(() => {
  if (props.solving) return "求解完成后，候选方案将在这里展示。";
  if (props.status === "等待求解") return "准备好数据后，点击「开始求解」启动计算。";
  return "本次任务尚无可展示的方案，可查看下方求解日志。";
});
</script>
