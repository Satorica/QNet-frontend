<template>
  <div ref="graphContainer" class="maxcut-graph">
    <svg :width="width" :height="height" class="graph-svg">
      <!-- 边 -->
      <line
        v-for="(edge, index) in edges"
        :key="`edge-${index}`"
        :x1="nodes[edge.source]?.x"
        :y1="nodes[edge.source]?.y"
        :x2="nodes[edge.target]?.x"
        :y2="nodes[edge.target]?.y"
        stroke="#C0C4CC"
        stroke-width="2"
        opacity="0.6"
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
        style="pointer-events: none"
      >
        {{ node.id }}
      </text>
    </svg>

    <!-- 图例说明 -->
    <div v-if="Object.keys(partition).length > 0" class="graph-legend">
      <div class="legend-item">
        <div class="legend-color" style="background: #ff6b6b"></div>
        <span>分区 A</span>
      </div>
      <div class="legend-item">
        <div class="legend-color" style="background: #4ecdc4"></div>
        <span>分区 B</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

const props = defineProps({
  nodes: {
    type: Array,
    default: () => [],
  },
  edges: {
    type: Array,
    default: () => [],
  },
  partition: {
    type: Object,
    default: () => ({}),
  },
  editable: {
    type: Boolean,
    default: false,
  },
  selectedNodes: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["node-click"]);

const graphContainer = ref(null);
const width = 400;
const height = 360;
const nodeRadius = 18;

// 根据分区着色 - 使用更鲜明的颜色
const getNodeColor = (nodeId) => {
  const partition = props.partition[nodeId];
  if (partition === 0) return "#FF6B6B"; // 分区A - 鲜艳红色
  if (partition === 1) return "#4ECDC4"; // 分区B - 青绿色
  return "#B0B0B0"; // 默认灰色（未分区）
};

// 节点边框颜色
const getNodeStrokeColor = (nodeId) => {
  const partition = props.partition[nodeId];
  if (partition === 0) return "#E85454"; // 深红色边框
  if (partition === 1) return "#3DBDB4"; // 深青色边框
  return "#909090"; // 灰色边框
};

// 检查节点是否已分区
const hasPartition = (nodeId) => {
  return props.partition[nodeId] !== undefined;
};


const isSelected = (nodeId) => {
  return (
    Array.isArray(props.selectedNodes) && props.selectedNodes.includes(nodeId)
  );
};

const handleNodeClick = (nodeId) => {
  if (props.editable) {
    emit("node-click", nodeId);
  }
};
</script>

<style scoped>
.maxcut-graph {
  width: 100%;
  min-height: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px 0;
  gap: 12px;
}

.graph-svg {
  border-radius: 8px;
  overflow: visible;
}

.graph-legend {
  display: flex;
  gap: 20px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #666;
}

.legend-color {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}


.graph-edge {
  transition: stroke 0.3s ease, stroke-width 0.3s ease, opacity 0.3s ease;
}

.clickable {
  cursor: pointer;
  transition: all 0.3s ease;
  transform-box: fill-box;
  transform-origin: center;
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

