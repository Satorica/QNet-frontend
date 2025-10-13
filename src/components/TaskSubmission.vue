<template>
  <div class="task-submission">
    <!-- 服务器状态显示 -->
    <ServerStatus @status-updated="onServerStatusUpdated" />
    
    <!-- 任务提交表单 -->
    <div class="submission-form">
      <h3>任务提交</h3>
      
      <el-form :model="taskForm" :rules="rules" ref="taskFormRef" label-width="120px">
        <el-form-item label="问题类型" prop="problemType">
          <el-select v-model="taskForm.problemType" placeholder="选择问题类型">
            <el-option label="最大割问题" value="maxcut" />
            <el-option label="数字分割" value="number_partition" />
            <el-option label="图着色" value="graph_coloring" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="计算模式" prop="modelType">
          <el-select v-model="taskForm.modelType" placeholder="选择计算模式">
            <el-option label="经典算法" value="classic" />
            <el-option label="模拟退火" value="sim" />
            <el-option label="云计算" value="cloud" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="矩阵大小" prop="matrixSize">
          <el-input-number v-model="taskForm.matrixSize" :min="3" :max="20" />
        </el-form-item>
        
        <el-form-item label="邻接矩阵" prop="adjacencyMatrix">
          <div class="matrix-input">
            <el-button @click="generateRandomMatrix" size="small" type="primary">生成随机矩阵</el-button>
            <el-button @click="clearMatrix" size="small">清空矩阵</el-button>
          </div>
          <div class="matrix-grid" :style="gridStyle">
            <el-input 
              v-for="(value, index) in flatMatrix" 
              :key="index"
              v-model.number="flatMatrix[index]"
              size="small"
              type="number"
              :disabled="isDiagonal(index)"
              class="matrix-cell"
            />
          </div>
        </el-form-item>
        
        <el-form-item>
          <el-button 
            type="primary" 
            @click="submitTask" 
            :loading="submitting"
            :disabled="!canSubmit"
            size="large"
          >
            <span v-if="submitting">提交中...</span>
            <span v-else>提交任务</span>
          </el-button>
          
          <el-button 
            v-if="currentTask && currentTask.usePolling" 
            @click="cancelTask"
            :loading="cancelling"
            size="large"
          >
            取消任务
          </el-button>
        </el-form-item>
      </el-form>
    </div>
    
    <!-- 任务状态显示 -->
    <div v-if="currentTask" class="task-status">
      <h3>任务状态</h3>
      <div class="status-info">
        <el-tag :type="getStatusType(currentTask.state)">
          {{ getStatusText(currentTask.state) }}
        </el-tag>
        <span class="server-type">
          使用 {{ currentTask.serverType === 'cloud' ? '云服务器' : '本地服务器' }}
        </span>
        <span class="task-id">任务ID: {{ currentTask.taskId }}</span>
      </div>
      
      <div v-if="currentTask.message" class="task-message">
        {{ currentTask.message }}
      </div>
      
      <div v-if="currentTask.usePolling && currentTask.state === 'processing'" class="polling-info">
        <el-progress :percentage="getProgress()" :status="getProgressStatus()" />
        <p>正在轮询任务状态... ({{ pollingCount }} 次)</p>
      </div>
    </div>
    
    <!-- 结果显示 -->
    <div v-if="taskResults" class="results">
      <h3>计算结果</h3>
      <div class="candidates">
        <div 
          v-for="(candidate, index) in taskResults.candidates" 
          :key="index"
          class="candidate-item"
        >
          <div class="candidate-header">
            <span class="rank">候选解 {{ index + 1 }}</span>
            <span class="value">值: {{ candidate.value }}</span>
          </div>
          <div class="solution">
            解向量: [{{ candidate.solution?.join(', ') }}]
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { submitTask, getTaskStatus, cancelTask } from '@/api'
import ServerStatus from './ServerStatus.vue'

