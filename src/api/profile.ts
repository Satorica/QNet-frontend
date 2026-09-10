import { cloudApi } from './index';
import type { ApiResponse } from '../types/api';

export interface UserProfile {
  avatarUrl: string;
  nickname: string;
  gender: '男' | '女' | '保密';
  birthday: string;
}

export type ProfileUpdate = Partial<Omit<UserProfile, 'avatarUrl'>>;

const readProfile = (response: ApiResponse<{ profile: UserProfile }>): UserProfile => {
  if (!response.success || !response.data?.profile) {
    throw new Error(response.message || '个人资料响应缺少数据');
  }
  const profile = response.data.profile;
  const baseURL = String(cloudApi.defaults.baseURL || '').replace(/\/+$/, '');
  return {
    ...profile,
    avatarUrl: profile.avatarUrl?.startsWith('/')
      ? `${baseURL}${profile.avatarUrl}`
      : profile.avatarUrl || '',
  };
};

export const profileApi = {
  async get(): Promise<UserProfile> {
    const response = await cloudApi.get<ApiResponse<{ profile: UserProfile }>>('/auth/profile');
    return readProfile(response.data);
  },
  async update(payload: ProfileUpdate): Promise<UserProfile> {
    const response = await cloudApi.put<ApiResponse<{ profile: UserProfile }>>('/auth/profile', payload);
    return readProfile(response.data);
  },
  async uploadAvatar(file: File, nickname?: string): Promise<UserProfile> {
    const data = new FormData();
    data.append('avatar', file, file.name);
    if (nickname !== undefined) data.append('nickname', nickname);
    const response = await cloudApi.post<ApiResponse<{ profile: UserProfile }>>('/auth/profile/avatar', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return readProfile(response.data);
  },
};
