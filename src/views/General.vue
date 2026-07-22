<template>
  <div class="general-page">
    <el-card class="main-card">
      <div class="card-content">
        <div class="left-column">
          <div class="controls-top">
            <span class="label">求解模型选择：</span>
            <el-radio-group v-model="solveType" class="solve-type-group" :disabled="solving">
              <el-radio-button label="classic">经典计算</el-radio-button>
              <el-radio-button label="sim">量子芯片模拟计算</el-radio-button>
              <el-radio-button label="cloud">量子云服务计算</el-radio-button>
            </el-radio-group>
          </div>

          <div class="controls-row">
            <div class="control-item">
              <span class="ctrl-label">问题规模：</span>
              <el-input-number
                v-model="matrixSize"
                :min="1"
                :max="10"
                :disabled="solving"
                style="width: 130px"
                @change="resizeMatrix"
              />
            </div>
          </div>

          <el-card class="model-card">
            <el-tabs v-model="inputMode" class="input-tabs">
              <el-tab-pane label="数学表达输入" name="expression">
                <el-form label-position="top" class="expression-form">
                  <el-form-item label="变量">
                    <el-input v-model="variableText" :disabled="solving" placeholder="x1,x2,x3,x4" />
                  </el-form-item>
                  <div class="expression-options">
                    <el-form-item label="变量域">
                      <el-select v-model="variableDomain" :disabled="solving">
                        <el-option label="0/1 变量" value="binary" />
                        <el-option label="-1/+1 变量" value="spin" />
                      </el-select>
                    </el-form-item>
                    <el-form-item label="方向">
                      <el-select v-model="objectiveSense" :disabled="solving">
                        <el-option label="最小化" value="minimize" />
                        <el-option label="最大化" value="maximize" />
                      </el-select>
                    </el-form-item>
                    <el-button class="example-button" :disabled="solving" @click="loadMaxCutExample">加载4自旋MaxCut示例</el-button>
                  </div>

                  <el-tabs v-model="expressionForm" class="expression-type-tabs">
                    <el-tab-pane label="标量表达式" name="scalar">
                      <el-form-item label="标量目标函数（按所选变量域解释）">
                        <el-input
                          v-model="objectiveExpression"
                          type="textarea"
                          :rows="5"
                          :disabled="solving"
                          placeholder="例如 2*x1*x2-3*x2；±1域可写 0.5*(1-x1*x2)"
                        />
                      </el-form-item>
                      <div class="tip expression-tip">标量式支持数字、变量以及 +、-、*、/、**。0/1域按 xᵢ²=xᵢ；±1域按 sᵢ²=1 后自动转 QUBO。</div>
                    </el-tab-pane>

                    <el-tab-pane label="向量/矩阵形式" name="vector">
                      <div class="matrix-formula">矩阵目标：输入 W 是一般权重矩阵，不是 QUBO；程序自动生成 QUBO</div>
                      <el-form-item label="矩阵类型">
                        <el-select v-model="matrixObjectiveKind" :disabled="solving" class="matrix-kind-select">
                          <el-option label="通用二次型 zᵀWz+cᵀz+k" value="quadratic" />
                          <el-option label="MaxCut权重矩阵" value="maxcut" />
                        </el-select>
                      </el-form-item>
                      <el-form-item label="权重矩阵 W（不是QUBO矩阵）">
                        <el-input
                          v-model="weightMatrixText"
                          type="textarea"
                          :rows="7"
                          :disabled="solving"
                          class="matrix-textarea"
                          placeholder="W = [[0, 1], [1, 0]]"
                        />
                      </el-form-item>
                      <div class="vector-fields">
                        <el-form-item label="线性向量 c">
                          <el-input v-model="linearVectorText" :disabled="solving" placeholder="c = [0,0,0,0]" />
                        </el-form-item>
                        <el-form-item label="常数 k">
                          <el-input v-model="constantText" :disabled="solving" placeholder="0" />
                        </el-form-item>
                      </div>
                      <div class="tip expression-tip">矩阵和向量请使用 JSON 数字数组，不支持元组或元素算式。通用二次型中 z 表示所选变量域；MaxCut模式下 W 表示图边权，c 按内部0/1变量解释。</div>
                    </el-tab-pane>
                  </el-tabs>

                  <div class="constraint-heading">
                    <span>多约束与独立惩罚系数</span>
                    <div>
                      <el-button size="small" :disabled="solving" @click="addConstraint">添加约束</el-button>
                      <el-button size="small" :disabled="solving || constraints.length === 0" @click="constraints = []">清空约束</el-button>
                    </div>
                  </div>
                  <el-table :data="constraints" class="constraint-table" table-layout="fixed" size="small" border empty-text="暂无约束">
                    <el-table-column :label="expressionForm === 'vector' ? '系数向量 a' : '左端表达式'" min-width="120">
                      <template #default="{ row }">
                        <el-input
                          v-model="row.coefficients"
                          :disabled="solving"
                          :placeholder="expressionForm === 'vector' ? '[1, 1, 0, 0]' : 'x1+x2'"
                        />
                      </template>
                    </el-table-column>
                    <el-table-column label="关系" width="68">
                      <template #default="{ row }">
                        <el-select v-model="row.operator" :disabled="solving">
                          <el-option label="≤" value="<=" />
                          <el-option label="=" value="==" />
                          <el-option label="≥" value=">=" />
                        </el-select>
                      </template>
                    </el-table-column>
                    <el-table-column label="右端" width="76">
                      <template #default="{ row }">
                        <el-input v-model="row.rhs" :disabled="solving" />
                      </template>
                    </el-table-column>
                    <el-table-column label="惩罚系数 λ" width="100">
                      <template #default="{ row }">
                        <el-input-number v-model="row.penalty" class="constraint-penalty-input" :min="0.001" :controls="false" :disabled="solving" />
                      </template>
                    </el-table-column>
                    <el-table-column label="操作" width="58" align="center">
                      <template #default="{ $index }">
                        <el-button link type="danger" :disabled="solving" @click="removeConstraint($index)">删除</el-button>
                      </template>
                    </el-table-column>
                  </el-table>

                  <div class="tip">{{ constraintHint }}</div>
                </el-form>
              </el-tab-pane>

              <el-tab-pane label="QUBO矩阵输入" name="matrix">
                <div class="matrix-actions">
                  <input ref="fileInput" class="file-input" type="file" accept=".csv,.txt,text/csv,text/plain" @change="handleFileImport" />
                  <el-button :disabled="solving" @click="openFilePicker">数据导入(txt/csv)</el-button>
                  <el-button :disabled="solving" @click="symmetrizeMatrix">对称化</el-button>
                  <el-button :disabled="solving" @click="clearMatrix">全零</el-button>
                </div>
              </el-tab-pane>
            </el-tabs>

            <div v-show="inputMode === 'matrix'" class="qubo-matrix-section">
              <div class="matrix-title-row" :style="{ width: `min(100%, ${matrixDisplayWidth}px)` }">
                <span>{{ matrixSize }} × {{ matrixSize }}</span>
              </div>
              <div class="matrix-scroll" :style="{ width: `min(100%, ${matrixDisplayWidth}px)` }">
                <table class="qubo-table" :style="{ minWidth: `${matrixDisplayWidth}px` }">
                  <thead>
                    <tr>
                      <th></th>
                      <th
                        v-for="(name, j) in variableNames"
                        :key="name"
                        :class="{ 'is-axis-hovered': hoveredCell?.column === j }"
                      >{{ name }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, i) in matrix" :key="i">
                      <th :class="{ 'is-axis-hovered': hoveredCell?.row === i }">{{ variableNames[i] }}</th>
                      <td
                        v-for="(_, j) in row"
                        :key="j"
                        :class="{ 'is-cell-hovered': hoveredCell?.row === i && hoveredCell?.column === j }"
                        @mouseenter="hoveredCell = { row: i, column: j }"
                        @mouseleave="hoveredCell = null"
                        @focusin="hoveredCell = { row: i, column: j }"
                        @focusout="hoveredCell = null"
                      >
                        <el-input-number
                          v-model="matrix[i][j]"
                          :controls="false"
                          :precision="3"
                          :disabled="solving"
                          aria-label="QUBO矩阵元素"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="matrix-description">此页直接输入已经形成的 QUBO 矩阵，按 f(x)=xᵀQx 解释；数学表达页的 W 是一般权重矩阵，会先自动转成 QUBO。</div>
            </div>
          </el-card>
        </div>

        <div class="right-column">
          <div class="solve-area">
            <el-button type="primary" size="large" :loading="solving" class="solve-btn" @click="startSolve">
              {{ solving ? "求解中..." : "求解" }}
            </el-button>
            <el-button
              :loading="
                currentTaskId !== null && cancelingTaskId === currentTaskId
              "
              :disabled="!solving || cancelingTaskId !== null"
              @click="cancelSolve"
            >取消任务</el-button>
          </div>

          <div class="solve-state">
            <div class="state-icon" :class="stateClass"></div>
            <div class="state-text">{{ stateText }}</div>
          </div>
          <div class="solve-time">求解时间：{{ solveTime }}</div>

          <el-card class="log-card">
            <template #header><span>求解日志</span></template>
            <div class="log-entries">
              <div v-for="(log, index) in logs" :key="index" class="log-entry">{{ log }}</div>
            </div>
          </el-card>

          <el-card class="result-card">
            <template #header>
              <div class="result-header">
                <span>候选结果</span>
                <el-button :disabled="candidates.length === 0" @click="exportResults">结果导出</el-button>
              </div>
            </template>
            <div v-if="candidates.length === 0" class="candidates-placeholder">--</div>
            <div class="candidates">
              <div v-for="(candidate, index) in candidates" :key="index" class="candidate-item">
                <div class="candidate-header">
                  <span class="candidate-rank">候选解 {{ index + 1 }}</span>
                  <span class="candidate-value">目标值：{{ formatCandidateValue(candidate.value) }}</span>
                </div>
                <div class="candidate-solution">
                  <span class="solution-label">解向量：</span>
                  <span class="solution-value">{{ JSON.stringify(candidate.solution) }}</span>
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
            <el-input v-model="historyTaskName" placeholder="请输入任务名称" style="width: 220px" clearable @keyup.enter="handleHistorySearch" />
            <el-button type="primary" @click="handleHistorySearch">确定</el-button>
            <el-button @click="handleHistoryReset">重置</el-button>
            <el-button type="danger" :disabled="historyTotal === 0" @click="handleDeleteAllTasks">全部删除</el-button>
          </div>
        </div>
      </template>
      <el-table :data="taskHistory" row-key="taskId" stripe table-layout="fixed" style="width: 100%" v-loading="historyLoading">
        <el-table-column prop="taskName" label="任务名" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <el-link type="primary" :underline="false" @click.stop="handleViewTaskDetail(row)">{{ row.taskName }}</el-link>
          </template>
        </el-table-column>
        <el-table-column prop="modelType" label="模型" min-width="150">
          <template #default="{ row }">{{ getModelTypeText(row.modelType) }}</template>
        </el-table-column>
        <el-table-column prop="timestamp" label="提交时间" min-width="170">
          <template #default="{ row }">{{ formatDate(row.timestamp) }}</template>
        </el-table-column>
        <el-table-column prop="matrixSize" label="规模" min-width="90" />
        <el-table-column prop="status" label="状态" min-width="110">
          <template #default="{ row }"><el-tag :type="getStatusType(row.status)">{{ getStatusText(row.status) }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="taskId" label="操作" width="190" align="center">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleViewTaskDetail(row)">查看详情</el-button>
            <el-button type="danger" size="small" :disabled="!isTaskDeletable(row.status)" @click="handleDeleteTask(row)">删除</el-button>
          </template>
        </el-table-column>
        <el-table-column prop="bestValue" label="最优值" min-width="100">
          <template #default="{ row }">{{ formatBestValue(row.bestValue) }}</template>
        </el-table-column>
        <el-table-column prop="solveTime" label="求解时间" min-width="110">
          <template #default="{ row }">{{ formatSolveTime(row.solveTime) }}</template>
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

    <el-dialog v-model="detailDialogVisible" title="任务详细信息" width="800px" :close-on-click-modal="false" @closed="handleTaskDetailClosed">
      <div
        v-if="selectedTask"
        v-loading="taskDetailLoading"
        class="task-detail"
        element-loading-text="正在加载任务详情..."
      >
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
              <span class="detail-value">一般优化问题</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">求解模型：</span>
              <span class="detail-value">{{ getModelTypeText(selectedTask.modelType) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">问题规模：</span>
              <span class="detail-value">{{ selectedTask.matrixSize }} 个变量</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">提交时间：</span>
              <span class="detail-value">{{ formatDate(selectedTask.timestamp) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">任务状态：</span>
              <el-tag class="task-detail-status-tag" :type="getStatusType(selectedTask.status)">{{ getStatusText(selectedTask.status) }}</el-tag>
            </div>
          </div>
        </el-card>

        <el-card v-if="selectedTask.status === 'completed' && taskDetailResults" class="detail-section task-detail-result-card">
          <template #header>
            <div class="detail-header">
              <span class="detail-title">结果信息</span>
            </div>
          </template>
          <div class="detail-content">
            <div class="detail-row">
              <span class="detail-label">求解时间：</span>
              <span class="detail-value">{{ formatSolveTime(
                typeof taskDetailResults.runtime === "number"
                  ? `${taskDetailResults.runtime}s`
                  : selectedTask.solveTime
              ) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">最优目标值：</span>
              <span class="detail-value highlight">{{ formatCandidateValue(selectedTask.bestValue) }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">候选解数量：</span>
              <span class="detail-value">{{ taskDetailResults.candidates?.length ?? 0 }}</span>
            </div>
          </div>

          <div class="candidates-list">
            <div class="candidates-header">候选解详情</div>
            <template v-if="taskDetailResults.candidates?.length">
              <div v-for="(candidate, index) in taskDetailResults.candidates" :key="index" class="candidate-item">
                <div class="candidate-header">
                  <span class="candidate-rank">候选解 {{ candidate.rank || index + 1 }}</span>
                  <span class="candidate-value">目标值：{{ formatCandidateValue(candidate.value) }}</span>
                </div>
                <div class="candidate-solution">
                  <span class="solution-label">解向量：</span>
                  <span class="solution-value">{{ JSON.stringify(candidate.solution) }}</span>
                </div>
              </div>
            </template>
            <div v-else class="detail-value">--</div>
          </div>
        </el-card>

        <el-card v-if="selectedTask.status === 'failed' || selectedTask.status === 'cancelled'" class="detail-section">
          <template #header>
            <div class="detail-header">
              <span class="detail-title">{{ selectedTask.status === "failed" ? "失败信息" : "取消信息" }}</span>
            </div>
          </template>
          <div class="detail-content">
            <div class="detail-row">
              <span class="detail-label">消息：</span>
              <span class="detail-value">{{ selectedTask.message || "无详细信息" }}</span>
            </div>
          </div>
        </el-card>
      </div>
      <template #footer>
        <el-button @click="detailDialogVisible = false">关闭</el-button>
        <el-button
          v-if="selectedTask?.status === 'completed'"
          type="primary"
          :disabled="!taskDetailResults"
          @click="exportTaskDetail"
        >导出结果</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  cancelTask,
  deleteTask,
  deleteTasksByFilter,
  getTaskDetail,
  getTaskHistory,
  getTaskStatus,
  submitTask,
} from "../api";
import { useCustomTaskName } from "../stores/customTaskName";
import { createAsyncScope, createLatestRequestGuard } from "../utils/asyncScope";
import { getErrorMessage } from "../utils/error";
import { formatBestValue, formatCandidateValue, formatSolveTime } from "../utils/format";
import {
  applyGeneralConstraintsToQubo,
  convertMatrixObjectiveToQubo,
  convertScalarObjectiveToQubo,
  extractGeneralInputSnapshot,
  formatGeneralMatrix,
  formatGeneralVector,
  parseGeneralConstant,
  parseGeneralMatrix,
  parseGeneralVector,
  restoreGeneralTaskResults,
  type GeneralInputSnapshot,
  type GeneralMatrixObjectiveKind,
} from "../utils/generalObjective";
import {
  downloadTaskResultExport,
  type TaskResultExportInfo,
} from "../utils/resultExport";
import { createSolveLogController, SOLVE_LOG_IDLE_MESSAGE } from "../utils/solveLog";
import { getDeleteAllResultMessage, isDialogDismissed, isTaskDeletable } from "../utils/task";
import type {
  ModelType,
  TaskCandidate,
  TaskHistoryItem,
  TaskHistoryParams,
  TaskResults,
  TaskStatus,
  TaskSubmitRequest,
} from "../types/api";

type InputMode = "expression" | "matrix";
type ExpressionForm = "scalar" | "vector";
type VariableDomain = "binary" | "spin";
type ObjectiveSense = "minimize" | "maximize";
type TagType = "success" | "primary" | "warning" | "info" | "danger";
interface ConstraintRow {
  coefficients: string;
  operator: "<=" | "==" | ">=";
  rhs: string;
  penalty: number;
}
interface GeneralResultExportContext {
  taskInfo: TaskResultExportInfo;
  input: {
    quboMatrix: number[][];
    generalInput: GeneralInputSnapshot;
  };
}

const { customTaskName, clearCustomTaskName } = useCustomTaskName();
const solveType = ref<ModelType>("classic");
const matrixSize = ref(4);
const inputMode = ref<InputMode>("expression");
const expressionForm = ref<ExpressionForm>("scalar");
const variableText = ref("x1,x2,x3,x4");
const variableDomain = ref<VariableDomain>("spin");
const objectiveSense = ref<ObjectiveSense>("maximize");
const objectiveExpression = ref("0.5*(1-x1*x2) + 0.5*(1-x2*x3) + 0.5*(1-x3*x4) + 0.5*(1-x4*x1)");
const matrixObjectiveKind = ref<GeneralMatrixObjectiveKind>("quadratic");
const weightMatrixText = ref(formatGeneralMatrix([
  [0, 1, 0, 1],
  [1, 0, 1, 0],
  [0, 1, 0, 1],
  [1, 0, 1, 0],
]));
const linearVectorText = ref(formatGeneralVector(4));
const constantText = ref("0");
const constraints = ref<ConstraintRow[]>([]);
const matrix = ref<number[][]>([
  [-2, 1, 0, 1],
  [1, -2, 1, 0],
  [0, 1, -2, 1],
  [1, 0, 1, -2],
]);
const hoveredCell = ref<{ row: number; column: number } | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const solving = ref(false);
const stateClass = ref("state-idle");
const stateText = ref("等待求解");
const solveTime = ref("--");
const logs = ref([SOLVE_LOG_IDLE_MESSAGE]);
const candidates = ref<TaskCandidate[]>([]);
const solveTaskResults = ref<TaskResults | null>(null);
const resultExportContext = ref<GeneralResultExportContext | null>(null);
const currentTaskId = ref<string | null>(null);
const cancelingTaskId = ref<string | null>(null);
const solveScope = createAsyncScope();
const { addLog, resetSolveLogs, addTaskProgressLog } = createSolveLogController(logs);

const taskHistory = ref<TaskHistoryItem[]>([]);
const historyLoading = ref(false);
const historyTaskName = ref("");
const appliedHistoryTaskName = ref("");
const historyCurrentPage = ref(1);
const historyPageSize = ref(10);
const historyTotal = ref(0);
const taskHistoryRequestGuard = createLatestRequestGuard();
const taskDetailRequestGuard = createLatestRequestGuard();
const detailDialogVisible = ref(false);
const selectedTask = ref<TaskHistoryItem | null>(null);
const taskDetailResults = ref<TaskResults | null>(null);
const taskDetailInput = ref<unknown>(null);
const taskDetailLoading = ref(false);

const getDefaultVariableNames = (size: number) =>
  Array.from({ length: size }, (_, index) => `x${index + 1}`);

const variableNames = computed(() => {
  const fallback = getDefaultVariableNames(matrixSize.value);
  if (inputMode.value === "matrix") return fallback;
  const parsed = variableText.value.split(",").map((item) => item.trim()).filter(Boolean);
  if (
    parsed.length === matrixSize.value
    && new Set(parsed).size === parsed.length
    && parsed.every((name) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
  ) return parsed;
  return fallback;
});

const matrixDisplayWidth = computed(() => {
  const cellWidth = Math.max(60, 92 - Math.max(0, matrixSize.value - 4) * 5);
  return 40 + matrixSize.value * cellWidth;
});

const constraintHint = computed(() => {
  const domainText = variableDomain.value === "spin" ? "-1/+1变量" : "0/1变量";
  return expressionForm.value === "vector"
    ? `向量/矩阵模式：每行表示 aᵀz ≤/≥/= b，z 为当前选择的${domainText}。例如 [1,1,0,0] <= 1；不等式会自动加入二进制松弛变量。`
    : `标量模式：每行输入左端表达式、关系、右端和惩罚系数，表达式按${domainText}解释。约束必须为线性式；不等式会自动加入二进制松弛变量。`;
});

const resizeMatrix = () => {
  if (solving.value) return;
  const size = matrixSize.value;
  const previous = matrix.value;
  matrix.value = Array.from({ length: size }, (_, i) =>
    Array.from({ length: size }, (_, j) => Number(previous[i]?.[j] ?? 0)),
  );
  variableText.value = Array.from({ length: size }, (_, index) => `x${index + 1}`).join(",");
  weightMatrixText.value = formatGeneralMatrix(Array.from({ length: size }, () => Array(size).fill(0)));
  linearVectorText.value = formatGeneralVector(size);
};

const addConstraint = () => {
  constraints.value.push({
    coefficients: expressionForm.value === "vector" ? `[${Array(matrixSize.value).fill(0).join(", ")}]` : "",
    operator: "<=",
    rhs: "0",
    penalty: 20,
  });
};
const removeConstraint = (index: number) => constraints.value.splice(index, 1);

const buildExpressionQubo = () => {
  const names = variableText.value.split(",").map((item) => item.trim()).filter(Boolean);
  if (names.length !== matrixSize.value || new Set(names).size !== names.length) {
    throw new Error(`变量数量必须为 ${matrixSize.value}，且变量名不能重复`);
  }
  if (names.some((name) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))) {
    throw new Error("变量名必须以字母或下划线开头，且只能包含字母、数字和下划线");
  }
  const objectiveMatrix = expressionForm.value === "scalar"
    ? convertScalarObjectiveToQubo({
      expression: objectiveExpression.value,
      variableNames: names,
      domain: variableDomain.value,
      sense: objectiveSense.value,
    })
    : (() => {
      const weightMatrix = parseGeneralMatrix(weightMatrixText.value, matrixSize.value);
      const linearVector = parseGeneralVector(linearVectorText.value, matrixSize.value);
      parseGeneralConstant(constantText.value);
      return convertMatrixObjectiveToQubo({
        weightMatrix,
        linearVector,
        domain: variableDomain.value,
        sense: objectiveSense.value,
        kind: matrixObjectiveKind.value,
      });
    })();

  const activeConstraints = constraints.value
    .filter((constraint) => constraint.coefficients.trim())
    .map((constraint) => ({ ...constraint }));

  const constrainedResult = applyGeneralConstraintsToQubo({
    matrix: objectiveMatrix,
    constraints: activeConstraints,
    variableNames: names,
    expressionForm: expressionForm.value,
    domain: variableDomain.value,
    maxSize: 10,
  });

  return { ...constrainedResult, activeConstraints };
};

const loadMaxCutExample = () => {
  const exampleWeightMatrix = [
    [0, 1, 0, 1],
    [1, 0, 1, 0],
    [0, 1, 0, 1],
    [1, 0, 1, 0],
  ];
  matrixSize.value = 4;
  inputMode.value = "expression";
  expressionForm.value = "vector";
  variableText.value = "x1,x2,x3,x4";
  variableDomain.value = "spin";
  objectiveSense.value = "maximize";
  objectiveExpression.value = "0.5*(1-x1*x2) + 0.5*(1-x2*x3) + 0.5*(1-x3*x4) + 0.5*(1-x4*x1)";
  matrixObjectiveKind.value = "maxcut";
  weightMatrixText.value = formatGeneralMatrix(exampleWeightMatrix);
  linearVectorText.value = formatGeneralVector(4);
  constantText.value = "0";
  matrix.value = convertMatrixObjectiveToQubo({
    weightMatrix: exampleWeightMatrix,
    linearVector: Array(4).fill(0),
    domain: "spin",
    sense: "maximize",
    kind: "maxcut",
  });
  constraints.value = [];
  candidates.value = [];
  solveTaskResults.value = null;
  resultExportContext.value = null;
  currentTaskId.value = null;
  addLog("已加载4自旋 MaxCut 示例：W为四节点环图C4权重矩阵，变量域±1，目标为最大化割边权重。");
  ElMessage.success("已加载4自旋 MaxCut 示例");
};

const openFilePicker = () => fileInput.value?.click();
const handleFileImport = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    if (file.size > 256 * 1024) throw new Error("导入文件不能超过 256 KB");
    const rows = (await file.text()).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) =>
      line.split(line.includes(",") ? "," : /\s+/).map((cell) => {
        const value = String(cell).trim();
        return value ? Number(value) : Number.NaN;
      }),
    );
    if (rows.length < 1 || rows.length > 10 || rows.some((row) => row.length !== rows.length)) throw new Error("导入数据必须是 1~10 阶方阵");
    if (rows.some((row) => row.some((value) => !Number.isFinite(value) || Math.abs(value) > 100000))) throw new Error("矩阵元素必须是绝对值不超过 100000 的有限数字");
    matrixSize.value = rows.length;
    variableText.value = getDefaultVariableNames(rows.length).join(",");
    weightMatrixText.value = formatGeneralMatrix(Array.from({ length: rows.length }, () => Array(rows.length).fill(0)));
    linearVectorText.value = formatGeneralVector(rows.length);
    matrix.value = rows;
    ElMessage.success(`已导入 ${rows.length} 阶QUBO矩阵`);
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "导入失败"));
  } finally {
    input.value = "";
  }
};

