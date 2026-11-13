import maxcut from './examples/maxcut.py?raw';
import number from './examples/number_partition.py?raw';
import coloring from './examples/coloring.py?raw';
import tsp from './examples/tsp.py?raw';
import general from './examples/general.py?raw';
import batchWorkflow from './examples/batch.py?raw';

export const problemExamples = [
  { value: 'maxcut', label: '图分割', size: '经典 2–256；量子单台 2–1024／多台 2–4096', input: '对称方阵，对角线为 0；权重 0–30，最多一位小数。', script: maxcut },
  { value: 'number_partition', label: '数字分割', size: '经典 2–256；量子单台 2–1024／多台 2–4096', input: '一维整数数组，长度等于 matrixSize；元素绝对值不超过 1,000,000。', script: number },
  { value: 'coloring', label: '图着色', size: '经典 2–16；量子单台 2–32／多台 2–64', input: '对称 0/1 方阵，对角线为 0。', script: coloring },
  { value: 'tsp', label: '旅行商', size: '经典 2–16；量子单台 2–32／多台 2–64', input: '对称距离方阵，对角线为 0；其余距离为 0.1–100,000。', script: tsp },
  { value: 'general', label: '一般 QUBO', size: '经典 2–256；量子单台 2–1024／多台 2–4096', input: 'QUBO 方阵，允许非对称及非零对角线；矩阵元素绝对值不超过 100,000。', script: general },
];

