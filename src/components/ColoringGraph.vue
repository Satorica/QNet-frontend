<template>
  <div ref="graphContainer" class="coloring-graph">
    <svg :width="width" :height="height" class="graph-svg">
      <!-- 边 -->
      <line
        v-for="(edge, index) in edges"
        :key="`edge-${index}`"
        :x1="nodes[edge.source]?.x"
        :y1="nodes[edge.source]?.y"
        :x2="nodes[edge.target]?.x"
        :y2="nodes[edge.target]?.y"
        stroke="#8C8FA3"
        stroke-width="2"
        opacity="0.6"
      />
      
      <!-- 节点 -->
      <circle
        v-for="node in nodes"
        :key="`node-${node.id}`"
        :cx="node.x"
        :cy="node.y"
        :r="nodeRadius"
        :fill="getNodeColor(node.id)"
        :stroke="isSelected(node.id) ? '#4050F8' : getNodeStrokeColor(node.id)"
        :stroke-width="isSelected(node.id) ? 4 : (hasColor(node.id) ? 2 : 3)"
        :class="{ clickable: editable }"
        @click="handleNodeClick(node.id)"
      />
      
      <!-- 节点标签 -->
      <text
        v-for="node in nodes"
        :key="`text-${node.id}`"
        :x="node.x"
        :y="node.y"
        text-anchor="middle"
        dy="0.35em"
        fill="white"
        font-size="14"
        font-weight="600"
        style="pointer-events: none;"
      >
        {{ node.id }}
      </text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface GraphNode {
  id: number
  x: number
  y: number
}

interface GraphEdge {
  source: number
  target: number
}

const props = withDefaults(defineProps<{
  nodes?: GraphNode[]
  edges?: GraphEdge[]
  coloring?: Record<number, number>
  colors?: string[]
  editable?: boolean
  selectedNodes?: number[]
}>(), {
  nodes: () => [],
  edges: () => [],
  coloring: () => ({}),
  colors: () => ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'],
  editable: false,
  selectedNodes: () => [],
})

const emit = defineEmits<{
  'node-click': [nodeId: number]
  'node-color': [nodeId: number, colorIndex: number]
}>()

const graphContainer = ref<HTMLDivElement | null>(null)
const width = 400
const height = 360
const nodeRadius = 12

const getNodeColor = (nodeId: number) => {
  const colorIndex = props.coloring[nodeId]
  return colorIndex !== undefined ? props.colors[colorIndex] || '#E0E0E0' : '#B0B0B0'
}

const hasColor = (nodeId: number) => props.coloring[nodeId] !== undefined

const getNodeStrokeColor = (nodeId: number) => {
  return hasColor(nodeId) ? '#FFFFFF' : '#909090'
}

const isSelected = (nodeId: number) => {
  return Array.isArray(props.selectedNodes) && props.selectedNodes.includes(nodeId)
}

const handleNodeClick = (nodeId: number) => {
  if (props.editable) {
    emit('node-click', nodeId)
  }
}
</script>

<style scoped>
.coloring-graph {
  width: 100%;
  min-height: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px 0;
}

.graph-svg {
  border-radius: 8px;
  overflow: visible;
}

.clickable {
  cursor: pointer;
}

.clickable:hover {
  r: 18;
}
</style> 
