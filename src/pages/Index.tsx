import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { DURATION, EASE } from "@/lib/motion";
import { viewTransitionTo, vtClick } from "@/lib/viewTransition";
import { Magnetic } from "@/lib/Magnetic";
import { useAuth } from "@/hooks/useAuth";
import { TodayCard } from "@/components/home/TodayCard";
import { BrumeMascot, type MascotReaction } from "@/components/BrumeMascot";
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
const RHYTHMS = [
  { id: "box", label: "Box" },
  { id: "relaxation", label: "4-7-8" },
  { id: "wim_hof", label: "Wim Hof" },
  { id: "sleep", label: "Sleep" },
] as const;

/** "More rhythms" — a quiet popover of direct rhythm picks. */
function RhythmPeek() {
  const navigate = useNavigate();
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none hover:text-foreground transition-colors [&::-webkit-details-marker]:hidden">
        More rhythms
      </summary>
      <div className="absolute left-1/2 top-full z-20 mt-2 flex -translate-x-1/2 gap-2">
        {RHYTHMS.map((r) => (
          <button
            key={r.id}
            type="button"
            className="brume-pill px-3 py-1.5 text-xs whitespace-nowrap"
            onClick={(event) =>
              viewTransitionTo(
                () =>
                  navigate(`/session?pattern=${r.id}`, {
                    state: {
                      reason: r.label,
                      reasonDetail: "You picked this rhythm.",
                      source: "Your choice",
                    },
                  }),
                { origin: event.currentTarget },
              )
            }
          >
            {r.label}
          </button>
        ))}
      </div>
    </details>
  );
}

export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isGuest = !user;
  const reduceMotion = useReducedMotion() || (typeof document !== "undefined" && document.hidden);
  const dayPart = useDayPart();
  const { presence, setPresence } = useMascotPresence();
  const companion = presence === "companion";
  const [feelTap, setFeelTap] = useState<number | null>(null);
  const [mascotReaction, setMascotReaction] = useState<
    { name: MascotReaction; key: number } | undefined
  >();
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
  // A null index means the word was put back down — the room lets go.
  const handleFeel = (index: number | null, chip?: HTMLElement) => {
    setFeelTap(index);
    const a = chip?.getBoundingClientRect();
    applyFeel(
      index,
      a ? { x: a.left + a.width / 2, y: a.top + a.height / 2 } : undefined,
    );
    const next = feelAt(index);
    if (next?.reaction) {
      setMascotReaction({ name: next.reaction, key: Date.now() });
    }
    const card = mascotCardRef.current;
    if (reduceMotion || !next || !card || !a) return;
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
              reaction={mascotReaction}
              tapReaction="ready"
            />
            <p>Brume can keep you company.</p>
            <div className="flex gap-2" role="group" aria-label="Brume presence">
              <Magnetic pull={0.15} radius={110}>
              <button
                type="button"
                className={`brume-pill ${!companion ? "is-selected" : ""}`}
                aria-pressed={!companion}
                onClick={() => {
                  if (!companion) return;
                  setPresence("quiet");
                  setMascotReaction({ name: "settle", key: Date.now() });
                }}
              >
                Quiet
              </button>
              </Magnetic>
              <Magnetic pull={0.15} radius={110}>
              <button
                type="button"
                className={`brume-pill ${companion ? "is-selected" : ""}`}
                aria-pressed={companion}
                onClick={() => {
                  if (companion) return;
                  setPresence("companion");
                  setMascotReaction({ name: "hop", key: Date.now() });
                }}
              >
                Company
              </button>
              </Magnetic>
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
        <Magnetic className="w-full">
        <Link
          to="/session?pattern=reset"
          className="brume-btn brume-btn--push w-full py-4 text-base"
          state={{
            reason: "Reset · 4 in, 6 out",
            reasonDetail: "In for 4, out for 6. A moment between tasks.",
            source: "Your reset",
          }}
          onClick={(e) =>
            vtClick(e, () =>
              navigate("/session?pattern=reset", {
                state: {
                  reason: "Reset · 4 in, 6 out",
                  reasonDetail: "In for 4, out for 6. A moment between tasks.",
                  source: "Your reset",
                },
              }),
            )
          }
        >
          Start a breathing reset
        </Link>
        </Magnetic>
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
        <div className="w-full max-w-2xl brume-card px-4 py-5 md:px-7">
          <TodayCard onFeel={handleFeel} />
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <RhythmPeek />
          <span aria-hidden="true">·</span>
          <Link
            to="/decompress"
            className="hover:text-foreground transition-colors"
            onClick={(e) => vtClick(e, () => navigate("/decompress"))}
          >
            Take two minutes
          </Link>
        </div>
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