export type ExampleLanguage = 'python' | 'curl';
export type ApiModelType = 'classic' | 'quantum';
export type ApiDeviceMode = 'single-auto' | 'single-manual' | 'multi-auto' | 'multi-manual';
export const quantumDeviceExamples: { value: ApiDeviceMode; label: string }[] = [
  { value: 'single-auto', label: '单台自动分配' },
  { value: 'single-manual', label: '单台指定设备' },
  { value: 'multi-auto', label: '多台自动分配' },
  { value: 'multi-manual', label: '多台指定设备' },
];
export interface ApiTaskPayload {
  problemType: string;
  modelType: ApiModelType;
  methodType?: string;
  matrixSize: number;
  adjacencyMatrix: number[] | number[][];
  computeMode?: 'single' | 'multi';
  deviceSelection?: 'auto' | 'manual';
  deviceIds?: number[];
  deviceCount?: number;
  generalInput?: typeof generalInputExample;
}
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
const quantumSelectionFields: ApiDocField[] = [
  { ...field('computeMode', 'string', '仅 quantum：single（单台）或 multi（多台）。携带设备参数时默认 single；完全省略设备参数则保留旧协议。', false), default: 'single', example: 'single' },
  { ...field('deviceSelection', 'string', '仅 quantum：auto（自动分配）或 manual（指定设备），默认 auto。', false), default: 'auto', example: 'auto' },
  { ...field('deviceIds', 'array<integer>', '仅 quantum + manual 时必填：单台恰好一个，多台至少两个，不可重复。默认编号 1–6，部署可配置；auto 禁止携带。', false, [field('[]', 'integer', '已配置的 Ising 设备编号；默认 1–6。')]), example: [3] },
  { ...field('deviceCount', 'integer', '仅 quantum + multi + auto 可选，默认范围 2–6，部署可配置。不填按编码后的规模分配至少两台；manual 或 single 禁止携带。', false), example: 2 },
];
const solverResultFields = (): ApiDocField[] => [
  field('runtime', 'number', '求解运行时间，秒。', false),
  field('candidates', 'array<object>', '候选解；模型可能返回额外字段，以实际响应为准。', false, [field('[]', 'object', '一个候选解。', true, [field('rank', 'integer', '候选解排名。', false), field('value', 'number', '候选解的目标值。', false), field('solution', 'array<number> | array<array<number>>', '解向量或编码矩阵，结构随问题和模型变化；下方经典示例使用一维向量。', false)])]),
  field('fpga', 'object', '量子任务的实际设备信息；经典任务和部分历史任务可能没有。', false, [
    field('device_ids', 'array<integer>', '实际参与计算的 Ising 设备编号；与请求的 deviceIds 区分，自动分配时以此为准。', false, [field('[]', 'integer', '实际设备编号。')]),
    field('decomposed', 'boolean', '是否使用多板分解协同计算。', false),
    field('failover_count', 'integer', '自动分配单板任务的故障切换次数；指定设备不自动换板。', false),
  ]),
];
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
  field('expression', 'string', '原始目标表达式字符串，最多 10,000 字符；expression 来源且 expressionForm=scalar 时不可为空白，其他情况可传空字符串。'),
  field('matrixObjective', 'object', '原始矩阵目标的文本快照，以下字段均传字符串。', true, [
    field('kind', 'string', 'quadratic 或 maxcut。'), field('weightMatrix', 'string', '权重矩阵文本，最多 2,097,152 字符。'), field('linearVector', 'string', '线性项向量文本，最多 10,000 字符。'), field('constant', 'string', '常数项文本，最多 10,000 字符。'),
  ]),
  field('constraints', 'array<object>', '约束说明，最多 50 条；无约束传空数组。', true, [field('[]', 'object', '一条约束。', true, [
    field('coefficients', 'string', '系数向量文本，最多 10,000 字符。'), field('operator', 'string', '<=、== 或 >=。'), field('rhs', 'string | number', '右端值，数值须有限；字符串最多 128 字符。'), field('penalty', 'number', '大于 0 的有限惩罚系数。'),
  ])]),
];
const logFields = [field('[]', 'object', '一条求解事件；历史任务可能没有日志。', true, [
  field('sequence', 'integer', '事件顺序，从 1 开始；裁剪旧日志后序号可能不连续。'), field('state', 'string', 'received 或任务状态。'), field('message', 'string', '事件说明。'),
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

const taskIdParameter: ApiDocField = { name: 'taskId', type: 'string', required: true, description: '本账号的任务 ID，支持网页、小程序和 API 创建的任务。' };
const stateField: ApiDocField = { name: 'state', type: 'string', description: 'queued、processing、completed、failed 或 cancelled。' };
const logsField: ApiDocField = { name: 'solveLogs', type: 'array', description: '求解事件日志，最多 200 条；超限保留首条接收事件及最近 199 条，历史任务可能为空数组。' };

export const apiEndpoints: ApiEndpointDoc[] = [
  {
    id: 'submit', title: '提交单个任务', method: 'POST', path: '/tasks', success: 202,
    description: '提交任务并返回任务 ID，计算异步执行。', parameterLocation: '请求体 · application/json',
    parameters: [
      { name: 'problemType', type: 'string', required: false, default: 'maxcut', description: '问题类型：maxcut、number_partition、coloring、tsp 或 general。建议显式指定。' },
      { name: 'modelType', type: 'string', required: false, default: 'classic', description: 'classic 为经典计算，quantum 为量子芯片模拟计算。' },
      { name: 'methodType', type: 'string', required: false, default: 'sa', description: '经典算法：sa、tabu、genetic、hill_climb、ils、random_search。量子模型可省略，也接受 fpga；实际使用设备端量子求解。' },
      ...quantumSelectionFields,
      { name: 'matrixSize', type: 'integer', required: true, description: '矩阵阶数或数字数组长度。quantum 单台：最大割、数字分割、一般 QUBO 为 2–1024，图着色、TSP 为 2–32；multi（集群／多台）分别为 2–4096、2–64。不传 computeMode 按单台上限校验；classic 保持 2–256／2–16。' },
      { name: 'adjacencyMatrix', type: 'array', required: true, description: '问题数据。数字分割为一维数组，其他问题为方阵；general 直接传入 QUBO 矩阵。' },
      { name: 'taskName', type: 'string', required: false, default: '问题类型前缀_毫秒时间戳', description: '最多 64 个字符，同一用户的已有任务名称不能重复。留空时按网页相同格式自动生成，例如 Coloring_1791763200000；重名时追加任务 ID 后缀。' },
      { name: 'generalInput', type: 'object', required: false, description: '仅 general 可选，保存建模说明；实际求解使用 adjacencyMatrix。整个快照的 JSON 序列化内容最多 3 MiB。' },
    ],
    responseFields: [
      { name: 'taskId', type: 'string', description: '用于查询状态、获取结果或取消任务。' },
      { ...stateField, description: '新受理任务为 queued；幂等重放返回原任务当前状态，原任务已删除时为 null。' },
      { name: 'statusUrl', type: 'string', description: '状态查询路径，相对于 API 域名。' },
      { name: 'resultUrl', type: 'string', description: '结果查询路径，相对于 API 域名。' },
      { name: 'replayed', type: 'boolean', description: 'true 表示返回该幂等键对应的已提交任务，不会创建新任务。' },
      { name: 'queuePosition', type: 'integer', description: '可获取时返回，表示排队位置。' },
    ],
    notes: ['提交成功表示任务已接收；请通过状态接口等待 completed，再获取结果。', '建议携带 Idempotency-Key：同账号在 24 小时内使用相同标识和参数提交，将返回同一任务 ID；参数不一致时返回 IDEMPOTENCY_CONFLICT。', '任务详情已删除时，使用相同标识重试仍返回该任务 ID，并标记 taskDeleted=true、state=null。'],
  },
  {
    id: 'status', title: '查询单个任务状态', method: 'GET', path: '/tasks/{taskId}', success: 200,
    description: '查看任务当前状态、排队信息和求解日志。建议每 2 秒查询一次。', parameterLocation: '路径参数', parameters: [taskIdParameter],
    responseFields: [{ name: 'taskId', type: 'string', description: '任务 ID。' }, { name: 'taskName', type: 'string', description: '任务名称。' }, stateField,
      { name: 'message', type: 'string', description: '当前阶段的说明或失败原因。' },
      { name: 'updatedAt', type: 'number', description: '最后更新时间，Unix 时间戳，单位为秒。' }, logsField,
      { name: 'queuePosition', type: 'integer', description: '仅 queued 且可查询到当前队列位置时返回；其他状态或队列信息不可用时省略。' }],
    notes: ['任务 failed 或 cancelled 时停止轮询，查看 message，不要自动重新提交。', '任务不存在、已删除或不属于当前用户时统一返回 TASK_NOT_FOUND。'],
  },
  {
    id: 'result', title: '获取单个任务结果', method: 'GET', path: '/tasks/{taskId}/result', success: 200,
    description: '任务 completed 后，获取输入摘要、结果摘要与完整求解结果。', parameterLocation: '路径参数', parameters: [taskIdParameter],
    responseFields: [{ name: 'taskId', type: 'string', description: '任务 ID。' }, { ...stateField, description: '成功响应固定为 completed；其他任务状态返回 HTTP 409 的 error 分支。' },
      { name: 'taskInfo', type: 'object', description: '任务名称、问题、模型、算法和规模；其中 createdAt 为 Unix 毫秒时间戳。' },
      { name: 'input', type: 'object', description: '问题输入摘要；具体结构随 problemType 变化。' },
      { name: 'resultSummary', type: 'object', description: 'runtime（秒）、bestValue、usedColors 和 candidateCount。不适用的摘要字段可能为 null。' },
      { name: 'results', type: 'object', description: '完整求解结果，候选解位于 candidates。' }, logsField],
    notes: ['仅 completed 返回 HTTP 200 和 data。queued 或 processing 返回 HTTP 409 TASK_NOT_COMPLETED；failed 返回 HTTP 409 TASK_FAILED；cancelled 返回 HTTP 409 TASK_CANCELLED。错误响应为顶层 error 和 requestId，不包含成功响应的 data。', '请及时保存 results。结果保留期限与网页任务相同，取决于服务的清理配置。'],
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
    id: 'cancel', title: '取消单个任务', method: 'POST', path: '/tasks/{taskId}/cancel', success: 200,
    description: '取消排队或处理中的任务。请求无需 JSON 请求体。', parameterLocation: '路径参数', parameters: [taskIdParameter],
    responseFields: [{ name: 'taskId', type: 'string', description: '已取消任务的 ID。' }, { name: 'state', type: 'string', description: 'cancelled。' },
      { name: 'cancelled', type: 'boolean', description: '成功取消时为 true。' }, { name: 'message', type: 'string', description: '取消状态说明。' }, logsField],
    notes: ['仅 queued 或 processing 可取消。completed、failed 或 cancelled 返回 HTTP 409 TASK_NOT_CANCELLABLE；重复取消已取消任务也返回此错误，与批量取消的重放行为不同。', '取消后释放该任务占用的可用额度。'],
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
  if (endpoint.id === 'submit') endpoint.responseFields.push(field('message', 'string', '接收或幂等重放说明，始终返回。'), { ...logsField, description: '新任务受理时返回；幂等重放时省略。最多 200 条，保留首条接收事件及最近事件。', type: 'array<object>', children: logFields, required: false }, field('taskDeleted', 'boolean', '仅幂等记录对应任务已删除时返回 true，此时 state 为 null。', false));
  if (endpoint.id === 'list') endpoint.responseFields[0].children = [field('[]', 'object', '一个任务。', true, [
    field('taskId', 'string', '任务 ID。'), field('taskName', 'string', '任务名称。'), field('problemType', 'string', '问题类型。'), field('modelType', 'string', '计算模型。'), field('state', 'string', '任务状态。'), field('source', 'string', 'web、miniprogram 或 api。'), field('createdAt', 'number', '创建时间，Unix 秒时间戳。'),
  ])];
}

export function requestDocFields(endpoint: ApiEndpointDoc, payload = buildTaskPayload('maxcut')): ApiDocField[] {
  if (endpoint.id === 'batch-submit') return withFieldExamples([field('tasks', 'array<object>', '1–50 项；请求体只能包含 tasks，每项只能包含 idempotencyKey 和 payload；整个请求最多 512 MiB。', true, [
    field('[]', 'object', '一项独立任务。', true, [field('idempotencyKey', 'string', '1–128 个无空白 ASCII 字符，批内唯一；24 小时内重试保持标识和参数不变。'),
      field('payload', 'object', '完整任务参数；服务端 UTF-8 序列化后的参数及接收日志须不超过 511 MiB，另预留 1 MiB 状态日志空间；矩阵字段须不超过 512 MiB。', true, requestDocFields(apiEndpoints.find(item => item.id === 'submit')!, payload))]),
  ])], batchRequestBody(endpoint.id, payload));
  if (endpoint.id.startsWith('batch-')) return withFieldExamples(endpoint.parameters, batchRequestBody(endpoint.id, payload));
  const values = { ...payload, taskId: 't_abcdefghijklmnop', taskName: '示例任务', page: 1, pageSize: 20, state: 'completed', generalInput: generalInputExample };
  return withFieldExamples(endpoint.parameters.map(item => item.name === 'adjacencyMatrix' ? { ...item, type: payload.problemType === 'number_partition' ? 'array<integer>' : 'array<array<number>>', children: payload.problemType === 'number_partition' ? [field('[]', 'integer', '数字数组元素。')] : numericMatrix } : item), values);
}

export function responseDocFields(endpoint: ApiEndpointDoc, payload = buildTaskPayload('maxcut')): ApiDocField[] {
  const fields = endpoint.responseFields.map(item => ({ ...item }));
  if (endpoint.id === 'result') {
    const addChildren = (name: string, children: ApiDocField[]) => { const item = fields.find(item => item.name === name); if (item) item.children = children; };
    addChildren('taskInfo', [field('taskId', 'string', '任务 ID。'), field('taskName', 'string', '任务名称。'), field('source', 'string', '提交来源。'), field('problemType', 'string', '问题类型。'), field('modelType', 'string', '计算模型。'), field('methodType', 'string', '保存的经典算法名；fpga 或缺失值当前序列化为 sa，量子任务仍按 modelType 执行。'), field('matrixSize', 'integer', '矩阵阶数或数组长度。'), field('createdAt', 'integer', '创建时间，Unix 毫秒时间戳。'), field('adjacencyMatrix', payload.problemType === 'number_partition' ? 'array<integer>' : 'array', '原始问题数据；数字分割为一维整数数组，其他问题为方阵。', true, payload.problemType === 'number_partition' ? [field('[]', 'integer', '数字数组元素。')] : numericMatrix), field('extra', 'object', '任务保存的其他参数（如原始 methodType），按实际任务返回。', false), ...quantumSelectionFields]);
    const input = payload.problemType === 'number_partition' ? [field('numbers', 'array<integer>', '待分割数字。', true, [field('[]', 'integer', '数字数组元素。')])] : payload.problemType === 'coloring' ? [field('nodeCount', 'integer', '节点数量。'), field('adjacencyMatrix', 'array', '图的邻接矩阵。', true, numericMatrix)] : payload.problemType === 'tsp' ? [field('cityCount', 'integer', '城市数量。'), field('cities', 'array', '城市信息，没有附加信息时为空数组。'), field('distanceMatrix', 'array', '城市距离矩阵。', true, numericMatrix)] : payload.problemType === 'general' ? [field('adjacencyMatrix', 'array', 'QUBO 矩阵。', true, numericMatrix), field('generalInput', 'object', '提交时附带的建模快照。', false, generalInputFields)] : [field('matrix', 'array', '图的权重矩阵。', true, numericMatrix)];
    addChildren('input', [...input, field('methodType', 'string', '与 taskInfo.methodType 相同的序列化算法名；不能据此判断量子任务的实际求解方式。'), ...quantumSelectionFields]);
    addChildren('resultSummary', [field('runtime', 'number | null', '求解运行时间，秒；无记录时为 null。'), field('bestValue', 'number | null', '最佳目标值，不适用时为 null。'), field('usedColors', 'integer | null', '图着色使用颜色数，其他问题为 null。'), field('candidateCount', 'integer', '候选解数量。')]);
    addChildren('results', solverResultFields());
    fields.push(field('taskName', 'string', '任务名称。'), field('message', 'string', '完成状态说明。'), field('updatedAt', 'number', '最后更新时间，Unix 秒。'), field('queuePosition', 'integer', '有可用排队信息时返回。', false), field('runtime', 'number', '求解运行时间，秒。', false));
  }
  if (endpoint.id === 'batch-results') {
    const item = fields.find(field => field.name === 'tasks')?.children?.[0];
    const results = item?.children?.find(field => field.name === 'results');
    if (results) {
      // Clone the nested schema before adding examples; endpoint definitions are shared.
      const tasks = fields.find(field => field.name === 'tasks')!;
      tasks.children = [{ ...item!, children: item!.children!.map(field => field.name === 'results' ? { ...field, children: solverResultFields() } : field) }];
    }
  }
  return withFieldExamples([field('data', 'object', '成功响应的业务数据。', true, fields), field('requestId', 'string', '请求编号，用于问题排查。')], JSON.parse(buildResponseExample(endpoint.id, payload)));
}

export const businessErrors: Record<string, { code: string; description: string }[]> = {
  submit: [
    { code: 'INVALID_TASK', description: '任务参数不符合求解要求。' },
    { code: 'EMAIL_BINDING_REQUIRED', description: '账号尚未验证邮箱。' },
    { code: 'QUOTA_EXHAUSTED', description: '对应模型可用额度不足。' },
    { code: 'TASK_NAME_EXISTS', description: '任务名称已存在。' },
    { code: 'INVALID_IDEMPOTENCY_KEY', description: '提交标识格式不正确。' },
    { code: 'IDEMPOTENCY_CONFLICT', description: '同一提交标识已关联不同参数。' },
    { code: 'TASK_QUEUE_FULL', description: '任务队列已满。' },
    { code: 'TASK_ADMISSION_UNAVAILABLE', description: '暂时无法受理任务。' },
    { code: 'TASK_ADMISSION_EXPIRED', description: '任务受理超时。' },
    { code: 'REQUEST_TOO_LARGE', description: '请求体超过 512 MiB 上限。' },
    { code: 'ACCOUNT_MERGING', description: '账号合并正在进行。' },
  ],
  status: [{ code: 'TASK_NOT_FOUND', description: '任务不存在、已删除或不属于本账号。' }],
  result: [
    { code: 'TASK_NOT_FOUND', description: '任务不存在、已删除或不属于本账号。' },
    { code: 'TASK_NOT_COMPLETED', description: '任务仍在排队或计算。' },
    { code: 'TASK_FAILED', description: '任务计算失败。' },
    { code: 'TASK_CANCELLED', description: '任务已取消。' },
  ],
  list: [{ code: 'INVALID_TASK', description: '分页参数或状态筛选不合法。' }],
  cancel: [
    { code: 'TASK_NOT_FOUND', description: '任务不存在、已删除或不属于本账号。' },
    { code: 'TASK_NOT_CANCELLABLE', description: '当前任务状态不支持取消。' },
  ], quota: [],
};

export const taskStates = [
  { value: 'queued', label: '等待处理', next: '继续查询状态' },
  { value: 'processing', label: '计算中', next: '继续查询状态' },
  { value: 'completed', label: '已完成', next: '获取并保存结果' },
  { value: 'failed', label: '失败', next: '停止轮询，查看 message' },
  { value: 'cancelled', label: '已取消', next: '停止轮询' },
];

export function buildTaskPayload(problemType: string, modelType: ApiModelType = 'classic', deviceMode: ApiDeviceMode = 'single-auto'): ApiTaskPayload {
  const matrix = problemType === 'number_partition' ? [1, 2, 3, 4] : problemType === 'general' ? [[1, -2], [0, 1]] : [[0, 1], [1, 0]];
  const selection = modelType === 'quantum' ? {
    computeMode: deviceMode.startsWith('multi') ? 'multi' as const : 'single' as const,
    deviceSelection: deviceMode.endsWith('manual') ? 'manual' as const : 'auto' as const,
    ...(deviceMode.endsWith('manual') ? { deviceIds: deviceMode.startsWith('multi') ? [1, 3] : [3] } : {}),
  } : {};
  return { problemType, modelType, ...(modelType === 'classic' ? { methodType: 'sa' } : {}), ...selection, matrixSize: matrix.length, adjacencyMatrix: matrix };
}

export function buildCompleteTaskExample(baseUrl: string, payload = buildTaskPayload('maxcut')) {
  const example = problemExamples.find(item => item.value === payload.problemType) || problemExamples[0];
  return example.script.replace(/^BASE_URL = .*$/m, () => `BASE_URL = ${JSON.stringify(baseUrl)}`)
    .replace(/^PAYLOAD = .*$/m, () => `PAYLOAD = ${JSON.stringify(payload)}`);
}

export function buildRequestExample(endpoint: ApiEndpointDoc, baseUrl: string, language: ExampleLanguage, payload = buildTaskPayload('maxcut')) {
  const submits = endpoint.id === 'submit';
  const batch = endpoint.id.startsWith('batch-');
  const bodyPayload = batch ? batchRequestBody(endpoint.id, payload) : payload;
  const query = endpoint.id === 'list' ? '?page=1&pageSize=20' : '';
  const taskPath = endpoint.path.replace('{taskId}', 't_abcdefghijklmnop') + query;
  if (language === 'curl') {
    const lines = [`curl --request ${endpoint.method} "${baseUrl}${taskPath}"`, '  --header "Authorization: Bearer YOUR_API_KEY"'];
    if (submits) lines.push('  --header "Content-Type: application/json"', '  --header "Idempotency-Key: YOUR_UNIQUE_REQUEST_ID"', `  --data '${JSON.stringify(payload, null, 2)}'`);
    if (batch) lines.push('  --header "Content-Type: application/json"', `  --data '${JSON.stringify(bodyPayload, null, 2)}'`);
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
  if (batch) lines.push('headers["Content-Type"] = "application/json"', '',
    `payload = ${JSON.stringify(bodyPayload, null, 2)}`, 'body = json.dumps(payload).encode("utf-8")');
  if (endpoint.path.includes('{taskId}')) lines.push('', 'TASK_ID = "t_abcdefghijklmnop"  # 替换为已提交的任务 ID');
  const url = endpoint.path.includes('{taskId}') ? `f"{BASE_URL}${endpoint.path.replace('{taskId}', '{TASK_ID}')}"` : `BASE_URL + "${taskPath}"`;
  lines.push('', `request = Request(${url},`, `                  headers=headers, method="${endpoint.method}"${submits || batch ? ', data=body' : ''})`,
    `with urlopen(request, timeout=${payload.modelType === 'quantum' ? 300 : 30}) as response:`, '    result = json.load(response)', '',
    'print(json.dumps(result, ensure_ascii=False, indent=2))');
  return lines.join('\n');
}

export function buildResponseExample(id: string, payload = buildTaskPayload('maxcut')) {
  const taskId = 't_abcdefghijklmnop';
  const prefixes: Record<string, string> = { maxcut: 'MaxCut', coloring: 'Coloring', number_partition: 'NumberPartition', tsp: 'TSP', general: 'General' };
  const taskName = `${prefixes[payload.problemType] || 'MaxCut'}_1791763200000`;
  const submittedLogs = [
    { sequence: 1, state: 'received', message: '后端已接收任务', timestampNs: '1791763200000000000', timestamp: '2026-10-12T08:00:00.000000000+08:00', elapsedSeconds: 0 },
    { sequence: 2, state: 'queued', message: '任务已加入队列，等待处理', timestampNs: '1791763200001000000', timestamp: '2026-10-12T08:00:00.001000000+08:00', elapsedSeconds: 0.001 },
  ];
  let data: unknown;
  if (id === 'batch-submit') data = { tasks: [{ index: 0, idempotencyKey: 'YOUR_UNIQUE_REQUEST_ID_1', taskId, state: 'queued', replayed: false, statusUrl: `/api/v1/tasks/${taskId}`, resultUrl: `/api/v1/tasks/${taskId}/result` }], acceptedCount: 1, replayedCount: 0 };
  else if (id === 'batch-status') data = { tasks: [{ taskId, taskName, state: 'completed', message: '计算完成', updatedAt: 1791763200 }], successCount: 1, errorCount: 0 };
  else if (id === 'batch-results') {
    const result = JSON.parse(buildResponseExample('result', payload)).data;
    data = { tasks: [{ taskId, state: 'completed', results: result.results, resultSummary: { runtime: result.resultSummary.runtime, bestValue: result.resultSummary.bestValue, usedColors: result.resultSummary.usedColors } }], successCount: 1, errorCount: 0 };
  }
  else if (id === 'batch-cancel') data = { tasks: [{ taskId, state: 'cancelled', cancelled: true, message: '任务已取消' }], successCount: 1, errorCount: 0 };
  else if (id === 'submit') data = { taskId, state: 'queued', replayed: false, message: '任务已接收并加入处理队列', solveLogs: submittedLogs, queuePosition: 1, statusUrl: `/api/v1/tasks/${taskId}`, resultUrl: `/api/v1/tasks/${taskId}/result` };
  else if (id === 'status') data = { taskId, taskName, state: 'queued', message: '任务已加入队列，等待处理', updatedAt: 1791763200, queuePosition: 1, solveLogs: [] };
  else if (id === 'list') data = { tasks: [{ taskId, taskName, problemType: 'maxcut', modelType: 'classic', state: 'completed', source: 'api', createdAt: 1791763200 }], page: 1, pageSize: 20, total: 1, totalPages: 1 };
  else if (id === 'cancel') data = { taskId, state: 'cancelled', cancelled: true, message: '任务已取消', solveLogs: [] };
  else if (id === 'quota') data = { quotaSummary: { defaultQuotas: { classic: 10000, quantum: 10000 }, models: { classic: { remaining: 9999, pending: 1, available: 9998, total: 10000, default: 10000, label: '经典计算' }, quantum: { remaining: 10000, pending: 0, available: 10000, total: 10000, default: 10000, label: '量子芯片模拟计算' } } } };
  else {
    const matrix = payload.adjacencyMatrix;
    const methodType = payload.methodType && payload.methodType !== 'fpga' ? payload.methodType : 'sa';
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
    const input = payload.problemType === 'number_partition' ? { numbers: matrix, methodType } : payload.problemType === 'coloring' ? { nodeCount: matrix.length, adjacencyMatrix: matrix, methodType } : payload.problemType === 'tsp' ? { cityCount: matrix.length, cities: [], distanceMatrix: matrix, methodType } : payload.problemType === 'general' ? { adjacencyMatrix: matrix, methodType, ...(payload.generalInput ? { generalInput: payload.generalInput } : {}) } : { matrix, methodType };
    const selection = Object.fromEntries(Object.entries(payload)
      .filter(([key]) => ['computeMode', 'deviceSelection', 'deviceIds', 'deviceCount'].includes(key)));
    const actualIds = payload.deviceSelection === 'manual' ? payload.deviceIds || []
      : Array.from({ length: payload.computeMode === 'multi' ? payload.deviceCount || 2 : 1 }, (_, index) => index + 1);
    data = { taskId, taskName, state: 'completed', message: '计算完成', updatedAt: 1791763200, runtime: 0.0125, input: { ...input, ...selection }, taskInfo: { taskId, taskName, source: 'api', problemType: payload.problemType, modelType: payload.modelType, matrixSize: payload.matrixSize, adjacencyMatrix: matrix, methodType, createdAt: 1791763200000, ...selection, extra: { methodType: payload.methodType || 'sa', ...selection } }, resultSummary: { runtime: 0.0125, bestValue: value, usedColors, candidateCount: 1 }, results: { runtime: 0.0125, candidates: [{ rank: 1, value, solution }], ...(payload.modelType === 'quantum' ? { fpga: { device_ids: actualIds, decomposed: actualIds.length > 1, failover_count: 0 } } : {}) }, solveLogs: [] };
  }
  return JSON.stringify({ data, requestId: '0123456789abcdef0123456789abcdef' }, null, 2);
}

export function batchRequestBody(id: string, payload = buildTaskPayload('maxcut')) {
  return id === 'batch-submit' ? { tasks: [{ idempotencyKey: 'YOUR_UNIQUE_REQUEST_ID_1', payload }] }
    : { taskIds: ['t_abcdefghijklmnop'] };
}

export function buildCompleteBatchExample(baseUrl: string, payload = buildTaskPayload('maxcut')) {
  return batchWorkflow.replace(/^BASE_URL = .*$/m, () => `BASE_URL = ${JSON.stringify(baseUrl)}`)
    .replace(/^PAYLOAD = .*$/m, () => `PAYLOAD = ${JSON.stringify(payload)}`);
}

const batchItemError = field('error', 'object', '仅单项失败时返回；HTTP 200 不代表所有项成功。', false, [
  field('code', 'string', '该项错误码。'), field('message', 'string', '该项错误说明。'),
]);
const batchEndpoints: ApiEndpointDoc[] = [
  {
    id: 'batch-submit', title: '批量提交任务', method: 'POST', path: '/tasks/batch', success: 202,
    description: '一次提交 1–50 个任务，可混合问题类型与计算模型。校验失败时本次新任务均不受理。',
    parameterLocation: '请求体 · application/json', parameters: [field('tasks', 'array<object>', '任务数组，每项包含 idempotencyKey 与 payload。')],
    responseFields: [field('tasks', 'array<object>', '按输入顺序返回。', true, [field('[]', 'object', '每项任务的提交结果。', true, [
      field('index', 'integer', '输入下标，从 0 开始。'), field('idempotencyKey', 'string', '该项提交标识。'), field('taskId', 'string', '任务 ID。'),
      field('state', 'string | null', '新受理任务为 queued；幂等重放返回原任务当前状态，原任务已删除时为 null。'), field('replayed', 'boolean', '是否返回已提交的任务；为 true 时未创建新任务。'),
      field('taskDeleted', 'boolean', '任务详情已删除时为 true，不会重复创建任务。', false), field('statusUrl', 'string', '该任务的状态查询地址。'), field('resultUrl', 'string', '该任务的完整结果获取地址。'),
    ])]), field('acceptedCount', 'integer', '本次新受理的任务数。'), field('replayedCount', 'integer', '通过幂等标识返回的已提交任务数。')],
    notes: ['请求体最多 512 MiB，服务端自动分段处理，无需按 4 MiB 拆分请求。任一项参数、名称、额度或容量检查失败，本次新任务全部不受理；此前已受理任务不受影响。',
      '单个任务的完整参数及接收日志在服务端 UTF-8 序列化后须不超过 511 MiB，另预留 1 MiB 状态日志空间；矩阵字段须不超过 512 MiB。超限返回 INVALID_TASK，并标明任务下标，本次新任务全部不受理。',
      '每项必填独立 idempotencyKey，不传整批 Idempotency-Key 请求头。与单任务接口共享账号级 24 小时幂等记录。',
      '网络超时或返回 5xx 时，任务仍可能已受理。请使用相同的 idempotencyKey 和参数重试，避免重复创建任务。',
      '每个 HTTP 请求计 1 次提交，与单任务提交分别限流，重复提交也计数。计算次数额度仍按任务预留，成功完成后扣次，失败或取消后释放预留。'],
  },
  ...(['status', 'results', 'cancel'] as const).map(kind => ({
    id: `batch-${kind}`, title: { status: '批量查询状态', results: '批量获取结果', cancel: '批量取消任务' }[kind],
    method: 'POST' as const, path: `/tasks/batch-${kind}`, success: 200,
    description: { status: '查询当前状态、名称、消息和更新时间；不返回数值进度、排队位置或求解日志。建议每 2 秒查询，任务结束后停止。', results: '获取 completed 任务的结果及摘要，成功结果合计最多 8 MiB。其他任务状态返回单项 error，批量请求本身仍为 HTTP 200。', cancel: '批量取消任务，各项独立返回结果；已取消任务可重试。' }[kind],
    parameterLocation: '请求体 · application/json',
    parameters: [field('taskIds', 'array<string>', `任务 ID 数组，1–${{ status: 100, results: 20, cancel: 50 }[kind]} 项，不可重复；每个 ID 为 1–128 字符，请求体只能包含 taskIds，最多 4 MiB。`)],
    responseFields: [field('tasks', 'array<object>', '按输入顺序返回，各项可能成功或携带 error。', true, [field('[]', 'object', '单项结果。', true, [
      field('taskId', 'string', '请求中的任务 ID。'), field('state', 'string', kind === 'results' ? '成功项固定为 completed；其他任务状态返回该项 error。' : kind === 'cancel' ? '成功项固定为 cancelled。' : '成功项的任务状态：queued、processing、completed、failed 或 cancelled。', false),
      ...(kind === 'status' ? [field('taskName', 'string', '任务名称。', false), field('message', 'string', '状态说明。', false), field('updatedAt', 'number', '更新时间，Unix 秒。', false)]
        : kind === 'results' ? [field('results', 'object | null', '求解结果，结构与单任务结果中的 results 一致。', false), field('resultSummary', 'object', '成功项始终包含此对象及 runtime、bestValue、usedColors；字段值可为 null，不返回 candidateCount。', false, [field('runtime', 'number | null', '保存的求解运行时间，秒。'), field('bestValue', 'number | null', '保存的最佳目标值。'), field('usedColors', 'integer | null', '保存的图着色颜色数，不适用时为 null。')])]
        : [field('cancelled', 'boolean', '平台任务已取消并释放额度，成功项为 true。', false), field('replayed', 'boolean', '此前已取消时为 true；首次取消省略。', false), field('message', 'string', '首次取消成功时返回；已取消任务的重放项省略。', false)]), batchItemError,
    ])]), field('successCount', 'integer', '未携带 error 的项数。'), field('errorCount', 'integer', '携带 error 的项数。')],
    notes: ['请求体最多 4 MiB；任务不存在、已删除或不属于本账号统一返回单项 TASK_NOT_FOUND。',
      kind === 'status' ? '每 2 秒查询尚未结束的任务，遇到 429 遵循 Retry-After。每个 HTTP 请求计 1 次状态查询，与单任务状态查询分别限流，重复查询也计数。'
        : kind === 'results' ? '成功结果项的序列化内容总计最多 8 MiB；超限项返回 RESULT_TOO_LARGE，可分小批或使用单任务完整结果接口。每个 HTTP 请求计 1 次结果获取，与单任务结果获取分别限流，重复获取也计数。'
        : '每个 HTTP 请求计 1 次取消，与单任务取消分别限流，重复取消也计数。已取消任务可安全重试；已完成或失败返回 TASK_NOT_CANCELLABLE。任务取消后释放占用额度，计算设备可能稍后才停止执行。',
      'HTTP 200 表示批量处理结束，请逐项检查 error；不会因为一个任务失败而隐藏其他任务结果。'],
  })),
];
apiEndpoints.unshift(...batchEndpoints);
businessErrors['batch-submit'] = [...businessErrors.submit,
  { code: 'INVALID_BATCH', description: '批量任务格式、数量或提交标识不符合要求。' },
  { code: 'BATCH_UNAVAILABLE', description: '批量提交暂不可用。' },
];
for (const kind of ['status', 'results', 'cancel']) businessErrors[`batch-${kind}`] = [
  { code: 'REQUEST_TOO_LARGE', description: '请求体超过 4 MiB 上限。' },
  { code: 'INVALID_BATCH', description: '任务 ID 列表格式、数量或唯一性不符合要求。' },
  ...businessErrors[kind === 'results' ? 'result' : kind],
];
businessErrors['batch-results'].push(
  { code: 'RESULT_TOO_LARGE', description: '该项结果超出本批 8 MiB 上限。' },
  { code: 'RESULT_UNAVAILABLE', description: '任务结果暂时无法获取。' },
);
businessErrors['batch-cancel'].push({ code: 'CANCEL_UNCONFIRMED', description: '任务取消结果尚未确认。' });
