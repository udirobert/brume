/**
 * Intelligent Provider Fallback System
 * 
 * Manages AI provider selection, health monitoring, and automatic fallback
 * for streaming AI analysis to ensure maximum reliability and uptime.
 */

import { api } from '../api/unified-client';
import type { SecureAIProvider } from './config';

export interface ProviderHealth {
  provider: SecureAIProvider;
  isHealthy: boolean;
  lastChecked: number;
  responseTime: number;
  errorCount: number;
  successCount: number;
  streamingSupported: boolean;
  lastError?: string;
}

export interface FallbackConfig {
  maxRetries: number;
  retryDelay: number; // milliseconds
  healthCheckInterval: number; // milliseconds
  providerTimeout: number; // milliseconds
  streamingTimeout: number; // milliseconds
  fallbackOrder: SecureAIProvider[];
}

export class ProviderFallbackManager {
  private providerHealth: Map<SecureAIProvider, ProviderHealth> = new Map();
  private config: FallbackConfig;
  private healthCheckTimer?: ReturnType<typeof setTimeout>;

  constructor(config?: Partial<FallbackConfig>) {
    this.config = {
      maxRetries: 3,
      retryDelay: 2000,
      healthCheckInterval: 60000, // 1 minute
      providerTimeout: 10000, // 10 seconds
      streamingTimeout: 30000, // 30 seconds
      fallbackOrder: ['openai', 'anthropic', 'google'],
      ...config
    };

    this.initializeProviderHealth();
    this.startHealthMonitoring();
  }

  private initializeProviderHealth(): void {
    this.config.fallbackOrder.forEach(provider => {
      this.providerHealth.set(provider, {
        provider,
        isHealthy: true,
        lastChecked: 0,
        responseTime: 0,
        errorCount: 0,
        successCount: 0,
        streamingSupported: true
      });
    });
  }

  private startHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  private async performHealthChecks(): Promise<void> {
    const promises = this.config.fallbackOrder.map(provider => 
      this.checkProviderHealth(provider)
    );

    await Promise.allSettled(promises);
  }

  private async checkProviderHealth(provider: SecureAIProvider): Promise<void> {
    const startTime = Date.now();
    const health = this.providerHealth.get(provider);
    
    if (!health) return;

    try {
      // Test basic connectivity
      const isHealthy = await Promise.race([
        api.ai.testConnection(provider),
        new Promise<boolean>((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), this.config.providerTimeout)
        )
      ]);

      const responseTime = Date.now() - startTime;

      this.updateProviderHealth(provider, {
        isHealthy,
        lastChecked: Date.now(),
        responseTime,
        successCount: health.successCount + 1,
        lastError: undefined
      });

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.updateProviderHealth(provider, {
        isHealthy: false,
        lastChecked: Date.now(),
        responseTime,
        errorCount: health.errorCount + 1,
        lastError: errorMessage
      });

      console.warn(`Provider ${provider} health check failed:`, errorMessage);
    }
  }

  private updateProviderHealth(provider: SecureAIProvider, updates: Partial<ProviderHealth>): void {
    const current = this.providerHealth.get(provider);
    if (current) {
      this.providerHealth.set(provider, { ...current, ...updates });
    }
  }

  public async getOptimalProvider(preferStreaming: boolean = true): Promise<SecureAIProvider> {
    // Update health status for all providers
    await this.performHealthChecks();

    // Sort providers by health and performance
    const sortedProviders = this.config.fallbackOrder
      .map(provider => ({
        provider,
        health: this.providerHealth.get(provider)!
      }))
      .filter(({ health }) => health.isHealthy)
      .filter(({ health }) => !preferStreaming || health.streamingSupported)
      .sort((a, b) => {
        // Prioritize by success rate
        const aSuccessRate = a.health.successCount / (a.health.successCount + a.health.errorCount) || 0;
        const bSuccessRate = b.health.successCount / (b.health.successCount + b.health.errorCount) || 0;
        
        if (aSuccessRate !== bSuccessRate) {
          return bSuccessRate - aSuccessRate;
        }

        // Then by response time
        return a.health.responseTime - b.health.responseTime;
      });

    if (sortedProviders.length === 0) {
      console.warn('No healthy providers available, using fallback');
      return 'openai'; // Fallback to openai as default
    }

    return sortedProviders[0].provider;
  }

  public async executeWithFallback<T>(
    operation: (provider: SecureAIProvider) => Promise<T>,
    preferStreaming: boolean = true
  ): Promise<T> {
    let lastError: Error | null = null;
    let attemptCount = 0;

    // Get ordered list of providers to try
    const providers = await this.getProviderFallbackOrder(preferStreaming);

    for (const provider of providers) {
      if (attemptCount >= this.config.maxRetries) {
        break;
      }

      try {
        console.log(`Attempting AI operation with provider: ${provider} (attempt ${attemptCount + 1})`);
        
        const result = await Promise.race([
          operation(provider),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Operation timeout')), this.config.providerTimeout)
          )
        ]);

        // Success - update health metrics
        this.recordSuccess(provider);
        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        attemptCount++;

        console.warn(`Provider ${provider} failed (attempt ${attemptCount}):`, lastError.message);
        
        // Record failure
        this.recordFailure(provider, lastError.message);

        // Wait before retry (except for last attempt)
        if (attemptCount < this.config.maxRetries && providers.length > attemptCount) {
          await this.delay(this.config.retryDelay * attemptCount);
        }
      }
    }

    // All providers failed
    throw new Error(`All AI providers failed after ${attemptCount} attempts. Last error: ${lastError?.message}`);
  }

  private async getProviderFallbackOrder(preferStreaming: boolean): Promise<SecureAIProvider[]> {
    const healthyProviders = this.config.fallbackOrder.filter(provider => {
      const health = this.providerHealth.get(provider);
      return health?.isHealthy && (!preferStreaming || health.streamingSupported);
    });

    // If no healthy providers, try all providers as last resort
    return healthyProviders.length > 0 ? healthyProviders : this.config.fallbackOrder;
  }

  private recordSuccess(provider: SecureAIProvider): void {
    const health = this.providerHealth.get(provider);
    if (health) {
      this.updateProviderHealth(provider, {
        successCount: health.successCount + 1,
        isHealthy: true,
        lastError: undefined
      });
    }
  }

  private recordFailure(provider: SecureAIProvider, error: string): void {
    const health = this.providerHealth.get(provider);
    if (health) {
      const newErrorCount = health.errorCount + 1;
      const successRate = health.successCount / (health.successCount + newErrorCount);
      
      this.updateProviderHealth(provider, {
        errorCount: newErrorCount,
        isHealthy: successRate > 0.5, // Mark unhealthy if success rate drops below 50%
        lastError: error
      });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getProviderHealth(): Map<SecureAIProvider, ProviderHealth> {
    return new Map(this.providerHealth);
  }

  public getHealthSummary(): { provider: SecureAIProvider; health: ProviderHealth }[] {
    return Array.from(this.providerHealth.entries()).map(([provider, health]) => ({
      provider,
      health
    }));
  }

  public destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }
}

// Global instance
export const providerFallbackManager = new ProviderFallbackManager();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    providerFallbackManager.destroy();
  });
}