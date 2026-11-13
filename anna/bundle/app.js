// Brume Reset — Anna App bundle entry.
// AI-planned guided breathing break: Home → Planning → Plan → Session →
// Check-in → Result. Talks to the host only via the AnnaAppRuntime SDK
// (storage, llm.complete/catalog, audio.speak, mobile.haptics).

import {
  createSessionClock,
  pauseSessionClock,
  resumeSessionClock,
  isClockRunning,
  readSessionElapsedMs,
  createTempoTracker,
  syncTempoTracker,
  setTempo,
  sampleSessionTimingWithTempo,
} from "./timing.js";
import {
  PATTERNS,
  ALLOWED_LENGTHS,
  fallbackPlan,
  effectiveLengthSeconds,
  phaseWord,
  cleanReflection,
  summarizeHistory,
  preparationMemoryLine,
} from "./plan.js";
import {
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
  fetchInvite,
  lastReflectionModel,
  FALLBACK_REFLECTION,
  responseText,
  unwrapHostResponse,
  storageValue,
  withTimeout,
} from "./session.js";
import { ChimePlayer, VoiceGuide, VoiceUnavailable } from "./audio.js";
import { createMascot } from "./mascot.js";
import { breathAmount } from "./mascot-engine.js";
import {
  runAlertness, baselineMedian, bandFor, updateAlertSummary,
  alertnessNotePrompt, ALERTNESS_FALLBACK_NOTE, CHECK_SECONDS,
  alertHeading,
} from "./alertness.js";
import {
  requestPreparation,
  requestRehearsal,
  faithfulnessIssues,
  withholdUngrounded,
  faithfulnessMessage,
  preparationSource,
  rehearsalSource,
  PLAN_FACT_FIELDS,
  REHEARSAL_FACT_FIELDS,
  groundedSpans,
  scheduleQuestion,
  scheduleDay,
  maskFacts,
  CARD_FACT_FIELDS,
  quotesReply,
  sayableParagraph,
} from "./preparation.js";
import { createCheckpointStore } from "./recovery.js";
import { MOMENTS, normaliseWordingStyle, parseReadyHandoff } from "./experience.js";
import { loadWordingPreference, saveWordingPreference } from "./ready-preferences.js";
import {
  FEELINGS,
  ACTS,
  feelingById,
  actFor,
  inviteFallback,
  createScatter,
  createSetdown,
} from "./arrive.js";

const SDK_URL = "/static/anna-apps/_sdk/latest/index.js";
const TICK_MS = 200;
const TASK_TICK_EVERY = 5;
const STEP_SNAPSHOT_EVERY = 4;
const REDUCED_MOTION =
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = (sel) => document.querySelector(sel);

const els = {
  btnReady: $("#btn-ready"),
  btnLastPrep: $("#btn-last-prep"),
  lastPrepSub: $("#last-prep-sub"),
  btnAlertness: $("#btn-alertness"),
  alertLine: $("#alert-line"),
  alertSpark: $("#alert-spark"),
  taskBanner: $("#task-banner"),
  taskBannerText: $("#task-banner-text"),
  btnTaskResume: $("#btn-task-resume"),
  btnTaskKeep: $("#btn-task-keep"),
  btnTaskReplace: $("#btn-task-replace"),
  btnTaskDiscard: $("#btn-task-discard"),
  btnTaskRetry: $("#btn-task-retry"),
  taskStatus: $("#task-status"),
  btnHomeNav: $("#btn-home-nav"),
  alertInterruptNote: $("#alert-interrupt-note"),
  alertSaveNote: $("#alert-save-note"),
  btnAlertSaveRetry: $("#btn-alert-save-retry"),
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
  startupPanel: $("#startup-panel"),
  startupMessage: $("#startup-message"),
  btnStartupRetry: $("#btn-startup-retry"),
  startupHelp: $("#startup-help"),
  prepPreserve: $("#prep-preserve"),
  prepWordingBadge: $("#prep-wording-badge"),
  wordingSelect: $("#wording-select"),
  btnPrefSave: $("#btn-pref-save"),
  btnPrefForget: $("#btn-pref-forget"),
  prefStatus: $("#pref-status"),
  btnPrefRetry: $("#btn-pref-retry"),
  prefDetails: $("#pref-details"),
  cardPrefSlot: $("#card-pref-slot"),
  homeScreen: $("#screen-home"),
  prepEvent: $("#prep-event"),
  prepGoal: $("#prep-goal"),
  prepKeypoint: $("#prep-keypoint"),
  prepKindChips: $("#prep-kind-chips"),
  prepQuestion: $("#prep-question"),
  prepClarification: $("#prep-clarification"),
  prepOpening: $("#prep-opening"),
  prepKeypointEdit: $("#prep-keypoint-edit"),
  prepApproach: $("#prep-approach"),
  prepObjection: $("#prep-objection"),
  prepResponse: $("#prep-response"),
  prepNextstep: $("#prep-nextstep"),
  prepPracticeObjection: $("#prep-practice-objection"),
  prepReply: $("#prep-reply"),
  prepAdjustment: $("#prep-adjustment"),
  prepFinalResponse: $("#prep-final-response"),
  prepFinalNextstep: $("#prep-final-nextstep"),
  prepCardTitle: $("#prep-card-title"),
  cardGoal: $("#card-goal"),
  cardOpening: $("#card-opening"),
  cardKeypoint: $("#card-keypoint"),
  cardApproach: $("#card-approach"),
  cardObjection: $("#card-objection"),
  cardResponse: $("#card-response"),
  cardNextstep: $("#card-nextstep"),
  cardAdjustment: $("#card-adjustment"),
  cardSayable: $("#card-sayable"),
  cardSource: $("#card-source"),
  cardSourceText: $("#card-source-text"),
  prepSourceNote: $("#prep-source-note"),
  prepSourceQuote: $("#prep-source-quote"),
  prepInterviewSource: $("#prep-interview-source"),
  prepInterviewQuote: $("#prep-interview-quote"),
  prepInterviewList: $("#prep-interview-list"),
  btnPrepInterviewGo: $("#btn-prep-interview-go"),
  btnPrepInterviewManual: $("#btn-prep-interview-manual"),
  btnPrepGo: $("#btn-prep-go"),
  cardSaveNote: $("#card-save-note"),
  btnCardSaveRetry: $("#btn-card-save-retry"),
  btnCardDone: $("#btn-card-done"),
  btnCardHome: $("#btn-card-home"),
  btnCardExport: $("#btn-card-export"),
  btnCardPrint: $("#btn-card-print"),
  btnArrive: $("#btn-arrive"),
  feelingRing: $("#feeling-ring"),
  arriveAct: $("#arrive-act"),
  arriveActName: $("#arrive-act-name"),
  arriveInvite: $("#arrive-invite"),
  btnArriveGo: $("#btn-arrive-go"),
  btnArriveBack: $("#btn-arrive-back"),
  scatterCanvas: $("#scatter-canvas"),
  scatterHint: $("#scatter-hint"),
  scatterControls: $("#scatter-controls"),
  btnScatterGo: $("#btn-scatter-go"),
  btnScatterBack: $("#btn-scatter-back"),
  scatterDone: $("#scatter-done"),
  btnScatterHome: $("#btn-scatter-home"),
  btnScatterAgain: $("#btn-scatter-again"),
  scatterEnd: $("#scatter-end"),
  setdownTrack: $("#setdown-track"),
  setdownWeight: $("#setdown-weight"),
  setdownHint: $("#setdown-hint"),
  setdownControls: $("#setdown-controls"),
  btnSetdownBack: $("#btn-setdown-back"),
  setdownDone: $("#setdown-done"),
  setdownEnd: $("#setdown-end"),
  btnSetdownHome: $("#btn-setdown-home"),
  btnSetdownAgain: $("#btn-setdown-again"),
  prepStatus: $("#prep-status"),
  prepStatusText: $("#prep-status-text"),
  btnPrepCancel: $("#btn-prep-cancel"),
  btnPrepRetry: $("#btn-prep-retry"),
  btnPrepAlt: $("#btn-prep-alt"),
  prepAltConfirm: $("#prep-alt-confirm"),
  btnPrepAltYes: $("#btn-prep-alt-yes"),
  btnPrepAltNo: $("#btn-prep-alt-no"),
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
    prepInput: $("#screen-prep-input"),
    prepClarify: $("#screen-prep-clarify"),
    prepInterview: $("#screen-prep-interview"),
    prepPlan: $("#screen-prep-plan"),
    prepPractice: $("#screen-prep-practice"),
    prepFeedback: $("#screen-prep-feedback"),
    prepCard: $("#screen-prep-card"),
    readyRun: $("#screen-ready-run"),
    arrive: $("#screen-arrive"),
    scatter: $("#screen-scatter"),
    setdown: $("#screen-setdown"),
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
  adjPatternVal: $("#adj-pattern-val"),
  adjLengthVal: $("#adj-length-val"),
  adjSoundVal: $("#adj-sound-val"),
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
  btnSaveRetry: $("#btn-save-retry"),
  btnReflectRetry: $("#btn-reflect-retry"),
  btnSaveAnyway: $("#btn-save-anyway"),
  lastSession: $("[data-last-session]"),
  worked: $("[data-worked]"),
  memoryLine: $("#memory-line"),
  toast: $("#toast"),
};

