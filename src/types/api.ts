export type ModelType = "classic" | "sim" | "cloud";
export type ProblemType = "maxcut" | "number_partition" | "coloring" | "tsp";
export type MatrixImportProblemType = Exclude<ProblemType, "number_partition">;
export type TaskStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";
export type TaskStatusFilter = TaskStatus | "running";

export interface GraphNode {
  id: number;
  x: number;
  y: number;
}

export interface GraphEdge {
  source: number;
  target: number;
}

export interface WeightedGraphEdge extends GraphEdge {
  weight: number;
}

export interface City extends GraphNode {
  name: string;
}

export interface CandidateDisplay {
  value?: number | string | null;
  solution: string;
}

export interface NumberPartitionResult {
  subsetA: number[];
  subsetB: number[];
  sumA: number;
  sumB: number;
  difference: number;
  balance: string;
}

export interface ApiResponse<T = undefined> {
  success: boolean;
  message?: string;
  data?: T;
  errorCode?: string;
}

export type FeedbackCategory =
  | "task"
  | "quota"
  | "account"
  | "suggestion"
  | "other";

export interface FeedbackClientInfo {
  platform?: string;
  system?: string;
  version?: string;
  brand?: string;
  model?: string;
  envVersion?: string;
  appVersion?: string;
  sourcePage?: string;
  collectedAt?: number;
}

export interface FeedbackSubmitRequest {
  category: FeedbackCategory;
  content: string;
  contact?: string;
  clientInfo?: FeedbackClientInfo;
}

export interface FeedbackSubmitData {
  feedbackId: number | string;
}

export interface FeedbackHistoryItem {
  id: string;
  category: FeedbackCategory;
  content: string;
  status: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface FeedbackHistoryData {
  feedbacks: FeedbackHistoryItem[];
  page: number;
  pageSize: number;
  total: number;
}

export interface FeedbackHistoryParams {
  page?: number;
  pageSize?: number;
}

export interface QuotaModelSummary {
  remaining: number;
  pending: number;
  available: number;
  default: number;
  label: string;
}

export interface QuotaSummary {
  defaultQuota: number;
  models: Record<ModelType, QuotaModelSummary>;
}

export interface UserInfo {
  id: number;
  username: string;
  maskedEmail?: string | null;
  maskedPhone?: string | null;
  is_verified: boolean;
  status: string;
  email?: string | null;
  phone?: string | null;
  role?: string;
  quotaSummary?: QuotaSummary;
}

export interface AuthUserData {
  user: UserInfo;
  expiresAt?: number;
}

export interface RegisterRequest {
  username: string;
  password: string;
  register_type: "email";
  code: string;
  email: string;
}

export interface ResetCodeData {
  resetToken: string;
  maskedEmail?: string;
}

export interface TaskSubmitRequest {
  taskName: string;
  problemType: ProblemType;
  modelType: ModelType;
  matrixSize: number;
  adjacencyMatrix: number[] | number[][];
  [key: string]: unknown;
}

export interface MatrixImportData {
  problemType: MatrixImportProblemType;
  matrixSize: number;
  adjacencyMatrix: number[][];
}

export interface TaskCandidate {
  rank?: number | string;
  value?: number | string | null;
  solution?: unknown;
  unsatisfied_count?: number;
  [key: string]: unknown;
}

export interface TaskResults {
  runtime?: number;
  candidates?: TaskCandidate[];
  [key: string]: unknown;
}

export interface TaskSubmitResponse extends ApiResponse {
  taskId: string;
  queuePosition?: number;
  quotaSummary?: QuotaSummary;
  serverType: "cloud";
  usePolling: true;
}

export interface TaskStatusResponse {
  taskId: string;
  state: TaskStatus;
  taskName?: string;
  updatedAt?: number;
  message?: string;
  queuePosition?: number;
  cancelRequested?: boolean;
  results?: TaskResults;
}

export type CancelTaskResponse =
  | {
      success: true;
      message?: string;
      cancelled: true;
      taskStatus: "cancelled";
    }
  | {
      success: false;
      message?: string;
      cancelled?: false;
      taskStatus: TaskStatus;
    };

export interface TaskHistoryItem {
  taskId: string;
  taskName: string;
  problemType: ProblemType;
  modelType: ModelType;
  status: TaskStatus;
  matrixSize: number;
  timestamp: string | null;
  solveTime?: string | null;
  message?: string | null;
  usedColors?: number | null;
  bestValue?: number | null;
}

export interface TaskStatusCounts {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export interface TaskHistoryData {
  tasks: TaskHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  statusCounts: TaskStatusCounts;
}

export interface TaskHistoryParams {
  page?: number;
  pageSize?: number;
  taskName?: string;
  modelType?: ModelType | "" | null;
  problemType?: ProblemType | "" | null;
  status?: TaskStatusFilter | null;
}

export interface TaskDeleteFilters {
  taskName?: string;
  modelType?: ModelType;
  problemType?: ProblemType;
  status?: TaskStatusFilter;
}

export interface DeleteTaskResponse extends ApiResponse {
  deleted?: boolean;
  deletedCount?: number;
  skippedNonTerminalCount?: number;
}

export interface QuotaData {
  quotaSummary: QuotaSummary;
}

export interface TaskInfo {
  taskId: string;
  taskName: string;
  problemType: ProblemType;
  modelType: ModelType;
  matrixSize: number;
  adjacencyMatrix: number[] | number[][];
  createdAt: number;
  extra?: Record<string, unknown>;
}

export interface TaskDetail {
  taskId: string;
  taskName: string;
  state: TaskStatus;
  updatedAt: number;
  message: string;
  input: unknown;
  taskInfo: TaskInfo;
  queuePosition?: number;
  runtime?: number;
  resultSummary: {
    runtime?: number | null;
    bestValue?: number | null;
    usedColors?: number | null;
    candidateCount: number;
  };
  results?: TaskResults;
}
