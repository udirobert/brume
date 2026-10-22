import { useState, useEffect, useCallback } from "react";
import { supabase } from "../integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { User, UserRole } from "../types/blockchain";
import { useWalletStatus, useWalletActions } from "./useWallet";
import { revenueCatAuthIntegration } from "../lib/monetization/revenueCatAuthIntegration";
import { revenueCatService, UserSubscription } from "../lib/monetization/revenueCat";
import { useSiweAuth } from './useSiweAuth';
import type { BlockchainAuthReturn } from './useBlockchainAuth';

/**
 * useAuth is used on every screen (Header, Home, session history).
 * It must NOT call wagmi hooks — WagmiProvider only wraps /profile,
 * /subscription, and the lazy wallet step on /auth.
 */
const disconnectedBlockchainAuth = {
  state: {
    isAuthenticated: { lens: false, flow: false, both: false },
    isInitializing: false,
    isAuthenticating: false,
    isProcessingPayment: false,
    error: null,
    lensSession: null,
    flowUser: null,
  },
  isAuthenticated: false,
  isLensAuthenticated: false,
  isFlowAuthenticated: false,
  authenticateBoth: async () => ({ success: false as const, error: "Connect a wallet from Profile" }),
  authenticateLens: async () => ({ success: false as const, error: "Connect a wallet from Profile" }),
  authenticateFlow: async () => ({ success: false as const, error: "Connect a wallet from Profile" }),
  logout: async () => {},
  executePayment: async () => ({ success: false as const, error: "Connect a wallet from Profile" }),
  subscribeToPlan: async () => ({ success: false as const, error: "Connect a wallet from Profile" }),
  refreshAuthStatus: () => {},
  authService: undefined,
} as unknown as BlockchainAuthReturn;

// Auth action result interface (consistent with SocialActionResult)
export interface AuthActionResult {
  success: boolean;
  error?: string;
  data?: any;
}

// Unified Auth Return Interface
export interface UseAuthReturn {
  session: Session | null;
  user: (Omit<User, 'wallet' | 'profile'> & { 
    id: string; 
    email: string; 
    tier: 'free' | 'pro' | 'premium';
    wallet: { address: string | null; chain: string | null; chainId: string | null; isConnected: boolean } | null;
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
  walletUser: { address: string | null; chainId: string | null } | null;
  wallet: { address: string | null; chain: string | null; chainId: string | null; isConnected: boolean } | null;
  walletConnection: { isConnected: boolean; isConnecting: boolean; chain: string | null; chainId: string | null };
  loginWithWallet: () => Promise<void>;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  isAuthenticated: boolean;
  hasWallet: boolean;
  isWeb3User: boolean;
  blockchainEnabled: boolean;
  supportedChains: string[];
  currentChain: string | null;
  currentChainId: string | null;
  hasLensProfile: boolean;
  lensHandle: string | null;
  hasFlowAccount: boolean;
  flowAddress: string | null;
  blockchainAuth: BlockchainAuthReturn;
}

// Blockchain features configuration - disabled by default to reduce initial bundle size
// Users who navigate to Web3 routes will trigger lazy loading of blockchain features
const BLOCKCHAIN_FEATURES_ENABLED = false;

// Helper function to get chain name from chainId
const getChainName = (chainId: string | null): string | null => {
  if (!chainId) return null;
  const chainNames: Record<string, string> = {
    '0x1': 'Ethereum',
    '0x89': 'Polygon', 
    '0xa4b1': 'Arbitrum',
  };
  return chainNames[chainId] || 'Unknown';
};

export const useAuth = (): UseAuthReturn => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Wallet hooks for wallet integration (safe when WalletProvider is absent)
  const { isConnected, isConnecting, address, chainId } = useWalletStatus();
  const { connect, disconnect } = useWalletActions();

  // SIWE auth hook — must be called at top level, not inside a callback
  const { authenticate: siweAuthenticate } = useSiweAuth();

  const openConnectModal = useCallback(async () => {
    try {
      await connect();
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  }, [connect]);

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
      
      // Disconnect wallet
      if (isConnected) {
        disconnect();
      }
      
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
  }, [session, isConnected, disconnect]);

