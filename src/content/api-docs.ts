import maxcut from './examples/maxcut.py?raw';
import number from './examples/number_partition.py?raw';
import coloring from './examples/coloring.py?raw';
import tsp from './examples/tsp.py?raw';
import general from './examples/general.py?raw';

export const problemExamples = [
  { value: 'maxcut', label: '图分割', size: '2–256', input: '对称方阵，对角线为 0；权重 0–30，最多一位小数。', script: maxcut },
  { value: 'number_partition', label: '数字分割', size: '2–256', input: '一维整数数组，长度等于 matrixSize；元素绝对值不超过 1,000,000。', script: number },
  { value: 'coloring', label: '图着色', size: '2–16', input: '对称 0/1 方阵，对角线为 0。', script: coloring },
  { value: 'tsp', label: '旅行商', size: '2–16', input: '对称距离方阵，对角线为 0；其余距离至少为 0.1。', script: tsp },
  { value: 'general', label: '一般 QUBO', size: '2–256', input: 'QUBO 方阵，允许非对称及非零对角线；矩阵元素绝对值不超过 100,000。', script: general },
];

export type ExampleLanguage = 'python' | 'curl';
export type ApiModelType = 'classic' | 'quantum';
export interface ApiDocField {
  name: string;
  type: string;
  description: string;
  required?: boolean;
  default?: string;
  example?: unknown;
  children?: ApiDocField[];
}
export function compactDocFields(fields: ApiDocField[]): ApiDocField[] {
  return fields.map(field => {
    const elements: ApiDocField[] = [];
    let children = field.children;
    while (children?.length === 1 && children[0].name === '[]') {
      elements.push(children[0]);
      children = children[0].children;
    }
    const leaf = elements[elements.length - 1];
    if (field.type.startsWith('array') && leaf && !children?.length && /^(string|number|integer|boolean|null)$/.test(leaf.type)) {
      const { children: _children, ...compact } = field;
      const type = elements.reduceRight((type) => `array<${type}>`, leaf.type);
      const descriptions = [...new Set([field.description, ...elements.map(element => element.description)])];
      return { ...compact, type, description: descriptions.filter(Boolean).join(' ') };
    }
    return { ...field, ...(field.children ? { children: compactDocFields(field.children) } : {}) };
  });
}
export function flattenDocFields(fields: ApiDocField[], expanded?: ReadonlySet<string>, parent = '', depth = 0): { path: string; depth: number; field: ApiDocField }[] {
  return fields.flatMap(field => {
    const path = parent ? parent + (field.name === '[]' ? '[]' : '.' + field.name) : field.name;
    const row = { path, depth, field };
    return [row, ...(field.children && (!expanded || expanded.has(path)) ? flattenDocFields(field.children, expanded, path, depth + 1) : [])];
  });
}

export function withFieldExamples(fields: ApiDocField[], values: unknown): ApiDocField[] {
  return fields.map(field => {
    const value = field.name === '[]' && Array.isArray(values) ? values[0] : values && typeof values === 'object' ? (values as Record<string, unknown>)[field.name] : undefined;
    return { ...field, example: value === undefined ? field.example : value, ...(field.children ? { children: withFieldExamples(field.children, value) } : {}) };
  });
}

