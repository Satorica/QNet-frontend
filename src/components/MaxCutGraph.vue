<template>
  <div class="maxcut-graph">
    <div v-if="isLarge" class="graph-toolbar">
      <span>{{ nodes.length }} 个节点 · {{ edges.length }} 条边</span>
      <div class="graph-controls">
        <label class="graph-locate">节点
          <input v-model="locateValue" type="number" min="0" :max="nodes.length - 1" aria-label="定位节点编号" :aria-invalid="!!locateError" @input="locateError = ''" @keydown.enter.prevent="locateNode" />
        </label>
        <button type="button" @click="locateNode">定位</button>
        <button v-if="editable" type="button" :disabled="!canSelectLocatedNode" @click="selectLocatedNode">{{ locatedNode !== null && selectedNodes.includes(locatedNode) ? '取消选择' : '选择此节点' }}</button>
        <span v-if="locateError" class="graph-locate-error" role="alert">{{ locateError }}</span>
      </div>
    </div>
    <div ref="graphViewport" class="graph-viewport" :class="{ 'is-large': isLarge }">
      <div ref="graphStage" class="graph-stage" :style="stageStyle">
        <canvas ref="edgeCanvas" class="graph-edges" aria-hidden="true"></canvas>
        <canvas ref="nodeCanvas" class="graph-nodes" tabindex="0" role="img"
          :aria-label="`环形图，${nodes.length} 个节点。方向键切换节点，回车选择节点。`"
          @pointermove="onPointerMove" @pointerleave="hoveredNode = null" @click="onCanvasClick" @keydown="onKeyDown"></canvas>
      </div>
    </div>
    <div v-if="Object.keys(partition).length" class="graph-legend">
      <span class="legend-item"><i class="legend-color partition-a"></i>分区 A</span>
      <span class="legend-item"><i class="legend-color partition-b"></i>分区 B</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

interface GraphNode { id: number; x: number; y: number }
interface GraphEdge { source: number; target: number }
const props = withDefaults(defineProps<{
  nodes?: GraphNode[]; edges?: GraphEdge[]; partition?: Record<number, number>;
  editable?: boolean; selectedNodes?: number[];
}>(), { nodes: () => [], edges: () => [], partition: () => ({}), editable: false, selectedNodes: () => [] });
const emit = defineEmits<{ 'node-click': [nodeId: number] }>();
const graphViewport = ref<HTMLDivElement | null>(null);
const graphStage = ref<HTMLDivElement | null>(null);
const edgeCanvas = ref<HTMLCanvasElement | null>(null);
const nodeCanvas = ref<HTMLCanvasElement | null>(null);
const viewportWidth = ref(400);
const hoveredNode = ref<number | null>(null);
const locatedNode = ref<number | null>(null);
const locateValue = ref(0);
const locateError = ref('');
const canSelectLocatedNode = computed(() => locatedNode.value !== null && String(locateValue.value).trim() !== '' && Number(locateValue.value) === locatedNode.value);
const isLarge = computed(() => props.nodes.length > 32);
const width = computed(() => isLarge.value ? viewportWidth.value : 400);
const height = computed(() => isLarge.value ? Math.min(480, width.value) : 360);
const radius = computed(() => isLarge.value ? Math.max(1, Math.min(12, (Math.min(width.value, height.value) - 64) * Math.PI / props.nodes.length / 2 - 1)) : 12);
const stageStyle = computed(() => isLarge.value
  ? { width: `${width.value}px`, height: `${height.value}px` }
  : { width: '100%', aspectRatio: '400 / 360' });
const displayNodes = computed(() => !isLarge.value ? props.nodes : props.nodes.map((node, index) => {
  const angle = index / props.nodes.length * Math.PI * 2;
  const ringRadius = Math.max(0, Math.min(width.value, height.value) / 2 - 32);
  return { id: node.id, x: width.value / 2 + ringRadius * Math.cos(angle), y: height.value / 2 + ringRadius * Math.sin(angle) };
}));
const nodeById = computed(() => new Map(displayNodes.value.map(node => [node.id, node])));
const edgesByNode = computed(() => {
  const result = new Map<number, GraphEdge[]>();
  for (const edge of props.edges) {
    for (const id of [edge.source, edge.target]) {
      if (!result.has(id)) result.set(id, []);
      result.get(id)!.push(edge);
    }
  }
  return result;
});
const activeNode = computed(() => hoveredNode.value ?? locatedNode.value ?? props.selectedNodes[0] ?? null);
const focusedEdges = computed(() => activeNode.value === null ? [] : edgesByNode.value.get(activeNode.value) || []);
let drawFrame = 0;
let edgesDirty = true;
let resizeObserver: ResizeObserver | null = null;
let themeObserver: MutationObserver | null = null;

