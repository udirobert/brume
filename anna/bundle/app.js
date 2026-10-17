// Brume Reset — Anna App bundle entry.
// Camera-free, no audio, no external calls. Talks to the host only via
// the AnnaAppRuntime SDK (storage.get / storage.set / llm.complete).

import {
  createSessionClock,
  pauseSessionClock,
  resumeSessionClock,
  isClockRunning,
  createTempoTracker,
  syncTempoTracker,
  setTempo,
  sampleSessionTimingWithTempo,
  cycleDurationSeconds,
} from "./timing.js";
import {
  PATTERN,
  TARGET_SECONDS,
  PHASE_WORDS,
  PACE_LEVELS,
  PACE_TEMPO,
  PACE_LABEL,
  buildCompletionRecord,
  saveCompletionRecord,
  loadLastRecord,
  fetchClosingLine,
  FALLBACK_CLOSING_LINE,
} from "./session.js";

const SDK_URL = "/static/anna-apps/_sdk/latest/index.js";
const TARGET_MS = TARGET_SECONDS * 1000;
const TICK_MS = 200;
const TOTAL_CYCLES = Math.round(TARGET_SECONDS / cycleDurationSeconds(PATTERN));
const REDUCED_MOTION =
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = (sel) => document.querySelector(sel);

const els = {
  start: $("#screen-start"),
  session: $("#screen-session"),
  result: $("#screen-result"),
  begin: $("#btn-begin"),
  pause: $("#btn-pause"),
  end: $("#btn-end"),
  slower: $("#btn-slower"),
  faster: $("#btn-faster"),
  paceHint: $("#pace-hint"),
  again: $("#btn-again"),
  phase: $("#phase-word"),
  elapsed: $("#elapsed"),
  target: $("#target"),
  cycle: $("#cycle-label"),
  dot: $("#breath-dot"),
  resultHeading: $("#result-heading"),
  resultPattern: $("#result-pattern"),
  resultTime: $("#result-time"),
  resultCycles: $("#result-cycles"),
  closingLine: $("#closing-line"),
  saveNote: $("#save-note"),
  lastSession: $("[data-last-session]"),
};

async function connectAnna() {
  try {
    const { AnnaAppRuntime } = await import(SDK_URL);
    const anna = await AnnaAppRuntime.connect();
    try {
      await anna.window.set_title({ title: "Brume Reset" });
    } catch {
      /* cosmetic only */
    }
    return anna;
  } catch {
    return null; // standalone preview: no host
  }
}

function fmtSeconds(total) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function show(screen) {
  for (const el of [els.start, els.session, els.result]) {
    el.hidden = el !== screen;
  }
}

function now() {
  return performance.timeOrigin + performance.now();
}

let anna = null;
let clock = null;
let tracker = null; // tempo state: pattern-time + current pace factor
let paceIdx = 1; // index into PACE_LEVELS; 1 = "normal"
let timer = null;
let finishing = false;

function updateBreathDot(snap) {
  if (REDUCED_MOTION || !els.dot) return;
  // Inhale grows 0.75 → 1.15, exhale shrinks 1.15 → 0.75, holds stay put.
  const t = snap.phaseProgress / 100;
  let scale = 0.75;
  if (snap.currentPhase === "inhale") scale = 0.75 + 0.4 * t;
  else if (snap.currentPhase === "exhale") scale = 1.15 - 0.4 * t;
  else scale = snap.currentPhase === "pause" ? 0.75 : 1.15;
  els.dot.style.transform = `scale(${scale.toFixed(3)})`;
}

// Pace buttons are only meaningful while the session is running — they
// are disabled while paused, finished, or at the tempo extreme.
function updatePaceUI() {
  const running = clock !== null && isClockRunning(clock);
  if (els.slower) els.slower.disabled = !running || paceIdx <= 0;
  if (els.faster)
    els.faster.disabled = !running || paceIdx >= PACE_LEVELS.length - 1;
  if (els.paceHint) els.paceHint.textContent = PACE_LABEL[PACE_LEVELS[paceIdx]];
}

function setPaceLevel(idx) {
  if (!clock || !isClockRunning(clock)) return;
  paceIdx = Math.max(0, Math.min(PACE_LEVELS.length - 1, idx));
  // Tempo applies immediately, preserving the current phase + progress
  // (see timing.js tempo section).
  tracker = setTempo(tracker, clock, now(), PACE_TEMPO[PACE_LEVELS[paceIdx]]);
  updatePaceUI();
}

