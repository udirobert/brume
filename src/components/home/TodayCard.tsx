/**
 * TodayCard — "What do you need today?" on the Home surface.
 *
 * One-tap entry: tap a state → session starts immediately. The reason
 * ("Box Breathing · works in ~2 min · calms the vagus nerve") is passed
 * as location state to the session preview, where it shows as a brief
 * caption before the session begins. No intermediate card, no second
 * button — the state check-in IS the first step of the session.
 */
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { SmartPatternRecommendations } from "@/lib/recommendations/SmartPatternRecommendations";
import { cn } from "@/lib/utils";

const STATE_CHIPS = [
  { id: "stressed", label: "Stressed", mood: "stressed" },
  { id: "anxious", label: "Anxious", mood: "anxious" },
  { id: "tired", label: "Tired", mood: "tired" },
  { id: "restless", label: "Restless", mood: "anxious" },
  { id: "good", label: "Good", mood: "calm" },
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

  const handleStateSelect = (mood: "stressed" | "anxious" | "tired" | "calm") => {
    const top = SmartPatternRecommendations.getRecommendations({
      currentMood: mood,
      timeOfDay: new Date().getHours(),
      userLevel: "beginner",
      sessionType: "classic",
    })[0];

    if (top) {
      navigate(`/session?pattern=${top.pattern.id}`, {
        state: {
          reason: `${top.pattern.name} · works in ${top.timeToEffect}`,
          reasonDetail: top.reason,
          source: "Your check-in · breath science",
        },
      });
    } else {
      navigate("/session?pattern=box");
    }
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
        Choose how you feel
      </p>
      <p className="text-sm text-muted-foreground mt-1 mb-3 text-center">
        We&apos;ll suggest a rhythm, or you can choose one below.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {STATE_CHIPS.map((c) => (
          <motion.button
            key={c.id}
            type="button"
            onClick={() => handleStateSelect(c.mood)}
            whileHover={reduceMotion ? undefined : { scale: 1.04, borderRadius: 22 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97, borderRadius: 28 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            className={cn(
              "rounded-full px-5 py-2.5 text-sm font-medium",
              "bg-card/80 text-foreground border border-border/80",
              "hover:border-primary/40 hover:bg-primary/5",
            )}
          >
            {c.label}
          </motion.button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground/70 mt-6 mb-2 text-center">or pick a rhythm</p>
      <div className="flex flex-wrap justify-center gap-2">
        {RHYTHMS.map((r) => (
          <motion.button
            key={r.id}
            type="button"
            onClick={() => handleRhythmSelect(r.id, r.label)}
            whileHover={reduceMotion ? undefined : { scale: 1.03 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 24 }}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium",
              "text-muted-foreground border border-transparent",
              "hover:border-border hover:text-foreground",
            )}
          >
            {r.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

export default TodayCard;
