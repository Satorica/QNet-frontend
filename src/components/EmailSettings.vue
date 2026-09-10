<template>
  <el-dialog :model-value="true" :title="title" width="480px" class="email-settings"
    append-to-body align-center :close-on-click-modal="false" :close-on-press-escape="!busy"
    :show-close="!busy" @update:model-value="close">
    <div v-if="loading" class="email-loading" role="status">
      <el-skeleton :rows="4" animated />
      <p>正在同步邮箱与登录状态…</p>
    </div>
    <div v-else-if="loadError" class="email-load-error">
      <el-alert :title="loadError" type="error" :closable="false" show-icon />
      <el-button @click="loadUser">重新加载</el-button>
    </div>
    <template v-else>
      <p v-if="!completed && !passwordMode" class="email-description email-intro">{{ hasEmail ? '验证新邮箱后即可更换，账号数据和登录密码保持不变。' : (reason || '绑定后即可提交求解任务，并在 Web 与小程序中使用同一账号。') }}</p>
      <div class="email-summary">
        <span class="email-summary-icon" aria-hidden="true"><el-icon><Message /></el-icon></span>
        <div class="email-summary-copy">
          <span class="email-summary-label">{{ hasEmail ? '当前绑定邮箱' : '邮箱状态' }}</span>
          <strong>{{ user?.maskedEmail || '尚未绑定邮箱' }}</strong>
        </div>
        <span class="email-status" :class="{ unbound: !hasEmail }"><el-icon v-if="hasEmail" aria-hidden="true"><Check /></el-icon>{{ hasEmail ? '已绑定' : '未绑定' }}</span>
      </div>

      <template v-if="completed && !passwordMode">
        <div class="email-complete" role="status">
          <el-icon><CircleCheck /></el-icon>
          <h3>{{ successMessage }}</h3>
          <p>{{ user?.hasPassword === false ? '现在可以提交求解任务。设置登录密码后，也可通过邮箱和密码登录 Web 端。' : '账号信息已同步。下次使用邮箱登录时，请输入当前绑定邮箱和原密码。' }}</p>
        </div>
      </template>

      <el-form v-else-if="passwordMode" label-position="top" :disabled="busy" @submit.prevent="savePassword">
        <p class="email-description">为当前邮箱设置登录密码，之后也可继续扫码登录。</p>
        <el-form-item label="登录密码">
          <el-input v-model="password" type="password" show-password autocomplete="new-password" maxlength="16" placeholder="8–16 位，包含字母和数字" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="passwordAgain" type="password" show-password autocomplete="new-password" maxlength="16" placeholder="请再次输入密码" @keyup.enter="savePassword" />
        </el-form-item>
      </el-form>

      <el-form v-else label-position="top" :disabled="busy" @submit.prevent="submit">
        <el-form-item :label="hasEmail ? '新邮箱' : '邮箱地址'" required>
          <el-input :model-value="email" type="email" autocomplete="email" maxlength="254" placeholder="请输入邮箱地址" @update:model-value="changeAddress" />
        </el-form-item>
        <el-form-item v-if="!pendingLink" label="邮箱验证码" required>
          <div class="email-code-row">
            <el-input v-model="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="6 位验证码" @keyup.enter="submit" />
            <el-button type="primary" plain :disabled="busy || countdown > 0" :loading="sending" @click="sendCode">{{ countdown > 0 ? `${countdown} 秒后重发` : '获取验证码' }}</el-button>
          </div>
        </el-form-item>
        <div v-else class="email-link-preview" role="status">
          <h3>确认绑定邮箱</h3>
          <p>该邮箱对应 Web 端账号 <strong>{{ pendingLink.preview.nickname }}</strong>。绑定后，小程序与 Web 端将使用同一账号。</p>
          <p>两端的任务记录和额度将统一到关联后的账号。</p>
          <el-button text type="primary" :disabled="busy" @click="resetVerification">重新验证邮箱</el-button>
        </div>
        <p class="email-note"><el-icon aria-hidden="true"><Lock /></el-icon><span>邮箱仅用于账号验证与登录，不会公开展示。</span></p>
        <el-button v-if="hasEmail && user?.hasPassword === false" text type="primary" :disabled="busy" @click="startPasswordSetup">设置登录密码</el-button>
      </el-form>
      <div v-if="actionError" ref="errorNotice" class="email-action-error">
        <el-alert :title="actionError" type="error" :closable="false" show-icon @open="revealError" />
      </div>
    </template>
    <template #footer>
      <template v-if="!loading && !loadError">
        <el-button :disabled="busy" @click="close">{{ completed && user?.hasPassword === false ? '稍后设置' : '关闭' }}</el-button>
        <el-button v-if="passwordMode" type="primary" :loading="submitting" :disabled="busy && !submitting" @click="savePassword">确认设置</el-button>
        <el-button v-else-if="completed && user?.hasPassword === false" type="primary" @click="startPasswordSetup">设置登录密码</el-button>
        <el-button v-else-if="completed" type="primary" @click="close">完成</el-button>
        <el-button v-else type="primary" :loading="submitting" :disabled="busy && !submitting" @click="submit">{{ pendingLink ? '确认绑定' : hasEmail ? '确认更换' : '确认绑定' }}</el-button>
      </template>
      <el-button v-else :disabled="busy" @click="close">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Check, CircleCheck, Lock, Message } from '@element-plus/icons-vue';
