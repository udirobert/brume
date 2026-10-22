import { storageValue, unwrapHostResponse, withTimeout } from "./session.js";
import { normaliseWordingStyle } from "./experience.js";

const PREFS_KEY = "ready/preferences";
const LOAD_TIMEOUT_MS = 8000;

export async function loadWordingPreference(anna) {
  const res = await withTimeout(
    Promise.resolve(anna.storage.get({ key: PREFS_KEY, scope: "user" })),
    LOAD_TIMEOUT_MS,
  );
  const v = storageValue(res);
  if (!v || typeof v !== "object" || v.version !== 1) return "natural";
  return normaliseWordingStyle(v.wordingStyle);
}

export async function saveWordingPreference(anna, style) {
  const s = normaliseWordingStyle(style);
  if (s === "natural") {
    unwrapHostResponse(await anna.storage.set({ key: PREFS_KEY, value: null, scope: "user" }));
  } else {
    unwrapHostResponse(await anna.storage.set({
      key: PREFS_KEY, value: { version: 1, wordingStyle: s }, scope: "user",
    }));
  }
  return s;
}
