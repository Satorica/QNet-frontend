<template>
  <VirtualMatrixEditor :matrix="matrix" :labels="labels" :disabled="disabled" compact>
    <template #cell="{ row, column, value }">
      <button
        class="graph-matrix-cell"
        :disabled="disabled || row === column"
        :aria-label="`${matrixLabel}行 ${row}，列 ${column}`"
        :title="`行 ${row}，列 ${column}`"
        @click="emit('cell-click', row, column)"
      >{{ value }}</button>
    </template>
  </VirtualMatrixEditor>
</template>

<script setup lang="ts">
import { computed } from "vue";
import VirtualMatrixEditor from "./VirtualMatrixEditor.vue";

const props = withDefaults(defineProps<{
  matrix: number[][];
  disabled?: boolean;
  matrixLabel?: string;
}>(), { disabled: false, matrixLabel: "邻接矩阵" });
const emit = defineEmits<{ "cell-click": [row: number, column: number] }>();
// Keep matrix coordinates consistent with the graph's node/city IDs.
const labels = computed(() => props.matrix.map((_, index) => String(index)));
</script>

<style scoped>
.graph-matrix-cell {
  width: 100%;
  height: 100%;
  border: 0;
  padding: 0 3px;
  background: transparent;
  color: var(--app-accent);
  font: inherit;
  cursor: pointer;
}
.graph-matrix-cell:disabled {
  color: #8c8fa3;
  cursor: default;
}
</style>
