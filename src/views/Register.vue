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
          <h1 class="system-title">{{ $t('register.title') }}</h1>
        </div>
        <p class="subtitle">{{ $t('register.subtitle') }}</p>
      </div>

      <!-- 注册方式切换 -->
      <el-segmented v-model="registerType" :options="translatedRegisterOptions" block size="large" class="register-type-switch" />

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
            :placeholder="$t('register.username')"
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
              :placeholder="$t('register.email')"
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
                :placeholder="$t('register.emailCode')"
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
              :placeholder="$t('register.phone')"
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
                :placeholder="$t('register.phoneCode')"
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
            :placeholder="$t('register.password')"
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
            :placeholder="$t('register.confirmPassword')"
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
            {{ $t('register.agree') }}
            <el-link type="primary" :underline="false">{{ $t('register.userAgreement') }}</el-link>
            {{ $t('register.and') }}
            <el-link type="primary" :underline="false">{{ $t('register.privacyPolicy') }}</el-link>
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
            {{ $t('register.registerButton') }}
          </el-button>
        </el-form-item>

        <!-- 登录链接 -->
        <div class="login-link">
          {{ $t('register.hasAccount') }}
          <el-link type="primary" :underline="false" @click="goToLogin">
            {{ $t('register.login') }}
          </el-link>
        </div>
      </el-form>
    </el-card>

    <!-- 版权信息 -->
    <div class="footer-info">
      <p>{{ $t('register.footer') }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Message, Phone, Lock, Key } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { authApi } from '../api/auth.js'
import { tokenManager, userManager, notificationManager } from '../utils/auth.js'

const router = useRouter()
const { t } = useI18n()
const registerFormRef = ref(null)
const loading = ref(false)

// 注册方式
const registerType = ref('email')
const translatedRegisterOptions = computed(() => [
  { label: t('register.type.email'), value: 'email' },
  { label: t('register.type.phone'), value: 'phone' }
])

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
  return emailCodeCountdown.value > 0 
    ? `${emailCodeCountdown.value}${t('register.resendCode')}` 
    : t('register.sendCode')
})

// 手机验证码相关
const phoneCodeDisabled = ref(false)
const phoneCodeCountdown = ref(0)
const phoneCodeText = computed(() => {
  return phoneCodeCountdown.value > 0 
    ? `${phoneCodeCountdown.value}${t('register.resendCode')}` 
    : t('register.sendCode')
})

// 表单验证规则
const validateUsername = (rule, value, callback) => {
  if (!value) {
    callback(new Error(t('register.validation.usernameRequired')))
  } else if (!/^[a-zA-Z0-9_]{3,20}$/.test(value)) {
    callback(new Error(t('register.validation.usernameFormat')))
  } else {
    callback()
  }
}

const validateEmail = (rule, value, callback) => {
  if (registerType.value === 'email') {
    if (!value) {
      callback(new Error(t('register.validation.emailRequired')))
    } else if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/.test(value)) {
      callback(new Error(t('register.validation.emailFormat')))
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
      callback(new Error(t('register.validation.phoneRequired')))
    } else if (!/^1[3-9]\d{9}$/.test(value)) {
      callback(new Error(t('register.validation.phoneFormat')))
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
    callback(new Error(t('register.validation.codeRequired')))
  } else {
    callback()
  }
}

const validateConfirmPassword = (rule, value, callback) => {
  if (!value) {
    callback(new Error(t('register.validation.confirmRequired')))
  } else if (value !== registerForm.password) {
    callback(new Error(t('register.validation.passwordMismatch')))
  } else {
    callback()
  }
}

const validateAgree = (rule, value, callback) => {
  if (!value) {
    callback(new Error(t('register.validation.agreeRequired')))
  } else {
    callback()
  }
}

const registerRules = computed(() => ({
  username: [{ validator: validateUsername, trigger: 'blur' }],
  email: [{ validator: validateEmail, trigger: 'blur' }],
  emailCode: [{ validator: validateCode, trigger: 'blur' }],
  phone: [{ validator: validatePhone, trigger: 'blur' }],
  phoneCode: [{ validator: validateCode, trigger: 'blur' }],
  password: [
    { required: true, message: t('register.validation.passwordRequired'), trigger: 'blur' },
    { min: 6, message: t('register.validation.passwordLength'), trigger: 'blur' }
  ],
  confirmPassword: [{ validator: validateConfirmPassword, trigger: 'blur' }],
  agree: [{ validator: validateAgree, trigger: 'change' }]
}))

// 发送邮箱验证码
const sendEmailCode = async () => {
  if (!registerForm.email) {
    ElMessage.warning(t('register.messages.enterEmail'))
    return
  }
  if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/.test(registerForm.email)) {
    ElMessage.warning(t('register.messages.invalidEmail'))
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
      ElMessage.success(t('register.messages.codeSent'))
      
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
      ElMessage.error(response.message || t('register.messages.codeFailed'))
    }
  } catch (error) {
    console.error('Send email code error:', error)
    ElMessage.error(t('register.messages.codeFailed'))
  }
}

// 发送手机验证码
const sendPhoneCode = async () => {
  if (!registerForm.phone) {
    ElMessage.warning(t('register.messages.enterPhone'))
    return
  }
  if (!/^1[3-9]\d{9}$/.test(registerForm.phone)) {
    ElMessage.warning(t('register.messages.invalidPhone'))
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
      
      ElMessage.success(t('register.messages.codeSent'))
      
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
      ElMessage.error(response.message || t('register.messages.codeFailed'))
    }
  } catch (error) {
    console.error('Send phone code error:', error)
    ElMessage.error(t('register.messages.codeFailed'))
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
          ElMessage.success(t('register.messages.success'))
          
          // 跳转到登录页
          setTimeout(() => {
            router.push('/login')
          }, 1500)
        } else {
          ElMessage.error(response.message || t('register.messages.failed'))
        }
      } catch (error) {
        console.error('Register error:', error)
        ElMessage.error(error.response?.data?.message || t('register.messages.networkError'))
      } finally {
        loading.value = false
      }
    } else {
      ElMessage.error(t('register.messages.formError'))
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

