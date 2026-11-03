// Brume — a small mist sprite that IS the breath circle.
// React port of anna/bundle/mascot.js — keep the two in sync: same DOM,
// same class names, same states. Styles live in BrumeMascot.css
// (mirrored from anna/bundle/app.css).

import { useEffect, useLayoutEffect, useRef } from "react";
import { motion } from "framer-motion";
import { createMascot } from "../../anna/bundle/mascot.js";
import type { MascotHandle, BrumeMascotState, MascotReaction } from "../../anna/bundle/mascot.js";
import {
  allocMountId,
  flightVector,
  readCenter,
  recordCompanion,
  stampDeparture,
  FLIGHT_RELEASE_MS,
} from "@/lib/mascotFlight";
import type { MascotPresence } from "@/lib/mascotPresence";
import "./BrumeMascot.css";

export type { BrumeMascotState, MascotHandle, MascotReaction };

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
  /** One-shot reaction; fires when `key` changes (not on first mount). */
  reaction?: { name: MascotReaction; key: string | number };
  /** Touch the creature: pointer/keyboard tap fires this reaction. */
  tapReaction?: MascotReaction;
  /** Shared layoutId makes the sprite travel between mount points. */
  layoutId?: string;
}

// Where the companion was on the previous screen — a new mount reads
// the shared trail (src/lib/mascotFlight.ts) to fly in looking where
// it's going, still wearing its old face, and smearing along the way.
function centerOf(host: HTMLElement) {
  return readCenter(host.getBoundingClientRect(), getComputedStyle(host).transform);
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
  reaction,
  tapReaction,
  layoutId,
}: BrumeMascotProps) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const handleRef = useRef<MascotHandle | null>(null);
  const reactionSeen = useRef(false);
  const prevReactionKey = useRef<string | number | undefined>(undefined);
  const liveRef = useRef(false);
  const mountIdRef = useRef(0);
  if (!mountIdRef.current) mountIdRef.current = allocMountId();

  useLayoutEffect(() => {
    // Skip until the mount effect ran — the trail still holds the
    // previous screen's position and flightVector hasn't read it yet.
    if (!layoutId || !hostRef.current || !liveRef.current) return;
    const host = hostRef.current;
    recordSpot(host);
    // Departure stamp: refresh the *time* of our latest entry at
    // unmount — staleness then measures how long ago the companion
    // was last seen, while cx/cy keep the last resting position
    // (a rect read at unmount catches mid-exit transforms instead).
    return () => stampDeparture(mountIdRef.current);
  });

  function recordSpot(host: HTMLElement) {
    const c = centerOf(host);
    if (c) recordCompanion(mountIdRef.current, host.dataset.state || "idle", c);
  }

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const flight =
      layoutId && centerOf(host)
        ? flightVector(mountIdRef.current, centerOf(host)!)
        : null;
    handleRef.current = createMascot(
      host,
      flight ? { state: flight.fromState, gaze: flight.gaze, lean: flight.lean } : {},
    );
    let release = 0;
    if (flight) {
      handleRef.current?.smearFrom(flight.smear);
      release = window.setTimeout(() => {
        handleRef.current?.setOptions({ gaze: undefined, lean: undefined });
      }, FLIGHT_RELEASE_MS);
    }
    liveRef.current = true;
    // Record on mount too: screens where nothing re-renders the mascot
    // (the home card) would otherwise leave the trail empty, and the
    // first flight out of them would never be detected.
    if (layoutId) recordSpot(host);
    return () => {
      if (release) clearTimeout(release);
      handleRef.current?.destroy();
      handleRef.current = null;
    };
    // layoutId is a mount-time contract, not a reactive prop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  useEffect(() => {
    if (!reactionSeen.current) {
      reactionSeen.current = true;
    } else if (reaction && reaction.key !== prevReactionKey.current) {
      handleRef.current?.react(reaction.name);
    }
    prevReactionKey.current = reaction?.key;
  }, [reaction]);

  return (
    <motion.span
      ref={hostRef}
      layoutId={layoutId}
      className={`brume-mascot ${className || ""}`}
      data-presence={presence}
      style={{ width: size, height: size }}
      role={tapReaction ? "button" : undefined}
      tabIndex={tapReaction ? 0 : undefined}
      onPointerDown={tapReaction ? () => handleRef.current?.react(tapReaction) : undefined}
      onKeyDown={tapReaction
        ? (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleRef.current?.react(tapReaction);
            }
          }
        : undefined}
    />
  );
}

export default BrumeMascot;
