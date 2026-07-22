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
            <el-radio-group v-model="solveType" class="solve-type-group" :disabled="solving">
              <el-radio-button label="classic">经典计算</el-radio-button>
              <el-radio-button label="sim">量子芯片模拟计算</el-radio-button>
              <el-radio-button label="cloud">量子云服务计算</el-radio-button>
            </el-radio-group>
          </div>

          <!-- 规模控制 -->
          <div class="controls-row">
            <div class="control-item">
              <span class="ctrl-label">问题规模：</span>
              <el-input-number
                v-model="matrixSize"
                :min="2"
                :max="24"
                :disabled="solving"
                style="width: 130px"
                @change="generateMatrix"
              />
            </div>
          </div>

          <!-- 邻接矩阵 -->
          <el-card class="matrix-card">
            <template #header>
              <div class="matrix-header">
                <span>邻接矩阵</span>
                <div class="matrix-actions">
                  <el-button
                    :type="editMode === 'custom' ? 'primary' : ''"
                    :disabled="solving"
                    @click="setEditMode('custom')"
                    >自定义</el-button
                  >
                  <el-button
                    :type="editMode === 'random' ? 'primary' : ''"
                    :disabled="solving"
                    @click="
                      setEditMode('random');
                      generateRandomMatrix();
                    "
                    >随机生成</el-button
                  >
                  <el-upload
                    ref="importUpload"
                    action="#"
                    accept=".csv,.txt,text/csv,text/plain"
                    :limit="1"
                    :show-file-list="false"
                    :disabled="solving || importing"
                    :http-request="handleFileImport"
                    :on-success="clearImportFiles"
                    :on-error="clearImportFiles"
                  >
                    <el-button
                      :disabled="solving || importing"
                      :loading="importing"
                    >
                      {{ importing ? "解析中..." : "数据导入(txt/csv)" }}
                    </el-button>
                  </el-upload>
                  <el-button
                    :disabled="solving"
                    @click="handleTemplateDownload"
                    >下载模板</el-button
                  >
                </div>
              </div>
            </template>

            <div class="matrix-grid">
              <div v-for="(row, i) in matrix" :key="i" class="matrix-row">
                <div
                  v-for="(cell, j) in row"
                  :key="j"
                  class="matrix-cell"
                  :class="{ editable: !solving && i !== j }"
                  @click="toggleCell(i, j)"
                >
                  {{ formatMatrixCell(cell) }}
                </div>
              </div>
            </div>

            <div class="tip">
              矩阵与图同步；点矩阵改权重（0-30，1位小数），点两节点连/删边。
            </div>
          </el-card>

          <!-- 图形可视化 -->
          <div class="graph-container">
            <MaxCutGraph
              :nodes="nodes"
              :edges="edges"
              :partition="partition"
              :editable="!solving"
              :selected-nodes="selectedNodes"
              @node-click="onGraphNodeClick"
            />
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
              {{ solving ? "求解中..." : "求解" }}
            </el-button>
            <el-button
              :loading="
                currentTaskId !== null &&
                historyCancelingTaskId === currentTaskId
              "
              :disabled="!solving || historyCancelingTaskId !== null"
              @click="cancelSolve"
              >取消任务</el-button
            >
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
              <span>求解日志</span>
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
                <span>候选结果</span>
                <el-button
                  :disabled="candidates.length === 0"
                  @click="exportResults"
                  >结果导出</el-button
                >
              </div>
            </template>
            <div v-if="candidates.length === 0" class="candidates-placeholder">
              --
            </div>
            <div class="candidates">
              <div
                v-for="(candidate, index) in candidates"
                :key="index"
                class="candidate-item"
              >
                <div class="candidate-header">
                  <span class="candidate-rank">候选解 {{ index + 1 }}</span>
                  <span class="candidate-value"
                    >目标值：{{ formatCandidateValue(candidate.value) }}</span
                  >
                </div>
                <div class="candidate-solution">
                  <span class="solution-label">解向量：</span>
                  <span class="solution-value">{{
                    candidate.solution == null
                      ? "--"
                      : JSON.stringify(candidate.solution)
                  }}</span>
                </div>
              </div>
            </div>
          </el-card>
        </div>
      </div>
    </el-card>

    <!-- 任务历史列表 -->
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
          min-width="220"
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
      <div
        v-if="selectedTask"
        v-loading="taskDetailLoading"
        class="task-detail"
        element-loading-text="正在加载任务详情..."
      >
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
              <span class="detail-value">MaxCut 最大割问题</span>
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
                >{{ selectedTask.matrixSize }} 个节点</span
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

        <!-- 结果信息卡片 -->
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
            <div class="detail-row">
              <span class="detail-label">求解时间：</span>
              <span class="detail-value">{{
                taskDetailResults.runtime
                  ? taskDetailResults.runtime.toFixed(2) + "s"
                  : selectedTask.solveTime || "--"
              }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">最优目标值：</span>
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
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import {
  submitTask,
  getTaskStatus,
  getTaskDetail,
  cancelTask,
  getTaskHistory,
  deleteTask,
  deleteTasksByFilter,
  parseProblemImportFile,
} from "../api";
import {
  ElMessage,
  ElMessageBox,
  type UploadInstance,
  type UploadRequestOptions,
} from "element-plus";
import MaxCutGraph from "../components/MaxCutGraph.vue";
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
import { downloadMatrixTemplate } from "../utils/dataImport";
import {
  downloadTaskResultExport,
  type TaskResultExportInfo,
} from "../utils/resultExport";
import type {
  ModelType,
  TaskCandidate,
  TaskDeleteFilters,
  TaskHistoryItem,
  TaskHistoryParams,
  TaskResults,
  TaskStatus,
  TaskSubmitRequest,
  WeightedGraphEdge,
  GraphNode,
} from "../types/api";
type TagType = "success" | "primary" | "warning" | "info" | "danger";
type MaxCutExportContext = {
  taskInfo: TaskResultExportInfo;
  matrix: number[][];
};

const { customTaskName, clearCustomTaskName } = useCustomTaskName();

// 响应式数据
const solveType = ref<ModelType>("classic");
const matrixSize = ref(6);
const editMode = ref("custom");
const matrix = ref<number[][]>([]);
const solving = ref(false);
const stateClass = ref("state-idle");
const stateText = ref("等待求解");
const solveTime = ref("--");
const logs = ref([SOLVE_LOG_IDLE_MESSAGE]);
const { addLog, resetSolveLogs, addTaskProgressLog } =
  createSolveLogController(logs);
const candidates = ref<TaskCandidate[]>([]);
const solveTaskResults = ref<TaskResults | null>(null);
const resultExportContext = ref<MaxCutExportContext | null>(null);
const currentTaskId = ref<string | null>(null);
const solveScope = createAsyncScope();

const importUpload = ref<UploadInstance>();
const importing = ref(false);

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
const taskDetailLoading = ref(false);

// 图形可视化数据
const nodes = ref<GraphNode[]>([]);
const edges = ref<WeightedGraphEdge[]>([]);
const selectedNodes = ref<number[]>([]);
const partition = ref<Record<number, 0 | 1>>({});
const MAX_ADJACENCY_WEIGHT = 30;

// 计算属性
const edgeCount = computed(() => {
  let count = 0;
  for (let i = 0; i < matrix.value.length; i++) {
    for (let j = i + 1; j < matrix.value[i].length; j++) {
      if (Number(matrix.value[i][j]) !== 0) count++;
    }
  }
  return count;
});

const normalizeAdjacencyWeight = (value: unknown): number => Number(Number(value).toFixed(1));

const formatMatrixCell = (value: unknown): string => String(normalizeAdjacencyWeight(value));

const invalidateCurrentResult = () => {
  partition.value = {};
  candidates.value = [];
  solveTime.value = "--";
  stateClass.value = "state-idle";
  stateText.value = "等待求解";
  currentTaskId.value = null;
  solveTaskResults.value = null;
  resultExportContext.value = null;
};

// 初始化矩阵
const generateMatrix = () => {
  if (solving.value) return;
  const size = matrixSize.value;
  matrix.value = Array(size)
    .fill(null)
    .map(() => Array(size).fill(0));
  generateNodes();
  syncEdgesFromMatrix();
  invalidateCurrentResult();
};

// 生成节点布局
const generateNodes = () => {
  const size = matrixSize.value;
  nodes.value = Array.from({ length: size }, (_, i) => ({
    id: i,
    x: 200 + 150 * Math.cos((2 * Math.PI * i) / size),
    y: 180 + 150 * Math.sin((2 * Math.PI * i) / size),
  }));
};

// 生成随机矩阵
const generateRandomMatrix = () => {
  if (solving.value) return;
  const size = matrixSize.value;
  const newMatrix = Array(size)
    .fill(null)
    .map(() => Array(size).fill(0));

  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      const weight =
        Math.random() > 0.6
          ? normalizeAdjacencyWeight(
              (Math.floor(Math.random() * (MAX_ADJACENCY_WEIGHT * 10)) + 1) /
                10
            )
          : 0;
      newMatrix[i][j] = weight;
      newMatrix[j][i] = weight;
    }
  }

  matrix.value = newMatrix;
  syncEdgesFromMatrix();
  invalidateCurrentResult();
};

