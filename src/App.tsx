import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Core components that should load immediately
import MainLayout from "@/components/MainLayout";
import SessionModeWrapper from "@/components/session/SessionModeWrapper";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

import { Toaster } from "@/components/ui/sonner";

// Small pages that can load immediately
import Index from "@/pages/Index";
import Onboarding from "@/pages/Onboarding";
import NotFound from "@/pages/NotFound";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";

// Notifications (OneSignal) — guarded no-op until VITE_ONESIGNAL_APP_ID is set
import { initNotifications } from "@/lib/notifications/oneSignal";
import { useDayPart } from "@/hooks/useDayPart";
import RouteErrorBoundary from "@/components/auth/RouteErrorBoundary";

// Large pages - lazy load these to reduce initial bundle size
const Auth = React.lazy(() => import("@/pages/Auth"));
const Progress = React.lazy(() => import("@/pages/Progress"));
const PostSession = React.lazy(() => import("@/pages/PostSession"));
const UserProfile = React.lazy(() => import("@/pages/UserProfile"));
const Subscription = React.lazy(() => import("@/pages/Subscription"));
const Decompress = React.lazy(() => import("@/pages/Decompress"));

// Web3 Provider — lazy-loaded, only wraps /profile and /subscription.
// /auth is email-first: wagmi mounts only if the user picks wallet login.
const EagerWeb3Provider = React.lazy(() =>
  import("@/providers/EagerWeb3Provider").then((m) => ({ default: m.EagerWeb3Provider }))
);

// Consolidation redirects — old URLs redirect so nothing breaks
const PatternsRedirect = () => <Navigate to="/" replace />;
const ResultsRedirect = () => <Navigate to="/" replace />;
const CommunityRedirect = () => <Navigate to="/" replace />;
const LeaderboardRedirect = () => <Navigate to="/" replace />;
const SettingsRedirect = () => <Navigate to="/profile" replace />;

// Loading component for lazy routes
import { PixelLoader } from "@/components/primitives/PixelLoader";

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <PixelLoader variant="drive" label="Brume" />
  </div>
);

/**
 * Web3Route — wraps children with the lazy-loaded Web3 provider.
 * Used for /profile and /subscription. Session, home, auth (email),
 * onboarding, and post-session load with zero Wagmi.
 */
const Web3Route: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<PageLoader />}>
    <EagerWeb3Provider>
      {children}
    </EagerWeb3Provider>
  </Suspense>
);

function App() {
  useDayPart();
  React.useEffect(() => {
    void initNotifications();
  }, []);

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Main Application Routes with Header — no Web3 */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/session" element={<SessionModeWrapper />} />
            <Route path="/session/:mode" element={<SessionModeWrapper />} />
            <Route path="/post-session" element={<RouteErrorBoundary><PostSession /></RouteErrorBoundary>} />
            <Route path="/progress" element={<RouteErrorBoundary><Progress /></RouteErrorBoundary>} />
            {/* Web3 routes — wrapped with lazy-loaded provider */}
            <Route path="/profile" element={
              <Web3Route>
                <ProtectedRoute>
                  <RouteErrorBoundary>
                    <UserProfile />
                  </RouteErrorBoundary>
                </ProtectedRoute>
              </Web3Route>
            } />
            <Route path="/subscription" element={
              <Web3Route>
                <ProtectedRoute>
                  <RouteErrorBoundary>
                    <Subscription />
                  </RouteErrorBoundary>
                </ProtectedRoute>
              </Web3Route>
            } />
            {/* Consolidation redirects */}
            <Route path="/patterns" element={<PatternsRedirect />} />
            <Route path="/results" element={<ResultsRedirect />} />
            <Route path="/community" element={<CommunityRedirect />} />
            <Route path="/settings" element={<SettingsRedirect />} />
            <Route path="/leaderboard" element={<LeaderboardRedirect />} />
          </Route>

          {/* Email sign-in must not mount Wagmi. Wallet login lazy-loads it. */}
          <Route path="/decompress" element={
            <RouteErrorBoundary>
              <Decompress />
            </RouteErrorBoundary>
          } />
          <Route path="/auth" element={
            <RouteErrorBoundary>
              <Auth />
            </RouteErrorBoundary>
          } />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />

          {/* Catch all route */}
          <Route path="*" element={<NotFound />} />
        </Routes>

        <Toaster />
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
