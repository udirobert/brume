import React, { useRef, useState } from "react";
import { Button } from "../ui/button";
import { motion, useReducedMotion } from "framer-motion";
import { DURATION, EASE } from "@/lib/motion";
import { toast } from "sonner";
import { WordsCard } from "@/components/checkin/WordsCard";
import { shareInvitation } from "@/lib/invitation";
import { getPattern } from "@/lib/breathingPatterns";
import { formatPracticeDuration } from "@/lib/utils/practice-duration";
import { AFTER_PRACTICE_CHOICES, type AfterPracticeChoiceId } from "@/lib/checkin";
import { feelAt } from "@/lib/feelTheme";
import { CompanionAnchor } from "@/components/companion/JourneyCompanion";
import type { MascotReaction } from "@/components/BrumeMascot";
import type { RoomDemeanor } from "@/lib/roomExperience";

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
  const [after, setAfter] = useState<AfterPracticeChoiceId | null>(null);
  const [afterReaction, setAfterReaction] = useState<
    { name: MascotReaction; key: number } | undefined
  >();
  const wordsRef = useRef<HTMLDivElement>(null);

  const feel = feelAt(checkInIndex);

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

  const chooseAfter = (id: AfterPracticeChoiceId) => {
    setAfter(id);
    setAfterReaction({
      name: id === "lighter" ? "celebrate" : "settle",
      key: Date.now(),
    });
  };

  const openWords = () => {
    setWordsOpen((v) => !v);
  };

  React.useEffect(() => {
    if (!wordsOpen) return;
    const raf = requestAnimationFrame(() => {
      const el = wordsRef.current;
      if (!el) return;
      el.scrollIntoView({
        block: "nearest",
        behavior: reduceMotion ? "auto" : "smooth",
      });
      el.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [wordsOpen, reduceMotion]);

  const fade = (delay: number) =>
    reduceMotion || (typeof document !== "undefined" && document.hidden)
      ? undefined
      : {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: DURATION.standard, delay: delay * 0.55, ease: EASE },
        };

  const mascotState =
    after === "lighter"
      ? "bright"
      : after === "heavy"
        ? "tender"
        : (feel?.state ?? "watching");
  const mascotDemeanor: RoomDemeanor =
    after === "lighter" ? "open" : after === "heavy" ? "sheltering" : (feel?.demeanor ?? "open");

  const meta = [
    metrics.cycles != null && metrics.cycles > 0
      ? `${metrics.cycles} ${metrics.cycles === 1 ? "cycle" : "cycles"}`
      : null,
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col items-center text-center">
      <CompanionAnchor
        state={mascotState}
        demeanor={mascotDemeanor}
        reaction={afterReaction}
        size={96}
        className="mb-4"
      />
      <motion.div className="space-y-3 px-4" {...fade(0)}>
        <h2 className="text-3xl font-bold tracking-tight">
          {metrics.isFirstSession ? "Your first breath." : "A moment, taken."}
        </h2>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          {insight || `You practiced ${metrics.patternName}.`}
        </p>
      </motion.div>

      <motion.div className="mt-10 flex flex-col items-center gap-3" {...fade(0.12)}>
        <p className="text-sm font-medium text-foreground">How is it now?</p>
        <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="How is it now?">
          {AFTER_PRACTICE_CHOICES.map((choice) => (
            <button
              key={choice.id}
              type="button"
              aria-pressed={after === choice.id}
              onClick={() => chooseAfter(choice.id)}
              className="brume-choice"
            >
              {choice.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">You can leave it here.</p>
      </motion.div>

      <motion.div
        className="mt-10 w-full max-w-xs flex flex-col items-center gap-5"
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
          onClick={openWords}
          aria-expanded={wordsOpen}
          className="w-full rounded-full py-6 text-base"
        >
          Put it into words
        </Button>

        <details className="brume-practice-details w-full text-left">
          <summary className="text-sm text-muted-foreground cursor-pointer text-center">
            Practice details
          </summary>
          <div className="mt-4 flex flex-col items-center gap-3 text-center">
            <p className="text-3xl font-light tabular-nums tracking-tight leading-none">
              {formatPracticeDuration(metrics.duration)}
            </p>
            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              practice time
            </p>
            {meta.length > 0 && (
              <p className="text-sm text-muted-foreground">{meta.join(" · ")}</p>
            )}
            <div className="flex items-center gap-3 text-sm pt-1">
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
              {isGuest && (
                <>
                  <span className="text-muted-foreground/30">·</span>
                  <button
                    type="button"
                    onClick={onSaveProgress}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Create an account
                  </button>
                </>
              )}
            </div>
          </div>
        </details>

        {wordsOpen && (
          <div
            ref={wordsRef}
            tabIndex={-1}
            className="w-full max-w-sm mt-2 outline-none"
            aria-label="Put it into words"
          >
            <WordsCard checkInIndex={checkInIndex ?? null} />
          </div>
        )}
      </motion.div>
    </div>
  );
};