// 设置编辑模式
const setEditMode = (mode: "custom" | "random") => {
  if (solving.value) return;
  editMode.value = mode;
  invalidateCurrentResult();
  addLog("切换编辑模式，清除分区结果");
};

const setEdgeWeight = (i: number, j: number, weight: number) => {
  if (solving.value) return;
  if (i === j) return;
  const normalizedWeight = normalizeAdjacencyWeight(weight);
  matrix.value[i][j] = normalizedWeight;
  matrix.value[j][i] = normalizedWeight;
  syncEdgesFromMatrix();
  invalidateCurrentResult();
  addLog(`设置边 (${i}, ${j}) = ${normalizedWeight}`);
};

// 弹窗输入并校验边权重（0~MAX_ADJACENCY_WEIGHT，最多 1 位小数），返回有效数值或 null
const promptEdgeWeight = async (i: number, j: number, title = "编辑矩阵单元") => {
  const inputValue = String(formatMatrixCell(matrix.value[i][j]));
  const { value } = await ElMessageBox.prompt(
    `请输入边权重（0-${MAX_ADJACENCY_WEIGHT}，最多 1 位小数）`,
    title,
    {
      inputValue,
      inputPattern: /^(?:0|[1-9]\d*)(?:\.\d)?$/,
      inputErrorMessage: `请输入 0-${MAX_ADJACENCY_WEIGHT} 之间的数字，最多 1 位小数`,
      confirmButtonText: "确定",
      cancelButtonText: "取消",
    }
  ).catch(() => ({ value: null }));
  if (value === null || value === undefined) return null;

  const weight = Number(value);
  if (!Number.isFinite(weight) || weight < 0 || weight > MAX_ADJACENCY_WEIGHT) {
    ElMessage.warning(`请输入 0-${MAX_ADJACENCY_WEIGHT} 之间的数字`);
    return null;
  }
  if (Math.abs(weight * 10 - Math.round(weight * 10)) > 1e-8) {
    ElMessage.warning("最多保留 1 位小数");
    return null;
  }

  return weight;
};

