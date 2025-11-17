<template>
  <div class="tsp-page">
    <el-card class="main-card">
      <div class="card-content">
        <!-- 左列：矩阵和图 -->
        <div class="left-column">
                  <!-- 求解模型选择 -->
          <div class="controls-top">
            <span class="label">求解模型选择：</span>
            <el-radio-group v-model="solveType" class="solve-type-group">
              <el-radio-button label="classic">经典计算</el-radio-button>
              <el-radio-button label="sim">量子芯片模拟计算</el-radio-button>
              <el-radio-button label="cloud">量子云服务计算</el-radio-button>
            </el-radio-group>
          </div>
          <!-- 距离矩阵（可非负权重） -->
          <el-card class="matrix-card">
            <template #header>
              <div class="matrix-header">
                <span>距离矩阵</span>
                <div class="matrix-actions">
                  <el-button size="small" :type="matrixMode === 'custom' ? 'primary' : ''" @click="setMatrixMode('custom')">自定义</el-button>
                  <el-button size="small" @click="generateRandomMatrix">随机生成</el-button>
                  <el-button size="small" @click="triggerFileInput">数据导入(txt/csv)</el-button>
                  <input ref="fileInput" type="file" accept=".csv,.txt" style="display:none" @change="handleFileImport" />
                </div>
              </div>
            </template>

            <div class="matrix-grid">
              <div v-for="(row, i) in distanceMatrix" :key="i" class="matrix-row">
                <div
                  v-for="(cell, j) in row"
                  :key="j"
                  class="matrix-cell"
                  :class="{ editable: matrixMode === 'custom' && i !== j }"
                  @click="toggleMatrixCell(i, j)"
                >
                  {{ cell }}
                </div>
              </div>
            </div>
            <div class="tip">点击单元格编辑权重；输入0表示删除该边（对称）。</div>
          </el-card>

          <!-- TSP可视化 -->
          <div class="tsp-visualization">
            <TSPGraph
              :cities="cities"
              :route="currentRoute"
              :bestRoute="bestRoute"
              :editable="true"
              :selected-nodes="selectedNodes"
              :distance-matrix="distanceMatrix"
              @city-click="onCityClick"
              @city-move="handleCityMove"
              @route-change="handleRouteChange"
            />
          </div>
        </div>

        <!-- 右列：求解状态和结果 -->
        <div class="right-column">
          <!-- 求解按钮 -->
          <div class="solve-area">
            <el-button
              type="primary"
              size="large"
              :loading="solving"
              @click="submitSolve"
              class="solve-btn"
            >
              {{ solving ? '求解中...' : '求解' }}
            </el-button>
            <el-button @click="cancelSolve">取消任务</el-button>
          </div>

          <!-- 求解状态 -->
          <div class="solve-state">
            <div class="state-icon" :class="statusClass"></div>
            <div class="state-text">{{ statusText }}</div>
          </div>

          <div class="solve-time">求解时间：{{ solveTime }}</div>

          <!-- 城市设置 -->
          <el-card class="cities-card">
            <template #header>
              <span>城市设置</span>
            </template>
            
            <div class="cities-controls">
              <div class="control-item">
                <label>城市数量：</label>
                <el-input-number
                  v-model="cityCount"
                  :min="3"
                  :max="24"
                  @change="generateCitiesAndMatrix"
                />
              </div>
              
              <div class="control-item">
                <label>生成模式：</label>
                <el-select v-model="generationMode" @change="generateCitiesAndMatrix">
                  <el-option label="随机分布" value="random" />
                  <el-option label="网格分布" value="grid" />
                  <el-option label="环形分布" value="circle" />
                  <el-option label="聚类分布" value="cluster" />
                </el-select>
              </div>

              <div class="control-buttons">
                <el-button @click="generateCitiesAndMatrix">重新生成</el-button>
                <el-button @click="clearRoute">清除路径</el-button>
              </div>
            </div>
          </el-card>

          <!-- 统计信息 -->
          <el-card class="stats-card">
            <template #header>
              <span>统计信息</span>
            </template>
            
            <div class="stats-content">
              <div class="stat-item">
                <span class="label">城市数：</span>
                <span class="value">{{ cityCount }}</span>
              </div>
              <div class="stat-item">
                <span class="label">边数（非零）：</span>
                <span class="value">{{ positiveEdgeCount }}</span>
              </div>
              <div class="stat-item">
                <span class="label">当前路径长度：</span>
                <span class="value">{{ currentDistance.toFixed(2) }}</span>
              </div>
              <div class="stat-item">
                <span class="label">最短路径长度：</span>
                <span class="value">{{ bestDistance.toFixed(2) }}</span>
              </div>
            </div>
          </el-card>



          <!-- 算法日志 -->
          <el-card class="log-card">
            <template #header>
              <span>算法日志</span>
            </template>
            <div class="log-entries">
              <div v-for="(log, index) in logs" :key="index" class="log-entry">
                {{ log }}
              </div>
            </div>
          </el-card>
        </div>
      </div>
    </el-card>
    <el-card class="history-card">
      <template #header>
        <div class="history-header">
          <h3>任务历史</h3>
          <el-button size="small" @click="clearHistory">清空历史</el-button>
        </div>
      </template>
      <el-table :data="taskHistory" stripe style="width: 100%">
        <el-table-column prop="taskName" label="任务名" width="200" />
        <el-table-column prop="modelType" label="模型" width="150">
          <template #default="{ row }">
            {{ getModelTypeText(row.modelType) }}
          </template>
        </el-table-column>
        <el-table-column prop="timestamp" label="提交时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.timestamp) }}
          </template>
        </el-table-column>
        <el-table-column prop="matrixSize" label="规模" width="80" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="bestValue" label="最优值" width="100" />
        <el-table-column prop="solveTime" label="求解时间" width="120" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import TSPGraph from '../components/TSPGraph.vue'
