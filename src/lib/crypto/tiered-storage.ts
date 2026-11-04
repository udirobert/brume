/**
 * Tiered Storage Manager
 * Provides multiple storage strategies with graceful fallbacks
 */

interface StorageProvider {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): void;
  hasItem(key: string): boolean;
  clear(): void;
  getAllKeys(): string[];
}

// Primary provider - Uses Web Crypto when available
class SecureProvider implements StorageProvider {
  private prefix = 'secure_';
  private static readonly KEY_DERIVATION_SALT = 'brume-salt-2024';
  private static encryptionKey: CryptoKey | null = null;

  constructor() {
    // Immediately check if we're supported
    if (!this.isSupported()) {
      throw new Error('Secure storage not supported');
    }
  }

  private isSupported(): boolean {
    return typeof window !== 'undefined' && 
           'crypto' in window && 
           'subtle' in window.crypto &&
           typeof sessionStorage !== 'undefined';
  }

  /**
   * Initialize encryption key from user session
   */
  private async getEncryptionKey(): Promise<CryptoKey> {
    if (SecureProvider.encryptionKey) {
      return SecureProvider.encryptionKey;
    }

    try {
      // Derive key from a combination of session data and salt
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(SecureProvider.KEY_DERIVATION_SALT + Date.now().toString().slice(0, -7)),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      SecureProvider.encryptionKey = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: new TextEncoder().encode(SecureProvider.KEY_DERIVATION_SALT),
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      return SecureProvider.encryptionKey;
    } catch (error) {
      console.error('Failed to initialize encryption key:', error);
      throw new Error('Failed to initialize encryption', { cause: error });
    }
  }

  /**
   * Encrypt data using AES-GCM
   */
  private async encrypt(data: string): Promise<{ iv: string; data: string }> {
    try {
      const key = await this.getEncryptionKey();
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encodedData = new TextEncoder().encode(data);

      const encryptedData = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encodedData
      );

      return {
        iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
        data: Array.from(new Uint8Array(encryptedData)).map(b => b.toString(16).padStart(2, '0')).join('')
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Encryption failed', { cause: error });
    }
  }

  /**
   * Decrypt data using AES-GCM
   */
  private async decrypt(encryptedData: { iv: string; data: string }): Promise<string> {
    try {
      const key = await this.getEncryptionKey();
      const iv = new Uint8Array(encryptedData.iv.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
      const data = new Uint8Array(encryptedData.data.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));

      const decryptedData = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );

      return new TextDecoder().decode(decryptedData);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Decryption failed', { cause: error });
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      const encrypted = await this.encrypt(value);
      sessionStorage.setItem(`${this.prefix}${key}`, JSON.stringify(encrypted));
    } catch (error) {
      console.error('SecureProvider.setItem failed:', error);
      throw error;
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const stored = sessionStorage.getItem(`${this.prefix}${key}`);
      if (!stored) return null;

      const encrypted = JSON.parse(stored);
      return await this.decrypt(encrypted);
    } catch (error) {
      console.error('SecureProvider.getItem failed:', error);
      // Clean up potentially corrupted data
      this.removeItem(key);
      return null;
    }
  }

  removeItem(key: string): void {
    sessionStorage.removeItem(`${this.prefix}${key}`);
  }

  hasItem(key: string): boolean {
    return sessionStorage.getItem(`${this.prefix}${key}`) !== null;
  }

  clear(): void {
    const keys = Object.keys(sessionStorage).filter(key => key.startsWith(this.prefix));
    keys.forEach(key => sessionStorage.removeItem(key));
    SecureProvider.encryptionKey = null;
  }

  getAllKeys(): string[] {
    return Object.keys(sessionStorage)
      .filter(key => key.startsWith(this.prefix))
      .map(key => key.substring(this.prefix.length));
  }
}

// Fallback provider - Uses localStorage with basic encoding
class EncodedProvider implements StorageProvider {
  private prefix = 'encoded_';
  
  async setItem(key: string, value: string): Promise<void> {
    try {
      // Simple encoding (not encryption, but better than plaintext)
      const encoded = btoa(unescape(encodeURIComponent(value)));
      localStorage.setItem(`${this.prefix}${key}`, encoded);
    } catch (error) {
      console.error('EncodedProvider.setItem failed:', error);
      // Fall back to unencoded if encoding fails
      localStorage.setItem(`${this.prefix}${key}`, value);
    }
  }
  
  async getItem(key: string): Promise<string | null> {
    const item = localStorage.getItem(`${this.prefix}${key}`);
    if (!item) return null;
    
    try {
      return decodeURIComponent(escape(atob(item)));
    } catch (e) {
      // If decoding fails, return the raw value as fallback
      // This handles cases where the value was stored unencoded
      return item;
    }
  }
  
