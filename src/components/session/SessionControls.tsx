/**
 * Enhanced Session Controls Component
 * 
 * ENHANCEMENT FIRST: Enhanced existing component with variant support
 * AGGRESSIVE CONSOLIDATION: Replaces SessionControlsBar and composite SessionControls
 * MODULAR: Supports different layouts and configurations
 * CLEAN: Clear separation of concerns with explicit dependencies
 */

import React from "react";
import { Pause, Play, StopCircle, Volume2, VolumeX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/useSession";

type SessionControlsVariant = "default" | "compact" | "minimal";

type SessionControlsProps = {
  onEndSession?: () => void;
  variant?: SessionControlsVariant;
  className?: string;
  disabled?: boolean;
  showAudio?: boolean;
  showStop?: boolean;
  isLoading?: boolean;
};

const VARIANT_CONFIGS = {
  default: {
    buttonSize: "icon" as const,
    buttonClass: "rounded-full w-16 h-16",
    iconSize: 32,
    spacing: "space-x-4",
    showLabels: false,
  },
  compact: {
    buttonSize: "sm" as const,
    buttonClass: "rounded-full w-12 h-12",
    iconSize: 24,
    spacing: "space-x-3",
    showLabels: false,
  },
  minimal: {
    buttonSize: "sm" as const,
    buttonClass: "rounded-md px-4 py-2",
    iconSize: 16,
    spacing: "space-x-2",
    showLabels: true,
  },
};

export const SessionControls = ({ 
  onEndSession,
  variant = "default",
  className = "",
  disabled = false,
  showAudio = true,
  showStop = true,
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

  const config = VARIANT_CONFIGS[variant];

  const handlePlayPause = () => {
    if (disabled || isLoading) return;

    // isActive is lifecycle (phase !== 'setup') and stays true while paused,
    // so check paused first or resume is unreachable.
    if (isPaused) {
      resume();
    } else if (isActive) {
      pause();
    }
  };

  const handleStop = () => {
    if (disabled || isLoading) return;
    if (onEndSession) {
      onEndSession();
      return;
    }
    stop();
  };

  const handleToggleAudio = () => {
    if (disabled || isLoading) return;
    toggleAudio();
  };

  return (
    <div className={`z-20 mt-auto mb-8 flex items-center justify-center ${config.spacing} ${className}`}>
      {/* Audio Toggle */}
      {showAudio && (
        <Button
          variant="ghost"
          size={config.buttonSize}
          onClick={handleToggleAudio}
          className={config.buttonClass}
          disabled={disabled || isLoading}
          aria-label={isAudioEnabled ? "Mute audio" : "Unmute audio"}
        >
          {isAudioEnabled ? (
            <Volume2 size={config.iconSize} />
          ) : (
            <VolumeX size={config.iconSize} />
          )}
          {config.showLabels && (
            <span className="ml-2">
              {isAudioEnabled ? "Mute" : "Unmute"}
            </span>
          )}
        </Button>
      )}

      {/* Play/Pause Button */}
      <Button
        variant="ghost"
        size={config.buttonSize}
        onClick={handlePlayPause}
        className={config.buttonClass}
        disabled={disabled || isLoading || (!isActive && !isPaused)}
        aria-label={
          isLoading
            ? "Loading session"
            : isPaused
              ? "Resume session"
              : isActive
                ? "Pause session"
                : "Play session"
        }
      >
        {isLoading ? (
          <Loader2 size={config.iconSize} className="animate-spin" />
        ) : isActive && !isPaused ? (
          <Pause size={config.iconSize} />
        ) : (
          <Play size={config.iconSize} />
        )}
        {config.showLabels && (
          <span className="ml-2">
            {isLoading
              ? "Loading"
              : isPaused
                ? "Resume"
                : isActive
                  ? "Pause"
                  : "Play"}
          </span>
        )}
      </Button>

      {/* Stop Button */}
      {showStop && (
        <Button
          variant="destructive"
          size={config.buttonSize}
          onClick={handleStop}
          className={`${config.buttonClass} bg-red-400 hover:bg-red-500`}
          disabled={disabled || isLoading}
          aria-label="End session"
        >
          <StopCircle size={config.iconSize} />
          {config.showLabels && <span className="ml-2">Stop</span>}
        </Button>
      )}
    </div>
  );
};

// Convenience components for backward compatibility
export const CompactSessionControls = (props: Omit<SessionControlsProps, "variant">) => (
  <SessionControls {...props} variant="compact" />
);

export const MinimalSessionControls = (props: Omit<SessionControlsProps, "variant">) => (
  <SessionControls {...props} variant="minimal" />
);