import { submitTask, getTaskStatus, cancelTask } from '../api/index.js'
import { ElMessageBox } from 'element-plus'

// 响应式数据
const cityCount = ref(8)
const generationMode = ref('random')
const algorithm = ref('nearest')
const temperature = ref(500)
const populationSize = ref(100)
const solveType = ref('classic')
const solving = ref(false)
const statusClass = ref('status-idle')
const statusText = ref('等待求解')
const solveTime = ref('--')
const iterations = ref(0)
const logs = ref(['TSP求解系统已就绪'])
const currentTaskId = ref(null)

// 任务历史
const taskHistory = ref([])

const cities = ref([])
const currentRoute = ref([])
const bestRoute = ref([])

// 两点选择用于添加/删除边（并输入权重）
const selectedNodes = ref([])

// 距离矩阵（允许非负数）
const distanceMatrix = ref([])
const matrixMode = ref('custom')
const fileInput = ref(null)

// 计算属性
const currentDistance = computed(() => {
  if (currentRoute.value.length < 2) return 0
  return calculateRouteDistance(currentRoute.value)
})

const bestDistance = computed(() => {
  if (bestRoute.value.length < 2) return 0
  return calculateRouteDistance(bestRoute.value)
})

const optimizationRatio = computed(() => {
  if (currentDistance.value === 0 || bestDistance.value === 0) return 0
  return ((currentDistance.value - bestDistance.value) / currentDistance.value * 100).toFixed(1)
})

const positiveEdgeCount = computed(() => {
  const m = distanceMatrix.value
  let count = 0
  for (let i = 0; i < m.length; i++) {
    for (let j = i + 1; j < m.length; j++) {
      if ((m[i][j] ?? 0) > 0) count++
    }
  }
  return count
})

// 方法
const generateCitiesAndMatrix = () => {
  generateCities()
  // 初始化/重置距离矩阵
  const size = cityCount.value
  distanceMatrix.value = Array(size).fill().map(() => Array(size).fill(0))
  // 清除路径结果
  bestRoute.value = []
}

const generateCities = () => {
  cities.value = []
  switch (generationMode.value) {
    case 'random': generateRandomCities(); break
    case 'grid': generateGridCities(); break
    case 'circle': generateCircleCities(); break
    case 'cluster': generateClusterCities(); break
  }
  currentRoute.value = Array.from({ length: cityCount.value }, (_, i) => i)
  bestRoute.value = []
  addLog(`生成${cityCount.value}个城市，${generationMode.value}分布`)
}

const generateRandomCities = () => {
  for (let i = 0; i < cityCount.value; i++) {
    cities.value.push({
      id: i,
      x: Math.random() * 360 + 40,
      y: Math.random() * 280 + 40,
      name: `城市${i}`
    })
  }
}

