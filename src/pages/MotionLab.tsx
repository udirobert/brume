/**
 * Motion Lab — a deterministic storyboard of the CALM transition
 * grammar (dev-only, see App.tsx). Each strip renders real transition
 * states frozen at fixed easings, so frames can be compared and
 * critiqued instead of eyeballing live—the MotionSites look-and-fix
 * loop. The pieces it freezes run live on real navigation:
 *
 * · root crossfade + rise (styles/brume-transitions.css)
 * · the `brume-entry` control morph (src/lib/viewTransition.ts)
 * · the press squash/settle grammar (styles/brume-controls.css)
 * · session preview ↔ breath handover (ResponsiveEnhancedSession)
 * · the mascot's three-act reactions + silhouette deltas
 *   (anna/bundle/mascot-engine.js, painted via the shared painter)
 *
 * No animation loop: everything is a pure function of the stop.
 */
import { useEffect, useRef } from "react";
import { EASE, EASE_SETTLE } from "@/lib/motion";
import {
  createMascot,
  type BrumeMascotState,
  type MascotReaction,
} from "../../anna/bundle/mascot.js";
import "@/components/BrumeMascot.css";

/** Eased progress at a stop, solved numerically from a CSS cubic-bezier. */
function bezierAt(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x: number,
): number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => 3 * ax * t * t + 2 * bx * t + cx;
  let t = Math.min(1, Math.max(0, x));
  for (let i = 0; i < 12; i += 1) {
    const vx = sampleX(t) - x;
    if (Math.abs(vx) < 1e-5) break;
    t -= vx / (slopeX(t) || 1e-5);
    t = Math.min(1, Math.max(0, t));
  }
  return sampleY(Math.min(1, Math.max(0, t)));
}

const STOPS = [0, 0.3, 0.6, 0.85, 1] as const;
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

function Frame({
  stop,
  children,
}: {
  stop: number;
  children: React.ReactNode;
}) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <div className="relative h-40 w-72 overflow-hidden rounded-2xl border border-[var(--brume-rule)] bg-[var(--brume-card)]">
        {children}
      </div>
      <figcaption className="font-mono text-[11px] text-muted-foreground">
        t = {stop}
      </figcaption>
    </figure>
  );
}

/** Strip 1 — the entry morph: the pressed pill becomes the destination control. */
function EntryMorphStrip() {
  const ease = (t: number) => bezierAt(EASE[0], EASE[1], EASE[2], EASE[3], t);
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid w-max grid-cols-[repeat(5,18rem)] gap-3">
        {STOPS.map((stop) => {
          const k = ease(stop);
          // Home pill (x 40, y 26, w 240, h 56) → Begin button (x 52, y 88, w 216, h 44).
          const x = lerp(40, 52, k);
          const y = lerp(26, 88, k);
          const w = lerp(240, 216, k);
          const h = lerp(56, 44, k);
          return (
            <Frame key={stop} stop={stop}>
              <div
                className="absolute flex items-center justify-center rounded-full text-sm font-extrabold transition-none"
                style={{
                  left: x,
                  top: y,
                  width: w,
                  height: h,
                  background: "var(--brume-pear)",
                  color: "var(--brume-ink)",
                  boxShadow: `0 ${lerp(4, 2, k)}px 0 0 var(--brume-pear-deep)`,
                  transform: `scale(${lerp(1.02, 1, k)}, ${lerp(0.96, 1, k)})`,
                }}
              >
                <span style={{ opacity: 1 - k }}>Start a breathing reset</span>
                <span className="absolute" style={{ opacity: k }}>
                  Begin
                </span>
              </div>
            </Frame>
          );
        })}
      </div>
    </div>
  );
}

