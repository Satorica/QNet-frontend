import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

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

// 使用插件（图标由各组件按需 import，unplugin-vue-components 负责模板内自动导入）
app.use(router)
app.use(ElementPlus, {
  locale: zhCn,
})

app.mount('#app')

// HMR trigger: ensure latest file with mount is served 