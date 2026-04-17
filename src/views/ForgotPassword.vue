<template>
  <div class="forgot-password-container">
    <div class="background-decoration">
      <div class="circle circle-1"></div>
      <div class="circle circle-2"></div>
      <div class="circle circle-3"></div>
    </div>

    <el-card class="forgot-password-card">
      <div class="forgot-password-header">
        <div class="logo-section">
          <div class="logo-icon">Q</div>
          <h1 class="system-title">{{ $t("forgotPassword.title") }}</h1>
        </div>
        <p class="subtitle">{{ $t("forgotPassword.subtitle") }}</p>
      </div>

      <el-steps
        :active="activeStepIndex"
        finish-status="success"
        align-center
        class="step-bar"
      >
        <el-step :title="$t('forgotPassword.steps.verify')" />
        <el-step :title="$t('forgotPassword.steps.reset')" />
        <el-step :title="$t('forgotPassword.steps.success')" />
      </el-steps>

      <div v-if="step === 'verify'" class="step-content">
        <el-alert
          :title="$t('forgotPassword.tips.genericVerification')"
          type="info"
          :closable="false"
          show-icon
          class="info-alert"
        />

        <el-form
          ref="verifyFormRef"
          :model="verifyForm"
          :rules="verifyRules"
          class="forgot-password-form"
          @submit.prevent="handleVerify"
        >
          <el-form-item prop="email">
            <el-input
              v-model="verifyForm.email"
              :placeholder="$t('forgotPassword.email')"
              size="large"
              clearable
            >
              <template #prefix>
                <el-icon><Message /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item prop="code">
            <div class="code-input-wrapper">
              <el-input
                v-model="verifyForm.code"
                :placeholder="$t('forgotPassword.code')"
                size="large"
                maxlength="6"
                clearable
              >
                <template #prefix>
                  <el-icon><Key /></el-icon>
                </template>
              </el-input>
              <el-button
                type="primary"
                size="large"
                class="send-code-btn"
                :loading="sendCodeLoading"
                :disabled="sendCodeDisabled"
                @click="sendResetCode"
              >
                {{ sendCodeText }}
              </el-button>
            </div>
          </el-form-item>

          <el-form-item>
            <el-button
              type="primary"
              size="large"
              class="primary-button"
              :loading="verifyLoading"
              @click="handleVerify"
            >
              {{ $t("forgotPassword.verifyButton") }}
            </el-button>
          </el-form-item>

          <div class="secondary-link-row">
            <el-link type="primary" :underline="false" @click="goToLogin">
              <el-icon class="link-icon"><ArrowLeft /></el-icon>
              {{ $t("forgotPassword.backToLogin") }}
            </el-link>
          </div>
        </el-form>
      </div>

      <div v-else-if="step === 'reset'" class="step-content">
        <el-alert
          :title="
            $t('forgotPassword.tips.verifiedAccount', {
              email: maskedEmail || verifyForm.email,
            })
          "
          type="success"
          :closable="false"
          show-icon
          class="info-alert"
        />

        <el-form
          ref="resetFormRef"
          :model="resetForm"
          :rules="resetRules"
          class="forgot-password-form"
          @submit.prevent="handleResetPassword"
        >
          <el-form-item prop="newPassword">
            <el-input
              v-model="resetForm.newPassword"
              type="password"
              :placeholder="$t('forgotPassword.newPassword')"
              size="large"
              show-password
              clearable
            >
              <template #prefix>
                <el-icon><Lock /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <div class="password-strength-panel">
            <div class="strength-header">
              <span>{{ $t("forgotPassword.strength.label") }}</span>
              <span :style="{ color: passwordStrength.color }">
                {{ passwordStrength.text }}
              </span>
            </div>
            <el-progress
              :percentage="passwordStrength.percentage"
              :show-text="false"
              :stroke-width="8"
              :color="passwordStrength.color"
            />
            <p class="strength-tip">{{ $t("forgotPassword.passwordHint") }}</p>
          </div>

          <el-form-item prop="confirmPassword">
            <el-input
              v-model="resetForm.confirmPassword"
              type="password"
              :placeholder="$t('forgotPassword.confirmPassword')"
              size="large"
              show-password
              clearable
            >
              <template #prefix>
                <el-icon><Lock /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item>
            <el-button
              type="primary"
              size="large"
              class="primary-button"
              :loading="resetLoading"
              :disabled="!canSubmitReset"
              @click="handleResetPassword"
            >
              {{ $t("forgotPassword.resetButton") }}
            </el-button>
          </el-form-item>

          <div class="secondary-link-row between">
            <el-link type="primary" :underline="false" @click="backToVerify">
              <el-icon class="link-icon"><ArrowLeft /></el-icon>
              {{ $t("forgotPassword.backToVerify") }}
            </el-link>
            <el-link type="primary" :underline="false" @click="goToLogin">
              {{ $t("forgotPassword.backToLogin") }}
            </el-link>
          </div>
        </el-form>
      </div>

      <div v-else class="success-view">
        <el-icon class="success-icon"><CircleCheckFilled /></el-icon>
        <p class="success-title">{{ $t("forgotPassword.successTitle") }}</p>
        <p>{{ $t("forgotPassword.successSubtitle") }}</p>
        <el-button
          type="primary"
          size="large"
          class="primary-button"
          @click="goToLogin"
        >
          {{ $t("forgotPassword.goLoginNow") }}
        </el-button>
      </div>
    </el-card>

    <div class="footer-info">
      <p>{{ $t("forgotPassword.footer") }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import {
  ArrowLeft,
  CircleCheckFilled,
  Key,
  Lock,
  Message,
} from "@element-plus/icons-vue";
import { useI18n } from "vue-i18n";
import { authApi } from "../api/auth.js";

const EMAIL_REGEX = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
const CODE_REGEX = /^\d{6}$/;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,16}$/;

