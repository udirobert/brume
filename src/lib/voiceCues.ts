const SPEECH_RATE = 0.9;
const SPEECH_PITCH = 1;
const SPEECH_VOLUME = 0.85;

// Cue ids match the phase names sampleSessionTiming emits
// ("pause" is the store's name for hold_after_exhale — the UI shows "Rest").
export const VOICE_CUES = {
  inhale: { file: "/voice/inhale.wav", text: "Breathe in" },
  hold: { file: "/voice/hold.wav", text: "Hold" },
  exhale: { file: "/voice/exhale.wav", text: "Breathe out" },
  pause: { file: "/voice/pause.wav", text: "Rest" },
} as const;

export type VoiceCueId = keyof typeof VOICE_CUES;

export type CueStyle = "spoken" | "breath";

// Breath-shaped cues: the sound's edge marks the change — an inhale
// that runs out IS the hold beginning, so hold and rest need no cue.
const BREATH_CUES: Partial<Record<VoiceCueId, string>> = {
  inhale: "/voice/breath-in.mp3",
  exhale: "/voice/breath-out.mp3",
};

let cueStyle: CueStyle = "spoken";

let voiceEnabled = true;
let cueSerial = 0;
let currentAudio: HTMLAudioElement | null = null;

const audioCache = new Map<string, HTMLAudioElement>();
const missing = new Set<string>();

function audioFor(id: string, file: string): HTMLAudioElement | null {
  if (typeof Audio !== "function") return null;
  let audio = audioCache.get(id);
  if (!audio) {
    audio = new Audio(file);
    audio.preload = "auto";
    audio.addEventListener("error", () => missing.add(id), { once: true });
    audioCache.set(id, audio);
  }
  return audio;
}

function speakFallback(text: string, onend?: () => void) {
  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance !== "function") {
    onend?.();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = SPEECH_RATE;
  utterance.pitch = SPEECH_PITCH;
  utterance.volume = SPEECH_VOLUME;
  if (onend) {
    utterance.onend = onend;
    utterance.onerror = onend;
  }
  synth.speak(utterance);
}

function playFile(id: string, file: string, fallback?: () => void): void {
  stopCues();
  const serial = ++cueSerial;

  const audio = missing.has(id) ? null : audioFor(id, file);
  if (!audio) {
    fallback?.();
    return;
  }

  const giveUp = () => {
    if (currentAudio === audio) currentAudio = null;
    if (serial === cueSerial) fallback?.();
  };

  currentAudio = audio;
  try {
    audio.currentTime = 0;
    const playing = audio.play();
    if (playing && typeof playing.then === "function") {
      playing.then(
        () => {},
        () => {
          if (audio.error) missing.add(id);
          giveUp();
        },
      );
    } else {
      missing.add(id);
      giveUp();
    }
  } catch {
    if (audio.error) missing.add(id);
    giveUp();
  }
}

// ---- Spoken lines (live TTS) ------------------------------------------------
// Fixed cues are pre-rendered files; a spoken *line* is dynamic text — the
// session greeting naming your moment, or your own words read back. It goes
// to /api/tts (our AssemblyAI-backed function); the browser voice is the
// fallback. While a line is speaking, phase cues hold — one voice at a time.

// Dev speaks to the vite middleware (/api/tts); production speaks to the
// FastAPI service on Hetzner via VITE_HETZNER_SERVICE_URL — and if that
// var is missing from a build, the same relative path lands on the
// Netlify function. Same request/response contract on all three.
const TTS_ENDPOINT = import.meta.env.DEV
  ? "/api/tts"
  : `${import.meta.env.VITE_HETZNER_SERVICE_URL ?? ""}/api/tts`;
const LINE_CACHE_LIMIT = 8;
const lineCache = new Map<string, string>(); // text -> object URL
let lineAbort: AbortController | null = null;
let lineActive = false;
let lineGuard: ReturnType<typeof setTimeout> | undefined;

function endLine(): void {
  lineActive = false;
  if (lineGuard) {
    clearTimeout(lineGuard);
    lineGuard = undefined;
  }
}

function cacheLine(text: string, url: string): void {
  if (lineCache.size >= LINE_CACHE_LIMIT) {
    const oldest = lineCache.keys().next().value;
    if (oldest !== undefined) {
      URL.revokeObjectURL(lineCache.get(oldest)!);
      lineCache.delete(oldest);
    }
  }
  lineCache.set(text, url);
}

