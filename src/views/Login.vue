<template>
  <div class="login-page">
    <div class="login-container">
      <!-- 背景装饰 -->
      <LoginBackground />

      <!-- 登录卡片 -->
      <el-card class="login-card">
        <!-- Logo 和标题 -->
        <div class="login-header">
          <p class="brand-eyebrow">QUANTUM COMPUTING</p>
          <div class="logo-section">
            <div class="logo-icon">Q</div>
            <h1 class="system-title">量子Ising求解系统</h1>
          </div>
          <p class="subtitle">现代化量子优化问题求解平台</p>
        </div>

        <div class="login-modes" role="tablist" aria-label="登录方式">
          <button role="tab" :disabled="loginPending" :aria-selected="loginMode === 'password'" :class="{ active: loginMode === 'password' }" @click="switchLoginMode('password')">账号密码登录</button>
          <button role="tab" :disabled="loginPending" :aria-selected="loginMode === 'qr'" :class="{ active: loginMode === 'qr' }" @click="switchLoginMode('qr')">小程序扫码登录</button>
        </div>
        <QrLoginPanel v-if="loginMode === 'qr'" @redeeming="qrRedeeming = $event" @logged-in="finishQrLogin" />
        <!-- 登录表单 -->
        <el-form v-if="loginMode === 'password'"
          ref="loginFormRef"
          :model="loginForm"
          :rules="loginRules"
          :disabled="loginPending"
          class="login-form"
          @submit.prevent="handleLogin"
        >
          <el-form-item prop="account">
            <label class="field-label" for="login-account">账号</label>
            <el-input
              id="login-account"
              v-model="loginForm.account"
              placeholder="Web 账号用户名 / 邮箱"
              size="large"
              clearable
            >
              <template #prefix>
                <el-icon><User /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item prop="password">
            <label class="field-label" for="login-password">密码</label>
            <el-input
              id="login-password"
              v-model="loginForm.password"
              type="password"
              placeholder="密码"
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
            <div class="form-options">
              <el-checkbox v-model="loginForm.remember"
                >记住我</el-checkbox
              >
              <el-link
                type="primary"
                :underline="false"
                @click="goToForgotPassword"
                >找回密码</el-link
              >
            </div>
          </el-form-item>

          <el-form-item>
            <el-button
              type="primary"
              size="large"
              class="login-button"
              :loading="loading"
              @click="handleLogin"
            >
              登 录
            </el-button>
          </el-form-item>

          <div class="register-link">
            还没有账号？
            <el-link type="primary" :underline="false" @click="goToRegister">
              立即注册
            </el-link>
          </div>
        </el-form>
      </el-card>

      <!-- 版权信息 -->
      <div class="footer-info">
        <p>© {{ new Date().getFullYear() }} 量子Ising求解系统 | 现代化量子优化平台</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import { ElMessage, type FormInstance } from "element-plus";
import { User, Lock } from "@element-plus/icons-vue";
import { authApi } from "../api/auth";
import { userManager } from "../utils/auth";
import QrLoginPanel from "../components/QrLoginPanel.vue";
import LoginBackground from "../components/LoginBackground.vue";
import type { UserInfo } from "../types/api";
import { getErrorMessage } from "../utils/error";

const router = useRouter();
const loginMode = ref<"password" | "qr">(
  router.currentRoute.value.query.mode === "qr" ? "qr" : "password"
);
const loading = ref(false);
const qrRedeeming = ref(false);
const loginSucceeded = ref(false);
const loginPending = computed(() => loading.value || qrRedeeming.value);
const switchLoginMode = (mode: "password" | "qr") => {
  if (!loginPending.value) loginMode.value = mode;
};
// Keep the component alive until the request that can set the login Cookie
// finishes. Successful login may navigate to its destination immediately.
onBeforeRouteLeave(() => !loginPending.value || loginSucceeded.value);

