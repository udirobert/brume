import React from "react";
import ReactDOM from "react-dom/client";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { GlobalErrorBoundary, SessionStartupErrorBoundary } from "./lib/errors/error-boundary";
import { queryClient } from "./lib/query/config";
import * as Sentry from "@sentry/react";
import App from "./App";
import "./index.css";
import "./polyfills";

// Sentry initialization for production error tracking
if (import.meta.env.PROD) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
  });
}

// ENHANCEMENT: Initialize developer commands in development
import "./lib/developer/console-commands";
import { runEnvironmentChecks } from "./utils/environment-check";
import { optimizeForMobile } from "./utils/mobile-detection";

// Explicitly set global references for old libraries that might expect them
(window as unknown as { React: typeof React }).React = React;
(window as unknown as { ReactDOM: typeof ReactDOM }).ReactDOM = ReactDOM;

// Run environment checks before initializing the app
const envCheck = runEnvironmentChecks();
if (import.meta.env.DEV) {
  console.log("Environment check results:", envCheck);
}

// Initialize mobile optimizations
optimizeForMobile();

// Query client is now handled by EnhancedWeb3Provider

// Error handling for the root element
const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error("Root element not found! Application cannot mount.");
  // Create a fallback element to show an error message
  const fallbackElement = document.createElement("div");
  fallbackElement.innerHTML = `
    <div style="font-family: sans-serif; padding: 20px; text-align: center;">
      <h2>Application Error</h2>
      <p>The application could not initialize properly. Please refresh the page or contact support.</p>
    </div>
  `;
  document.body.appendChild(fallbackElement);
} else {
  // Enhanced error handling for React initialization
  const renderApp = () => {
    try {
      const root = createRoot(rootElement);

      root.render(
        <React.StrictMode>
          <GlobalErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <SessionStartupErrorBoundary>
                <App />
              </SessionStartupErrorBoundary>
            </QueryClientProvider>
          </GlobalErrorBoundary>
        </React.StrictMode>
      );

    } catch (rootError) {
      console.error("Error creating React root:", rootError);
      showErrorFallback(rootError);
    }
  };

  const showErrorFallback = (error: any) => {
    rootElement.innerHTML = `
      <div style="font-family: sans-serif; padding: 20px; text-align: center; min-height: 100vh; display: flex; align-items: center; justify-content: center;">
        <div style="max-width: 500px; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="width: 60px; height: 60px; background: #fee; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: #dc2626; font-size: 24px;">⚠</div>
          <h2 style="margin: 0 0 16px 0; color: #111; font-size: 24px; font-weight: 700;">Application Error</h2>
          <p style="margin: 0 0 20px 0; color: #555; line-height: 1.5;">The application encountered an initialization error. This is typically resolved by refreshing the page.</p>
          <div style="display: flex; gap: 12px; flex-direction: column;">
            <button onclick="location.reload(true)" style="background: #2563eb; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; font-family: inherit;">Reload Page</button>
            <button onclick="if(confirm('This will clear cache and reload. Continue?')){caches.keys().then(names => Promise.all(names.map(name => caches.delete(name)))).then(() => location.reload(true))}" style="background: #6b7280; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; cursor: pointer; font-family: inherit;">Clear Cache & Reload</button>
          </div>
          ${process.env.NODE_ENV === 'development' ? `
            <details style="margin-top: 20px; text-align: left;">
              <summary style="color: #6b7280; cursor: pointer; font-size: 14px;">Technical Details</summary>
              <pre style="background: #f3f4f6; padding: 12px; border-radius: 6px; font-size: 12px; overflow: auto; margin-top: 8px; color: #374151;">${error?.toString()}</pre>
            </details>
          ` : ''}
        </div>
      </div>
    `;
  };

  // Try to render the app
  renderApp();
}
