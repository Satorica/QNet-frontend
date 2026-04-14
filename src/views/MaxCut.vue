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
            <el-radio-group v-model="solveType" class="solve-type-group">
              <el-radio-button label="classic">经典计算</el-radio-button>
              <el-radio-button label="sim">量子芯片模拟计算</el-radio-button>
              <el-radio-button label="cloud">量子云服务计算</el-radio-button>
            </el-radio-group>
          </div>

          <!-- 规模控制 -->
          <div class="controls-row">
            <div class="control-item">
              <span class="ctrl-label">求解问题规模：</span>
              <el-input-number
                v-model="matrixSize"
                :min="2"
                :max="24"
                style="width: 130px"
                @change="generateMatrix"
              />
            </div>
          </div>

          <!-- 矩阵标题 -->
          <div class="matrix-header">
            <div class="title-section">
              <div class="title-bar"></div>
              <span class="title-text">请输入图的邻接矩阵：</span>
            </div>
          </div>

          <!-- 矩阵操作按钮 -->
          <div class="matrix-options">
            <el-button
              :type="editMode === 'custom' ? 'primary' : ''"
              @click="setEditMode('custom')"
              >自定义</el-button
            >
            <el-button
              :type="editMode === 'random' ? 'primary' : ''"
              @click="setEditMode('random'); generateRandomMatrix()"
              >随机生成</el-button
            >
            <el-button @click="triggerFileInput">数据导入(txt/csv)</el-button>
            <input
              ref="fileInput"
              type="file"
              accept=".csv,.txt"
              style="display: none"
              @change="handleFileImport"
            />
          </div>

          <!-- 邻接矩阵网格 -->
          <div class="matrix-grid">
            <div v-for="(row, i) in matrix" :key="i" class="matrix-row">
              <div
                v-for="(cell, j) in row"
                :key="j"
                class="matrix-cell"
                :class="{ editable: i !== j }"
                @click="toggleCell(i, j)"
              >
                {{ cell }}
              </div>
            </div>
          </div>

          <div class="tip">
            互相转化（邻接矩阵 ↔ 图）。点击矩阵单元格可随时编辑连接关系。
          </div>

          <!-- 图形可视化 -->
          <div class="graph-container">
            <MaxCutGraph
              :nodes="nodes"
              :edges="edges"
              :partition="partition"
              :editable="true"
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
            <el-button @click="cancelSolve">取消任务</el-button>
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
                <span>候选结果（3）</span>
                <el-button size="small" @click="exportResults"
                  >结果导出</el-button
                >
              </div>
            </template>
            <div class="candidates">
              <div
                v-for="(candidate, index) in candidates"
                :key="index"
                class="candidate-item"
              >
                <div class="candidate-header">
                  <span class="candidate-rank">候选解 {{ index + 1 }}</span>
                  <span class="candidate-value">目标值：{{ candidate.value ?? "--" }}</span>
                </div>
                <div class="candidate-solution">
                  <span class="solution-label">解向量：</span>
                  <span class="solution-value">{{ candidate.solution || "--" }}</span>
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
            >全部删除</el-button>
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
            <el-button type="danger" size="small" @click="handleDeleteTask(row)"
              >删除</el-button
            >
          </template>
        </el-table-column>
        <el-table-column prop="bestValue" label="最优值" min-width="100">
          <template #default="{ row }">
            {{ row.bestValue ?? "--" }}
          </template>
        </el-table-column>
        <el-table-column prop="solveTime" label="求解时间" min-width="110">
          <template #default="{ row }">
            {{ row.solveTime ?? "--" }}
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
              <span class="detail-label">最优目标值：</span>
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
                  JSON.stringify(candidate.solution)
                }}</span>
              </div>
            </div>
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
import { ref, computed, onMounted, watch } from "vue";
import {
  submitTask,
  getTaskStatus,
  cancelTask,
  getTaskHistory,
  deleteTask,
  deleteAllTasks,
} from "../api/index.js";
import { ElMessage, ElMessageBox } from "element-plus";
import MaxCutGraph from "../components/MaxCutGraph.vue";
import { useCustomTaskName } from "../stores/customTaskName.js";

