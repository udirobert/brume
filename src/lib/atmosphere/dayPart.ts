export type DayPart = "dawn" | "day" | "dusk" | "night";

export function dayPartFromHour(hour: number): DayPart {
  if (hour >= 5 && hour < 8) return "dawn";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "dusk";
  return "night";
}

export function roomWhisper(part: DayPart): string {
  if (part === "dawn") return "The room is still waking.";
  if (part === "dusk") return "Let the day settle.";
  if (part === "night") return "The room is quieter now.";
  return "A pause in the middle of the day.";
}

/** Sets html[data-daypart] so mist, gradient, and copy share one clock. */
export function applyDayPart(part: DayPart = dayPartFromHour(new Date().getHours())) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.daypart = part;
}
