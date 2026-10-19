// Centralized environment configuration for multichain architecture

interface ServiceEndpoints {
  ai: {
    url: string;
    timeout: number;
    retries: number;
  };
  vision: {
    url: string;
    timeout: number;
    retries: number;
  };
  social: {
    url: string;
    timeout: number;
    retries: number;
  };
}

interface EnvironmentConfig {
  services: ServiceEndpoints;
  supabase: {
    url: string;
    anonKey: string;
  };
  flow: {
    accessNode: string;
    discoveryWallet: string;
    contractAddress: string;
    fungibleToken: string;
    flowToken: string;
  };
  lens: {
    environment: "testnet" | "mainnet";
    apiUrl: string;
    appAddress: string;
    rpcUrl: string;
    chainId: string;
    explorerUrl: string;
    currencySymbol: string;
  };
  ai: {
    geminiApiKey: string;
  };
  app: {
    name: string;
    description: string;
    url: string;
    icon: string;
  };
  development: {
    debugMode: boolean;
    enableAnalytics: boolean;
    enableServiceDiscovery: boolean;
    enableUnifiedAPI: boolean;
  };
}

// Validate critical environment variables (only throw for truly required ones)
const criticalEnvVars = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
] as const;

// Check for missing critical environment variables
const missingCriticalVars = criticalEnvVars.filter(
  (varName) => !import.meta.env[varName],
);

if (missingCriticalVars.length > 0) {
  console.error("Missing critical environment variables:", missingCriticalVars);
  throw new Error(
    `Missing critical environment variables: ${missingCriticalVars.join(", ")}`,
  );
}

// Warn about missing optional variables
const optionalEnvVars = [
  "VITE_FLOW_ACCESS_NODE",
  "VITE_FLOW_CONTRACT_ADDRESS",
  "VITE_LENS_API_URL",
  "VITE_GEMINI_API_KEY",
] as const;

// Note: RevenueCat keys are intentionally excluded from client-side environment
// They should be handled securely via server-side configuration or secure runtime loading

const missingOptionalVars = optionalEnvVars.filter(
  (varName) => !import.meta.env[varName],
);

if (missingOptionalVars.length > 0) {
  console.warn(
    "Missing optional environment variables (using defaults):",
    missingOptionalVars,
  );
}

export const config: EnvironmentConfig = {
  services: {
    ai: {
      url: import.meta.env.VITE_HETZNER_SERVICE_URL || import.meta.env.VITE_AI_SERVICE_URL || 'http://localhost:8001',
      timeout: parseInt(import.meta.env.VITE_AI_TIMEOUT || '30000'),
      retries: parseInt(import.meta.env.VITE_AI_RETRIES || '3'),
    },
    vision: {
      url: import.meta.env.VITE_HETZNER_SERVICE_URL || import.meta.env.VITE_VISION_SERVICE_URL || 'http://localhost:8001',
      timeout: parseInt(import.meta.env.VITE_VISION_TIMEOUT || '10000'),
      retries: parseInt(import.meta.env.VITE_VISION_RETRIES || '2'),
    },
    social: {
      url: import.meta.env.VITE_HETZNER_SERVICE_URL || import.meta.env.VITE_VISION_SERVICE_URL || 'http://localhost:8001',
      timeout: parseInt(import.meta.env.VITE_SOCIAL_TIMEOUT || '15000'),
      retries: parseInt(import.meta.env.VITE_SOCIAL_RETRIES || '3'),
    },
  },
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL!,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY!,
  },
  flow: {
    accessNode:
      import.meta.env.VITE_FLOW_ACCESS_NODE ||
      "https://rest-testnet.onflow.org",
    discoveryWallet:
      import.meta.env.VITE_FLOW_DISCOVERY_WALLET ||
      "https://fcl-discovery.onflow.org/testnet/authn",
    contractAddress:
      import.meta.env.VITE_FLOW_CONTRACT_ADDRESS || "0xf8d6e0586b0a20c7",
    fungibleToken:
      import.meta.env.VITE_FLOW_FUNGIBLE_TOKEN || "0x9a0766d93b6608b7",
    flowToken: import.meta.env.VITE_FLOW_FLOW_TOKEN || "0x7e60df042a9c0868",
  },
  lens: {
    environment:
      (import.meta.env.VITE_LENS_ENVIRONMENT as "testnet" | "mainnet") ||
      "testnet",
    apiUrl: import.meta.env.VITE_LENS_API_URL || "https://api.testnet.lens.xyz",
    appAddress:
      import.meta.env.VITE_LENS_APP_ADDRESS ||
      "0xC75A89145d765c396fd75CbD16380Eb184Bd2ca7", // Lens Chain Testnet default
    rpcUrl: import.meta.env.VITE_LENS_RPC_URL || "https://rpc.testnet.lens.xyz",
    chainId: import.meta.env.VITE_LENS_CHAIN_ID || "37111",
    explorerUrl:
      import.meta.env.VITE_LENS_EXPLORER_URL ||
      "https://explorer.testnet.lens.xyz",
    currencySymbol: import.meta.env.VITE_LENS_CURRENCY_SYMBOL || "GRASS",
  },
  ai: {
    geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || "",
  },
  app: {
    name: import.meta.env.VITE_APP_NAME || "Brume",
    description:
      import.meta.env.VITE_APP_DESCRIPTION ||
      "A calm companion for breathing breaks",
    url: import.meta.env.VITE_APP_URL || "https://brumeapp.netlify.app",
    icon:
      import.meta.env.VITE_APP_ICON || "https://brumeapp.netlify.app/android-chrome-512x512.png",
  },
  development: {
    debugMode: import.meta.env.VITE_DEBUG_MODE === "true",
    enableAnalytics: import.meta.env.VITE_ENABLE_ANALYTICS !== "false",
    enableServiceDiscovery: import.meta.env.VITE_ENABLE_SERVICE_DISCOVERY !== "false",
    enableUnifiedAPI: import.meta.env.VITE_ENABLE_UNIFIED_API !== "false",
  },
} as const;

// Export individual configs for convenience
export const { services, supabase, flow, lens, ai, app, development } = config;

// Development helpers
export const isDevelopment = import.meta.env.DEV;
export const isProduction = import.meta.env.PROD;

// Logging helper that respects debug mode
export const debugLog = (...args: unknown[]) => {
  if (development.debugMode || isDevelopment) {
    console.log("[DEBUG]", ...args);
  }
};

export default config;
