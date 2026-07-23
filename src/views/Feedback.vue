<template>
  <div class="feedback-page">
    <el-card class="feedback-card" shadow="never">
      <div class="feedback-workspace">
        <section class="feedback-main">
          <header class="feedback-card-header">
            <div class="feedback-heading-copy">
              <h2>问题反馈</h2>
              <p>详细描述问题，有助于我们更快定位和处理。</p>
            </div>
            <el-button class="history-entry" plain type="primary" @click="goToHistory">
              <el-icon><Clock /></el-icon>
              <span>我的反馈</span>
            </el-button>
          </header>

          <div class="main-divider"></div>

          <el-form
            ref="formRef"
            :model="form"
            :rules="rules"
            label-position="top"
            class="feedback-form"
            @submit.prevent="handleSubmit"
          >
            <el-form-item label="反馈类型" prop="category">
              <el-radio-group v-model="form.category" class="category-grid">
                <el-radio-button
                  v-for="option in categoryOptions"
                  :key="option.value"
                  :label="option.value"
                  class="category-option"
                >
                  {{ option.label }}
                </el-radio-button>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="反馈内容" prop="content">
              <el-input
                v-model="form.content"
                type="textarea"
                :rows="7"
                maxlength="500"
                show-word-limit
                resize="none"
                placeholder="请描述遇到的问题、操作步骤或希望改进的地方（不少于 10 个字）"
              />
            </el-form-item>

            <el-form-item label="联系方式（选填）" prop="contact">
              <el-input
                v-model="form.contact"
                maxlength="100"
                clearable
                placeholder="邮箱、手机号或其他方便联系你的方式"
              />
              <div class="field-help">仅在需要进一步了解问题时使用。</div>
            </el-form-item>

            <div class="client-info-row" @click="form.includeClientInfo = !form.includeClientInfo">
              <el-checkbox
                v-model="form.includeClientInfo"
                aria-label="附带系统信息"
                @click.stop
              />
              <div>
                <div class="client-info-title">附带系统信息</div>
                <div class="client-info-desc">包含浏览器、操作系统、当前页面和应用版本，帮助排查问题；可取消勾选。</div>
              </div>
            </div>

            <div class="form-actions">
              <el-button
                type="primary"
                native-type="submit"
                :loading="submitting"
                :disabled="submitting"
              >
                {{ submitting ? "正在提交" : "提交反馈" }}
              </el-button>
            </div>
          </el-form>
        </section>

      </div>
    </el-card>

    <el-dialog
      v-model="successDialogVisible"
      class="feedback-success-dialog"
      width="520px"
      align-center
      append-to-body
      aria-label="反馈提交成功"
    >
      <div class="success-dialog-content" aria-live="polite">
        <div class="success-icon"><el-icon><Check /></el-icon></div>
        <h3>反馈已成功提交</h3>
        <p class="success-description">感谢你的反馈，我们会尽快查看并处理。</p>
        <div class="success-note">
          <el-icon><Clock /></el-icon>
          <span>反馈记录已保存，可在“我的反馈”中查看处理进度。</span>
        </div>
      </div>

      <template #footer>
        <div class="success-actions">
          <el-button type="primary" @click="successDialogVisible = false">继续反馈</el-button>
          <el-button @click="goToHistory">查看处理进度</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import type { FormInstance, FormRules } from "element-plus";
import { Check, Clock } from "@element-plus/icons-vue";
import { submitFeedback } from "../api/feedback";
import type { FeedbackCategory, FeedbackClientInfo } from "../types/api";

interface FeedbackFormModel {
  category: FeedbackCategory | "";
  content: string;
  contact: string;
  includeClientInfo: boolean;
}

const router = useRouter();
const route = useRoute();
const formRef = ref<FormInstance>();
const submitting = ref(false);
const successDialogVisible = ref(false);

