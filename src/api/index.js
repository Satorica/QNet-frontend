import axios from "axios";

const isDev = import.meta.env.DEV;
const prodApiBaseURL = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/+$/,
  "",
);
const runtimeBaseURL = isDev ? "" : prodApiBaseURL;

// 创建云服务器 axios 实例
const cloudApi = axios.create({
  baseURL: runtimeBaseURL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 统一读取 token（支持 sessionStorage 与 localStorage）
const getStoredToken = () => {
  return (
    sessionStorage.getItem("accessToken") || localStorage.getItem("accessToken")
  );
};

// 请求拦截器
cloudApi.interceptors.request.use(
  (config) => {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// 响应拦截器
cloudApi.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const message = error.response?.data?.message || error.message;

    // 用后端返回的业务信息覆盖 axios 默认错误描述
    error.message = message;

    if (error.response?.status === 401) {
      handleTokenExpired();
    }

    return Promise.reject(error);
  },
);

// 401 时须同时清 session/localStorage（未勾选「记住我」时 token 在 sessionStorage）
const handleTokenExpired = () => {
  sessionStorage.removeItem("accessToken");
  sessionStorage.removeItem("refreshToken");
  sessionStorage.removeItem("userInfo");
  sessionStorage.removeItem("isLoggedIn");

  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("userInfo");
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("rememberMe");

  if (
    window.location.pathname !== "/login" &&
    window.location.pathname !== "/register" &&
    window.location.pathname !== "/forgot-password"
  ) {
    window.location.href = "/login";
  }
};

// 检查服务器状态，返回布尔值
export const checkServerStatus = async () => {
  try {
    const response = await cloudApi.get("/api/server-status");
    return response.data.success === true;
  } catch (error) {
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
export const cancelTask = async (taskId) => {
  const response = await cloudApi.post(`/api/cancel-task/${taskId}`);
  return response.data;
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

export const deleteAllTasks = async (problemType = null) => {
  const payload = problemType ? { problemType } : {};
  const response = await cloudApi.post("/api/tasks/delete-all", payload);
  return response.data;
};

export { cloudApi };
export default cloudApi;
