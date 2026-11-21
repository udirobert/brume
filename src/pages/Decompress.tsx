import { track } from "@/lib/events";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { type BrumeMascotState, type MascotReaction } from "@/components/BrumeMascot";
import { CompanionAnchor } from "@/components/companion/JourneyCompanion";
import { startDecompressTrack } from "@/lib/decompressAudio";
import { useMascotPresence } from "@/hooks/useMascotPresence";
import { useIsMobile } from "@/hooks/use-mobile";
import { DECOMPRESS_SECONDS, getDecompressStep } from "@/lib/decompress";
import { CheckInWords } from "@/components/checkin/CheckInWords";
import {
  DecompressPond,
  type PondBeat,
  type PondMoment,
} from "@/components/atmosphere/DecompressPond";
import { PauseIcon, PlayIcon } from "@/components/icons/BrumeIcons";
import { WordsCard } from "@/components/checkin/WordsCard";
import { applyFeel, feelAt } from "@/lib/feelTheme";
import { demeanorForFeel, practiceProgress, useRoomExperience } from "@/lib/roomExperience";
import "./Decompress.css";

type DecompressStage = "arrive" | "pause" | "rest" | "checkin";

// Closed, plain-language headlines keyed to the internal step identity —
// step.title/cue stay the lib contract; the room renders these instead.
const STEP_HEADLINE: Record<string, string> = {
  Arrive: "Rest your hands.",
  Settle: "Let your shoulders drop.",
  Roll: "Circle your shoulders.",
  Soften: "Let your arms hang.",
  Land: "Come to stillness.",
};

const STEP_GUIDANCE: Record<number, string> = {
  20: "Skip any movement that hurts.",
  48: "Small circles, if comfortable.",
};

/** A soft speaker — rhythm toggle, drawn in the same stroke style. */
const SoundIcon = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 9.5v5h3.2l4.3 3.4c.7.6 1.7.1 1.7-.8V6.9c0-.9-1-1.4-1.7-.8L8.2 9.5H5z" />
    <path d="M17 9.2c1.1 1.5 1.1 4.1 0 5.6" />
  </svg>
);

/** A tiny hand-drawn firefly with a dotted flight trail. */
const FireflyGlyph = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <path
      d="M12.4 13.6c0 2.4-1.6 4-3.6 4s-3.4-1.7-3.4-4c0-2.3 1.5-4.1 3.4-4.1s3.6 1.7 3.6 4.1z"
      fill="var(--brume-coral-deep)"
      opacity=".85"
    />
    <path
      d="M9.6 9.8c.8-2 2.6-3.4 4.6-3.8M8 9.8C7.2 7.8 5.4 6.4 3.6 6"
      stroke="var(--brume-ink)"
      strokeWidth="1.1"
      strokeLinecap="round"
    />
    <circle cx="8.8" cy="15.4" r="1.3" fill="var(--brume-pear)" />
    <circle cx="16.4" cy="12.8" r=".8" fill="var(--brume-coral-deep)" />
    <circle cx="18.4" cy="10.4" r=".8" fill="var(--brume-coral-deep)" />
    <circle cx="19.6" cy="7.6" r=".8" fill="var(--brume-coral-deep)" />
  </svg>
);

