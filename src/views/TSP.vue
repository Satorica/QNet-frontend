<template>
  <div class="tsp-page">
    <el-card class="main-card">
      <div class="card-content">
        <!-- 左列：矩阵和图 -->
        <div class="left-column">
          <!-- 求解模型选择 -->
          <div class="controls-top">
            <span class="label">求解模型选择：</span>
            <el-radio-group v-model="solveType" class="solve-type-group">
              <el-radio-button label="classic">经典计算</el-radio-button>
              <el-radio-button label="sim">量子芯片模拟计算</el-radio-button>
              <el-radio-button label="cloud">量子云服务计算</el-radio-button>
            </el-radio-group>
          </div>
          <!-- 城市设置 -->
          <div class="controls-row">
            <div class="control-item">
              <span class="ctrl-label">城市数量：</span>
              <el-input-number
                v-model="cityCount"
                :min="3"
                :max="24"
                style="width: 130px"
                @change="generateCitiesAndMatrix"
              />
            </div>
          </div>

          <!-- 距离矩阵（可非负权重） -->
          <el-card class="matrix-card">
            <template #header>
              <div class="matrix-header">
                <span>距离矩阵</span>
                <div class="matrix-actions">
                  <el-button
                    :type="matrixMode === 'custom' ? 'primary' : ''"
                    @click="setMatrixMode('custom')"
                    >自定义</el-button
                  >
                  <el-button
                    :type="matrixMode === 'random' ? 'primary' : ''"
                    @click="
                      setMatrixMode('random');
                      generateRandomMatrix();
                    "
                    >随机生成</el-button
                  >
                  <el-button @click="triggerFileInput"
                    >数据导入(txt/csv)</el-button
                  >
                  <input
                    ref="fileInput"
                    type="file"
                    accept=".csv,.txt"
                    style="display: none"
                    @change="handleFileImport"
                  />
                </div>
              </div>
            </template>

            <div class="matrix-grid">
              <div
                v-for="(row, i) in distanceMatrix"
                :key="i"
                class="matrix-row"
              >
                <div
                  v-for="(cell, j) in row"
                  :key="j"
                  class="matrix-cell"
                  :class="{
                    editable:
                      (matrixMode === 'custom' || matrixMode === 'random') &&
                      i !== j,
                  }"
                  @click="toggleMatrixCell(i, j)"
                >
                  {{ cell }}
                </div>
              </div>
            </div>
            <div class="tip">点击单元格编辑距离，非对角线距离需 ≥ 0.1（对称）。</div>
          </el-card>

          <!-- TSP可视化 -->
          <div class="tsp-visualization">
            <TSPGraph
              :cities="cities"
              :route="currentRoute"
              :bestRoute="bestRoute"
              :editable="true"
              :selected-nodes="selectedNodes"
              :distance-matrix="distanceMatrix"
              @city-click="onCityClick"
              @city-move="handleCityMove"
              @route-change="handleRouteChange"
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
            <el-button @click="cancelSolve">取消任务</el-button>
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
                <span class="label">城市数：</span>
                <span class="value">{{ cityCount }}</span>
              </div>
              <div class="stat-item">
                <span class="label">边数（非零）：</span>
                <span class="value">{{ positiveEdgeCount }}</span>
              </div>
              <div class="stat-item">
                <span class="label">最短路径长度：</span>
                <span class="value">{{ firstCandidatePathLength }}</span>
              </div>
              <div class="stat-item">
                <span class="label">冲突数：</span>
                <span class="value">{{ firstCandidateConflictCount }}</span>
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

          <!-- 候选结果 -->
          <el-card class="candidates-card">
            <template #header>
              <span>候选结果</span>
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
                    >路径长度：{{ formatPathLength(candidate.value) }}</span
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
        <el-table-column prop="taskId" label="操作" width="190" align="center">
          <template #default="{ row }">
            <el-button
              type="primary"
              size="small"
              @click="handleViewTaskDetail(row)"
              >查看详情</el-button
            >
            <el-button
              type="danger"
              size="small"
              :disabled="!isTaskDeletable(row.status)"
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
              <span class="detail-value">旅行商问题 (TSP)</span>
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
                >{{ selectedTask.matrixSize }} 个城市</span
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
              <span class="detail-label">最短路径长度：</span>
              <span class="detail-value highlight">{{
                formatPathLength(selectedTask.bestValue)
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
                    >候选解 {{ candidate.rank || index + 1 }}</span
                  >
                  <span class="candidate-value"
                    >路径长度：{{ formatPathLength(candidate.value) }}</span
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
          >导出结果</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import TSPGraph from "../components/TSPGraph.vue";
import {
  submitTask,
  getTaskStatus,
  cancelTask,
  getTaskHistory,
  deleteTask,
  deleteTasksByFilter,
} from "../api/index.js";
import { ElMessage, ElMessageBox } from "element-plus";
import { useCustomTaskName } from "../stores/customTaskName.js";
import { formatBestValue, formatSolveTime } from "../utils/format.js";
import {
  createSolveLogController,
  SOLVE_LOG_IDLE_MESSAGE,
} from "../utils/solveLog.js";
import {
  getDeleteAllResultMessage,
  isTaskDeletable,
} from "../utils/task.js";

const { customTaskName, clearCustomTaskName } = useCustomTaskName();

// 响应式数据
const cityCount = ref(8);
const algorithm = ref("nearest");
const temperature = ref(500);
const solveType = ref("classic");
const solving = ref(false);
const statusClass = ref("status-idle");
const statusText = ref("等待求解");
const solveTime = ref("--");
const iterations = ref(0);
const logs = ref([SOLVE_LOG_IDLE_MESSAGE]);
const { addLog, resetSolveLogs, addTaskProgressLog } =
  createSolveLogController(logs);
const currentTaskId = ref(null);
const solveCandidates = ref([]);

const TSP_LAYOUT_CENTER_X = 380;
const TSP_LAYOUT_CENTER_Y = 190;
const TSP_LAYOUT_INITIAL_RADIUS_X = 164;
const TSP_LAYOUT_INITIAL_RADIUS_Y = 146;
const TSP_LAYOUT_MAX_WIDTH = 640;
const TSP_LAYOUT_MAX_HEIGHT = 330;
const TSP_LAYOUT_MAX_UPSCALE_X = 1.82;
const TSP_LAYOUT_MAX_UPSCALE_Y = 1.42;

// 任务历史
const taskHistory = ref([]);
const historyLoading = ref(false);
const historyTaskName = ref("");
const historyCurrentPage = ref(1);
const historyPageSize = ref(10);
const historyTotal = ref(0);
const appliedHistoryTaskName = ref("");

// 任务详情对话框
const detailDialogVisible = ref(false);
const selectedTask = ref(null);
const taskDetailResults = ref(null);

const cities = ref([]);
const currentRoute = ref([]);
const bestRoute = ref([]);

// 两点选择用于编辑边权
const selectedNodes = ref([]);

// 距离矩阵（允许非负数）
const distanceMatrix = ref([]);
const matrixMode = ref("custom");
const fileInput = ref(null);

// 计算属性
const currentDistance = computed(() => {
  if (currentRoute.value.length < 2) return 0;
  return calculateRouteDistance(currentRoute.value);
});

const bestDistance = computed(() => {
  if (bestRoute.value.length < 2) return 0;
  return calculateRouteDistance(bestRoute.value);
});

const _optimizationRatio = computed(() => {
  if (currentDistance.value === 0 || bestDistance.value === 0) return 0;
  return (
    ((currentDistance.value - bestDistance.value) / currentDistance.value) *
    100
  ).toFixed(1);
});

const positiveEdgeCount = computed(() => {
  const m = distanceMatrix.value;
  let count = 0;
  for (let i = 0; i < m.length; i++) {
    for (let j = i + 1; j < m.length; j++) {
      if ((m[i][j] ?? 0) > 0) count++;
    }
  }
  return count;
});

const firstCandidate = computed(() => solveCandidates.value[0] || null);

const formatPathLength = (value) => {
  if (value === null || value === undefined || value === "") return "--";
  const num = Number(value);
  if (!Number.isFinite(num)) return value;
  return num.toFixed(2);
};

const firstCandidatePathLength = computed(() =>
  formatPathLength(firstCandidate.value?.value)
);

const firstCandidateConflictCount = computed(() => {
  const count = firstCandidate.value?.unsatisfied_count;
  if (count === null || count === undefined || count === "") return "--";
  return count;
});

const isValidTspRoute = (route, n) => {
  if (!Array.isArray(route) || route.length !== n) return false;
  const seen = new Set();
  for (const node of route) {
    if (!Number.isInteger(node) || node < 0 || node >= n || seen.has(node)) {
      return false;
    }
    seen.add(node);
  }
  return true;
};

const normalizeTspRouteFromSolution = (solution, n) => {
  if (!Array.isArray(solution)) return [];

  const flatSolution = solution.flat ? solution.flat() : solution;
  const routeVector = flatSolution.map((node) => Number(node));
  if (isValidTspRoute(routeVector, n)) {
    return routeVector;
  }

  if (flatSolution.length !== n * n) return [];

  const route = [];
  for (let step = 0; step < n; step++) {
    for (let node = 0; node < n; node++) {
      const index = step * n + node;
      if (Number(flatSolution[index]) === 1) {
        route.push(node);
        break;
      }
    }
  }

  return isValidTspRoute(route, n) ? route : [];
};

// 方法
const generateCitiesAndMatrix = () => {
  const size = cityCount.value;
  distanceMatrix.value = createRandomDistanceMatrix(size);
  generateCities();
  layoutCitiesByDistanceMatrix();
  currentRoute.value = [];
  bestRoute.value = [];
  solveCandidates.value = [];
  resetSolveStatus();
  matrixMode.value = "random";
};

const generateCities = () => {
  cities.value = [];

  for (let i = 0; i < cityCount.value; i++) {
    const angle = (2 * Math.PI * i) / cityCount.value;
    cities.value.push({
      id: i,
      x: TSP_LAYOUT_CENTER_X + TSP_LAYOUT_INITIAL_RADIUS_X * Math.cos(angle),
      y: TSP_LAYOUT_CENTER_Y + TSP_LAYOUT_INITIAL_RADIUS_Y * Math.sin(angle),
      name: `城市${i}`,
    });
  }

  currentRoute.value = [];
  bestRoute.value = [];
  addLog(`生成${cityCount.value}个城市，按距离矩阵布局`);
};

const layoutCitiesByDistanceMatrix = (matrix = distanceMatrix.value) => {
  const n = cityCount.value;
  if (!Array.isArray(matrix) || matrix.length !== n || cities.value.length !== n) {
    return;
  }

  const edges = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const weight = Number(matrix[i]?.[j]);
      if (Number.isFinite(weight) && weight >= MIN_DISTANCE_WEIGHT) {
        edges.push({ i, j, weight });
      }
    }
  }
  if (edges.length === 0) return;

  const fitAndApplyCityPoints = (points) => {
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const fitScaleX = Math.min(
      TSP_LAYOUT_MAX_UPSCALE_X,
      TSP_LAYOUT_MAX_WIDTH / spanX
    );
    const fitScaleY = Math.min(
      TSP_LAYOUT_MAX_UPSCALE_Y,
      TSP_LAYOUT_MAX_HEIGHT / spanY
    );
    const layoutCenterX = (minX + maxX) / 2;
    const layoutCenterY = (minY + maxY) / 2;

    cities.value = cities.value.map((city, index) => ({
      ...city,
      x: Number(
        (
          TSP_LAYOUT_CENTER_X +
          (points[index].x - layoutCenterX) * fitScaleX
        ).toFixed(1)
      ),
      y: Number(
        (
          TSP_LAYOUT_CENTER_Y +
          (points[index].y - layoutCenterY) * fitScaleY
        ).toFixed(1)
      ),
    }));
  };

  if (n === 3) {
    const d01 = Number(matrix[0]?.[1]);
    const d02 = Number(matrix[0]?.[2]);
    const d12 = Number(matrix[1]?.[2]);
    if (d01 >= MIN_DISTANCE_WEIGHT && d02 >= MIN_DISTANCE_WEIGHT && d12 >= MIN_DISTANCE_WEIGHT) {
      const visualScale = 330 / Math.max(d01, d02, d12);
      const sides = [d01 * visualScale, d02 * visualScale, d12 * visualScale];
      const maxSideIndex = sides.indexOf(Math.max(...sides));
      const otherSideSum = sides.reduce((sum, side) => sum + side, 0) - sides[maxSideIndex];
      if (sides[maxSideIndex] >= otherSideSum) {
        sides[maxSideIndex] = otherSideSum * 0.9;
      }

      const [side01, side02, side12] = sides;
      const x2 = (side02 * side02 + side01 * side01 - side12 * side12) / (2 * side01);
      const y2 = Math.sqrt(Math.max(0, side02 * side02 - x2 * x2));

      fitAndApplyCityPoints([
        { x: 0, y: 0 },
        { x: side01, y: 0 },
        { x: x2, y: y2 },
      ]);
      return;
    }
  }

  const sortedWeights = edges.map((edge) => edge.weight).sort((a, b) => a - b);
  const minWeight = sortedWeights[0];
  const p95Index =
    sortedWeights.length < 20
      ? sortedWeights.length - 1
      : Math.ceil((sortedWeights.length - 1) * 0.95);
  const visualMaxWeight = Math.max(minWeight, sortedWeights[p95Index]);
  const minTargetDistance = 52;
  const maxTargetDistance = 560;
  const weightSpan = visualMaxWeight - minWeight;
  const normalizeWeight = (weight) => {
    if (weightSpan <= 0) return 0.5;
    const clampedWeight = Math.min(Math.max(weight, minWeight), visualMaxWeight);
    return Math.log1p(clampedWeight - minWeight) / Math.log1p(weightSpan);
  };
  const targetDistance = (weight) =>
    minTargetDistance + normalizeWeight(weight) * (maxTargetDistance - minTargetDistance);
  const constraintStrength = (weight) => {
    const normalized = normalizeWeight(weight);
    return 0.025 + Math.pow(1 - normalized, 1.8) * 0.06;
  };

  const points = Array.from({ length: n }, (_, index) => {
    const angle = (2 * Math.PI * index) / n - Math.PI / 2;
    return {
      x: TSP_LAYOUT_CENTER_X + TSP_LAYOUT_INITIAL_RADIUS_X * Math.cos(angle),
      y: TSP_LAYOUT_CENTER_Y + TSP_LAYOUT_INITIAL_RADIUS_Y * Math.sin(angle),
    };
  });

  for (let iteration = 0; iteration < 620; iteration++) {
    for (const edge of edges) {
      const from = points[edge.i];
      const to = points[edge.j];
      let dx = to.x - from.x;
      let dy = to.y - from.y;
      let distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < 0.1) {
        const angle = (((edge.i + 1) * 17 + (edge.j + 1) * 31) % 360) * Math.PI / 180;
        dx = Math.cos(angle);
        dy = Math.sin(angle);
        distance = 1;
      }

      const diff = distance - targetDistance(edge.weight);
      const force = Math.max(-9, Math.min(9, diff * constraintStrength(edge.weight)));
      const moveX = (dx / distance) * force * 0.5;
      const moveY = (dy / distance) * force * 0.5;
      from.x += moveX;
      from.y += moveY;
      to.x -= moveX;
      to.y -= moveY;
    }

    const avgX = points.reduce((sum, point) => sum + point.x, 0) / n;
    const avgY = points.reduce((sum, point) => sum + point.y, 0) / n;
    for (const point of points) {
      point.x += TSP_LAYOUT_CENTER_X - avgX;
      point.y += TSP_LAYOUT_CENTER_Y - avgY;
    }
  }

  fitAndApplyCityPoints(points);
};

