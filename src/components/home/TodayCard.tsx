/**
 * TodayCard — "What do you need today?" on the Home surface.
 *
 * One-tap entry: tap a state → session starts immediately. The reason
 * (the pattern name and a line about its rhythm) is passed
 * as location state to the session preview, where it shows as a brief
 * caption before the session begins. No intermediate card, no second
 * button — the state check-in IS the first step of the session.
 */
import { motion, useReducedMotion } from "framer-motion";
import { DURATION, EASE } from "@/lib/motion";
import { useNavigate } from "react-router-dom";
import { getPattern } from "@/lib/breathingPatterns";
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

export function TodayCard({ className }: { className?: string }) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const handleStateSelect = (index: number) => {
    const pattern = getPattern(CHECK_IN_PATTERN_IDS[index]);
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
      <p className="text-sm text-muted-foreground mt-1 mb-3 text-center">
        Pick one and Brume suggests a rhythm.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {CHECK_IN_SHORT_LABELS.map((label, index) => (
          <motion.button
            key={label}
            type="button"
            onClick={() => handleStateSelect(index)}
            whileHover={reduceMotion ? undefined : { scale: 1.02 }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            transition={{ duration: DURATION.quick, ease: EASE }}
            className={cn("brume-btn brume-btn--soft px-5 py-2.5 min-h-0 text-sm")}
          >
            {label}
          </motion.button>
        ))}
      </div>
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