// Brume mascots — one sprite per screen, lazily created on first show.
const mascots = {};
function mascot(name) {
  const host = $(`#mascot-${name}`);
  if (!host) return null;
  if (!mascots[name]) mascots[name] = createMascot(host, { presence: "companion" });
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
let sessionWasRunning = false;
let tracker = null;
let paceIdx = 1;
let timer = null;
let finishing = false;
let lastPhase = null;
let chime = null;
let voice = null;
let toastTimer = null;
let tickCount = 0;
let stepTickCount = 0;
let selectedFelt = null;
let resultState = null;
let reflectionRequest = 0;

async function connectAnna() {
  try {
    const { AnnaAppRuntime } = await import(SDK_URL);
    const rt = await AnnaAppRuntime.connect();
    try {
      Promise.resolve(rt.window.set_title({ title: "Brume" })).catch(() => {});
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
  plan: { el: "plan", state: "idle" },
  checkin: { el: "checkin", state: "idle" },
  result: { el: "result", state: "proud" },
  alert: { el: "alert", state: "idle" },
  alertTest: { el: "alert-test", state: "watching" },
  alertResult: { el: "alert-result", state: "bright" },
  prepInput: { el: "prep-input", state: "idle" },
  prepClarify: { el: "prep-clarify", state: "thinking" },
  prepPlan: { el: "prep-plan", state: "idle" },
  prepPractice: { el: "prep-practice", state: "watching" },
  prepFeedback: { el: "prep-feedback", state: "thinking" },
  prepCard: { el: "prep-card", state: "proud" },
  readyRun: { el: "ready-run", state: "idle" },
  arrive: { el: "arrive", state: "tender" },
  scatter: { el: "scatter", state: "watching" },
  setdown: { el: "setdown", state: "tender" },
};

let scatterCtl = null;
let setdownCtl = null;
let setdownHintTimer = 0;

function leaveActScreens(screen) {
  if (screen !== els.screens.scatter && scatterCtl) {
    scatterCtl.destroy();
    scatterCtl = null;
    mascots.scatter?.setOptions({ lookAt: undefined, gaze: undefined });
  }
  if (screen !== els.screens.setdown && setdownCtl) {
    setdownCtl.destroy();
    setdownCtl = null;
    clearTimeout(setdownHintTimer);
    mascots.setdown?.setOptions({ lookAt: undefined });
  }
}

function show(screen) {
  leaveActScreens(screen);
  for (const el of Object.values(els.screens)) el.hidden = el !== screen;
  for (const [key, conf] of Object.entries(SCREEN_MASCOT)) {
    const s = els.screens[key];
    if (s === screen) mascot(conf.el)?.setState(conf.state);
  }
  if (screen === els.screens.home && els.prefDetails
      && els.prefDetails.parentElement !== els.homeScreen) {
    els.homeScreen.appendChild(els.prefDetails);
  }
  const h = screen?.querySelector?.("h1");
  if (h) {
    h.setAttribute("tabindex", "-1");
    h.focus({ preventScroll: true });
  }
  updateTaskBanner();
  updateHomeNav();
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

const FLOW_LABEL = {
  reset: "breathing break",
  ready: "preparation",
  alert: "alertness check",
};

let taskStore = null;
let task = null;
let taskGeneration = 0;
let taskTransition = false;
let pendingChoice = null;
let lastAppliedPayloadJson = null;
let bannerMode = null;

function invalidateTaskWork() {
  taskGeneration += 1;
  reflectionRequest += 1;
  planningToken += 1;
  prepGen += 1;
  clearInterval(timer); timer = null;
  clearInterval(readyTimerId); readyTimerId = null;
  clearTimeout(prepEditTimer); prepEditTimer = null;
  stopAlertRun();
}

function ownsTask(id, generation) {
  return task?.id === id && taskGeneration === generation;
}

function newTaskId() {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function saveTask(screen, data) {
  if (!task) return Promise.resolve(false);
  task = { ...task, screen, updatedAt: Date.now(), data };
  return taskStore?.save(task) ?? Promise.resolve(false);
}

function snapshotNow() {
  if (!task) return;
  if (task.flow === "reset") snapshotReset(task.screen);
  else if (task.flow === "ready") snapshotReady(task.screen);
  else if (task.flow === "alert") saveTask(task.screen, alertCheckpointData());
}

function pauseAndSnapshotCurrent() {
  if (!els.screens.session.hidden && clock && isClockRunning(clock)) {
    clock = pauseSessionClock(clock, now());
    els.pause.textContent = "Resume";
    updatePaceUI();
  }
  if (task?.flow === "ready" && task.screen === "pause") pauseReadyStep();
  if (!els.screens.alertTest.hidden) interruptAlertTest();
  else snapshotNow();
}

function beginTask(flow, screen, data) {
  invalidateTaskWork();
  resetFlowGlobals();
  task = {
    version: 1,
    id: newTaskId(),
    flow,
    screen,
    updatedAt: Date.now(),
    data,
  };
  taskStore?.save(task);
}

async function endTask() {
  if (taskTransition) return false;
  taskTransition = true;
  $("#root").inert = true;
  pauseAndSnapshotCurrent();
  invalidateTaskWork();
  const previous = task;
  const previousBanner = bannerMode;
  const ok = anna?.storage?.set ? await taskStore.clear() : true;
  if (ok) {
    task = null;
    bannerMode = null;
    pendingChoice = null;
    resetFlowGlobals();
  } else {
    task = previous;
    bannerMode = previousBanner;
    onTaskStatus("error");
  }
  taskTransition = false;
  $("#root").inert = false;
  updateTaskBanner();
  return ok;
}

const statusRetry = document.createElement("button");
statusRetry.type = "button";
statusRetry.className = "textlink";
statusRetry.textContent = "Retry";
statusRetry.hidden = true;
const statusText = document.createElement("span");
els.taskStatus.append(statusText, statusRetry);

function onTaskStatus(state) {
  const labels = {
    saving: "Saving…",
    saved: "Saved",
    error: "Couldn't save — keep this window open.",
    disconnected: "Not connected — nothing is being saved.",
  };
  if (!labels[state]) return;
  statusText.textContent = labels[state];
  statusRetry.hidden = state !== "error" && state !== "disconnected";
  els.taskStatus.hidden = false;
}

statusRetry.addEventListener("click", () => {
  if (taskStore?.clearFailed) {
    endTask();
  } else if (task) {
    snapshotNow();
  } else {
    taskStore?.retry();
  }
});

function updateTaskBanner() {
  const banner = els.taskBanner;
  const showBanner =
    pendingChoice || bannerMode === "error" || bannerMode === "corrupt"
    || (task && !els.screens.home.hidden);
  if (!showBanner) {
    banner.hidden = true;
    return;
  }
  banner.hidden = false;
  const t = els.taskBannerText;
  els.btnTaskResume.hidden = true;
  els.btnTaskKeep.hidden = true;
  els.btnTaskReplace.hidden = true;
  els.btnTaskDiscard.hidden = true;
  els.btnTaskRetry.hidden = true;
  if (bannerMode === "error") {
    t.textContent = "Couldn't check for a saved task.";
    els.btnTaskRetry.hidden = false;
    return;
  }
  if (bannerMode === "corrupt") {
    t.textContent = "There's a saved task we can't restore.";
    els.btnTaskDiscard.hidden = false;
    return;
  }
  if (pendingChoice) {
    t.textContent = `You have an unfinished ${FLOW_LABEL[task?.flow] || "task"}. Start something new instead?`;
    els.btnTaskKeep.hidden = false;
    els.btnTaskReplace.hidden = false;
    return;
  }
  t.textContent = `Unfinished ${FLOW_LABEL[task.flow] || "task"} — pick up where you left off?`;
  els.btnTaskResume.hidden = false;
  els.btnTaskDiscard.hidden = false;
}

let soundRevision = 0;
function loadBlocked() {
  return bootState !== "ready" || bannerMode === "error" || bannerMode === "corrupt" || taskTransition;
}

function requestNewTask(start) {
  if (loadBlocked()) {
    updateTaskBanner();
    return;
  }
  if (task) {
    pendingChoice = { start };
    updateTaskBanner();
    return;
  }
  start();
}

function resetFlowGlobals() {
  plan = null;
  context = "";
  clock = null;
  tracker = null;
  paceIdx = 1;
  finishing = false;
  lastPhase = null;
  pendingResult = null;
  selectedFelt = null;
  resultState = null;
  prep = newPrepState();
  alertKss = null;
  alertResultState = null;
  readyPlan = null;
  readyStep = 0;
  readyStepElapsed = 0;
  readyPaused = false;
  readyReturn = null;
  cardViewOnly = false;
}

els.btnTaskResume.addEventListener("click", () => {
  if (task) hydrateTask(task);
});
els.btnTaskDiscard.addEventListener("click", async () => {
  if (taskTransition) return;
  const ok = await endTask();
  if (ok) show(els.screens.home);
});
els.btnTaskRetry.addEventListener("click", async () => {
  if (bannerMode !== "error") return;
  els.btnTaskRetry.disabled = true;
  try {
    await loadActiveTask({ apply: true });
  } finally {
    els.btnTaskRetry.disabled = false;
    updateTaskBanner();
  }
});
els.btnTaskKeep.addEventListener("click", () => {
  pendingChoice = null;
  updateTaskBanner();
});
els.btnTaskReplace.addEventListener("click", async () => {
  if (taskTransition) return;
  const choice = pendingChoice;
  const ok = await endTask();
  if (!ok) return;
  if (choice?.start) choice.start();
  else if (choice?.payload) applyEntryPayload(choice.payload);
  else show(els.screens.home);
});
els.btnHomeNav.addEventListener("click", () => {
  if (taskTransition) return;
  pauseAndSnapshotCurrent();
  invalidateTaskWork();
  if (prep.busy) {
    prep.busy = null;
    prep.error = "That step was interrupted — retry when you're ready.";
    snapshotNow();
  }
  show(els.screens.home);
});

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
  if (anna?.storage?.get && els.btnLastPrep) {
    try {
      const v = storageValue(
        await anna.storage.get({ key: "ready/last", scope: "user" }),
      );
      const breath = document.getElementById("breathing-details");
      if (v && v.completedAt) {
        els.lastPrepSub.textContent = `${v.event ? v.event.slice(0, 60) : "Saved card"} · ${new Date(v.completedAt).toLocaleDateString()}`;
        els.btnLastPrep.hidden = false;
        if (breath) breath.hidden = false;
      } else if (breath) {
        breath.hidden = true;
      }
      // Memory as reflection (no scores, no streaks, no typed text): names a
      // kind of preparation that recurred, from the closed `kind` field only,
      // and stays hidden until one has.
      if (els.memoryLine) {
        try {
          const line = preparationMemoryLine(await loadReadySessions(anna));
          els.memoryLine.textContent = line || "";
          els.memoryLine.hidden = !line;
        } catch {
          els.memoryLine.hidden = true;
        }
      }
    } catch {}
  }
}

async function loadResetSessions(anna) {
  if (!anna?.storage?.list) return [];
  try {
    const res = unwrapHostResponse(
      await anna.storage.list({ prefix: "reset/sessions/", scope: "user" }),
    );
    const keys = res?.keys || res?.items || [];
    const out = [];
    for (const k of keys.slice(0, 40)) {
      const key = k?.key ?? k;
      try {
        const v = storageValue(await anna.storage.get({ key, scope: "user" }));
        if (v && typeof v === "object" && v.completedAt) out.push(v);
      } catch {}
    }
    return out.sort((a, b) => String(b.completedAt || "").localeCompare(String(a.completedAt || "")));
  } catch {
    return [];
  }
}

async function loadReadySessions(anna) {
  if (!anna?.storage?.list) return [];
  try {
    const res = unwrapHostResponse(
      await anna.storage.list({ prefix: "ready/sessions/", scope: "user" }),
    );
    const keys = res?.keys || res?.items || [];
    const out = [];
    for (const k of keys.slice(0, 40)) {
      const key = k?.key ?? k;
      try {
        const v = storageValue(await anna.storage.get({ key, scope: "user" }));
        if (v && typeof v === "object" && v.completedAt) out.push(v);
      } catch {}
    }
    return out.sort((a, b) => String(b.completedAt || "").localeCompare(String(a.completedAt || "")));
  } catch {
    return [];
  }
}

// --- Arrive: how are you arriving? ------------------------------------------
// One tap, one act, never a menu. The ring is a closed set; the map picks
// the act; the model writes only the invitation line. Acts persist nothing.

let arriveRingBuilt = false;
let arriveSelection = null;
let arriveInviteToken = 0;

function buildFeelingRing() {
  if (arriveRingBuilt || !els.feelingRing) return;
  arriveRingBuilt = true;
  const n = FEELINGS.length;
  FEELINGS.forEach((f, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ring-word";
    b.dataset.feeling = f.id;
    b.textContent = f.label;
    const ang = (-90 + (i * 360) / n) * (Math.PI / 180);
    b.style.left = `${50 + 39 * Math.cos(ang)}%`;
    b.style.top = `${50 + 40 * Math.sin(ang)}%`;
    b.style.setProperty("--d", `${(i % 5) * 0.9}s`);
    b.addEventListener("click", () => pickFeeling(f.id));
    els.feelingRing.appendChild(b);
  });
}

function resetArrive() {
  arriveSelection = null;
  arriveInviteToken += 1;
  els.arriveAct.hidden = true;
  for (const w of els.feelingRing.querySelectorAll(".ring-word")) {
    w.classList.remove("selected", "dim");
  }
}

function arriveFeelingFromPayload(v) {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  return feelingById(s) || FEELINGS.find((f) => f.label.toLowerCase() === s) || null;
}

function pickFeeling(id) {
  const f = feelingById(id);
  if (!f || loadBlocked()) return;
  arriveSelection = f;
  for (const w of els.feelingRing.querySelectorAll(".ring-word")) {
    const sel = w.dataset.feeling === id;
    w.classList.toggle("selected", sel);
    w.classList.toggle("dim", !sel);
  }
  mascot("arrive")?.react("hop");
  const act = actFor(id);
  els.arriveActName.textContent = act ? ACTS[act].name : "Steady";
  els.arriveInvite.textContent = inviteFallback(id);
  els.btnArriveGo.textContent = act ? "Begin" : "Carry on";
  els.arriveAct.hidden = false;
  const token = ++arriveInviteToken;
  fetchInvite(anna, { feeling: id, act }).then((line) => {
    if (token === arriveInviteToken && arriveSelection?.id === id) {
      els.arriveInvite.textContent = line;
    }
  });
}

// The companion watches the page while you draw, breathes out with the
// mist, and settles — acknowledgment, never celebration of a feeling.
function enterScatter() {
  if (scatterCtl) {
    scatterCtl.destroy();
    scatterCtl = null;
  }
  els.scatterHint.hidden = false;
  els.scatterDone.hidden = true;
  els.scatterControls.hidden = false;
  els.scatterEnd.hidden = true;
  els.btnScatterGo.disabled = true;
  els.scatterCanvas.classList.remove("is-released");
  show(els.screens.scatter);
  mascot("scatter")?.setOptions({ lookAt: els.scatterCanvas, gaze: undefined });
  scatterCtl = createScatter({
    canvas: els.scatterCanvas,
    reducedMotion: REDUCED_MOTION,
    onInk: () => { els.btnScatterGo.disabled = false; },
    onRelease: releaseScatter,
    onDone: finishScatter,
  });
}

function releaseScatter() {
  haptic();
  els.btnScatterGo.disabled = true;
  els.scatterCanvas.classList.add("is-released");
  const m = mascot("scatter");
  m?.setOptions({ lookAt: undefined, gaze: { x: 0.4, y: -1.6 } });
  m?.setState("exhale");
}

function finishScatter() {
  const m = mascot("scatter");
  m?.setOptions({ gaze: undefined });
  m?.setState("tender");
  m?.react("settle");
  const hadFocus = els.screens.scatter.contains(document.activeElement);
  els.scatterHint.hidden = true;
  els.scatterDone.hidden = false;
  els.scatterControls.hidden = true;
  els.scatterEnd.hidden = false;
  if (hadFocus) els.btnScatterHome.focus({ preventScroll: true });
}

function enterSetdown() {
  if (setdownCtl) {
    setdownCtl.destroy();
    setdownCtl = null;
  }
  clearTimeout(setdownHintTimer);
  els.setdownHint.textContent = ACTS.setdown.hint;
  els.setdownHint.hidden = false;
  els.setdownDone.hidden = true;
  els.setdownControls.hidden = false;
  els.setdownEnd.hidden = true;
  els.setdownWeight.style.cssText = "";
  els.setdownWeight.classList.remove("held");
  show(els.screens.setdown);
  mascot("setdown")?.setOptions({ lookAt: els.setdownWeight });
  setdownCtl = createSetdown({
    track: els.setdownTrack,
    weight: els.setdownWeight,
    reducedMotion: REDUCED_MOTION,
    onSlip: slipSetdown,
    onDone: finishSetdown,
  });
}

function slipSetdown() {
  clearTimeout(setdownHintTimer);
  els.setdownHint.textContent = ACTS.setdown.slip;
  setdownHintTimer = setTimeout(() => {
    els.setdownHint.textContent = ACTS.setdown.hint;
  }, 2600);
}

function finishSetdown() {
  haptic();
  clearTimeout(setdownHintTimer);
  const m = mascot("setdown");
  m?.setOptions({ lookAt: undefined });
  m?.react("settle");
  const hadFocus = els.screens.setdown.contains(document.activeElement);
  els.setdownHint.hidden = true;
  els.setdownDone.hidden = false;
  els.setdownControls.hidden = true;
  els.setdownEnd.hidden = false;
  if (hadFocus) els.btnSetdownHome.focus({ preventScroll: true });
}

function backToArrive() {
  resetArrive();
  show(els.screens.arrive);
}

// --- Planning ---------------------------------------------------------------

let planningToken = 0;

async function startPlanning() {
  context = els.contextInput.value.trim().slice(0, 200);
  const token = ++planningToken;
  const taskId = task?.id;
  const gen = taskGeneration;
  show(els.screens.planning);
  if (anna?.storage?.set && !(await taskStore.flush())) {
    if (!ownsTask(taskId, gen)) return;
    toast("Couldn't save your input — keep this window open and retry.");
    show(els.screens.home);
    return;
  }
  if (token !== planningToken || !ownsTask(taskId, gen)) return;
  let readySessions = [];
  try { readySessions = await loadReadySessions(anna); } catch {}
  const { plan: p, offline } = await fetchPlan(anna, { context, summary, readySessions });
  if (token !== planningToken || !ownsTask(taskId, gen)) return; // user skipped
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
      previewBreath(v);
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
  if (els.adjPatternVal) {
    const current = PATTERNS[plan.pattern];
    els.adjPatternVal.textContent = current ? current.name : plan.pattern;
    els.adjLengthVal.textContent = fmtSeconds(plan.seconds);
    els.adjSoundVal.textContent = { off: "off", chime: "chime", voice: "voice" }[soundMode];
  }
}

let breathPreview = 0;
function previewBreath(patternId) {
  const token = ++breathPreview;
  const m = mascot("plan");
  const pat = PATTERNS[patternId];
  if (!m || !pat || REDUCED_MOTION) return;
  const phases = [
    ["inhale", pat.inhale],
    ["topup", pat.topup],
    ["hold", pat.hold],
    ["exhale", pat.exhale],
    ["pause", pat.holdAfterExhale],
  ].filter(([, s]) => s > 0);
  if (!phases.length) return;
  const total = phases.reduce((a, [, s]) => a + s, 0) * 1000;
  const start = performance.now();
  function frame(t) {
    if (token !== breathPreview || els.screens.plan.hidden) return;
    let el = (t - start) % total;
    let phase = "idle", prog = 0;
    for (const [name, s] of phases) {
      const ms = s * 1000;
      if (el < ms) { phase = name; prog = el / ms; break; }
      el -= ms;
    }
    m.setState(phase === "pause" ? "idle" : phase);
    m.setBreath(breathAmount(phase, prog));
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function showPlan(p) {
  plan = p;
  const pat = PATTERNS[plan.pattern];
  const userMoment = (context || "").trim();
  els.planTitle.textContent = plan.offline && userMoment ? userMoment : plan.title;
  els.planRhythm.textContent = `${pat.name} · ${pat.rhythm}`;
  els.planLength.textContent = `${fmtSeconds(plan.seconds)} total`;
  els.planOpening.textContent = plan.offline ? plan.why : plan.opening;
  els.planWhy.textContent = plan.offline ? "" : plan.why;
  els.planOffline.textContent = plan.planSource === "quick"
    ? `${plan.title} — a standard breathing plan.`
    : `${plan.title} — a standard plan; AI personalization unavailable.`;
  els.planOffline.hidden = !plan.offline;
  renderPlanControls();
  show(els.screens.plan);
  if (task?.flow === "reset") snapshotReset("plan");
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
  if (task?.flow === "reset") snapshotReset("session");
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
  const running = isClockRunning(clock);
  const m = mascot("session");
  if (m) {
    if (running && !sessionWasRunning) m.react("hop");
    else if (!running && sessionWasRunning) m.react("settle");
    m.setState(running ? snap.currentPhase : "idle");
    m.setBreath(breathAmount(snap.currentPhase, snap.phaseProgress / 100));
  }
  sessionWasRunning = running;
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
  if (isClockRunning(clock) && ++tickCount % TASK_TICK_EVERY === 0 && task?.flow === "reset") {
    snapshotReset("session");
  }
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

function begin() {
  finishing = false;
  lastPhase = null;
  tickCount = 0;
  clock = resumeSessionClock(createSessionClock(), now());
  sessionWasRunning = false;
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
  if (task?.flow === "reset") snapshotReset("session");
}

function snapshotReset(screen) {
  if (!task || task.flow !== "reset") return;
  const t = now();
  const pausedClock = clock
    ? { elapsedMs: readSessionElapsedMs(clock, t), runningSince: null }
    : null;
  const syncedTracker = clock && tracker
    ? syncTempoTracker(tracker, clock, t)
    : tracker;
  saveTask(screen, {
    context,
    plan,
    soundMode,
    paceIdx,
    clock: pausedClock,
    tracker: syncedTracker,
    pendingResult,
    felt: selectedFelt,
    result: resultState
      ? {
          reflection: resultState.reflection,
          reflectionStatus: resultState.reflectionStatus,
          reflectionModel: resultState.reflectionModel,
          recordSaved: resultState.recordSaved,
          completedAt: resultState.record?.completedAt ?? null,
        }
      : null,
  });
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
  selectedFelt = null;
  clock = null;
  tracker = null;
  updatePaceUI();
  if (pendingResult.activeSeconds >= 1) {
    show(els.screens.checkin);
    if (task?.flow === "reset") snapshotReset("checkin");
  } else {
    completeResult(null);
  }
}

function renderResult({ heading, pattern, activeSeconds, cycles, reflection, qualifies }) {
  els.resultHeading.textContent = heading;
  els.resultPattern.textContent = pattern;
  els.resultTime.textContent = `${activeSeconds} second${activeSeconds === 1 ? "" : "s"}`;
  els.resultCycles.textContent = String(cycles);
  els.closingLine.textContent = reflection;
  els.closingLine.hidden = !qualifies;
}

async function saveResultRecord() {
  const s = resultState;
  if (!s?.record || s.recordSaved || s.saving) return;
  s.saving = true;
  const taskId = task?.id;
  const gen = taskGeneration;
  try {
    snapshotReset("result");
    if (anna?.storage?.set && !(await taskStore.flush())) throw new Error("Checkpoint failed");
    if (!ownsTask(taskId, gen) || resultState !== s) return;
    await saveCompletionRecord(anna, s.record);
    s.recordSaved = true;
    if (!ownsTask(taskId, gen) || resultState !== s) return;
    summary = await loadSummary(anna);
    if (!ownsTask(taskId, gen) || resultState !== s) return;
    els.saveNote.hidden = true;
    els.btnSaveRetry.hidden = true;
    snapshotReset("result");
  } catch {
    if (!ownsTask(taskId, gen) || resultState !== s) return;
    els.saveNote.textContent =
      "Couldn't save this session — the result above still stands.";
    els.saveNote.hidden = false;
    els.btnSaveRetry.hidden = false;
  } finally {
    s.saving = false;
  }
}

async function completeResult(felt) {
  if (!pendingResult || !plan || task?.screen === "result") return;
  const { activeSeconds, cycles, interrupted } = pendingResult;
  const qualifies = activeSeconds >= 1;
  const pat = PATTERNS[plan.pattern];
  selectedFelt = felt;

  // The reflection call is what makes the run server-observable. It is
  // raced against a ~6s cap inside fetchReflection and never throws; the
  // line swaps in when the model answers.
  const capturedPlan = plan;
  const capturedContext = context;
  const taskId = task?.id;
  const gen = taskGeneration;

  els.resultHeading.textContent = interrupted ? "Ended early" : "Reset complete";
  mascot("result")?.setState(interrupted ? "idle" : "proud");
  if (!interrupted) mascot("result")?.react("celebrate");
  renderResult({
    heading: els.resultHeading.textContent,
    pattern: pat.name,
    activeSeconds,
    cycles,
    reflection: "Writing your AI note…", // provisional
    qualifies,
  });
  els.saveNote.hidden = true;
  els.btnSaveRetry.hidden = true;
  els.btnReflectRetry.hidden = true;
  els.btnSaveAnyway.hidden = true;
  show(els.screens.result);

  const record = buildCompletionRecord({
    context: capturedContext,
    pattern: capturedPlan.pattern,
    plannedSeconds: capturedPlan.seconds,
    activeSeconds,
    cycles,
    interrupted,
    felt,
    planSource: capturedPlan.planSource,
    planModel: capturedPlan.planModel ?? null,
    reflectionModel: null,
    reflection: "",
    source: "app",
    now: Date.now(),
  });
  resultState = {
    record,
    reflection: null,
    reflectionStatus: qualifies ? "pending" : "unavailable",
    reflectionModel: null,
    recordSaved: false,
    facts: {
      context: capturedContext,
      patternName: pat.name,
      activeSeconds,
      plannedSeconds: capturedPlan.seconds,
      effectiveSeconds: effectiveLength().effectiveSeconds,
      cycles,
      interrupted,
      felt,
    },
  };
  if (task?.flow === "reset") snapshotReset("result");
  if (!qualifies) {
    els.saveNote.textContent = "Under one active second — nothing was saved.";
    els.saveNote.hidden = false;
    return;
  }
  if (anna?.storage?.set && !(await taskStore.flush())) {
    if (!ownsTask(taskId, gen)) return;
    els.closingLine.textContent = "Couldn't save your progress — retry before asking for an AI note.";
    els.btnReflectRetry.hidden = false;
    els.btnSaveAnyway.hidden = false;
    return;
  }
  if (!ownsTask(taskId, gen)) return;

  // Cross-flow history (closed-set only) so the reflection can reference
  // the user's own patterns observationally.
  try {
    const [resetSessions, readySessions] = await Promise.all([
      loadResetSessions(anna),
      loadReadySessions(anna),
    ]);
    if (ownsTask(taskId, gen) && resultState?.facts) {
      resultState.facts.history = summarizeHistory(resetSessions, readySessions);
    }
  } catch {}

  if (!ownsTask(taskId, gen)) return;

  const reflection = qualifies
    ? (await fetchReflection(anna, resultState.facts)) || FALLBACK_REFLECTION
    : null;
  if (!ownsTask(taskId, gen)) return;
  resultState.reflection = reflection;
  resultState.reflectionStatus =
    reflection === FALLBACK_REFLECTION ? "unavailable" : "ready";
  resultState.reflectionModel = lastReflectionModel;
  resultState.record.reflection = reflection === FALLBACK_REFLECTION ? "" : reflection;
  resultState.record.reflectionModel = resultState.reflectionModel;
  els.closingLine.textContent = reflection === FALLBACK_REFLECTION ? "AI note unavailable." : reflection;
  if (task?.flow === "reset") snapshotReset("result");

  if (!anna) {
    els.saveNote.textContent = "Not connected to Anna — nothing was saved.";
    els.saveNote.hidden = false;
    return;
  }
  await saveResultRecord();
}

async function retryReflection() {
  const s = resultState;
  if (!s || s.reflectionStatus !== "pending" || s.reflecting) return;
  s.reflecting = true;
  const request = ++reflectionRequest;
  const taskId = task?.id;
  const gen = taskGeneration;
  els.btnReflectRetry.disabled = true;
  els.closingLine.textContent = "Asking Anna's AI for a note…";
  snapshotReset("result");
  if (anna?.storage?.set && !(await taskStore.flush())) {
    s.reflecting = false;
    if (!ownsTask(taskId, gen)) return;
    els.btnReflectRetry.disabled = false;
    els.closingLine.textContent = "Couldn't save your progress — keep this window open and retry.";
    return;
  }
  if (!ownsTask(taskId, gen) || request !== reflectionRequest) {
    s.reflecting = false;
    return;
  }
  const reflection = (await fetchReflection(anna, s.facts)) || null;
  s.reflecting = false;
  if (!ownsTask(taskId, gen) || resultState !== s || request !== reflectionRequest) return;
  els.btnReflectRetry.disabled = false;
  if (reflection && reflection !== FALLBACK_REFLECTION) {
    resultState.reflection = reflection;
    resultState.reflectionStatus = "ready";
    resultState.reflectionModel = lastReflectionModel;
    resultState.record.reflection = reflection;
    resultState.record.reflectionModel = resultState.reflectionModel;
    els.closingLine.textContent = reflection;
    els.btnReflectRetry.hidden = true;
    els.btnSaveAnyway.hidden = true;
  } else {
    resultState.reflectionStatus = "pending";
    els.closingLine.textContent = "AI note unavailable — you can retry, or save without it.";
  }
  if (task?.flow === "reset") snapshotReset("result");
  if (s.reflectionStatus === "ready") await saveResultRecord();
}

// --- Alertness check -----------------------------------------------------

const KSS_LABELS = {
  1: "Extremely alert", 3: "Alert", 5: "Neither alert nor sleepy",
  7: "Sleepy, but no effort to stay awake", 9: "Very sleepy, fighting sleep",
};
const ALERT_NOTE_TIMEOUT_MS = 8000;
let alertKss = null;
let alertRun = null;
let alertAborted = false;
let alertCountdown = null;
let alertProgressTimer = null;
let alertCleanup = null;
let alertResultState = null;

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
      if (task?.flow === "alert") saveTask("setup", { kss: alertKss, interrupted: task.data?.interrupted === true });
    });
    els.kssRow.appendChild(b);
  }
}

async function alertChecks() {
  if (!anna?.storage?.list) return [];
  try {
    const res = unwrapHostResponse(
      await anna.storage.list({ prefix: "alert/checks/", scope: "user" }),
    );
    const keys = res?.keys || res?.items || [];
    const out = [];
    for (const k of keys.slice(0, 12)) {
      const v = await anna.storage.get({ key: k.key ?? k, scope: "user" });
      const rec = storageValue(v);
      if (rec && rec.medianMs) out.push(rec);
    }
    return out.sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
  } catch {
    return [];
  }
}

async function refreshAlertLine() {
  // The home control does not show a reaction-time chart or a millisecond
  // figure. Those numbers stay on the check's own result screen.
  if (els.alertLine) els.alertLine.hidden = true;
  if (els.alertSpark) els.alertSpark.hidden = true;
}

function stopAlertRun() {
  alertAborted = true;
  if (alertCountdown) { clearInterval(alertCountdown); alertCountdown = null; }
  if (alertProgressTimer) { clearInterval(alertProgressTimer); alertProgressTimer = null; }
  if (alertCleanup) { alertCleanup(); alertCleanup = null; }
  if (alertRun) { alertRun.stop?.(); alertRun = null; }
}

function showAlertSetup({ interrupted = false } = {}) {
  stopAlertRun();
  els.alertInterruptNote.hidden = !interrupted;
  show(els.screens.alert);
}

function startAlertCountdown() {
  // 3-2-1 countdown then run
  showAlertSetup();
  let n = 3;
  show(els.screens.alertTest);
  els.alertWait.textContent = String(n);
  els.alertWait.hidden = false;
  alertCountdown = setInterval(() => {
    n -= 1;
    if (n <= 0) { clearInterval(alertCountdown); alertCountdown = null; startAlertTest(); return; }
    els.alertWait.textContent = String(n);
  }, 1000);
  if (task?.flow === "alert") saveTask("countdown", { kss: alertKss });
}

function startAlertTest() {
  show(els.screens.alertTest);
  mascot("alert-test")?.setState("watching");
  els.alertWait.textContent = "Wait for the counter…";
  els.alertWait.hidden = false;
  els.alertMs.hidden = true;
  els.alertMsg.hidden = true;
  alertAborted = false;
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
    onResult: (metrics) => { if (!alertAborted) finishAlert(metrics); },
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
  alertCleanup = () => {
    els.alertTarget.removeEventListener("pointerdown", onPointer);
    els.alertTarget.removeEventListener("keydown", onKey);
    if (rtAnim) cancelAnimationFrame(rtAnim);
  };
  const t0 = performance.now();
  alertProgressTimer = setInterval(() => {
    const left = Math.max(0, CHECK_SECONDS - (performance.now() - t0) / 1000);
    els.alertProgress.textContent = `${Math.ceil(left)}s left`;
    const fill = document.getElementById("alert-bar-fill");
    if (fill) fill.style.width = `${Math.min(100, (1 - left / CHECK_SECONDS) * 100)}%`;
    if (left <= 0 || els.screens.alertTest.hidden) clearInterval(alertProgressTimer);
  }, 500);
  if (task?.flow === "alert") saveTask("test", { kss: alertKss });
}

function interruptAlertTest() {
  const wasActive = !els.screens.alertTest.hidden || task?.screen === "test" || task?.screen === "countdown";
  stopAlertRun();
  if (wasActive) {
    showAlertSetup({ interrupted: true });
    if (task?.flow === "alert") saveTask("setup", { kss: alertKss, interrupted: true });
  }
}

async function saveAlertRecord() {
  const s = alertResultState;
  if (!s || s.recordSaved || s.saving) return;
  const taskId = task?.id;
  const gen = taskGeneration;
  if (!anna?.storage?.set) {
    /* storage optional */
    els.alertSaveNote.textContent = "Not connected — this check wasn't saved.";
    els.alertSaveNote.hidden = false;
    els.btnAlertSaveRetry.hidden = true;
    return;
  }
  s.saving = true;
  try {
    saveTask("result", alertCheckpointData());
    if (!(await taskStore.flush())) throw new Error("Checkpoint failed");
    if (!ownsTask(taskId, gen) || alertResultState !== s) return;
    unwrapHostResponse(
      await anna.storage.set({ key: `alert/checks/${s.record.completedAt}`, value: s.record, scope: "user" }),
    );
    const prev = storageValue(
      await anna.storage.get({ key: "alert/summary", scope: "user" }),
    );
    const prevRecent = Array.isArray(prev?.recent) ? prev.recent : [];
    if (!prevRecent.some((r) => r && r.completedAt === s.record.completedAt)) {
      unwrapHostResponse(
        await anna.storage.set({ key: "alert/summary", value: updateAlertSummary(prev, s.record), scope: "user" }),
      );
    }
    s.recordSaved = true;
    if (!ownsTask(taskId, gen) || alertResultState !== s) return;
    els.alertSaveNote.hidden = true;
    els.btnAlertSaveRetry.hidden = true;
  } catch {
    if (!ownsTask(taskId, gen) || alertResultState !== s) return;
    els.alertSaveNote.textContent = "Couldn't save this check — the result above still stands.";
    els.alertSaveNote.hidden = false;
    els.btnAlertSaveRetry.hidden = false;
  } finally {
    s.saving = false;
  }
  if (ownsTask(taskId, gen) && alertResultState === s && task?.flow === "alert") {
    saveTask("result", alertCheckpointData());
    if (!els.screens.alertResult.hidden) renderAlertResult(alertResultState);
  }
}

function alertCheckpointData() {
  const s = alertResultState;
  return s
    ? {
        metrics: s.metrics, kss: s.kss, band: s.band, baseline: s.baseline,
        checkCount: s.checkCount, baselinePending: s.baselinePending ?? false, record: s.record,
        recordSaved: s.recordSaved, note: s.note, noteSource: s.noteSource,
      }
    : { kss: alertKss, interrupted: task?.data?.interrupted === true };
}

function renderAlertResult(s) {
  show(els.screens.alertResult);
  els.alertBand.textContent = s.checkCount == null
    ? "Check complete"
    : alertHeading(s.band, s.baseline, s.checkCount);
  els.alertMedian.textContent = `${s.metrics.medianMs} ms`;
  els.alertLapses.textContent = `${s.metrics.lapses} of ${s.metrics.trials}`;
  els.alertTrials.textContent = `${s.metrics.trials} (${s.metrics.falseStarts} false start${s.metrics.falseStarts === 1 ? "" : "s"})`;
  // The heading already carries the baseline-building message — never
  // repeat it in the note line below.
  els.alertBaselineNote.hidden = true;
  els.alertNote.textContent =
    s.noteSource === "ai" ? s.note
    : s.recordSaved ? ALERTNESS_FALLBACK_NOTE
    : "AI note unavailable";
}

async function finishAlert(metrics) {
  if (task?.flow !== "alert") return;
  const taskId = task?.id;
  const gen = taskGeneration;
  const completedAt = new Date().toISOString();
  const kss = alertKss;
  const alertState = {
    metrics, kss, band: null, baseline: null, checkCount: null, baselinePending: true,
    record: {
      completedAt, durationSec: CHECK_SECONDS,
      trials: metrics.trials, medianMs: metrics.medianMs,
      meanSpeed: metrics.meanSpeed, lapses: metrics.lapses,
      falseStarts: metrics.falseStarts, inputType: metrics.inputType,
      kss, band: null, baselineMs: null, note: "", noteSource: "none", noteModel: null,
    },
    recordSaved: false,
    note: "", noteSource: "none",
  };
  alertResultState = alertState;
  stopAlertRun();
  els.alertSaveNote.hidden = true;
  els.btnAlertSaveRetry.hidden = true;
  if (task?.flow === "alert") saveTask("result", alertCheckpointData());
  renderAlertResult(alertResultState);
  const m = mascot("alert-result");
  if (m) m.setState("idle");

  const checks = await alertChecks();
  if (!ownsTask(taskId, gen) || alertResultState !== alertState) return;
  const baseline = baselineMedian(checks, metrics.inputType);
  const band = bandFor(metrics.medianMs, metrics.lapses, baseline);
  const checkCount = checks.filter((c) => c.inputType === metrics.inputType).length + 1;
  alertState.baseline = baseline;
  alertState.band = band;
  alertState.checkCount = checkCount;
  alertState.baselinePending = false;
  alertState.record.band = band;
  alertState.record.baselineMs = baseline;
  if (task?.flow === "alert") saveTask("result", alertCheckpointData());
  renderAlertResult(alertResultState);
  if (m) m.setState(kss >= 7 || band === "much slower than usual" ? "sleepy" : band === "sharper than usual" ? "bright" : "idle");

  if (anna?.llm?.complete) {
    try {
      if (!(await taskStore.flush())) throw new Error("Checkpoint failed");
      if (!ownsTask(taskId, gen) || alertResultState !== alertState) return;
      const res = await withTimeout(
        Promise.resolve(anna.llm.complete({
          messages: [{ role: "user", content: { type: "text",
            text: alertnessNotePrompt({ metrics, baseline, band, kss, checkCount, timeOfDay: new Date().toTimeString().slice(0, 5) }) } }],
          maxTokens: 512,
        })),
        ALERT_NOTE_TIMEOUT_MS,
      );
      if (!ownsTask(taskId, gen) || alertResultState !== alertState) return;
      const t = cleanReflection(responseText(res));
      if (t !== FALLBACK_REFLECTION) {
        alertState.note = t;
        alertState.noteSource = "ai";
        alertState.record.note = t;
        alertState.record.noteSource = "ai";
        alertState.record.noteModel = res?.model ?? null;
      }
    } catch { /* fallback */ }
  }
  if (!ownsTask(taskId, gen) || alertResultState !== alertState) return;
  await saveAlertRecord();
  if (!ownsTask(taskId, gen) || alertResultState !== alertState) return;
  renderAlertResult(alertResultState);
}

// --- Get ready ------------------------------------------------------------

let readyPlan = null;
let readyStep = 0;
let readyTimerId = null;
let readyStepElapsed = 0;
let readyStepT0 = 0;
let readyPaused = false;
let readyReturn = null;

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

function renderReadyDots() {
  els.readyDots.innerHTML = "";
  READY_STEPS.forEach((_, i) => {
    const d = document.createElement("span");
    if (i <= readyStep) d.classList.add("on");
    els.readyDots.appendChild(d);
  });
}

function pauseReadyStep() {
  if (readyTimerId) {
    readyStepElapsed += performance.now() - readyStepT0;
    clearInterval(readyTimerId);
    readyTimerId = null;
  }
  readyPaused = true;
  $("#btn-ready-pause").textContent = "Resume";
}

function startStepTimer() {
  const step = READY_STEPS[readyStep];
  readyStepT0 = performance.now();
  stepTickCount = 0;
  readyTimerId = setInterval(() => {
    const t = (readyStepElapsed + performance.now() - readyStepT0) / 1000;
    const left = Math.max(0, Math.round(step.secs - t));
    els.readyTimer.textContent = `${left}s`;
    if (step.key === "breathe") {
      // Real cyclic-sigh guidance: phase word + Cycle N of 7 +
      // "0:12 / 1:03" timer, driven by the same clock math as a reset.
      const ph = t % 9;
      const cyc = Math.min(7, Math.floor(t / 9) + 1);
      const state = ph < 2 ? "inhale" : ph < 3 ? "topup" : "exhale";
      const word = { inhale: "Breathe in", topup: "Top up", exhale: "Breathe out" }[state];
      mascot("ready-run")?.setState(state);
      mascot("ready-run")?.setBreath(ph < 3 ? ph / 3 : Math.max(0, 1 - (ph - 3) / 6));
      els.readyTimer.textContent =
        `${word} · Cycle ${cyc} of 7 · ${fmtSeconds(Math.floor(t))} / 1:03`;
    }
    if (++stepTickCount % STEP_SNAPSHOT_EVERY === 0 && task?.flow === "ready") {
      snapshotReady("pause");
    }
    if (left <= 0) { clearInterval(readyTimerId); readyTimerId = null; nextReadyStep(); }
  }, 250);
}

function runReadyStep({ resume = false } = {}) {
  const step = READY_STEPS[readyStep];
  show(els.screens.readyRun);
  mascot("ready-run")?.setState(step.state);
  els.readyStepLabel.textContent = step.label;
  els.readyStepTitle.textContent = step.title;
  els.readyStepText.textContent = step.text;
  els.readyRehearse.hidden = step.key !== "rehearse";
  renderReadyDots();
  if (step.key === "rehearse") {
    els.readyOpener.textContent = readyPlan?.opener || "(say it your way — the main thing first)";
    els.readyKeypoint.textContent = readyPlan?.keyPoint || "Your one clear point.";
    els.readyReminder.textContent = readyPlan?.reminder || "";
    els.btnHear.hidden = !(soundMode === "voice" && voice && !voice.failed);
    els.readyTimer.textContent = "";
  }
  $("#btn-ready-pause").hidden = !step.secs;
  clearInterval(readyTimerId);
  readyTimerId = null;
  if (!resume) readyStepElapsed = 0;
  if (step.secs && !readyPaused) {
    startStepTimer();
  } else if (step.secs && readyPaused) {
    const left = Math.max(0, Math.round(step.secs - readyStepElapsed / 1000));
    els.readyTimer.textContent = `${left}s (paused)`;
  } else {
    els.readyTimer.textContent = "";
  }
  if (task?.flow === "ready") snapshotReady("pause");
}

function nextReadyStep() {
  clearInterval(readyTimerId);
  readyTimerId = null;
  readyPaused = false;
  $("#btn-ready-pause").textContent = "Pause";
  readyStep += 1;
  if (readyStep >= READY_STEPS.length) return finishReadySteps();
  runReadyStep();
}

function finishReadySteps() {
  readyStep = 0;
  readyStepElapsed = 0;
  const dest = readyReturn === "practice" ? "practice" : "plan";
  readyReturn = null;
  prep.stage = dest;
  renderPrepStage();
}

function startGuidedPause(fromStage) {
  /* optional */
  if (!prep.plan) return;
  readyReturn = fromStage;
  readyPlan = {
    opener: prep.plan.opening,
    keyPoint: prep.plan.keyPoint,
    reminder: prep.plan.approach,
  };
  readyStep = 0;
  readyStepElapsed = 0;
  readyPaused = false;
  $("#btn-ready-pause").textContent = "Pause";
  runReadyStep();
}

const PREP_KINDS = [
  ["interview", "Interview"], ["presentation", "Presentation"],
  ["hard-conversation", "Hard conversation"], ["meeting", "Meeting"],
];

function newPrepState() {
  return {
    input: { event: "", goal: "", keyPoint: "", kind: null, preserve: "" },
    wordingStyle: "natural",
    stage: "input",
    clarificationUsed: false,
    question: "",
    clarification: "",
    plan: null,
    planModel: null,
    planSource: null,
    reply: "",
    feedback: null,
    feedbackModel: null,
    finalResponse: null,
    finalNextStep: null,
    busy: null,
    error: "",
    completedAt: null,
    saved: false,
    faithfulnessRetried: false,
    rehearsalRetried: false,
    scheduleAsked: false,
    quoteNote: "",
    // Where the situation text came from: "typed" (the person wrote it),
    // "handoff" (Anna's reading is on screen — Prepare stays off until
    // the person writes their own), "answered" (the person wrote every
    // card field in the interview and the card was made from those
    // words), "confirmed" (older checkpoints), "edited" (they
    // corrected it).
    sourceProvenance: "typed",
    // Anna's reading of a chat message — a suggestion, never the source.
    suggestion: null,
    // A brume_prepare draft waiting on the person's own writing:
    // { draft, written, day, schedule } — the draft is masked reference
    // only; only what the person types can reach the card.
    interview: null,
    // The audit the card records: the model's draft beside what the
    // person actually wrote, field by field, plus the day they named.
    interviewAudit: null,
  };
}

const BLANK_FIELD = {
  opening: "prep-opening",
  keyPoint: "prep-keypoint-edit",
  approach: "prep-approach",
  response: "prep-response",
  nextStep: "prep-nextstep",
  adjustment: "prep-adjustment",
};

function noteFaithfulness(issues, screenName) {
  prep.faithfulnessNote = faithfulnessMessage(issues);
  prep.error = prep.faithfulnessNote;
  const sprite = screenName ? mascot(screenName) : null;
  sprite?.setState("watching");
  const first = issues.find((issue) => BLANK_FIELD[issue.field]);
  const el = first && document.getElementById(BLANK_FIELD[first.field]);
  if (el) {
    sprite?.setOptions({ lookAt: el });
    el.focus();
  }
}

async function faithfulPlan(payload) {
  prep.faithfulnessNote = "";
  if (!payload.clarificationUsed && !prep.scheduleAsked) {
    const question = scheduleQuestion(preparationSource(payload));
    if (question) {
      prep.scheduleAsked = true;
      return { value: { kind: "clarify", question }, model: null, issues: [] };
    }
  }
  let { value, model } = await requestPreparation(anna, payload);
  if (value.kind !== "plan") return { value, model };
  const source = preparationSource(payload);
  let issues = faithfulnessIssues(value, source, PLAN_FACT_FIELDS);
  if (issues.length && !prep.faithfulnessRetried) {
    prep.faithfulnessRetried = true;
    try {
      const again = await requestPreparation(anna, {
        ...payload,
        droppedFacts: [...new Set(issues.flatMap((issue) => issue.spans))],
      });
      if (again.value.kind === "plan") {
        value = again.value;
        model = again.model;
        issues = faithfulnessIssues(value, source, PLAN_FACT_FIELDS);
      }
    } catch { /* keep the first draft and blank the ungrounded fields */ }
  }
  if (issues.length) {
    value = { ...withholdUngrounded(value, issues), kind: "plan" };
    prep.faithfulnessNote = faithfulnessMessage(issues);
  } else {
    prep.faithfulnessNote = "";
  }
  return { value, model, issues };
}

let prep = newPrepState();
let prepGen = 0;
let prepEditTimer = null;
let cardViewOnly = false;

const PREP_SCREENS = {
  input: () => els.screens.prepInput,
  clarify: () => els.screens.prepClarify,
  interview: () => els.screens.prepInterview,
  plan: () => els.screens.prepPlan,
  practice: () => els.screens.prepPractice,
  feedback: () => els.screens.prepFeedback,
  card: () => els.screens.prepCard,
};

function prepKindChips() {
  if (els.prepKindChips.childElementCount) {
    els.prepKindChips.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("selected", b.dataset.kind === prep.input.kind);
    });
    return;
  }
  for (const [id, label] of PREP_KINDS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.dataset.kind = id;
    b.addEventListener("click", () => {
      prep.input.kind = id;
      els.prepKindChips.querySelectorAll("button").forEach((x) => x.classList.remove("selected"));
      b.classList.add("selected");
      snapshotReady("input");
    });
    els.prepKindChips.appendChild(b);
  }
}

function readyPauseData(screen = task?.screen) {
  if (screen !== "pause" || task?.flow !== "ready") return null;
  const elapsedMs = readyStepElapsed
    + (readyTimerId && !readyPaused ? performance.now() - readyStepT0 : 0);
  return {
    step: readyStep,
    elapsedMs,
    paused: true,
    return: readyReturn === "practice" ? "practice" : "plan",
  };
}

function snapshotReady(screen) {
  if (!task || task.flow !== "ready") return;
  return saveTask(screen, { prep, pause: readyPauseData(screen) });
}

function openConversation() {
  prep = newPrepState();
  prep.wordingStyle = currentWordingPreference;
  show(els.screens.prepInput);
  syncPrepInputs();
  prepKindChips();
}

function ensurePrepTask() {
  if (task?.flow === "ready") return;
  const event = els.prepEvent.value;
  const goal = els.prepGoal.value;
  const keyPoint = els.prepKeypoint.value;
  const preserve = els.prepPreserve ? els.prepPreserve.value : "";
  startPreparation();
  prep.input.event = event.trim().slice(0, 600);
  prep.input.goal = goal.trim().slice(0, 300);
  prep.input.keyPoint = keyPoint.trim().slice(0, 220);
  prep.input.preserve = preserve.trim().slice(0, 220);
  syncPrepInputs();
}

function startPreparation({ moment } = {}) {
  prepGen += 1;
  cardViewOnly = false;
  els.btnCardDone.hidden = false;
  els.btnCardHome.hidden = true;
  els.prepEvent.placeholder = "A one-on-one with my manager about next quarter's workload";
  beginTask("ready", "input", { prep: newPrepState(), pause: null });
  prep = task.data.prep;
  prep.wordingStyle = currentWordingPreference;
  if (moment && MOMENTS[moment]) {
    prep.input.event = MOMENTS[moment].event;
    prep.input.kind = MOMENTS[moment].kind;
    els.prepEvent.placeholder = MOMENTS[moment].placeholder;
  }
  prepKindChips();
  renderPrepStage();
}

function syncPrepInputs() {
  els.prepEvent.value = prep.input.event;
  els.prepGoal.value = prep.input.goal;
  els.prepKeypoint.value = prep.input.keyPoint;
  if (els.prepPreserve) els.prepPreserve.value = prep.input.preserve || "";
  updateWordingBadge();
}

// Anna's reading of a chat message is model-written, so it is never the
// card's source: it sits on screen as a suggestion and the person writes
// the situation themselves. Until they do, Prepare stays off — a card
// whose facts come from the model's prose would be exactly the thing the
// faithfulness gate exists to prevent.
function updatePrepSourceGate() {
  const gated = prep.sourceProvenance === "handoff" || !prep.input.event.trim();
  // Anna's reading stays on screen as a reference while the person
  // writes their own version.
  if (els.prepSourceNote) els.prepSourceNote.hidden = !prep.suggestion;
  els.btnPrepGo.disabled = gated;
}

function renderPrepSuggestion() {
  if (!els.prepSourceQuote) return;
  const s = prep.suggestion;
  if (!s) {
    els.prepSourceQuote.textContent = "";
    return;
  }
  const parts = [];
  if (s.event) parts.push(s.event);
  if (s.goal) parts.push(`What needs to change: ${s.goal}`);
  if (s.keyPoint) parts.push(`The one thing to remember: ${s.keyPoint}`);
  if (s.preserve) parts.push(`What to preserve: ${s.preserve}`);
  els.prepSourceQuote.textContent = parts.join("\n");
}

function markSourceEngaged() {
  if (prep.sourceProvenance === "handoff" || prep.sourceProvenance === "confirmed") {
    prep.sourceProvenance = "edited";
  }
  updatePrepSourceGate();
}

// --- The brume_prepare interview -----------------------------------------
// The tool drafts the card but every argument it receives is model-written,
// so the draft is never the oracle — and substituting a token inside a
// model sentence still leaves the model's sentence. The window shows each
// drafted field with its facts masked and the person writes every part
// themselves; only typed text can reach the card.

const INTERVIEW_FIELD_LABELS = {
  opening: "Opening",
  keyPoint: "Key point",
  approach: "Approach",
  objection: "If they push back — what they might say",
  response: "Your response",
  nextStep: "Next step",
};

function renderPrepInterview() {
  const iv = prep.interview;
  if (!iv) return;
  const s = prep.suggestion;
  const quote = s
    ? [s.event, s.goal, s.keyPoint, s.preserve]
        .filter(Boolean)
        .map((part) => maskFacts(part))
        .join("\n")
    : "";
  if (els.prepInterviewQuote) els.prepInterviewQuote.textContent = quote;
  if (els.prepInterviewSource) els.prepInterviewSource.hidden = !quote;
  els.prepInterviewList.textContent = "";
  for (const field of CARD_FACT_FIELDS) {
    const draft = iv.draft?.[field] || "";
    if (!draft) continue;
    const block = document.createElement("div");
    block.className = "interview-q";
    const label = document.createElement("p");
    label.className = "field-label";
    label.textContent = INTERVIEW_FIELD_LABELS[field] || field;
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = `Anna's draft — for reference, not the card: “${maskFacts(draft)}”`;
    const input = document.createElement("textarea");
    input.rows = 2;
    input.maxLength = 1000;
    input.dataset.field = field;
    input.value = iv.written[field] || "";
    input.placeholder = "Write it in your own words — or leave blank to drop it";
    input.addEventListener("input", () => {
      iv.written[field] = input.value;
      if (task?.flow === "ready") snapshotReady("interview");
    });
    block.append(label, hint, input);
    els.prepInterviewList.appendChild(block);
  }
  if (iv.schedule) {
    const block = document.createElement("div");
    block.className = "interview-q";
    const text = document.createElement("p");
    text.className = "hint";
    text.textContent = iv.schedule;
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 60;
    input.dataset.schedule = "1";
    input.value = iv.day || "";
    input.placeholder = "e.g. Thursday — or leave blank";
    input.addEventListener("input", () => {
      iv.day = input.value;
      if (task?.flow === "ready") snapshotReady("interview");
    });
    block.append(text, input);
    els.prepInterviewList.appendChild(block);
  }
}

function submitInterview() {
  const iv = prep.interview;
  if (!iv) return;
  const written = {};
  for (const field of CARD_FACT_FIELDS) {
    const v = String(iv.written?.[field] || "").trim().slice(0, 1000);
    if (v) written[field] = v;
  }
  if (!Object.keys(written).length) {
    toast("Write at least one part in your own words — or choose “Write it myself instead”.");
    return;
  }
  const deadlineDay = iv.schedule ? scheduleDay(iv.day || "") : "";
  // The person's typed fields are the only source the card may claim —
  // every fact in them is theirs by construction.
  const sourceText = [...Object.values(written), deadlineDay]
    .filter(Boolean).join(" · ");
  const fields = Object.fromEntries(CARD_FACT_FIELDS.map((f) => [f, written[f] || ""]));
  const issues = faithfulnessIssues(fields, sourceText, PLAN_FACT_FIELDS);
  const finalFields = issues.length ? withholdUngrounded(fields, issues) : fields;
  prep.interviewAudit = {
    draft: iv.draft || {},
    written,
    deadlineDay: deadlineDay || null,
  };
  prep.plan = {
    opening: finalFields.opening ?? "",
    keyPoint: finalFields.keyPoint ?? "",
    approach: finalFields.approach ?? "",
    objection: finalFields.objection ?? "",
    response: finalFields.response ?? "",
    nextStep: finalFields.nextStep ?? "",
  };
  prep.planModel = null;
  prep.planSource = null;
  prep.input.event = sourceText;
  prep.sourceProvenance = "answered";
  prep.interview = null;
  prep.stage = "plan";
  renderPrepStage();
}

function abandonInterview() {
  prep.interview = null;
  prep.stage = "input";
  renderPrepStage();
}

function updateWordingBadge() {
  if (!els.prepWordingBadge) return;
  const label = { natural: "Natural", concise: "Shorter", direct: "More direct" }[normaliseWordingStyle(prep.wordingStyle)];
  els.prepWordingBadge.textContent = `Wording: ${label}`;
}

function showPrepStatus(screenEl, { busy = null, error = "" } = {}) {
  const el = els.prepStatus;
  screenEl.appendChild(el);
  el.hidden = !(busy || error);
  els.prepStatusText.textContent = busy === "preparing"
    ? "Preparing your talking points…"
    : busy === "rehearsing"
      ? "Thinking about your answer…"
      : error;
  els.btnPrepCancel.hidden = !busy;
  els.btnPrepRetry.hidden = !error;
  els.btnPrepAlt.hidden = !error;
  els.prepAltConfirm.hidden = true;
  for (const c of screenEl.querySelectorAll("button, textarea, input")) {
    if (el.contains(c)) continue;
    c.disabled = Boolean(busy);
  }
}

function hidePrepStatus() {
  els.prepStatus.hidden = true;
  els.prepAltConfirm.hidden = true;
}

function collectPrepInput() {
  prep.input.event = els.prepEvent.value.trim().slice(0, 600);
  prep.input.goal = els.prepGoal.value.trim().slice(0, 300);
  prep.input.keyPoint = els.prepKeypoint.value.trim().slice(0, 220);
  if (els.prepPreserve) prep.input.preserve = els.prepPreserve.value.trim().slice(0, 220);
}

function prepRequestPayload() {
  return {
    event: prep.input.event,
    goal: prep.input.goal,
    keyPoint: prep.input.keyPoint,
    preserve: prep.input.preserve || "",
    kind: prep.input.kind,
    wordingStyle: prep.wordingStyle,
    clarification: prep.clarificationUsed
      ? { question: prep.question, answer: prep.clarification || null }
      : null,
    clarificationUsed: prep.clarificationUsed,
    scheduleUnspecified: Boolean(prep.scheduleAsked && prep.clarificationUsed && !prep.clarification),
  };
}

async function runPreparationRequest() {
  if (prep.busy) return;
  if (prep.stage === "input") collectPrepInput();
  if (!prep.input.event) {
    prep.error = "Tell me what's coming up first.";
    showPrepStatus(PREP_SCREENS[prep.stage === "clarify" ? "clarify" : "input"](), { error: prep.error });
    els.btnPrepRetry.hidden = true;
    els.btnPrepAlt.hidden = true;
    return;
  }
  const gen = ++prepGen;
  const taskId = task?.id;
  const taskGen = taskGeneration;
  prep.busy = "preparing";
  prep.error = "";
  const screenEl = PREP_SCREENS[prep.stage === "clarify" ? "clarify" : "input"]();
  showPrepStatus(screenEl, { busy: "preparing" });
  snapshotReady(prep.stage === "clarify" ? "clarify" : "input");
  try {
    if (anna?.storage?.set && !(await taskStore.flush())) {
      throw new Error("Couldn't save your input — keep this window open and retry.");
    }
    if (gen !== prepGen || !ownsTask(taskId, taskGen)) return;
    const drafted = await faithfulPlan(prepRequestPayload());
    if (gen !== prepGen || !ownsTask(taskId, taskGen)) return;
    const { value, model } = drafted;
    prep.busy = null;
    prep.error = "";
    if (value.kind === "clarify") {
      prep.question = value.question;
      prep.stage = "clarify";
    } else {
      prep.plan = {
        opening: value.opening,
        keyPoint: value.keyPoint,
        approach: value.approach,
        objection: value.objection,
        response: value.response,
        nextStep: value.nextStep,
      };
      prep.planModel = model;
      prep.planSource = "ai";
      prep.stage = "plan";
      if (drafted.issues?.length) prep.error = prep.faithfulnessNote;
    }
    hidePrepStatus();
    renderPrepStage();
    if (prep.faithfulnessNote && prep.stage === "plan") noteFaithfulness(drafted.issues, "prep-plan");
  } catch (e) {
    if (gen !== prepGen || !ownsTask(taskId, taskGen)) return;
    prep.busy = null;
    prep.error = String(e?.message || "Preparation isn't available right now.").slice(0, 300);
    showPrepStatus(screenEl, { error: prep.error });
    snapshotReady(prep.stage === "clarify" ? "clarify" : "input");
  }
}

async function runRehearsalRequest() {
  if (prep.busy) return;
  if (!prep.reply.trim()) {
    prep.error = "Write how you'd answer first — then ask for the adjustment.";
    showPrepStatus(els.screens.prepPractice, { error: prep.error });
    els.btnPrepRetry.hidden = true;
    els.btnPrepAlt.hidden = true;
    return;
  }
  const gen = ++prepGen;
  const taskId = task?.id;
  const taskGen = taskGeneration;
  prep.busy = "rehearsing";
  prep.error = "";
  showPrepStatus(els.screens.prepPractice, { busy: "rehearsing" });
  snapshotReady("practice");
  try {
    if (anna?.storage?.set && !(await taskStore.flush())) {
      throw new Error("Couldn't save your answer — keep this window open and retry.");
    }
    if (gen !== prepGen || !ownsTask(taskId, taskGen)) return;
    const rehearsalInput = {
      event: prep.input.event,
      goal: prep.input.goal,
      keyPoint: prep.input.keyPoint,
      preserve: prep.input.preserve || "",
      wordingStyle: prep.wordingStyle,
      clarification: prep.clarificationUsed
        ? { question: prep.question, answer: prep.clarification || null }
        : null,
      plan: prep.plan,
      reply: prep.reply,
    };
    let { value, model } = await requestRehearsal(anna, rehearsalInput);
    if (gen !== prepGen || !ownsTask(taskId, taskGen)) return;
    const source = rehearsalSource(rehearsalInput);
    let issues = faithfulnessIssues(value, source, REHEARSAL_FACT_FIELDS);
    if (issues.length && !prep.rehearsalRetried) {
      prep.rehearsalRetried = true;
      try {
        const again = await requestRehearsal(anna, {
          ...rehearsalInput,
          droppedFacts: [...new Set(issues.flatMap((issue) => issue.spans))],
        });
        if (gen !== prepGen || !ownsTask(taskId, taskGen)) return;
        value = again.value;
        model = again.model;
        issues = faithfulnessIssues(value, source, REHEARSAL_FACT_FIELDS);
      } catch { /* blank the ungrounded note from the first reply */ }
    }
    if (issues.length) value = withholdUngrounded(value, issues);
    prep.quoteNote = "";
    if (value.adjustment && !quotesReply(value.adjustment, prep.reply)) {
      value = { ...value, adjustment: "" };
      prep.quoteNote = "The note didn't use your words, so it isn't shown.";
    }
    prep.busy = null;
    prep.error = issues.length ? faithfulnessMessage(issues) : "";
    prep.faithfulnessNote = prep.error;
    prep.feedback = {
      adjustment: value.adjustment,
      response: value.response,
      nextStep: value.nextStep,
    };
    prep.feedbackModel = model;
    prep.stage = "feedback";
    hidePrepStatus();
    renderPrepStage();
    if (issues.length) noteFaithfulness(issues, "prep-feedback");
    else if (prep.quoteNote) {
      mascot("prep-feedback")?.setState("watching");
      mascot("prep-feedback")?.setOptions({ lookAt: document.getElementById("prep-adjustment") });
    }
  } catch (e) {
    if (gen !== prepGen || !ownsTask(taskId, taskGen)) return;
    prep.busy = null;
    prep.error = String(e?.message || "The adjustment isn't available right now.").slice(0, 300);
    showPrepStatus(els.screens.prepPractice, { error: prep.error });
    snapshotReady("practice");
  }
}

const PLAN_FIELDS = [
  ["opening", els.prepOpening],
  ["keyPoint", els.prepKeypointEdit],
  ["approach", els.prepApproach],
  ["response", els.prepResponse],
  ["nextStep", els.prepNextstep],
];

function schedulePrepEdit() {
  clearTimeout(prepEditTimer);
  prepEditTimer = setTimeout(() => {
    if (task?.flow === "ready") snapshotReady(prep.stage);
  }, 300);
}

function prepFinalValues() {
  return {
    response: prep.finalResponse ?? prep.feedback?.response ?? prep.plan?.response ?? "",
    nextStep: prep.finalNextStep ?? prep.feedback?.nextStep ?? prep.plan?.nextStep ?? "",
  };
}

function prepCardComplete() {
  if (!prep.plan) return false;
  const { response, nextStep } = prepFinalValues();
  return ["opening", "keyPoint", "approach", "objection"].every((k) => prep.plan[k].trim())
    && Boolean(response.trim());
}

function renderPrepStage() {
  hidePrepStatus();
  const screenEl = PREP_SCREENS[prep.stage]();
  for (const c of screenEl.querySelectorAll("button, textarea, input")) {
    if (!els.prepStatus.contains(c)) c.disabled = false;
  }
  if (prep.stage === "input") {
    syncPrepInputs();
    prepKindChips();
    renderPrepSuggestion();
    updatePrepSourceGate();
  } else if (prep.stage === "clarify") {
    els.prepQuestion.textContent = prep.question;
    els.prepClarification.value = prep.clarification;
  } else if (prep.stage === "interview") {
    renderPrepInterview();
  } else if (prep.stage === "plan") {
    for (const [key, el] of PLAN_FIELDS) el.value = prep.plan?.[key] ?? "";
    els.prepObjection.textContent = prep.plan?.objection ?? "";
    renderGrounding();
  } else if (prep.stage === "practice") {
    els.prepPracticeObjection.textContent = prep.plan?.objection ?? "";
    els.prepReply.value = prep.reply;
  } else if (prep.stage === "feedback") {
    els.prepAdjustment.textContent = prep.feedback?.adjustment || prep.quoteNote || "";
    els.prepFinalResponse.value = prepFinalValues().response;
    els.prepFinalNextstep.value = prepFinalValues().nextStep;
  } else if (prep.stage === "card") {
    renderPrepCard();
    els.cardSaveNote.textContent = prep.saved ? "Saved." : "This card hasn't been saved yet.";
    els.cardSaveNote.hidden = false;
    els.btnCardSaveRetry.hidden = prep.saved;
  }
  show(screenEl);
  if (prep.error) showPrepStatus(screenEl, { error: prep.error });
  snapshotReady(prep.stage);
}

function currentSayable() {
  const p = prep.plan || {};
  return sayableParagraph({
    opening: p.opening,
    keyPoint: p.keyPoint,
    nextStep: prepFinalValues().nextStep,
  });
}

function renderGrounding() {
  const source = preparationSource({
    ...prep.input,
    clarification: prep.clarificationUsed
      ? { question: prep.question, answer: prep.clarification }
      : null,
  });
  for (const [key] of PLAN_FIELDS) {
    const hint = document.getElementById(`ground-${key}`);
    if (!hint) continue;
    const spans = groundedSpans(prep.plan?.[key] || "", source);
    hint.hidden = spans.length === 0;
    hint.textContent = spans.length ? `From what you wrote: ${spans.join(", ")}` : "";
  }
}

function prepCardText() {
  const lines = [];
  const sayable = (els.cardSayable?.textContent || "").trim();
  if (sayable) {
    lines.push(sayable);
    lines.push("");
    lines.push("—");
    lines.push("");
  }
  lines.push("Brume preparation card");
  lines.push("");
  const goal = (els.cardGoal.textContent || "").trim();
  if (goal && goal !== "—") lines.push(`Goal: ${goal}`);
  const pairs = [
    ["Opening", els.cardOpening],
    ["Key point", els.cardKeypoint],
    ["Approach", els.cardApproach],
    ["Possible pushback", els.cardObjection],
    ["Response", els.cardResponse],
    ["Next step", els.cardNextstep],
  ];
  for (const [label, el] of pairs) {
    const v = (el?.textContent || "").trim();
    if (v) lines.push(`${label}: ${v}`);
  }
  const adj = (els.cardAdjustment?.textContent || "").trim();
  if (adj) lines.push(adj);
  lines.push("");
  lines.push("Not a script. Take what helps.");
  return lines.join("\n");
}

async function exportPrepCard() {
  const text = prepCardText();
  let copied = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch {}
  // Always also offer a file download so the card can be saved/taken along.
  try {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `brume-preparation-card-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {}
  toast(copied ? "Card copied and downloaded." : "Card downloaded.");
}

function printPrepCard() {
  document.body.classList.add("printing-card");
  // Ensure the card screen is the only visible content.
  window.print();
  setTimeout(() => document.body.classList.remove("printing-card"), 300);
}

// Where a card's source came from. "answered" is a card the person
// wrote in the interview: every field is text they typed, so the card
// quotes those words. "typed"/"edited" is the window form.
function prepSourceLabel(provenance) {
  if (provenance === "answered") return "Prepared from what you wrote:";
  return "Prepared from your words:";
}

function renderPrepCard() {
  if (!cardViewOnly && els.prefDetails && els.cardPrefSlot) {
    els.cardPrefSlot.appendChild(els.prefDetails);
  }
  const p = prep.plan || {};
  const { response, nextStep } = prepFinalValues();
  els.cardGoal.textContent = prep.input.goal || prep.input.event || "—";
  els.cardSayable.textContent = currentSayable();
  els.cardSayable.hidden = !els.cardSayable.textContent.trim();
  els.cardOpening.textContent = p.opening ?? "";
  els.cardKeypoint.textContent = p.keyPoint ?? "";
  els.cardApproach.textContent = p.approach ?? "";
  els.cardObjection.textContent = p.objection ?? "";
  els.cardResponse.textContent = response;
  els.cardNextstep.textContent = nextStep;
  els.cardAdjustment.hidden = !prep.feedback?.adjustment;
  els.cardAdjustment.textContent = prep.feedback?.adjustment
    ? `Rehearsal note: ${prep.feedback.adjustment}`
    : "";
  // The card always carries its source: a reviewer reading the result
  // sees exactly which words grounded it, so a model-invented situation
  // shows up here instead of hiding in a form field.
  const src = (prep.input.event || "").trim();
  const prov = prep.sourceProvenance;
  if (src) {
    els.cardSource.hidden = false;
    els.cardSource.textContent = prepSourceLabel(prov);
    els.cardSourceText.hidden = false;
    els.cardSourceText.textContent = `“${src}”`;
  } else {
    els.cardSource.hidden = true;
    els.cardSourceText.hidden = true;
  }
  els.prepCardTitle.textContent = prep.feedback
    ? "Your preparation card"
    : "Your preparation card — not rehearsed";
}

function prepCardRecord() {
  const p = prep.plan || {};
  const { response, nextStep } = prepFinalValues();
  return {
    completedAt: prep.completedAt,
    event: prep.input.event,
    goal: prep.input.goal,
    keyPoint: prep.input.keyPoint,
    preserve: prep.input.preserve || "",
    kind: prep.input.kind,
    wordingStyle: prep.wordingStyle,
    clarification: prep.clarificationUsed
      ? { question: prep.question, answer: prep.clarification || null }
      : null,
    opening: p.opening ?? "",
    preparedKeyPoint: p.keyPoint ?? "",
    approach: p.approach ?? "",
    objection: p.objection ?? "",
    response,
    nextStep,
    sayable: currentSayable(),
    rehearsed: Boolean(prep.feedback),
    adjustment: prep.feedback?.adjustment ?? null,
    reply: prep.reply || null,
    planModel: prep.planModel ?? null,
    planSource: prep.planSource ?? null,
    sourceProvenance: prep.sourceProvenance,
    feedbackModel: prep.feedbackModel ?? null,
    source: "app",
    // The interview audit: the model's draft beside what the person
    // actually wrote, field by field, plus the day they named. A
    // reviewer can compare the card against the typed text directly.
    ...(prep.interviewAudit ? { interview: prep.interviewAudit } : {}),
  };
}

const prepCardSaves = new WeakSet();
async function savePrepCard() {
  const state = prep;
  if (state.saved || prepCardSaves.has(state)) return;
  const record = prepCardRecord();
  const taskId = task?.id;
  const taskGen = taskGeneration;
  if (!anna?.storage?.set) {
    els.cardSaveNote.textContent = "Not connected — this card wasn't saved.";
    els.cardSaveNote.hidden = false;
    els.btnCardSaveRetry.hidden = true;
    return;
  }
  prepCardSaves.add(state);
  els.cardSaveNote.textContent = "Saving…";
  els.cardSaveNote.hidden = false;
  els.btnCardSaveRetry.hidden = true;
  try {
    snapshotReady("card");
    if (!(await taskStore.flush())) throw new Error("Checkpoint failed");
    if (!ownsTask(taskId, taskGen) || prep !== state) return;
    unwrapHostResponse(
      await anna.storage.set({
        key: `ready/sessions/${record.completedAt}`,
        value: record,
        scope: "user",
      }),
    );
    unwrapHostResponse(
      await anna.storage.set({ key: "ready/last", value: record, scope: "user" }),
    );
    state.saved = true;
    if (!ownsTask(taskId, taskGen) || prep !== state) return;
    els.cardSaveNote.textContent = "Saved.";
    els.cardSaveNote.hidden = false;
  } catch {
    if (!ownsTask(taskId, taskGen) || prep !== state) return;
    els.cardSaveNote.textContent = "Couldn't save this card.";
    els.cardSaveNote.hidden = false;
    els.btnCardSaveRetry.hidden = false;
  } finally {
    prepCardSaves.delete(state);
  }
  if (ownsTask(taskId, taskGen) && prep === state && task?.flow === "ready") {
    snapshotReady("card");
  }
}

async function gotoCard() {
  const taskId = task?.id;
  const gen = taskGeneration;
  if (!prepCardComplete()) {
    prep.error = "Fill in the empty fields — or put the suggestion back — before saving your card.";
    showPrepStatus(PREP_SCREENS[prep.stage](), { error: prep.error });
    els.btnPrepRetry.hidden = true;
    els.btnPrepAlt.hidden = true;
    return;
  }
  if (!prep.completedAt) prep.completedAt = new Date().toISOString();
  prep.saved = false;
  prep.error = "";
  prep.stage = "card";
  renderPrepStage();
  if (taskStore) {
    const ok = await taskStore.flush();
    if (!ownsTask(taskId, gen)) return;
    if (!ok) {
      els.cardSaveNote.textContent = "Couldn't save your progress — keep this window open and retry.";
      els.cardSaveNote.hidden = false;
      els.btnCardSaveRetry.hidden = false;
      return;
    }
  }
  savePrepCard();
}

async function showLastPreparation() {
  const taskId = task?.id;
  const gen = taskGeneration;
  let record = null;
  try {
    record = storageValue(
      await anna.storage.get({ key: "ready/last", scope: "user" }),
    );
  } catch {}
  if (!ownsTask(taskId, gen)) return;
  if (!record || typeof record !== "object") {
    toast("No saved preparation found.");
    return;
  }
  cardViewOnly = true;
  els.cardGoal.textContent = record.goal || record.event || "—";
  els.cardSayable.textContent = record.sayable
    || sayableParagraph({ opening: record.opening, keyPoint: record.preparedKeyPoint, nextStep: record.nextStep });
  els.cardSayable.hidden = !els.cardSayable.textContent.trim();
  els.cardOpening.textContent = record.opening ?? "";
  els.cardKeypoint.textContent = record.preparedKeyPoint ?? "";
  els.cardApproach.textContent = record.approach ?? "";
  els.cardObjection.textContent = record.objection ?? "";
  els.cardResponse.textContent = record.response ?? "";
  els.cardNextstep.textContent = record.nextStep ?? "";
  els.cardAdjustment.hidden = !record.adjustment;
  els.cardAdjustment.textContent = record.adjustment ? `Rehearsal note: ${record.adjustment}` : "";
  const recSrc = (record.sourceText || record.event || "").trim();
  if (recSrc) {
    els.cardSource.hidden = false;
    els.cardSource.textContent = prepSourceLabel(record.sourceProvenance);
    els.cardSourceText.hidden = false;
    els.cardSourceText.textContent = `“${recSrc}”`;
  } else {
    els.cardSource.hidden = true;
    els.cardSourceText.hidden = true;
  }
  els.prepCardTitle.textContent = record.rehearsed
    ? "Your preparation card"
    : "Your preparation card — not rehearsed";
  els.cardSaveNote.hidden = true;
  els.btnCardSaveRetry.hidden = true;
  els.btnCardDone.hidden = true;
  els.btnCardHome.hidden = false;
  show(els.screens.prepCard);
  mascot("prep-card")?.react("celebrate");
}

// --- entry_payload ------------------------------------------------------------

function applyEntryPayload(payload) {
  if (!payload || typeof payload !== "object") return false;
  const json = JSON.stringify(payload);
  if (json === lastAppliedPayloadJson) return false;
  if (task || loadBlocked()) {
    pendingChoice = { payload };
    updateTaskBanner();
    return false;
  }
  lastAppliedPayloadJson = json;
  const ctx = typeof payload.context === "string" ? payload.context : "";
  const mode = payload.mode || "ready";
  if (mode === "ready") {
    // Anna's reading, not the source. It is shown as a suggestion and
    // the person writes the situation themselves — the card's facts are
    // grounded in what they write, never in the model's prose.
    const handoff = parseReadyHandoff(payload);
    startPreparation();
    const s = handoff.suggestion;
    if (s.event || s.goal || s.keyPoint || s.preserve) {
      prep.suggestion = s;
      prep.sourceProvenance = "handoff";
    }
    if (handoff.interview) {
      // brume_prepare drafted the card in chat; the window shows each
      // drafted field masked and the person writes every part here.
      // The draft is model-written, so nothing in it reaches the card —
      // only what the person types does.
      // The deadline-day prompt keys on the suggestion — the relay of
      // the person's own words — never on the model's draft, which could
      // invent a deadline the person never mentioned.
      const suggestionText = [s.event, s.goal, s.keyPoint, s.preserve]
        .filter(Boolean).join("\n");
      prep.interview = {
        draft: handoff.interview.fields,
        written: {},
        day: "",
        schedule: scheduleQuestion(suggestionText) || "",
      };
      prep.stage = "interview";
    }
    prepKindChips();
    syncPrepInputs();
    renderPrepSuggestion();
    updatePrepSourceGate();
    renderPrepStage();
    snapshotReady(prep.stage);
    return true;
  }
  if (mode === "alertness") {
    buildKssRow();
    alertKss = null;
    els.kssHint.textContent = "";
    els.kssRow.querySelectorAll("button").forEach((x) => x.classList.remove("selected"));
    beginTask("alert", "setup", { kss: null });
    showAlertSetup();
    return true;
  }
  if (mode === "arrive") {
    buildFeelingRing();
    resetArrive();
    const f = arriveFeelingFromPayload(payload.feeling);
    if (f) pickFeeling(f.id);
    show(els.screens.arrive);
    return true;
  }
  if (ctx) els.contextInput.value = ctx.slice(0, 200);
  beginTask("reset", "planning", { context: els.contextInput.value });
  // Auto-run planning (never auto-start the session itself).
  startPlanning();
  return true;
}

async function loadActiveTask({ apply = false } = {}) {
  if (!taskStore) return null;
  let checkpoint;
  try {
    checkpoint = await taskStore.load();
  } catch {
    // validation/unwrap threw — treat like a corrupt checkpoint.
    // NEVER erase the stored value; it is kept for inspection.
    taskStore.lastLoad = { state: "corrupt", raw: null };
  }
  const state = taskStore.lastLoad.state;
  if (state === "error") {
    bannerMode = "error";
    updateTaskBanner();
    return null;
  }
  if (state === "corrupt") {
    bannerMode = "corrupt";
    updateTaskBanner();
    return null;
  }
  bannerMode = null;
  task = checkpoint;
  if (task && apply) {
    try {
      hydrateTask(task);
    } catch {
      // A checkpoint that passed validation but broke restore is corrupt —
      // drop it from memory, reset half-applied work, keep the stored raw.
      task = null;
      bannerMode = "corrupt";
      taskStore.lastLoad = { state: "corrupt", raw: checkpoint };
      try { invalidateTaskWork(); } catch { /* half-applied cleanup */ }
      updateTaskBanner();
      return null;
    }
  }
  if (!task && pendingChoice?.payload) {
    const p = pendingChoice.payload;
    pendingChoice = null;
    applyEntryPayload(p);
  }
  updateTaskBanner();
  return task;
}

function hydrateTask(checkpoint) {
  invalidateTaskWork();
  const data = checkpoint.data || {};
  if (checkpoint.flow === "reset") hydrateReset(checkpoint.screen, data);
  else if (checkpoint.flow === "ready") hydrateReady(checkpoint.screen, data);
  else if (checkpoint.flow === "alert") hydrateAlert(checkpoint.screen, data);
  updateTaskBanner();
}

function hydrateReset(screen, data) {
  context = data.context ?? "";
  els.contextInput.value = context;
  selectedFelt = data.felt ?? null;
  pendingResult = data.pendingResult ?? null;
  resultState = null;
  plan = data.plan ?? null;
  if (SOUND_MODES.includes(data.soundMode)) soundMode = data.soundMode;
  if (screen === "plan" || screen === "planning" || screen === "input") {
    if (plan) showPlan(plan);
    else {
      toast("That planning step was interrupted — try again when you're ready.");
      show(els.screens.home);
    }
    return;
  }
  if (screen === "session" && plan) {
    clock = data.clock && Number.isFinite(data.clock.elapsedMs)
      ? { elapsedMs: data.clock.elapsedMs, runningSince: null }
      : createSessionClock();
    tracker = data.tracker && Number.isFinite(data.tracker.tauMs)
      ? data.tracker
      : createTempoTracker();
    paceIdx = Number.isInteger(data.paceIdx)
      ? Math.max(0, Math.min(PACE_LEVELS.length - 1, data.paceIdx))
      : 1;
    finishing = false;
    lastPhase = null;
    tickCount = 0;
    sessionWasRunning = false;
    els.pause.textContent = "Resume";
    els.sessionPattern.textContent = `${PATTERNS[plan.pattern].name} · ${plan.title}`;
    els.target.textContent = fmtSeconds(effectiveLength().effectiveSeconds);
    updatePaceUI();
    show(els.screens.session);
    tick();
    timer = setInterval(tick, TICK_MS);
    return;
  }
  if (screen === "checkin" && pendingResult && plan) {
    show(els.screens.checkin);
    return;
  }
  if (screen === "result" && pendingResult && plan) {
    const pat = PATTERNS[plan.pattern];
    const qualifies = pendingResult.activeSeconds >= 1;
    resultState = {
      record: buildCompletionRecord({
        context,
        pattern: plan.pattern,
        plannedSeconds: plan.seconds,
        activeSeconds: pendingResult.activeSeconds,
        cycles: pendingResult.cycles,
        interrupted: pendingResult.interrupted,
        felt: selectedFelt,
        planSource: plan.planSource,
        planModel: plan.planModel ?? null,
        reflectionModel: data.result.reflectionModel ?? null,
        reflection: data.result.reflectionStatus === "ready" ? data.result.reflection : "",
        source: "app",
        now: Date.parse(data.result.completedAt) || Date.now(),
      }),
      reflection: data.result.reflection ?? null,
      reflectionStatus: data.result.reflectionStatus ?? "pending",
      reflectionModel: data.result.reflectionModel ?? null,
      recordSaved: Boolean(data.result.recordSaved),
      facts: {
        context,
        patternName: pat.name,
        activeSeconds: pendingResult.activeSeconds,
        plannedSeconds: plan.seconds,
        effectiveSeconds: effectiveLength().effectiveSeconds,
        cycles: pendingResult.cycles,
        interrupted: pendingResult.interrupted,
        felt: selectedFelt,
      },
    };
    const pending = resultState.reflectionStatus === "pending";
    els.resultHeading.textContent = pendingResult.interrupted ? "Ended early" : "Reset complete";
    mascot("result")?.setState(pendingResult.interrupted ? "idle" : "proud");
    if (!pendingResult.interrupted) mascot("result")?.react("celebrate");
    renderResult({
      heading: els.resultHeading.textContent,
      pattern: pat.name,
      activeSeconds: pendingResult.activeSeconds,
      cycles: pendingResult.cycles,
      reflection: pending
        ? "The AI note didn't finish — retry it, or save without it."
        : resultState.reflectionStatus === "unavailable" ? "AI note unavailable." : resultState.reflection,
      qualifies,
    });
    els.saveNote.hidden = true;
    els.btnSaveRetry.hidden = true;
    els.btnReflectRetry.hidden = !pending;
    els.btnSaveAnyway.hidden = !pending;
    els.btnReflectRetry.disabled = false;
    if (!qualifies) {
      els.saveNote.textContent = "Under one active second — nothing was saved.";
      els.saveNote.hidden = false;
    } else if (!resultState.recordSaved) {
      els.saveNote.textContent = "This session wasn't saved yet.";
      els.saveNote.hidden = false;
      els.btnSaveRetry.hidden = false;
    }
    show(els.screens.result);
    return;
  }
  show(els.screens.home);
}

function hydrateReady(screen, data) {
  if (data.prep && typeof data.prep === "object") {
    prep = { ...newPrepState(), ...data.prep };
    prep.input = { ...newPrepState().input, ...data.prep.input };
  } else {
    prep = newPrepState();
  }
  cardViewOnly = false;
  els.btnCardDone.hidden = false;
  els.btnCardHome.hidden = true;
  syncPrepInputs();
  if (prep.busy) {
    prep.busy = null;
    prep.error = "That step was interrupted before the AI answered — retry when you're ready.";
  }
  if (screen === "pause" && data.pause) {
    readyPlan = prep.plan
      ? { opener: prep.plan.opening, keyPoint: prep.plan.keyPoint, reminder: prep.plan.approach }
      : null;
    readyReturn = data.pause.return === "practice" ? "practice" : "plan";
    readyStep = Math.max(0, Math.min(READY_STEPS.length - 1, data.pause.step ?? 0));
    readyStepElapsed = Math.max(0, data.pause.elapsedMs ?? 0);
    readyPaused = true;
    $("#btn-ready-pause").textContent = "Resume";
    runReadyStep({ resume: true });
    return;
  }
  prep.stage = Object.hasOwn(PREP_SCREENS, screen) ? screen : "input";
  renderPrepStage();
}

function hydrateAlert(screen, data) {
  buildKssRow();
  alertKss = Number.isInteger(data.kss) ? data.kss : null;
  if (alertKss) {
    const b = els.kssRow.children[alertKss - 1];
    if (b) {
      els.kssRow.querySelectorAll("button").forEach((x) => x.classList.remove("selected"));
      b.classList.add("selected");
      els.kssHint.textContent = KSS_LABELS[alertKss] || "";
    }
  }
  if (screen === "result" && data.metrics) {
    alertResultState = {
      metrics: data.metrics,
      kss: data.kss ?? null,
      band: data.band ?? null,
      baseline: data.baseline ?? null,
      checkCount: data.checkCount ?? null,
      baselinePending: Boolean(data.baselinePending),
      record: data.record ?? null,
      recordSaved: Boolean(data.recordSaved),
      note: data.note ?? "",
      noteSource: data.noteSource ?? "none",
    };
    els.alertSaveNote.hidden = alertResultState.recordSaved;
    els.btnAlertSaveRetry.hidden = true;
    if (!alertResultState.recordSaved) {
      els.alertSaveNote.textContent = "This check wasn't saved yet.";
      els.alertSaveNote.hidden = false;
      els.btnAlertSaveRetry.hidden = false;
    }
    renderAlertResult(alertResultState);
    return;
  }
  const interrupted = screen === "countdown" || screen === "test" || data.interrupted === true;
  showAlertSetup({ interrupted });
  if (interrupted) saveTask("setup", { kss: alertKss, interrupted: true });
}

// --- Boot -------------------------------------------------------------------------

let bootState = "loading";
let bootGeneration = 0;
let queuedBootPayload = null;
let currentWordingPreference = "natural";
let prefGeneration = 0;
let prefsBusy = false;

function setBootMessage(msg, { error = false } = {}) {
  els.startupMessage.textContent = msg;
  els.startupHelp.hidden = !error;
  els.btnStartupRetry.hidden = !error;
  els.startupPanel.hidden = false;
}

function updateHomeNav() {
  els.btnHomeNav.hidden = bootState !== "ready" || !els.screens.home.hidden;
}

function applyDaypart() {
  const h = new Date().getHours();
  const dp = h >= 5 && h < 8 ? "dawn" : h >= 8 && h < 17 ? "day" : h >= 17 && h < 21 ? "dusk" : "night";
  document.documentElement.dataset.daypart = dp;
}
applyDaypart();
setInterval(applyDaypart, 60000);

const boundRuntimes = new WeakSet();
const BOOT_WATCHDOG_MS = 15000;
async function initializeHost() {
  const gen = ++bootGeneration;
  bootState = "loading";
  // Overall boot watchdog — if anything after this stalls without reaching
  // ready/error, the app shows a retryable error instead of hanging.
  let watchdogMs = BOOT_WATCHDOG_MS;
  try {
    const h = location.hostname;
    if ((h === "localhost" || h === "127.0.0.1")
        && Number.isFinite(window.__BRUME_BOOT_WATCHDOG_MS)) {
      watchdogMs = window.__BRUME_BOOT_WATCHDOG_MS;
    }
  } catch { /* test hook is optional */ }
  const watchdog = setTimeout(() => {
    if (gen === bootGeneration && bootState === "loading") {
      bootState = "error";
      setBootMessage("Brume couldn't start.", { error: true });
      updateHomeNav();
    }
  }, watchdogMs);
  try {
    await initializeHostInner(gen);
  } catch {
    if (gen === bootGeneration) {
      bootState = "error";
      setBootMessage("Brume couldn't start.", { error: true });
      updateHomeNav();
    }
  } finally {
    clearTimeout(watchdog);
  }
}

async function initializeHostInner(gen) {
  setBootMessage("Connecting to Anna…");
  let runtime = null;
  try {
    runtime = await withTimeout(connectAnna(), 8000);
  } catch {
    runtime = null;
  }
  if (gen !== bootGeneration) return;
  anna = runtime;
  if (!anna) {
    bootState = "error";
    setBootMessage("Anna is not connected.", { error: true });
    updateHomeNav();
    return;
  }
  try {
    const h = location.hostname;
    if (h === "localhost" || h === "127.0.0.1") window.__brumeAnna = anna;
  } catch { /* test hook */ }
  // entry_payload: initial value, then live pushes when the assistant
  // re-invokes open_app_view with a payload.
  try {
    if (anna.entryPayload) queuedBootPayload = anna.entryPayload;
    if (typeof anna.on === "function" && !boundRuntimes.has(anna)) {
      boundRuntimes.add(anna);
      const rt = anna;
      anna.on("entry_payload", (payload) => {
        if (anna !== rt) return;
        if (bootState === "ready") applyEntryPayload(payload);
        else queuedBootPayload = payload;
      });
    }
  } catch { /* payload wiring is best-effort */ }
  taskStore = createCheckpointStore(anna, { onStatus: onTaskStatus });
  setBootMessage("Checking for unfinished work…");
  const restored = await loadActiveTask({ apply: true });
  if (gen !== bootGeneration) return;
  bootState = "ready";
  els.startupPanel.hidden = true;
  let payloadNavigated = false;
  if (queuedBootPayload) {
    const p = queuedBootPayload;
    queuedBootPayload = null;
    payloadNavigated = applyEntryPayload(p);
  }
  if (!task && !restored && !payloadNavigated) openConversation();
  updateHomeNav();
  loadOptionalData(gen);
}

function loadOptionalData(gen) {
  try {
    loadOptionalDataInner(gen);
  } catch { /* best-effort; boot already succeeded */ }
}
function loadOptionalDataInner(gen) {
  const rt = anna;
  const soundRev = ++soundRevision;
  if (rt) {
    withTimeout(loadSummary(rt), 8000)
      .then((s2) => { if (gen === bootGeneration && anna === rt) summary = s2; })
      .catch(() => {});
    withTimeout(loadPrefs(rt), 8000)
      .then((p2) => {
        if (gen === bootGeneration && anna === rt
          && soundRev === soundRevision && task?.flow !== "reset"
          && SOUND_MODES.includes(p2.sound)) {
          prefs = p2;
          soundMode = p2.sound;
        }
      })
      .catch(() => {});
  }
  refreshHomeMeta();
  refreshAlertLine();
  loadWording(gen);
}

async function loadWording(gen) {
  if (!anna?.storage?.get) { renderPrefUI("unavailable"); return; }
  await doPrefLoad(gen);
}

const PREF_LABEL = { natural: "Natural", concise: "Shorter", direct: "More direct" };
let prefRetryAction = null;
function renderPrefUI(state) {
  if (!els.prefStatus) return;
  els.wordingSelect.value = normaliseWordingStyle(
    state === "ready" || state === "saved" ? currentWordingPreference : els.wordingSelect.value);
  els.btnPrefSave.disabled = prefsBusy;
  els.btnPrefForget.disabled = prefsBusy;
  els.wordingSelect.disabled = prefsBusy;
  els.btnPrefRetry.hidden = !["load-error", "save-error", "forget-error"].includes(state);
  const msgs = {
    loading: "Checking saved preference…",
    saving: "Saving preference…",
    removing: "Removing preference…",
    ready: currentWordingPreference === "natural" ? "No saved preference (Natural)." : `Remembered: ${PREF_LABEL[currentWordingPreference]}.`,
    "load-error": "Couldn't check your preference — Retry.",
    "save-error": "Couldn't save your preference — Retry.",
    "forget-error": "Couldn't remove your preference — Retry.",
    saved: currentWordingPreference === "natural" ? "No saved preference (Natural)." : `Remembered: ${PREF_LABEL[currentWordingPreference]}.`,
    forgotten: "Preference removed.",
    unavailable: "Not connected — preferences aren't saved.",
  };
  els.prefStatus.textContent = msgs[state] || "";
}

async function doPrefLoad(gen = bootGeneration) {
  prefsBusy = true;
  renderPrefUI("loading");
  const myGen = ++prefGeneration;
  const rt = anna;
  try {
    const style = await loadWordingPreference(rt);
    if (myGen !== prefGeneration || gen !== bootGeneration || anna !== rt) return;
    currentWordingPreference = style;
    prefsBusy = false;
    renderPrefUI("ready");
  } catch {
    if (myGen !== prefGeneration || gen !== bootGeneration || anna !== rt) return;
    prefsBusy = false;
    prefRetryAction = "load";
    renderPrefUI("load-error");
  }
}

async function doPrefSave(style) {
  if (!anna || prefsBusy) { renderPrefUI("unavailable"); return; }
  prefsBusy = true;
  renderPrefUI("saving");
  const rt = anna;
  try {
    const saved = await saveWordingPreference(rt, style);
    currentWordingPreference = saved;
    prefGeneration += 1;
    prefsBusy = false;
    prefRetryAction = null;
    renderPrefUI("saved");
  } catch {
    prefsBusy = false;
    prefRetryAction = `save:${style}`;
    renderPrefUI("save-error");
  }
}

async function doPrefForget() {
  if (!anna || prefsBusy) { renderPrefUI("unavailable"); return; }
  prefsBusy = true;
  renderPrefUI("removing");
  const rt = anna;
  try {
    await saveWordingPreference(rt, "natural");
    currentWordingPreference = "natural";
    prefGeneration += 1;
    prefsBusy = false;
    prefRetryAction = null;
    els.wordingSelect.value = "natural";
    renderPrefUI("forgotten");
  } catch {
    prefsBusy = false;
    prefRetryAction = "forget";
    renderPrefUI("forget-error");
  }
}

async function main() {
  chime = new ChimePlayer();

  for (const b of document.querySelectorAll("[data-context]")) {
    b.addEventListener("click", () => {
      els.contextInput.value = b.dataset.context;
      els.contextInput.focus();
    });
  }
  els.btnPlan.addEventListener("click", () =>
    requestNewTask(() => {
      beginTask("reset", "planning", { context: els.contextInput.value.trim().slice(0, 200) });
      startPlanning();
    }),
  );
  els.contextInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") els.btnPlan.click();
  });
  els.btnQuick.addEventListener("click", () =>
    requestNewTask(() => {
      context = els.contextInput.value.trim().slice(0, 200);
      beginTask("reset", "planning", { context });
      quickPlan();
    }),
  );
  els.btnSkipPlan.addEventListener("click", () => {
    planningToken += 1;
    const p = fallbackPlan(context);
    p.offline = true;
    if (!task) beginTask("reset", "planning", { context });
    showPlan(p);
  });
  for (const b of els.soundChips.querySelectorAll(".chip")) {
    b.addEventListener("click", () => {
      soundMode = b.dataset.sound;
      soundRevision += 1;
      renderPlanControls();
      prefs = { ...prefs, sound: soundMode };
      if (anna) savePrefs(anna, prefs).catch(() => {});
      if (task?.flow === "reset") snapshotReset(task.screen);
      if (soundMode === "chime" && chime) chime.play("inhale");
    });
  }
  for (const row of document.querySelectorAll(".adjust-row[data-adjust]")) {
    row.addEventListener("click", () => {
      const opts = row.nextElementSibling;
      const wasOpen = opts && !opts.hidden;
      for (const r2 of document.querySelectorAll(".adjust-row[data-adjust]")) {
        r2.setAttribute("aria-expanded", "false");
        if (r2.nextElementSibling?.classList.contains("adjust-opts")) {
          r2.nextElementSibling.hidden = true;
        }
      }
      if (opts?.classList.contains("adjust-opts") && !wasOpen) {
        opts.hidden = false;
        row.setAttribute("aria-expanded", "true");
      }
    });
  }
  els.begin.addEventListener("click", begin);
  els.again.addEventListener("click", async () => {
    if (resultState?.record?.activeSeconds >= 1 && !resultState.recordSaved && anna) {
      snapshotNow();
      show(els.screens.home);
      return;
    }
    await endTask();
    refreshHomeMeta();
    show(els.screens.home);
  });
  els.btnSaveRetry.addEventListener("click", saveResultRecord);
  els.btnReflectRetry.addEventListener("click", retryReflection);
  els.btnSaveAnyway.addEventListener("click", async () => {
    if (!resultState) return;
    reflectionRequest += 1;
    const s = resultState;
    const taskId = task?.id;
    const gen = taskGeneration;
    resultState.reflectionStatus = "unavailable";
    resultState.reflection = null;
    resultState.record.reflection = "";
    resultState.record.reflectionModel = null;
    els.btnReflectRetry.hidden = true;
    els.btnSaveAnyway.hidden = true;
    els.closingLine.textContent = "AI note unavailable.";
    if (task?.flow === "reset") snapshotReset("result");
    await saveResultRecord();
    if (ownsTask(taskId, gen) && resultState === s && s.recordSaved) {
      els.closingLine.textContent = "Saved without an AI note.";
    }
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
      if (soundMode === "chime") chime?.ensureContext();
      if (soundMode === "voice") primeVoice();
      els.pause.textContent = "Pause";
    }
    updatePaceUI();
    if (task?.flow === "reset") snapshotReset("session");
  });

  for (const b of document.querySelectorAll("[data-moment]")) {
    b.addEventListener("click", () => {
      if (loadBlocked()) return;
      if (task?.flow === "ready" && !pendingChoice && !cardViewOnly
          && task.data?.prep?.input?.event === MOMENTS[b.dataset.moment]?.event
          && els.screens.prepInput.hidden) {
        hydrateTask(task);
        return;
      }
      requestNewTask(() => startPreparation({ moment: b.dataset.moment }));
    });
  }
  els.btnReady.addEventListener("click", () => {
    if (task?.flow === "ready") {
      hydrateTask(task);
      return;
    }
    requestNewTask(startPreparation);
  });
  els.btnStartupRetry.addEventListener("click", () => {
    initializeHost().catch(() => {
      if (bootState === "loading") {
        bootState = "error";
        setBootMessage("Brume couldn't start.", { error: true });
        updateHomeNav();
      }
    });
  });
  els.btnPrefSave.addEventListener("click", () => doPrefSave(els.wordingSelect.value));
  els.btnPrefForget.addEventListener("click", doPrefForget);
  els.btnPrefRetry.addEventListener("click", () => {
    if (!prefRetryAction || prefsBusy) return;
    if (prefRetryAction === "load") doPrefLoad();
    else if (prefRetryAction === "forget") doPrefForget();
    else if (prefRetryAction.startsWith("save:")) doPrefSave(prefRetryAction.slice(5));
  });
  els.btnLastPrep.addEventListener("click", () => {
    if (loadBlocked()) return;
    showLastPreparation();
  });
  els.btnAlertness.addEventListener("click", () => {
    if (task?.flow === "alert") {
      hydrateTask(task);
      return;
    }
    requestNewTask(() => {
      buildKssRow();
      alertKss = null;
      els.kssHint.textContent = "";
      els.kssRow.querySelectorAll("button").forEach((x) => x.classList.remove("selected"));
      beginTask("alert", "setup", { kss: null });
      showAlertSetup();
    });
  });
  els.btnArrive.addEventListener("click", () => {
    if (loadBlocked()) return;
    buildFeelingRing();
    resetArrive();
    show(els.screens.arrive);
  });
  els.btnArriveGo.addEventListener("click", () => {
    const act = arriveSelection ? actFor(arriveSelection.id) : null;
    if (!act) {
      show(els.screens.home);
      return;
    }
    if (act === "scatter") enterScatter();
    else if (act === "setdown") enterSetdown();
  });
  els.btnArriveBack.addEventListener("click", resetArrive);
  els.btnScatterGo.addEventListener("click", () => scatterCtl?.letGo());
  els.btnScatterBack.addEventListener("click", backToArrive);
  els.btnScatterHome.addEventListener("click", () => show(els.screens.home));
  els.btnScatterAgain.addEventListener("click", enterScatter);
  els.btnSetdownBack.addEventListener("click", backToArrive);
  els.btnSetdownHome.addEventListener("click", () => show(els.screens.home));
  els.btnSetdownAgain.addEventListener("click", enterSetdown);
  $("#btn-alert-start").addEventListener("click", startAlertCountdown);
  $("#btn-alert-skip-kss").addEventListener("click", () => {
    alertKss = null;
    startAlertCountdown();
  });
  $("#btn-alert-cancel").addEventListener("click", () => {
    if (task?.flow === "alert") saveTask("setup", { kss: alertKss });
    showAlertSetup();
  });
  els.btnAlertSaveRetry.addEventListener("click", saveAlertRecord);
  $("#btn-alert-break").addEventListener("click", () => {
    if (alertResultState && !alertResultState.recordSaved && anna) {
      pendingChoice = {
        start: () => {
          beginTask("reset", "planning", { context: els.contextInput.value });
          quickPlan();
        },
      };
      updateTaskBanner();
      return;
    }
    const kss = alertKss ? `${alertKss}/9` : "not given";
    els.contextInput.value = `Alertness check: ${els.alertBand.textContent || "done"}, sleepiness ${kss}`.slice(0, 200);
    resetFlowGlobals();
    endTask().then((ok) => {
      if (!ok) return;
      beginTask("reset", "planning", { context: els.contextInput.value });
      quickPlan();
    });
  });
  $("#btn-alert-done").addEventListener("click", async () => {
    if (alertResultState && !alertResultState.recordSaved && anna) {
      saveTask("result", alertCheckpointData());
      show(els.screens.home);
      return;
    }
    await endTask();
    show(els.screens.home);
  });

  for (const el of [els.prepEvent, els.prepGoal, els.prepKeypoint, els.prepPreserve].filter(Boolean)) {
    el.addEventListener("input", () => {
      collectPrepInput();
      markSourceEngaged();
      schedulePrepEdit();
    });
  }
  els.prepClarification.addEventListener("input", () => {
    prep.clarification = els.prepClarification.value;
    schedulePrepEdit();
  });
  els.prepEvent.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#btn-prep-go").click(); }
  });
  $("#btn-prep-go").addEventListener("click", () => {
    ensurePrepTask();
    snapshotReady("input");
    runPreparationRequest();
  });
  $("#btn-prep-answer").addEventListener("click", () => {
    prep.clarification = els.prepClarification.value.trim().slice(0, 600);
    prep.clarificationUsed = true;
    runPreparationRequest();
  });
  $("#btn-prep-skip-clarify").addEventListener("click", () => {
    prep.clarification = "";
    prep.clarificationUsed = true;
    runPreparationRequest();
  });
  els.btnPrepInterviewGo.addEventListener("click", submitInterview);
  els.btnPrepInterviewManual.addEventListener("click", abandonInterview);
  for (const [key, el] of PLAN_FIELDS) {
    el.addEventListener("input", () => {
      if (!prep.plan) return;
      prep.plan[key] = el.value;
      renderGrounding();
      schedulePrepEdit();
    });
  }
  els.prepReply.addEventListener("input", () => {
    prep.reply = els.prepReply.value;
    schedulePrepEdit();
  });
  els.prepFinalResponse.addEventListener("input", () => {
    prep.finalResponse = els.prepFinalResponse.value;
    schedulePrepEdit();
  });
  els.prepFinalNextstep.addEventListener("input", () => {
    prep.finalNextStep = els.prepFinalNextstep.value;
    schedulePrepEdit();
  });
  $("#btn-prep-practice").addEventListener("click", () => {
    prep.error = "";
    prep.stage = "practice";
    renderPrepStage();
  });
  $("#btn-prep-finish").addEventListener("click", gotoCard);
  $("#btn-prep-pause").addEventListener("click", () => startGuidedPause("plan"));
  $("#btn-prep-adjust").addEventListener("click", () => {
    prep.reply = els.prepReply.value;
    runRehearsalRequest();
  });
  $("#btn-prep-back").addEventListener("click", () => {
    prep.error = "";
    prep.stage = "plan";
    renderPrepStage();
  });
  $("#btn-prep-card").addEventListener("click", gotoCard);
  $("#btn-prep-keep").addEventListener("click", () => {
    els.prepFinalResponse.value = prep.reply || els.prepFinalResponse.value;
    prep.finalResponse = els.prepFinalResponse.value;
    schedulePrepEdit();
  });
  els.btnPrepCancel.addEventListener("click", () => {
    prepGen += 1;
    prep.busy = null;
    hidePrepStatus();
    renderPrepStage();
  });
  els.btnPrepRetry.addEventListener("click", () => {
    prep.error = "";
    if (prep.stage === "practice") {
      prep.reply = els.prepReply.value;
      runRehearsalRequest();
    } else {
      runPreparationRequest();
    }
  });
  els.btnPrepAlt.addEventListener("click", () => {
    if (task) els.prepAltConfirm.hidden = false;
    else startBreathingAlternative();
  });
  els.btnPrepAltYes.addEventListener("click", () => {
    const ctx = prep.input.event;
    endTask().then((ok) => { if (ok) startBreathingAlternative(ctx); });
  });
  els.btnPrepAltNo.addEventListener("click", () => {
    els.prepAltConfirm.hidden = true;
  });
  els.btnCardSaveRetry.addEventListener("click", savePrepCard);
  if (els.btnCardExport) els.btnCardExport.addEventListener("click", exportPrepCard);
  if (els.btnCardPrint) els.btnCardPrint.addEventListener("click", printPrepCard);
  els.btnCardDone.addEventListener("click", async () => {
    if (!prep.saved && anna) {
      snapshotReady("card");
      show(els.screens.home);
      return;
    }
    await endTask();
    refreshHomeMeta();
    show(els.screens.home);
  });
  els.btnCardHome.addEventListener("click", () => {
    cardViewOnly = false;
    els.btnCardDone.hidden = false;
    els.btnCardHome.hidden = true;
    show(els.screens.home);
  });

  $("#btn-ready-next").addEventListener("click", nextReadyStep);
  $("#btn-ready-skip").addEventListener("click", nextReadyStep);
  $("#btn-ready-pause").addEventListener("click", () => {
    const step = READY_STEPS[readyStep];
    if (!readyPaused) {
      pauseReadyStep();
      if (step?.secs) {
        const left = Math.max(0, Math.round(step.secs - readyStepElapsed / 1000));
        els.readyTimer.textContent = `${left}s (paused)`;
      }
    } else {
      readyPaused = false;
      $("#btn-ready-pause").textContent = "Pause";
      runReadyStep({ resume: true });
      return;
    }
    if (task?.flow === "ready") snapshotReady("pause");
  });
  els.btnHear.addEventListener("click", () => {
    if (readyPlan?.opener && voice && !voice.failed) voice.play(readyPlan.opener);
  });

  // entry_payload: initial value, then live pushes when the assistant
  // re-invokes open_app_view with a payload.
  try {

  } catch {
    /* payload wiring is best-effort */
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    pauseAndSnapshotCurrent();
  });
  window.addEventListener("pagehide", () => {
    pauseAndSnapshotCurrent();
  });

  initializeHost().catch(() => {
    if (bootState === "loading") {
      bootState = "error";
      setBootMessage("Brume couldn't start.", { error: true });
      updateHomeNav();
    }
  });
  if (!task && !els.screens.home.hidden) updateTaskBanner();
  // The home screen is visible before any show() call — create its
  // mascot (and any other already-visible screen's) explicitly.
  for (const [key, conf] of Object.entries(SCREEN_MASCOT)) {
    if (!els.screens[key].hidden) mascot(conf.el)?.setState(conf.state);
  }
}

function startBreathingAlternative(ctx = prep.input.event) {
  /* fallback */
  els.contextInput.value = ctx.slice(0, 200);
  beginTask("reset", "planning", { context: els.contextInput.value });
  quickPlan();
}

main();
