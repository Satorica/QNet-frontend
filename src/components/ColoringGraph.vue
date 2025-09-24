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
        :stroke="isSelected(node.id) ? '#4050F8' : '#FFFFFF'"
        :stroke-width="isSelected(node.id) ? 4 : 2"
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

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  nodes: {
    type: Array,
    default: () => []
  },
  edges: {
    type: Array,
    default: () => []
  },
  coloring: {
    type: Object,
    default: () => ({})
  },
  colors: {
    type: Array,
    default: () => ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4']
  },
  editable: {
    type: Boolean,
    default: false
  },
  selectedNodes: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['node-click', 'node-color'])

const graphContainer = ref(null)
const width = 400
const height = 360
const nodeRadius = 16

const getNodeColor = (nodeId) => {
  const colorIndex = props.coloring[nodeId]
  return colorIndex !== undefined ? props.colors[colorIndex] : '#E0E0E0'
}

const isSelected = (nodeId) => {
  return Array.isArray(props.selectedNodes) && props.selectedNodes.includes(nodeId)
}

const handleNodeClick = (nodeId) => {
  if (props.editable) {
    emit('node-click', nodeId)
  }
}
</script>

<style scoped>
.coloring-graph {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.graph-svg {
  border-radius: 8px;
}

.clickable {
  cursor: pointer;
}

.clickable:hover {
  r: 18;
}
</style> 