// removed duplicate calculateRouteDistance (see distance-aware implementation below)

const _clearRoute = () => {
  currentRoute.value = [];
  bestRoute.value = [];
  addLog("清除所有路径");
};

const resetSolveStatus = () => {
  solveTime.value = "--";
  statusClass.value = "status-idle";
  statusText.value = "等待求解";
  currentTaskId.value = null;
};

const _startSolve = async () => {
  solving.value = true;
  statusClass.value = "status-running";
  statusText.value = "求解中";
  iterations.value = 0;

  const startTime = Date.now();
  addLog(`开始使用${algorithm.value}算法求解TSP`);

  try {
    // 执行求解算法
    const result = await executeTSPAlgorithm();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    currentRoute.value = result.route;
    bestRoute.value = result.route;
    iterations.value = result.iterations;

    statusClass.value = "status-success";
    statusText.value = "求解成功";
    solveTime.value = `${duration}s`;

    addLog("求解完成");
  } catch (error) {
    statusClass.value = "status-fail";
    statusText.value = "求解失败";
    addLog("求解失败：" + error.message);
  } finally {
    solving.value = false;
  }
};

const executeTSPAlgorithm = () => {
  return new Promise((resolve) => {
    let result;

    switch (algorithm.value) {
      case "nearest":
        result = nearestNeighborAlgorithm();
        break;
      case "greedy":
        result = greedyAlgorithm();
        break;
      case "annealing":
        result = simulatedAnnealingAlgorithm();
        break;
      default:
        result = nearestNeighborAlgorithm();
    }

    resolve(result);
  });
};

