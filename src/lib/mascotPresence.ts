export type MascotPresence = "quiet" | "companion";

export const MASCOT_PRESENCE_KEY = "brume/mascot-presence";
export const DEFAULT_MASCOT_PRESENCE: MascotPresence = "companion";

export function readMascotPresence(): MascotPresence | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(MASCOT_PRESENCE_KEY);
    return stored === "quiet" || stored === "companion" ? stored : null;
  } catch {
    return null;
  }
}

export function writeMascotPresence(presence: MascotPresence) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MASCOT_PRESENCE_KEY, presence);
  } catch {
    // Presence is a nicety; storage failure should not interrupt the page.
  }
}