const categoryOptions: Array<{ label: string; value: FeedbackCategory }> = [
  { label: "任务问题", value: "task" },
  { label: "额度问题", value: "quota" },
  { label: "账号问题", value: "account" },
  { label: "体验建议", value: "suggestion" },
  { label: "其他", value: "other" },
];

const createInitialForm = (): FeedbackFormModel => ({
  category: "",
  content: "",
  contact: "",
  includeClientInfo: true,
});

const form = reactive<FeedbackFormModel>(createInitialForm());
const rules: FormRules<FeedbackFormModel> = {
  category: [{ required: true, message: "请选择反馈类型", trigger: "change" }],
  content: [
    {
      required: true,
      validator: (_rule, value: string, callback) => {
        const contentLength = value.trim().length;
        if (contentLength === 0) {
          callback(new Error("请输入反馈内容"));
        } else if (contentLength < 10 || contentLength > 500) {
          callback(new Error("反馈内容应为 10 至 500 个字"));
        } else {
          callback();
        }
      },
      trigger: "blur",
    },
  ],
  contact: [{ max: 100, message: "联系方式不能超过 100 个字", trigger: "blur" }],
};

const collectClientInfo = (): FeedbackClientInfo => ({
  platform: "web",
  system: navigator.userAgent,
  version: navigator.appVersion,
  brand: navigator.vendor,
  model: navigator.platform,
  envVersion: import.meta.env.MODE,
  appVersion: import.meta.env.VITE_APP_VERSION || "1.0.0",
  sourcePage: route.fullPath,
  collectedAt: Date.now(),
});

const handleSubmit = async () => {
  if (!formRef.value || submitting.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid || !form.category) return;

  submitting.value = true;
  try {
    await submitFeedback({
      category: form.category,
      content: form.content.trim(),
      ...(form.contact.trim() ? { contact: form.contact.trim() } : {}),
      ...(form.includeClientInfo ? { clientInfo: collectClientInfo() } : {}),
    });
    Object.assign(form, createInitialForm());
    formRef.value?.clearValidate();
    successDialogVisible.value = true;
  } catch (error) {
    ElMessage.error(error instanceof Error && error.message ? error.message : "反馈提交失败，请稍后重试");
  } finally {
    submitting.value = false;
  }
};

const goToHistory = () => {
  successDialogVisible.value = false;
  router.push("/feedback/history");
};
</script>

<style scoped>
.feedback-page {
  height: 100%;
  overflow: auto;
  overflow-x: hidden;
}

.feedback-card {
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;
  margin: 0 auto;
  border: 1px solid #e4e8f2;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(9, 30, 66, 0.06);
}

.feedback-card :deep(.el-card__body) {
  min-height: 100%;
  box-sizing: border-box;
  padding: 0;
}

.feedback-workspace {
  min-height: 100%;
}

.feedback-main {
  min-width: 0;
  padding: 30px 36px 32px;
}

