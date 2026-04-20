import { cloudApi } from "./index.js";

// 用户认证相关API
export const authApi = {
  // 用户登录
  login: async (account, password) => {
    try {
      const response = await cloudApi.post("/auth/login", {
        account,
        password,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 用户注册
  register: async (userData) => {
    try {
      const response = await cloudApi.post("/auth/register", userData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 发送邮箱验证码
  sendEmailCode: async (email, scene = "register") => {
    try {
      const response = await cloudApi.post("/auth/send-email-code", {
        email,
        scene,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 发送手机验证码（手机号注册暂未启用）
  // sendPhoneCode: async (phone) => {
  //   try {
  //     const response = await cloudApi.post("/auth/send-phone-code", { phone });
  //     return response.data;
  //   } catch (error) {
  //     throw error;
  //   }
  // },

  verifyResetCode: async (email, code) => {
    try {
      const response = await cloudApi.post("/auth/verify-reset-code", {
        email,
        code,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  resetPassword: async (resetToken, newPassword) => {
    try {
      const response = await cloudApi.post("/auth/reset-password", {
        resetToken,
        newPassword,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 验证token
  verifyToken: async (token) => {
    try {
      const response = await cloudApi.get("/auth/verify", {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 刷新token
  refreshToken: async (refreshToken) => {
    try {
      const response = await cloudApi.post("/auth/refresh", { refreshToken });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // 用户登出
  logout: async (token) => {
    try {
      const response = await cloudApi.post(
        "/auth/logout",
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};
