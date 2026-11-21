/**
 * Error Reporter
 * 
 * Handles error logging, reporting, and telemetry.
 * Provides different reporting strategies for different environments.
 */

import { AppError, ErrorInfo, ErrorSeverity, ErrorCategory } from './error-types';
import * as Sentry from "@sentry/react";

// The minute gift's line lives in the URL fragment; reports from that
// room carry only origin + pathname so it can never ride along.
function reportUrl(): string {
  const { origin, pathname, search } = window.location;
  if (
    /^\/decompress\/?$/i.test(pathname) &&
    new URLSearchParams(search).get("room") === "minute"
  ) {
    return origin + pathname;
  }
  return window.location.href;
}

export interface ErrorReportConfig {
  enableConsoleLogging: boolean;
  enableRemoteReporting: boolean;
  enableLocalStorage: boolean;
  maxStoredErrors: number;
  reportingEndpoint?: string;
  apiKey?: string;
  userId?: string;
  sessionId?: string;
  environment: 'development' | 'staging' | 'production';
}

export interface ErrorReport extends ErrorInfo {
  url: string;
  userAgent: string;
  userId?: string;
  sessionId?: string;
  environment: string;
  buildVersion?: string;
  additionalContext?: Record<string, any>;
  // Vision-specific fields
  visionError?: boolean;
  faceMeshError?: boolean;
  mediaPipeError?: boolean;
  cameraPermission?: boolean;
  visionModelLoaded?: boolean;
  faceDetectionActive?: boolean;
}

interface ErrorMetrics {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  lastErrorTime: number;
  sessionErrors: ErrorReport[];
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: ErrorReportConfig = {
  enableConsoleLogging: true,
  enableRemoteReporting: false,
  enableLocalStorage: true,
  maxStoredErrors: 100,
  environment: (import.meta.env.MODE as 'development' | 'staging' | 'production') || 'development',
};

/**
 * Error Reporter Class
 */
class ErrorReporter {
  private config: ErrorReportConfig;
  private metrics: ErrorMetrics;
  private sessionId: string;

  constructor(config: Partial<ErrorReportConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    // DRY: Use session ID from session store if available, fallback to generated ID
    this.sessionId = this.getActiveSessionId() || this.generateSessionId();
    this.metrics = this.initializeMetrics();

    // Setup global error handlers
    this.setupGlobalHandlers();
  }

