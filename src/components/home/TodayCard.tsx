/**
 * TodayCard — "What do you need today?" on the Home surface.
 *
 * Two taps, on purpose: tap a word → the room absorbs it (mascot,
 * mist, a droplet letting go) and Brume's suggestion appears; tap
 * "Take it into a breath" → the session preview. The feeling is
 * something you can sit in and change, not a button that whisks
 * you away. The reason (pattern + rhythm) travels to the preview
 * as location state.
 */
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { DURATION, EASE } from "@/lib/motion";
import { useNavigate } from "react-router-dom";
import { formatPhases, getPattern } from "@/lib/breathingPatterns";
import { CHECK_IN_SHORT_LABELS } from "@/lib/checkin";
import { cn } from "@/lib/utils";

/** Check-in word index → pattern id. "Overwhelmed" lands on the reset:
 *  the shortest rhythm with no holds. */
export const CHECK_IN_PATTERN_IDS = [
  "mindfulness",
  "box",
  "relaxation",
  "relaxation",
  "reset",
] as const;

const RHYTHMS = [
  { id: "box", label: "Box" },
  { id: "relaxation", label: "4-7-8" },
  { id: "wim_hof", label: "Wim Hof" },
  { id: "sleep", label: "Sleep" },
] as const;

export function TodayCard({
  className,
  onFeel,
}: {
  className?: string;
  /** Fired when a check-in word is tapped, before navigation. */
  onFeel?: (index: number, chip: HTMLElement) => void;
}) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [picked, setPicked] = useState<number | null>(null);
  const pattern = picked === null ? null : getPattern(CHECK_IN_PATTERN_IDS[picked]);

  // First tap: the word is let go — the room absorbs it and the
  // suggestion appears. Nothing navigates; re-tap another word to
  // change the answer while it holds.
  const handleStateSelect = (index: number, chip: HTMLElement) => {
    setPicked(index);
    onFeel?.(index, chip);
  };

  // Second tap: the opt-in — carry the feeling into the preview.
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
    if (!reduceMotion) window.setTimeout(go, 280);
    else go();
  };

  const handleRhythmSelect = (patternId: string, name: string) => {
    navigate(`/session?pattern=${patternId}`, {
      state: {
        reason: name,
        reasonDetail: "You picked this rhythm.",
        source: "Your choice",
      },
    });
  };

  return (
    <div className={cn("w-full max-w-2xl", className)}>
      <p className="text-sm font-medium text-foreground text-center">
        How is it for you right now?
      </p>
      <p className="text-sm text-muted-foreground mt-1 mb-3 text-center" aria-live="polite">
        {picked === null
          ? "Pick one and Brume suggests a rhythm."
          : pattern
            ? `${pattern.name} · ${formatPhases(pattern)}`
            : "Pick one and Brume suggests a rhythm."}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {CHECK_IN_SHORT_LABELS.map((label, index) => (
          <motion.button
            key={label}
            type="button"
            aria-pressed={picked === index}
            onClick={(event) => handleStateSelect(index, event.currentTarget)}
            whileHover={reduceMotion ? undefined : { scale: 1.02 }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            transition={{ duration: DURATION.quick, ease: EASE }}
            className={cn("brume-btn brume-btn--soft px-5 py-2.5 min-h-0 text-sm")}
          >
            {label}
          </motion.button>
        ))}
      </div>

      {picked !== null && (
        <motion.div
          className="mt-4 flex flex-col items-center"
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.standard, ease: EASE }}
        >
          <button
            type="button"
            className="brume-btn brume-btn--push px-6 py-3 text-sm"
            onClick={handleContinue}
          >
            Take it into a breath
          </button>
        </motion.div>
      )}
      <details className="mt-6">
        <summary className="brume-pill mx-auto w-fit cursor-pointer list-none text-center">More rhythms</summary>
        <div className="flex flex-wrap justify-center gap-2 mt-3">
        {RHYTHMS.map((r) => (
          <motion.button
            key={r.id}
            type="button"
            onClick={() => handleRhythmSelect(r.id, r.label)}
            whileHover={reduceMotion ? undefined : { scale: 1.02 }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            transition={{ duration: DURATION.quick, ease: EASE }}
            className={cn("brume-pill px-3 py-1.5 min-h-0 text-xs")}
          >
            {r.label}
          </motion.button>
        ))}
        </div>
      </details>
    </div>
  );
}

export default TodayCard;