/** A small folded envelope with its flap. */
const EnvelopeGlyph = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <path
      d="M3.6 6.8c0-.6.5-1.1 1.1-1.1h12.6c.6 0 1.1.5 1.1 1.1v8.4c0 .6-.5 1.1-1.1 1.1H4.7c-.6 0-1.1-.5-1.1-1.1V6.8z"
      stroke="var(--brume-ink)"
      strokeWidth="1.2"
    />
    <path
      d="M4.2 7l6.8 4.6L17.8 7"
      stroke="var(--brume-ink)"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const formatRemaining = (elapsed: number) => {
  const remaining = Math.max(0, Math.ceil(DECOMPRESS_SECONDS - elapsed));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

function DecompressRoom() {
  const isMobile = useIsMobile();
  const { presence } = useMascotPresence();
  const companion = presence === "companion";

  const [stage, setStage] = useState<DecompressStage>("arrive");
  const [elapsed, setElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const [checkInIndex, setCheckInIndex] = useState(2);
  const [checkInTouched, setCheckInTouched] = useState(false);
  const [wordsOpen, setWordsOpen] = useState(false);
  const [nudgeReaction, setNudgeReaction] = useState<{ name: MascotReaction; key: number } | undefined>();
  const [pondMoment, setPondMoment] = useState<PondMoment>({ kind: "idle", id: 0 });

  const headRef = useRef<HTMLHeadingElement>(null);
  const elapsedOffsetRef = useRef(0);
  const startedAtRef = useRef(0);
  const stopAudioRef = useRef<(() => void) | null>(null);
  const rafRef = useRef(0);
  const reactionSerial = useRef(0);

  const step = getDecompressStep(elapsed);

  const currentElapsed = () => {
    if (isPaused) return elapsedOffsetRef.current;
    return Math.min(
      DECOMPRESS_SECONDS,
      elapsedOffsetRef.current + (performance.now() - startedAtRef.current) / 1000,
    );
  };

  const stopMusic = () => {
    stopAudioRef.current?.();
    stopAudioRef.current = null;
  };

  const beginMusic = () => {
    if (stopAudioRef.current) return;
    try {
      const stop = startDecompressTrack(elapsedOffsetRef.current);
      if (!stop) {
        setAudioAvailable(false);
        setMusicOn(false);
        return;
      }
      stopAudioRef.current = stop;
    } catch {
      setAudioAvailable(false);
      setMusicOn(false);
    }
  };

  useEffect(() => {
    document.title = "Decompress · Brume";
    return () => {
      document.title = "Brume";
    };
  }, []);

  // The heading holds focus once per stage so the timer's own updates
  // never steal it.
  useEffect(() => {
    headRef.current?.focus();
  }, [stage]);


  useEffect(() => stopMusic, []);

  useEffect(() => {
    const room = useRoomExperience.getState();
    if (stage !== "pause") {
      if (room.practicing || room.paused) {
        room.setPractice({ practicing: false, paused: false });
      }
      return;
    }
    room.setPractice({
      progress: practiceProgress(elapsed),
      breath: 0,
      practicing: !isPaused,
      paused: isPaused,
    });
  }, [stage, elapsed, isPaused]);

  useEffect(
    () => () => {
      useRoomExperience.getState().setPractice({ practicing: false, paused: false });
      cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const playBeat = (kind: Exclude<PondBeat, "idle">) => {
    const key = ++reactionSerial.current;
    setPondMoment({ kind, id: key });
    setNudgeReaction({ name: kind === "land" ? "settle" : "hop", key });
  };

  const finishPause = () => {
    cancelAnimationFrame(rafRef.current);
    elapsedOffsetRef.current = 0;
    setIsPaused(false);
    stopMusic();
    playBeat("land");
    setStage("rest");
  };

  // Active time only: pausing freezes the offset, resuming restarts the
  // clock from it, so wall-clock pauses never count.
  useEffect(() => {
    if (stage !== "pause" || isPaused) return undefined;
    startedAtRef.current = performance.now();
    let lastSecond = Math.floor(elapsedOffsetRef.current);
    const tick = () => {
      const next = currentElapsed();
      if (next >= DECOMPRESS_SECONDS) {
        finishPause();
        return;
      }
      const second = Math.floor(next);
      if (second !== lastSecond) {
        lastSecond = second;
        setElapsed(second);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, isPaused]);

  const begin = () => {
    elapsedOffsetRef.current = 0;
    setElapsed(0);
    setIsPaused(false);
    setWordsOpen(false);
    playBeat("enter");
    setStage("pause");
    if (musicOn) beginMusic();
  };

  const togglePause = () => {
    if (isPaused) {
      setIsPaused(false);
      if (musicOn) beginMusic();
      return;
    }
    elapsedOffsetRef.current = currentElapsed();
    setElapsed(elapsedOffsetRef.current);
    setIsPaused(true);
    stopMusic();
  };

  const toggleMusic = () => {
    const next = !musicOn;
    setMusicOn(next);
    if (!next) {
      stopMusic();
      return;
    }
    if (stage === "pause" && !isPaused) beginMusic();
  };

  const chooseCheckIn = (index: number) => {
    setCheckInIndex(index);
    setCheckInTouched(true);
    applyFeel(index);
    track("checkin_word", { feeling: index, surface: "decompress" });
    const reaction = feelAt(index)?.reaction;
    if (reaction) setNudgeReaction({ name: reaction, key: ++reactionSerial.current });
  };

  const nudgeBrume = () => {
    playBeat("splash");
  };

  const mascotState: BrumeMascotState =
    stage === "rest"
      ? "tender"
      : stage === "checkin"
        ? (checkInTouched ? (feelAt(checkInIndex)?.state ?? "watching") : "watching")
        : stage === "pause"
          ? step.mascot
          : "idle";
  const demeanor = checkInTouched ? demeanorForFeel(checkInIndex) : "open";

  const h1 =
    stage === "arrive"
      ? "A little room for you."
      : stage === "pause"
        ? (isPaused ? "Paused." : (STEP_HEADLINE[step.title] ?? step.title))
        : stage === "rest"
          ? "A moment of rest."
          : "How are you feeling?";

  return (
    <div className="decompress-page" data-stage={stage} data-paused={isPaused || undefined}>
      <div className="dc-col">
        <h1 ref={headRef} tabIndex={-1} className="dc-h1" aria-live={stage === "pause" ? "polite" : "off"} aria-atomic="true">
          <span key={h1} className="dc-h1__text">{h1}</span>
        </h1>

        <button
          type="button"
          className="dc-pond"
          onClick={nudgeBrume}
          aria-label="Make a ripple with Brume"
        >
          <span className="dc-pond__art" aria-hidden="true">
            <DecompressPond
              moment={pondMoment}
              mood={stage === "arrive" ? "bank" : stage === "pause" ? "near" : "rest"}
            />
          </span>
          <span className="dc-pond__sprite">
            <CompanionAnchor
              size={isMobile ? 132 : 156}
              state={mascotState}
              presence={presence}
              breathing={companion}
              trackPointer={companion}
              reaction={nudgeReaction}
              demeanor={demeanor}
            />
          </span>
        </button>

        {stage === "arrive" && (
          <div key="arrive" className="dc-stage-copy">
            <button type="button" className="brume-btn brume-btn--push" onClick={begin}>
              Begin a two-minute pause
            </button>
            <p className="dc-clue">A quiet shoulder break.</p>
            <div className="dc-quiet-links dc-quiet-links--below">
              <a className="dc-quiet-link dc-quiet-link--art" href="/decompress?room=firefly">
                <FireflyGlyph />
                Play with a firefly
              </a>
              <a className="dc-quiet-link dc-quiet-link--art" href="/decompress?room=minute">
                <EnvelopeGlyph />
                Make a gift
              </a>
            </div>
          </div>
        )}

        {stage === "pause" && (
          <div key="pause" className="dc-stage-copy">
            {STEP_GUIDANCE[step.start] && !isPaused && (
              <p className="dc-field-note">{STEP_GUIDANCE[step.start]}</p>
            )}
            <p className="dc-time">{formatRemaining(elapsed)} left</p>
            <div className="dc-actions dc-actions--center">
              <button type="button" className="brume-btn brume-btn--soft" onClick={togglePause}>
                {isPaused ? <PlayIcon size={15} /> : <PauseIcon size={15} />}
                {isPaused ? "Resume" : "Pause"}
              </button>
              <button type="button" className="brume-btn brume-btn--outline" onClick={finishPause}>
                Finish early
              </button>
            </div>
            <button
              type="button"
              className="brume-toggle"
              aria-pressed={musicOn}
              aria-label="Rhythm sound"
              onClick={toggleMusic}
            >
              <SoundIcon size={15} />
              {musicOn ? "Sound on" : "Sound off"}
            </button>
            {!audioAvailable && (
              <p className="dc-field-note">Audio is unavailable in this browser.</p>
            )}
          </div>
        )}

        {stage === "rest" && (
          <div key="rest" className="dc-stage-copy">
            <Link to="/" className="brume-btn brume-btn--push">
              Done
            </Link>
            <div className="dc-quiet-links">
              <button type="button" className="dc-quiet-link" onClick={() => setStage("checkin")}>
                Add a word
              </button>
            </div>
          </div>
        )}

        {stage === "checkin" && (
          <div key="checkin" className="dc-stage-copy">
            <CheckInWords index={checkInIndex} touched={checkInTouched} onChoose={chooseCheckIn} />
            {checkInTouched && !wordsOpen && (
              <button
                type="button"
                className="brume-btn brume-btn--soft"
                onClick={() => setWordsOpen(true)}
              >
                Put it into words
              </button>
            )}
            {checkInTouched && wordsOpen && (
              <>
                <WordsCard key={checkInIndex} checkInIndex={checkInIndex} />
                <p className="dc-field-note">
                  Your message stays here until you copy or share it.
                </p>
              </>
            )}
            <div className="dc-quiet-links">
              <Link to="/" className="dc-quiet-link">
                Done
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const RoomPlay = lazy(() => import("@/components/roomplay/RoomPlay"));

export default function Decompress() {
  const { search } = useLocation();
  const room = new URLSearchParams(search).get("room");
  if (room === "firefly" || room === "minute") {
    return (
      <Suspense fallback={null}>
        <RoomPlay room={room} />
      </Suspense>
    );
  }
  return <DecompressRoom />;
}