/** Strip 2 — the press grammar: fast squash, settle bounce on release. */
function PressSquashStrip() {
  const press = { translateY: 3, sx: 1.02, sy: 0.96 };
  const releaseOvershoot = { translateY: -2, sx: 1.012, sy: 0.992 }; // t≈0.4 on EASE_SETTLE
  const mid = { translateY: 1.6, sx: 1.008, sy: 0.975 };
  const frames = [
    { stop: 0, name: "rest", ...{ translateY: 0, sx: 1, sy: 1 } },
    { stop: 0.4, name: "press", ...press },
    { stop: 1, name: "full press", ...press },
    { stop: 0.45, name: "release (settle overshoot)", ...releaseOvershoot },
    { stop: 0.2, name: "release mid", ...mid },
  ] as const;
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid w-max grid-cols-[repeat(5,18rem)] gap-3">
        {frames.map((f) => (
          <div key={f.name} className="flex flex-col items-center gap-2">
            <div className="relative flex h-40 w-72 items-center justify-center rounded-2xl border border-[var(--brume-rule)] bg-[var(--brume-card)]">
              <div
                className="flex items-center justify-center rounded-full text-sm font-extrabold"
                style={{
                  width: 200,
                  height: 56,
                  background: "var(--brume-pear)",
                  color: "var(--brume-ink)",
                  transform: `translateY(${f.translateY}px) scale(${f.sx}, ${f.sy})`,
                  transformOrigin: "50% 78%",
                  boxShadow: `0 ${Math.max(1, 4 - f.translateY)}px 0 0 var(--brume-pear-deep)`,
                  transition: "none",
                }}
              >
                Start a breathing reset
              </div>
            </div>
            <span className="font-mono text-[11px] text-muted-foreground">
              {f.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Strip 3 — both halves of the preview → breath handover. */
function SessionHandoverStrip() {
  const ease = (t: number) => bezierAt(EASE[0], EASE[1], EASE[2], EASE[3], t);
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid w-max grid-cols-[repeat(5,18rem)] gap-3">
        {STOPS.map((stop) => {
          const k = ease(stop);
          return (
            <Frame key={stop} stop={stop}>
              {/* outgoing preview */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-1"
                style={{ opacity: 1 - k, transform: `translateY(${-k * 2}px)` }}
              >
                <span className="text-lg font-light">Box</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  4 · 4 · 4 · 4
                </span>
              </div>
              {/* incoming breath */}
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  opacity: k,
                  transform: `scale(${lerp(0.99, 1, k)}) translateY(${(1 - k) * 3}px)`,
                }}
              >
                <div
                  className="rounded-full border border-[var(--brume-rule)] bg-[var(--brume-card)]"
                  style={{ width: 96, height: 96 }}
                />
              </div>
            </Frame>
          );
        })}
      </div>
    </div>
  );
}

/** One real mascot painted once — a frozen frame of the engine. */
function MascotFrame({
  state = "idle",
  reactionName,
  reactionAge,
  label,
}: {
  state?: BrumeMascotState;
  reactionName?: MascotReaction;
  reactionAge?: number;
  label: string;
}) {
  const hostRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const m = createMascot(host, { autoAnimate: false });
    m.renderAt(3, {
      state,
      reaction:
        reactionName !== undefined && reactionAge !== undefined
          ? { name: reactionName, age: reactionAge }
          : undefined,
    });
    return () => m.destroy();
  }, [state, reactionName, reactionAge]);
  return (
    <figure className="flex flex-col items-center gap-2">
      <div className="relative flex h-40 w-72 items-center justify-center rounded-2xl border border-[var(--brume-rule)] bg-[var(--brume-card)]">
        <span
          ref={hostRef}
          className="brume-mascot block"
          style={{ width: 96, height: 96 }}
        />
      </div>
      <figcaption className="font-mono text-[11px] text-muted-foreground">
        {label}
      </figcaption>
    </figure>
  );
}

/** Strip 5 — the mascot's three-act hop, frozen at reaction ages (0.5s). */
function MascotReactionStrip() {
  const frames = [
    { age: 0, label: "rest" },
    { age: 0.05, label: "crouch · anticipation" },
    { age: 0.2, label: "apex · stretch" },
    { age: 0.45, label: "touchdown · squash" },
    { age: 0.49, label: "settled" },
  ] as const;
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid w-max grid-cols-[repeat(5,18rem)] gap-3">
        {frames.map((f) => (
          <MascotFrame
            key={f.age}
            label={f.label}
            reactionName="hop"
            reactionAge={f.age}
          />
        ))}
      </div>
    </div>
  );
}