const router = useRouter();
const { t } = useI18n();

const verifyFormRef = ref(null);
const resetFormRef = ref(null);

const step = ref("verify");
const verifyLoading = ref(false);
const sendCodeLoading = ref(false);
const resetLoading = ref(false);
const sendCodeCountdown = ref(0);
const resetToken = ref("");
const maskedEmail = ref("");

const verifyForm = reactive({
  email: "",
  code: "",
});

const resetForm = reactive({
  newPassword: "",
  confirmPassword: "",
});

let sendCodeTimer = null;

const activeStepIndex = computed(() => {
  const stepMap = { verify: 0, reset: 1, success: 2 };
  return stepMap[step.value] ?? 0;
});

const sendCodeDisabled = computed(
  () => sendCodeLoading.value || sendCodeCountdown.value > 0
);

const sendCodeText = computed(() => {
  return sendCodeCountdown.value > 0
    ? `${sendCodeCountdown.value}${t("forgotPassword.resendCode")}`
    : t("forgotPassword.sendCode");
});

const passwordStrength = computed(() => {
  const password = resetForm.newPassword;
  if (!password) {
    return {
      percentage: 0,
      color: "#c0c4cc",
      text: t("forgotPassword.strength.empty"),
    };
  }

  const hasDigit = /\d/.test(password);
  const hasLetter = /[A-Za-z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);

  if (/^\d+$/.test(password)) {
    return {
      percentage: 33,
      color: "#f56c6c",
      text: t("forgotPassword.strength.weak"),
    };
  }

  if (hasDigit && hasLetter && hasLower && hasUpper && hasSymbol) {
    return {
      percentage: 100,
      color: "#67c23a",
      text: t("forgotPassword.strength.strong"),
    };
  }

  if (hasDigit && hasLetter) {
    return {
      percentage: 66,
      color: "#e6a23c",
      text: t("forgotPassword.strength.medium"),
    };
  }

  return {
    percentage: 33,
    color: "#f56c6c",
    text: t("forgotPassword.strength.weak"),
  };
});

const canSubmitReset = computed(() => {
  return (
    PASSWORD_REGEX.test(resetForm.newPassword) &&
    resetForm.confirmPassword &&
    resetForm.newPassword === resetForm.confirmPassword &&
    Boolean(resetToken.value)
  );
});

const validateEmail = (rule, value, callback) => {
  if (!value) {
    callback(new Error(t("forgotPassword.validation.emailRequired")));
  } else if (!EMAIL_REGEX.test(value)) {
    callback(new Error(t("forgotPassword.validation.emailFormat")));
  } else {
    callback();
  }
};

const validateCode = (rule, value, callback) => {
  if (!value) {
    callback(new Error(t("forgotPassword.validation.codeRequired")));
  } else if (!CODE_REGEX.test(value)) {
    callback(new Error(t("forgotPassword.validation.codeFormat")));
  } else {
    callback();
  }
};

const validateNewPassword = (rule, value, callback) => {
  if (!value) {
    callback(new Error(t("forgotPassword.validation.passwordRequired")));
  } else if (!PASSWORD_REGEX.test(value)) {
    callback(new Error(t("forgotPassword.validation.passwordFormat")));
  } else {
    callback();
  }
};

const validateConfirmPassword = (rule, value, callback) => {
  if (!value) {
    callback(new Error(t("forgotPassword.validation.confirmRequired")));
  } else if (value !== resetForm.newPassword) {
    callback(new Error(t("forgotPassword.validation.passwordMismatch")));
  } else {
    callback();
  }
};

const verifyRules = computed(() => ({
  email: [{ validator: validateEmail, trigger: "blur" }],
  code: [{ validator: validateCode, trigger: "blur" }],
}));

