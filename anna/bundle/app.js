// Brume Reset — Anna App bundle entry.
// AI-planned guided breathing break: Home → Planning → Plan → Session →
// Check-in → Result. Talks to the host only via the AnnaAppRuntime SDK
// (storage, llm.complete/catalog, audio.speak, mobile.haptics).

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
  PATTERNS,
  ALLOWED_LENGTHS,
  fallbackPlan,
  effectiveLengthSeconds,
  phaseWord,
} from "./plan.js";
import {
  PHASE_WORDS,
  PACE_LEVELS,
  PACE_TEMPO,
  PACE_LABEL,
  SOUND_MODES,
  buildCompletionRecord,
  saveCompletionRecord,
  loadLastRecord,
  loadSummary,
  loadPrefs,
  savePrefs,
  summaryLine,
  fetchPlan,
  fetchReflection,
  FALLBACK_REFLECTION,
} from "./session.js";
import { ChimePlayer, VoiceGuide, VoiceUnavailable } from "./audio.js";

const SDK_URL = "/static/anna-apps/_sdk/latest/index.js";
const TICK_MS = 200;
const REDUCED_MOTION =
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = (sel) => document.querySelector(sel);

const els = {
  screens: {
    home: $("#screen-home"),
    planning: $("#screen-planning"),
    plan: $("#screen-plan"),
    session: $("#screen-session"),
    checkin: $("#screen-checkin"),
    result: $("#screen-result"),
  },
  contextInput: $("#context-input"),
  btnPlan: $("#btn-plan"),
  btnQuick: $("#btn-quick"),
  btnSkipPlan: $("#btn-skip-plan"),
  planTitle: $("#plan-title"),
  planOffline: $("#plan-offline"),
  planRhythm: $("#plan-rhythm"),
  planLength: $("#plan-length"),
  planOpening: $("#plan-opening"),
  planWhy: $("#plan-why"),
  patternChips: $("#pattern-chips"),
  lengthChips: $("#length-chips"),
  soundChips: $("#sound-chips"),
  begin: $("#btn-begin"),
  sessionPattern: $("#session-pattern"),
  pause: $("#btn-pause"),
  end: $("#btn-end"),
  slower: $("#btn-slower"),
  faster: $("#btn-faster"),
  paceHint: $("#pace-hint"),
  again: $("#btn-again"),
  phase: $("#phase-word"),
  cue: $("#cue-text"),
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
  worked: $("[data-worked]"),
  toast: $("#toast"),
};

// Brume mascots — one sprite per screen, lazily created on first show.
const mascots = {};
function mascot(name) {
  const host = $(`#mascot-${name}`);
  if (!host) return null;
  if (!mascots[name]) mascots[name] = createMascot(host);
  return mascots[name];
}

let anna = null;
let prefs = {};
let summary = null;

// Current plan + session state
let plan = null; // {pattern, seconds, title, opening, cues, why, planSource}
let context = "";
let soundMode = "off";
let clock = null;
let tracker = null;
let paceIdx = 1;
let timer = null;
let finishing = false;
let lastPhase = null;
let chime = null;
let voice = null;
let toastTimer = null;

async function connectAnna() {
  try {
    const { AnnaAppRuntime } = await import(SDK_URL);
    const rt = await AnnaAppRuntime.connect();
    try {
      await rt.window.set_title({ title: "Brume Reset" });
    } catch {
      /* cosmetic only */
    }
    return rt;
  } catch {
    return null; // standalone preview: no host
  }
}

function fmtSeconds(total) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const SCREEN_MASCOT = {
  home: { el: "home", state: "idle" },
  planning: { el: "planning", state: "thinking" },
  checkin: { el: "checkin", state: "idle" },
  result: { el: "result", state: "proud" },
};

function show(screen) {
  for (const el of Object.values(els.screens)) el.hidden = el !== screen;
  for (const [key, conf] of Object.entries(SCREEN_MASCOT)) {
    const s = els.screens[key];
    if (s === screen) mascot(conf.el)?.setState(conf.state);
  }
}

function toast(msg, ms = 5000) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, ms);
}

function haptic() {
  try {
    anna?.mobile?.haptics?.({ type: "impact", style: "light" }).catch(() => {});
  } catch {
    /* fire-and-forget; unsupported_container on desktop */
  }
}

