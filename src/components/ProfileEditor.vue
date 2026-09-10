<template>
  <el-dialog
    :model-value="true"
    title="编辑个人资料"
    width="520px"
    class="profile-editor"
    append-to-body
    align-center
    :close-on-click-modal="false"
    :close-on-press-escape="!saving"
    :show-close="!saving"
    @update:model-value="close"
  >
    <div v-if="loading" class="profile-loading" role="status">
      <el-skeleton :rows="6" animated />
      <span>正在加载个人资料…</span>
    </div>
    <div v-else-if="loadError" class="profile-load-error" role="alert">
      <el-alert :title="loadError" type="error" :closable="false" show-icon />
      <el-button @click="loadProfile">重新加载</el-button>
    </div>
    <el-form v-else ref="formRef" :model="draft" :rules="rules" label-position="top" :disabled="saving" @submit.prevent="save">
      <div class="profile-identity">
        <button class="profile-avatar-button" type="button" aria-label="更换头像" :disabled="saving" @click="fileInput?.click()">
          <el-avatar :size="72" :src="previewUrl || draft.avatarUrl || defaultAvatar">
            <img :src="defaultAvatar" alt="默认头像" />
          </el-avatar>
        </button>
        <div class="profile-avatar-copy">
          <el-button text type="primary" :disabled="saving" @click="fileInput?.click()">更换头像</el-button>
          <p class="profile-account"><span>用户 ID</span><span>{{ userId }}</span></p>
          <p>JPG、PNG、WEBP · 不超过 5 MB</p>
        </div>
        <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" class="profile-file-input" :disabled="saving" aria-label="选择头像文件" @change="selectAvatar" />
      </div>
      <el-form-item label="昵称" prop="nickname">
        <template #label>
          <span class="profile-label">昵称<span class="profile-field-tip">1–30 个字符</span></span>
        </template>
        <el-input v-model="draft.nickname" placeholder="请输入昵称" autocomplete="off" />
      </el-form-item>
      <div class="profile-fields">
        <el-form-item label="性别" prop="gender">
          <el-select v-model="draft.gender" aria-label="性别">
            <el-option v-for="gender in genders" :key="gender" :label="gender" :value="gender" />
          </el-select>
        </el-form-item>
        <el-form-item label="出生日期" prop="birthday">
          <el-date-picker v-model="draft.birthday" type="date" value-format="YYYY-MM-DD" format="YYYY-MM-DD" placeholder="请选择出生日期" :disabled-date="isFutureDate" :editable="false" />
        </el-form-item>
      </div>
      <el-alert v-if="saveError" :title="saveError" type="error" :closable="false" show-icon class="profile-save-error" />
      <p class="profile-sync-note">保存后将同步至同一账号的小程序。</p>
    </el-form>
    <template #footer>
      <el-button :disabled="saving" @click="close">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="loading || !!loadError" @click="save">{{ saving ? '正在保存' : '保存修改' }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { profileApi, type ProfileUpdate, type UserProfile } from '../api/profile';
import { getErrorMessage } from '../utils/error';
import defaultAvatar from '../assets/default-avatar.png';

defineProps<{ userId: string }>();
const emit = defineEmits<{ close: []; updated: [profile: UserProfile] }>();
const genders = ['男', '女', '保密'] as const;
const draft = reactive<UserProfile>({ avatarUrl: '', nickname: '', gender: '保密', birthday: '' });
const formRef = ref<FormInstance>();
const fileInput = ref<HTMLInputElement>();
const loading = ref(true);
const saving = ref(false);
const loadError = ref('');
const saveError = ref('');
const previewUrl = ref('');
let avatarFile: File | null = null;
let original: UserProfile | null = null;
let disposed = false;

const isFutureDate = (date: Date) => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date.getTime() > today.getTime();
};
const rules: FormRules = {
  nickname: [{
    validator: (_rule, value: string, callback) => {
      const length = Array.from(value.trim()).length;
      callback(length === 0 ? new Error('请输入昵称') : length > 30 ? new Error('昵称不能超过 30 个字符') : undefined);
    },
    trigger: 'blur',
  }],
};

function clearPreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = '';
}

function selectAvatar(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || saving.value) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    ElMessage.error('头像仅支持 JPG、PNG 或 WEBP 格式');
    return;
  }
  if (file.size === 0 || file.size > 5 * 1024 * 1024) {
    ElMessage.error(file.size === 0 ? '头像文件为空' : '头像不能超过 5 MB');
    return;
  }
  clearPreview();
  avatarFile = file;
  previewUrl.value = URL.createObjectURL(file);
}

async function loadProfile() {
  if (disposed) return;
  loading.value = true;
  loadError.value = '';
  try {
    const profile = await profileApi.get();
    if (disposed) return;
    original = profile;
    Object.assign(draft, profile);
    emit('updated', profile);
  } catch (error) {
    if (!disposed) loadError.value = getErrorMessage(error, '个人资料加载失败，请重试');
  } finally {
    if (!disposed) loading.value = false;
  }
}

