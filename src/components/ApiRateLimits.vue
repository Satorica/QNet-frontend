<template>
  <section id="api-doc-limits" data-doc-section>
    <h3>调用限额</h3>
    <div class="limit-rule"><span>账号{{ description.label }}限额</span><strong>{{ minute.toLocaleString('zh-CN') }} {{ description.unit }}／分钟</strong></div>
    <div v-if="accountRate" class="limit-rule"><span>每秒恢复 / 突发上限</span><strong>{{ accountRate.rate }} / {{ accountRate.burst }} {{ description.unit }}</strong></div>
    <p>同账号全部 API Key 共享本类预算，{{ description.scope }}合并计数；其他类别单独计数。</p>
    <p v-if="operation !== 'read'">批量请求每个任务或 ID 计 1 单位，包含幂等重放和业务失败项；单任务请求每次计 1 单位。</p>
    <template v-if="operation === 'submit'">
      <h4>跨账号共享提交限额</h4>
      <p>提交必须同时满足账号、全局及对应计算通道的限额。其他账号的提交也会消耗共享预算，因此低于账号限额时仍可能收到 429。</p>
      <div v-if="submissionLimits" class="shared-limits">
        <table aria-label="跨账号共享提交限额">
          <thead><tr><th>共享范围</th><th>每秒恢复（个任务）</th><th>突发上限（个任务）</th></tr></thead>
          <tbody><tr v-for="scope in sharedScopes" :key="scope.key"><td>{{ scope.label }}</td><td>{{ submissionLimits[scope.key].rate }}</td><td>{{ submissionLimits[scope.key].burst }}</td></tr></tbody>
        </table>
      </div>
      <p v-else>共享限额配置暂不可用，请刷新页面获取服务端当前配置。</p>
    </template>
    <p>所有接口另按同类 HTTP 请求次数限流，分钟上限、每秒恢复量和突发容量与本类账号预算的数值相同。格式错误或请求体超限也计次；此计数不重复扣除任务项令牌。</p>
    <p>收到 <code>429 RATE_LIMITED</code> 时，读取响应头 <code>Retry-After</code>，等待指定秒数后重试。等待后仍可能因其他调用消耗预算而再次限流；重试也计数。</p>
    <p v-if="operation === 'submit'">重试提交必须保留原幂等键和参数：单任务复用 <code>Idempotency-Key</code>，批量复用每项的 <code>idempotencyKey</code>。不要生成新键重新提交。</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ApiKeyOverview } from '../api';
import { operationDescriptions, type ApiOperation } from '../content/api-rate-limits';

const props = defineProps<{
  operation: ApiOperation;
  limits: ApiKeyOverview['limits'];
  operationLimits?: ApiKeyOverview['operationLimits'];
  submissionLimits?: ApiKeyOverview['submissionLimits'];
}>();
const description = computed(() => operationDescriptions[props.operation]);
const minute = computed(() => props.operationLimits?.[props.operation]?.minute ?? props.limits[props.operation] ?? props.limits.read);
const accountRate = computed(() => props.operationLimits?.[props.operation] ?? (props.operation === 'submit' ? props.submissionLimits?.account : undefined));
const sharedScopes = [
  { key: 'global', label: '所有公开 API 账号合计' },
  { key: 'classic', label: '公开 API 经典通道' },
  { key: 'quantum', label: '公开 API 量子通道' },
] as const;
</script>

<style scoped>
h3 { margin: 0 0 14px; font-size: var(--app-font-section-title); font-weight: 600; line-height: 1.5; }
h4 { font-size: var(--app-font-subtitle); font-weight: var(--app-weight-medium); }
p { color: var(--el-text-color-regular); line-height: var(--app-line-reading); margin: 10px 0 18px; font-size: var(--app-font-subtitle); }
code { font: var(--app-font-mono)/1.7 var(--app-font-family-mono); overflow-wrap: anywhere; }
.limit-rule { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 16px; background: var(--el-fill-color-lighter); padding: 15px; }
.limit-rule strong { font-size: 15px; font-weight: 500; }
.shared-limits { overflow-x: auto; margin: 16px 0; }
table { width: 100%; min-width: 460px; border-collapse: collapse; border: 1px solid var(--doc-border); font-size: 14px; }
th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid var(--doc-border); color: var(--el-text-color-regular); }
th { background: var(--el-fill-color-light); font-weight: 600; }
</style>