function playLineAudio(url: string, serial: number, fallback: () => void): void {
  if (typeof Audio !== "function") {
    fallback();
    return;
  }
  const audio = new Audio(url);
  const giveUp = () => {
    if (currentAudio === audio) currentAudio = null;
    // No endLine here — the fallback's own onend clears it, so a cue
    // can never overlap the browser voice either.
    if (serial === cueSerial) fallback();
  };

  currentAudio = audio;
  audio.addEventListener("ended", () => {
    if (currentAudio === audio) currentAudio = null;
    if (serial === cueSerial) endLine();
  });
  try {
    const playing = audio.play();
    if (playing && typeof playing.then === "function") {
      playing.then(() => {}, giveUp);
    }
  } catch {
    giveUp();
  }
}

function speakLineInternal(text: string): void {
  const t = text.trim();
  if (!t) return;
  stopCues(); // one channel: cues, synth and any in-flight line all yield
  const serial = ++cueSerial;
  lineActive = true;
  // A wedged 'ended' must never silence the breath cues — hard bound.
  lineGuard = setTimeout(endLine, Math.min(10_000, 2_000 + t.length * 90));

  const fallback = () => {
    if (serial !== cueSerial) return;
    speakFallback(t, () => {
      if (serial === cueSerial) endLine();
    });
  };

  const cached = lineCache.get(t);
  if (cached) {
    playLineAudio(cached, serial, fallback);
    return;
  }
  if (typeof fetch !== "function" || typeof URL?.createObjectURL !== "function") {
    fallback();
    return;
  }

  lineAbort = new AbortController();
  fetch(TTS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: t }),
    signal: lineAbort.signal,
  })
    .then((res) => {
      if (!res.ok) throw new Error(`tts ${res.status}`);
      return res.blob();
    })
    .then((blob) => {
      if (serial !== cueSerial) return;
      const url = URL.createObjectURL(blob);
      cacheLine(t, url);
      playLineAudio(url, serial, fallback);
    })
    .catch(() => {
      if (serial !== cueSerial) return;
      fallback();
    });
}

/** Speak a dynamic line through the voice service; honours voiceEnabled. */
export function speakLine(text: string): void {
  if (!voiceEnabled || typeof window === "undefined") return;
  speakLineInternal(text);
}

/** Audition a line even when voice is off (same rule as previewCue). */
export function previewLine(text: string): void {
  if (typeof window === "undefined") return;
  speakLineInternal(text);
}

function playCue(id: string, preview: boolean): void {
  if ((!preview && !voiceEnabled) || typeof window === "undefined") return;
  // A spoken line owns the voice while it plays — the orb carries the
  // phase visually; skipping this edge beats two voices at once.
  if (lineActive) return;

  if (cueStyle === "breath") {
    const file = BREATH_CUES[id as VoiceCueId];
    // No speech fallback here — a missing breath file stays quiet;
    // silence around the two edges is part of the design.
    if (file) playFile(`breath:${id}`, file);
    return;
  }

  const cue = VOICE_CUES[id as VoiceCueId];
  if (!cue) return;
  playFile(id, cue.file, () => speakFallback(cue.text));
}

export function speakCue(id: string): void {
  playCue(id, false);
}

// Hear-it preview on the session preview screen: plays even when voice is
// off — that's the point, you audition the cue before enabling it.
export function previewCue(id: string): void {
  playCue(id, true);
}

export function stopCues(): void {
  cueSerial++;
  try {
    lineAbort?.abort();
  } catch {
    // abort is best-effort
  }
  lineAbort = null;
  endLine();
  if (typeof window === "undefined") return;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // speechSynthesis can throw in headless contexts — cues are best-effort
  }
  if (currentAudio) {
    try {
      currentAudio.pause();
    } catch {
      // best-effort
    }
    currentAudio = null;
  }
}

export function setVoiceEnabled(enabled: boolean): void {
  voiceEnabled = enabled;
  if (!enabled) stopCues();
}

export function setCueStyle(style: CueStyle): void {
  cueStyle = style;
}

export function preloadCues(): void {
  if (typeof window === "undefined") return;
  for (const [id, cue] of Object.entries(VOICE_CUES)) {
    audioFor(id, cue.file);
  }
  for (const [id, file] of Object.entries(BREATH_CUES)) {
    audioFor(`breath:${id}`, file);
  }
}
