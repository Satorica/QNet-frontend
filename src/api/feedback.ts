import { cloudApi } from "./index";
import type {
  ApiResponse,
  FeedbackHistoryData,
  FeedbackHistoryParams,
  FeedbackSubmitData,
  FeedbackSubmitRequest,
} from "../types/api";

export const submitFeedback = async (
  payload: FeedbackSubmitRequest,
): Promise<ApiResponse<FeedbackSubmitData>> => {
  const response = await cloudApi.post<ApiResponse<FeedbackSubmitData>>(
    "/api/feedback",
    payload,
  );
  return response.data;
};

export const getFeedbackHistory = async (
  params: FeedbackHistoryParams = {},
): Promise<ApiResponse<FeedbackHistoryData>> => {
  const response = await cloudApi.get<ApiResponse<FeedbackHistoryData>>(
    "/api/feedback",
    {
      params: {
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 10,
      },
    },
  );
  return response.data;
};