function now() {
  return performance.timeOrigin + performance.now();
}

// --- Home -----------------------------------------------------------------

async function refreshHomeMeta() {
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
  if (els.worked) {
    const line = summaryLine(summary);
    if (line) {
      els.worked.textContent = `What's worked: ${line}`;
      els.worked.hidden = false;
    }
  }
}

// --- Planning ---------------------------------------------------------------

let planningToken = 0;

async function startPlanning() {
  context = els.contextInput.value.trim().slice(0, 200);
  const token = ++planningToken;
  show(els.screens.planning);
  const { plan: p, offline } = await fetchPlan(anna, { context, summary });
  if (token !== planningToken) return; // user skipped
  p.offline = offline;
  showPlan(p);
}

function quickPlan() {
  context = els.contextInput.value.trim().slice(0, 200);
  const p = fallbackPlan(context, "quick");
  p.seconds = 90;
  showPlan(p);
}

function markEdited() {
  if (plan && !plan.planSource.endsWith("+edited")) {
    plan.planSource += "+edited";
  }
}

function renderChips(container, entries, active, onPick) {
  container.innerHTML = "";
  for (const { value, label } of entries) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (value === active ? " active" : "");
    b.textContent = label;
    b.addEventListener("click", () => onPick(value));
    container.appendChild(b);
  }
}

function renderPlanControls() {
  renderChips(
    els.patternChips,
    Object.values(PATTERNS).map((p) => ({ value: p.id, label: p.name })),
    plan.pattern,
    (v) => {
      plan.pattern = v;
      markEdited();
      showPlan(plan);
    },
  );
  renderChips(
    els.lengthChips,
    ALLOWED_LENGTHS.map((s) => ({ value: s, label: fmtSeconds(s) })),
    plan.seconds,
    (v) => {
      plan.seconds = v;
      markEdited();
      showPlan(plan);
    },
  );
  for (const b of els.soundChips.querySelectorAll(".chip")) {
    b.classList.toggle("active", b.dataset.sound === soundMode);
  }
}

function showPlan(p) {
  plan = p;
  const pat = PATTERNS[plan.pattern];
  els.planTitle.textContent = plan.title;
  els.planRhythm.textContent = `${pat.name} · ${pat.rhythm}`;
  els.planLength.textContent = `${fmtSeconds(plan.seconds)} total`;
  els.planOpening.textContent = plan.opening;
  els.planWhy.textContent = plan.why;
  els.planOffline.hidden = !plan.offline;
  renderPlanControls();
  show(els.screens.plan);
}

// --- Session ------------------------------------------------------------------

// Whole-cycle snapping shared with the chat path: the session always
// ends at the end of a full cycle, so timer target, cycle counter,
// summary cycles and chat count lines all agree.
function effectiveLength() {
  return effectiveLengthSeconds(plan.pattern, plan.seconds);
}

function totalCycles() {
  return effectiveLength().cycles;
}

function updateBreathDot(snap) {
  if (REDUCED_MOTION || !els.dot) return;
  // Inhale grows 0.75 → 1.15, topup nudges a bit further, exhale
  // shrinks back; holds stay put.
  const t = snap.phaseProgress / 100;
  let scale = 0.75;
  if (snap.currentPhase === "inhale") scale = 0.75 + 0.4 * t;
  else if (snap.currentPhase === "topup") scale = 1.15 + 0.05 * t;
  else if (snap.currentPhase === "exhale") scale = 1.2 - 0.45 * t;
  else scale = snap.currentPhase === "pause" ? 0.75 : 1.15;
  els.dot.style.transform = `scale(${scale.toFixed(3)})`;
}

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
  tracker = setTempo(tracker, clock, now(), PACE_TEMPO[PACE_LEVELS[paceIdx]]);
  updatePaceUI();
}

function phaseSound(phase) {
  if (soundMode === "voice" && voice && !voice.failed) {
    voice.play(phaseWord(plan.pattern, phase));
  } else if (soundMode === "chime" && chime) {
    chime.play(phase);
  }
}

function updateCue(duration) {
  const cues = plan.cues || [];
  if (!cues.length) {
    els.cue.textContent = "";
    return;
  }
  // Rotate through cues at even fractions of the planned session.
  const slot = Math.max(1, Math.floor(plan.seconds / cues.length));
  els.cue.textContent = cues[Math.min(cues.length - 1, Math.floor(duration / slot))];
}

