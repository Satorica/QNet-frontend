<template>
  <div class="api-documentation" :class="{ 'api-documentation--keys': selected === 'api-keys' }">
    <nav class="api-doc-menu" aria-label="接口目录">
      <div class="menu-scroll">
        <div class="menu-title">API 文档 <span>v1</span></div>
        <el-input v-model="search" class="menu-search" placeholder="搜索接口名称或路径" clearable aria-label="搜索接口"><template #prefix><Search :size="20" :stroke-width="1.8" aria-hidden="true" /></template></el-input>
        <button v-for="item in guideItems" :key="item.id" type="button" class="guide-link" :class="{ selected: selected === item.id }" :aria-current="selected === item.id ? 'page' : undefined" @click="selectPage(item.id)">
          <FileText class="nav-icon" :size="22" :stroke-width="1.8" aria-hidden="true" />
          <span>{{ item.title }}</span>
          <ChevronRight class="nav-chevron" :size="18" :stroke-width="1.8" aria-hidden="true" />
        </button>
        <button type="button" class="menu-group" :aria-expanded="endpointsExpanded || !!search.trim()" aria-controls="api-endpoint-list" @click="endpointsExpanded = !endpointsExpanded">
          <ChevronDown :size="18" :stroke-width="2" :class="{ collapsed: !endpointsExpanded && !search.trim() }" aria-hidden="true" />
          <span>任务 API</span>
        </button>
        <div v-show="endpointsExpanded || search.trim()" id="api-endpoint-list" class="endpoint-list">
          <button v-for="endpoint in filteredEndpoints" :key="endpoint.id" type="button" class="endpoint-link" :class="{ selected: selected === endpoint.id }" :aria-label="`${endpoint.title} ${endpoint.method} ${endpoint.path}`" :aria-current="selected === endpoint.id ? 'page' : undefined" @click="selectPage(endpoint.id)">
            <span class="method" :class="endpoint.method.toLowerCase()">{{ endpoint.method }}</span>
            <span class="endpoint-summary">
              <code class="menu-path" :title="endpoint.path">{{ endpoint.path }}</code>
              <span class="menu-name">{{ endpoint.title }}</span>
            </span>
            <ChevronRight class="nav-chevron" :size="18" :stroke-width="1.8" aria-hidden="true" />
          </button>
        </div>
        <p v-if="!filteredEndpoints.length" class="menu-empty" role="status">没有匹配的接口</p>
      </div>
      <div class="menu-footer">
        <button type="button" class="key-manager-cta manage-keys" :class="{ selected: selected === 'api-keys' }" :aria-current="selected === 'api-keys' ? 'page' : undefined" @click="selectPage('api-keys')">
          <KeyRound :size="15" :stroke-width="1.8" aria-hidden="true" />
          <span>管理 API Key</span>
          <ArrowRight class="key-manager-arrow" :size="14" :stroke-width="1.8" aria-hidden="true" />
        </button>
      </div>
    </nav>

    <main class="api-doc-content">
      <div v-if="selected === 'api-keys'" ref="documentHeader" class="key-manager-content" tabindex="-1"><slot name="key-manager" /></div>
      <template v-else>
      <header ref="documentHeader" class="document-header" tabindex="-1">
        <template v-if="endpoint">
          <div class="endpoint-heading"><h2>{{ endpoint.path }}</h2><span class="method" :class="endpoint.method.toLowerCase()">{{ endpoint.method }}</span></div>
          <h3>{{ endpoint.title }}</h3><p>{{ endpoint.description }}</p>
          <div class="endpoint-address"><code>{{ baseUrl }}{{ endpoint.path }}</code><el-button text @click="copy(baseUrl + endpoint.path)">复制地址</el-button></div>
        </template>
        <template v-else><h2>{{ pageTitle }}</h2><p>{{ pageDescription }}</p></template>
      </header>

      <template v-if="endpoint">
        <section id="api-doc-common" data-doc-section><h3>公共参数</h3>
          <ApiParameterTable :fields="headerFields" label="公共参数表" />
        </section>
        <section id="api-doc-request-params" data-doc-section><h3>请求参数</h3>
          <ApiParameterTable v-if="endpoint.parameters.length" :fields="requestFields" :initial-expanded-depth="0" :key="endpoint.id + '-request'" label="请求参数表" />
          <div v-else class="no-parameters">此接口无需请求参数。</div>
          <div v-if="isSubmit" class="problem-guide"><h4>每项任务的问题数据约束</h4><div v-for="problem in problemExamples" :key="problem.value" class="problem-row"><code>{{ problem.value }}</code><span>{{ problem.size }} 阶／项</span><p>{{ problem.input }}</p></div></div>
        </section>
        <section id="api-doc-request-example" data-doc-section><h3>请求示例</h3>
          <div v-if="isSubmit" class="example-settings"><span>示例问题</span><el-select v-model="problemType" aria-label="示例问题"><el-option v-for="problem in problemExamples" :key="problem.value" :label="problem.label" :value="problem.value" /></el-select><el-select v-model="modelType" aria-label="示例模型"><el-option label="经典计算" value="classic" /><el-option label="量子芯片模拟计算" value="quantum" /></el-select></div>
          <p v-if="endpoint.id === 'batch-submit'">每项使用独立的 <code>idempotencyKey</code>，将完整任务参数放入 <code>payload</code>。保存各项标识，重试时保持原标识和参数；不传整批幂等请求头。</p>
          <p v-if="endpoint.id === 'submit'">将 <code>YOUR_UNIQUE_REQUEST_ID</code> 替换为本次提交的唯一标识并保存。新任务使用新标识；重试同一次提交时保留标识和参数。</p>
          <el-tabs v-model="language" class="language-tabs"><el-tab-pane label="python" name="python" /><el-tab-pane label="curl" name="curl" /></el-tabs>
          <ApiCodeBlock :code="requestCode" :title="language === 'python' ? 'Python · 标准库' : 'curl · Bash'" />
          <details v-if="endpoint.id === 'batch-submit'"><summary>完整 Python 批量流程：提交、恢复、轮询与结果保存</summary><p>示例跟随上方问题类型和模型选择。修改 API_KEY 与 TASK_PAYLOADS；保留任务清单文件，重试时不要更换文件或各项幂等键。</p><ApiCodeBlock :code="selectedBatchWorkflow" title="Python 3.9+ · 标准库" /></details>
        </section>
        <section id="api-doc-response-params" data-doc-section><h3>响应参数</h3>
          <div v-if="['result', 'batch-results'].includes(endpoint.id)" class="example-settings"><span>结果问题类型</span><el-select v-model="problemType" aria-label="结果问题类型"><el-option v-for="problem in problemExamples" :key="problem.value" :label="problem.label" :value="problem.value" /></el-select></div>
          <ApiParameterTable :fields="responseFields" :key="endpoint.id + '-response'" label="响应参数表" response />
        </section>
        <section id="api-doc-response-example" data-doc-section><h3>响应示例</h3><div class="response-kind"><span class="success-dot" />正常 · HTTP {{ endpoint.success }}<span class="sample-label">示例数据</span></div><ApiCodeBlock :code="responseCode" title="JSON" /></section>
        <section id="api-doc-return-codes" data-doc-section><h3>业务错误码</h3>
          <p v-if="endpoint.id.startsWith('batch-') && endpoint.id !== 'batch-submit'">INVALID_BATCH 等请求错误通过 HTTP 错误响应返回；TASK_NOT_FOUND 等任务错误位于 <code>data.tasks[].error</code>，此时 HTTP 为 200。</p>
          <div v-if="endpointErrors.length" class="parameter-table error-table"><table><thead><tr><th>业务错误码</th><th>说明</th><th>处理方式</th></tr></thead><tbody><tr v-for="error in endpointErrors" :key="error.code"><td><code>{{ error.code }}</code></td><td>{{ error.description }}</td><td>{{ error.resolution }}</td></tr></tbody></table></div><p v-else>此接口暂无独立业务错误码。</p>
          <ApiCodeBlock v-if="endpointErrors.length" :code="errorExample" title="业务错误响应示例" />
        </section>
        <section id="api-doc-permission" data-doc-section><h3>权限说明</h3><p>使用本账号创建的 API Key 调用。只能访问本账号的任务和额度，包括网页、小程序和 API 创建的任务。</p><ul class="endpoint-notes"><li v-for="note in endpoint.notes" :key="note">{{ note }}</li></ul></section>
        <section id="api-doc-limits" data-doc-section><h3>限流规则</h3><div class="limit-rule"><span>账号共享预算</span><strong>{{ endpointLimit }} 单位／分钟</strong></div><p>批量接口每项任务或 ID 计 1 单位，包括重放项；单任务接口每次调用计 1 单位。同账号多个密钥共享预算，遇到 429 请遵循 Retry-After 退避。</p><p v-if="endpoint.id.startsWith('batch-')">批量请求另有同账号、同类操作的请求次数限制，每分钟上限与上述预算数相同。格式错误或请求体超限也计次，此计数不重复扣除任务项预算。</p></section>
      </template>

      <template v-else-if="selected === 'quick-start'">
        <section id="api-doc-overview" data-doc-section>
          <h3>接口概览</h3>
          <div class="connection-info"><div><span>接口基础地址</span><code>{{ baseUrl }}</code></div><el-button text @click="copy(baseUrl)">复制地址</el-button></div>
          <dl class="quick-facts"><div><dt>数据格式</dt><dd>JSON · UTF-8</dd></div><div><dt>认证方式</dt><dd>Bearer API Key</dd></div></dl>
        </section>
        <section id="api-doc-authentication" data-doc-section>
          <h3>准备 API Key</h3>
          <p>在账号设置中验证并绑定邮箱，然后创建 API Key。完整密钥仅显示一次，请妥善保存。</p>
          <button type="button" class="key-manager-cta" @click="selectPage('api-keys')">
            <KeyRound :size="15" :stroke-width="1.8" aria-hidden="true" />
            <span>管理 API Key</span>
            <ArrowRight class="key-manager-arrow" :size="14" :stroke-width="1.8" aria-hidden="true" />
          </button>
          <p>将示例中的 <code>YOUR_API_KEY</code> 替换为你的密钥。</p>
          <ApiCodeBlock code="Authorization: Bearer YOUR_API_KEY" title="HTTP 请求头" />
        </section>
        <section id="api-doc-first-call" data-doc-section>
          <h3>1. 批量提交任务</h3>
          <div class="quick-endpoint"><span class="method post">POST</span><code>/tasks/batch</code><button type="button" class="text-link" @click="selectPage('batch-submit')">接口详情 →</button></div>
          <p>以 2 个节点的图分割问题为例，使用模拟退火算法（<code>sa</code>）求解。</p>
          <p>在 <code>tasks</code> 数组中添加任务，每项包含独立的 <code>idempotencyKey</code> 和完整 <code>payload</code>；每批 1–100 项，请求体最多 4 MiB。新任务使用新标识，重试保留原标识及参数。</p>
          <el-tabs v-model="language" class="language-tabs" aria-label="示例语言"><el-tab-pane label="python" name="python" /><el-tab-pane label="curl" name="curl" /></el-tabs>
          <ApiCodeBlock :code="quickStartRequests.submit" :title="language === 'python' ? 'Python 3.9+ · 标准库' : 'curl · Bash'" />
          <div class="response-kind"><span class="success-dot" />HTTP 202 · 已接收<span class="sample-label">示例响应</span></div>
          <ApiCodeBlock :code="quickStartResponse" title="JSON" />
          <p><code>HTTP 202</code> 表示受理成功，不代表计算完成。保存 <code>data.tasks</code> 中每项的 taskId；任何一项校验或额度检查失败，本次新任务全部不受理。</p>
          <p>网络超时可能发生在受理成功之后。重试时复用原项键和参数；幂等有效期 24 小时，过期后先核对任务，避免重复提交。</p>
        </section>
        <section id="api-doc-poll-status" data-doc-section>
          <h3>2. 批量查询状态</h3>
          <div class="quick-endpoint"><span class="method post">POST</span><code>/tasks/batch-status</code><button type="button" class="text-link" @click="selectPage('batch-status')">接口详情 →</button></div>
          <p>每批传 1–100 个不重复的 taskIds，建议每 2 秒查询尚未结束的任务。逐项检查 error 和 state；completed 时获取结果，failed 或 cancelled 时停止轮询。根据账号读取预算控制查询频率。</p>
          <ApiCodeBlock :code="quickStartRequests.status" :title="language === 'python' ? 'Python · 查询状态' : 'curl · 查询状态'" />
        </section>
        <section id="api-doc-fetch-result" data-doc-section>
          <h3>3. 批量获取结果</h3>
          <div class="quick-endpoint"><span class="method post">POST</span><code>/tasks/batch-results</code><button type="button" class="text-link" @click="selectPage('batch-results')">接口详情 →</button></div>
          <p>每批最多 20 个任务，从 <code>data.tasks[].results</code> 读取结果。HTTP 200 也可能包含单项错误；RESULT_TOO_LARGE 时改用单任务结果接口。需要停止任务时调用批量取消接口。</p>
          <ApiCodeBlock :code="quickStartRequests.result" :title="language === 'python' ? 'Python · 获取结果' : 'curl · 获取结果'" />
          <div class="next-links"><button type="button" @click="selectPage('batch-cancel')">批量取消任务 <span>→</span></button></div>
        </section>
        <section id="api-doc-workflow" data-doc-section><h3>完整 Python 示例</h3><p>此示例保存每项幂等键和任务 ID，支持分批提交、退避重试、批量轮询、结果保存和中断后恢复。修改 API_KEY 与 TASK_PAYLOADS 即可运行；保留任务清单文件，勿将同一清单交给多个进程同时运行。</p><ApiCodeBlock :code="batchWorkflowCode" title="Python 3.9+ · 标准库 · 可恢复批量流程" /></section>
      </template>

      </template>
    </main>

    <aside v-if="selected !== 'api-keys'" class="api-doc-outline" aria-label="当前文档章节"><button v-for="section in outline" :key="section.id" type="button" :class="{ active: activeAnchor === section.id }" :aria-current="activeAnchor === section.id ? 'location' : undefined" @click="scrollTo(section.id)">{{ section.label }}</button></aside>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { ArrowRight, ChevronDown, ChevronRight, FileText, KeyRound, Search } from 'lucide-vue-next';
