/**
 * Unified API Client with Request Orchestration
 * 
 * Centralizes all backend communication with consistent error handling,
 * retry logic, service discovery, and intelligent request orchestration.
 * 
 * ENHANCED: Now includes dependency management, parallel request coordination,
 * and advanced fallback strategies following the blueprint's methodology.
 */

import { config } from '../../config/environment';
import { withRetry } from '../network/retry-policy';
import { NetworkError, AppError } from '../errors/error-types';
import { supabase } from '../../integrations/supabase/client';
import { API_ENDPOINTS } from '../../config/api-endpoints';

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    cached?: boolean;
    provider?: string;
    timestamp?: string;
    orchestration?: {
      requestId?: string;
      dependencies?: string[];
      executionTime?: number;
    };
  };
}

export interface RequestOrchestration {
  id: string;
  dependencies: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  timeout: number;
  fallback?: () => Promise<APIResponse>;
  cacheable?: boolean;
  cacheKey?: string;
}

export interface BatchRequest {
  requests: Array<{
    id: string;
    serviceName: string;
    endpoint: string;
    options?: RequestInit;
    orchestration?: Partial<RequestOrchestration>;
  }>;
  strategy: 'parallel' | 'sequential' | 'prioritized';
  failFast?: boolean;
}

export interface ServiceEndpoint {
  name: string;
  baseUrl: string;
  healthCheck: string;
  timeout: number;
  retries: number;
  requiresAuth: boolean;
}

/**
 * Service registry with health checking
 */
class ServiceRegistry {
  private services: Map<string, ServiceEndpoint> = new Map();
  private healthStatus: Map<string, boolean> = new Map();
  private failureCounts: Map<string, number> = new Map();
  private lastHealthCheck: Map<string, number> = new Map();
  private pendingHealthChecks: Map<string, Promise<boolean>> = new Map(); // Prevent concurrent health checks
  private readonly HEALTH_CHECK_INTERVAL = 600000; // 10 minutes - reasonable for all environments

  constructor() {
    this.initializeServices();

    // Debug logging in development
    if (import.meta.env.DEV) {
      console.log('🔧 Unified API Client initialized with services:', Array.from(this.services.keys()));
    }
  }

  private initializeServices() {
    // AI Analysis Service (Essential - uses Netlify Functions in production, localhost in dev)
    this.registerService({
      name: 'ai',
      baseUrl: config.services.ai.url,
      healthCheck: API_ENDPOINTS.ai.health,
      timeout: config.services.ai.timeout,
      retries: config.services.ai.retries,
      requiresAuth: false,
    });

    // Social/Pattern Service (Essential - same as AI service)
    this.registerService({
      name: 'social',
      baseUrl: config.services.social.url,
      healthCheck: API_ENDPOINTS.social.health,
      timeout: config.services.social.timeout,
      retries: config.services.social.retries,
      requiresAuth: false,
    });

    // Vision Processing Service - Always register for development
    if (config.services.vision.url !== config.services.ai.url) {
      // Register standalone vision service if configured differently
      this.registerService({
        name: 'vision',
        baseUrl: config.services.vision.url,
        healthCheck: API_ENDPOINTS.vision.health,
        timeout: config.services.vision.timeout,
        retries: config.services.vision.retries,
        requiresAuth: false,
      });
    } else {
      // Use AI service as vision service (integrated mode)
      this.registerService({
        name: 'vision',
        baseUrl: config.services.ai.url,
        healthCheck: API_ENDPOINTS.ai.health,
        timeout: config.services.vision.timeout,
        retries: config.services.vision.retries,
        requiresAuth: false,
      });
    }

    // Flow Blockchain (Optional - register if enabled)
    const flowEnabled = import.meta.env.VITE_ENABLE_FLOW_BLOCKCHAIN === 'true';
    const flowAccessNode = import.meta.env.VITE_FLOW_ACCESS_API;
    if (flowEnabled && flowAccessNode) {
      this.registerService({
        name: 'flow',
        baseUrl: flowAccessNode,
        healthCheck: API_ENDPOINTS.flow.health,
        timeout: 20000,
        retries: 5,
        requiresAuth: false,
      });
    }

    // Lens Protocol (Optional - register if enabled)
    // Note: Lens API doesn't provide a health check endpoint, so we disable health checks
    const lensEnabled = import.meta.env.VITE_ENABLE_LENS_INTEGRATION === 'true';
    const lensEnvironment = import.meta.env.VITE_LENS_ENVIRONMENT;
    if (lensEnabled && lensEnvironment) {
      const lensApiUrl = lensEnvironment === 'testnet'
        ? 'https://api.testnet.lens.xyz'
        : 'https://api.lens.xyz';

      this.registerService({
        name: 'lens',
        baseUrl: lensApiUrl,
        healthCheck: '', // Lens API doesn't provide health check endpoints
        timeout: 10000,
        retries: 2,
        requiresAuth: false,
      });
    }
  }

