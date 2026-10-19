import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { TodayCard } from "@/components/home/TodayCard";
import { BrumeMascot } from "@/components/BrumeMascot";
import { WordReveal, type WordPart } from "@/components/atmosphere/WordReveal";
import { Button } from "@/components/ui/button";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { useDayPart } from "@/hooks/useDayPart";
import { roomWhisper } from "@/lib/atmosphere/dayPart";

/**
 * Home — reset-first.
 *
 * One obvious action: a ~90-second Reset (in 4, out 6). No check-in
 * required, camera optional. The mood check-in stays available below
 * as the secondary path for anyone who wants a matched pattern.
 */
export default function Index() {
  const { user } = useAuth();
  const { streak } = useSessionHistory();
  const isGuest = !user;
  const reduceMotion = useReducedMotion();
  const dayPart = useDayPart();

  const headline = useMemo((): WordPart[] => {
    if (streak > 0) {
      return [`Day ${streak}. Keep it breathing.`];
    }
    if (isGuest) {
      return [
        "A breathing break between thinking and ",
        { text: "doing.", className: "text-gradient" },
      ];
    }
    return ["Welcome back."];
  }, [isGuest, streak]);

  return (
    <div className="w-full flex flex-col items-center px-2">
      <div className="relative text-center space-y-2 max-w-2xl">
        <motion.div
          className="flex justify-center mb-4"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        >
          <BrumeMascot state="idle" size={104} />
        </motion.div>
        <WordReveal
          parts={headline}
          className="text-3xl md:text-5xl font-bold tracking-tight text-foreground leading-[1.1]"
        />
        <motion.p
          className="text-muted-foreground max-w-md mx-auto"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          {streak > 0
            ? "One check-in, one session — that's the whole practice."
            : roomWhisper(dayPart)}
        </motion.p>
      </div>

      {/* Primary: the ~90-second Reset. No check-in, camera optional. */}
      <motion.div
        className="mt-10 flex flex-col items-center w-full max-w-xs"
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.48, ease: [0.16, 1, 0.3, 1] }}
      >
        <Button asChild size="lg" className="w-full rounded-full btn-premium py-6 text-base">
          <Link
            to="/session?pattern=reset"
            state={{
              reason: "Reset · about 90 seconds",
              reasonDetail: "In for 4, out for 6. A moment between tasks.",
              source: "Your reset",
            }}
          >
            Take a reset
          </Link>
        </Button>
        <p className="mt-3 text-sm text-muted-foreground">
          About 90 seconds · camera optional
        </p>
      </motion.div>

      {/* Secondary: the check-in path — still here, just not the lead. */}
      <motion.div
        className="mt-12 flex justify-center w-full"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.62 }}
      >
        <TodayCard />
      </motion.div>

      {isGuest && (
        <motion.div
          className="mt-10 text-center space-y-2"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.7 }}
        >
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/auth?redirect=/"
              className="font-semibold text-primary hover:underline underline-offset-2"
            >
              Sign in
            </Link>
          </p>
        </motion.div>
      )}
    </div>
  );
}