const nearestNeighborAlgorithm = () => {
  const unvisited = new Set(
    Array.from({ length: cityCount.value }, (_, i) => i)
  );
  const route = [];
  let current = 0; // 从第一个城市开始

  route.push(current);
  unvisited.delete(current);

  while (unvisited.size > 0) {
    let nearest = null;
    let nearestDistance = Infinity;

    for (const city of unvisited) {
      const distance = getDistance(current, city);
      if (distance < nearestDistance) {
        nearest = city;
        nearestDistance = distance;
      }
    }

    route.push(nearest);
    unvisited.delete(nearest);
    current = nearest;
  }

  return {
    route,
    iterations: cityCount.value,
  };
};

const greedyAlgorithm = () => {
  // 贪心算法：选择最短的边
  const edges = [];

  // 生成所有边
  for (let i = 0; i < cityCount.value; i++) {
    for (let j = i + 1; j < cityCount.value; j++) {
      edges.push({
        from: i,
        to: j,
        distance: getDistance(i, j),
      });
    }
  }

  // 按距离排序
  edges.sort((a, b) => a.distance - b.distance);

  // 使用贪心策略构建路径
  const route = nearestNeighborAlgorithm().route;

  return {
    route,
    iterations: edges.length,
  };
};

const simulatedAnnealingAlgorithm = () => {
  let currentRoute = [...currentRoute.value];
  let bestRoute = [...currentRoute];
  let currentTemp = temperature.value;
  let iterations = 0;
  const maxIterations = 1000;

  while (currentTemp > 1 && iterations < maxIterations) {
    const newRoute = [...currentRoute];

    // 随机交换两个城市
    const i = Math.floor(Math.random() * cityCount.value);
    const j = (Math.floor(Math.random() * cityCount.value)[
      (newRoute[i], newRoute[j])
    ] = [newRoute[j], newRoute[i]]);

    const currentDist = calculateRouteDistance(currentRoute);
    const newDist = calculateRouteDistance(newRoute);
    const bestDist = calculateRouteDistance(bestRoute);

    // 接受条件
    if (
      newDist < currentDist ||
      Math.random() < Math.exp(-(newDist - currentDist) / currentTemp)
    ) {
      currentRoute = newRoute;

      if (newDist < bestDist) {
        bestRoute = [...newRoute];
      }
    }

    currentTemp *= 0.995; // 降温
    iterations++;
  }

  return {
    route: bestRoute,
    iterations,
  };
};

