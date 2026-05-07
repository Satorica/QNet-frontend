import { cloudApi } from "./index.js";

// 用户认证相关API
// Token 由 HttpOnly Cookie 承载，所有接口不再手动传递 Authorization header
export const authApi = {
  // 用户登录（remember 传给后端，决定 Cookie 是否持久化）
  login: async (account, password, remember = false) => {
    const response = await cloudApi.post("/auth/login", {
      account,
      password,
      remember,
    });
    return response.data;
  },

  // 用户注册
  register: async (userData) => {
    const response = await cloudApi.post("/auth/register", userData);
    return response.data;
  },

  // 发送邮箱验证码
  sendEmailCode: async (email, scene = "register") => {
    const response = await cloudApi.post("/auth/send-email-code", {
      email,
      scene,
    });
    return response.data;
  },

  // 验证重置码
  verifyResetCode: async (email, code) => {
    const response = await cloudApi.post("/auth/verify-reset-code", {
      email,
      code,
    });
    return response.data;
  },

  // 重置密码
  resetPassword: async (resetToken, newPassword) => {
    const response = await cloudApi.post("/auth/reset-password", {
      resetToken,
      newPassword,
    });
    return response.data;
  },

  // 验证 token 有效性（Cookie 由浏览器自动携带）
  verifyToken: async () => {
    const response = await cloudApi.get("/auth/verify");
    return response.data;
  },

  // 续期 token（Cookie 由浏览器自动携带，后端签发新 token 并更新 Cookie）
  refreshToken: async () => {
    const response = await cloudApi.post("/auth/refresh", {});
    return response.data;
  },

  // 用户登出（后端清除 Cookie）
  logout: async () => {
    const response = await cloudApi.post("/auth/logout", {});
    return response.data;
  },
};