const generateGridCities = () => {
  const side = Math.ceil(Math.sqrt(cityCount.value))
  const spacing = 300 / side
  
  for (let i = 0; i < cityCount.value; i++) {
    const row = Math.floor(i / side)
    const col = i % side
    cities.value.push({
      id: i,
      x: 60 + col * spacing,
      y: 60 + row * spacing,
      name: `城市${i}`
    })
  }
}

const generateCircleCities = () => {
  const centerX = 200
  const centerY = 180
  const radius = 120
  
  for (let i = 0; i < cityCount.value; i++) {
    const angle = (2 * Math.PI * i) / cityCount.value
    cities.value.push({
      id: i,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      name: `城市${i}`
    })
  }
}

const generateClusterCities = () => {
  const clusterCount = Math.min(3, Math.ceil(cityCount.value / 3))
  const clusterCenters = []
  
  // 生成聚类中心
  for (let i = 0; i < clusterCount; i++) {
    clusterCenters.push({
      x: Math.random() * 300 + 50,
      y: Math.random() * 240 + 50
    })
  }
  
  // 在聚类中心周围生成城市
  for (let i = 0; i < cityCount.value; i++) {
    const clusterIndex = i % clusterCount
    const center = clusterCenters[clusterIndex]
    const angle = Math.random() * 2 * Math.PI
    const distance = Math.random() * 50 + 10
    
    cities.value.push({
      id: i,
      x: center.x + distance * Math.cos(angle),
      y: center.y + distance * Math.sin(angle),
      name: `城市${i}`
    })
  }
}

// removed duplicate calculateRouteDistance (see distance-aware implementation below)

const clearRoute = () => {
  currentRoute.value = []
  bestRoute.value = []
  addLog('清除所有路径')
}

const startSolve = async () => {
  solving.value = true
  statusClass.value = 'status-running'
  statusText.value = '求解中'
  iterations.value = 0
  
  const startTime = Date.now()
  addLog(`开始使用${algorithm.value}算法求解TSP`)
  
  try {
    // 执行求解算法
    const result = await executeTSPAlgorithm()
    
    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)
    
    currentRoute.value = result.route
    bestRoute.value = result.route
    iterations.value = result.iterations
    
    statusClass.value = 'status-success'
    statusText.value = '求解成功'
    solveTime.value = `${duration}s`
    
    addLog(`求解完成，最短距离：${bestDistance.value.toFixed(2)}，迭代${result.iterations}次`)
    
  } catch (error) {
    statusClass.value = 'status-fail'
    statusText.value = '求解失败'
    addLog('求解失败：' + error.message)
  } finally {
    solving.value = false
  }
}

const executeTSPAlgorithm = () => {
  return new Promise((resolve) => {
    let result
    
    switch (algorithm.value) {
      case 'nearest':
        result = nearestNeighborAlgorithm()
        break
      case 'greedy':
        result = greedyAlgorithm()
        break
      case 'annealing':
        result = simulatedAnnealingAlgorithm()
        break
      default:
        result = nearestNeighborAlgorithm()
    }
    
    resolve(result)
  })
}

const nearestNeighborAlgorithm = () => {
  const unvisited = new Set(Array.from({ length: cityCount.value }, (_, i) => i))
  const route = []
  let current = 0 // 从第一个城市开始
  
  route.push(current)
  unvisited.delete(current)
  
  while (unvisited.size > 0) {
    let nearest = null
    let nearestDistance = Infinity
    
    for (const city of unvisited) {
      const distance = getDistance(current, city)
      if (distance < nearestDistance) {
        nearest = city
        nearestDistance = distance
      }
    }
    
    route.push(nearest)
    unvisited.delete(nearest)
    current = nearest
  }
  
  return {
    route,
    iterations: cityCount.value
  }
}

const greedyAlgorithm = () => {
  // 贪心算法：选择最短的边
  const edges = []
  
  // 生成所有边
  for (let i = 0; i < cityCount.value; i++) {
    for (let j = i + 1; j < cityCount.value; j++) {
      edges.push({
        from: i,
        to: j,
        distance: getDistance(i, j)
      })
    }
  }
  
  // 按距离排序
  edges.sort((a, b) => a.distance - b.distance)
  
  // 使用贪心策略构建路径
  const route = nearestNeighborAlgorithm().route
  
  return {
    route,
    iterations: edges.length
  }
}

