/**
 * WordsCard — "put it into words". One honest shareable sentence built
 * from the check-in point + who it's for + what would help. Nothing
 * leaves the page unless the person copies or shares it.
 */
import { useState } from "react";
import {
  composeCheckInMessage,
  FOR_OPTIONS,
  SUPPORT_SENTENCES,
  type ForChoice,
  type SupportChoice,
} from "@/lib/checkin";

const SUPPORT_OPTIONS: Array<{ id: SupportChoice; label: string }> = [
  { id: "company", label: "Company" },
  { id: "space", label: "A little space" },
  { id: "listening", label: "Listening" },
  { id: "unsure", label: "Not sure" },
];

interface WordsCardProps {
  checkInIndex: number | null;
  onCopied?: () => void;
  onShared?: () => void;
}

export function WordsCard({ checkInIndex, onCopied, onShared }: WordsCardProps) {
  const [forChoice, setForChoice] = useState<ForChoice | null>(null);
  const [supportChoice, setSupportChoice] = useState<SupportChoice | null>(null);
  const [message, setMessage] = useState(() =>
    composeCheckInMessage(checkInIndex, null, null),
  );
  const [edited, setEdited] = useState(false);
  const [feedback, setFeedback] = useState("");

  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";
  const forMe = forChoice === "just_for_me";

  const recompose = (forC: ForChoice | null, support: SupportChoice | null) => {
    if (!edited) setMessage(composeCheckInMessage(checkInIndex, support, forC));
  };

  const chooseFor = (choice: ForChoice) => {
    const next = forChoice === choice ? null : choice;
    setForChoice(next);
    recompose(next, supportChoice);
  };

  const chooseSupport = (choice: SupportChoice) => {
    const next = supportChoice === choice ? null : choice;
    setSupportChoice(next);
    recompose(forChoice, next);
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setFeedback("Copied. Nothing was sent.");
      onCopied?.();
    } catch {
      setFeedback("Copy is unavailable here. You can still select the message.");
    }
  };

  const shareMessage = async () => {
    try {
      await navigator.share({ text: message });
      setFeedback("Shared only because you chose to.");
      onShared?.();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFeedback("Sharing is unavailable here. You can copy the message instead.");
    }
  };

  return (
    <section className="dc-share-card" aria-label="Share message">
      <div className="dc-share-card__head">
        <h2>If you want to let someone in</h2>
        <p>Preview it first. You can edit every word.</p>
      </div>

      <div className="dc-for" aria-label="Who is this for?">
        <span className="dc-for__label">For</span>
        {FOR_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`brume-pill ${forChoice === option.id ? "is-selected" : ""}`}
            aria-pressed={forChoice === option.id}
            onClick={() => chooseFor(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {!forMe && (
        <div className="dc-support" aria-label="What would help">
          {SUPPORT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`brume-pill ${supportChoice === option.id ? "is-selected" : ""}`}
              aria-pressed={supportChoice === option.id}
              onClick={() => chooseSupport(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

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
          setEdited(true);
        }}
      />

      {forMe ? (
        <p className="dc-field-note" aria-live="polite">
          Kept here. Nothing to send.
        </p>
      ) : (
        <>
          <p className="dc-field-note dc-field-note--reserved" aria-live="polite">
            {feedback || "You can edit this before copying or sharing."}
          </p>
          <div className="dc-actions">
            <button type="button" className="brume-btn brume-btn--push" onClick={copyMessage}>
              Copy message
            </button>
            {canNativeShare && (
              <button type="button" className="brume-btn brume-btn--soft" onClick={shareMessage}>
                Share…
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default WordsCard;
