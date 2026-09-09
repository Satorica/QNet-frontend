<template>
  <div class="task-name-field" :class="{ 'has-error': errorMessage }">
    <label for="solver-task-name" class="task-name-label">任务名称</label>
    <div class="task-name-controls">
      <el-input
        id="solver-task-name"
        :model-value="draftName"
        :maxlength="64"
        :disabled="disabled"
        :aria-invalid="Boolean(errorMessage)"
        :aria-describedby="errorMessage ? 'task-name-optional task-name-error' : 'task-name-optional'"
        placeholder="请输入任务名称"
        clearable
        @update:model-value="updateName"
        @blur="validate"
        @keydown.enter.prevent="validate"
      >
        <template #suffix>
          <span v-if="validating" class="name-validation-spinner" role="status" aria-label="正在校验任务名称"></span>
        </template>
      </el-input>
      <span v-if="errorMessage" id="task-name-error" class="task-name-error" role="alert">{{ errorMessage }}</span>
    </div>
    <span id="task-name-optional" class="task-name-note">选填</span>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import axios from 'axios'
import { checkTaskName } from '../api'
import { useCustomTaskName } from '../stores/customTaskName'

const props = withDefaults(defineProps<{ disabled?: boolean }>(), { disabled: false })
const { customTaskName, setCustomTaskName, clearCustomTaskName } = useCustomTaskName()
const draftName = ref(customTaskName.value)
const validating = ref(false)
const errorMessage = ref('')
let requestVersion = 0
let disposed = false
let validatedName: string | null = null
let pendingValidation: Promise<boolean> | null = null

watch(customTaskName, value => { draftName.value = value }, { flush: 'sync' })

function updateName(value: string) {
  requestVersion += 1
  pendingValidation = null
  validatedName = null
  validating.value = false
  errorMessage.value = ''
  // An edited or cleared name must never submit the previously validated value.
  clearCustomTaskName()
  draftName.value = value
}

onBeforeUnmount(() => {
  disposed = true
  requestVersion += 1
  clearCustomTaskName()
})

function validate(): Promise<boolean> {
  if (disposed || props.disabled) return Promise.resolve(false)
  const name = draftName.value.trim()
  if (!name) {
    updateName('')
    return Promise.resolve(true)
  }
  if (validatedName === name && customTaskName.value === name) return Promise.resolve(true)
  // Blur and clicking Solve share the same check; submission waits for its result.
  if (pendingValidation) return pendingValidation
  const version = ++requestVersion
  validating.value = true
  errorMessage.value = ''
  pendingValidation = (async () => {
    try {
      const response = await checkTaskName(name)
      if (version !== requestVersion || disposed) return false
      if (!response.success) throw new Error(response.message || '检查任务名称失败')
      validatedName = name
      setCustomTaskName(name)
      draftName.value = name
      return true
    } catch (error) {
      if (version !== requestVersion || disposed) return false
      errorMessage.value = axios.isAxiosError(error)
        ? error.response?.status === 401
          ? '请先登录'
          : error.response?.data?.message || '检查任务名称失败，请重试'
        : error instanceof Error ? error.message : '检查任务名称失败，请重试'
      return false
    } finally {
      if (version === requestVersion) {
        validating.value = false
        pendingValidation = null
      }
    }
  })()
  return pendingValidation
}

defineExpose({ validate })
</script>

<style scoped>
.task-name-field {
  grid-column: 1 / -1;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
  margin: 0;
}
.task-name-label {
  flex-shrink: 0;
  color: #8c8fa3;
  font-size: 14px;
  line-height: 32px;
  white-space: nowrap;
}
.task-name-controls {
  display: flex;
  flex: 0 1 280px;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
.task-name-controls .el-input {
  width: 100%;
  min-width: 0;
}
.task-name-error {
  font-size: 12px;
  line-height: 18px;
}
.task-name-error { color: var(--el-color-danger); }
.task-name-note {
  flex-shrink: 0;
  color: #8c8fa3;
  font-size: 12px;
  line-height: 32px;
  white-space: nowrap;
}
.name-validation-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--app-accent-soft);
  border-top-color: var(--app-accent);
  border-radius: 50%;
  animation: name-validation-spin .8s linear infinite;
}
@keyframes name-validation-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .name-validation-spinner { animation: none; }
}
</style>
