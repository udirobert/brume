// Brume — a small mist sprite that IS the breath circle.
// React port of anna/bundle/mascot.js — keep the two in sync: same DOM,
// same class names, same states. Styles live in BrumeMascot.css
// (mirrored from anna/bundle/app.css).

import { useEffect, useRef } from "react";
import { createMascot } from "../../anna/bundle/mascot.js";
import type { MascotHandle, BrumeMascotState } from "../../anna/bundle/mascot.js";
import type { MascotPresence } from "@/lib/mascotPresence";
import "./BrumeMascot.css";

export type { BrumeMascotState, MascotHandle };

export interface BrumeMascotProps {
  state?: BrumeMascotState;
  /** 0..1 breath scale driven by a breathing clock (optional). */
  breath?: number;
  size?: number;
  className?: string;
  presence?: MascotPresence;
  trackPointer?: boolean;
  breathing?: boolean;
  breathPeriod?: number;
}

export function BrumeMascot({
  state = "idle",
  breath,
  size = 104,
  className,
  presence = "quiet",
  trackPointer = false,
  breathing = false,
  breathPeriod = 7,
}: BrumeMascotProps) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const handleRef = useRef<MascotHandle | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    handleRef.current = createMascot(host);
    return () => {
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, []);

  useEffect(() => {
    handleRef.current?.setOptions({
      presence,
      trackPointer,
      breathing,
      breathPeriod,
      breath,
    });
  }, [presence, trackPointer, breathing, breathPeriod, breath]);

  useEffect(() => {
    handleRef.current?.setState(state);
  }, [state]);

  return (
    <span
      ref={hostRef}
      className={`brume-mascot ${className || ""}`}
      data-presence={presence}
      style={{ width: size, height: size }}
    />
  );
}

export default BrumeMascot;
