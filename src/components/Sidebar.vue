<template>
  <div class="sidebar">
    <div class="sidebar-top">
      <!-- 品牌区域 -->
      <div class="brand">
        <div class="logo">Q</div>
        <div>
          <div class="title">{{ $t('sidebar.title') }}</div>
          <div class="subtitle">{{ $t('sidebar.subtitle') }}</div>
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
          <span>{{ $t('sidebar.menu.maxcut') }}</span>
        </el-menu-item>
        <el-menu-item index="/number">
          <el-icon><Odometer /></el-icon>
          <span>{{ $t('sidebar.menu.number') }}</span>
        </el-menu-item>
        <el-menu-item index="/coloring">
          <el-icon><MagicStick /></el-icon>
          <span>{{ $t('sidebar.menu.coloring') }}</span>
        </el-menu-item>
        <el-menu-item index="/tsp">
          <el-icon><Location /></el-icon>
          <span>{{ $t('sidebar.menu.tsp') }}</span>
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
          <span>{{ $t('sidebar.menu.tasks') }}</span>
        </el-menu-item>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <span>{{ $t('sidebar.menu.settings') }}</span>
        </el-menu-item>
        <el-menu-item class="logout-btn" @click="handleLogout">
          <el-icon><SwitchButton /></el-icon>
          <span>{{ $t('sidebar.menu.logout') }}</span>
        </el-menu-item>
      </el-menu>
    </div>
  </div>
</template>

<script setup>
import { TrendCharts, Odometer, MagicStick, Location, List, Setting, SwitchButton } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { userManager } from '../utils/auth.js'

const router = useRouter()
const { t } = useI18n()

const handleLogout = async () => {
  try {
    await userManager.logout()
    ElMessage.success(t('sidebar.messages.logoutSuccess'))
    router.push('/login')
  } catch (error) {
    console.error('Logout error:', error)
    ElMessage.error(t('sidebar.messages.logoutFailed'))
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