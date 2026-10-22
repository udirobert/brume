import { PATTERNS, ALLOWED_LENGTHS } from "./plan.js";
import { PACE_TEMPO, withTimeout } from "./session.js";

export const ACTIVE_TASK_KEY = "brume/active-task";

const CHECKPOINT_VERSION = 1;
const MAX_ID_LEN = 128;
const MAX_DATA_BYTES = 120_000;
const MAX_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;

const READY_STAGES = ["input", "clarify", "plan", "practice", "feedback", "card"];
const READY_KINDS = ["interview", "presentation", "hard-conversation", "meeting"];
const PREP_BUSY = ["preparing", "rehearsing"];
const INPUT_TYPES = ["touch", "mouse", "keyboard"];

const SCREENS = {
  reset: ["input", "planning", "plan", "session", "checkin", "result"],
  ready: ["input", "clarify", "plan", "practice", "feedback", "card", "pause"],
  alert: ["setup", "countdown", "test", "result"],
};

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v, max) => typeof v === "string" && v.length <= max;
const num = (v) => Number.isFinite(v) && v >= 0;
const iso = (v) => typeof v === "string" && Number.isFinite(Date.parse(v));
const isoOrNull = (v) => v === null || iso(v);

function validReadyPlan(p) {
  if (!isObj(p)) return false;
  return ["opening", "keyPoint", "approach", "objection", "response", "nextStep"]
    .every((k) => str(p[k], 1000));
}

function validPrep(p) {
  if (!isObj(p)) return false;
  if (!READY_STAGES.includes(p.stage)) return false;
  if (!isObj(p.input)) return false;
  if (!str(p.input.event, 600)) return false;
  if (!str(p.input.goal, 300)) return false;
  if (!str(p.input.keyPoint, 220)) return false;
  if (p.input.preserve !== undefined && !str(p.input.preserve, 220)) return false;
  if (p.input.kind !== null && !READY_KINDS.includes(p.input.kind)) return false;
  if (p.wordingStyle !== undefined && !["natural", "concise", "direct"].includes(p.wordingStyle)) return false;
  if (p.planSource !== undefined && p.planSource !== null
    && !["ai", "anna-handoff"].includes(p.planSource)) return false;
  if (typeof p.clarificationUsed !== "boolean") return false;
  if (!str(p.question, 180)) return false;
  if (!str(p.clarification, 600)) return false;
  if (!str(p.reply, 1000)) return false;
  if (p.busy !== null && !PREP_BUSY.includes(p.busy)) return false;
  if (p.error !== undefined && !str(p.error, 300)) return false;
  if (!isoOrNull(p.completedAt)) return false;
  if (typeof p.saved !== "boolean") return false;
  if (p.plan !== null && !validReadyPlan(p.plan)) return false;
  if (["plan", "practice", "feedback", "card", "pause"].includes(p.stage) && !p.plan) return false;
  if (p.feedback !== null) {
    if (!isObj(p.feedback)) return false;
    if (!["adjustment", "response", "nextStep"].every((k) => str(p.feedback[k], 1000))) return false;
  }
  if (p.stage === "feedback" && !p.feedback) return false;
  if (p.finalResponse !== null && !str(p.finalResponse, 1000)) return false;
  if (p.finalNextStep !== null && !str(p.finalNextStep, 1000)) return false;
  return true;
}

function validResetPlan(p) {
  if (!isObj(p)) return false;
  return Object.hasOwn(PATTERNS, p.pattern)
    && ALLOWED_LENGTHS.includes(p.seconds)
    && str(p.title, 200)
    && str(p.opening, 400)
    && str(p.why, 300)
    && str(p.planSource, 60)
    && Array.isArray(p.cues)
    && p.cues.every((c) => str(c, 120));
}

function validResetData(screen, d) {
  if (!isObj(d) || !str(d.context, 400)) return false;
  if (screen === "input" || screen === "planning") return true;
  if (!validResetPlan(d.plan)) return false;
  if (d.soundMode !== undefined && !["off", "chime", "voice"].includes(d.soundMode)) return false;
  if (screen === "plan") return true;
  if (screen === "session") {
    if (!isObj(d.clock) || !num(d.clock.elapsedMs)) return false;
    if (!isObj(d.tracker)) return false;
    if (!num(d.tracker.tauMs) || !num(d.tracker.syncedElapsedMs)) return false;
    if (!Number.isFinite(d.tracker.tempo) || d.tracker.tempo <= 0
      || !Object.values(PACE_TEMPO).includes(d.tracker.tempo)) return false;
    if (!Number.isInteger(d.paceIdx) || d.paceIdx < 0 || d.paceIdx > 2) return false;
    return true;
  }
  if (!isObj(d.pendingResult)) return false;
  const pr = d.pendingResult;
  if (!num(pr.activeSeconds) || !num(pr.cycles) || typeof pr.interrupted !== "boolean") return false;
  if (screen === "checkin") return true;
  if (!isObj(d.result)) return false;
  if (!iso(d.result.completedAt)) return false;
  if (!["pending", "ready", "unavailable"].includes(d.result.reflectionStatus)) return false;
  if (d.result.reflection !== null && !str(d.result.reflection, 400)) return false;
  if (typeof d.result.recordSaved !== "boolean") return false;
  return true;
}