// 邻接矩阵交互：弹窗编辑边权重
const toggleCell = async (i: number, j: number) => {
  if (solving.value) return;
  if (i === j) return;
  const weight = await promptEdgeWeight(i, j, "编辑矩阵单元");
  if (weight !== null) {
    setEdgeWeight(i, j, weight);
  }
};

// 从邻接矩阵同步边
const syncEdgesFromMatrix = () => {
  const size = matrixSize.value;
  const newEdges: WeightedGraphEdge[] = [];
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      const weight = Number(matrix.value[i]?.[j]);
      if (Number.isFinite(weight) && weight !== 0) {
        newEdges.push({ source: i, target: j, weight });
      }
    }
  }
  edges.value = newEdges;
};

const applyTerminalTaskStatus = (taskStatus: TaskStatus) => {
  if (taskStatus === "completed") {
    stateClass.value = "state-success";
    stateText.value = "求解成功";
  } else if (taskStatus === "cancelled") {
    stateClass.value = "state-fail";
    stateText.value = "已取消";
  } else if (taskStatus === "failed") {
    stateClass.value = "state-fail";
    stateText.value = "求解失败";
  }
};

// 节点点击事件处理
const onGraphNodeClick = (nodeId: number) => {
  if (solving.value) return;
  if (selectedNodes.value.includes(nodeId)) {
    selectedNodes.value = selectedNodes.value.filter((id) => id !== nodeId);
  } else {
    if (selectedNodes.value.length < 2) {
      selectedNodes.value = [...selectedNodes.value, nodeId];
    } else {
      selectedNodes.value = [nodeId];
    }
  }

  if (selectedNodes.value.length === 2) {
    const [a, b] = selectedNodes.value;
    selectedNodes.value = [];
    openEdgeDialog(a, b);
  }
};

