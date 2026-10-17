import type { BreathingPattern } from "../breathingPatterns";
import type { BreathPhase } from "../../types/metrics";

export interface SessionClock {
  elapsedMs: number;
  runningSince: number | null;
}

export interface SessionTimingSnapshot {
  duration: number;
  cycleCount: number;
  currentPhase: BreathPhase;
  phaseProgress: number;
}

type TimingPattern = Pick<
  BreathingPattern,
  "inhale" | "hold" | "exhale" | "hold_after_exhale"
>;

export function createSessionClock(): SessionClock {
  return { elapsedMs: 0, runningSince: null };
}

export function readSessionElapsedMs(clock: SessionClock, nowMs: number): number {
  if (!Number.isFinite(nowMs)) throw new RangeError("Invalid clock timestamp");
  return clock.elapsedMs + (
    clock.runningSince === null ? 0 : Math.max(0, nowMs - clock.runningSince)
  );
}

export function pauseSessionClock(clock: SessionClock, nowMs: number): SessionClock {
  return { elapsedMs: readSessionElapsedMs(clock, nowMs), runningSince: null };
}

export function resumeSessionClock(clock: SessionClock, nowMs: number): SessionClock {
  if (!Number.isFinite(nowMs)) throw new RangeError("Invalid clock timestamp");
  return clock.runningSince === null ? { ...clock, runningSince: nowMs } : clock;
}

export function sampleSessionTiming(
  clock: SessionClock,
  pattern: TimingPattern,
  nowMs: number,
): SessionTimingSnapshot {
  const phases: Array<{ name: BreathPhase; seconds: number }> = [
    { name: "inhale", seconds: pattern.inhale },
    { name: "hold", seconds: pattern.hold },
    { name: "exhale", seconds: pattern.exhale },
    { name: "pause", seconds: pattern.hold_after_exhale },
  ];
  if (
    pattern.inhale <= 0 || pattern.exhale <= 0 ||
    phases.some(({ seconds }) => !Number.isFinite(seconds) || seconds < 0)
  ) {
    throw new RangeError("Invalid breathing pattern duration");
  }

  const activePhases = phases.filter(({ seconds }) => seconds > 0);
  const cycleMs = activePhases.reduce((sum, { seconds }) => sum + seconds * 1000, 0);
  if (!Number.isFinite(cycleMs)) throw new RangeError("Invalid breathing cycle duration");

  // One active-time axis drives the displayed duration, rhythm, and cycle count.
  // Sampling is independent of tick frequency; delayed ticks do not lose phases.
  const elapsedMs = readSessionElapsedMs(clock, nowMs);
  const duration = Math.floor(elapsedMs / 1000);
  const cycleCount = Math.floor(elapsedMs / cycleMs);
  let offsetMs = elapsedMs % cycleMs;
  for (const phase of activePhases) {
    const phaseMs = phase.seconds * 1000;
    if (offsetMs < phaseMs) {
      return {
        duration,
        cycleCount,
        currentPhase: phase.name,
        phaseProgress: offsetMs / phaseMs * 100,
      };
    }
    offsetMs -= phaseMs;
  }
  throw new RangeError("Unable to resolve breathing phase");
}
