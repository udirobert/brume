import { useState } from "react";
import { addMarginEntry } from "@/lib/checkinMargin";
import { getCheckInMode } from "@/lib/feelings";

/**
 * "add a word?" — a private margin beside the check-in. Appears only
 * once a feeling is picked; Enter or blur keeps it on this device.
 */
export function CheckInMargin({ feeling }: { feeling: number | null }) {
  const [note, setNote] = useState("");
  const [kept, setKept] = useState(false);

  if (feeling == null) return null;

  const save = () => {
    if (!note.trim()) return;
    addMarginEntry(feeling, getCheckInMode() ?? "now", note);
    setNote("");
    setKept(true);
    window.setTimeout(() => setKept(false), 2500);
  };

  return (
    <div className="brume-margin">
      <input
        className="brume-margin__input"
        type="text"
        value={note}
        maxLength={140}
        placeholder="add a word?"
        aria-label="Add a private note to your check-in"
        onChange={(e) => setNote(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && save()}
      />
      <span className="brume-margin__hint">
        {kept ? "kept — just for you" : "private · stays on this device"}
      </span>
    </div>
  );
}

export default CheckInMargin;
