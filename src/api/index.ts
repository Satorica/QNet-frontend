import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import type {
  ApiResponse,
  CancelTaskResponse,
  DeleteTaskResponse,
  MatrixImportData,
  MatrixImportProblemType,
  QuotaData,
  TaskDeleteFilters,
  TaskHistoryData,
  TaskHistoryParams,
  TaskStatusResponse,
  TaskSubmitRequest,
  TaskSubmitResponse,
} from "../types/api";

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

interface RefreshSubscriber {
  resolve: () => void;
  reject: (reason?: unknown) => void;
}

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
const handleTokenExpired = (redirectToLogin = true) => {
  const keys = ["userInfo", "isLoggedIn"];
  keys.forEach((key) => {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  });
  localStorage.removeItem("rememberMe");

  if (
    redirectToLogin &&
    window.location.pathname !== "/login" &&
    window.location.pathname !== "/register" &&
    window.location.pathname !== "/forgot-password"
  ) {
    window.location.href = "/login";
  }
};

// ---- Token 自动刷新队列机制 ----
let isRefreshing = false;
let refreshSubscribers: RefreshSubscriber[] = [];

const subscribeTokenRefresh = (
  resolve: RefreshSubscriber["resolve"],
  reject: RefreshSubscriber["reject"],
) =>
  refreshSubscribers.push({ resolve, reject });
const onTokenRefreshed = () => {
  refreshSubscribers.forEach(({ resolve }) => resolve());
  refreshSubscribers = [];
};
const onRefreshFailed = (err: unknown) => {
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
  async (error: AxiosError<ApiResponse>) => {
    const message = error.response?.data?.message || error.message;
    error.message = message;

    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as RetriableRequestConfig | undefined;
    if (!originalRequest) return Promise.reject(error);

    // 认证类接口本身 401 不走刷新（避免死循环）
    if (originalRequest.url?.startsWith("/auth/")) {
      handleTokenExpired(originalRequest.url !== "/auth/verify");
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
      const refreshResponse = await axios.post<ApiResponse>(
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
export const submitTask = async (
  taskData: TaskSubmitRequest,
): Promise<TaskSubmitResponse> => {
  const response = await cloudApi.post<Omit<TaskSubmitResponse, "serverType" | "usePolling">>(
    "/api/submit-task",
    taskData,
  );
  return { ...response.data, serverType: "cloud", usePolling: true };
};

export const getProblemImportTemplate = async (
  problemType: MatrixImportProblemType,
): Promise<{ blob: Blob; filename: string }> => {
  const response = await cloudApi.get<Blob>(
    `/api/problem-imports/${problemType}/template`,
    { responseType: "blob" },
  );
  const disposition = String(response.headers["content-disposition"] || "");
  const encodedFilename = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plainFilename = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  const filename = encodedFilename
    ? decodeURIComponent(encodedFilename)
    : plainFilename || `${problemType}-template.csv`;
  return { blob: response.data, filename };
};

export const parseProblemImportFile = async (
  problemType: MatrixImportProblemType,
  file: File,
): Promise<MatrixImportData> => {
  const formData = new FormData();
  formData.append("file", file, file.name);
  const response = await cloudApi.post<ApiResponse<MatrixImportData>>(
    `/api/problem-imports/${problemType}`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  if (!response.data.data) {
    throw new Error(response.data.message || "导入响应缺少矩阵数据");
  }
  return response.data.data;
};

// 获取任务状态
export const getTaskStatus = async (taskId: string): Promise<TaskStatusResponse> => {
  const response = await cloudApi.get<TaskStatusResponse>(`/api/task-status/${taskId}`);
  return response.data;
};

// 取消任务
// 任务已是终态（completed/failed/cancelled）时后端返回 400，
// 此处捕获 4xx 业务拒绝并返回响应体，由调用方根据 success/taskStatus 统一处理；
// 5xx 服务器错误仍然 throw，让调用方以 error 级别提示。
export const cancelTask = async (taskId: string): Promise<CancelTaskResponse> => {
  try {
    const response = await cloudApi.post<CancelTaskResponse>(`/api/cancel-task/${taskId}`);
    return response.data;
  } catch (error: unknown) {
    if (!axios.isAxiosError<CancelTaskResponse>(error)) throw error;
    const status = error.response?.status ?? 0;
    const responseData = error.response?.data;
    if (status === 400 && responseData?.taskStatus) {
      return responseData;
    }
    throw error;
  }
};

// 查询任务名称是否重复
export const checkTaskName = async (taskName: string): Promise<ApiResponse> => {
  const response = await cloudApi.post<ApiResponse>("/api/tasks/check-name", { taskName });
  return response.data;
};

// 获取任务历史
export const getTaskHistory = async (
  params: TaskHistoryParams = {},
): Promise<ApiResponse<TaskHistoryData>> => {
  const {
    page = 1,
    pageSize = 10,
    taskName = "",
    modelType = null,
    problemType = null,
    status = null,
  } = params;

  const payload = {
    page,
    pageSize,
    ...(problemType ? { problemType } : {}),
    ...(taskName ? { taskName } : {}),
    ...(modelType ? { modelType } : {}),
    ...(status ? { status } : {}),
  };

  const response = await cloudApi.post<ApiResponse<TaskHistoryData>>("/api/tasks/history", payload);
  return response.data;
};

export const getTaskQuota = async (): Promise<ApiResponse<QuotaData>> => {
  const response = await cloudApi.get<ApiResponse<QuotaData>>("/api/tasks/quota");
  return response.data;
};

// 清理任务（管理员功能）
export const cleanupTasks = async (retentionDays = 30): Promise<ApiResponse> => {
  const response = await cloudApi.post<ApiResponse>("/api/tasks/cleanup", { retentionDays });
  return response.data;
};

export const deleteTask = async (taskId: string): Promise<DeleteTaskResponse> => {
  const response = await cloudApi.post<DeleteTaskResponse>("/api/tasks/delete", { taskId });
  return response.data;
};

const compactTaskFilterPayload = (params: TaskDeleteFilters = {}): TaskDeleteFilters =>
  Object.fromEntries(
    Object.entries(params)
      .map(([key, value]) => [
        key,
        typeof value === "string" ? value.trim() : value,
      ])
      .filter(([, value]) => value !== "" && value !== null && value !== undefined)
  ) as TaskDeleteFilters;

export const deleteTasksByFilter = async (
  params: TaskDeleteFilters = {},
): Promise<DeleteTaskResponse> => {
  const response = await cloudApi.post<DeleteTaskResponse>(
    "/api/tasks/delete-by-filter",
    compactTaskFilterPayload(params)
  );
  return response.data;
};

export { cloudApi };
export default cloudApi;
