import { authApi } from '../api/auth.js'

// 获取存储对象（根据是否记住登录状态）
const getStorage = () => {
    // 检查是否选择了"记住我"
    const rememberMe = localStorage.getItem('rememberMe') === 'true'
    return rememberMe ? localStorage : sessionStorage
}

// Token管理
export const tokenManager = {
    // 存储token
    setToken: (accessToken, refreshToken, remember = false) => {
        // 如果选择记住，使用localStorage，否则使用sessionStorage
        const storage = remember ? localStorage : sessionStorage
        storage.setItem('accessToken', accessToken)
        if (refreshToken) {
            storage.setItem('refreshToken', refreshToken)
        }
        // 记录是否选择了"记住我"
        if (remember) {
            localStorage.setItem('rememberMe', 'true')
        } else {
            localStorage.removeItem('rememberMe')
        }
    },

    // 获取access token
    getAccessToken: () => {
        return sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken')
    },

    // 获取refresh token
    getRefreshToken: () => {
        return sessionStorage.getItem('refreshToken') || localStorage.getItem('refreshToken')
    },

    // 清除所有token
    clearTokens: () => {
        // 清除sessionStorage
        sessionStorage.removeItem('accessToken')
        sessionStorage.removeItem('refreshToken')
        sessionStorage.removeItem('userInfo')
        sessionStorage.removeItem('isLoggedIn')
        
        // 清除localStorage
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('userInfo')
        localStorage.removeItem('isLoggedIn')
        localStorage.removeItem('rememberMe')
    },

    // 检查token是否存在
    hasToken: () => {
        return !!(sessionStorage.getItem('accessToken') || localStorage.getItem('accessToken'))
    },

    // 验证token有效性
    verifyToken: async () => {
        const token = tokenManager.getAccessToken()
        if (!token) return false

        try {
            const response = await authApi.verifyToken(token)
            return response.success
        } catch (error) {
            console.error('Token验证失败:', error)
            return false
        }
    },

    // 刷新token
    refreshToken: async () => {
        const refreshToken = tokenManager.getRefreshToken()
        if (!refreshToken) return false

        try {
            const response = await authApi.refreshToken(refreshToken)
            if (response.success) {
                tokenManager.setToken(response.data.accessToken, response.data.refreshToken)
                return true
            }
            return false
        } catch (error) {
            console.error('Token刷新失败:', error)
            tokenManager.clearTokens()
            return false
        }
    }
}

// 用户状态管理
export const userManager = {
    // 设置用户信息
    setUserInfo: (userInfo, remember = false) => {
        const storage = remember ? localStorage : sessionStorage
        storage.setItem('userInfo', JSON.stringify(userInfo))
        storage.setItem('isLoggedIn', 'true')
    },

    // 获取用户信息
    getUserInfo: () => {
        const userInfo = sessionStorage.getItem('userInfo') || localStorage.getItem('userInfo')
        return userInfo ? JSON.parse(userInfo) : null
    },

    // 检查是否已登录
    isLoggedIn: () => {
        const hasSession = sessionStorage.getItem('isLoggedIn') === 'true'
        const hasLocal = localStorage.getItem('isLoggedIn') === 'true'
        return (hasSession || hasLocal) && tokenManager.hasToken()
    },

    // 清除用户信息
    clearUserInfo: () => {
        sessionStorage.removeItem('userInfo')
        sessionStorage.removeItem('isLoggedIn')
        localStorage.removeItem('userInfo')
        localStorage.removeItem('isLoggedIn')
    },

    // 登出
    logout: async () => {
        const token = tokenManager.getAccessToken()
        if (token) {
            try {
                await authApi.logout(token)
            } catch (error) {
                console.error('登出请求失败:', error)
            }
        }
        tokenManager.clearTokens()
        userManager.clearUserInfo()
    }
}

// 验证码通知管理
export const notificationManager = {
    // 显示验证码通知
    showCodeNotification: (type, code) => {
        const message = type === 'email'
            ? `邮箱验证码: ${code}`
            : `手机验证码: ${code}`

        // 使用Element Plus的通知组件
        if (window.ElNotification) {
            window.ElNotification({
                title: '验证码',
                message: message,
                type: 'info',
                duration: 10000,
                showClose: true,
                position: 'top-right'
            })
        } else {
            // 降级到alert
            alert(message)
        }
    },

    // 显示成功通知
    showSuccessNotification: (message) => {
        if (window.ElMessage) {
            window.ElMessage.success(message)
        } else {
            alert(message)
        }
    },

    // 显示错误通知
    showErrorNotification: (message) => {
        if (window.ElMessage) {
            window.ElMessage.error(message)
        } else {
            alert(message)
        }
    }
}
