<template>
  <div class="register-container">
    <!-- 背景装饰 -->
    <div class="background-decoration">
      <div class="circle circle-1"></div>
      <div class="circle circle-2"></div>
      <div class="circle circle-3"></div>
    </div>

    <!-- 注册卡片 -->
    <el-card class="register-card">
      <!-- Logo 和标题 -->
      <div class="register-header">
        <div class="logo-section">
          <div class="logo-icon">Q</div>
          <h1 class="system-title">创建新账户</h1>
        </div>
        <p class="subtitle">加入量子Ising求解系统</p>
      </div>

      <!-- 注册方式切换 -->
      <el-segmented v-model="registerType" :options="registerOptions" block size="large" class="register-type-switch" />

      <!-- 注册表单 -->
      <el-form
        ref="registerFormRef"
        :model="registerForm"
        :rules="registerRules"
        class="register-form"
        @submit.prevent="handleRegister"
      >
        <!-- 用户名 -->
        <el-form-item prop="username">
          <el-input
            v-model="registerForm.username"
            placeholder="用户名 (字母、数字、下划线)"
            size="large"
            clearable
          >
            <template #prefix>
              <el-icon><User /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <!-- 邮箱注册 -->
        <template v-if="registerType === 'email'">
          <el-form-item prop="email">
            <el-input
              v-model="registerForm.email"
              placeholder="邮箱地址"
              size="large"
              clearable
            >
              <template #prefix>
                <el-icon><Message /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item prop="emailCode">
            <div class="code-input-wrapper">
              <el-input
                v-model="registerForm.emailCode"
                placeholder="邮箱验证码"
                size="large"
                clearable
              >
                <template #prefix>
                  <el-icon><Key /></el-icon>
                </template>
              </el-input>
              <el-button
                type="primary"
                size="large"
                class="send-code-btn"
                :disabled="emailCodeDisabled"
                @click="sendEmailCode"
              >
                {{ emailCodeText }}
              </el-button>
            </div>
          </el-form-item>
        </template>

        <!-- 手机号注册 -->
        <template v-if="registerType === 'phone'">
          <el-form-item prop="phone">
            <el-input
              v-model="registerForm.phone"
              placeholder="手机号码"
              size="large"
              clearable
            >
              <template #prefix>
                <el-icon><Phone /></el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item prop="phoneCode">
            <div class="code-input-wrapper">
              <el-input
                v-model="registerForm.phoneCode"
                placeholder="短信验证码"
                size="large"
                clearable
              >
                <template #prefix>
                  <el-icon><Key /></el-icon>
                </template>
              </el-input>
              <el-button
                type="primary"
                size="large"
                class="send-code-btn"
                :disabled="phoneCodeDisabled"
                @click="sendPhoneCode"
              >
                {{ phoneCodeText }}
              </el-button>
            </div>
          </el-form-item>
        </template>

        <!-- 密码 -->
        <el-form-item prop="password">
          <el-input
            v-model="registerForm.password"
            type="password"
            placeholder="密码 (至少6位)"
            size="large"
            show-password
            clearable
          >
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <!-- 确认密码 -->
        <el-form-item prop="confirmPassword">
          <el-input
            v-model="registerForm.confirmPassword"
            type="password"
            placeholder="确认密码"
            size="large"
            show-password
            clearable
          >
            <template #prefix>
              <el-icon><Lock /></el-icon>
            </template>
          </el-input>
        </el-form-item>

        <!-- 用户协议 -->
        <el-form-item prop="agree">
          <el-checkbox v-model="registerForm.agree">
            我已阅读并同意
            <el-link type="primary" :underline="false">《用户协议》</el-link>
            和
            <el-link type="primary" :underline="false">《隐私政策》</el-link>
          </el-checkbox>
        </el-form-item>

        <!-- 注册按钮 -->
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            class="register-button"
            :loading="loading"
            @click="handleRegister"
          >
            注 册
          </el-button>
        </el-form-item>

        <!-- 登录链接 -->
        <div class="login-link">
          已有账号？
          <el-link type="primary" :underline="false" @click="goToLogin">
            立即登录
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
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Message, Phone, Lock, Key } from '@element-plus/icons-vue'
import { authApi } from '../api/auth.js'
import { tokenManager, userManager, notificationManager } from '../utils/auth.js'

const router = useRouter()
const registerFormRef = ref(null)
const loading = ref(false)

// 注册方式
const registerType = ref('email')
const registerOptions = [
  { label: '邮箱注册', value: 'email' },
  { label: '手机注册', value: 'phone' }
]

