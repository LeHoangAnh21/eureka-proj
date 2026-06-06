'use client';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { AuthUser } from '../types/auth';
import { api } from '../lib/api';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isInitialized: boolean;
  setUser: (user: AuthUser | null) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      isLoading: false,
      isInitialized: false,

      setUser: (user) => set({ user }),

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await api.post<{ user: AuthUser }>('/auth/login', { email, password });
          set({ user: res.user, isInitialized: true });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        await api.post('/auth/logout', {});
        set({ user: null });
      },

      checkAuth: async () => {
        set({ isLoading: true });
        try {
          const user = await api.get<AuthUser>('/auth/me');
          set({ user, isInitialized: true });
        } catch {
          set({ user: null, isInitialized: true });
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    { name: 'AuthStore' },
  ),
);