const { customTaskName, clearCustomTaskName } = useCustomTaskName();

// 响应式数据
const solveType = ref("classic");
const matrixSize = ref(6);
const editMode = ref("custom");
const matrix = ref([]);
const solving = ref(false);
const stateClass = ref("state-idle");
const stateText = ref("等待求解");
const solveTime = ref("--");
const logs = ref(["参数校验通过"]);
const candidates = ref([
  { value: null, solution: null },
  { value: null, solution: null },
  { value: null, solution: null },
]);
const currentTaskId = ref(null);

const fileInput = ref(null);

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

// 图形可视化数据
const nodes = ref([]);
const edges = ref([]);
const selectedNodes = ref([]);
const partition = ref({});

// 计算属性
const edgeCount = computed(() => {
  let count = 0;
  for (let i = 0; i < matrix.value.length; i++) {
    for (let j = i + 1; j < matrix.value[i].length; j++) {
      if (matrix.value[i][j] === 1) count++;
    }
  }
  return count;
});

// 初始化矩阵
const generateMatrix = () => {
  const size = matrixSize.value;
  matrix.value = Array(size)
    .fill()
    .map(() => Array(size).fill(0));
  generateNodes();
  syncEdgesFromMatrix();
  // 清除分区结果
  partition.value = {};
  candidates.value = [
    { value: null, solution: null },
    { value: null, solution: null },
    { value: null, solution: null },
  ];
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
  const size = matrixSize.value;
  const newMatrix = Array(size)
    .fill()
    .map(() => Array(size).fill(0));

  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      const connected = Math.random() > 0.6 ? 1 : 0;
      newMatrix[i][j] = connected;
      newMatrix[j][i] = connected;
    }
  }

  matrix.value = newMatrix;
  syncEdgesFromMatrix();
  // 清除分区结果
  partition.value = {};
  candidates.value = [
    { value: null, solution: null },
    { value: null, solution: null },
    { value: null, solution: null },
  ];
};

// 设置编辑模式
const setEditMode = (mode) => {
  editMode.value = mode;
  // 切换编辑模式时清除分区结果
  partition.value = {};
  candidates.value = [
    { value: null, solution: null },
    { value: null, solution: null },
    { value: null, solution: null },
  ];
  addLog("切换编辑模式，清除分区结果");
};

// 切换单元格状态
const toggleCell = (i, j) => {
  if (i !== j) {
    const newValue = matrix.value[i][j] === 1 ? 0 : 1;
    matrix.value[i][j] = newValue;
    matrix.value[j][i] = newValue;
    syncEdgesFromMatrix();
    // 修改矩阵时清除分区结果
    partition.value = {};
    candidates.value = [
      { value: null, solution: null },
      { value: null, solution: null },
      { value: null, solution: null },
    ];
  }
};

// 从邻接矩阵同步边
const syncEdgesFromMatrix = () => {
  const size = matrixSize.value;
  const newEdges = [];
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      if (matrix.value[i] && matrix.value[i][j] === 1) {
        newEdges.push({ source: i, target: j });
      }
    }
  }
  edges.value = newEdges;
};

// 从边同步到邻接矩阵
const syncMatrixFromEdges = () => {
  const size = matrixSize.value;
  const newMatrix = Array(size)
    .fill()
    .map(() => Array(size).fill(0));
  for (const edge of edges.value) {
    newMatrix[edge.source][edge.target] = 1;
    newMatrix[edge.target][edge.source] = 1;
  }
  matrix.value = newMatrix;
};

// 节点点击事件处理
const onGraphNodeClick = (nodeId) => {
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
    toggleEdge(a, b);
    selectedNodes.value = [];
  }
};

// 切换边
const toggleEdge = (a, b) => {
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

  syncMatrixFromEdges();
  // 修改边时清除分区结果
  partition.value = {};
  candidates.value = [
    { value: null, solution: null },
    { value: null, solution: null },
    { value: null, solution: null },
  ];
};

// 触发文件输入
const triggerFileInput = () => {
  fileInput.value.click();
};