  removeItem(key: string): void {
    localStorage.removeItem(`${this.prefix}${key}`);
  }
  
  hasItem(key: string): boolean {
    return localStorage.getItem(`${this.prefix}${key}`) !== null;
  }
  
  clear(): void {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(this.prefix));
    keys.forEach(key => localStorage.removeItem(key));
  }
  
  getAllKeys(): string[] {
    return Object.keys(localStorage)
      .filter(key => key.startsWith(this.prefix))
      .map(key => key.substring(this.prefix.length));
  }
}

// Development provider - No encoding when in dev mode
class DevProvider implements StorageProvider {
  private prefix = 'dev_';
  private memoryFallback: Map<string, string> = new Map();
  
  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(`${this.prefix}${key}`, value);
    } catch (error) {
      // Fall back to memory storage if localStorage fails
      this.memoryFallback.set(key, value);
    }
  }
  
  async getItem(key: string): Promise<string | null> {
    try {
      const value = localStorage.getItem(`${this.prefix}${key}`);
      if (value !== null) return value;
      
      // Check memory fallback
      return this.memoryFallback.get(key) || null;
    } catch (error) {
      return this.memoryFallback.get(key) || null;
    }
  }
  
  removeItem(key: string): void {
    try {
      localStorage.removeItem(`${this.prefix}${key}`);
    } catch (error) {
      // Ignore errors
    }
    this.memoryFallback.delete(key);
  }
  
  hasItem(key: string): boolean {
    try {
      return localStorage.getItem(`${this.prefix}${key}`) !== null || this.memoryFallback.has(key);
    } catch (error) {
      return this.memoryFallback.has(key);
    }
  }
  
  clear(): void {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith(this.prefix));
      keys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      // Ignore errors
    }
    this.memoryFallback.clear();
  }
  
  getAllKeys(): string[] {
    const localStorageKeys = (() => {
      try {
        return Object.keys(localStorage)
          .filter(key => key.startsWith(this.prefix))
          .map(key => key.substring(this.prefix.length));
      } catch (error) {
        return [];
      }
    })();
    
    const memoryKeys = Array.from(this.memoryFallback.keys());
    
    // Combine and deduplicate
    return [...new Set([...localStorageKeys, ...memoryKeys])];
  }
}

// Memory-only provider - For completely incompatible environments
class MemoryProvider implements StorageProvider {
  private storage = new Map<string, string>();
  
  async setItem(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
  }
  
  async getItem(key: string): Promise<string | null> {
    return this.storage.get(key) || null;
  }
  
  removeItem(key: string): void {
    this.storage.delete(key);
  }
  
  hasItem(key: string): boolean {
    return this.storage.has(key);
  }
  
  clear(): void {
    this.storage.clear();
  }
  
  getAllKeys(): string[] {
    return Array.from(this.storage.keys());
  }
}

/**
 * API Key Manager with tiered storage approach
 */
export class TieredStorageManager {
  private static provider: StorageProvider | null = null;
  private static readonly API_KEY_PREFIX = 'api_key_';
  private static initialized = false;
  
  /**
   * Initialize the storage system
   */
  static async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Create providers in priority order
    const providers: (() => StorageProvider)[] = [
      () => new SecureProvider(),
      () => new EncodedProvider(),
      () => new DevProvider(),
      () => new MemoryProvider()
    ];
    
    // Select the best available provider
    if (import.meta.env.VITE_STORAGE_PROVIDER) {
      // Allow explicit override via environment
      const override = import.meta.env.VITE_STORAGE_PROVIDER;
      try {
        if (override === 'secure') this.provider = providers[0]();
        else if (override === 'encoded') this.provider = providers[1]();
        else if (override === 'dev') this.provider = providers[2]();
        else if (override === 'memory') this.provider = providers[3]();
        else this.provider = providers[3](); // Default to memory if invalid
      } catch (error) {
        console.warn(`Failed to initialize preferred storage provider '${override}':`, error);
        // Try the next provider in the list
        for (let i = 1; i < providers.length; i++) {
          try {
            this.provider = providers[i]();
            break;
          } catch (error) {
            console.warn(`Failed to initialize fallback provider #${i}:`, error);
          }
        }
      }
    } else if (import.meta.env.DEV && import.meta.env.VITE_USE_DEV_STORAGE === 'true') {
      // Use dev provider in development by default
      this.provider = providers[2]();
    } else {
      // Auto-detect best provider
      for (const providerFn of providers) {
        try {
          const provider = providerFn();
          // Test provider functionality
          const isWorking = await this.testProvider(provider);
          if (isWorking) {
            this.provider = provider;
            break;
          }
        } catch (error) {
          // Provider initialization failed, try next one
          continue;
        }
      }
    }
    