const copyDirectQuboMatrix = () => matrix.value.map((row) => row.map((value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("QUBO矩阵存在空白或无效元素");
  }
  return value;
}));

const symmetrizeMatrix = () => {
  try {
    const sourceMatrix = copyDirectQuboMatrix();
    for (let i = 0; i < matrixSize.value; i += 1) {
      for (let j = i + 1; j < matrixSize.value; j += 1) {
        const average = Number(((sourceMatrix[i][j] + sourceMatrix[j][i]) / 2).toFixed(6));
        matrix.value[i][j] = average;
        matrix.value[j][i] = average;
      }
    }
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "矩阵对称化失败"));
  }
};
const clearMatrix = () => { matrix.value = Array.from({ length: matrixSize.value }, () => Array(matrixSize.value).fill(0)); };

const getModelTypeText = (type: ModelType) => ({ classic: "经典计算", sim: "量子芯片模拟计算", cloud: "量子云服务计算" }[type] || type);
const getStatusText = (status: TaskStatus) => ({ queued: "计算中", processing: "计算中", completed: "已完成", failed: "已失败", cancelled: "已取消" }[status] || status);
const getStatusType = (status: TaskStatus): TagType => ({ queued: "warning", processing: "warning", completed: "success", failed: "danger", cancelled: "info" }[status] as TagType);
const formatDate = (timestamp: string | null) => {
  if (!timestamp) return "--";
  const date = new Date(timestamp);
  return `${date.toLocaleDateString("zh-CN")} ${date.toLocaleTimeString(
    "zh-CN",
    { hour: "2-digit", minute: "2-digit" },
  )}`;
};

