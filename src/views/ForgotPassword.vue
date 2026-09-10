<template>
  <div class="auth-page">
    <div class="forgot-password-container auth-container">
      <LoginBackground />

      <el-card class="forgot-password-card auth-card">
        <div class="forgot-password-header auth-header">
          <p class="brand-eyebrow">QUANTUM COMPUTING</p>
          <div class="logo-section">
            <h1 class="system-title">{{ isInitialSetup ? "设置登录密码" : "找回密码" }}</h1>
          </div>
        </div>

        <el-steps
          :active="activeStepIndex"
          finish-status="success"
          align-center
          class="step-bar"
        >
          <el-step title="身份核验" />
          <el-step :title="isInitialSetup ? '设置登录密码' : '设置新密码'" />
          <el-step title="完成" />
        </el-steps>

        <div v-if="step === 'verify'" class="step-content">
          <el-alert
            title="请输入绑定或注册邮箱和验证码完成身份核验"
            type="info"
            :closable="false"
            show-icon
            class="info-alert"
          />

          <el-form
            ref="verifyFormRef"
            :model="verifyForm"
            :rules="verifyRules"
            class="forgot-password-form auth-form"
            @submit.prevent="handleVerify"
          >
            <el-form-item prop="email">
              <label class="field-label" for="forgot-password-email">邮箱</label>
              <el-input
                id="forgot-password-email"
                v-model="verifyForm.email"
                placeholder="请输入绑定或注册邮箱"
                size="large"
                clearable
              >
                <template #prefix>
                  <el-icon><Message /></el-icon>
                </template>
              </el-input>
            </el-form-item>

            <el-form-item prop="code">
              <label class="field-label" for="forgot-password-code">邮箱验证码</label>
              <div class="code-input-wrapper">
                <el-input
                  id="forgot-password-code"
                  v-model="verifyForm.code"
                  placeholder="请输入6位验证码"
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
                class="primary-button auth-button"
                :loading="verifyLoading"
                @click="handleVerify"
              >
                下一步
              </el-button>
            </el-form-item>

            <div class="secondary-link-row auth-link-row">
              <el-link type="primary" :underline="false" @click="goToLogin">
                <el-icon class="link-icon"><ArrowLeft /></el-icon>
                返回登录
              </el-link>
            </div>
          </el-form>
        </div>

        <div v-else-if="step === 'reset'" class="step-content">
          <el-alert
            :title="'已验证账号：' + (maskedEmail || verifyForm.email)"
            type="success"
            :closable="false"
            show-icon
            class="info-alert"
          />

          <el-form
            ref="resetFormRef"
            :model="resetForm"
            :rules="resetRules"
            class="forgot-password-form auth-form"
            @submit.prevent="handleResetPassword"
          >
            <el-form-item prop="newPassword">
              <label class="field-label" for="forgot-password-newPassword">新密码</label>
              <el-input
                id="forgot-password-newPassword"
                v-model="resetForm.newPassword"
                type="password"
                :placeholder="isInitialSetup ? '请设置登录密码' : '请输入新密码'"
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
                <span>密码强度</span>
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
              <p class="strength-tip">密码需为8-16位，且必须包含字母和数字。</p>
            </div>

            <el-form-item prop="confirmPassword">
              <label class="field-label" for="forgot-password-confirmPassword">确认密码</label>
              <el-input
                id="forgot-password-confirmPassword"
                v-model="resetForm.confirmPassword"
                type="password"
                :placeholder="isInitialSetup ? '请再次输入登录密码' : '请再次输入新密码'"
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
                class="primary-button auth-button"
                :loading="resetLoading"
                :disabled="!canSubmitReset"
                @click="handleResetPassword"
              >
                {{ isInitialSetup ? "确认设置" : "确认重置" }}
              </el-button>
            </el-form-item>

            <div class="secondary-link-row auth-link-row">
              <el-link type="primary" :underline="false" @click="goToLogin">
                返回登录
              </el-link>
            </div>
          </el-form>
        </div>

        <div v-else class="success-view">
          <el-icon class="success-icon"><CircleCheckFilled /></el-icon>
          <p class="success-title">{{ isInitialSetup ? "登录密码设置成功" : "密码重置成功" }}</p>
          <p>请妥善保管密码，并使用绑定邮箱和密码登录。</p>
          <el-button
            type="primary"
            size="large"
            class="primary-button auth-button"
            @click="goToLogin"
          >
            立即登录
          </el-button>
        </div>
      </el-card>

      <div class="footer-info">
        <p>© {{ new Date().getFullYear() }} 量子Ising求解系统 | 现代化量子优化平台</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, type FormInstance } from "element-plus";
