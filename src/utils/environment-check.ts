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

  return {
    isProduction,
    hasReact,
    hasReactDOM,
  };
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