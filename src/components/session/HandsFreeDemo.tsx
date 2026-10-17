import React, { useId, useReducer, useState } from "react";
import { ChevronDown, Hand } from "lucide-react";

/**
 * HandsFreeDemo — a fully local, permission-free simulation of the planned
 * hands-free gesture controls. No camera, no model, no network, no timers.
 * It never touches the real session, camera store, or history.
 */

export interface HandsFreeDemoState {
  /** demo is paused (as if a gesture toggled pause) */
  paused: boolean;
  /** simulated detection signal */
  signal: "tracking" | "signal-lost";
}

export type HandsFreeDemoAction = "toggle-pause" | "toggle-signal" | "reset";

export const initialHandsFreeDemoState: HandsFreeDemoState = {
  paused: false,
  signal: "tracking",
};

export function handsFreeDemoReducer(
  state: HandsFreeDemoState,
  action: HandsFreeDemoAction,
): HandsFreeDemoState {
  switch (action) {
    case "toggle-pause":
      // A gesture only registers while the simulated signal is tracking.
      if (state.signal !== "tracking") return state;
      return { ...state, paused: !state.paused };
    case "toggle-signal":
      // Signal loss restores/hides detection without changing pause state.
      return {
        ...state,
        signal: state.signal === "tracking" ? "signal-lost" : "tracking",
      };
    case "reset":
      return initialHandsFreeDemoState;
    default:
      return state;
  }
}

export function handsFreeDemoStatusText(state: HandsFreeDemoState): string {
  const practice = state.paused ? "Practice paused" : "Practice running";
  const signal = state.signal === "signal-lost" ? "Signal lost" : "Tracking";
  return `${practice} · ${signal}`;
}

interface HandsFreeDemoProps {
  defaultOpen?: boolean;
  initialState?: HandsFreeDemoState;
}

export const HandsFreeDemo: React.FC<HandsFreeDemoProps> = ({
  defaultOpen = false,
  initialState = initialHandsFreeDemoState,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const [state, dispatch] = useReducer(handsFreeDemoReducer, initialState);
  const panelId = useId();

  const statusText = handsFreeDemoStatusText(state);
  const signalLost = state.signal === "signal-lost";

  return (
    <div className="w-full max-w-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="mx-auto flex items-center gap-1 text-xs text-muted-foreground/70 hover:text-muted-foreground transition-colors"
      >
        <Hand className="h-3 w-3" />
        Try hands-free preview
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div id={panelId} className="mt-4 rounded-2xl bg-black/40 ring-1 ring-white/10 p-5 space-y-4 text-center">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            Simulation — no camera used
          </p>
          <p className="text-xs text-muted-foreground/70">
            Live gesture controls are not available yet.
          </p>

          {/* Static orb — mirrors the mist visual language, no animation. */}
          <div
            aria-hidden="true"
            className="mx-auto h-20 w-20 rounded-full bg-primary/25 ring-1 ring-primary/30 shadow-[0_0_60px_-10px_hsl(var(--primary)/0.6)]"
          />

          <p role="status" aria-live="polite" className="text-sm text-foreground">
            {statusText}
          </p>

          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              aria-pressed={state.paused}
              disabled={signalLost}
              onClick={() => dispatch("toggle-pause")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:hover:text-muted-foreground"
            >
              Simulate eyebrow raise
            </button>
            <button
              type="button"
              aria-pressed={signalLost}
              onClick={() => dispatch("toggle-signal")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Simulate signal loss
            </button>
            <button
              type="button"
              onClick={() => dispatch("reset")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Reset preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HandsFreeDemo;
