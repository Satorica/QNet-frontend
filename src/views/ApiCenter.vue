<template>
  <div class="api-center">
    <ApiDocumentation :base-url="apiBaseUrl" :limits="overview.limits" :operation-limits="overview.operationLimits" @manage-keys="openKeyManager" @page-change="onPageChange">
      <template #key-manager>
      <section ref="keyManagerPanel" class="keys-management" aria-label="管理 API Key">
      <header>
        <h2 class="keys-heading">管理 API Key</h2>
      </header>
      <div class="keys-description">
        <p>完整密钥仅在创建时显示一次，请及时保存，不要公开分享或写入客户端代码。</p>
        <p>列表仅显示有效密钥，各端共用账号额度；最多保留 {{ overview.maxKeys }} 枚。删除后密钥立即失效，退出网页登录不会撤销密钥。</p>
      </div>
      <div class="keys-toolbar">
        <button type="button" class="keys-details-toggle" :aria-expanded="detailsOpen" aria-controls="api-key-details" @click="detailsOpen = !detailsOpen">
          更多说明<el-icon :class="{ 'is-expanded': detailsOpen }" aria-hidden="true"><ArrowDown /></el-icon>
        </button>
        <el-button class="keys-create-button" type="primary" :icon="Plus" :disabled="!overview.enabled || !!loadError || loading || keyMutationBusy || !!editingKey || activeKeys >= overview.maxKeys" @click="createOpen = true">创建密钥</el-button>
      </div>
      <div v-if="detailsOpen" id="api-key-details" class="keys-details">
        <p>密钥长期有效。账号停用会禁止调用；密码重置或账号合并会撤销相关密钥。</p>
      </div>
      <div class="keys-panel" v-loading="loading" element-loading-text="正在加载密钥…" :aria-busy="loading">
          <el-table :data="loading || loadError ? [] : visibleKeys" row-key="id" class="keys-table" :class="{ 'keys-table--has-data': !loading && !loadError && visibleKeys.length }" :empty-text="loadError || (loading ? '正在加载密钥…' : overview.enabled ? '暂无有效密钥' : 'API 调用尚未开放')" aria-label="访问密钥列表">
            <el-table-column prop="name" label="名称" min-width="144" show-overflow-tooltip />
            <el-table-column label="Key" min-width="210"><template #default="{ row }"><code>{{ row.maskedKey }}</code></template></el-table-column>
            <el-table-column label="创建日期" min-width="124"><template #default="{ row }"><span class="keys-date" :title="row.createdAt">{{ formatDate(row.createdAt) }}</span></template></el-table-column>
            <el-table-column label="最新使用日期" min-width="124"><template #default="{ row }"><span class="keys-date" :title="row.lastUsedAt || '尚未使用'">{{ formatDate(row.lastUsedAt) }}</span></template></el-table-column>
            <el-table-column label="操作" width="112" align="right">
              <template #default="{ row }">
                <div class="keys-row-actions">
                    <el-button text :icon="EditPen" :disabled="keyMutationBusy" title="编辑名称" :aria-label="'编辑名称：' + row.name" @click="beginRename(row)" />
                    <el-button text :icon="Delete" :loading="deleting === row.id" :disabled="keyMutationBusy" title="删除 Key" :aria-label="'删除密钥：' + row.name" @click="beginDelete(row)" />
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div v-if="!loading && !loadError && visibleKeys.length" class="keys-mobile-list" aria-label="访问密钥列表">
            <article v-for="key in visibleKeys" :key="key.id" class="keys-mobile-item">
              <div class="keys-mobile-title"><strong>{{ key.name }}</strong></div>
              <code>{{ key.maskedKey }}</code>
              <dl><div><dt>创建时间</dt><dd>{{ formatDate(key.createdAt) }}</dd></div><div><dt>最后使用</dt><dd>{{ formatDate(key.lastUsedAt) }}</dd></div></dl>
              <div class="keys-mobile-actions">
                  <el-button text :icon="EditPen" :disabled="keyMutationBusy" @click="beginRename(key)">编辑名称</el-button>
                  <el-button text :icon="Delete" :loading="deleting === key.id" :disabled="keyMutationBusy" @click="beginDelete(key)">删除 Key</el-button>
              </div>
            </article>
          </div>
      </div>
      </section>
      </template>
    </ApiDocumentation>
    <el-dialog v-model="renameOpen" title="修改 API Key" width="min(400px, calc(100vw - 32px))" align-center append-to-body class="api-key-dialog api-key-dialog--compact api-key-dialog--create api-key-dialog--rename" :close-on-click-modal="false" :before-close="closeRename" @closed="editedName = ''">
      <el-form label-position="top" @submit.prevent="saveName"><el-form-item label="名称"><el-input v-model="editedName" maxlength="64" :disabled="renaming" aria-label="API Key 名称" placeholder="输入 API Key 的名称" /></el-form-item></el-form>
      <template #footer><el-button :disabled="renaming" @click="cancelRename">取消</el-button><el-button type="primary" :loading="renaming" :disabled="!editedName.trim() || editedName.trim() === editingKey?.name" @click="saveName">保存</el-button></template>
    </el-dialog>
    <el-dialog v-model="deleteOpen" title="删除 API Key" width="min(400px, calc(100vw - 32px))" align-center append-to-body class="api-key-dialog api-key-dialog--compact api-key-dialog--create api-key-dialog--delete" :close-on-click-modal="false" :before-close="closeDelete">
      <p class="key-delete-description">确定删除“{{ deletingKey?.name }}”吗？此密钥将立即失效，依赖它的 API 请求会被拒绝。删除后无法恢复，已提交的任务不受影响。</p>
      <template #footer><el-button :disabled="!!deleting" @click="deleteOpen = false">取消</el-button><el-button type="danger" :loading="!!deleting" @click="confirmDelete">删除</el-button></template>
    </el-dialog>
    <el-dialog v-model="createOpen" title="创建 API Key" width="min(400px, calc(100vw - 32px))" align-center append-to-body class="api-key-dialog api-key-dialog--compact api-key-dialog--create" :close-on-click-modal="false" :before-close="closeCreate" @closed="keyName = ''">
      <p id="api-key-create-description" class="key-create-description">单个账号最多可以保留 {{ overview.maxKeys }} 个 API Key。</p>
      <el-form @submit.prevent="create"><el-form-item><el-input v-model="keyName" maxlength="64" placeholder="输入 API Key 的名称" aria-label="API Key 名称" aria-describedby="api-key-create-description" /></el-form-item></el-form>
      <template #footer><el-button :disabled="creating" @click="createOpen = false">取消</el-button><el-button type="primary" :loading="creating" :disabled="!keyName.trim()" @click="create">创建</el-button></template>
    </el-dialog>
    <el-dialog v-model="secretOpen" title="保存你的 API Key" width="min(400px, calc(100vw - 32px))" align-center append-to-body class="api-key-dialog api-key-dialog--compact api-key-dialog--secret" :close-on-click-modal="false" @closed="secret = ''">
      <p class="secret-description">请将此 API Key 保存在安全且便于访问的地方。完整密钥仅在创建时显示一次，关闭后无法通过密钥管理页面再次查看。如果丢失，请删除旧密钥并重新创建。</p>
      <div class="secret-value">
        <code :title="secret">{{ secret }}</code>
        <el-button class="secret-copy-button" :icon="CopyDocument" @click="copy(secret)">复制</el-button>
      </div>
      <p class="secret-security-note">提示：不要与他人共享你的 API Key，也不要将其暴露在浏览器或其他客户端代码中。</p>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onBeforeUnmount, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { ArrowDown, CopyDocument, Delete, EditPen, Plus } from '@element-plus/icons-vue';
