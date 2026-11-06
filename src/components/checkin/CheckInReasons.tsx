import { useState } from "react";
import {
  CHECKIN_REASONS,
  attachReason,
  type CheckInReasonId,
} from "@/lib/checkinLedger";
import { track } from "@/lib/events";

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
    // The row transforms instead of vanishing: one confirmed pill, the
    // same height as the row, so nothing below jumps. A choice made is
    // still visible — that is the feedback.
    const label = CHECKIN_REASONS.find((r) => r.id === kept)?.label ?? "";
    return (
      <div className="brume-reasons brume-reasons--kept">
        <span className="brume-reasons__kept" role="status">
          because {label} · kept on this device
        </span>
      </div>
    );
  }

  const pick = (id: CheckInReasonId) => {
    attachReason(id);
    track("checkin_reason", { feeling, reason: id });
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
