/**
 * Auth Preferences Hook - Performance & UX Optimization
 * 
 * PERFORMANT: Caches user auth preferences for faster UX
 * CLEAN: Centralized preference management
 * DRY: Single source of truth for auth preferences
 */

import { useState, useEffect, useCallback } from 'react';
import type { AuthMethod } from '@/types/auth';

interface AuthPreferences {
  // User behavior tracking
  preferredMethod: string | null;
  lastAuthMethod: string | null;
  hasSeenWalletOption: boolean;
  hasSeenGuestOption: boolean;
  
  // Performance optimization
  shouldPreloadWallet: boolean;
  walletPreloadTime: number | null;
  
  // UX personalization
  skipMethodSelection: boolean;
  rememberChoice: boolean;
  
  // Analytics
  authAttempts: number;
  lastAuthTime: number | null;
  successfulMethods: string[];
}

const DEFAULT_PREFERENCES: AuthPreferences = {
  preferredMethod: null,
  lastAuthMethod: null,
  hasSeenWalletOption: false,
  hasSeenGuestOption: false,
  shouldPreloadWallet: false,
  walletPreloadTime: null,
  skipMethodSelection: false,
  rememberChoice: false,
  authAttempts: 0,
  lastAuthTime: null,
  successfulMethods: [],
};

const STORAGE_KEY = 'brume-auth-preferences';
const PRELOAD_DELAY = 2000; // 2 seconds before preloading wallet

/**
 * PERFORMANT: Auth preferences hook with caching and smart preloading
 */
export const useAuthPreferences = () => {
  const [preferences, setPreferences] = useState<AuthPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  // PERFORMANT: Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
      }
    } catch (error) {
      console.warn('Failed to load auth preferences:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // PERFORMANT: Debounced save to localStorage
  const savePreferences = useCallback((newPreferences: Partial<AuthPreferences>) => {
    setPreferences(prev => {
      const updated = { ...prev, ...newPreferences };
      
      // Save to localStorage asynchronously
      setTimeout(() => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (error) {
          console.warn('Failed to save auth preferences:', error);
        }
      }, 0);
      
      return updated;
    });
  }, []);

  // CLEAN: Track auth method usage
  const trackAuthAttempt = useCallback((method: string) => {
    savePreferences({
      lastAuthMethod: method,
      authAttempts: preferences.authAttempts + 1,
      lastAuthTime: Date.now(),
    });
  }, [preferences.authAttempts, savePreferences]);

  // CLEAN: Track successful auth
  const trackAuthSuccess = useCallback((method: string) => {
    const successfulMethods = [...new Set([...preferences.successfulMethods, method])];
    
    savePreferences({
      preferredMethod: method,
      lastAuthMethod: method,
      successfulMethods,
      lastAuthTime: Date.now(),
    });
  }, [preferences.successfulMethods, savePreferences]);

  // PERFORMANT: Smart preloading logic
  const shouldPreloadWallet = useCallback(() => {
    // Don't preload if already preloaded recently
    if (preferences.walletPreloadTime && 
        Date.now() - preferences.walletPreloadTime < 60000) { // 1 minute
      return false;
    }

    // Preload if user has used wallet before
    if (preferences.successfulMethods.includes('wallet')) {
      return true;
    }

    // Preload if user has seen wallet option multiple times
    if (preferences.hasSeenWalletOption && preferences.authAttempts > 2) {
      return true;
    }

    return false;
  }, [preferences]);

  // PERFORMANT: Trigger wallet preload
  const triggerWalletPreload = useCallback(() => {
    if (shouldPreloadWallet()) {
      setTimeout(() => {
        savePreferences({
          shouldPreloadWallet: true,
          walletPreloadTime: Date.now(),
        });
      }, PRELOAD_DELAY);
    }
  }, [shouldPreloadWallet, savePreferences]);

  // UX: Get recommended auth method based on preferences
  const getRecommendedMethod = useCallback((availableMethods: AuthMethod[]) => {
    // If user has a preferred method and it's available, recommend it
    if (preferences.preferredMethod) {
      const preferred = availableMethods.find(m => m.id === preferences.preferredMethod);
      if (preferred) return preferred;
    }

    // If user successfully used a method before, recommend it
    for (const methodId of preferences.successfulMethods) {
      const method = availableMethods.find(m => m.id === methodId);
      if (method) return method;
    }

    // Default to first available method
    return availableMethods[0];
  }, [preferences.preferredMethod, preferences.successfulMethods]);

  // UX: Check if we should skip method selection
  const shouldSkipSelection = useCallback(() => {
    return preferences.skipMethodSelection && 
           preferences.preferredMethod && 
           preferences.successfulMethods.length > 0;
  }, [preferences.skipMethodSelection, preferences.preferredMethod, preferences.successfulMethods]);

  // CLEAN: Mark options as seen for UX optimization
  const markOptionSeen = useCallback((option: 'wallet' | 'guest') => {
    if (option === 'wallet' && !preferences.hasSeenWalletOption) {
      savePreferences({ hasSeenWalletOption: true });
    } else if (option === 'guest' && !preferences.hasSeenGuestOption) {
      savePreferences({ hasSeenGuestOption: true });
    }
  }, [preferences.hasSeenWalletOption, preferences.hasSeenGuestOption, savePreferences]);

  // CLEAN: Reset preferences (for testing or user request)
  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    // State
    preferences,
    isLoading,
    
    // Actions
    trackAuthAttempt,
    trackAuthSuccess,
    markOptionSeen,
    resetPreferences,
    
    // Smart recommendations
    getRecommendedMethod,
    shouldSkipSelection,
    
    // Performance optimization
    shouldPreloadWallet: shouldPreloadWallet(),
    triggerWalletPreload,
    
    // Convenience getters
    hasAuthHistory: preferences.successfulMethods.length > 0,
    isReturningUser: preferences.authAttempts > 0,
    preferredMethod: preferences.preferredMethod,
  };
};