import ApiCodeBlock from './ApiCodeBlock.vue';
import ApiParameterTable from './ApiParameterTable.vue';
import { apiEndpoints, businessErrors, requestDocFields, responseDocFields, withFieldExamples, problemExamples, buildTaskPayload, buildRequestExample, buildResponseExample, buildCompleteBatchExample, type ExampleLanguage, type ApiModelType, type ApiDocField } from '../content/api-docs';

const props = defineProps<{ baseUrl: string; limits: { submit: number; read: number; cancel: number } }>();
const emit = defineEmits<{ (event: 'manage-keys'): void; (event: 'page-change', id: string): void }>();
const selected = ref('quick-start');
const search = ref('');
const endpointsExpanded = ref(true);
const problemType = ref('maxcut');
const modelType = ref<ApiModelType>('classic');
const language = ref<ExampleLanguage>('python');
const documentHeader = ref<HTMLElement>();
const activeAnchor = ref('api-doc-overview');
const guideItems = [{ id: 'quick-start', title: '快速开始' }];
const endpoint = computed(() => apiEndpoints.find(item => item.id === selected.value));
const isSubmit = computed(() => ['submit', 'batch-submit'].includes(endpoint.value?.id || ''));
const filteredEndpoints = computed(() => apiEndpoints.filter(item => `${item.title} ${item.path} ${item.method}`.toLowerCase().includes(search.value.trim().toLowerCase())));
const payload = computed(() => buildTaskPayload(problemType.value, modelType.value));
const requestCode = computed(() => buildRequestExample(endpoint.value || apiEndpoints[0], props.baseUrl, language.value, payload.value));
const responseCode = computed(() => buildResponseExample(endpoint.value?.id || 'submit', payload.value));
const endpointLimit = computed(() => isSubmit.value ? props.limits.submit : ['cancel', 'batch-cancel'].includes(endpoint.value?.id || '') ? props.limits.cancel : props.limits.read);
const pageTitle = '快速开始';
const pageDescription = '创建 API Key，批量提交完整任务、跟踪进度并收集结果。单任务接口继续兼容。';
const quickStartPayload = buildTaskPayload('maxcut', 'classic');
const quickStartRequests = computed(() => Object.fromEntries([['submit', 'batch-submit'], ['status', 'batch-status'], ['result', 'batch-results']].map(([key, id]) => [key, buildRequestExample(apiEndpoints.find(item => item.id === id)!, props.baseUrl, language.value, quickStartPayload)])));
const quickStartResponse = buildResponseExample('batch-submit', quickStartPayload);
const batchWorkflowCode = computed(() => buildCompleteBatchExample(props.baseUrl));
const selectedBatchWorkflow = computed(() => buildCompleteBatchExample(props.baseUrl, payload.value));
const commonHeaders = computed<ApiDocField[]>(() => [
  { name: 'Authorization', type: 'string', required: true, description: 'Bearer 后接本账号的 API Key；仅接受此请求头，不使用网页登录 Cookie。' },
  ...(endpoint.value?.id.startsWith('batch-') ? [{ name: 'Content-Type', type: 'string', required: true, description: '请求体使用 application/json；每项幂等键位于请求体，不设置整批 Idempotency-Key。' }] : []),
  ...(endpoint.value?.id === 'submit' ? [{ name: 'Content-Type', type: 'string', required: true, description: '请求体使用 application/json。' }, { name: 'Idempotency-Key', type: 'string', required: false, description: '1–128 个无空白 ASCII 字符；同用户保留 24 小时。同键同参数返回原任务，不同参数返回 IDEMPOTENCY_CONFLICT。网络重试使用同一键。' }] : []),
]);
const headerFields = computed(() => withFieldExamples(commonHeaders.value, { Authorization: 'Bearer YOUR_API_KEY', 'Content-Type': 'application/json', 'Idempotency-Key': 'YOUR_UNIQUE_REQUEST_ID' }));
const requestFields = computed(() => endpoint.value ? requestDocFields(endpoint.value, payload.value) : []);
const responseFields = computed(() => endpoint.value ? responseDocFields(endpoint.value, payload.value) : []);
const endpointErrors = computed(() => businessErrors[endpoint.value?.id || ''] || []);
const errorExample = computed(() => JSON.stringify({ error: { code: endpointErrors.value[0]?.code, message: endpointErrors.value[0]?.description }, requestId: '0123456789abcdef0123456789abcdef' }, null, 2));
const outline = computed(() => endpoint.value ? [
  { id: 'api-doc-common', label: '公共参数' }, { id: 'api-doc-request-params', label: '请求参数' }, { id: 'api-doc-request-example', label: '请求示例' }, { id: 'api-doc-response-params', label: '响应参数' }, { id: 'api-doc-response-example', label: '响应示例' }, { id: 'api-doc-return-codes', label: '业务错误码' }, { id: 'api-doc-permission', label: '权限说明' }, { id: 'api-doc-limits', label: '限流规则' },
] : selected.value === 'quick-start' ? [
  { id: 'api-doc-overview', label: '接口概览' }, { id: 'api-doc-authentication', label: '准备 API Key' },
  { id: 'api-doc-first-call', label: '1. 提交任务' }, { id: 'api-doc-poll-status', label: '2. 查询状态' },
  { id: 'api-doc-fetch-result', label: '3. 获取结果' },
  { id: 'api-doc-workflow', label: '完整 Python 示例' },
] : []);

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); ElMessage.success('已复制'); }
  catch { ElMessage.warning('无法访问剪贴板，请手动复制。'); }
}
async function selectPage(id: string) {
  selected.value = id;
  emit('page-change', id);
  if (id === 'api-keys') emit('manage-keys');
  await nextTick();
  documentHeader.value?.scrollIntoView({ block: 'start' });
  documentHeader.value?.focus({ preventScroll: true });
}
let scrollRoot: HTMLElement | null = null;
let clickedScrollPosition: number | undefined;
let scrollFrame: number | undefined;
function scrollPosition() { return scrollRoot ? scrollRoot.scrollTop : window.scrollY; }
function scrollTo(id: string) {
  const section = document.getElementById(id);
  if (!section) return;
  section.scrollIntoView({ block: 'start', behavior: 'instant' });
  activeAnchor.value = id;
  // Keep the clicked section selected even if the last section cannot align at the top.
  clickedScrollPosition = scrollPosition();
}
function updateActiveSection() {
  if (clickedScrollPosition !== undefined && Math.abs(scrollPosition() - clickedScrollPosition) <= 1) return;
  clickedScrollPosition = undefined;
  const headingLine = (scrollRoot?.getBoundingClientRect().top ?? 0) + 18;
  let current = outline.value[0]?.id;
  for (const section of outline.value) {
    const heading = document.getElementById(section.id)?.querySelector('h3');
    if (heading && heading.getBoundingClientRect().top <= headingLine) current = section.id;
  }
  if (current) activeAnchor.value = current;
}
function scheduleOutlineUpdate() {
  if (scrollFrame !== undefined) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = undefined;
    updateActiveSection();
  });
}
function stopOutlineTracking() {
  (scrollRoot ?? window).removeEventListener('scroll', scheduleOutlineUpdate);
  window.removeEventListener('resize', scheduleOutlineUpdate);
  if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame);
  scrollFrame = undefined;
}
async function trackSections() {
  stopOutlineTracking();
  clickedScrollPosition = undefined;
  await nextTick();
  scrollRoot = documentHeader.value?.closest<HTMLElement>('.el-main, .standalone-layout') ?? null;
  updateActiveSection();
  (scrollRoot ?? window).addEventListener('scroll', scheduleOutlineUpdate, { passive: true });
  window.addEventListener('resize', scheduleOutlineUpdate);
}
watch(selected, trackSections);
onMounted(trackSections);
onBeforeUnmount(stopOutlineTracking);
</script>

