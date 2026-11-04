import { useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { DURATION, EASE } from "@/lib/motion";
import { Magnetic } from "@/lib/Magnetic";
import { PairedFeelings } from "@/components/checkin/PairedFeelings";
import { type MascotReaction } from "@/components/BrumeMascot";
import { CompanionAnchor } from "@/components/companion/JourneyCompanion";
import { AbsorbDroplet } from "@/components/atmosphere/AbsorbDroplet";
import { useMascotPresence } from "@/hooks/useMascotPresence";
import { applyFeel } from "@/lib/feelTheme";
import { track } from "@/lib/events";
import { feelingAt, HOME_FEELING_COPY, isPositiveFeel } from "@/lib/feelings";
import { useRoomExperience } from "@/lib/roomExperience";
import { RoomSettings } from "@/components/atmosphere/RoomControls";
import { useSessionStore } from "@/stores/sessionStore";
import { formatPhases, getPattern } from "@/lib/breathingPatterns";

/**
 * Home — reset-first.
 *
 * One obvious action: a guided Reset (in 4, out 6). No check-in
 * required, no camera. The mood check-in stays available below
 * as the secondary path for anyone who wants a matched pattern.
 */
const RHYTHMS = [
  { id: "reset", label: "Reset" },
  { id: "mindfulness", label: "Mindfulness" },
  { id: "box", label: "Box" },
  { id: "relaxation", label: "4-7-8" },
  { id: "wim_hof", label: "Wim Hof" },
  { id: "sleep", label: "Sleep" },
] as const;

/** "More rhythms" — a quiet popover of direct rhythm picks. */
function RhythmPicker({ value, onChange }: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const id = useId();
  return (
    <div className="brume-home-options__row">
      <label htmlFor={id}>Rhythm</label>
      <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Auto · from my feeling</option>
        {RHYTHMS.map((r) => (
          <option key={r.id} value={r.id}>{r.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function Index() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion() || (typeof document !== "undefined" && document.hidden);
  const { presence, setPresence } = useMascotPresence();
  const companion = presence === "companion";
  const feelTap = useRoomExperience((s) => s.feelIndex);
  const [patternOverride, setPatternOverride] = useState<string | null>(null);
  const reactionSerial = useRef(0);
  const [mascotReaction, setMascotReaction] = useState<
    { name: MascotReaction; key: string } | undefined
  >();
  const [droplet, setDroplet] = useState<{
    key: number;
    from: { x: number; y: number };
    to: { x: number; y: number };
    color: string;
  } | null>(null);
  const mascotCardRef = useRef<HTMLDivElement>(null);
  const feel = feelingAt(feelTap);
  const audioEnabled = useSessionStore((s) => s.audioEnabled);
  const cueStyle = useSessionStore((s) => s.cueStyle);
  const setCueStyle = useSessionStore((s) => s.setCueStyle);
  const setAudioEnabled = useSessionStore((s) => s.setAudioEnabled);

  const selectedPattern =
    getPattern(patternOverride ?? feel?.patternId ?? "reset");

  // The chip sheds its word into the room: a droplet melts toward the
  // mascot while the mist takes the feeling's colour and weight.
  // A null index means the word was put back down — the room lets go.
  const handleFeel = (index: number | null, chip?: HTMLElement) => {
    const a = chip?.getBoundingClientRect();
    applyFeel(
      index,
      a ? { x: a.left + a.width / 2, y: a.top + a.height / 2 } : undefined,
    );
    const next = feelingAt(index);
    if (next && index !== null) track("checkin_word", { feeling: index, surface: "home" });
    if (next?.reaction) {
      setMascotReaction({ name: next.reaction, key: `home-${++reactionSerial.current}` });
    }
    const card = mascotCardRef.current;
    if (reduceMotion || !next || !card || !a) return;
    const b = card.getBoundingClientRect();
    setDroplet({
      key: reactionSerial.current,
      from: { x: a.left + a.width / 2, y: a.top + a.height / 2 },
      to: { x: b.left + b.width / 2, y: b.top + b.height / 2 },
      color: next.orbMist,
    });
  };

  const begin = () => {
    if (!selectedPattern) return;
    navigate(`/session?pattern=${selectedPattern.id}`, {
      state: {
        reason: selectedPattern.name,
        reasonDetail: selectedPattern.description,
        source: patternOverride ? "Your choice" : feelTap === null ? "Your reset" : "From how you feel",
        checkInIndex: feelTap,
        startImmediately: true,
      },
    });
  };

  return (
    <div className="brume-home brume-home--compact">
      <h1>{HOME_FEELING_COPY.prompt}</h1>

      <motion.div
        className="brume-home__companion"
        ref={mascotCardRef}
        data-presence={presence}
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: DURATION.standard, delay: 0.04, ease: EASE }}
      >
        <CompanionAnchor
          state={feel?.state ?? "idle"}
          size={156}
          presence={presence}
          breathing={companion}
          trackPointer={companion}
          reaction={mascotReaction}
          tapReaction={feel?.reaction ?? "ready"}
          demeanor={feel?.demeanor ?? "open"}
          allowTapEscalation={!feel || isPositiveFeel(feelTap)}
        />
      </motion.div>

      <PairedFeelings selectedIndex={feelTap} onChoose={handleFeel} />

      <Magnetic className="brume-home__primary" pull={0.15} radius={110}>
        <button type="button" className="brume-btn brume-btn--push" onClick={begin}>
          Begin
        </button>
      </Magnetic>

      <details className="brume-home-options" onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.currentTarget.open = false;
        e.currentTarget.querySelector("summary")?.focus();
      }}>
        <summary>{HOME_FEELING_COPY.options}</summary>
        <div className="brume-home-options__content">
          <div className="brume-home-options__row">
            <span>Breath cues</span>
            <div className="flex gap-2" role="group" aria-label="Breath cues">
              {(["spoken", "breath", "off"] as const).map((kind) => {
                const pressed =
                  kind === "off" ? !audioEnabled : audioEnabled && cueStyle === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    className={`brume-pill ${pressed ? "is-selected" : ""}`}
                    aria-pressed={pressed}
                    onClick={() => {
                      if (kind === "off") setAudioEnabled(false);
                      else {
                        setCueStyle(kind);
                        setAudioEnabled(true);
                      }
                    }}
                  >
                    {kind}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="brume-home-options__row">
            <span>Brume</span>
            <div className="flex gap-2" role="group" aria-label="Brume presence">
          <Magnetic pull={0.15} radius={110}>
            <button
              type="button"
              className={`brume-pill ${!companion ? "is-selected" : ""}`}
              aria-pressed={!companion}
              onClick={() => {
                if (!companion) return;
                setPresence("quiet");
                setMascotReaction({ name: "settle", key: `home-${++reactionSerial.current}` });
              }}
            >
              Quiet
            </button>
          </Magnetic>
          <Magnetic pull={0.15} radius={110}>
            <button
              type="button"
              className={`brume-pill ${companion ? "is-selected" : ""}`}
              aria-pressed={companion}
              onClick={() => {
                if (companion) return;
                setPresence("companion");
                setMascotReaction({
                  name: feel?.reaction ?? "ready",
                  key: `home-${++reactionSerial.current}`,
                });
              }}
            >
              Company
            </button>
          </Magnetic>
            </div>
          </div>
          <RoomSettings />
          <RhythmPicker value={patternOverride} onChange={setPatternOverride} />
          <p className="brume-home-options__rhythm">
            {selectedPattern && `${selectedPattern.name} · ${formatPhases(selectedPattern)}`}
          </p>
          <Link
            to="/about"
            className="brume-home-options__row text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            About Brume
          </Link>
        </div>
      </details>

      {droplet && (
        <AbsorbDroplet
          key={droplet.key}
          from={droplet.from}
          to={droplet.to}
          color={droplet.color}
          onDone={() => setDroplet(null)}
        />
      )}
    </div>
  );
}
