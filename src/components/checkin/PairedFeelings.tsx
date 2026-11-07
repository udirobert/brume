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
import {
  clipHeard,
  getMicMode,
  hasNegation,
  listenOnce,
  voiceCheckinSupported,
  voiceHelpFor,
  VOICE_FAILURE_COPY,
  type ListenControl,
} from "@/lib/voiceCheckin";
import { track } from "@/lib/events";

const HINT_KEY = "brume.feelingFlipHint.v1";
const HOLD_HINT_KEY = "brume.voiceHoldHint.v1";

function holdHintSeen(): boolean {
  try { return window.localStorage.getItem(HOLD_HINT_KEY) === "1"; } catch { return false; }
}
function writeHoldHintSeen() {
  try { window.localStorage.setItem(HOLD_HINT_KEY, "1"); } catch (e) { void e; }
}

// First press is the scary one — the browser prompt appears with no
// warning. A one-time line beside the mic sets the expectation.
const MIC_USED_KEY = "brume.micUsed.v1";
function micEverUsed(): boolean {
  try { return window.localStorage.getItem(MIC_USED_KEY) === "1"; } catch { return true; }
}
function markMicUsed() {
  try { window.localStorage.setItem(MIC_USED_KEY, "1"); } catch (e) { void e; }
}

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
  onVoiceState?: (state: "listening" | "matched" | "missed" | "blocked", index?: number) => void;
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
  // Hold to talk: the mic stays open while the finger is down and stops on
  // release. A press shorter than HOLD_TAP_MS settles into the old toggle —
  // one press to start, another (or a quiet stretch) to finish — because a
  // hold-only button is a wall for keyboard and switch users.
  const CONFIRM_SPIN_MS = 900;
