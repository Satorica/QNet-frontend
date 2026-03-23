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
        <el-table-column prop="taskId" label="操作" width="200">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleViewTaskDetail(row)">查看详情</el-button>
            <el-button type="danger" size="small" @click="handleDeleteTask(row)">删除</el-button>
          </template>
        </el-table-column>
        <el-table-column prop="bestValue" label="最优值" width="100" />
        <el-table-column prop="solveTime" label="求解时间" width="120" />
      </el-table>
    </el-card>

    <!-- 任务详情弹窗 -->
    <el-dialog
      v-model="detailDialogVisible"
      title="任务详细信息"
      width="800px"
      :close-on-click-modal="false"
    >
      <div v-if="selectedTask" class="task-detail">
        <!-- 基本信息卡片 -->
        <el-card class="detail-section">
          <template #header>
            <div class="detail-header">
              <span class="detail-title">基本信息</span>
            </div>
          </template>
          <div class="detail-content">
            <div class="detail-row">
              <span class="detail-label">任务名称：</span>
              <span class="detail-value">{{ selectedTask.taskName }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">任务ID：</span>
              <span class="detail-value">{{ selectedTask.taskId }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">问题类型：</span>
              <span class="detail-value">数字分割问题</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">求解模型：</span>
              <span class="detail-value">{{ getModelTypeText(selectedTask.modelType) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">问题规模：</span>
              <span class="detail-value">{{ selectedTask.matrixSize }} 个数字</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">提交时间：</span>
              <span class="detail-value">{{ formatDate(selectedTask.timestamp) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">任务状态：</span>
              <el-tag :type="getStatusType(selectedTask.status)">
                {{ getStatusText(selectedTask.status) }}
              </el-tag>
            </div>
          </div>
        </el-card>

        <!-- 结果信息卡片 -->
        <el-card class="detail-section" v-if="selectedTask.status === 'completed' && taskDetailResults">
          <template #header>
            <div class="detail-header">
              <span class="detail-title">结果信息</span>
            </div>
          </template>
          <div class="detail-content">
            <div class="detail-row">
              <span class="detail-label">求解时间：</span>
              <span class="detail-value">{{ taskDetailResults.runtime ? taskDetailResults.runtime.toFixed(2) + 's' : selectedTask.solveTime || '--' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">最优差值：</span>
              <span class="detail-value highlight">{{ selectedTask.bestValue || '--' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">候选解数量：</span>
              <span class="detail-value">{{ taskDetailResults.candidates ? taskDetailResults.candidates.length : 0 }}</span>
            </div>
          </div>

          <!-- 候选解列表 -->
          <div class="candidates-list">
            <div class="candidates-header">候选解详情</div>
            <div v-for="(candidate, index) in taskDetailResults.candidates" :key="index" class="candidate-item">
              <div class="candidate-header">
                <span class="candidate-rank">候选解 {{ candidate.rank || (index + 1) }}</span>
                <span class="candidate-value">差值：{{ candidate.value }}</span>
              </div>
              <div class="candidate-solution">
                <span class="solution-label">解向量：</span>
                <span class="solution-value">{{ JSON.stringify(candidate.solution) }}</span>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 失败信息 -->
        <el-card class="detail-section" v-if="selectedTask.status === 'failed' || selectedTask.status === 'cancelled'">
          <template #header>
            <div class="detail-header">
              <span class="detail-title">{{ selectedTask.status === 'failed' ? '失败信息' : '取消信息' }}</span>
            </div>
          </template>
          <div class="detail-content">
            <div class="detail-row">
              <span class="detail-label">消息：</span>
              <span class="detail-value">{{ selectedTask.message || '无详细信息' }}</span>
            </div>
          </div>
        </el-card>
      </div>

      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="exportTaskDetail" v-if="selectedTask && selectedTask.status === 'completed'">导出结果</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { submitTask, getTaskStatus, cancelTask, getTaskHistory, deleteTask } from '../api/index.js'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCustomTaskName } from '../composables/customTaskName.js'

const { customTaskName, clearCustomTaskName } = useCustomTaskName()

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

// 任务详情对话框
const detailDialogVisible = ref(false)
const selectedTask = ref(null)
const taskDetailResults = ref(null)

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
      taskName: customTaskName.value || `NumberPartition_${Date.now()}`,
      problemType: 'number_partition',
      modelType: solveType.value, // classic | sim | cloud
      matrixSize: numbers.value.length,
      adjacencyMatrix: numbers.value
    }
    
    // 提交任务到后端
    const submitResponse = await submitTask(taskData)
    
    if (submitResponse.success) {
      clearCustomTaskName()
      currentTaskId.value = submitResponse.taskId
      addLog(`任务已提交，ID: ${submitResponse.taskId}`)
      
      // 任务已提交到后端，会自动保存到数据库，不需要手动添加到历史
      
      // 开始轮询任务状态
      await pollTaskStatus(submitResponse.taskId, startTime)
    } else {
      throw new Error(submitResponse.message || '任务提交失败')
    }
    
  } catch (error) {
    clearCustomTaskName()
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
          
          // 任务状态已更新到数据库，刷新任务历史
          loadTaskHistory()
          
          addLog(`求解完成，找到最优解，差值：${difference}`)
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
const loadTaskHistory = async () => {
  try {
    const response = await getTaskHistory({
      problemType: 'number_partition',
      page: 1,
      pageSize: 50
    })
    if (response.success && response.data) {
      // 转换后端数据格式为前端格式
      taskHistory.value = response.data.tasks.map(task => ({
        taskId: task.taskId,
        taskName: task.taskName,
        modelType: task.modelType,
        timestamp: task.timestamp,
        matrixSize: task.matrixSize,
        status: task.status,
        bestValue: task.bestValue || '--',
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

// 删除任务
const handleDeleteTask = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除该任务吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })

    const response = await deleteTask(row.taskId)
    if (response.success) {
      addLog(`任务已删除: ${row.taskId}`)
      loadTaskHistory()
    } else {
      addLog(`删除任务失败: ${response.message}`)
    }
  } catch (error) {
    // 用户取消删除或删除失败
    if (error !== 'cancel') {
      console.error('删除任务失败:', error)
      addLog(`删除任务失败: ${error.message || '未知错误'}`)
    }
  }
}

// 查看任务详情
const handleViewTaskDetail = async (row) => {
  try {
    selectedTask.value = row
    detailDialogVisible.value = true
    
    // 如果任务已完成，获取详细结果
    if (row.status === 'completed') {
      const statusResponse = await getTaskStatus(row.taskId)
      if (statusResponse.results) {
        taskDetailResults.value = statusResponse.results
      }
    } else {
      taskDetailResults.value = null
    }
  } catch (error) {
    console.error('获取任务详情失败:', error)
    addLog('获取任务详情失败: ' + error.message)
  }
}

// 导出任务详情
const exportTaskDetail = () => {
  if (!selectedTask.value) return
  
  const data = {
    taskInfo: {
      taskId: selectedTask.value.taskId,
      taskName: selectedTask.value.taskName,
      problemType: 'number_partition',
      modelType: selectedTask.value.modelType,
      matrixSize: selectedTask.value.matrixSize,
      timestamp: selectedTask.value.timestamp,
      status: selectedTask.value.status
    },
    results: taskDetailResults.value
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `task-${selectedTask.value.taskId}-detail.json`
  link.click()
  URL.revokeObjectURL(url)
}

// 初始化
// 异步加载任务历史
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

/* 任务详情对话框样式 */
.task-detail {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-section {
  border: 1px solid #E6EAF5;
  border-radius: 12px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-title {
  font-weight: 600;
  color: #292929;
  font-size: 16px;
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-row {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #F0F0F0;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  min-width: 120px;
  color: #666;
  font-size: 14px;
}

.detail-value {
  flex: 1;
  color: #292929;
  font-size: 14px;
  word-break: break-all;
}

.detail-value.highlight {
  color: #4050F8;
  font-weight: 600;
  font-size: 16px;
}

.candidates-list {
  margin-top: 16px;
}

.candidates-header {
  font-weight: 600;
  color: #292929;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid #E6EAF5;
}

.candidate-item {
  padding: 12px;
  margin-bottom: 12px;
  background: #FAFBFC;
  border: 1px solid #E6EAF5;
  border-radius: 8px;
}

.candidate-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.candidate-rank {
  font-weight: 600;
  color: #4050F8;
}

.candidate-value {
  color: #666;
  font-size: 14px;
}

.candidate-solution {
  display: flex;
  gap: 8px;
  font-size: 13px;
}

.solution-label {
  color: #666;
  min-width: 70px;
}

.solution-value {
  flex: 1;
  color: #292929;
  font-family: 'Courier New', monospace;
  word-break: break-all;
}
</style> 