const field = (name: string, type: string, description: string, required = true, children?: ApiDocField[]): ApiDocField => ({ name, type, description, required, ...(children ? { children } : {}) });
const numericArray = [field('[]', 'number', '数组元素。')];
const numericMatrix = [field('[]', 'array<number>', '矩阵的一行，长度等于 matrixSize。', true, numericArray)];
export const generalInputExample = {
  source: 'matrix', expressionForm: 'scalar', domain: 'binary', sense: 'minimize', variables: ['x1', 'x2'], slackVariables: [], expression: '',
  matrixObjective: { kind: 'quadratic', weightMatrix: '[[1,-2],[0,1]]', linearVector: '[0,0]', constant: '0' }, constraints: [],
};
const generalInputFields: ApiDocField[] = [
  field('source', 'string', 'matrix（矩阵）或 expression（表达式）。'),
  field('expressionForm', 'string', 'scalar（标量表达式）或 vector（向量表达式）。'),
  field('domain', 'string', 'binary（二进制变量）或 spin（自旋变量）。'),
  field('sense', 'string', 'minimize 或 maximize，表示原始目标方向。'),
  field('variables', 'array<string>', '原始变量名；非空、不可重复，每项最多 64 字符。', true, [field('[]', 'string', '以字母或下划线开头，只含字母、数字、下划线。')]),
  field('slackVariables', 'array<string>', '松弛变量名，与 variables 合计长度等于 matrixSize；matrix 来源必须为空数组。', true, [field('[]', 'string', '松弛变量名，格式同 variables。')]),
  field('expression', 'string', '原始目标表达式字符串，最多 10,000 字符；matrix 来源可传空字符串。'),
  field('matrixObjective', 'object', '原始矩阵目标的文本快照，以下字段均传字符串。', true, [
    field('kind', 'string', 'quadratic 或 maxcut。'), field('weightMatrix', 'string', '权重矩阵文本，最多 2,097,152 字符。'), field('linearVector', 'string', '线性项向量文本，最多 10,000 字符。'), field('constant', 'string', '常数项文本，最多 10,000 字符。'),
  ]),
  field('constraints', 'array<object>', '约束说明，最多 50 条；无约束传空数组。', true, [field('[]', 'object', '一条约束。', true, [
    field('coefficients', 'string', '系数向量文本，最多 10,000 字符。'), field('operator', 'string', '<=、== 或 >=。'), field('rhs', 'string | number', '右端值，数值须有限；字符串最多 128 字符。'), field('penalty', 'number', '大于 0 的有限惩罚系数。'),
  ])]),
];
const logFields = [field('[]', 'object', '一条求解事件；历史任务可能没有日志。', true, [
  field('sequence', 'integer', '事件顺序，从 1 开始。'), field('state', 'string', 'received 或任务状态。'), field('message', 'string', '事件说明。'),
  field('timestampNs', 'string', 'Unix 纳秒时间戳，以字符串保留精度。'), field('timestamp', 'string', '带时区的事件时间。'), field('elapsedSeconds', 'number', '从接收任务开始的累计秒数。'),
])];
export interface ApiEndpointDoc {
  id: string;
  title: string;
  method: 'GET' | 'POST';
  path: string;
  description: string;
  success: number;
  parameters: ApiDocField[];
  parameterLocation: string;
  responseFields: ApiDocField[];
  notes: string[];
}

const taskIdParameter: ApiDocField = { name: 'taskId', type: 'string', required: true, description: '本账号的任务 ID，来自提交响应；也可使用网页或小程序创建的任务 ID。' };
const stateField: ApiDocField = { name: 'state', type: 'string', description: 'queued、processing、completed、failed 或 cancelled。' };
const logsField: ApiDocField = { name: 'solveLogs', type: 'array', description: '任务从接收到当前阶段的求解日志。' };

