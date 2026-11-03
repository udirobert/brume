/**
 * SessionPreview — one screen before the breath.
 *
 * The state check-in already picked the pattern; we show why and start.
 * No camera, nothing to get right. The breath itself is orb-only.
 */
import React from "react";
import { useLocation } from "react-router-dom";
import { Button } from "../ui/button";
import { ContextCards } from "@/components/primitives/ContextCard";
import { formatPhases } from "@/lib/breathingPatterns";
import { previewCue } from "@/lib/voiceCues";
import { AlertCircle, Volume2 } from "lucide-react";

interface SessionPreviewProps {
  patternName: string;
  pattern: {
    name: string;
    phases: {
      inhale: number;
      hold?: number;
      exhale: number;
      pause?: number;
    };
    benefits?: string[];
    description?: string;
  };
  onStart: () => void;
  onCancel?: () => void;
  /** Session-level error (e.g. unavailable pattern) — rendered as an alert. */
  sessionError?: string | null;
  /** Spoken breath cues choice — surfaced here before first play. */
  audioEnabled?: boolean;
  onToggleAudio?: () => void;
  /** Brume waits with you — rendered above the pattern name. */
  mascot?: React.ReactNode;
}

export const SessionPreview: React.FC<SessionPreviewProps> = ({
  patternName,
  pattern,
  onStart,
  onCancel,
  sessionError,
  audioEnabled,
  onToggleAudio,
  mascot,
}) => {
  const location = useLocation();
  // Cosmetic only: `?via=invite` means someone handed this break to you.
  // No tracking — the flag just explains how you got here.
  const isInvite = new URLSearchParams(location.search).get("via") === "invite";
  const reason = (location.state as { reason?: string; reasonDetail?: string; source?: string } | null)?.reason;
  const reasonDetail = (location.state as { reason?: string; reasonDetail?: string; source?: string } | null)?.reasonDetail;
  const source =
    (location.state as { source?: string } | null)?.source || "From how you feel";

  const phases = formatPhases(pattern.phases);

  return (
    <div className="flex-grow flex flex-col items-center justify-center p-6 space-y-8">
      <div className="text-center space-y-2 max-w-md">
        {mascot}
        {isInvite && (
          <p className="text-sm text-muted-foreground/80">Someone passed you a break.</p>
        )}
        <h2 className="text-3xl font-light tracking-tight text-foreground">{patternName}</h2>
        <p className="text-sm text-muted-foreground font-mono">{phases}</p>
      </div>

      {sessionError && (
        <div
          role="alert"
          className="flex items-start gap-2 text-sm text-destructive max-w-sm"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{sessionError}</span>
        </div>
      )}

      {(reason || reasonDetail) && (
        <ContextCards
          className="max-w-sm"
          chunks={[
            {
              title: reason || patternName,
              body: reasonDetail || pattern.description || "A pattern matched to how you feel right now.",
              source,
            },
          ]}
        />
      )}

      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        <Button
          onClick={() => onStart()}
          size="lg"
          className="w-full rounded-full btn-premium py-6"
        >
          Begin
        </Button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Not now
          </button>
        )}

        {audioEnabled !== undefined && onToggleAudio && (
          <div className="flex flex-col items-center gap-1.5 mt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-pressed={audioEnabled}
                aria-label="Spoken breath cues"
                onClick={onToggleAudio}
                className="brume-toggle"
              >
                <span className="brume-toggle__dot" aria-hidden="true" />
                Spoken breath cues {audioEnabled ? "on" : "off"}
              </button>
              <button
                type="button"
                aria-label="Hear a spoken cue"
                title="Hear it"
                onClick={() => previewCue("inhale")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
              >
                <Volume2 size={18} aria-hidden="true" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground/70 text-center">
              Plays from files on this device — nothing is sent anywhere.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionPreview;