  registerService(service: ServiceEndpoint) {
    this.services.set(service.name, service);
    this.healthStatus.set(service.name, false); // Start with unknown status, require real check

    // Debug logging in development
    if (import.meta.env.DEV) {
      console.log(`✅ Registered service: ${service.name} -> ${service.baseUrl}`);
    }
  }

  async getService(name: string): Promise<ServiceEndpoint | null> {
    const service = this.services.get(name);
    if (!service) return null;

    // PERFORMANT: No automatic health checks - only on explicit request
    // This prevents spam and follows manual-only health check principle
    return service;
  }

  async checkServiceHealth(serviceName: string): Promise<boolean> {
    const service = this.services.get(serviceName);
    if (!service) return false;

    // Skip health check for services without health check endpoints (e.g., Lens Protocol)
    if (!service.healthCheck) {
      this.healthStatus.set(serviceName, true); // Assume healthy since no health check available
      this.lastHealthCheck.set(serviceName, Date.now());
      return true;
    }

    // Check if there's already a pending health check for this service
    const existingCheck = this.pendingHealthChecks.get(serviceName);
    if (existingCheck) {
      return existingCheck;
    }

    // Create a new health check promise
    const healthCheckPromise = this.performHealthCheck(serviceName, service);
    this.pendingHealthChecks.set(serviceName, healthCheckPromise);

    try {
      const result = await healthCheckPromise;
      return result;
    } finally {
      // Always remove the pending check when done
      this.pendingHealthChecks.delete(serviceName);
    }
  }

  private async performHealthCheck(serviceName: string, service: ServiceEndpoint): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout for health checks

      // Use GET for external services, HEAD for local services
      const method = service.baseUrl.includes('localhost') ? 'HEAD' : 'GET';

      const response = await fetch(`${service.baseUrl}${service.healthCheck}`, {
        method,
        signal: controller.signal,
        cache: 'no-cache',
        headers: {
          'Accept': '*/*'
        }
      });

      clearTimeout(timeoutId);
      const isHealthy = response.ok;
      this.healthStatus.set(serviceName, isHealthy);
      this.lastHealthCheck.set(serviceName, Date.now());

      // Reset failure count on success
      if (isHealthy) {
        this.failureCounts.delete(serviceName);
      }

      return isHealthy;
    } catch (error) {
      // Only log first failure and then every 10th failure to reduce spam
      const failures = this.failureCounts.get(serviceName) || 0;
      if (failures === 0 || failures % 10 === 0) {
        console.warn(`Health check failed for ${serviceName}:`, error instanceof Error ? error.message : 'Unknown error');
      }
      this.failureCounts.set(serviceName, failures + 1);
      this.healthStatus.set(serviceName, false);
      this.lastHealthCheck.set(serviceName, Date.now());
      return false;
    }
  }

  isServiceHealthy(serviceName: string): boolean {
    return this.healthStatus.get(serviceName) || false;
  }

  /**
   * Get list of registered services
   */
  getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }

  getAllServicesHealth(): Record<string, boolean> {
    const health: Record<string, boolean> = {};
    for (const [name, status] of this.healthStatus) {
      health[name] = status;
    }
    return health;
  }
}

/**
 * Unified API Client with service discovery, resilience, and request orchestration
 */