// 处理文件导入
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

      const newMatrix = lines.map((line) =>
        line
          .split(/[,\s]+/)
          .filter((cell) => cell.trim())
          .map((cell) => {
            const val = cell.trim();
            if (val !== "0" && val !== "1") {
              throw new Error(`包含非法字符：${val}（仅允许0和1）`);
            }
            return parseInt(val);
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

      // 验证2：检查是否只包含0和1
      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          if (newMatrix[i][j] !== 0 && newMatrix[i][j] !== 1) {
            addLog(`导入失败：矩阵[${i}][${j}]=${newMatrix[i][j]}，只允许0或1`);
            return;
          }
        }
      }

      // 验证3：检查对角线是否为0（无自环）
      for (let i = 0; i < size; i++) {
        if (newMatrix[i][i] !== 0) {
          addLog(
            `导入失败：对角线元素[${i}][${i}]=${newMatrix[i][i]}，不允许自环（必须为0）`
          );
          return;
        }
      }

      // 验证4：检查是否对称
      for (let i = 0; i < size; i++) {
        for (let j = i + 1; j < size; j++) {
          if (newMatrix[i][j] !== newMatrix[j][i]) {
            addLog(
              `导入失败：矩阵不对称（[${i}][${j}]=${newMatrix[i][j]}，但[${j}][${i}]=${newMatrix[j][i]}）`
            );
            return;
          }
        }
      }

      // 验证5：检查规模是否在允许范围内
      if (size < 2 || size > 24) {
        addLog(`导入失败：矩阵规模${size}超出范围（允许2-24）`);
        return;
      }

      // 所有验证通过，导入数据
      matrixSize.value = size;
      matrix.value = newMatrix;
      generateNodes();
      syncEdgesFromMatrix();
      addLog(`数据导入成功：${size}×${size}邻接矩阵，${edgeCount.value}条边`);
    } catch (error) {
      console.error("文件解析失败:", error);
      addLog(`导入失败：${error.message}`);
    }
  };
  reader.readAsText(file);
};

// 开始求解
const startSolve = async () => {
  solving.value = true;
  stateClass.value = "state-running";
  stateText.value = "求解中";

  const startTime = Date.now();
  addLog("开始求解...");

  try {
    // 准备任务数据
    const taskData = {
      taskName: customTaskName.value || `MaxCut_${Date.now()}`,
      modelType: solveType.value,
      problemType: "maxcut",
      matrixSize: matrixSize.value,
      adjacencyMatrix: matrix.value,
    };

    // 提交任务到后端
    const submitResponse = await submitTask(taskData);

    if (submitResponse.success) {
      clearCustomTaskName();
      currentTaskId.value = submitResponse.taskId;
      addLog(`任务已提交，ID: ${submitResponse.taskId}`);

      // 任务已提交到后端，会自动保存到数据库，不需要手动添加到历史

      // 开始轮询任务状态
      await pollTaskStatus(submitResponse.taskId, startTime);
    } else {
      throw new Error(submitResponse.message || "任务提交失败");
    }
  } catch (error) {
    clearCustomTaskName();
    stateClass.value = "state-fail";
    stateText.value = "求解失败";
    addLog("求解失败: " + error.message);
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

        stateClass.value = "state-success";
        stateText.value = "求解成功";
        solveTime.value = `${duration}s`;
        solving.value = false;

        // 更新结果
        console.log("-----GET RESULT FROM BACKEND------");
        console.log(statusResponse.results);
        console.log("-----RESULT END------");

        // 修复：后端返回的是 results.candidates 数组
        const resultCandidates = statusResponse.results?.candidates || [];
        if (resultCandidates.length > 0) {
          candidates.value = resultCandidates.map((result) => ({
            value: result.value,
            solution: JSON.stringify(result.solution),
          }));
          console.log("更新候选结果:", candidates.value);

          // 更新图形分区显示 - 将解向量转换为两种颜色的分区
          if (resultCandidates[0].solution) {
            const solution = resultCandidates[0].solution;
            const newPartition = {};

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
            console.log("分区结果:", newPartition);
            addLog(
              `图着色完成：${
                Object.values(newPartition).filter((v) => v === 0).length
              } 个节点在分区A（红色），${
                Object.values(newPartition).filter((v) => v === 1).length
              } 个节点在分区B（蓝绿色）`
            );
          }
        }

        addLog("求解完成");
      } else if (
        statusResponse.state === "failed" ||
        statusResponse.state === "cancelled"
      ) {
        // 任务失败或取消
        stateClass.value = "state-fail";
        stateText.value =
          statusResponse.state === "cancelled" ? "已取消" : "求解失败";
        solving.value = false;
        addLog(statusResponse.message || "任务失败");
      } else if (statusResponse.state === "processing") {
        // 任务处理中
        stateText.value = "计算中...";
        addLog("任务正在计算中");
        setTimeout(poll, pollInterval);
      } else if (statusResponse.state === "queued") {
        // 任务排队中
        stateText.value = `排队中${
          statusResponse.queuePosition
            ? `(第${statusResponse.queuePosition}位)`
            : ""
        }`;
        setTimeout(poll, pollInterval);
      }
    } catch (error) {
      stateClass.value = "state-fail";
      stateText.value = "连接失败";
      solving.value = false;
      addLog("无法获取任务状态: " + error.message);
    } finally {
      // 每次轮询结束（成功拿到状态或请求失败）刷新任务历史
      loadTaskHistory();
    }
  };

  // 开始轮询
  setTimeout(poll, pollInterval);
};

