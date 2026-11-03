import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { DURATION, EASE } from "@/lib/motion";
import { useAuth } from "@/hooks/useAuth";
import { TodayCard } from "@/components/home/TodayCard";
import { BrumeMascot } from "@/components/BrumeMascot";
import { WordReveal, type WordPart } from "@/components/atmosphere/WordReveal";
import { AbsorbDroplet } from "@/components/atmosphere/AbsorbDroplet";
import { useMascotPresence } from "@/hooks/useMascotPresence";
import { useDayPart } from "@/hooks/useDayPart";
import { roomWhisper } from "@/lib/atmosphere/dayPart";
import { applyFeel, feelAt } from "@/lib/feelTheme";

/**
 * Home — reset-first.
 *
 * One obvious action: a guided Reset (in 4, out 6). No check-in
 * required, no camera. The mood check-in stays available below
 * as the secondary path for anyone who wants a matched pattern.
 */
export default function Index() {
  const { user } = useAuth();
  const isGuest = !user;
  const reduceMotion = useReducedMotion() || (typeof document !== "undefined" && document.hidden);
  const dayPart = useDayPart();
  const { presence, setPresence } = useMascotPresence();
  const companion = presence === "companion";
  const [feelTap, setFeelTap] = useState<number | null>(null);
  const [droplet, setDroplet] = useState<{
    key: number;
    from: { x: number; y: number };
    to: { x: number; y: number };
    color: string;
  } | null>(null);
  const mascotCardRef = useRef<HTMLDivElement>(null);
  const feel = feelAt(feelTap);

  // The chip sheds its word into the room: a droplet melts toward the
  // mascot while the mist takes the feeling's colour and weight.
  const handleFeel = (index: number, chip: HTMLElement) => {
    setFeelTap(index);
    applyFeel(index);
    const next = feelAt(index);
    const card = mascotCardRef.current;
    if (reduceMotion || !next || !card) return;
    const a = chip.getBoundingClientRect();
    const b = card.getBoundingClientRect();
    setDroplet({
      key: Date.now(),
      from: { x: a.left + a.width / 2, y: a.top + a.height / 2 },
      to: { x: b.left + b.width / 2, y: b.top + b.height / 2 },
      color: next.orbMist,
    });
  };

  const headline = useMemo((): WordPart[] => {
    if (isGuest) {
      return [
        "A little room to ",
        { text: "breathe.", className: "brume-hl" },
      ];
    }
    return ["Welcome back."];
  }, [isGuest]);

  return (
    <div className="w-full flex flex-col items-center px-2">
      <div className="relative text-center space-y-2 max-w-2xl">
        <motion.div
          className="flex justify-center mb-4"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: DURATION.standard, delay: 0.04, ease: EASE }}
        >
          <div className="brume-mascot-card w-56" data-presence={presence} ref={mascotCardRef}>
            <BrumeMascot
              state={feel?.state ?? "idle"}
              size={104}
              presence={presence}
              breathing={companion}
              trackPointer={companion}
              layoutId="brume-companion"
              reaction={feel?.reaction ? { name: feel.reaction, key: feelTap ?? -1 } : undefined}
            />
            <p>Brume can keep you company.</p>
            <div className="flex gap-2" role="group" aria-label="Brume presence">
              <button
                type="button"
                className={`brume-pill ${!companion ? "is-selected" : ""}`}
                aria-pressed={!companion}
                onClick={() => setPresence("quiet")}
              >
                Quiet
              </button>
              <button
                type="button"
                className={`brume-pill ${companion ? "is-selected" : ""}`}
                aria-pressed={companion}
                onClick={() => setPresence("companion")}
              >
                Company
              </button>
            </div>
          </div>
        </motion.div>
        <WordReveal
          parts={headline}
          className="text-3xl md:text-5xl font-bold tracking-tight text-foreground leading-[1.1]"
        />
        <motion.p
          className="text-muted-foreground max-w-md mx-auto"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.standard, delay: 0.08, ease: EASE }}
        >
          {roomWhisper(dayPart)}
        </motion.p>
      </div>

      {/* Primary: a guided Reset. No check-in required. */}
      <motion.div
        className="mt-10 flex flex-col items-center w-full max-w-xs"
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: DURATION.standard, delay: 0.12, ease: EASE }}
      >
        <Link
          to="/session?pattern=reset"
          className="brume-btn brume-btn--push w-full py-4 text-base"
          state={{
            reason: "Reset · 4 in, 6 out",
            reasonDetail: "In for 4, out for 6. A moment between tasks.",
            source: "Your reset",
          }}
        >
          Start a breathing reset
        </Link>
        <p className="mt-3 text-sm text-muted-foreground">
          In for 4, out for 6 · nothing to get right
        </p>
      </motion.div>

      {/* Secondary: the check-in path — still here, just not the lead. */}
      <motion.div
        className="mt-12 flex flex-col items-center w-full"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: DURATION.standard, delay: 0.18, ease: EASE }}
      >
        <div className="w-full max-w-2xl brume-card px-4 py-6 md:px-7">
          <TodayCard onFeel={handleFeel} />
        </div>
        <Link
          to="/decompress"
          className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Want a longer pause? Take two minutes
        </Link>
      </motion.div>

      {isGuest && (
        <motion.div
          className="mt-10 text-center space-y-2"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DURATION.standard, delay: 0.22, ease: EASE }}
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

      {droplet && (
        <AbsorbDroplet
          key={droplet.key}
          from={droplet.from}
          to={droplet.to}
          color={droplet.color}
          onDone={() => setDroplet(null)}
        />
      )}
    </div>
  );
}
