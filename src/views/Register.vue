<template>
  <div class="register-container">
    <!-- 背景装饰 -->
    <div class="background-decoration">
      <div class="circle circle-1"></div>
      <div class="circle circle-2"></div>
      <div class="circle circle-3"></div>
    </div>

    <!-- 注册卡片 -->
    <el-card class="register-card">
      <!-- Logo 和标题 -->
      <div class="register-header">
        <div class="logo-section">
          <div class="logo-icon">Q</div>
          <h1 class="system-title">创建新账户</h1>
        </div>
        <p class="subtitle">加入量子Ising求解系统</p>
      </div>

      <!-- 注册方式切换（手机号注册暂未启用） -->
      <!-- <el-segmented
        v-model="registerType"
        :options="translatedRegisterOptions"
        block
        size="large"
        class="register-type-switch"
      /> -->

      <!-- 注册表单 -->
      <el-form
        ref="registerFormRef"
        :model="registerForm"
        :rules="registerRules"
        class="register-form"
        @submit.prevent="handleRegister"
      >
        <!-- 用户名 -->
        <el-form-item prop="username">
          <el-input
            v-model="registerForm.username"
            placeholder="用户名 (字母、数字、下划线)"
            size="large"
            clearable
          >
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <!-- 邮箱注册 -->
        <template v-if="registerType === 'email'">
          <el-form-item prop="email">
            <el-input
              v-model="registerForm.email"
              placeholder="邮箱地址"
              size="large"
              clearable
            >
              <template #prefix>
                <el-icon><Message /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item prop="emailCode">
            <div class="code-input-wrapper">
              <el-input
                v-model="registerForm.emailCode"
                placeholder="邮箱验证码"
                size="large"
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
                :loading="emailCodeLoading"
                :disabled="emailCodeDisabled"
                @click="sendEmailCode"
              >
                {{ emailCodeText }}
              </el-button>
            </div>
          </el-form-item>
        </template>

        <!-- 手机号注册（暂未启用） -->
        <!-- <template v-if="registerType === 'phone'">
          <el-form-item prop="phone">
            <el-input
              v-model="registerForm.phone"
              placeholder="手机号码"
              size="large"
              clearable
            >
              <template #prefix>
                <el-icon><Phone /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item prop="phoneCode">
            <div class="code-input-wrapper">
              <el-input
                v-model="registerForm.phoneCode"
                placeholder="短信验证码"
                size="large"
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
                :loading="phoneCodeLoading"
                :disabled="phoneCodeDisabled"
                @click="sendPhoneCode"
              >
                {{ phoneCodeText }}
              </el-button>
            </div>
          </el-form-item>
        </template> -->

        <!-- 密码 -->
        <el-form-item prop="password">
          <el-input
            v-model="registerForm.password"
            type="password"
            placeholder="密码 (8-16位，含字母和数字)"
            size="large"
            show-password
            clearable
          >
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <!-- 确认密码 -->
        <el-form-item prop="confirmPassword">
          <el-input
            v-model="registerForm.confirmPassword"
            type="password"
            placeholder="确认密码"
            size="large"
            show-password
            clearable
          >
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <!-- 用户协议 -->
        <el-form-item prop="agree">
          <el-checkbox v-model="registerForm.agree">
            我已阅读并同意
            <el-link
              type="primary"
              :underline="false"
              @click.stop.prevent="openLegalDocument('terms')"
              >《用户协议》</el-link
            >
            和
            <el-link
              type="primary"
              :underline="false"
              @click.stop.prevent="openLegalDocument('privacy')"
              >《隐私政策》</el-link
            >
          </el-checkbox>
        </el-form-item>

        <!-- 注册按钮 -->
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            class="register-button"
            :loading="loading"
            @click="handleRegister"
          >
            注 册
          </el-button>
        </el-form-item>

        <!-- 登录链接 -->
        <div class="login-link">
          已有账号？
          <el-link type="primary" :underline="false" @click="goToLogin">
            立即登录
          </el-link>
        </div>
      </el-form>
    </el-card>

    <!-- 版权信息 -->
    <div class="footer-info">
      <p>© {{ new Date().getFullYear() }} 量子Ising求解系统 | 现代化量子优化平台</p>
    </div>

    <el-dialog
      v-model="legalDialogVisible"
      :title="activeLegalDocument.title"
      width="min(680px, 92vw)"
      append-to-body
    >
      <div class="legal-document">
        <p class="legal-updated">更新日期：2026年7月10日</p>
        <section v-for="section in activeLegalDocument.sections" :key="section.title">
          <h3>{{ section.title }}</h3>
          <p>{{ section.content }}</p>
        </section>
      </div>
      <template #footer>
        <el-button type="primary" @click="legalDialogVisible = false">我已阅读</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, type FormInstance } from "element-plus";
