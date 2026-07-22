import {
  serverSessionManager,
  tokenManager,
  userManager,
} from "../utils/auth";
import type { Router } from "vue-router";

const AUTH_PATHS = new Set(["/login", "/register", "/forgot-password"]);
let verificationPromise: Promise<boolean> | null = null;

const verifyServerSession = () => {
  const sessionStatus = serverSessionManager.getStatus();

  if (sessionStatus === "authenticated" && userManager.isLoggedIn()) {
    return Promise.resolve(true);
  }

  if (!verificationPromise) {
    verificationPromise = tokenManager
      .verifyToken()
      .finally(() => {
        verificationPromise = null;
      });
  }

  return verificationPromise;
};

// 路由守卫配置
export const setupRouterGuards = (router: Router): void => {
  // 全局前置守卫
  router.beforeEach(async (to) => {
    // 检查是否需要认证的页面
    const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);

    const isAuthPage = AUTH_PATHS.has(to.path);
    // 服务端确认登出后只跳过紧随其后的那一次认证页校验，避免产生预期的 401。
    // 标记消费后恢复正常校验，因此不会阻止其他标签页登录后的会话恢复。
    const skipServerSessionVerification =
      isAuthPage && serverSessionManager.consumeAuthPageVerificationSkip();
    // 认证页也统一等待服务端会话校验，以恢复仅由 HttpOnly Cookie
    // 保存的登录态，并避免页面挂载后的后台校验与登录请求发生竞态。
    const shouldVerifySession = requiresAuth || isAuthPage;
    const isLoggedIn =
      shouldVerifySession && !skipServerSessionVerification
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