import { createApiKey, deleteApiKey, getApiKeys, renameApiKey, type ApiKeyOverview, type ApiKeyRecord } from '../api';
import ApiDocumentation from '../components/ApiDocumentation.vue';
import { openEmailSettings } from '../utils/emailSettings';
import { defaultApiLimits } from '../content/api-rate-limits';

const managerActive = ref(false);
const keyManagerPanel = ref<HTMLElement>();
const detailsOpen = ref(false);
const loading = ref(true);
const loadError = ref('');
const overview = ref<ApiKeyOverview>({ enabled: false, maxKeys: 5, keys: [], limits: { ...defaultApiLimits } });
const visibleKeys = computed(() => overview.value.keys.filter(key => !key.revokedAt));
const activeKeys = computed(() => visibleKeys.value.length);
const createOpen = ref(false);
const creating = ref(false);
const keyName = ref('');
const secretOpen = ref(false);
const secret = ref('');
const deleting = ref('');
const editingKey = ref<ApiKeyRecord | null>(null);
const renameOpen = ref(false);
const deleteOpen = ref(false);
const deletingKey = ref<ApiKeyRecord | null>(null);
const editedName = ref('');
const renaming = ref(false);
const keyMutationBusy = computed(() => creating.value || renaming.value || !!deleting.value);
const apiOrigin = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_PROXY_TARGET || window.location.origin).replace(/\/+$/, '');
const apiBaseUrl = `${apiOrigin}/api/v1`;

