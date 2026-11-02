import React from "react";
import { ErrorBoundary } from "@/lib/errors/error-boundary";
import { ErrorCategory } from "@/lib/errors/error-types";
import { BrumeMascot } from "@/components/BrumeMascot";

export const RouteErrorFallback: React.FC<{ retry: () => void }> = ({ retry }) => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
    <BrumeMascot state="sleepy" size={88} className="mb-4" />
    <h2 className="text-xl font-semibold mb-2">Something slipped.</h2>
    <p className="text-muted-foreground mb-6 max-w-md">
      Your breath is fine. Try again, or head home.
    </p>
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={retry}
        className="brume-btn brume-btn--push px-6"
      >
        Try again
      </button>
      <a
        href="/"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Home
      </a>
    </div>
  </div>
);

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
}

const RouteErrorBoundary: React.FC<RouteErrorBoundaryProps> = ({ children }) => {
  return (
    <ErrorBoundary
      category={ErrorCategory.UNKNOWN}
      fallback={(_error, retry) => <RouteErrorFallback retry={retry} />}
    >
      {children}
    </ErrorBoundary>
  );
};

export default RouteErrorBoundary;
