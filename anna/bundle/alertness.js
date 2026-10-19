// Alertness check — a 60-second reaction-time test (PVT-style), pure
// metrics separate from the DOM driver so everything is unit-testable.
// Not a medical test.

export const CHECK_SECONDS = 60;
export const ISI_MIN_MS = 1500;
export const ISI_MAX_MS = 4000;
export const FALSE_START_MS = 100;
export const LAPSE_MS = 500;
export const NO_RESPONSE_MS = 3000;
export const BASELINE_MIN = 3;
export const BASELINE_WINDOW = 10;

// One recorded response attempt. anticipated: key/pointer press before
// the stimulus onset or < FALSE_START_MS after it.
export function computeMetrics(responses) {
  const valid = responses.filter((r) => !r.falseStart);
  const rts = valid.map((r) => r.rtMs).sort((a, b) => a - b);
  const medianMs = rts.length
    ? rts.length % 2
      ? rts[(rts.length - 1) / 2]
      : (rts[rts.length / 2 - 1] + rts[rts.length / 2]) / 2
    : 0;
  const meanSpeed = rts.length
    ? rts.reduce((s, rt) => s + 1000 / rt, 0) / rts.length
    : 0;
  const counts = { touch: 0, mouse: 0, keyboard: 0 };
  for (const r of valid) counts[r.inputType] = (counts[r.inputType] || 0) + 1;
  const inputType =
    Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "mouse";
  return {
    trials: valid.length,
    medianMs: Math.round(medianMs),
    meanSpeed: Math.round(meanSpeed * 1000) / 1000,
    lapses: valid.filter((r) => r.rtMs >= LAPSE_MS).length,
    falseStarts: responses.filter((r) => r.falseStart).length,
    inputType,
  };
}

// Baseline = median of medianMs over the user's last ≤10 previous
// checks with the same inputType. Returns null while fewer than
// BASELINE_MIN matching checks exist.
export function baselineMedian(priorChecks, inputType) {
  const matching = priorChecks
    .filter((c) => c.inputType === inputType)
    .slice(0, BASELINE_WINDOW)
    .map((c) => c.medianMs)
    .sort((a, b) => a - b);
  if (matching.length < BASELINE_MIN) return null;
  const mid = Math.floor(matching.length / 2);
  return matching.length % 2
    ? matching[mid]
    : (matching[mid - 1] + matching[mid]) / 2;
}

// Band vs baseline. lapses >= 3 or >= +20% -> much slower.
export function bandFor(medianMs, lapses, baseline) {
  if (lapses >= 3) return "much slower than usual";
  if (baseline == null) return null; // no baseline yet
  const ratio = medianMs / baseline;
  if (ratio >= 1.2) return "much slower than usual";
  if (ratio >= 1.1) return "slower than usual";
  if (ratio > 0.95) return "about your usual";
  return "sharper than usual";
}

export function updateAlertSummary(summary, check) {
  const s = summary && summary.version === 1 ? summary : { version: 1, recent: [] };
  s.recent = [
    {
      completedAt: check.completedAt,
      medianMs: check.medianMs,
      lapses: check.lapses,
      kss: check.kss,
      inputType: check.inputType,
    },
    ...s.recent,
  ].slice(0, 20);
  return s;
}

export function alertnessNotePrompt({ metrics, baseline, band, kss, checkCount, timeOfDay }) {
  const baselineLine =
    baseline == null
      ? `not enough checks yet (this is check ${checkCount} of the 3 needed for a baseline)`
      : `${baseline} ms`;
  return `You write the short note shown after a 60-second reaction-time alertness check in a breathing-break app. This is not a medical test.
Facts:
- Median reaction time: ${metrics.medianMs} ms; lapses (responses slower than 500 ms): ${metrics.lapses} of ${metrics.trials}; false starts: ${metrics.falseStarts}
- Their usual median (from their last ${BASELINE_WINDOW} checks on this device type): ${baselineLine}
- Compared with their usual: ${band || "no baseline yet"}
- How sleepy they said they feel (Karolinska scale, 1 = extremely alert, 9 = very sleepy): ${kss ?? "not given"}
- Local time of day: ${timeOfDay}
Write at most 2 sentences and 40 words in total. First, say plainly what the result shows compared with their own usual, without judging them. Second, suggest one small next step for the next few minutes that fits the result: if they are sharper than usual or about their usual, a good use of that focus, such as starting the task that needs it most; if they are slower than usual or sleepy, a short Brume breathing break, a few minutes of movement or daylight, or some water; if it is late and they are very sleepy, winding down. Plain text only, no emoji, no medical or health claims, and never diagnose.`;
}


// Result heading: capitalized band, or the baseline-building note when
// there isn't a baseline yet (never a bare band in that case).
export function alertHeading(band, baseline, checkCount) {
  if (baseline == null)
    return `Building your baseline (check ${checkCount} of ${BASELINE_MIN})`;
  return band ? band[0].toUpperCase() + band.slice(1) : "Check complete";
}

export const ALERTNESS_FALLBACK_NOTE =
  "Thanks — this check is saved and helps build your usual.";

// --- DOM driver ----------------------------------------------------------
// runAlertness({onStimulus, onResult, isCancelled, rand}) drives the
// 60s test. Returns {stop, respond, awaiting}: call respond(inputType,
// rtMs) on every input while awaiting() is true.

export function runAlertness({ onStimulus, onResult, isCancelled, rand = Math.random }) {
  const responses = [];
  let pending = null; // {timer, timeout}
  let ended = false;

  function end() {
    if (ended) return;
    ended = true;
    if (pending) { clearTimeout(pending.timer); clearTimeout(pending.timeout); pending = null; }
    onResult(computeMetrics(responses), responses);
  }

  // Called by the UI on every response. rt is measured by the caller
  // from the stimulus onset (performance.now() - onset).
  function respond(inputType, rt) {
    if (!pending || !pending.live || ended) return false;
    clearTimeout(pending.timeout);
    pending = null;
    if (rt < FALSE_START_MS) {
      responses.push({ falseStart: true, inputType });
    } else {
      responses.push({ rtMs: rt, inputType });
    }
    setTimeout(schedule, 600); // brief feedback window, then next interval
    return true;
  }

  function schedule() {
    if (ended || isCancelled?.()) return;
    const isi = ISI_MIN_MS + rand() * (ISI_MAX_MS - ISI_MIN_MS);
    const timer = setTimeout(() => {
      if (ended || isCancelled?.()) return;
      // Onset is the first rAF timestamp after the stimulus is shown —
      // the caller fires respond() with RT measured from its own
      // performance.now() mark taken at that frame.
      pending = { live: false };
      requestAnimationFrame(() => {
        if (!pending || ended) return;
        onStimulus?.();
        pending.live = true;
        pending.timeout = setTimeout(() => {
          if (!pending || ended) return;
          responses.push({ rtMs: NO_RESPONSE_MS, inputType: "mouse" });
          pending = null;
          setTimeout(schedule, 600);
        }, NO_RESPONSE_MS);
      });
      pending.timer = timer;
    }, isi);
    pending = { timer, live: false };
  }

  const stopTimer = setTimeout(end, CHECK_SECONDS * 1000);
  schedule();
  return {
    stop: () => { clearTimeout(stopTimer); end(); },
    respond,
    awaiting: () => Boolean(pending && pending.live),
  };
}