import {
  ArrowLeft,
  CircleCheckFilled,
  Key,
  Lock,
  Message,
} from "@element-plus/icons-vue";
import LoginBackground from "../components/LoginBackground.vue";
import { authApi } from "../api/auth";
import { getErrorCode, getErrorMessage } from "../utils/error";
import { EMAIL_REGEX } from "../utils/validation";

const CODE_REGEX = /^\d{6}$/;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,16}$/;
type ValidatorCallback = (error?: Error) => void;

const router = useRouter();

const verifyFormRef = ref<FormInstance>();
const resetFormRef = ref<FormInstance>();

const step = ref<"verify" | "reset" | "success">("verify");
const verifyLoading = ref(false);
const sendCodeLoading = ref(false);
const resetLoading = ref(false);
const sendCodeCountdown = ref(0);
const resetToken = ref("");
const maskedEmail = ref("");
const isInitialSetup = ref(false);

const verifyForm = reactive({
  email: "",
  code: "",
});

const resetForm = reactive({
  newPassword: "",
  confirmPassword: "",
});

let sendCodeTimer: ReturnType<typeof setInterval> | null = null;

const activeStepIndex = computed(() => {
  const stepMap = { verify: 0, reset: 1, success: 2 };
  return stepMap[step.value] ?? 0;
});

const sendCodeDisabled = computed(
  () => sendCodeLoading.value || sendCodeCountdown.value > 0
);

const sendCodeText = computed(() => {
  return sendCodeCountdown.value > 0
    ? `${sendCodeCountdown.value}秒后重试`
    : "获取验证码";
});

