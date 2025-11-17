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

      <!-- 登录表单 -->
      <el-form
        ref="loginFormRef"
        :model="loginForm"
        :rules="loginRules"
        class="login-form"
        @submit.prevent="handleLogin"
      >
        <el-form-item prop="account">
          <el-input
            v-model="loginForm.account"
            placeholder="用户名 / 邮箱 / 手机号"
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
            <el-checkbox v-model="loginForm.remember">记住我</el-checkbox>
            <el-link type="primary" :underline="false">忘记密码?</el-link>
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
      <p>© 2025 量子Ising求解系统 | 现代化量子优化平台</p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { authApi } from '../api/auth.js'
import { tokenManager, userManager } from '../utils/auth.js'

const router = useRouter()
const loginFormRef = ref(null)
const loading = ref(false)

// 登录表单数据
const loginForm = reactive({
  account: '',
  password: '',
  remember: false
})

// 表单验证规则
const loginRules = {
  account: [
    { required: true, message: '请输入用户名/邮箱/手机号', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ]
}

// 处理登录
const handleLogin = async () => {
  if (!loginFormRef.value) return

  await loginFormRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      
      try {
        // 调用后端登录接口
        const response = await authApi.login(loginForm.account, loginForm.password)
        
        if (response.success) {
          // 保存token和用户信息（根据"记住我"选择存储方式）
          const remember = loginForm.remember
          tokenManager.setToken(response.data.accessToken, response.data.refreshToken, remember)
          userManager.setUserInfo(response.data.user, remember)
          
          ElMessage.success('登录成功！')
          
          // 跳转到主页或重定向页面
          const redirect = router.currentRoute.value.query.redirect || '/maxcut'
          router.push(redirect)
        } else {
          ElMessage.error(response.message || '登录失败')
        }
      } catch (error) {
        console.error('登录错误:', error)
        ElMessage.error(error.response?.data?.message || '登录失败，请检查网络连接')
      } finally {
        loading.value = false
      }
    } else {
      ElMessage.error('请正确填写表单')
      return false
    }
  })
}

// 跳转到注册页面
const goToRegister = () => {
  router.push('/register')
}
</script>

<style scoped>
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
  position: relative;
  z-index: 10;
  width: 460px;
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
  transition: all 0.3s ease;
}

.login-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

.login-button:active {
  transform: translateY(0);
}

/* 注册链接 */
.register-link {
  text-align: center;
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
    padding: 40px 30px;
  }

  .system-title {
    font-size: 24px;
  }
}
</style>