import { authApi } from "../api/auth";
import { EMAIL_REGEX } from "../utils/validation";
import { getErrorMessage } from "../utils/error";
import type { RegisterRequest } from "../types/api";
// import { notificationManager } from "../utils/auth"; // 手机号注册暂未启用

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,16}$/;
type ValidatorCallback = (error?: Error) => void;

const router = useRouter();
const registerFormRef = ref<FormInstance>();
const loading = ref(false);
const legalDialogVisible = ref(false);
const legalDocumentType = ref<keyof typeof LEGAL_DOCUMENTS>("terms");

const LEGAL_DOCUMENTS = {
  terms: {
    title: "用户协议",
    sections: [
      { title: "一、服务说明", content: "本系统提供量子与经典优化问题的任务提交、计算和结果展示服务。计算结果仅供学习、研究和业务评估使用。" },
      { title: "二、账号责任", content: "用户应提供真实、有效的注册信息，妥善保管账号，并对账号下提交的任务和操作负责。" },
      { title: "三、使用规范", content: "不得利用本系统实施违法活动、攻击服务、绕过额度限制，或提交侵犯他人合法权益的数据。" },
      { title: "四、服务与结果", content: "任务可能因网络、算力或第三方服务原因延迟或失败。用户应自行核验重要计算结果并保留必要备份。" },
      { title: "五、协议更新", content: "系统功能或合规要求变化时，本协议可能更新；重大变化将通过系统页面提示。" },
    ],
  },
  privacy: {
    title: "隐私政策",
    sections: [
      { title: "一、收集的信息", content: "为完成注册、登录和任务服务，系统会处理账号信息、联系方式、任务参数、计算结果及必要的设备和日志信息。" },
      { title: "二、使用目的", content: "相关信息用于身份验证、任务计算、额度管理、安全审计、故障排查和服务改进。" },
      { title: "三、存储与保护", content: "系统采取访问控制、传输保护和最小权限等措施保护信息，并在实现服务目的所需期限内保存。" },
      { title: "四、共享与披露", content: "除完成计算所必需、获得用户授权或法律法规要求外，不会向无关第三方提供个人信息。" },
      { title: "五、用户权利", content: "用户可以通过系统提供的渠道申请查询、更正或删除个人信息，并可停止使用服务。" },
    ],
  },
};

const activeLegalDocument = computed(
  () => LEGAL_DOCUMENTS[legalDocumentType.value]
);

const openLegalDocument = (type: keyof typeof LEGAL_DOCUMENTS) => {
  legalDocumentType.value = type;
  legalDialogVisible.value = true;
};

// 注册方式（手机号注册暂未启用，固定为邮箱）
const registerType = ref<"email">("email");
// const translatedRegisterOptions = computed(() => [
//   { label: t("register.type.email"), value: "email" },
//   { label: t("register.type.phone"), value: "phone" },
// ]);

// 注册表单数据
const registerForm = reactive({
  username: "",
  email: "",
  emailCode: "",
  // phone: "",     // 手机号注册暂未启用
  // phoneCode: "", // 手机号注册暂未启用
  password: "",
  confirmPassword: "",
  agree: false,
});

// 邮箱验证码相关
const emailCodeLoading = ref(false);
const emailCodeDisabled = ref(false);
const emailCodeCountdown = ref(0);
const emailCodeText = computed(() => {
  return emailCodeCountdown.value > 0
    ? `${emailCodeCountdown.value}秒后重试`
    : "发送验证码";
});

// 手机验证码相关（手机号注册暂未启用）
// const phoneCodeLoading = ref(false);
// const phoneCodeDisabled = ref(false);
// const phoneCodeCountdown = ref(0);
// const phoneCodeText = computed(() => {
//   return phoneCodeCountdown.value > 0
//     ? `${phoneCodeCountdown.value}${t("register.resendCode")}`
//     : t("register.sendCode");
// });

// 表单验证规则
const validateUsername = (_rule: unknown, value: string, callback: ValidatorCallback) => {
  if (!value) {
    callback(new Error("请输入用户名"));
  } else if (!/^[a-zA-Z0-9_]{3,20}$/.test(value)) {
    callback(new Error("用户名为3-20位字母、数字或下划线"));
  } else {
    callback();
  }
};

const validateEmail = (_rule: unknown, value: string, callback: ValidatorCallback) => {
  if (registerType.value === "email") {
    if (!value) {
      callback(new Error("请输入邮箱地址"));
    } else if (!EMAIL_REGEX.test(value)) {
      callback(new Error("请输入有效的邮箱地址"));
    } else {
      callback();
    }
  } else {
    callback();
  }
};