  // Enhanced wallet connection with ConnectKit
  const connectWallet = useCallback(async () => {
    try {
      if (isConnected) {
        console.log("Wallet already connected:", address);
        return;
      }

      // Open ConnectKit modal
      openConnectModal();
    } catch (error) {
      console.error("Wallet connection failed:", error);
      throw error;
    }
  }, [isConnected, address, openConnectModal]);

  const loginWithWallet = useCallback(async () => {
    try {
      if (!address) {
        await connectWallet();
        return;
      }

      // If no Supabase session, perform SIWE verification for wallet-only auth
      if (!session) {
        const result = await siweAuthenticate();
        if (!result.success) {
          throw new Error(result.error || 'SIWE authentication failed');
        }
        // Sync wallet with RevenueCat using address as userId (mobile-only integration remains isolated)
        const userId = address;
        await revenueCatAuthIntegration.handleWalletAuth(userId, address, chainId ? parseInt(chainId, 16) : undefined);
        return;
      }

      // Sync wallet with RevenueCat
      const userId = session?.user?.id || address; // Use session user ID if available, otherwise use address
      await revenueCatAuthIntegration.handleWalletAuth(userId, address, chainId ? parseInt(chainId, 16) : undefined);

      // Create or link wallet to existing profile
      if (session?.user) {
        // Link wallet to existing Supabase user
        const { error } = await (supabase
          .from("users") as any)
          .update({
            wallet_address: address,
            preferred_chain: getChainName(chainId) || "ethereum",
          })
          .eq("id", session.user.id);

        if (error) throw error;
        await refreshProfile();
      } else {
        // Fallback: advise email signup if SIWE path is not applicable
        console.log("Wallet-only authentication now uses SIWE; email signup optional");
      }
    } catch (error) {
      console.error("Wallet login failed:", error);
      throw error;
    }
  }, [address, session, chainId, connectWallet, refreshProfile, siweAuthenticate]);

  const user = (session?.user && profile)
    ? {
        ...profile, // This provides role, creator_verified, etc.
        id: session.user.id,
        email: session.user.email || '',
        tier: (subscription?.tier?.id || 'free') as 'free' | 'pro' | 'premium',
        wallet: isConnected
          ? {
              address,
              chain: getChainName(chainId),
              chainId: chainId,
              isConnected,
            }
          : null,
        profile: {
          username: session.user?.user_metadata?.username,
          name: session.user?.user_metadata?.display_name,
          avatar: session.user?.user_metadata?.avatar_url,
        },
      }
    : null;

  // Additional helpers for UnifiedAuthFlow
  const hasUser = !!session?.user?.id;

  return {
    // Enhanced Supabase auth with wallet support
    session,
    user,
    profile,
    loading,
    loginWithEmail,
    signUpWithEmail,
    logout,
    refreshProfile,
    
    // Auth helpers for UnifiedAuthFlow
    hasUser,
    login: loginWithEmail,
    register: signUpWithEmail,

    // Enhanced blockchain features
    walletUser: isConnected ? { address, chainId } : null,
    wallet: isConnected
      ? {
          address,
          chain: getChainName(chainId),
          chainId: chainId,
          isConnected,
        }
      : null,
    walletConnection: {
      isConnected,
      isConnecting,
      chain: getChainName(chainId),
      chainId: chainId,
    },
    loginWithWallet,
    connectWallet: openConnectModal,
    disconnectWallet: disconnect,

    // Helper properties
    isAuthenticated: !!user,
    hasWallet: isConnected && !!address,
    isWeb3User: isConnected && !!address && !!session,

    // Feature flags and chain info
    blockchainEnabled: BLOCKCHAIN_FEATURES_ENABLED,
    supportedChains: [
      "ethereum",
      "polygon",
      "arbitrum",
      "base",
      "lens",
      "story",
    ],
    currentChain: getChainName(chainId),
    currentChainId: chainId,
    
    // Lens/Flow — stubbed here. Real values come from useBlockchainAuth
    // on /profile and /subscription (inside WagmiProvider).
    hasLensProfile: false,
    lensHandle: null,
    hasFlowAccount: false,
    flowAddress: null,
    blockchainAuth: disconnectedBlockchainAuth,
    signOut: logout,
  };
};

export const useBasicAuth = () => useAuth();
export const useWeb3Auth = () => useAuth();
export const useFlowOnlyAuth = () => useAuth();
export const useFullAuth = () => useAuth();
