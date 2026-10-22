import "viem/window";

/**
 * Unified Wallet Provider Manager
 * 
 * Single source of truth for wallet provider detection, management, and fallbacks.
 * Abstracts away the complexity of multiple wallet providers and browser compatibility.
 */

export interface WalletProvider {
  name: string;
  provider: any;
  priority: number;
  isBackpack: boolean;
  isConnected: () => Promise<boolean>;
  request: (method: string, params?: any[]) => Promise<any>;
}

export interface WalletConnectionState {
  isAvailable: boolean;
  isConnected: boolean;
  activeProvider: WalletProvider | null;
  availableProviders: WalletProvider[];
  address: string | null;
  chainId: string | null;
}

export type WalletEventType = 'provider-change' | 'connection-change' | 'error';

export interface WalletEvent {
  type: WalletEventType;
  provider?: WalletProvider;
  error?: Error;
  data?: any;
}

class WalletProviderManager {
  private providers: Map<string, WalletProvider> = new Map();
  private activeProvider: WalletProvider | null = null;
  private listeners: Set<(event: WalletEvent) => void> = new Set();
  private monitorInterval: number | null = null;
  private isInitialized = false;

  constructor() {
    // Lazy: WalletProvider calls initialize() on mount so session/home
    // never probe window.ethereum.
  }

