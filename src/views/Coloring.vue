<template>
  <div class="coloring-page">
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
          <!-- 图结构设置 -->
          <div class="controls-row">
            <div class="control-item">
              <span class="ctrl-label">节点数量：</span>
              <el-input-number
                v-model="nodeCount"
                :min="3"
                :max="24"
                :disabled="solving"
                style="width: 130px"
              />
            </div>
            <div class="control-item">
              <span class="ctrl-label">图类型：</span>
              <el-select
                v-model="graphType"
                :disabled="solving"
                @change="generateGraph"
                style="width: 120px"
              >
                <el-option label="随机图" value="random" />
                <el-option label="完全图" value="complete" />
                <el-option label="环图" value="cycle" />
                <el-option label="星图" value="star" />
                <el-option label="网格图" value="grid" />
              </el-select>
            </div>
            <div class="control-item" v-if="graphType === 'random'">
              <span class="ctrl-label">边密度：</span>
              <el-slider
                v-model="edgeDensity"
                :min="0.1"
                :max="0.8"
                :step="0.1"
                :disabled="solving"
                @change="generateGraph"
                style="width: 120px"
              />
              <span class="ctrl-label">{{ edgeDensity }}</span>
            </div>
          </div>

          <!-- 邻接矩阵 -->
          <el-card class="matrix-card">
            <template #header>
              <div class="matrix-header">
                <span>邻接矩阵</span>
                <div class="matrix-actions">
                  <el-button
                    :type="matrixMode === 'custom' ? 'primary' : ''"
                    :disabled="solving"
                    @click="setMatrixMode('custom')"
                    >自定义</el-button
                  >
                  <el-button
                    :type="matrixMode === 'random' ? 'primary' : ''"
                    :disabled="solving"
                    @click="
                      setMatrixMode('random');
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
              <div
                v-for="(row, i) in adjacencyMatrix"
                :key="i"
                class="matrix-row"
              >
                <div
                  v-for="(cell, j) in row"
                  :key="j"
                  class="matrix-cell"
                  :class="{
                    editable:
                      !solving &&
                      (matrixMode === 'custom' || matrixMode === 'random') &&
                      i !== j,
                  }"
                  @click="toggleMatrixCell(i, j)"
                >
                  {{ cell }}
                </div>
              </div>
            </div>
            <div class="tip">
              点击单元格切换边关系（对称），会覆盖当前图结构
            </div>
          </el-card>

          <!-- 图形可视化 -->
          <div class="graph-visualization">
            <ColoringGraph
              :nodes="nodes"
              :edges="edges"
              :coloring="coloring"
              :colors="availableColors"
              :editable="!solving"
              :selected-nodes="selectedNodes"
              @node-click="onGraphNodeClick"
              @node-color="handleNodeColor"
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
              @click="submitSolve"
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
            <div class="state-icon" :class="statusClass"></div>
            <div class="state-text">{{ statusText }}</div>
          </div>

          <div class="solve-time">求解时间：{{ solveTime }}</div>

          <!-- 统计信息 -->
          <el-card class="stats-card">
            <template #header>
              <span>统计信息</span>
            </template>

            <div class="stats-content">
              <div class="stat-item">
                <span class="label">节点数：</span>
                <span class="value">{{ nodeCount }}</span>
              </div>
              <div class="stat-item">
                <span class="label">边数：</span>
                <span class="value">{{ edges.length }}</span>
              </div>
              <div class="stat-item">
                <span class="label">使用颜色：</span>
                <span class="value">{{ usedColors }}</span>
              </div>
              <div class="stat-item">
                <span class="label">冲突数：</span>
                <span class="value">{{ conflicts }}</span>
              </div>
            </div>
          </el-card>

          <!-- 操作日志 -->
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

          <!-- 保留候选结果位 -->
          <el-card class="candidates-card">
            <template #header>
              <div class="result-header">
                <span>候选结果</span>
                <el-button
                  :disabled="solveCandidates.length === 0"
                  @click="exportResults"
                  >结果导出</el-button
                >
              </div>
            </template>
            <div
              v-if="solveCandidates.length === 0"
              class="candidates-placeholder"
            >
              --
            </div>
            <div v-else class="candidates-list">
              <div
                v-for="(candidate, index) in solveCandidates"
                :key="index"
                class="candidate-item"
              >
                <div class="candidate-header">
                  <span class="candidate-rank"
                    >候选解 {{ candidate.rank ?? index + 1 }}</span
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
        <el-table-column prop="usedColors" label="使用颜色" min-width="100">
          <template #default="{ row }">
            {{ row.usedColors ?? "--" }}
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
              <span class="detail-value">图着色问题</span>
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
              <span class="detail-label">使用颜色数：</span>
              <span class="detail-value highlight">{{
                selectedTask.usedColors || "--"
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
import { ref, computed, watch, onBeforeUnmount } from "vue";
import {
  submitTask,
  getTaskStatus,
  getTaskDetail,
  cancelTask as cancelTaskAPI,
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
import ColoringGraph from "../components/ColoringGraph.vue";
import { useCustomTaskName } from "../stores/customTaskName";
import { formatCandidateValue, formatSolveTime } from "../utils/format";
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
  GraphEdge,
  GraphNode,
  ModelType,
  TaskCandidate,
  TaskDeleteFilters,
  TaskHistoryItem,
  TaskHistoryParams,
  TaskResults,
  TaskStatus,
  TaskSubmitRequest,
} from "../types/api";
type TagType = "success" | "primary" | "warning" | "info" | "danger";
type ColoringExportContext = {
  taskInfo: TaskResultExportInfo;
  nodeCount: number;
  adjacencyMatrix: number[][];
};

const { customTaskName, clearCustomTaskName } = useCustomTaskName();

// 响应式数据
const nodeCount = ref(8);
const graphType = ref("random");
const edgeDensity = ref(0.3);
const statusClass = ref("status-idle");
const statusText = ref("等待求解");
const conflicts = ref("--");
const logs = ref([SOLVE_LOG_IDLE_MESSAGE]);
const { addLog, resetSolveLogs, addTaskProgressLog } =
  createSolveLogController(logs);

const nodes = ref<GraphNode[]>([]);
const edges = ref<GraphEdge[]>([]);
const coloring = ref<Record<number, number>>({});

// 邻接矩阵数据与模式
const matrixMode = ref("custom");
const adjacencyMatrix = ref<number[][]>([]);
const importUpload = ref<UploadInstance>();
const importing = ref(false);
let skipNextNodeCountRebuild = false;

// 颜色定义
const availableColors = [
  "#D7263D",
  "#1B66D2",
  "#2E9F45",
  "#7E2F8E",
  "#F28C28",
  "#00A6A6",
  "#6B4E16",
  "#C2185B",
  "#111827",
  "#9E6A03",
  "#005F73",
  "#5B21B6",
  "#B91C1C",
  "#047857",
  "#1D4ED8",
  "#BE123C",
  "#4D7C0F",
  "#A16207",
  "#0F766E",
  "#6D28D9",
  "#C2410C",
  "#0369A1",
  "#86198F",
  "#374151",
];

// 两点选中以建边/取消边
const selectedNodes = ref<number[]>([]);

// 求解相关
const solveType = ref<ModelType>("classic");
const solving = ref(false);
const solveTime = ref("--");
const currentTaskId = ref<string | null>(null);
const solveCandidates = ref<TaskCandidate[]>([]);
const solveTaskResults = ref<TaskResults | null>(null);
const resultExportContext = ref<ColoringExportContext | null>(null);
const solveScope = createAsyncScope();

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

// 计算属性
const usedColors = computed(() => {
  const colorValues = Object.values(coloring.value);
  return colorValues.length > 0 ? new Set(colorValues).size : "--";
});

const maxDegree = computed(() => {
  if (nodes.value.length === 0) return 0;
  const degrees = Array(nodeCount.value).fill(0);
  edges.value.forEach((edge) => {
    degrees[edge.source]++;
    degrees[edge.target]++;
  });
  return Math.max(...degrees);
});

const normalizeColoringSolution = (
  solution: unknown,
  size: number,
): { coloringMap: Record<number, number>; usedColorsCount: number } => {
  if (!Array.isArray(solution)) {
    return { coloringMap: {}, usedColorsCount: 0 };
  }

  const vector: number[] = isColorVector(solution, size)
    ? solution.map(Number)
    : extractVectorFromOneHotSolution(solution, size);

  const colorValues = vector.slice(0, size).map(Number);
  const uniqueColors = Array.from(
    new Set(colorValues.filter((value) => Number.isFinite(value)))
  ).sort((a, b) => a - b);
  const colorToPaletteIndex = new Map(
    uniqueColors.map((colorValue, index) => [colorValue, index])
  );
  const coloringMap: Record<number, number> = {};

  colorValues.forEach((colorValue, index) => {
    if (Number.isFinite(colorValue)) {
      coloringMap[index] = colorToPaletteIndex.get(colorValue) ?? 0;
    }
  });

  return {
    coloringMap,
    usedColorsCount: uniqueColors.length,
  };
};

const isColorVector = (solution: unknown[], size: number): boolean =>
  solution.length === size &&
  solution.every((value) => !Array.isArray(value) && Number.isFinite(Number(value)));

const extractVectorFromOneHotSolution = (solution: unknown[], size: number): number[] => {
  if (
    solution.length === size &&
    solution.every((row) => Array.isArray(row))
  ) {
    return solution.map((row) =>
      row.findIndex((value) => Number(value) === 1)
    );
  }

  if (solution.length === size * size) {
    const vector = Array(size).fill(Number.NaN);
    solution.forEach((value, index) => {
      if (Number(value) === 1) {
        vector[Math.floor(index / size)] = index % size;
      }
    });
    return vector;
  }

  return solution.map(Number);
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

const GRAPH_WIDTH = 400;
const GRAPH_HEIGHT = 360;
const NODE_RADIUS = 12;
const NODE_MARGIN = NODE_RADIUS + 8;

const createCircleLayout = () =>
  Array.from({ length: nodeCount.value }, (_, i) => ({
    id: i,
    x: 200 + 150 * Math.cos((2 * Math.PI * i) / nodeCount.value),
    y: 180 + 150 * Math.sin((2 * Math.PI * i) / nodeCount.value),
  }));

const createRandomLayout = () => {
  const innerWidth = GRAPH_WIDTH - NODE_MARGIN * 2;
  const innerHeight = GRAPH_HEIGHT - NODE_MARGIN * 2;
  const columns = Math.max(
    1,
    Math.ceil(Math.sqrt((nodeCount.value * innerWidth) / innerHeight))
  );
  const rows = Math.ceil(nodeCount.value / columns);
  const cellWidth = innerWidth / columns;
  const cellHeight = innerHeight / rows;
  // 预留悬停放大到 18px 后与相邻节点及描边的安全距离。
  const minNodeGap = NODE_RADIUS * 2 + 10;
  const jitterX = Math.max(0, (cellWidth - minNodeGap) / 2);
  const jitterY = Math.max(0, (cellHeight - minNodeGap) / 2);
  const slots = Array.from({ length: nodeCount.value }, (_, index) => index);

  for (let index = slots.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [slots[index], slots[swapIndex]] = [slots[swapIndex], slots[index]];
  }

  // 与小程序一致：随机排序的网格加受限扰动，既随机又不重叠。
  return Array.from({ length: nodeCount.value }, (_, id) => {
    const slot = slots[id];
    const row = Math.floor(slot / columns);
    const col = slot % columns;
    return {
      id,
      x:
        NODE_MARGIN +
        (col + 0.5) * cellWidth +
        (Math.random() * 2 - 1) * jitterX,
      y:
        NODE_MARGIN +
        (row + 0.5) * cellHeight +
        (Math.random() * 2 - 1) * jitterY,
    };
  });
};

// 方法
const invalidateCurrentResult = () => {
  coloring.value = {};
  conflicts.value = "--";
  solveTime.value = "--";
  statusClass.value = "status-idle";
  statusText.value = "等待求解";
  currentTaskId.value = null;
  solveCandidates.value = [];
  solveTaskResults.value = null;
  resultExportContext.value = null;
};

const generateGraph = () => {
  if (solving.value) return;
  // 随机图同时随机拓扑和节点坐标；其他图保持稳定的规则布局。
  nodes.value =
    graphType.value === "random" ? createRandomLayout() : createCircleLayout();

  // 按图类型生成边
  edges.value = [];
  switch (graphType.value) {
    case "random":
      generateRandomGraph();
      break;
    case "complete":
      generateCompleteGraph();
      break;
    case "cycle":
      generateCycleGraph();
      break;
    case "star":
      generateStarGraph();
      break;
    case "grid":
      generateGridGraph();
      break;
  }

  // 同步邻接矩阵
  syncMatrixFromEdges();

  // 图结构变化后清理旧求解结果
  invalidateCurrentResult();
  selectedNodes.value = [];
  addLog(
    `生成${graphType.value}图，${nodeCount.value}个节点，${edges.value.length}条边`
  );
};

const generateRandomGraph = () => {
  for (let i = 0; i < nodeCount.value; i++) {
    for (let j = i + 1; j < nodeCount.value; j++) {
      if (Math.random() < edgeDensity.value) {
        edges.value.push({ source: i, target: j });
      }
    }
  }
};

const generateCompleteGraph = () => {
  for (let i = 0; i < nodeCount.value; i++) {
    for (let j = i + 1; j < nodeCount.value; j++) {
      edges.value.push({ source: i, target: j });
    }
  }
};

const generateCycleGraph = () => {
  for (let i = 0; i < nodeCount.value; i++) {
    edges.value.push({ source: i, target: (i + 1) % nodeCount.value });
  }
};

const generateStarGraph = () => {
  for (let i = 1; i < nodeCount.value; i++) {
    edges.value.push({ source: 0, target: i });
  }
};

const generateGridGraph = () => {
  const side = Math.ceil(Math.sqrt(nodeCount.value));
  nodes.value = Array.from({ length: nodeCount.value }, (_, i) => {
    const row = Math.floor(i / side);
    const col = i % side;
    return { id: i, x: 150 + col * 80, y: 150 + row * 80 };
  });
  for (let i = 0; i < nodeCount.value; i++) {
    const row = Math.floor(i / side);
    const col = i % side;
    if (col < side - 1 && i + 1 < nodeCount.value)
      edges.value.push({ source: i, target: i + 1 });
    if (row < side - 1 && i + side < nodeCount.value)
      edges.value.push({ source: i, target: i + side });
  }
};

// 两点点击建边/取消边
const onGraphNodeClick = (nodeId: number) => {
  if (solving.value) return;
  // 选中逻辑：切换选中
  if (selectedNodes.value.includes(nodeId)) {
    selectedNodes.value = selectedNodes.value.filter((id) => id !== nodeId);
  } else {
    if (selectedNodes.value.length < 2) {
      selectedNodes.value = [...selectedNodes.value, nodeId];
    } else {
      // 若已有两个，重置为当前
      selectedNodes.value = [nodeId];
    }
  }

  if (selectedNodes.value.length === 2) {
    const [a, b] = selectedNodes.value;
    toggleEdge(a, b);
    // 完成后清空选中，便于继续操作
    selectedNodes.value = [];
  }
};

const toggleEdge = (a: number, b: number) => {
  if (solving.value) return;
  if (a === b) return;
  const i = Math.min(a, b);
  const j = Math.max(a, b);
  const idx = edges.value.findIndex(
    (e) =>
      (e.source === i && e.target === j) || (e.source === j && e.target === i)
  );
  if (idx >= 0) {
    edges.value.splice(idx, 1);
    addLog(`移除边 (${i}, ${j})`);
  } else {
    edges.value.push({ source: i, target: j });
    addLog(`新增边 (${i}, ${j})`);
  }
  // 同步矩阵
  syncMatrixFromEdges();
  invalidateCurrentResult();
};

const _clearSelected = () => {
  selectedNodes.value = [];
};

const _clearEdges = () => {
  edges.value = [];
  syncMatrixFromEdges();
  invalidateCurrentResult();
  // validateColoring() // 移除前端冲突检测
  addLog("清空所有边");
};

// 矩阵 <-> 边 同步
const syncMatrixFromEdges = () => {
  const size = nodeCount.value;
  const m = Array(size)
    .fill(null)
    .map(() => Array(size).fill(0));
  for (const e of edges.value) {
    m[e.source][e.target] = 1;
    m[e.target][e.source] = 1;
  }
  adjacencyMatrix.value = m;
};

const syncEdgesFromMatrix = () => {
  const size = adjacencyMatrix.value.length;
  const newEdges: GraphEdge[] = [];
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      if (adjacencyMatrix.value[i][j] === 1)
        newEdges.push({ source: i, target: j });
    }
  }
  edges.value = newEdges;
};

// 邻接矩阵交互
const setMatrixMode = (mode: "custom" | "random") => {
  if (solving.value) return;
  matrixMode.value = mode;
  invalidateCurrentResult();
  addLog("切换矩阵模式，清除当前结果");
};

const generateRandomMatrix = () => {
  if (solving.value) return;
  const size = nodeCount.value;
  const newMatrix = Array(size)
    .fill(null)
    .map(() => Array(size).fill(0));
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      const connected = Math.random() > 0.6 ? 1 : 0;
      newMatrix[i][j] = connected;
      newMatrix[j][i] = connected;
    }
  }
  adjacencyMatrix.value = newMatrix;
  // 覆盖图结构
  syncEdgesFromMatrix();
  if (graphType.value === "random") {
    nodes.value = createRandomLayout();
  }
  invalidateCurrentResult();
  addLog("随机生成邻接矩阵并覆盖当前图结构");
};

