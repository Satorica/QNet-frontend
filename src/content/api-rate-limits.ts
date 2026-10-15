export type ApiOperation = 'submit' | 'status' | 'result' | 'read' | 'cancel';

export function apiOperation(endpointId: string): ApiOperation {
  if (['submit', 'batch-submit'].includes(endpointId)) return 'submit';
  if (['status', 'batch-status'].includes(endpointId)) return 'status';
  if (['result', 'batch-results'].includes(endpointId)) return 'result';
  if (['cancel', 'batch-cancel'].includes(endpointId)) return 'cancel';
  return 'read';
}

export const operationDescriptions = {
  submit: { label: '任务提交', unit: '个任务', scope: '单个与批量提交、经典与量子任务' },
  status: { label: '状态查询', unit: '个任务 ID', scope: '单个与批量状态查询' },
  result: { label: '结果获取', unit: '个任务 ID', scope: '单个与批量结果获取' },
  read: { label: '列表与额度查询', unit: '次请求', scope: '任务列表与额度查询' },
  cancel: { label: '任务取消', unit: '个任务 ID', scope: '单个与批量取消' },
};
