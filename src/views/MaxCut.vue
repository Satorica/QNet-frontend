<template>
  <div class="maxcut-page">
    <!-- 主求解卡片 -->
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

          <!-- 矩阵标题和规模控制 -->
          <div class="matrix-header">
            <div class="title-section">
              <div class="title-bar"></div>
              <span class="title-text">请输入图的邻接矩阵：</span>
            </div>
            <div class="size-controls">
              <span class="label">求解问题规模：</span>
              <el-input-number
                v-model="matrixSize"
                :min="2"
                :max="24"
                size="small"
                style="width: 120px"
                @change="generateMatrix"
              />
              <el-button @click="generateMatrix">生成矩阵</el-button>
            </div>
          </div>

          <!-- 矩阵操作按钮 -->
          <div class="matrix-options">
            <el-button :type="editMode === 'custom' ? 'primary' : ''" @click="setEditMode('custom')">自定义</el-button>
            <el-button @click="generateRandomMatrix">随机生成</el-button>
            <el-button @click="triggerFileInput">数据导入(txt/csv)</el-button>
            <input ref="fileInput" type="file" accept=".csv,.txt" style="display: none" @change="handleFileImport" />
            <span class="mode-indicator">模式：{{ editMode === 'custom' ? '编辑' : '查看' }}</span>
          </div>

          <!-- 邻接矩阵网格 -->
          <div class="matrix-grid">
            <div v-for="(row, i) in matrix" :key="i" class="matrix-row">
              <div
                v-for="(cell, j) in row"
                :key="j"
                class="matrix-cell"
                :class="{ editable: editMode === 'custom' && i !== j }"
                @click="toggleCell(i, j)"
              >
                {{ cell }}
              </div>
            </div>
          </div>

          <div class="tip">
            互相转化（邻接矩阵 ↔ 图）。点击矩阵单元格可编辑连接关系（仅自定义模式）。
          </div>

          <!-- 简化的图形显示 -->
          <div class="graph-container">
            <div class="graph-placeholder">
              <p>图形可视化区域</p>
              <p>节点数：{{ matrixSize }}</p>
              <p>边数：{{ edgeCount }}</p>
            </div>
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
              @click="startSolve"
              class="solve-btn"
            >
              {{ solving ? '求解中...' : '求解' }}
            </el-button>
            <el-button @click="cancelSolve">取消任务</el-button>
          </div>

          <!-- 求解状态 -->
          <div class="solve-state">
            <div class="state-icon" :class="stateClass"></div>
            <div class="state-text">{{ stateText }}</div>
          </div>

          <div class="solve-time">求解时间：{{ solveTime }}</div>

          <!-- 日志 -->
          <el-card class="log-card">
            <template #header>
              <span>求解状态</span>
            </template>
            <div class="log-entries">
              <div v-for="(log, index) in logs" :key="index" class="log-entry">
                {{ log }}
              </div>
            </div>
          </el-card>

          <!-- 候选结果 -->
          <el-card class="result-card">
            <template #header>
              <div class="result-header">
                <span>候选结果（3）</span>
                <el-button size="small" @click="exportResults">结果导出</el-button>
              </div>
            </template>
            <div class="candidates">
              <div v-for="(candidate, index) in candidates" :key="index" class="candidate">
                <div class="cand-title">
                  目标值 {{ index + 1 }}：<span class="cand-value">{{ candidate.value || '--' }}</span>
                </div>
                <div class="cand-solution">{{ candidate.solution || '--' }}</div>
              </div>
            </div>
          </el-card>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { submitTask, getTaskStatus, cancelTask } from '../api/index.js'

// 响应式数据
const solveType = ref('classic')
const matrixSize = ref(6)
const editMode = ref('view')
const matrix = ref([])
const solving = ref(false)
const stateClass = ref('state-idle')
const stateText = ref('等待求解')
const solveTime = ref('--')
const logs = ref(['参数校验通过'])
const candidates = ref([
  { value: null, solution: null },
  { value: null, solution: null },
  { value: null, solution: null }
])
const currentTaskId = ref(null)

