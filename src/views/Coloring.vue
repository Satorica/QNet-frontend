<template>
  <div class="coloring-page">
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
            <!-- 邻接矩阵 -->
            <el-card class="matrix-card">
              <template #header>
                <div class="matrix-header">
                  <span>邻接矩阵</span>
                  <div class="matrix-actions">
                    <el-button size="small" :type="matrixMode === 'custom' ? 'primary' : ''" @click="setMatrixMode('custom')">自定义</el-button>
                    <el-button size="small" @click="generateRandomMatrix">随机生成</el-button>
                    <el-button size="small" @click="triggerFileInput">数据导入(txt/csv)</el-button>
                    <input ref="fileInput" type="file" accept=".csv,.txt" style="display: none" @change="handleFileImport" />
                  </div>
                </div>
              </template>

              <div class="matrix-grid">
                <div v-for="(row, i) in adjacencyMatrix" :key="i" class="matrix-row">
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
              <div class="tip">点击单元格切换边关系（对称），会覆盖当前图结构</div>
            </el-card>

            <!-- 图形可视化 -->
            <div class="graph-visualization">
              <ColoringGraph
                :nodes="nodes"
                :edges="edges"
                :coloring="coloring"
                :colors="availableColors"
                :editable="true"
                :selected-nodes="selectedNodes"
                @node-click="onGraphNodeClick"
                @node-color="handleNodeColor"
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

            <!-- 图结构设置 -->
            <el-card class="graph-card">
              <template #header>
                <span>图结构设置</span>
              </template>
              
              <div class="graph-controls">
                <div class="control-item">
                  <label>节点数量：</label>
                  <el-input-number
                    v-model="nodeCount"
                    :min="3"
                    :max="24"
                    @change="generateGraph"
                  />
                </div>
                
                <div class="control-item">
                  <label>图类型：</label>
                  <el-select v-model="graphType" @change="generateGraph">
                    <el-option label="随机图" value="random" />
                    <el-option label="完全图" value="complete" />
                    <el-option label="环图" value="cycle" />
                    <el-option label="星图" value="star" />
                    <el-option label="网格图" value="grid" />
                  </el-select>
                </div>
                
                <div class="control-item" v-if="graphType === 'random'">
                  <label>边密度：</label>
                  <el-slider
                    v-model="edgeDensity"
                    :min="0.1"
                    :max="0.8"
                    :step="0.1"
                    @change="generateGraph"
                    show-input
                  />
                </div>

                <div class="control-buttons">
                  <el-button @click="generateGraph">重新生成</el-button>
                  <el-button @click="clearColoring">清空结果/颜色</el-button>
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
                  <span class="label">节点数：</span>
                  <span class="value">{{ nodeCount }}</span>
                </div>
                <div class="stat-item">
                  <span class="label">边数：</span>
                  <span class="value">{{ edges.length }}</span>
                </div>
                <div class="stat-item">
                  <span class="label">使用颜色：</span>
                  <span class="value">{{ usedColors }}</span>
                </div>
                <div class="stat-item">
                  <span class="label">色数下界：</span>
                  <span class="value">{{ chromaticLowerBound }}</span>
                </div>
                <div class="stat-item">
                  <span class="label">最大度数：</span>
                  <span class="value">{{ maxDegree }}</span>
                </div>
                <div class="stat-item">
                  <span class="label">图密度：</span>
                  <span class="value">{{ graphDensity.toFixed(3) }}</span>
                </div>
              </div>
            </el-card>

            <!-- 操作日志 -->
            <el-card class="log-card">
              <template #header>
                <span>操作日志</span>
              </template>
              <div class="log-entries">
                <div v-for="(log, index) in logs" :key="index" class="log-entry">
                  {{ log }}
                </div>
              </div>
            </el-card>

            <!-- 保留候选结果位 -->
            <el-card class="candidates-card">
              <template #header>
                <span>候选结果（预留）</span>
              </template>
              <div class="candidates-placeholder">未来用于显示候选着色方案</div>
            </el-card>
        </div>
      </div>
    </el-card>

    <!-- 任务历史列表 -->
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
        <el-table-column prop="usedColors" label="使用颜色" width="100" />
        <el-table-column prop="solveTime" label="求解时间" width="120" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { submitTask, getTaskStatus, cancelTask as cancelTaskAPI, getTaskHistory } from '../api/index.js'
