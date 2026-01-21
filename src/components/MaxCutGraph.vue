<template>
  <div ref="graphContainer" class="maxcut-graph">
    <svg :width="width" :height="height" class="graph-svg">
      <!-- 边 - 根据是否被切割显示不同颜色 -->
      <line
        v-for="(edge, index) in edges"
        :key="`edge-${index}`"
        :x1="nodes[edge.source]?.x"
        :y1="nodes[edge.source]?.y"
        :x2="nodes[edge.target]?.x"
        :y2="nodes[edge.target]?.y"
        :stroke="getEdgeColor(edge)"
        :stroke-width="getEdgeWidth(edge)"
        :opacity="getEdgeOpacity(edge)"
        class="graph-edge"
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
        :stroke-width="isSelected(node.id) ? 4 : 3"
        :class="{ clickable: editable, 'has-partition': hasPartition(node.id) }"
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
import { ref } from 'vue'

const props = defineProps({
  nodes: {
    type: Array,
    default: () => []
  },
  edges: {
    type: Array,
    default: () => []
  },
  partition: {
    type: Object,
    default: () => ({})
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

const emit = defineEmits(['node-click'])

const graphContainer = ref(null)
const width = 400
const height = 360
const nodeRadius = 18

// 根据分区着色 - 使用更鲜明的颜色
const getNodeColor = (nodeId) => {
  const partition = props.partition[nodeId]
  if (partition === 0) return '#FF6B6B'  // 分区A - 鲜艳红色
  if (partition === 1) return '#4ECDC4'  // 分区B - 青绿色
  return '#B0B0B0'  // 默认灰色（未分区）
}

// 节点边框颜色
const getNodeStrokeColor = (nodeId) => {
  const partition = props.partition[nodeId]
  if (partition === 0) return '#E85454'  // 深红色边框
  if (partition === 1) return '#3DBDB4'  // 深青色边框
  return '#909090'  // 灰色边框
}

// 检查节点是否已分区
const hasPartition = (nodeId) => {
  return props.partition[nodeId] !== undefined
}

// 边的颜色 - 被切割的边显示为高亮
const getEdgeColor = (edge) => {
  const sourcePartition = props.partition[edge.source]
  const targetPartition = props.partition[edge.target]
  
  // 如果两个节点都已分区且在不同分区，这条边被切割了
  if (sourcePartition !== undefined && targetPartition !== undefined) {
    if (sourcePartition !== targetPartition) {
      return '#FFA726'  // 橙色 - 被切割的边
    } else {
      return '#8C8FA3'  // 灰色 - 未被切割的边
    }
  }
  
  return '#C0C4CC'  // 浅灰色 - 默认边
}

// 边的宽度
const getEdgeWidth = (edge) => {
  const sourcePartition = props.partition[edge.source]
  const targetPartition = props.partition[edge.target]
  
  // 被切割的边更粗
  if (sourcePartition !== undefined && targetPartition !== undefined && sourcePartition !== targetPartition) {
    return 3
  }
  return 2
}

// 边的透明度
const getEdgeOpacity = (edge) => {
  const sourcePartition = props.partition[edge.source]
  const targetPartition = props.partition[edge.target]
  
  // 被切割的边更明显
  if (sourcePartition !== undefined && targetPartition !== undefined && sourcePartition !== targetPartition) {
    return 0.9
  }
  return 0.4
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
.maxcut-graph {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.graph-svg {
  border-radius: 8px;
}

.graph-edge {
  transition: stroke 0.3s ease, stroke-width 0.3s ease, opacity 0.3s ease;
}

.clickable {
  cursor: pointer;
  transition: all 0.3s ease;
}

.clickable:hover {
  filter: brightness(1.1);
  transform: scale(1.1);
}

.has-partition {
  animation: nodeAppear 0.5s ease-out;
}

@keyframes nodeAppear {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>

