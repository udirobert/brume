/**
 * Session layout — the orb owns the screen.
 *
 * A corner pip is the "you are being seen" signal: mirrored camera +
 * a seeing ring when the face is found. No metrics dashboard.
 */
import React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

interface EnhancedSessionLayoutProps {
  videoFeed: React.ReactNode;
  showVideo: boolean;
  seen?: boolean;
  breathingAnimation: React.ReactNode;
  metrics: {
    stillnessScore: number;
    presenceScore: number;
    confidenceScore: number;
    showMetrics: boolean;
  };
  sessionInfo: {
    duration: string;
    cycle: number;
    phase: string;
    progressPercentage: number;
  };
  controls: React.ReactNode;
  isMobile?: boolean;
  onExit?: () => void;
}

export const EnhancedSessionLayout: React.FC<EnhancedSessionLayoutProps> = ({
  videoFeed,
  showVideo,
  seen = false,
  breathingAnimation,
  controls,
  onExit,
}) => {
  return (
    <div className="relative flex flex-col h-[100dvh] min-h-screen bg-calm-gradient overflow-hidden">
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

      {showVideo && (
        <div
          className={cn(
            "absolute top-4 right-4 z-20 w-20 sm:w-24 aspect-[3/4] rounded-2xl overflow-hidden",
            "bg-black shadow-lg ring-2 ring-offset-2 ring-offset-transparent transition-all duration-500",
            seen ? "ring-emerald-400/70" : "ring-white/25 opacity-80",
          )}
          aria-label={seen ? "Camera can see you" : "Looking for your face"}
        >
          {videoFeed}
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 to-transparent px-1.5 pb-1.5 pt-4 pointer-events-none">
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  seen ? "bg-emerald-400 animate-pulse" : "bg-white/40",
                )}
              />
              <span className="text-[9px] font-medium tracking-wide text-white/85">
                {seen ? "Seen" : "Looking"}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="relative flex-1 flex items-center justify-center p-6">
        {breathingAnimation}
      </div>

      <div className="relative flex-shrink-0 pb-8 pt-2">
        {controls}
      </div>
    </div>
  );
};

export default EnhancedSessionLayout;