// 弹窗编辑边权重（从图节点点击触发）
const openEdgeDialog = async (a: number, b: number) => {
  if (a === b) return;
  const i = Math.min(a, b);
  const j = Math.max(a, b);
  const weight = await promptEdgeWeight(i, j, "编辑边权重");
  if (weight !== null) {
    setEdgeWeight(i, j, weight);
    if (weight === 0) {
      addLog(`删除边 (${i}, ${j})（权重设为 0）`);
    }
  }
};

const handleTemplateDownload = async () => {
  try {
    await downloadMatrixTemplate("maxcut");
  } catch (error) {
    addLog(`模板下载失败：${getErrorMessage(error, "请稍后重试")}`);
  }
};

const clearImportFiles = () => importUpload.value?.clearFiles();

// 文件内容由后端解析；返回 Promise 交给 el-upload 管理成功/失败状态。
const handleFileImport = async ({ file }: UploadRequestOptions) => {
  if (solving.value || importing.value) {
    throw new Error("当前无法导入文件");
  }
  importing.value = true;
  try {
    const imported = await parseProblemImportFile("maxcut", file);
    if (solving.value) {
      addLog("导入已取消：任务正在求解");
      return;
    }
    matrixSize.value = imported.matrixSize;
    matrix.value = imported.adjacencyMatrix;
    generateNodes();
    syncEdgesFromMatrix();
    invalidateCurrentResult();
    addLog(
      `数据导入成功：${imported.matrixSize}×${imported.matrixSize}邻接矩阵，${edgeCount.value}条边`,
    );
  } catch (error) {
    const message = getErrorMessage(error, "请稍后重试");
    addLog(`导入失败：${message}`);
    ElMessage.error(`导入失败：${message}`);
    throw error instanceof Error ? error : new Error("导入失败");
  } finally {
    importing.value = false;
  }
};

// 开始求解
const startSolve = async () => {
  const submittedAt = Date.now();
  const submittedTaskName = customTaskName.value || `MaxCut_${submittedAt}`;
  resultExportContext.value = {
    taskInfo: {
      taskId: "",
      taskName: submittedTaskName,
      problemType: "maxcut",
      modelType: solveType.value,
      matrixSize: matrixSize.value,
      timestamp: new Date(submittedAt).toISOString(),
      status: "completed",
    },
    matrix: matrix.value.map((row) => [...row]),
  };
  const solveToken = solveScope.begin();
  solving.value = true;
  stateClass.value = "state-running";
  solveTime.value = "--";
  candidates.value = [];
  solveTaskResults.value = null;
  partition.value = {};
  currentTaskId.value = null;
  stateText.value = "求解中";

  const startTime = Date.now();
  resetSolveLogs(
    `开始求解图分割问题（求解模型：${getModelTypeText(solveType.value)}，${matrixSize.value}个节点，${edgeCount.value}条边）`
  );

  try {
    // 准备任务数据
    const taskData: TaskSubmitRequest = {
      taskName: submittedTaskName,
      modelType: solveType.value,
      problemType: "maxcut",
      matrixSize: matrixSize.value,
      adjacencyMatrix: matrix.value,
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
      await pollTaskStatus(submitResponse.taskId, startTime, solveToken);
    } else {
      throw new Error(submitResponse.message || "任务提交失败");
    }
  } catch (error) {
    if (!solveScope.isCurrent(solveToken)) return;
    clearCustomTaskName();
    stateClass.value = "state-fail";
    stateText.value = "求解失败";
    addLog("求解失败: " + getErrorMessage(error, "求解失败"));
    ElMessage.error(getErrorMessage(error, "求解失败"));
    solving.value = false;
  }
};

