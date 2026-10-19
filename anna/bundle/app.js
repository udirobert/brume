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
  cleanText,
  cleanReflection,
  HEALTH_CLAIM_RE,
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
  responseText,
} from "./session.js";
import { ChimePlayer, VoiceGuide, VoiceUnavailable } from "./audio.js";
import { createMascot } from "./mascot.js";
import {
  runAlertness, baselineMedian, bandFor, updateAlertSummary,
  alertnessNotePrompt, ALERTNESS_FALLBACK_NOTE, CHECK_SECONDS,
  alertHeading,
} from "./alertness.js";

const SDK_URL = "/static/anna-apps/_sdk/latest/index.js";
const TICK_MS = 200;
const REDUCED_MOTION =
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = (sel) => document.querySelector(sel);

const els = {
  btnReady: $("#btn-ready"),
  btnAlertness: $("#btn-alertness"),
  alertLine: $("#alert-line"),
  alertSpark: $("#alert-spark"),
  kssRow: $("#kss-row"),
  kssHint: $("#kss-hint"),
  alertTarget: $("#alert-target"),
  alertWait: $("#alert-wait"),
  alertMs: $("#alert-ms"),
  alertMsg: $("#alert-msg"),
  alertProgress: $("#alert-progress"),
  alertBand: $("#alert-band"),
  alertMedian: $("#alert-median"),
  alertLapses: $("#alert-lapses"),
  alertTrials: $("#alert-trials"),
  alertNote: $("#alert-note"),
  alertBaselineNote: $("#alert-baseline-note"),
  readyEvent: $("#ready-event"),
  readyPoint: $("#ready-point"),
  readyKindChips: $("#ready-kind-chips"),
  readyStepLabel: $("#ready-step-label"),
  readyStepTitle: $("#ready-step-title"),
  readyStepText: $("#ready-step-text"),
  readyRehearse: $("#ready-rehearse"),
  readyOpener: $("#ready-opener"),
  readyKeypoint: $("#ready-keypoint"),
  readyReminder: $("#ready-reminder"),
  readyTimer: $("#ready-timer"),
  readyDots: $("#ready-dots"),
  btnHear: $("#btn-hear"),
  readyDoneOpener: $("#ready-done-opener"),
  readyDoneKeypoint: $("#ready-done-keypoint"),
  screens: {
    home: $("#screen-home"),
    planning: $("#screen-planning"),
    plan: $("#screen-plan"),
    session: $("#screen-session"),
    checkin: $("#screen-checkin"),
    result: $("#screen-result"),
    alert: $("#screen-alert"),
    alertTest: $("#screen-alert-test"),
    alertResult: $("#screen-alert-result"),
    ready: $("#screen-ready"),
    readyRun: $("#screen-ready-run"),
    readyDone: $("#screen-ready-done"),
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
  alert: { el: "alert", state: "idle" },
  alertTest: { el: "alert-test", state: "watching" },
  alertResult: { el: "alert-result", state: "bright" },
  ready: { el: "ready", state: "idle" },
  readyRun: { el: "ready-run", state: "idle" },
  readyDone: { el: "ready-done", state: "proud" },
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
  const mode = payload.mode || "reset";
  if (mode === "ready") {
    els.readyEvent.value = ctx.slice(0, 200);
    if (typeof payload.key_point === "string" && payload.key_point)
      els.readyPoint.value = payload.key_point.slice(0, 200);
    show(els.screens.ready);
    readyKindChips();
    return;
  }
  if (mode === "alertness") {
    buildKssRow();
    show(els.screens.alert);
    return;
  }
  if (!ctx) return;
  els.contextInput.value = ctx.slice(0, 200);
  // Auto-run planning (never auto-start the session itself).
  startPlanning();
}

// --- Boot -------------------------------------------------------------------------

// --- Alertness check -----------------------------------------------------

const KSS_LABELS = {
  1: "Extremely alert", 3: "Alert", 5: "Neither alert nor sleepy",
  7: "Sleepy, but no effort to stay awake", 9: "Very sleepy, fighting sleep",
};
let alertKss = null;
let alertRun = null;

function buildKssRow() {
  if (els.kssRow.childElementCount) return;
  for (let i = 1; i <= 9; i += 1) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = String(i);
    b.setAttribute("aria-label", KSS_LABELS[i] ? `${i} — ${KSS_LABELS[i]}` : String(i));
    b.addEventListener("click", () => {
      alertKss = i;
      els.kssRow.querySelectorAll("button").forEach((x) => x.classList.remove("selected"));
      b.classList.add("selected");
      els.kssHint.textContent = KSS_LABELS[i] || "";
    });
    els.kssRow.appendChild(b);
  }
}

