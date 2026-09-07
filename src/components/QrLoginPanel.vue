<template>
  <div class="qr-panel" aria-live="polite">
    <div
      class="qr-frame"
      :class="[`is-${visualState}`, { 'has-placeholder': !image || terminal }]"
      :aria-busy="loading"
    >
      <img v-if="image && !terminal" :src="image" alt="请使用微信扫一扫此小程序码登录" />
      <div v-else class="qr-placeholder">
        <div v-if="loading" class="status-loader" aria-hidden="true">
          <svg viewBox="0 0 44 44" fill="none">
            <circle class="status-loader__track" cx="22" cy="22" r="17" />
            <path class="status-loader__arc" d="M22 5a17 17 0 0 1 17 17" />
          </svg>
        </div>
        <div v-else class="state-icon" aria-hidden="true">
          <svg v-if="state === 'expired'" viewBox="0 0 64 64" fill="none">
            <path class="state-icon__soft" d="M48.2 20.7A20 20 0 1 1 41.3 14" />
            <path d="M32 20v13l8.5 5" />
            <path d="M41.8 10.5v8.7h8.7" />
          </svg>
          <svg v-else-if="state === 'consumed'" viewBox="0 0 64 64" fill="none">
            <circle class="state-icon__soft" cx="32" cy="32" r="20" />
            <path d="m23.5 32.5 5.7 5.7L41.5 25" />
          </svg>
          <svg v-else-if="state === 'cancelled'" viewBox="0 0 64 64" fill="none">
            <circle class="state-icon__soft" cx="32" cy="32" r="20" />
            <path d="m25 25 14 14M39 25 25 39" />
          </svg>
          <svg v-else-if="state === 'error'" viewBox="0 0 64 64" fill="none">
            <circle class="state-icon__soft" cx="32" cy="32" r="20" />
            <path d="M32 21.5v13M32 42.5h.01" />
          </svg>
          <svg v-else viewBox="0 0 64 64" fill="none">
            <path d="M13 13h15v15H13zM36 13h15v15H36zM13 36h15v15H13z" />
            <path class="state-icon__soft" d="M36 36h6v6h-6zM45 36h6v15H45zM36 45h6v6h-6z" />
          </svg>
        </div>
        <span class="placeholder-message">{{ loading ? '正在生成小程序码…' : message }}</span>
      </div>
    </div>
    <p class="qr-title">{{ state === 'scanned' ? '已扫码，请在小程序中确认' : '使用微信扫一扫' }}</p>
    <p v-if="!terminal && !loading" class="qr-status">{{ message }}</p>
    <el-button v-if="terminal" type="primary" plain :loading="loading" @click="create">重新获取小程序码</el-button>
  </div>
</template>

<script setup lang="ts">
import axios from 'axios';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { cloudApi } from '../api';
import type { ApiResponse, UserInfo } from '../types/api';
import { getErrorMessage } from '../utils/error';

const emit = defineEmits<{
  (event: 'logged-in', user: UserInfo): void;
  (event: 'redeeming', pending: boolean): void;
}>();
const loading = ref(false);
const image = ref('');
const state = ref('waiting');
const message = ref('扫码后，请在小程序确认登录');
const terminal = computed(() => ['error', 'expired', 'cancelled', 'consumed'].includes(state.value));
const visualState = computed(() => loading.value ? 'loading' : state.value);
let requestId = '';
let generation = 0;
let disposed = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let expiresAt = 0;
let pollFailures = 0;

const cancel = (id: string) => {
  if (id) void cloudApi.post(`/auth/qr-login/${id}/browser-cancel`).catch(() => undefined);
};
const stop = () => { if (timer) clearTimeout(timer); timer = undefined; };
const schedulePoll = (run: number, delay = 2000) => {
  timer = setTimeout(() => poll(run), delay);
};

const isRetriablePollError = (error: unknown) => {
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === undefined || status === 408 || status === 429 || status >= 500;
};

const handlePollError = (error: unknown, run: number) => {
  if (disposed || run !== generation) return;
  if (isRetriablePollError(error) && image.value && Date.now() < expiresAt * 1000) {
    pollFailures += 1;
    message.value = '连接暂时不稳定，正在重试登录状态…';
    schedulePoll(run, Math.min(10000, 2000 * (2 ** (pollFailures - 1))));
    return;
  }
  if (expiresAt && Date.now() >= expiresAt * 1000) {
    state.value = 'expired';
    message.value = '小程序码已过期';
    return;
  }
  state.value = 'error';
  message.value = getErrorMessage(error, '登录状态获取失败，请刷新小程序码');
};

