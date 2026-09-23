<template>
  <div class="tasks-page">
    <el-card class="task-card">
      <template #header>
        <div class="task-header">
          <h3>任务列表</h3>
          <div class="task-controls">
            <el-input
              v-model="taskName"
              class="task-search-input"
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
            <el-select
              v-model="methodType"
              placeholder="请选择算法类型"
              style="width: 180px"
              clearable
            >
              <el-option
                v-for="option in METHOD_TYPE_OPTIONS"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <el-button type="primary" @click="handleSearchConfirm"
              >确定</el-button
            >
            <el-button @click="handleResetSearch"
              >重置</el-button
            >
            <el-button
              type="primary" plain
              :disabled="total === 0"
              @click="handleDeleteAllTasks"
              >全部删除</el-button
            >
          </div>
        </div>
      </template>

      <!-- 任务表格 -->
      <el-table
        class="tasks-table app-data-table"
        scrollbar-always-on
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
          min-width="180"
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
          width="112"
        >
          <template #default="{ row }">
            {{ getProblemTypeText(row.problemType) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="modelType"
          label="模型"
          width="156" class-name="table-model"
        >
          <template #default="{ row }">
            {{ getModelTypeText(row.modelType) }}
          </template>
        </el-table-column>
        <el-table-column prop="methodType" label="算法类型" width="124">
          <template #default="{ row }">{{ getTaskListMethodTypeText(row.modelType, row.methodType) }}</template>
        </el-table-column>
        <el-table-column
          prop="timestamp"
          label="提交时间"
          width="176"
        >
          <template #default="{ row }">
            {{ formatDate(row.timestamp) }}
          </template>
        </el-table-column>
        <el-table-column
          prop="matrixSize"
          label="规模"
          width="80"
        />
        <el-table-column
          prop="status"
          label="状态"
          width="96"
        >
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="total_time" label="总时间" width="145">
          <template #default="{ row }">{{ formatSolveTime(row.total_time) }}</template>
        </el-table-column>
        <el-table-column prop="solveTime" label="设备求解时间" width="145">
          <template #default="{ row }">
            {{ formatSolveTime(row.solveTime) }}
          </template>
        </el-table-column>
        <el-table-column prop="device_communication_time" label="设备通信时间" width="145">
          <template #default="{ row }">{{ formatDeviceOverheadTime(row.device_communication_time, row.modelType, row.status === "completed") }}</template>
        </el-table-column>
        <el-table-column prop="postprocess_time" label="后处理时间" width="145">
          <template #default="{ row }">{{ formatDeviceOverheadTime(row.postprocess_time, row.modelType, row.status === "completed") }}</template>
        </el-table-column>
        <el-table-column
          label="操作"
          fixed="right"
          class-name="table-actions"
          width="156"
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
                type="primary" plain
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
            <div class="quota-panel-title">剩余可用额度</div>
            <div class="quota-panel-meta">
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
              <span class="quota-meta-divider" aria-hidden="true"></span>
              <el-button
                class="quota-refresh-button"
                text
                type="primary"
                :loading="quotaLoading"
                :disabled="quotaLoading"
                data-testid="quota-refresh-button"
                @click="loadQuotaSummary(true)"
              >
                <el-icon v-if="!quotaLoading"><Refresh /></el-icon>
                <span>{{ quotaLoading ? "刷新中" : "刷新" }}</span>
              </el-button>
            </div>
          </div>
          <el-button
            class="quota-request-button"
            type="primary"
            data-testid="quota-request-button"
            @click="openQuotaRequestDialog"
          >
            <el-icon><Plus /></el-icon>
            <span>申请额度</span>
          </el-button>
        </div>

        <div
          class="quota-row"
          :class="{ 'quota-row--refreshing': quotaLoading }"
        >
          <div
            v-for="card in quotaCards"
            :key="card.key"
            class="quota-item quota-card"
            :class="[
              `quota-card--${card.key}`,
              { 'quota-card--wide': Number(card.available) > 9999 },
            ]"
            role="group"
            :aria-label="`${card.label}剩余额度 ${card.available} 次`"
          >
            <div class="quota-card-label">
              <span class="quota-card-mark" aria-hidden="true"></span>
              <div class="quota-card-name">{{ card.label }}</div>
            </div>

            <div class="quota-balance">
              <strong>{{ card.available }}</strong>
              <span>次</span>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <el-dialog
      v-model="quotaRequestDialogVisible"
      class="quota-request-dialog"
      title="申请额度"
      width="560px"
      align-center
      :close-on-click-modal="false"
    >
      <div
        v-loading="quotaRequestLoading"
        class="quota-request-content"
        :class="{ 'is-pending': pendingQuotaRequest }"
      >
        <template v-if="pendingQuotaRequest">
          <section class="quota-pending-card" aria-labelledby="quota-pending-title">
            <div class="quota-pending-head">
              <div class="quota-pending-heading">
                <span class="quota-pending-mark" aria-hidden="true"></span>
                <div>
                  <strong id="quota-pending-title">等待管理员审批</strong>
                </div>
              </div>
              <el-tag type="warning" effect="light" size="small">待审批</el-tag>
            </div>

            <div class="quota-pending-amounts">
              <div class="quota-pending-amount">
                <span>经典计算</span>
                <div><strong>+{{ pendingQuotaRequest.amounts.classic }}</strong><small>次</small></div>
              </div>
              <div class="quota-pending-amount">
                <span>量子芯片模拟计算</span>
                <div><strong>+{{ pendingQuotaRequest.amounts.quantum }}</strong><small>次</small></div>
              </div>
            </div>

            <div class="quota-pending-reason">
              <span>申请原因</span>
              <p>{{ pendingQuotaRequest.reason }}</p>
            </div>

            <div class="quota-pending-meta">
              <span>提交时间</span>
              <time>{{ formatDate(pendingQuotaRequest.createdAt || null) }}</time>
            </div>
          </section>
        </template>

        <template v-else>
          <el-form label-position="top" @submit.prevent>
            <div class="quota-request-grid">
              <el-form-item label="经典计算额度（次）">
                <el-input-number
                  v-model="quotaRequestForm.classic"
                  :min="0"
                  :max="100000"
                  :precision="0"
                  :step="10"
                  :controls="false"
                />
              </el-form-item>
              <el-form-item label="量子芯片模拟计算额度（次）">
                <el-input-number
                  v-model="quotaRequestForm.quantum"
                  :min="0"
                  :max="100000"
                  :precision="0"
                  :step="10"
                  :controls="false"
                />
              </el-form-item>
            </div>
            <el-form-item label="申请原因">
              <el-input
                v-model="quotaRequestForm.reason"
                type="textarea"
                :rows="4"
                :maxlength="200"
                show-word-limit
                placeholder="请说明使用场景、课题或项目需求（至少 2 个字符）"
              />
            </el-form-item>
            <div class="quota-request-note">
              申请提交后将由管理员审批，通过后额度会自动增加。
            </div>
          </el-form>
        </template>
      </div>
      <template #footer>
        <el-button @click="quotaRequestDialogVisible = false">关闭</el-button>
        <el-button
          v-if="!pendingQuotaRequest"
          type="primary"
          :loading="quotaRequestSubmitting"
          :disabled="quotaRequestLoading"
          @click="handleSubmitQuotaRequest"
        >
          提交
        </el-button>
      </template>
    </el-dialog>

    <!-- 任务详情对话框 -->
    <el-dialog
      v-model="taskDetailVisible"
      class="task-detail-dialog"
      title="任务详情"
      width="800px"
      :close-on-click-modal="false"
      @closed="handleTaskDetailClosed"
    >
      <div
        v-if="selectedTask"
        v-loading="taskDetailLoading"
        class="task-detail"
        element-loading-text="正在加载任务详情..."
      >
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
            <div v-if="selectedTask.modelType === 'classic'" class="detail-row">
              <span class="detail-label">算法类型：</span>
              <span class="detail-value">{{ getMethodTypeText(selectedTask.methodType) }}</span>
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
              <el-tag
                class="task-detail-status-tag"
                :type="getStatusType(selectedTask.status)"
              >
                {{ getStatusText(selectedTask.status) }}
              </el-tag>
            </div>
          </div>
        </el-card>

        <!-- 结果信息 -->
        <el-card
          class="detail-section task-detail-result-card"
          v-if="selectedTask.status === 'completed' && taskDetailResults"
        >
          <template #header>
            <div class="detail-header">
              <span class="detail-title">结果信息</span>
            </div>
          </template>
          <div class="detail-content">
            <TaskTiming :results="taskDetailResults" :device-time="selectedTask.solveTime" :model-type="selectedTask.modelType" />
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
import TaskTiming from "../components/TaskTiming.vue";
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus, Refresh } from "@element-plus/icons-vue";
import {
  getTaskHistory,
  getTaskQuota,
  cancelTask as cancelTaskAPI,
  deleteTask as deleteTaskAPI,
  deleteTasksByFilter as deleteTasksByFilterAPI,
  getTaskDetail,
  getQuotaRequestStatus,
  submitQuotaRequest,
} from "../api";
import {
  getDeleteAllResultMessage,
  isDialogDismissed,
  isTaskCancellable,
  isTaskDeletable,
} from "../utils/task";
import { formatCandidateValue, formatDeviceOverheadTime, formatSolveTime, toFiniteNumber } from "../utils/format";
import { createLatestRequestGuard } from "../utils/asyncScope";
import { getErrorMessage } from "../utils/error";
import { downloadTaskResultExport } from "../utils/resultExport";
import { getMethodTypeText, getTaskListMethodTypeText, METHOD_TYPE_OPTIONS } from "../types/api";
import type {
  MethodType,
  ModelType,
  ProblemType,
  QuotaSummary,
  QuotaRequestItem,
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
  methodType: MethodType | "";
  problemType: ProblemType | "";
}

