/**
 * Invitation — "pass this break on".
 *
 * A finished session can be handed to someone else as a plain link:
 * `/session?pattern=<id>&via=invite`. The link carries ONLY the pattern
 * id (plus a cosmetic `via=invite` flag that shows a one-line
 * "someone passed you a break" note on the preview). No mood, history,
 * camera data, or reflection ever leaves this device in the URL.
 *
 * There are no share counters, referrals, or analytics here — the
 * invite is useful to the recipient, not a score for the sender.
 */

/** Public origin of the deployed app — where invite links should land. */
export const INVITATION_ORIGIN = "https://brumeapp.netlify.app";

/**
 * Build the invitation URL for a pattern. Only two params are ever
 * emitted: `pattern` (the routine id) and `via=invite` (cosmetic).
 */
export function buildInvitationUrl(patternId: string): string {
  const params = new URLSearchParams({ pattern: patternId, via: "invite" });
  return `${INVITATION_ORIGIN}/session?${params.toString()}`;
}

interface RoutineEstimate {
  inhale: number;
  hold?: number;
  exhale: number;
  hold_after_exhale?: number;
}

/**
 * Rough routine length in seconds (~9 comfortable cycles). Used only
 * to phrase the invite copy honestly, e.g. "a 90-second breathing break".
 */
export function estimateRoutineSeconds(pattern: RoutineEstimate): number {
  const cycle =
    pattern.inhale + (pattern.hold ?? 0) + pattern.exhale + (pattern.hold_after_exhale ?? 0);
  return cycle * 9;
}

/**
 * Invite copy — what the recipient can actually use. Factual length,
 * no claims, no sender stats.
 */
export function invitationShareText(pattern?: RoutineEstimate): string {
  const seconds = pattern ? estimateRoutineSeconds(pattern) : 0;
  if (seconds > 0 && seconds < 120) {
    return `Take a ${Math.round(seconds / 5) * 5}-second breathing break`;
  }
  if (seconds >= 120) {
    const minutes = Math.max(2, Math.round(seconds / 60));
    return `Take a ${minutes}-minute breathing break`;
  }
  return "Take a breathing break";
}

/**
 * Share the invite: Web Share API when available, clipboard otherwise.
 * The shared payload is text + URL only — no files, no personal data.
 */
export async function shareInvitation(
  patternId: string,
  pattern?: RoutineEstimate
): Promise<"shared" | "copied"> {
  const url = buildInvitationUrl(patternId);
  const text = invitationShareText(pattern);

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "Brume", text, url });
      return "shared";
    } catch (err) {
      // Share sheet dismissed — treat as done, don't fall through to copy.
      if (err instanceof Error && err.name === "AbortError") return "shared";
    }
  }

  try {
    await navigator.clipboard.writeText(`${text} — ${url}`);
  } catch {
    // Clipboard unavailable (permissions, insecure context) — silent.
  }
  return "copied";
}