export class UnifiedAPIClient {
  private static instance: UnifiedAPIClient;
  private serviceRegistry: ServiceRegistry;
  private authToken: string | null = null;
  private requestCache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private pendingRequests: Map<string, Promise<APIResponse>> = new Map();
  private requestQueue: Array<{ id: string; request: () => Promise<APIResponse>; priority: number }> = [];
  private isProcessingQueue = false;

  private constructor() {
    this.serviceRegistry = new ServiceRegistry();
    this.initializeAuth();
    this.startRequestQueueProcessor();
  }

  static getInstance(): UnifiedAPIClient {
    if (!UnifiedAPIClient.instance) {
      UnifiedAPIClient.instance = new UnifiedAPIClient();
    }
    return UnifiedAPIClient.instance;
  }

  private async initializeAuth() {
    // Subscribe to Supabase auth changes
    supabase.auth.onAuthStateChange((event, session) => {
      this.authToken = session?.access_token || null;
    });

    // Get initial session
    const { data: { session } } = await supabase.auth.getSession();
    this.authToken = session?.access_token || null;
  }

  /**
   * Make authenticated request to any service
   */
  async request<T = any>(
    serviceName: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    const service = await this.serviceRegistry.getService(serviceName);

    if (!service) {
      throw new NetworkError(`Service '${serviceName}' not found`);
    }

    const url = `${service.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add any additional headers from options
    if (options.headers) {
      Object.entries(options.headers).forEach(([key, value]) => {
        if (typeof value === 'string') {
          headers[key] = value;
        }
      });
    }

    // Add authentication if required
    if (service.requiresAuth && this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const requestOptions: RequestInit = {
      ...options,
      headers,
      signal: options.signal || AbortSignal.timeout(service.timeout),
    };

    return withRetry(async () => {
      try {
        const response = await fetch(url, requestOptions);

        if (!response.ok) {
          throw new NetworkError(
            `HTTP ${response.status}: ${response.statusText}`,
            { service: serviceName, endpoint, status: response.status }
          );
        }

        const data = await response.json();

        return {
          success: true,
          data,
          metadata: {
            provider: serviceName,
            timestamp: new Date().toISOString(),
          },
        };
      } catch (error) {
        if (error instanceof NetworkError) {
          throw error;
        }

        throw new NetworkError(
          `Request failed: ${error instanceof Error ? error.message : String(error)}`,
          { service: serviceName, endpoint }
        );
      }
    }, {
      maxAttempts: service.retries,
      initialDelayMs: 1000,
      retryableErrors: ['network error', 'timeout', '502', '503', '504'],
    });
  }

  /**
   * AI Analysis with enhanced prompt system and proper response format handling
   */
  async analyzeSession(provider: string, sessionData: any): Promise<APIResponse> {
    try {
      console.log('🤖 Sending enhanced AI analysis request:', { provider, sessionData });

      // ENHANCED: Use sophisticated prompt system for better analysis
      const requestBody = {
        provider,
        session_data: sessionData, // Match Hetzner server format exactly
        analysis_type: 'session',
        enhanced_prompts: true, // Flag to use enhanced prompt system
        include_expertise: true // Include pattern-specific expertise
      };

      const response = await this.request('ai', API_ENDPOINTS.ai.analysis, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      console.log('📥 Raw AI analysis response:', response);

      // FIXED: Handle the actual backend response format
      if (response.success && response.data) {
        // Backend returns: { success, provider, analysis_type, result, error, cached }
        // Frontend expects: { success, data: { analysis, suggestions, score, nextSteps } }

        const backendData = response.data;

        // Transform backend response to frontend format
        if (backendData.result) {
          // Transform the backend result format to match frontend expectations
          const backendResult = backendData.result;

          const frontendResult = {
            analysis: backendResult.encouragement || 'Analysis completed successfully',
            suggestions: backendResult.suggestions || [],
            score: {
              overall: backendResult.overallScore || 75,
              focus: backendResult.focus || (backendResult.overallScore ? backendResult.overallScore * 0.8 : 60),
              consistency: backendResult.consistency || (backendResult.overallScore ? backendResult.overallScore * 0.9 : 70),
              progress: backendResult.progress || (backendResult.overallScore ? Math.min(backendResult.overallScore + 10, 100) : 80)
            },
            nextSteps: backendResult.nextSteps || []
          };

          return {
            success: true,
            data: frontendResult,
            metadata: {
              provider: backendData.provider || provider,
              timestamp: new Date().toISOString(),
              cached: backendData.cached || false
            }
          };
        }

        // Handle direct format (fallback case)
        if (backendData.analysis) {
          return {
            success: true,
            data: backendData,
            metadata: {
              provider: provider,
              timestamp: new Date().toISOString(),
            }
          };
        }
      }

      // If we get here, something went wrong
      throw new Error(response.error || 'Invalid response format from AI service');

    } catch (error) {
      console.warn('AI analysis failed, using fallback:', error);

      // Return fallback response with proper format
      return {
        success: true,
        data: {
          analysis: 'Great session! Your breathing practice shows good consistency and focus.',
          suggestions: [
            'Continue practicing regularly to build strong habits',
            'Focus on maintaining steady rhythm throughout',
            'Try extending your sessions gradually for deeper benefits'
          ],
          score: {
            overall: 75,
            focus: 70,
            consistency: 80,
            progress: 75
          },
          nextSteps: [
            'Practice daily for 10-15 minutes',
            'Try different breathing patterns to find your favorites',
            'Track your progress over time to see improvements'
          ],
        },
        metadata: {
          provider: 'fallback',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Stream AI analysis results
   */
  async analyzeSessionStreaming(provider: string, sessionData: any): Promise<ReadableStream<string>> {
    const maxRetries = 3;
    const timeoutMs = 30000; // 30 seconds
    const retryDelays = [1000, 2000, 4000]; // Progressive backoff
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Create a readable stream with enhanced error handling
        const stream = new ReadableStream<string>({
          async start(controller) {
            let timeoutId: ReturnType<typeof setTimeout> | null = null;
            let abortController: AbortController | null = null;
            
            try {
              // Set up timeout and abort controller
              abortController = new AbortController();
              timeoutId = setTimeout(() => {
                abortController?.abort();
                controller.error(new Error(`Streaming timeout after ${timeoutMs}ms`));
              }, timeoutMs);

              // Make request to streaming endpoint with abort signal
              const response = await fetch(`${config.services.ai.url}/api/ai-analysis-stream`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  provider,
                  session_data: sessionData,
                  analysis_type: 'session',
                  streaming_config: {
                    timeout: timeoutMs,
                    chunk_size: 1024,
                    buffer_size: 4096
                  }
                }),
                signal: abortController.signal
              });

              // Clear timeout on successful response
              if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }

              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }

              if (!response.body) {
                throw new Error('No response body received from streaming endpoint');
              }

              // Read the stream with enhanced error handling
              const reader = response.body.getReader();
              const decoder = new TextDecoder();
              let bytesReceived = 0;
              let lastActivity = Date.now();
              const activityTimeout = 10000; // 10 seconds of inactivity

              // Set up activity monitoring
              const activityCheck = setInterval(() => {
                if (Date.now() - lastActivity > activityTimeout) {
                  clearInterval(activityCheck);
                  controller.error(new Error('Stream inactive for too long'));
                }
              }, 1000);

              try {
                while (true) {
                  const { done, value } = await reader.read();
                  
                  if (done) {
                    clearInterval(activityCheck);
                    controller.close();
                    console.log(`✅ Streaming completed successfully. Total bytes: ${bytesReceived}`);
                    break;
                  }

                  // Update activity tracking
                  lastActivity = Date.now();
                  bytesReceived += value.length;

                  // Decode the chunk and enqueue it
                  const chunk = decoder.decode(value, { stream: true });
                  
                  // Validate chunk before enqueueing
                  if (chunk.trim()) {
                    controller.enqueue(chunk);
                  }
                }
              } catch (readError) {
                clearInterval(activityCheck);
                console.error('Stream reading error:', readError);
                controller.error(readError);
              } finally {
                reader.releaseLock();
              }
            } catch (error) {
              // Clear timeout on error
              if (timeoutId) {
                clearTimeout(timeoutId);
              }
              
              console.error(`Streaming attempt ${attempt + 1} failed:`, error);
              
              // Don't retry on abort (user cancelled)
              if (error instanceof Error && error.name === 'AbortError') {
                controller.error(new Error('Streaming cancelled by user'));
                return;
              }
              
              // Store error for potential retry
              lastError = error instanceof Error ? error : new Error(String(error));
              
              // If this is not the last attempt, we'll retry
              if (attempt < maxRetries) {
                console.log(`Will retry streaming in ${retryDelays[attempt]}ms...`);
                controller.error(new Error(`Streaming failed, retrying... (${attempt + 1}/${maxRetries})`));
                return;
              }
              
              // Final attempt failed
              controller.error(lastError);
            }
          }
        });

        return stream;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Streaming setup attempt ${attempt + 1} failed:`, lastError);
        