const taskName = ref("");
const modelType = ref<ModelType | "">("");
const methodType = ref<MethodType | "">("");
const problemType = ref<ProblemType | "">("");
const currentPage = ref(1);
const pageSize = ref(10);
const total = ref(0);
const taskDetailVisible = ref(false);
const selectedTask = ref<TaskHistoryItem | null>(null);
const taskDetailResults = ref<TaskResults | null>(null);
const taskDetailInput = ref<unknown>(null);
const taskDetailLoading = ref(false);
const historyLoading = ref(false);
const cancelingTaskId = ref<string | null>(null);
const appliedTaskFilters = ref<TaskFilterState>({
  taskName: "",
  modelType: "",
  methodType: "",
  problemType: "",
});
const modelTypeOptions: ModelType[] = ["classic", "quantum"];
const quotaSummary = ref<QuotaSummary | null>(null);
const quotaLoading = ref(false);
const quotaError = ref("");
const quotaLastUpdatedAt = ref<Date | null>(null);
const quotaRequestDialogVisible = ref(false);
const quotaRequestLoading = ref(false);
const quotaRequestSubmitting = ref(false);
const pendingQuotaRequest = ref<QuotaRequestItem | null>(null);
const quotaRequestForm = ref({ classic: 0, quantum: 0, reason: "" });
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
  { value: "general", label: "一般问题" },
];
// 方法
const normalizeTaskFilters = (filters: Partial<TaskFilterState> = {}): TaskFilterState => ({
  taskName: (filters.taskName ?? "").trim(),
  modelType: (filters.modelType ?? "") as ModelType | "",
  methodType: (filters.methodType ?? "") as MethodType | "",
  problemType: (filters.problemType ?? "") as ProblemType | "",
});

