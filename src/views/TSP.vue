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
            <div class="control-item">
              <span class="ctrl-label">生成模式：</span>
              <el-select
                v-model="generationMode"
                style="width: 120px"
                @change="generateCitiesAndMatrix"
              >
                <el-option label="随机分布" value="random" />
                <el-option label="网格分布" value="grid" />
                <el-option label="环形分布" value="circle" />
                <el-option label="聚类分布" value="cluster" />
              </el-select>
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
            <div class="tip">
              点击单元格编辑权重；输入0表示删除该边（对称）。
            </div>
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
                <span class="label">当前路径长度：</span>
                <span class="value">{{ currentDistance.toFixed(2) }}</span>
              </div>
              <div class="stat-item">
                <span class="label">最短路径长度：</span>
                <span class="value">{{ bestDistance.toFixed(2) }}</span>
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
                    >路径长度：{{ candidate.value }}</span
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
                    >路径长度：{{ candidate.value }}</span
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
  deleteAllTasks,
} from "../api/index.js";
import { ElMessage, ElMessageBox } from "element-plus";
import { useCustomTaskName } from "../stores/customTaskName.js";
import { formatBestValue, formatSolveTime } from "../utils/format.js";
import {
  getDeleteAllResultMessage,
  isTaskDeletable,
} from "../utils/task.js";

const { customTaskName, clearCustomTaskName } = useCustomTaskName();

// 响应式数据
const cityCount = ref(8);
const generationMode = ref("random");
const algorithm = ref("nearest");
const temperature = ref(500);
const populationSize = ref(100);
const solveType = ref("classic");
const solving = ref(false);
const statusClass = ref("status-idle");
const statusText = ref("等待求解");
const solveTime = ref("--");
const iterations = ref(0);
const logs = ref(["TSP求解系统已就绪"]);
const currentTaskId = ref(null);
const solveCandidates = ref([]);

// 任务历史
const taskHistory = ref([]);
const historyLoading = ref(false);
const historyTaskName = ref("");
const historyCurrentPage = ref(1);
const historyPageSize = ref(10);
const historyTotal = ref(0);

// 任务详情对话框
const detailDialogVisible = ref(false);
const selectedTask = ref(null);
const taskDetailResults = ref(null);

const cities = ref([]);
const currentRoute = ref([]);
const bestRoute = ref([]);

// 两点选择用于添加/删除边（并输入权重）
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

