<template>
  <div ref="graphContainer" class="tsp-graph">
    <svg :width="width" :height="height" class="graph-svg">
      
      <!-- 矩阵定义的边（非零权重） - 背景边 -->
      <g v-if="distanceMatrix && distanceMatrix.length > 0">
        <g v-for="edge in renderedEdges" :key="`e-${edge.i}-${edge.j}`">
          <line
            :x1="cities[edge.i]?.x"
            :y1="cities[edge.i]?.y"
            :x2="cities[edge.j]?.x"
            :y2="cities[edge.j]?.y"
            stroke="#E6EAF5"
            stroke-width="1.5"
            opacity="0.5"
          />
        </g>
      </g>
      
      <!-- 当前路径线 -->
      <g v-if="route.length > 1">
        <path
          :d="getRoutePath(route)"
          fill="none"
          stroke="#8C8FA3"
          stroke-width="2"
          opacity="0.5"
        />
      </g>
      
      <!-- 最佳路径线（标粗） -->
      <g v-if="bestRoute.length > 1">
        <path
          :d="getRoutePath(bestRoute)"
          fill="none"
          stroke="#40C878"
          stroke-width="4"
          opacity="0.8"
        />
      </g>
      
      <!-- 最佳路径权值标签 -->
      <g v-if="bestRoute.length > 1">
        <text
          v-for="(segment, index) in getBestRouteSegments()"
          :key="`label-${index}`"
          :x="segment.midX"
          :y="segment.midY"
          text-anchor="middle"
          dy="-5"
          fill="#40C878"
          font-size="11"
          font-weight="600"
          style="pointer-events: none; text-shadow: 0 0 3px white, 0 0 3px white, 0 0 3px white;"
        >
          {{ segment.weight.toFixed(1) }}
        </text>
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

// 获取边的权重（优先使用矩阵，否则计算欧几里得距离）
const getEdgeWeight = (cityAId, cityBId) => {
  const m = props.distanceMatrix
  if (m && m[cityAId] && typeof m[cityAId][cityBId] === 'number' && m[cityAId][cityBId] > 0) {
    return m[cityAId][cityBId]
  }
  
  const cityA = props.cities[cityAId]
  const cityB = props.cities[cityBId]
  if (cityA && cityB) {
    const dx = cityA.x - cityB.x
    const dy = cityA.y - cityB.y
    return Math.sqrt(dx * dx + dy * dy)
  }
  return 0
}

// 获取最佳路径的所有段及其权重
const getBestRouteSegments = () => {
  if (!props.bestRoute || props.bestRoute.length < 2) return []
  
  const segments = []
  for (let i = 0; i < props.bestRoute.length; i++) {
    const fromId = props.bestRoute[i]
    const toId = props.bestRoute[(i + 1) % props.bestRoute.length]
    
    const fromCity = props.cities[fromId]
    const toCity = props.cities[toId]
    
    if (fromCity && toCity) {
      const weight = getEdgeWeight(fromId, toId)
      segments.push({
        from: fromId,
        to: toId,
        midX: (fromCity.x + toCity.x) / 2,
        midY: (fromCity.y + toCity.y) / 2,
        weight: weight
      })
    }
  }
  
  return segments
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