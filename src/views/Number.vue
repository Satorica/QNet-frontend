<template>
  <div class="number-page">
    <el-card class="main-card">
      <div class="card-content">
        <div class="left-column">
          <!-- 求解模型选择 -->
          <div class="controls-top">
            <span class="label">求解模型选择：</span>
            <el-radio-group v-model="solveType" class="solve-type-group" :disabled="solving">
              <el-radio-button label="classic">经典计算</el-radio-button>
              <el-radio-button label="sim">量子芯片模拟计算</el-radio-button>
              <el-radio-button label="cloud">量子云服务计算</el-radio-button>
            </el-radio-group>
          </div>

          <!-- 规模控制 -->
          <div class="controls-row">
            <div class="control-item">
              <span class="ctrl-label">数字规模：</span>
              <el-input-number
                v-model="numberSize"
                :min="NUMBER_MIN_SIZE"
                :max="NUMBER_MAX_SIZE"
                :disabled="solving"
                style="width: 130px"
                @change="handleNumberSizeChange"
              />
            </div>
          </div>

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
                :disabled="solving"
                placeholder="请输入数字，用逗号或空格分隔，例如：1,2,3,4,5"
              />
              <div class="input-buttons">
                <el-button :disabled="solving" @click="parseNumbers">解析数字</el-button>
                <el-button :disabled="solving" @click="generateRandomNumbers">随机生成</el-button>
                <el-button :disabled="solving" @click="clearNumbers">清空</el-button>
              </div>
            </div>

            <div class="number-list" v-if="numbers.length > 0">
              <h4>当前数字列表（{{ numbers.length }}个）：</h4>
              <div class="number-tags">
                <el-tag
                  v-for="(num, index) in numbers"
                  :key="index"
                  :closable="!solving"
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

          <!-- 候选结果 -->
          <el-card class="candidates-result-card">
            <template #header>
              <div class="result-header">
                <span>候选结果</span>
                <el-button
                  :disabled="!result || !resultExportContext"
                  @click="exportResults"
                  >结果导出</el-button
                >
              </div>
            </template>
            <div v-if="candidates.length === 0" class="candidates-placeholder">
              --
            </div>
            <div class="candidates-list-main">
              <div
                v-for="(candidate, index) in candidates"
                :key="index"
                class="candidate-item-main"
              >
                <div class="candidate-header-main">
                  <span class="candidate-rank-main"
                    >候选解 {{ index + 1 }}</span
                  >
                  <span class="candidate-value-main"
                    >目标值：{{ formatCandidateValue(candidate.value) }}</span
                  >
                </div>
                <div class="candidate-solution-main">
                  <span class="solution-label-main">解向量：</span>
                  <span class="solution-value-main">{{
                    candidate.solution || "--"
                  }}</span>
                </div>
              </div>
            </div>
          </el-card>
        </div>

        <div class="right-column">
          <!-- 求解控制 -->
          <div class="solve-area">
            <el-button
              type="primary"
              size="large"
              :loading="solving"
              :disabled="!numberInput.trim()"
              @click="startSolve"
              class="solve-btn"
            >
              {{ solving ? "求解中..." : "求解" }}
            </el-button>
            <el-button
              :loading="historyCancelingTaskId === currentTaskId"
              :disabled="!solving || historyCancelingTaskId !== null"
              @click="cancelSolve"
              >取消任务</el-button
            >
          </div>

          <!-- 求解状态 -->
          <div class="solve-state">
            <div class="state-icon" :class="statusClass"></div>
            <div class="state-text">{{ statusText }}</div>
          </div>
          <div class="solve-time">求解时间：{{ solveTime }}</div>

          <!-- 结果展示 -->
          <el-card class="result-card" v-if="result">
            <template #header>
              <div class="result-header">
                <span>求解结果</span>
              </div>
            </template>

            <div class="result-content">
              <div class="partition-result">
                <div class="subset">
                  <h4>子集A（和：{{ result.sumA }}）</h4>
                  <div class="subset-numbers">
                    <el-tag
                      v-for="num in result.subsetA"
                      :key="num"
                      type="success"
                    >
                      {{ num }}
                    </el-tag>
                  </div>
                </div>

                <div class="subset">
                  <h4>子集B（和：{{ result.sumB }}）</h4>
                  <div class="subset-numbers">
                    <el-tag
                      v-for="num in result.subsetB"
                      :key="num"
                      type="warning"
                    >
                      {{ num }}
                    </el-tag>
                  </div>
                </div>
              </div>

              <div class="result-stats">
                <div class="stat-item">
                  <span class="label">目标值：</span>
                  <span
                    class="value"
                    :class="{
                      optimal: result.difference === Math.abs(totalSum % 2),
                    }"
                  >
                    {{ formatCandidateValue(result.difference) }}
                    <el-tag
                      v-if="result.difference === Math.abs(totalSum % 2)"
                      type="success"
                      size="small"
                      >最优</el-tag
                    >
                  </span>
                </div>
                <div class="stat-item">
                  <span class="label">平衡度：</span>
                  <span class="value"
                    >{{ formatCandidateValue(result.balance) }}%</span
                  >
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
    </el-card>
    <el-card class="history-card">
      <template #header>
        <div class="history-header">
          <h3>任务历史</h3>
          <div class="history-actions">
            <el-input
              v-model="historyTaskName"
              placeholder="请输入任务名称"
              style="width: 220px"
              clearable
              @keyup.enter="handleHistorySearch"
            />
            <el-button type="primary" @click="handleHistorySearch"
              >确定</el-button
            >
            <el-button @click="handleHistoryReset">重置</el-button>
            <el-button
              type="danger"
              :disabled="historyTotal === 0"
              @click="handleDeleteAllTasks"
              >全部删除</el-button
            >
          </div>
        </div>
      </template>
      <el-table
        class="history-table"
        :data="taskHistory"
        row-key="taskId"
        stripe
        table-layout="fixed"
        style="width: 100%"
        v-loading="historyLoading"
      >
        <el-table-column
          prop="taskName"
          label="任务名"
          min-width="260"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <el-link
              class="task-name-link"
              type="primary"
              :underline="false"
              @click.stop="handleViewTaskDetail(row)"
            >
              {{ row.taskName }}
            </el-link>
          </template>
        </el-table-column>
        <el-table-column prop="modelType" label="模型" min-width="150">
          <template #default="{ row }">
            {{ getModelTypeText(row.modelType) }}
          </template>
        </el-table-column>
        <el-table-column prop="timestamp" label="提交时间" min-width="170">
          <template #default="{ row }">
            {{ formatDate(row.timestamp) }}
          </template>
        </el-table-column>
        <el-table-column prop="matrixSize" label="规模" min-width="90" />
        <el-table-column prop="status" label="状态" min-width="110">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="taskId" label="操作" width="220" align="center">
          <template #default="{ row }">
            <el-button
              type="primary"
              size="small"
              @click="handleViewTaskDetail(row)"
              >查看详情</el-button
            >
            <el-button
              v-if="isTaskCancellable(row.status)"
              type="warning"
              size="small"
              :loading="historyCancelingTaskId === row.taskId"
              :disabled="
                historyCancelingTaskId !== null &&
                historyCancelingTaskId !== row.taskId
              "
              @click="handleCancelHistoryTask(row)"
              >取消</el-button
            >
            <el-button
              v-else
              type="danger"
              size="small"
              @click="handleDeleteTask(row)"
              >删除</el-button
            >
          </template>
        </el-table-column>
        <el-table-column prop="bestValue" label="最优值" min-width="100">
          <template #default="{ row }">
            {{ formatBestValue(row.bestValue) }}
          </template>
        </el-table-column>
        <el-table-column prop="solveTime" label="求解时间" min-width="110">
          <template #default="{ row }">
            {{ formatSolveTime(row.solveTime) }}
          </template>
        </el-table-column>
      </el-table>
      <div class="history-pagination">
        <el-pagination
          :current-page="historyCurrentPage"
          :page-size="historyPageSize"
          :page-sizes="[10, 20, 50]"
          :total="historyTotal"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleHistoryPageSizeChange"
          @current-change="handleHistoryCurrentChange"
        />
      </div>
    </el-card>

    <!-- 任务详情弹窗 -->
    <el-dialog
      v-model="detailDialogVisible"
      title="任务详细信息"
      width="800px"
      :close-on-click-modal="false"
      @closed="handleTaskDetailClosed"
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
              <span class="detail-value">{{
                getModelTypeText(selectedTask.modelType)
              }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">问题规模：</span>
              <span class="detail-value"
                >{{ selectedTask.matrixSize }} 个数字</span
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

        <!-- 结果信息卡片 -->
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
            <div class="detail-row">
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
            <template
              v-if="
                taskDetailResults.candidates &&
                taskDetailResults.candidates.length > 0
              "
            >
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
                    JSON.stringify(candidate.solution)
                  }}</span>
                </div>
              </div>
            </template>
            <div v-else class="detail-value">--</div>
          </div>
        </el-card>

        <!-- 失败信息 -->
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
        <el-button @click="detailDialogVisible = false">关闭</el-button>
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
import { ref, computed, onBeforeUnmount } from "vue";
import {
  submitTask,
  getTaskStatus,
  getTaskDetail,
  cancelTask,
  getTaskHistory,
  deleteTask,
  deleteTasksByFilter,
} from "../api";
import { ElMessage, ElMessageBox } from "element-plus";
import { useCustomTaskName } from "../stores/customTaskName";
import {
  formatBestValue,
  formatCandidateValue,
  formatSolveTime,
} from "../utils/format";
import {
  createSolveLogController,
  SOLVE_LOG_IDLE_MESSAGE,
} from "../utils/solveLog";
import {
  getDeleteAllResultMessage,
  isDialogDismissed,
  isTaskCancellable,
  isTaskDeletable,
} from "../utils/task";
import { createAsyncScope, createLatestRequestGuard } from "../utils/asyncScope";
import { getErrorMessage } from "../utils/error";
import {
  downloadTaskResultExport,
  type TaskResultExportInfo,
} from "../utils/resultExport";
import {
  assertSafeIntegerSum,
  parsePositiveSafeInteger,
} from "../utils/validation";
import type {
  CandidateDisplay,
  ModelType,
  NumberPartitionResult,
  TaskDeleteFilters,
  TaskHistoryItem,
  TaskHistoryParams,
  TaskResults,
  TaskStatus,
  TaskSubmitRequest,
} from "../types/api";
type TagType = "success" | "primary" | "warning" | "info" | "danger";
type NumberExportContext = {
  taskInfo: TaskResultExportInfo;
  numbers: number[];
};