  /**
   * A wallet is only "connected" when it actually exposes an account.
   * Detection of an injected provider is not a connection.
   */
  private async hasAccounts(
    request: (method: string, params?: any[]) => Promise<any>
  ): Promise<boolean> {
    try {
      const accounts = await request('eth_accounts');
      return Array.isArray(accounts) && accounts.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Initialize the provider manager
   */
  async initialize(): Promise<void> {
    if (typeof window === 'undefined' || this.isInitialized) return;

    try {
      // Wait for provider scripts to load
      await this.waitForProviders();

      // Detect available providers
      await this.detectProviders();

      // Start monitoring for provider changes
      this.startMonitoring();

      this.isInitialized = true;
      console.log('Wallet Provider Manager initialized');
    } catch (error) {
      console.error('Failed to initialize Wallet Provider Manager:', error);
      this.emit({ type: 'error', error: error as Error });
    }
  }

  /**
   * Wait for wallet provider scripts to load
   */
  private async waitForProviders(timeout = 3000): Promise<void> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const check = () => {
        // Check if any provider APIs are available
        const hasProviders = !!(
          window.ethereum ||
          window.walletApi ||
          window.safeWallet ||
          window.__walletState
        );

        if (hasProviders || Date.now() - startTime > timeout) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };

      check();
    });
  }

  /**
   * Detect and register available wallet providers
   */
  private async detectProviders(): Promise<void> {
    const detectedProviders: WalletProvider[] = [];

    // 1. Production patch API (highest priority)
    if (window.walletApi?.isAvailable?.()) {
      detectedProviders.push({
        name: 'production-api',
        provider: window.walletApi,
        priority: 100,
        isBackpack: this.isBackpackProvider(window.walletApi.getProvider?.()),
        // "A provider exists" is not "a wallet is connected" — ask for
        // accounts. Reporting isAvailable() here made the app think every
        // visitor had a wallet and kept probing it.
        isConnected: async () => this.hasAccounts(window.walletApi!.request),
        request: async (method, params) => window.walletApi!.request(method, params),
      });
    }

    // 2. Safe wallet API (medium priority)
    if (window.safeWallet?.isAvailable?.()) {
      detectedProviders.push({
        name: 'safe-wallet',
        provider: window.safeWallet,
        priority: 80,
        isBackpack: this.isBackpackProvider(window.safeWallet.getProvider?.()),
        isConnected: async () => this.hasAccounts(window.safeWallet!.request),
        request: async (method, params) => window.safeWallet!.request(method, params),
      });
    }

    // 3. Direct ethereum provider (low priority)
    if (window.ethereum) {
      const ethereum = window.ethereum;
      detectedProviders.push({
        name: 'direct-ethereum',
        provider: ethereum,
        priority: 60,
        isBackpack: this.isBackpackProvider(ethereum),
        isConnected: async () => {
          try {
            const accounts = await ethereum.request?.({ method: 'eth_accounts' });
            return Array.isArray(accounts) && accounts.length > 0;
          } catch {
            return false;
          }
        },
        request: async (method, params) => {
          // Dynamic RPC method dispatch — widen EIP-1193's typed request surface.
          const request = ethereum.request as (args: {
            method: string;
            params?: unknown[];
          }) => Promise<unknown>;
          return request.call(ethereum, { method, params });
        },
      });
    }

    // 4. Tracked providers from wallet state
    if (window.__walletState?.current) {
      const tracked = window.__walletState.current;
      detectedProviders.push({
        name: 'tracked-provider',
        provider: tracked,
        priority: 40,
        isBackpack: this.isBackpackProvider(tracked),
        isConnected: async () => {
          try {
            const accounts = await tracked.request?.({ method: 'eth_accounts' });
            return Array.isArray(accounts) && accounts.length > 0;
          } catch {
            return false;
          }
        },
        request: async (method, params) => tracked.request({ method, params }),
      });
    }

    // Sort by priority (highest first) and register
    detectedProviders
      .sort((a, b) => b.priority - a.priority)
      .forEach(provider => {
        this.providers.set(provider.name, provider);
      });

    // Set active provider to highest priority available
    if (detectedProviders.length > 0) {
      this.activeProvider = detectedProviders[0];
      this.emit({
        type: 'provider-change',
        provider: this.activeProvider
      });
    }
  }

  /**
   * Check if a provider is Backpack
   */
  private isBackpackProvider(provider: any): boolean {
    return !!(provider?._isBackpack || provider?.isBackpack);
  }

  /**
   * Start monitoring for provider changes
   */
  private startMonitoring(): void {
    if (this.monitorInterval) return;

    this.monitorInterval = window.setInterval(async () => {
      try {
        await this.detectProviders();
      } catch (error) {
        console.warn('Provider monitoring error:', error);
      }
    }, 2000);
  }

  /**
   * Stop monitoring
   */
  private stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  /**
   * Emit an event to listeners
   */
  private emit(event: WalletEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Wallet event listener error:', error);
      }
    });
  }

  /**
   * Public API
   */

  /**
   * Get current connection state
   */
  async getConnectionState(): Promise<WalletConnectionState> {
    const availableProviders = Array.from(this.providers.values());
    let address: string | null = null;
    let chainId: string | null = null;
    let isConnected = false;

    if (this.activeProvider) {
      try {
        isConnected = await this.activeProvider.isConnected();
        if (isConnected) {
          const accounts = await this.activeProvider.request('eth_accounts');
          address = accounts?.[0] || null;
          chainId = await this.activeProvider.request('eth_chainId');
        }
      } catch (error) {
        console.warn('Error getting connection state:', error);
      }
    }

    return {
      isAvailable: availableProviders.length > 0,
      isConnected,
      activeProvider: this.activeProvider,
      availableProviders,
      address,
      chainId,
    };
  }

  /**
   * Connect to a wallet
   */
  async connect(providerName?: string): Promise<string[]> {
    let targetProvider = this.activeProvider;

    // Use specific provider if requested
    if (providerName && this.providers.has(providerName)) {
      targetProvider = this.providers.get(providerName)!;
      this.activeProvider = targetProvider;
    }

    if (!targetProvider) {
      throw new Error('No wallet provider available');
    }

    try {
      const accounts = await targetProvider.request('eth_requestAccounts');
      this.emit({ type: 'connection-change', provider: targetProvider });
      return accounts;
    } catch (error) {
      const errorMessage = (error as Error).message;

      // Handle common wallet errors gracefully
      if (errorMessage.includes('User rejected') || errorMessage.includes('User denied')) {
        console.log('User rejected wallet connection');
      } else if (errorMessage.includes('extension not found') || errorMessage.includes('not found')) {
        console.warn('Wallet extension not found or not installed');
      } else {
        console.error('Wallet connection failed:', errorMessage);
      }

      this.emit({ type: 'error', error: error as Error });
      throw error;
    }
  }

  /**
   * Make a request using the active provider
   */
  async request(method: string, params?: any[]): Promise<any> {
    if (!this.activeProvider) {
      throw new Error('No active wallet provider');
    }

    // Try active provider first
    try {
      return await this.activeProvider.request(method, params);
    } catch (error) {
      const errorMessage = (error as Error).message;

      // Log specific error types for debugging
      if (errorMessage.includes('extension not found')) {
        console.warn(`Wallet provider ${this.activeProvider.name} not available`);
      } else if (errorMessage.includes('User rejected')) {
        console.log('User rejected wallet request');
        throw error; // Don't try fallbacks for user rejection
      }

      // Try fallback providers
      const fallbacks = Array.from(this.providers.values())
        .filter(p => p !== this.activeProvider)
        .sort((a, b) => b.priority - a.priority);

      for (const provider of fallbacks) {
        try {
          const result = await provider.request(method, params);
          // Switch to working provider
          this.activeProvider = provider;
          this.emit({ type: 'provider-change', provider });
          return result;
        } catch {
          continue;
        }
      }

      throw error;
    }
  }

  /**
   * Get available provider names
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Switch to a specific provider
   */
  async switchProvider(name: string): Promise<void> {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider ${name} not found`);
    }

    this.activeProvider = provider;
    this.emit({ type: 'provider-change', provider });
  }

  /**
   * Add event listener
   */
  addEventListener(listener: (event: WalletEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopMonitoring();
    this.providers.clear();
    this.listeners.clear();
    this.activeProvider = null;
    this.isInitialized = false;
  }
}

// Singleton instance
export const walletProviderManager = new WalletProviderManager();

// Type augmentation for window object
declare global {
  interface Window {
    walletApi?: {
      getProvider: () => any;
      request: (method: string, params?: any[]) => Promise<any>;
      isAvailable: () => boolean;
    };
    safeWallet?: {
      getProvider: () => any;
      request: (method: string, params?: any[]) => Promise<any>;
      isAvailable: () => boolean;
      getAddress: () => Promise<string | null>;
      getChainId: () => Promise<string | null>;
    };
    __walletState?: {
      current: any;
      providers: any[];
      original: any;
      backpack: any;
    };
  }
}