// removed duplicate getDistance (use distanceBetween)

const _stepSolve = () => {
  if (currentRoute.value.length < 2) return;

  // 执行一次2-opt优化
  const route = [...currentRoute.value];
  let improved = false;

  for (let i = 0; i < route.length - 1; i++) {
    for (let j = i + 2; j < route.length; j++) {
      const newRoute = [...route];

      // 反转i+1到j之间的路径
      for (let k = 0; k <= j - i - 1; k++) {
        newRoute[i + 1 + k] = route[j - k];
      }

      if (calculateRouteDistance(newRoute) < calculateRouteDistance(route)) {
        currentRoute.value = newRoute;
        improved = true;
        addLog(`2-opt优化：交换段[${i + 1},${j}]，距离减少`);
        break;
      }
    }
    if (improved) break;
  }

  if (!improved) {
    addLog("2-opt优化：未找到更好的解");
  }
};

const _resetToWorst = () => {
  // 生成一个相对较差的路径（随机排列）
  const route = Array.from({ length: cityCount.value }, (_, i) => i);
  for (let i = route.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [route[i], route[j]] = [route[j], route[i]];
  }

  currentRoute.value = route;
  addLog("重置为随机路径");
};

const handleCityMove = (cityId, newX, newY) => {
  if (cities.value[cityId]) {
    cities.value[cityId].x = newX;
    cities.value[cityId].y = newY;
    addLog(`移动城市${cityId}到新位置`);
  }
};

