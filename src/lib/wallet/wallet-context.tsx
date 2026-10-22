/**
 * Wallet Context Provider
 * 
 * React context for managing wallet state across the application.
 * Provides clean API for wallet operations with automatic state management.
 */

import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react';
import { walletProviderManager, WalletConnectionState, WalletEvent } from './provider-manager';
import { AuthType, AuthContext, getFeaturesForAuthLevel } from '../../config/messaging';

// Helper function to get features for auth level
const getAuthLevelFeatures = (authLevel: AuthType): string[] => {
  return [...getFeaturesForAuthLevel(authLevel)];
};

// State interface
export interface WalletState extends WalletConnectionState {
  isConnecting: boolean;
  error: string | null;
  lastConnected: number | null;
  // Authentication level tracking
  authLevel: AuthType;
  availableFeatures: string[];
  pendingAction?: {
    action: string;
    requiresAuth: AuthType;
    context: AuthContext;
  };
}

// Action types
type WalletAction =
  | { type: 'CONNECTING' }
  | { type: 'CONNECTED'; payload: WalletConnectionState }
  | { type: 'DISCONNECTED' }
  | { type: 'ERROR'; payload: string }
  | { type: 'PROVIDER_CHANGED'; payload: WalletConnectionState }
  | { type: 'CLEAR_ERROR' }
  | { type: 'UPDATE_AUTH_LEVEL'; payload: AuthType }
  | { type: 'SET_PENDING_ACTION'; payload: { action: string; requiresAuth: AuthType; context: AuthContext } }
  | { type: 'CLEAR_PENDING_ACTION' };

// Initial state
const initialState: WalletState = {
  isAvailable: false,
  isConnected: false,
  isConnecting: false,
  activeProvider: null,
  availableProviders: [],
  address: null,
  chainId: null,
  error: null,
  lastConnected: null,
  authLevel: 'none',
  availableFeatures: ['Unlimited breathing sessions', 'Basic pattern library', 'Simple progress tracking (local)'] as string[],
  pendingAction: undefined,
};