const HOLD_TAP_MS = 350;
  const holdingRef = useRef(false);
  const pressStartRef = useRef(0);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const ctlRef = useRef<ListenControl | null>(null);
  const [holdUI, setHoldUI] = useState(false);
  // Help for a stuck microphone. Unlike heard transcripts — which are the
  // person's words, and dissolve — this is Brume's own line from a closed
  // table: it stays until the next press proves the moment has passed.
  const [help, setHelp] = useState<string | null>(null);
  const [micUsed, setMicUsed] = useState(micEverUsed);
  const [heard, setHeard] = useState("");
  const [dissolve, setDissolve] = useState(false);
  // The invitation ("Drained? tap to choose"). The transcript dissolves —
  // that is the privacy story, made visible — but a suggestion that
  // evaporates with it reads as nothing happening. Ours, so it stays.
  const [offer, setOffer] = useState<{ index: number; maybe: boolean } | null>(null);
  const offerRef = useRef<HTMLDivElement | null>(null);
  // After the invitation is taken, the row stays a breath longer as a
  // kept word — the "was that right?" answer, in the same seat so
  // nothing jumps.
  const [kept, setKept] = useState<number | null>(null);
  const keptTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // The confirmation spin: when the heard word is ALREADY face-up (or
  // already chosen), there is no flip to play — so the chip acknowledges
  // with a spin instead. Delight is feedback too.
  const [confirm, setConfirm] = useState<{ pair: number; n: number } | null>(null);
  const confirmSerial = useRef(0);
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

  // A word is chosen by any path — the invitation has done its job.
  useEffect(() => {
    if (selectedIndex != null) setOffer(null);
  }, [selectedIndex]);

  // On a short phone the invitation lands under the pinned Begin; bring it
  // up into view (its scroll-margin clears the Begin seat).
  useEffect(() => {
    if (!offer) return;
    offerRef.current?.scrollIntoView?.({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
  }, [offer, reduced]);

  // The spin clears itself. onAnimationEnd is the fast path in a real
  // browser; this timeout is the guarantee (and the only path jsdom gets).
  useEffect(() => {
    if (!confirm) return;
    const t = window.setTimeout(() => setConfirm(null), CONFIRM_SPIN_MS + 50);
    return () => window.clearTimeout(t);
  }, [confirm]);

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
      setHelp(null);
      setOffer(null);
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
      const tookTheOffer = wasOffered && next.selected === suggested;
      clearTimeout(keptTimer.current);
      if (tookTheOffer) {
        setKept(next.selected);
        keptTimer.current = setTimeout(() => setKept(null), 2600);
      } else {
        setKept(null);
      }
      onChoose(next.selected!, button, tookTheOffer);
    },
    [faces, selectedIndex, onChoose, showHint, suggested],
  );

  const stopListening = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Voice proposes and never commits: whatever is heard, the closest word
  // turns itself face-up and waits for a tap. A misread costs nothing and
  // a hit and a miss are the same interaction — so there is no rule here
  // the user has to remember, and nothing Brume can say about them that
  // they did not confirm.
  const beginListening = useCallback(async () => {
    setMicOn(true);
    setHeard("listening…");
    onVoiceState?.("listening");
    abortRef.current = new AbortController();
    const ctl = ctlRef.current ?? { hold: false };
    const { transcript, index, suggest, pattern, failure } = await listenOnce(
      setHeard,
      abortRef.current.signal,
      ctl,
    );
    const offered = index ?? suggest;
    track("checkin_voice_used", { matched: index != null, offered });
    const wasTap = ctl.hold === false;
    setMicOn(false);
    setHoldUI(false);
    holdingRef.current = false;
    if (wasTap && getMicMode() === "hold" && offered != null && !holdHintSeen()) {
      // They tapped and it worked — once, teach the easier way. It lands
      // after the offer itself, so it never speaks over the match. Never
      // nudge someone who has chosen tap on purpose.
      writeHoldHintSeen();
      window.setTimeout(() => flashHeard("tip: keep your finger on it to take your time"), 1400);
    }
    if (failure && !transcript) {
      // Said out loud, not shrugged off — and with the actual way through.
      // The short line flashes; the help card stays, because instructions
      // that evaporate in four seconds are a finding, not a feature.
      const card = voiceHelpFor(failure, navigator.userAgent);
      onVoiceState?.(failure === "mic_blocked" || failure === "insecure" ? "blocked" : "missed");
      setAnnounce(card);
      setHelp(card);
      flashHeard(VOICE_FAILURE_COPY[failure]);
      return;
    }
    onVoiceState?.(offered != null || pattern != null ? "matched" : "missed", offered ?? undefined);
    const snippet = clipHeard(transcript, offered);
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
      // That is already the word you carry — nothing to offer, but the
      // room still nods: the chosen chip spins once.
      const cpi = FEELING_PAIRS.indexOf(pair);
      if (cpi >= 0) setConfirm({ pair: cpi, n: ++confirmSerial.current });
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
    } else {
      // Already face-up: the flip has nothing to do, so the spin speaks.
      setConfirm({ pair: pi, n: ++confirmSerial.current });
    }
    setSuggested(offered);
    setAnnounce(`Heard ${transcript} — ${FEELINGS[offered].label}. Tap to keep it.`);
    // Their words pass through the mist; the invitation persists below.
    flashHeard(`heard “${snippet}”`);
    setOffer({ index: offered, maybe: index == null });
  }, [faces, selectedIndex, onVoiceState, onPatternOffer]);

  const onMicPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault(); // no focus ring dance, no synthesized click after
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { void 0; }
    if (micOn) {
      if (!holdingRef.current) stopListening(); // second press ends a tap-mode listen
      return;
    }
    const mode = getMicMode();
    setHelp(null); // the moment they try again, the card has done its job
    setOffer(null);
    setKept(null);
    if (!micUsed) {
      markMicUsed();
      setMicUsed(true);
    }
    holdingRef.current = true;
    pressStartRef.current = Date.now();
    // Hold (the default): open while the finger is down, release ends it.
    // Tap: hands-free from the first press — silence or a second press ends it.
    ctlRef.current = { hold: mode === "hold" };
    holdTimerRef.current = setTimeout(() => {
      if (!abortRef.current || abortRef.current.signal.aborted) return;
      if (mode === "hold") {
        setHoldUI(true);
        setHeard("listening — let go when you're done");
      } else {
        setHeard("listening — tap again when done");
      }
    }, HOLD_TAP_MS);
    beginListening();
  }, [micOn, beginListening, stopListening]);

  const settleToTap = useCallback(() => {
    // The finger is gone but the mic is still open: it now ends on
    // silence or a second press — and the screen says so, because the
    // timer that would have shown the hint is already cleared.
    if (ctlRef.current) ctlRef.current.hold = false;
    setHoldUI(false);
    if (micOn) setHeard("listening — tap again when done");
  }, [micOn]);

  const onMicPointerEnd = useCallback((release: boolean) => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    clearTimeout(holdTimerRef.current);
    if (!release) {
      // The release was stolen (the permission sheet on a first press, a
      // system swipe). A hold with no finger behind it would stay open to
      // the 20 s ceiling with nothing to say how it ends — settle it.
      settleToTap();
      return;
    }
    if (getMicMode() === "tap") return; // hands-free: release changes nothing
    const held = Date.now() - pressStartRef.current >= HOLD_TAP_MS;
    if (!held && ctlRef.current) {
      // Even in hold mode a quick press is not a dead end: settle into
      // listen-until-silence so a nervous tap still gets heard.
      settleToTap();
      return;
    }
    stopListening();
  }, [stopListening, settleToTap]);

  const onMicKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    // Keyboard push-to-talk: Space holds, Enter taps.
    if (e.key === " " && !e.repeat) {
      e.preventDefault();
      if (!micOn) {
        holdingRef.current = true;
        ctlRef.current = { hold: true };
        setHoldUI(true);
        beginListening();
      }
    }
  }, [micOn, beginListening]);

  const onMicKeyUp = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === " " && ctlRef.current?.hold) {
      e.preventDefault();
      setHoldUI(false);
      stopListening();
    }
  }, [stopListening]);

  const onMicClick = useCallback(() => {
    // detail 0 = keyboard Enter: behave like the old tap-to-toggle.
    if (micOn) {
      if (!ctlRef.current?.hold) stopListening();
    } else {
      ctlRef.current = { hold: false };
      beginListening();
    }
  }, [micOn, beginListening, stopListening]);

  return (
    <div
      className={`brume-pairs${selectedIndex !== null ? " has-selection" : ""}`}
      role="group"
      aria-label="Choose a feeling"
    >
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
            className={`brume-choice brume-choice--flip${selected ? " is-selected" : ""}${feel.valence === "positive" ? " is-positive" : ""}${suggested === face ? " is-suggested" : ""}${confirm?.pair === i ? " is-confirming" : ""}`}
            onAnimationEnd={(e) => {
              if (e.target === e.currentTarget) setConfirm(null);
            }}
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
          className={`brume-mic${micOn ? (heard === "hearing…" ? " is-hearing" : " is-listening") : ""}${holdUI ? " is-holding" : ""}`}
          aria-label={
            micOn
              ? "Listening — press to stop"
              : getMicMode() === "hold"
                ? "Say how you feel — hold to speak"
                : "Say how you feel — tap to speak, tap again to stop"
          }
          aria-pressed={micOn}
          onPointerDown={onMicPointerDown}
          onPointerUp={() => onMicPointerEnd(true)}
          onPointerCancel={() => onMicPointerEnd(false)}
          onKeyDown={onMicKeyDown}
          onKeyUp={onMicKeyUp}
          onClick={(e) => {
            if (e.detail === 0) onMicClick(); // keyboard Enter only
          }}
          onContextMenu={(e) => e.preventDefault()}
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
          {micOn ? (holdUI ? "" : "tap to stop") : "say it"}
        </button>
      )}
      {!micUsed && voiceOk && !micOn && (
        <span className="brume-mic-hint">
          {getMicMode() === "hold"
            ? "hold to speak — the browser asks for the mic the first time"
            : "tap to speak — the browser asks for the mic the first time"}
        </span>
      )}
      {heard && (
        <span className={`brume-voice-heard${dissolve ? " is-dissolve" : ""}`} aria-hidden="true">
          {heard}
        </span>
      )}
      {help && (
        <div className="brume-voice-help" role="note">
          <p>{help}</p>
          <button type="button" onClick={() => setHelp(null)}>
            okay
          </button>
        </div>
      )}
      {offer && (
        <div className="brume-voice-offer" role="note" ref={offerRef}>
          {/* The invitation is itself the word: tapping it is the same
              commit as tapping the chip, so voice still only proposes. */}
          <button
            type="button"
            className="brume-voice-offer__take"
            onClick={() => {
              const pair = pairForFeel(offer.index);
              const pi = pair ? FEELING_PAIRS.indexOf(pair) : -1;
              const chip = chipRefs.current[pi];
              if (pi >= 0 && chip) handlePick(pi, chip);
            }}
          >
            {offer.maybe ? "maybe " : ""}
            <strong>{FEELINGS[offer.index].label}</strong> — tap to keep it
          </button>
          <button
            type="button"
            className="brume-voice-offer__dismiss"
            aria-label="Not this one"
            onClick={() => {
              setOffer(null);
              setSuggested(null);
            }}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      )}
      {kept != null && !offer && (
        <div className="brume-voice-offer brume-voice-offer--kept" role="note">
          <span className="brume-voice-offer__kept">
            {FEELINGS[kept].label} — kept
          </span>
        </div>
      )}
      {selectedIndex !== null && (
        <button
          type="button"
          className="brume-pairs__release"
          onClick={(e) => {
            setSuggested(null);
            setKept(null);
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
