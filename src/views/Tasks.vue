<template>
  <div class="tasks-page">
    <el-card class="task-card">
      <template #header>
        <div class="task-header">
          <h3>任务列表</h3>
          <div class="task-controls">
            <el-select v-model="pageSize" @change="handlePageSizeChange" style="width: 120px">
              <el-option label="每页 5" :value="5" />
              <el-option label="每页 10" :value="10" />
              <el-option label="每页 20" :value="20" />
            </el-select>
            <el-input
              v-model="searchText"
              placeholder="模型/任务搜索"
              style="width: 200px"
              @input="handleSearch"
            />
            <el-button @click="refreshTasks">刷新任务</el-button>
          </div>
        </div>
      </template>

      <!-- 任务表格 -->
      <el-table
        :data="paginatedTasks"
        style="width: 100%"
        stripe
        @row-click="handleRowClick"
      >
        <el-table-column prop="taskName" label="任务名" width="180">
          <template #default="{ row }">
            <el-link type="primary" @click="viewTask(row)">{{ row.taskName }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="problemType" label="问题类型" width="120">
          <template #default="{ row }">
            {{ getProblemTypeText(row.problemType) }}
          </template>
        </el-table-column>
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
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button size="small" @click="viewTask(row)">查看</el-button>
              <el-button size="small" type="danger" @click="deleteTask(row)" v-if="row.status !== 'processing'">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[5, 10, 20, 50]"
          :total="filteredTasks.length"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handlePageSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <!-- 任务详情对话框 -->
    <el-dialog
      v-model="taskDetailVisible"
      title="任务详情"
      width="50%"
    >
      <div v-if="selectedTask" class="task-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="任务名">{{ selectedTask.taskName }}</el-descriptions-item>
          <el-descriptions-item label="问题类型">{{ getProblemTypeText(selectedTask.problemType) }}</el-descriptions-item>
          <el-descriptions-item label="模型类型">{{ getModelTypeText(selectedTask.modelType) }}</el-descriptions-item>
          <el-descriptions-item label="提交时间">{{ formatDate(selectedTask.timestamp) }}</el-descriptions-item>
          <el-descriptions-item label="规模">{{ selectedTask.matrixSize }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(selectedTask.status)">
              {{ getStatusText(selectedTask.status) }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <div v-if="selectedTask.results" class="task-results">
          <h4>求解结果</h4>
          <div v-for="(result, index) in selectedTask.results" :key="index" class="result-item">
            <strong>候选解 {{ index + 1 }}：</strong>
            <div>目标值：{{ result.value }}</div>
            <div>解向量：{{ result.solution }}</div>
          </div>
        </div>

        <div v-if="selectedTask.matrix" class="task-matrix">
          <h4>邻接矩阵</h4>
          <div class="matrix-display">
            <div v-for="(row, i) in selectedTask.matrix" :key="i" class="matrix-row">
              <span v-for="(cell, j) in row" :key="j" class="matrix-cell">{{ cell }}</span>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// 响应式数据
const tasks = ref([])
const searchText = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const taskDetailVisible = ref(false)
const selectedTask = ref(null)

// 计算属性
const filteredTasks = computed(() => {
  if (!searchText.value) return tasks.value
  
  const search = searchText.value.toLowerCase()
  return tasks.value.filter(task => {
    return task.taskName.toLowerCase().includes(search) ||
           getProblemTypeText(task.problemType).toLowerCase().includes(search) ||
           getModelTypeText(task.modelType).toLowerCase().includes(search)
  })
})

const paginatedTasks = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredTasks.value.slice(start, end)
})

// 方法
const loadTasks = () => {
  try {
    const stored = localStorage.getItem('quantumTasks')
    if (stored) {
      tasks.value = JSON.parse(stored)
    } else {
      // 生成一些模拟数据
      tasks.value = generateMockTasks()
      saveTasks()
    }
  } catch (error) {
    console.error('加载任务失败:', error)
    tasks.value = generateMockTasks()
    saveTasks()
  }
}

const saveTasks = () => {
  localStorage.setItem('quantumTasks', JSON.stringify(tasks.value))
}

const generateMockTasks = () => {
  const mockTasks = []
  const problemTypes = ['maxcut', 'number', 'coloring', 'tsp']
  const modelTypes = ['classic', 'sim', 'cloud']
  const statuses = ['completed', 'processing', 'failed', 'timeout']

  for (let i = 0; i < 15; i++) {
    const problemType = problemTypes[Math.floor(Math.random() * problemTypes.length)]
    const modelType = modelTypes[Math.floor(Math.random() * modelTypes.length)]
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    
    mockTasks.push({
      taskId: `task_${Date.now()}_${i}`,
      taskName: `任务${i + 1}`,
      problemType,
      modelType,
      status,
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      matrixSize: Math.floor(Math.random() * 15) + 4,
      matrix: generateRandomMatrix(6),
      results: status === 'completed' ? generateMockResults() : null
    })
  }

  return mockTasks
}

const generateRandomMatrix = (size) => {
  const matrix = Array(size).fill().map(() => Array(size).fill(0))
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      const connected = Math.random() > 0.6 ? 1 : 0
      matrix[i][j] = connected
      matrix[j][i] = connected
    }
  }
  return matrix
}

