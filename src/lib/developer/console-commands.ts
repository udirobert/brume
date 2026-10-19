/**
 * Developer Console Commands
 * ENHANCEMENT: Provides easy console access to developer features
 * DRY: Single source of truth for developer utilities
 * CLEAN: Clear separation of developer tools
 */

import { 
  setDeveloperOverride, 
  clearDeveloperOverride, 
  getDeveloperOverride 
} from '@/lib/monetization/revenueCatConfig';
import { revenueCatService } from '@/lib/monetization/revenueCat';

/**
 * Developer utilities exposed to global window object in development
 * MODULAR: Composable developer interface
 */
export const developerCommands = {
  // Subscription overrides
  setBasic: () => {
    setDeveloperOverride('basic');
    console.info('🔧 Developer override set to BASIC tier');
  },
  
  setPremium: () => {
    setDeveloperOverride('premium');
    console.info('🔧 Developer override set to PREMIUM tier');
  },
  
  setPro: () => {
    setDeveloperOverride('pro');
    console.info('🔧 Developer override set to PRO tier');
  },
  
  clearOverride: () => {
    clearDeveloperOverride();
    console.info('🔧 Developer override cleared');
  },
  
  // Status checks
  getOverride: () => {
    const override = getDeveloperOverride();
    console.info('🔧 Current developer override:', override);
    return override;
  },
  
  getRevenueCatStatus: () => {
    // Note: revenueCatService doesn't have getConfigurationStatus method
    const isAvailable = revenueCatService.isRevenueCatAvailable();
    console.info('💰 RevenueCat available:', isAvailable);
    return { isAvailable };
  },
  
  // Quick subscription status check
  checkSubscription: async () => {
    try {
      const status = await revenueCatService.getSubscriptionStatus();
      console.info('📊 Current subscription status:', status);
      return status;
    } catch (error) {
      console.error('❌ Failed to get subscription status:', error);
      return null;
    }
  },
  
  // Help command
  help: () => {
    console.info(`
🔧 Brume Developer Commands:

Subscription Overrides:
  dev.setBasic()     - Set basic tier access
  dev.setPremium()   - Set premium tier access  
  dev.setPro()       - Set pro tier access
  dev.clearOverride() - Clear any override

Status Checks:
  dev.getOverride()        - Show current override
  dev.getRevenueCatStatus() - Show RevenueCat config status
  dev.checkSubscription()  - Check current subscription status
  
Utilities:
  dev.help()         - Show this help message

Example usage:
  dev.setPro()       // Grant pro access for testing
  dev.checkSubscription() // Verify the change
  dev.clearOverride() // Reset to normal behavior
    `);
  }
};

/**
 * ENHANCEMENT: Initialize developer commands in development mode
 * CLEAN: Only available in development environment
 */
export function initializeDeveloperCommands(): void {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    // Expose developer commands to global scope
    (window as any).dev = developerCommands;
    
    console.info(`
🔧 Developer commands loaded! Type 'dev.help()' for available commands.
    `);
  }
}

// Auto-initialize in development
if (import.meta.env.DEV) {
  initializeDeveloperCommands();
}