import ColoringGraph from '../components/ColoringGraph.vue'

// 响应式数据
const nodeCount = ref(8)
const graphType = ref('random')
const edgeDensity = ref(0.3)
const selectedColor = ref(0)
const statusClass = ref('status-idle')
const statusText = ref('等待操作')
const conflicts = ref(0)
const logs = ref(['图着色系统已就绪'])

const nodes = ref([])
const edges = ref([])
const coloring = ref({})

// 邻接矩阵数据与模式
const matrixMode = ref('custom')
const adjacencyMatrix = ref([])
const fileInput = ref(null)

// 颜色定义
const availableColors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA',
  '#F1948A', '#85CDFD', '#F9E79F', '#D7BDE2'
]

// 两点选中以建边/取消边
const selectedNodes = ref([])

// 求解相关
const solveType = ref('classic')
const solving = ref(false)
const solveTime = ref('0s')
const currentTaskId = ref(null)

// 任务历史
const taskHistory = ref([])

// 计算属性
const usedColors = computed(() => {
  const colors = new Set(Object.values(coloring.value))
  return colors.size
})

const chromaticLowerBound = computed(() => {
  return Math.max(maxDegree.value + 1, Math.ceil(Math.sqrt(nodeCount.value)))
})

const maxDegree = computed(() => {
  if (nodes.value.length === 0) return 0
  const degrees = Array(nodeCount.value).fill(0)
  edges.value.forEach(edge => {
    degrees[edge.source]++
    degrees[edge.target]++
  })
  return Math.max(...degrees)
})

const graphDensity = computed(() => {
  const maxEdges = nodeCount.value * (nodeCount.value - 1) / 2
  return edges.value.length / maxEdges
})

// 方法
const generateGraph = () => {
  // 生成节点布局
  nodes.value = Array.from({ length: nodeCount.value }, (_, i) => ({
    id: i,
    x: 200 + 150 * Math.cos(2 * Math.PI * i / nodeCount.value),
    y: 200 + 150 * Math.sin(2 * Math.PI * i / nodeCount.value)
  }))

  // 按图类型生成边
  edges.value = []
  switch (graphType.value) {
    case 'random': generateRandomGraph(); break
    case 'complete': generateCompleteGraph(); break
    case 'cycle': generateCycleGraph(); break
    case 'star': generateStarGraph(); break
    case 'grid': generateGridGraph(); break
  }

  // 同步邻接矩阵
  syncMatrixFromEdges()

  // 清理状态
  coloring.value = {}
  selectedNodes.value = []
  addLog(`生成${graphType.value}图，${nodeCount.value}个节点，${edges.value.length}条边`)
}

const generateRandomGraph = () => {
  for (let i = 0; i < nodeCount.value; i++) {
    for (let j = i + 1; j < nodeCount.value; j++) {
      if (Math.random() < edgeDensity.value) {
        edges.value.push({ source: i, target: j })
      }
    }
  }
}

const generateCompleteGraph = () => {
  for (let i = 0; i < nodeCount.value; i++) {
    for (let j = i + 1; j < nodeCount.value; j++) {
      edges.value.push({ source: i, target: j })
    }
  }
}

const generateCycleGraph = () => {
  for (let i = 0; i < nodeCount.value; i++) {
    edges.value.push({ source: i, target: (i + 1) % nodeCount.value })
  }
}

const generateStarGraph = () => {
  for (let i = 1; i < nodeCount.value; i++) {
    edges.value.push({ source: 0, target: i })
  }
}