/** Strip 6 — per-state silhouette deltas (BODY_POSES), painted statically. */
function MascotSilhouetteStrip() {
  const states = [
    { state: "idle", label: "idle · drawn shape" },
    { state: "topup", label: "topup · upper lobe puffs" },
    { state: "stretch", label: "stretch · trunk elongates" },
    { state: "sleepy", label: "sleepy · everything droops" },
  ] as const;
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid w-max grid-cols-[repeat(4,18rem)] gap-3">
        {states.map((s) => (
          <MascotFrame key={s.state} label={s.label} state={s.state} />
        ))}
      </div>
    </div>
  );
}

const SETTLE_STOPS = [0, 0.25, 0.5, 0.75, 1] as const;

/** Strip 4 — what the settle ease does on release (the only sanctioned overshoot). */
function SettleCurveStrip() {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid w-max grid-cols-[repeat(5,18rem)] gap-3">
        {SETTLE_STOPS.map((stop) => {
          const y = bezierAt(
            EASE_SETTLE[0],
            EASE_SETTLE[1],
            EASE_SETTLE[2],
            EASE_SETTLE[3],
            stop,
          );
          return (
            <Frame key={stop} stop={stop}>
              <div className="absolute inset-x-0 top-8 flex flex-col items-center gap-3">
                <div
                  className="flex h-10 w-44 items-center justify-center rounded-full bg-[var(--brume-pear)] text-xs font-extrabold"
                  style={{
                    transform: `translateY(${12 * (1 - y)}px) scaleY(${lerp(0.96, 1, y)})`,
                    transformOrigin: "50% 78%",
                    boxShadow: `0 ${Math.max(1, 4 - 12 * (1 - y))}px 0 0 var(--brume-pear-deep)`,
                  }}
                >
                  release at t = {stop}
                </div>
                <div className="h-2 w-40 rounded-full bg-[var(--brume-rule)]" />
              </div>
            </Frame>
          );
        })}
      </div>
    </div>
  );
}

export default function MotionLab() {
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight">Motion lab</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Frozen frames of the CALM transition grammar at fixed easings —
          release build omits this page. Live on real navigation: the root
          crossfade, the entry morph between the pressed control and the
          destination&apos;s Begin button, the press squash and release settle
          on every shared control, and the session handover.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
          Entry morph — pressed pill → Begin
        </h2>
        <EntryMorphStrip />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
          Press grammar — squash down, settle up
        </h2>
        <PressSquashStrip />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
          Session handover — exit and enter, both halves
        </h2>
        <SessionHandoverStrip />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
          Settle ease — the one sanctioned overshoot
        </h2>
        <SettleCurveStrip />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
          Mascot reaction — hop in three acts
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          The body holds nearly still at idle (bob ≤ 0.5px, rotate ≤ 0.35°) —
          the life is gaze drift plus a deterministic look-away every 6.4s.
          Reactions are three-act curves: hop 0.5s (crouch → apex → touchdown
          squash), settle 0.9s (gather → sink → spring back), celebrate 0.9s
          (three shrinking bounces). Blends run 0.5s on easeOutQuint from the
          frozen pose.
        </p>
        <MascotReactionStrip />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-muted-foreground">
          Mascot silhouette — states reshape the body
        </h2>
        <MascotSilhouetteStrip />
      </section>
    </div>
  );
}