const pollTaskStatus = async (taskId: string, startedAt: number, token: number) => {
  if (!solveScope.isCurrent(token) || currentTaskId.value !== taskId) return;
  try {
    const response = await getTaskStatus(taskId);
    if (!solveScope.isCurrent(token) || currentTaskId.value !== taskId) return;
    if (response.state === "completed") {
      const runtime = response.results?.runtime;
      solveTime.value = typeof runtime === "number" ? formatSolveTime(`${runtime}s`) : formatSolveTime(`${(Date.now() - startedAt) / 1000}s`);
      const generalInput = resultExportContext.value?.input.generalInput;
      const restoredResults = response.results && generalInput
        ? restoreGeneralTaskResults(response.results, generalInput)
        : response.results;
      candidates.value = restoredResults?.candidates || [];
      solveTaskResults.value = restoredResults || null;
      stateClass.value = "state-success";
      stateText.value = "求解成功";
      solving.value = false;
      addLog(candidates.value.length ? "求解完成" : "求解完成，但未返回候选解");
      loadTaskHistory();
      return;
    }
    if (response.state === "failed" || response.state === "cancelled") {
      stateClass.value = "state-fail";
      stateText.value = response.state === "failed" ? "求解失败" : "已取消";
      solving.value = false;
      addLog(response.state === "failed" ? `求解失败：${response.message || "任务失败"}` : "任务已取消");
      loadTaskHistory();
      return;
    }
    addTaskProgressLog(response.state === "processing" ? "processing" : "queued", response.queuePosition);
    solveScope.schedule(token, () => pollTaskStatus(taskId, startedAt, token), 1200);
  } catch (error) {
    stateClass.value = "state-fail";
    stateText.value = "连接失败";
    solving.value = false;
    addLog(`无法获取任务状态: ${getErrorMessage(error, "未知错误")}`);
  }
};