async function create() {
  stop();
  cancel(requestId);
  requestId = '';
  expiresAt = 0;
  pollFailures = 0;
  const run = ++generation;
  loading.value = true;
  image.value = '';
  state.value = 'waiting';
  try {
    const response = await cloudApi.post<ApiResponse<{ requestId: string; image: string; expiresAt: number }>>('/auth/qr-login');
    const data = response.data.data;
    if (!response.data.success || !data) throw new Error(response.data.message || '无法生成小程序码');
    if (disposed || run !== generation) { cancel(data.requestId); return; }
    requestId = data.requestId;
    expiresAt = data.expiresAt;
    image.value = data.image;
    message.value = '扫码后，请在小程序确认登录';
    schedulePoll(run);
  } catch (error) {
    if (disposed || run !== generation) return;
    state.value = 'error';
    message.value = getErrorMessage(error, '小程序码加载失败，请稍后重试');
  } finally { if (!disposed && run === generation) loading.value = false; }
}

async function poll(run: number) {
  if (disposed || run !== generation) return;
  let response;
  try {
    response = await cloudApi.get<ApiResponse<{ state: string }>>(`/auth/qr-login/${requestId}`);
  } catch (error) {
    handlePollError(error, run);
    return;
  }
  if (disposed || run !== generation) return;
  pollFailures = 0;
  const next = response.data.data?.state;
  if (!next) {
    handlePollError(new Error('登录状态获取失败'), run);
    return;
  }
  state.value = next;
  if (next === 'confirmed') {
    message.value = '已确认，正在登录…';
    // Lock the parent before starting the request: discarding its result would
    // not undo the browser's processing of the authentication Set-Cookie.
    emit('redeeming', true);
    try {
      const result = await cloudApi.post<ApiResponse<{ user: UserInfo }>>(`/auth/qr-login/${requestId}/redeem`);
      if (disposed || run !== generation) return;
      if (!result.data.success || !result.data.data?.user) throw new Error('登录失败，请重新扫码');
      requestId = '';
      emit('logged-in', result.data.data.user);
    } catch (error) {
      if (disposed || run !== generation) return;
      state.value = 'error';
      message.value = getErrorMessage(error, '登录失败，请重新获取小程序码');
    } finally {
      emit('redeeming', false);
    }
    return;
  }
  const messages: Record<string, string> = {
    waiting: '扫码后，请在小程序确认登录', scanned: '已扫码，请在小程序确认登录',
    expired: '小程序码已过期', cancelled: '已取消登录', consumed: '此小程序码已使用',
  };
  message.value = messages[next] || '请重新扫码';
  if (!terminal.value) schedulePoll(run);
}

onMounted(create);
onUnmounted(() => { disposed = true; generation += 1; stop(); cancel(requestId); });
</script>

<style scoped>
.qr-panel { text-align: center; padding-bottom: 12px; }
.qr-frame { width: 224px; height: 224px; margin: 0 auto 20px; border: 1px solid #e2e8f0; border-radius: 18px; padding: 10px; background: #fff; box-sizing: border-box; overflow: hidden; transition: border-color .2s ease, background .2s ease; }
.qr-frame.has-placeholder { border-color: #e3e8f0; background: #fbfcfe; }
.qr-frame.is-expired { border-color: #eee4d6; background: #fffdf9; }
.qr-frame.is-consumed { border-color: #dceae4; background: #fbfefc; }
.qr-frame img { width: 100%; height: 100%; object-fit: contain; }
.qr-placeholder { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 11px; padding: 12px; box-sizing: border-box; color: #64748b; font-size: 13px; line-height: 1.6; }
.placeholder-message { color: #667085; font-weight: 400; letter-spacing: .01em; }

.status-loader { width: 44px; height: 44px; color: #7083df; }
.status-loader svg { width: 100%; height: 100%; animation: loader-spin .9s linear infinite; }
.status-loader__track, .status-loader__arc { stroke-width: 2.5; }
.status-loader__track { stroke: #e8ebf6; }
.status-loader__arc { stroke: currentColor; stroke-linecap: round; }

.state-icon { display: grid; place-items: center; width: 48px; height: 48px; color: #d49a4b; }
.state-icon svg { width: 42px; height: 42px; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.state-icon__soft { stroke-width: 1.8; opacity: .72; }
.is-error .state-icon { color: #d97b78; }
.is-cancelled .state-icon { color: #98a2b3; }
.is-consumed .state-icon { color: #54a27e; }
.is-waiting .state-icon { color: #7788a5; }

@keyframes loader-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .status-loader svg { animation: none; } }
.qr-title { font-size: 17px; color: #1e293b; font-weight: 600; margin: 0 0 10px; }
.qr-status { font-size: 12px; color: #2563eb; line-height: 1.7; }
</style>
