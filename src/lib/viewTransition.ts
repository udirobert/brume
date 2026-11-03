/**
 * viewTransition — same-document page transformations.
 *
 * Core-loop navigations hand their destination change to
 * `document.startViewTransition(...)`, which keeps the outgoing page
 * mounted while the browser snapshots it. Page changes then have an
 * *exit* half, not just the mount entrance — and a control can travel
 * between screens: the pressed control is named `brume-entry` for the
 * duration, and a control on the destination can carry
 * `data-vt-entry`, so the browser morphs one into the other.
 *
 * Browsers without the View Transitions API, and users with
 * reduced motion (whose media query also zeroes the CSS animations
 * in styles/brume-transitions.css), navigate instantly, exactly as
 * before.
 *
 * Transform + opacity only. This module owns no visuals of its own.
 */
import type { MouseEvent } from "react";
import { flushSync } from "react-dom";

export const VT_ENTRY_NAME = "brume-entry";

type ViewTransitionHandle = { finished?: Promise<unknown> };
type StartViewTransition = (update: () => void) => ViewTransitionHandle;

export interface ViewTransitionOptions {
  /** The control that was pressed — its snapshot morphs to the destination. */
  origin?: HTMLElement | null;
  /** Injectable for tests; defaults to document.startViewTransition. */
  start?: StartViewTransition | null;
  /** Injectable for tests; React batches, so the snapshot needs a sync render. */
  flush?: (update: () => void) => void;
}

function nativeStart(): StartViewTransition | null {
  if (typeof document === "undefined") return null;
  const start = (document as Document & { startViewTransition?: StartViewTransition })
    .startViewTransition;
  return typeof start === "function" ? start.bind(document) : null;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Name every [data-vt-entry] control on the current page. */
function nameEntryControls(value: string | null): void {
  if (value === null) {
    if (typeof document === "undefined") return;
    document.querySelectorAll<HTMLElement>("[data-vt-entry]").forEach((el) => {
      el.style.removeProperty("view-transition-name");
    });
    return;
  }
  if (typeof document === "undefined") return;
  document.querySelectorAll<HTMLElement>("[data-vt-entry]").forEach((el) => {
    el.style.setProperty("view-transition-name", value);
  });
}

/**
 * Run `go()` inside a view transition when the browser supports them
 * and motion is wanted; otherwise run it synchronously as before.
 */
export function viewTransitionTo(go: () => void, options: ViewTransitionOptions = {}): void {
  const { origin } = options;
  const start = options.start !== undefined ? options.start : nativeStart();
  const flush = options.flush ?? flushSync;

  if (!start || prefersReducedMotion()) {
    go();
    return;
  }

  origin?.style.setProperty("view-transition-name", VT_ENTRY_NAME);
  let ran = false;
  try {
    const transition = start(() => {
      ran = true;
      flush(go);
      // The destination renders synchronously above; mark its entry
      // control now, before the browser captures the new state.
      nameEntryControls(VT_ENTRY_NAME);
    });
    const cleanup = () => {
      origin?.style.removeProperty("view-transition-name");
      nameEntryControls(null);
    };
    transition.finished?.catch(() => undefined).finally(cleanup);
  } catch (error) {
    origin?.style.removeProperty("view-transition-name");
    // If the browser rejected the transition before running our update,
    // still navigate — but never run the update twice.
    if (!ran) go();
    if (import.meta.env.DEV) console.warn("[viewTransition] skipped:", error);
  }
}

/**
 * Link interception for plain left clicks: `vtClick(e, ()=>navigate(...))`
 * on a <Link> or <a>. Modifier/click combinations keep native behaviour
 * (open in new tab etc.) — only the plain click view-transitions.
 */
export function vtClick(e: MouseEvent<HTMLElement>, go: () => void): void {
  if (e.defaultPrevented || e.button !== 0
    || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
    return;
  }
  e.preventDefault();
  viewTransitionTo(go, { origin: e.currentTarget });
}