// 注册表单数据
const registerForm = reactive({
  username: '',
  email: '',
  emailCode: '',
  phone: '',
  phoneCode: '',
  password: '',
  confirmPassword: '',
  agree: false
})

// 邮箱验证码相关
const emailCodeDisabled = ref(false)
const emailCodeCountdown = ref(0)
const emailCodeText = computed(() => {
  return emailCodeCountdown.value > 0 ? `${emailCodeCountdown.value}秒后重试` : '发送验证码'
})

// 手机验证码相关
const phoneCodeDisabled = ref(false)
const phoneCodeCountdown = ref(0)
const phoneCodeText = computed(() => {
  return phoneCodeCountdown.value > 0 ? `${phoneCodeCountdown.value}秒后重试` : '发送验证码'
})

// 表单验证规则
const validateUsername = (rule, value, callback) => {
  if (!value) {
    callback(new Error('请输入用户名'))
  } else if (!/^[a-zA-Z0-9_]{3,20}$/.test(value)) {
    callback(new Error('用户名为3-20位字母、数字或下划线'))
  } else {
    callback()
  }
}

const validateEmail = (rule, value, callback) => {
  if (registerType.value === 'email') {
    if (!value) {
      callback(new Error('请输入邮箱地址'))
    } else if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/.test(value)) {
      callback(new Error('请输入有效的邮箱地址'))
    } else {
      callback()
    }
  } else {
    callback()
  }
}

const validatePhone = (rule, value, callback) => {
  if (registerType.value === 'phone') {
    if (!value) {
      callback(new Error('请输入手机号码'))
    } else if (!/^1[3-9]\d{9}$/.test(value)) {
      callback(new Error('请输入有效的手机号码'))
    } else {
      callback()
    }
  } else {
    callback()
  }
}

const validateCode = (rule, value, callback) => {
  const isEmail = registerType.value === 'email'
  if ((isEmail && !registerForm.emailCode) || (!isEmail && !registerForm.phoneCode)) {
    callback(new Error('请输入验证码'))
  } else {
    callback()
  }
}

const validateConfirmPassword = (rule, value, callback) => {
  if (!value) {
    callback(new Error('请再次输入密码'))
  } else if (value !== registerForm.password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const validateAgree = (rule, value, callback) => {
  if (!value) {
    callback(new Error('请阅读并同意用户协议和隐私政策'))
  } else {
    callback()
  }
}

const registerRules = {
  username: [{ validator: validateUsername, trigger: 'blur' }],
  email: [{ validator: validateEmail, trigger: 'blur' }],
  emailCode: [{ validator: validateCode, trigger: 'blur' }],
  phone: [{ validator: validatePhone, trigger: 'blur' }],
  phoneCode: [{ validator: validateCode, trigger: 'blur' }],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ],
  confirmPassword: [{ validator: validateConfirmPassword, trigger: 'blur' }],
  agree: [{ validator: validateAgree, trigger: 'change' }]
}

// 发送邮箱验证码
const sendEmailCode = async () => {
  if (!registerForm.email) {
    ElMessage.warning('请先输入邮箱地址')
    return
  }
  if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/.test(registerForm.email)) {
    ElMessage.warning('请输入有效的邮箱地址')
    return
  }

  try {
    const response = await authApi.sendEmailCode(registerForm.email)
    console.log('=========sendEmailCode response=========')
    console.log(response)
    console.log('=========sendEmailCode response end=========')
    if (response.success) {
      // 目前后端传回来验证码
      notificationManager.showCodeNotification('email', response.code)
      ElMessage.success('验证码已发送到您的邮箱')
      
      // 开始倒计时
      emailCodeDisabled.value = true
      emailCodeCountdown.value = 60
      const timer = setInterval(() => {
        emailCodeCountdown.value--
        if (emailCodeCountdown.value <= 0) {
          clearInterval(timer)
          emailCodeDisabled.value = false
        }
      }, 1000)
    } else {
      ElMessage.error(response.message || '发送验证码失败')
    }
  } catch (error) {
    console.error('发送邮箱验证码错误:', error)
    ElMessage.error('发送验证码失败，请稍后重试')
  }
}

