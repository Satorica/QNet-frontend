import axios from "axios";
import type { ApiResponse } from "../types/api";

// Public statistics must not trigger session refresh, login redirects or toasts.
const api = axios.create({
  baseURL: import.meta.env.DEV ? "" : (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, ""),
  timeout: 8000,
  withCredentials: true,
});

function readTotal(response: ApiResponse<{ totalUsers: number }>): number {
  const total = response.data?.totalUsers;
  if (!response.success || typeof total !== "number" || !Number.isSafeInteger(total) || total < 0) {
    throw new Error("Invalid registered user total");
  }
  return total;
}

export async function getRegisteredUserTotal(signal: AbortSignal): Promise<number> {
  const response = await api.get<ApiResponse<{ totalUsers: number }>>("/api/usage-stats", { signal });
  return readTotal(response.data);
}