const startSolve = async () => {
  const startedAt = Date.now();
  const taskName = customTaskName.value || `General_${startedAt}`;
  const token = solveScope.begin();
  solving.value = true;
  stateClass.value = "state-running";
  stateText.value = "求解中";
  solveTime.value = "--";
  candidates.value = [];
  solveTaskResults.value = null;
  resultExportContext.value = null;
  currentTaskId.value = null;
  resetSolveLogs(`开始求解一般优化问题（${getModelTypeText(solveType.value)}，${matrixSize.value}个变量）`);
  try {
    const submittedTaskName = taskName;
    const submittedModelType = solveType.value;
    const submittedVariables = [...variableNames.value];
    const expressionResult = inputMode.value === "expression"
      ? buildExpressionQubo()
      : { matrix: copyDirectQuboMatrix(), slackVariableNames: [], activeConstraints: [] };
    const submittedMatrix = expressionResult.matrix;
    const submittedMatrixSize = submittedMatrix.length;
    if (submittedMatrixSize < 1 || submittedMatrixSize > 10 || submittedMatrix.some((row) => row.length !== submittedMatrixSize || row.some((value) => !Number.isFinite(value)))) {
      throw new Error("QUBO矩阵数据不完整");
    }
    if (submittedMatrix.some((row) => row.some((value) => Math.abs(value) > 100000))) {
      throw new Error("QUBO矩阵元素绝对值不能超过 100000");
    }
    const submittedInputMode = inputMode.value;
    const generalInput: GeneralInputSnapshot = {
      source: submittedInputMode,
      expressionForm: submittedInputMode === "matrix" ? "vector" : expressionForm.value,
      variables: submittedVariables,
      slackVariables: expressionResult.slackVariableNames,
      domain: submittedInputMode === "matrix" ? "binary" : variableDomain.value,
      sense: submittedInputMode === "matrix" ? "minimize" : objectiveSense.value,
      expression: submittedInputMode === "matrix" ? "" : objectiveExpression.value,
      matrixObjective: submittedInputMode === "matrix"
        ? { kind: "quadratic", weightMatrix: "", linearVector: "", constant: "0" }
        : {
          kind: matrixObjectiveKind.value,
          weightMatrix: weightMatrixText.value,
          linearVector: linearVectorText.value,
          constant: constantText.value,
        },
      constraints: submittedInputMode === "matrix"
        ? []
        : expressionResult.activeConstraints,
    };
    const payload: TaskSubmitRequest = {
      taskName: submittedTaskName,
      problemType: "general",
      modelType: submittedModelType,
      matrixSize: submittedMatrixSize,
      quboMatrix: submittedMatrix,
      generalInput,
    };
    addLog("提交任务中");
    const response = await submitTask(payload);
    if (!solveScope.isCurrent(token)) return;
    if (!response.success) throw new Error(response.message || "任务提交失败");
    clearCustomTaskName();
    currentTaskId.value = response.taskId;
    resultExportContext.value = {
      taskInfo: {
        taskId: response.taskId,
        taskName: submittedTaskName,
        problemType: "general",
        modelType: submittedModelType,
        matrixSize: submittedMatrixSize,
        timestamp: new Date(startedAt).toISOString(),
        status: "completed",
      },
      input: {
        quboMatrix: submittedMatrix.map((row) => [...row]),
        generalInput,
      },
    };
    addLog("任务已提交，等待结果");
    solveScope.schedule(token, () => pollTaskStatus(response.taskId, startedAt, token), 350);
    loadTaskHistory();
  } catch (error) {
    if (!solveScope.isCurrent(token)) return;
    clearCustomTaskName();
    stateClass.value = "state-fail";
    stateText.value = "求解失败";
    solving.value = false;
    const message = getErrorMessage(error, "求解失败");
    addLog(`求解失败: ${message}`);
    ElMessage.error(message);
  }
};

