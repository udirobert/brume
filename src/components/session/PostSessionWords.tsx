/**
 * PostSessionWords — the "Put it into words" composer for the
 * post-session morph. One card: who the sentence is for, the sentence
 * itself (editable), and the two ways it can leave — copied or shared
 * as a rendered card. The support-sentence default stays; the old
 * unexplained support grid is gone. "Just for me" keeps the check-in
 * contract: the message is only ever shown, never offered for share.
 *
 * What this writes: nothing to the ledger — a sentence is not analysis
 * substrate, and the spine stays a closed set. The wire (`metrics.ts` WIRE)
 * sees two acts and no words: that the card opened, and that the composed
 * sentence became the person's own.
 */
import { track } from "@/lib/events";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  composeCheckInMessage,
  FOR_OPTIONS,
  type ForChoice,
} from "@/lib/checkin";
import { appendRoomLink } from "@/lib/invitation";
import { copyText, shareMessageCard } from "@/lib/shareMessageCard";
import { onSpeaking, previewLine, stopCues } from "@/lib/voiceCues";

interface PostSessionWordsProps {
  /** Word chosen on the check-in path, if any — seeds the sentence. */
  checkInIndex: number | null;
  /** `--brume-orb-mist` colour of that feeling; tints the share card. */
  orbMist?: string;
  /** Pattern just practised — names the downloaded card file. */
  patternName?: string;
  /** Registry id of the pattern — used when opting in to include a room link. */
  patternId?: string;
  onBack: () => void;
}

/**
 * "Hear it" follows the voice: while the line is on its way or playing the
 * button says Stop, so a tap is never answered by nothing.
 */
function HearItButton({ message, edited }: { message: string; edited: boolean }) {
  const [mine, setMine] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const active = mine && speaking;
  const activeRef = useRef(false);
  useEffect(
    () =>
      onSpeaking((s) => {
        setSpeaking(s);
        if (!s) setMine(false);
      }),
    [],
  );
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  // Leaving the card ends the line it started.
  useEffect(() => () => {
    if (activeRef.current) stopCues();
  }, []);
  return (
    <button
      type="button"
      className={`brume-btn brume-btn--soft${active ? " is-speaking" : ""}`}
      title="Read aloud by our voice service"
      aria-pressed={active}
      onClick={() => {
        if (active) {
          stopCues();
          return;
        }
        track("words_card_heard", { surface: "post_session", edited });
        setMine(true);
        previewLine(message);
      }}
    >
      {active ? "Stop" : "Hear it"}
    </button>
  );
}

export function PostSessionWords({
  checkInIndex,
  orbMist,
  patternName,
  patternId,
  onBack,
}: PostSessionWordsProps) {
  const [forChoice, setForChoice] = useState<ForChoice | null>(null);
  const [message, setMessage] = useState(() =>
    composeCheckInMessage(checkInIndex, null, null),
  );
  const [edited, setEdited] = useState(false);
  const [includeRoomLink, setIncludeRoomLink] = useState(false);
  const [sharing, setSharing] = useState(false);

  const forMe = forChoice === "just_for_me";

  useEffect(() => {
    track("words_card_shown", { surface: "post_session", arm: "sentence" });
  }, []);
  const outcome = () => ({
    surface: "post_session" as const,
    arm: "sentence" as const,
    room_link: includeRoomLink,
    for_me: forMe,
    edited,
  });
  const outgoingText = includeRoomLink
    ? appendRoomLink(message, patternId)
    : message;

  const chooseFor = (choice: ForChoice) => {
    const next = forChoice === choice ? null : choice;
    setForChoice(next);
    if (!edited) setMessage(composeCheckInMessage(checkInIndex, null, next));
  };

  const copyMessage = async () => {
    if (await copyText(outgoingText)) {
      track("words_card_copied", outcome());
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
      if (result === "shared" || result === "downloaded" || result === "copied") {
        track("words_card_shared", outcome());
      }
      if (result === "shared") {
        toast.success("Card sent");
      } else if (result === "downloaded") {
        toast.success("Image saved");
      } else if (result === "copied") {
        toast.success("Copied to clipboard");
      } else if (await copyText(outgoingText)) {
        track("words_card_copied", outcome());
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
            // The first keystroke is the answer existing: ours becomes theirs.
            // Counted as the act only — the sentence itself never leaves.
            if (!edited) {
              track("words_written", {
                surface: "post_session",
                arm: "sentence",
                for_me: forMe,
              });
            }
            setMessage(event.target.value);
            setEdited(true);
          }}
        />

        {forMe ? (
          <>
            <p className="dc-field-note" aria-live="polite">
              Kept here. Nothing to send.
            </p>
            <div className="flex flex-wrap gap-3">
              <HearItButton message={message} edited={edited} />
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`brume-pill ${includeRoomLink ? "is-selected" : ""}`}
              aria-pressed={includeRoomLink}
              onClick={() => {
                track("room_link_toggled", { surface: "post_session", on: !includeRoomLink });
                setIncludeRoomLink((prev) => !prev);
              }}
            >
              Include a quiet room link
            </button>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="brume-btn"
                onClick={() => void copyMessage()}
              >
                Copy message
              </button>
              <HearItButton message={message} edited={edited} />
              <button
                type="button"
                className="brume-btn brume-btn--soft"
                disabled={sharing}
                onClick={() => void shareCard()}
              >
                Share
              </button>
            </div>
          </>
        )}

        <p className="dc-field-note">
          Edit it freely — nothing is sent without you. "Hear it" sends
          the words to our voice service to be spoken, nowhere else.
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
