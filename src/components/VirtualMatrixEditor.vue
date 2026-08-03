<template>
  <div
    class="virtual-matrix-editor"
    :style="{
      '--matrix-content-width': `${40 + canvasWidth}px`,
      '--matrix-content-height': `${canvasHeight}px`,
    }"
  >
    <div class="matrix-corner"></div>
    <div class="column-header-viewport">
      <div
        class="column-header-canvas"
        :style="{
          width: `${canvasWidth}px`,
          transform: `translateX(-${scrollLeft}px)`,
        }"
      >
        <div
          v-for="column in visibleColumns"
          :key="column"
          class="axis-cell column-header"
          :class="{ 'is-axis-hovered': hoveredCell?.column === column }"
          :style="{ left: `${column * cellWidth}px`, width: `${cellWidth}px` }"
        >
          {{ labels[column] ?? column + 1 }}
        </div>
      </div>
    </div>

    <div class="row-header-viewport">
      <div
        class="row-header-canvas"
        :style="{
          height: `${canvasHeight}px`,
          transform: `translateY(-${scrollTop}px)`,
        }"
      >
        <div
          v-for="row in visibleRows"
          :key="row"
          class="axis-cell row-header"
          :class="{ 'is-axis-hovered': hoveredCell?.row === row }"
          :style="{ top: `${row * cellHeight}px`, height: `${cellHeight}px` }"
        >
          {{ labels[row] ?? row + 1 }}
        </div>
      </div>
    </div>

    <div ref="viewportRef" class="matrix-data-viewport" @scroll="handleScroll">
      <div
        class="matrix-data-canvas"
        :style="{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }"
      >
        <div
          v-for="cell in visibleCells"
          :key="`${cell.row}-${cell.column}`"
          class="matrix-cell"
          :class="{ 'is-cell-hovered': hoveredCell?.row === cell.row && hoveredCell?.column === cell.column }"
          :style="{
            top: `${cell.row * cellHeight}px`,
            left: `${cell.column * cellWidth}px`,
            width: `${cellWidth}px`,
            height: `${cellHeight}px`,
          }"
          @mouseenter="hoveredCell = { row: cell.row, column: cell.column }"
          @mouseleave="hoveredCell = null"
          @focusin="hoveredCell = { row: cell.row, column: cell.column }"
          @focusout="hoveredCell = null"
        >
          <el-input-number
            :model-value="matrix[cell.row]?.[cell.column] ?? 0"
            :controls="false"
            :precision="3"
            :disabled="disabled"
            :aria-label="`QUBO矩阵第${cell.row + 1}行第${cell.column + 1}列`"
            @update:model-value="updateCell(cell.row, cell.column, $event)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

interface MatrixCell {
  row: number;
  column: number;
}

const props = defineProps<{
  matrix: number[][];
  labels: string[];
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (event: "update-cell", payload: MatrixCell & { value: number }): void;
}>();

const CELL_HEIGHT = 36;
const OVERSCAN = 2;

const viewportRef = ref<HTMLElement | null>(null);
const viewportWidth = ref(640);
const viewportHeight = ref(420);
const scrollLeft = ref(0);
const scrollTop = ref(0);
const hoveredCell = ref<MatrixCell | null>(null);
let resizeObserver: ResizeObserver | null = null;

const size = computed(() => props.matrix.length);
const cellWidth = computed(() => Math.max(60, 92 - Math.max(0, size.value - 4) * 5));
const cellHeight = CELL_HEIGHT;
const canvasWidth = computed(() => size.value * cellWidth.value);
const canvasHeight = computed(() => size.value * cellHeight);

const visibleColumnRange = computed(() => {
  const start = Math.max(0, Math.floor(scrollLeft.value / cellWidth.value) - OVERSCAN);
  const end = Math.min(
    size.value,
    Math.ceil((scrollLeft.value + viewportWidth.value) / cellWidth.value) + OVERSCAN,
  );
  return { start, end };
});

const visibleRowRange = computed(() => {
  const start = Math.max(0, Math.floor(scrollTop.value / cellHeight) - OVERSCAN);
  const end = Math.min(
    size.value,
    Math.ceil((scrollTop.value + viewportHeight.value) / cellHeight) + OVERSCAN,
  );
  return { start, end };
});

