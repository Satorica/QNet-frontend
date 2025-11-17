import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import routes from './router/index.js'
import { setupRouterGuards } from './router/guards.js'

const app = createApp(App)

// 配置路由
const router = createRouter({
  history: createWebHistory(),
  routes
})

// 设置路由守卫
setupRouterGuards(router)

// 注册Element Plus图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 使用插件
app.use(router)
app.use(ElementPlus, {
  locale: zhCn,
})

// 将Element Plus组件挂载到全局，供工具函数使用
app.config.globalProperties.$message = ElementPlus.ElMessage
app.config.globalProperties.$notification = ElementPlus.ElNotification

// 将Element Plus组件挂载到window对象，供工具函数使用
window.ElMessage = ElementPlus.ElMessage
window.ElNotification = ElementPlus.ElNotification

app.mount('#app')

// HMR trigger: ensure latest file with mount is served 