const TRACK_URL = "/audio/decompress-afrobeats.mp3";
const TARGET_VOLUME = 0.55;
const FADE_IN_MS = 1600;
const FADE_OUT_MS = 350;

function rampVolume(audio: HTMLAudioElement, target: number, ms: number, done?: () => void) {
  const start = audio.volume;
  const started = performance.now();
  const tick = () => {
    const t = Math.min(1, (performance.now() - started) / ms);
    audio.volume = start + (target - start) * t;
    if (t < 1 && !audio.paused) requestAnimationFrame(tick);
    else if (t >= 1) done?.();
  };
  tick();
}

export function startDecompressTrack(elapsedSeconds = 0): (() => void) | null {
  if (typeof window === "undefined") return null;
  const audio = new Audio(TRACK_URL);
  audio.volume = 0;
  audio.preload = "auto";

  let failed = false;
  audio.addEventListener("error", () => { failed = true; }, { once: true });

  const play = async () => {
    try {
      if (elapsedSeconds > 0 && elapsedSeconds < 115) {
        audio.currentTime = elapsedSeconds;
      }
      await audio.play();
      rampVolume(audio, TARGET_VOLUME, FADE_IN_MS);
    } catch {
      failed = true;
    }
  };
  void play();

  return () => {
    if (failed) return;
    rampVolume(audio, 0, FADE_OUT_MS, () => {
      audio.pause();
      audio.src = "";
    });
  };
}
