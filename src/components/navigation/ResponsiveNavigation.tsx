import React from "react";
import { useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { BottomTabBar } from "./BottomTabBar";
import Header from "@/components/Header";
import { MistField } from "@/components/atmosphere/MistField";
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

export const ResponsiveNavigation: React.FC<ResponsiveNavigationProps> = ({
  children,
}) => {
  const isMobile = useIsMobile();
  const { pathname } = useLocation();
  const immersive = isImmersivePath(pathname);

  return (
    <div className="relative min-h-screen w-full bg-calm-gradient flex flex-col">
      {!immersive && <MistField />}
      {!immersive && <ProgressiveBlur />}
      {!immersive && <Header />}
      {/* Where the mist field sleeps, the room still answers the
          check-in word — a still wash in the feeling's colour. */}
      {immersive && <div className="brume-feel-wash" aria-hidden="true" />}

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
