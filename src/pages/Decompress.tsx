import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BrumeMascot, type BrumeMascotState } from "@/components/BrumeMascot";
import { startDecompressTrack } from "@/lib/decompressAudio";
import { useMascotPresence } from "@/hooks/useMascotPresence";
import {
  CHECK_IN_LABELS,
  CHECK_IN_SHORT_LABELS,
  DECOMPRESS_SECONDS,
  composeDecompressMessage,
  getDecompressStep,
  type SupportChoice,
} from "@/lib/decompress";
import "./Decompress.css";

type DecompressStage = "arrive" | "pause" | "checkin" | "done";

const SUPPORT_OPTIONS: Array<{ id: SupportChoice; label: string }> = [
  { id: "company", label: "Company" },
  { id: "space", label: "A little space" },
  { id: "listening", label: "Listening" },
  { id: "unsure", label: "Not sure" },
];

const formatRemaining = (elapsed: number) => {
  const remaining = Math.max(0, Math.ceil(DECOMPRESS_SECONDS - elapsed));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export default function Decompress() {
  const [stage, setStage] = useState<DecompressStage>("arrive");
  const [elapsed, setElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [musicOn, setMusicOn] = useState(true);
  const [audioAvailable, setAudioAvailable] = useState(true);
  const [checkInIndex, setCheckInIndex] = useState(2);
  const [checkInTouched, setCheckInTouched] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [supportChoice, setSupportChoice] = useState<SupportChoice | null>(null);
  const [message, setMessage] = useState("");
  const [messageEdited, setMessageEdited] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");
  const [sparkKey, setSparkKey] = useState(0);
  const { presence, setPresence } = useMascotPresence();
  const [nudgeState, setNudgeState] = useState<BrumeMascotState | null>(null);

  const elapsedOffsetRef = useRef(0);
  const startedAtRef = useRef(0);
  const lastUiElapsedRef = useRef(0);
  const roomRef = useRef<HTMLDivElement>(null);
  const stopAudioRef = useRef<(() => void) | null>(null);

  const step = useMemo(() => getDecompressStep(elapsed), [elapsed]);
  const checkInLabel = CHECK_IN_LABELS[checkInIndex];
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const setRoomDepth = useCallback((depth: number) => {
    const room = roomRef.current;
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!room || reduced) return;
    const mistOpacity = 0.44 - depth * 0.12;
    room.style.setProperty("--dc-depth", String(depth));
    room.style.setProperty("--dc-depth-y", `${depth * 2.4}rem`);
    room.style.setProperty("--dc-mist-left", `${depth * -2.8}rem`);
    room.style.setProperty("--dc-mist-right", `${depth * 2.2}rem`);
    room.style.setProperty("--dc-mist-up", `${depth * -1.4}rem`);
    room.style.setProperty("--dc-mist-down", `${depth * 1.2}rem`);
    room.style.setProperty("--dc-mist-scale", String(1 - depth * 0.16));
    room.style.setProperty("--dc-mist-opacity", String(mistOpacity));
    room.style.setProperty("--dc-mist-faint", String(mistOpacity * 0.62));
  }, []);

  const currentElapsed = useCallback(() => {
    if (stage !== "pause" || isPaused) return elapsedOffsetRef.current;
    return Math.min(
      DECOMPRESS_SECONDS,
      elapsedOffsetRef.current +
        (performance.now() - startedAtRef.current) / 1000,
    );
  }, [stage, isPaused]);

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

  useEffect(() => stopMusic, []);

  useEffect(() => {
    if (stage !== "pause" || isPaused) return undefined;
    startedAtRef.current = performance.now();
    lastUiElapsedRef.current = elapsedOffsetRef.current;
    let frame = 0;
    const tick = () => {
      const next = currentElapsed();
      setRoomDepth(next / DECOMPRESS_SECONDS);
      if (next - lastUiElapsedRef.current >= 0.25 || next >= DECOMPRESS_SECONDS) {
        lastUiElapsedRef.current = next;
        setElapsed(next);
      }
      if (next >= DECOMPRESS_SECONDS) {
        elapsedOffsetRef.current = DECOMPRESS_SECONDS;
        setIsPaused(false);
        stopAudioRef.current?.();
        stopAudioRef.current = null;
        setStage("checkin");
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [stage, isPaused, currentElapsed, setRoomDepth]);

  const beginPause = () => {
    elapsedOffsetRef.current = 0;
    lastUiElapsedRef.current = 0;
    setRoomDepth(0);
    setElapsed(0);
    setShareOpen(false);
    setShareFeedback("");
    setStage("pause");
    setIsPaused(false);
    if (musicOn) beginMusic();
  };

  const togglePause = () => {
    if (isPaused) {
      setIsPaused(false);
      if (musicOn) beginMusic();
      return;
    }
    const next = currentElapsed();
    elapsedOffsetRef.current = next;
    setElapsed(next);
    setRoomDepth(next / DECOMPRESS_SECONDS);
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

  const moveToCheckIn = () => {
    setIsPaused(false);
    stopMusic();
    setStage("checkin");
  };

  const chooseCheckIn = (index: number) => {
    setCheckInIndex(index);
    setCheckInTouched(true);
    if (!messageEdited) {
      setMessage(composeDecompressMessage(index, supportChoice));
    }
  };

  const openShare = () => {
    setShareOpen(true);
    setShareFeedback("");
    if (!messageEdited) {
      setMessage(composeDecompressMessage(checkInIndex, supportChoice));
    }
  };

  const chooseSupport = (choice: SupportChoice) => {
    const next = supportChoice === choice ? null : choice;
    setSupportChoice(next);
    if (!messageEdited) {
      setMessage(composeDecompressMessage(checkInIndex, next));
    }
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setShareFeedback("Copied. Nothing was sent.");
      setSparkKey((key) => key + 1);
    } catch {
      setShareFeedback("Copy is unavailable here. You can still select the message.");
    }
  };

  const shareMessage = async () => {
    try {
      await navigator.share({ text: message });
      setShareFeedback("Shared only because you chose to.");
      setSparkKey((key) => key + 1);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareFeedback("Sharing is unavailable here. You can copy the message instead.");
    }
  };

  const nudgeBrume = () => {
    setNudgeState("topup");
    window.setTimeout(() => setNudgeState(null), 950);
  };

  const handleRoomPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const room = roomRef.current;
    if (!room) return;
    const rect = room.getBoundingClientRect();
    room.style.setProperty("--dc-mx", `${event.clientX - rect.left}px`);
    room.style.setProperty("--dc-my", `${event.clientY - rect.top}px`);
  };

  const finish = () => {
    setShareOpen(false);
    setStage("done");
    setSparkKey((key) => key + 1);
  };

  const mascotState: BrumeMascotState =
    stage === "done"
      ? "proud"
      : stage === "checkin"
        ? "watching"
        : stage === "pause"
          ? step.mascot
          : "idle";
  const companion = presence === "companion";
  const displayMascot = nudgeState ?? mascotState;
  const roomMode = stage === "pause" || stage === "checkin";

  const activeRail = stage === "checkin" ? 1 : stage === "done" ? 2 : 0;

  return (
    <div className="decompress-page" data-stage={stage}>
      <nav className="dc-nav-chip" aria-label="Decompress">
        <Link to="/" className="dc-nav-chip__mark">
          Brume
        </Link>
        <Link to="/" className="dc-nav-chip__action">
          Home
        </Link>
      </nav>

      <main className={roomMode ? "dc-room" : "dc-shell"}>
        {roomMode ? (
          <div
            className={`dc-room__field ${stage === "checkin" ? "dc-room__field--checkin" : ""}`}
            ref={roomRef}
            data-rhythm={stage === "pause" && musicOn && !isPaused}
            aria-live="polite"
            onPointerMove={handleRoomPointer}
          >
            {sparkKey > 0 && <span key={sparkKey} className="dc-star-burst" aria-hidden="true" />}
            <span className="dc-room__mist dc-room__mist--one" aria-hidden="true" />
            <span className="dc-room__mist dc-room__mist--two" aria-hidden="true" />
            <span className="dc-room__mist dc-room__mist--three" aria-hidden="true" />
            <span className="dc-room__wisp" aria-hidden="true" />

            {stage === "pause" ? (
              <>
            <div className="dc-room__cue">
              <p className="dc-eyebrow">1.0 · Settle</p>
              <h1 key={step.title}>{step.title}</h1>
              <p key={`${step.title}-cue`} className="dc-room__text">{step.cue}</p>
            </div>

            <button type="button" className="dc-room__companion" onClick={nudgeBrume} aria-label="Give Brume a little nudge">
              <BrumeMascot state={displayMascot} size={156} presence={presence} breathing={companion} />
              <span>with you · tap me</span>
            </button>

            <div
              className="dc-room__shoulder"
              role="progressbar"
              aria-label="Pause progress · press to pause or resume"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round((elapsed / DECOMPRESS_SECONDS) * 100)}
              onClick={togglePause}
              title="Pause or resume"
            >
              <svg viewBox="0 0 320 92" aria-hidden="true">
                <path className="dc-room__shoulder-back" d="M 8 58 C 78 30, 128 30, 160 42 C 192 30, 242 30, 312 58" />
                <path className="dc-room__shoulder-front" d="M 8 64 C 78 36, 128 36, 160 48 C 192 36, 242 36, 312 64" />
              </svg>
            </div>

            <p className="dc-room__time">{formatRemaining(elapsed)} left · move only within comfort</p>
            <div className="dc-room__controls">
              <button type="button" className="dc-btn dc-btn--soft" onClick={togglePause}>
                {isPaused ? "Resume" : "Pause"}
              </button>
              <button type="button" className="dc-btn dc-btn--outline" onClick={moveToCheckIn}>
                Check in now
              </button>
              <button
                type="button"
                className="dc-toggle"
                aria-pressed={musicOn}
                onClick={toggleMusic}
              >
                <span className="dc-toggle__dot" aria-hidden="true" />
                {musicOn ? "Rhythm on" : "Rhythm off"}
              </button>
            </div>
              </>
            ) : (
              <>
            <div className="dc-room__cue dc-room__cue--checkin">
              <p className="dc-eyebrow">2.0 · Check in</p>
              <h1>How is it for you right now?</h1>
              <p className="dc-room__text">You don’t have to explain it.</p>
            </div>

            <button type="button" className="dc-room__companion dc-room__companion--checkin" onClick={nudgeBrume} aria-label="Give Brume a little nudge">
              <BrumeMascot state={displayMascot} size={112} presence={presence} breathing={companion} trackPointer={companion} />
            </button>

            <div
              className="dc-room__shoulder"
              role="progressbar"
              aria-label="Pause progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={100}
            >
              <svg viewBox="0 0 320 92" aria-hidden="true">
                <path className="dc-room__shoulder-back" d="M 8 58 C 78 30, 128 30, 160 42 C 192 30, 242 30, 312 58" />
                <path className="dc-room__shoulder-front" d="M 8 64 C 78 36, 128 36, 160 48 C 192 36, 242 36, 312 64" />
              </svg>
            </div>

            <div className="dc-words" role="radiogroup" aria-label="How is it for you right now?">
              {CHECK_IN_SHORT_LABELS.map((label, index) => (
                <label
                  key={label}
                  className={`dc-word ${checkInTouched && checkInIndex === index ? "is-chosen" : ""}`}
                >
                  <input
                    type="radio"
                    name="dc-checkin"
                    value={index}
                    checked={checkInTouched && checkInIndex === index}
                    onChange={() => chooseCheckIn(index)}
                    aria-label={CHECK_IN_LABELS[index]}
                  />
                  <span className="dc-word__dot" aria-hidden="true" />
                  <span className="dc-word__text">{label}</span>
                </label>
              ))}
            </div>

            <div className="dc-room__status">
              <span className="dc-slider-current" aria-live="polite">
                {checkInTouched ? checkInLabel : "Choose a point"}
              </span>
              <p className="dc-field-note" id="dc-share-help">
                {checkInTouched ? "That can be enough." : "Pick a point — or just leave it there."}
              </p>
            </div>

            <div className="dc-room__controls">
              <button type="button" className="dc-btn dc-btn--push" onClick={finish}>
                Leave it here
              </button>
              <button
                type="button"
                className="dc-btn dc-btn--soft"
                onClick={openShare}
                disabled={!checkInTouched}
                aria-describedby="dc-share-help"
              >
                Put it into words
              </button>
            </div>

            {shareOpen && checkInTouched && (
              <div className="dc-room__share-wrap">
              <section className="dc-share-card dc-room__share" aria-label="Share message">
                <div className="dc-share-card__head">
                  <h2>If you want to let someone in</h2>
                  <p>Preview it first. Nothing is sent unless you choose.</p>
                </div>

                <div className="dc-support" aria-label="What would help">
                  {SUPPORT_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={`dc-support__option ${supportChoice === option.id ? "is-selected" : ""}`}
                      aria-pressed={supportChoice === option.id}
                      onClick={() => chooseSupport(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <label className="dc-message-label" htmlFor="dc-share-message">
                  Your words
                </label>
                <textarea
                  id="dc-share-message"
                  className="dc-textarea"
                  value={message}
                  rows={4}
                  onChange={(event) => {
                    setMessage(event.target.value);
                    setMessageEdited(true);
                  }}
                />
                <p className="dc-field-note dc-field-note--reserved" aria-live="polite">
                  {shareFeedback || "You can edit this before copying or sharing."}
                </p>
                <div className="dc-actions">
                  <button type="button" className="dc-btn dc-btn--push" onClick={copyMessage}>
                    Copy message
                  </button>
                  {canNativeShare && (
                    <button type="button" className="dc-btn dc-btn--soft" onClick={shareMessage}>
                      Share…
                    </button>
                  )}
                </div>
              </section>
              </div>
            )}
              </>
            )}
          </div>
        ) : (
          <>
        <ol className="dc-rail" aria-label="Decompress flow">
          <li className={`dc-rail__item dc-rail__item--pear ${activeRail === 0 ? "is-active" : ""}`} aria-current={activeRail === 0 ? "step" : undefined}>
            <span className="dc-rail__number">1.0</span>
            <span className="dc-rail__copy">
              <strong>Settle</strong>
              <span>Two minutes with nothing to get right.</span>
            </span>
          </li>
          <li className={`dc-rail__item dc-rail__item--cyan ${activeRail === 1 ? "is-active" : ""}`} aria-current={activeRail === 1 ? "step" : undefined}>
            <span className="dc-rail__number">2.0</span>
            <span className="dc-rail__copy">
              <strong>Check in</strong>
              <span>Name the moment without explaining it.</span>
            </span>
          </li>
          <li className={`dc-rail__item dc-rail__item--coral ${activeRail === 2 ? "is-active" : ""}`} aria-current={activeRail === 2 ? "step" : undefined}>
            <span className="dc-rail__number">3.0</span>
            <span className="dc-rail__copy">
              <strong>Choose</strong>
              <span>Share it, copy it, or leave it here.</span>
            </span>
          </li>
        </ol>

        <section className="dc-panel" aria-live="polite">
          {sparkKey > 0 && <span key={sparkKey} className="dc-star-burst" aria-hidden="true" />}

          {stage === "arrive" && (
            <div className="dc-stage dc-stage--arrive">
              <div className="dc-stage__copy">
                <p className="dc-eyebrow">Brume · quiet prototype</p>
                <h1>A little room <span className="dc-hl">for you.</span></h1>
                <p className="dc-lede">
                  Two minutes, a soft rhythm, and one easy way to say how the
                  moment feels. No account. Nothing saved.
                </p>
                <div className="dc-actions">
                  <button type="button" className="dc-btn dc-btn--push" onClick={beginPause}>
                    Take a moment
                  </button>
                  <button type="button" className="dc-btn dc-btn--soft" onClick={moveToCheckIn}>
                    Just check in
                  </button>
                </div>
                <p className="dc-note">Small comfortable movements only. Skip anything that hurts.</p>
              </div>

              <div className="dc-mascot-card" data-presence={presence}>
                <BrumeMascot state={mascotState} size={132} presence={presence} breathing={companion} trackPointer={companion} />
                <p>Brume can keep you company.</p>
                <button
                  type="button"
                  className="dc-toggle"
                  aria-pressed={musicOn}
                  onClick={toggleMusic}
                >
                  <span className="dc-toggle__dot" aria-hidden="true" />
                  {musicOn ? "Rhythm on" : "Rhythm off"}
                </button>
                <div className="dc-presence" role="group" aria-label="Brume presence">
                  <button
                    type="button"
                    className={`dc-support__option ${presence === "quiet" ? "is-selected" : ""}`}
                    aria-pressed={presence === "quiet"}
                    onClick={() => setPresence("quiet")}
                  >
                    Quiet
                  </button>
                  <button
                    type="button"
                    className={`dc-support__option ${presence === "companion" ? "is-selected" : ""}`}
                    aria-pressed={presence === "companion"}
                    onClick={() => setPresence("companion")}
                  >
                    Company
                  </button>
                </div>
                {!audioAvailable && (
                  <p className="dc-field-note">Audio is unavailable in this browser.</p>
                )}
              </div>
            </div>
          )}

          {stage === "done" && (
            <div className="dc-stage dc-stage--done">
              <div className="dc-done-card">
                <BrumeMascot state={mascotState} size={132} presence={presence} breathing={companion} trackPointer={companion} />
                <p className="dc-eyebrow">3.0 · Choose</p>
                <h1>You can go now.</h1>
                <p className="dc-lede">That can be enough.</p>
                <div className="dc-actions dc-actions--center">
                  <button type="button" className="dc-btn dc-btn--soft" onClick={() => setStage("checkin")}>
                    Stay a moment
                  </button>
                  <Link to="/" className="dc-btn dc-btn--outline">
                    Back to Brume
                  </Link>
                </div>
              </div>
            </div>
          )}
        </section>
          </>
        )}
      </main>

      <footer className="dc-footer">
        <p className="dc-footer__line">A pause can be enough.</p>
        <div className="dc-footer__meta">
          <span>Brume</span>
          <span>quiet prototype · nothing saved</span>
        </div>
      </footer>
    </div>
  );
}
