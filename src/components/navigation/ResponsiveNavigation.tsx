import React from "react";
import { useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { BottomTabBar } from "./BottomTabBar";
import Header from "@/components/Header";
import { ProgressiveBlur } from "@/components/atmosphere/ProgressiveBlur";

interface ResponsiveNavigationProps {
  children: React.ReactNode;
}

/**
 * Session and post-session own the screen — no header, no tab bar, no mist.
 * Everywhere else: living mist field + Header + (mobile) BottomTabBar.
 */
function isImmersivePath(pathname: string) {
  return pathname.startsWith("/session") || pathname.startsWith("/post-session");
}

function isCoreRoomPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/session") ||
    pathname.startsWith("/post-session")
  );
}

export const ResponsiveNavigation: React.FC<ResponsiveNavigationProps> = ({
  children,
}) => {
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  const immersive = isImmersivePath(pathname);
  const core = isCoreRoomPath(pathname);

  return (
    <div className={`relative min-h-screen w-full ${core ? "" : "bg-calm-gradient "}flex flex-col`}>
      {/* Where the mist field sleeps the room answers as a still
          wash; where it lives, a softer soak beneath the folds. */}
      {!immersive && <ProgressiveBlur />}
      {!immersive && <Header />}

      <main
        className={
          immersive
            ? "relative z-10 flex-grow flex flex-col"
            : `relative z-10 flex-grow flex flex-col items-center justify-center p-4 ${isMobile ? "pb-24" : ""}`
        }
      >
        {children}
      </main>

      {!immersive && isMobile && <BottomTabBar />}
    </div>
  );
};

export default ResponsiveNavigation;