const simulatedAnnealingAlgorithm = () => {
  let currentRoute = [...currentRoute.value]
  let bestRoute = [...currentRoute]
  let currentTemp = temperature.value
  let iterations = 0
  const maxIterations = 1000
  
  while (currentTemp > 1 && iterations < maxIterations) {
    const newRoute = [...currentRoute]
    
    // 随机交换两个城市
    const i = Math.floor(Math.random() * cityCount.value)
    const j = Math.floor(Math.random() * cityCount.value)
    [newRoute[i], newRoute[j]] = [newRoute[j], newRoute[i]]
    
    const currentDist = calculateRouteDistance(currentRoute)
    const newDist = calculateRouteDistance(newRoute)
    const bestDist = calculateRouteDistance(bestRoute)
    
    // 接受条件
    if (newDist < currentDist || Math.random() < Math.exp(-(newDist - currentDist) / currentTemp)) {
      currentRoute = newRoute
      
      if (newDist < bestDist) {
        bestRoute = [...newRoute]
      }
    }
    
    currentTemp *= 0.995 // 降温
    iterations++
  }
  
  return {
    route: bestRoute,
    iterations
  }
}

// removed duplicate getDistance (use distanceBetween)

const stepSolve = () => {
  if (currentRoute.value.length < 2) return
  
  // 执行一次2-opt优化
  const route = [...currentRoute.value]
  let improved = false
  
  for (let i = 0; i < route.length - 1; i++) {
    for (let j = i + 2; j < route.length; j++) {
      const newRoute = [...route]
      
      // 反转i+1到j之间的路径
      for (let k = 0; k <= j - i - 1; k++) {
        newRoute[i + 1 + k] = route[j - k]
      }
      
      if (calculateRouteDistance(newRoute) < calculateRouteDistance(route)) {
        currentRoute.value = newRoute
        improved = true
        addLog(`2-opt优化：交换段[${i+1},${j}]，距离减少`)
        break
      }
    }
    if (improved) break
  }
  
  if (!improved) {
    addLog('2-opt优化：未找到更好的解')
  }
}

const resetToWorst = () => {
  // 生成一个相对较差的路径（随机排列）
  const route = Array.from({ length: cityCount.value }, (_, i) => i)
  for (let i = route.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[route[i], route[j]] = [route[j], route[i]]
  }
  
  currentRoute.value = route
  addLog('重置为随机路径')
}

const handleCityMove = (cityId, newX, newY) => {
  if (cities.value[cityId]) {
    cities.value[cityId].x = newX
    cities.value[cityId].y = newY
    addLog(`移动城市${cityId}到新位置`)
  }
}

const handleRouteChange = (newRoute) => {
  currentRoute.value = newRoute
  addLog('手动修改路径')
}

const onCityClick = async (cityId) => {
  // 选中两点
  if (selectedNodes.value.includes(cityId)) {
    selectedNodes.value = selectedNodes.value.filter(id => id !== cityId)
    return
  }
  if (selectedNodes.value.length < 2) {
    selectedNodes.value = [...selectedNodes.value, cityId]
  } else {
    selectedNodes.value = [cityId]
  }
  
  if (selectedNodes.value.length === 2) {
    const [a, b] = selectedNodes.value
    // 询问边权：0 表示删除
    const { value } = await ElMessageBox.prompt('请输入边长度（非负数，0 表示删除边）', '设置边权', {
      inputValue: String(distanceMatrix.value[a][b] || 0),
      inputPattern: /^\d+(?:\.\d+)?$/,
      inputErrorMessage: '请输入非负数',
      confirmButtonText: '确定',
      cancelButtonText: '取消'
    }).catch(() => ({ value: null }))
    if (value !== null && value !== undefined) {
      const w = parseFloat(value)
      setEdgeWeight(a, b, w)
    }
    selectedNodes.value = []
  }
}

const setEdgeWeight = (i, j, w) => {
  if (i === j) return
  const a = Math.min(i, j)
  const b = Math.max(i, j)
  if (w <= 0 || isNaN(w)) {
    distanceMatrix.value[a][b] = 0
    distanceMatrix.value[b][a] = 0
    addLog(`删除边 (${a}, ${b})`)
  } else {
    distanceMatrix.value[a][b] = w
    distanceMatrix.value[b][a] = w
    addLog(`设置边 (${a}, ${b}) = ${w}`)
  }
  // 修改边权时清除路径结果
  bestRoute.value = []
}

// 距离矩阵交互：自定义/随机/导入
const setMatrixMode = (mode) => { 
  matrixMode.value = mode
  // 切换模式时清除路径结果
  bestRoute.value = []
  addLog('切换矩阵模式，清除路径结果')
}