// Reducer
function walletReducer(state: WalletState, action: WalletAction): WalletState {
  switch (action.type) {
    case 'CONNECTING':
      return {
        ...state,
        isConnecting: true,
        error: null,
      };

    case 'CONNECTED':
      return {
        ...state,
        ...action.payload,
        isConnecting: false,
        error: null,
        lastConnected: Date.now(),
      };

    case 'DISCONNECTED':
      return {
        ...state,
        isConnected: false,
        address: null,
        chainId: null,
        isConnecting: false,
        error: null,
      };

    case 'ERROR':
      return {
        ...state,
        isConnecting: false,
        error: action.payload,
      };

    case 'PROVIDER_CHANGED':
      return {
        ...state,
        ...action.payload,
        error: null,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'UPDATE_AUTH_LEVEL':
      return {
        ...state,
        authLevel: action.payload,
        availableFeatures: getAuthLevelFeatures(action.payload),
      };

    case 'SET_PENDING_ACTION':
      return {
        ...state,
        pendingAction: action.payload,
      };

    case 'CLEAR_PENDING_ACTION':
      return {
        ...state,
        pendingAction: undefined,
      };

    default:
      return state;
  }
}

// Context interface
export interface WalletContextValue {
  // State
  state: WalletState;
  
  // Actions
  connect: (providerName?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  switchProvider: (name: string) => Promise<void>;
  request: (method: string, params?: any[]) => Promise<any>;
  clearError: () => void;
  
  // Authentication level management
  updateAuthLevel: (level: AuthType) => void;
  setPendingAction: (action: string, requiresAuth: AuthType, context: AuthContext) => void;
  clearPendingAction: () => void;
  getCurrentAuthLevel: () => AuthType;
  canAccessFeature: (requiredAuth: AuthType) => boolean;
  
  // Utilities
  getShortAddress: () => string | null;
  isChainSupported: (chainId: string) => boolean;
}

// Create context
const WalletContext = createContext<WalletContextValue | null>(null);

// Supported chains (can be configured)
const SUPPORTED_CHAINS = {
  '0x1': 'Ethereum Mainnet',
  '0x89': 'Polygon',
  '0xa4b1': 'Arbitrum One',
  // Add more as needed
};

// Provider component props
interface WalletProviderProps {
  children: React.ReactNode;
  autoConnect?: boolean;
  supportedChains?: Record<string, string>;
}

/**
 * Wallet Provider Component
 */
export const WalletProvider: React.FC<WalletProviderProps> = ({
  children,
  autoConnect = true,
  supportedChains = SUPPORTED_CHAINS,
}) => {
  const [state, dispatch] = useReducer(walletReducer, initialState);

  /**
   * Update state from connection state
   */
  const updateConnectionState = useCallback(async () => {
    try {
      const connectionState = await walletProviderManager.getConnectionState();
      dispatch({ type: 'PROVIDER_CHANGED', payload: connectionState });
    } catch (error) {
      dispatch({ type: 'ERROR', payload: (error as Error).message });
    }
  }, []);

  /**
   * Handle wallet events
   */
  const handleWalletEvent = useCallback((event: WalletEvent) => {
    switch (event.type) {
      case 'provider-change':
      case 'connection-change':
        updateConnectionState();
        break;

      case 'error':
        dispatch({ type: 'ERROR', payload: event.error?.message || 'Unknown wallet error' });
        break;
    }
  }, [updateConnectionState]);

  /**
   * Connect to wallet
   */
  const connect = useCallback(async (providerName?: string) => {
    if (state.isConnecting) return;

    try {
      dispatch({ type: 'CONNECTING' });
      await walletProviderManager.connect(providerName);
      await updateConnectionState();
    } catch (error) {
      dispatch({ type: 'ERROR', payload: (error as Error).message });
      throw error;
    }
  }, [state.isConnecting, updateConnectionState]);

  /**
   * Disconnect wallet
   */
  const disconnect = useCallback(async () => {
    try {
      // Note: Most wallets don't have a disconnect method
      // We just update our internal state
      dispatch({ type: 'DISCONNECTED' });
    } catch (error) {
      dispatch({ type: 'ERROR', payload: (error as Error).message });
      throw error;
    }
  }, []);

  /**
   * Switch to a different provider
   */
  const switchProvider = useCallback(async (name: string) => {
    try {
      dispatch({ type: 'CONNECTING' });
      await walletProviderManager.switchProvider(name);
      await updateConnectionState();
    } catch (error) {
      dispatch({ type: 'ERROR', payload: (error as Error).message });
      throw error;
    }
  }, [updateConnectionState]);

  /**
   * Make a request to the active provider
   */
  const request = useCallback(async (method: string, params?: any[]) => {
    try {
      return await walletProviderManager.request(method, params);
    } catch (error) {
      dispatch({ type: 'ERROR', payload: (error as Error).message });
      throw error;
    }
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  /**
   * Get shortened address for display
   */
  const getShortAddress = useCallback((): string | null => {
    if (!state.address) return null;
    return `${state.address.slice(0, 6)}...${state.address.slice(-4)}`;
  }, [state.address]);

  /**
   * Check if chain is supported
   */
  const isChainSupported = useCallback((chainId: string): boolean => {
    return chainId in supportedChains;
  }, [supportedChains]);

  /**
   * Update authentication level
   */
  const updateAuthLevel = useCallback((level: AuthType) => {
    dispatch({ type: 'UPDATE_AUTH_LEVEL', payload: level });
  }, []);

  /**
   * Set pending action that requires authentication
   */
  const setPendingAction = useCallback((action: string, requiresAuth: AuthType, context: AuthContext) => {
    dispatch({ type: 'SET_PENDING_ACTION', payload: { action, requiresAuth, context } });
  }, []);

  /**
   * Clear pending action
   */
  const clearPendingAction = useCallback(() => {
    dispatch({ type: 'CLEAR_PENDING_ACTION' });
  }, []);

  /**
   * Get current authentication level
   */
  const getCurrentAuthLevel = useCallback((): AuthType => {
    return state.authLevel;
  }, [state.authLevel]);

  /**
   * Check if user can access a feature with required auth
   */
  const canAccessFeature = useCallback((requiredAuth: AuthType): boolean => {
    const authHierarchy: AuthType[] = ['none', 'supabase', 'evm', 'flow'];
    const currentIndex = authHierarchy.indexOf(state.authLevel);
    const requiredIndex = authHierarchy.indexOf(requiredAuth);
    return currentIndex >= requiredIndex;
  }, [state.authLevel]);

  /**
   * Initialize and setup event listeners
   */
  useEffect(() => {
    void walletProviderManager.initialize().then(() => {
      // Only ask the wallet for accounts when the app means to show a
      // connection. autoConnect=false is the default for email-first screens:
      // probing on every mount made the wallet look like it was being
      // triggered by the app. Connecting stays an explicit user action.
      if (!autoConnect) return;
      updateConnectionState();
      if (localStorage.getItem('wallet-last-connected')) {
        connect().catch(console.error);
      }
    });

    const cleanup = walletProviderManager.addEventListener(handleWalletEvent);
    return cleanup;
  }, [autoConnect, connect, handleWalletEvent, updateConnectionState]);

  /**
   * Save connection state to localStorage
   */
  useEffect(() => {
    // Only a wallet that actually holds an account counts as connected —
    // otherwise "wallet-last-connected" gets set for every visitor who has
    // an extension installed, and the next mount tries to connect the wallet
    // behind their back.
    if (state.isConnected && state.activeProvider && state.address) {
      localStorage.setItem('wallet-last-connected', Date.now().toString());
      localStorage.setItem('wallet-last-provider', state.activeProvider.name);
    } else {
      localStorage.removeItem('wallet-last-connected');
      localStorage.removeItem('wallet-last-provider');
    }
  }, [state.isConnected, state.activeProvider, state.address]);

  /**
   * Monitor account changes
   */
  useEffect(() => {
    if (!state.isConnected || !state.activeProvider) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        dispatch({ type: 'DISCONNECTED' });
      } else {
        updateConnectionState();
      }
    };

    const handleChainChanged = () => {
      updateConnectionState();
    };

    // Listen for account/chain changes if provider supports it
    const provider = state.activeProvider.provider;
    if (provider?.on) {
      provider.on('accountsChanged', handleAccountsChanged);
      provider.on('chainChanged', handleChainChanged);
    }

    return () => {
      if (provider?.removeListener) {
        provider.removeListener('accountsChanged', handleAccountsChanged);
        provider.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [state.isConnected, state.activeProvider, updateConnectionState]);

  const contextValue: WalletContextValue = {
    state,
    connect,
    disconnect,
    switchProvider,
    request,
    clearError,
    updateAuthLevel,
    setPendingAction,
    clearPendingAction,
    getCurrentAuthLevel,
    canAccessFeature,
    getShortAddress,
    isChainSupported,
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};

/**
 * Hook to access wallet context
 */
export const useWalletContext = (): WalletContextValue | null => {
  const context = useContext(WalletContext);
  return context;
};

/**
 * Hook for wallet connection status
 */
export const useWalletConnection = () => {
  const context = useWalletContext();
  
  if (!context) {
    return {
      isAvailable: false,
      isConnected: false,
      isConnecting: false,
      address: null,
      shortAddress: null,
      chainId: null,
      error: null,
    };
  }

  const { state } = context;
  return {
    isAvailable: state.isAvailable,
    isConnected: state.isConnected,
    isConnecting: state.isConnecting,
    address: state.address,
    shortAddress: state.address ? `${state.address.slice(0, 6)}...${state.address.slice(-4)}` : null,
    chainId: state.chainId,
    error: state.error,
  };
};

/**
 * Hook for wallet operations
 */
export const useWalletOperations = () => {
  const context = useWalletContext();
  if (!context) {
    const noop = async () => {};
    return {
      connect: async () => {},
      disconnect: noop,
      switchProvider: async () => {},
      request: async () => { throw new Error('WalletProvider not available'); },
      clearError: () => {},
    };
  }
  const { connect, disconnect, switchProvider, request, clearError } = context;
  return {
    connect,
    disconnect,
    switchProvider,
    request,
    clearError,
  };
};