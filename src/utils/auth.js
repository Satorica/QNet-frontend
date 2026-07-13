import { ElMessage, ElNotification } from 'element-plus'
import { authApi } from '../api/auth.js'

const USER_INFO_STORAGE_KEY = 'userInfo'
const LOGIN_STATE_STORAGE_KEY = 'isLoggedIn'
const REMEMBER_ME_STORAGE_KEY = 'rememberMe'

const toSafeUserInfo = (userInfo = {}) => ({
    id: userInfo.id,
    username: userInfo.username,
    maskedEmail: userInfo.maskedEmail,
    maskedPhone: userInfo.maskedPhone,
    is_verified: userInfo.is_verified,
    status: userInfo.status,
})

const removeAuthState = (storage) => {
    storage.removeItem(USER_INFO_STORAGE_KEY)
    storage.removeItem(LOGIN_STATE_STORAGE_KEY)
}

const readStoredUserInfo = (storage) => {
    const raw = storage.getItem(USER_INFO_STORAGE_KEY)
    if (!raw) return null

    try {
        return JSON.parse(raw)
    } catch {
        storage.removeItem(USER_INFO_STORAGE_KEY)
        return null
    }
}

export const tokenManager = {
    verifyToken: async () => {
        try {
            const response = await authApi.verifyToken()
            if (response.success && response.data?.user) {
                const remember = localStorage.getItem(REMEMBER_ME_STORAGE_KEY) === 'true'
                userManager.setUserInfo(response.data.user, remember)
                return true
            }
            tokenManager.clearTokens()
            return false
        } catch (error) {
            if ([401, 403].includes(error.response?.status)) {
                tokenManager.clearTokens()
            } else {
                console.error('Token verification failed:', error)
            }
            return false
        }
    },

    clearTokens: () => {
        removeAuthState(sessionStorage)
        removeAuthState(localStorage)
        localStorage.removeItem(REMEMBER_ME_STORAGE_KEY)
    },
}

export const userManager = {
    setUserInfo: (userInfo, remember = false) => {
        const storage = remember ? localStorage : sessionStorage
        const safeUserInfo = toSafeUserInfo(userInfo)

        removeAuthState(sessionStorage)
        removeAuthState(localStorage)
        storage.setItem(USER_INFO_STORAGE_KEY, JSON.stringify(safeUserInfo))
        storage.setItem(LOGIN_STATE_STORAGE_KEY, 'true')
    },

    getUserInfo: () => {
        const storage = sessionStorage.getItem(USER_INFO_STORAGE_KEY)
            ? sessionStorage
            : localStorage
        const userInfo = readStoredUserInfo(storage)
        if (!userInfo) return null

        const safeUserInfo = toSafeUserInfo(userInfo)
        if (JSON.stringify(userInfo) !== JSON.stringify(safeUserInfo)) {
            storage.setItem(USER_INFO_STORAGE_KEY, JSON.stringify(safeUserInfo))
        }
        return safeUserInfo
    },

    isLoggedIn: () => (
        sessionStorage.getItem(LOGIN_STATE_STORAGE_KEY) === 'true' ||
        localStorage.getItem(LOGIN_STATE_STORAGE_KEY) === 'true'
    ),

    clearUserInfo: () => {
        removeAuthState(sessionStorage)
        removeAuthState(localStorage)
    },

    logout: async () => {
        try {
            await authApi.logout()
        } catch (error) {
            console.error('Logout request failed:', error)
        }
        tokenManager.clearTokens()
    }
}

export const notificationManager = {
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

    showSuccessNotification: (message) => {
        ElMessage.success(message)
    },

    showErrorNotification: (message) => {
        ElMessage.error(message)
    }
}