function tick() {
  if (!clock) return;
  tracker = syncTempoTracker(tracker, clock, now());
  const pat = PATTERNS[plan.pattern];
  const snap = sampleSessionTimingWithTempo(clock, tracker, pat, now());
  els.phase.textContent = isClockRunning(clock)
    ? phaseWord(plan.pattern, snap.currentPhase)
    : "Paused";
  const m = mascot("session");
  if (m) {
    m.setState(isClockRunning(clock) ? snap.currentPhase : "idle");
    m.setBreath(snap.phaseProgress / 100);
  }
  if (snap.currentPhase !== lastPhase) {
    lastPhase = snap.currentPhase;
    if (isClockRunning(clock)) {
      haptic();
      phaseSound(snap.currentPhase);
    }
  }
  els.elapsed.textContent = fmtSeconds(snap.duration);
  const total = totalCycles();
  els.cycle.textContent = `Cycle ${Math.min(snap.cycleCount + 1, total)} of ${total}`;
  updateCue(snap.duration);
  updateBreathDot(snap);
  if (snap.duration >= effectiveLength().effectiveSeconds) finish(false);
}

// Prefetch the opening line + every phase word the pattern uses, so
// playback is instant at each phase change. Failures degrade to chime.
async function primeVoice() {
  if (soundMode !== "voice" || !anna) return;
  chime.ensureContext();
  if (!voice) voice = new VoiceGuide(anna, chime);
  try {
    await voice.init();
    const pat = PATTERNS[plan.pattern];
    const texts = new Set([plan.opening]);
    for (const [key, label] of [
      ["inhale", "inhale"],
      ["topup", "topup"],
      ["hold", "hold"],
      ["exhale", "exhale"],
      ["holdAfterExhale", "pause"],
    ]) {
      if (pat[key] > 0) texts.add(phaseWord(plan.pattern, label));
    }
    for (const t of texts) voice.speakBuffer(t).catch(() => {});
  } catch (e) {
    if (!(e instanceof VoiceUnavailable)) {
      /* unexpected errors degrade the same way */
    }
    soundMode = "chime";
    renderPlanControls();
    toast(
      "Voice needs audio enabled for Brume in Anna settings — using chime.",
      7000,
    );
  }
}

async function begin() {
  finishing = false;
  lastPhase = null;
  clock = resumeSessionClock(createSessionClock(), now());
  tracker = createTempoTracker();
  paceIdx = 1;
  els.pause.textContent = "Pause";
  els.sessionPattern.textContent = `${PATTERNS[plan.pattern].name} · ${plan.title}`;
  els.target.textContent = fmtSeconds(effectiveLength().effectiveSeconds);
  updatePaceUI();
  // Audio must start inside this click handler (autoplay policy).
  if (soundMode === "chime" && chime) chime.ensureContext();
  if (soundMode === "voice") primeVoice(); // async; session starts meanwhile
  show(els.screens.session);
  tick();
  timer = setInterval(tick, TICK_MS);
}

// --- Check-in + Result -----------------------------------------------------------

let pendingResult = null;

function finish(interrupted) {
  if (finishing) return;
  finishing = true;
  clearInterval(timer);
  timer = null;
  const pat = PATTERNS[plan.pattern];
  const snap = clock
    ? sampleSessionTimingWithTempo(clock, tracker, pat, now())
    : { duration: 0, cycleCount: 0 };
  pendingResult = {
    activeSeconds: snap.duration,
    cycles: snap.cycleCount,
    interrupted,
  };
  clock = null;
  tracker = null;
  updatePaceUI();
  if (pendingResult.activeSeconds >= 1) {
    show(els.screens.checkin);
  } else {
    completeResult(null);
  }
}