const cancelSolve = async () => {
  const taskId = currentTaskId.value;
  if (!taskId || cancelingTaskId.value !== null) return;

  try {
    await ElMessageBox.confirm("确定要取消当前任务吗？取消后任务将停止计算。", "确认取消任务", {
      confirmButtonText: "确定取消",
      cancelButtonText: "取消",
      type: "warning",
    });
    cancelingTaskId.value = taskId;
    const response = await cancelTask(taskId);
    if (currentTaskId.value !== taskId) return;
    if (response.success === false) {
      ElMessage.warning(response.message || "取消失败");
      if (response.taskStatus === "completed") {
        if (!solving.value) {
          loadTaskHistory();
          return;
        }
        stateClass.value = "state-running";
        stateText.value = "正在获取结果";
        addLog("任务已完成，正在获取最终结果");
        loadTaskHistory();
        return;
      }
      if (["failed", "cancelled"].includes(response.taskStatus)) {
        solving.value = false;
        stateClass.value = "state-fail";
        stateText.value = response.taskStatus === "failed" ? "求解失败" : "已取消";
        solveScope.invalidate();
        loadTaskHistory();
      }
      return;
    }

    solving.value = false;
    stateClass.value = "state-fail";
    stateText.value = "已取消";
    addLog("任务已取消");
    solveScope.invalidate();
    ElMessage.success(response.message || "任务已取消");
    loadTaskHistory();
  } catch (error) {
    if (!isDialogDismissed(error)) {
      ElMessage.error(getErrorMessage(error, "取消任务失败"));
    }
  } finally {
    if (cancelingTaskId.value === taskId) cancelingTaskId.value = null;
  }
};

