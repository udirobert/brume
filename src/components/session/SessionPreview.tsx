/**
 * SessionPreview — one screen before the breath.
 *
 * The state check-in already picked the pattern; we show why and start.
 * No camera, nothing to get right. The breath itself is orb-only.
 */
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import { formatPhases, getPattern } from "@/lib/breathingPatterns";
import { CHECK_IN_PATTERN_IDS } from "@/components/home/TodayCard";
import { feelingAt } from "@/lib/feelings";
import { PairedFeelings } from "@/components/checkin/PairedFeelings";
import { CUE_STATES, cueStateOf, previewCue } from "@/lib/voiceCues";
import type { CueState, CueStyle } from "@/lib/voiceCues";
import { AlertIcon } from "@/components/icons/BrumeIcons";

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
  /** Breath cues — spoken words, the breath itself, or quiet. */
  audioEnabled?: boolean;
  cueStyle?: CueStyle;
  onChooseCues?: (choice: CueState) => void;
  /** One quiet line naming the session's own ending, under the phases. */
  landingNote?: string;
  /** Brume waits with you — rendered above the pattern name. */
  mascot?: React.ReactNode;
  /** Voice check-in state — lets the parent perk the companion's ears. */
  onVoiceState?: (state: "listening" | "matched" | "missed", index?: number) => void;
}

export const SessionPreview: React.FC<SessionPreviewProps> = ({
  patternName,
  pattern,
  onStart,
  onCancel,
  sessionError,
  audioEnabled,
  cueStyle,
  onVoiceState,
  onChooseCues,
  landingNote,
  mascot,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const checkInIndex = typeof (location.state as { checkInIndex?: number } | null)
    ?.checkInIndex === "number"
    ? (location.state as { checkInIndex: number }).checkInIndex
    : null;

  // Re-pick the feeling → swap the pattern preview without leaving.
  // Putting the word back down lands on the plain reset instead.
  const pickFeel = (index: number | null) => {
    const next = getPattern(index === null ? "reset" : CHECK_IN_PATTERN_IDS[index]);
    if (!next) return;
    navigate(`/session?pattern=${next.id}`, {
      replace: true,
      state: {
        reason: next.name,
        reasonDetail: next.description,
        source: index === null ? "Your reset" : "From how you feel",
        checkInIndex: index,
      },
    });
  };
  // Cosmetic only: `?via=invite` means someone handed this break to you.
  // No tracking — the flag just explains how you got here.
  const isInvite = new URLSearchParams(location.search).get("via") === "invite";
  const reason = (location.state as { reason?: string; reasonDetail?: string; source?: string } | null)?.reason;
  const reasonDetail = (location.state as { reason?: string; reasonDetail?: string; source?: string } | null)?.reasonDetail;

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
        {landingNote && (
          <p className="text-xs text-muted-foreground/70">{landingNote}</p>
        )}
      </div>

      {sessionError && (
        <div
          role="alert"
          className="flex items-start gap-2 text-sm text-destructive max-w-sm"
        >
          <AlertIcon className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{sessionError}</span>
        </div>
      )}

      {(reason || reasonDetail) && (
        <p className="text-sm text-muted-foreground max-w-sm text-center">
          {reasonDetail || pattern.description || "A pattern matched to how you feel right now."}
        </p>
      )}

      {checkInIndex !== null && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-muted-foreground">
            You said:{" "}
            <span className="font-medium text-foreground">
              {feelingAt(checkInIndex)?.label}
            </span>
          </p>
          <PairedFeelings selectedIndex={checkInIndex} onChoose={pickFeel} onVoiceState={onVoiceState} showHint={false} />
        </div>
      )}

      <div className="flex flex-col items-center gap-3 w-full max-w-xs">
        {/* data-vt-entry: named `brume-entry` during a view transition,
            so the control that navigated here morphs into this button. */}
        <Button
          onClick={() => onStart()}
          size="lg"
          data-vt-entry
          className="w-full rounded-full btn-pear py-6"
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

        {audioEnabled !== undefined && cueStyle && onChooseCues && (
          <p className="text-xs text-muted-foreground/70 text-center mt-1">
            Breath cues:{" "}
            {CUE_STATES.map((kind, i) => {
              const pressed =
                cueStateOf(!!audioEnabled, cueStyle) === kind;
              return (
                <React.Fragment key={kind}>
                  {i > 0 && " · "}
                  <button
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => onChooseCues(kind)}
                    className={`transition-colors underline-offset-2 hover:underline ${
                      pressed ? "text-foreground underline" : "hover:text-foreground"
                    }`}
                  >
                    {kind}
                  </button>
                </React.Fragment>
              );
            })}
            {" · "}
            <button
              type="button"
              aria-label="Hear a cue"
              onClick={() => previewCue("inhale")}
              className="hover:text-foreground transition-colors underline-offset-2 hover:underline"
            >
              hear it
            </button>
            {" — cue files stay on this device; spoken greets you aloud via our voice service."}
          </p>
        )}
      </div>
    </div>
  );
};

export default SessionPreview;
