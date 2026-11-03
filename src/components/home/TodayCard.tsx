/**
 * TodayCard — "How is it for you right now?" on the Home surface.
 *
 * Two rows, two taps. Row one is the five words; tap one and the room
 * absorbs it (mascot, mist, a droplet letting go) while the second
 * row slides in: ‹ choose again puts the word down and releases the
 * room, "Take it into a breath" carries it to the session preview.
 * The feeling is something you sit in and can change — never a
 * button that whisks you away.
 */
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DURATION, EASE, EASE_SETTLE, PRESS } from "@/lib/motion";
import { useNavigate } from "react-router-dom";
import { formatPhases, getPattern } from "@/lib/breathingPatterns";
import { CHECK_IN_SHORT_LABELS } from "@/lib/checkin";
import { cn } from "@/lib/utils";

/** Check-in word index → pattern id. "Overwhelmed" lands on the reset:
 *  the shortest rhythm with no holds. */
import { FEELINGS, LEGACY_FEEL_INDICES } from "@/lib/feelings";

export const CHECK_IN_PATTERN_IDS = FEELINGS.map((f) => f.patternId);

export function TodayCard({
  className,
  onFeel,
  initialIndex = null,
  showContinue = true,
}: {
  className?: string;
  /** A word is let go (index) or put back down (null). */
  onFeel?: (index: number | null, chip?: HTMLElement) => void;
  initialIndex?: number | null;
  showContinue?: boolean;
}) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [picked, setPicked] = useState<number | null>(initialIndex);
  const pattern = picked === null ? null : getPattern(CHECK_IN_PATTERN_IDS[picked]);

  // First tap: the word is let go — the room absorbs it and the
  // second row slides in. Nothing navigates; tap another word to
  // change the answer while it holds.
  const handleStateSelect = (index: number, chip: HTMLElement) => {
    setPicked(index);
    onFeel?.(index, chip);
  };

  // "Choose again" — the word is put back down; room and card release.
  const handleUnpick = () => {
    setPicked(null);
    onFeel?.(null);
  };

  // "Take it into a breath" — the opt-in that carries it forward.
  // After the droplet settles, this control view-transitions into the
  // session preview's Begin button (its [data-vt-entry] mark).
  const handleContinue = () => {
    if (picked === null) return;
    const index = picked;
    const go = () => {
      if (!pattern) {
        navigate("/session?pattern=box");
        return;
      }
      navigate(`/session?pattern=${pattern.id}`, {
        state: {
          reason: pattern.name,
          reasonDetail: pattern.description,
          source: "From how you feel",
          checkInIndex: index,
        },
      });
    };
    go();
  };

  return (
    <div className={cn("w-full max-w-2xl", className)}>
      <p className="text-sm font-medium text-foreground text-center">
        How is it for you right now?
      </p>
      <p className="text-sm text-muted-foreground mt-1 mb-2.5 text-center" aria-live="polite">
        {picked === null || !pattern
          ? "Pick one and Brume suggests a rhythm."
          : `${pattern.name} · ${formatPhases(pattern)}`}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {LEGACY_FEEL_INDICES.map((index) => {
          const label = CHECK_IN_SHORT_LABELS[index];
          return (
          <motion.button
            key={label}
            type="button"
            aria-pressed={picked === index}
            onClick={(event) => handleStateSelect(index, event.currentTarget)}
            whileHover={reduceMotion ? undefined : { scale: 1.04 }}
            whileTap={reduceMotion
              ? undefined
              // Asymmetric squash: the chip widens as it shortens, and
              // releases on the settle ease (one small overshoot pass).
              : { ...PRESS.chipSquash, transition: { duration: 0.3, ease: EASE_SETTLE } }}
            transition={{ duration: DURATION.quick, ease: EASE }}
            className={cn("brume-choice")}
          >
              {label}
            </motion.button>
          );
        })}
      </div>

      {picked !== null && (
        <motion.div
          className="mt-3 flex items-center justify-center gap-4"
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.standard, ease: EASE }}
        >
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={handleUnpick}
          >
            ‹ choose again
          </button>
          {showContinue && (
            <button
              type="button"
              className="brume-btn brume-btn--push px-5 py-2.5 min-h-0 text-sm"
              onClick={() => handleContinue()}
            >
              Take it into a breath
            </button>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default TodayCard;