const handleRouteChange = (newRoute) => {
  currentRoute.value = newRoute;
  addLog("手动修改路径");
};

const onCityClick = async (cityId) => {
  // 选中两点
  if (selectedNodes.value.includes(cityId)) {
    selectedNodes.value = selectedNodes.value.filter((id) => id !== cityId);
    return;
  }
  if (selectedNodes.value.length < 2) {
    selectedNodes.value = [...selectedNodes.value, cityId];
  } else {
    selectedNodes.value = [cityId];
  }

  if (selectedNodes.value.length === 2) {
    const [a, b] = selectedNodes.value;
    const { value } = await ElMessageBox.prompt(
      "请输入边长度（最小 0.1）",
      "设置边权",
      {
        inputValue: String(distanceMatrix.value[a][b] || MIN_DISTANCE_WEIGHT),
        inputPattern: /^(?:0\.[1-9]\d*|[1-9]\d*(?:\.\d+)?)$/,
        inputErrorMessage: "请输入不小于 0.1 的数字",
        confirmButtonText: "确定",
        cancelButtonText: "取消",
      }
    ).catch(() => ({ value: null }));
    if (value !== null && value !== undefined) {
      const w = parseFloat(value);
      setEdgeWeight(a, b, w);
    }
    selectedNodes.value = [];
  }
};

const setEdgeWeight = (i, j, w) => {
  if (i === j) return;
  const a = Math.min(i, j);
  const b = Math.max(i, j);
  const nextWeight = normalizeDistanceWeight(w);
  distanceMatrix.value[a][b] = nextWeight;
  distanceMatrix.value[b][a] = nextWeight;
  layoutCitiesByDistanceMatrix();
  addLog(`设置边 (${a}, ${b}) = ${nextWeight}`);
  // 修改边权时清除路径结果
  currentRoute.value = [];
  bestRoute.value = [];
  solveCandidates.value = [];
  resetSolveStatus();
};

// 距离矩阵交互：自定义/随机/导入
const setMatrixMode = (mode) => {
  matrixMode.value = mode;
  // 切换模式时清除路径结果
  currentRoute.value = [];
  bestRoute.value = [];
  solveCandidates.value = [];
  resetSolveStatus();
  addLog("切换矩阵模式，清除路径结果");
};

const MIN_DISTANCE_WEIGHT = 0.1;
const normalizeDistanceWeight = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return MIN_DISTANCE_WEIGHT;
  return Number(Math.max(MIN_DISTANCE_WEIGHT, numericValue).toFixed(2));
};
const createRandomEdgeWeight = () =>
  Number((Math.random() * (10 - MIN_DISTANCE_WEIGHT) + MIN_DISTANCE_WEIGHT).toFixed(1));

const createRandomDistanceMatrix = (size) => {
  const matrix = Array(size)
    .fill()
    .map(() => Array(size).fill(0));
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      const w = createRandomEdgeWeight();
      matrix[i][j] = w;
      matrix[j][i] = w;
    }
  }
  return matrix;
};

const generateRandomMatrix = () => {
  const size = cityCount.value;
  const m = createRandomDistanceMatrix(size);
  distanceMatrix.value = m;
  layoutCitiesByDistanceMatrix(m);
  // 清除路径结果
  currentRoute.value = [];
  bestRoute.value = [];
  solveCandidates.value = [];
  resetSolveStatus();
  addLog("随机生成距离矩阵（对角线为0，其余单元格均为非零距离）");
};

const triggerFileInput = () => {
  fileInput.value && fileInput.value.click();
};