const generateRandomMatrix = () => {
  const size = cityCount.value
  const m = Array(size).fill().map(() => Array(size).fill(0))
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      const w = Math.random() < 0.6 ? (Math.random() * 9 + 1) : 0 // 60% 概率有边
      m[i][j] = Number(w.toFixed(1))
      m[j][i] = m[i][j]
    }
  }
  distanceMatrix.value = m
  // 清除路径结果
  bestRoute.value = []
  addLog('随机生成距离矩阵（非负权），覆盖当前图结构')
}

const triggerFileInput = () => { fileInput.value && fileInput.value.click() }

const handleFileImport = (event) => {
  const file = event.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const content = e.target.result
      const lines = content.trim().split('\n').filter(line => line.trim())
      
      if (lines.length === 0) {
        addLog('导入失败：文件为空')
        return
      }
      
      const newMatrix = lines.map((line, lineIdx) => 
        line.split(/[\,\s]+/).filter(cell => cell.trim()).map((cell, colIdx) => {
          const val = cell.trim()
          const num = parseFloat(val)
          
          // 检查是否为有效数字
          if (isNaN(num)) {
            throw new Error(`第${lineIdx + 1}行第${colIdx + 1}列包含非数字：${val}`)
          }
          
          // 检查是否为负数
          if (num < 0) {
            throw new Error(`第${lineIdx + 1}行第${colIdx + 1}列为负数：${num}（距离必须非负）`)
          }
          
          // 检查是否为整数或浮点数
          if (!Number.isFinite(num)) {
            throw new Error(`第${lineIdx + 1}行第${colIdx + 1}列不是有效数值：${val}`)
          }
          
          return num
        })
      )
      
      // 验证1：检查是否为方阵
      const size = newMatrix.length
      if (size === 0) {
        addLog('导入失败：矩阵为空')
        return
      }
      
      for (let i = 0; i < size; i++) {
        if (newMatrix[i].length !== size) {
          addLog(`导入失败：不是方阵（第${i + 1}行有${newMatrix[i].length}列，期望${size}列）`)
          return
        }
      }
      
      // 验证2：检查对角线是否为0（无自环）
      for (let i = 0; i < size; i++) {
        if (newMatrix[i][i] !== 0) {
          addLog(`导入失败：对角线元素[${i}][${i}]=${newMatrix[i][i]}，不允许自环（必须为0）`)
          return
        }
      }
      
      // 验证3：检查是否对称
      for (let i = 0; i < size; i++) {
        for (let j = i + 1; j < size; j++) {
          const diff = Math.abs(newMatrix[i][j] - newMatrix[j][i])
          // 使用小的容差来处理浮点数精度问题
          if (diff > 0.0001) {
            addLog(`导入失败：矩阵不对称（[${i}][${j}]=${newMatrix[i][j]}，但[${j}][${i}]=${newMatrix[j][i]}）`)
            return
          }
          // 确保完全对称
          newMatrix[j][i] = newMatrix[i][j]
        }
      }
      
      // 验证4：检查规模是否在允许范围内
      if (size < 3 || size > 24) {
        addLog(`导入失败：矩阵规模${size}超出范围（允许3-24）`)
        return
      }
      
      // 验证5：检查是否所有非对角线元素都为0（这样的矩阵无意义）
      let hasEdge = false
      for (let i = 0; i < size; i++) {
        for (let j = i + 1; j < size; j++) {
          if (newMatrix[i][j] > 0) {
            hasEdge = true
            break
          }
        }
        if (hasEdge) break
      }
      
      if (!hasEdge) {
        addLog('警告：矩阵中没有任何正权重边，TSP问题无意义')
      }
      
      // 所有验证通过，导入数据
      cityCount.value = size
      distanceMatrix.value = newMatrix
      generateCities() // 重建城市布局与默认路径
      
      // 计算边数（非零边）
      let edgeCount = 0
      for (let i = 0; i < size; i++) {
        for (let j = i + 1; j < size; j++) {
          if (newMatrix[i][j] > 0) edgeCount++
        }
      }
      
      addLog(`数据导入成功：${size}×${size}距离矩阵，${edgeCount}条非零边`)
      
    } catch (err) {
      console.error('文件解析失败:', err)
      addLog(`导入失败：${err.message}`)
    }
  }
  reader.readAsText(file)
}