const optimizationRatio = computed(() => {
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

// 方法
const generateCitiesAndMatrix = () => {
  generateCities();
  // 初始化/重置距离矩阵
  const size = cityCount.value;
  distanceMatrix.value = Array(size)
    .fill()
    .map(() => Array(size).fill(0));
  // 清除路径结果
  bestRoute.value = [];
};

const generateCities = () => {
  cities.value = [];
  switch (generationMode.value) {
    case "random":
      generateRandomCities();
      break;
    case "grid":
      generateGridCities();
      break;
    case "circle":
      generateCircleCities();
      break;
    case "cluster":
      generateClusterCities();
      break;
  }
  currentRoute.value = Array.from({ length: cityCount.value }, (_, i) => i);
  bestRoute.value = [];
  addLog(`生成${cityCount.value}个城市，${generationMode.value}分布`);
};

const generateRandomCities = () => {
  for (let i = 0; i < cityCount.value; i++) {
    cities.value.push({
      id: i,
      x: Math.random() * 320 + 40,
      y: Math.random() * 280 + 40,
      name: `城市${i}`,
    });
  }
};

const generateGridCities = () => {
  const side = Math.ceil(Math.sqrt(cityCount.value));
  const rows = Math.ceil(cityCount.value / side);
  const spacing = Math.min(300 / side, 260 / rows);
  const startX = (400 - (side - 1) * spacing) / 2;
  const startY = (360 - (rows - 1) * spacing) / 2;

  for (let i = 0; i < cityCount.value; i++) {
    const row = Math.floor(i / side);
    const col = i % side;
    cities.value.push({
      id: i,
      x: startX + col * spacing,
      y: startY + row * spacing,
      name: `城市${i}`,
    });
  }
};

const generateCircleCities = () => {
  const centerX = 200;
  const centerY = 180;
  const radius = 120;

  for (let i = 0; i < cityCount.value; i++) {
    const angle = (2 * Math.PI * i) / cityCount.value;
    cities.value.push({
      id: i,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      name: `城市${i}`,
    });
  }
};

const generateClusterCities = () => {
  const clusterCount = Math.min(3, Math.ceil(cityCount.value / 3));
  const clusterCenters = [];

  // 生成聚类中心
  for (let i = 0; i < clusterCount; i++) {
    clusterCenters.push({
      x: Math.random() * 300 + 50,
      y: Math.random() * 240 + 50,
    });
  }

  // 在聚类中心周围生成城市
  for (let i = 0; i < cityCount.value; i++) {
    const clusterIndex = i % clusterCount;
    const center = clusterCenters[clusterIndex];
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * 50 + 10;

    cities.value.push({
      id: i,
      x: center.x + distance * Math.cos(angle),
      y: center.y + distance * Math.sin(angle),
      name: `城市${i}`,
    });
  }
};

// removed duplicate calculateRouteDistance (see distance-aware implementation below)

const clearRoute = () => {
  currentRoute.value = [];
  bestRoute.value = [];
  addLog("清除所有路径");
};

const startSolve = async () => {
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

    addLog(
      `求解完成，最短距离：${bestDistance.value.toFixed(2)}，迭代${
        result.iterations
      }次`
    );
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

const stepSolve = () => {
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

const resetToWorst = () => {
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
    // 询问边权：0 表示删除
    const { value } = await ElMessageBox.prompt(
      "请输入边长度（非负数，0 表示删除边）",
      "设置边权",
      {
        inputValue: String(distanceMatrix.value[a][b] || 0),
        inputPattern: /^\d+(?:\.\d+)?$/,
        inputErrorMessage: "请输入非负数",
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
  if (w <= 0 || isNaN(w)) {
    distanceMatrix.value[a][b] = 0;
    distanceMatrix.value[b][a] = 0;
    addLog(`删除边 (${a}, ${b})`);
  } else {
    distanceMatrix.value[a][b] = w;
    distanceMatrix.value[b][a] = w;
    addLog(`设置边 (${a}, ${b}) = ${w}`);
  }
  // 修改边权时清除路径结果
  bestRoute.value = [];
};

// 距离矩阵交互：自定义/随机/导入
const setMatrixMode = (mode) => {
  matrixMode.value = mode;
  // 切换模式时清除路径结果
  bestRoute.value = [];
  addLog("切换矩阵模式，清除路径结果");
};

const generateRandomMatrix = () => {
  const size = cityCount.value;
  const m = Array(size)
    .fill()
    .map(() => Array(size).fill(0));
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      const w = Math.random() < 0.6 ? Math.random() * 9 + 1 : 0; // 60% 概率有边
      m[i][j] = Number(w.toFixed(1));
      m[j][i] = m[i][j];
    }
  }
  distanceMatrix.value = m;
  // 清除路径结果
  bestRoute.value = [];
  addLog("随机生成距离矩阵（非负权），覆盖当前图结构");
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
          .split(/[\,\s]+/)
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
      generateCities(); // 重建城市布局与默认路径

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
    "请输入边长度（非负数，0 表示删除边）",
    "编辑矩阵单元",
    {
      inputValue: String(distanceMatrix.value[i][j] || 0),
      inputPattern: /^\d+(?:\.\d+)?$/,
      inputErrorMessage: "请输入非负数",
      confirmButtonText: "确定",
      cancelButtonText: "取消",
    }
  ).catch(() => ({ value: null }));
  if (value !== null && value !== undefined) {
    const w = parseFloat(value);
    setEdgeWeight(i, j, w);
  }
};

// 求解提交（统一POST参数）
const submitSolve = async () => {
  try {
    solving.value = true;
    statusClass.value = "status-running";
    statusText.value = "求解中";
    solveCandidates.value = [];
    const start = Date.now();

    const payload = {
      taskName: customTaskName.value || `TSP_${Date.now()}`,
      problemType: "tsp",
      modelType: solveType.value, // classic | sim | cloud
      algorithm: algorithm.value,
      matrixSize: cityCount.value,
      cities: cities.value.map((c) => ({ id: c.id, x: c.x, y: c.y })),
      adjacencyMatrix: distanceMatrix.value,
    };

    const res = await submitTask(payload);
    if (res?.success) {
      clearCustomTaskName();
      currentTaskId.value = res.taskId;
      addLog(`任务已提交，ID: ${res.taskId}`);

      // 任务已提交到后端，会自动保存到数据库，不需要手动添加到历史

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
    try {
      const statusResponse = await getTaskStatus(taskId);

      if (statusResponse.state === "completed") {
        // 任务完成
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        statusClass.value = "status-success";
        statusText.value = "求解成功";
        solveTime.value = `${duration}s`;
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
          const solutionMatrix = bestResult.solution; // 一维数组
          const routeValue = bestResult.value; // 路径长度

          // 将解矩阵转换为路径
          // solutionMatrix是N×N矩阵的一维表示
          // 第i行第j列为1表示第i步经过第j个节点
          const n = cityCount.value;
          const route = [];

          if (Array.isArray(solutionMatrix)) {
            for (let step = 0; step < n; step++) {
              for (let node = 0; node < n; node++) {
                const index = step * n + node; // 一维数组索引
                if (solutionMatrix[index] === 1) {
                  route.push(node);
                  break;
                }
              }
            }
          }

          console.log("解析的路径:", route);
          console.log("路径长度:", routeValue);

          bestRoute.value = route;
          currentRoute.value = route;

          addLog(`求解完成，最短距离：${routeValue.toFixed(2)}`);
        }
      } else if (
        statusResponse.state === "failed" ||
        statusResponse.state === "cancelled"
      ) {
        // 任务失败或取消
        statusClass.value = "status-fail";
        statusText.value =
          statusResponse.state === "cancelled" ? "已取消" : "求解失败";
        solving.value = false;
        addLog(statusResponse.message || "任务失败");
      } else if (statusResponse.state === "processing") {
        // 任务处理中
        statusText.value = "计算中...";
        setTimeout(poll, pollInterval);
      } else if (statusResponse.state === "queued") {
        // 任务排队中
        statusText.value = `排队中${
          statusResponse.queuePosition
            ? `(第${statusResponse.queuePosition}位)`
            : ""
        }`;
        setTimeout(poll, pollInterval);
      }
    } catch (error) {
      statusClass.value = "status-fail";
      statusText.value = "连接失败";
      solving.value = false;
      addLog("无法获取任务状态: " + error.message);
    } finally {
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
      if (res?.cancelled === false) {
        ElMessage.info(res?.message || "任务已结束，无需取消");
        addLog(res?.message || "任务已结束，无需取消");
        return;
      }

      ElMessage.success(res?.message || "任务已取消");
      addLog("取消任务请求已发送");
      solving.value = false;
      statusClass.value = "status-idle";
      statusText.value = "已取消";
      currentTaskId.value = null;
    } catch (error) {
      addLog("取消任务失败: " + error.message);
      ElMessage.error(error.message || "取消任务失败");
    }
  }
};

const addLog = (message) => {
  const timestamp = new Date().toLocaleTimeString("zh-CN");
  logs.value.unshift(`${timestamp} - ${message}`);
  if (logs.value.length > 20) {
    logs.value = logs.value.slice(0, 20);
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
const loadTaskHistory = async (params = {}) => {
  const requestParams = {
    problemType: "tsp",
    page: params.page ?? historyCurrentPage.value,
    pageSize: params.pageSize ?? historyPageSize.value,
    taskName: params.taskName ?? historyTaskName.value.trim(),
  };

  try {
    historyLoading.value = true;
    const response = await getTaskHistory(requestParams);
    if (response.success && response.data) {
      taskHistory.value = response.data.tasks || [];
      historyTotal.value = response.data.total || 0;
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
    queued: "排队中",
    processing: "计算中",
    completed: "已完成",
    failed: "失败",
    cancelled: "已取消",
  };
  return statuses[status] || status;
};

const getStatusType = (status) => {
  const types = {
    queued: "info",
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
    const response = await deleteAllTasks("tsp");
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
