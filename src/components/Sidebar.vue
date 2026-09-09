<template>
  <div class="sidebar">
    <div class="sidebar-top">
      <!-- 品牌区域 -->
      <div class="brand">
        <div class="title">量子 Ising 求解系统</div>
        <div class="subtitle">可视化求解与任务管理</div>
      </div>

      <!-- 导航菜单 -->
      <el-menu
        :default-active="activeMenu"
        class="nav-menu"
        router
        background-color="transparent"
        text-color="#8C8FA3"
        active-text-color="var(--app-accent)"
      >
        <el-menu-item index="/maxcut">
          <el-icon><TrendCharts /></el-icon>
          <span>图分割问题</span>
        </el-menu-item>
        <el-menu-item index="/number">
          <el-icon><Odometer /></el-icon>
          <span>数分问题</span>
        </el-menu-item>
        <el-menu-item index="/coloring">
          <el-icon><MagicStick /></el-icon>
          <span>图着色问题</span>
        </el-menu-item>
        <el-menu-item index="/tsp">
          <el-icon><Location /></el-icon>
          <span>旅行商问题</span>
        </el-menu-item>
        <el-menu-item index="/general">
          <el-icon><DataAnalysis /></el-icon>
          <span>一般问题</span>
        </el-menu-item>
      </el-menu>
    </div>

    <!-- 底部导航 -->
    <div class="sidebar-bottom">
      <el-menu
        :default-active="activeMenu"
        class="bottom-menu"
        router
        background-color="transparent"
        text-color="#8C8FA3"
        active-text-color="var(--app-accent)"
      >
        <el-menu-item index="/tasks">
          <el-icon><List /></el-icon>
          <span>任务情况</span>
        </el-menu-item>
        <el-menu-item index="/quota-requests">
          <el-icon><Tickets /></el-icon>
          <span>我的申请</span>
        </el-menu-item>
        <el-menu-item index="/feedback">
          <el-icon><ChatDotRound /></el-icon>
          <span>问题反馈</span>
        </el-menu-item>
        <el-menu-item class="logout-btn" @click="handleLogout">
          <el-icon><SwitchButton /></el-icon>
          <span>退出</span>
        </el-menu-item>
      </el-menu>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TrendCharts, Odometer, MagicStick, Location, DataAnalysis, List, Tickets, ChatDotRound, SwitchButton } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { userManager } from '../utils/auth'

const router = useRouter()
const route = useRoute()
const activeMenu = computed(() => {
  if (route.path.startsWith('/feedback')) return '/feedback'
  return route.path
})

const handleLogout = async () => {
  try {
    await userManager.logout()
    ElMessage.success('已退出登录')
    router.push('/login')
  } catch {
    ElMessage.error('登出失败')
  }
}
</script>

<style scoped>
.sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.brand {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  min-height: 40px;
  padding: 0 12px;
  margin-bottom: 20px;
}

.title {
  font-weight: 600;
  font-size: 15px;
  line-height: 1.6;
  color: #263b52;
}

.subtitle {
  font-size: 12px;
  color: #8C8FA3;
}

.nav-menu, .bottom-menu {
  border: none;
}

.nav-menu .el-menu-item,
.bottom-menu .el-menu-item,
.logout-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  margin: 4px 0;
  transition: all 0.3s;
}

.nav-menu .el-menu-item:hover,
.bottom-menu .el-menu-item:hover,
.logout-btn:hover {
  background-color: var(--app-accent-soft);
}

.nav-menu .el-menu-item.is-active,
.bottom-menu .el-menu-item.is-active {
  background: var(--app-accent-gradient);
  color: white !important;
  box-shadow: 0 6px 18px rgba(var(--app-accent-rgb), 0.25);
}

.logout-btn {
  cursor: pointer;
  color: #8C8FA3;
  font-size: 14px;
  margin-top: 8px;
}

.logout-btn:hover {
  color: var(--app-accent);
}
</style>