import { accountApi, type EmailLinkConfirmation } from '../api/account';
import { authApi } from '../api/auth';
import { userManager, type SafeUserInfo } from '../utils/auth';
import { getErrorCode, getErrorMessage } from '../utils/error';
import { EMAIL_REGEX } from '../utils/validation';
import type { AuthUserData } from '../types/api';

defineProps<{ reason?: string }>();
const emit = defineEmits<{ close: []; updated: [] }>();
const user = ref<SafeUserInfo | null>(null);
const loading = ref(true), sending = ref(false), submitting = ref(false);
const loadError = ref(''), actionError = ref('');
const errorNotice = ref<HTMLElement>();
async function revealError() {
  await nextTick();
  errorNotice.value?.scrollIntoView({ block: 'nearest' });
}
const email = ref(''), code = ref(''), countdown = ref(0);
const pendingLink = ref<EmailLinkConfirmation | null>(null);
const completed = ref(false), successMessage = ref('');
const passwordMode = ref(false), password = ref(''), passwordAgain = ref('');
const hasEmail = computed(() => Boolean(user.value?.maskedEmail));
const busy = computed(() => sending.value || submitting.value);
const title = computed(() => passwordMode.value ? '设置登录密码' : completed.value ? '邮箱设置' : hasEmail.value ? '更换邮箱' : '绑定邮箱');
const initialIdentity = userManager.getUserInfo()?.id;
const remember = localStorage.getItem('rememberMe') === 'true';
let disposed = false;
let timer: ReturnType<typeof setInterval> | undefined;
const isCurrent = () => !disposed && Boolean(initialIdentity) && userManager.getUserInfo()?.id === initialIdentity;

function clearCountdown() {
  if (timer !== undefined) clearInterval(timer);
  timer = undefined;
  countdown.value = 0;
}

function resetVerification() {
  pendingLink.value = null;
  code.value = '';
  clearCountdown();
}

function changeAddress(value: string) {
  if (busy.value) return;
  if (value.trim().toLowerCase() !== email.value.trim().toLowerCase()) resetVerification();
  email.value = value;
  actionError.value = '';
}

async function loadUser() {
  if (!isCurrent()) return;
  loading.value = true;
  loadError.value = '';
  try {
    const response = await authApi.verifyToken();
    if (!isCurrent()) return;
    if (!response.success || !response.data?.user) throw new Error(response.message || '账号状态加载失败');
    if (response.data.user.id !== initialIdentity) {
      userManager.setUserInfo(response.data.user, remember);
      emit('close');
      return;
    }
    userManager.setUserInfo(response.data.user, remember);
    user.value = userManager.getUserInfo();
  } catch (error) {
    if (isCurrent()) loadError.value = getErrorMessage(error, '账号状态加载失败，请重试');
  } finally {
    if (!disposed) loading.value = false;
  }
}