async function alertChecks() {
  if (!anna?.storage?.list) return [];
  try {
    const res = await anna.storage.list({ prefix: "alert/checks/", scope: "user" });
    const keys = res.keys || res.items || [];
    const out = [];
    for (const k of keys.slice(0, 12)) {
      const v = await anna.storage.get({ key: k.key ?? k, scope: "user" });
      const rec = v?.value ?? v;
      if (rec && rec.medianMs) out.push(rec);
    }
    return out.sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
  } catch {
    return [];
  }
}

async function refreshAlertLine() {
  const checks = await alertChecks();
  if (!checks.length) return;
  const last = checks[0];
  els.alertLine.textContent = `Alertness: ${last.medianMs} ms${last.band ? ` · ${last.band}` : ""}`;
  els.alertLine.hidden = false;
  const recent = checks.slice(0, 7).reverse();
  if (recent.length >= 2 && els.alertSpark) {
    const c = els.alertSpark.getContext("2d");
    const max = Math.max(...recent.map((x) => x.medianMs));
    const min = Math.min(...recent.map((x) => x.medianMs));
    const range = Math.max(1, max - min);
    c.clearRect(0, 0, 140, 24);
    c.strokeStyle = "#5b8a72"; c.lineWidth = 1.5; c.beginPath();
    recent.forEach((x, i) => {
      const px = (i / (recent.length - 1)) * 130 + 5;
      const py = 20 - ((x.medianMs - min) / range) * 16;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    });
    c.stroke();
    els.alertSpark.hidden = false;
  }
}

function startAlertTest() {
  show(els.screens.alertTest);
  mascot("alert-test")?.setState("watching");
  els.alertWait.textContent = "Wait for the counter…";
  els.alertWait.hidden = false;
  els.alertMs.hidden = true;
  els.alertMsg.hidden = true;
  let rtAnim = null;
  let onsetNow = 0;

  const run = runAlertness({
    onStimulus: () => {
      els.alertWait.hidden = true;
      els.alertMsg.hidden = true;
      els.alertMs.hidden = false;
      onsetNow = performance.now();
      const step = () => {
        els.alertMs.textContent = String(Math.max(0, Math.round(performance.now() - onsetNow)));
        rtAnim = requestAnimationFrame(step);
      };
      rtAnim = requestAnimationFrame(step);
    },
    onResult: (metrics) => finishAlert(metrics),
    isCancelled: () => els.screens.alertTest.hidden,
  });
  alertRun = run;

  function respond(itype) {
    if (!run.awaiting()) return;
    const rt = performance.now() - onsetNow;
    cancelAnimationFrame(rtAnim);
    els.alertMs.hidden = true;
    if (rt < 100) {
      els.alertMsg.textContent = "Too soon";
      els.alertMsg.hidden = false;
      els.alertWait.hidden = true;
    } else {
      els.alertMsg.textContent = `${Math.round(rt)} ms`;
      els.alertMsg.hidden = false;
      els.alertWait.hidden = true;
    }
    run.respond(itype, rt);
  }

  const onPointer = (e) => respond(e.pointerType === "touch" ? "touch" : "mouse");
  const onKey = (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); respond("keyboard"); } };
  els.alertTarget.addEventListener("pointerdown", onPointer);
  els.alertTarget.addEventListener("keydown", onKey);
  const t0 = performance.now();
  const prog = setInterval(() => {
    const left = Math.max(0, CHECK_SECONDS - (performance.now() - t0) / 1000);
    els.alertProgress.textContent = `${Math.ceil(left)}s left`;
    const fill = document.getElementById("alert-bar-fill");
    if (fill) fill.style.width = `${Math.min(100, (1 - left / CHECK_SECONDS) * 100)}%`;
    if (left <= 0 || els.screens.alertTest.hidden) clearInterval(prog);
  }, 500);
}

