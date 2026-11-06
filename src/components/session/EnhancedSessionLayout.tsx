/**
 * Session layout — the orb owns the screen.
 * No camera, no metrics dashboard.
 */
import React from "react";
import { CloseIcon } from "@/components/icons/BrumeIcons";

interface EnhancedSessionLayoutProps {
  breathingAnimation: React.ReactNode;
  controls: React.ReactNode;
  onExit?: () => void;
}

export const EnhancedSessionLayout: React.FC<EnhancedSessionLayoutProps> = ({
  breathingAnimation,
  controls,
  onExit,
}) => {
  return (
    // h-screen is the fallback for browsers without dvh; when 100dvh is
    // supported it wins — and there is deliberately no min-h-screen here:
    // 100vh is the viewport WITH the mobile URL bar retracted, so as a
    // minimum it pushes the controls behind the browser's own bar.
    <div className="relative flex flex-col h-screen supports-[height:100dvh]:h-[100dvh] overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-primary/15 rounded-full blur-[120px] -z-10" />

      {onExit && (
        <button
          type="button"
          onClick={onExit}
          className="absolute top-4 left-4 z-20 rounded-full p-2 text-muted-foreground/70 hover:text-foreground hover:bg-background/40 transition-colors"
          aria-label="Leave session"
        >
          <CloseIcon className="w-5 h-5" />
        </button>
      )}

      <div className="relative flex-1 flex items-center justify-center p-6">
        {breathingAnimation}
      </div>

      <div className="relative flex-shrink-0 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {controls}
      </div>
    </div>
  );
};

export default EnhancedSessionLayout;