const compactTaskFilters = (filters = {}) => {
  const normalizedFilters = normalizeTaskFilters(filters);
  return Object.fromEntries(
    Object.entries(normalizedFilters).filter(([, value]) => value)
  );
};

const hasOwnFilter = (params: TaskHistoryParams, key: keyof TaskFilterState) =>
  Object.prototype.hasOwnProperty.call(params, key);

const loadTasks = async (params: TaskHistoryParams = {}) => {
  const requestId = taskHistoryRequestGuard.begin();
  const requestFilters = normalizeTaskFilters({
    taskName: hasOwnFilter(params, "taskName")
      ? params.taskName ?? ""
      : appliedTaskFilters.value.taskName,
    modelType: hasOwnFilter(params, "modelType")
      ? params.modelType ?? ""
      : appliedTaskFilters.value.modelType,
    methodType: hasOwnFilter(params, "methodType")
      ? params.methodType ?? ""
      : appliedTaskFilters.value.methodType,
    problemType: hasOwnFilter(params, "problemType")
      ? params.problemType ?? ""
      : appliedTaskFilters.value.problemType,
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
    methodType: methodType.value,
    problemType: problemType.value,
  });
};

const handleResetSearch = () => {
  taskName.value = "";
  modelType.value = "";
  methodType.value = "";
  problemType.value = "";
  loadTasks({
    page: currentPage.value,
    pageSize: pageSize.value,
    taskName: "",
    modelType: "",
    methodType: "",
    problemType: "",
  });
};

