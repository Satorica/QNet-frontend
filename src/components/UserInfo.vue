<template>
  <div class="user-info" v-if="isLoggedIn">
    <el-dropdown @command="handleCommand" trigger="click">
      <div class="user-avatar">
        <el-avatar :size="32" :src="userInfo?.avatar">
          {{ userInfo?.username?.charAt(0).toUpperCase() }}
        </el-avatar>
        <span class="username">{{ userInfo?.username }}</span>
        <el-icon class="dropdown-icon"><ArrowDown /></el-icon>
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="profile">
            <el-icon><User /></el-icon>
            个人资料
          </el-dropdown-item>
          <el-dropdown-item command="settings">
            <el-icon><Setting /></el-icon>
            设置
          </el-dropdown-item>
          <el-dropdown-item divided command="logout">
            <el-icon><SwitchButton /></el-icon>
            退出登录
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
  <div class="login-link" v-else>
    <el-button type="primary" @click="goToLogin">登录</el-button>
    <el-button @click="goToRegister">注册</el-button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Setting, SwitchButton, ArrowDown } from '@element-plus/icons-vue'
import { userManager } from '../utils/auth.js'

const router = useRouter()

// 用户信息
const userInfo = computed(() => userManager.getUserInfo())
const isLoggedIn = computed(() => userManager.isLoggedIn())

// 处理下拉菜单命令
const handleCommand = async (command) => {
  switch (command) {
    case 'profile':
      ElMessage.info('个人资料功能开发中...')
      break
    case 'settings':
      router.push('/settings')
      break
    case 'logout':
      await handleLogout()
      break
  }
}

// 处理登出
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

// 跳转到登录页面
const goToLogin = () => {
  router.push('/login')
}

// 跳转到注册页面
const goToRegister = () => {
  router.push('/register')
}
</script>

<style scoped>
.user-info {
  display: flex;
  align-items: center;
}

.user-avatar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.user-avatar:hover {
  background-color: rgba(102, 126, 234, 0.1);
}

.username {
  font-size: 14px;
  font-weight: 500;
  color: #2c3e50;
}

.dropdown-icon {
  font-size: 12px;
  color: #8492a6;
  transition: transform 0.3s;
}

.user-avatar:hover .dropdown-icon {
  transform: rotate(180deg);
}

.login-link {
  display: flex;
  align-items: center;
  gap: 8px;
}

.login-link .el-button {
  height: 32px;
  padding: 0 16px;
  font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .username {
    display: none;
  }
  
  .login-link {
    flex-direction: column;
    gap: 4px;
  }
  
  .login-link .el-button {
    width: 80px;
    height: 28px;
    font-size: 12px;
  }
}
</style>
