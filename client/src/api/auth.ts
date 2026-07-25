import { ApiError, apiFetch, apiJson } from './client';
import type { User } from './types';

export const authApi = {
  /** Returns the current user, or null when unauthenticated (401). */
  me: async (): Promise<User | null> => {
    try {
      const res = await apiFetch<{ user: User }>('/auth/me');
      return res.user;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        return null;
      }
      throw error;
    }
  },

  register: (email: string, password: string): Promise<{ user: User }> =>
    apiJson('/auth/register', 'POST', { email, password }),

  login: async (email: string, password: string): Promise<User> => {
    const res = await apiJson<{ user: User }>('/auth/login', 'POST', { email, password });
    return res.user;
  },

  logout: (): Promise<{ ok: true }> => apiJson('/auth/logout', 'POST'),
};