<style scoped>
.api-documentation {
  /* Reading surfaces stay neutral; only navigation and controls use the skin. */
  --doc-border: #e2e6ec;
  --el-text-color-primary: #202938;
  --el-text-color-regular: #374151;
  --el-text-color-secondary: #5e6878;
  --el-fill-color-light: #f3f5f8;
  --el-fill-color-lighter: #f6f7f9;
  --el-border-color: #d5dbe3;
  --el-border-color-light: #e2e6ec;
  --el-border-color-lighter: #e9edf2;
  --el-bg-color: #ffffff;
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 140px;
  gap: 28px;
  align-items: start;
  box-sizing: border-box;
  width: 100%;
  margin: 12px 0 0;
  padding: 24px;
  border: 1px solid var(--doc-border);
  border-radius: 8px;
  background: #ffffff;
  color: var(--el-text-color-primary);
  font-family: var(--app-font-family);
  font-size: 15px;
  line-height: 1.7;
}
.api-documentation--keys { grid-template-columns: 300px minmax(0, 1fr); }
.key-manager-content { min-width: 0; outline: none; scroll-margin-top: 16px; }
.api-doc-menu {
  /* Reference panel: 784 × 1656, scaled to the existing 300px column. */
  --nav-accent: #743cbe;
  --nav-selected: #eeeaf8;
  --nav-hover: #ebeff5;
  --nav-border: #dfe5ef;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: calc(100dvh - 64px);
  box-sizing: border-box;
  position: sticky;
  top: 16px;
  padding: 22px 10px 12px;
  border: 1px solid #d6deeb;
  border-radius: 6px;
  background: #f2f5f9;
  color: #111c30;
}
.menu-scroll { flex: 1; overflow-y: auto; overflow-x: hidden; min-height: 0; scrollbar-width: thin; scrollbar-color: #c5ccd7 transparent; }
.menu-title { display: flex; justify-content: space-between; align-items: center; height: 34px; margin: 0 7px 10px; font-size: var(--app-font-section-title); line-height: 34px; font-weight: var(--app-weight-semibold); transform: translateY(-4px); }
.menu-title span { color: #626d81; font: 500 12.5px/24px var(--app-font-family); transform: translateY(-3px); }
.menu-search { --el-input-height: 38px; --el-input-text-color: #626d81; --el-input-placeholder-color: #7b8596; --el-input-border-color: #ced7e6; --el-input-bg-color: #fff; display: flex; width: calc(100% - 12px); height: 38px; margin: 0 6px; font-size: 13px; }
.menu-search :deep(.el-input__wrapper) { height: 38px; box-sizing: border-box; padding: 0 12px; border-radius: 4px; }
.menu-search :deep(.el-input__inner) { font-weight: 400; }
.menu-search :deep(.el-input__prefix-inner) { margin-right: 14px; color: #626d81; }
.menu-search :deep(.el-input__prefix-inner > svg) { width: 18px; height: 18px; margin-right: 0; }
button { box-sizing: border-box; font: inherit; cursor: pointer; border: 0; background: transparent; color: inherit; }
.guide-link, .endpoint-link { display: flex; align-items: center; width: 100%; min-width: 0; position: relative; text-align: left; transition: background-color .15s, color .15s, border-color .15s; }
.guide-link { height: 41px; margin-top: 20px; padding: 0 10px 0 13px; gap: 17px; border-radius: 5px; background: var(--nav-hover); font-size: 14.5px; font-weight: 500; }
.guide-link .nav-icon { width: 19px; height: 19px; color: #525e73; stroke-width: 2; }
.guide-link:hover { background: #e5eaf2; }
.guide-link.selected { color: #111c30; background: var(--nav-hover); }
.menu-group { display: flex; align-items: center; gap: 9px; width: 100%; height: 28px; margin: 18px 0 7px; padding: 0 10px; color: #111c30; font-size: 14.5px; line-height: 24px; font-weight: 500; text-align: left; border-radius: 4px; }
.menu-group > span { transform: translateY(-2px); }
.menu-group svg { flex-shrink: 0; color: #465268; transition: transform .15s; }
.menu-group svg.collapsed { transform: rotate(-90deg); }
.menu-group:hover { background: var(--nav-hover); }
button:focus-visible { outline: 2px solid var(--app-accent); outline-offset: 3px; }
.api-doc-menu button:focus-visible { outline-color: var(--nav-accent); outline-offset: -2px; }
.endpoint-list { display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; }
.endpoint-link { height: 56px; padding: 9px 9px 9px 14px; gap: 12px; border-radius: 0; }
.endpoint-link:first-child { height: 54px; }
.endpoint-link::after { content: ''; position: absolute; left: 2px; right: 0; bottom: -3px; height: 1px; background: var(--nav-border); }
.endpoint-link:last-child::after { display: none; }
.endpoint-link:hover, .endpoint-link.selected { border-radius: 4px; background: var(--nav-hover); }
.endpoint-link.selected { color: var(--nav-accent); background: var(--nav-selected); }
.endpoint-link.selected::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; border-radius: 4px; background: var(--nav-accent); }
.endpoint-link .method { align-self: flex-start; display: grid; place-items: center; box-sizing: border-box; width: 39px; min-width: 39px; height: 20px; margin: 0; padding: 0; border-radius: 4px; color: #086333; background: #dff0e6; font: 500 11.5px/20px var(--app-font-family-mono); }
.endpoint-link .method.post { color: #6240d9; background: #e6e3fc; }
.endpoint-summary { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; }
.menu-path { display: block; min-width: 0; color: #606c82; font: 400 11.5px/19px var(--app-font-family-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.menu-name { font-size: 13.5px; font-weight: 500; line-height: 20px; }
.selected .menu-name { font-weight: 600; }
.nav-icon { flex-shrink: 0; }
.nav-chevron { flex-shrink: 0; width: 18px; height: 18px; margin-left: auto; color: #576277; stroke-width: 2; }
.endpoint-link.selected .nav-chevron { color: var(--nav-accent); }
.menu-footer { flex-shrink: 0; margin: 4px 2px 0; padding-top: 10px; border-top: 1px solid #d1d9e7; }
.manage-keys { width: 100%; }
.menu-empty { font-size: 13px; padding: 8px; color: var(--el-text-color-secondary); }
.method { color: #367653; background: #ecf4ee; font: 500 11px/1.5 var(--app-font-family-mono); padding: 3px 4px; border-radius: 3px; flex-shrink: 0; }.method.post { color: #486aa7; background: #edf1fa; }
.endpoint-address .el-button, .connection-info .el-button { color: var(--app-accent); }
.api-doc-content { min-width: 0; padding: 0 0 16px; }.document-header { margin-bottom: 28px; outline: none; scroll-margin-top: 16px; }
h2 { font-size: var(--app-font-page-title); margin: 0 0 12px; font-weight: 600; letter-spacing: 0; }h3 { color: var(--el-text-color-primary); font-size: var(--app-font-section-title); margin: 0 0 14px; font-weight: 600; line-height: 1.5; }h4 { font-size: var(--app-font-subtitle); font-weight: var(--app-weight-medium); }.endpoint-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }.endpoint-heading h2 { font: var(--app-weight-medium) var(--app-font-page-title)/var(--app-line-heading) var(--app-font-family-mono); margin: 0; overflow-wrap: anywhere; }
p { color: var(--el-text-color-regular); line-height: var(--app-line-reading); margin: 10px 0 18px; font-size: var(--app-font-subtitle); }code { font: var(--app-font-mono)/1.7 var(--app-font-family-mono); overflow-wrap: anywhere; }section { margin-bottom: 34px; scroll-margin-top: 16px; }.endpoint-address { display: flex; gap: 8px; align-items: center; justify-content: space-between; background: var(--el-fill-color-lighter); padding: 8px 12px; border-radius: 5px; margin: 18px 0; }
.parameter-table { overflow-x: auto; margin: 16px 0; }table { width: 100%; min-width: 590px; border-collapse: collapse; border: 1px solid var(--doc-border); font-size: 14px; }th { background: var(--el-fill-color-light); color: var(--el-text-color-regular); font-weight: 600; text-align: left; padding: 12px 14px; white-space: nowrap; }td { padding: 14px; border-bottom: 1px solid var(--doc-border); color: var(--el-text-color-regular); line-height: 1.75; vertical-align: top; }td:first-child { width: 126px; }td:nth-child(2) { width: 60px; }td:nth-child(3) { width: 56px; }td:nth-child(4) { min-width: 100px; }td code { font-size: 14px; }.required { color: #be5454; }.default-value { display: block; color: var(--el-text-color-secondary); font-size: 12px; margin-top: 5px; }.response-table td:nth-child(3) { min-width: 100px; }.error-table td:first-child { width: 30%; min-width: 180px; }.error-table td:nth-child(2) { width: 30%; }.error-table td:nth-child(3) { width: 40%; }.no-parameters { padding: 20px; text-align: center; background: var(--el-fill-color-lighter); color: var(--el-text-color-secondary); font-size: 14px; }
.problem-guide { margin-top: 22px; }.problem-row { display: grid; grid-template-columns: 156px 96px minmax(0, 1fr); gap: 8px; align-items: start; border-bottom: 1px solid var(--doc-border); padding: 10px 0; font-size: 13px; }.problem-row code { font-size: 13px; }.problem-row span { color: var(--el-text-color-secondary); }.problem-row p { margin: 0; font-size: 14px; }.example-settings { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin: 18px 0; color: var(--el-text-color-secondary); font-size: 14px; }.example-settings .el-select { width: 170px; }.language-tabs :deep(.el-tabs__header) { margin: 0; }.language-tabs :deep(.el-tabs__item) { height: 36px; font-size: 14px; }.response-kind { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #367653; }.success-dot { width: 6px; height: 6px; border-radius: 50%; background: #509b69; }.sample-label { margin-left: auto; color: var(--el-text-color-secondary); font-size: 13px; }.endpoint-notes { padding-left: 18px; color: var(--el-text-color-secondary); line-height: 1.9; font-size: 14px; }.endpoint-notes li { margin: 8px 0; }.limit-rule { display: flex; justify-content: space-between; gap: 16px; background: var(--el-fill-color-lighter); padding: 15px; }.limit-rule strong { font-size: 15px; font-weight: 500; }
.connection-info { display: flex; justify-content: space-between; align-items: center; gap: 14px; background: var(--el-fill-color-lighter); border: 1px solid var(--doc-border); border-radius: 6px; padding: 16px; }.connection-info span { display: block; color: var(--el-text-color-secondary); font-size: 13px; margin-bottom: 6px; }
.next-links { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 24px 0; }.next-links button { display: flex; justify-content: space-between; align-items: center; gap: 8px; text-align: left; border: 1px solid var(--doc-border); border-radius: 6px; padding: 14px; font-size: 14px; }.next-links button:hover { border-color: var(--app-accent); color: var(--app-accent); }
.api-doc-outline { position: sticky; top: 24px; display: flex; flex-direction: column; box-sizing: border-box; min-width: 0; border-left: 1px solid var(--doc-border); padding: 0 12px 0 16px; margin-top: 4px; }.api-doc-outline button { text-align: left; padding: 8px 0; color: var(--el-text-color-secondary); font-size: 14px; line-height: 1.7; position: relative; }.api-doc-outline button:hover, .api-doc-outline button.active { color: var(--app-accent); }
.api-doc-outline button.active { font-weight: 600; }
.api-doc-outline button.active::before { content: ''; position: absolute; left: -17px; top: 9px; bottom: 9px; width: 3px; border-radius: 2px; background: var(--app-accent); }
.quick-facts { display: flex; flex-wrap: wrap; gap: 18px 32px; margin: 18px 0 24px; font-size: 13px; }
.quick-facts div { display: flex; gap: 10px; }
.quick-facts dt { color: var(--el-text-color-secondary); }
.quick-facts dd { margin: 0; color: var(--el-text-color-primary); }
.quick-endpoint { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin: -2px 0 16px; }
.quick-endpoint code { font-size: 14px; }
.text-link { padding: 0; color: var(--app-accent); font-size: 13px; }
.quick-endpoint .text-link { margin-left: auto; }
.text-link:hover { text-decoration: underline; text-underline-offset: 4px; }
.key-manager-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  max-width: 100%;
  min-height: 32px;
  padding: 5px 11px;
  border: 1px solid var(--el-color-primary-light-5);
  border-radius: 5px;
  background: var(--app-accent-soft);
  color: var(--app-accent);
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  transition: background-color .15s, border-color .15s;
}
.key-manager-cta svg { flex-shrink: 0; }
.key-manager-arrow { margin-left: 2px; }
.key-manager-cta:hover {
  border-color: var(--app-accent);
  background: var(--el-color-primary-light-8);
}
.key-manager-cta:active { background: var(--el-color-primary-light-7); }
.key-manager-cta.selected { border-color: var(--app-accent); background: var(--el-color-primary-light-8); }
.key-manager-cta:focus-visible, .api-doc-menu .key-manager-cta:focus-visible { outline: 2px solid var(--app-accent); outline-offset: 3px; }


@container (max-width: 1080px) { .api-documentation { grid-template-columns: 300px minmax(0, 1fr); gap: 20px; }.api-doc-outline { display: none; } }
@container (max-width: 780px) {
  .api-documentation { grid-template-columns: minmax(0, 1fr); gap: 16px; padding: 16px 12px; }
  .api-doc-menu { position: static; width: 300px; max-width: 100%; height: 634px; max-height: none; }
  .menu-scroll { overflow-y: auto; }
  .api-doc-content { padding-top: 14px; }.endpoint-heading h2 { font-size: 24px; }
  .key-manager-content { min-height: calc(100dvh - 64px); }
  .problem-row { grid-template-columns: 150px 86px; }.problem-row p { grid-column: 1 / -1; }
  .connection-info { flex-wrap: wrap; }.next-links { grid-template-columns: 1fr; }
  .quick-facts { gap: 10px 20px; }
}

</style>
