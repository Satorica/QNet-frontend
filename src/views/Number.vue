<template>
  <div class="number-page">
    <el-card class="main-card">
      <div class="page-content">
        <div class="page-header">
          <div class="title-section">
            <div class="title-bar"></div>
            <h2>数字分割问题</h2>
          </div>
          <p class="description">
            将一组数字分成两个子集，使得两个子集的和尽可能接近。
          </p>
        </div>

        <div class="content-grid">
          <div class="left-panel">
            <!-- 数字输入区域 -->
            <el-card class="input-card">
              <template #header>
                <span>数字输入</span>
              </template>
              
              <div class="number-input-area">
                <el-input
                  v-model="numberInput"
                  type="textarea"
                  :rows="4"
                  placeholder="请输入数字，用逗号或空格分隔，例如：1,2,3,4,5"
                />
                <div class="input-buttons">
                  <el-button @click="parseNumbers">解析数字</el-button>
                  <el-button @click="generateRandomNumbers">随机生成</el-button>
                  <el-button @click="clearNumbers">清空</el-button>
                </div>
              </div>

              <div class="number-list" v-if="numbers.length > 0">
                <h4>当前数字列表（{{ numbers.length }}个）：</h4>
                <div class="number-tags">
                  <el-tag
                    v-for="(num, index) in numbers"
                    :key="index"
                    closable
                    @close="removeNumber(index)"
                    :type="getNumberTagType(num)"
                  >
                    {{ num }}
                  </el-tag>
                </div>
                <div class="number-stats">
                  <span>总和：{{ totalSum }}</span>
                  <span>平均值：{{ average.toFixed(2) }}</span>
                  <span>目标差值：≤{{ Math.abs(totalSum % 2) }}</span>
                </div>
              </div>
            </el-card>

            <!-- 求解配置 -->
            <el-card class="config-card">
              <template #header>
                <span>求解配置</span>
              </template>
              
              <div class="solve-config">
                <div class="config-item">
                  <label>求解模型：</label>
                  <el-radio-group v-model="solveType">
                    <el-radio-button label="classic">经典计算</el-radio-button>
                    <el-radio-button label="sim">量子芯片模拟计算</el-radio-button>
                    <el-radio-button label="cloud">量子云服务计算</el-radio-button>
                  </el-radio-group>
                </div>
              </div>
            </el-card>
          </div>

          <div class="right-panel">
            <!-- 求解控制 -->
            <div class="solve-section">
              <el-button
                type="primary"
                size="large"
                :loading="solving"
                :disabled="numbers.length === 0"
                @click="startSolve"
                class="solve-btn"
              >
                {{ solving ? '求解中...' : '开始求解' }}
              </el-button>
              <el-button @click="cancelSolve" :disabled="!solving">取消任务</el-button>
            </div>

            <!-- 求解状态 -->
            <div class="solve-status">
              <div class="status-indicator" :class="statusClass">
                <div class="status-icon"></div>
                <span>{{ statusText }}</span>
              </div>
              <div class="solve-time">求解时间：{{ `solveTime` }}</div>
            </div>

            <!-- 结果展示 -->
            <el-card class="result-card" v-if="result">
              <template #header>
                <div class="result-header">
                  <span>求解结果</span>
                  <el-button size="small" @click="exportResult">导出</el-button>
                </div>
              </template>
              
              <div class="result-content">
                <div class="partition-result">
                  <div class="subset">
                    <h4>子集A（和：{{ result.sumA }}）</h4>
                    <div class="subset-numbers">
                      <el-tag v-for="num in result.subsetA" :key="num" type="success">
                        {{ num }}
                      </el-tag>
                    </div>
                  </div>
                  
                  <div class="subset">
                    <h4>子集B（和：{{ result.sumB }}）</h4>
                    <div class="subset-numbers">
                      <el-tag v-for="num in result.subsetB" :key="num" type="warning">
                        {{ num }}
                      </el-tag>
                    </div>
                  </div>
                </div>
                
                <div class="result-stats">
                  <div class="stat-item">
                    <span class="label">差值：</span>
                    <span class="value" :class="{ optimal: result.difference === Math.abs(totalSum % 2) }">
                      {{ result.difference }}
                      <el-tag v-if="result.difference === Math.abs(totalSum % 2)" type="success" size="small">最优</el-tag>
                    </span>
                  </div>
                  <div class="stat-item">
                    <span class="label">平衡度：</span>
                    <span class="value">{{ result.balance }}%</span>
                  </div>
                </div>
              </div>
            </el-card>

            <!-- 算法日志 -->
            <el-card class="log-card">
              <template #header>
                <span>求解日志</span>
              </template>
              <div class="log-entries">
                <div v-for="(log, index) in logs" :key="index" class="log-entry">
                  {{ log }}
                </div>
              </div>
            </el-card>
          </div>
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
import { submitTask, getTaskStatus, cancelTask } from '../api/index.js'
import { ElMessage } from 'element-plus'

