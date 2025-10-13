import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import routes from './router/index.js'

const app = createApp(App)

// 配置路由
const router = createRouter({
  history: createWebHistory(),
  routes
})
// 注册Element Plus图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// 使用插件
app.use(router)
app.use(ElementPlus, {
  locale: zhCn,
})

app.mount('#app')

// HMR trigger: ensure latest file with mount is served 