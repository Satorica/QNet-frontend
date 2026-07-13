import axios from "axios";

interface ApiErrorData {
  message?: string;
  code?: number;
}

export const getErrorMessage = (
  error: unknown,
  fallbackMessage: string
): string => {
  if (axios.isAxiosError<ApiErrorData>(error)) {
    return error.response?.data?.message || error.message || fallbackMessage;
  }

  return error instanceof Error && error.message
    ? error.message
    : fallbackMessage;
};

export const getErrorCode = (error: unknown): number | undefined =>
  axios.isAxiosError<ApiErrorData>(error)
    ? error.response?.data?.code
    : undefined;