const visibleColumns = computed(() =>
  Array.from(
    { length: visibleColumnRange.value.end - visibleColumnRange.value.start },
    (_, index) => visibleColumnRange.value.start + index,
  ),
);

const visibleRows = computed(() =>
  Array.from(
    { length: visibleRowRange.value.end - visibleRowRange.value.start },
    (_, index) => visibleRowRange.value.start + index,
  ),
);

const visibleCells = computed<MatrixCell[]>(() =>
  visibleRows.value.flatMap((row) =>
    visibleColumns.value.map((column) => ({ row, column })),
  ),
);

const syncViewportSize = () => {
  const viewport = viewportRef.value;
  if (!viewport) return;
  viewportWidth.value = viewport.clientWidth;
  viewportHeight.value = viewport.clientHeight;
};

const handleScroll = (event: Event) => {
  const viewport = event.currentTarget as HTMLElement;
  scrollLeft.value = viewport.scrollLeft;
  scrollTop.value = viewport.scrollTop;
  syncViewportSize();
};

const updateCell = (
  row: number,
  column: number,
  value: number | null | undefined,
) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return;
  emit("update-cell", { row, column, value });
};

watch(size, async () => {
  await nextTick();
  const viewport = viewportRef.value;
  if (viewport) {
    viewport.scrollTo({ left: 0, top: 0 });
    scrollLeft.value = 0;
    scrollTop.value = 0;
  }
  syncViewportSize();
});

onMounted(() => {
  syncViewportSize();
  if (typeof ResizeObserver !== "undefined" && viewportRef.value) {
    resizeObserver = new ResizeObserver(syncViewportSize);
    resizeObserver.observe(viewportRef.value);
  }
});

onBeforeUnmount(() => resizeObserver?.disconnect());
</script>

<style scoped>
.virtual-matrix-editor {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  grid-template-rows: 36px min(var(--matrix-content-height), 46vh, 480px);
  width: min(100%, var(--matrix-content-width));
  overflow: hidden;
  border: 1px solid #dbe3f0;
  border-radius: 10px;
  background: #fff;
}

.matrix-corner,
.axis-cell {
  background: #f1f6ff;
  color: #526176;
  font-size: 12px;
  font-weight: 600;
}

.matrix-corner {
  z-index: 3;
  border-right: 1px solid #dbe3f0;
  border-bottom: 1px solid #dbe3f0;
}

.column-header-viewport,
.row-header-viewport {
  position: relative;
  overflow: hidden;
}

.column-header-viewport {
  border-bottom: 1px solid #dbe3f0;
}

.row-header-viewport {
  border-right: 1px solid #dbe3f0;
}

.column-header-canvas,
.row-header-canvas {
  position: relative;
  will-change: transform;
}

.axis-cell,
.matrix-cell {
  position: absolute;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.column-header {
  top: 0;
  height: 36px;
  border-right: 1px solid #dbe3f0;
}

.row-header {
  left: 0;
  width: 40px;
  border-bottom: 1px solid #dbe3f0;
}

.axis-cell.is-axis-hovered {
  background: #e3f0ff;
  color: #2878c8;
}

.matrix-data-viewport {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

.matrix-data-canvas {
  position: relative;
}

.matrix-cell {
  border-right: 1px solid #dbe3f0;
  border-bottom: 1px solid #dbe3f0;
  background: #fff;
}

.matrix-cell::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
  border: 1px solid #409eff;
  border-radius: 3px;
  opacity: 0;
  pointer-events: none;
}

.matrix-cell.is-cell-hovered,
.matrix-cell:hover,
.matrix-cell:focus-within {
  background: #f0f7ff;
}

.matrix-cell.is-cell-hovered::after,
.matrix-cell:hover::after,
.matrix-cell:focus-within::after {
  opacity: 1;
  box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.1);
}

.matrix-cell :deep(.el-input-number) {
  width: 100%;
  min-width: 0;
  height: 100%;
}

.matrix-cell :deep(.el-input__wrapper) {
  min-height: 100%;
  padding: 0 3px;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.matrix-cell :deep(.el-input__inner) {
  text-align: center;
  font-family: "SFMono-Regular", Consolas, monospace;
}

@media (max-width: 720px) {
  .virtual-matrix-editor {
    grid-template-rows: 36px min(var(--matrix-content-height), 52vh, 360px);
  }
}
</style>