async function finishAlert(metrics) {
  const checks = await alertChecks();
  const baseline = baselineMedian(checks, metrics.inputType);
  const band = bandFor(metrics.medianMs, metrics.lapses, baseline);
  const kss = alertKss;
  const checkCount = checks.filter((c) => c.inputType === metrics.inputType).length + 1;
  const timeOfDay = new Date().toTimeString().slice(0, 5);
  let note = ALERTNESS_FALLBACK_NOTE, noteSource = "fallback";
  if (anna?.llm?.complete) {
    try {
      const res = await anna.llm.complete({
        messages: [{ role: "user", content: { type: "text",
          text: alertnessNotePrompt({ metrics, baseline, band, kss, checkCount, timeOfDay }) } }],
        maxTokens: 120,
      });
      const t = cleanReflection(responseText(res));
      if (t !== "Take a moment before you begin again.") { note = t; noteSource = "ai"; }
    } catch { /* fallback */ }
  }
  const record = {
    completedAt: new Date().toISOString(), durationSec: CHECK_SECONDS,
    trials: metrics.trials, medianMs: metrics.medianMs,
    meanSpeed: metrics.meanSpeed, lapses: metrics.lapses,
    falseStarts: metrics.falseStarts, inputType: metrics.inputType,
    kss, band, baselineMs: baseline, note, noteSource,
  };
  try {
    await anna.storage.set({ key: `alert/checks/${record.completedAt}`, value: record, scope: "user" });
    const prev = await anna.storage.get({ key: "alert/summary", scope: "user" }).catch(() => null);
    await anna.storage.set({ key: "alert/summary", value: updateAlertSummary(prev?.value ?? prev, record), scope: "user" });
  } catch { /* storage optional */ }
  show(els.screens.alertResult);
  els.alertBand.textContent = alertHeading(band, baseline, checkCount);
  els.alertMedian.textContent = `${metrics.medianMs} ms`;
  els.alertLapses.textContent = `${metrics.lapses} of ${metrics.trials}`;
  els.alertTrials.textContent = `${metrics.trials} (${metrics.falseStarts} false start${metrics.falseStarts === 1 ? "" : "s"})`;
  // The heading already carries the baseline-building message — never
  // repeat it in the note line below.
  els.alertBaselineNote.hidden = true;
  els.alertNote.textContent = note;
  const m = mascot("alert-result");
  if (m) m.setState(kss >= 7 || band === "much slower than usual" ? "sleepy" : band === "sharper than usual" ? "bright" : "idle");
}

// --- Get ready ------------------------------------------------------------

let readyPlan = null;
let readyStep = 0;
let readyTimerId = null;
let readyT0 = 0;

const READY_STEPS = [
  { key: "breathe", label: "Step 1 of 4", title: "Breathe", state: "inhale",
    text: "Two short sips of air through the nose, then one long, slow breath out. About a minute.", secs: 63 },
  { key: "open", label: "Step 2 of 4", title: "Open up", state: "stretch",
    text: "Sit or stand tall and roll your shoulders back. If you have room, raise your arms overhead in a wide V and hold for a few breaths, then let them float down.", secs: 30 },
  { key: "hum", label: "Step 3 of 4", title: "Warm up your voice", state: "hum",
    text: "With your lips closed, hum gently on a comfortable note. Then glide the hum up and down like a slow siren, a few times.", secs: 30 },
  { key: "rehearse", label: "Step 4 of 4", title: "Rehearse", state: "idle",
    text: "Say your opening line out loud, twice, at an easy pace:", secs: 0 },
];

const READY_PROMPT = (event, kind, point) => `You help someone get ready in the few minutes before an important moment at work.
What's coming up: "${event || "not given"}"
Kind: ${kind || "not given"}
The one thing they want the other person to remember, in their words: "${point || "not given"}"
Reply with ONLY a JSON object, no prose and no code fences:
{"title": up to 6 words naming this prep, "opener": one natural opening sentence they could say, in their own voice (max 30 words), "key_point": their main point rewritten to be clear and memorable (max 20 words; if they gave none, infer a sensible one from what is coming up), "reminder": one short practical reminder for the moment itself (max 14 words, for example about pausing or listening)}
Keep it specific to what they said. Do not invent facts about them, make no medical or health claims, and do not use emoji.`;

