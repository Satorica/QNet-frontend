<template>
  <div class="tasks-page">
    <el-card class="task-card">
      <template #header>
        <div class="task-header">
          <h3>{{ $t('tasks.title') }}</h3>
          <div class="task-controls">
            <el-select v-model="pageSize" @change="handlePageSizeChange" style="width: 120px">
              <el-option :label="`${$t('tasks.pageSize')} 5`" :value="5" />
              <el-option :label="`${$t('tasks.pageSize')} 10`" :value="10" />
              <el-option :label="`${$t('tasks.pageSize')} 20`" :value="20" />
            </el-select>
            <el-input
              v-model="searchText"
              :placeholder="$t('tasks.search')"
              style="width: 200px"
              @input="handleSearch"
            />
            <el-button @click="refreshTasks">{{ $t('tasks.refresh') }}</el-button>
          </div>
        </div>
      </template>

      <!-- 任务表格 -->
      <el-table
        :data="paginatedTasks"
        style="width: 100%"
        stripe
        v-loading="loading"
        @row-click="handleRowClick"
      >
        <el-table-column prop="taskName" :label="$t('tasks.table.taskName')" width="180">
          <template #default="{ row }">
            <el-link type="primary" @click="viewTask(row)">{{ row.taskName }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="problemType" :label="$t('tasks.table.problemType')" width="120">
          <template #default="{ row }">
            {{ getProblemTypeText(row.problemType) }}
          </template>
        </el-table-column>
        <el-table-column prop="modelType" :label="$t('tasks.table.model')" width="150">
          <template #default="{ row }">
            {{ getModelTypeText(row.modelType) }}
          </template>
        </el-table-column>
        <el-table-column prop="timestamp" :label="$t('tasks.table.submitTime')" width="180">
          <template #default="{ row }">
            {{ formatDate(row.timestamp) }}
          </template>
        </el-table-column>
        <el-table-column prop="matrixSize" :label="$t('tasks.table.scale')" width="80" />
        <el-table-column prop="status" :label="$t('tasks.table.status')" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="$t('tasks.table.actions')" width="200">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button type="primary" size="small" @click.stop="viewTask(row)">{{ $t('tasks.table.view') }}</el-button>
              <el-button size="small" type="danger" @click.stop="deleteTask(row)">{{ $t('tasks.table.delete') }}</el-button>
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
      :title="$t('tasks.detail.title')"
      width="800px"
      :close-on-click-modal="false"
    >
      <div v-if="selectedTask" class="task-detail">
        <!-- 基本信息 -->
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
              <span class="detail-value">{{ getProblemTypeText(selectedTask.problemType) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">求解模型：</span>
              <span class="detail-value">{{ getModelTypeText(selectedTask.modelType) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">问题规模：</span>
              <span class="detail-value">{{ selectedTask.matrixSize }} {{ getProblemTypeSizeUnit(selectedTask.problemType) }}</span>
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

        <!-- 结果信息 -->
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
            <div class="detail-row" v-if="selectedTask.problemType === 'coloring'">
              <span class="detail-label">使用颜色数：</span>
              <span class="detail-value highlight">{{ selectedTask.usedColors || '--' }}</span>
            </div>
            <div class="detail-row" v-else>
              <span class="detail-label">最优值：</span>
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
                <span class="candidate-value">目标值：{{ candidate.value }}</span>
              </div>
              <div class="candidate-solution">
                <span class="solution-label">解向量：</span>
                <span class="solution-value">{{ formatSolution(candidate.solution) }}</span>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 失败/取消信息 -->
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
        <el-button @click="taskDetailVisible = false">关闭</el-button>
        <el-button type="primary" @click="exportTaskDetail" v-if="selectedTask && selectedTask.status === 'completed'">导出结果</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { getTaskHistory, deleteTask as deleteTaskAPI, getTaskStatus } from '../api/index.js'

const router = useRouter()
const { t } = useI18n()

// 响应式数据
const tasks = ref([])
const searchText = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const taskDetailVisible = ref(false)
const selectedTask = ref(null)
const taskDetailResults = ref(null)
const loading = ref(false)

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
const loadTasks = async () => {
  try {
    loading.value = true
    const allTasks = []
    
    // 获取所有四种问题类型的任务历史
    const problemTypes = ['maxcut', 'coloring', 'number_partition', 'tsp']
    
    for (const problemType of problemTypes) {
      try {
        const response = await getTaskHistory(problemType, 1, 100) // 获取每种类型最多100个任务
        if (response.success && response.data && response.data.tasks) {
          // 将任务添加到总列表中
          allTasks.push(...response.data.tasks.map(task => ({
            ...task,
            // 统一字段名称
            timestamp: task.timestamp,
            matrixSize: task.matrixSize,
            status: task.status,
            taskName: task.taskName,
            taskId: task.taskId,
            problemType: task.problemType,
            modelType: task.modelType,
            message: task.message,
            // 保留额外信息
            bestValue: task.bestValue,
            usedColors: task.usedColors,
            solveTime: task.solveTime
          })))
        }
      } catch (error) {
        console.error(`加载${problemType}任务失败:`, error)
      }
    }
    
    // 按时间倒序排序
    allTasks.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    
    tasks.value = allTasks
    ElMessage.success(`成功加载 ${allTasks.length} 个任务`)
  } catch (error) {
    console.error('加载任务失败:', error)
    ElMessage.error('加载任务失败')
  } finally {
    loading.value = false
  }
}

const refreshTasks = () => {
  loadTasks()
  ElMessage.success(t('tasks.messages.refreshed'))
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

const viewTask = async (task) => {
  try {
    selectedTask.value = task
    taskDetailVisible.value = true
    
    // 如果任务已完成，获取详细结果
    if (task.status === 'completed') {
      const statusResponse = await getTaskStatus(task.taskId)
      if (statusResponse.results) {
        taskDetailResults.value = statusResponse.results
      }
    } else {
      taskDetailResults.value = null
    }
  } catch (error) {
    console.error('获取任务详情失败:', error)
    ElMessage.error('获取任务详情失败')
  }
}

const deleteTask = async (task) => {
  ElMessageBox.confirm(
    t('tasks.messages.confirmDelete', { name: task.taskName }),
    t('tasks.messages.confirmTitle'),
    {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    }
  ).then(async () => {
    try {
      const response = await deleteTaskAPI(task.taskId)
      if (response.success) {
        // 从列表中移除该任务
        const index = tasks.value.findIndex(t => t.taskId === task.taskId)
        if (index > -1) {
          tasks.value.splice(index, 1)
        }
        ElMessage.success(t('tasks.messages.deleted'))
      } else {
        ElMessage.error('删除任务失败: ' + response.message)
      }
    } catch (error) {
      console.error('删除任务失败:', error)
      ElMessage.error('删除任务失败')
    }
  }).catch(() => {
    // 用户取消
  })
}

// 辅助函数
const getProblemTypeText = (type) => {
  // 处理 number_partition 的别名
  if (type === 'number_partition') {
    return t('tasks.problemTypes.number', '数字分割')
  }
  return t(`tasks.problemTypes.${type}`, type)
}

const getModelTypeText = (type) => {
  return t(`tasks.modelTypes.${type}`, type)
}

const getStatusText = (status) => {
  return t(`tasks.status.${status}`, t('tasks.status.unknown'))
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

const getProblemTypeSizeUnit = (type) => {
  const units = {
    'maxcut': '个节点',
    'coloring': '个节点',
    'number_partition': '个数字',
    'tsp': '个城市'
  }
  return units[type] || '个节点'
}

const formatSolution = (solution) => {
  if (Array.isArray(solution)) {
    // 如果解向量太长，只显示前20个元素
    if (solution.length > 20) {
      return JSON.stringify(solution.slice(0, 20)) + '...'
    }
    return JSON.stringify(solution)
  }
  return JSON.stringify(solution)
}

const exportTaskDetail = () => {
  if (!selectedTask.value) return
  
  const data = {
    taskInfo: {
      taskId: selectedTask.value.taskId,
      taskName: selectedTask.value.taskName,
      problemType: selectedTask.value.problemType,
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

/* 任务详情对话框样式 */
.detail-section {
  margin-bottom: 20px;
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