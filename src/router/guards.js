import { tokenManager, userManager } from '../utils/auth.js'

// 路由守卫配置
export const setupRouterGuards = (router) => {
  // 全局前置守卫
  router.beforeEach((to, from, next) => {
    // 检查是否需要认证的页面
    const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
    
    // 如果页面需要认证
    if (requiresAuth) {
      // 检查是否已登录
      if (!userManager.isLoggedIn()) {
        // 未登录，跳转到登录页
        console.log('用户未登录，跳转到登录页')
        next({
          path: '/login',
          query: { redirect: to.fullPath }
        })
        return
      }
      
      console.log('用户已登录，允许访问:', to.path)
    }

    // 如果已登录用户访问登录/注册页面，重定向到主页
    if ((to.path === '/login' || to.path === '/register') && userManager.isLoggedIn()) {
      console.log('已登录用户访问登录页，重定向到主页')
      next('/maxcut')
      return
    }

    next()
  })

  // 全局后置钩子
  router.afterEach((to, from) => {
    // 可以在这里添加页面访问统计等逻辑
    console.log(`路由跳转: ${from.path} -> ${to.path}`)
  })
}
