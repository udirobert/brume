/**
 * PostSessionWords — the "Put it into words" composer for the
 * post-session morph. One card: who the sentence is for, the sentence
 * itself (editable), and the two ways it can leave — copied or shared
 * as a rendered card. The support-sentence default stays; the old
 * unexplained support grid is gone. "Just for me" keeps the check-in
 * contract: the message is only ever shown, never offered for share.
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  composeCheckInMessage,
  FOR_OPTIONS,
  type ForChoice,
} from "@/lib/checkin";
import { copyText, shareMessageCard } from "@/lib/shareMessageCard";

interface PostSessionWordsProps {
  /** Word chosen on the check-in path, if any — seeds the sentence. */
  checkInIndex: number | null;
  /** `--brume-orb-mist` colour of that feeling; tints the share card. */
  orbMist?: string;
  /** Pattern just practised — names the downloaded card file. */
  patternName?: string;
  onBack: () => void;
}

export function PostSessionWords({
  checkInIndex,
  orbMist,
  patternName,
  onBack,
}: PostSessionWordsProps) {
  const [forChoice, setForChoice] = useState<ForChoice | null>(null);
  const [message, setMessage] = useState(() =>
    composeCheckInMessage(checkInIndex, null, null),
  );
  const [edited, setEdited] = useState(false);
  const [sharing, setSharing] = useState(false);

  const forMe = forChoice === "just_for_me";

  const chooseFor = (choice: ForChoice) => {
    const next = forChoice === choice ? null : choice;
    setForChoice(next);
    if (!edited) setMessage(composeCheckInMessage(checkInIndex, null, next));
  };

  const copyMessage = async () => {
    if (await copyText(message)) {
      toast.success("Copied to clipboard");
    } else {
      toast.error("Copy is unavailable here — you can still select the words");
    }
  };

  const shareCard = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const result = await shareMessageCard({ message, orbMistCss: orbMist, patternName });
      if (result === "shared") {
        toast.success("Card sent");
      } else if (result === "downloaded") {
        toast.success("Image saved");
      } else if (result === "copied") {
        toast.success("Copied to clipboard");
      } else if (await copyText(message)) {
        toast.success("Copied to clipboard");
      } else {
        toast.error("Sharing is unavailable here — you can still select the words");
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="w-full max-w-sm flex flex-col items-center gap-4 text-left">
      <h3
        data-panel-heading
        tabIndex={-1}
        className="text-xl font-bold tracking-tight outline-none"
      >
        Say it in a sentence
      </h3>

      <section className="dc-share-card w-full" aria-label="Your message">
        <div className="dc-for" aria-label="Who is this for?">
          <span className="dc-for__label">For:</span>
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

        <label className="dc-message-label" htmlFor="ps-words-message">
          Your words
        </label>
        <textarea
          id="ps-words-message"
          className="dc-textarea"
          rows={4}
          value={message}
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
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="brume-btn"
              onClick={() => void copyMessage()}
            >
              Copy message
            </button>
            <button
              type="button"
              className="brume-btn brume-btn--soft"
              disabled={sharing}
              onClick={() => void shareCard()}
            >
              Share
            </button>
          </div>
        )}

        <p className="dc-field-note">
          Edit it freely — nothing is sent without you.
        </p>
      </section>

      <button
        type="button"
        onClick={onBack}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Back
      </button>
    </div>
  );
}

export default PostSessionWords;
