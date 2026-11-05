/**
 * Session controls — quiet, brand-shaped.
 * "End" is an outline pill (never red — this isn't a recorder);
 * pause/resume and the cue cycle are 48px ghost icon buttons.
 */

import React from "react";
import { PauseIcon, PlayIcon, SpinnerIcon } from "@/components/icons/BrumeIcons";
import { useSession } from "@/hooks/useSession";
import { useSessionPhase } from "@/stores/sessionStore";
import {
  CueBreathIcon,
  CueQuietIcon,
  CueVoiceIcon,
} from "@/components/icons/BrumeIcons";
import {
  cueStateOf,
  nextCueState,
  previewCue,
  setCueStyle as setVoiceCueStyle,
  setVoiceEnabled,
} from "@/lib/voiceCues";
import { track } from "@/lib/events";

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
    audioEnabled,
    cueStyle,
    pause,
    resume,
    complete: stop,
    setAudioEnabled,
    setCueStyle,
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

  // One glyph, three textures — spoken, breath, quiet. Mid-breath is
  // exactly when you find out which one you wanted, so the change lives on
  // the session rather than in a drawer.
  const cueState = cueStateOf(audioEnabled, cueStyle);
  const nextCue = nextCueState(cueState);

  const handleCycleCues = () => {
    if (disabled || isLoading) return;
    if (nextCue === "quiet") {
      setAudioEnabled(false);
      // Turning the voice off also cuts whichever cue is mid-breath; the
      // parent syncs this from the store one render later.
      setVoiceEnabled(false);
    } else {
      setAudioEnabled(true);
      setCueStyle(nextCue);
      // The audition reads the engine's own style, so it has to be set
      // before this tap — otherwise the first breath you hear is the
      // texture you just left.
      setVoiceCueStyle(nextCue);
      previewCue("inhale");
    }
    track("cue_changed", { from: cueState, to: nextCue });
  };

  return (
    <div className={`z-20 flex items-center justify-center gap-4 ${className}`}>
      {showAudio && (
        <button
          type="button"
          onClick={handleCycleCues}
          className={ICON_BTN}
          disabled={disabled || isLoading}
          aria-label={`Breath cues: ${cueState} — tap for ${nextCue}.`}
        >
          {cueState === "spoken" ? (
            <CueVoiceIcon size={22} />
          ) : cueState === "breath" ? (
            <CueBreathIcon size={22} />
          ) : (
            <CueQuietIcon size={22} />
          )}
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
            <SpinnerIcon size={22} className="animate-spin" />
          ) : isPaused ? (
            <PlayIcon size={22} />
          ) : (
            <PauseIcon size={22} />
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