async function completeResult(felt) {
  const { activeSeconds, cycles, interrupted } = pendingResult;
  const qualifies = activeSeconds >= 1;
  const pat = PATTERNS[plan.pattern];

  // The reflection call is what makes the run server-observable. It is
  // raced against a ~6s cap inside fetchReflection and never throws; the
  // line swaps in when the model answers.
  const reflectionPromise = qualifies
    ? fetchReflection(anna, {
        context,
        patternName: pat.name,
        activeSeconds,
        plannedSeconds: plan.seconds,
        effectiveSeconds: effectiveLength().effectiveSeconds,
        cycles,
        interrupted,
        felt,
      })
    : Promise.resolve(null);

  els.resultHeading.textContent = interrupted ? "Ended early" : "Reset complete";
  mascot("result")?.setState(interrupted ? "idle" : "proud");
  els.resultPattern.textContent = pat.name;
  els.resultTime.textContent = `${activeSeconds} second${activeSeconds === 1 ? "" : "s"}`;
  els.resultCycles.textContent = String(cycles);
  els.closingLine.textContent = FALLBACK_REFLECTION; // provisional
  els.closingLine.hidden = !qualifies;
  els.saveNote.hidden = true;
  show(els.screens.result);

  if (!qualifies) {
    els.saveNote.textContent = "Under one active second — nothing was saved.";
    els.saveNote.hidden = false;
    return;
  }

  const reflection = (await reflectionPromise) || FALLBACK_REFLECTION;
  els.closingLine.textContent = reflection;

  if (!anna) {
    els.saveNote.textContent = "Not connected to Anna — nothing was saved.";
    els.saveNote.hidden = false;
    return;
  }
  try {
    const record = buildCompletionRecord({
      context,
      pattern: plan.pattern,
      plannedSeconds: plan.seconds,
      activeSeconds,
      cycles,
      interrupted,
      felt,
      planSource: plan.planSource,
      reflection,
      source: "app",
      now: Date.now(),
    });
    await saveCompletionRecord(anna, record);
    summary = await loadSummary(anna);
  } catch {
    els.saveNote.textContent =
      "Couldn't save this session — the result above still stands.";
    els.saveNote.hidden = false;
  }
}

// --- entry_payload ------------------------------------------------------------

function applyEntryPayload(payload) {
  if (!payload || typeof payload !== "object") return;
  const ctx = typeof payload.context === "string" ? payload.context : "";
  if (!ctx) return;
  els.contextInput.value = ctx.slice(0, 200);
  // Auto-run planning (never auto-start the session itself).
  startPlanning();
}

// --- Boot -------------------------------------------------------------------------

async function main() {
  anna = await connectAnna();
  if (anna) {
    [summary, prefs] = await Promise.all([
      loadSummary(anna),
      loadPrefs(anna),
    ]);
  }
  if (SOUND_MODES.includes(prefs.sound)) soundMode = prefs.sound;
  chime = new ChimePlayer();

  for (const b of document.querySelectorAll("[data-context]")) {
    b.addEventListener("click", () => {
      els.contextInput.value = b.dataset.context;
      els.contextInput.focus();
    });
  }
  els.btnPlan.addEventListener("click", startPlanning);
  els.contextInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") startPlanning();
  });
  els.btnQuick.addEventListener("click", quickPlan);
  els.btnSkipPlan.addEventListener("click", () => {
    planningToken += 1;
    const p = fallbackPlan(context);
    p.offline = true;
    showPlan(p);
  });
  for (const b of els.soundChips.querySelectorAll(".chip")) {
    b.addEventListener("click", () => {
      soundMode = b.dataset.sound;
      renderPlanControls();
      prefs = { ...prefs, sound: soundMode };
      if (anna) savePrefs(anna, prefs).catch(() => {});
    });
  }
  els.begin.addEventListener("click", begin);
  els.again.addEventListener("click", () => {
    refreshHomeMeta();
    show(els.screens.home);
  });
  els.end.addEventListener("click", () => finish(true));
  els.slower.addEventListener("click", () => setPaceLevel(paceIdx - 1));
  els.faster.addEventListener("click", () => setPaceLevel(paceIdx + 1));
  for (const b of document.querySelectorAll("[data-felt]")) {
    b.addEventListener("click", () => completeResult(b.dataset.felt || null));
  }
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

  // entry_payload: initial value, then live pushes when the assistant
  // re-invokes open_app_view with a payload.
  try {
    if (anna?.entryPayload) applyEntryPayload(anna.entryPayload);
    if (typeof anna?.on === "function") {
      anna.on("entry_payload", (payload) => applyEntryPayload(payload));
    }
  } catch {
    /* payload wiring is best-effort */
  }

  refreshHomeMeta();
}

main();