export const apiEndpoints: ApiEndpointDoc[] = [
  {
    id: 'submit', title: '提交任务', method: 'POST', path: '/tasks', success: 202,
    description: '提交一个求解任务。接口立即返回任务 ID，计算通过现有队列异步执行。', parameterLocation: '请求体 · application/json',
    parameters: [
      { name: 'problemType', type: 'string', required: false, default: 'maxcut', description: '问题类型：maxcut、number_partition、coloring、tsp 或 general。建议显式指定。' },
      { name: 'modelType', type: 'string', required: false, default: 'classic', description: 'classic 为经典计算，quantum 为量子芯片模拟计算。' },
      { name: 'methodType', type: 'string', required: false, default: 'sa', description: '算法：sa、tabu、genetic、hill_climb、ils、random_search。量子模型示例省略此字段，与网页一致。' },
      { name: 'matrixSize', type: 'integer', required: true, description: '矩阵阶数或数字数组长度；允许范围取决于问题类型。' },
      { name: 'adjacencyMatrix', type: 'array', required: true, description: '问题数据。数字分割为一维数组，其他问题为方阵；general 直接传入 QUBO 矩阵。' },
      { name: 'taskName', type: 'string', required: false, default: '自动生成', description: '最多 64 个字符，同一用户的已有任务名称不能重复。' },
      { name: 'generalInput', type: 'object', required: false, description: '仅 general 可选，保存建模说明；实际求解使用 adjacencyMatrix。整个快照的 JSON 序列化内容最多 3 MiB。' },
    ],
    responseFields: [
      { name: 'taskId', type: 'string', description: '保存该 ID，后续用它查询状态、获取结果或取消任务。' },
      stateField,
      { name: 'statusUrl', type: 'string', description: '状态查询路径，相对于 API 域名。' },
      { name: 'resultUrl', type: 'string', description: '结果查询路径，相对于 API 域名。' },
      { name: 'replayed', type: 'boolean', description: 'true 表示返回幂等键对应的原任务，未创建新任务。' },
      { name: 'queuePosition', type: 'integer', description: '可获取时返回，表示排队位置。' },
    ],
    notes: ['提交成功表示任务已接收；请通过状态接口等待 completed，再获取结果。', '建议携带 Idempotency-Key：同用户 24 小时内同键同参数返回原 ID，不同参数返回 IDEMPOTENCY_CONFLICT。', '任务详情已删除时，幂等重试仍返回原 ID，并标记 taskDeleted=true、state=null。'],
  },
  {
    id: 'status', title: '查询任务状态', method: 'GET', path: '/tasks/{taskId}', success: 200,
    description: '查看任务当前状态、排队信息和求解日志。建议每 2 秒查询一次。', parameterLocation: '路径参数', parameters: [taskIdParameter],
    responseFields: [{ name: 'taskId', type: 'string', description: '任务 ID。' }, { name: 'taskName', type: 'string', description: '任务名称。' }, stateField,
      { name: 'message', type: 'string', description: '当前阶段的说明或失败原因。' },
      { name: 'updatedAt', type: 'number', description: '最后更新时间，Unix 时间戳，单位为秒。' }, logsField,
      { name: 'queuePosition', type: 'integer', description: '有可用排队信息时返回。' }],
    notes: ['任务 failed 或 cancelled 时停止轮询，查看 message，不要自动重新提交。', '任务不存在、已删除或不属于当前用户时统一返回 TASK_NOT_FOUND。'],
  },
  {
    id: 'result', title: '获取求解结果', method: 'GET', path: '/tasks/{taskId}/result', success: 200,
    description: '任务 completed 后，获取输入摘要、结果摘要与完整求解结果。', parameterLocation: '路径参数', parameters: [taskIdParameter],
    responseFields: [{ name: 'taskId', type: 'string', description: '任务 ID。' }, stateField,
      { name: 'taskInfo', type: 'object', description: '任务名称、问题、模型、算法和规模；其中 createdAt 为 Unix 毫秒时间戳。' },
      { name: 'input', type: 'object', description: '问题输入摘要；具体结构随 problemType 变化。' },
      { name: 'resultSummary', type: 'object', description: 'runtime（秒）、bestValue、usedColors 和 candidateCount。不适用的摘要字段可能为 null。' },
      { name: 'results', type: 'object', description: '完整求解结果，与网页使用相同结构；候选解位于 candidates。' }, logsField],
    notes: ['queued 或 processing 返回 TASK_NOT_COMPLETED；failed、cancelled 分别返回 TASK_FAILED、TASK_CANCELLED。', '请及时保存 results。结果保留期限与网页任务相同，取决于服务的清理配置。'],
  },
  {
    id: 'list', title: '查询任务列表', method: 'GET', path: '/tasks', success: 200,
    description: '按创建时间倒序查询本账号任务，包括网页、小程序和 API 创建的任务。', parameterLocation: '查询参数',
    parameters: [{ name: 'page', type: 'integer', required: false, default: '1', description: '页码，至少为 1。' },
      { name: 'pageSize', type: 'integer', required: false, default: '20', description: '每页条数，范围 1–100。' },
      { name: 'state', type: 'string', required: false, description: '按 queued、processing、completed、failed 或 cancelled 筛选；省略时返回全部状态。' }],
    responseFields: [{ name: 'tasks', type: 'array', description: '任务列表，每项包含 taskId、taskName、problemType、modelType、state、source、createdAt（Unix 秒）。' },
      field('page', 'integer', '当前页码。'), field('pageSize', 'integer', '每页条数。'),
      field('total', 'integer', '匹配任务总数。'), field('totalPages', 'integer', '匹配任务总页数。')], notes: ['source 为 web、miniprogram 或 api，表示提交来源。'],
  },
  {
    id: 'cancel', title: '取消任务', method: 'POST', path: '/tasks/{taskId}/cancel', success: 200,
    description: '取消排队或处理中的任务。请求无需 JSON 请求体。', parameterLocation: '路径参数', parameters: [taskIdParameter],
    responseFields: [{ name: 'taskId', type: 'string', description: '已取消任务的 ID。' }, { name: 'state', type: 'string', description: 'cancelled。' },
      { name: 'cancelled', type: 'boolean', description: '成功取消时为 true。' }, { name: 'message', type: 'string', description: '取消状态说明。' }, logsField],
    notes: ['completed、failed 或 cancelled 任务不能再取消，返回 TASK_NOT_CANCELLABLE。', '取消后释放该任务占用的可用额度。'],
  },
  {
    id: 'quota', title: '查询可用额度', method: 'GET', path: '/quota', success: 200,
    description: '查看经典计算和量子芯片模拟计算的剩余额度、占用额度与可用额度。', parameterLocation: '请求参数', parameters: [],
    responseFields: [field('quotaSummary', 'object', '完整额度摘要。', true, [
      field('defaultQuotas', 'object', '各模型的默认初始额度，实际值由服务配置决定。', true, [field('classic', 'integer', '经典计算默认额度。'), field('quantum', 'integer', '量子芯片模拟计算默认额度。')]),
      field('models', 'object', '各模型的账号额度。', true, ['classic', 'quantum'].map(name => field(name, 'object', name === 'classic' ? '经典计算额度。' : '量子芯片模拟计算额度。', true, [
        field('remaining', 'integer', '尚未扣除的剩余额度。'), field('pending', 'integer', '排队和运行中的任务占用额度。'), field('available', 'integer', '可用额度，max(remaining - pending, 0)。'),
        field('total', 'integer', '账号累计获配额度。'), field('default', 'integer', '此模型的默认初始额度。'), field('label', 'string', '模型显示名称。'),
      ]))),
    ])],
    notes: ['网页、小程序和 API 共用额度，多个 API Key 不会增加账号额度。', '成功完成后扣次；失败或取消释放占用。'],
  },
];

