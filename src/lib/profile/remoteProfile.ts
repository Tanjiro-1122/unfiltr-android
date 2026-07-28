import { apiClient } from '@/lib/api/client';

export type RemoteProfile = Record<string, unknown> & {
  avatar_id?: string | null;
  companion_name?: string | null;
  display_name?: string | null;
  id?: string | null;
  personality?: string | null;
  preferences?: Record<string, unknown> | null;
};

type ProfileGetResponse = {
  memory?: Record<string, unknown>;
  profile?: RemoteProfile | null;
};

export async function loadRemoteProfile(): Promise<ProfileGetResponse> {
  return apiClient.post<ProfileGetResponse>('/api/profile', { action: 'get' });
}
