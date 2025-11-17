<template>
  <div id="app">
    <!-- 加载状态 -->
    <div v-if="!initialized" class="loading-container">
      <div class="loading-spinner"></div>
      <p class="loading-text">正在加载...</p>
    </div>
    
    <!-- 登录和注册页面 - 全屏显示 -->
    <div v-else-if="isAuthPage" class="auth-layout">
      <router-view />
    </div>
    
    <!-- 主应用布局 - 包含侧边栏和顶部栏 -->
    <el-container v-else-if="shouldShowMainLayout">
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
import {ref, onMounted} from 'vue'
import { tokenManager, userManager } from './utils/auth.js'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Sidebar from './components/Sidebar.vue'
import TopBar from './components/TopBar.vue'

const route = useRoute()
const initialized = ref(false)

onMounted(async () => {
  console.log('=========onMounted=========')
  console.log(userManager.isLoggedIn())
  console.log(tokenManager.getAccessToken())
  console.log(tokenManager.getRefreshToken())
  console.log('=========onMounted end=========')
  if (userManager.isLoggedIn()) {
    await tokenManager.verifyToken(() => {})
  }
  initialized.value = true
})

// 判断是否为认证页面（登录/注册）
const isAuthPage = computed(() => {
  return route.path === '/login' || route.path === '/register'
})

// 判断是否应该显示主布局（不在认证页面即可，访问控制由路由守卫保证）
const shouldShowMainLayout = computed(() => {
  return initialized.value && !isAuthPage.value
})
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
  background-image: url('/cover.jpg');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
}

.loading-container::before {
  content: '';
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
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 认证页面布局 - 全屏显示 */
.auth-layout {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background-image: url('/cover.jpg');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
}

.auth-layout::before {
  content: '';
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
.el-container {
  height: 100vh;
  background: linear-gradient(180deg, #F6F7FA, #FBFBFF);
  padding: 20px;
  gap: 20px;
}

.el-aside {
  background: linear-gradient(180deg, #F6F7FF, #FFFFFF);
  border-radius: 18px;
  border: 1px solid #E6EAF5;
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