const viewTask = async (task: TaskHistoryItem) => {
  const requestId = taskDetailRequestGuard.begin();
  selectedTask.value = task;
  taskDetailResults.value = null;
  taskDetailInput.value = null;
  taskDetailLoading.value = task.status === "completed";
  taskDetailVisible.value = true;
  try {
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
      const resultBestValue = toFiniteNumber(
        taskDetailResults.value?.candidates?.[0]?.value,
      );
      if (
        task.problemType === "general"
        && resultBestValue !== null
        && selectedTask.value
      ) {
        selectedTask.value = {
          ...selectedTask.value,
          bestValue: resultBestValue,
        };
        const historyItem = tasks.value.find((item) => item.taskId === task.taskId);
        if (historyItem) historyItem.bestValue = resultBestValue;
      }
    }
  } catch (error) {
    if (!taskDetailRequestGuard.isLatest(requestId)) return;
    ElMessage.error(getErrorMessage(error, "获取任务详情失败"));
  } finally {
    if (taskDetailRequestGuard.isLatest(requestId)) {
      taskDetailLoading.value = false;
    }
  }
};

const loadQuotaRequestStatus = async () => {
  quotaRequestLoading.value = true;
  try {
    const response = await getQuotaRequestStatus();
    if (response.success && response.data) {
      pendingQuotaRequest.value = response.data.pendingRequest || null;
      return;
    }
    throw new Error(response.message || "加载申请状态失败");
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "加载申请状态失败"));
  } finally {
    quotaRequestLoading.value = false;
  }
};

const openQuotaRequestDialog = () => {
  quotaRequestForm.value = { classic: 0, quantum: 0, reason: "" };
  quotaRequestDialogVisible.value = true;
  loadQuotaRequestStatus();
};

const handleSubmitQuotaRequest = async () => {
  const { classic, quantum } = quotaRequestForm.value;
  const reason = quotaRequestForm.value.reason.trim();
  const amounts = [classic, quantum];
  if (!amounts.every((amount) => Number.isFinite(amount) && Number.isInteger(amount))) {
    ElMessage.warning("申请额度必须是整数");
    return;
  }
  if (amounts.some((amount) => amount < 0 || amount > 100000)) {
    ElMessage.warning("单项申请额度须在 0-100000 之间");
    return;
  }
  if (classic + quantum <= 0) {
    ElMessage.warning("请至少申请一项计算额度");
    return;
  }
  if (reason.length < 2) {
    ElMessage.warning("请填写至少 2 个字符的申请原因");
    return;
  }

  quotaRequestSubmitting.value = true;
  try {
    const response = await submitQuotaRequest({
      amounts: { classic, quantum },
      reason,
    });
    if (!response.success || !response.data?.request) {
      throw new Error(response.message || "额度申请提交失败");
    }
    pendingQuotaRequest.value = response.data.request;
    quotaRequestDialogVisible.value = false;
    ElMessage.success("额度申请已提交，请等待管理员审批");
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "额度申请提交失败"));
    await loadQuotaRequestStatus();
  } finally {
    quotaRequestSubmitting.value = false;
  }
};

const handleTaskDetailClosed = () => {
  taskDetailRequestGuard.invalidate();
  selectedTask.value = null;
  taskDetailResults.value = null;
  taskDetailInput.value = null;
  taskDetailLoading.value = false;
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
  general: "一般问题",
};

const modelTypeMap = {
  classic: "经典计算",
  quantum: "量子芯片模拟计算",
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
    const hasAvailable = Number.isFinite(Number(quotaData?.available));
    const available = hasAvailable ? Number(quotaData?.available) : "--";

    return {
      key: type,
      label: quotaData?.label || getModelTypeText(type),
      available,
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
    general: "个变量",
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
      methodType: selectedTask.value.methodType ?? undefined,
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
  align-items: flex-start;
  gap: 20px;
}

.task-header h3 {
  margin: 0;
  flex-shrink: 0;
  line-height: 36px;
  white-space: nowrap;
  color: #292929;
  font-weight: 600;
}

.task-controls {
  display: flex;
  min-width: 0;
  justify-content: flex-end;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.task-controls :deep(.el-select__wrapper) {
  min-height: 36px;
  box-sizing: border-box;
  border-radius: 7px;
  background: var(--app-control-bg);
  box-shadow: none;
}

.task-controls :deep(.el-select__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--app-border) inset;
}

.task-controls :deep(.el-select__wrapper.is-focused) {
  background: var(--app-control-bg);
  box-shadow: 0 0 0 1px var(--app-accent) inset;
}

.task-controls :deep(.el-button) {
  height: 36px;
  margin-left: 0;
  border-radius: 7px;
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
  flex: 1;
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
  color: #7b879c;
  font-size: 12px;
  line-height: 1.4;
  transition: color 0.2s ease;
}

.quota-panel-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  margin-top: 5px;
}