const { customTaskName, clearCustomTaskName } = useCustomTaskName();

const NUMBER_MIN_SIZE = 1;
const NUMBER_MAX_SIZE = 10;
const NUMBER_DEFAULT_SIZE = 8;

// 响应式数据
const numberInput = ref("");
const numbers = ref<number[]>([]);
const numberSize = ref(NUMBER_DEFAULT_SIZE);
const solveType = ref<ModelType>("classic");
const solving = ref(false);
const statusClass = ref("status-idle");
const statusText = ref("等待求解");
const solveTime = ref("--");
const result = ref<NumberPartitionResult | null>(null);
const logs = ref([SOLVE_LOG_IDLE_MESSAGE]);
const { addLog, resetSolveLogs, addTaskProgressLog } =
  createSolveLogController(logs);
const currentTaskId = ref<string | null>(null);
const candidates = ref<CandidateDisplay[]>([]);
const solveTaskResults = ref<TaskResults | null>(null);
const resultExportContext = ref<NumberExportContext | null>(null);
const solveScope = createAsyncScope();

const clearSolveResult = () => {
  result.value = null;
  candidates.value = [];
  solveTaskResults.value = null;
  resultExportContext.value = null;
};

// 任务历史
const taskHistory = ref<TaskHistoryItem[]>([]);
const historyLoading = ref(false);
const historyCancelingTaskId = ref<string | null>(null);
const historyTaskName = ref("");
const historyCurrentPage = ref(1);
const historyPageSize = ref(10);
const historyTotal = ref(0);
const appliedHistoryTaskName = ref("");
const taskHistoryRequestGuard = createLatestRequestGuard();
const taskDetailRequestGuard = createLatestRequestGuard();