const handleFileImport = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = e.target.result;
      const lines = content
        .trim()
        .split("\n")
        .filter((line) => line.trim());

      if (lines.length === 0) {
        addLog("导入失败：文件为空");
        return;
      }

      const newMatrix = lines.map((line, lineIdx) =>
        line
          .split(/[,\s]+/)
          .filter((cell) => cell.trim())
          .map((cell, colIdx) => {
            const val = cell.trim();
            const num = parseFloat(val);

            // 检查是否为有效数字
            if (isNaN(num)) {
              throw new Error(
                `第${lineIdx + 1}行第${colIdx + 1}列包含非数字：${val}`
              );
            }

            // 检查是否为负数
            if (num < 0) {
              throw new Error(
                `第${lineIdx + 1}行第${
                  colIdx + 1
                }列为负数：${num}（距离必须非负）`
              );
            }

            // 检查是否为整数或浮点数
            if (!Number.isFinite(num)) {
              throw new Error(
                `第${lineIdx + 1}行第${colIdx + 1}列不是有效数值：${val}`
              );
            }

            return num;
          })
      );

      // 验证1：检查是否为方阵
      const size = newMatrix.length;
      if (size === 0) {
        addLog("导入失败：矩阵为空");
        return;
      }

      for (let i = 0; i < size; i++) {
        if (newMatrix[i].length !== size) {
          addLog(
            `导入失败：不是方阵（第${i + 1}行有${
              newMatrix[i].length
            }列，期望${size}列）`
          );
          return;
        }
      }

      // 验证2：检查对角线是否为0（无自环）
      for (let i = 0; i < size; i++) {
        if (newMatrix[i][i] !== 0) {
          addLog(
            `导入失败：对角线元素[${i}][${i}]=${newMatrix[i][i]}，不允许自环（必须为0）`
          );
          return;
        }
      }

      // 验证3：检查是否对称
      for (let i = 0; i < size; i++) {
        for (let j = i + 1; j < size; j++) {
          if (newMatrix[i][j] < MIN_DISTANCE_WEIGHT || newMatrix[j][i] < MIN_DISTANCE_WEIGHT) {
            addLog(`导入失败：非对角线距离必须 ≥ 0.1（[${i}][${j}] 或 [${j}][${i}] 不符合）`);
            return;
          }
          const diff = Math.abs(newMatrix[i][j] - newMatrix[j][i]);
          // 使用小的容差来处理浮点数精度问题
          if (diff > 0.0001) {
            addLog(
              `导入失败：矩阵不对称（[${i}][${j}]=${newMatrix[i][j]}，但[${j}][${i}]=${newMatrix[j][i]}）`
            );
            return;
          }
          // 确保完全对称
          newMatrix[j][i] = newMatrix[i][j];
        }
      }

      // 验证4：检查规模是否在允许范围内
      if (size < 3 || size > 24) {
        addLog(`导入失败：矩阵规模${size}超出范围（允许3-24）`);
        return;
      }

      // 验证5：检查是否所有非对角线元素都为0（这样的矩阵无意义）
      let hasEdge = false;
      for (let i = 0; i < size; i++) {
        for (let j = i + 1; j < size; j++) {
          if (newMatrix[i][j] > 0) {
            hasEdge = true;
            break;
          }
        }
        if (hasEdge) break;
      }

      if (!hasEdge) {
        addLog("警告：矩阵中没有任何正权重边，TSP问题无意义");
      }

      // 所有验证通过，导入数据
      cityCount.value = size;
      distanceMatrix.value = newMatrix;
      generateCities();
      layoutCitiesByDistanceMatrix(newMatrix);
      currentRoute.value = [];
      bestRoute.value = [];
      solveCandidates.value = [];
      resetSolveStatus();

      // 计算边数（非零边）
      let edgeCount = 0;
      for (let i = 0; i < size; i++) {
        for (let j = i + 1; j < size; j++) {
          if (newMatrix[i][j] > 0) edgeCount++;
        }
      }

      addLog(`数据导入成功：${size}×${size}距离矩阵，${edgeCount}条非零边`);
    } catch (err) {
      console.error("文件解析失败:", err);
      addLog(`导入失败：${err.message}`);
    }
  };
  reader.readAsText(file);
};

const toggleMatrixCell = async (i, j) => {
  if (
    (matrixMode.value !== "custom" && matrixMode.value !== "random") ||
    i === j
  )
    return;
  const { value } = await ElMessageBox.prompt(
    "请输入边长度（最小 0.1）",
    "编辑矩阵单元",
    {
      inputValue: String(distanceMatrix.value[i][j] || MIN_DISTANCE_WEIGHT),
      inputPattern: /^(?:0\.[1-9]\d*|[1-9]\d*(?:\.\d+)?)$/,
      inputErrorMessage: "请输入不小于 0.1 的数字",
      confirmButtonText: "确定",
      cancelButtonText: "取消",
    }
  ).catch(() => ({ value: null }));
  if (value !== null && value !== undefined) {
    const w = parseFloat(value);
    setEdgeWeight(i, j, w);
  }
};

