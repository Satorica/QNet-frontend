<template>
  <div class="sidebar">
    <div class="sidebar-top">
      <!-- 品牌区域 -->
      <div class="brand">
        <div class="logo">Q</div>
        <div>
          <div class="title">量子Ising求解系统</div>
          <div class="subtitle">可视化求解与任务管理</div>
        </div>
      </div>

      <!-- 导航菜单 -->
      <el-menu
        :default-active="$route.path"
        class="nav-menu"
        router
        background-color="transparent"
        text-color="#8C8FA3"
        active-text-color="#4050F8"
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
      </el-menu>
    </div>

    <!-- 底部导航 -->
    <div class="sidebar-bottom">
      <el-menu
        :default-active="$route.path"
        class="bottom-menu"
        router
        background-color="transparent"
        text-color="#8C8FA3"
        active-text-color="#4050F8"
      >
        <el-menu-item index="/tasks">
          <el-icon><List /></el-icon>
          <span>任务情况</span>
        </el-menu-item>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <span>设置</span>
        </el-menu-item>
        <el-menu-item class="logout-btn" @click="handleLogout">
          <el-icon><SwitchButton /></el-icon>
          <span>退出</span>
        </el-menu-item>
      </el-menu>
    </div>
  </div>
</template>

<script setup>
import { TrendCharts, Odometer, MagicStick, Location, List, Setting, SwitchButton } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { userManager } from '../utils/auth.js'

const router = useRouter()

const handleLogout = async () => {
  try {
    await userManager.logout()
    ElMessage.success('已退出登录')
    router.push('/login')
  } catch (error) {
    console.error('登出错误:', error)
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
  gap: 12px;
  align-items: center;
  margin-bottom: 20px;
}

.logo {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: linear-gradient(180deg, #4050F8, #7848E8);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 18px;
  box-shadow: 0 6px 18px rgba(64, 80, 248, 0.12);
}

.title {
  font-weight: 700;
  font-size: 15px;
  color: #292929;
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
  background-color: rgba(64, 80, 248, 0.1);
}

.nav-menu .el-menu-item.is-active,
.bottom-menu .el-menu-item.is-active {
  background: linear-gradient(135deg, #4050F8, #7848E8);
  color: white !important;
  box-shadow: 0 6px 18px rgba(64, 80, 248, 0.25);
}

.logout-btn {
  cursor: pointer;
  color: #8C8FA3;
  font-size: 14px;
  margin-top: 8px;
}

.logout-btn:hover {
  color: #4050F8;
}
</style> 