async function save() {
  if (disposed || saving.value || loading.value || !original || loadError.value) return;
  saving.value = true;
  saveError.value = '';
  let savedFields = '';
  try {
    if (!await formRef.value?.validate().catch(() => false)) return;
    if (disposed) return;
    draft.nickname = draft.nickname.trim();
    // 以打开编辑器时的资料为基准，只提交用户实际修改的字段。
    // 头像响应可能包含小程序刚更新的资料，不能把那些字段重新写回旧值。
    const changes: ProfileUpdate = {};
    if (draft.nickname !== original.nickname) changes.nickname = draft.nickname;
    if (draft.gender !== original.gender) changes.gender = draft.gender;
    if ((draft.birthday || '') !== original.birthday) changes.birthday = draft.birthday || '';
    // 头像接口同时保存昵称；若后续字段保存失败，保留已保存结果，重试无需重复上传。
    if (avatarFile) {
      const profile = await profileApi.uploadAvatar(avatarFile, changes.nickname);
      if (disposed) return;
      original = profile;
      avatarFile = null;
      savedFields = changes.nickname === undefined ? '头像' : '头像和昵称';
      delete changes.nickname;
      Object.assign(draft, profile, changes);
      clearPreview();
      emit('updated', profile);
    }
    if (Object.keys(changes).length) {
      const profile = await profileApi.update(changes);
      if (disposed) return;
      original = profile;
      emit('updated', profile);
    }
    ElMessage.success('个人资料已保存');
    emit('close');
  } catch (error) {
    if (!disposed) {
      const message = getErrorMessage(error, '保存失败，请重试');
      saveError.value = savedFields ? `${savedFields}已保存，其他资料未保存：${message}。请重试。` : message;
    }
  } finally {
    saving.value = false;
  }
}

function close() {
  if (!saving.value) emit('close');
}

onMounted(loadProfile);
onUnmounted(() => {
  disposed = true;
  clearPreview();
});
</script>

<style>
.el-dialog.profile-editor { --el-border-radius-base: 8px; max-width: calc(100vw - 32px); border-radius: 18px; padding: 24px; }
.profile-editor .el-dialog__header { padding-bottom: 0; }
.profile-editor .el-dialog__title { font-size: 20px; font-weight: 600; line-height: 28px; }
.profile-editor .el-dialog__headerbtn { top: 14px; right: 14px; width: 40px; height: 40px; border-radius: 8px; }
.profile-editor .el-dialog__body { padding-top: 28px; padding-bottom: 20px; }
.profile-editor .el-dialog__footer { border-top: 1px solid var(--app-border); padding-top: 20px; }
.profile-editor .el-dialog__footer .el-button { height: 40px; min-width: 80px; padding: 0 20px; border-radius: 8px; }
.profile-editor .el-dialog__footer .el-button--primary { min-width: 104px; }
.profile-editor .profile-identity { display: flex; align-items: center; gap: 20px; margin-bottom: 28px; }
.profile-editor .profile-avatar-button { position: relative; border: 0; padding: 0; background: none; cursor: pointer; height: 72px; flex-shrink: 0; border-radius: 50%; }
.profile-editor .profile-avatar-button:focus-visible { outline: 2px solid var(--app-accent); outline-offset: 5px; }
.profile-editor .profile-avatar-button:disabled { cursor: wait; }
.profile-editor .profile-avatar-copy { min-width: 0; }
.profile-editor .profile-avatar-copy .el-button { padding: 0; height: 28px; font-weight: 600; border-radius: 4px; }
.profile-editor .profile-avatar-copy p { margin: 4px 0 0; color: var(--el-text-color-regular); font-size: 12px; line-height: 1.6; }
.profile-editor .profile-file-input { display: none; }
.profile-editor .profile-account { display: flex; align-items: baseline; gap: 8px; }
.profile-editor .profile-account > span:first-child { flex-shrink: 0; }
.profile-editor .profile-account > span:last-child { overflow-wrap: anywhere; min-width: 0; }
.profile-editor .el-form-item { margin-bottom: 24px; }
.profile-editor .el-form-item__label { display: block; width: 100%; padding: 0; color: var(--el-text-color-primary); line-height: 20px; margin-bottom: 8px; }
.profile-editor .profile-label { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.profile-editor .profile-fields { display: grid; grid-template-columns: 1fr 1.35fr; gap: 16px; }
.profile-editor .profile-fields .el-form-item { min-width: 0; margin-bottom: 0; }
.profile-editor .el-select, .profile-editor .el-date-editor.el-input { width: 100%; }
.profile-editor .el-input__wrapper, .profile-editor .el-select__wrapper { min-height: 40px; box-sizing: border-box; border-radius: 8px; padding-left: 12px; padding-right: 12px; background: var(--app-control-bg); box-shadow: none; }
.profile-editor .el-input__wrapper:hover, .profile-editor .el-select__wrapper:hover { box-shadow: 0 0 0 1px var(--app-border) inset; }
.profile-editor .el-input__wrapper.is-focus, .profile-editor .el-select__wrapper.is-focused { box-shadow: 0 0 0 1px var(--app-accent) inset; }
.profile-editor .el-input.is-disabled .el-input__wrapper, .profile-editor .el-select__wrapper.is-disabled { background: var(--app-control-bg); box-shadow: none; }
.profile-editor .el-form-item.is-error .el-input__wrapper, .profile-editor .el-form-item.is-error .el-select__wrapper { box-shadow: 0 0 0 1px var(--el-color-danger) inset; }
.profile-editor .el-input__inner { height: 38px; }
.profile-editor .profile-field-tip { color: var(--el-text-color-regular); font-size: 12px; font-weight: 400; }
.profile-editor .profile-sync-note { font-size: 12px; color: var(--el-text-color-regular); margin: 20px 0 0; line-height: 1.7; }
.profile-editor .profile-save-error { margin: 20px 0 16px; }
.profile-editor .profile-loading { padding: 12px 0; color: var(--el-text-color-secondary); }
.profile-editor .profile-load-error { display: grid; justify-items: start; gap: 18px; padding-bottom: 24px; }
@media (max-width: 480px) {
  .el-dialog.profile-editor { padding: 20px; }
  .profile-editor .el-dialog__headerbtn { top: 10px; right: 10px; }
  .profile-editor .profile-identity { gap: 16px; }
  .profile-editor .profile-fields { grid-template-columns: 1fr; gap: 24px; }
}
</style>