const finishQrLogin = (user: UserInfo) => {
  localStorage.removeItem("rememberMe");
  userManager.setUserInfo(user);
  loginSucceeded.value = true;
  ElMessage.success("登录成功");
  const raw = router.currentRoute.value.query.redirect;
  router.push(typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/maxcut");
};
const loginFormRef = ref<FormInstance>();

// 登录表单数据
const loginForm = reactive({
  account: "",
  password: "",
  remember: false,
});

// 表单验证规则
const loginRules = computed(() => ({
  account: [
    {
      required: true,
      message: "请输入用户名/邮箱/手机号",
      trigger: "blur",
    },
  ],
  password: [
    {
      required: true,
      message: "请输入密码",
      trigger: "blur",
    },
    { min: 6, message: "密码长度不能少于6位", trigger: "blur" },
  ],
}));

// 处理登录
const handleLogin = async () => {
  if (loginPending.value || loginMode.value !== "password" || !loginFormRef.value) return;
  // Lock before asynchronous validation as well as during the login request.
  loading.value = true;
  loginSucceeded.value = false;
  try {
    const valid = await loginFormRef.value.validate().catch(() => false);
    if (!valid) {
      ElMessage.error("请正确填写表单");
      return;
    }
    // 调用后端登录接口（remember 传递给后端决定 Cookie 持久化策略）
    const response = await authApi.login(
      loginForm.account,
      loginForm.password,
      loginForm.remember
    );

    if (response.success && response.data?.user) {
      // Token 已由后端通过 HttpOnly Cookie 写入，前端只缓存展示用的用户信息
      const remember = loginForm.remember;
      if (remember) localStorage.setItem("rememberMe", "true");
      else localStorage.removeItem("rememberMe");
      userManager.setUserInfo(response.data.user, remember);
      loginSucceeded.value = true;

      ElMessage.success("登录成功！");

      // 跳转到主页或重定向页面（校验为站内相对路径，防止开放重定向）
      const rawRedirect = router.currentRoute.value.query.redirect;
      const redirect =
        typeof rawRedirect === "string" &&
        rawRedirect.startsWith("/") &&
        !rawRedirect.startsWith("//")
          ? rawRedirect
          : "/maxcut";
      router.push(redirect);
    } else {
      ElMessage.error(response.message || "登录失败");
    }
  } catch (error) {
    ElMessage.error(getErrorMessage(error, "登录失败，请检查网络连接"));
  } finally {
    loading.value = false;
  }
};

// 跳转到注册页面
const goToRegister = () => {
  if (loginPending.value) return;
  router.push("/register");
};

const goToForgotPassword = () => {
  if (loginPending.value) return;
  router.push("/forgot-password");
};
</script>

<style scoped>
.login-page {
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  background: #020c19;
}
.login-container {
  position: relative;
  isolation: isolate;
  box-sizing: border-box;
  width: 100%;
  min-height: 100%;
  padding: 32px 24px 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.login-card {
  --el-color-primary: #087eaa;
  --el-color-primary-light-3: #219cc0;
  --el-color-primary-dark-2: #066888;
  --el-text-color-regular: #405e70;
  box-sizing: border-box;
  position: relative;
  z-index: 2;
  width: 480px;
  max-width: 100%;
  padding: 28px 38px;
  border-radius: 24px;
  background: rgba(236, 246, 250, .96);
  border: 1px solid rgba(199, 234, 246, .8);
  box-shadow: 0 24px 80px #000b1880, inset 0 1px 0 #ffffff;
  backdrop-filter: blur(24px);
}
.login-card :deep(.el-card__body) { padding: 0; }
.login-header { text-align: center; margin-bottom: 22px; }
.brand-eyebrow {
  margin: 0 0 12px;
  font: 500 10px/1.4 "Consolas", monospace;
  letter-spacing: .24em;
  color: #52798b;
}
.logo-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 12px;
}
.logo-icon {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 13px;
  background: #077fa4;
  border: 1px solid #149ab9;
  color: #fff;
  font-size: 27px;
  font-weight: 600;
  display: grid;
  place-items: center;
  box-shadow: 0 5px 14px #087eaa24, inset 0 1px 0 #ffffff30;
}
.system-title {
  font-size: 25px;
  font-weight: 600;
  letter-spacing: -.035em;
  color: #173c50;
  margin: 0;
}
.subtitle { font-size: 13px; color: #587384; margin: 0; line-height: 1.6; }
.login-modes {
  display: flex;
  gap: 4px;
  padding: 4px;
  margin: 0 0 20px;
  border: 1px solid #cddfe6;
  background: #e0edf2;
  border-radius: 11px;
}
.login-modes button {
  flex: 1;
  padding: 10px 2px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: #506b7b;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: background-color .18s, color .18s;
}
.login-modes button.active {
  color: #066d91;
  background: #f9fdff;
  border-color: #d4e4eb;
  box-shadow: 0 2px 5px #203f5110;
  font-weight: 600;
}
.login-modes button:hover:not(.active):not(:disabled) { background: #edf6f9; }
.login-modes button:disabled { cursor: wait; opacity: .65; }
.login-modes button:focus-visible,
.login-card :deep(.el-link:focus-visible),
.login-button:focus-visible { outline: 3px solid #0795bd; outline-offset: 3px; }
.login-form { margin-top: 0; }
.field-label { display: block; width: 100%; color: #365669; font-size: 13px; line-height: 20px; margin-bottom: 8px; font-weight: 500; }
.login-form :deep(.el-form-item) { margin-bottom: 18px; }
.login-form :deep(.el-input__wrapper) {
  border-radius: 10px;
  padding: 4px 13px;
  background: #f7fcfe;
  box-shadow: 0 0 0 1px #bfd3df inset;
  transition: box-shadow .18s, background-color .18s;
}
.login-form :deep(.el-input__wrapper:hover) { box-shadow: 0 0 0 1px #7baec2 inset; }
.login-form :deep(.el-input__wrapper.is-focus) {
  background: #fff;
  box-shadow: 0 0 0 1.5px #087eaa inset, 0 0 0 3px #087eaa14;
}
.login-form :deep(.is-error .el-input__wrapper) { box-shadow: 0 0 0 1px var(--el-color-danger) inset; }
.login-form :deep(.el-input__inner) { font-size: 14px; color: #214559; }
.login-form :deep(.el-input__inner::placeholder) { color: #6b8290; }
.login-form :deep(.el-input__prefix),
.login-form :deep(.el-input__suffix) { color: #638397; }
.login-form :deep(input:-webkit-autofill) {
  -webkit-box-shadow: 0 0 0 1000px #f7fcfe inset;
  -webkit-text-fill-color: #214559;
  caret-color: #214559;
}
.form-options { width: 100%; display: flex; justify-content: space-between; align-items: center; }
.form-options :deep(.el-checkbox__label) { font-size: 13px; color: #4c6879; }
.form-options :deep(.el-checkbox__inner) { border-color: #91adbd; }
.form-options :deep(.el-link) { font-size: 13px; }
.login-button {
  width: 100%;
  height: 48px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: .16em;
  border-radius: 10px;
  background: #087fa8;
  border: 1px solid #0e90b7;
  box-shadow: 0 6px 16px #087fa823, inset 0 1px 0 #ffffff20;
  transition: background-color .18s, box-shadow .18s;
}
.login-button:hover:not(:disabled) { background: #066d94; box-shadow: 0 8px 20px #087fa82e; }
.login-button:active:not(:disabled) { background: #075a7b; }
.register-link { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; color: #526e7e; margin-top: 4px; }
.register-link :deep(.el-link) { font-size: 13px; font-weight: 600; }
.footer-info {
  position: absolute;
  z-index: 1;
  bottom: 26px;
  left: 20px;
  right: 20px;
  text-align: center;
  color: #9ab2c7;
  font-size: 12px;
  line-height: 1.7;
}
.footer-info p { margin: 0; }
@media (max-width: 768px) {
  .login-container { padding: 136px 20px 84px; }
  .login-card { width: 440px; padding: 28px 24px; border-radius: 20px; }
  .brand-eyebrow { margin-bottom: 17px; font-size: 9px; }
  .system-title { font-size: clamp(18px, 5vw, 23px); }
  .logo-section { gap: 10px; }
  .logo-icon { width: 38px; height: 38px; font-size: 25px; border-radius: 11px; }
  .login-header { margin-bottom: 24px; }
  .subtitle { font-size: 12px; }
  .login-modes button { font-size: 13px; }
  .footer-info { font-size: 11px; }
}
@media (max-width: 360px) {
  .login-container { padding-left: 14px; padding-right: 14px; }
  .login-card { padding-left: 20px; padding-right: 20px; }
}
@media (max-height: 540px) and (min-width: 540px) {
  .login-container { padding-top: 32px; }
}
@media (prefers-reduced-motion: reduce) {
  .login-card *, .login-card :deep(*) { transition: none !important; }
}
</style>
