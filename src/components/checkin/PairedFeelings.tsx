import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  FEELINGS,
  FEELING_PAIRS,
  HOME_FEELING_COPY,
  initialPairedFeelState,
  oppositeFeel,
  pairForFeel,
  selectPairedFeel,
} from "@/lib/feelings";
import { hasNegation, listenOnce, voiceCheckinSupported } from "@/lib/voiceCheckin";
import { track } from "@/lib/events";

const HINT_KEY = "brume.feelingFlipHint.v1";

function readHintSeen(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}
function writeHintSeen() {
  try {
    window.localStorage.setItem(HINT_KEY, "1");
  } catch (e) {
    void e;
  }
}

export function PairedFeelings({
  selectedIndex,
  onChoose,
  onVoiceState,
  onPatternOffer,
  showHint = true,
}: {
  selectedIndex: number | null;
  onChoose: (index: number | null, button: HTMLButtonElement, fromOffer?: boolean) => void;
  onVoiceState?: (state: "listening" | "matched" | "missed", index?: number) => void;
  /** A rhythm name heard in the utterance — proposed, never committed. */
  onPatternOffer?: (patternId: string) => void;
  showHint?: boolean;
}) {
  const reduced = useReducedMotion();
  const descId = useId();
  const [faces, setFaces] = useState<number[]>(
    () => initialPairedFeelState(selectedIndex).faces,
  );
  const [hintOpen, setHintOpen] = useState(false);
  const [flips, setFlips] = useState<number[]>(() => FEELING_PAIRS.map(() => 0));
  const [announce, setAnnounce] = useState("");
  const hintSeenRef = useRef(readHintSeen());
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [micOn, setMicOn] = useState(false);
  const [suggested, setSuggested] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [heard, setHeard] = useState("");
  const [dissolve, setDissolve] = useState(false);
  const heardTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const heardClearTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The transcript is matched and dropped — so it dissolves, on screen,
  // into the mist it came from. Nothing it heard is kept.
  const flashHeard = (s: string) => {
    setHeard(s);
    setDissolve(false);
    clearTimeout(heardClearTimer.current);
    clearTimeout(heardTimer.current);
    heardTimer.current = setTimeout(() => setDissolve(true), 4200);
    heardClearTimer.current = setTimeout(() => {
      setHeard("");
      setDissolve(false);
    }, 6000);
  };
  const voiceOk = useMemo(() => voiceCheckinSupported(), []);

  useEffect(() => {
    const pair = pairForFeel(selectedIndex);
    if (!pair || selectedIndex == null) return;
    const i = FEELING_PAIRS.indexOf(pair);
    setFaces((prev) => {
      if (prev[i] === selectedIndex) return prev;
      const next = [...prev];
      next[i] = selectedIndex;
      return next;
    });
  }, [selectedIndex]);

  useEffect(() => {
    if (!hintOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHintOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hintOpen]);

  const handlePick = useCallback(
    (pairIndex: number, button: HTMLButtonElement) => {
      const wasOffered = suggested !== null;
      setSuggested(null);
      const next = selectPairedFeel(
        { faces, selected: selectedIndex },
        pairIndex,
      );
      const flipped = next.faces[pairIndex] !== faces[pairIndex];
      setFaces(next.faces);
      if (flipped) {
        setFlips((f) => f.map((v, i) => (i === pairIndex ? v + 1 : v)));
        setHintOpen(false);
      } else if (showHint && !hintSeenRef.current) {
        hintSeenRef.current = true;
        writeHintSeen();
        setHintOpen(true);
      }
      setAnnounce(`${FEELINGS[next.selected!].label} selected.`);
      onChoose(next.selected!, button, wasOffered && next.selected === suggested);
    },
    [faces, selectedIndex, onChoose, showHint, suggested],
  );

  // Voice proposes and never commits: whatever is heard, the closest word
  // turns itself face-up and waits for a tap. A misread costs nothing and
  // a hit and a miss are the same interaction — so there is no rule here
  // the user has to remember, and nothing Brume can say about them that
  // they did not confirm.
  const onMicTap = useCallback(async () => {
    if (micOn) {
      abortRef.current?.abort(); // tap again to stop early
      return;
    }
    setMicOn(true);
    setHeard("listening…");
    onVoiceState?.("listening");
    abortRef.current = new AbortController();
    const { transcript, index, suggest, pattern } = await listenOnce(setHeard, abortRef.current.signal);
    const offered = index ?? suggest;
    track("checkin_voice_used", { matched: index != null, offered });
    setMicOn(false);
    onVoiceState?.(offered != null || pattern != null ? "matched" : "missed", offered ?? undefined);
    const snippet = transcript.trim().slice(0, 28);
    const pair = offered == null ? null : pairForFeel(offered);
    if (offered == null || !pair) {
      if (pattern) {
        onPatternOffer?.(pattern);
        setAnnounce("Heard a rhythm — tap Rhythm below to use it.");
        flashHeard(`heard “${snippet}” — a rhythm? below`);
        return;
      }
      if (transcript && hasNegation(transcript)) {
        // The refusal is the feature: it heard every word and chooses
        // not to guess — say so, out loud, instead of a generic miss.
        setAnnounce("Heard you — I'll ask instead of guessing.");
        flashHeard(`heard “${snippet}” — I'll ask instead`);
        return;
      }
      flashHeard(
        transcript
          ? `heard “${snippet}” — tap a word`
          : "didn't catch that — try again or tap",
      );
      return;
    }
    if (selectedIndex === offered) {
      // That is already the word you carry — nothing to offer.
      flashHeard(`heard “${snippet}”`);
      return;
    }
    const pi = FEELING_PAIRS.indexOf(pair);
    if (faces[pi] !== offered) {
      setFaces((prev) => {
        const nextFaces = [...prev];
        nextFaces[pi] = offered;
        return nextFaces;
      });
      setFlips((f) => f.map((v, i) => (i === pi ? v + 1 : v)));
    }
    setSuggested(offered);
    setAnnounce(`Heard ${transcript} — ${FEELINGS[offered].label}? Tap to choose.`);
    flashHeard(
      `heard “${snippet}” — ${index == null ? "maybe " : ""}${FEELINGS[offered].label}? tap to choose`,
    );
  }, [micOn, faces, selectedIndex, onVoiceState, onPatternOffer]);

  return (
    <div className="brume-pairs" role="group" aria-label="Choose a feeling">
      {FEELING_PAIRS.map((pair, i) => {
        const face = faces[i];
        const feel = FEELINGS[face];
        const selected = selectedIndex === face;
        const opposite = oppositeFeel(face);
        const minW = Math.max(
          FEELINGS[pair.indices[0]].label.length,
          FEELINGS[pair.indices[1]].label.length,
        );
        return (
          <button
            key={pair.id}
            type="button"
            ref={(el) => {
              chipRefs.current[i] = el;
            }}
            className={`brume-choice brume-choice--flip${selected ? " is-selected" : ""}${feel.valence === "positive" ? " is-positive" : ""}${suggested === face ? " is-suggested" : ""}`}
            aria-pressed={selected}
            aria-label={feel.label}
            aria-describedby={
              selected
                ? `${descId}-${i}${hintOpen ? ` ${descId}-hint` : ""}`
                : undefined
            }
            style={{ width: `min(8rem, ${Math.max(5.4, minW * 0.48 + 1.9)}rem)` }}
            onClick={(e) => handlePick(i, e.currentTarget)}
          >
            <span id={`${descId}-${i}`} className="sr-only">
              {`Activate again for ${opposite != null ? FEELINGS[opposite].label : ""}.`}
            </span>
            <motion.span
              key={`${face}-${flips[i]}`}
              className="brume-choice__face"
              initial={
                flips[i] === 0
                  ? false
                  : reduced
                    ? { opacity: 0 }
                    : { rotateX: -72, opacity: 0 }
              }
              animate={reduced ? { opacity: 1 } : { rotateX: 0, opacity: 1 }}
              transition={{ duration: reduced ? 0.16 : 0.32, ease: "easeOut" }}
            >
              {feel.label}
            </motion.span>
            {selected && (
              <svg
                className="brume-choice__turn"
                aria-hidden="true"
                viewBox="0 0 16 16"
                width="13"
                height="13"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M 12.5 3.2 A 5.4 5.4 0 1 1 8 2.6" />
                <path d="M 8.6 5.4 L 12.7 3.3 L 11 7.1" />
              </svg>
            )}
          </button>
        );
      })}
      {voiceOk && (
        <button
          type="button"
          className={`brume-mic${micOn ? (heard === "hearing…" ? " is-hearing" : " is-listening") : ""}`}
          aria-label="Say how you feel"
          aria-pressed={micOn}
          onClick={onMicTap}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <rect x="6" y="1.5" width="4" height="8" rx="2" />
            <path d="M 3 7.5 a 5 5 0 0 0 10 0 M 8 12.5 L 8 14.5" />
          </svg>
          {micOn ? "" : "say it"}
        </button>
      )}
      {heard && (
        <span className={`brume-voice-heard${dissolve ? " is-dissolve" : ""}`} aria-hidden="true">
          {heard}
        </span>
      )}
      {selectedIndex !== null && (
        <button
          type="button"
          className="brume-pairs__release"
          onClick={(e) => {
            setSuggested(null);
            setAnnounce("Let it go.");
            onChoose(null, e.currentTarget);
          }}
        >
          put it down
        </button>
      )}
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>
      <AnimatePresence>
        {hintOpen && (
          <motion.div
            className="brume-flip-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <span id={`${descId}-hint`} role="tooltip">
              {HOME_FEELING_COPY.hint}
            </span>
            <button
              type="button"
              className="brume-flip-hint__dismiss"
              aria-label="Dismiss tip"
              onClick={() => setHintOpen(false)}
            >
              <span aria-hidden="true">×</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PairedFeelings;
