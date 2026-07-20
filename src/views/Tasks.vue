<template>
  <div class="tasks-page">
    <el-card class="task-card">
      <template #header>
        <div class="task-header">
          <h3>任务列表</h3>
          <div class="task-controls">
            <el-input
              v-model="taskName"
              placeholder="请输入任务名称"
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
              placeholder="请选择模型类型"
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
            <el-button type="primary" @click="handleSearchConfirm"
              >确定</el-button
            >
            <el-button @click="handleResetSearch"
              >重置</el-button
            >
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
          label="任务名"
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
          label="问题类型"
          min-width="120"
        >
          <template #default="{ row }">
            {{ getProblemTypeText(row.problemType) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="modelType"
          label="模型"
          min-width="140"
        >
          <template #default="{ row }">
            {{ getModelTypeText(row.modelType) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="timestamp"
          label="提交时间"
          min-width="170"
        >
          <template #default="{ row }">
            {{ formatDate(row.timestamp) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="matrixSize"
          label="规模"
          min-width="90"
        />
        <el-table-column
          prop="status"
          label="状态"
          min-width="110"
        >
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="210"
          align="center"
        >
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button
                type="primary"
                size="small"
                @click.stop="viewTask(row)"
                >查看</el-button
              >
              <el-button
                v-if="isTaskCancellable(row.status)"
                size="small"
                type="warning"
                :loading="cancelingTaskId === row.taskId"
                @click.stop="cancelTask(row)"
                >取消</el-button
              >
              <el-button
                v-else
                size="small"
                type="danger"
                @click.stop="deleteTask(row)"
                >删除</el-button
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
          <div class="quota-panel-heading">
            <div class="quota-panel-title">计算额度</div>
            <div
              class="quota-panel-status"
              :class="{
                'is-updating': quotaLoading,
                'is-error': quotaError && !quotaLoading,
              }"
              aria-live="polite"
              data-testid="quota-refresh-status"
            >
              <span class="quota-status-dot"></span>
              <span>{{ quotaStatusText }}</span>
            </div>
          </div>
          <el-button
            class="quota-refresh-button"
            type="primary"
            :loading="quotaLoading"
            :disabled="quotaLoading"
            data-testid="quota-refresh-button"
            @click="loadQuotaSummary(true)"
          >
            <el-icon v-if="!quotaLoading"><Refresh /></el-icon>
            <span>{{ quotaLoading ? "刷新中" : "刷新额度" }}</span>
          </el-button
          >
        </div>

        <div
          class="quota-row"
          :class="{ 'quota-row--refreshing': quotaLoading }"
        >
          <div
            v-for="card in quotaCards"
            :key="card.key"
            class="quota-item quota-card"
            :style="{ '--quota-accent': card.accentColor }"
          >
            <div class="quota-card-label">
              <div class="quota-card-name">{{ card.label }}</div>
              <div class="quota-card-type">剩余额度</div>
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
      title="任务详情"
      width="800px"
      :close-on-click-modal="false"
      @closed="handleTaskDetailClosed"
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
                formatCandidateValue(selectedTask.bestValue)
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
                  >候选解 {{ candidate.rank || Number(index) + 1 }}</span
                >
                <span class="candidate-value"
                  >目标值：{{ formatCandidateValue(candidate.value) }}</span
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
          :disabled="!taskDetailResults"
          >导出结果</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Refresh } from "@element-plus/icons-vue";
import {
  getTaskHistory,
  getTaskQuota,
  cancelTask as cancelTaskAPI,
  deleteTask as deleteTaskAPI,
  deleteTasksByFilter as deleteTasksByFilterAPI,
  getTaskDetail,
} from "../api";
import {
  getDeleteAllResultMessage,
  isDialogDismissed,
  isTaskCancellable,
  isTaskDeletable,
} from "../utils/task";
import { formatCandidateValue } from "../utils/format";
import { createLatestRequestGuard } from "../utils/asyncScope";
import { getErrorMessage } from "../utils/error";
import { downloadTaskResultExport } from "../utils/resultExport";
import type {
  ModelType,
  ProblemType,
  QuotaSummary,
  TaskHistoryItem,
  TaskHistoryParams,
  TaskResults,
  TaskStatus,
} from "../types/api";
type TagType = "success" | "primary" | "warning" | "info" | "danger";

// 响应式数据
const tasks = ref<TaskHistoryItem[]>([]);
interface TaskFilterState {
  taskName: string;
  modelType: ModelType | "";
  problemType: ProblemType | "";
}

const taskName = ref("");
const modelType = ref<ModelType | "">("");
const problemType = ref<ProblemType | "">("");
const currentPage = ref(1);
const pageSize = ref(10);
const total = ref(0);
const taskDetailVisible = ref(false);
const selectedTask = ref<TaskHistoryItem | null>(null);
const taskDetailResults = ref<TaskResults | null>(null);
const taskDetailInput = ref<unknown>(null);
const historyLoading = ref(false);
const cancelingTaskId = ref<string | null>(null);
const appliedTaskFilters = ref<TaskFilterState>({
  taskName: "",
  modelType: "",
  problemType: "",
});
const modelTypeOptions: ModelType[] = ["classic", "sim", "cloud"];
const quotaSummary = ref<QuotaSummary | null>(null);
const quotaLoading = ref(false);
const quotaError = ref("");
const quotaLastUpdatedAt = ref<Date | null>(null);
let quotaRefreshPromise: Promise<boolean> | null = null;
let quotaRefreshQueued = false;
let quotaFeedbackRequested = false;
const taskHistoryRequestGuard = createLatestRequestGuard();
const taskDetailRequestGuard = createLatestRequestGuard();
const problemTypeOptions = [
  { value: "maxcut", label: "图分割问题" },
  { value: "number_partition", label: "数分问题" },
  { value: "coloring", label: "图着色问题" },
  { value: "tsp", label: "旅行商问题" },
];
const quotaColorMap: Record<ModelType, Array<{ color: string; percentage: number }>> = {
  classic: [{ color: "#ff9966", percentage: 50 }, { color: "#60dbe8", percentage: 100 }],
  sim: [{ color: "#5b6ef6", percentage: 50 }, { color: "#60dbe8", percentage: 100 }],
  cloud: [{ color: "#ffb85c", percentage: 50 }, { color: "#60dbe8", percentage: 100 }],
};

// 方法
const normalizeTaskFilters = (filters: Partial<TaskFilterState> = {}): TaskFilterState => ({
  taskName: (filters.taskName ?? "").trim(),
  modelType: (filters.modelType ?? "") as ModelType | "",
  problemType: (filters.problemType ?? "") as ProblemType | "",
});

const compactTaskFilters = (filters = {}) => {
  const normalizedFilters = normalizeTaskFilters(filters);
  return Object.fromEntries(
    Object.entries(normalizedFilters).filter(([, value]) => value)
  );
};

const loadTasks = async (params: TaskHistoryParams = {}) => {
  const requestId = taskHistoryRequestGuard.begin();
  const requestFilters = normalizeTaskFilters({
    taskName: params.taskName ?? appliedTaskFilters.value.taskName,
    modelType: params.modelType ?? appliedTaskFilters.value.modelType,
    problemType: params.problemType ?? appliedTaskFilters.value.problemType,
  });
  const requestParams = {
    page: params.page ?? currentPage.value,
    pageSize: params.pageSize ?? pageSize.value,
    ...requestFilters,
  };

  try {
    historyLoading.value = true;
    const response = await getTaskHistory(requestParams);
    if (!taskHistoryRequestGuard.isLatest(requestId)) return;

    if (response.success && response.data) {
      tasks.value = response.data.tasks || [];
      total.value = response.data.total || 0;
      appliedTaskFilters.value = requestFilters;
      return;
    }

    tasks.value = [];
    total.value = 0;
    ElMessage.error(response.message || "加载任务失败");
  } catch (error) {
    if (!taskHistoryRequestGuard.isLatest(requestId)) return;
    tasks.value = [];
    total.value = 0;
    ElMessage.error(getErrorMessage(error, "加载任务失败"));
  } finally {
    if (taskHistoryRequestGuard.isLatest(requestId)) {
      historyLoading.value = false;
    }
  }
};

const requestQuotaSummary = async () => {
  quotaError.value = "";
  try {
    const response = await getTaskQuota();
    if (response.success && response.data?.quotaSummary) {
      quotaSummary.value = response.data.quotaSummary;
      quotaLastUpdatedAt.value = new Date();
      return true;
    }

    quotaError.value = response.message || "加载额度失败";
  } catch (error) {
    quotaError.value = getErrorMessage(error, "加载额度失败");
  }
  return false;
};

const loadQuotaSummary = (showFeedback = false) => {
  quotaFeedbackRequested = quotaFeedbackRequested || showFeedback;
  if (quotaRefreshPromise) {
    quotaRefreshQueued = true;
    return quotaRefreshPromise;
  }

  quotaLoading.value = true;
  const runRefreshQueue = async () => {
    let refreshed;
    do {
      quotaRefreshQueued = false;
      refreshed = await requestQuotaSummary();
    } while (quotaRefreshQueued);

    if (quotaFeedbackRequested) {
      if (refreshed) {
        ElMessage.success("额度已更新");
      } else {
        ElMessage.error(quotaError.value || "加载额度失败");
      }
    }
    return refreshed;
  };

  quotaRefreshPromise = runRefreshQueue().finally(() => {
    quotaRefreshPromise = null;
    quotaRefreshQueued = false;
    quotaFeedbackRequested = false;
    quotaLoading.value = false;
  });
  return quotaRefreshPromise;
};

const handlePageSizeChange = (size: number) => {
  pageSize.value = size;
  currentPage.value = 1;
  loadTasks({
    page: 1,
    pageSize: size,
  });
};

const handleCurrentChange = (page: number) => {
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
    modelType: modelType.value,
    problemType: problemType.value,
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

const viewTask = async (task: TaskHistoryItem) => {
  const requestId = taskDetailRequestGuard.begin();
  try {
    selectedTask.value = task;
    taskDetailResults.value = null;
    taskDetailInput.value = null;
    taskDetailVisible.value = true;

    // 如果任务已完成，获取详细结果
    if (task.status === "completed") {
      const taskDetail = await getTaskDetail(task.taskId);
      if (
        !taskDetailRequestGuard.isLatest(requestId) ||
        selectedTask.value?.taskId !== task.taskId
      ) {
        return;
      }
      taskDetailResults.value = taskDetail.results || null;
      taskDetailInput.value = taskDetail.input;
    }
  } catch (error) {
    if (!taskDetailRequestGuard.isLatest(requestId)) return;
    ElMessage.error(getErrorMessage(error, "获取任务详情失败"));
  }
};

const handleTaskDetailClosed = () => {
  taskDetailRequestGuard.invalidate();
  selectedTask.value = null;
  taskDetailResults.value = null;
  taskDetailInput.value = null;
};

const confirmCancelTask = async (taskName = "") => {
  const taskLabel = taskName ? `任务“${taskName}”` : "该任务";
  await ElMessageBox.confirm(
    `确定要取消${taskLabel}吗？取消后任务将停止计算。`,
    "确认取消任务",
    {
      confirmButtonText: "确定取消",
      cancelButtonText: "取消",
      type: "warning",
    }
  );
};

const cancelTask = async (task: TaskHistoryItem) => {
  if (!isTaskCancellable(task.status)) {
    ElMessage.warning("仅支持取消计算中的任务");
    return;
  }

  try {
    await confirmCancelTask(task.taskName);
    cancelingTaskId.value = task.taskId;
    const response = await cancelTaskAPI(task.taskId);
    if (response?.success === false) {
      ElMessage.warning(response?.message || "取消失败");
      if (isTaskDeletable(response?.taskStatus)) {
        await Promise.all([loadTasks(), loadQuotaSummary()]);
      }
      return;
    }

    await Promise.all([loadTasks(), loadQuotaSummary()]);
    ElMessage.success(response?.message || "任务已取消");
  } catch (error) {
    if (!isDialogDismissed(error)) {
      ElMessage.error(getErrorMessage(error, "取消任务失败"));
    }
  } finally {
    cancelingTaskId.value = null;
  }
};

const deleteTask = async (task: TaskHistoryItem) => {
  if (!isTaskDeletable(task.status)) {
    ElMessage.warning("仅支持删除已完成、失败或已取消的任务");
    return;
  }

  ElMessageBox.confirm(
    `确定要删除任务“${task.taskName}”吗？`,
    "确认删除",
    {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
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
          ElMessage.success("任务已删除");
        } else {
          ElMessage.error("删除任务失败: " + response.message);
        }
      } catch (error) {
        ElMessage.error(getErrorMessage(error, "删除任务失败"));
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

    const response = await deleteTasksByFilterAPI(
      compactTaskFilters(appliedTaskFilters.value)
    );
    if (response.success) {
      ElMessage.success(
        getDeleteAllResultMessage(
          response.deletedCount,
          response.skippedNonTerminalCount
        )
      );
      currentPage.value = 1;
      await Promise.all([loadTasks({ page: 1 }), loadQuotaSummary()]);
    } else {
      ElMessage.error(response.message || "删除全部任务失败");
    }
  } catch (error) {
    if (error !== "cancel") {
      ElMessage.error(getErrorMessage(error, "删除全部任务失败"));
    }
  }
};

const problemTypeMap = {
  maxcut: "图分割",
  number: "数字分割",
  number_partition: "数字分割",
  coloring: "图着色",
  tsp: "旅行商",
};

const modelTypeMap = {
  classic: "经典计算",
  sim: "量子芯片模拟计算",
  cloud: "量子云服务计算",
};

// 与 backend.models.task Task.task_status 枚举一致
const statusTextMap = {
  queued: "计算中",
  processing: "计算中",
  completed: "已完成",
  failed: "已失败",
  cancelled: "已取消",
};

// 辅助函数
const getProblemTypeText = (type: ProblemType | "number") => {
  return problemTypeMap[type] ?? type;
};

const getModelTypeText = (type: ModelType) => {
  return modelTypeMap[type] ?? type;
};

const quotaStatusText = computed(() => {
  if (quotaLoading.value) {
    return quotaSummary.value
      ? "正在同步最新额度，当前数据仍可查看"
      : "正在获取额度数据";
  }
  if (quotaError.value) {
    return quotaSummary.value
      ? "刷新失败，当前显示上次数据"
      : "额度加载失败，请重试";
  }
  if (quotaLastUpdatedAt.value) {
    return `最近更新 ${quotaLastUpdatedAt.value.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })}`;
  }
  return "展示各计算模型当前可用额度";
});

const quotaCards = computed(() =>
  modelTypeOptions.map((type) => {
    const quotaData = quotaSummary.value?.models?.[type];
    const total = quotaData?.default || quotaSummary.value?.defaultQuota || 50;
    const hasAvailable = Number.isFinite(Number(quotaData?.available));
    const available = hasAvailable ? Number(quotaData?.available) : "--";
    const pending = quotaData?.pending ?? 0;

    return {
      key: type,
      label: quotaData?.label || getModelTypeText(type),
      total,
      available,
      pending,
      percentage:
        hasAvailable && total > 0
          ? Math.min(Math.max(Math.round((Number(available) / total) * 100), 0), 100)
          : 0,
      colors: quotaColorMap[type],
      accentColor: quotaColorMap[type][0].color,
    };
  })
);

const getStatusText = (status: TaskStatus) => {
  if (status == null) return "未知";
  return statusTextMap[status] ?? String(status);
};

const getStatusType = (status: TaskStatus): TagType => {
  const types: Record<TaskStatus, TagType> = {
    queued: "warning",
    processing: "warning",
    completed: "success",
    failed: "danger",
    cancelled: "info",
  };
  return types[status] || "info";
};

const formatDate = (timestamp: string | null) => {
  if (!timestamp) return "--";
  const date = new Date(timestamp);
  return `${date.toLocaleDateString("zh-CN")} ${date.toLocaleTimeString(
    "zh-CN",
    { hour: "2-digit", minute: "2-digit" }
  )}`;
};

const getProblemTypeSizeUnit = (type: ProblemType) => {
  const units = {
    maxcut: "个节点",
    coloring: "个节点",
    number_partition: "个数字",
    tsp: "个城市",
  };
  return units[type] || "个节点";
};

const formatSolution = (solution: unknown) => {
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
  if (!selectedTask.value || !taskDetailResults.value) return;

  downloadTaskResultExport(
    {
      taskId: selectedTask.value.taskId,
      taskName: selectedTask.value.taskName,
      problemType: selectedTask.value.problemType,
      modelType: selectedTask.value.modelType,
      matrixSize: selectedTask.value.matrixSize,
      timestamp: selectedTask.value.timestamp,
      status: selectedTask.value.status,
    },
    taskDetailInput.value,
    taskDetailResults.value
  );
};

onMounted(() => {
  loadTasks();
  loadQuotaSummary();
});

onBeforeUnmount(() => {
  taskHistoryRequestGuard.invalidate();
  taskDetailRequestGuard.invalidate();
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

.quota-panel-heading {
  min-width: 0;
}

.quota-panel-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.quota-panel-status {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 7px;
  color: #7b879c;
  font-size: 12px;
  line-height: 1.4;
  transition: color 0.2s ease;
}

.quota-status-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: #9aabc4;
  box-shadow: 0 0 0 3px rgba(154, 171, 196, 0.12);
}

.quota-panel-status.is-updating {
  color: #2878e5;
}

.quota-panel-status.is-updating .quota-status-dot {
  background: #409eff;
  box-shadow: 0 0 0 4px rgba(64, 158, 255, 0.13);
  animation: quota-status-pulse 1.4s ease-in-out infinite;
}

.quota-panel-status.is-error {
  color: #c45656;
}

.quota-panel-status.is-error .quota-status-dot {
  background: #f56c6c;
  box-shadow: 0 0 0 3px rgba(245, 108, 108, 0.12);
}

.quota-refresh-button {
  min-width: 112px;
}

.quota-refresh-button :deep(.el-icon) {
  margin-right: 6px;
}

.quota-row {
  position: relative;
  display: flex;
  gap: 14px;
}

.quota-item {
  flex: 1 1 0;
  min-width: 0;
}

.quota-card {
  position: relative;
  overflow: hidden;
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
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.quota-row--refreshing .quota-card {
  border-color: rgba(64, 158, 255, 0.28);
  box-shadow: 0 6px 20px rgba(64, 158, 255, 0.08);
}

.quota-row--refreshing .quota-card::after {
  position: absolute;
  top: 0;
  left: -36%;
  width: 36%;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    rgba(64, 158, 255, 0),
    rgba(64, 158, 255, 0.9),
    rgba(96, 219, 232, 0)
  );
  content: "";
  animation: quota-refresh-scan 1.35s ease-in-out infinite;
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

@keyframes quota-status-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(0.76);
    opacity: 0.65;
  }
}

@keyframes quota-refresh-scan {
  from {
    left: -36%;
  }
  to {
    left: 100%;
  }
}

@media (max-width: 900px) {
  .quota-row {
    flex-wrap: wrap;
  }

  .quota-item {
    flex: 1 1 calc(50% - 7px);
    min-width: 260px;
  }
}

@media (max-width: 620px) {
  .quota-panel-header {
    align-items: flex-start;
  }

  .quota-panel-status {
    max-width: 210px;
  }

  .quota-refresh-button {
    min-width: 104px;
  }

  .quota-item {
    flex-basis: 100%;
    min-width: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .quota-panel-status.is-updating .quota-status-dot,
  .quota-row--refreshing .quota-card::after {
    animation: none;
  }
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
