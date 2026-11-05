import React, { Suspense, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { ResponsiveNavigation } from "./navigation/ResponsiveNavigation";
import { development } from "../config/environment";
import DeveloperTools from "./developer/DeveloperTools";
import { Button } from "./ui/button";
import { SettingsIcon } from "./icons/BrumeIcons";

// Kept tiny and chrome-shaped so a lazy page never blanks the header or
// tab bar — the suspense boundary lives here, inside the layout.
const PageLoader = () => (
  <div
    className="flex items-center justify-center min-h-[50vh]"
    role="status"
    aria-label="Loading"
  >
    <span aria-hidden="true" style={{ width: 88, height: 88 }} />
    <span className="sr-only">Loading</span>
  </div>
);

const MainLayout = () => {
  const [showDevTools, setShowDevTools] = useState(false);
  const { pathname } = useLocation();
  const immersive =
    pathname.startsWith("/session") || pathname.startsWith("/post-session");

  return (
    <ResponsiveNavigation>
      {development.debugMode && !immersive && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
          <Button
            onClick={() => setShowDevTools(!showDevTools)}
            size="sm"
            variant="outline"
            className="bg-background/80 backdrop-blur-sm"
            aria-label="Toggle developer tools"
          >
            <SettingsIcon className="h-4 w-4" />
          </Button>

          {showDevTools && (
            <div className="w-80">
              <DeveloperTools />
            </div>
          )}
        </div>
      )}
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </ResponsiveNavigation>
  );
};

export default MainLayout;
