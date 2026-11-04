/**
 * "Meet me where I am" — one spoken line that names your moment before
 * the breath begins. Composed entirely from closed vocabulary (daypart +
 * the feeling's own phrase), so the words going to the voice service are
 * always ours, never typed by the user.
 */

import { dayPartFromHour, type DayPart } from "./atmosphere/dayPart";
import { feelingAt } from "./feelings";

const DAYPART_SPOKEN: Record<DayPart, string> = {
  dawn: "Early morning.",
  day: "Midday.",
  dusk: "Evening.",
  night: "It's late.",
};

/**
 * The line Brume says when a session begins with spoken cues on.
 * ~10–14 words — short enough to hand you into the first breath.
 */
export function sessionGreeting(
  checkInIndex: number | null,
  hour: number = new Date().getHours(),
): string {
  const daypart = DAYPART_SPOKEN[dayPartFromHour(hour)];
  const feeling = feelingAt(checkInIndex);
  if (!feeling) {
    return `${daypart} A short breathing pause — I'll count the rhythm for you.`;
  }
  const tail =
    feeling.valence === "heavy"
      ? "we'll take it slow."
      : "the rhythm stays easy.";
  return `${daypart} You came in ${feeling.phrase} — ${tail}`;
}