// 响应式数据
const numberInput = ref('')
const numbers = ref([])
const solveType = ref('classic')
const solving = ref(false)
const statusClass = ref('status-idle')
const statusText = ref('等待求解')
const solveTime = ref('--')
const result = ref(null)
const logs = ref(['系统已就绪'])
const currentTaskId = ref(null)

// 任务历史
const taskHistory = ref([])

// 计算属性
const totalSum = computed(() => numbers.value.reduce((sum, num) => sum + num, 0))
const average = computed(() => numbers.value.length > 0 ? totalSum.value / numbers.value.length : 0)

// 方法
const parseNumbers = () => {
  try {
    const parsed = numberInput.value
      .split(/[,\s]+/)
      .map(s => s.trim())
      .filter(s => s)
      .map(s => parseInt(s))
      .filter(n => !isNaN(n) && n > 0)

    if (parsed.length === 0) {
      ElMessage.warning('请输入有效的正整数')
      return
    }

    numbers.value = [...new Set(parsed)] // 去重
    // 清除之前的结果
    result.value = null
    addLog(`解析得到${numbers.value.length}个数字`)
    ElMessage.success(`成功解析${numbers.value.length}个数字`)
  } catch (error) {
    ElMessage.error('数字解析失败')
    addLog('数字解析失败')
  }
}

const generateRandomNumbers = () => {
  const count = Math.floor(Math.random() * 8) + 6 // 6-13个数字
  const newNumbers = []
  
  for (let i = 0; i < count; i++) {
    newNumbers.push(Math.floor(Math.random() * 50) + 1) // 1-50的随机数
  }
  
  numbers.value = newNumbers
  numberInput.value = newNumbers.join(', ')
  // 清除之前的结果
  result.value = null
  addLog(`随机生成${count}个数字`)
  ElMessage.success(`随机生成${count}个数字`)
}

const clearNumbers = () => {
  numbers.value = []
  numberInput.value = ''
  result.value = null
  addLog('已清空数字列表')
}

const removeNumber = (index) => {
  numbers.value.splice(index, 1)
  numberInput.value = numbers.value.join(', ')
  addLog(`移除数字：${numbers.value[index]}`)
}

const getNumberTagType = (num) => {
  if (num <= 10) return ''
  if (num <= 30) return 'success'
  if (num <= 50) return 'warning'
  return 'danger'
}

