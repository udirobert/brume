/**
 * The voice key — a header on the three requests that spend the deployment's
 * AssemblyAI quota (`/api/tts`, `/api/stt`, `/api/stt-token`).
 *
 * `backend/vision-service/voice_guard.py` checks it only when that box has
 * `VOICE_SHARED_SECRET` set; with no secret configured it sends nothing, so an
 * unconfigured build behaves exactly as it did before this file existed. Both
 * values are the owner's to set, and they must match: this one is in the build
 * env (`VITE_VOICE_KEY`), that one in the server env.
 *
 * It is worth being clear about what this buys. Anything in a bundle is public
 * — the key stops a script that finds the endpoint, not a person who opens
 * DevTools — and what actually bounds the cost is the per-visitor limit and the
 * per-day budget on the server. A wrong or missing key is not a hard failure
 * either: a refused request falls through to the same path a network failure
 * takes, which is the browser's own voice for a spoken line and the browser's
 * own recognition for a check-in.
 */
const VOICE_KEY_HEADER = "X-Brume-Voice-Key";

/** `extra` first, so a caller's Content-Type stays and the key rides with it. */
export function voiceHeaders(extra: Record<string, string> = {}): Record<string, string> {
  // Read per call, not at module load: a build-time constant would make the
  // "no key configured" path untestable without re-importing the world.
  const key: string = import.meta.env.VITE_VOICE_KEY ?? "";
  return key ? { ...extra, [VOICE_KEY_HEADER]: key } : extra;
}