// 手机号注册暂未启用
// const validatePhone = (rule, value, callback) => {
//   if (registerType.value === "phone") {
//     if (!value) {
//       callback(new Error(t("register.validation.phoneRequired")));
//     } else if (!/^1[3-9]\d{9}$/.test(value)) {
//       callback(new Error(t("register.validation.phoneFormat")));
//     } else {
//       callback();
//     }
//   } else {
//     callback();
//   }
// };

const validateCode = (_rule: unknown, _value: string, callback: ValidatorCallback) => {
  if (!registerForm.emailCode) {
    callback(new Error("请输入验证码"));
  } else {
    callback();
  }
};

const validatePassword = (_rule: unknown, value: string, callback: ValidatorCallback) => {
  if (!value) {
    callback(new Error("请输入密码"));
  } else if (!PASSWORD_REGEX.test(value)) {
    callback(new Error("密码需为8-16位，且必须包含字母和数字"));
  } else {
    callback();
  }
};

const validateConfirmPassword = (_rule: unknown, value: string, callback: ValidatorCallback) => {
  if (!value) {
    callback(new Error("请再次输入密码"));
  } else if (value !== registerForm.password) {
    callback(new Error("两次输入的密码不一致"));
  } else {
    callback();
  }
};

const validateAgree = (_rule: unknown, value: boolean, callback: ValidatorCallback) => {
  if (!value) {
    callback(new Error("请阅读并同意用户协议和隐私政策"));
  } else {
    callback();
  }
};

const registerRules = computed(() => ({
  username: [{ validator: validateUsername, trigger: "blur" }],
  email: [{ validator: validateEmail, trigger: "blur" }],
  emailCode: [{ validator: validateCode, trigger: "blur" }],
  // phone: [{ validator: validatePhone, trigger: "blur" }],     // 手机号注册暂未启用
  // phoneCode: [{ validator: validateCode, trigger: "blur" }],  // 手机号注册暂未启用
  password: [{ validator: validatePassword, trigger: "blur" }],
  confirmPassword: [{ validator: validateConfirmPassword, trigger: "blur" }],
  agree: [{ validator: validateAgree, trigger: "change" }],
}));

let emailCodeTimer: ReturnType<typeof setInterval> | null = null;
// let phoneCodeTimer = null; // 手机号注册暂未启用

const startEmailCodeCountdown = () => {
  if (emailCodeTimer) clearInterval(emailCodeTimer);
  emailCodeCountdown.value = 60;
  emailCodeTimer = setInterval(() => {
    emailCodeCountdown.value--;
    if (emailCodeCountdown.value <= 0) {
      if (emailCodeTimer) clearInterval(emailCodeTimer);
      emailCodeTimer = null;
      emailCodeDisabled.value = false;
    }
  }, 1000);
};

// 手机号注册暂未启用
// const startPhoneCodeCountdown = () => {
//   clearInterval(phoneCodeTimer);
//   phoneCodeCountdown.value = 60;
//   phoneCodeTimer = setInterval(() => {
//     phoneCodeCountdown.value--;
//     if (phoneCodeCountdown.value <= 0) {
//       clearInterval(phoneCodeTimer);
//       phoneCodeTimer = null;
//       phoneCodeDisabled.value = false;
//     }
//   }, 1000);
// };

onBeforeUnmount(() => {
  if (emailCodeTimer) clearInterval(emailCodeTimer);
  // clearInterval(phoneCodeTimer); // 手机号注册暂未启用
});

// 发送邮箱验证码
const sendEmailCode = async () => {
  if (emailCodeDisabled.value) {
    return;
  }
  if (!registerForm.email) {
    ElMessage.warning("请先输入邮箱地址");
    return;
  }
  if (
    !EMAIL_REGEX.test(registerForm.email)
  ) {
    ElMessage.warning("请输入有效的邮箱地址");
    return;
  }

  emailCodeDisabled.value = true;
  emailCodeLoading.value = true;
  try {
    const response = await authApi.sendEmailCode(
      registerForm.email,
      "register"
    );
    if (response.success) {
      ElMessage.success("验证码已发送");
      startEmailCodeCountdown();
    } else {
      emailCodeDisabled.value = false;
      ElMessage.error(response.message || "发送验证码失败");
    }
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "发送验证码失败"));
    emailCodeDisabled.value = false;
  } finally {
    emailCodeLoading.value = false;
  }
};

