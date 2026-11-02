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

function speakFallback(text: string) {
  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance !== "function") return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = SPEECH_RATE;
  utterance.pitch = SPEECH_PITCH;
  utterance.volume = SPEECH_VOLUME;
  synth.speak(utterance);
}

function playCue(id: string, preview: boolean): void {
  if ((!preview && !voiceEnabled) || typeof window === "undefined") return;
  const cue = VOICE_CUES[id as VoiceCueId];
  if (!cue) return;

  stopCues();
  const serial = ++cueSerial;

  const audio = missing.has(id) ? null : audioFor(id, cue.file);
  if (!audio) {
    speakFallback(cue.text);
    return;
  }

  const giveUp = () => {
    if (currentAudio === audio) currentAudio = null;
    if (serial === cueSerial && (preview || voiceEnabled)) speakFallback(cue.text);
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

export function preloadCues(): void {
  if (typeof window === "undefined") return;
  for (const [id, cue] of Object.entries(VOICE_CUES)) {
    audioFor(id, cue.file);
  }
}

export function setVoiceEnabled(enabled: boolean): void {
  voiceEnabled = enabled;
  if (!enabled) stopCues();
}