function errorMessage(error: unknown) { return error instanceof Error ? error.message : '操作失败，请稍后重试'; }
function loadErrorMessage(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 404 || (status && status >= 500)) return '密钥加载失败，请稍后重试。';
  if (status === 403) return '当前账号暂时无法访问密钥服务，请确认账号权限后重试。';
  if (!status) return '未能连接到密钥服务，请检查网络后重试。';
  return errorMessage(error);
}
let loadRevision = 0;
async function loadKeys() {
  const revision = ++loadRevision;
  loading.value = true;
  loadError.value = '';
  try { const result = await getApiKeys(); if (revision === loadRevision && !disposed) overview.value = result; }
  catch (error) { if (revision === loadRevision && !disposed) loadError.value = loadErrorMessage(error); }
  finally { if (revision === loadRevision && !disposed) loading.value = false; }
}
async function openKeyManager() {
  managerActive.value = true;
  await loadKeys();
  if (disposed || !managerActive.value) return;
  await nextTick();
  keyManagerPanel.value?.scrollIntoView({ block: 'start' });
}
function onPageChange(id: string) { managerActive.value = id === 'api-keys'; }
function closeRename(done: () => void) { if (!renaming.value) { editingKey.value = null; done(); } }
function closeDelete(done: () => void) { if (!deleting.value) done(); }
function closeCreate(done: () => void) { if (!creating.value) done(); }
async function create() {
  if (!keyName.value.trim() || creating.value || !managerActive.value) return;
  creating.value = true;
  try {
    const result = await createApiKey(keyName.value.trim());
    if (disposed) return;
    secret.value = result.apiKey;
    secretOpen.value = true;
    createOpen.value = false;
    await loadKeys();
  } catch (error) {
    const code = (error as { response?: { data?: { code?: string } } }).response?.data?.code;
    if (code === 'EMAIL_BINDING_REQUIRED') openEmailSettings('创建 API Key 前请验证并绑定邮箱。');
    ElMessage.error(errorMessage(error));
  } finally { creating.value = false; }
}
function beginRename(key: ApiKeyRecord) {
  if (keyMutationBusy.value || loading.value || loadError.value || !managerActive.value) return;
  editingKey.value = key;
  editedName.value = key.name;
  renameOpen.value = true;
}
function cancelRename() {
  if (renaming.value) return;
  editingKey.value = null;
  renameOpen.value = false;
}
async function saveName() {
  const key = editingKey.value;
  const name = editedName.value.trim();
  if (!key || !name || name === key.name || keyMutationBusy.value || !managerActive.value) return;
  renaming.value = true;
  try {
    const updated = await renameApiKey(key.id, name);
    if (disposed) return;
    overview.value.keys = overview.value.keys.map(item => item.id === key.id ? updated : item);
    editingKey.value = null;
    renameOpen.value = false;
    ElMessage.success('名称已更新');
  } catch (error) { if (!disposed) ElMessage.error(errorMessage(error)); }
  finally { renaming.value = false; }
}
function beginDelete(key: ApiKeyRecord) {
  if (keyMutationBusy.value || loading.value || loadError.value || !managerActive.value) return;
  deletingKey.value = key;
  deleteOpen.value = true;
}
async function confirmDelete() {
  const key = deletingKey.value;
  if (!key || keyMutationBusy.value || !managerActive.value || disposed) return;
  deleting.value = key.id;
  try {
    await deleteApiKey(key.id);
    if (disposed) return;
    overview.value.keys = overview.value.keys.filter(item => item.id !== key.id);
    deleteOpen.value = false;
    deletingKey.value = null;
    ElMessage.success('密钥已删除');
  } catch (error) { if (!disposed) ElMessage.error(errorMessage(error)); }
  finally { deleting.value = ''; }
}
async function copy(value: string) {
  try { await navigator.clipboard.writeText(value); ElMessage.success('已复制'); }
  catch { ElMessage.warning('无法访问剪贴板，请手动选择并复制。'); }
}
function formatDate(value: string | null) { return value ? value.slice(0, 10) : '尚未使用'; }
onMounted(loadKeys);
let disposed = false;
onBeforeUnmount(() => {
  disposed = true;
  ++loadRevision;
  secret.value = '';
  secretOpen.value = createOpen.value = renameOpen.value = deleteOpen.value = false;
  editingKey.value = deletingKey.value = null;
  overview.value.keys = [];
});
</script>

