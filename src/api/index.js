import axios from "axios";

const isDev = import.meta.env.DEV;
const prodApiBaseURL = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/+$/,
  "",
);
const runtimeBaseURL = isDev ? "" : prodApiBaseURL;

// 创建云服务器 axios 实例
// withCredentials: true — 确保跨域请求时浏览器携带 HttpOnly Cookie
const cloudApi = axios.create({
  baseURL: runtimeBaseURL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// 清理本地用户信息并跳转登录页
// Token 存储在 HttpOnly Cookie 中，由后端通过 Set-Cookie 清除；
// 前端只清理非敏感的用户信息缓存。
const handleTokenExpired = () => {
  const keys = ["userInfo", "isLoggedIn"];
  keys.forEach((key) => {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  });
  localStorage.removeItem("rememberMe");

  if (
    window.location.pathname !== "/login" &&
    window.location.pathname !== "/register" &&
    window.location.pathname !== "/forgot-password"
  ) {
    window.location.href = "/login";
  }
};

// ---- Token 自动刷新队列机制 ----
let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (resolve, reject) =>
  refreshSubscribers.push({ resolve, reject });
const onTokenRefreshed = () => {
  refreshSubscribers.forEach(({ resolve }) => resolve());
  refreshSubscribers = [];
};
const onRefreshFailed = (err) => {
  refreshSubscribers.forEach(({ reject }) => reject(err));
  refreshSubscribers = [];
};

// 请求拦截器：token 由 Cookie 自动携带，无需手动注入 Authorization header
cloudApi.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error),
);

// 响应拦截器
cloudApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const message = error.response?.data?.message || error.message;
    error.message = message;

    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const originalRequest = error.config;

    // 认证类接口本身 401 不走刷新（避免死循环）
    if (originalRequest.url?.startsWith("/auth/")) {
      handleTokenExpired();
      return Promise.reject(error);
    }

    // 已经重试过仍 401，刷新也无效
    if (originalRequest._retry) {
      handleTokenExpired();
      return Promise.reject(error);
    }

    // 刷新进行中：将请求加入队列，等刷新完成后重试
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh(
          () => resolve(cloudApi(originalRequest)),
          reject,
        );
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // 直接使用原生 axios 发请求，绕过本实例拦截器；
      // Cookie 由浏览器自动携带，无需在请求体中传递 token。
      const refreshResponse = await axios.post(
        `${runtimeBaseURL}/auth/refresh`,
        {},
        {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
        },
      );

      if (refreshResponse.data?.success) {
        // 新 Cookie 已由后端通过 Set-Cookie 写入，前端无需操作
        onTokenRefreshed();
        isRefreshing = false;
        return cloudApi(originalRequest);
      } else {
        isRefreshing = false;
        onRefreshFailed(error);
        handleTokenExpired();
        return Promise.reject(error);
      }
    } catch (refreshError) {
      isRefreshing = false;
      onRefreshFailed(refreshError);
      handleTokenExpired();
      return Promise.reject(refreshError);
    }
  },
);

// 检查服务器状态，返回布尔值
export const checkServerStatus = async () => {
  try {
    const response = await cloudApi.get("/api/server-status");
    return response.data.success === true;
  } catch {
    return false;
  }
};

// 提交任务
export const submitTask = async (taskData) => {
  const response = await cloudApi.post("/api/submit-task", taskData);
  return { ...response.data, serverType: "cloud", usePolling: true };
};

// 获取任务状态
export const getTaskStatus = async (taskId) => {
  const response = await cloudApi.get(`/api/task-status/${taskId}`);
  return response.data;
};

// 取消任务
// 任务已是终态（completed/failed/cancelled）时后端返回 400，
// 此处捕获 4xx 业务拒绝并返回响应体，由调用方根据 success/taskStatus 统一处理；
// 5xx 服务器错误仍然 throw，让调用方以 error 级别提示。
export const cancelTask = async (taskId) => {
  try {
    const response = await cloudApi.post(`/api/cancel-task/${taskId}`);
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    if (status >= 400 && status < 500 && error.response?.data) {
      return error.response.data;
    }
    throw error;
  }
};

// 查询任务名称是否重复
export const checkTaskName = async (taskName) => {
  const response = await cloudApi.post("/api/tasks/check-name", { taskName });
  return response.data;
};

// 获取任务历史
export const getTaskHistory = async (params = {}) => {
  const {
    page = 1,
    pageSize = 10,
    taskName = "",
    modelType = null,
    problemType = null,
  } = params;

  const payload = {
    page,
    pageSize,
    ...(problemType ? { problemType } : {}),
    ...(taskName ? { taskName } : {}),
    ...(modelType ? { modelType } : {}),
  };

  const response = await cloudApi.post("/api/tasks/history", payload);
  return response.data;
};

export const getTaskQuota = async () => {
  const response = await cloudApi.get("/api/tasks/quota");
  return response.data;
};

// 清理任务（管理员功能）
export const cleanupTasks = async (retentionDays = 30) => {
  const response = await cloudApi.post("/api/tasks/cleanup", { retentionDays });
  return response.data;
};

export const deleteTask = async (taskId) => {
  const response = await cloudApi.post("/api/tasks/delete", { taskId });
  return response.data;
};

export const deleteTasksByFilter = async (params = {}) => {
  const response = await cloudApi.post("/api/tasks/delete-by-filter", params);
  return response.data;
};

export { cloudApi };
export default cloudApi;