const resetRules = computed(() => ({
  newPassword: [{ validator: validateNewPassword, trigger: "blur" }],
  confirmPassword: [{ validator: validateConfirmPassword, trigger: "blur" }],
}));

const getErrorMessage = (error, fallbackKey) => {
  if (!error.response) {
    return t("forgotPassword.messages.networkError");
  }
  return error.response?.data?.message || t(fallbackKey);
};

const startSendCodeCountdown = () => {
  clearInterval(sendCodeTimer);
  sendCodeCountdown.value = 60;
  sendCodeTimer = setInterval(() => {
    sendCodeCountdown.value -= 1;
    if (sendCodeCountdown.value <= 0) {
      clearInterval(sendCodeTimer);
      sendCodeTimer = null;
    }
  }, 1000);
};

const sendResetCode = async () => {
  if (!verifyForm.email) {
    ElMessage.warning(t("forgotPassword.messages.enterEmail"));
    return;
  }

  if (!EMAIL_REGEX.test(verifyForm.email)) {
    ElMessage.warning(t("forgotPassword.messages.invalidEmail"));
    return;
  }

  sendCodeLoading.value = true;
  try {
    const response = await authApi.sendEmailCode(
      verifyForm.email,
      "reset_password"
    );
    if (response.success) {
      ElMessage.success(t("forgotPassword.messages.codeSent"));
      startSendCodeCountdown();
    } else {
      ElMessage.error(
        response.message || t("forgotPassword.messages.codeFailed")
      );
    }
  } catch (error) {
    console.error("Send reset code error:", error);
    ElMessage.error(
      getErrorMessage(error, "forgotPassword.messages.codeFailed")
    );
  } finally {
    sendCodeLoading.value = false;
  }
};

const handleVerify = async () => {
  if (!verifyFormRef.value) return;

  await verifyFormRef.value.validate(async (valid) => {
    if (!valid) {
      ElMessage.error(t("forgotPassword.messages.formError"));
      return false;
    }

    verifyLoading.value = true;
    try {
      const response = await authApi.verifyResetCode(
        verifyForm.email,
        verifyForm.code
      );

      if (response.success) {
        resetToken.value = response.data.resetToken;
        maskedEmail.value = response.data.maskedEmail || verifyForm.email;
        step.value = "reset";
        ElMessage.success(t("forgotPassword.messages.verifySuccess"));
      } else {
        ElMessage.error(
          response.message || t("forgotPassword.messages.verifyFailed")
        );
      }
    } catch (error) {
      console.error("Verify reset code error:", error);
      ElMessage.error(
        getErrorMessage(error, "forgotPassword.messages.verifyFailed")
      );
    } finally {
      verifyLoading.value = false;
    }
  });
};

const backToVerify = () => {
  step.value = "verify";
  resetToken.value = "";
  maskedEmail.value = "";
  verifyForm.code = "";
  resetForm.newPassword = "";
  resetForm.confirmPassword = "";
};

const handleResetPassword = async () => {
  if (!resetToken.value) {
    ElMessage.warning(t("forgotPassword.messages.invalidStep"));
    backToVerify();
    return;
  }

  if (!resetFormRef.value) return;

  await resetFormRef.value.validate(async (valid) => {
    if (!valid) {
      ElMessage.error(t("forgotPassword.messages.formError"));
      return false;
    }

    resetLoading.value = true;
    try {
      const response = await authApi.resetPassword(
        resetToken.value,
        resetForm.newPassword
      );

      if (response.success) {
        step.value = "success";
        resetToken.value = "";
        ElMessage.success(t("forgotPassword.messages.resetSuccess"));
      } else {
        ElMessage.error(
          response.message || t("forgotPassword.messages.resetFailed")
        );
      }
    } catch (error) {
      console.error("Reset password error:", error);
      const message = getErrorMessage(
        error,
        "forgotPassword.messages.resetFailed"
      );
      ElMessage.error(message);
      if (error.response?.data?.code === 4001) {
        backToVerify();
      }
    } finally {
      resetLoading.value = false;
    }
  });
};

const goToLogin = () => {
  router.push("/login");
};

onBeforeUnmount(() => {
  clearInterval(sendCodeTimer);
});
</script>

<style scoped>
.forgot-password-container {
  position: relative;
  width: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 0;
  box-sizing: border-box;
}

.background-decoration {
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: hidden;
  opacity: 0.1;
}

.circle {
  position: absolute;
  border-radius: 50%;
  background: white;
}

.circle-1 {
  width: 300px;
  height: 300px;
  top: -100px;
  left: -100px;
}

.circle-2 {
  width: 500px;
  height: 500px;
  bottom: -150px;
  right: -150px;
}

.circle-3 {
  width: 200px;
  height: 200px;
  top: 50%;
  right: 10%;
}