.feedback-card-header {
  display: flex;
  width: 100%;
  max-width: 1120px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.feedback-heading-copy {
  min-width: 0;
}

.feedback-card-header h2 {
  margin: 0;
  color: #292929;
  font-size: 22px;
  line-height: 1.35;
}

.main-divider {
  height: 1px;
  margin-top: 24px;
  background: #edf0f6;
}

.feedback-card-header p {
  margin: 6px 0 0;
  color: #8c8fa3;
  font-size: 13px;
  line-height: 1.6;
}

.history-entry {
  flex-shrink: 0;
  height: 32px;
  padding: 0 12px;
  border-color: #d9e7f7;
  border-radius: 7px;
  background: #f7faff;
  font-size: 13px;
  font-weight: 500;
}

.history-entry:hover {
  background: #f2f6fb;
  color: #337ecc;
}

.history-entry .el-icon {
  margin-right: 5px;
}

.feedback-form {
  max-width: 690px;
  padding-top: 24px;
}

.category-grid {
  display: flex;
  width: 100%;
  flex-wrap: wrap;
  gap: 8px;
}

.category-option {
  width: 92px;
  margin: 0 !important;
}

.category-option :deep(.el-radio-button__inner) {
  display: flex;
  width: 100%;
  height: 32px;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  border: 1px solid #dfe4ee !important;
  border-radius: 8px !important;
  box-shadow: none !important;
  color: #60657a;
  font-size: 12px;
  transition: border-color 0.18s ease, background-color 0.18s ease, color 0.18s ease;
}

.category-option :deep(.el-radio-button__inner:hover) {
  border-color: #9aa7ff !important;
  color: #4050f8;
}

.category-option.is-active :deep(.el-radio-button__inner) {
  border-color: #5265f8;
  background: #f6f7ff;
  color: #4050f8;
  font-weight: 600;
}

.feedback-form :deep(.el-form-item) {
  margin-bottom: 26px;
}

.feedback-form :deep(.el-form-item__label) {
  color: #303447;
  font-size: 14px;
  font-weight: 600;
}

.feedback-form :deep(.el-textarea__inner),
.feedback-form :deep(.el-input__wrapper) {
  border-radius: 10px;
}

.feedback-form :deep(.el-input__wrapper) {
  min-height: 40px;
}

.feedback-form :deep(.el-textarea__inner) {
  min-height: 194px !important;
  line-height: 1.7;
}

.field-help {
  width: 100%;
  margin-top: 7px;
  color: #a0a5b4;
  font-size: 12px;
  line-height: 1.5;
}

.client-info-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: fit-content;
  margin-top: -2px;
  cursor: pointer;
  user-select: none;
}

.client-info-row :deep(.el-checkbox) {
  height: 22px;
}

.client-info-title {
  color: #303447;
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.client-info-desc {
  margin-top: 3px;
  color: #8c8fa3;
  font-size: 12px;
  line-height: 1.55;
}

.form-actions {
  margin-top: 28px;
}

.form-actions .el-button {
  min-width: 96px;
  height: 34px;
  padding: 0 16px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 600;
}

:global(.feedback-success-dialog) {
  overflow: hidden;
  border-radius: 16px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
}

:global(.feedback-success-dialog .el-dialog__header) {
  height: 0;
  margin: 0;
  padding: 0;
}

:global(.feedback-success-dialog .el-dialog__headerbtn) {
  top: 14px;
  right: 14px;
  z-index: 2;
}

:global(.feedback-success-dialog .el-dialog__body) {
  padding: 42px 40px 8px;
}

:global(.feedback-success-dialog .el-dialog__footer) {
  padding: 18px 40px 34px;
}

.success-dialog-content {
  text-align: center;
}

.success-icon {
  display: flex;
  width: 64px;
  height: 64px;
  margin: 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #ecfdf3;
  color: #22a06b;
  font-size: 30px;
  box-shadow: 0 0 0 9px rgba(34, 160, 107, 0.07);
}

.success-dialog-content h3 {
  margin: 26px 0 9px;
  color: #20242d;
  font-size: 22px;
  font-weight: 650;
}

.success-description {
  margin: 0;
  color: #7c8495;
  font-size: 14px;
  line-height: 1.7;
}

.success-note {
  display: flex;
  margin-top: 24px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 12px 16px;
  border-radius: 8px;
  background: #f5f8fb;
  color: #667085;
  font-size: 12px;
  line-height: 1.5;
}

.success-note .el-icon {
  flex-shrink: 0;
  color: #409eff;
}

.success-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.success-actions .el-button {
  min-width: 108px;
  height: 36px;
  border-radius: 7px;
  font-size: 13px;
}

@media (max-width: 820px) {
  .feedback-card-header {
    align-items: flex-start;
  }

  :global(.feedback-success-dialog) {
    width: calc(100vw - 32px) !important;
  }

  .feedback-main {
    padding: 26px 24px 28px;
  }

}
</style>