function validEmail() {
  email.value = email.value.trim().toLowerCase();
  if (!EMAIL_REGEX.test(email.value)) {
    actionError.value = '请输入有效的邮箱地址';
    return false;
  }
  return true;
}

async function sendCode() {
  if (!isCurrent() || busy.value || loading.value || loadError.value || countdown.value > 0) return;
  actionError.value = '';
  if (!validEmail()) return;
  sending.value = true;
  try {
    await accountApi.sendEmailCode(email.value);
    if (!isCurrent()) return;
    resetVerification();
    const deadline = Date.now() + 60000;
    countdown.value = 60;
    timer = setInterval(() => {
      countdown.value = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (!countdown.value) clearCountdown();
    }, 1000);
    ElMessage.success('验证码已发送');
  } catch (error) {
    if (isCurrent()) actionError.value = getErrorMessage(error, '验证码发送失败，请重试');
  } finally {
    sending.value = false;
  }
}

function finish(result: AuthUserData) {
  if (!result.user) throw new Error('账号信息响应不完整，请重新打开邮箱设置');
  successMessage.value = hasEmail.value ? '邮箱已更换' : '邮箱已绑定';
  userManager.setUserInfo(result.user, remember);
  user.value = userManager.getUserInfo();
  completed.value = true;
  resetVerification();
  email.value = '';
  emit('updated');
}

async function submit() {
  if (!isCurrent() || busy.value || loading.value || loadError.value || completed.value) return;
  actionError.value = '';
  if (!validEmail()) return;
  if (!pendingLink.value && !/^\d{6}$/.test(code.value.trim())) {
    actionError.value = '请输入 6 位数字验证码';
    return;
  }
  submitting.value = true;
  try {
    if (pendingLink.value) {
      // 已绑定邮箱的账号只允许更换空闲邮箱，不能进入关联确认。
      if (hasEmail.value) throw new Error('该邮箱已被其他账号使用，请更换邮箱');
      const result = await accountApi.confirmEmailLink(pendingLink.value.linkTicket);
      if (isCurrent()) finish(result);
      return;
    }
    const result = await accountApi.changeEmail(email.value, code.value.trim());
    if (!isCurrent()) return;
    if ('requiresConfirmation' in result) {
      code.value = '';
      if (hasEmail.value) throw new Error('该邮箱已被其他账号使用，请更换邮箱');
      pendingLink.value = result;
    } else {
      finish(result);
    }
  } catch (error) {
    if (!isCurrent()) return;
    const errorCode = getErrorCode(error);
    if (['TICKET_EXPIRED', 'ACCOUNT_CHANGED', 'ACCOUNT_UNAVAILABLE', 'WECHAT_ALREADY_BOUND', 'EMAIL_ALREADY_REGISTERED'].includes(String(errorCode))) resetVerification();
    actionError.value = errorCode === 'TICKET_EXPIRED'
      ? '关联确认已过期，请重新获取邮箱验证码'
      : getErrorMessage(error, '邮箱设置失败，请重试');
  } finally {
    submitting.value = false;
  }
}

function startPasswordSetup() {
  if (!isCurrent() || busy.value || user.value?.hasPassword !== false) return;
  passwordMode.value = true;
  actionError.value = '';
  resetVerification();
}

async function savePassword() {
  if (!isCurrent() || busy.value || !passwordMode.value) return;
  actionError.value = '';
  if (!/^(?=.*[A-Za-z])(?=.*\d).{8,16}$/.test(password.value) || password.value.trim() !== password.value) {
    actionError.value = '密码需为 8–16 位，包含字母和数字，首尾不能有空格';
    return;
  }
  if (password.value !== passwordAgain.value) {
    actionError.value = '两次输入的密码不一致';
    return;
  }
  submitting.value = true;
  try {
    await accountApi.setPassword(password.value);
    if (!isCurrent()) return;
    const current = userManager.getUserInfo();
    if (current) userManager.setUserInfo({ ...current, hasPassword: true }, remember);
    ElMessage.success('登录密码已设置');
    emit('close');
  } catch (error) {
    if (!isCurrent()) return;
    actionError.value = getErrorMessage(error, '密码设置失败，请重试');
    if (getErrorCode(error) === 'PASSWORD_ALREADY_SET') {
      passwordMode.value = false;
      await loadUser();
    }
  } finally {
    password.value = '';
    passwordAgain.value = '';
    submitting.value = false;
  }
}