// 轮询任务状态
const pollTaskStatus = async (taskId: string, startTime: number, solveToken: number) => {
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

        stateClass.value = "state-success";
        stateText.value = "求解成功";
        solveTime.value = displaySolveTime;
        solving.value = false;

        // 修复：后端返回的是 results.candidates 数组
        solveTaskResults.value = statusResponse.results || null;
        const resultCandidates = statusResponse.results?.candidates || [];
        if (resultCandidates.length > 0) {
          candidates.value = resultCandidates;
          // 更新图形分区显示 - 将解向量转换为两种颜色的分区
          if (Array.isArray(resultCandidates[0].solution)) {
            const solution = resultCandidates[0].solution;
            const newPartition: Record<number, 0 | 1> = {};

            // 后端可能返回 1/-1 或 0/1，统一转换为 0/1
            solution.forEach((value, index) => {
              // 如果值是 -1，转换为 0；如果是 1，保持为 1
              // 如果已经是 0/1，直接使用
              if (value === -1 || value === 0) {
                newPartition[index] = 0; // 第一个分区（红色）
              } else if (value === 1) {
                newPartition[index] = 1; // 第二个分区（蓝绿色）
              }
            });

            partition.value = newPartition;
          }
        }

        addLog(
          resultCandidates.length > 0
            ? "求解完成"
            : "求解完成，但未返回候选解"
        );
        loadTaskHistory();
      } else if (
        statusResponse.state === "failed" ||
        statusResponse.state === "cancelled"
      ) {
        // 任务失败或取消
        stateClass.value = "state-fail";
        stateText.value =
          statusResponse.state === "cancelled" ? "已取消" : "求解失败";
        solving.value = false;
        addLog(
          statusResponse.state === "cancelled"
            ? "任务已取消"
            : `求解失败：${statusResponse.message || "任务失败"}`
        );
        loadTaskHistory();
      } else if (statusResponse.state === "processing") {
        stateText.value = "计算中...";
        addTaskProgressLog("processing");
        solveScope.schedule(solveToken, poll, pollInterval);
      } else if (statusResponse.state === "queued") {
        stateText.value = `计算中${
          statusResponse.queuePosition
            ? `(队列第${statusResponse.queuePosition}位)`
            : ""
        }`;
        addTaskProgressLog("queued", statusResponse.queuePosition);
        solveScope.schedule(solveToken, poll, pollInterval);
      }
    } catch (error) {
      if (!solveScope.isCurrent(solveToken)) return;
      stateClass.value = "state-fail";
      stateText.value = "连接失败";
      solving.value = false;
      addLog("无法获取任务状态: " + getErrorMessage(error, "未知错误"));
      loadTaskHistory();
    }
  };

  // 开始轮询
  solveScope.schedule(solveToken, poll, pollInterval);
};

// 取消求解
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
          stateClass.value = "state-running";
          stateText.value = "正在获取结果";
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
    stateClass.value = "state-fail";
    stateText.value = "已取消";
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

// 导出结果
const exportResults = () => {
  const exportContext = resultExportContext.value;
  const taskResults = solveTaskResults.value;
  if (!exportContext || !taskResults || candidates.value.length === 0) return;

  downloadTaskResultExport(
    exportContext.taskInfo,
    {
      matrix: exportContext.matrix,
    },
    taskResults
  );
};

// 任务历史相关方法
const getHistoryDeleteFilters = (): TaskDeleteFilters => {
  const taskName = appliedHistoryTaskName.value.trim();
  return taskName ? { problemType: "maxcut", taskName } : { problemType: "maxcut" };
};

