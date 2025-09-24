<template>
  <div ref="graphContainer" class="tsp-graph">
    <svg :width="width" :height="height" class="graph-svg">
      <!-- 当前路径线 -->
      <g v-if="route.length > 1">
        <path
          :d="getRoutePath(route)"
          fill="none"
          stroke="#4050F8"
          stroke-width="2"
          opacity="0.8"
        />
      </g>
      
      <!-- 最佳路径线 -->
      <g v-if="bestRoute.length > 1 && bestRoute !== route">
        <path
          :d="getRoutePath(bestRoute)"
          fill="none"
          stroke="#40C878"
          stroke-width="3"
          stroke-dasharray="5,5"
          opacity="0.6"
        />
      </g>
      
      <!-- 矩阵定义的边（非零权重） -->
      <g v-if="distanceMatrix && distanceMatrix.length > 0">
        <line
          v-for="edge in renderedEdges"
          :key="`e-${edge.i}-${edge.j}`"
          :x1="cities[edge.i]?.x"
          :y1="cities[edge.i]?.y"
          :x2="cities[edge.j]?.x"
          :y2="cities[edge.j]?.y"
          stroke="#8C8FA3"
          stroke-width="1.5"
          opacity="0.5"
        />
      </g>
      
      <!-- 城市节点 -->
      <circle
        v-for="city in cities"
        :key="`city-${city.id}`"
        :cx="city.x"
        :cy="city.y"
        :r="cityRadius"
        fill="url(#cityGradient)"
        :stroke="isSelected(city.id) ? '#4050F8' : '#FFFFFF'"
        :stroke-width="isSelected(city.id) ? 3 : 2"
        :class="{ clickable: editable }"
        @mousedown="startDrag(city)"
        @click="handleCityClick(city.id)"
      />
      
      <!-- 城市标签 -->
      <text
        v-for="city in cities"
        :key="`text-${city.id}`"
        :x="city.x"
        :y="city.y"
        text-anchor="middle"
        dy="0.35em"
        fill="white"
        font-size="12"
        font-weight="600"
        style="pointer-events: none;"
      >
        {{ city.id }}
      </text>
      
      <!-- 渐变定义 -->
      <defs>
        <linearGradient id="cityGradient" gradientTransform="rotate(45)">
          <stop offset="0%" stop-color="#4050F8" />
          <stop offset="100%" stop-color="#7848E8" />
        </linearGradient>
      </defs>
    </svg>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  cities: {
    type: Array,
    default: () => []
  },
  route: {
    type: Array,
    default: () => []
  },
  bestRoute: {
    type: Array,
    default: () => []
  },
  editable: {
    type: Boolean,
    default: false
  },
  selectedNodes: {
    type: Array,
    default: () => []
  },
  distanceMatrix: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['city-move', 'route-change', 'city-click'])

const graphContainer = ref(null)
const width = 400
const height = 360
const cityRadius = 12

const getRoutePath = (route) => {
  if (route.length < 2) return ''
  
  let path = ''
  for (let i = 0; i < route.length; i++) {
    const cityId = route[i]
    const city = props.cities[cityId]
    if (city) {
      if (i === 0) {
        path += `M ${city.x} ${city.y}`
      } else {
        path += ` L ${city.x} ${city.y}`
      }
    }
  }
  
  // 回到起点
  if (route.length > 2) {
    const firstCity = props.cities[route[0]]
    if (firstCity) {
      path += ` L ${firstCity.x} ${firstCity.y}`
    }
  }
  
  return path
}

const renderedEdges = computed(() => {
  const result = []
  const m = props.distanceMatrix || []
  const n = m.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const w = m[i]?.[j]
      if (typeof w === 'number' && w > 0) {
        result.push({ i, j, w })
      }
    }
  }
  return result
})

const isSelected = (cityId) => {
  return Array.isArray(props.selectedNodes) && props.selectedNodes.includes(cityId)
}

const startDrag = (city) => {
  if (props.editable) {
    // 简化的拖拽实现
    console.log('开始拖拽城市:', city.id)
  }
}

const handleCityClick = (cityId) => {
  if (props.editable) {
    emit('city-click', cityId)
  }
}
</script>

<style scoped>
.tsp-graph {
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
  r: 14;
}
</style> 