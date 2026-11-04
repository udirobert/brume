/**
 * Unified Auth Session Store
 *
 * This used to carry wallet, Lens, SIWE and RevenueCat state as well. Nothing
 * ever wrote to those, so they are gone rather than dormant.
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Session } from '@supabase/supabase-js';
import type { User } from '../types/user';

export interface AuthStatus {
  isAuthenticated: boolean;
  isLoading: boolean;
  lastUpdated: number | null;
}

export interface AuthSession {
  session: Session | null;
  userId: string | null;
  profile: User | null;
  status: AuthStatus;
}

export interface AuthActions {
  setSession: (session: Session | null) => void;
  setProfile: (profile: User | null) => void;
  setLoading: (isLoading: boolean) => void;
  clear: () => void;
}

const initialState: AuthSession = {
  session: null,
  userId: null,
  profile: null,
  status: { isAuthenticated: false, isLoading: true, lastUpdated: null },
};

export const useAuthStore = create<AuthSession & AuthActions>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,
    setSession: (session) => {
      set({
        session,
        userId: session?.user?.id ?? null,
        status: {
          ...get().status,
          isAuthenticated: !!session?.user?.id,
          lastUpdated: Date.now(),
        },
      });
    },
    setProfile: (profile) => {
      set({ profile, status: { ...get().status, lastUpdated: Date.now() } });
    },
    setLoading: (isLoading) => {
      set({ status: { ...get().status, isLoading, lastUpdated: Date.now() } });
    },
    clear: () => {
      set({
        ...initialState,
        status: { isAuthenticated: false, isLoading: false, lastUpdated: Date.now() },
      });
    },
  }))
);

export const useAuthStatus = () => useAuthStore((s) => s.status);
export const useAuthProfile = () => useAuthStore((s) => s.profile);