export default {
  name: 'TaskSubmission',
  components: {
    ServerStatus
  },
  
  data() {
    return {
      taskForm: {
        problemType: 'maxcut',
        modelType: 'classic',
        matrixSize: 6,
        adjacencyMatrix: []
      },
      
      rules: {
        problemType: [{ required: true, message: '请选择问题类型', trigger: 'change' }],
        modelType: [{ required: true, message: '请选择计算模式', trigger: 'change' }],
        matrixSize: [{ required: true, message: '请输入矩阵大小', trigger: 'blur' }]
      },
      
      flatMatrix: [],
      submitting: false,
      cancelling: false,
      currentTask: null,
      taskResults: null,
      pollingTimer: null,
      pollingCount: 0,
      serverStatus: { cloud: false, local: false }
    }
  },
  
  computed: {
    gridStyle() {
      const size = this.taskForm.matrixSize
      return {
        gridTemplateColumns: `repeat(${size}, 1fr)`,
        gridTemplateRows: `repeat(${size}, 1fr)`
      }
    },
    
    canSubmit() {
      return (this.serverStatus.cloud || this.serverStatus.local) && 
             !this.submitting && 
             this.taskForm.matrixSize >= 3
    }
  },
  
  watch: {
    'taskForm.matrixSize'(newSize) {
      this.initializeMatrix(newSize)
    }
  },
  
  mounted() {
    this.initializeMatrix(this.taskForm.matrixSize)
  },
  
  beforeUnmount() {
    this.clearPolling()
  },
  
  methods: {
    onServerStatusUpdated(status) {
      this.serverStatus = status
    },
    
    initializeMatrix(size) {
      this.flatMatrix = new Array(size * size).fill(0)
      this.updateMatrixFromFlat()
    },
    
    updateMatrixFromFlat() {
      const size = this.taskForm.matrixSize
      const matrix = []
      for (let i = 0; i < size; i++) {
        const row = []
        for (let j = 0; j < size; j++) {
          row.push(this.flatMatrix[i * size + j])
        }
        matrix.push(row)
      }
      this.taskForm.adjacencyMatrix = matrix
    },
    
    isDiagonal(index) {
      const size = this.taskForm.matrixSize
      const row = Math.floor(index / size)
      const col = index % size
      return row === col
    },
    
    generateRandomMatrix() {
      const size = this.taskForm.matrixSize
      for (let i = 0; i < size * size; i++) {
        if (!this.isDiagonal(i)) {
          this.flatMatrix[i] = Math.random() > 0.7 ? Math.floor(Math.random() * 10) + 1 : 0
        }
      }
      
      // 确保矩阵对称
      for (let i = 0; i < size; i++) {
        for (let j = i + 1; j < size; j++) {
          const value = this.flatMatrix[i * size + j]
          this.flatMatrix[j * size + i] = value
        }
      }
      
      this.updateMatrixFromFlat()
    },
    
    clearMatrix() {
      this.flatMatrix.fill(0)
      this.updateMatrixFromFlat()
    },
    
    async submitTask() {
      try {
        await this.$refs.taskFormRef.validate()
        
        this.submitting = true
        this.updateMatrixFromFlat()
        
        const taskData = {
          ...this.taskForm,
          taskName: `${this.taskForm.problemType}_${this.taskForm.modelType}_${Date.now()}`
        }
        
        console.log('提交任务数据:', taskData)
        
        const result = await submitTask(taskData)
        
        this.currentTask = result
        this.taskResults = null
        
        if (result.usePolling) {
          // 云服务器模式，开始轮询
          this.startPolling(result.taskId)
        } else {
          // 本地服务器模式，直接显示结果
          // 注意：本地服务器可能直接返回 results，确保有 candidates 结构
          this.taskResults = result.results || { candidates: [] }
          this.currentTask.state = 'completed'
        }
        
        this.$message.success('任务提交成功')
        
      } catch (error) {
        console.error('任务提交失败:', error)
        this.$message.error(`任务提交失败: ${error.message}`)
      } finally {
        this.submitting = false
      }
    },
    
    startPolling(taskId) {
      this.pollingCount = 0
      this.pollingTimer = setInterval(async () => {
        try {
          this.pollingCount++
          const status = await getTaskStatus(taskId)
          
          this.currentTask = { ...this.currentTask, ...status }
          
          if (status.state === 'completed') {
            // 修复：后端返回的是 results.candidates 结构
            this.taskResults = status.results || { candidates: [] }
            this.clearPolling()
            this.$message.success('任务完成')
          } else if (status.state === 'failed' || status.state === 'cancelled') {
            this.clearPolling()
            this.$message.error(`任务${status.state === 'failed' ? '失败' : '已取消'}: ${status.message}`)
          }
          
          // 防止无限轮询
          if (this.pollingCount > 60) { // 5分钟后停止轮询
            this.clearPolling()
            this.$message.warning('任务轮询超时，请手动检查任务状态')
          }
          
        } catch (error) {
          console.error('轮询任务状态失败:', error)
        }
      }, 5000) // 每5秒轮询一次
    },
    
    clearPolling() {
      if (this.pollingTimer) {
        clearInterval(this.pollingTimer)
        this.pollingTimer = null
      }
    },
    
    async cancelTask() {
      if (!this.currentTask?.taskId) return
      
      try {
        this.cancelling = true
        await cancelTask(this.currentTask.taskId)
        this.clearPolling()
        this.currentTask.state = 'cancelled'
        this.$message.success('任务已取消')
      } catch (error) {
        this.$message.error(`取消任务失败: ${error.message}`)
      } finally {
        this.cancelling = false
      }
    },
    
    getStatusType(state) {
      const typeMap = {
        'queued': 'info',
        'processing': 'warning', 
        'completed': 'success',
        'failed': 'danger',
        'cancelled': 'info'
      }
      return typeMap[state] || 'info'
    },
    
    getStatusText(state) {
      const textMap = {
        'queued': '排队中',
        'processing': '处理中',
        'completed': '已完成',
        'failed': '失败',
        'cancelled': '已取消'
      }
      return textMap[state] || state
    },
    
    getProgress() {
      if (!this.currentTask?.usePolling) return 0
      
      const stateProgress = {
        'queued': 20,
        'processing': 60,
        'completed': 100,
        'failed': 100,
        'cancelled': 100
      }
      
      return stateProgress[this.currentTask.state] || 0
    },
    
    getProgressStatus() {
      if (this.currentTask?.state === 'failed') return 'exception'
      if (this.currentTask?.state === 'completed') return 'success'
      return undefined
    }
  }
}
</script>