for (const endpoint of apiEndpoints) {
  endpoint.parameters = endpoint.parameters.map(item => item.name === 'generalInput' ? { ...item, children: generalInputFields } : item);
  endpoint.responseFields = endpoint.responseFields.map(item => ({ ...item, required: item.required ?? !['queuePosition', 'results'].includes(item.name), ...(item.name === 'state' && endpoint.id === 'submit' ? { type: 'string | null' } : {}), ...(item.name === 'solveLogs' ? { type: 'array<object>', children: logFields } : {}) }));
  if (endpoint.id === 'submit') endpoint.responseFields.push(field('message', 'string', '任务接收说明。', false), { ...logsField, type: 'array<object>', children: logFields, required: false }, field('taskDeleted', 'boolean', '仅幂等记录对应任务已删除时返回 true，此时 state 为 null。', false));
  if (endpoint.id === 'list') endpoint.responseFields[0].children = [field('[]', 'object', '一个任务。', true, [
    field('taskId', 'string', '任务 ID。'), field('taskName', 'string', '任务名称。'), field('problemType', 'string', '问题类型。'), field('modelType', 'string', '计算模型。'), field('state', 'string', '任务状态。'), field('source', 'string', 'web、miniprogram 或 api。'), field('createdAt', 'number', '创建时间，Unix 秒时间戳。'),
  ])];
}

export function requestDocFields(endpoint: ApiEndpointDoc, payload = buildTaskPayload('maxcut')): ApiDocField[] {
  const values = { ...payload, taskId: 't_abcdefghijklmnop', taskName: '示例任务', page: 1, pageSize: 20, state: 'completed', generalInput: generalInputExample };
  return withFieldExamples(endpoint.parameters.map(item => item.name === 'adjacencyMatrix' ? { ...item, type: payload.problemType === 'number_partition' ? 'array<integer>' : 'array<array<number>>', children: payload.problemType === 'number_partition' ? [field('[]', 'integer', '数字数组元素。')] : numericMatrix } : item), values);
}