const generateGridGraph = () => {
  const side = Math.ceil(Math.sqrt(nodeCount.value))
  nodes.value = Array.from({ length: nodeCount.value }, (_, i) => {
    const row = Math.floor(i / side)
    const col = i % side
    return { id: i, x: 150 + col * 80, y: 150 + row * 80 }
  })
  for (let i = 0; i < nodeCount.value; i++) {
    const row = Math.floor(i / side)
    const col = i % side
    if (col < side - 1 && i + 1 < nodeCount.value) edges.value.push({ source: i, target: i + 1 })
    if (row < side - 1 && i + side < nodeCount.value) edges.value.push({ source: i, target: i + side })
  }
}

// 两点点击建边/取消边
const onGraphNodeClick = (nodeId) => {
  // 选中逻辑：切换选中
  if (selectedNodes.value.includes(nodeId)) {
    selectedNodes.value = selectedNodes.value.filter(id => id !== nodeId)
  } else {
    if (selectedNodes.value.length < 2) {
      selectedNodes.value = [...selectedNodes.value, nodeId]
    } else {
      // 若已有两个，重置为当前
      selectedNodes.value = [nodeId]
    }
  }

  if (selectedNodes.value.length === 2) {
    const [a, b] = selectedNodes.value
    toggleEdge(a, b)
    // 完成后清空选中，便于继续操作
    selectedNodes.value = []
  }
}

const toggleEdge = (a, b) => {
  if (a === b) return
  const i = Math.min(a, b)
  const j = Math.max(a, b)
  const idx = edges.value.findIndex(e => (e.source === i && e.target === j) || (e.source === j && e.target === i))
  if (idx >= 0) {
    edges.value.splice(idx, 1)
    addLog(`移除边 (${i}, ${j})`)
  } else {
    edges.value.push({ source: i, target: j })
    addLog(`新增边 (${i}, ${j})`)
  }
  // 同步矩阵
  syncMatrixFromEdges()
  // 修改边时清除颜色结果
  coloring.value = {}
}

const clearSelected = () => {
  selectedNodes.value = []
}

const clearEdges = () => {
  edges.value = []
  syncMatrixFromEdges()
  // validateColoring() // 移除前端冲突检测
  addLog('清空所有边')
}

// 矩阵 <-> 边 同步
const syncMatrixFromEdges = () => {
  const size = nodeCount.value
  const m = Array(size).fill().map(() => Array(size).fill(0))
  for (const e of edges.value) {
    m[e.source][e.target] = 1
    m[e.target][e.source] = 1
  }
  adjacencyMatrix.value = m
}

const syncEdgesFromMatrix = () => {
  const size = adjacencyMatrix.value.length
  const newEdges = []
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      if (adjacencyMatrix.value[i][j] === 1) newEdges.push({ source: i, target: j })
    }
  }
  edges.value = newEdges
}

// 邻接矩阵交互
const setMatrixMode = (mode) => {
  matrixMode.value = mode
  // 切换模式时清除颜色结果
  coloring.value = {}
  addLog('切换矩阵模式，清除颜色结果')
}

const generateRandomMatrix = () => {
  const size = nodeCount.value
  const newMatrix = Array(size).fill().map(() => Array(size).fill(0))
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      const connected = Math.random() > 0.6 ? 1 : 0
      newMatrix[i][j] = connected
      newMatrix[j][i] = connected
    }
  }
  adjacencyMatrix.value = newMatrix
  // 覆盖图结构
  syncEdgesFromMatrix()
  // 清除颜色结果
  coloring.value = {}
  addLog('随机生成邻接矩阵并覆盖当前图结构')
}