const loadTaskHistory = async (params: TaskHistoryParams = {}) => {
  const requestId = taskHistoryRequestGuard.begin();
  const requestTaskName = (params.taskName ?? appliedHistoryTaskName.value).trim();
  const requestParams: TaskHistoryParams = {
    problemType: "maxcut",
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
      `确定要删除全部 ${historyTotal.value} 条图分割任务历史吗？此操作不可恢复。`,
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
  selectedTask.value = row;
  taskDetailResults.value = null;
  taskDetailInput.value = null;
  taskDetailLoading.value = row.status === "completed";
  detailDialogVisible.value = true;
  try {
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
    addLog(`获取任务详情失败: ${getErrorMessage(error, "未知错误")}`);
    ElMessage.error(getErrorMessage(error, "获取任务详情失败"));
  } finally {
    if (taskDetailRequestGuard.isLatest(requestId)) {
      taskDetailLoading.value = false;
    }
  }
};

const handleTaskDetailClosed = () => {
  taskDetailRequestGuard.invalidate();
  selectedTask.value = null;
  taskDetailResults.value = null;
  taskDetailInput.value = null;
  taskDetailLoading.value = false;
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

onMounted(() => {
  generateMatrix();
  // 异步加载任务历史
  loadTaskHistory();
});

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

.matrix-card {
  margin: 16px 0;
}

.matrix-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.matrix-actions {
  display: flex;
  gap: 8px;
}

.matrix-grid {
  display: inline-block;
  border: 1px solid #e6eaf5;
  border-radius: 8px;
  overflow: hidden;
  margin-top: 12px;
}

.matrix-row {
  display: flex;
}

.matrix-cell {
  width: 36px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid #e6eaf5;
  border-bottom: 1px solid #e6eaf5;
  font-size: 12px;
  background: #fafbfc;
}

.matrix-cell.editable {
  cursor: pointer;
  background: #ffffff;
}

.matrix-cell.editable:hover {
  background: #f0f8ff;
}

.matrix-row:last-child .matrix-cell {
  border-bottom: none;
}

.matrix-cell:last-child {
  border-right: none;
}

.tip {
  color: #8c8fa3;
  font-size: 12px;
  margin-top: 8px;
  margin-bottom: 16px;
}

.graph-container {
  border: 1px solid #e6eaf5;
  border-radius: 8px;
  background: #fafbfc;
}

.graph-placeholder {
  text-align: center;
  color: #8c8fa3;
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

.state-idle {
  background: #8c8fa3;
}

.state-running {
  background: #f88818;
  animation: pulse 1.5s infinite;
}

.state-success {
  background: #40c878;
}

.state-fail {
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

.log-card,
.result-card {
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

.candidates-placeholder {
  color: #8c8fa3;
  font-size: 14px;
}

.candidates {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.label {
  color: #8c8fa3;
  font-size: 14px;
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

/* 任务详情弹窗样式 */
.task-detail {
  max-height: 70vh;
  overflow-y: auto;
}

.detail-section {
  margin-bottom: 16px;
  border-radius: 12px;
  border: 1px solid #e6eaf5;
}

.detail-section:last-child {
  margin-bottom: 0;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-title {
  font-weight: 600;
  color: #292929;
  font-size: 16px;
}

.detail-content {
  padding: 8px 0;
}

.detail-row {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f6f7fa;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  min-width: 120px;
  color: #8c8fa3;
  font-size: 14px;
  font-weight: 500;
}

.detail-value {
  color: #292929;
  font-size: 14px;
  word-break: break-all;
}

.detail-value.highlight {
  color: #4050f8;
  font-weight: 600;
  font-size: 16px;
}

/* 候选解列表样式 */
.candidates-list {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e6eaf5;
}

.candidates-header {
  font-weight: 600;
  color: #292929;
  margin-bottom: 12px;
  font-size: 15px;
}

.candidate-item {
  background: #f6f7fa;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
}

.candidate-item:last-child {
  margin-bottom: 0;
}

.candidate-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.candidate-rank {
  font-weight: 500;
  color: #292929;
  font-size: 14px;
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
  color: #8c8fa3;
  min-width: 60px;
  flex-shrink: 0;
}

.solution-value {
  color: #666;
  word-break: break-all;
  font-family: "Courier New", monospace;
  padding: 4px 8px;
  border-radius: 4px;
}
</style> 