const handleTemplateDownload = async () => {
  try {
    await downloadMatrixTemplate("coloring");
  } catch (error) {
    addLog(`模板下载失败：${getErrorMessage(error, "请稍后重试")}`);
  }
};

const clearImportFiles = () => importUpload.value?.clearFiles();

const handleFileImport = async ({ file }: UploadRequestOptions) => {
  if (solving.value || importing.value) {
    throw new Error("当前无法导入文件");
  }
  importing.value = true;
  try {
    const imported = await parseProblemImportFile("coloring", file);
    if (solving.value) {
      addLog("导入已取消：任务正在求解");
      return;
    }
    if (nodeCount.value !== imported.matrixSize) {
      skipNextNodeCountRebuild = true;
    }
    nodeCount.value = imported.matrixSize;
    adjacencyMatrix.value = imported.adjacencyMatrix;
    rebuildNodesLayout();
    syncEdgesFromMatrix();
    invalidateCurrentResult();
    addLog(
      `数据导入成功：${imported.matrixSize}×${imported.matrixSize}邻接矩阵，${edges.value.length}条边`,
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

const toggleMatrixCell = (i: number, j: number) => {
  if (solving.value) return;
  if (
    (matrixMode.value !== "custom" && matrixMode.value !== "random") ||
    i === j
  )
    return;
  const newValue = adjacencyMatrix.value[i][j] === 1 ? 0 : 1;
  adjacencyMatrix.value[i][j] = newValue;
  adjacencyMatrix.value[j][i] = newValue;
  syncEdgesFromMatrix();
  invalidateCurrentResult();
};

const rebuildNodesLayout = () => {
  nodes.value =
    graphType.value === "random" ? createRandomLayout() : createCircleLayout();
};

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
      `确定要删除全部 ${historyTotal.value} 条图着色任务历史吗？此操作不可恢复。`,
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
    addLog("获取任务详情失败: " + getErrorMessage(error, "未知错误"));
    ElMessage.error(getErrorMessage(error, "获取任务详情失败"));
  } finally {
    if (taskDetailRequestGuard.isLatest(requestId)) {
      taskDetailLoading.value = false;
    }
  }
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

// 导出当前求解结果
const exportResults = () => {
  const exportContext = resultExportContext.value;
  const taskResults = solveTaskResults.value;
  if (!exportContext || !taskResults || solveCandidates.value.length === 0) return;

  downloadTaskResultExport(
    exportContext.taskInfo,
    {
      nodeCount: exportContext.nodeCount,
      adjacencyMatrix: exportContext.adjacencyMatrix,
    },
    taskResults
  );
};

// 颜色交互（保留以便候选结果展示）
const handleNodeColor = (nodeId: number, colorIndex: number) => {
  coloring.value = { ...coloring.value, [nodeId]: colorIndex };
  // validateColoring() // 移除前端冲突检测
};

// 求解方法
const submitSolve = async () => {
  if (nodes.value.length === 0) {
    addLog("请先生成图结构");
    return;
  }

  const submittedNodeCount = nodeCount.value;
  const submittedAt = Date.now();
  const submittedTaskName = customTaskName.value || `Coloring_${submittedAt}`;
  resultExportContext.value = {
    taskInfo: {
      taskId: "",
      taskName: submittedTaskName,
      problemType: "coloring",
      modelType: solveType.value,
      matrixSize: submittedNodeCount,
      timestamp: new Date(submittedAt).toISOString(),
      status: "completed",
    },
    nodeCount: submittedNodeCount,
    adjacencyMatrix: adjacencyMatrix.value.map((row) => [...row]),
  };
  const solveToken = solveScope.begin();
  solving.value = true;
  statusClass.value = "status-idle";
  statusText.value = "求解中...";
  solveTime.value = "--";
  conflicts.value = "--";
  coloring.value = {};
  solveCandidates.value = [];
  solveTaskResults.value = null;
  currentTaskId.value = null;

  const startTime = Date.now();
  resetSolveLogs(
    `开始求解图着色问题（求解模型：${getModelTypeText(solveType.value)}，${nodeCount.value}个节点，${edges.value.length}条边）`
  );

  try {
    // 准备任务数据
    const taskData: TaskSubmitRequest = {
      taskName: submittedTaskName,
      modelType: solveType.value,
      problemType: "coloring",
      matrixSize: nodeCount.value,
      adjacencyMatrix: adjacencyMatrix.value,
    };

    addLog("提交任务中");

    // 提交任务到后端
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
        submittedNodeCount
      );
    } else {
      throw new Error(submitResponse.message || "任务提交失败");
    }
  } catch (error) {
    if (!solveScope.isCurrent(solveToken)) return;
    clearCustomTaskName();
    addLog(`求解失败: ${getErrorMessage(error, "求解失败")}`);
    ElMessage.error(getErrorMessage(error, "求解失败"));
    statusClass.value = "status-fail";
    statusText.value = "求解失败";
    solving.value = false;
  }
};

