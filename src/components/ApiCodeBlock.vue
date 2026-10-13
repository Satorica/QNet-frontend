<template>
  <div class="api-code-block">
    <div class="code-header"><span>{{ title }}</span><el-button text size="small" @click="copyCode">复制代码</el-button></div>
    <pre :aria-label="title"><code><span v-for="(line, index) in lines" :key="index" class="code-line"><span class="line-number" aria-hidden="true">{{ index + 1 }}</span><span class="line-content"><span v-for="(token, tokenIndex) in tokenize(line)" :key="tokenIndex" :class="token.kind">{{ token.text }}</span></span></span></code></pre>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ElMessage } from 'element-plus';

const props = defineProps<{ code: string; title: string }>();
const lines = computed(() => props.code.split('\n'));
function tokenize(line: string) {
  const pattern = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#.*$|\b(?:import|from|with|as|if|else|for|while|def|return|raise|try|except|True|False|None|true|false|null)\b|\b\d+(?:\.\d+)?\b)/g;
  const result: { text: string; kind: string }[] = [];
  let end = 0;
  for (const match of line.matchAll(pattern)) {
    const start = match.index!;
    if (start > end) result.push({ text: line.slice(end, start), kind: '' });
    const text = match[0];
    const kind = text.startsWith('#') ? 'comment' : /^["']/.test(text) ? 'string' : /^\d/.test(text) ? 'number' : 'keyword';
    result.push({ text, kind });
    end = start + text.length;
  }
  if (end < line.length) result.push({ text: line.slice(end), kind: '' });
  return result;
}
async function copyCode() {
  try { await navigator.clipboard.writeText(props.code); ElMessage.success('已复制'); }
  catch { ElMessage.warning('无法访问剪贴板，请手动复制代码。'); }
}
</script>

<style scoped>
.api-code-block { margin: 16px 0; border: 1px solid #253249; border-radius: 7px; overflow: hidden; background: #101c2c; }
.code-header { display: flex; justify-content: space-between; align-items: center; padding: 7px 16px; border-bottom: 1px solid #253249; color: #bdcadd; background: #182539; font-size: 13px; }
.code-header .el-button { color: #bdcadd; }
pre { margin: 0; padding: 16px 0; max-height: 520px; overflow: auto; font: var(--app-font-mono)/1.85 var(--app-font-family-mono); color: #e1e8f3; tab-size: 4; }
code { font: inherit; }
.code-line { display: flex; min-height: 26px; }
.line-number { width: 44px; flex-shrink: 0; color: #91a0b5; padding-right: 12px; text-align: right; user-select: none; }
.line-content { padding-right: 20px; white-space: pre; }
.string { color: #b4d6a0; }.keyword { color: #bfa8e8; }.number { color: #edbd7e; }.comment { color: #a2afc2; }
</style>