const toggleMatrixCell = async (i, j) => {
  if (matrixMode.value !== 'custom' || i === j) return
  const { value } = await ElMessageBox.prompt('请输入边长度（非负数，0 表示删除边）', '编辑矩阵单元', {
    inputValue: String(distanceMatrix.value[i][j] || 0),
    inputPattern: /^\d+(?:\.\d+)?$/,
    inputErrorMessage: '请输入非负数',
    confirmButtonText: '确定',
    cancelButtonText: '取消'
  }).catch(() => ({ value: null }))
  if (value !== null && value !== undefined) {
    const w = parseFloat(value)
    setEdgeWeight(i, j, w)
  }
}

// 求解提交（统一POST参数）
const submitSolve = async () => {
  try {
    solving.value = true
    statusClass.value = 'status-running'
    statusText.value = '求解中'
    const start = Date.now()

    const payload = {
      taskName: `TSP_${Date.now()}`,
      problemType: 'tsp',
      modelType: solveType.value, // classic | sim | cloud
      algorithm: algorithm.value,
      matrixSize: cityCount.value,
      cities: cities.value.map(c => ({ id: c.id, x: c.x, y: c.y })),
      adjacencyMatrix: distanceMatrix.value
    }

    const res = await submitTask(payload)
    if (res?.success) {
      currentTaskId.value = res.taskId
      addLog(`任务已提交，ID: ${res.taskId}`)
      
      // 添加到任务历史
      addTaskToHistory({
        taskId: res.taskId,
        taskName: payload.taskName,
        modelType: payload.modelType,
        timestamp: new Date().toISOString(),
        matrixSize: payload.matrixSize,
        status: 'queued',
        bestValue: '--',
        solveTime: '--'
      })
      
      // 开始轮询任务状态
      await pollTaskStatus(res.taskId, start)
    } else {
      throw new Error(res?.message || '提交失败')
    }
  } catch (e) {
    statusClass.value = 'status-fail'
    statusText.value = '提交失败'
    addLog('提交失败：' + e.message)
    solving.value = false
  }
}

// 轮询任务状态
const pollTaskStatus = async (taskId, startTime) => {
  const pollInterval = 2000 // 2秒轮询一次
  
  const poll = async () => {
    try {
      const statusResponse = await getTaskStatus(taskId)
      
      if (statusResponse.state === 'completed') {
        // 任务完成
        const endTime = Date.now()
        const duration = ((endTime - startTime) / 1000).toFixed(2)
        
        statusClass.value = 'status-success'
        statusText.value = '求解成功'
        solveTime.value = `${duration}s`
        solving.value = false
        
        // 更新结果
        console.log("-----GET RESULT FROM BACKEND------")
        console.log(statusResponse)
        console.log("-----RESULT END------")
        
        // 解析后端返回的结果
        const resultCandidates = statusResponse.results?.candidates || []
        if (resultCandidates.length > 0) {
          // 取第一个候选结果
          const bestResult = resultCandidates[0]
          const solutionMatrix = bestResult.solution // 一维数组
          const routeValue = bestResult.value // 路径长度
          
          // 将解矩阵转换为路径
          // solutionMatrix是N×N矩阵的一维表示
          // 第i行第j列为1表示第i步经过第j个节点
          const n = cityCount.value
          const route = []
          
          if (Array.isArray(solutionMatrix)) {
            for (let step = 0; step < n; step++) {
              for (let node = 0; node < n; node++) {
                const index = step * n + node // 一维数组索引
                if (solutionMatrix[index] === 1) {
                  route.push(node)
                  break
                }
              }
            }
          }
          
          console.log("解析的路径:", route)
          console.log("路径长度:", routeValue)
          
          bestRoute.value = route
          currentRoute.value = route
          
          // 更新任务历史
          updateTaskInHistory(taskId, {
            status: 'completed',
            bestValue: routeValue.toFixed(2),
            solveTime: `${duration}s`
          })
          
          addLog(`求解完成，最短距离：${routeValue.toFixed(2)}`)
        }
        
      } else if (statusResponse.state === 'failed' || statusResponse.state === 'cancelled') {
        // 任务失败或取消
        statusClass.value = 'status-fail'
        statusText.value = statusResponse.state === 'cancelled' ? '已取消' : '求解失败'
        solving.value = false
        addLog(statusResponse.message || '任务失败')
        
        // 更新任务历史
        updateTaskInHistory(taskId, {
          status: statusResponse.state,
          solveTime: '--'
        })
        
      } else if (statusResponse.state === 'processing') {
        // 任务处理中
        statusText.value = '计算中...'
        updateTaskInHistory(taskId, { status: 'processing' })
        setTimeout(poll, pollInterval)
        
      } else if (statusResponse.state === 'queued') {
        // 任务排队中
        statusText.value = `排队中${statusResponse.queuePosition ? `(第${statusResponse.queuePosition}位)` : ''}`
        updateTaskInHistory(taskId, { status: 'queued' })
        setTimeout(poll, pollInterval)
      }
      
    } catch (error) {
      statusClass.value = 'status-fail'
      statusText.value = '连接失败'
      solving.value = false
      addLog('无法获取任务状态: ' + error.message)
    }
  }
  
  // 开始轮询
  setTimeout(poll, pollInterval)
}

