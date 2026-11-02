import React, { useState } from "react";
import { Button } from "../ui/button";
import { motion, useReducedMotion } from "framer-motion";
import { DURATION, EASE } from "@/lib/motion";
import { toast } from "sonner";
import { WordsCard } from "@/components/checkin/WordsCard";
import { shareInvitation } from "@/lib/invitation";
import { getPattern } from "@/lib/breathingPatterns";
import { formatPracticeDuration } from "@/lib/utils/practice-duration";
import { BrumeMascot } from "../BrumeMascot";

interface PostSessionCelebrationProps {
  metrics: {
    patternName: string;
    duration: number;
    cycles?: number;
    sessionType?: string;
    isFirstSession?: boolean;
    streak?: number;
  };
  /** Registry id of the pattern just practised — enables the invite link. */
  patternId?: string;
  /** Word chosen on the check-in path, if any. */
  checkInIndex?: number | null;
  insight?: string;
  isGuest?: boolean;
  onContinue?: () => void;
  onSeeProgress?: () => void;
  onSaveProgress?: () => void;
  onClose?: () => void;
}

export const PostSessionCelebration: React.FC<PostSessionCelebrationProps> = ({
  metrics,
  patternId,
  checkInIndex,
  insight,
  isGuest = false,
  onContinue,
  onSeeProgress,
  onSaveProgress,
}) => {
  const reduceMotion = useReducedMotion();
  const [wordsOpen, setWordsOpen] = useState(false);

  // "Pass this break on" — the useful share: a bare /session?pattern=<id>&via=invite
  // link. No mood, history, camera data, or reflection in the URL.
  const invitePattern = patternId ? getPattern(patternId) : undefined;
  const handleInvite = async () => {
    if (!patternId) return;
    try {
      const result = await shareInvitation(patternId, invitePattern);
      if (result === "shared") {
        toast.success("Break passed on");
      } else {
        toast.success("Invite link copied — send it to someone");
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  const fade = (delay: number) =>
    reduceMotion || (typeof document !== "undefined" && document.hidden)
      ? undefined
      : {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: DURATION.standard, delay: delay * 0.55, ease: EASE },
        };

  const meta = [
    metrics.cycles != null && metrics.cycles > 0 ? `${metrics.cycles} cycles` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col items-center text-center">
      <BrumeMascot state="proud" size={96} className="mb-4" />
      <motion.div className="space-y-3 px-4" {...fade(0)}>
        <h2 className="text-3xl font-bold tracking-tight">
          {metrics.isFirstSession ? "Your first breath." : "Session complete."}
        </h2>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          {insight || `You practiced ${metrics.patternName}.`}
        </p>
      </motion.div>

      <motion.div className="mt-14 space-y-3" {...fade(0.12)}>
        <p className="text-7xl md:text-8xl font-light tabular-nums tracking-tight leading-none">
          {formatPracticeDuration(metrics.duration)}
        </p>
        <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          practice time
        </p>
        <p className="text-sm text-muted-foreground pt-1">
          {meta.join(" · ")}
        </p>
      </motion.div>

      {isGuest && (
        <motion.p className="mt-10 text-sm text-muted-foreground px-4" {...fade(0.22)}>
          <button
            type="button"
            onClick={onSaveProgress}
            className="font-medium text-primary hover:underline underline-offset-2"
          >
            Create an account
          </button>{" "}
          to keep this practice across devices.
        </motion.p>
      )}

      <motion.div
        className="mt-12 w-full max-w-xs flex flex-col items-center gap-5"
        {...fade(0.28)}
      >
        <Button
          onClick={onContinue}
          className="w-full rounded-full btn-premium py-6 text-base"
        >
          Done
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setWordsOpen((v) => !v)}
          aria-expanded={wordsOpen}
          className="w-full rounded-full py-6 text-base"
        >
          Put it into words
        </Button>
        <div className="flex items-center gap-3 text-sm">
          {patternId && (
            <>
              <button
                type="button"
                onClick={() => void handleInvite()}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Pass this break on
              </button>
              <span className="text-muted-foreground/30">·</span>
            </>
          )}
          <button
            type="button"
            onClick={onSeeProgress}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Progress
          </button>
        </div>
        {wordsOpen && (
          <div className="w-full max-w-sm mt-2">
            <WordsCard checkInIndex={checkInIndex ?? null} />
          </div>
        )}
      </motion.div>
    </div>
  );
};