export function responseDocFields(endpoint: ApiEndpointDoc, payload = buildTaskPayload('maxcut')): ApiDocField[] {
  const fields = endpoint.responseFields.map(item => ({ ...item }));
  if (endpoint.id === 'result') {
    const addChildren = (name: string, children: ApiDocField[]) => { const item = fields.find(item => item.name === name); if (item) item.children = children; };
    addChildren('taskInfo', [field('taskId', 'string', '任务 ID。'), field('taskName', 'string', '任务名称。'), field('source', 'string', '提交来源。'), field('problemType', 'string', '问题类型。'), field('modelType', 'string', '计算模型。'), field('methodType', 'string', '使用的算法。'), field('matrixSize', 'integer', '矩阵阶数或数组长度。'), field('createdAt', 'integer', '创建时间，Unix 毫秒时间戳。'), field('adjacencyMatrix', 'array', '原始问题数据。', true, payload.problemType === 'number_partition' ? numericArray : numericMatrix), field('extra', 'object', '任务保存的其他参数，按实际任务返回。', false)]);
    const input = payload.problemType === 'number_partition' ? [field('numbers', 'array<integer>', '待分割数字。', true, numericArray)] : payload.problemType === 'coloring' ? [field('nodeCount', 'integer', '节点数量。'), field('adjacencyMatrix', 'array', '图的邻接矩阵。', true, numericMatrix)] : payload.problemType === 'tsp' ? [field('cityCount', 'integer', '城市数量。'), field('cities', 'array', '城市信息，没有附加信息时为空数组。'), field('distanceMatrix', 'array', '城市距离矩阵。', true, numericMatrix)] : payload.problemType === 'general' ? [field('adjacencyMatrix', 'array', 'QUBO 矩阵。', true, numericMatrix), field('generalInput', 'object', '提交时附带的建模快照。', false, generalInputFields)] : [field('matrix', 'array', '图的权重矩阵。', true, numericMatrix)];
    addChildren('input', [...input, field('methodType', 'string', '使用的算法。')]);
    addChildren('resultSummary', [field('runtime', 'number | null', '求解运行时间，秒；无记录时为 null。'), field('bestValue', 'number | null', '最佳目标值，不适用时为 null。'), field('usedColors', 'integer | null', '图着色使用颜色数，其他问题为 null。'), field('candidateCount', 'integer', '候选解数量。')]);
    addChildren('results', [field('runtime', 'number', '求解运行时间，秒。', false), field('candidates', 'array<object>', '候选解；模型可能返回额外字段，以实际响应为准。', false, [field('[]', 'object', '一个候选解。', true, [field('rank', 'integer', '候选解排名。', false), field('value', 'number', '候选解的目标值。', false), field('solution', 'array', '解向量，编码随问题和模型变化。', false, numericArray)])])]);
    fields.push(field('taskName', 'string', '任务名称。'), field('message', 'string', '完成状态说明。'), field('updatedAt', 'number', '最后更新时间，Unix 秒。'), field('queuePosition', 'integer', '有可用排队信息时返回。', false), field('runtime', 'number', '求解运行时间，秒。', false));
  }
  return withFieldExamples([field('data', 'object', '成功响应的业务数据。', true, fields), field('requestId', 'string', '请求编号，用于问题排查。')], JSON.parse(buildResponseExample(endpoint.id, payload)));
}

export const businessErrors: Record<string, { code: string; description: string; resolution: string }[]> = {
  submit: [
    { code: 'INVALID_TASK', description: '任务参数不符合求解要求。', resolution: '检查问题类型、矩阵、规模及模型算法组合。' },
    { code: 'EMAIL_BINDING_REQUIRED', description: '账号尚未验证邮箱。', resolution: '在账号设置中绑定并验证邮箱。' },
    { code: 'QUOTA_EXHAUSTED', description: '对应模型可用额度不足。', resolution: '等待占用额度释放或申请更多额度。' },
    { code: 'TASK_NAME_EXISTS', description: '任务名称已存在。', resolution: '更换名称，或省略 taskName 自动生成。' },
    { code: 'INVALID_IDEMPOTENCY_KEY', description: '提交标识格式不正确。', resolution: '使用 1–128 个无空白 ASCII 字符。' },
    { code: 'IDEMPOTENCY_CONFLICT', description: '同一提交标识已关联不同参数。', resolution: '重试保留原参数；提交新任务使用新标识。' },
    { code: 'TASK_SUBMIT_IN_PROGRESS', description: '本账号的同一模型有任务正在提交。', resolution: '稍后使用相同标识及参数重试。' },
    { code: 'TASK_QUEUE_FULL', description: '任务队列已满。', resolution: '稍后使用相同提交标识重试。' },
    { code: 'ACCOUNT_MERGING', description: '账号合并正在进行。', resolution: '等待合并完成后重新创建密钥。' },
  ],
  status: [{ code: 'TASK_NOT_FOUND', description: '任务不存在、已删除或不属于本账号。', resolution: '确认 taskId 和密钥所属账号。' }],
  result: [
    { code: 'TASK_NOT_FOUND', description: '任务不存在、已删除或不属于本账号。', resolution: '确认 taskId 和密钥所属账号。' },
    { code: 'TASK_NOT_COMPLETED', description: '任务仍在排队或计算。', resolution: '查询状态，等待 completed 后再获取结果。' },
    { code: 'TASK_FAILED', description: '任务计算失败。', resolution: '查询状态中的 message 和 solveLogs，排查失败原因。' },
    { code: 'TASK_CANCELLED', description: '任务已取消。', resolution: '此任务没有完成结果。' },
  ],
  list: [{ code: 'INVALID_TASK', description: '分页参数或状态筛选不合法。', resolution: 'page ≥ 1，pageSize 为 1–100；state 使用支持的任务状态。' }],
  cancel: [
    { code: 'TASK_NOT_FOUND', description: '任务不存在、已删除或不属于本账号。', resolution: '确认 taskId 和密钥所属账号。' },
    { code: 'TASK_NOT_CANCELLABLE', description: '任务已完成、失败或取消。', resolution: '查询当前状态，只取消排队或运行中的任务。' },
  ], quota: [],
};