const applyTerminalTaskStatus = (taskStatus) => {
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

// 求解提交（统一POST参数）
const submitSolve = async () => {
  try {
    solving.value = true;
    statusClass.value = "status-running";
    solveTime.value = "--";
    iterations.value = 0;
    currentRoute.value = [];
    bestRoute.value = [];
    currentTaskId.value = null;
    statusText.value = "求解中";
    solveCandidates.value = [];
    const start = Date.now();
    resetSolveLogs(
      `开始求解旅行商问题（求解模型：${getModelTypeText(solveType.value)}，${cityCount.value}个城市）`
    );

    const payload = {
      taskName: customTaskName.value || `TSP_${Date.now()}`,
      problemType: "tsp",
      modelType: solveType.value, // classic | sim | cloud
      algorithm: algorithm.value,
      matrixSize: cityCount.value,
      cities: cities.value.map((c) => ({ id: c.id, x: c.x, y: c.y })),
      adjacencyMatrix: distanceMatrix.value,
    };

    addLog("提交任务中");
    const res = await submitTask(payload);
    if (res?.success) {
      clearCustomTaskName();
      currentTaskId.value = res.taskId;
      addLog("任务已提交，等待结果");
      loadTaskHistory();

      // 开始轮询任务状态
      await pollTaskStatus(res.taskId, start);
    } else {
      throw new Error(res?.message || "提交失败");
    }
  } catch (e) {
    clearCustomTaskName();
    statusClass.value = "status-fail";
    statusText.value = "提交失败";
    addLog("提交失败：" + e.message);
    ElMessage.error(e.message || "提交失败");
    solving.value = false;
  }
};

// 轮询任务状态
const pollTaskStatus = async (taskId, startTime) => {
  const pollInterval = 2000; // 2秒轮询一次

  const poll = async () => {
    if (!solving.value) return;
    try {
      const statusResponse = await getTaskStatus(taskId);
      if (!solving.value) return;

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

        // 更新结果
        console.log("-----GET RESULT FROM BACKEND------");
        console.log(statusResponse);
        console.log("-----RESULT END------");

        // 解析后端返回的结果
        const resultCandidates = statusResponse.results?.candidates || [];
        solveCandidates.value = resultCandidates;
        if (resultCandidates.length > 0) {
          // 取第一个候选结果
          const bestResult = resultCandidates[0];
          const routeValue = bestResult.value; // 路径长度

          const route = normalizeTspRouteFromSolution(
            bestResult.solution,
            cityCount.value
          );

          console.log("解析的路径:", route);
          console.log("路径长度:", routeValue);

          bestRoute.value = route;
          currentRoute.value = route;

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
        setTimeout(poll, pollInterval);
      } else if (statusResponse.state === "queued") {
        statusText.value = `计算中${
          statusResponse.queuePosition
            ? `(队列第${statusResponse.queuePosition}位)`
            : ""
        }`;
        addTaskProgressLog("queued", statusResponse.queuePosition);
        setTimeout(poll, pollInterval);
      }
    } catch (error) {
      statusClass.value = "status-fail";
      statusText.value = "连接失败";
      solving.value = false;
      addLog("无法获取任务状态: " + error.message);
      loadTaskHistory();
    }
  };

  // 开始轮询
  setTimeout(poll, pollInterval);
};

const cancelSolve = async () => {
  if (currentTaskId.value) {
    try {
      const res = await cancelTask(currentTaskId.value);
      if (res?.success === false) {
        ElMessage.warning(res?.message || "取消失败");
        addLog(`取消失败：${res?.message || "取消失败"}`);
        // 任务刚好完成时继续保留轮询，让完成分支回填结果。
        if (["completed", "failed", "cancelled"].includes(res?.taskStatus)) {
          applyTerminalTaskStatus(res.taskStatus);
          if (res.taskStatus === "completed") {
            loadTaskHistory();
            return;
          }
          solving.value = false;
          currentTaskId.value = null;
          loadTaskHistory();
        }
        return;
      }

      ElMessage.success(res?.message || "任务已取消");
      addLog("任务已取消");
      solving.value = false;
      statusClass.value = "status-fail";
      statusText.value = "已取消";
      currentTaskId.value = null;
      loadTaskHistory();
    } catch (error) {
      addLog("取消任务失败: " + error.message);
      ElMessage.error(error.message || "取消任务失败");
    }
  }
};

// 距离函数优先使用矩阵权重
const distanceBetween = (a, b) => {
  const w = distanceMatrix.value?.[a]?.[b];
  if (typeof w === "number" && w > 0) return w;
  const ca = cities.value[a];
  const cb = cities.value[b];
  const dx = ca.x - cb.x;
  const dy = ca.y - cb.y;
  return Math.sqrt(dx * dx + dy * dy);
};

// 重写路径距离计算以支持权重矩阵
const calculateRouteDistance = (route) => {
  if (route.length < 2) return 0;
  let distance = 0;
  for (let i = 0; i < route.length; i++) {
    const u = route[i];
    const v = route[(i + 1) % route.length];
    distance += distanceBetween(u, v);
  }
  return distance;
};

// 兼容原有算法使用的距离接口
const getDistance = (cityA, cityB) => distanceBetween(cityA, cityB);

// 任务历史相关方法
const getHistoryDeleteFilters = () => {
  const taskName = appliedHistoryTaskName.value.trim();
  return taskName ? { problemType: "tsp", taskName } : { problemType: "tsp" };
};

const loadTaskHistory = async (params = {}) => {
  const requestTaskName = (params.taskName ?? appliedHistoryTaskName.value).trim();
  const requestParams = {
    problemType: "tsp",
    page: params.page ?? historyCurrentPage.value,
    pageSize: params.pageSize ?? historyPageSize.value,
    taskName: requestTaskName,
  };

  try {
    historyLoading.value = true;
    const response = await getTaskHistory(requestParams);
    if (response.success && response.data) {
      taskHistory.value = response.data.tasks || [];
      historyTotal.value = response.data.total || 0;
      appliedHistoryTaskName.value = requestTaskName;
    } else {
      taskHistory.value = [];
      historyTotal.value = 0;
    }
  } catch (error) {
    console.error("加载任务历史失败:", error);
    addLog("加载任务历史失败: " + error.message);
    taskHistory.value = [];
    historyTotal.value = 0;
  } finally {
    historyLoading.value = false;
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

const handleHistoryPageSizeChange = (size) => {
  historyPageSize.value = size;
  historyCurrentPage.value = 1;
  loadTaskHistory({
    page: 1,
    pageSize: size,
  });
};

const handleHistoryCurrentChange = (page) => {
  historyCurrentPage.value = page;
  loadTaskHistory({
    page,
  });
};

// 辅助函数
const getModelTypeText = (type) => {
  const types = {
    classic: "经典计算",
    sim: "量子芯片模拟计算",
    cloud: "量子云服务计算",
  };
  return types[type] || type;
};

const getStatusText = (status) => {
  const statuses = {
    queued: "计算中",
    processing: "计算中",
    completed: "已完成",
    failed: "已失败",
    cancelled: "已取消",
  };
  return statuses[status] || status;
};

const getStatusType = (status) => {
  const types = {
    queued: "warning",
    processing: "warning",
    completed: "success",
    failed: "danger",
    cancelled: "info",
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

// 删除任务
const handleDeleteTask = async (row) => {
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
      ElMessage.error(error.message || "删除任务失败");
      console.error("删除任务失败:", error);
      addLog(`删除任务失败: ${error.message || "未知错误"}`);
    }
  }
};

const handleDeleteAllTasks = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除全部 ${historyTotal.value} 条旅行商任务历史吗？此操作不可恢复。`,
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
      ElMessage.error(error.message || "删除全部任务失败");
    }
  }
};

// 查看任务详情
const handleViewTaskDetail = async (row) => {
  try {
    selectedTask.value = row;
    detailDialogVisible.value = true;

    // 如果任务已完成，获取详细结果
    if (row.status === "completed") {
      const statusResponse = await getTaskStatus(row.taskId);
      if (statusResponse.results) {
        taskDetailResults.value = statusResponse.results;
      }
    } else {
      taskDetailResults.value = null;
    }
  } catch (error) {
    console.error("获取任务详情失败:", error);
    addLog("获取任务详情失败: " + error.message);
    ElMessage.error(error.message || "获取任务详情失败");
  }
};

// 导出任务详情
const exportTaskDetail = () => {
  if (!selectedTask.value) return;

  const data = {
    taskInfo: {
      taskId: selectedTask.value.taskId,
      taskName: selectedTask.value.taskName,
      problemType: "tsp",
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

// 初始化
generateCitiesAndMatrix();
// 异步加载任务历史
loadTaskHistory();
</script>

<style scoped>
.main-card {
  background: #ffffff;
  border-radius: 20px;
  border: 1px solid #e6eaf5;
  box-shadow: 0 10px 20px rgba(9, 30, 66, 0.04);
}

.page-content {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
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
  background: linear-gradient(180deg, #4050f8, #7848e8);
  border-radius: 2px;
}

.description {
  color: #666;
  font-size: 14px;
  margin-top: 8px;
}

.card-content {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 32px;
}

.left-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.right-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

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
}

.tsp-visualization {
  border: 1px solid #e6eaf5;
  border-radius: 12px;
  background: #fafbfc;
  margin-bottom: 20px;
  overflow: hidden;
}

.route-comparison {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.route-item h4 {
  color: #292929;
  margin-bottom: 8px;
  font-size: 14px;
}

.route-sequence {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.route-distance {
  font-size: 14px;
  color: #666;
  font-weight: 500;
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

.stats-card {
  margin-top: 16px;
}

.stats-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
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
.state-icon.status-running {
  background: #f88818;
  animation: pulse 1.5s infinite;
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

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
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

.candidates-card {
  margin-top: 16px;
}

.candidates-placeholder {
  color: #8c8fa3;
  font-size: 14px;
}

.candidates-list {
  margin-top: 0;
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