// 发送手机验证码
const sendPhoneCode = async () => {
  if (!registerForm.phone) {
    ElMessage.warning('请先输入手机号码')
    return
  }
  if (!/^1[3-9]\d{9}$/.test(registerForm.phone)) {
    ElMessage.warning('请输入有效的手机号码')
    return
  }

  try {
    const response = await authApi.sendPhoneCode(registerForm.phone)
    console.log('=========sendPhoneCode response=========')
    console.log(response)
    console.log('=========sendPhoneCode response end=========')
    if (response.success) {
      // 目前后端传回来验证码
      // const mockCode = Math.floor(100000 + Math.random() * 900000).toString()
      notificationManager.showCodeNotification('phone', response.code)
      
      ElMessage.success('验证码已发送到您的手机')
      
      // 开始倒计时
      phoneCodeDisabled.value = true
      phoneCodeCountdown.value = 60
      const timer = setInterval(() => {
        phoneCodeCountdown.value--
        if (phoneCodeCountdown.value <= 0) {
          clearInterval(timer)
          phoneCodeDisabled.value = false
        }
      }, 1000)
    } else {
      ElMessage.error(response.message || '发送验证码失败')
    }
  } catch (error) {
    console.error('发送手机验证码错误:', error)
    ElMessage.error('发送验证码失败，请稍后重试')
  }
}

// 处理注册
const handleRegister = async () => {
  if (!registerFormRef.value) return

  await registerFormRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      
      try {
        // 准备注册数据
        const registerData = {
          username: registerForm.username,
          password: registerForm.password,
          register_type: registerType.value  // 后端期望 register_type
        }

        // 根据注册方式添加相应字段
        if (registerType.value === 'email') {
          registerData.email = registerForm.email
          registerData.code = registerForm.emailCode  // 后端期望 code 字段
        } else {
          registerData.phone = registerForm.phone
          registerData.code = registerForm.phoneCode  // 后端期望 code 字段
        }

        // 调用后端注册接口
        const response = await authApi.register(registerData)
        
        if (response.success) {
          ElMessage.success('注册成功！即将跳转到登录页面...')
          
          // 跳转到登录页
          setTimeout(() => {
            router.push('/login')
          }, 1500)
        } else {
          ElMessage.error(response.message || '注册失败')
        }
      } catch (error) {
        console.error('注册错误:', error)
        ElMessage.error(error.response?.data?.message || '注册失败，请检查网络连接')
      } finally {
        loading.value = false
      }
    } else {
      ElMessage.error('请正确填写表单')
      return false
    }
  })
}

// 跳转到登录页面
const goToLogin = () => {
  router.push('/login')
}
</script>

<style scoped>
.register-container {
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

/* 注册卡片 */
.register-card {
  position: relative;
  z-index: 10;
  width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 50px 40px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
}

.register-card :deep(.el-card__body) {
  padding: 0;
}

/* 滚动条样式 */
.register-card::-webkit-scrollbar {
  width: 6px;
}

.register-card::-webkit-scrollbar-thumb {
  background: rgba(102, 126, 234, 0.3);
  border-radius: 3px;
}

.register-card::-webkit-scrollbar-thumb:hover {
  background: rgba(102, 126, 234, 0.5);
}

/* Logo 和标题区域 */
.register-header {
  text-align: center;
  margin-bottom: 30px;
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

/* 注册方式切换 */
.register-type-switch {
  margin-bottom: 30px;
}

.register-type-switch :deep(.el-segmented__item) {
  padding: 10px 20px;
  font-size: 14px;
}

/* 注册表单 */
.register-form {
  margin-top: 30px;
}

.register-form :deep(.el-input__wrapper) {
  border-radius: 10px;
  padding: 12px 15px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.register-form :deep(.el-input__inner) {
  font-size: 15px;
}

/* 验证码输入 */
.code-input-wrapper {
  display: flex;
  gap: 10px;
}

.code-input-wrapper .el-input {
  flex: 1;
}

.send-code-btn {
  width: 140px;
  border-radius: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  white-space: nowrap;
}

.send-code-btn:disabled {
  background: #c0c4cc;
}

/* 用户协议 */
.register-form :deep(.el-checkbox__label) {
  font-size: 13px;
  color: #606266;
}

/* 注册按钮 */
.register-button {
  width: 100%;
  height: 50px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  transition: all 0.3s ease;
}

.register-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

.register-button:active {
  transform: translateY(0);
}

/* 登录链接 */
.login-link {
  text-align: center;
  font-size: 14px;
  color: #606266;
  margin-top: 20px;
}

.login-link :deep(.el-link) {
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
  .register-card {
    width: 90%;
    padding: 40px 30px;
  }

  .system-title {
    font-size: 24px;
  }

  .code-input-wrapper {
    flex-direction: column;
  }

  .send-code-btn {
    width: 100%;
  }
}
</style>

