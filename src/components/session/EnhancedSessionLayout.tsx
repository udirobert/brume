/**
 * Session layout — the orb owns the screen.
 * No camera, no metrics dashboard.
 */
import React from "react";
import { X } from "lucide-react";

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
    <div className="relative flex flex-col h-[100dvh] min-h-screen overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-primary/15 rounded-full blur-[120px] -z-10" />

      {onExit && (
        <button
          type="button"
          onClick={onExit}
          className="absolute top-4 left-4 z-20 rounded-full p-2 text-muted-foreground/70 hover:text-foreground hover:bg-background/40 transition-colors"
          aria-label="Leave session"
        >
          <X className="w-5 h-5" />
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
