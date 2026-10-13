<template>
  <div class="parameter-tree">
    <div v-if="branches.length" class="tree-actions">
      <button type="button" :aria-expanded="allExpanded" @click="toggleAll">
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path :d="allExpanded ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'" />
        </svg>
        {{ allExpanded ? '全部折叠' : '全部展开' }}
      </button>
    </div>
    <div class="table-scroll">
      <table :aria-label="label">
        <thead><tr><th>参数名称</th><th>参数类型</th><th>{{ response ? '是否返回' : '是否必填' }}</th><th>示例值</th><th>参数说明</th></tr></thead>
        <tbody>
          <tr v-for="row in rows" :key="row.path" :class="{ 'object-row': row.field.children?.length }">
            <td>
              <div class="field-name" :style="{ paddingLeft: `${row.depth * 20}px` }">
                <button v-if="row.field.children?.length" type="button" class="tree-toggle" :aria-label="`${expanded.has(row.path) ? '收起' : '展开'} ${row.path}`" :aria-expanded="expanded.has(row.path)" @click="toggle(row.path)">{{ expanded.has(row.path) ? '−' : '+' }}</button>
                <span v-else class="tree-spacer" /><code :title="row.path">{{ row.field.name }}</code>
              </div>
              <span v-if="row.field.default" class="default-value" :style="{ paddingLeft: `${row.depth * 20 + 24}px` }">默认：{{ row.field.default }}</span>
            </td>
            <td>{{ row.field.type }}</td>
            <td>{{ response ? row.field.required ? '始终返回' : '条件返回' : row.field.required ? '是' : '否' }}</td>
            <td><code class="example-value">{{ previewValue(row.field.example) }}</code></td>
            <td>{{ row.field.description }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { compactDocFields, flattenDocFields, type ApiDocField } from '../content/api-docs';

const props = withDefaults(defineProps<{ fields: ApiDocField[]; label: string; response?: boolean; initialExpandedDepth?: number }>(), { response: false, initialExpandedDepth: 1 });
const expanded = ref(new Set<string>());
const displayFields = computed(() => compactDocFields(props.fields));
const branches = computed(() => flattenDocFields(displayFields.value).filter(row => row.field.children?.length));
const allExpanded = computed(() => branches.value.length > 0 && branches.value.every(row => expanded.value.has(row.path)));
const rows = computed(() => flattenDocFields(displayFields.value, expanded.value));
watch(() => props.fields, () => { expanded.value = new Set(branches.value.filter(row => row.depth < props.initialExpandedDepth).map(row => row.path)); }, { immediate: true });
function toggle(path: string) { const next = new Set(expanded.value); if (next.has(path)) next.delete(path); else next.add(path); expanded.value = next; }
function toggleAll() { expanded.value = allExpanded.value ? new Set() : new Set(branches.value.map(row => row.path)); }
function previewValue(value: unknown) {
  if (value === undefined) return '—';
  if (value === '') return '""';
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) return '—';
  if (Array.isArray(value) && value.some(item => item !== null && typeof item === 'object' && !Array.isArray(item))) return '[{…}]';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 80 ? text.slice(0, 77) + '…' : text;
}
</script>

<style scoped>
.parameter-tree { margin: 16px 0; }.tree-actions { display: flex; justify-content: flex-end; align-items: center; gap: 7px; margin: -6px 0 12px; font-size: 14px; }button { cursor: pointer; font: inherit; }.tree-actions button { display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; color: var(--app-accent); padding: 4px 0; }button:focus-visible { outline: 2px solid var(--app-accent); outline-offset: 3px; }.table-scroll { overflow-x: auto; }table { width: 100%; min-width: 700px; border-collapse: collapse; border: 1px solid var(--doc-border, #e2e6ec); table-layout: fixed; font-size: 14px; }th { padding: 13px 14px; text-align: left; background: #f3f5f8; font-weight: var(--app-weight-medium); color: #374151; }th:first-child { width: 22%; }th:nth-child(2) { width: 11%; }th:nth-child(3) { width: 10%; }th:nth-child(4) { width: 20%; }td { padding: 14px; border-bottom: 1px solid var(--doc-border, #e2e6ec); color: #374151; line-height: 1.75; vertical-align: top; overflow-wrap: anywhere; }.object-row { background: #f8fafc; }tbody tr:hover { background: #f3f5f8; }.field-name { display: flex; align-items: baseline; gap: 6px; }code { font: var(--app-font-mono)/1.75 var(--app-font-family-mono); overflow-wrap: anywhere; }.field-name code { min-width: 0; color: #202938; font-weight: 500; }.tree-toggle { flex: 0 0 18px; width: 18px; height: 18px; padding: 0; background: #ffffff; border: 1px solid #cbd3df; color: #374151; line-height: 16px; font-size: 14px; }.tree-spacer { flex: 0 0 18px; }.default-value { display: block; color: #5e6878; font-size: 12px; }.example-value { white-space: pre-wrap; }
</style>
