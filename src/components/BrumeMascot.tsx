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
// A short trail tagged by mount id: a mount's own position records
// (StrictMode's replayed effects, sibling mounts on the same route)
// can never masquerade as the previous screen's position.
type CompanionSpot = { id: number; state: string; cx: number; cy: number; t: number };
const companionTrail: CompanionSpot[] = [];
let nextMountId = 1;
const FLIGHT_RELEASE_MS = 700;
const FLIGHT_STALE_MS = 2000;

function projectedCenter(host: HTMLElement) {
  const r = host.getBoundingClientRect();
  if (!r.width) return null;
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
  return { cx: r.left + r.width / 2 - tx, cy: r.top + r.height / 2 - ty };
}

function recordCompanion(host: HTMLElement, id: number) {
  const c = projectedCenter(host);
  if (!c) return;
  companionTrail.push({
    id,
    state: host.dataset.state || "idle",
    cx: c.cx,
    cy: c.cy,
    t: performance.now(),
  });
  if (companionTrail.length > 4) companionTrail.shift();
}

function flightVector(host: HTMLElement, selfId: number) {
  const c = projectedCenter(host);
  if (!c) return null;
  const now = performance.now();
  const prev = [...companionTrail].reverse().find(
    (e) => e.id !== selfId && now - e.t <= FLIGHT_STALE_MS,
  );
  if (!prev) return null;
  const dx = c.cx - prev.cx;
  const dy = c.cy - prev.cy;
  const dist = Math.hypot(dx, dy);
  if (dist < 30) return null;
  return {
    fromState: prev.state,
    gaze: {
      x: Math.max(-2.4, Math.min(2.4, dx * 0.006)),
      y: Math.max(-1.8, Math.min(1.8, dy * 0.006)),
    },
    lean: Math.max(-4, Math.min(4, dx * 0.03)),
    smear: {
      x: dx / dist,
      y: dy / dist,
      strength: Math.min(1, dist / 420),
    },
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
  const mountIdRef = useRef(0);
  if (!mountIdRef.current) mountIdRef.current = nextMountId++;

  useLayoutEffect(() => {
    // Skip until the mount effect ran — the trail still holds the
    // previous screen's position and flightVector hasn't read it yet.
    if (!layoutId || !hostRef.current || !liveRef.current) return;
    const host = hostRef.current;
    recordCompanion(host, mountIdRef.current);
    // Departure stamp: refresh the *time* of our latest entry at
    // unmount — staleness then measures how long ago the companion
    // was last seen, while cx/cy keep the last resting position
    // (a rect read at unmount catches mid-exit transforms instead).
    return () => {
      const mine = [...companionTrail].reverse().find((e) => e.id === mountIdRef.current);
      if (mine) mine.t = performance.now();
    };
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const flight = layoutId ? flightVector(host, mountIdRef.current) : null;
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
    if (layoutId) recordCompanion(host, mountIdRef.current);
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
