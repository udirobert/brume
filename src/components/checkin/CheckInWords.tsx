/**
 * CheckInWords — the five-point "how is it for you" radiogroup.
 * Used by Decompress; pure presentation.
 */
import {
  CHECK_IN_LABELS,
  CHECK_IN_SHORT_LABELS,
} from "@/lib/checkin";
import { LEGACY_FEEL_INDICES } from "@/lib/feelings";

interface CheckInWordsProps {
  index: number;
  touched: boolean;
  onChoose: (index: number) => void;
}

export function CheckInWords({ index, touched, onChoose }: CheckInWordsProps) {
  return (
    <>
      <div className="dc-words" role="radiogroup" aria-label="How are you feeling?">
        {LEGACY_FEEL_INDICES.map((i) => ({ label: CHECK_IN_SHORT_LABELS[i], i })).map(({ label, i }) => (
          <label
            key={label}
            className={`dc-word ${touched && index === i ? "is-chosen" : ""}`}
          >
            <input
              type="radio"
              name="dc-checkin"
              value={i}
              checked={touched && index === i}
              onChange={() => onChoose(i)}
              aria-label={CHECK_IN_LABELS[i]}
            />
            <span className="dc-word__dot" aria-hidden="true" />
            <span className="dc-word__text">{label}</span>
          </label>
        ))}
      </div>
      {touched && (
        <div className="text-center mt-4">
          <span className="dc-slider-current" aria-live="polite">
            {CHECK_IN_LABELS[index]}
          </span>
        </div>
      )}
    </>
  );
}

export default CheckInWords;