const READY_KINDS = [
  ["interview", "Interview"], ["presentation", "Presentation"],
  ["hard-conversation", "Hard conversation"], ["meeting", "Meeting"],
];
let readyKind = null;

function readyKindChips() {
  if (els.readyKindChips.childElementCount) return;
  for (const [id, label] of READY_KINDS) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = label;
    b.addEventListener("click", () => {
      readyKind = id;
      els.readyKindChips.querySelectorAll("button").forEach((x) => x.classList.remove("selected"));
      b.classList.add("selected");
    });
    els.readyKindChips.appendChild(b);
  }
}

async function prepareReady() {
  const event = els.readyEvent.value.trim().slice(0, 200);
  const point = els.readyPoint.value.trim().slice(0, 200);
  readyPlan = { event, kind: readyKind, opener: "", keyPoint: point, reminder: "Pause before you answer.", planSource: "fallback", title: "Get ready" };
  if (anna?.llm?.complete) {
    try {
      const res = await anna.llm.complete({
        messages: [{ role: "user", content: { type: "text", text: READY_PROMPT(event, readyKind, point) } }],
        maxTokens: 300,
      });
      const raw = responseText(res);
      const i = raw.indexOf("{"), j = raw.lastIndexOf("}");
      if (i >= 0 && j > i) {
        const p = JSON.parse(raw.slice(i, j + 1));
        readyPlan.opener = cleanText(p.opener, 220);
        readyPlan.keyPoint = cleanText(p.key_point, 160) || point;
        readyPlan.reminder = cleanText(p.reminder, 110) || readyPlan.reminder;
        readyPlan.title = cleanText(p.title, 60) || readyPlan.title;
        readyPlan.planSource = "ai";
        if (HEALTH_CLAIM_RE.test(readyPlan.opener)) readyPlan.opener = "";
        if (HEALTH_CLAIM_RE.test(readyPlan.keyPoint)) readyPlan.keyPoint = point;
        if (HEALTH_CLAIM_RE.test(readyPlan.reminder)) readyPlan.reminder = "Pause before you answer.";
      }
    } catch { /* fallback */ }
  }
  readyStep = 0;
  runReadyStep();
}

function renderReadyDots() {
  els.readyDots.innerHTML = "";
  READY_STEPS.forEach((_, i) => {
    const d = document.createElement("span");
    if (i <= readyStep) d.classList.add("on");
    els.readyDots.appendChild(d);
  });
}

function runReadyStep() {
  const step = READY_STEPS[readyStep];
  show(els.screens.readyRun);
  mascot("ready-run")?.setState(step.state);
  els.readyStepLabel.textContent = step.label;
  els.readyStepTitle.textContent = step.title;
  els.readyStepText.textContent = step.text;
  els.readyRehearse.hidden = step.key !== "rehearse";
  renderReadyDots();
  if (step.key === "rehearse") {
    els.readyOpener.textContent = readyPlan.opener || "(say it your way — the main thing first)";
    els.readyKeypoint.textContent = readyPlan.keyPoint || "Your one clear point.";
    els.readyReminder.textContent = readyPlan.reminder;
    els.btnHear.hidden = soundMode !== "voice";
    els.readyTimer.textContent = "";
  }
  clearInterval(readyTimerId);
  if (step.secs) {
    let left = step.secs;
    readyT0 = performance.now();
    readyTimerId = setInterval(() => {
      left = Math.max(0, Math.round(step.secs - (performance.now() - readyT0) / 1000));
      els.readyTimer.textContent = `${left}s`;
      if (step.key === "breathe") {
        // Real cyclic-sigh guidance: phase word + Cycle N of 7 +
        // "0:12 / 1:03" timer, driven by the same clock math as a reset.
        const t = (performance.now() - readyT0) / 1000;
        const ph = t % 9;
        const cyc = Math.min(7, Math.floor(t / 9) + 1);
        const state = ph < 2 ? "inhale" : ph < 3 ? "topup" : "exhale";
        const word = { inhale: "Breathe in", topup: "Top up", exhale: "Breathe out" }[state];
        mascot("ready-run")?.setState(state);
        mascot("ready-run")?.setBreath(ph < 3 ? ph / 3 : Math.max(0, 1 - (ph - 3) / 6));
        els.readyTimer.textContent =
          `${word} · Cycle ${cyc} of 7 · ${fmtSeconds(Math.floor(t))} / 1:03`;
      }
      if (left <= 0) { clearInterval(readyTimerId); nextReadyStep(); }
    }, 250);
  } else {
    els.readyTimer.textContent = "";
  }
}

