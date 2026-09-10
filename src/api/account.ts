import { cloudApi } from './index';
import type { ApiResponse, AuthUserData } from '../types/api';

export interface EmailLinkConfirmation {
  requiresConfirmation: true;
  linkTicket: string;
  preview: {
    nickname: string;
    sourceTasks: number;
    targetTasks: number;
    classicRemaining: number;
    quantumRemaining: number;
    hasHistoryToMerge: boolean;
  };
}

function readData<T>(response: ApiResponse<T>): T {
  if (!response.success || !response.data) throw new Error(response.message || '账号信息响应不完整，请重试');
  return response.data;
}

export const accountApi = {
  async sendEmailCode(email: string) {
    const { data } = await cloudApi.post<ApiResponse>('/auth/email/send-change-code', { email });
    if (!data.success) throw new Error(data.message || '验证码发送失败');
  },
  async changeEmail(email: string, code: string) {
    const { data } = await cloudApi.post<ApiResponse<AuthUserData | EmailLinkConfirmation>>('/auth/email/change', { email, code });
    return readData(data);
  },
  async confirmEmailLink(linkTicket: string) {
    const { data } = await cloudApi.post<ApiResponse<AuthUserData>>('/auth/email/confirm-link', { linkTicket });
    return readData(data);
  },
  async setPassword(password: string) {
    const { data } = await cloudApi.post<ApiResponse<{ hasPassword: boolean }>>('/auth/password/set', { password });
    return readData(data);
  },
};