<style scoped>
.api-center { container-type: inline-size; min-width: 0; padding: 0 10px 40px; color: var(--el-text-color-primary); }
@media (max-width: 900px) { .api-center { padding: 8px 0 24px; } }
</style>

<style>
.api-key-dialog.el-dialog { padding: 0; max-height: calc(100dvh - 32px); display: flex; flex-direction: column; overflow: hidden; border-radius: 16px; box-shadow: 0 24px 72px rgba(31, 42, 68, .2); font-family: var(--app-font-family); }
.api-key-dialog .el-dialog__header { flex-shrink: 0; margin: 0; padding: 24px 64px 22px 28px; border-bottom: 1px solid var(--el-border-color-lighter); }
.api-key-dialog .el-dialog__headerbtn { top: 18px; right: 18px; width: 34px; height: 34px; border-radius: 8px; }
.api-key-dialog .el-dialog__headerbtn:hover { background: var(--el-fill-color-light); }
.api-key-dialog .el-dialog__title { color: var(--el-text-color-primary); font-weight: 600; }
.api-key-dialog .el-dialog__body { min-height: 0; padding: 24px 28px; overflow-y: auto; color: var(--el-text-color-regular); }
.api-key-dialog .el-dialog__footer { padding: 0 28px 24px; }
.api-key-dialog .el-button { border-radius: 8px; }
.keys-management { min-width: 0; padding-top: 4px; scroll-margin-top: 24px; }
.keys-management > header { margin-bottom: 18px; }
.keys-management code { font-family: var(--app-font-family-mono); font-size: 13px; white-space: nowrap; }
.key-delete-description { margin: 0; font-size: 14px; line-height: 1.8; }
.keys-management .keys-heading { margin: 0; color: var(--el-text-color-primary); font-size: 26px; font-weight: 600; line-height: 1.4; }
.keys-management .keys-description p { margin: 0; color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.9; }
.keys-management .keys-description p + p { margin-top: 3px; }
.keys-management .keys-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin: 24px 0 18px; }
.keys-management .keys-details-toggle { display: inline-flex; align-items: center; gap: 8px; min-height: 36px; padding: 4px 0; border: 0; background: transparent; color: var(--el-text-color-regular); font: inherit; font-size: 14px; cursor: pointer; }
.keys-management .keys-details-toggle:hover { color: var(--app-accent); }
.keys-management .keys-details-toggle:focus-visible { outline: 2px solid var(--app-accent); outline-offset: 4px; border-radius: 3px; }
.keys-management .keys-details-toggle .el-icon { font-size: 13px; transition: transform .2s; }
.keys-management .keys-details-toggle .is-expanded { transform: rotate(180deg); }
.keys-management .keys-details { margin: -6px 0 18px; }
.keys-management .keys-details p { margin: 0; color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.8; }
.keys-management .keys-create-button { flex-shrink: 0; height: 32px; margin-left: auto; padding: 0 12px; border-radius: 7px; font-size: 13px; font-weight: 500; }
.keys-management .keys-create-button .el-icon { font-size: 14px; }
.keys-management .keys-panel { border: 1px solid var(--el-border-color-lighter); border-radius: 10px; overflow: hidden; }
.keys-management .keys-table { --el-table-header-bg-color: var(--el-fill-color-light); --el-table-header-text-color: var(--el-text-color-regular); --el-table-border-color: var(--el-border-color-lighter); }
.keys-management .keys-table::before, .keys-management .keys-table .el-table__inner-wrapper::before { display: none; }
.keys-management .keys-table th.el-table__cell { height: 46px; font-size: 13px; font-weight: 500; }
.keys-management .keys-table td.el-table__cell { padding: 14px 0; }
.keys-management .keys-table .cell { padding: 0 16px; }
.keys-management .keys-table .el-button.is-text { height: auto; padding: 4px 0; }
.keys-management .keys-row-actions { display: flex; justify-content: flex-end; gap: 8px; }
.keys-management .keys-table .keys-row-actions .el-button { flex-shrink: 0; width: 32px; height: 32px; margin: 0; padding: 0; font-size: 16px; }
.keys-management .keys-mobile-actions { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 8px; }
.keys-management .keys-mobile-actions .el-button { margin: 0; padding: 4px 0; }
.keys-management .keys-table .keys-date { color: var(--el-text-color-secondary); font-size: 12px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.api-key-dialog code { font-family: var(--app-font-family-mono); font-size: 12px; overflow-wrap: anywhere; }
.keys-management .keys-mobile-list { display: none; }
.api-key-dialog--compact .el-dialog__header { padding-bottom: 18px; }
.api-key-dialog--compact .el-form-item { margin-bottom: 0; }
.api-key-dialog--create .el-dialog__header { padding: 22px 60px 12px 24px; border-bottom: 0; }
.api-key-dialog--create .el-dialog__headerbtn { top: 14px; right: 14px; }
.api-key-dialog--create .el-dialog__body { padding: 0 24px 20px; }
.api-key-dialog--create .el-dialog__footer { padding: 0 24px 22px; }
.api-key-dialog--create .key-create-description { margin: 0 0 8px; font-size: 14px; line-height: 1.6; }
.api-key-dialog--create .el-input__wrapper { min-height: 40px; padding: 0 14px; border-radius: 999px; box-sizing: border-box; box-shadow: 0 0 0 1px var(--el-text-color-regular) inset; }
.api-key-dialog--create .el-input__wrapper:hover { box-shadow: 0 0 0 1px var(--el-text-color-regular) inset; }
.api-key-dialog--create .el-input__wrapper.is-focus { box-shadow: 0 0 0 1px var(--el-color-primary) inset; }
.api-key-dialog--create .el-button { min-width: 72px; height: 36px; padding: 0 20px; border-radius: 999px; }
.api-key-dialog--create .el-button--primary.is-disabled { --el-button-disabled-bg-color: var(--el-text-color-placeholder); --el-button-disabled-border-color: var(--el-text-color-placeholder); --el-button-disabled-text-color: var(--el-color-white); }
.api-key-dialog--secret .el-dialog__header { padding: 22px 60px 12px 24px; border-bottom: 0; }
.api-key-dialog--secret .el-dialog__headerbtn { top: 14px; right: 14px; }
.api-key-dialog--secret .el-dialog__body { padding: 0 24px 24px; }
.api-key-dialog--secret .secret-description { margin: 0; color: var(--el-text-color-secondary); font-size: 14px; line-height: 1.7; }
.api-key-dialog--secret .secret-value { display: flex; align-items: center; gap: 10px; padding: 5px 5px 5px 14px; margin: 18px 0; background: var(--el-fill-color-light); border: 1px solid var(--el-border-color); border-radius: 999px; }
.api-key-dialog--secret .secret-value code { flex: 1; min-width: 0; overflow-x: auto; white-space: nowrap; user-select: all; scrollbar-width: none; }
.api-key-dialog--secret .secret-value code::-webkit-scrollbar { display: none; }
.api-key-dialog--secret .secret-copy-button { flex-shrink: 0; height: 36px; margin: 0; padding: 0 14px; border-radius: 999px; --el-button-text-color: #fff; --el-button-bg-color: #111318; --el-button-border-color: #111318; --el-button-hover-text-color: #fff; --el-button-hover-bg-color: #292c32; --el-button-hover-border-color: #292c32; --el-button-active-text-color: #fff; --el-button-active-bg-color: #111318; --el-button-active-border-color: #111318; }
.api-key-dialog--secret .secret-security-note { margin: 0; color: var(--el-text-color-primary); font-size: 14px; line-height: 1.7; }
@media (max-width: 640px) {
  .api-key-dialog .el-dialog__header { padding: 20px 52px 18px 20px; }
  .api-key-dialog .el-dialog__body { padding: 20px; }
  .api-key-dialog .el-dialog__footer { padding: 0 20px 20px; }
  .api-key-dialog .el-dialog__headerbtn { top: 14px; right: 12px; }
  .keys-management .keys-heading { font-size: 22px; }
  .keys-management .keys-toolbar { flex-wrap: wrap; gap: 12px; margin-top: 20px; }
  .keys-management .keys-table--has-data { display: none; }
  .keys-management .keys-table .el-table__header-wrapper { display: none; }
  .keys-management .keys-table .el-scrollbar__wrap { overflow-x: hidden; }
  .keys-management .keys-table .el-table__empty-text { width: 100%; padding: 12px 16px; box-sizing: border-box; line-height: 1.8; }
  .keys-management .keys-mobile-list { display: block; }
  .keys-management .keys-mobile-item { padding: 16px; }
  .keys-management .keys-mobile-item + .keys-mobile-item { border-top: 1px solid var(--el-border-color-lighter); }
  .keys-management .keys-mobile-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
  .keys-management .keys-mobile-title strong { min-width: 0; color: var(--el-text-color-primary); font-size: 14px; overflow-wrap: anywhere; }
  .keys-management .keys-mobile-item dl { margin: 12px 0 4px; font-size: 12px; }
  .keys-management .keys-mobile-item dl div { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px; margin-top: 6px; }
  .keys-management .keys-mobile-item dt { color: var(--el-text-color-secondary); }
  .keys-management .keys-mobile-item dd { margin: 0; font-variant-numeric: tabular-nums; }
  .keys-management .keys-mobile-item > .el-button { padding: 6px 0; }
  .api-key-dialog--create .el-dialog__header { padding: 20px 52px 12px 20px; }
  .api-key-dialog--create .el-dialog__body { padding: 0 20px 20px; }
  .api-key-dialog--create .el-dialog__footer { padding: 0 20px 20px; }
  .api-key-dialog--secret .el-dialog__header { padding: 20px 52px 12px 20px; }
  .api-key-dialog--secret .el-dialog__body { padding: 0 20px 20px; }
}
</style>
