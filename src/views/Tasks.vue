<template>
  <div class="tasks-page">
    <el-card class="task-card">
      <template #header>
        <div class="task-header">
          <h3>{{ $t("tasks.title") }}</h3>
          <div class="task-controls">
            <el-input
              v-model="taskName"
              :placeholder="$t('tasks.taskNamePlaceholder')"
              style="width: 200px"
              clearable
              @keyup.enter="handleSearchConfirm"
            />
            <el-select
              v-model="problemType"
              placeholder="问题类型"
              style="width: 160px"
              clearable
            >
              <el-option
                v-for="option in problemTypeOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <el-select
              v-model="modelType"
              :placeholder="$t('tasks.modelTypePlaceholder')"
              style="width: 180px"
              clearable
            >
              <el-option
                v-for="option in modelTypeOptions"
                :key="option"
                :label="getModelTypeText(option)"
                :value="option"
              />
            </el-select>
            <el-button type="primary" @click="handleSearchConfirm">{{
              $t("common.confirm")
            }}</el-button>
            <el-button @click="handleResetSearch">{{
              $t("tasks.reset")
            }}</el-button>
            <el-button
              type="danger"
              :disabled="total === 0"
              @click="handleDeleteAllTasks"
              >全部删除</el-button
            >
          </div>
        </div>
      </template>

      <!-- 任务表格 -->
      <el-table
        class="tasks-table"
        row-key="taskId"
        :data="tasks"
        style="width: 100%"
        table-layout="fixed"
        stripe
        v-loading="historyLoading"
        size="large"
      >
        <el-table-column
          prop="taskName"
          :label="$t('tasks.table.taskName')"
          min-width="210"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <el-link
              class="task-name-text"
              type="primary"
              :underline="false"
              @click.stop="viewTask(row)"
            >
              {{ row.taskName }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column
          prop="problemType"
          :label="$t('tasks.table.problemType')"
          min-width="120"
        >
          <template #default="{ row }">
            {{ getProblemTypeText(row.problemType) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="modelType"
          :label="$t('tasks.table.model')"
          min-width="140"
        >
          <template #default="{ row }">
            {{ getModelTypeText(row.modelType) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="timestamp"
          :label="$t('tasks.table.submitTime')"
          min-width="170"
        >
          <template #default="{ row }">
            {{ formatDate(row.timestamp) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="matrixSize"
          :label="$t('tasks.table.scale')"
          min-width="90"
        />
        <el-table-column
          prop="status"
          :label="$t('tasks.table.status')"
          min-width="110"
        >
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          :label="$t('tasks.table.actions')"
          width="180"
          align="center"
        >
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button
                type="primary"
                size="small"
                @click.stop="viewTask(row)"
                >{{ $t("tasks.table.view") }}</el-button
              >
              <el-button
                size="small"
                type="danger"
                @click.stop="deleteTask(row)"
                >{{ $t("tasks.table.delete") }}</el-button
              >
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          :current-page="currentPage"
          :page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handlePageSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>

    <el-card class="quota-panel-card">
      <div class="quota-panel">
        <div class="quota-panel-header">
          <div class="quota-panel-title">计算额度</div>
          <el-button type="primary" @click="loadQuotaSummary(true)"
            >刷新额度</el-button
          >
        </div>

        <div class="quota-row">
          <div
            v-for="card in quotaCards"
            :key="card.key"
            class="quota-item quota-card"
            :style="{ '--quota-accent': card.accentColor }"
          >
            <div class="quota-card-label">
              <div class="quota-card-name">{{ card.label }}</div>
              <div class="quota-card-type">额度</div>
              <div v-if="card.pending > 0" class="quota-card-pending">
                进行中 {{ card.pending }}
              </div>
            </div>

            <el-progress
              type="circle"
              :width="96"
              :stroke-width="7"
              :percentage="card.percentage"
              :color="card.colors"
            >
              <div class="quota-progress-text">
                <strong>{{ card.available }}</strong>
                <span>/{{ card.total }}</span>
              </div>
            </el-progress>
          </div>
        </div>
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
              <span class="detail-value">{{
                getProblemTypeText(selectedTask.problemType)
              }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">求解模型：</span>
              <span class="detail-value">{{
                getModelTypeText(selectedTask.modelType)
              }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">问题规模：</span>
              <span class="detail-value"
                >{{ selectedTask.matrixSize }}
                {{ getProblemTypeSizeUnit(selectedTask.problemType) }}</span
              >
            </div>
            <div class="detail-row">
              <span class="detail-label">提交时间：</span>
              <span class="detail-value">{{
                formatDate(selectedTask.timestamp)
              }}</span>
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
        <el-card
          class="detail-section"
          v-if="selectedTask.status === 'completed' && taskDetailResults"
        >
          <template #header>
            <div class="detail-header">
              <span class="detail-title">结果信息</span>
            </div>
          </template>
          <div class="detail-content">
            <div class="detail-row">
              <span class="detail-label">求解时间：</span>
              <span class="detail-value">{{
                taskDetailResults.runtime
                  ? taskDetailResults.runtime.toFixed(2) + "s"
                  : selectedTask.solveTime || "--"
              }}</span>
            </div>
            <div
              class="detail-row"
              v-if="selectedTask.problemType === 'coloring'"
            >
              <span class="detail-label">使用颜色数：</span>
              <span class="detail-value highlight">{{
                selectedTask.usedColors || "--"
              }}</span>
            </div>
            <div class="detail-row" v-else>
              <span class="detail-label">最优值：</span>
              <span class="detail-value highlight">{{
                selectedTask.bestValue || "--"
              }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">候选解数量：</span>
              <span class="detail-value">{{
                taskDetailResults.candidates
                  ? taskDetailResults.candidates.length
                  : 0
              }}</span>
            </div>
          </div>

          <!-- 候选解列表 -->
          <div class="candidates-list">
            <div class="candidates-header">候选解详情</div>
            <div
              v-for="(candidate, index) in taskDetailResults.candidates"
              :key="index"
              class="candidate-item"
            >
              <div class="candidate-header">
                <span class="candidate-rank"
                  >候选解 {{ candidate.rank || index + 1 }}</span
                >
                <span class="candidate-value"
                  >目标值：{{ candidate.value }}</span
                >
              </div>
              <div class="candidate-solution">
                <span class="solution-label">解向量：</span>
                <span class="solution-value">{{
                  formatSolution(candidate.solution)
                }}</span>
              </div>
            </div>
          </div>
        </el-card>

        <!-- 失败/取消信息 -->
        <el-card
          class="detail-section"
          v-if="
            selectedTask.status === 'failed' ||
            selectedTask.status === 'cancelled'
          "
        >
          <template #header>
            <div class="detail-header">
              <span class="detail-title">{{
                selectedTask.status === "failed" ? "失败信息" : "取消信息"
              }}</span>
            </div>
          </template>
          <div class="detail-content">
            <div class="detail-row">
              <span class="detail-label">消息：</span>
              <span class="detail-value">{{
                selectedTask.message || "无详细信息"
              }}</span>
            </div>
          </div>
        </el-card>
      </div>

      <template #footer>
        <el-button @click="taskDetailVisible = false">关闭</el-button>
        <el-button
          type="primary"
          @click="exportTaskDetail"
          v-if="selectedTask && selectedTask.status === 'completed'"
          >导出结果</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  getTaskHistory,
  getTaskQuota,
  deleteTask as deleteTaskAPI,
  deleteAllTasks as deleteAllTasksAPI,
  getTaskStatus,
} from "../api/index.js";

const { t } = useI18n();

// 响应式数据
const tasks = ref([]);
const taskName = ref("");
const modelType = ref("");
const problemType = ref("");
const currentPage = ref(1);
const pageSize = ref(10);
const total = ref(0);
const taskDetailVisible = ref(false);
const selectedTask = ref(null);
const taskDetailResults = ref(null);
const historyLoading = ref(false);
const modelTypeOptions = ["classic", "sim", "cloud"];
const quotaSummary = ref(null);
const problemTypeOptions = [
  { value: "maxcut", label: "图分割问题" },
  { value: "number_partition", label: "数分问题" },
  { value: "coloring", label: "图着色问题" },
  { value: "tsp", label: "旅行商问题" },
];
const quotaColorMap = {
  classic: ["#ff9966", "#60dbe8"],
  sim: ["#5b6ef6", "#60dbe8"],
  cloud: ["#ffb85c", "#60dbe8"],
};

// 方法
const loadTasks = async (params = {}) => {
  const requestParams = {
    page: params.page ?? currentPage.value,
    pageSize: params.pageSize ?? pageSize.value,
    taskName: params.taskName ?? (taskName.value ?? "").trim(),
    modelType: params.modelType ?? (modelType.value ?? "").trim(),
    problemType: params.problemType ?? (problemType.value ?? "").trim(),
  };

  try {
    historyLoading.value = true;
    const response = await getTaskHistory(requestParams);

    if (response.success && response.data) {
      tasks.value = response.data.tasks || [];
      total.value = response.data.total || 0;
      return;
    }

    tasks.value = [];
    total.value = 0;
    ElMessage.error(response.message || "加载任务失败");
  } catch (error) {
    console.error("加载任务失败:", error);
    tasks.value = [];
    total.value = 0;
    ElMessage.error("加载任务失败");
  } finally {
    historyLoading.value = false;
  }
};

const loadQuotaSummary = async (showError = false) => {
  try {
    const response = await getTaskQuota();
    if (response.success && response.data) {
      quotaSummary.value = response.data.quotaSummary || null;
      return;
    }

    quotaSummary.value = null;
    if (showError) {
      ElMessage.error(response.message || "加载额度失败");
    }
  } catch (error) {
    console.error("加载额度失败:", error);
    quotaSummary.value = null;
    if (showError) {
      ElMessage.error(error.message || "加载额度失败");
    }
  }
};

const handlePageSizeChange = (size) => {
  pageSize.value = size;
  currentPage.value = 1;
  loadTasks({
    page: 1,
    pageSize: size,
  });
};

const handleCurrentChange = (page) => {
  currentPage.value = page;
  loadTasks({
    page,
  });
};

const handleSearchConfirm = () => {
  currentPage.value = 1;
  loadTasks({
    page: 1,
    taskName: (taskName.value ?? "").trim(),
    modelType: (modelType.value ?? "").trim(),
    problemType: (problemType.value ?? "").trim(),
  });
};

const handleResetSearch = () => {
  taskName.value = "";
  modelType.value = "";
  problemType.value = "";
  loadTasks({
    page: currentPage.value,
    pageSize: pageSize.value,
    taskName: "",
    modelType: "",
    problemType: "",
  });
};

const viewTask = async (task) => {
  try {
    selectedTask.value = task;
    taskDetailVisible.value = true;

    // 如果任务已完成，获取详细结果
    if (task.status === "completed") {
      const statusResponse = await getTaskStatus(task.taskId);
      taskDetailResults.value = statusResponse.results || null;
    } else {
      taskDetailResults.value = null;
    }
  } catch (error) {
    console.error("获取任务详情失败:", error);
    ElMessage.error("获取任务详情失败");
  }
};

const deleteTask = async (task) => {
  ElMessageBox.confirm(
    t("tasks.messages.confirmDelete", { name: task.taskName }),
    t("tasks.messages.confirmTitle"),
    {
      confirmButtonText: t("common.confirm"),
      cancelButtonText: t("common.cancel"),
      type: "warning",
    }
  )
    .then(async () => {
      try {
        const response = await deleteTaskAPI(task.taskId);
        if (response.success) {
          const targetPage =
            tasks.value.length === 1 && currentPage.value > 1
              ? currentPage.value - 1
              : currentPage.value;

          currentPage.value = targetPage;
          await Promise.all([
            loadTasks({
              page: targetPage,
            }),
            loadQuotaSummary(),
          ]);
          ElMessage.success(t("tasks.messages.deleted"));
        } else {
          ElMessage.error("删除任务失败: " + response.message);
        }
      } catch (error) {
        console.error("删除任务失败:", error);
        ElMessage.error("删除任务失败");
      }
    })
    .catch(() => {
      // 用户取消
    });
};

const handleDeleteAllTasks = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除全部 ${total.value} 个任务吗？此操作不可恢复。`,
      "删除全部任务",
      {
        confirmButtonText: "确定删除",
        cancelButtonText: "取消",
        type: "warning",
      }
    );

    const response = await deleteAllTasksAPI();
    if (response.success) {
      ElMessage.success(`已成功删除 ${response.deletedCount} 个任务`);
      currentPage.value = 1;
      await Promise.all([loadTasks({ page: 1 }), loadQuotaSummary()]);
    } else {
      ElMessage.error(response.message || "删除全部任务失败");
    }
  } catch (error) {
    if (error !== "cancel") {
      ElMessage.error(error.message || "删除全部任务失败");
    }
  }
};

// 辅助函数
const getProblemTypeText = (type) => {
  // 处理 number_partition 的别名
  if (type === "number_partition") {
    return t("tasks.problemTypes.number", "数字分割");
  }
  return t(`tasks.problemTypes.${type}`, type);
};

const getModelTypeText = (type) => {
  return t(`tasks.modelTypes.${type}`, type);
};

const quotaCards = computed(() =>
  modelTypeOptions.map((type) => {
    const quotaData = quotaSummary.value?.models?.[type] || {};
    const total = quotaData.default || quotaSummary.value?.defaultQuota || 50;
    const available = quotaData.available ?? 0;
    const pending = quotaData.pending ?? 0;

    return {
      key: type,
      label: quotaData.label || getModelTypeText(type),
      total,
      available,
      pending,
      percentage: total > 0 ? Math.round((available / total) * 100) : 0,
      colors: quotaColorMap[type] || ["#5b6ef6", "#60dbe8"],
      accentColor: (quotaColorMap[type] || ["#5b6ef6"])[0],
    };
  })
);

const getStatusText = (status) => {
  return t(`tasks.status.${status}`, t("tasks.status.unknown"));
};

const getStatusType = (status) => {
  const types = {
    processing: "warning",
    completed: "success",
    failed: "danger",
    timeout: "info",
    error: "danger",
  };
  return types[status] || "info";
};

const formatDate = (timestamp) => {
  const date = new Date(timestamp);
  return `${date.toLocaleDateString("zh-CN")} ${date.toLocaleTimeString(
    "zh-CN",
    { hour: "2-digit", minute: "2-digit" }
  )}`;
};

const getProblemTypeSizeUnit = (type) => {
  const units = {
    maxcut: "个节点",
    coloring: "个节点",
    number_partition: "个数字",
    tsp: "个城市",
  };
  return units[type] || "个节点";
};

const formatSolution = (solution) => {
  if (Array.isArray(solution)) {
    // 如果解向量太长，只显示前20个元素
    if (solution.length > 20) {
      return JSON.stringify(solution.slice(0, 20)) + "...";
    }
    return JSON.stringify(solution);
  }
  return JSON.stringify(solution);
};

const exportTaskDetail = () => {
  if (!selectedTask.value) return;

  const data = {
    taskInfo: {
      taskId: selectedTask.value.taskId,
      taskName: selectedTask.value.taskName,
      problemType: selectedTask.value.problemType,
      modelType: selectedTask.value.modelType,
      matrixSize: selectedTask.value.matrixSize,
      timestamp: selectedTask.value.timestamp,
      status: selectedTask.value.status,
    },
    results: taskDetailResults.value,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `task-${selectedTask.value.taskId}-detail.json`;
  link.click();
  URL.revokeObjectURL(url);
};

onMounted(() => {
  loadTasks();
  loadQuotaSummary();
});
</script>

<style scoped>
.task-card {
  background: #ffffff;
  border-radius: 20px;
  border: 1px solid #e6eaf5;
  box-shadow: 0 10px 20px rgba(9, 30, 66, 0.04);
}

.quota-panel-card {
  margin-top: 20px;
  background: #ffffff;
  border-radius: 20px;
  border: 1px solid #e6eaf5;
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
  flex-wrap: wrap;
}

.tasks-table {
  width: 100%;
}

.quota-panel {
  padding: 0;
}

.quota-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.quota-panel-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.quota-row {
  display: flex;
  gap: 14px;
}

.quota-item {
  flex: 1 1 0;
  min-width: 0;
}

.quota-card {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 22px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid rgba(232, 237, 248, 0.95);
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06);
}

.quota-card-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.quota-card-name {
  color: #1f2937;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
}

.quota-card-type {
  color: #6b7280;
  font-size: 13px;
}

.quota-card-pending {
  margin-top: 6px;
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f0f4ff;
  color: var(--quota-accent);
  font-size: 12px;
  font-weight: 500;
}

.quota-progress-text {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 1px;
}

.quota-progress-text strong {
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
  color: var(--quota-accent);
}

.quota-progress-text span {
  font-size: 12px;
  color: #9ca3af;
}

.task-name-text {
  display: inline-block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #409eff;
}

.task-name-text:hover,
.task-name-text:focus {
  color: #409eff;
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
  background: #f6f7fa;
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
  border: 1px solid #e6eaf5;
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
  border-right: 1px solid #e6eaf5;
  border-bottom: 1px solid #e6eaf5;
  font-size: 12px;
  background: #fafbfc;
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
  border: 1px solid #e6eaf5;
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
  border-bottom: 1px solid #f0f0f0;
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
  color: #4050f8;
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
  border-bottom: 2px solid #e6eaf5;
}

.candidate-item {
  padding: 12px;
  margin-bottom: 12px;
  background: #fafbfc;
  border: 1px solid #e6eaf5;
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
  color: #4050f8;
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
  font-family: "Courier New", monospace;
  word-break: break-all;
}
</style> 