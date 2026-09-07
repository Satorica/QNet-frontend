<template>
  <div class="auth-page">
    <div class="register-container auth-container">
      <!-- 背景装饰 -->
      <LoginBackground />

      <!-- 注册卡片 -->
      <el-card class="register-card auth-card">
        <!-- Logo 和标题 -->
        <div class="register-header auth-header">
          <p class="brand-eyebrow">QUANTUM COMPUTING</p>
          <div class="logo-section">
            <img class="logo-icon" :src="brandLogo" alt="量子Ising" width="44" height="44" />
            <h1 class="system-title">创建新账户</h1>
          </div>
          <p class="register-hint subtitle">使用邮箱和密码登录，昵称用于展示</p>
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
          class="register-form auth-form"
          @submit.prevent="handleRegister"
        >
          <!-- 昵称 -->
          <el-form-item prop="nickname">
            <label class="field-label" for="register-nickname">昵称</label>
            <el-input
              id="register-nickname"
              v-model="registerForm.nickname"
              placeholder="昵称（1–30个字符，支持中文）"
              autocomplete="off"
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
              <label class="field-label" for="register-email">邮箱</label>
              <el-input
                id="register-email"
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
              <label class="field-label" for="register-emailCode">邮箱验证码</label>
              <div class="code-input-wrapper">
                <el-input
                  id="register-emailCode"
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
            <label class="field-label" for="register-password">密码</label>
            <el-input
              id="register-password"
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
            <label class="field-label" for="register-confirmPassword">确认密码</label>
            <el-input
              id="register-confirmPassword"
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
              class="register-button auth-button"
              :loading="loading"
              @click="handleRegister"
            >
              注 册
            </el-button>
          </el-form-item>

          <!-- 登录链接 -->
          <div class="login-link auth-link-row">
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, type FormInstance } from "element-plus";
import { User, Message, Key, Lock } from "@element-plus/icons-vue";
import LoginBackground from "../components/LoginBackground.vue";
import brandLogo from "../assets/brand-logo.svg";
import { authApi } from "../api/auth";
import { EMAIL_REGEX } from "../utils/validation";
import { getErrorCode, getErrorMessage } from "../utils/error";
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
  nickname: "",
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
const validateNickname = (_rule: unknown, value: string, callback: ValidatorCallback) => {
  const nickname = value.trim();
  if (!nickname) {
    callback(new Error("请输入昵称"));
  } else if (Array.from(nickname).length > 30) {
    callback(new Error("昵称不能超过30个字符"));
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
  nickname: [{ validator: validateNickname, trigger: "blur" }],
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
          nickname: registerForm.nickname.trim(),
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
          ElMessage.success(response.message || "账号已准备就绪，即将跳转到登录页面");

          // 跳转到登录页
          setTimeout(() => {
            router.push("/login");
          }, 1500);
        } else {
          ElMessage.error(response.message || "注册失败");
        }
      } catch (error) {
        if (getErrorCode(error) === "SCAN_LOGIN_REQUIRED") {
          ElMessage.info(getErrorMessage(error, "小程序账号请扫码登录"));
          goToQrLogin();
          return;
        }
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
const goToQrLogin = () => {
  router.push({ path: "/login", query: { mode: "qr" } });
};
</script>

<style scoped src="../styles/auth.css"></style>

<style scoped>
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
</style>