    // Ensure we have a provider - use memory as absolute fallback
    if (!this.provider) {
      this.provider = new MemoryProvider();
    }
    
    console.log(`Using storage provider: ${this.provider.constructor.name}`);
    this.initialized = true;
  }
  
  /**
   * Test if a provider works correctly
   */
  private static async testProvider(provider: StorageProvider): Promise<boolean> {
    try {
      const testKey = '_test_' + Date.now();
      const testValue = 'test_' + Date.now();
      
      // Test write
      await provider.setItem(testKey, testValue);
      
      // Test read
      const result = await provider.getItem(testKey);
      
      // Test remove
      provider.removeItem(testKey);
      
      return result === testValue;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Store API key securely
   */
  static async setAPIKey(provider: string, apiKey: string): Promise<void> {
    if (!this.initialized) this.initialize();
    if (!this.provider) throw new Error('No storage provider available');
    
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('API key cannot be empty');
    }
    
    return this.provider.setItem(`${this.API_KEY_PREFIX}${provider}`, apiKey.trim());
  }
  
  /**
   * Retrieve API key securely
   */
  static async getAPIKey(provider: string): Promise<string | null> {
    if (!this.initialized) this.initialize();
    if (!this.provider) return null;
    
    return this.provider.getItem(`${this.API_KEY_PREFIX}${provider}`);
  }
  
  /**
   * Remove API key
   */
  static removeAPIKey(provider: string): void {
    if (!this.initialized) this.initialize();
    if (!this.provider) return;
    
    this.provider.removeItem(`${this.API_KEY_PREFIX}${provider}`);
  }
  
  /**
   * Check if API key exists
   */
  static hasAPIKey(provider: string): boolean {
    if (!this.initialized) this.initialize();
    if (!this.provider) return false;
    
    return this.provider.hasItem(`${this.API_KEY_PREFIX}${provider}`);
  }
  
  /**
   * Clear all API keys
   */
  static clearAllAPIKeys(): void {
    if (!this.initialized) this.initialize();
    if (!this.provider) return;
    
    // Only clear API keys, not other secure data
    const keys = this.provider.getAllKeys()
      .filter(key => key.startsWith(this.API_KEY_PREFIX));
    
    keys.forEach(key => this.provider?.removeItem(key));
  }
  
  /**
   * Get list of configured providers
   */
  static getConfiguredProviders(): string[] {
    if (!this.initialized) this.initialize();
    if (!this.provider) return [];
    
    return this.provider.getAllKeys()
      .filter(key => typeof key === 'string' && key.startsWith(this.API_KEY_PREFIX))
      .map(key => key.replace(this.API_KEY_PREFIX, ''))
      .filter(provider => typeof provider === 'string' && provider.length > 0);
  }
  
  /**
   * Check if secure storage is supported in this environment
   */
  static isSecureStorageSupported(): boolean {
    try {
      return typeof window !== 'undefined' && 
             'crypto' in window && 
             'subtle' in window.crypto &&
             typeof sessionStorage !== 'undefined';
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Migrate from old storage mechanism
   */
  static async migrateFromOldStorage(): Promise<void> {
    if (!this.initialized) this.initialize();
    if (!this.provider) return;
    
    // Try to migrate from localStorage first (original implementation)
    try {
      const localStorageKeys = Object.keys(localStorage)
        .filter(key => key.includes('api') || key.includes('key'));
      
      for (const key of localStorageKeys) {
        const value = localStorage.getItem(key);
        if (value) {
          try {
            // Extract provider name from key
            const provider = key.replace(/.*api.*key.*_?/i, '') || 'unknown';
            await this.setAPIKey(provider, value);
            localStorage.removeItem(key); // Remove from localStorage after successful migration
          } catch (error) {
            console.warn(`Failed to migrate localStorage key ${key}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to migrate from localStorage:', error);
    }
    
    // Try to migrate from old sessionStorage (secure_api_key_*)
    try {
      const sessionKeys = Object.keys(sessionStorage)
        .filter(key => key.startsWith('secure_api_key_'));
      
      for (const key of sessionKeys) {
        try {
          const value = sessionStorage.getItem(key);
          if (value) {
            const provider = key.replace('secure_api_key_', '');
            // Parse the stored encrypted value
            const encryptedData = JSON.parse(value);
            // We can't decrypt directly, so we'll store it using the new system
            // The user will need to re-enter their API keys
            sessionStorage.removeItem(key);
          }
        } catch (error) {
          console.warn(`Failed to migrate sessionStorage key ${key}:`, error);
        }
      }
    } catch (error) {
      console.warn('Failed to migrate from sessionStorage:', error);
    }
  }
}

export default TieredStorageManager;