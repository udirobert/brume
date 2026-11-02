/**
 * CheckInWords — the five-point "how is it for you" radiogroup.
 * Shared by Decompress and Home; pure presentation.
 */
import {
  CHECK_IN_LABELS,
  CHECK_IN_SHORT_LABELS,
} from "@/lib/checkin";

interface CheckInWordsProps {
  index: number;
  touched: boolean;
  onChoose: (index: number) => void;
}

export function CheckInWords({ index, touched, onChoose }: CheckInWordsProps) {
  return (
    <>
      <div className="dc-words" role="radiogroup" aria-label="How is it for you right now?">
        {CHECK_IN_SHORT_LABELS.map((label, i) => (
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
      <div className="text-center mt-4">
        <span className="dc-slider-current" aria-live="polite">
          {touched ? CHECK_IN_LABELS[index] : "Choose a point"}
        </span>
      </div>
    </>
  );
}

export default CheckInWords;
