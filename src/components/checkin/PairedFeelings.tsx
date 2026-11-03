import { useCallback, useEffect, useId, useRef, useState } from "react";
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
  showHint = true,
}: {
  selectedIndex: number | null;
  onChoose: (index: number, button: HTMLButtonElement) => void;
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
      onChoose(next.selected!, button);
    },
    [faces, selectedIndex, onChoose, showHint],
  );

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
            className={`brume-choice brume-choice--flip${selected ? " is-selected" : ""}${feel.valence === "positive" ? " is-positive" : ""}`}
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