function tick() {
  if (!clock) return;
  tracker = syncTempoTracker(tracker, clock, now());
  const snap = sampleSessionTimingWithTempo(clock, tracker, PATTERN, now());
  els.phase.textContent = isClockRunning(clock)
    ? PHASE_WORDS[snap.currentPhase] || snap.currentPhase
    : "Paused";
  els.elapsed.textContent = fmtSeconds(snap.duration);
  els.cycle.textContent = `Cycle ${Math.min(snap.cycleCount + 1, TOTAL_CYCLES)} of ${TOTAL_CYCLES}`;
  updateBreathDot(snap);
  if (snap.duration >= TARGET_SECONDS) finish(false);
}

async function finish(interrupted) {
  if (finishing) return;
  finishing = true;
  clearInterval(timer);
  timer = null;
  const snap = clock
    ? sampleSessionTimingWithTempo(clock, tracker, PATTERN, now())
    : { duration: 0, cycleCount: 0 };
  const activeSeconds = snap.duration;
  const cycles = snap.cycleCount;
  clock = null;
  tracker = null;
  updatePaceUI();

  // Issue llm.complete before showing the result — the successful call is
  // what makes the run server-observable. It is raced against a ~4s cap
  // inside fetchClosingLine and never throws, so the factual result below
  // renders regardless; the line swaps in when the model answers.
  const qualifies = activeSeconds >= 1;
  const closingLinePromise = qualifies
    ? fetchClosingLine(anna, { activeSeconds, cycles, interrupted })
    : Promise.resolve(null);

  els.resultHeading.textContent = interrupted ? "Ended early" : "Reset complete";
  els.resultPattern.textContent = PATTERN.name;
  els.resultTime.textContent = `${activeSeconds} second${activeSeconds === 1 ? "" : "s"}`;
  els.resultCycles.textContent = String(cycles);
  els.closingLine.textContent = FALLBACK_CLOSING_LINE; // provisional
  els.closingLine.hidden = !qualifies;
  els.saveNote.hidden = true;
  show(els.result);

  if (!qualifies) {
    els.saveNote.textContent = "Under one active second — nothing was saved.";
    els.saveNote.hidden = false;
    return;
  }

  const line = await closingLinePromise;
  if (line) els.closingLine.textContent = line;

  if (!anna) {
    els.saveNote.textContent = "Not connected to Anna — nothing was saved.";
    els.saveNote.hidden = false;
    return;
  }
  try {
    const record = buildCompletionRecord({
      activeSeconds,
      cycles,
      interrupted,
      now: Date.now(),
    });
    await saveCompletionRecord(anna, record);
  } catch {
    els.saveNote.textContent =
      "Couldn't save this session — the result above still stands.";
    els.saveNote.hidden = false;
  }
}

function begin() {
  clock = resumeSessionClock(createSessionClock(), now());
  tracker = createTempoTracker();
  paceIdx = 1; // "normal"
  finishing = false;
  els.pause.textContent = "Pause";
  els.target.textContent = fmtSeconds(TARGET_SECONDS);
  updatePaceUI();
  show(els.session);
  tick();
  timer = setInterval(tick, TICK_MS);
}

async function main() {
  document
    .querySelectorAll("[data-pattern-name]")
    .forEach((el) => (el.textContent = PATTERN.name));

  anna = await connectAnna();

  if (anna && els.lastSession) {
    try {
      const last = await loadLastRecord(anna);
      if (last && last.completedAt) {
        const when = new Date(last.completedAt);
        els.lastSession.textContent = `Last reset: ${when.toLocaleString()} · ${last.activeSeconds}s`;
        els.lastSession.hidden = false;
      }
    } catch {
      /* absence of history is fine */
    }
  }

  els.begin.addEventListener("click", begin);
  els.again.addEventListener("click", () => show(els.start));
  els.end.addEventListener("click", () => finish(true));
  els.slower.addEventListener("click", () => setPaceLevel(paceIdx - 1));
  els.faster.addEventListener("click", () => setPaceLevel(paceIdx + 1));
  els.pause.addEventListener("click", () => {
    if (!clock) return;
    if (isClockRunning(clock)) {
      clock = pauseSessionClock(clock, now());
      els.pause.textContent = "Resume";
      els.phase.textContent = "Paused";
    } else {
      clock = resumeSessionClock(clock, now());
      els.pause.textContent = "Pause";
    }
    updatePaceUI();
  });
}

main();
