import { useState } from "react";
import {
  CHECKIN_REASONS,
  attachReason,
  type CheckInReasonId,
} from "@/lib/checkinLedger";
import { feelingAt } from "@/lib/feelings";
import { CheckIcon } from "@/components/icons/BrumeIcons";
import { track } from "@/lib/events";

// The kept sentence gets one quiet remark under it — closed table, one
// per valence, same situation same line: for a heavy word the room holds
// it too; for a light one the keeping is the point.
const KEPT_ASIDE: Record<"positive" | "heavy", string> = {
  positive: "worth keeping.",
  heavy: "it can sit here.",
};

/**
 * One tap for what it is about — the reason row beside a check-in.
 *
 * The words are ours, not the user's: a closed set the ledger can count
 * without storing a single private string. Nothing here is fetched or
 * logged; the row is optional and disappears if left alone.
 */
export function CheckInReasons({ feeling, onPick }: {
  feeling: number;
  /** Fired after the reason is kept — the room may acknowledge it. */
  onPick?: (id: CheckInReasonId) => void;
}) {
  const [kept, setKept] = useState<CheckInReasonId | null>(null);

  if (kept !== null) {
    // The row transforms instead of vanishing: one pill, the same height
    // as the row, so nothing below jumps. What it says is their own
    // sentence back — "Heavy, because money" — because the moment after a
    // pick wants to know it was heard, not where it is stored. (The
    // privacy hint already sits under the chips, before the choice.)
    const label = CHECKIN_REASONS.find((r) => r.id === kept)?.label ?? "";
    const feel = feelingAt(feeling);
    return (
      <div className="brume-reasons brume-reasons--kept">
        <span className="brume-reasons__kept" role="status">
          <CheckIcon size={11} className="brume-reasons__kept-check" />
          {feel ? `${feel.label}, ` : ""}because {label} — kept
        </span>
        {feel && <span className="brume-reasons__hint">{KEPT_ASIDE[feel.valence]}</span>}
      </div>
    );
  }

  const pick = (id: CheckInReasonId) => {
    attachReason(id);
    track("checkin_reason", { feeling, reason: id });
    try { navigator.vibrate?.(8); } catch { void 0; }
    setKept(id);
    onPick?.(id);
  };

  return (
    <div className="brume-reasons">
      <div className="brume-reasons__row" role="group" aria-label="What is it about?">
        <span className="brume-reasons__lead">because</span>
        {CHECKIN_REASONS.map((r) => (
          <button
            key={r.id}
            type="button"
            className="brume-reasons__chip"
            onClick={() => pick(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>
      <span className="brume-reasons__hint">private · stays on this device</span>
    </div>
  );
}

export default CheckInReasons;
