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

// --- Tempo (mid-session pace control) ---------------------------------------
//
// A tempo factor scales phase durations uniformly: tempo 1.25 = 25%
// slower, 0.8 = 25% faster. The SessionClock is untouched — it keeps
// tracking absolute active elapsed in real milliseconds.
//
// Chosen recalibration semantics: progress-preserving immediate apply.
// Rather than waiting for the next phase boundary, a tempo change takes
// effect at once while the current phase keeps its progress percentage.
// This is implemented via "pattern time" tau: inside each tempo segment,
// tau advances at 1/tempo of real elapsed time, and the base pattern is
// sampled at tau. Because tau is continuous across tempo changes, the
// phase and its progress fraction cannot jump — only the remaining real
// duration of the phase stretches or shrinks. duration (floored active
// seconds) and cycleCount therefore keep their monotonic-clock meaning.

export function createTempoTracker() {
  return { tauMs: 0, tempo: 1, syncedElapsedMs: 0 };
}

// Advance pattern-time to the clock's current elapsed. Pure — returns a
// new tracker. Call before sampling and before changing tempo.
export function syncTempoTracker(tracker, clock, nowMs) {
  if (!Number.isFinite(tracker.tempo) || tracker.tempo <= 0) {
    throw new RangeError("Invalid tempo factor");
  }
  const elapsedMs = readSessionElapsedMs(clock, nowMs);
  const deltaMs = Math.max(0, elapsedMs - tracker.syncedElapsedMs);
  return {
    tauMs: tracker.tauMs + deltaMs / tracker.tempo,
    tempo: tracker.tempo,
    syncedElapsedMs: elapsedMs,
  };
}

// Change the tempo, preserving the current phase + progress. Sync first
// so time already accrued lands under the old tempo.
export function setTempo(tracker, clock, nowMs, tempo) {
  const synced = syncTempoTracker(tracker, clock, nowMs);
  if (!Number.isFinite(tempo) || tempo <= 0) {
    throw new RangeError("Invalid tempo factor");
  }
  return { ...synced, tempo };
}

// Sample phase/cycleCount from pattern-time while duration stays real
// active elapsed. Mirrors sampleSessionTiming's shape exactly.
export function sampleSessionTimingWithTempo(clock, tracker, pattern, nowMs) {
  const synced = syncTempoTracker(tracker, clock, nowMs);
  const snap = sampleSessionTiming(
    { elapsedMs: synced.tauMs, runningSince: null },
    pattern,
    0,
  );
  return {
    duration: Math.floor(readSessionElapsedMs(clock, nowMs) / 1000),
    cycleCount: snap.cycleCount,
    currentPhase: snap.currentPhase,
    phaseProgress: snap.phaseProgress,
  };
}
