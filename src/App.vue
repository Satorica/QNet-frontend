<template>
  <div id="app">
    <!-- 加载状态 -->
    <div v-if="!initialized" class="loading-container">
      <div class="loading-spinner"></div>
      <p class="loading-text">{{ $t("app.loading") }}</p>
    </div>

    <!-- 登录和注册页面 - 全屏显示 -->
    <div v-else-if="isAuthPage" class="auth-layout">
      <router-view />
    </div>

    <!-- 主应用布局 - 包含侧边栏和顶部栏 -->
    <el-container v-else-if="shouldShowMainLayout" class="main-layout">
      <!-- 侧边栏 -->
      <el-aside width="240px">
        <Sidebar />
      </el-aside>

      <!-- 主内容区 -->
      <el-container>
        <!-- 顶栏 -->
        <el-header height="70px">
          <TopBar />
        </el-header>

        <!-- 主内容 -->
        <el-main>
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { tokenManager, userManager } from "./utils/auth.js";
import { computed } from "vue";
import { useRoute } from "vue-router";
import Sidebar from "./components/Sidebar.vue";
import TopBar from "./components/TopBar.vue";

const route = useRoute();
const initialized = ref(false);

onMounted(async () => {
  if (userManager.isLoggedIn()) {
    await tokenManager.verifyToken(() => {});
  }
  initialized.value = true;
});

// 判断是否为认证页面（登录/注册/找回密码）
const isAuthPage = computed(() => {
  return ["/login", "/register", "/forgot-password"].includes(route.path);
});

// 判断是否应该显示主布局（不在认证页面即可，访问控制由路由守卫保证）
const shouldShowMainLayout = computed(() => {
  return initialized.value && !isAuthPage.value;
});
</script>

<style>
#app {
  height: 100vh;
  font-family: "PingFang SC", "Noto Sans SC", "Inter", "Roboto", sans-serif;
}

/* 加载状态样式 */
.loading-container {
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  /* 渐变背景：紫蓝 → 靛蓝 → 青绿，带柔和光斑 */
  background: radial-gradient(
      circle at 8% 18%,
      rgba(124, 58, 237, 0.08),
      transparent 16%
    ),
    radial-gradient(circle at 92% 82%, rgba(34, 197, 94, 0.06), transparent 16%),
    linear-gradient(135deg, #071028 0%, #172554 45%, #5b6ef6 100%);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
}

.loading-container::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  z-index: 1;
}

.loading-container > * {
  position: relative;
  z-index: 2;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

.loading-text {
  color: white;
  font-size: 16px;
  margin: 0;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 认证页面布局 - 全屏显示 */
.auth-layout {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  /* 认证页背景：与全局保持一致的渐变色与光斑 */
  background: radial-gradient(
      circle at 15% 25%,
      rgba(124, 58, 237, 0.06),
      transparent 16%
    ),
    radial-gradient(circle at 85% 75%, rgba(34, 197, 94, 0.05), transparent 16%),
    linear-gradient(135deg, #071028 0%, #0c1a3a 45%, #4f6bf5 100%);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
}

.auth-layout::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(6px);
  z-index: 1;
}

.auth-layout > * {
  position: relative;
  z-index: 2;
}

/* 主应用布局 */
html,
body {
  margin: 0;
  padding: 0;
  overflow: hidden;
}

/* 外层主布局容器 */
.main-layout {
  box-sizing: border-box;
  height: 100vh;
  background: linear-gradient(180deg, #f6f7fa, #fbfbff);
  padding: 20px;
  gap: 20px;
}

.el-aside {
  background: linear-gradient(180deg, #f6f7ff, #ffffff);
  border-radius: 18px;
  border: 1px solid #e6eaf5;
  box-shadow: 0 10px 20px rgba(9, 30, 66, 0.04);
  padding: 18px;
}

.el-header {
  padding: 0;
  margin-bottom: 20px;
}

.el-main {
  padding: 0;
}
</style> 