function close() {
  if (!busy.value) emit('close');
}

onMounted(loadUser);
onUnmounted(() => { disposed = true; resetVerification(); password.value = ''; passwordAgain.value = ''; });
</script>

<style>
.el-dialog.email-settings {
  --el-border-radius-base: 8px;
  --email-surface: rgba(var(--app-accent-rgb), 0.035);
  --email-border: rgba(var(--app-accent-rgb), 0.16);
  --email-strong: var(--el-color-primary-dark-2);
  --email-muted: var(--el-text-color-regular);
  max-width: calc(100vw - 32px);
  max-height: calc(100dvh - 32px);
  display: flex;
  flex-direction: column;
  border-radius: 18px;
  padding: 24px;
  border: 1px solid var(--email-border);
  box-shadow: 0 24px 72px rgba(20, 30, 48, 0.18), 0 4px 16px rgba(20, 30, 48, 0.06);
}
.email-settings .el-dialog__header { padding: 0 36px 0 0; flex-shrink: 0; }
.email-settings .el-dialog__title { font-size: 20px; font-weight: 600; line-height: 28px; color: var(--el-text-color-primary); }
.email-settings .el-dialog__headerbtn { top: 16px; right: 16px; width: 36px; height: 36px; border-radius: 8px; }
.email-settings .el-dialog__headerbtn:hover { background: var(--email-surface); }
.email-settings .el-dialog__headerbtn:focus-visible { outline: 2px solid var(--app-accent); outline-offset: 2px; }
.email-settings .el-dialog__body { min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 20px 4px 24px; margin: 0 -4px; }
.email-settings .el-dialog__footer { flex-shrink: 0; border-top: 1px solid var(--app-border); padding-top: 20px; }
.email-settings .el-dialog__footer .el-button { height: 40px; min-width: 88px; padding: 0 20px; border-radius: 8px; font-weight: 500; }
.email-settings .el-dialog__footer .el-button--primary { min-width: 112px; }
.email-settings .el-button:focus-visible { outline: 2px solid var(--app-accent); outline-offset: 3px; }
.email-settings .email-description { font-size: 13px; line-height: 1.8; color: var(--email-muted); margin: 0 0 20px; }
.email-settings .email-intro { margin: -8px 0 20px; }
.email-settings .email-summary { display: flex; align-items: center; gap: 10px; padding: 8px 12px; margin-bottom: 20px; background: var(--email-surface); border: 1px solid var(--email-border); border-radius: 10px; }
.email-settings .email-summary-icon { display: grid; place-items: center; width: 32px; height: 32px; flex-shrink: 0; color: var(--app-accent); background: var(--el-bg-color); border: 1px solid var(--email-border); border-radius: 8px; font-size: 17px; }
.email-settings .email-summary-copy { display: grid; gap: 0; min-width: 0; flex: 1; }
.email-settings .email-summary-label { color: var(--email-muted); font-size: 12px; line-height: 16px; }
.email-settings .email-summary-copy strong { font-size: 14px; line-height: 20px; font-weight: 600; overflow-wrap: anywhere; color: var(--el-text-color-primary); }
.email-settings .email-status { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 500; line-height: 18px; color: var(--email-strong); background: rgba(var(--app-accent-rgb), 0.09); }
.email-settings .email-status.unbound { color: var(--email-muted); background: var(--el-fill-color); }
.email-settings .el-form-item { margin-bottom: 22px; }
.email-settings .el-form-item__label { color: var(--el-text-color-primary); font-size: 13px; font-weight: 500; line-height: 20px; margin-bottom: 8px; }
.email-settings .el-input__wrapper { min-height: 40px; box-sizing: border-box; border-radius: 8px; padding: 0 12px; background: var(--app-control-bg); box-shadow: none; transition: box-shadow 150ms; }
.email-settings .el-input__wrapper:hover { box-shadow: 0 0 0 1px var(--app-border) inset; }
.email-settings .el-input__wrapper.is-focus { background: var(--app-control-bg); box-shadow: 0 0 0 1px var(--app-accent) inset; }
.email-settings .el-input__inner { height: 38px; font-size: 14px; }
.email-settings .el-input__inner::placeholder { color: var(--email-muted); font-size: 13px; }
.email-settings .el-input.is-disabled .el-input__wrapper { background: var(--app-control-bg); box-shadow: none; }
.email-settings .email-code-row { display: flex; width: 100%; gap: 12px; }
.email-settings .email-code-row .el-input { min-width: 0; flex: 1; }
.email-settings .email-code-row .el-button { height: 40px; min-width: 120px; border-radius: 8px; font-weight: 500; }
.email-settings .email-code-row .el-button--primary.is-plain:not(.is-disabled) { --el-button-text-color: var(--email-strong); --el-button-bg-color: var(--email-surface); --el-button-border-color: var(--email-border); }
.email-settings .email-code-row .el-button.is-disabled { color: var(--email-muted); background: var(--el-fill-color-light); border-color: var(--app-border); }
.email-settings .email-note { display: flex; align-items: flex-start; gap: 6px; color: var(--email-muted); font-size: 12px; line-height: 20px; margin: 2px 0 0; }
.email-settings .email-note .el-icon { margin-top: 3px; flex-shrink: 0; font-size: 14px; }
.email-settings .email-action-error { margin-top: 14px; }
.email-settings .el-alert--error { --el-alert-bg-color: var(--el-color-danger-light-9); color: #b4232c; border: 1px solid var(--el-color-danger-light-7); border-radius: 8px; padding: 10px 12px; }
.email-settings .el-alert__title { font-size: 13px; line-height: 21px; overflow-wrap: anywhere; }
.email-settings .email-action-error .el-alert { padding: 5px 10px; border-radius: 6px; }
.email-settings .email-action-error .el-alert__title { line-height: 20px; }
.email-settings .email-action-error .el-alert__icon { font-size: 14px; width: 14px; margin-right: 7px; }
.email-settings .email-link-preview { padding: 16px; border: 1px solid var(--email-border); border-radius: 10px; margin-bottom: 20px; background: var(--email-surface); }
.email-settings .email-link-preview h3 { margin: 0; font-size: 15px; color: var(--el-text-color-primary); }
.email-settings .email-link-preview p { font-size: 13px; line-height: 1.8; overflow-wrap: anywhere; color: var(--email-muted); }
.email-settings .email-link-preview .el-button { padding: 0; }
.email-settings .email-complete { padding: 4px 4px 8px; text-align: center; }
.email-settings .email-complete > .el-icon { font-size: 40px; color: var(--app-accent); }
.email-settings .email-complete h3 { color: var(--el-text-color-primary); font-size: 18px; margin: 12px 0; }
.email-settings .email-complete p { font-size: 13px; line-height: 1.8; margin: 0; color: var(--email-muted); }
.email-settings .email-load-error { display: grid; justify-items: start; gap: 16px; }
.email-settings .email-loading p { font-size: 13px; color: var(--email-muted); margin-bottom: 0; }
@media (max-width: 520px) {
  .el-dialog.email-settings { padding: 20px; max-height: calc(100dvh - 24px); }
  .email-settings .el-dialog__headerbtn { top: 12px; right: 12px; }
  .email-settings .email-summary { padding: 8px 10px; gap: 8px; }
  .email-settings .email-code-row { gap: 8px; }
  .email-settings .email-code-row .el-button { min-width: 108px; padding: 0 10px; }
}
@media (max-width: 360px) {
  .email-settings .email-summary-icon { width: 28px; height: 28px; font-size: 16px; }
  .email-settings .email-status { padding: 2px 5px; gap: 2px; }
}
@media (prefers-reduced-motion: reduce) {
  .email-settings .el-input__wrapper { transition: none; }
}
</style>