// 轮询任务状态
const pollTaskStatus = async (
  taskId: string,
  startTime: number,
  solveToken: number,
  submittedNodeCount: number
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

        solveTime.value = displaySolveTime;
        solving.value = false;

        // 解析后端返回的结果
        solveTaskResults.value = statusResponse.results || null;
        const resultCandidates = statusResponse.results?.candidates || [];
        solveCandidates.value = resultCandidates;
        if (resultCandidates.length > 0) {
          // 取第一个候选结果
          const bestResult = resultCandidates[0];

          const { coloringMap } = normalizeColoringSolution(
            bestResult.solution,
            submittedNodeCount
          );
          const unsatisfiedCount = Number(bestResult.unsatisfied_count);
          const conflictCount = Number.isFinite(unsatisfiedCount)
            ? unsatisfiedCount
            : "--";

          // 更新图着色
          coloring.value = coloringMap;
          conflicts.value = String(conflictCount);

          statusClass.value = "status-success";
          statusText.value = "求解成功";

          addLog("求解完成");
        } else {
          statusClass.value = "status-warning";
          statusText.value = "无候选解";
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

    const res = await cancelTaskAPI(taskId);
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

const handleTaskDetailClosed = () => {
  taskDetailRequestGuard.invalidate();
  selectedTask.value = null;
  taskDetailResults.value = null;
  taskDetailInput.value = null;
  taskDetailLoading.value = false;
};

// 经典算法求解 (示例)
const _solveClassic = async (graph: { nodes: GraphNode[]; edges: GraphEdge[] }) => {
  const n = graph.nodes.length;
  const m = graph.edges.length;
  const d = Array(n).fill(0);
  const adj = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  // 构建邻接矩阵
  graph.edges.forEach((edge) => {
    const u = edge.source;
    const v = edge.target;
    adj[u][v] = 1;
    adj[v][u] = 1;
    d[u]++;
    d[v]++;
  });

  // 尝试所有可能的颜色组合
  const totalCombinations = Math.pow(availableColors.length, n);
  let bestSolution: Record<number, number> = {};
  let bestConflicts = Infinity;

  for (let i = 0; i < totalCombinations; i++) {
    const currentSolution: Record<number, number> = {};
    let currentConflicts = 0;
    for (let j = 0; j < n; j++) {
      const colorIndex =
        (i / Math.pow(availableColors.length, j)) % availableColors.length;
      currentSolution[j] = colorIndex;
    }

    // 检查冲突
    for (let u = 0; u < n; u++) {
      for (let v = u + 1; v < n; v++) {
        if (adj[u][v] === 1 && currentSolution[u] === currentSolution[v]) {
          currentConflicts++;
        }
      }
    }

    if (currentConflicts < bestConflicts) {
      bestConflicts = currentConflicts;
      bestSolution = currentSolution;
    }
  }

  // 使用最佳解决方案
  // 计算统计信息（不能直接赋值给computed属性）
  const computedChromaticLowerBound = Math.max(
    maxDegree.value + 1,
    Math.ceil(Math.sqrt(nodeCount.value))
  );
  const computedMaxDegree = Math.max(...d);
  const computedGraphDensity = m / ((n * (n - 1)) / 2);

  return {
    solution: bestSolution,
    conflicts: bestConflicts,
    usedColors: new Set(Object.values(bestSolution)).size,
    chromaticLowerBound: computedChromaticLowerBound,
    maxDegree: computedMaxDegree,
    graphDensity: computedGraphDensity,
  };
};

// 清空颜色与状态
const _clearColoring = () => {
  invalidateCurrentResult();
  selectedNodes.value = [];
  addLog("清空结果/颜色");
};

// 监听节点数变化，重建矩阵
watch(nodeCount, () => {
  if (skipNextNodeCountRebuild) {
    skipNextNodeCountRebuild = false;
    return;
  }
  const size = nodeCount.value;
  adjacencyMatrix.value = Array(size)
    .fill(null)
    .map(() => Array(size).fill(0));
  generateGraph();
});

// 任务历史相关方法
const getHistoryDeleteFilters = (): TaskDeleteFilters => {
  const taskName = appliedHistoryTaskName.value.trim();
  return taskName
    ? { problemType: "coloring", taskName }
    : { problemType: "coloring" };
};

const loadTaskHistory = async (params: TaskHistoryParams = {}) => {
  const requestId = taskHistoryRequestGuard.begin();
  const requestTaskName = (params.taskName ?? appliedHistoryTaskName.value).trim();
  const requestParams: TaskHistoryParams = {
    problemType: "coloring",
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
    const response = await cancelTaskAPI(row.taskId);
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

// 初始化
generateGraph();
// 异步加载任务历史
loadTaskHistory();

onBeforeUnmount(() => {
  solveScope.invalidate();
  taskHistoryRequestGuard.invalidate();
  taskDetailRequestGuard.invalidate();
});
</script>

<style scoped>
/* MaxCut风格布局 */

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

/***** 矩阵样式 *****/
.matrix-card {
  margin: 16px 0px;
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
  width: 28px;
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
}

/***** 右侧图与操作 *****/
.graph-visualization {
  border: 1px solid #e6eaf5;
  border-radius: 12px;
  background: #fafbfc;
  margin-bottom: 20px;
  overflow: hidden;
}
.solve-info {
  display: flex;
  gap: 20px;
  color: #8c8fa3;
  font-size: 14px;
}

/***** 候选结果占位 *****/
.candidates-card {
  margin-top: 16px;
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

/***** 统计与日志 *****/
.stats-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}
.stat-item .label {
  color: #666;
  font-size: 14px;
}
.stat-item .value {
  font-weight: 600;
  color: #292929;
}
.log-card {
  margin-top: 16px;
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

/* MaxCut风格样式 */
.controls-top {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
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
.state-text {
  font-weight: 500;
  color: #292929;
}
.solve-time {
  color: #8c8fa3;
  font-size: 14px;
  margin-bottom: 20px;
}

.state-icon.status-idle {
  background: #8c8fa3;
}
.state-icon.status-success {
  background: #40c878;
}
.state-icon.status-warning {
  background: #ffa726;
}
.state-icon.status-fail {
  background: #e57550;
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
</style> 
