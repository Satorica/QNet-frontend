import { ElMessage, ElNotification } from 'element-plus'
import { authApi } from '../api/auth.js'

// Token 现在存储在 HttpOnly Cookie 中，由浏览器自动管理；
// tokenManager 只保留用于 UI 状态同步的轻量接口。
export const tokenManager = {
    // 验证 token 有效性（Cookie 由浏览器自动携带，无需手动传递）
    verifyToken: async () => {
        try {
            const response = await authApi.verifyToken()
            if (response.success && response.data?.user) {
                const remember = localStorage.getItem('rememberMe') === 'true'
                userManager.setUserInfo(response.data.user, remember)
            }
            return response.success
        } catch (error) {
            console.error('Token验证失败:', error)
            return false
        }
    },

    // 清理本地用户信息缓存（非敏感数据）
    // 实际 Cookie 由后端通过 Set-Cookie: Max-Age=0 清除
    clearTokens: () => {
        sessionStorage.removeItem('userInfo')
        sessionStorage.removeItem('isLoggedIn')
        localStorage.removeItem('userInfo')
        localStorage.removeItem('isLoggedIn')
        localStorage.removeItem('rememberMe')
    },
}

// 用户状态管理（仅缓存非敏感的用户展示信息）
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

    // 检查是否已登录（乐观判断：依据本地缓存标志，实际权鉴由 Cookie + 后端保证）
    isLoggedIn: () => {
        return (
            sessionStorage.getItem('isLoggedIn') === 'true' ||
            localStorage.getItem('isLoggedIn') === 'true'
        )
    },

    // 清除用户信息
    clearUserInfo: () => {
        sessionStorage.removeItem('userInfo')
        sessionStorage.removeItem('isLoggedIn')
        localStorage.removeItem('userInfo')
        localStorage.removeItem('isLoggedIn')
    },

    // 登出：通知后端清除 Cookie，再清本地缓存
    logout: async () => {
        try {
            await authApi.logout()
        } catch (error) {
            console.error('登出请求失败:', error)
        }
        tokenManager.clearTokens()
    }
}

// 验证码通知管理
export const notificationManager = {
    // 显示验证码通知
    showCodeNotification: (type, code) => {
        const message = type === 'email'
            ? `邮箱验证码: ${code}`
            : `手机验证码: ${code}`

        ElNotification({
            title: '验证码',
            message,
            type: 'info',
            duration: 10000,
            showClose: true,
            position: 'top-right'
        })
    },

    // 显示成功通知
    showSuccessNotification: (message) => {
        ElMessage.success(message)
    },

    // 显示错误通知
    showErrorNotification: (message) => {
        ElMessage.error(message)
    }
}