const generateMockResults = () => {
  return Array(3).fill().map((_, i) => ({
    value: Math.floor(Math.random() * 1000),
    solution: JSON.stringify(Array(6).fill().map(() => Math.random() > 0.5 ? 1 : 0))
  }))
}

const refreshTasks = () => {
  loadTasks()
  ElMessage.success('任务列表已刷新')
}

const handlePageSizeChange = (size) => {
  pageSize.value = size
  currentPage.value = 1
}

const handleCurrentChange = (page) => {
  currentPage.value = page
}

const handleSearch = () => {
  currentPage.value = 1
}

const handleRowClick = (row) => {
  viewTask(row)
}

const viewTask = (task) => {
  selectedTask.value = task
  taskDetailVisible.value = true
}

const deleteTask = (task) => {
  ElMessageBox.confirm(
    `确定要删除任务"${task.taskName}"吗？`,
    '确认删除',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    const index = tasks.value.findIndex(t => t.taskId === task.taskId)
    if (index > -1) {
      tasks.value.splice(index, 1)
      saveTasks()
      ElMessage.success('任务已删除')
    }
  }).catch(() => {
    // 用户取消
  })
}

// 辅助函数
const getProblemTypeText = (type) => {
  const types = {
    maxcut: '图分割',
    number: '数字分割',
    coloring: '图着色',
    tsp: '旅行商'
  }
  return types[type] || type
}

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
    processing: '运行中',
    completed: '已完成',
    failed: '失败',
    timeout: '超时',
    error: '错误'
  }
  return statuses[status] || '未知'
}

const getStatusType = (status) => {
  const types = {
    processing: 'warning',
    completed: 'success',
    failed: 'danger',
    timeout: 'info',
    error: 'danger'
  }
  return types[status] || 'info'
}

const formatDate = (timestamp) => {
  const date = new Date(timestamp)
  return `${date.toLocaleDateString('zh-CN')} ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
}

onMounted(() => {
  loadTasks()
})
</script>

<style scoped>
.tasks-page {
  padding: 20px;
}

.task-card {
  background: #FFFFFF;
  border-radius: 20px;
  border: 1px solid #E6EAF5;
  box-shadow: 0 10px 20px rgba(9, 30, 66, 0.04);
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.task-header h3 {
  margin: 0;
  color: #292929;
  font-weight: 600;
}

.task-controls {
  display: flex;
  gap: 12px;
  align-items: center;
}

.pagination-container {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

.task-detail {
  max-height: 60vh;
  overflow-y: auto;
}

.task-results {
  margin-top: 20px;
}

.task-results h4 {
  color: #292929;
  margin-bottom: 12px;
}

.result-item {
  background: #F6F7FA;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 8px;
}

.task-matrix {
  margin-top: 20px;
}

.task-matrix h4 {
  color: #292929;
  margin-bottom: 12px;
}

.matrix-display {
  display: inline-block;
  border: 1px solid #E6EAF5;
  border-radius: 8px;
  overflow: hidden;
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
  font-size: 12px;
  background: #FAFBFC;
}

.matrix-row:last-child .matrix-cell {
  border-bottom: none;
}

.matrix-cell:last-child {
  border-right: none;
}

.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
}
</style> 