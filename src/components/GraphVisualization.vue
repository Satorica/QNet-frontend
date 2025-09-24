<template>
  <div ref="graphContainer" class="graph-visualization"></div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import * as d3 from 'd3'

const props = defineProps({
  matrix: {
    type: Array,
    default: () => []
  },
  size: {
    type: Number,
    default: 6
  },
  editable: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['matrix-change'])

const graphContainer = ref(null)
let svg = null
let nodes = []
let links = []
let simulation = null

const svgSize = { width: 420, height: 360 }
const nodeRadius = 16

// 初始化图形
const initGraph = () => {
  if (!graphContainer.value || !props.matrix.length) return

  // 清除现有的SVG
  d3.select(graphContainer.value).selectAll('*').remove()

  // 创建SVG
  svg = d3.select(graphContainer.value)
    .append('svg')
    .attr('width', svgSize.width)
    .attr('height', svgSize.height)
    .attr('viewBox', `0 0 ${svgSize.width} ${svgSize.height}`)

  // 创建定义和渐变
  const defs = svg.append('defs')
  const gradient = defs.append('linearGradient')
    .attr('id', 'nodeGradient')
    .attr('gradientTransform', 'rotate(45)')
  
  gradient.append('stop')
    .attr('offset', '0%')
    .attr('stop-color', '#4050F8')
  
  gradient.append('stop')
    .attr('offset', '100%')
    .attr('stop-color', '#7848E8')

  updateGraph()
}

// 更新图形数据
const updateGraph = () => {
  if (!svg || !props.matrix.length) return

  // 生成节点数据
  nodes = Array.from({ length: props.size }, (_, i) => ({
    id: i,
    x: Math.random() * (svgSize.width - 2 * nodeRadius) + nodeRadius,
    y: Math.random() * (svgSize.height - 2 * nodeRadius) + nodeRadius
  }))

  // 生成连接数据
  links = []
  for (let i = 0; i < props.size; i++) {
    for (let j = i + 1; j < props.size; j++) {
      if (props.matrix[i] && props.matrix[i][j] === 1) {
        links.push({
          source: i,
          target: j
        })
      }
    }
  }

  // 创建力导向仿真
  simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(80))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(svgSize.width / 2, svgSize.height / 2))
    .force('collision', d3.forceCollide().radius(nodeRadius + 5))

  // 绘制连接线
  const linkElements = svg.selectAll('.link')
    .data(links, d => `${d.source.id || d.source}-${d.target.id || d.target}`)

  linkElements.exit().remove()

  const linkEnter = linkElements.enter()
    .append('line')
    .attr('class', 'link')
    .style('stroke', '#8C8FA3')
    .style('stroke-width', 2)
    .style('opacity', 0.6)

  linkElements.merge(linkEnter)

  // 绘制节点
  const nodeElements = svg.selectAll('.node')
    .data(nodes, d => d.id)

  nodeElements.exit().remove()

  const nodeEnter = nodeElements.enter()
    .append('g')
    .attr('class', 'node')

  // 节点圆圈
  nodeEnter.append('circle')
    .attr('r', nodeRadius)
    .style('fill', 'url(#nodeGradient)')
    .style('stroke', '#FFFFFF')
    .style('stroke-width', 2)
    .style('cursor', props.editable ? 'grab' : 'default')

  // 节点标签
  nodeEnter.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .style('fill', '#FFFFFF')
    .style('font-size', '14px')
    .style('font-weight', '600')
    .style('pointer-events', 'none')
    .text(d => d.id)

  const nodeUpdate = nodeElements.merge(nodeEnter)

  // 添加拖拽行为
  if (props.editable) {
    nodeUpdate.call(d3.drag()
      .on('start', dragStarted)
      .on('drag', dragged)
      .on('end', dragEnded)
    )

    // 添加连接拖拽行为
    let dragLine = null
    let isDraggingConnection = false
    let sourceNode = null

    nodeUpdate.on('mousedown', function(event, d) {
      if (event.shiftKey) {
        event.stopPropagation()
        isDraggingConnection = true
        sourceNode = d

        // 创建临时连接线
        dragLine = svg.append('line')
          .attr('class', 'drag-line')
          .style('stroke', '#4050F8')
          .style('stroke-width', 2)
          .style('stroke-dasharray', '5,5')
          .attr('x1', d.x)
          .attr('y1', d.y)
          .attr('x2', d.x)
          .attr('y2', d.y)
      }
    })

    svg.on('mousemove', function(event) {
      if (isDraggingConnection && dragLine) {
        const [x, y] = d3.pointer(event)
        dragLine
          .attr('x2', x)
          .attr('y2', y)
      }
    })

    svg.on('mouseup', function(event) {
      if (isDraggingConnection) {
        const [x, y] = d3.pointer(event)
        const targetNode = nodes.find(node => {
          const dx = node.x - x
          const dy = node.y - y
          return Math.sqrt(dx * dx + dy * dy) < nodeRadius
        })

        if (targetNode && targetNode !== sourceNode) {
          toggleConnection(sourceNode.id, targetNode.id)
        }

        // 清理
        if (dragLine) {
          dragLine.remove()
          dragLine = null
        }
        isDraggingConnection = false
        sourceNode = null
      }
    })
  }

  // 更新仿真
  simulation.on('tick', () => {
    svg.selectAll('.link')
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y)

    svg.selectAll('.node')
      .attr('transform', d => `translate(${d.x},${d.y})`)
  })
}

// 拖拽事件处理
const dragStarted = (event, d) => {
  if (!event.active) simulation.alphaTarget(0.3).restart()
  d.fx = d.x
  d.fy = d.y
}

const dragged = (event, d) => {
  d.fx = event.x
  d.fy = event.y
}

const dragEnded = (event, d) => {
  if (!event.active) simulation.alphaTarget(0)
  d.fx = null
  d.fy = null
}

// 切换连接状态
const toggleConnection = (sourceId, targetId) => {
  const newMatrix = props.matrix.map(row => [...row])
  const currentValue = newMatrix[sourceId][targetId]
  const newValue = currentValue === 1 ? 0 : 1
  
  newMatrix[sourceId][targetId] = newValue
  newMatrix[targetId][sourceId] = newValue
  
  emit('matrix-change', newMatrix)
}

// 监听属性变化
watch(() => props.matrix, () => {
  nextTick(updateGraph)
}, { deep: true })

watch(() => props.size, () => {
  nextTick(initGraph)
})

watch(() => props.editable, () => {
  nextTick(updateGraph)
})

onMounted(() => {
  nextTick(initGraph)
})
</script>

<style scoped>
.graph-visualization {
  width: 100%;
  height: 100%;
  position: relative;
}

:deep(.link) {
  transition: stroke-width 0.2s;
}

:deep(.link:hover) {
  stroke-width: 3px;
}

:deep(.node circle) {
  transition: r 0.2s;
}

:deep(.node:hover circle) {
  r: 18px;
}

:deep(.drag-line) {
  pointer-events: none;
}
</style> 