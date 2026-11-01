import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_MASCOT_PRESENCE,
  readMascotPresence,
  writeMascotPresence,
  type MascotPresence,
} from "@/lib/mascotPresence";

export function useMascotPresence(defaultPresence: MascotPresence = DEFAULT_MASCOT_PRESENCE) {
  const [presence, setPresence] = useState<MascotPresence>(
    () => readMascotPresence() ?? defaultPresence,
  );

  useEffect(() => {
    const stored = readMascotPresence();
    if (stored) setPresence(stored);
  }, []);

  const updatePresence = useCallback((next: MascotPresence) => {
    setPresence(next);
    writeMascotPresence(next);
  }, []);

  return { presence, setPresence: updatePresence };
}