const triggerFileInput = () => {
  fileInput.value && fileInput.value.click()
}

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
      
      const newMatrix = lines.map(line => 
        line.split(/[\,\s]+/).filter(cell => cell.trim()).map(cell => {
          const val = cell.trim()
          if (val !== '0' && val !== '1') {
            throw new Error(`包含非法字符：${val}（仅允许0和1）`)
          }
          return parseInt(val)
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
      
      // 验证2：检查是否只包含0和1
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          if (newMatrix[i][j] !== 0 && newMatrix[i][j] !== 1) {
            addLog(`导入失败：矩阵[${i}][${j}]=${newMatrix[i][j]}，只允许0或1`)
            return
          }
        }
      }
      
      // 验证3：检查对角线是否为0（无自环）
      for (let i = 0; i < size; i++) {
        if (newMatrix[i][i] !== 0) {
          addLog(`导入失败：对角线元素[${i}][${i}]=${newMatrix[i][i]}，不允许自环（必须为0）`)
          return
        }
      }
      
      // 验证4：检查是否对称
      for (let i = 0; i < size; i++) {
        for (let j = i + 1; j < size; j++) {
          if (newMatrix[i][j] !== newMatrix[j][i]) {
            addLog(`导入失败：矩阵不对称（[${i}][${j}]=${newMatrix[i][j]}，但[${j}][${i}]=${newMatrix[j][i]}）`)
            return
          }
        }
      }
      
      // 验证5：检查规模是否在允许范围内
      if (size < 3 || size > 24) {
        addLog(`导入失败：矩阵规模${size}超出范围（允许3-24）`)
        return
      }
      
      // 所有验证通过，导入数据
      nodeCount.value = size
      adjacencyMatrix.value = newMatrix
      // 覆盖图结构
      rebuildNodesLayout()
      syncEdgesFromMatrix()
      coloring.value = {}
      
      // 计算边数
      let edgeCount = 0
      for (let i = 0; i < size; i++) {
        for (let j = i + 1; j < size; j++) {
          if (newMatrix[i][j] === 1) edgeCount++
        }
      }
      
      addLog(`数据导入成功：${size}×${size}邻接矩阵，${edgeCount}条边`)
      
    } catch (error) {
      console.error('文件解析失败:', error)
      addLog(`导入失败：${error.message}`)
    }
  }
  reader.readAsText(file)
}

const toggleMatrixCell = (i, j) => {
  if (matrixMode.value !== 'custom' || i === j) return
  const newValue = adjacencyMatrix.value[i][j] === 1 ? 0 : 1
  adjacencyMatrix.value[i][j] = newValue
  adjacencyMatrix.value[j][i] = newValue
  syncEdgesFromMatrix()
  // 修改矩阵时清除颜色结果
  coloring.value = {}
}

const rebuildNodesLayout = () => {
  nodes.value = Array.from({ length: nodeCount.value }, (_, i) => ({
    id: i,
    x: 200 + 150 * Math.cos(2 * Math.PI * i / nodeCount.value),
    y: 200 + 150 * Math.sin(2 * Math.PI * i / nodeCount.value)
  }))
}

// 颜色交互（保留以便候选结果展示）
const handleNodeColor = (nodeId, colorIndex) => {
  coloring.value = { ...coloring.value, [nodeId]: colorIndex }
  // validateColoring() // 移除前端冲突检测
}