const cancelSolve = async () => {
  if (currentTaskId.value) {
    try {
      await cancelTask(currentTaskId.value)
      addLog('取消任务请求已发送')
    } catch (error) {
      addLog('取消任务失败: ' + error.message)
    }
  }
  
  solving.value = false
  statusClass.value = 'status-idle'
  statusText.value = '已取消'
  currentTaskId.value = null
}

const addLog = (message) => {
  const timestamp = new Date().toLocaleTimeString('zh-CN')
  logs.value.unshift(`${timestamp} - ${message}`)
  if (logs.value.length > 20) {
    logs.value = logs.value.slice(0, 20)
  }
}

// 距离函数优先使用矩阵权重
const distanceBetween = (a, b) => {
  const w = distanceMatrix.value?.[a]?.[b]
  if (typeof w === 'number' && w > 0) return w
  const ca = cities.value[a]
  const cb = cities.value[b]
  const dx = ca.x - cb.x
  const dy = ca.y - cb.y
  return Math.sqrt(dx * dx + dy * dy)
}

// 重写路径距离计算以支持权重矩阵
const calculateRouteDistance = (route) => {
  if (route.length < 2) return 0
  let distance = 0
  for (let i = 0; i < route.length; i++) {
    const u = route[i]
    const v = route[(i + 1) % route.length]
    distance += distanceBetween(u, v)
  }
  return distance
}

// 兼容原有算法使用的距离接口
const getDistance = (cityA, cityB) => distanceBetween(cityA, cityB)

// 任务历史相关方法
const loadTaskHistory = () => {
  try {
    const stored = localStorage.getItem('tspTaskHistory')
    if (stored) {
      taskHistory.value = JSON.parse(stored)
    }
  } catch (error) {
    console.error('加载任务历史失败:', error)
    taskHistory.value = []
  }
}

const saveTaskHistory = () => {
  try {
    localStorage.setItem('tspTaskHistory', JSON.stringify(taskHistory.value))
  } catch (error) {
    console.error('保存任务历史失败:', error)
  }
}

const addTaskToHistory = (task) => {
  taskHistory.value.unshift(task)
  if (taskHistory.value.length > 50) {
    taskHistory.value = taskHistory.value.slice(0, 50)
  }
  saveTaskHistory()
}

const updateTaskInHistory = (taskId, updates) => {
  const task = taskHistory.value.find(t => t.taskId === taskId)
  if (task) {
    Object.assign(task, updates)
    saveTaskHistory()
  }
}

const clearHistory = () => {
  taskHistory.value = []
  saveTaskHistory()
  addLog('任务历史已清空')
}

// 辅助函数
const getModelTypeText = (type) => {
  const types = {
    classic: '经典计算',
    sim: '量子芯片模拟',
    cloud: '量子云服务'
  }
  return types[type] || type
}

const getStatusText = (status) => {
  const statuses = {
    queued: '排队中',
    processing: '计算中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消'
  }
  return statuses[status] || status
}

const getStatusType = (status) => {
  const types = {
    queued: 'info',
    processing: 'warning',
    completed: 'success',
    failed: 'danger',
    cancelled: 'info'
  }
  return types[status] || 'info'
}