const passwordStrength = computed(() => {
  const password = resetForm.newPassword;
  if (!password) {
    return {
      percentage: 0,
      color: "#c0c4cc",
      text: "待输入",
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
      text: "弱",
    };
  }

  if (hasDigit && hasLetter && hasLower && hasUpper && hasSymbol) {
    return {
      percentage: 100,
      color: "#67c23a",
      text: "强",
    };
  }

  if (hasDigit && hasLetter) {
    return {
      percentage: 66,
      color: "#e6a23c",
      text: "中",
    };
  }

  return {
    percentage: 33,
    color: "#f56c6c",
    text: "弱",
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

const validateEmail = (_rule: unknown, value: string, callback: ValidatorCallback) => {
  if (!value) {
    callback(new Error("请输入邮箱地址"));
  } else if (!EMAIL_REGEX.test(value)) {
    callback(new Error("请输入有效的邮箱地址"));
  } else {
    callback();
  }
};

const validateCode = (_rule: unknown, value: string, callback: ValidatorCallback) => {
  if (!value) {
    callback(new Error("请输入验证码"));
  } else if (!CODE_REGEX.test(value)) {
    callback(new Error("验证码需为6位数字"));
  } else {
    callback();
  }
};

const validateNewPassword = (_rule: unknown, value: string, callback: ValidatorCallback) => {
  if (!value) {
    callback(new Error("请输入新密码"));
  } else if (!PASSWORD_REGEX.test(value)) {
    callback(new Error("新密码需为8-16位，且必须包含字母和数字"));
  } else {
    callback();
  }
};

const validateConfirmPassword = (_rule: unknown, value: string, callback: ValidatorCallback) => {
  if (!value) {
    callback(new Error("请再次输入新密码"));
  } else if (value !== resetForm.newPassword) {
    callback(new Error("两次输入的密码不一致"));
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

const startSendCodeCountdown = () => {
  if (sendCodeTimer) clearInterval(sendCodeTimer);
  sendCodeCountdown.value = 60;
  sendCodeTimer = setInterval(() => {
    sendCodeCountdown.value -= 1;
    if (sendCodeCountdown.value <= 0) {
      if (sendCodeTimer) clearInterval(sendCodeTimer);
      sendCodeTimer = null;
    }
  }, 1000);
};

const sendResetCode = async () => {
  if (!verifyForm.email) {
    ElMessage.warning("请先输入邮箱地址");
    return;
  }

  if (!EMAIL_REGEX.test(verifyForm.email)) {
    ElMessage.warning("请输入有效的邮箱地址");
    return;
  }

  sendCodeLoading.value = true;
  try {
    const response = await authApi.sendEmailCode(
      verifyForm.email,
      "reset_password"
    );
    if (response.success) {
      ElMessage.success("若账号存在，验证码已发送到您的邮箱");
      startSendCodeCountdown();
    } else {
      ElMessage.error(
        response.message || "验证码发送失败"
      );
    }
  } catch (error) {
    ElMessage.error(
      getErrorMessage(error, "验证码发送失败")
    );
  } finally {
    sendCodeLoading.value = false;
  }
};

const handleVerify = async () => {
  if (!verifyFormRef.value) return;

  await verifyFormRef.value.validate(async (valid) => {
    if (!valid) {
      ElMessage.error("请正确填写表单");
      return;
    }

    verifyLoading.value = true;
    try {
      const response = await authApi.verifyResetCode(
        verifyForm.email,
        verifyForm.code
      );

      if (response.success && response.data?.resetToken) {
        resetToken.value = response.data.resetToken;
        maskedEmail.value = response.data.maskedEmail || verifyForm.email;
        isInitialSetup.value = Boolean(response.data.isInitialSetup);
        step.value = "reset";
        ElMessage.success("身份核验成功");
      } else {
        ElMessage.error(
          response.message || "身份核验失败"
        );
      }
    } catch (error) {
      if (getErrorCode(error) === "SCAN_LOGIN_REQUIRED") {
        ElMessage.info(getErrorMessage(error, "小程序账号请扫码登录"));
        goToQrLogin();
        return;
      }
      ElMessage.error(
        getErrorMessage(error, "身份核验失败")
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
  isInitialSetup.value = false;
  verifyForm.code = "";
  resetForm.newPassword = "";
  resetForm.confirmPassword = "";
};

const handleResetPassword = async () => {
  if (!resetToken.value) {
    ElMessage.warning("当前重置状态已失效，请重新验证");
    backToVerify();
    return;
  }

  if (!resetFormRef.value) return;

  await resetFormRef.value.validate(async (valid) => {
    if (!valid) {
      ElMessage.error("请正确填写表单");
      return;
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
        ElMessage.success(isInitialSetup.value ? "登录密码设置成功" : "密码重置成功");
      } else {
        ElMessage.error(
          response.message || "密码重置失败"
        );
      }
    } catch (error) {
      if (getErrorCode(error) === "SCAN_LOGIN_REQUIRED") {
        ElMessage.info(getErrorMessage(error, "小程序账号请扫码登录"));
        goToQrLogin();
        return;
      }
      const message = getErrorMessage(
        error,
        "密码重置失败"
      );
      ElMessage.error(message);
      if (getErrorCode(error) === 4001) {
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
const goToQrLogin = () => {
  router.push({ path: "/login", query: { mode: "qr" } });
};

onBeforeUnmount(() => {
  if (sendCodeTimer) clearInterval(sendCodeTimer);
});
</script>

<style scoped src="../styles/auth.css"></style>

<style scoped>
.step-bar { padding: 0 4px; }
.step-bar :deep(.el-step__head.is-process),
.step-bar :deep(.el-step__title.is-process) { color: var(--brand-primary); border-color: var(--brand-primary); }
.step-bar :deep(.el-step__title) { font-size: 13px; }
.step-bar :deep(.el-step__head.is-wait),
.step-bar :deep(.el-step__title.is-wait) { color: #8395ae; border-color: #c6d5e9; }
.step-bar :deep(.el-step__icon) { background: #ffffff; }
.step-bar :deep(.el-step__head.is-process .el-step__icon) { background: var(--brand-primary-light-9); box-shadow: 0 0 0 5px rgba(var(--brand-rgb), .07); }
.step-bar :deep(.el-step__line) { background: #dce4ef; }
.step-content { margin-top: 28px; }
.info-alert { margin-bottom: 24px; border-radius: 10px; }
.info-alert.el-alert--info { background: #edf2f8; color: #4b5d76; }
.password-strength-panel { box-sizing: border-box; margin: -6px 0 18px; width: 100%; padding: 10px 12px; background: #edf2f8; border-radius: 10px; }
.strength-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 13px; color: #4b5d76; }
.strength-tip { margin: 8px 0 0; font-size: 12px; color: #687c96; }
.link-icon { margin-right: 4px; }
.success-view { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 28px 0 8px; }
.success-icon { font-size: 64px; color: var(--el-color-success); margin-bottom: 20px; }
.success-view p { margin: 0 0 16px; font-size: 13px; line-height: 1.6; color: #687c96; }
.success-view .success-title { font-size: 22px; font-weight: 500; color: #243753; }
</style>
