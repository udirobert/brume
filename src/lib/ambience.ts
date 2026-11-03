/**
 * Ambience — the room you hear. A material may carry a quiet ambient
 * bed (waves → ocean, snow → wind): the same atmosphere as the room,
 * just audible. Loops, fades on the room's own slow timescale, sits
 * under the spoken cues. Files live in public/ambience — local like
 * the voice cues; nothing is streamed or sent anywhere.
 */
import { type RoomMaterial } from "./roomExperience";

const AMBIENCE_FILES: Partial<Record<RoomMaterial, string>> = {
  waves: "/ambience/waves.mp3",
  snow: "/ambience/snow.mp3",
};

const PREF_KEY = "brume.ambienceEnabled";
const MAX_VOLUME = 0.16;
const FADE_MS = 1200;
const STEP_MS = 50;

export function ambienceFor(
  material: RoomMaterial | null | undefined,
): string | null {
  return material ? (AMBIENCE_FILES[material] ?? null) : null;
}

export function isAmbienceEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem(PREF_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setAmbienceEnabled(on: boolean): void {
  try {
    globalThis.localStorage?.setItem(PREF_KEY, String(on));
  } catch {
    // private-mode storage is best-effort
  }
}

let current: { audio: HTMLAudioElement; file: string } | null = null;
let lastMaterial: RoomMaterial | null = null;
let lastPlaying = false;

function fade(
  audio: HTMLAudioElement,
  from: number,
  to: number,
  onDone?: () => void,
): void {
  const steps = Math.max(1, Math.round(FADE_MS / STEP_MS));
  let i = 0;
  audio.volume = from;
  const t = window.setInterval(() => {
    i += 1;
    audio.volume = Math.max(0, Math.min(1, from + (to - from) * Math.min(1, i / steps)));
    if (i >= steps) {
      window.clearInterval(t);
      onDone?.();
    }
  }, STEP_MS);
}

/**
 * The single sync point — called whenever the session phase or the
 * room material may have changed. `playing` should only be true while
 * a session is actively breathing: pause, the landing and every other
 * screen stay silent.
 */
export function syncAmbience(
  material: RoomMaterial | null,
  playing: boolean,
): void {
  lastMaterial = material;
  lastPlaying = playing;
  if (typeof Audio !== "function") return;

  const desired =
    playing && isAmbienceEnabled() ? ambienceFor(material) : null;
  if ((current?.file ?? null) === desired) return;

  if (current) {
    const leaving = current;
    current = null;
    fade(leaving.audio, leaving.audio.volume, 0, () => {
      try {
        leaving.audio.pause();
      } catch {
        // best-effort
      }
    });
  }
  if (desired) {
    const audio = new Audio(desired);
    audio.loop = true;
    audio.volume = 0;
    current = { audio, file: desired };
    const playing = audio.play();
    if (playing && typeof playing.then === "function") {
      playing.catch(() => {
        if (current?.audio === audio) current = null;
      });
    }
    fade(audio, 0, MAX_VOLUME);
  }
}

/** Re-evaluate after the on/off pref flips, using the last seen state. */
export function refreshAmbience(): void {
  syncAmbience(lastMaterial, lastPlaying);
}