const loadTaskHistory = async (params: TaskHistoryParams = {}) => {
  const requestId = taskHistoryRequestGuard.begin();
  const taskName = (params.taskName ?? appliedHistoryTaskName.value).trim();
  try {
    historyLoading.value = true;
    const response = await getTaskHistory({ problemType: "general", page: params.page ?? historyCurrentPage.value, pageSize: params.pageSize ?? historyPageSize.value, taskName });
    if (!taskHistoryRequestGuard.isLatest(requestId)) return;
    taskHistory.value = response.success && response.data ? response.data.tasks || [] : [];
    historyTotal.value = response.success && response.data ? response.data.total || 0 : 0;
    appliedHistoryTaskName.value = taskName;
  } catch (error) {
    if (!taskHistoryRequestGuard.isLatest(requestId)) return;
    taskHistory.value = [];
    historyTotal.value = 0;
    addLog(`加载任务历史失败: ${getErrorMessage(error, "未知错误")}`);
  } finally {
    if (taskHistoryRequestGuard.isLatest(requestId)) historyLoading.value = false;
  }
};
const handleHistorySearch = () => { historyCurrentPage.value = 1; loadTaskHistory({ page: 1, taskName: historyTaskName.value.trim() }); };
const handleHistoryReset = () => { historyTaskName.value = ""; historyCurrentPage.value = 1; loadTaskHistory({ page: 1, taskName: "" }); };
const handleHistoryPageSizeChange = (size: number) => { historyPageSize.value = size; historyCurrentPage.value = 1; loadTaskHistory({ page: 1, pageSize: size }); };
const handleHistoryCurrentChange = (page: number) => { historyCurrentPage.value = page; loadTaskHistory({ page }); };

