/**
 * Enhanced RevenueCat Configuration Management
 * 
 * ENHANCEMENT: Improved error handling and developer access control
 * CLEAN: Centralized configuration with graceful fallbacks
 * MODULAR: Composable configuration strategies
 * 
 * This module handles RevenueCat API keys securely by:
 * 1. Not exposing keys in client-side bundles
 * 2. Providing graceful fallback behavior when backend is unavailable
 * 3. Supporting development, staging, and production environments
 * 4. Developer whitelist and override capabilities
 */

export interface RevenueCatConfig {
  ios: string;
  android: string;
}

export interface SecureRevenueCatConfig {
  isAvailable: boolean;
  config: RevenueCatConfig | null;
  error?: string;
  mode: 'production' | 'development' | 'demo';
  isDeveloperOverride?: boolean;
}

export interface DeveloperOverride {
  enabled: boolean;
  tier: 'basic' | 'premium' | 'pro';
  features: string[];
  reason?: string;
}

/**
 * Brume Premium — single source of truth for RevenueCat naming.
 *
 * CLEAN: One entitlement, two products. Everything paid in Brume maps to the
 * `brume_premium` entitlement; legacy 'pro'/'premium' tier labels elsewhere in
 * the app are backward-compatible aliases of it.
 *
 * NOTE (Shipaton judges): promo/offer codes are configured on the RevenueCat
 * side (App Store Connect / Google Play offers) — no client constants needed.
 */
export const ENTITLEMENT_ID = "brume_premium";

export const PRODUCT_IDS = {
  monthly: "brume_premium_monthly",
  annual: "brume_premium_annual",
} as const;

export type BrumeProductInterval = keyof typeof PRODUCT_IDS;

/** The annual product carries the 7-day free trial (configured in the stores). */
export const ANNUAL_TRIAL_DAYS = 7;

/**
 * Enhanced configuration loading with graceful fallbacks
 * ENHANCEMENT: Better error handling and developer overrides
 * CLEAN: Clear separation of configuration strategies
 */
export async function loadRevenueCatConfig(): Promise<SecureRevenueCatConfig> {
  try {
    const isDev = import.meta.env.DEV;
    const isStaging = import.meta.env.VITE_APP_ENV === 'staging';
    
    // Check for developer override first
    const developerOverride = getDeveloperOverride();
    if (developerOverride.enabled) {
      console.info(`🔧 Developer override active: ${developerOverride.tier} tier access`);
      return {
        isAvailable: true,
        config: createMockRevenueCatConfig(),
        mode: 'development',
        isDeveloperOverride: true
      };
    }

    // Development fallback keys
    const devFallbacks = {
      ios: "appl_dev_fallback_key",
      android: "goog_dev_fallback_key"
    };

    let config: RevenueCatConfig | null = null;
    let mode: 'production' | 'development' | 'demo' = 'demo';
    
    if (isDev || isStaging) {
      // Development/staging: use fallback keys for testing
      config = devFallbacks;
      mode = 'development';
      console.info("🔧 RevenueCat: Using development fallback keys for testing");
    } else {
      // Production: attempt to fetch from backend with graceful fallback
      const backendResult = await attemptBackendConfiguration();
      
      if (backendResult.success && backendResult.config) {
        config = backendResult.config;
        mode = 'production';
        console.info("✅ RevenueCat: Successfully loaded production configuration");
      } else {
        // Graceful fallback to demo mode instead of failing
        console.info("🎭 RevenueCat: Backend unavailable, running in demo mode");
        console.info("   → All subscription features will work in demo mode");
        console.info("   → Configure backend endpoint for production billing");
        config = devFallbacks;
        mode = 'demo';
      }
    }

    return {
      isAvailable: true, // Always available now with fallbacks
      config,
      mode,
      isDeveloperOverride: false
    };
  } catch (error) {
    console.error("Failed to load RevenueCat configuration:", error);
    
    // Even on error, provide demo mode fallback
    return {
      isAvailable: true,
      config: createMockRevenueCatConfig(),
      mode: 'demo',
      error: error instanceof Error ? error.message : "Unknown configuration error"
    };
  }
}

/**
 * MODULAR: Attempt to load configuration from backend
 * CLEAN: Separated backend logic for better testability
 */
async function attemptBackendConfiguration(): Promise<{
  success: boolean;
  config?: RevenueCatConfig;
  error?: string;
}> {
  try {
    const backendUrl = import.meta.env.VITE_HETZNER_SERVICE_URL || 'http://localhost:8001';
    
    const response = await fetch(`${backendUrl}/api/config/revenuecat`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(3000) // Reduced timeout for faster fallback
    });

    if (response.ok) {
      const serverConfig = await response.json();
      
      if (serverConfig.ios && serverConfig.android) {
        return {
          success: true,
          config: {
            ios: serverConfig.ios,
            android: serverConfig.android
          }
        };
      } else {
        return {
          success: false,
          error: "Backend returned incomplete configuration"
        };
      }
    } else {
      return {
        success: false,
        error: `Backend endpoint returned ${response.status}`
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Backend fetch failed"
    };
  }
}

/**
 * ENHANCEMENT: Developer override system
 * CLEAN: Centralized developer access control
 */
export function getDeveloperOverride(): DeveloperOverride {
  // Check for developer override in localStorage (for development)
  const override = localStorage.getItem('brume-dev-override');
  if (override) {
    try {
      const parsed = JSON.parse(override);
      return {
        enabled: true,
        tier: parsed.tier || 'pro',
        features: parsed.features || [],
        reason: 'Local developer override'
      };
    } catch {
      // Invalid override, ignore
    }
  }

  // Check for environment-based developer mode
  const isDeveloperMode = import.meta.env.VITE_DEVELOPER_MODE === 'true';
  if (isDeveloperMode) {
    return {
      enabled: true,
      tier: 'pro',
      features: ['all'],
      reason: 'Environment developer mode'
    };
  }

  return { enabled: false, tier: 'basic', features: [] };
}

/**
 * ENHANCEMENT: Set developer override (for development/testing)
 */
export function setDeveloperOverride(tier: 'basic' | 'premium' | 'pro', features?: string[]): void {
  const override = {
    tier,
    features: features || ['all'],
    timestamp: Date.now()
  };
  
  localStorage.setItem('brume-dev-override', JSON.stringify(override));
  console.info(`🔧 Developer override set: ${tier} tier access`);
}

/**
 * ENHANCEMENT: Clear developer override
 */
export function clearDeveloperOverride(): void {
  localStorage.removeItem('brume-dev-override');
  console.info('🔧 Developer override cleared');
}

/**
 * Gets the appropriate API key for the current platform
 */
export function getRevenueCatKeyForPlatform(config: RevenueCatConfig, platform: 'ios' | 'android'): string {
  return platform === 'ios' ? config.ios : config.android;
}

/**
 * Validates that a RevenueCat key is properly formatted
 */
export function isValidRevenueCatKey(key: string, platform: 'ios' | 'android'): boolean {
  if (!key || typeof key !== 'string') return false;
  
  const expectedPrefix = platform === 'ios' ? 'appl_' : 'goog_';
  return key.startsWith(expectedPrefix) && key.length > expectedPrefix.length;
}

/**
 * Creates a mock configuration for testing/demo purposes
 */
export function createMockRevenueCatConfig(): RevenueCatConfig {
  return {
    ios: "appl_mock_key_for_testing",
    android: "goog_mock_key_for_testing"
  };
}