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
 * Append a gentle, zero-tracking break link to a check-in sentence when
 * the sender opts in. Never includes the sender's feeling or personal data
 * in the URL — only the bare origin or `/session?pattern=<id>&via=invite`.
 */
export function appendRoomLink(message: string, patternId?: string): string {
  const trimmed = message.trim();
  const url = patternId ? buildInvitationUrl(patternId) : INVITATION_ORIGIN;
  return `${trimmed}\n\nTwo quiet minutes if you want them: ${url}`;
}

/**
 * Build a local `.ics` calendar file for a recurring 2-minute quiet pause.
 * Everything happens on-device (`data:text/calendar`); no server, no account,
 * no push-notification permission required.
 */
export function buildQuietPauseIcs(options?: {
  patternId?: string;
  hourLocal?: number;
  minuteLocal?: number;
  now?: Date;
}): string {
  const now = options?.now ?? new Date();
  const hour = options?.hourLocal ?? 15;
  const minute = options?.minuteLocal ?? 0;

  const start = new Date(now);
  start.setHours(hour, minute, 0, 0);
  if (start.getTime() <= now.getTime()) {
    start.setDate(start.getDate() + 1);
  }
  const end = new Date(start.getTime() + 2 * 60 * 1000);

  const fmtUtc = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");

  const url = options?.patternId
    ? buildInvitationUrl(options.patternId)
    : INVITATION_ORIGIN;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Brume//Quiet Pause//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:brume-pause-${ fmtUtc(now) }@brumeapp.netlify.app`,
    `DTSTAMP:${fmtUtc(now)}`,
    `DTSTART:${fmtUtc(start)}`,
    `DTEND:${fmtUtc(end)}`,
    "RRULE:FREQ=DAILY",
    "SUMMARY:Brume — two quiet minutes",
    `DESCRIPTION:A two-minute breathing pause between things. ${url}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/**
 * Trigger a browser download of the `.ics` file so the user's calendar app
 * can add the recurring 2-minute pause.
 */
export function downloadQuietPauseIcs(options?: { patternId?: string }): boolean {
  if (typeof document === "undefined" || typeof Blob === "undefined") return false;
  try {
    const ics = buildQuietPauseIcs(options);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "brume-two-minutes.ics";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

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