const startSolve = async () => {
  if (numbers.value.length === 0) {
    ElMessage.warning('请先输入数字')
    return
  }

  solving.value = true
  statusClass.value = 'status-running'
  statusText.value = '求解中'
  result.value = null
  
  const startTime = Date.now()
  addLog(`开始求解数字分割问题（${solveType.value}模式）`)
  
  try {
    // 准备任务数据
    const taskData = {
      taskName: `NumberPartition_${Date.now()}`,
      problemType: 'number_partition',
      modelType: solveType.value, // classic | sim | cloud
      matrixSize: numbers.value.length,
      adjacencyMatrix: numbers.value
    }
    
    // 提交任务到后端
    const submitResponse = await submitTask(taskData)
    
    if (submitResponse.success) {
      currentTaskId.value = submitResponse.taskId
      addLog(`任务已提交，ID: ${submitResponse.taskId}`)
      
      // 添加到任务历史
      addTaskToHistory({
        taskId: submitResponse.taskId,
        taskName: taskData.taskName,
        modelType: taskData.modelType,
        timestamp: new Date().toISOString(),
        matrixSize: taskData.matrixSize,
        status: 'queued',
        bestValue: '--',
        solveTime: '--'
      })
      
      // 开始轮询任务状态
      await pollTaskStatus(submitResponse.taskId, startTime)
    } else {
      throw new Error(submitResponse.message || '任务提交失败')
    }
    
  } catch (error) {
    statusClass.value = 'status-fail'
    statusText.value = '求解失败'
    addLog('求解失败：' + error.message)
    ElMessage.error('求解失败')
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
          const solutionVector = bestResult.solution // 向量：1或-1
          const resultValue = bestResult.value // 差值
          
          // 将解向量转换为两个子集
          // 1表示子集A，-1表示子集B
          const subsetA = []
          const subsetB = []
          
          if (Array.isArray(solutionVector)) {
            solutionVector.forEach((value, index) => {
              if (index < numbers.value.length) {
                if (value === 1 || value > 0) {
                  subsetA.push(numbers.value[index])
                } else {
                  subsetB.push(numbers.value[index])
                }
              }
            })
          }
          
          const sumA = subsetA.reduce((a, b) => a + b, 0)
          const sumB = subsetB.reduce((a, b) => a + b, 0)
          const difference = Math.abs(sumA - sumB)
          const balance = sumA + sumB > 0 
            ? ((Math.min(sumA, sumB) / Math.max(sumA, sumB)) * 100).toFixed(1)
            : '0.0'
          
          result.value = {
            subsetA,
            subsetB,
            sumA,
            sumB,
            difference,
            balance
          }
          
          console.log("解析的结果:", result.value)
          
          // 更新任务历史
          updateTaskInHistory(taskId, {
            status: 'completed',
            bestValue: difference,
            solveTime: `${duration}s`
          })
          
          addLog(`求解完成，找到最优解，差值：${difference}`)
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
  addLog('求解已取消')
}

const addLog = (message) => {
  const timestamp = new Date().toLocaleTimeString('zh-CN')
  logs.value.unshift(`${timestamp} - ${message}`)
  if (logs.value.length > 20) {
    logs.value = logs.value.slice(0, 20)
  }
}

const exportResult = () => {
  if (!result.value) return
  
  const data = {
    numbers: numbers.value,
    solveType: solveType.value,
    result: result.value,
    timestamp: new Date().toISOString()
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `number-partition-result-${Date.now()}.json`
  link.click()
  URL.revokeObjectURL(url)
}

// 任务历史相关方法
const loadTaskHistory = () => {
  try {
    const stored = localStorage.getItem('numberTaskHistory')
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
    localStorage.setItem('numberTaskHistory', JSON.stringify(taskHistory.value))
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
</script>

<style scoped>
.number-page {
  padding: 20px;
}

.main-card {
  background: #FFFFFF;
  border-radius: 20px;
  border: 1px solid #E6EAF5;
  box-shadow: 0 10px 20px rgba(9, 30, 66, 0.04);
}

.page-header {
  margin-bottom: 24px;
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

.page-header h2 {
  margin: 0;
  color: #292929;
  font-weight: 600;
}

.description {
  color: #8C8FA3;
  margin: 0;
  font-size: 14px;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 24px;
}

.number-input-area {
  margin-bottom: 20px;
}

.input-buttons {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.number-list h4 {
  color: #292929;
  margin-bottom: 12px;
}

.number-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.number-stats {
  display: flex;
  gap: 16px;
  font-size: 14px;
  color: #666;
}

.solve-config {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.config-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.config-item label {
  min-width: 80px;
  color: #666;
  font-size: 14px;
}

.config-item :deep(.el-radio-group) {
  display: flex;
  gap: 12px;
}

.config-item :deep(.el-radio-button__inner) {
  border: 1px solid #DCDFE6;
}

.config-item :deep(.el-radio-button:not(.is-active) .el-radio-button__inner) {
  background: #FFFFFF;
  border-color: #DCDFE6;
}

.solve-section {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.solve-section .solve-btn {
  width: 160px;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
}

.solve-section :deep(.el-button) {
  height: 48px;
}

.solve-status {
  margin-bottom: 20px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 8px;
}

.status-idle {
  background: #F6F7FA;
}

.status-running {
  background: #FFF7E6;
}

.status-success {
  background: #F0F9F4;
}

.status-fail {
  background: #FEF2F2;
}

.status-icon {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.status-idle .status-icon {
  background: #8C8FA3;
}

.status-running .status-icon {
  background: #F88818;
  animation: pulse 1.5s infinite;
}

.status-success .status-icon {
  background: #40C878;
}

.status-fail .status-icon {
  background: #E57550;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.solve-time {
  color: #8C8FA3;
  font-size: 14px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.partition-result {
  margin-bottom: 20px;
}

.subset {
  margin-bottom: 16px;
}

.subset h4 {
  color: #292929;
  margin-bottom: 8px;
  font-size: 16px;
}

.subset-numbers {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.result-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: #F6F7FA;
  border-radius: 8px;
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

.stat-item .value.optimal {
  color: #40C878;
}

.log-entries {
  max-height: 200px;
  overflow-y: auto;
}

.log-entry {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
  padding: 4px 0;
  border-bottom: 1px solid #F0F0F0;
}

.log-entry:last-child {
  border-bottom: none;
}

.input-card, .config-card, .result-card, .log-card {
  margin-bottom: 20px;
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