// 取消求解
const cancelSolve = async () => {
  if (currentTaskId.value) {
    try {
      await cancelTask(currentTaskId.value);
      addLog("取消任务请求已发送");
    } catch (error) {
      addLog("取消任务失败: " + error.message);
    }
  }

  solving.value = false;
  stateClass.value = "state-idle";
  stateText.value = "已取消";
  currentTaskId.value = null;
};

// 添加日志
const addLog = (message) => {
  const now = new Date();
  const timestamp = now.toLocaleString("zh-CN");
  logs.value.unshift(`${timestamp}：${message}`);
};

// 导出结果
const exportResults = () => {
  const data = {
    matrix: matrix.value,
    candidates: candidates.value,
    solveType: solveType.value,
    timestamp: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `quantum-solve-result-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

// 任务历史相关方法
const loadTaskHistory = async (params = {}) => {
  const requestParams = {
    problemType: "maxcut",
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
  try {
    await ElMessageBox.confirm("确定删除该任务吗？", "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });

    const response = await deleteTask(row.taskId);
    if (response.success) {
      ElMessage.success('任务删除成功');
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
      ElMessage.error(response.message || '删除任务失败');
      addLog(`删除任务失败: ${response.message}`);
    }
  } catch (error) {
    // 用户取消删除或删除失败
    if (error !== "cancel") {
      ElMessage.error(error.message || '删除任务失败');
      addLog(`删除任务失败: ${error.message || "未知错误"}`);
    }
  }
};

const handleDeleteAllTasks = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要删除全部 ${historyTotal.value} 条图分割任务历史吗？此操作不可恢复。`,
      '删除全部任务',
      { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'warning' }
    );
    const response = await deleteAllTasks('maxcut');
    if (response.success) {
      ElMessage.success(`已成功删除 ${response.deletedCount} 个任务`);
      historyCurrentPage.value = 1;
      loadTaskHistory({ page: 1 });
    } else {
      ElMessage.error(response.message || '删除全部任务失败');
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除全部任务失败');
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
    addLog(`获取任务详情失败: ${error.message}`);
  }
};

// 导出任务详情
const exportTaskDetail = () => {
  if (!selectedTask.value) return;

  const data = {
    taskInfo: {
      taskId: selectedTask.value.taskId,
      taskName: selectedTask.value.taskName,
      problemType: "maxcut",
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
  generateMatrix();
  // 异步加载任务历史
  loadTaskHistory();
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

.matrix-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-bar {
  width: 4px;
  height: 20px;
  background: linear-gradient(180deg, #4050f8, #7848e8);
  border-radius: 2px;
}

.title-text {
  font-weight: 600;
  color: #292929;
}


.matrix-options {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.matrix-grid {
  display: inline-block;
  border: 1px solid #e6eaf5;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 12px;
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
  font-size: 14px;
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
  background: #ffffff;
  padding: 4px 8px;
  border-radius: 4px;
}
</style> 