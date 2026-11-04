import { useState, useEffect, useCallback } from "react";
import { supabase } from "../integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { User, UserRole } from "../types/user";
import { revenueCatAuthIntegration } from "../lib/monetization/revenueCatAuthIntegration";
import { revenueCatService, UserSubscription } from "../lib/monetization/revenueCat";
import { useAuthStore } from '../stores/authStore';

/**
 * useAuth is used on every screen (Header, Home, session history).
 * It is email-only: Supabase sessions, the profile row, and the mobile
 * RevenueCat sync. There is no wallet sign-in and no blockchain session —
 * the app never asks for one.
 */

// Auth action result interface (consistent with SocialActionResult)
export interface AuthActionResult {
  success: boolean;
  error?: string;
  data?: any;
}

// Unified Auth Return Interface
export interface UseAuthReturn {
  session: Session | null;
  user: (Omit<User, 'profile'> & { 
    id: string; 
    email: string; 
    tier: 'free' | 'pro' | 'premium';
    profile: { username?: string; name?: string; avatar?: string };
  }) | null;
  profile: User | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<AuthActionResult>;
  signUpWithEmail: (email: string, password: string) => Promise<AuthActionResult>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasUser: boolean;
  login: (email: string, password: string) => Promise<AuthActionResult>;
  register: (email: string, password: string) => Promise<AuthActionResult>;
  isAuthenticated: boolean;
}

export const useAuth = (): UseAuthReturn => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  // Transform DB user to the User interface
  const transformToUser = (dbUser: any): User | null => {
    if (!dbUser) return null;
    return {
      ...dbUser,
      createdAt: dbUser.created_at || new Date().toISOString(),
      updatedAt: dbUser.updated_at || new Date().toISOString(),
      profile: dbUser.profile || {}, // Default to empty profile if not found
    } as User;
  };

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      // Explicitly type the query to avoid 'never' issues with Supabase client inference.
      // maybeSingle() (not single()): a missing profile is an expected state, and
      // PostgREST answers single() with 406 rather than PGRST116 for zero rows.
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        // No profile yet: create it. Sign-up and session restore can race on the
        // same user id, so insert idempotently and then read the stored row.
        const { error: insertError } = await (supabase.from("users") as any).upsert(
          {
            id: userId,
            role: "user" as UserRole,
            creator_verified: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          { onConflict: "id", ignoreDuplicates: true }
        );

        if (insertError) throw insertError;

        const { data: stored, error: readError } = await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        if (readError) throw readError;
        setProfile(transformToUser(stored));
      } else {
        // Map database fields (snake_case) to our User interface (camelCase)
        setProfile(transformToUser(data));
      }
    } catch (error) {
      console.error("Error fetching user profile:", error);
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) {
      await fetchProfile(session.user.id);
    }
  }, [session, fetchProfile]);

  /**
   * Mirror the session into the shared auth store.
   *
   * The store is the app's cross-screen source of truth (the Header reads
   * `useAuthStatus()`), but nothing used to write the session into it, so
   * `isAuthenticated` stayed false forever and the header kept offering
   * "Sign in" to signed-in users. Several useAuth instances exist (one per
   * screen), so only a real session clears the profile — a screen that has
   * not loaded the profile yet must not wipe the one another screen loaded.
   */
  useEffect(() => {
    const store = useAuthStore.getState();
    store.setSession(session);
    if (profile) {
      store.setProfile(profile);
    } else if (!session) {
      store.setProfile(null);
    }
  }, [session, profile]);

  useEffect(() => {
    useAuthStore.getState().setLoading(loading);
  }, [loading]);

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      
      // Initialize RevenueCat auth integration
      await revenueCatAuthIntegration.initialize();
      
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      
      // Load subscription status
      const subStatus = await revenueCatService.getSubscriptionStatus();
      setSubscription(subStatus);

      if (session?.user) {
        if (session.user?.id) {
          await fetchProfile(session.user.id);
        }
        // Sync user with RevenueCat
        if (session.user?.id && session.user?.email) {
          await revenueCatAuthIntegration.handleEmailAuth(
            session.user.id,
            session.user.email
          );
        }
      }
      setLoading(false);
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event: string, session: Session | null) => {
        setSession(session);
        if (session?.user) {
          if (session.user?.id) {
            await fetchProfile(session.user.id);
          }
          // Sync user with RevenueCat on auth state change
          if (session.user?.id && session.user?.email) {
            await revenueCatAuthIntegration.handleEmailAuth(
              session.user.id,
              session.user.email
            );
          }
        } else {
          setProfile(null);
          // Logout from RevenueCat when user logs out
          await revenueCatAuthIntegration.handleLogout();
        }
      },
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, [fetchProfile]);

  // Traditional email/social login
  const loginWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) return { success: false, error: error.message };
        return { success: true, data };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : "Authentication failed" 
        };
      }
    },
    [],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      try {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) return { success: false, error: error.message };
        return { success: true, data };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : "Registration failed" 
        };
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      // Logout from RevenueCat first
      await revenueCatAuthIntegration.handleLogout();

      // Sign out from Supabase
      if (session) {
        await supabase.auth.signOut();
      }
      setSession(null);
      setProfile(null);
    } catch (error) {
      console.error("Logout error:", error);
      throw error;
    }
  }, [session]);

  const user = (session?.user && profile)
    ? {
        ...profile, // This provides role, creator_verified, etc.
        id: session.user.id,
        email: session.user.email || '',
        tier: (subscription?.tier?.id || 'free') as 'free' | 'pro' | 'premium',
        profile: {
          username: session.user?.user_metadata?.username,
          name: session.user?.user_metadata?.display_name,
          avatar: session.user?.user_metadata?.avatar_url,
        },
      }
    : null;

  const hasUser = !!session?.user?.id;

  return {
    // On the web `tier` is always free: RevenueCat only runs inside Capacitor.
    session,
    user,
    profile,
    loading,
    loginWithEmail,
    signUpWithEmail,
    logout,
    refreshProfile,
    
    hasUser,
    login: loginWithEmail,
    register: signUpWithEmail,

    isAuthenticated: !!user,
    signOut: logout,
  };
};

export const useBasicAuth = () => useAuth();
export const useFullAuth = () => useAuth();