.forgot-password-card {
  position: relative;
  z-index: 10;
  width: 520px;
  max-width: calc(100vw - 32px);
  padding: 44px 40px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
}

.forgot-password-card :deep(.el-card__body) {
  padding: 0;
}

.forgot-password-header {
  text-align: center;
  margin-bottom: 28px;
}

.logo-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 15px;
  margin-bottom: 10px;
}

.logo-icon {
  width: 50px;
  height: 50px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 28px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.system-title {
  font-size: 28px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.subtitle {
  font-size: 14px;
  color: #8492a6;
  margin: 0;
}

.step-bar {
  padding: 0 8px;
}

.step-bar :deep(.el-step__head.is-process) {
  color: #667eea;
  border-color: #667eea;
}

.step-bar :deep(.el-step__title.is-process) {
  color: #667eea;
  font-weight: 600;
}

.step-bar :deep(.el-step__description.is-process) {
  color: #8492a6;
}

.step-bar :deep(.el-step__head.is-success) {
  color: #67c23a;
  border-color: #67c23a;
}

.step-bar :deep(.el-step__title.is-success) {
  color: #67c23a;
  font-weight: 600;
}

.step-bar :deep(.el-step.is-center .el-step__line) {
  left: calc(50% + 22px);
  right: calc(-50% + 22px);
  height: 2px;
  background-color: #e4e7ed;
  border-radius: 999px;
  overflow: hidden;
}

.step-bar :deep(.el-step__line-inner) {
  border-width: 2px !important;
  border-color: #e4e7ed !important;
  border-radius: 999px;
  opacity: 0;
}

.step-bar :deep(.el-step__head.is-success + .el-step__main .el-step__title) {
  color: #67c23a;
}

.step-bar :deep(.el-step__icon) {
  background: #ffffff;
  transition: all 0.3s ease;
}

.step-bar :deep(.el-step__head.is-process .el-step__icon) {
  background: rgba(102, 126, 234, 0.12);
  box-shadow: 0 0 0 6px rgba(102, 126, 234, 0.08);
}

.step-bar :deep(.el-step__head.is-success .el-step__icon) {
  background: rgba(103, 194, 58, 0.12);
}

.step-content {
  margin-top: 28px;
}

.info-alert {
  margin-bottom: 24px;
  border-radius: 12px;
}

.forgot-password-form :deep(.el-input__wrapper) {
  border-radius: 10px;
  padding: 12px 15px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.forgot-password-form :deep(.el-input__inner) {
  font-size: 15px;
}

.code-input-wrapper {
  display: flex;
  gap: 10px;
  width: 100%;
}

.code-input-wrapper .el-input {
  flex: 1;
}

.send-code-btn,
.primary-button {
  border-radius: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  overflow: hidden;
}

.send-code-btn {
  width: 140px;
  white-space: nowrap;
}

.send-code-btn:disabled,
.send-code-btn.is-disabled,
.send-code-btn.is-disabled:hover {
  background: #c0c4cc !important;
  border-color: #c0c4cc !important;
  color: #ffffff !important;
  cursor: not-allowed;
  box-shadow: none;
}

.primary-button {
  width: 100%;
  height: 50px;
  font-size: 16px;
  font-weight: 600;
}

.password-strength-panel {
  margin: -6px 0 18px;
  width: calc(100% - 28px);
  max-width: 100%;
  margin-left: auto;
  margin-right: auto;
  padding: 10px 12px;
  background: #f7f8fc;
  border-radius: 12px;
}

.strength-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
  color: #606266;
}

.strength-tip {
  margin: 8px 0 0;
  font-size: 12px;
  color: #909399;
}

.secondary-link-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.secondary-link-row.between {
  justify-content: space-between;
}

.link-icon {
  margin-right: 4px;
}

.success-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 20px 0 8px;
}

.success-icon {
  font-size: 72px;
  color: #67c23a;
  margin-bottom: 20px;
}

.success-title {
  font-size: 22px;
  font-weight: 500;
}

.success-view h2 {
  margin: 0 0 10px;
  color: #303133;
  font-size: 28px;
}

.success-view p {
  margin: 0 0 12px;
  color: #606266;
}

.footer-info {
  position: absolute;
  bottom: 30px;
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
}

.footer-info p {
  margin: 0;
}

@media (max-width: 768px) {
  .forgot-password-container {
    justify-content: flex-start;
    padding: 24px 16px 72px;
  }

  .forgot-password-card {
    width: 100%;
    padding: 36px 24px;
  }

  .system-title {
    font-size: 24px;
  }

  .code-input-wrapper {
    flex-direction: column;
  }

  .send-code-btn {
    width: 100%;
  }

  .secondary-link-row.between {
    flex-direction: column;
    gap: 12px;
  }

  .footer-info {
    position: static;
    margin-top: 24px;
  }
}
</style>
