// Brume — a small mist sprite that IS the breath circle.
// React port of anna/bundle/mascot.js — keep the two in sync: same DOM,
// same class names, same states. Styles live in BrumeMascot.css
// (mirrored from anna/bundle/app.css).

import { useEffect, useLayoutEffect, useRef } from "react";
import { motion } from "framer-motion";
import { createMascot } from "../../anna/bundle/mascot.js";
import type { MascotHandle, BrumeMascotState, MascotReaction } from "../../anna/bundle/mascot.js";
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
  /** Shared layoutId makes the sprite travel between mount points. */
  layoutId?: string;
}

// Where the companion was on the previous screen — a new mount reads
// this to fly in looking where it's going, still wearing its old face.
let lastCompanion: { state: string; cx: number; cy: number; t: number } | null = null;
const FLIGHT_RELEASE_MS = 700;

function flightVector(host: HTMLElement) {
  if (!lastCompanion || performance.now() - lastCompanion.t > 2000) return null;
  const r = host.getBoundingClientRect();
  const tr = getComputedStyle(host).transform;
  let tx = 0;
  let ty = 0;
  if (tr && tr !== "none") {
    const m = tr.match(/matrix\(([^)]+)\)/);
    if (m) {
      const p = m[1].split(",").map(Number);
      tx = p[4] || 0;
      ty = p[5] || 0;
    }
  }
  const cx = r.left + r.width / 2 - tx;
  const cy = r.top + r.height / 2 - ty;
  const dx = cx - lastCompanion.cx;
  const dy = cy - lastCompanion.cy;
  if (Math.hypot(dx, dy) < 30) return null;
  return {
    fromState: lastCompanion.state,
    gaze: {
      x: Math.max(-2.4, Math.min(2.4, dx * 0.006)),
      y: Math.max(-1.8, Math.min(1.8, dy * 0.006)),
    },
    lean: Math.max(-4, Math.min(4, dx * 0.03)),
  };
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
  layoutId,
}: BrumeMascotProps) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const handleRef = useRef<MascotHandle | null>(null);
  const reactionSeen = useRef(false);
  const prevReactionKey = useRef<string | number | undefined>(undefined);
  const liveRef = useRef(false);

  useLayoutEffect(() => {
    // Skip until the mount effect ran — lastCompanion still holds the
    // previous screen's position and flightVector hasn't read it yet.
    if (!layoutId || !hostRef.current || !liveRef.current) return;
    const r = hostRef.current.getBoundingClientRect();
    if (r.width) {
      lastCompanion = {
        state,
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
        t: performance.now(),
      };
    }
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const flight = layoutId ? flightVector(host) : null;
    handleRef.current = createMascot(
      host,
      flight ? { state: flight.fromState, gaze: flight.gaze, lean: flight.lean } : {},
    );
    let release = 0;
    if (flight) {
      release = window.setTimeout(() => {
        handleRef.current?.setOptions({ gaze: undefined, lean: undefined });
      }, FLIGHT_RELEASE_MS);
    }
    liveRef.current = true;
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
    />
  );
}

export default BrumeMascot;
