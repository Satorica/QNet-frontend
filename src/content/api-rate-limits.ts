export const defaultApiLimits = {
  submit: 6000, batchSubmit: 120,
  status: 18000, batchStatus: 600,
  result: 6000, batchResult: 600,
  cancel: 6000, batchCancel: 240,
  read: 600, quota: 120,
};

export type ApiOperation = keyof typeof defaultApiLimits;

export function apiOperation(endpointId: string): ApiOperation {
  const operations: Record<string, ApiOperation> = {
    submit: 'submit', 'batch-submit': 'batchSubmit',
    status: 'status', 'batch-status': 'batchStatus',
    result: 'result', 'batch-results': 'batchResult',
    cancel: 'cancel', 'batch-cancel': 'batchCancel',
    list: 'read', quota: 'quota',
  };
  return operations[endpointId] ?? 'read';
}

export const operationDescriptions: Record<ApiOperation, { label: string; counting: string }> = {
  submit: { label: '单任务提交', counting: '每个 HTTP 请求计 1 次，与批量提交分别限流。' },
  batchSubmit: { label: '批量提交', counting: '每个 HTTP 请求计 1 次，每批最多 100 个任务，与单任务提交分别限流。' },
  status: { label: '单任务状态查询', counting: '每个 HTTP 请求计 1 次，与批量状态查询分别限流。' },
  batchStatus: { label: '批量状态查询', counting: '每个 HTTP 请求计 1 次，每批最多 100 个任务，与单任务状态查询分别限流。' },
  result: { label: '单任务结果获取', counting: '每个 HTTP 请求计 1 次，与批量结果获取分别限流。' },
  batchResult: { label: '批量结果获取', counting: '每个 HTTP 请求计 1 次，每批最多 20 个任务，与单任务结果获取分别限流。' },
  cancel: { label: '单任务取消', counting: '每个 HTTP 请求计 1 次，与批量取消分别限流。' },
  batchCancel: { label: '批量取消', counting: '每个 HTTP 请求计 1 次，每批最多 50 个任务，与单任务取消分别限流。' },
  read: { label: '任务列表查询', counting: '每个 HTTP 请求计 1 次，与额度查询分别限流。' },
  quota: { label: '额度查询', counting: '每个 HTTP 请求计 1 次，与任务列表查询分别限流。' },
};
