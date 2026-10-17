/**
 * Production Environment Check Utility
 *
 * This file provides utilities to check the environment and
 * detect common issues that might cause runtime errors.
 */

// Check React environment
export function checkReactEnvironment() {
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    import.meta.env.PROD ||
    import.meta.env.VITE_APP_ENV === 'production';
  
  // In development, perform more extensive checks
  if (!isProduction) {
    console.log('Development environment detected - performing extended checks');
  }

  // Check for React and ReactDOM availability using dynamic property access
  const globalObj = typeof window !== 'undefined' ? window : globalThis;
  const hasReact = !!(globalObj as Record<string, unknown>).React;
  const hasReactDOM = !!(globalObj as Record<string, unknown>).ReactDOM;

  if (!hasReact) {
    console.warn('React is not defined globally - this could cause issues');
  }

  if (!hasReactDOM) {
    console.warn('ReactDOM is not defined globally - this could cause issues');
  }

  // Check for window.ethereum
  if (import.meta.env.DEV) {
    checkWalletEnvironment();
  }

  return {
    isProduction,
    hasReact,
    hasReactDOM,
  };
}

// Check wallet environment
export function checkWalletEnvironment() {
  if (typeof window === 'undefined') return;

  // Log wallet provider state
  if (window.ethereum) {
    const ethereum = window.ethereum as typeof window.ethereum & {
      isMetaMask?: boolean;
      chainId?: string;
      selectedAddress?: string;
    };
    console.log('Wallet provider detected:', {
      isMetaMask: ethereum.isMetaMask,
      chainId: ethereum.chainId,
      selectedAddress: ethereum.selectedAddress,
      // Log any other properties that might be useful for debugging
    });
  } else {
    console.log('No wallet provider detected on window.ethereum');
  }

  // Check for multiple providers
  const providers = [];
  if (window.ethereum) providers.push('window.ethereum');
  if (((window as unknown as Record<string, unknown>).web3 as Record<string, unknown>)?.currentProvider) providers.push('window.web3.currentProvider');
  if ((window as unknown as Record<string, unknown>).__originalEthereum) providers.push('__originalEthereum (backup)');
  
  if (providers.length > 1) {
    console.log(`Multiple wallet providers detected: ${providers.join(', ')}`);
  }
}

// Export a function that can be called at app initialization
export function runEnvironmentChecks() {
  try {
    const envInfo = checkReactEnvironment();
    if (import.meta.env.DEV) {
      console.log('Environment check complete:', envInfo);
    }
    return envInfo;
  } catch (error) {
    console.error('Error during environment check:', error);
    return { error };
  }
}

export default runEnvironmentChecks;