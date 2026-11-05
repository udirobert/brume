import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LayoutGroup, MotionConfig } from "framer-motion";

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
import About from "@/pages/About";

// Notifications (OneSignal) — guarded no-op until VITE_ONESIGNAL_APP_ID is set
import { initNotifications } from "@/lib/notifications/oneSignal";
import { useDayPart } from "@/hooks/useDayPart";
import { recordVisit } from "@/lib/events";
import RouteErrorBoundary from "@/components/auth/RouteErrorBoundary";
import { RoomEnvironment } from "@/components/atmosphere/RoomEnvironment";
import { JourneyCompanionProvider } from "@/components/companion/JourneyCompanion";

// Large pages - lazy load these to reduce initial bundle size
const Auth = React.lazy(() => import("@/pages/Auth"));
const Progress = React.lazy(() => import("@/pages/Progress"));
const PostSession = React.lazy(() => import("@/pages/PostSession"));
const UserProfile = React.lazy(() => import("@/pages/UserProfile"));
const Decompress = React.lazy(() => import("@/pages/Decompress"));

// Consolidation redirects — old URLs redirect so nothing breaks
const PatternsRedirect = () => <Navigate to="/" replace />;
const ResultsRedirect = () => <Navigate to="/" replace />;
const CommunityRedirect = () => <Navigate to="/" replace />;
const LeaderboardRedirect = () => <Navigate to="/" replace />;
const SettingsRedirect = () => <Navigate to="/profile" replace />;

// Frozen-frame motion storyboard — dev only, never in the release build.
const MotionLab = import.meta.env.DEV
  ? React.lazy(() => import("@/pages/MotionLab"))
  : null;

// Loading component for lazy routes
const PageLoader = () => (
  <div
    className="flex items-center justify-center min-h-screen"
    role="status"
    aria-label="Loading"
  >
    <span aria-hidden="true" style={{ width: 88, height: 88 }} />
    <span className="sr-only">Loading</span>
  </div>
);

function App() {
  useDayPart();
  React.useEffect(() => {
    void initNotifications();
    recordVisit();
  }, []);

  return (
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <RoomEnvironment />
        <JourneyCompanionProvider>
        <LayoutGroup>
        <Routes>
          {/* Main Application Routes with Header — no Web3 */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/session" element={<SessionModeWrapper />} />
            <Route path="/session/:mode" element={<SessionModeWrapper />} />
            <Route path="/post-session" element={<RouteErrorBoundary><PostSession /></RouteErrorBoundary>} />
            <Route path="/progress" element={<RouteErrorBoundary><Progress /></RouteErrorBoundary>} />
            <Route path="/profile" element={
              <ProtectedRoute>
                <RouteErrorBoundary>
                  <UserProfile />
                </RouteErrorBoundary>
              </ProtectedRoute>
            } />
            <Route path="/about" element={<RouteErrorBoundary><About /></RouteErrorBoundary>} />
            {/* Consolidation redirects */}
            <Route path="/patterns" element={<PatternsRedirect />} />
            <Route path="/results" element={<ResultsRedirect />} />
            <Route path="/community" element={<CommunityRedirect />} />
            <Route path="/settings" element={<SettingsRedirect />} />
            <Route path="/leaderboard" element={<LeaderboardRedirect />} />
          </Route>

          <Route path="/decompress" element={
            <RouteErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Decompress />
              </Suspense>
            </RouteErrorBoundary>
          } />
          <Route path="/auth" element={
            <RouteErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Auth />
              </Suspense>
            </RouteErrorBoundary>
          } />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />

          {/* Frozen-frame motion storyboard (dev only) */}
          {MotionLab && (
            <Route
              path="/motion-lab"
              element={
                <Suspense fallback={<PageLoader />}>
                  <MotionLab />
                </Suspense>
              }
            />
          )}

          {/* Catch all route */}
          <Route path="*" element={<NotFound />} />
        </Routes>

        <Toaster />
        </LayoutGroup>
        </JourneyCompanionProvider>
      </MotionConfig>
    </BrowserRouter>
  );
}

export default App;
