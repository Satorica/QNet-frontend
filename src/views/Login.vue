<template>
  <div class="login-container">
    <!-- 背景装饰 -->
    <div class="background-decoration">
      <div class="circle circle-1"></div>
      <div class="circle circle-2"></div>
      <div class="circle circle-3"></div>
    </div>

    <!-- 登录卡片 -->
    <el-card class="login-card">
      <!-- Logo 和标题 -->
      <div class="login-header">
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
          <el-input
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
          <el-input
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
</template>

<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import { onBeforeRouteLeave, useRouter } from "vue-router";
import { ElMessage, type FormInstance } from "element-plus";
import { User, Lock } from "@element-plus/icons-vue";
import { authApi } from "../api/auth";
import { userManager } from "../utils/auth";
import QrLoginPanel from "../components/QrLoginPanel.vue";
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
.login-modes { display: flex; gap: 12px; margin: 0 0 24px; border-bottom: 1px solid #e5e7eb; }
.login-modes button { flex: 1; padding: 12px 4px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: #64748b; font: inherit; cursor: pointer; }
.login-modes button.active { color: #2563eb; border-bottom-color: #2563eb; font-weight: 600; }
.login-modes button:disabled { cursor: wait; opacity: .65; }

.login-container {
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

/* 登录卡片 */
.login-card {
  box-sizing: border-box;
  max-width: calc(100vw - 32px);
  position: relative;
  z-index: 10;
  width: 540px;
  padding: 50px 40px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
}

.login-card :deep(.el-card__body) {
  padding: 0;
}

/* Logo 和标题区域 */
.login-header {
  text-align: center;
  margin-bottom: 40px;
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

/* 登录表单 */
.login-form {
  margin-top: 30px;
}

.login-form :deep(.el-input__wrapper) {
  border-radius: 10px;
  padding: 12px 15px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.login-form :deep(.el-input__inner) {
  font-size: 15px;
}

.form-options {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-options :deep(.el-checkbox__label) {
  font-size: 14px;
  color: #606266;
}

.form-options :deep(.el-link) {
  font-size: 14px;
}

/* 登录按钮 */
.login-button {
  width: 100%;
  height: 50px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  overflow: hidden;
}

/* 注册链接 */
.register-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 14px;
  color: #606266;
  margin-top: 20px;
}

.register-link :deep(.el-link) {
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
  .login-card {
    width: 90%;
    padding: 32px 20px;
  }

  .system-title {
    font-size: clamp(17px, 5vw, 20px);
  }
  .logo-section { gap: 12px; }
  .logo-icon { width: 44px; height: 44px; flex-shrink: 0; font-size: 28px; }
}
</style>