function nextReadyStep() {
  clearInterval(readyTimerId);
  readyStep += 1;
  if (readyStep >= READY_STEPS.length) return finishReady();
  runReadyStep();
}

async function finishReady() {
  show(els.screens.readyDone);
  els.readyDoneOpener.textContent = readyPlan.opener || "";
  els.readyDoneKeypoint.textContent = readyPlan.keyPoint || "";
  try {
    await anna?.storage?.set({
      key: `ready/sessions/${new Date().toISOString()}`,
      value: {
        completedAt: new Date().toISOString(), event: readyPlan.event,
        kind: readyPlan.kind, opener: readyPlan.opener,
        key_point: readyPlan.keyPoint, reminder: readyPlan.reminder,
        planSource: readyPlan.planSource, stepsCompleted: readyStep + 1,
        source: "app",
      },
      scope: "user",
    });
  } catch { /* optional */ }
}

async function main() {
  anna = await connectAnna();
  try {
    const h = location.hostname;
    if (h === "localhost" || h === "127.0.0.1") window.__brumeAnna = anna;
  } catch { /* test hook */ }
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

  els.btnReady.addEventListener("click", () => {
    readyKindChips();
    show(els.screens.ready);
  });
  els.btnAlertness.addEventListener("click", () => {
    buildKssRow();
    alertKss = null;
    els.kssHint.textContent = "";
    els.kssRow.querySelectorAll("button").forEach((x) => x.classList.remove("selected"));
    show(els.screens.alert);
  });
  $("#btn-alert-start").addEventListener("click", () => {
    // 3-2-1 countdown then run
    let n = 3;
    show(els.screens.alertTest);
    els.alertWait.textContent = String(n);
    const cd = setInterval(() => {
      n -= 1;
      if (n <= 0) { clearInterval(cd); startAlertTest(); return; }
      els.alertWait.textContent = String(n);
    }, 1000);
  });
  $("#btn-alert-skip-kss").addEventListener("click", () => {
    alertKss = null;
    $("#btn-alert-start").click();
  });
  $("#btn-alert-cancel").addEventListener("click", () => {
    alertRun?.stop?.();
    show(els.screens.home);
  });
  $("#btn-alert-break").addEventListener("click", () => {
    const kss = alertKss ? `${alertKss}/9` : "not given";
    els.contextInput.value = `Alertness check: ${els.alertBand.textContent || "done"}, sleepiness ${kss}`.slice(0, 200);
    show(els.screens.home);
    startPlanning();
  });
  $("#btn-alert-done").addEventListener("click", () => show(els.screens.home));
  $("#btn-prepare").addEventListener("click", prepareReady);
  els.readyEvent.addEventListener("keydown", (e) => { if (e.key === "Enter") prepareReady(); });
  $("#btn-ready-next").addEventListener("click", nextReadyStep);
  $("#btn-ready-skip").addEventListener("click", nextReadyStep);
  let readyPaused = false;
  let readyT0Adjust = 0;
  $("#btn-ready-pause").addEventListener("click", () => {
    if (!readyPaused) {
      readyPaused = true;
      clearInterval(readyTimerId);
      readyTimerId = null;
      readyT0Adjust = performance.now();
      $("#btn-ready-pause").textContent = "Resume";
    } else {
      readyPaused = false;
      readyT0 += performance.now() - readyT0Adjust;
      $("#btn-ready-pause").textContent = "Pause";
      runReadyStep();
    }
  });
  els.btnHear.addEventListener("click", () => {
    if (readyPlan?.opener && voice) voice.play(readyPlan.opener);
  });
  $("#btn-ready-again").addEventListener("click", () => {
    refreshAlertLine();
    show(els.screens.home);
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
  refreshAlertLine();
  // The home screen is visible before any show() call — create its
  // mascot (and any other already-visible screen's) explicitly.
  for (const [key, conf] of Object.entries(SCREEN_MASCOT)) {
    if (!els.screens[key].hidden) mascot(conf.el)?.setState(conf.state);
  }
}

main();