<style scoped>
.task-submission {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.submission-form {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.submission-form h3 {
  margin: 0 0 20px 0;
  color: #2c3e50;
}

.matrix-input {
  margin-bottom: 10px;
}

.matrix-grid {
  display: grid;
  gap: 4px;
  max-width: 400px;
  margin-top: 10px;
}

.matrix-cell {
  width: 100%;
}

.task-status {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.task-status h3 {
  margin: 0 0 16px 0;
  color: #2c3e50;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.server-type {
  color: #7f8c8d;
  font-size: 14px;
}

.task-id {
  color: #95a5a6;
  font-size: 12px;
  font-family: 'Courier New', monospace;
}

.task-message {
  background: #f8f9fa;
  padding: 8px 12px;
  border-radius: 4px;
  color: #6c757d;
  font-size: 14px;
  margin-bottom: 12px;
}

.polling-info {
  margin-top: 16px;
}

.polling-info p {
  margin: 8px 0 0 0;
  color: #7f8c8d;
  font-size: 14px;
}

.results {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.results h3 {
  margin: 0 0 20px 0;
  color: #2c3e50;
}

.candidates {
  display: grid;
  gap: 12px;
}

.candidate-item {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 12px;
  background: #f8f9fa;
}

.candidate-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.rank {
  font-weight: bold;
  color: #3498db;
}

.value {
  color: #e74c3c;
  font-weight: bold;
}

.solution {
  font-family: 'Courier New', monospace;
  font-size: 14px;
  color: #2c3e50;
  background: #fff;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #dee2e6;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .task-submission {
    padding: 10px;
  }
  
  .status-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style> 