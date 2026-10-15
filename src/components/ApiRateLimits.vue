<template>
  <section id="api-doc-limits" data-doc-section>
    <h3>调用限额</h3>
    <div class="limit-rule"><span>{{ description.label }} · 账号限流</span><strong>{{ minute.toLocaleString('zh-CN') }} 次请求／分钟</strong></div>
    <p class="limit-counting">{{ description.counting }}</p>
    <p class="limit-counting">同账号所有 API Key 共享本接口限额，重复请求也计数；超限返回 429，请遵循 Retry-After 重试。</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ApiKeyOverview } from '../api';
import { defaultApiLimits, operationDescriptions, type ApiOperation } from '../content/api-rate-limits';

const props = defineProps<{
  operation: ApiOperation;
  limits: ApiKeyOverview['limits'];
  operationLimits?: ApiKeyOverview['operationLimits'];
}>();
const description = computed(() => operationDescriptions[props.operation]);
const minute = computed(() => props.operationLimits?.[props.operation]?.minute ?? props.limits[props.operation] ?? defaultApiLimits[props.operation]);
</script>

<style scoped>
h3 { margin: 0 0 14px; font-size: var(--app-font-section-title); font-weight: 600; line-height: 1.5; }
.limit-rule { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 16px; background: var(--el-fill-color-lighter); padding: 15px; }
.limit-rule strong { font-size: 15px; font-weight: 500; }
.limit-counting { margin: 10px 0 0; color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.8; }
</style>