  /**
   * Get active session ID from session store
   * CLEAN: Single source of truth for session IDs
   */
  private getActiveSessionId(): string | null {
    try {
      // Use dynamic import for browser compatibility
      // This will be called synchronously, so we can't use async import here
      // Return null and let the fallback ID generation handle it
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Generate unique session ID (fallback only)
   * ORGANIZED: Different format for error reporting vs active sessions
   */
  private generateSessionId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize error metrics
   */
  private initializeMetrics(): ErrorMetrics {
    return {
      totalErrors: 0,
      errorsByCategory: Object.values(ErrorCategory).reduce((acc, category) => {
        acc[category] = 0;
        return acc;
      }, {} as Record<ErrorCategory, number>),
      errorsBySeverity: Object.values(ErrorSeverity).reduce((acc, severity) => {
        acc[severity] = 0;
        return acc;
      }, {} as Record<ErrorSeverity, number>),
      lastErrorTime: 0,
      sessionErrors: [],
    };
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalHandlers(): void {
    // Handle unhandled errors
    window.addEventListener('error', (event) => {
      const error = new AppError(
        event.message,
        ErrorCategory.UNKNOWN,
        ErrorSeverity.HIGH,
        undefined,
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
        }
      );
      this.reportError(error);
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = new AppError(
        event.reason?.message || 'Unhandled promise rejection',
        ErrorCategory.UNKNOWN,
        ErrorSeverity.HIGH,
        undefined,
        {
          reason: event.reason,
          stack: event.reason?.stack,
        }
      );
      this.reportError(error);
    });
  }

  /**
   * Report an error
   */
  async reportError(error: AppError, additionalContext?: Record<string, any>): Promise<void> {
    try {
      const errorReport = this.createErrorReport(error, additionalContext);

      // Update metrics
      this.updateMetrics(error);

      // Console logging
      if (this.config.enableConsoleLogging) {
        this.logToConsole(errorReport);
      }

      // Local storage
      if (this.config.enableLocalStorage) {
        this.storeErrorLocally(errorReport);
      }

      // Remote reporting
      if (this.config.enableRemoteReporting && this.shouldReportRemotely(error)) {
        // Report to Sentry
        Sentry.withScope((scope) => {
          scope.setTag("category", error.category);
          scope.setTag("severity", error.severity);
          scope.setTag("sessionId", this.sessionId);
          if (this.config.userId) scope.setUser({ id: this.config.userId });
          if (additionalContext) scope.setContext("additional", additionalContext);
          if (error.context) scope.setContext("error_context", error.context);
          
          Sentry.captureException(error);
        });

        // Also call generic endpoint if configured
        if (this.config.reportingEndpoint) {
          await this.sendToRemote(errorReport);
        }
      }

    } catch (reportingError) {
      console.error('Error reporting failed:', reportingError);
    }
  }

  /**
   * Create error report from AppError
   */
  private createErrorReport(error: AppError, additionalContext?: Record<string, any>): ErrorReport {
    return {
      ...error.toErrorInfo(),
      url: reportUrl(),
      userAgent: navigator.userAgent,
      userId: this.config.userId,
      sessionId: this.sessionId,
      environment: this.config.environment,
      buildVersion: import.meta.env.VITE_APP_VERSION,
      additionalContext,
    };
  }

  /**
   * Update error metrics
   */
  private updateMetrics(error: AppError): void {
    this.metrics.totalErrors++;
    this.metrics.errorsByCategory[error.category]++;
    this.metrics.errorsBySeverity[error.severity]++;
    this.metrics.lastErrorTime = Date.now();
  }

  /**
   * Log error to console with appropriate level
   */
  private logToConsole(errorReport: ErrorReport): void {
    const logLevel = this.getConsoleLogLevel(errorReport.severity);

    console[logLevel](`[${errorReport.severity.toUpperCase()}] ${errorReport.category}:`, {
      message: errorReport.message,
      id: errorReport.id,
      context: errorReport.context,
      additionalContext: errorReport.additionalContext,
    });

    // Log stack trace for development
    if (this.config.environment === 'development' && errorReport.stack) {
      console.groupCollapsed('Stack Trace');
      console.log(errorReport.stack);
      console.groupEnd();
    }
  }

  /**
   * Get appropriate console log level
   */
  private getConsoleLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'info' | 'log' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.LOW:
        return 'info';
      default:
        return 'log';
    }
  }

  /**
   * Store error in local storage
   */
  private storeErrorLocally(errorReport: ErrorReport): void {
    try {
      const stored = this.getStoredErrors();
      stored.push(errorReport);

      // Keep only recent errors
      const trimmed = stored.slice(-this.config.maxStoredErrors);

      localStorage.setItem('app_errors', JSON.stringify(trimmed));

      // Update session errors
      this.metrics.sessionErrors.push(errorReport);
      if (this.metrics.sessionErrors.length > 50) {
        this.metrics.sessionErrors = this.metrics.sessionErrors.slice(-50);
      }

    } catch (storageError) {
      console.warn('Failed to store error locally:', storageError);
    }
  }

  /**
   * Get stored errors from local storage
   */
  private getStoredErrors(): ErrorReport[] {
    try {
      const stored = localStorage.getItem('app_errors');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  /**
   * Determine if error should be reported remotely
   */
  private shouldReportRemotely(error: AppError): boolean {
    // Don't report low severity errors in development
    if (this.config.environment === 'development' && error.severity === ErrorSeverity.LOW) {
      return false;
    }

    // Always report critical errors
    if (error.severity === ErrorSeverity.CRITICAL) {
      return true;
    }

    // Sample non-critical errors to avoid spam
    if (error.severity === ErrorSeverity.LOW) {
      return Math.random() < 0.1; // 10% sampling
    }

    return true;
  }

  /**
   * Send error report to remote endpoint
   */
  private async sendToRemote(errorReport: ErrorReport): Promise<void> {
    if (!this.config.reportingEndpoint) {
      return;
    }

    try {
      const response = await fetch(this.config.reportingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify(errorReport),
      });

      if (!response.ok) {
        console.warn('Error reporting failed:', response.statusText);
      }

    } catch (networkError) {
      console.warn('Error reporting network failure:', networkError);
    }
  }

  /**
   * Get error metrics for debugging/monitoring
   */
  getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }


  /**
   * Clear stored errors
   */
  clearStoredErrors(): void {
    localStorage.removeItem('app_errors');
    this.metrics.sessionErrors = [];
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ErrorReportConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set user context
   */
  setUser(userId: string, additionalData?: Record<string, any>): void {
    this.config.userId = userId;
    if (additionalData) {
      // Store additional user context if needed
    }
  }

  /**
   * Update session ID when a new session starts
   * MODULAR: Allows error reporter to track session changes
   */
  updateSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /**
   * Create error report for external errors
   */
  reportExternalError(
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context?: Record<string, any>
  ): void {
    const error = new AppError(message, category, severity, undefined, context);
    this.reportError(error);
  }

  /**
   * Batch report multiple errors
   */
  async reportErrors(errors: AppError[]): Promise<void> {
    for (const error of errors) {
      await this.reportError(error);
    }
  }

  /**
   * Export error data for analysis
   */
  exportErrorData(): {
    metrics: ErrorMetrics;
    storedErrors: ErrorReport[];
    config: Partial<ErrorReportConfig>;
  } {
    return {
      metrics: this.getMetrics(),
      storedErrors: this.getStoredErrors(),
      config: {
        environment: this.config.environment,
        maxStoredErrors: this.config.maxStoredErrors,
        enableConsoleLogging: this.config.enableConsoleLogging,
        enableRemoteReporting: this.config.enableRemoteReporting,
      },
    };
  }

  /**
   * Report vision-specific errors with enhanced context
   */
  reportVisionError(
    error: AppError,
    visionContext?: {
      cameraPermission?: boolean;
      visionModelLoaded?: boolean;
      faceDetectionActive?: boolean;
      landmarksCount?: number;
      confidence?: number;
    }
  ): void {
    const enhancedContext = {
      ...error.context,
      ...visionContext,
      visionError: true,
    };

    this.reportError(error, enhancedContext);
  }

  /**
   * Get vision-specific error metrics
   */
  getVisionMetrics(): {
    totalVisionErrors: number;
    faceMeshErrors: number;
    mediaPipeErrors: number;
    cameraPermissionErrors: number;
    modelLoadingErrors: number;
    recentVisionErrors: ErrorReport[];
  } {
    const allErrors = this.getStoredErrors();
    const visionErrors = allErrors.filter(error =>
      error.visionError || error.faceMeshError || error.mediaPipeError
    );

    return {
      totalVisionErrors: visionErrors.length,
      faceMeshErrors: visionErrors.filter(e => e.faceMeshError).length,
      mediaPipeErrors: visionErrors.filter(e => e.mediaPipeError).length,
      cameraPermissionErrors: visionErrors.filter(e => e.context?.cameraPermission === false).length,
      modelLoadingErrors: visionErrors.filter(e => e.message?.toLowerCase().includes('model')).length,
      recentVisionErrors: visionErrors.slice(-10), // Last 10 vision errors
    };
  }

  /**
   * Report successful vision initialization for analytics
   */
  reportVisionSuccess(context: {
    sessionId: string;
    modelLoadTime?: number;
    initialDetectionTime?: number;
    landmarksCount?: number;
    confidence?: number;
  }): void {
    if (this.config.environment === 'development') {
      console.log('🎥 Vision system initialized successfully:', context);
    }

    // Store success metrics for analysis
    try {
      const successData = {
        type: 'vision_success',
        timestamp: Date.now(),
        ...context,
      };

      const stored = this.getStoredErrors();
      stored.push(successData as any);

      const trimmed = stored.slice(-this.config.maxStoredErrors);
      localStorage.setItem('app_errors', JSON.stringify(trimmed));
    } catch (error) {
      console.warn('Failed to store vision success metrics:', error);
    }
  }
}

// Create and export singleton instance
export const errorReporter = new ErrorReporter({
  environment: (import.meta.env.MODE as 'development' | 'staging' | 'production') || 'development',
  enableRemoteReporting: import.meta.env.PROD,
  reportingEndpoint: import.meta.env.VITE_ERROR_REPORTING_ENDPOINT,
  apiKey: import.meta.env.VITE_ERROR_REPORTING_API_KEY,
});

// Export class for custom instances
export { ErrorReporter };