function validAlertData(screen, d) {
  if (!isObj(d)) return false;
  if (!(d.kss === null || d.kss === undefined || (Number.isInteger(d.kss) && d.kss >= 1 && d.kss <= 9))) {
    return false;
  }
  if (screen !== "result") return true;
  if (!isObj(d.metrics)) return false;
  for (const k of ["trials", "medianMs", "meanSpeed", "lapses", "falseStarts"]) {
    if (!num(d.metrics[k])) return false;
  }
  if (!INPUT_TYPES.includes(d.metrics.inputType)) return false;
  if (d.baseline !== null && d.baseline !== undefined && !num(d.baseline)) return false;
  if (d.checkCount !== undefined && d.checkCount !== null && !num(d.checkCount)) return false;
  if (d.baselinePending !== undefined && typeof d.baselinePending !== "boolean") return false;
  if (!isObj(d.record) || !iso(d.record.completedAt)) return false;
  return true;
}

function validReadyData(screen, d) {
  if (!isObj(d) || !validPrep(d.prep)) return false;
  if (screen !== "pause" && d.prep.stage !== screen) return false;
  if (screen === "pause"
    && !(d.prep.plan && ["plan", "practice"].includes(d.prep.stage))) return false;
  if (d.pause !== null && d.pause !== undefined) {
    if (!isObj(d.pause)) return false;
    if (!Number.isInteger(d.pause.step) || d.pause.step < 0 || d.pause.step > 3) return false;
    if (!num(d.pause.elapsedMs)) return false;
    if (d.pause.return !== undefined && !["plan", "practice"].includes(d.pause.return)) return false;
  }
  if (screen === "pause" && !isObj(d.pause)) return false;
  return true;
}

export function validateCheckpoint(value) {
  if (!isObj(value)) return null;
  if (value.version !== CHECKPOINT_VERSION) return null;
  if (!str(value.id, MAX_ID_LEN) || !value.id) return null;
  if (!Object.hasOwn(SCREENS, value.flow)) return null;
  if (!SCREENS[value.flow].includes(value.screen)) return null;
  if (!Number.isFinite(value.updatedAt) || value.updatedAt < 0
    || value.updatedAt > Date.now() + MAX_FUTURE_SKEW_MS) return null;
  if (!isObj(value.data)) return null;
  try {
    if (JSON.stringify(value.data).length > MAX_DATA_BYTES) return null;
  } catch {
    return null;
  }
  const dataOk =
    value.flow === "reset" ? validResetData(value.screen, value.data)
    : value.flow === "ready" ? validReadyData(value.screen, value.data)
    : validAlertData(value.screen, value.data);
  if (!dataOk) return null;
  return {
    version: CHECKPOINT_VERSION,
    id: value.id,
    flow: value.flow,
    screen: value.screen,
    updatedAt: value.updatedAt,
    data: value.data,
  };
}

function unwrapEnvelope(res) {
  if (res && typeof res === "object") {
    if (res.ok === false) {
      const err = res.error || {};
      const e = new Error(err.message || "storage request failed");
      e.code = err.code;
      throw e;
    }
    if (res.ok === true && "result" in res) return res.result;
  }
  return res;
}

function valueOf(res) {
  const r = unwrapEnvelope(res);
  if (r == null) return null;
  if (typeof r === "object" && "value" in r && !("version" in r)) return r.value;
  return r;
}

const CLEAR = Symbol("clear");

export function createCheckpointStore(anna, { onStatus = () => {}, timeoutMs = 8000 } = {}) {
  const host = anna?.storage;
  let next;
  let draining = null;

  const store = {
    lastLoad: { state: "not-loaded" },
    failed: undefined,

    async load() {
      if (typeof host?.get !== "function") {
        store.lastLoad = { state: "disconnected" };
        return null;
      }
      let res;
      try {
        res = await withTimeout(
          Promise.resolve(host.get({ key: ACTIVE_TASK_KEY, scope: "user" })),
          timeoutMs,
        );
      } catch (e) {
        store.lastLoad = { state: "error", error: e };
        return null;
      }
      let raw;
      try {
        raw = valueOf(res);
      } catch (e) {
        store.lastLoad = { state: "error", error: e };
        return null;
      }
      if (raw == null) {
        store.lastLoad = { state: "empty" };
        return null;
      }
      const checkpoint = validateCheckpoint(raw);
      if (!checkpoint) {
        store.lastLoad = { state: "corrupt", raw };
        return null;
      }
      store.lastLoad = { state: "ok" };
      return checkpoint;
    },

    save(checkpoint) {
      const valid = validateCheckpoint(checkpoint);
      if (!valid) {
        onStatus("error");
        return Promise.resolve(false);
      }
      next = JSON.parse(JSON.stringify(valid));
      if (!draining) draining = Promise.resolve().then(drain);
      return draining;
    },

    clear() {
      next = CLEAR;
      if (!draining) draining = Promise.resolve().then(drain);
      return draining;
    },

    retry() {
      if (draining) return draining;
      if (store.failed === undefined) return Promise.resolve(true);
      next = store.failed;
      store.failed = undefined;
      if (!draining) draining = Promise.resolve().then(drain);
      return draining;
    },

    async flush() {
      while (draining) await draining;
      return store.failed === undefined;
    },

    get clearFailed() {
      return store.failed === CLEAR;
    },
  };

  async function drain() {
    try {
      while (next !== undefined) {
        const item = next;
        next = undefined;
        if (typeof host?.set !== "function") {
          store.failed = item;
          onStatus("disconnected");
          continue;
        }
        onStatus("saving");
        try {
          unwrapEnvelope(
            await host.set({
              key: ACTIVE_TASK_KEY,
              value: item === CLEAR ? null : item,
              scope: "user",
            }),
          );
          store.failed = undefined;
          onStatus("saved");
        } catch (e) {
          store.failed = item;
          onStatus("error", e);
        }
      }
      return store.failed === undefined;
    } finally {
      draining = null;
      if (next !== undefined && !draining) draining = Promise.resolve().then(drain);
    }
  }

  return store;
}