export const taskStates = [
  { value: 'queued', label: '等待处理', next: '继续查询状态' },
  { value: 'processing', label: '计算中', next: '继续查询状态' },
  { value: 'completed', label: '已完成', next: '获取并保存结果' },
  { value: 'failed', label: '失败', next: '停止轮询，查看 message' },
  { value: 'cancelled', label: '已取消', next: '停止轮询' },
];

export function buildTaskPayload(problemType: string, modelType: ApiModelType = 'classic') {
  const matrix = problemType === 'number_partition' ? [1, 2, 3, 4] : problemType === 'general' ? [[1, -2], [0, 1]] : [[0, 1], [1, 0]];
  return { problemType, modelType, ...(modelType === 'classic' ? { methodType: 'sa' } : {}), matrixSize: matrix.length, adjacencyMatrix: matrix };
}

export function buildCompleteTaskExample(baseUrl: string, payload = buildTaskPayload('maxcut')) {
  const example = problemExamples.find(item => item.value === payload.problemType) || problemExamples[0];
  return example.script.replace(/^BASE_URL = .*$/m, () => `BASE_URL = ${JSON.stringify(baseUrl)}`)
    .replace(/^PAYLOAD = .*$/m, () => `PAYLOAD = ${JSON.stringify(payload)}`);
}

export function buildRequestExample(endpoint: ApiEndpointDoc, baseUrl: string, language: ExampleLanguage, payload = buildTaskPayload('maxcut')) {
  const submits = endpoint.id === 'submit';
  const query = endpoint.id === 'list' ? '?page=1&pageSize=20' : '';
  const taskPath = endpoint.path.replace('{taskId}', 't_abcdefghijklmnop') + query;
  if (language === 'curl') {
    const lines = [`curl --request ${endpoint.method} "${baseUrl}${taskPath}"`, '  --header "Authorization: Bearer YOUR_API_KEY"'];
    if (submits) lines.push('  --header "Content-Type: application/json"', '  --header "Idempotency-Key: YOUR_UNIQUE_REQUEST_ID"', `  --data '${JSON.stringify(payload, null, 2)}'`);
    return lines.join(' \\\n');
  }
  const lines = ['import json', 'from urllib.request import Request, urlopen', '',
    `BASE_URL = ${JSON.stringify(baseUrl)}`, 'API_KEY = "YOUR_API_KEY"  # 替换为你的密钥', '',
    'headers = {"Authorization": "Bearer " + API_KEY}'];
  if (submits) {
    lines.push('IDEMPOTENCY_KEY = "YOUR_UNIQUE_REQUEST_ID"  # 新任务换成唯一标识，保存后在重试时复用',
      'headers["Content-Type"] = "application/json"', 'headers["Idempotency-Key"] = IDEMPOTENCY_KEY', '',
      `payload = ${JSON.stringify(payload, null, 2)}`, 'body = json.dumps(payload).encode("utf-8")');
  }
  if (endpoint.path.includes('{taskId}')) lines.push('', 'TASK_ID = "t_abcdefghijklmnop"  # 替换为已提交的任务 ID');
  const url = endpoint.path.includes('{taskId}') ? `f"{BASE_URL}${endpoint.path.replace('{taskId}', '{TASK_ID}')}"` : `BASE_URL + "${taskPath}"`;
  lines.push('', `request = Request(${url},`, `                  headers=headers, method="${endpoint.method}"${submits ? ', data=body' : ''})`,
    'with urlopen(request, timeout=30) as response:', '    result = json.load(response)', '',
    'print(json.dumps(result, ensure_ascii=False, indent=2))');
  return lines.join('\n');
}