const fileInput = ref(null)

// 计算属性
const edgeCount = computed(() => {
  let count = 0
  for (let i = 0; i < matrix.value.length; i++) {
    for (let j = i + 1; j < matrix.value[i].length; j++) {
      if (matrix.value[i][j] === 1) count++
    }
  }
  return count
})

// 初始化矩阵
const generateMatrix = () => {
  const size = matrixSize.value
  matrix.value = Array(size).fill().map(() => Array(size).fill(0))
}

// 生成随机矩阵
const generateRandomMatrix = () => {
  const size = matrixSize.value
  const newMatrix = Array(size).fill().map(() => Array(size).fill(0))
  
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      const connected = Math.random() > 0.6 ? 1 : 0
      newMatrix[i][j] = connected
      newMatrix[j][i] = connected
    }
  }
  
  matrix.value = newMatrix
}

// 设置编辑模式
const setEditMode = (mode) => {
  editMode.value = mode
}

// 切换单元格状态
const toggleCell = (i, j) => {
  if (editMode.value === 'custom' && i !== j) {
    const newValue = matrix.value[i][j] === 1 ? 0 : 1
    matrix.value[i][j] = newValue
    matrix.value[j][i] = newValue
  }
}

// 触发文件输入
const triggerFileInput = () => {
  fileInput.value.click()
}

// 处理文件导入
const handleFileImport = (event) => {
  const file = event.target.files[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const content = e.target.result
      const lines = content.trim().split('\n')
      const newMatrix = lines.map(line => 
        line.split(/[,\s]+/).map(cell => parseInt(cell.trim()) || 0)
      )
      
      if (newMatrix.length > 0 && newMatrix[0].length > 0) {
        matrixSize.value = newMatrix.length
        matrix.value = newMatrix
        addLog('数据导入成功')
      }
    } catch (error) {
      console.error('文件解析失败:', error)
      addLog('数据导入失败')
    }
  }
  reader.readAsText(file)
}

// 开始求解
const startSolve = async () => {
  solving.value = true
  stateClass.value = 'state-running'
  stateText.value = '求解中'
  
  const startTime = Date.now()
  addLog('开始求解...')
  
  try {
    // 准备任务数据
    const taskData = {
      taskName: `MaxCut_${Date.now()}`,
      modelType: solveType.value,
      problemType: 'maxcut',
      matrixSize: matrixSize.value,
      adjacencyMatrix: matrix.value
    }
    
    // 提交任务到后端
    const submitResponse = await submitTask(taskData)
    
    if (submitResponse.success) {
      currentTaskId.value = submitResponse.taskId
      addLog(`任务已提交，ID: ${submitResponse.taskId}`)
      
      // 开始轮询任务状态
      await pollTaskStatus(submitResponse.taskId, startTime)
    } else {
      throw new Error(submitResponse.message || '任务提交失败')
    }
    
  } catch (error) {
    stateClass.value = 'state-fail'
    stateText.value = '求解失败'
    addLog('求解失败: ' + error.message)
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
        
        stateClass.value = 'state-success'
        stateText.value = '求解成功'
        solveTime.value = `${duration}s`
        solving.value = false
        
        // 更新结果
        if (statusResponse.results && statusResponse.results.length > 0) {
          candidates.value = statusResponse.results.map(result => ({
            value: result.value || result.objective_value,
            solution: JSON.stringify(result.solution || result.cut)
          }))
        }
        
        addLog('求解完成')
        
      } else if (statusResponse.state === 'failed' || statusResponse.state === 'cancelled') {
        // 任务失败或取消
        stateClass.value = 'state-fail'
        stateText.value = statusResponse.state === 'cancelled' ? '已取消' : '求解失败'
        solving.value = false
        addLog(statusResponse.message || '任务失败')
        
      } else if (statusResponse.state === 'processing') {
        // 任务处理中
        stateText.value = '计算中...'
        addLog('任务正在计算中')
        setTimeout(poll, pollInterval)
        
      } else if (statusResponse.state === 'queued') {
        // 任务排队中
        stateText.value = `排队中${statusResponse.queuePosition ? `(第${statusResponse.queuePosition}位)` : ''}`
        setTimeout(poll, pollInterval)
      }
      
    } catch (error) {
      stateClass.value = 'state-fail'
      stateText.value = '连接失败'
      solving.value = false
      addLog('无法获取任务状态: ' + error.message)
    }
  }
  
  // 开始轮询
  setTimeout(poll, pollInterval)
}

