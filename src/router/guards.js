import { tokenManager, userManager } from "../utils/auth.js";

const AUTH_PATHS = new Set(["/login", "/register", "/forgot-password"]);
let serverSessionVerified = false;
let verificationPromise = null;

const verifyServerSession = () => {
  if (serverSessionVerified && userManager.isLoggedIn()) {
    return Promise.resolve(true);
  }

  if (!verificationPromise) {
    verificationPromise = tokenManager
      .verifyToken()
      .then((isValid) => {
        serverSessionVerified = isValid;
        return isValid;
      })
      .finally(() => {
        verificationPromise = null;
      });
  }

  return verificationPromise;
};

// 路由守卫配置
export const setupRouterGuards = (router) => {
  // 全局前置守卫
  router.beforeEach(async (to) => {
    // 检查是否需要认证的页面
    const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);

    const isAuthPage = AUTH_PATHS.has(to.path);
    // 认证页也统一等待服务端会话校验，以恢复仅由 HttpOnly Cookie
    // 保存的登录态，并避免页面挂载后的后台校验与登录请求发生竞态。
    const shouldVerifySession = requiresAuth || isAuthPage;
    const isLoggedIn =
      shouldVerifySession
        ? await verifyServerSession()
        : false;

    if (requiresAuth && !isLoggedIn) {
      return {
        path: "/login",
        query: { redirect: to.fullPath },
      };
    }

    // 如果已登录用户访问登录/注册页面，重定向到主页
    if (
      isAuthPage &&
      isLoggedIn
    ) {
      return "/maxcut";
    }

    return true;
  });
};
