/**
 * Session controls — quiet, brand-shaped.
 * "End" is an outline pill (never red — this isn't a recorder);
 * pause/resume and audio are 48px ghost icon buttons.
 */

import React from "react";
import { Pause, Play, Volume2, VolumeX, Loader2 } from "lucide-react";
import { useSession } from "@/hooks/useSession";
import { useSessionPhase } from "@/stores/sessionStore";

type SessionControlsProps = {
  onEndSession?: () => void;
  className?: string;
  disabled?: boolean;
  showAudio?: boolean;
  isLoading?: boolean;
};

const ICON_BTN =
  "w-12 h-12 rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-50 disabled:pointer-events-none";

export const SessionControls = ({
  onEndSession,
  className = "",
  disabled = false,
  showAudio = true,
  isLoading = false,
}: SessionControlsProps) => {
  const {
    isActive,
    isPaused,
    audioEnabled: isAudioEnabled,
    pause,
    resume,
    complete: stop,
    toggleAudio,
  } = useSession();
  // The play/pause icon only exists once the breath is running: active
  // pauses it, paused resumes it. Any pre-start phase (setup/ready) or
  // the completion beat renders nothing to press here — a play button
  // beside "Begin" reads as "the first tap didn't register".
  const phase = useSessionPhase();
  const breathRunning = phase === 'active' || phase === 'paused';

  const handlePlayPause = () => {
    if (disabled || isLoading) return;
    if (isPaused) {
      resume();
    } else if (isActive) {
      pause();
    }
  };

  const handleEnd = () => {
    if (disabled || isLoading) return;
    if (onEndSession) {
      onEndSession();
      return;
    }
    stop();
  };

  return (
    <div className={`z-20 flex items-center justify-center gap-4 ${className}`}>
      {showAudio && (
        <button
          type="button"
          onClick={() => { if (!disabled && !isLoading) toggleAudio(); }}
          className={ICON_BTN}
          disabled={disabled || isLoading}
          aria-label={isAudioEnabled ? "Mute audio" : "Unmute audio"}
        >
          {isAudioEnabled ? <Volume2 size={22} /> : <VolumeX size={22} />}
        </button>
      )}

      {breathRunning && (
        <button
          type="button"
          onClick={handlePlayPause}
          className={ICON_BTN}
          disabled={disabled || isLoading}
          aria-label={
            isLoading
              ? "Loading session"
              : isPaused
                ? "Resume session"
                : "Pause session"
          }
        >
          {isLoading ? (
            <Loader2 size={22} className="animate-spin" />
          ) : isPaused ? (
            <Play size={22} />
          ) : (
            <Pause size={22} />
          )}
        </button>
      )}

      <button
        type="button"
        onClick={handleEnd}
        className="brume-btn brume-btn--outline min-h-12 px-6"
        disabled={disabled || isLoading}
        aria-label="End session"
      >
        End
      </button>
    </div>
  );
};

export default SessionControls;