export function buildResponseExample(id: string, payload = buildTaskPayload('maxcut')) {
  const taskId = 't_abcdefghijklmnop';
  const taskName = 'Task_efghijklmnop';
  let data: unknown;
  if (id === 'submit') data = { taskId, state: 'queued', replayed: false, message: '任务已接收并加入处理队列', queuePosition: 1, statusUrl: `/api/v1/tasks/${taskId}`, resultUrl: `/api/v1/tasks/${taskId}/result` };
  else if (id === 'status') data = { taskId, taskName, state: 'queued', message: '任务已加入队列，等待处理', updatedAt: 1791763200, queuePosition: 1, solveLogs: [] };
  else if (id === 'list') data = { tasks: [{ taskId, taskName, problemType: 'maxcut', modelType: 'classic', state: 'completed', source: 'api', createdAt: 1791763200 }], page: 1, pageSize: 20, total: 1, totalPages: 1 };
  else if (id === 'cancel') data = { taskId, state: 'cancelled', cancelled: true, message: '任务已取消', solveLogs: [] };
  else if (id === 'quota') data = { quotaSummary: { defaultQuotas: { classic: 200, quantum: 100 }, models: { classic: { remaining: 199, pending: 1, available: 198, total: 200, default: 200, label: '经典计算' }, quantum: { remaining: 100, pending: 0, available: 100, total: 100, default: 100, label: '量子芯片模拟计算' } } } };
  else {
    const matrix = payload.adjacencyMatrix;
    const methodType = 'sa';
    // 示例候选解遵守实际求解器的编码，并根据输入计算对应目标值。
    const solution = Array.from({ length: payload.matrixSize }, (_, index) => {
      if (payload.problemType === 'number_partition') return [1, -1, -1, 1][index % 4];
      if (payload.problemType === 'maxcut') return index % 2 === 0 ? -1 : 1;
      if (payload.problemType === 'general') return index % 2;
      return index; // 图着色为颜色编号，TSP 为城市访问顺序。
    });
    const weights = matrix as number[][];
    let value = 0;
    if (payload.problemType === 'number_partition') {
      value = Math.abs((matrix as number[]).reduce((sum, number, index) => sum + number * solution[index], 0));
    } else if (payload.problemType === 'maxcut') {
      value = weights.reduce((sum, row, i) => sum + row.reduce((cut, weight, j) => cut + (j > i && solution[i] !== solution[j] ? weight : 0), 0), 0);
    } else if (payload.problemType === 'tsp') {
      value = solution.reduce((sum, city, step) => sum + weights[city][solution[(step + 1) % solution.length]], 0);
    } else if (payload.problemType === 'general') {
      value = weights.reduce((sum, row, i) => sum + row.reduce((cost, weight, j) => cost + weight * solution[i] * solution[j], 0), 0);
    }
    const usedColors = payload.problemType === 'coloring' ? new Set(solution).size : null;
    const input = payload.problemType === 'number_partition' ? { numbers: matrix, methodType } : payload.problemType === 'coloring' ? { nodeCount: matrix.length, adjacencyMatrix: matrix, methodType } : payload.problemType === 'tsp' ? { cityCount: matrix.length, cities: [], distanceMatrix: matrix, methodType } : payload.problemType === 'general' ? { adjacencyMatrix: matrix, methodType } : { matrix, methodType };
    data = { taskId, taskName, state: 'completed', message: '计算完成', updatedAt: 1791763200, input, taskInfo: { taskId, taskName, source: 'api', ...payload, methodType, createdAt: 1791763200000 }, resultSummary: { runtime: 0.0125, bestValue: value, usedColors, candidateCount: 1 }, results: { runtime: 0.0125, candidates: [{ rank: 1, value, solution }] }, solveLogs: [] };
  }
  return JSON.stringify({ data, requestId: '0123456789abcdef0123456789abcdef' }, null, 2);
}