.quota-meta-divider {
  width: 1px;
  height: 12px;
  background: #dce3ed;
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
  color: var(--app-accent);
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
  min-width: 0;
  height: 24px;
  margin-left: 0;
  padding: 0 5px;
  border-radius: 7px;
  color: #54708f;
  font-size: 12px;
  font-weight: 500;
}

.quota-refresh-button :deep(.el-icon) {
  margin-right: 4px;
}

.quota-request-content {
  min-height: 238px;
}

.quota-request-content.is-pending {
  min-height: 0;
}

.quota-pending-card { min-width: 0; }
.quota-pending-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 2px 0 16px;
  border-bottom: 1px solid #eef1f5;
}
.quota-pending-heading { display: flex; align-items: center; min-width: 0; gap: 10px; }
.quota-pending-mark {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--el-color-warning);
}
.quota-pending-heading strong { color: #303746; font-size: 14px; font-weight: 600; line-height: 22px; }
.quota-pending-head :deep(.el-tag) { flex-shrink: 0; border-radius: 4px; }
.quota-pending-amounts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  overflow: hidden;
  margin: 16px 0 20px;
  border-radius: 8px;
  background: #f8fafc;
}
.quota-pending-amount { padding: 15px 16px; }
.quota-pending-amount + .quota-pending-amount { border-left: 1px solid #e8edf4; }
.quota-pending-amount > span { display: block; color: #7c8494; font-size: 12px; line-height: 18px; }
.quota-pending-amount div { display: flex; align-items: baseline; gap: 5px; margin-top: 7px; }
.quota-pending-amount strong { color: #303746; font-size: 22px; font-variant-numeric: tabular-nums; line-height: 1.2; }
.quota-pending-amount small { color: #8992a3; font-size: 12px; }
.quota-pending-reason { padding-bottom: 16px; border-bottom: 1px solid #eef1f5; }
.quota-pending-reason > span {
  display: inline-block;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--app-accent);
  color: #202737;
  font-size: 14px;
  font-weight: 600;
}
.quota-pending-reason p { margin: 10px 0 0; color: #303746; font-size: 14px; line-height: 1.65; overflow-wrap: anywhere; white-space: pre-wrap; }
.quota-pending-meta { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 0 4px; color: #7c8494; font-size: 13px; }
.quota-pending-meta time { color: #596273; font-variant-numeric: tabular-nums; }

.quota-request-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.quota-request-grid :deep(.el-input-number) {
  width: 100%;
}

.quota-request-note {
  padding: 9px 12px;
  border-radius: 6px;
  background: #f5f7fa;
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}

:global(.el-dialog.quota-request-dialog) {
  overflow: hidden;
  padding: 0;
  border: 0;
  border-radius: 14px;
  background: #ffffff;
  box-shadow: 0 18px 54px rgba(31, 42, 68, 0.18);
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
}
:global(.quota-request-dialog .el-dialog__header) { position: relative; margin-right: 0; padding: 20px 24px 16px; border-bottom: 1px solid #edf1f6; }
:global(.quota-request-dialog .el-dialog__title) { color: #202737; font-size: 18px; font-weight: 600; }
:global(.quota-request-dialog .el-dialog__headerbtn) { top: 12px; right: 14px; width: 36px; height: 36px; border-radius: 8px; }
:global(.quota-request-dialog .el-dialog__headerbtn:hover) { background: #f3f6fa; }
:global(.quota-request-dialog .el-dialog__headerbtn .el-dialog__close) { color: #7a8798; font-size: 17px; }
:global(.quota-request-dialog .el-dialog__body) { padding: 18px 24px 6px; }
:global(.quota-request-dialog .el-dialog__footer) { padding: 12px 24px 20px; }
:global(.quota-request-dialog .el-dialog__footer .el-button) { min-width: 64px; border-radius: 7px; }
.quota-request-content :deep(.el-form-item) { margin-bottom: 20px; }
.quota-request-content :deep(.el-form-item__label) { height: auto; margin-bottom: 8px; padding: 0; color: #63738a; font-size: 13px; line-height: 20px; }
.quota-request-content :deep(.el-input__wrapper),
.quota-request-content :deep(.el-textarea__inner) { border-radius: 7px; background: var(--app-control-bg); box-shadow: none; }
.quota-request-content :deep(.el-input__wrapper) { min-height: 36px; box-sizing: border-box; }
.quota-request-content :deep(.el-input__wrapper:hover),
.quota-request-content :deep(.el-textarea__inner:hover) { box-shadow: 0 0 0 1px var(--app-border) inset; }
.quota-request-content :deep(.el-input__wrapper.is-focus),
.quota-request-content :deep(.el-textarea__inner:focus) { background: var(--app-control-bg); box-shadow: 0 0 0 1px var(--app-accent) inset; }
.quota-request-content :deep(.el-textarea__inner) { padding: 12px 14px 28px; line-height: 1.8; resize: none; }
.quota-request-content :deep(.el-input__count) { right: 14px; bottom: 8px; background: transparent; color: #78879b; }

.quota-row {
  position: relative;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.quota-item {
  flex: 1 1 0;
  min-width: 0;
}

.quota-card {
  --quota-tone: var(--app-accent);
  --quota-tone-rgb: var(--app-accent-rgb);
  --quota-surface: #f8f9fc;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  min-height: 104px;
  overflow: hidden;
  padding: 22px 26px;
  border: 1px solid rgba(var(--quota-tone-rgb), 0.13);
  border-radius: 13px;
  background: var(--quota-surface);
  box-shadow: 0 5px 16px rgba(15, 23, 42, 0.035);
  box-sizing: border-box;
  transition: border-color 0.2s ease, box-shadow 0.2s ease,
    transform 0.2s ease;
}

.quota-card--classic {
  --quota-surface: rgba(var(--app-accent-rgb), 0.035);
}

.quota-card--quantum {
  --quota-surface: rgba(var(--app-accent-rgb), 0.065);
}

.quota-card:hover {
  border-color: rgba(var(--quota-tone-rgb), 0.24);
  box-shadow: 0 8px 22px rgba(var(--quota-tone-rgb), 0.075);
  transform: translateY(-1px);
}

.quota-row--refreshing .quota-card {
  border-color: rgba(var(--quota-tone-rgb), 0.24);
  opacity: 0.72;
}

.quota-card-label {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.quota-card-mark {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 3px;
  background: var(--quota-tone);
}

.quota-card-name {
  color: #344258;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.quota-balance {
  display: flex;
  align-items: baseline;
  gap: 7px;
  flex: 0 0 auto;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.quota-balance strong {
  max-width: 100%;
  color: var(--quota-tone);
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1;
}

.quota-balance span {
  color: #718096;
  font-size: 13px;
  font-weight: 500;
}

.quota-card--wide .quota-balance {
  gap: 5px;
}

.quota-card--wide .quota-balance strong {
  font-size: 28px;
  letter-spacing: -0.04em;
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

@media (max-width: 900px) {
  .quota-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  :global(.el-dialog.quota-request-dialog) {
    width: calc(100% - 28px) !important;
    margin-top: 7vh;
  }

  :global(.quota-request-dialog .el-dialog__header) {
    padding-right: 20px;
    padding-left: 20px;
  }

  :global(.quota-request-dialog .el-dialog__body) {
    padding: 20px;
  }

  :global(.quota-request-dialog .el-dialog__footer) {
    padding-right: 20px;
    padding-left: 20px;
  }

  .quota-panel-header {
    align-items: flex-start;
  }

  .quota-panel-status {
    max-width: 210px;
  }

  .quota-item {
    flex-basis: 100%;
    min-width: 0;
  }

  .quota-request-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .quota-pending-amounts { grid-template-columns: 1fr; }
  .quota-pending-amount + .quota-pending-amount { border-top: 1px solid #e8edf4; border-left: 0; }
  .quota-pending-meta { flex-wrap: wrap; gap: 6px; }
}

@media (prefers-reduced-motion: reduce) {
  .quota-panel-status.is-updating .quota-status-dot {
    animation: none;
  }
}

.task-name-text {
  display: inline-block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-color-primary);
}

.task-name-text:hover,
.task-name-text:focus {
  color: var(--el-color-primary);
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
  color: var(--app-accent);
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
  color: var(--app-accent);
}

.candidate-value {
  color: #666;
  font-size: 14px;
}



</style> 
