import { userManager } from "../utils/auth.js";

// 路由守卫配置
export const setupRouterGuards = (router) => {
  // 全局前置守卫
  router.beforeEach((to, from, next) => {
    // 检查是否需要认证的页面
    const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);

    // 如果页面需要认证
    if (requiresAuth) {
      // 检查是否已登录
      if (!userManager.isLoggedIn()) {
        // 未登录，跳转到登录页
        next({
          path: "/login",
          query: { redirect: to.fullPath },
        });
        return;
      }
    }

    // 如果已登录用户访问登录/注册页面，重定向到主页
    if (
      (to.path === "/login" ||
        to.path === "/register" ||
        to.path === "/forgot-password") &&
      userManager.isLoggedIn()
    ) {
      next("/maxcut");
      return;
    }

    next();
  });
};