// 求解方法
const submitSolve = async () => {
  if (nodes.value.length === 0) {
    addLog('请先生成图结构')
    return
  }

  solving.value = true
  statusClass.value = 'status-idle'
  statusText.value = '求解中...'
  conflicts.value = 0
  logs.value = ['求解开始']

  const startTime = Date.now()

  try {
    // 准备任务数据
    const taskData = {
      taskName: `Coloring_${Date.now()}`,
      modelType: solveType.value,
      problemType: 'coloring',
      matrixSize: nodeCount.value,
      adjacencyMatrix: adjacencyMatrix.value
    }
    
    addLog('提交着色任务到后端...')
    
    // 提交任务到后端
    const submitResponse = await submitTask(taskData)
    
    if (submitResponse.success) {
      currentTaskId.value = submitResponse.taskId
      addLog(`任务已提交，ID: ${submitResponse.taskId}`)
      
      // 任务已提交到后端，会自动保存到数据库，不需要手动添加到历史
      
      // 开始轮询任务状态
      await pollTaskStatus(submitResponse.taskId, startTime)
    } else {
      throw new Error(submitResponse.message || '任务提交失败')
    }
    
  } catch (error) {
    console.error('求解失败:', error)
    addLog(`求解失败: ${error.message}`)
    statusClass.value = 'status-fail'
    statusText.value = '求解失败'
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
        
        solveTime.value = `${duration}s`
        solving.value = false
        
        // 解析后端返回的结果
        console.log("着色问题返回结果:", statusResponse.results)
        
        const resultCandidates = statusResponse.results?.candidates || []
        if (resultCandidates.length > 0) {
          // 取第一个候选结果
          const bestResult = resultCandidates[0]
          
          // 解析着色矩阵：solution是一个矩阵，第i行第j列为1表示节点i使用颜色j
          const solutionMatrix = bestResult.solution
          const newColoring = {}
          let conflictCount = 0
          
          // 第一步：找出所有被使用的列（颜色）
          const usedColumnsSet = new Set()
          console.log("-----solutionMatrix START------")
          console.log(solutionMatrix)
          console.log("-----solutionMatrix END------")

          for (let i = 0; i < solutionMatrix.length; i++) {
            if (solutionMatrix[i] === 1) 
              usedColumnsSet.add(i % (Math.sqrt(solutionMatrix.length)));
          }
          if (Array.isArray(solutionMatrix)) {
            for (let i = 0; i < solutionMatrix.length; i++) {
              if (Array.isArray(solutionMatrix[i])) {
                for (let j = 0; j < solutionMatrix[i].length; j++) {
                  if (solutionMatrix[i][j] === 1) {
                    usedColumnsSet.add(j)
                  }
                }
              }
            }
          }
          console.log("-----usedColumnsSet START------")
          console.log(usedColumnsSet)
          console.log("-----usedColumnsSet END------")
          // 第二步：将使用的列映射到连续的颜色索引
          const usedColumns = Array.from(usedColumnsSet).sort((a, b) => a - b)
          const columnToColorMap = {}
          usedColumns.forEach((col, index) => {
            columnToColorMap[col] = index
          })
          
          console.log("使用的列:", usedColumns)
          console.log("列到颜色的映射:", columnToColorMap)
          
          // 第三步：将矩阵转换为着色映射 {nodeId: colorIndex}
          if (Array.isArray(solutionMatrix)) {

            for (let i = 0; i < solutionMatrix.length; i++) {
                if (solutionMatrix[i] === 1) {
                  let color_num = i % Math.sqrt(solutionMatrix.length)
                  newColoring[Math.floor(i / Math.sqrt(solutionMatrix.length))] = columnToColorMap[color_num]
                }
            }
          }
          
          // 检查冲突
          edges.value.forEach(edge => {
            if (newColoring[edge.source] === newColoring[edge.target]) {
              conflictCount++
            }
          })
          
          // 更新图着色
          coloring.value = newColoring
          conflicts.value = conflictCount
          
          const usedColorsCount = usedColumns.length
          
          statusClass.value = conflictCount > 0 ? 'status-fail' : 'status-success'
          statusText.value = conflictCount > 0 ? `冲突数: ${conflictCount}` : '求解成功'
          
          console.log("最终着色结果:", newColoring)
          console.log("使用颜色数:", usedColorsCount)
          
          addLog(`求解完成！使用${usedColorsCount}种颜色，目标值: ${bestResult.value}`)
          addLog(`颜色分配: ${JSON.stringify(newColoring)}`)
          if (conflictCount > 0) {
            addLog(`警告：存在${conflictCount}个颜色冲突`)
          }
          
          // 任务状态已更新到数据库，刷新任务历史
          loadTaskHistory()
        }
        
      } else if (statusResponse.state === 'failed' || statusResponse.state === 'cancelled') {
        // 任务失败或取消
        statusClass.value = 'status-fail'
        statusText.value = statusResponse.state === 'cancelled' ? '已取消' : '求解失败'
        solving.value = false
        addLog(statusResponse.message || '任务失败')
        
        // 任务状态已更新到数据库，刷新任务历史
        loadTaskHistory()
        
      } else if (statusResponse.state === 'processing') {
        // 任务处理中
        statusText.value = '计算中...'
        setTimeout(poll, pollInterval)
        
      } else if (statusResponse.state === 'queued') {
        // 任务排队中
        statusText.value = `排队中${statusResponse.queuePosition ? `(第${statusResponse.queuePosition}位)` : ''}`
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
      await cancelTaskAPI(currentTaskId.value)
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

// 经典算法求解 (示例)
const solveClassic = async (graph) => {
  const n = graph.nodes.length
  const m = graph.edges.length
  const d = Array(n).fill(0)
  const adj = Array(n).fill().map(() => Array(n).fill(0))

  // 构建邻接矩阵
  graph.edges.forEach(edge => {
    const u = edge.source
    const v = edge.target
    adj[u][v] = 1
    adj[v][u] = 1
    d[u]++
    d[v]++
  })

  let usedColors = 0
  let conflicts = 0
  let solution = {}

  // 尝试所有可能的颜色组合
  const maxColors = Math.max(...d) + 1 // 色数下界
  const totalCombinations = Math.pow(availableColors.length, n)
  let bestSolution = {}
  let bestConflicts = Infinity

  for (let i = 0; i < totalCombinations; i++) {
    const currentSolution = {}
    let currentConflicts = 0
    let currentUsedColors = 0

    for (let j = 0; j < n; j++) {
      const colorIndex = (i / Math.pow(availableColors.length, j)) % availableColors.length
      currentSolution[j] = colorIndex
      currentUsedColors++
    }

    // 检查冲突
    for (let u = 0; u < n; u++) {
      for (let v = u + 1; v < n; v++) {
        if (adj[u][v] === 1 && currentSolution[u] === currentSolution[v]) {
          currentConflicts++
        }
      }
    }

    if (currentConflicts < bestConflicts) {
      bestConflicts = currentConflicts
      bestSolution = currentSolution
    }
  }

  // 使用最佳解决方案
  solution = bestSolution
  conflicts = bestConflicts
  usedColors = new Set(Object.values(solution)).size
  
  // 计算统计信息（不能直接赋值给computed属性）
  const computedChromaticLowerBound = Math.max(maxDegree.value + 1, Math.ceil(Math.sqrt(nodeCount.value)))
  const computedMaxDegree = Math.max(...d)
  const computedGraphDensity = m / (n * (n - 1) / 2)

  return { 
    solution, 
    conflicts, 
    usedColors, 
    chromaticLowerBound: computedChromaticLowerBound, 
    maxDegree: computedMaxDegree, 
    graphDensity: computedGraphDensity 
  }
}

// 工具：日志
const addLog = (message) => {
  const timestamp = new Date().toLocaleTimeString('zh-CN')
  logs.value.unshift(`${timestamp} - ${message}`)
  if (logs.value.length > 20) {
    logs.value = logs.value.slice(0, 20)
  }
}

// 清空颜色与状态
const clearColoring = () => {
  coloring.value = {}
  conflicts.value = 0
  selectedNodes.value = []
  addLog('清空结果/颜色')
}

// 监听节点数变化，重建矩阵
watch(nodeCount, () => {
  const size = nodeCount.value
  adjacencyMatrix.value = Array(size).fill().map(() => Array(size).fill(0))
  generateGraph()
})

// 任务历史相关方法
const loadTaskHistory = async () => {
  try {
    const response = await getTaskHistory('coloring', 1, 50)
    if (response.success && response.data) {
      // 转换后端数据格式为前端格式
      taskHistory.value = response.data.tasks.map(task => ({
        taskId: task.taskId,
        taskName: task.taskName,
        modelType: task.modelType,
        timestamp: task.timestamp,
        matrixSize: task.matrixSize,
        status: task.status,
        usedColors: task.usedColors || '--',
        solveTime: task.solveTime || '--'
      }))
    } else {
      taskHistory.value = []
    }
  } catch (error) {
    console.error('加载任务历史失败:', error)
    addLog('加载任务历史失败: ' + error.message)
    taskHistory.value = []
  }
}

const clearHistory = async () => {
  // 清空历史只是清空前端显示，实际数据仍在数据库中
  // 如果需要真正删除，可以调用清理API（需要管理员权限）
  taskHistory.value = []
  addLog('已清空本地任务历史显示')
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
generateGraph()
// 异步加载任务历史
loadTaskHistory()
</script>

<style scoped>
/* MaxCut风格布局 */
.coloring-page { padding: 20px; }
.main-card { background: #FFFFFF; border-radius: 20px; border: 1px solid #E6EAF5; box-shadow: 0 10px 20px rgba(9, 30, 66, 0.04); }
.card-content { display: grid; grid-template-columns: 1fr 400px; gap: 20px; padding: 20px; }

/***** 矩阵样式 *****/
.matrix-card { margin-top: 16px; }
.matrix-header { display: flex; justify-content: space-between; align-items: center; }
.matrix-actions { display: flex; gap: 8px; }
.matrix-grid { display: inline-block; border: 1px solid #E6EAF5; border-radius: 8px; overflow: hidden; margin-top: 12px; }
.matrix-row { display: flex; }
.matrix-cell { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-right: 1px solid #E6EAF5; border-bottom: 1px solid #E6EAF5; font-size: 12px; background: #FAFBFC; }
.matrix-cell.editable { cursor: pointer; background: #FFFFFF; }
.matrix-cell.editable:hover { background: #F0F8FF; }
.matrix-row:last-child .matrix-cell { border-bottom: none; }
.matrix-cell:last-child { border-right: none; }
.tip { color: #8C8FA3; font-size: 12px; margin-top: 8px; }

/***** 右侧图与操作 *****/
.graph-visualization { height: 400px; border: 1px solid #E6EAF5; border-radius: 12px; background: #FAFBFC; margin-bottom: 20px; }
.solve-section { display: flex; gap: 12px; margin-bottom: 20px; }
.solve-btn { width: 160px; height: 48px; font-size: 16px; font-weight: 600; }
.solve-status { margin-bottom: 20px; }
.status-indicator { display: flex; align-items: center; gap: 12px; padding: 16px; border-radius: 12px; margin-bottom: 8px; }
.status-idle { background: #F6F7FA; }
.status-success { background: #F0F9F4; }
.status-warning { background: #FFF8E1; }
.status-fail { background: #FEF2F2; }
.status-icon { width: 12px; height: 12px; border-radius: 50%; }
.status-idle .status-icon { background: #8C8FA3; }
.status-success .status-icon { background: #40C878; }
.status-warning .status-icon { background: #FFA726; }
.status-fail .status-icon { background: #E57550; }
.solve-info { display: flex; gap: 20px; color: #8C8FA3; font-size: 14px; }

/***** 候选结果占位 *****/
.candidates-card { margin-top: 16px; }
.candidates-placeholder { color: #8C8FA3; font-size: 14px; }

/***** 统计与日志 *****/
.stats-content { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.stat-item { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
.stat-item .label { color: #666; font-size: 14px; }
.stat-item .value { font-weight: 600; color: #292929; }
.log-card { margin-top: 16px; }
.log-entries { max-height: 200px; overflow-y: auto; }
.log-entry { font-size: 12px; color: #666; margin-bottom: 4px; }

/* MaxCut风格样式 */
.controls-top { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
.solve-type-group { display: flex; gap: 12px; }
.solve-type-group :deep(.el-radio-button__inner) {
  border: 1px solid #DCDFE6;
}
.solve-type-group :deep(.el-radio-button:not(.is-active) .el-radio-button__inner) {
  background: #FFFFFF;
  border-color: #DCDFE6;
}
.solve-state { display: flex; align-items: center; gap: 12px; padding: 16px; background: #F6F7FA; border-radius: 12px; margin-bottom: 12px; }
.state-icon { width: 16px; height: 16px; border-radius: 50%; }
.state-text { font-weight: 500; color: #292929; }
.solve-time { color: #8C8FA3; font-size: 14px; margin-bottom: 20px; }

.state-icon.status-idle { background: #8C8FA3; }
.state-icon.status-success { background: #40C878; }
.state-icon.status-warning { background: #FFA726; }
.state-icon.status-fail { background: #E57550; }

.solve-area { display: flex; gap: 10px; margin-bottom: 20px; }
.solve-area .solve-btn { width: 120px; height: 48px; font-size: 16px; font-weight: 600; }
.solve-area :deep(.el-button) { height: 48px; }
.label { color: #8C8FA3; font-size: 14px; }

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