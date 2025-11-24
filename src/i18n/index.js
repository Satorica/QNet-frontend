import { createI18n } from 'vue-i18n'
import zhCN from './zh.json'
import enUS from './en.json'

// 从localStorage获取保存的语言设置，默认为中文
const getDefaultLocale = () => {
    try {
        const settings = localStorage.getItem('quantumSolverSettings')
        if (settings) {
            const parsed = JSON.parse(settings)
            return parsed.language || 'zh-CN'
        }
    } catch (error) {
        console.error('Failed to load language setting:', error)
    }
    return 'zh-CN'
}

const i18n = createI18n({
    legacy: false, // 使用 Composition API 模式
    locale: getDefaultLocale(),
    fallbackLocale: 'zh-CN',
    messages: {
        'zh-CN': zhCN,
        'en-US': enUS
    }
})

export default i18n