// 取消求解
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
  stateClass.value = 'state-idle'
  stateText.value = '已取消'
  currentTaskId.value = null
}

// 生成模拟结果
const generateMockResults = () => {
  const size = matrixSize.value
  return Array(3).fill().map(() => ({
    value: Math.floor(Math.random() * 1000),
    solution: JSON.stringify(Array(size).fill().map(() => Math.random() > 0.5 ? 1 : 0))
  }))
}

// 添加日志
const addLog = (message) => {
  const now = new Date()
  const timestamp = now.toLocaleString('zh-CN')
  logs.value.unshift(`${timestamp}：${message}`)
}

// 导出结果
const exportResults = () => {
  const data = {
    matrix: matrix.value,
    candidates: candidates.value,
    solveType: solveType.value,
    timestamp: new Date().toISOString()
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `quantum-solve-result-${Date.now()}.json`
  link.click()
  URL.revokeObjectURL(url)
}

onMounted(() => {
  generateMatrix()
})
</script>

<style scoped>
.maxcut-page {
  padding: 20px;
}

.main-card {
  background: #FFFFFF;
  border-radius: 20px;
  border: 1px solid #E6EAF5;
  box-shadow: 0 10px 20px rgba(9, 30, 66, 0.04);
}

.card-content {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 20px;
  padding: 20px;
}

.controls-top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.matrix-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-bar {
  width: 4px;
  height: 20px;
  background: linear-gradient(180deg, #4050F8, #7848E8);
  border-radius: 2px;
}

.title-text {
  font-weight: 600;
  color: #292929;
}

.size-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.matrix-options {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.mode-indicator {
  color: #8C8FA3;
  font-size: 14px;
  margin-left: auto;
}

.matrix-grid {
  display: inline-block;
  border: 1px solid #E6EAF5;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 12px;
}

.matrix-row {
  display: flex;
}

.matrix-cell {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid #E6EAF5;
  border-bottom: 1px solid #E6EAF5;
  font-size: 14px;
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
  margin-bottom: 16px;
}

.graph-container {
  height: 360px;
  border: 1px solid #E6EAF5;
  border-radius: 8px;
  background: #FAFBFC;
  display: flex;
  align-items: center;
  justify-content: center;
}

.graph-placeholder {
  text-align: center;
  color: #8C8FA3;
}

.solve-area {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.solve-btn {
  width: 120px;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
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

.state-idle {
  background: #8C8FA3;
}

.state-running {
  background: #F88818;
  animation: pulse 1.5s infinite;
}

.state-success {
  background: #40C878;
}

.state-fail {
  background: #E57550;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
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

.log-card, .result-card {
  margin-bottom: 20px;
}

.log-entries {
  max-height: 200px;
  overflow-y: auto;
}

.log-entry {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.candidates {
  space-y: 12px;
}

.candidate {
  padding: 12px;
  background: #F6F7FA;
  border-radius: 8px;
  margin-bottom: 8px;
}

.cand-title {
  font-weight: 500;
  margin-bottom: 4px;
}

.cand-value {
  color: #4050F8;
  font-weight: 600;
}

.cand-solution {
  font-size: 12px;
  color: #666;
  word-break: break-all;
}

.label {
  color: #8C8FA3;
  font-size: 14px;
}
</style> 