// 任务详情对话框
const detailDialogVisible = ref(false);
const selectedTask = ref<TaskHistoryItem | null>(null);
const taskDetailResults = ref<TaskResults | null>(null);
const taskDetailInput = ref<unknown>(null);

// 计算属性
const totalSum = computed(() =>
  numbers.value.reduce((sum, num) => sum + num, 0)
);
const average = computed(() =>
  numbers.value.length > 0 ? totalSum.value / numbers.value.length : 0
);

// 方法
const parseNumberInput = () => {
  const tokens = numberInput.value
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter((s) => s);

  if (tokens.length === 0) {
    throw new Error("请输入有效的正整数");
  }
  const parsedNumbers = tokens.map(parsePositiveSafeInteger);
  assertSafeIntegerSum(parsedNumbers);
  return parsedNumbers;
};

const assertWithinNumberSize = (values: number[]) => {
  if (values.length > numberSize.value) {
    throw new Error(`数字数量不能超过当前规模 ${numberSize.value}`);
  }
};

const assertMatchedNumberSize = (values: number[]) => {
  if (values.length !== numberSize.value) {
    throw new Error(
      `数字数量需与当前规模一致：当前 ${values.length} 个，规模 ${numberSize.value}`
    );
  }
};

const handleNumberSizeChange = () => {
  if (solving.value) return;
  let nextNumbers;
  let nextInput;

  try {
    const parsedNumbers = parseNumberInput();
    nextNumbers = parsedNumbers.slice(0, numberSize.value);
    nextInput =
      parsedNumbers.length > numberSize.value
        ? nextNumbers.join(", ")
        : numberInput.value;
  } catch {
    nextNumbers = numbers.value.slice(0, numberSize.value);
    nextInput =
      numbers.value.length > numberSize.value
        ? nextNumbers.join(", ")
        : numberInput.value;
  }

  numbers.value = nextNumbers;
  numberInput.value = nextInput;
  clearSolveResult();
};

