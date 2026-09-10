<template>
  <div class="login-page auth-page">
    <div class="login-container auth-container">
      <!-- 背景装饰 -->
      <LoginBackground />

      <!-- 登录卡片 -->
      <el-card class="login-card auth-card">
        <!-- Logo 和标题 -->
        <div class="login-header auth-header">
          <p class="brand-eyebrow">QUANTUM COMPUTING</p>
          <div class="logo-section">
            <h1 class="system-title">量子 <span class="brand-latin">Ising</span> 求解系统</h1>
          </div>
          <p class="subtitle">现代化量子优化平台</p>
        </div>

        <div class="login-modes" role="tablist" aria-label="登录方式">
          <button role="tab" :disabled="loginPending" :aria-selected="loginMode === 'password'" :class="{ active: loginMode === 'password' }" @click="switchLoginMode('password')">邮箱密码登录</button>
          <button role="tab" :disabled="loginPending" :aria-selected="loginMode === 'qr'" :class="{ active: loginMode === 'qr' }" @click="switchLoginMode('qr')">小程序扫码登录</button>
        </div>
        <QrLoginPanel v-if="loginMode === 'qr'" @redeeming="qrRedeeming = $event" @logged-in="finishQrLogin" />
        <!-- 登录表单 -->
        <el-form v-if="loginMode === 'password'"
          ref="loginFormRef"
          :model="loginForm"
          :rules="loginRules"
          :disabled="loginPending"
          class="login-form auth-form"
          @submit.prevent="handleLogin"
        >
          <el-form-item prop="account">
            <label class="field-label" for="login-account">邮箱</label>
            <el-input
              id="login-account"
              v-model="loginForm.account"
              placeholder="请输入注册或绑定的邮箱"
              type="email"
              autocomplete="username"
              size="large"
              clearable
            >
              <template #prefix>
                <el-icon><Message /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item prop="password">
            <label class="field-label" for="login-password">密码</label>
            <el-input
              id="login-password"
              v-model="loginForm.password"
              type="password"
              autocomplete="current-password"
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
              class="login-button auth-button"
              :loading="loading"
              @click="handleLogin"
            >
              登 录
            </el-button>
          </el-form-item>

          <div class="register-link auth-link-row">
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
import { Message, Lock } from "@element-plus/icons-vue";
import { authApi } from "../api/auth";
import { userManager } from "../utils/auth";
import QrLoginPanel from "../components/QrLoginPanel.vue";
import LoginBackground from "../components/LoginBackground.vue";
import type { UserInfo } from "../types/api";
import { getErrorMessage } from "../utils/error";
import { EMAIL_REGEX } from "../utils/validation";

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
      message: "请输入邮箱地址",
      trigger: "blur",
    },
    { pattern: EMAIL_REGEX, message: "请输入有效的邮箱地址", trigger: "blur" },
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
  loginForm.account = loginForm.account.trim().toLowerCase();
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

<style scoped src="../styles/auth.css"></style>
