<template>
  <div class="tsp-graph">
    <svg
      :width="width"
      :height="height"
      :viewBox="`0 0 ${width} ${height}`"
      preserveAspectRatio="xMidYMid meet"
      class="graph-svg"
    >
      <!-- 矩阵定义的边（非零权重） - 背景边 -->
      <g v-if="distanceMatrix && distanceMatrix.length > 0">
        <g v-for="edge in renderedEdges" :key="`e-${edge.i}-${edge.j}`">
          <line
            :x1="cities[edge.i]?.x"
            :y1="cities[edge.i]?.y"
            :x2="cities[edge.j]?.x"
            :y2="cities[edge.j]?.y"
            stroke="#8C8FA3"
            stroke-width="1.5"
            opacity="0.5"
          />
        </g>
      </g>

      <!-- 最佳路径线：按解向量方向逐段绘制，并在每段终点显示箭头 -->
      <g v-if="routeSegments.length > 0">
        <line
          v-for="segment in routeSegments"
          :key="`route-${segment.from}-${segment.to}-${segment.index}`"
          :x1="segment.x1"
          :y1="segment.y1"
          :x2="segment.x2"
          :y2="segment.y2"
          fill="none"
          stroke="#40C878"
          stroke-width="3"
          opacity="0.8"
          stroke-linecap="round"
          marker-end="url(#tspRouteArrow)"
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
        style="pointer-events: none"
      >
        {{ city.id }}
      </text>

      <!-- 渐变定义 -->
      <defs>
        <linearGradient id="cityGradient" gradientTransform="rotate(45)">
          <stop offset="0%" stop-color="#4050F8" />
          <stop offset="100%" stop-color="#7848E8" />
        </linearGradient>
        <marker
          id="tspRouteArrow"
          markerWidth="10"
          markerHeight="10"
          refX="8.5"
          refY="5"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#40C878" opacity="0.9" />
        </marker>
      </defs>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface City {
  id: number;
  x: number;
  y: number;
  name?: string;
}

interface RenderedEdge {
  i: number;
  j: number;
  w: number;
}

interface RouteSegment {
  from: number;
  to: number;
  index: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const props = withDefaults(
  defineProps<{
    cities?: City[];
    route?: number[];
    bestRoute?: number[];
    editable?: boolean;
    selectedNodes?: number[];
    distanceMatrix?: number[][];
  }>(),
  {
    cities: () => [],
    route: () => [],
    bestRoute: () => [],
    editable: false,
    selectedNodes: () => [],
    distanceMatrix: () => [],
  },
);

const emit = defineEmits<{
  "city-move": [cityId: number, x: number, y: number];
  "route-change": [route: number[]];
  "city-click": [cityId: number];
}>();

const width = 760;
const height = 380;
const cityRadius = 12;
const routeEndpointGap = cityRadius + 5;

const getCityById = (cityId: number) => {
  return props.cities.find((city) => city?.id === cityId) || props.cities[cityId];
};

const renderedEdges = computed(() => {
  const result: RenderedEdge[] = [];
  const m = props.distanceMatrix || [];
  const n = m.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const w = m[i]?.[j];
      if (typeof w === "number" && w > 0) {
        result.push({ i, j, w });
      }
    }
  }
  return result;
});

const routeSegments = computed(() => {
  const route = Array.isArray(props.bestRoute) ? props.bestRoute : [];
  const result: RouteSegment[] = [];

  for (let index = 0; index < route.length; index++) {
    const from = route[index];
    // TSP 路径是闭环：最后一个城市需要回到首个城市。
    const to = route[(index + 1) % route.length];
    const fromCity = getCityById(from);
    const toCity = getCityById(to);
    if (!fromCity || !toCity) continue;

    const dx = toCity.x - fromCity.x;
    const dy = toCity.y - fromCity.y;
    const length = Math.hypot(dx, dy);
    if (!length) continue;

    const ux = dx / length;
    const uy = dy / length;
    const gap = Math.min(routeEndpointGap, length / 3);

    result.push({
      from,
      to,
      index,
      x1: fromCity.x + ux * gap,
      y1: fromCity.y + uy * gap,
      x2: toCity.x - ux * gap,
      y2: toCity.y - uy * gap,
    });
  }

  return result;
});

const isSelected = (cityId: number) => {
  return (
    Array.isArray(props.selectedNodes) && props.selectedNodes.includes(cityId)
  );
};

const handleCityClick = (cityId: number) => {
  if (props.editable) {
    emit("city-click", cityId);
  }
};
</script>

<style scoped>
.tsp-graph {
  width: 100%;
  min-height: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px 0;
}

.graph-svg {
  width: min(100%, 760px);
  height: 380px;
  border-radius: 8px;
  overflow: hidden;
}

.clickable {
  cursor: pointer;
}

.clickable:hover {
  r: 14;
}
</style>
