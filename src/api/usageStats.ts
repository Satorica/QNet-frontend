import axios from "axios";
import type { ApiResponse } from "../types/api";

// Public statistics must not trigger session refresh, login redirects or toasts.
const api = axios.create({
  baseURL: import.meta.env.DEV ? "" : (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, ""),
  timeout: 8000,
  withCredentials: true,
});

export interface UsageStats {
  totalUsers: number;
  classicCalls: number | null;
  quantumCalls: number | null;
}

function readStats(response: ApiResponse<UsageStats>): UsageStats {
  if (!response.success || !response.data) throw new Error("Invalid usage statistics");
  const data = response.data;
  for (const field of ["totalUsers", "classicCalls", "quantumCalls"] as const) {
    const total = data[field];
    // During a rolling deployment, the older API only returns totalUsers.
    if (field !== "totalUsers" && total === undefined) continue;
    if (typeof total !== "number" || !Number.isSafeInteger(total) || total < 0) {
      throw new Error("Invalid usage statistics");
    }
  }
  return {
    totalUsers: data.totalUsers,
    classicCalls: data.classicCalls ?? null,
    quantumCalls: data.quantumCalls ?? null,
  };
}

export async function getUsageStats(signal: AbortSignal): Promise<UsageStats> {
  const response = await api.get<ApiResponse<UsageStats>>("/api/usage-stats", { signal });
  return readStats(response.data);
}