const handleDeleteTask = async (row: TaskHistoryItem) => {
  if (!isTaskDeletable(row.status)) return;
  try {
    await ElMessageBox.confirm("确定删除该任务吗？", "提示", { confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" });
    const response = await deleteTask(row.taskId);
    if (!response.success) throw new Error(response.message || "删除任务失败");
    ElMessage.success("任务删除成功");
    const targetPage = taskHistory.value.length === 1 && historyCurrentPage.value > 1 ? historyCurrentPage.value - 1 : historyCurrentPage.value;
    historyCurrentPage.value = targetPage;
    loadTaskHistory({ page: targetPage });
  } catch (error) {
    if (error !== "cancel") ElMessage.error(getErrorMessage(error, "删除任务失败"));
  }
};
const handleDeleteAllTasks = async () => {
  try {
    await ElMessageBox.confirm(`确定要删除全部 ${historyTotal.value} 条一般问题任务历史吗？此操作不可恢复。`, "删除全部任务", { confirmButtonText: "确定删除", cancelButtonText: "取消", type: "warning" });
    const taskName = appliedHistoryTaskName.value.trim();
    const response = await deleteTasksByFilter(taskName ? { problemType: "general", taskName } : { problemType: "general" });
    if (!response.success) throw new Error(response.message || "删除全部任务失败");
    ElMessage.success(getDeleteAllResultMessage(response.deletedCount, response.skippedNonTerminalCount));
    historyCurrentPage.value = 1;
    loadTaskHistory({ page: 1 });
  } catch (error) {
    if (error !== "cancel") ElMessage.error(getErrorMessage(error, "删除全部任务失败"));
  }
};
const handleViewTaskDetail = async (row: TaskHistoryItem) => {
  const requestId = taskDetailRequestGuard.begin();
  selectedTask.value = row;
  taskDetailResults.value = null;
  taskDetailInput.value = null;
  taskDetailLoading.value = true;
  detailDialogVisible.value = true;
  try {
    const taskDetail = await getTaskDetail(row.taskId);
    if (
      !taskDetailRequestGuard.isLatest(requestId)
      || selectedTask.value?.taskId !== row.taskId
    ) return;
    const detailRuntime = taskDetail.runtime ?? taskDetail.resultSummary.runtime;
    const detailGeneralInput = extractGeneralInputSnapshot(taskDetail.input);
    const restoredDetailResults = taskDetail.results && detailGeneralInput
      ? restoreGeneralTaskResults(taskDetail.results, detailGeneralInput)
      : taskDetail.results;
    const restoredBestValue = restoredDetailResults?.candidates?.[0]?.value;
    const summaryBestValue = detailGeneralInput?.source === "matrix"
      ? taskDetail.resultSummary.bestValue
      : selectedTask.value.bestValue;
    selectedTask.value = {
      ...selectedTask.value,
      problemType: taskDetail.taskInfo.problemType,
      modelType: taskDetail.taskInfo.modelType,
      matrixSize: taskDetail.taskInfo.matrixSize,
      status: taskDetail.state,
      message: taskDetail.message,
      solveTime: typeof detailRuntime === "number" ? `${detailRuntime}s` : selectedTask.value.solveTime,
      bestValue: typeof restoredBestValue === "number" && Number.isFinite(restoredBestValue)
        ? restoredBestValue
        : summaryBestValue,
    };
    taskDetailResults.value = restoredDetailResults || null;
    taskDetailInput.value = taskDetail.input;
    if (typeof restoredBestValue === "number" && Number.isFinite(restoredBestValue)) {
      const historyItem = taskHistory.value.find((item) => item.taskId === row.taskId);
      if (historyItem) historyItem.bestValue = restoredBestValue;
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
    taskDetailResults.value,
  );
};

const exportResults = () => {
  const exportContext = resultExportContext.value;
  if (!exportContext || !solveTaskResults.value || !candidates.value.length) return;
  downloadTaskResultExport(
    exportContext.taskInfo,
    exportContext.input,
    solveTaskResults.value,
  );
};

onMounted(() => loadTaskHistory());
onBeforeUnmount(() => {
  solveScope.invalidate();
  taskHistoryRequestGuard.invalidate();
  taskDetailRequestGuard.invalidate();
});
</script>

<style scoped>
.general-page { padding-bottom: 8px; }
.main-card, .history-card { background: #fff; border: 1px solid #e6eaf5; border-radius: 20px; box-shadow: 0 10px 20px rgba(9, 30, 66, 0.04); }
.card-content { display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 32px; }
.left-column { min-width: 0; }
.controls-top, .controls-row, .control-item, .matrix-title-row, .result-header, .history-header, .history-actions, .constraint-heading { display: flex; align-items: center; }
.controls-top { gap: 12px; margin-bottom: 20px; }
.controls-row { gap: 20px; margin-bottom: 16px; flex-wrap: wrap; }
.control-item { gap: 8px; }
.label, .ctrl-label { color: #8c8fa3; font-size: 14px; }
.solve-type-group { display: flex; gap: 12px; }
.solve-type-group :deep(.el-radio-button__inner) { border: 1px solid #dcdfe6; padding: 8px 10px; font-size: 13px; white-space: nowrap; }
.solve-type-group :deep(.el-radio-button:not(.is-active) .el-radio-button__inner) { background: #fff; border-color: #dcdfe6; }
.model-card { margin-top: 16px; }
.matrix-title-row, .result-header, .history-header, .constraint-heading { justify-content: space-between; }
.form-row { display: grid; gap: 12px; }
.three-columns { grid-template-columns: 1.4fr 1fr 1fr; }
.expression-form :deep(.el-form-item) { margin-bottom: 14px; }
.expression-options { display: grid; grid-template-columns: minmax(112px, 1fr) minmax(102px, 0.85fr) auto; gap: 12px; align-items: end; }
.expression-options .example-button { margin-bottom: 14px; white-space: nowrap; }
.expression-type-tabs { margin-top: 2px; }
.expression-tip { margin-top: -3px; margin-bottom: 14px; }
.matrix-formula { padding: 10px 12px; margin-bottom: 14px; border-left: 3px solid #409eff; background: #f3f8ff; color: #4050f8; font-size: 13px; line-height: 1.6; }
.matrix-kind-select { width: min(100%, 300px); }
.matrix-textarea :deep(.el-textarea__inner) { font-family: "SFMono-Regular", Consolas, monospace; line-height: 1.55; }
.vector-fields { display: grid; grid-template-columns: minmax(0, 1fr) 120px; gap: 12px; }
.constraint-heading { margin: 2px 0 10px; color: #292929; font-weight: 500; }
.constraint-table { width: 100%; }
.constraint-penalty-input { width: 100%; }
.matrix-description { color: #8c8fa3; font-size: 12px; font-weight: 400; line-height: 1.6; margin-top: 8px; }
.matrix-actions { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.file-input { display: none; }
.qubo-matrix-section, .qubo-matrix-section :deep(*) { animation: none !important; transition: none !important; }
.matrix-title-row { justify-content: flex-end; padding: 8px 0; color: #292929; font-weight: 600; }
.matrix-title-row span:last-child { color: #8c8fa3; font-size: 12px; font-weight: 400; }
.matrix-scroll { overflow-x: auto; overflow-y: hidden; border: 1px solid #dbe3f0; border-radius: 10px; }
.qubo-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.qubo-table th { height: 31px; background: #f1f6ff; color: #526176; font-size: 12px; font-weight: 600; transition: background-color 160ms ease, color 160ms ease !important; }
.qubo-table th:first-child { width: 40px; }
.qubo-table th, .qubo-table td { border-right: 1px solid #dbe3f0; border-bottom: 1px solid #dbe3f0; text-align: center; }
.qubo-table tr:last-child th, .qubo-table tr:last-child td { border-bottom: 0; }
.qubo-table th:last-child, .qubo-table td:last-child { border-right: 0; }
.qubo-table td { position: relative; height: 31px; min-width: 58px; background: #fff; transition: background-color 160ms ease !important; }
.qubo-table td::after { content: ""; position: absolute; inset: 0; z-index: 1; border: 1px solid #409eff; border-radius: 3px; opacity: 0; pointer-events: none; transition: opacity 160ms ease, box-shadow 160ms ease !important; }
.qubo-table td.is-cell-hovered, .qubo-table td:hover, .qubo-table td:focus-within { background: #f0f7ff; }
.qubo-table td.is-cell-hovered::after, .qubo-table td:hover::after, .qubo-table td:focus-within::after { opacity: 1; box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.10); }
.qubo-table th.is-axis-hovered { background: #e3f0ff; color: #2878c8; }
.qubo-table :deep(.el-input-number) { width: 100%; min-width: 0; height: 31px; }
.qubo-table :deep(.el-input__wrapper) { min-height: 31px; background: transparent; box-shadow: none; border-radius: 0; padding: 0 3px; transition: background-color 160ms ease !important; }
.qubo-table td:hover :deep(.el-input__wrapper), .qubo-table td:focus-within :deep(.el-input__wrapper) { background: #f0f7ff; cursor: text; }
.qubo-table :deep(.el-input__inner) { text-align: center; font-family: "SFMono-Regular", Consolas, monospace; }
@media (prefers-reduced-motion: reduce) { .qubo-table th, .qubo-table td, .qubo-table td::after, .qubo-table :deep(.el-input__wrapper) { transition: none !important; } }
.tip { color: #8c8fa3; font-size: 12px; line-height: 1.6; margin-top: 8px; }
.solve-area { display: flex; gap: 10px; margin-bottom: 20px; }
.solve-btn { width: 120px; height: 48px; font-size: 16px; font-weight: 600; }
.solve-area :deep(.el-button) { height: 48px; }
.solve-state { display: flex; align-items: center; gap: 12px; padding: 16px; background: #f6f7fa; border-radius: 12px; margin-bottom: 12px; }
.state-icon { width: 16px; height: 16px; border-radius: 50%; flex: 0 0 auto; }
.state-idle { background: #8c8fa3; } .state-running { background: #f88818; animation: pulse 1.5s infinite; } .state-success { background: #40c878; } .state-fail { background: #e57550; }
@keyframes pulse { 50% { opacity: 0.5; } }
.state-text { color: #292929; font-weight: 500; }
.solve-time { color: #8c8fa3; font-size: 14px; margin-bottom: 20px; }
.log-card, .result-card { margin-bottom: 20px; }
.log-entries { max-height: 180px; overflow-y: auto; }
.log-entry { color: #666; font-size: 12px; line-height: 1.7; }
.candidates-placeholder { color: #8c8fa3; font-size: 14px; line-height: 24px; }
.candidates { display: flex; flex-direction: column; gap: 12px; }
.candidate-item { background: #f6f7fa; border-radius: 8px; padding: 12px; }
.candidate-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
.candidate-rank { color: #292929; font-size: 14px; font-weight: 500; }
.candidate-value { color: #4050f8; font-size: 14px; font-weight: 600; }
.candidate-solution { display: flex; gap: 8px; font-size: 13px; }
.solution-label { color: #8c8fa3; }
.solution-value { color: #666; font-family: "Courier New", monospace; word-break: break-all; }
.history-card { margin-top: 20px; }
.history-actions { gap: 12px; flex-wrap: wrap; }
.history-header h3 { margin: 0; color: #292929; font-weight: 600; }
.history-pagination { display: flex; justify-content: center; padding-top: 20px; }
.task-detail { max-height: 70vh; overflow-y: auto; }
.detail-section { margin-bottom: 16px; border: 1px solid #e6eaf5; border-radius: 12px; }
.detail-section:last-child { margin-bottom: 0; }
.detail-header { display: flex; align-items: center; gap: 8px; }
.detail-title { color: #292929; font-size: 16px; font-weight: 600; }
.detail-content { padding: 8px 0; }
.detail-row { display: flex; align-items: center; padding: 10px 0; border-bottom: 1px solid #f6f7fa; }
.detail-row:last-child { border-bottom: 0; }
.detail-label { min-width: 120px; color: #8c8fa3; font-size: 14px; font-weight: 500; }
.detail-value { color: #292929; font-size: 14px; word-break: break-all; }
.detail-value.highlight { color: #4050f8; font-size: 16px; font-weight: 600; }
.candidates-list { margin-top: 16px; padding-top: 16px; border-top: 1px solid #e6eaf5; }
.candidates-header { margin-bottom: 12px; color: #292929; font-size: 15px; font-weight: 600; }
.candidates-list .candidate-item { margin-bottom: 12px; }
.candidates-list .candidate-item:last-child { margin-bottom: 0; }
.candidates-list .candidate-header { align-items: center; }
.candidates-list .solution-label { min-width: 60px; flex-shrink: 0; }
.candidates-list .solution-value { padding: 4px 8px; border-radius: 4px; }
@media (max-width: 1180px) { .card-content { grid-template-columns: 1fr; } .right-column { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; } .solve-area, .solve-state, .solve-time { grid-column: 1 / -1; } }
@media (max-width: 780px) { .controls-top { align-items: flex-start; flex-direction: column; } .solve-type-group { flex-wrap: wrap; } .three-columns, .right-column, .expression-options, .vector-fields { grid-template-columns: 1fr; } .expression-options .example-button { width: 100%; } .log-card, .result-card { grid-column: 1; } .history-header { align-items: flex-start; flex-direction: column; gap: 12px; } }
</style>
