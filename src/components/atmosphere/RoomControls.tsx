import { useEffect, useRef, useState } from "react";
import {
  ROOM_LABELS,
  materialForFeel,
  useRoomExperience,
  type RoomMaterial,
} from "@/lib/roomExperience";
import {
  isAmbienceEnabled,
  refreshAmbience,
  setAmbienceEnabled,
} from "@/lib/ambience";

const OVERRIDE_OPTIONS: readonly RoomMaterial[] = [
  "waves",
  "sand",
  "cells",
  "snow",
  "ink",
];

export function RoomSettings({
  onMaterialPicked,
}: {
  onMaterialPicked?: (material: RoomMaterial | null) => void;
}) {
  const materialOverride = useRoomExperience((s) => s.materialOverride);
  const still = useRoomExperience((s) => s.still);
  const setMaterial = useRoomExperience((s) => s.setMaterial);
  const setStill = useRoomExperience((s) => s.setStill);
  const [ambienceOn, setAmbienceOn] = useState(isAmbienceEnabled);

  const pick = (m: RoomMaterial | null) => {
    setMaterial(m);
    onMaterialPicked?.(m);
  };
  return (
    <fieldset className="brume-room-settings">
      <legend>Room</legend>
      <div className="brume-room-settings__grid" role="group" aria-label="Room material">
        <button
          type="button"
          className="brume-room-controls__item"
          aria-pressed={materialOverride === null}
          onClick={() => pick(null)}
        >
          Auto
        </button>
        {OVERRIDE_OPTIONS.map((m) => (
          <button
            key={m}
            type="button"
            className="brume-room-controls__item"
            aria-pressed={materialOverride === m}
            onClick={() => pick(m)}
          >
            {ROOM_LABELS[m]}
          </button>
        ))}
        <button
          type="button"
          className="brume-room-controls__item brume-room-controls__still"
          aria-pressed={still}
          onClick={() => setStill(!still)}
        >
          Still room
        </button>
        <button
          type="button"
          className="brume-room-controls__item"
          aria-pressed={ambienceOn}
          title="Waves and snow carry a quiet sound bed"
          onClick={() => {
            const next = !ambienceOn;
            setAmbienceEnabled(next);
            setAmbienceOn(next);
            refreshAmbience();
          }}
        >
          Ambience {ambienceOn ? "on" : "off"}
        </button>
      </div>
    </fieldset>
  );
}

export function RoomControls({
  routeKey,
  immersive = false,
  decompress = false,
  inline = false,
}: {
  routeKey?: string;
  immersive?: boolean;
  decompress?: boolean;
  inline?: boolean;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const materialOverride = useRoomExperience((s) => s.materialOverride);
  const feelIndex = useRoomExperience((s) => s.feelIndex);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    close();
  }, [routeKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = (refocus = false) => {
    setOpen(false);
    if (detailsRef.current) {
      detailsRef.current.open = false;
      if (refocus) detailsRef.current.querySelector("summary")?.focus();
    }
  };

  const pick = () => {
    close(true);
  };

  const current = materialOverride ?? materialForFeel(feelIndex);

  return (
    <details
      ref={detailsRef}
      className={`brume-room-controls${immersive ? " brume-room-controls--immersive" : ""}${decompress ? " brume-room-controls--decompress" : ""}${inline ? " brume-room-controls--inline" : ""}`}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary aria-label={`Change room, ${ROOM_LABELS[current]}`}>
        <span aria-hidden="true">{ROOM_LABELS[current]} · room</span>
      </summary>
      <div className="brume-room-controls__pop" role="group" aria-label="Room material">
        <RoomSettings onMaterialPicked={pick} />
      </div>
    </details>
  );
}

export default RoomControls;
