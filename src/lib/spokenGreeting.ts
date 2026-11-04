/**
 * Brume's own line, spoken as a session begins.
 *
 * It comes from Brume's side of the room — the light, the hour, the breath —
 * and never repeats the word the user just picked. Handing someone their own
 * choice back with a reason attached is a receipt, not a companion. Brume
 * also never uses any of the fourteen words it just offered: "Early light"
 * beside the feeling called Light reads as an echo either way.
 *
 * Whole lines from a closed table — nothing is composed from a transcript,
 * so the words going to the voice service are always ours.
 */

import { dayPartFromHour, type DayPart } from "./atmosphere/dayPart";
import { feelingAt, type FeelingDefinition } from "./feelings";

type Valence = FeelingDefinition["valence"];

const DAYPART_SPOKEN: Record<DayPart, string> = {
  dawn: "Early morning.",
  day: "Midday.",
  dusk: "Evening.",
  night: "It's late.",
};

const LINES: Record<Valence, Record<DayPart, string>> = {
  heavy: {
    dawn: "Cold morning. Breathe low and slow — the day can wait a minute.",
    day: "Midday. Set it down here — nothing in this room needs solving.",
    dusk: "Evening. Nothing to finish tonight. Just the long exhale.",
    night:
      "It's late. Breathe out longer than you breathe in. That's the whole job.",
  },
  positive: {
    dawn: "Bright morning. Slow down anyway — the day isn't racing you.",
    day: "Midday, and good. Stay here a minute anyway — nothing to catch.",
    dusk: "Evening, easy. Stay a minute longer than you mean to.",
    night: "Late. The breath doesn't need a reason.",
  },
};

/**
 * The line Brume says when a session begins with spoken cues on.
 * Same situation, same words — a companion that says something different
 * every visit is a feed. ~10–14 words: short enough to hand into the breath.
 */
export function sessionGreeting(
  checkInIndex: number | null,
  hour: number = new Date().getHours(),
): string {
  const daypart = dayPartFromHour(hour);
  const feeling = feelingAt(checkInIndex);
  if (!feeling) {
    return `${DAYPART_SPOKEN[daypart]} I'll count the rhythm — leave the rest to me.`;
  }
  return LINES[feeling.valence][daypart];
}
