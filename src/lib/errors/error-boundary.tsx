/**
 * Error Boundary Components
 *
 * React error boundaries with fallback UI and error reporting.
 * One calm surface for every failure — the screen a user sees when
 * something broke should feel like the same room, not another product.
 */

import { BrumeMascot } from '../../components/BrumeMascot';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AppError, ErrorFactory, ErrorCategory } from './error-types';
import { errorReporter } from './error-reporter';

interface ErrorBoundaryState {
  hasError: boolean;
  error: AppError | null;
  errorId: string | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: AppError, retry: () => void) => ReactNode;
  onError?: (error: AppError) => void;
  category?: ErrorCategory;
  isolate?: boolean; // If true, prevents error from bubbling up
}

/**
 * Base Error Boundary
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const appError = ErrorFactory.fromError(error);

    return {
      hasError: true,
      error: appError,
      errorId: appError.id,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const appError = ErrorFactory.fromError(
      error,
      this.props.category,
      {
        componentStack: errorInfo.componentStack,
        errorBoundary: this.constructor.name,
      }
    );

    // Report error
    errorReporter.reportError(appError);

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(appError);
    }

    // Prevent error from bubbling if isolate is true
    if (this.props.isolate) {
      return;
    }
  }

  retry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.retry);
      }

      return <DefaultErrorFallback error={this.state.error} onRetry={this.retry} />;
    }

    return this.props.children;
  }
}

/**
 * The shared calm surface every fallback renders on: mist gradient,
 * one card, the sleepy mascot, a push button, plain words.
 */
const CalmFallback: React.FC<{
  title: string;
  body: string;
  action: ReactNode;
  secondary?: ReactNode;
  details?: ReactNode;
}> = ({ title, body, action, secondary, details }) => (
  <div className="min-h-screen bg-calm-gradient flex items-center justify-center px-6">
    <div className="max-w-md w-full rounded-2xl border border-border/70 bg-card/70 backdrop-blur-sm p-8 text-center">
      <BrumeMascot state="sleepy" size={88} className="mx-auto mb-4" layoutId="brume-companion" />
      <h1 className="text-2xl font-bold tracking-tight text-foreground mb-3">{title}</h1>
      <p className="text-muted-foreground mb-6 leading-relaxed">{body}</p>
      <div className="flex flex-col items-center gap-3">
        {action}
        {secondary}
      </div>
      {details}
    </div>
  </div>
);

const PushButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  className,
  ...props
}) => (
  <button
    type="button"
    className={`brume-btn brume-btn--push px-8 ${className ?? ""}`}
    {...props}
  />
);

const QuietLink: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({
  className,
  ...props
}) => (
  <button
    type="button"
    className={`text-sm text-muted-foreground hover:text-foreground transition-colors ${className ?? ""}`}
    {...props}
  />
);

const DevDetails: React.FC<{ error: AppError }> = ({ error }) => {
  if (process.env.NODE_ENV !== 'development') return null;
  return (
    <div className="mt-6 text-left">
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
          Technical details
        </summary>
        <div className="mt-2 p-3 bg-foreground/5 rounded-xl text-xs space-y-1">
          <p><strong>Error ID:</strong> {error.id}</p>
          <p><strong>Category:</strong> {error.category}</p>
          <p><strong>Message:</strong> {error.message}</p>
          {error.stack && (
            <pre className="mt-1 overflow-auto whitespace-pre-wrap">{error.stack}</pre>
          )}
        </div>
      </details>
    </div>
  );
};

/**
 * Default Error Fallback Component
 */
interface DefaultErrorFallbackProps {
  error: AppError;
  onRetry: () => void;
}

const DefaultErrorFallback: React.FC<DefaultErrorFallbackProps> = ({ error, onRetry }) => (
  <CalmFallback
    title="Something slipped."
    body={error.userMessage || "Something didn't go as expected. You can try again — nothing is lost."}
    action={<PushButton onClick={onRetry}>Try again</PushButton>}
    secondary={<QuietLink onClick={() => window.location.reload()}>Refresh page</QuietLink>}
    details={<DevDetails error={error} />}
  />
);

/**
 * Session-specific error boundary — a session that can't start or
 * stumbles mid-breath lets itself down gently.
 */
export const SessionErrorBoundary: React.FC<Omit<ErrorBoundaryProps, 'category'>> = (props) => (
  <ErrorBoundary
    {...props}
    category={ErrorCategory.SESSION}
    fallback={(error, retry) => (
      <CalmFallback
        title="Something slipped."
        body={error.userMessage || "The session stumbled. You can start it again — nothing is lost."}
        action={<PushButton onClick={retry}>Try again</PushButton>}
        secondary={
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Back to Brume
          </a>
        }
      />
    )}
  />
);

/**
 * Session startup boundary — guards the moment a session begins.
 */
export const SessionStartupErrorBoundary: React.FC<Omit<ErrorBoundaryProps, 'category'>> = (props) => (
  <ErrorBoundary
    {...props}
    category={ErrorCategory.SESSION}
    fallback={(error, retry) => (
      <CalmFallback
        title="The session couldn't get ready."
        body={error.userMessage || "Preparing your breathing session hit a snag. Trying again usually clears it."}
        action={<PushButton onClick={retry}>Try again</PushButton>}
        secondary={
          <a href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Back to Brume
          </a>
        }
      />
    )}
  />
);

/**
 * Global error boundary — the last resort.
 */
export const GlobalErrorBoundary: React.FC<ErrorBoundaryProps> = (props) => (
  <ErrorBoundary
    {...props}
    onError={(error) => {
      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Global error caught:', error);
      }

      // Call custom handler if provided
      props.onError?.(error);
    }}
    fallback={(error, retry) => (
      <CalmFallback
        title="Something went wrong."
        body={error.userMessage || "The app stumbled. Trying again usually clears it."}
        action={<PushButton onClick={retry}>Try again</PushButton>}
        secondary={<QuietLink onClick={() => window.location.reload()}>Refresh page</QuietLink>}
        details={<DevDetails error={error} />}
      />
    )}
  />
);