const formatDate = (timestamp) => {
  const date = new Date(timestamp)
  return `${date.toLocaleDateString('zh-CN')} ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
}

// 初始化
loadTaskHistory()
generateCitiesAndMatrix()
</script>

<style scoped>
.tsp-page {
  padding: 20px;
}

.main-card {
  background: #FFFFFF;
  border-radius: 20px;
  border: 1px solid #E6EAF5;
  box-shadow: 0 10px 20px rgba(9, 30, 66, 0.04);
}

.page-content {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.title-bar {
  width: 4px;
  height: 28px;
  background: linear-gradient(180deg, #4050F8, #7848E8);
  border-radius: 2px;
}

.description {
  color: #666;
  font-size: 14px;
  margin-top: 8px;
}



.card-content {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 20px;
  padding: 20px;
}

.left-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.right-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.matrix-card {
  margin-top: 16px;
}

.matrix-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.matrix-actions {
  display: flex;
  gap: 8px;
}

.matrix-grid {
  display: inline-block;
  border: 1px solid #E6EAF5;
  border-radius: 8px;
  overflow: hidden;
  margin-top: 12px;
}

.matrix-row {
  display: flex;
}

.matrix-cell {
  width: 36px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid #E6EAF5;
  border-bottom: 1px solid #E6EAF5;
  font-size: 12px;
  background: #FAFBFC;
}

.matrix-cell.editable {
  cursor: pointer;
  background: #FFFFFF;
}

.matrix-cell.editable:hover {
  background: #F0F8FF;
}

.matrix-row:last-child .matrix-cell {
  border-bottom: none;
}

.matrix-cell:last-child {
  border-right: none;
}

.tip {
  color: #8C8FA3;
  font-size: 12px;
  margin-top: 8px;
}

.tsp-visualization {
  height: 400px;
  border: 1px solid #E6EAF5;
  border-radius: 12px;
  background: #FAFBFC;
  margin-bottom: 20px;
}



.route-comparison {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.route-item h4 {
  color: #292929;
  margin-bottom: 8px;
  font-size: 14px;
}

.route-sequence {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.route-distance {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.cities-card {
  margin-top: 16px;
}

.cities-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.control-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.control-item label {
  min-width: 80px;
  color: #666;
  font-size: 14px;
}

.stats-card {
  margin-top: 16px;
}

.stats-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-item .label {
  color: #666;
  font-size: 14px;
}

.stat-item .value {
  font-weight: 600;
  color: #292929;
}

.log-card {
  margin-top: 16px;
}

.log-entries {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #E6EAF5;
  border-radius: 8px;
  padding: 12px;
  background: #FAFBFC;
}

.log-entry {
  font-size: 13px;
  color: #333;
  margin-bottom: 4px;
  line-height: 1.4;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 8px;
}

.status-idle { background: #F6F7FA; }
.status-running { background: #FFF7E6; }
.status-success { background: #F0F9F4; }
.status-fail { background: #FEF2F2; }

.status-icon {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.status-idle .status-icon { background: #8C8FA3; }
.status-running .status-icon { background: #F88818; animation: pulse 1.5s infinite; }
.status-success .status-icon { background: #40C878; }
.status-fail .status-icon { background: #E57550; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* MaxCut风格样式 */
.controls-top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.solve-type-group {
  display: flex;
  gap: 12px;
}

.solve-type-group :deep(.el-radio-button__inner) {
  border: 1px solid #DCDFE6;
}

.solve-type-group :deep(.el-radio-button:not(.is-active) .el-radio-button__inner) {
  background: #FFFFFF;
  border-color: #DCDFE6;
}

.solve-state {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #F6F7FA;
  border-radius: 12px;
  margin-bottom: 12px;
}

.state-icon {
  width: 16px;
  height: 16px;
  border-radius: 50%;
}

.state-text {
  font-weight: 500;
  color: #292929;
}

.solve-time {
  color: #8C8FA3;
  font-size: 14px;
  margin-bottom: 20px;
}

.state-icon.status-idle { background: #8C8FA3; }
.state-icon.status-success { background: #40C878; }
.state-icon.status-warning { background: #FFA726; }
.state-icon.status-fail { background: #E57550; }

.solve-area {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.solve-area .solve-btn {
  width: 120px;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
}

.solve-area :deep(.el-button) {
  height: 48px;
}

.label {
  color: #8C8FA3;
  font-size: 14px;
}

.control-buttons {
  display: flex;
  gap: 12px;
}

/* 任务历史列表 */
.history-card { 
  margin-top: 20px; 
  background: #FFFFFF; 
  border-radius: 20px; 
  border: 1px solid #E6EAF5; 
  box-shadow: 0 10px 20px rgba(9, 30, 66, 0.04); 
}
.history-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
}
.history-header h3 { 
  margin: 0; 
  color: #292929; 
  font-weight: 600; 
}
</style> 