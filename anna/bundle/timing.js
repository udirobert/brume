// Session timing logic — a plain-JS port of src/lib/utils/session-timing.ts.
// One monotonic active-time clock drives duration, phase, and cycle count.
// Sampling is independent of tick frequency; paused time never accrues.
// Keep this file dependency-free: it is also imported by the node smoke test.

export function createSessionClock() {
  return { elapsedMs: 0, runningSince: null };
}

export function readSessionElapsedMs(clock, nowMs) {
  if (!Number.isFinite(nowMs)) throw new RangeError("Invalid clock timestamp");
  return (
    clock.elapsedMs +
    (clock.runningSince === null ? 0 : Math.max(0, nowMs - clock.runningSince))
  );
}

export function pauseSessionClock(clock, nowMs) {
  return { elapsedMs: readSessionElapsedMs(clock, nowMs), runningSince: null };
}

export function resumeSessionClock(clock, nowMs) {
  if (!Number.isFinite(nowMs)) throw new RangeError("Invalid clock timestamp");
  return clock.runningSince === null
    ? { ...clock, runningSince: nowMs }
    : clock;
}

export function isClockRunning(clock) {
  return clock.runningSince !== null;
}

// pattern: { inhale, hold, exhale, holdAfterExhale } in seconds.
// Returns { duration, cycleCount, currentPhase, phaseProgress } where
// duration is floored active seconds and cycleCount counts full cycles.
export function sampleSessionTiming(clock, pattern, nowMs) {
  const phases = [
    { name: "inhale", seconds: pattern.inhale },
    { name: "hold", seconds: pattern.hold },
    { name: "exhale", seconds: pattern.exhale },
    { name: "pause", seconds: pattern.holdAfterExhale },
  ];
  if (
    pattern.inhale <= 0 ||
    pattern.exhale <= 0 ||
    phases.some(({ seconds }) => !Number.isFinite(seconds) || seconds < 0)
  ) {
    throw new RangeError("Invalid breathing pattern duration");
  }

  const activePhases = phases.filter(({ seconds }) => seconds > 0);
  const cycleMs = activePhases.reduce(
    (sum, { seconds }) => sum + seconds * 1000,
    0,
  );
  if (!Number.isFinite(cycleMs))
    throw new RangeError("Invalid breathing cycle duration");

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
        phaseProgress: (offsetMs / phaseMs) * 100,
      };
    }
    offsetMs -= phaseMs;
  }
  throw new RangeError("Unable to resolve breathing phase");
}

export function cycleDurationSeconds(pattern) {
  return (
    (pattern.inhale || 0) +
    (pattern.hold || 0) +
    (pattern.exhale || 0) +
    (pattern.holdAfterExhale || 0)
  );
}