function prepare(canvas: HTMLCanvasElement | null) {
  const rect = graphStage.value?.getBoundingClientRect();
  if (!canvas || !rect?.width || !rect.height) return null;
  // Bound each bitmap to 8M pixels even for a large ring on high-DPI displays.
  const ratio = Math.min(window.devicePixelRatio || 1, Math.sqrt(8_000_000 / (rect.width * rect.height)));
  const pixelWidth = Math.max(1, Math.floor(rect.width * ratio));
  const pixelHeight = Math.max(1, Math.floor(rect.height * ratio));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.setTransform(canvas.width / width.value, 0, 0, canvas.height / height.value, 0, 0);
  context.globalAlpha = 1;
  return context;
}
function strokeEdges(context: CanvasRenderingContext2D, edges: GraphEdge[], color: string, alpha: number, lineWidth = 1.5) {
  context.beginPath();
  for (const edge of edges) {
    const from = nodeById.value.get(edge.source), to = nodeById.value.get(edge.target);
    if (!from || !to) continue;
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
  }
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.globalAlpha = alpha;
  context.stroke();
  context.globalAlpha = 1;
}
function draw() {
  drawFrame = 0;
  const accent = graphStage.value ? getComputedStyle(graphStage.value).getPropertyValue('--app-accent').trim() || '#8652c7' : '#8652c7';
  if (edgesDirty) {
    const context = prepare(edgeCanvas.value);
    if (context) strokeEdges(context, props.edges, '#B8C2D1', isLarge.value ? 0.35 : 0.6, isLarge.value ? 0.75 : 1.5);
    edgesDirty = false;
  }
  const context = prepare(nodeCanvas.value);
  if (!context) return;
  if (isLarge.value && activeNode.value !== null) strokeEdges(context, focusedEdges.value, accent, 0.5);
  for (const node of displayNodes.value) {
    const partition = props.partition[node.id];
    const selected = props.selectedNodes.includes(node.id) || activeNode.value === node.id;
    context.beginPath();
    context.arc(node.x, node.y, radius.value, 0, Math.PI * 2);
    context.fillStyle = partition === 0 ? '#FF6B6B' : partition === 1 ? '#4ECDC4' : accent;
    context.fill();
    context.strokeStyle = selected ? '#29394f' : '#FFFFFF';
    context.lineWidth = selected ? 3 : isLarge.value ? 0.5 : 2;
    context.stroke();
    if (!isLarge.value) {
      context.fillStyle = '#FFFFFF';
      context.font = `600 ${isLarge.value ? 12 : 14}px sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(String(node.id), node.x, node.y + 0.5);
    }
  }
  // Keep selected/located labels visible while inspecting another node.
  const labeledIds = new Set(props.selectedNodes);
  if (locatedNode.value !== null) labeledIds.add(locatedNode.value);
  if (activeNode.value !== null) labeledIds.add(activeNode.value);
  const labelRects: { x: number; y: number; width: number }[] = [];
  for (const id of labeledIds) {
    const node = nodeById.value.get(id);
    if (!node) continue;
    const angle = Math.atan2(node.y - height.value / 2, node.x - width.value / 2);
    const label = String(node.id);
    context.font = '600 12px sans-serif';
    const labelWidth = context.measureText(label).width + 12;
    let x = 0, y = 0;
    // Nearby nodes need separate badges; move later labels further inward.
    for (let offset = 25; offset <= 145; offset += 24) {
      x = Math.max(labelWidth / 2 + 2, Math.min(width.value - labelWidth / 2 - 2, node.x - Math.cos(angle) * offset));
      y = Math.max(12, Math.min(height.value - 12, node.y - Math.sin(angle) * offset));
      if (!labelRects.some(rect => Math.abs(x - rect.x) < (labelWidth + rect.width) / 2 + 4 && Math.abs(y - rect.y) < 24)) break;
    }
    labelRects.push({ x, y, width: labelWidth });
    context.beginPath();
    context.moveTo(node.x, node.y);
    context.lineTo(x, y);
    context.strokeStyle = '#29394f';
    context.lineWidth = 1;
    context.stroke();
    context.fillStyle = '#29394f';
    context.fillRect(x - labelWidth / 2, y - 10, labelWidth, 20);
    context.fillStyle = '#FFFFFF';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label, x, y + 0.5);
  }
}
function scheduleDraw() { if (!drawFrame) drawFrame = requestAnimationFrame(draw); }
function scheduleGeometry() { edgesDirty = true; scheduleDraw(); }
function hitNode(event: MouseEvent | PointerEvent) {
  const rect = nodeCanvas.value?.getBoundingClientRect();
  if (!rect?.width || !rect.height) return null;
  const x = (event.clientX - rect.left) * width.value / rect.width;
  const y = (event.clientY - rect.top) * height.value / rect.height;
  let nearest: number | null = null, distance = radius.value + 3;
  for (const node of displayNodes.value) {
    const next = Math.hypot(node.x - x, node.y - y);
    if (next < distance) { distance = next; nearest = node.id; }
  }
  return nearest;
}
function onPointerMove(event: PointerEvent) {
  hoveredNode.value = hitNode(event);
  if (nodeCanvas.value) nodeCanvas.value.style.cursor = hoveredNode.value !== null ? 'pointer' : 'default';
}
function focusNode(id: number) {
  hoveredNode.value = null;
  locatedNode.value = id;
  locateValue.value = id;
  locateError.value = '';
}
function onCanvasClick(event: MouseEvent) {
  const id = hitNode(event);
  if (id === null) return;
  focusNode(id);
  if (props.editable) emit('node-click', id);
}
function locateNode() {
  const id = Number(locateValue.value);
  if (String(locateValue.value).trim() && Number.isInteger(id) && nodeById.value.has(id)) focusNode(id);
  else locateError.value = `请输入 0–${props.nodes.length - 1} 范围内的整数编号。`;
}
function selectLocatedNode() {
  if (props.editable && canSelectLocatedNode.value && locatedNode.value !== null) emit('node-click', locatedNode.value);
}
function onKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    if (activeNode.value !== null && props.editable) emit('node-click', activeNode.value);
    return;
  }
  const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
  if (!direction || !props.nodes.length) return;
  event.preventDefault();
  const current = props.nodes.findIndex(node => node.id === activeNode.value);
  const next = current < 0 ? 0 : (current + direction + props.nodes.length) % props.nodes.length;
  focusNode(props.nodes[next].id);
}
watch([displayNodes, () => props.edges], scheduleGeometry, { deep: true, flush: 'post' });
watch([activeNode, locatedNode, () => props.partition, () => props.selectedNodes], scheduleDraw, { deep: true, flush: 'post' });
watch(() => props.selectedNodes, (selected, previous) => {
  // The parent keeps both nodes selected while the edge dialog is open.
  // Once it closes, also clear the graph's independent locate/hover state.
  if (previous.length === 2 && selected.length === 0) {
    hoveredNode.value = null;
    locatedNode.value = null;
  }
}, { flush: 'post' });
watch(() => props.nodes, () => {
  hoveredNode.value = null;
  locatedNode.value = null;
  locateError.value = '';
});
onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    const nextWidth = graphViewport.value?.clientWidth || 400;
    viewportWidth.value = nextWidth;
    scheduleGeometry();
  });
  if (graphViewport.value) resizeObserver.observe(graphViewport.value);
  window.addEventListener('resize', scheduleGeometry);
  themeObserver = new MutationObserver(scheduleDraw);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
  void nextTick(scheduleGeometry);
});
onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  themeObserver?.disconnect();
  window.removeEventListener('resize', scheduleGeometry);
  cancelAnimationFrame(drawFrame);
});
</script>

<style scoped>
.maxcut-graph { width: 100%; min-width: 0; min-height: 400px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
.graph-toolbar { width: 100%; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; color: #63738a; font-size: 12px; }
.graph-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.graph-locate { display: flex; align-items: center; gap: 5px; }
.graph-locate input { width: 58px; box-sizing: border-box; padding: 0 5px; }
.graph-locate input, .graph-controls button { height: 28px; border: 1px solid #dce3ed; border-radius: 5px; color: #536581; background: white; font: inherit; }
.graph-controls button { padding: 0 9px; cursor: pointer; }
.graph-controls button:hover:not(:disabled) { border-color: var(--app-accent); color: var(--app-accent); }
.graph-controls button:disabled { opacity: .5; cursor: default; }
.graph-viewport { width: 100%; max-width: 400px; overflow: hidden; border-radius: 8px; }
.graph-viewport.is-large { max-width: none; }
.graph-stage { position: relative; flex: none; }
.graph-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
.graph-edges { pointer-events: none; }
.graph-nodes:focus-visible { outline: 2px solid var(--app-accent); outline-offset: -2px; }
.graph-locate-error { color: #c0392b; }
.graph-legend { display: flex; gap: 20px; padding: 8px 16px; background: rgba(255,255,255,.9); border-radius: 8px; }
.legend-item { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #666; }
.legend-color { display: inline-block; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; }
.partition-a { background: #ff6b6b; }
.partition-b { background: #4ecdc4; }
</style>