const parseNumbers = () => {
  if (solving.value) return;
  try {
    const parsedNumbers = parseNumberInput();
    assertWithinNumberSize(parsedNumbers);
    numbers.value = parsedNumbers;
    // 清除之前的结果
    clearSolveResult();
    addLog(`解析得到${numbers.value.length}个数字`);
    ElMessage.success(`成功解析${numbers.value.length}个数字`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "数字解析失败";
    ElMessage.warning(message);
    addLog(message);
  }
};

const generateRandomNumbers = () => {
  if (solving.value) return;
  const count = numberSize.value;
  const newNumbers: number[] = [];

  for (let i = 0; i < count; i++) {
    newNumbers.push(Math.floor(Math.random() * 50) + 1); // 1-50的随机数
  }

  numbers.value = newNumbers;
  numberInput.value = newNumbers.join(", ");
  // 清除之前的结果
  clearSolveResult();
  addLog(`随机生成${count}个数字`);
};

const clearNumbers = () => {
  if (solving.value) return;
  numbers.value = [];
  numberInput.value = "";
  clearSolveResult();
  addLog("已清空数字列表");
};

const removeNumber = (index: number) => {
  if (solving.value) return;
  const removed = numbers.value[index];
  numbers.value.splice(index, 1);
  numberInput.value = numbers.value.join(", ");
  clearSolveResult();
  addLog(`移除数字：${removed}`);
};

const getNumberTagType = (num: number): TagType => {
  if (num <= 10) return "primary";
  if (num <= 30) return "success";
  if (num <= 50) return "warning";
  return "danger";
};

const applyTerminalTaskStatus = (taskStatus: TaskStatus) => {
  if (taskStatus === "completed") {
    statusClass.value = "status-success";
    statusText.value = "求解成功";
  } else if (taskStatus === "cancelled") {
    statusClass.value = "status-fail";
    statusText.value = "已取消";
  } else if (taskStatus === "failed") {
    statusClass.value = "status-fail";
    statusText.value = "求解失败";
  }
};

const startSolve = async () => {
  let parsedNumbers;
  try {
    parsedNumbers = parseNumberInput();
    assertMatchedNumberSize(parsedNumbers);
  } catch (error) {
    const message = error instanceof Error ? error.message : "请输入有效的正整数";
    ElMessage.warning(message);
    return;
  }

  numbers.value = parsedNumbers;
  const submittedNumbers = [...parsedNumbers];
  const submittedAt = Date.now();
  const submittedTaskName =
    customTaskName.value || `NumberPartition_${submittedAt}`;
  const solveToken = solveScope.begin();
  solving.value = true;
  statusClass.value = "status-running";
  solveTime.value = "--";
  currentTaskId.value = null;
  statusText.value = "求解中";
  clearSolveResult();
  resultExportContext.value = {
    taskInfo: {
      taskId: "",
      taskName: submittedTaskName,
      problemType: "number_partition",
      modelType: solveType.value,
      matrixSize: submittedNumbers.length,
      timestamp: new Date(submittedAt).toISOString(),
      status: "completed",
    },
    numbers: submittedNumbers,
  };

  const startTime = Date.now();
  resetSolveLogs(
    `开始求解数分问题（求解模型：${getModelTypeText(solveType.value)}，${parsedNumbers.length}个数字）`
  );

  try {
    // 准备任务数据
    const taskData: TaskSubmitRequest = {
      taskName: submittedTaskName,
      problemType: "number_partition",
      modelType: solveType.value, // classic | sim | cloud
      matrixSize: parsedNumbers.length,
      adjacencyMatrix: parsedNumbers,
    };

    // 提交任务到后端
    addLog("提交任务中");
    const submitResponse = await submitTask(taskData);
    if (!solveScope.isCurrent(solveToken)) return;

    if (submitResponse.success) {
      clearCustomTaskName();
      currentTaskId.value = submitResponse.taskId;
      if (resultExportContext.value) {
        resultExportContext.value = {
          ...resultExportContext.value,
          taskInfo: {
            ...resultExportContext.value.taskInfo,
            taskId: submitResponse.taskId,
          },
        };
      }
      addLog("任务已提交，等待结果");
      loadTaskHistory();

      // 开始轮询任务状态
      await pollTaskStatus(
        submitResponse.taskId,
        startTime,
        solveToken,
        submittedNumbers
      );
    } else {
      throw new Error(submitResponse.message || "任务提交失败");
    }
  } catch (error) {
    if (!solveScope.isCurrent(solveToken)) return;
    clearCustomTaskName();
    statusClass.value = "status-fail";
    statusText.value = "求解失败";
    addLog("求解失败：" + getErrorMessage(error, "求解失败"));
    ElMessage.error(getErrorMessage(error, "求解失败"));
    solving.value = false;
  }
};

// 轮询任务状态
const pollTaskStatus = async (
  taskId: string,
  startTime: number,
  solveToken: number,
  submittedNumbers: number[]
) => {
  const pollInterval = 2000; // 2秒轮询一次

  const poll = async () => {
    if (
      !solveScope.isCurrent(solveToken) ||
      currentTaskId.value !== taskId ||
      !solving.value
    ) return;
    try {
      const statusResponse = await getTaskStatus(taskId);
      if (
        !solveScope.isCurrent(solveToken) ||
        currentTaskId.value !== taskId ||
        !solving.value
      ) return;

      if (statusResponse.state === "completed") {
        // 任务完成
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        const runtime = statusResponse.results?.runtime;
        const displaySolveTime =
          typeof runtime === "number" ? formatSolveTime(`${runtime}s`) : formatSolveTime(`${duration}s`);

        statusClass.value = "status-success";
        statusText.value = "求解成功";
        solveTime.value = displaySolveTime;
        solving.value = false;

        // 解析后端返回的结果
        solveTaskResults.value = statusResponse.results || null;
        const resultCandidates = statusResponse.results?.candidates || [];
        if (resultCandidates.length > 0) {
          // 取第一个候选结果
          const bestResult = resultCandidates[0];
          const solutionVector = bestResult.solution; // 向量：1或-1

          // 将解向量转换为两个子集
          // 1表示子集A，-1表示子集B
          const subsetA: number[] = [];
          const subsetB: number[] = [];

          if (Array.isArray(solutionVector)) {
            solutionVector.forEach((value, index) => {
              if (index < submittedNumbers.length) {
                if (value === 1 || value > 0) {
                  subsetA.push(submittedNumbers[index]);
                } else {
                  subsetB.push(submittedNumbers[index]);
                }
              }
            });
          }

          const sumA = subsetA.reduce((a, b) => a + b, 0);
          const sumB = subsetB.reduce((a, b) => a + b, 0);
          const difference = Math.abs(sumA - sumB);
          const balance =
            sumA + sumB > 0
              ? ((Math.min(sumA, sumB) / Math.max(sumA, sumB)) * 100).toFixed(2)
              : "0.0";

          result.value = {
            subsetA,
            subsetB,
            sumA,
            sumB,
            difference,
            balance,
          };

          // 填充候选结果列表
          candidates.value = resultCandidates.map((c) => ({
            value: c.value,
            solution: JSON.stringify(c.solution),
          }));

          addLog("求解完成");
        } else {
          addLog("求解完成，但未返回候选解");
        }
        loadTaskHistory();
      } else if (
        statusResponse.state === "failed" ||
        statusResponse.state === "cancelled"
      ) {
        // 任务失败或取消
        statusClass.value = "status-fail";
        statusText.value =
          statusResponse.state === "cancelled" ? "已取消" : "求解失败";
        solving.value = false;
        addLog(
          statusResponse.state === "cancelled"
            ? "任务已取消"
            : `求解失败：${statusResponse.message || "任务失败"}`
        );
        loadTaskHistory();
      } else if (statusResponse.state === "processing") {
        // 任务处理中
        statusText.value = "计算中...";
        addTaskProgressLog("processing");
        solveScope.schedule(solveToken, poll, pollInterval);
      } else if (statusResponse.state === "queued") {
        statusText.value = `计算中${
          statusResponse.queuePosition
            ? `(队列第${statusResponse.queuePosition}位)`
            : ""
        }`;
        addTaskProgressLog("queued", statusResponse.queuePosition);
        solveScope.schedule(solveToken, poll, pollInterval);
      }
    } catch (error) {
      if (!solveScope.isCurrent(solveToken)) return;
      statusClass.value = "status-fail";
      statusText.value = "连接失败";
      solving.value = false;
      addLog("无法获取任务状态: " + getErrorMessage(error, "未知错误"));
      loadTaskHistory();
    }
  };

  // 开始轮询
  solveScope.schedule(solveToken, poll, pollInterval);
};

const cancelSolve = async () => {
  const taskId = currentTaskId.value;
  if (!taskId || historyCancelingTaskId.value !== null) return;

  historyCancelingTaskId.value = taskId;
  try {
    await confirmCancelTask();

    const res = await cancelTask(taskId);
    if (currentTaskId.value !== taskId) return;
    if (res?.success === false) {
      ElMessage.warning(res?.message || "取消失败");
      addLog(`取消失败：${res?.message || "取消失败"}`);
      // 任务刚好完成时继续保留轮询，让完成分支回填结果。
      if (res.taskStatus === "completed") {
        if (solving.value) {
          statusClass.value = "status-running";
          statusText.value = "正在获取结果";
          addLog("任务已完成，正在获取最终结果");
        }
        loadTaskHistory();
        return;
      }
      if (["failed", "cancelled"].includes(res.taskStatus)) {
        applyTerminalTaskStatus(res.taskStatus);
        solving.value = false;
        currentTaskId.value = null;
        solveScope.invalidate();
        loadTaskHistory();
      }
      return;
    }

    ElMessage.success(res?.message || "任务已取消");
    addLog("任务已取消");
    solving.value = false;
    solveScope.invalidate();
    statusClass.value = "status-fail";
    statusText.value = "已取消";
    currentTaskId.value = null;
    loadTaskHistory();
  } catch (error) {
    if (!isDialogDismissed(error)) {
      addLog("取消任务失败: " + getErrorMessage(error, "取消任务失败"));
      ElMessage.error(getErrorMessage(error, "取消任务失败"));
    }
  } finally {
    if (historyCancelingTaskId.value === taskId) {
      historyCancelingTaskId.value = null;
    }
  }
};

const exportResults = () => {
  const exportContext = resultExportContext.value;
  const solveResult = result.value;
  const taskResults = solveTaskResults.value;
  if (!exportContext || !solveResult || !taskResults) return;

  downloadTaskResultExport(
    exportContext.taskInfo,
    {
      numbers: exportContext.numbers,
    },
    taskResults,
    solveResult
  );
};

// 任务历史相关方法
const getHistoryDeleteFilters = (): TaskDeleteFilters => {
  const taskName = appliedHistoryTaskName.value.trim();
  return taskName
    ? { problemType: "number_partition", taskName }
    : { problemType: "number_partition" };
};

const loadTaskHistory = async (params: TaskHistoryParams = {}) => {
  const requestId = taskHistoryRequestGuard.begin();
  const requestTaskName = (params.taskName ?? appliedHistoryTaskName.value).trim();
  const requestParams: TaskHistoryParams = {
    problemType: "number_partition",
    page: params.page ?? historyCurrentPage.value,
    pageSize: params.pageSize ?? historyPageSize.value,
    taskName: requestTaskName,
  };

  try {
    historyLoading.value = true;
    const response = await getTaskHistory(requestParams);
    if (!taskHistoryRequestGuard.isLatest(requestId)) return;
    if (response.success && response.data) {
      taskHistory.value = response.data.tasks || [];
      historyTotal.value = response.data.total || 0;
      appliedHistoryTaskName.value = requestTaskName;
    } else {
      taskHistory.value = [];
      historyTotal.value = 0;
    }
  } catch (error) {
    if (!taskHistoryRequestGuard.isLatest(requestId)) return;
    addLog("加载任务历史失败: " + getErrorMessage(error, "未知错误"));
    taskHistory.value = [];
    historyTotal.value = 0;
  } finally {
    if (taskHistoryRequestGuard.isLatest(requestId)) {
      historyLoading.value = false;
    }
  }
};

const handleHistorySearch = () => {
  historyCurrentPage.value = 1;
  loadTaskHistory({
    page: 1,
    taskName: historyTaskName.value.trim(),
  });
};

const handleHistoryReset = () => {
  historyTaskName.value = "";
  historyCurrentPage.value = 1;
  loadTaskHistory({
    page: 1,
    pageSize: historyPageSize.value,
    taskName: "",
  });
};

const handleHistoryPageSizeChange = (size: number) => {
  historyPageSize.value = size;
  historyCurrentPage.value = 1;
  loadTaskHistory({
    page: 1,
    pageSize: size,
  });
};

const handleHistoryCurrentChange = (page: number) => {
  historyCurrentPage.value = page;
  loadTaskHistory({
    page,
  });
};

// 辅助函数
const getModelTypeText = (type: ModelType) => {
  const types = {
    classic: "经典计算",
    sim: "量子芯片模拟计算",
    cloud: "量子云服务计算",
  };
  return types[type] || type;
};

const getStatusText = (status: TaskStatus) => {
  const statuses = {
    queued: "计算中",
    processing: "计算中",
    completed: "已完成",
    failed: "已失败",
    cancelled: "已取消",
  };
  return statuses[status] || status;
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

const confirmCancelTask = async (taskName = "") => {
  const taskLabel = taskName ? `任务“${taskName}”` : "当前任务";
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

const handleCancelHistoryTask = async (row: TaskHistoryItem) => {
  if (!isTaskCancellable(row.status)) {
    ElMessage.warning("仅支持取消计算中的任务");
    return;
  }
  if (historyCancelingTaskId.value !== null) return;

  if (row.taskId === currentTaskId.value) {
    await cancelSolve();
    return;
  }

  historyCancelingTaskId.value = row.taskId;
  try {
    await confirmCancelTask(row.taskName);
    const response = await cancelTask(row.taskId);
    if (response?.success === false) {
      ElMessage.warning(response?.message || "取消失败");
      loadTaskHistory();
      return;
    }

    ElMessage.success(response?.message || "任务已取消");
    loadTaskHistory();
  } catch (error) {
    if (!isDialogDismissed(error)) {
      ElMessage.error(getErrorMessage(error, "取消任务失败"));
    }
  } finally {
    if (historyCancelingTaskId.value === row.taskId) {
      historyCancelingTaskId.value = null;
    }
  }
};

const formatDate = (timestamp: string | null) => {
  if (!timestamp) return "--";
  const date = new Date(timestamp);
  return `${date.toLocaleDateString("zh-CN")} ${date.toLocaleTimeString(
    "zh-CN",
    { hour: "2-digit", minute: "2-digit" }
  )}`;
};

// 删除任务
const handleDeleteTask = async (row: TaskHistoryItem) => {
  if (!isTaskDeletable(row.status)) {
    ElMessage.warning("仅支持删除已完成、失败或已取消的任务");
    return;
  }

  try {
    await ElMessageBox.confirm("确定删除该任务吗？", "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });

    const response = await deleteTask(row.taskId);
    if (response.success) {
      ElMessage.success("任务删除成功");
      addLog(`任务已删除: ${row.taskId}`);
      const targetPage =
        taskHistory.value.length === 1 && historyCurrentPage.value > 1
          ? historyCurrentPage.value - 1
          : historyCurrentPage.value;
      historyCurrentPage.value = targetPage;
      loadTaskHistory({
        page: targetPage,
      });
    } else {
      ElMessage.error(response.message || "删除任务失败");
      addLog(`删除任务失败: ${response.message}`);
    }
  } catch (error) {
    // 用户取消删除或删除失败
    if (error !== "cancel") {
      ElMessage.error(getErrorMessage(error, "删除任务失败"));
      addLog(`删除任务失败: ${getErrorMessage(error, "未知错误")}`);
    }
  }
};

const handleDeleteAllTasks = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除全部 ${historyTotal.value} 条数字分割任务历史吗？此操作不可恢复。`,
      "删除全部任务",
      {
        confirmButtonText: "确定删除",
        cancelButtonText: "取消",
        type: "warning",
      }
    );
    const response = await deleteTasksByFilter(getHistoryDeleteFilters());
    if (response.success) {
      ElMessage.success(
        getDeleteAllResultMessage(
          response.deletedCount,
          response.skippedNonTerminalCount
        )
      );
      historyCurrentPage.value = 1;
      loadTaskHistory({ page: 1 });
    } else {
      ElMessage.error(response.message || "删除全部任务失败");
    }
  } catch (error) {
    if (error !== "cancel") {
      ElMessage.error(getErrorMessage(error, "删除全部任务失败"));
    }
  }
};

// 查看任务详情
const handleViewTaskDetail = async (row: TaskHistoryItem) => {
  const requestId = taskDetailRequestGuard.begin();
  try {
    selectedTask.value = row;
    taskDetailResults.value = null;
    taskDetailInput.value = null;
    detailDialogVisible.value = true;

    // 如果任务已完成，获取详细结果
    if (row.status === "completed") {
      const taskDetail = await getTaskDetail(row.taskId);
      if (
        !taskDetailRequestGuard.isLatest(requestId) ||
        selectedTask.value?.taskId !== row.taskId
      ) return;
      taskDetailResults.value = taskDetail.results || null;
      taskDetailInput.value = taskDetail.input;
    } else {
      taskDetailResults.value = null;
    }
  } catch (error) {
    if (!taskDetailRequestGuard.isLatest(requestId)) return;
    addLog("获取任务详情失败: " + getErrorMessage(error, "未知错误"));
    ElMessage.error(getErrorMessage(error, "获取任务详情失败"));
  }
};

const handleTaskDetailClosed = () => {
  taskDetailRequestGuard.invalidate();
  selectedTask.value = null;
  taskDetailResults.value = null;
  taskDetailInput.value = null;
};

// 导出任务详情
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

// 初始化
// 异步加载任务历史
loadTaskHistory();

onBeforeUnmount(() => {
  solveScope.invalidate();
  taskHistoryRequestGuard.invalidate();
  taskDetailRequestGuard.invalidate();
});
</script>

<style scoped>
.main-card {
  background: #ffffff;
  border-radius: 20px;
  border: 1px solid #e6eaf5;
  box-shadow: 0 10px 20px rgba(9, 30, 66, 0.04);
}

.card-content {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 32px;
}

.controls-top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.controls-row {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.control-item {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.ctrl-label {
  white-space: nowrap;
  color: #8c8fa3;
  font-size: 14px;
  flex-shrink: 0;
}

.solve-type-group {
  display: flex;
  gap: 12px;
}

.solve-type-group :deep(.el-radio-button__inner) {
  border: 1px solid #dcdfe6;
}

.solve-type-group
  :deep(.el-radio-button:not(.is-active) .el-radio-button__inner) {
  background: #ffffff;
  border-color: #dcdfe6;
}

.label {
  color: #8c8fa3;
  font-size: 14px;
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

.solve-area {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.solve-area .solve-btn {
  width: 120px;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
}

.solve-area :deep(.el-button) {
  height: 48px;
}

.solve-state {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #f6f7fa;
  border-radius: 12px;
  margin-bottom: 12px;
}

.state-icon {
  width: 16px;
  height: 16px;
  border-radius: 50%;
}

.status-idle {
  background: #8c8fa3;
}

.status-running {
  background: #f88818;
  animation: pulse 1.5s infinite;
}

.status-success {
  background: #40c878;
}

.status-fail {
  background: #e57550;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.state-text {
  font-weight: 500;
  color: #292929;
}

.solve-time {
  color: #8c8fa3;
  font-size: 14px;
  margin-bottom: 20px;
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
  background: #f6f7fa;
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
  color: #40c878;
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

.input-card,
.result-card,
.log-card,
.candidates-result-card {
  margin-bottom: 20px;
}

.candidates-placeholder {
  color: #8c8fa3;
  font-size: 14px;
}

.candidates-list-main {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.candidate-item-main {
  background: #f6f7fa;
  border-radius: 8px;
  padding: 12px;
}

.candidate-header-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.candidate-rank-main {
  font-weight: 500;
  color: #4050f8;
  font-size: 14px;
}

.candidate-value-main {
  color: #4050f8;
  font-weight: 600;
  font-size: 14px;
}

.candidate-solution-main {
  display: flex;
  gap: 8px;
  font-size: 12px;
}

.solution-label-main {
  color: #8c8fa3;
  flex-shrink: 0;
}

.solution-value-main {
  color: #666;
  word-break: break-all;
  font-family: "Courier New", monospace;
  padding: 2px 6px;
  border-radius: 4px;
}

/* 任务历史列表 */
.history-card {
  margin-top: 20px;
  background: #ffffff;
  border-radius: 20px;
  border: 1px solid #e6eaf5;
  box-shadow: 0 10px 20px rgba(9, 30, 66, 0.04);
}
.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.history-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.history-header h3 {
  margin: 0;
  color: #292929;
  font-weight: 600;
}
.history-table {
  width: 100%;
}
.task-name-link {
  display: inline-block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #409eff;
}
.task-name-link:hover,
.task-name-link:focus {
  color: #409eff;
}
.history-pagination {
  display: flex;
  justify-content: center;
  padding: 20px 0 0;
}

/* 任务详情对话框样式 */
.task-detail {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-section {
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
  color: #4050f8;
  font-weight: 600;
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
