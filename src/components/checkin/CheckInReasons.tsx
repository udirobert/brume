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
export function CheckInReasons({ feeling }: { feeling: number }) {
  const [kept, setKept] = useState<CheckInReasonId | null>(null);

  if (kept !== null) {
    return (
      <p className="brume-reasons__kept">kept — just for you · stays on this device</p>
    );
  }

  const pick = (id: CheckInReasonId) => {
    attachReason(id);
    track("checkin_reason", { feeling, reason: id });
    setKept(id);
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