// 发送手机验证码（手机号注册暂未启用）
// const sendPhoneCode = async () => {
//   if (phoneCodeDisabled.value) {
//     return;
//   }
//   if (!registerForm.phone) {
//     ElMessage.warning(t("register.messages.enterPhone"));
//     return;
//   }
//   if (!/^1[3-9]\d{9}$/.test(registerForm.phone)) {
//     ElMessage.warning(t("register.messages.invalidPhone"));
//     return;
//   }
//
//   phoneCodeDisabled.value = true;
//   phoneCodeLoading.value = true;
//   try {
//     const response = await authApi.sendPhoneCode(registerForm.phone);
//
//     if (response.success) {
//       notificationManager.showCodeNotification("phone", response.code);
//       ElMessage.success(t("register.messages.codeSent"));
//       startPhoneCodeCountdown();
//     } else {
//       phoneCodeDisabled.value = false;
//       ElMessage.error(response.message || t("register.messages.codeFailed"));
//     }
//   } catch (error) {
//     console.error("Send phone code error:", error);
//     ElMessage.error(
//       error.response?.data?.message || t("register.messages.codeFailed")
//     );
//     phoneCodeDisabled.value = false;
//   } finally {
//     phoneCodeLoading.value = false;
//   }
// };

// 处理注册
const handleRegister = async () => {
  if (!registerFormRef.value) return;

  await registerFormRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true;

      try {
        // 准备注册数据
        const registerData: RegisterRequest = {
          username: registerForm.username,
          password: registerForm.password,
          register_type: registerType.value,
          email: registerForm.email,
          code: registerForm.emailCode,
        };
        // else {                                      // 手机号注册暂未启用
        //   registerData.phone = registerForm.phone;
        //   registerData.code = registerForm.phoneCode;
        // }

        // 调用后端注册接口
        const response = await authApi.register(registerData);

        if (response.success) {
          ElMessage.success("注册成功！即将跳转到登录页面...");

          // 跳转到登录页
          setTimeout(() => {
            router.push("/login");
          }, 1500);
        } else {
          ElMessage.error(response.message || "注册失败");
        }
      } catch (error) {
        console.error("Register error:", error);
        ElMessage.error(getErrorMessage(error, "注册失败，请检查网络连接"));
      } finally {
        loading.value = false;
      }
    } else {
      ElMessage.error("请正确填写表单");
      return;
    }
  });
};

// 跳转到登录页面
const goToLogin = () => {
  router.push("/login");
};
</script>

<style scoped>
.register-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* 背景装饰 */
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

/* 注册卡片 */
.register-card {
  position: relative;
  z-index: 10;
  width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 50px 40px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
}

.register-card :deep(.el-card__body) {
  padding: 0;
}

/* 滚动条样式 */
.register-card::-webkit-scrollbar {
  width: 6px;
}

.register-card::-webkit-scrollbar-thumb {
  background: rgba(102, 126, 234, 0.3);
  border-radius: 3px;
}

.register-card::-webkit-scrollbar-thumb:hover {
  background: rgba(102, 126, 234, 0.5);
}

/* Logo 和标题区域 */
.register-header {
  text-align: center;
  margin-bottom: 30px;
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

/* 注册方式切换 */
.register-type-switch {
  margin-bottom: 30px;
}

.register-type-switch :deep(.el-segmented__item) {
  padding: 10px 20px;
  font-size: 14px;
}

/* 注册表单 */
.register-form {
  margin-top: 30px;
}

.register-form :deep(.el-input__wrapper) {
  border-radius: 10px;
  padding: 12px 15px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.register-form :deep(.el-input__inner) {
  font-size: 15px;
}

/* 验证码输入 */
.code-input-wrapper {
  display: flex;
  gap: 10px;
}

.code-input-wrapper .el-input {
  flex: 1;
}

.send-code-btn {
  width: 140px;
  border-radius: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  white-space: nowrap;
  align-self: center;
  overflow: hidden;
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

/* 用户协议 */
.legal-document {
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 8px;
  color: #4b5563;
  line-height: 1.75;
}

.legal-document h3 {
  margin: 18px 0 6px;
  color: #1f2937;
  font-size: 15px;
}

.legal-document p {
  margin: 0;
}

.legal-updated {
  color: #8c8fa3;
  font-size: 13px;
}
.register-form :deep(.el-checkbox__label) {
  font-size: 13px;
  color: #606266;
}

/* 注册按钮 */
.register-button {
  width: 100%;
  height: 50px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  overflow: hidden;
}

/* 登录链接 */
.login-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  color: #606266;
  margin-top: 20px;
}

.login-link :deep(.el-link) {
  font-weight: 600;
}

/* 底部信息 */
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

/* 响应式设计 */
@media (max-width: 768px) {
  .register-card {
    width: 90%;
    padding: 40px 30px;
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
}
</style>