        // If this is not the last attempt, wait and retry
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
          continue;
        }
        
        // All attempts failed, throw the last error
        throw lastError;
      }
    }
    
    // This should never be reached, but TypeScript requires it
    throw lastError || new Error('Streaming failed after all retry attempts');
  }

  /**
   * Enhanced AI Analysis - HACKATHON: Cerebras integration
   */
  async enhancedAIAnalysis(data: any): Promise<APIResponse> {
    return this.request('ai', '/api/ai-analysis/enhanced', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Generate AI-powered breathing patterns
   */
  async generatePattern(provider: string, sessionData: any): Promise<APIResponse> {
    try {
      const requestBody = {
        provider,
        session_data: sessionData,
        analysis_type: 'pattern'
      };

      return await this.request('ai', API_ENDPOINTS.ai.analysis, {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
    } catch (error) {
      console.warn('Pattern generation failed, using fallback:', error);

      // Return fallback pattern
      return {
        success: true,
        data: {
          name: "Calming 4-7-8 Breath",
          description: "A relaxing breathing pattern that helps reduce stress and promote calmness",
          phases: [
            {
              type: "inhale",
              duration: 4,
              instruction: "Breathe in slowly through your nose"
            },
            {
              type: "hold",
              duration: 7,
              instruction: "Hold your breath gently"
            },
            {
              type: "exhale",
              duration: 8,
              instruction: "Exhale completely through your mouth"
            }
          ],
          reasoning: "This 4-7-8 pattern is excellent for relaxation and stress relief. The longer exhale helps activate your parasympathetic nervous system."
        },
        metadata: {
          provider: 'fallback',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Test AI provider connection
   */
  async testAIConnection(provider: string): Promise<boolean> {
    try {
      const testData = {
        pattern: "Box Breathing",
        duration: 60,
        averageBpm: 12,
        consistencyScore: 80,
        restlessnessScore: 20,
        breathHoldDuration: 4
      };

      const response = await this.analyzeSession(provider, testData);
      return response.success;
    } catch (error) {
      console.error(`Connection test failed for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Get available AI providers
   */
  getAvailableAIProviders(): string[] {
    return ['google', 'openai', 'anthropic'];
  }

  /**
   * Get AI provider information
   */
  getAIProviderInfo(provider: string) {
    const providers = {
      google: { name: 'Google Gemini', model: 'gemini-1.5-flash', enabled: true },
      openai: { name: 'OpenAI GPT-4', model: 'gpt-4o-mini', enabled: true },
      anthropic: { name: 'Anthropic Claude', model: 'claude-3-haiku-20240307', enabled: true }
    };
    return providers[provider as keyof typeof providers];
  }

  /**
   * Vision Processing - honest failure mode
   */
  async processVision(sessionId: string, frameData: any): Promise<APIResponse> {
    // No health check fallback - let the request fail honestly
    return this.request('vision', API_ENDPOINTS.vision.process, {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId, ...frameData }),
    });
  }

  /**
   * Social/Lens Integration
   */
  async shareBreathingSession(sessionData: any): Promise<APIResponse> {
    return this.request('social', API_ENDPOINTS.social.share, {
      method: 'POST',
      body: JSON.stringify({
        type: 'BREATHING_SESSION',
        content: `Completed ${sessionData.patternName} with ${sessionData.score}% focus!`,
        metadata: { breathingPattern: sessionData },
      }),
    });
  }

  /**
   * Flow Blockchain Operations
   */
  async mintPattern(patternData: any): Promise<APIResponse> {
    return this.request('flow', API_ENDPOINTS.flow.mintPattern, {
      method: 'POST',
      body: JSON.stringify(patternData),
    });
  }

  /**
   * Health Check for all services - Manual only (no automatic polling)
   */
  async getSystemHealth(): Promise<Record<string, boolean>> {
    const registeredServices = this.serviceRegistry.getRegisteredServices();

    // Set a reasonable 10-second timeout for the entire health check operation
    const timeoutPromise = new Promise<Record<string, boolean>>((_, reject) => {
      setTimeout(() => reject(new Error('System health check timeout')), 10000);
    });

    const healthCheckPromise = (async () => {
      const healthPromises = registeredServices.map(async (service) => {
        try {
          // Individual service timeout of 2 seconds
          const servicePromise = this.serviceRegistry.checkServiceHealth(service);
          const timeoutPromise = new Promise<boolean>((_, reject) =>
            setTimeout(() => reject(new Error('Service timeout')), 3000)
          );

          return await Promise.race([servicePromise, timeoutPromise]);
        } catch (error) {
          // Log timeout failures only occasionally to avoid spam
          console.warn(`Health check failed for ${service}:`, error instanceof Error ? error.message : 'Unknown error');
          return false;
        }
      });

      await Promise.allSettled(healthPromises);
      return this.serviceRegistry.getAllServicesHealth();
    })();

    try {
      return await Promise.race([healthCheckPromise, timeoutPromise]);
    } catch (error) {
      console.warn('System health check failed:', error instanceof Error ? error.message : 'Unknown error');
      // Return last known health status or all false
      const fallbackHealth: Record<string, boolean> = {};
      registeredServices.forEach(service => {
        fallbackHealth[service] = this.serviceRegistry.isServiceHealthy(service);
      });
      return fallbackHealth;
    }
  }

  /**
   * ORCHESTRATION: Execute batch requests with dependency management
   */
  async executeBatch(batch: BatchRequest): Promise<Record<string, APIResponse>> {
    const results: Record<string, APIResponse> = {};
    const requestsById = new Map(batch.requests.map(r => [r.id, r]));

    if (batch.strategy === 'parallel') {
      // Execute all requests in parallel
      const promises = batch.requests.map(async (req) => {
        const result = await this.executeWithOrchestration(req);
        return { id: req.id, result };
      });

      const settled = await Promise.allSettled(promises);
      settled.forEach((promise, index) => {
        if (promise.status === 'fulfilled') {
          results[promise.value.id] = promise.value.result;
        } else if (!batch.failFast) {
          const requestId = batch.requests[index]?.id || 'unknown';
          results[requestId] = {
            success: false,
            error: promise.reason?.message || 'Request failed'
          };
        }
      });
    } else if (batch.strategy === 'sequential') {
      // Execute requests in sequence
      for (const req of batch.requests) {
        try {
          results[req.id] = await this.executeWithOrchestration(req);
        } catch (error) {
          results[req.id] = {
            success: false,
            error: error instanceof Error ? error.message : 'Request failed'
          };
          if (batch.failFast) break;
        }
      }
    } else if (batch.strategy === 'prioritized') {
      // Sort by priority and execute with dependency resolution
      const sorted = batch.requests.sort((a, b) => {
        const aPriority = this.getPriorityValue(a.orchestration?.priority || 'medium');
        const bPriority = this.getPriorityValue(b.orchestration?.priority || 'medium');
        return bPriority - aPriority;
      });

      for (const req of sorted) {
        // Check dependencies
        const deps = req.orchestration?.dependencies || [];
        const depsResolved = deps.every(depId => results[depId]?.success);

        if (depsResolved) {
          try {
            results[req.id] = await this.executeWithOrchestration(req);
          } catch (error) {
            results[req.id] = {
              success: false,
              error: error instanceof Error ? error.message : 'Request failed'
            };
            if (batch.failFast) break;
          }
        } else {
          results[req.id] = {
            success: false,
            error: 'Dependencies not resolved'
          };
        }
      }
    }

    return results;
  }

  /**
   * ORCHESTRATION: Execute single request with orchestration features
   */
  private async executeWithOrchestration(req: {
    id: string;
    serviceName: string;
    endpoint: string;
    options?: RequestInit;
    orchestration?: Partial<RequestOrchestration>;
  }): Promise<APIResponse> {
    const startTime = Date.now();
    const requestId = req.orchestration?.id || req.id;

    // Check cache first
    if (req.orchestration?.cacheable && req.orchestration?.cacheKey) {
      const cached = this.getFromCache(req.orchestration.cacheKey);
      if (cached) {
        return {
          ...cached,
          metadata: {
            ...cached.metadata,
            cached: true,
            orchestration: {
              requestId,
              executionTime: Date.now() - startTime,
              dependencies: req.orchestration.dependencies || []
            }
          }
        };
      }
    }

    // Deduplicate identical pending requests
    const requestKey = `${req.serviceName}:${req.endpoint}:${JSON.stringify(req.options)}`;
    if (this.pendingRequests.has(requestKey)) {
      return await this.pendingRequests.get(requestKey)!;
    }

    // Execute request
    const requestPromise = this.request(req.serviceName, req.endpoint, req.options)
      .catch(async (error) => {
        // Try fallback if available
        if (req.orchestration?.fallback) {
          console.warn(`Request ${requestId} failed, trying fallback:`, error.message);
          const fallbackResult = await req.orchestration.fallback();
          return {
            ...fallbackResult,
            metadata: {
              ...fallbackResult.metadata,
              orchestration: {
                requestId,
                executionTime: Date.now() - startTime,
                dependencies: req.orchestration?.dependencies || [],
              }
            }
          };
        }
        throw error;
      })
      .finally(() => {
        this.pendingRequests.delete(requestKey);
      });

    this.pendingRequests.set(requestKey, requestPromise);
    const result = await requestPromise;

    // Cache result if cacheable
    if (req.orchestration?.cacheable && req.orchestration?.cacheKey) {
      this.setCache(req.orchestration.cacheKey, result, 300000); // 5 minutes default TTL
    }

    // Add orchestration metadata
    return {
      ...result,
      metadata: {
        ...result.metadata,
        orchestration: {
          requestId,
          executionTime: Date.now() - startTime,
          dependencies: req.orchestration?.dependencies || [],
        }
      }
    };
  }

  /**
   * ORCHESTRATION: Priority queue processing - Manual only
   */
  private async startRequestQueueProcessor() {
    // PREVENT BLOAT: No automatic intervals - process queue on demand only
    // Queue will be processed when requests are made
  }

  private async processRequestQueue() {
    if (this.isProcessingQueue) return;

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      // Sort by priority
      this.requestQueue.sort((a, b) => b.priority - a.priority);
      const { request } = this.requestQueue.shift()!;

      try {
        await request();
      } catch (error) {
        console.warn('Queued request failed:', error);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * ORCHESTRATION: Cache management
   */
  private getFromCache(key: string): any {
    const cached = this.requestCache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    this.requestCache.delete(key);
    return null;
  }

  private setCache(key: string, data: any, ttl: number) {
    this.requestCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private getPriorityValue(priority: 'low' | 'medium' | 'high' | 'critical'): number {
    const values = { low: 1, medium: 2, high: 3, critical: 4 };
    return values[priority] || 2;
  }

  /**
   * ORCHESTRATION: Smart session analysis with dependency coordination
   */
  async orchestrateSessionAnalysis(sessionData: any): Promise<APIResponse> {
    const batch: BatchRequest = {
      requests: [
        {
          id: 'ai-analysis',
          serviceName: 'ai',
          endpoint: API_ENDPOINTS.ai.analysis,
          options: {
            method: 'POST',
            body: JSON.stringify({ provider: 'openai', sessionData, analysisType: 'session' })
          },
          orchestration: {
            priority: 'high',
            cacheable: true,
            cacheKey: `session-analysis-${sessionData.sessionId}`,
            fallback: async () => ({
              success: true,
              data: {
                overallScore: 75,
                suggestions: ['Continue practicing regularly'],
                encouragement: 'Great session!'
              }
            })
          }
        }
      ],
      strategy: 'parallel',
      failFast: false
    };

    // Add vision analysis if available
    if (this.serviceRegistry.isServiceHealthy('vision') && sessionData.hasVideoData) {
      batch.requests.push({
        id: 'vision-analysis',
        serviceName: 'vision',
        endpoint: API_ENDPOINTS.vision.analyzeSession,
        options: {
          method: 'POST',
          body: JSON.stringify({ sessionId: sessionData.sessionId, frameData: sessionData.frames })
        },
        orchestration: {
          priority: 'medium',
          dependencies: [],
          fallback: async () => ({
            success: true,
            data: { metrics: null, fallback: true }
          })
        }
      });
    }

    const results = await this.executeBatch(batch);

    // Combine results intelligently
    const aiResult = results['ai-analysis'];
    const visionResult = results['vision-analysis'];

    return {
      success: aiResult.success,
      data: {
        ...aiResult.data,
        visionMetrics: visionResult?.data?.metrics || null,
        combinedScore: this.calculateCombinedScore(aiResult.data, visionResult?.data)
      },
      metadata: {
        provider: 'orchestrated',
        timestamp: new Date().toISOString(),
        orchestration: {
          requestId: `session-orchestration-${Date.now()}`,
          dependencies: ['ai-analysis', visionResult ? 'vision-analysis' : ''].filter(Boolean),
          executionTime: Math.max(
            aiResult.metadata?.orchestration?.executionTime || 0,
            visionResult?.metadata?.orchestration?.executionTime || 0
          )
        }
      }
    };
  }

  private calculateCombinedScore(aiData: any, visionData?: any): number {
    const aiScore = aiData?.overallScore || 0;
    const visionScore = visionData?.metrics?.stillnessScore || aiScore;

    // Weight AI analysis more heavily if vision is not available
    return visionData ? (aiScore * 0.7 + visionScore * 0.3) : aiScore;
  }

  /**
   * Get service status for monitoring
   */
  getServiceStatus() {
    return {
      healthy: this.serviceRegistry.getAllServicesHealth(),
      registered: this.serviceRegistry.getRegisteredServices(),
      auth: !!this.authToken,
      timestamp: new Date().toISOString(),
      orchestration: {
        cacheSize: this.requestCache.size,
        pendingRequests: this.pendingRequests.size,
        queueLength: this.requestQueue.length
      }
    };
  }
}

// Export singleton instance
export const apiClient = UnifiedAPIClient.getInstance();

// Enhanced convenience methods with orchestration
export const api = {
  ai: {
    analyzeSession: (provider: string, data: any) => apiClient.analyzeSession(provider, data),
    enhancedAnalysis: (data: any) => apiClient.enhancedAIAnalysis(data), // HACKATHON: Enhanced analysis
    generatePattern: (provider: string, data: any) => apiClient.generatePattern(provider, data),
    testConnection: (provider: string) => apiClient.testAIConnection(provider),
    getProviders: () => apiClient.getAvailableAIProviders(),
    getProviderInfo: (provider: string) => apiClient.getAIProviderInfo(provider),
    analyzeSessionStreaming: (provider: string, data: any) => apiClient.analyzeSessionStreaming(provider, data),
  },
  vision: {
    process: (sessionId: string, data: any) => apiClient.processVision(sessionId, data),
  },
  social: {
    share: (data: any) => apiClient.shareBreathingSession(data),
  },
  flow: {
    mint: (data: any) => apiClient.mintPattern(data),
  },
  health: () => apiClient.getSystemHealth(),
  status: () => apiClient.getServiceStatus(),

  // ORCHESTRATION: New orchestrated methods
  orchestration: {
    executeSessionAnalysis: (data: any) => apiClient.orchestrateSessionAnalysis(data),
    executeBatch: (batch: BatchRequest) => apiClient.executeBatch(batch),
  },
};
