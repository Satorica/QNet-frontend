<template>
  <el-popover
    v-model:visible="visible"
    trigger="click"
    placement="bottom-end"
    :width="168"
    :offset="12"
    :show-arrow="false"
    popper-class="theme-popover"
    @after-enter="focusSelection"
  >
    <template #reference>
      <button
        ref="triggerRef"
        type="button"
        class="theme-trigger"
        :class="{ 'is-open': visible }"
        :aria-label="`换肤，当前：${activeThemeName}`"
        :aria-expanded="visible"
        aria-haspopup="dialog"
        @keydown.esc.stop.prevent="closePanel"
      >
        <svg class="theme-wand" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m8 6 11 11-2 2L6 8Z M9 11l2-2" />
          <path d="M5 2v3 M3.5 3.5h3 M15 3v3 M13.5 4.5h3 M4 13v3 M2.5 14.5h3" />
        </svg>
        <span>换肤</span>
      </button>
    </template>

    <section ref="panelRef" class="theme-panel" role="dialog" aria-label="选择皮肤" @keydown.esc.stop.prevent="closePanel">
      <div class="theme-options" role="group" aria-label="主题色">
        <button
          v-for="theme in themes"
          :key="theme.id"
          type="button"
          class="theme-option"
          :class="{ 'is-selected': currentTheme === theme.id }"
          :aria-label="theme.name"
          :aria-pressed="currentTheme === theme.id"
          @click="selectTheme(theme.id)"
        >
          <span class="theme-swatch" :style="{ background: theme.primary }" aria-hidden="true"></span>
          <span class="theme-option-label"><span>{{ theme.name }}</span><el-icon v-if="currentTheme === theme.id"><Check /></el-icon></span>
        </button>
      </div>
    </section>
  </el-popover>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Check } from '@element-plus/icons-vue'
import { useTheme } from '../stores/theme'

const { currentTheme, themes, setTheme } = useTheme()
const activeThemeName = computed(() => themes.find(theme => theme.id === currentTheme.value)?.name)
const visible = ref(false)
const triggerRef = ref<HTMLButtonElement>()
const panelRef = ref<HTMLElement>()

function focusSelection() {
  if (visible.value) panelRef.value?.querySelector<HTMLButtonElement>('.theme-option.is-selected')?.focus()
}

function selectTheme(id: string) {
  setTheme(id)
  closePanel()
}

async function closePanel() {
  visible.value = false
  await nextTick()
  triggerRef.value?.focus()
}
</script>

<style>
.el-popover.el-popper.theme-popover {
  box-sizing: border-box;
  max-width: calc(100vw - 24px);
  padding: 0;
  border: 1px solid #e8ebf1;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.1);
}
</style>

<style scoped>
.theme-trigger { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; gap: 6px; height: 36px; padding: 0 12px; border: 1px solid rgba(var(--app-accent-rgb), 0.1); border-radius: 8px; background: rgba(var(--app-accent-rgb), 0.05); color: var(--app-accent); font-family: inherit; font-size: 13px; font-weight: 500; white-space: nowrap; cursor: pointer; transition: background-color 150ms, border-color 150ms; }
.theme-wand { display: block; width: 17px; height: 17px; }
.theme-trigger:hover, .theme-trigger.is-open { background: rgba(var(--app-accent-rgb), 0.1); border-color: rgba(var(--app-accent-rgb), 0.22); }
.theme-panel { padding: 6px; color: #26313f; font-family: "PingFang SC", "Microsoft YaHei", sans-serif; }
.theme-options { display: flex; flex-direction: column; gap: 2px; max-height: min(304px, calc(100vh - 120px)); overflow-y: auto; overscroll-behavior: contain; }
.theme-option { display: flex; flex-shrink: 0; align-items: center; gap: 10px; width: 100%; height: 36px; padding: 0 10px; border: 0; border-radius: 6px; background: transparent; color: #616b7c; font: inherit; cursor: pointer; transition: background-color 150ms; }
.theme-option:hover { background: #f5f7fa; }
.theme-option.is-selected { background: var(--app-accent-soft); color: var(--app-accent); }
.theme-swatch { flex-shrink: 0; width: 12px; height: 12px; border-radius: 50%; }
.theme-option-label { display: flex; flex: 1; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; line-height: 20px; }
.theme-option.is-selected .theme-option-label { font-weight: 500; }
button:focus-visible { outline: 2px solid var(--app-accent); outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) {
  .theme-trigger, .theme-option { transition: none; }
}
</style>
