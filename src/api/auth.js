import { cloudApi, localApi } from './index.js'

// 用户认证相关API
export const authApi = {
  // 用户登录
  login: async (account, password) => {
    try {
      const response = await cloudApi.post('/auth/login', {
        account,
        password
      })
      return response.data
    } catch (error) {
      // 如果云服务器失败，尝试本地服务器
      try {
        const response = await localApi.post('/auth/login', {
          account,
          password
        })
        return response.data
      } catch (localError) {
        throw error
      }
    }
  },

  // 用户注册
  register: async (userData) => {
    try {
      const response = await cloudApi.post('/auth/register', userData)
      return response.data
    } catch (error) {
      // 如果云服务器失败，尝试本地服务器
      try {
        const response = await localApi.post('/auth/register', userData)
        return response.data
      } catch (localError) {
        throw error
      }
    }
  },

  // 发送邮箱验证码
  sendEmailCode: async (email) => {
    try {
      const response = await cloudApi.post('/auth/send-email-code', { email })
      return response.data
    } catch (error) {
      try {
        const response = await localApi.post('/auth/send-email-code', { email })
        return response.data
      } catch (localError) {
        throw error
      }
    }
  },

  // 发送手机验证码
  sendPhoneCode: async (phone) => {
    try {
      const response = await cloudApi.post('/auth/send-phone-code', { phone })
      return response.data
    } catch (error) {
      try {
        const response = await localApi.post('/auth/send-phone-code', { phone })
        return response.data
      } catch (localError) {
        throw error
      }
    }
  },

  // 验证token
  verifyToken: async (token) => {
    try {
      const response = await cloudApi.get('/auth/verify', {
        headers: { Authorization: `Bearer ${token}` }
      })
      return response.data
    } catch (error) {
      try {
        const response = await localApi.get('/auth/verify', {
          headers: { Authorization: `Bearer ${token}` }
        })
        return response.data
      } catch (localError) {
        throw error
      }
    }
  },

  // 刷新token
  refreshToken: async (refreshToken) => {
    try {
      const response = await cloudApi.post('/auth/refresh', { refreshToken })
      return response.data
    } catch (error) {
      try {
        const response = await localApi.post('/auth/refresh', { refreshToken })
        return response.data
      } catch (localError) {
        throw error
      }
    }
  },

  // 用户登出
  logout: async (token) => {
    try {
      const response = await cloudApi.post('/auth/logout', {}, {
        headers: { Authorization: `Bearer ${token}` }
      })
      return response.data
    } catch (error) {
      try {
        const response = await localApi.post('/auth/logout', {}, {
          headers: { Authorization: `Bearer ${token}` }
        })
        return response.data
      } catch (localError) {
        throw error
      }
    }
  }
}
