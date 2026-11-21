import { memo, useEffect, useMemo, useRef, useState } from "react";
import { BrumeMascot } from "@/components/BrumeMascot";
import {
  FIREFLY_BOARD,
  FIREFLY_END_COPY,
  FIREFLY_GOAL,
  FIREFLY_MAX_MOVES,
  FIREFLY_START,
  FIREFLY_STONE,
  GIFT_LINE_MAX,
  GIFT_PRIVACY,
  SCENE_LABELS,
  SCENE_PROMISES,
  minuteFragment,
  readMinute,
  runFirefly,
  type FireflyFrame,
  type GiftScene,
  type Minute,
  type Move,
} from "@/lib/roomPlay";
import "./roomplay.css";

const EXIT_HREF = "/decompress";

const DIR_NAMES = ["east", "south", "west", "north"];

const reducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * One share control for both toys: native share when the platform has
 * it, copy otherwise, and a manual selectable URL only when asked for
 * or when the write path fails. "Link copied" is keyed to the exact
 * URL so an edit resets it; a cancelled share sheet is not a failure.
 */
function ShareLink({
  url,
  title,
  manualLabel,
  compact = false,
}: {
  url: string;
  title: string;
  manualLabel: string;
  /** Tight row variant (the firefly's top bar): icon + word, no manual
      toggle — the readonly URL still appears on failure. */
  compact?: boolean;
}) {
  const canShare = typeof navigator.share === "function";
  const [copiedFor, setCopiedFor] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (manual) inputRef.current?.select();
  }, [manual]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedFor(url);
    } catch {
      setManual(true);
    }
  };

  const share = async () => {
    try {
      await navigator.share({ url, title });
    } catch (error) {
      if ((error as DOMException).name === "AbortError") return;
      await copy();
    }
  };

  const copied = copiedFor === url;
  return (
    <div className={`rp-sharelink${compact ? " rp-sharelink--compact" : ""}`}>
      <div className="rp-sharelink__row">
        <button
          type="button"
          className={compact ? "rp-sharelink__btn" : "brume-btn brume-btn--soft"}
          onClick={canShare ? share : copy}
        >
          {compact && (
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path
                d="M8 10.5V2.5M5 5.2 8 2l3 3.2M3.5 9v3.2c0 .7.6 1.3 1.3 1.3h6.4c.7 0 1.3-.6 1.3-1.3V9"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {compact
            ? (copied ? "Copied" : "Share")
            : (copied ? "Link copied" : canShare ? "Share the link" : "Copy link")}
        </button>
        {!compact && !manual && (
          <button
            type="button"
            className="rp-sharelink__manual"
            onClick={() => setManual(true)}
          >
            {manualLabel}
          </button>
        )}
      </div>
      {manual && (
        <input
          ref={inputRef}
          className="rp-input rp-input--url"
          aria-label="Link to share"
          type="text"
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
        />
      )}
    </div>
  );
}

/** Local haptic tick — opt-in by hardware only: no vibration under
    reduced motion, on hidden tabs, or where the API doesn't exist. */
function pulseFirefly(kind: "move" | "release" | "bump" | "home") {
  try {
    if (reducedMotion()) return;
    if (document.visibilityState && document.visibilityState !== "visible") return;
    navigator.vibrate?.(
      kind === "move" ? 8 : kind === "release" ? 12 : kind === "bump" ? 18 : [7, 45, 10],
    );
  } catch {
    /* no haptics on this platform — visuals carry the beat */
  }
}

const MOVE_GLYPH: Record<Move, string> = { step: "↑", left: "↶", right: "↷" };

/* Three hand-drawn stepping-islets, chosen deterministically per cell:
   extruded dark face, worn moss top, one ink crack line. */
const ISLET_PATHS: string[][] = [
  [
    "M4 15 C4 18 8 20 12 20 C16 20 20 18 20 15 L20 13 C20 16 16 18 12 18 C8 18 4 16 4 13 Z",
    "M4 13 C4 9 8 7 12 7 C16 7 20 9 20 13 C20 16 16 18 12 18 C8 18 4 16 4 13 Z",
    "M9 10 C10 12 10 14 9 16",
  ],
  [
    "M3 14.5 C3 17.5 7 19.5 12 19.5 C17 19.5 21 17.5 21 14.5 L21 12.5 C21 15 17 17 12 17 C7 17 3 15 3 12.5 Z",
    "M3 12.5 C3 9.5 7 7 12 7 C17 7 21 9.5 21 12.5 C21 15 17 17 12 17 C7 17 3 15 3 12.5 Z",
    "M14 9 C15 11 15 13 14 15",
  ],
  [
    "M5 15.5 C5 18.5 8.5 20 12.5 20 C16 20 19 18 19 15.5 L19 13.5 C19 16 16 17.5 12.5 17.5 C8.5 17.5 5 16 5 13.5 Z",
    "M5 13.5 C5 10 8.5 8 12.5 8 C16 8 19 10 19 13.5 C19 16 16 17.5 12.5 17.5 C8.5 17.5 5 16 5 13.5 Z",
    "M11 10.5 C12 12.5 12 14 11 16",
  ],
];
const MOVE_NAME: Record<Move, string> = {
  step: "forward",
  left: "turn left",
  right: "turn right",
};

type ChipStatus = "played" | "blocked" | "pending";

/** Adjacent identical moves collapse into one chip; a chip never
    straddles a status boundary, so a blocked step splits its run. */
function pathChips(
  path: readonly Move[],
  statusOf: (i: number) => ChipStatus,
): { move: Move; status: ChipStatus; count: number }[] {
  const chips: { move: Move; status: ChipStatus; count: number }[] = [];
  path.forEach((move, i) => {
    const status = statusOf(i);
    const last = chips[chips.length - 1];
    if (last && last.move === move && last.status === status) {
      last.count++;
    } else {
      chips.push({ move, status, count: 1 });
    }
  });
  return chips;
}

/**
 * FireflyMarsh — the shadow-box the walk happens inside: a marsh at
 * blue hour, drawn behind the traversable grid. `lit` turns on the
 * amber pool of light and reed highlights the lantern throws. Pure
 * presentation; no clocks, no loops.
 */
/**
 * FireflyMarsh — the shadow-box the walk happens inside: a marsh at
 * blue hour, drawn behind the traversable grid. `lit` turns on the
 * amber pool of light and reed highlights the lantern throws. Pure
 * presentation; no clocks, no loops.
 */
const FireflyMarsh = memo(function FireflyMarsh({ lit }: { lit: boolean }) {
  return (
    <svg
      viewBox="0 0 500 400"
      className="rp-marsh"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="rm-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--rm-sky-top)" />
          <stop offset="1" stopColor="var(--rm-sky-low)" />
        </linearGradient>
        <linearGradient id="rm-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--rm-water-hi)" />
          <stop offset="1" stopColor="var(--rm-water-lo)" />
        </linearGradient>
      </defs>

      {/* deep ink-to-dusty-mauve dusk sky */}
      <rect width="500" height="118" fill="url(#rm-sky)" />
      {/* sparse stars, upper left */}
      <g fill="var(--rm-star)">
        <circle cx="46" cy="30" r="1.4" />
        <circle cx="86" cy="18" r="1" />
        <circle cx="128" cy="42" r="1.2" />
        <circle cx="64" cy="58" r="0.9" />
        <circle cx="170" cy="24" r="1" />
        <circle cx="104" cy="66" r="0.8" />
      </g>
      {/* crescent moon, high right, inside the safe area */}
      <path
        d="M436 44 a17 17 0 1 0 10 30 a13 13 0 1 1 -10 -30 Z"
        fill="var(--rm-moon)"
      />
      {/* narrow ochre sliver at the horizon */}
      <rect y="88" width="500" height="12" fill="var(--rm-apricot)" />
      {/* low scalloped forest ridge over the horizon */}
      <path
        d="M0 104 C18 96 30 100 44 96 C58 92 70 100 86 96 C102 92 116 100 132 97 C148 94 162 100 178 97 C196 93 210 100 228 97 C246 93 262 100 280 97 C298 93 314 100 332 97 C350 93 366 100 384 97 C402 93 418 100 436 97 C456 93 474 100 500 96 L500 118 L0 118 Z"
        fill="var(--rm-ridge)"
      />

      {/* teal dusk water fills the whole tile field */}
      <rect y="100" width="500" height="300" fill="url(#rm-water)" />
      <g className="rp-marsh__water-lines">
        <path d="M36 168 C70 165 104 167 134 165" />
        <path d="M176 196 C214 193 250 195 284 193" />
        <path d="M318 160 C356 157 390 159 420 157" />
        <path d="M60 250 C100 247 134 249 168 247" />
        <path d="M340 300 C374 297 408 299 442 297" />
        <path d="M210 336 C240 333 268 335 292 333" />
        <path d="M380 226 C410 223 436 225 462 223" />
      </g>

      {/* sparse lily leaves on the water */}
      <g fill="var(--rm-leaf)">
        <path d="M52 220 C52 214 62 211 70 213 C78 215 80 221 74 225 C68 229 58 228 54 225 C52 223 52 221 52 220 Z" />
        <path d="M446 210 C446 205 454 202 461 204 C467 206 469 211 464 214 C459 217 451 216 448 214 C446 212 446 211 446 210 Z" />
        <path d="M96 310 C96 306 103 303 109 305 C115 307 116 311 112 314 C108 316 100 316 98 314 C96 312 96 311 96 310 Z" />
      </g>

      {/* shore reeds in the bottom corners, pointed leaves */}
      <g className="rp-marsh__reeds">
        <path d="M16 400 C18 366 12 340 22 306" />
        <path d="M34 400 C32 370 40 346 36 316" />
        <path d="M466 400 C468 370 462 344 470 310" />
        <path d="M484 400 C482 374 490 352 486 326" />
      </g>
      <g fill="var(--rm-cattail)">
        <ellipse cx="22" cy="300" rx="4.5" ry="13" />
        <ellipse cx="36" cy="310" rx="4" ry="10" />
        <ellipse cx="470" cy="304" rx="4.5" ry="13" />
        <ellipse cx="486" cy="320" rx="4" ry="10" />
      </g>

      {/* a tiny moth resting near the left bank */}
      <g className="rp-marsh__moth">
        <path d="M74 176 C70 172 70 166 74 163 C78 166 78 172 74 176 Z" />
        <path d="M74 176 C78 172 78 166 74 163 C70 166 70 172 74 176 Z" transform="rotate(30 74 169)" />
      </g>

      {/* the lantern's pool of light — appears only when lit */}
      <g className="rp-marsh__light" data-lit={lit || undefined}>
        <ellipse cx="445" cy="232" rx="52" ry="14" fill="var(--rm-glow)" />
        <g className="rp-marsh__glowlines">
          <path d="M420 252 C444 250 468 251 490 249" />
          <path d="M428 272 C452 270 474 271 494 269" />
          <path d="M436 294 C458 292 478 293 496 291" />
          <path d="M440 314 C460 312 478 313 494 311" />
        </g>
        <g className="rp-marsh__lit-reeds">
          <path d="M466 400 C468 370 462 344 470 310" />
          <path d="M484 400 C482 374 490 352 486 326" />
        </g>
      </g>
    </svg>
  );
});

function FireflyRoom() {
  const [path, setPath] = useState<Move[]>(["step", "step", "step", "step"]);
  const [frames, setFrames] = useState<FireflyFrame[] | null>(null);
  const [end, setEnd] = useState<keyof typeof FIREFLY_END_COPY | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [impact, setImpact] = useState(false);
  const timerRef = useRef(0);
  const runRef = useRef(0);
  const buzzedRef = useRef(0);
  const headRef = useRef<HTMLHeadingElement>(null);
  const stepRef = useRef<HTMLButtonElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const lanternRef = useRef<HTMLSpanElement>(null);

  const settled = frames !== null && frameIndex >= frames.length - 1 && impact;
  const playing = frames !== null && !settled;
  const played = frames ? frameIndex : 0;
  const blocked =
    settled && (end === "stone" || end === "edge") ? frameIndex : -1;
  const frame = frames ? frames[Math.min(frameIndex, frames.length - 1)] : FIREFLY_START;
  const lastMove = frames && frameIndex > 0 ? path[frameIndex - 1] : null;
  const pivotDeg = path
    .slice(0, frames ? frameIndex : 0)
    .reduce((angle, m) => angle + (m === "left" ? -90 : m === "right" ? 90 : 0), 0);
  const lit = settled && end === "light";
  const bump = settled && (end === "stone" || end === "edge");

  useEffect(() => {
    headRef.current?.focus();
    document.title = "The Last Firefly · Brume";
    return () => {
      document.title = "Brume";
    };
  }, []);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  // Playback: frames step at a walk, then a short breath before the
  // terminal beat (lantern flare or bump) lands.
  useEffect(() => {
    if (!frames) return undefined;
    const fireImpact = () => {
      setImpact(true);
      if (buzzedRef.current !== runRef.current) {
        buzzedRef.current = runRef.current;
        if (end === "light") pulseFirefly("home");
        else if (end === "stone" || end === "edge") pulseFirefly("bump");
      }
    };
    if (reducedMotion()) {
      setFrameIndex(frames.length - 1);
      fireImpact();
      return undefined;
    }
    if (frameIndex < frames.length - 1) {
      timerRef.current = window.setTimeout(() => setFrameIndex((i) => i + 1), 420);
      return () => window.clearTimeout(timerRef.current);
    }
    if (!impact) {
      timerRef.current = window.setTimeout(fireImpact, 560);
      return () => window.clearTimeout(timerRef.current);
    }
    return undefined;
  }, [frames, frameIndex, impact, end]);

  const append = (move: Move) => {
    if (playing || settled || path.length >= FIREFLY_MAX_MOVES) return;
    pulseFirefly("move");
    setPath((p) => (p.length < FIREFLY_MAX_MOVES ? [...p, move] : p));
    setFrames(null);
    setEnd(null);
    setFrameIndex(0);
    setImpact(false);
  };

  const undo = () => {
    if (playing || settled || path.length === 0) return;
    pulseFirefly("move");
    setPath((p) => p.slice(0, -1));
    setFrames(null);
    setEnd(null);
    setImpact(false);
  };

  const walk = () => {
    if (playing || path.length === 0) return;
    pulseFirefly("release");
    runRef.current += 1;
    const result = runFirefly(path);
    setFrames(result.frames);
    setEnd(result.end);
    setFrameIndex(0);
    setImpact(false);
  };

  useEffect(() => {
    if (settled && document.activeElement === document.body) {
      ctaRef.current?.focus();
    }
  }, [settled]);

  const tryAgain = () => {
    window.clearTimeout(timerRef.current);
    setPath([]);
    setFrames(null);
    setEnd(null);
    setFrameIndex(0);
    setImpact(false);
    requestAnimationFrame(() => stepRef.current?.focus());
  };

  const statusOf = (i: number): ChipStatus =>
    i < played ? "played" : i === blocked ? "blocked" : "pending";

  const chips = pathChips(path, statusOf);
  const cell = (f: FireflyFrame) =>
    `column ${f.x + 1} of ${FIREFLY_BOARD.width}, row ${f.y + 1} of ${FIREFLY_BOARD.height}`;
  const pathSummary = path.length
    ? `Path: ${pathChips(path, () => "pending" as ChipStatus)
        .map((c) => `${MOVE_NAME[c.move]}${c.count > 1 ? ` ×${c.count}` : ""}`)
        .join(", ")}.`
    : "No moves yet.";

  return (
    <>
      <h1 className="rp-title rp-title--toy" tabIndex={-1} ref={headRef}>
        The Last Firefly
      </h1>
      <p className="rp-lede rp-lede--toy">Help Brume light the lantern.</p>

      <div className="rp-board-wrap" aria-hidden="true">
        <div className="rp-board-deck">
          <FireflyMarsh lit={lit} />
          <div
            className="rp-board"
            style={{
              gridTemplateColumns: `repeat(${FIREFLY_BOARD.width}, 1fr)`,
              gridTemplateRows: `repeat(${FIREFLY_BOARD.height}, 1fr)`,
            }}
          >
            {Array.from({ length: FIREFLY_BOARD.height * FIREFLY_BOARD.width }, (_, i) => {
              const x = i % FIREFLY_BOARD.width;
              const y = Math.floor(i / FIREFLY_BOARD.width);
              const isStone = x === FIREFLY_STONE.x && y === FIREFLY_STONE.y;
              const isGoal = x === FIREFLY_GOAL.x && y === FIREFLY_GOAL.y;
              return (
                <div
                  key={`${x}-${y}`}
                  className={`rp-cell${isStone ? " rp-cell--stone" : ""}${isGoal ? " rp-cell--goal" : ""}`}
                >
                  {!isStone && !isGoal && (
                    <svg viewBox="0 0 24 24" className="rp-islet" data-v={(x + y * 5) % 3}>
                      {ISLET_PATHS[(x + y * 5) % 3].map((d, j) => (
                        <path key={j} d={d} className={`rp-islet__${j === 0 ? "face" : j === 1 ? "top" : "line"}`} />
                      ))}
                    </svg>
                  )}
                  {isStone && (
                    <svg viewBox="0 0 24 24" className="rp-rock">
                      <path d="M3 18 C2 11 5 5 11 3 C16 1.5 21 6 22 12 C23 17 19 21 13 21 C7 21 3.5 20.5 3 18 Z" fill="var(--rm-rock)" />
                      <path d="M11 3 C13 7 13 12 12 17 M6.5 5.5 C8 9 9 14 8 19 M17 4 C18.5 8 19 13 18 18.5" stroke="var(--rm-rock-line)" strokeWidth="1" fill="none" />
                      <path d="M4.5 13 C4 9 6 5.5 9 4 C10.5 6.5 10 9.5 8 11.5 C6.5 13 5.5 13.5 4.5 13 Z" fill="var(--rm-moss)" />
                    </svg>
                  )}
                  {isGoal && (
                    <span ref={lanternRef} className="rp-lantern-wrap">
                      <svg
                        viewBox="0 0 24 24"
                        className={`rp-lantern${lit ? " rp-lantern--lit" : ""}`}
                      >
                        {/* a wood-and-amber beacon: stout post, capped
                            glass chamber, wick or flame inside */}
                        <path d="M14.5 21 V7.5" stroke="var(--rm-post)" strokeWidth="2.4" strokeLinecap="round" />
                        <path d="M14.5 8 C14.5 5.8 15.6 4.8 17 4.8 C18.6 4.8 19.6 5.8 19.6 7.4" fill="none" stroke="var(--rm-brass)" strokeWidth="1.5" strokeLinecap="round" />
                        <path d="M15.6 9.2 h3.4 a0.6 0.6 0 0 1 0.6 0.6 v6.6 a1.8 1.8 0 0 1 -1.8 1.8 h-1 a1.8 1.8 0 0 1 -1.8 -1.8 v-6.6 a0.6 0.6 0 0 1 0.6 -0.6 Z" fill={lit ? "var(--rm-glass-lit)" : "var(--rm-glass)"} stroke="var(--rm-brass)" strokeWidth="1.3" />
                        {lit ? (
                          <path d="M17.3 10.8 C18 11.7 18.2 12.6 17.7 13.7 C17 14.5 16.1 14 16.2 13 C16.3 12.2 16.8 11.4 17.3 10.8 Z" fill="var(--brume-pear-deep)" />
                        ) : (
                          <path d="M17.3 15.4 v-3.2" stroke="var(--rm-wick)" strokeWidth="1.3" strokeLinecap="round" />
                        )}
                      </svg>
                      {lit && <span className="rp-lampfly" />}
                    </span>
                  )}
                </div>
              );
            })}
            {/* the landing wake — one short ripple at a time */}
            {playing && lastMove === "step" && (
              <span
                key={`wake-${frameIndex}`}
                className="rp-wake"
                style={{
                  transform: `translate(calc(${frame.x} * (100% + 4px)), calc(${frame.y} * (100% + 4px)))`,
                }}
              />
            )}
            <div
              className={`rp-walker${bump ? " rp-walker--bump" : ""}${lit ? " rp-walker--home" : ""}`}
              style={{
                transform: `translate(calc(${frame.x} * (100% + 4px)), calc(${frame.y} * (100% + 4px)))`,
              }}
            >
              {/* contact ring where the fly met stone or edge */}
              {bump && <span className="rp-ring" data-dir={frame.dir} />}
              <div
                className={`rp-walker__inner${playing && lastMove === "step" ? " rp-hop" : ""}`}
                data-dir={frame.dir}
                data-hop={frameIndex % 2}
              >
                <BrumeMascot
                  state={lit ? "proud" : "idle"}
                  size={44}
                  presence="companion"
                  lookAt={lit ? lanternRef.current : null}
                />
                <svg viewBox="0 0 16 16" className={`rp-firefly${lit ? " rp-firefly--home" : ""}`} data-dir={frame.dir}>
                  <ellipse cx="5" cy="6" rx="3" ry="1.8" fill="var(--rp-wing)" transform="rotate(-30 5 6)" />
                  <ellipse cx="11" cy="6" rx="3" ry="1.8" fill="var(--rp-wing)" transform="rotate(30 11 6)" />
                  <circle cx="8" cy="9" r="2.6" fill="var(--brume-pear)" />
                </svg>
              </div>
              <span
                className="rp-walker__dir"
                data-dir={frame.dir}
                style={{ transform: `rotate(${pivotDeg}deg)` }}
              />
            </div>
          </div>
        </div>
      </div>

      <p className="rp-sr">
        Board: {FIREFLY_BOARD.width} columns by {FIREFLY_BOARD.height} rows. Brume starts at{" "}
        {cell(FIREFLY_START)} facing east; the stone sits at {cell({ ...FIREFLY_STONE, dir: 0 })}; the
        lantern waits at {cell({ ...FIREFLY_GOAL, dir: 0 })}. {pathSummary}
      </p>
      <p className="rp-status" role="status" aria-atomic="true">
        {settled && end ? (
          <>
            {FIREFLY_END_COPY[end]}
            <span className="rp-sr"> Brume is at {cell(frame)}.</span>
          </>
        ) : playing ? (
          "Walking…"
        ) : path.length >= FIREFLY_MAX_MOVES ? (
          "Sixteen moves is a full wind."
        ) : (
          ""
        )}
      </p>

      <div className="rp-pathrow">
        <span className="rp-pathrow__label" aria-hidden="true">Your path</span>
        <div className="rp-path" aria-hidden="true">
          {chips.length === 0 ? (
            <span className="rp-path__empty">Tap a move.</span>
          ) : (
            chips.map((c, i) => (
              <span key={i} className={`rp-chip rp-chip--${c.status}`}>
                <span className="rp-chip__glyph">{MOVE_GLYPH[c.move]}</span>
                {c.count > 1 && <span className="rp-chip__count">×{c.count}</span>}
              </span>
            ))
          )}
        </div>
        {!settled && (
          <button
            type="button"
            className="rp-undo"
            disabled={playing || path.length === 0}
            onClick={undo}
          >
            Undo
          </button>
        )}
      </div>

      {settled ? (
        <div className="rp-actions">
          <button type="button" ref={ctaRef} className="brume-btn brume-btn--push" onClick={tryAgain}>
            {end === "light" ? "Play again" : "Try another path"}
          </button>
        </div>
      ) : (
        <>
          <div className="rp-verbs" role="group" aria-label="Add a move">
            <button
              ref={stepRef}
              type="button"
              className="brume-btn brume-btn--soft rp-key"
              disabled={playing || path.length >= FIREFLY_MAX_MOVES}
              onClick={() => append("step")}
            >
              <span aria-hidden="true">↑ </span>Step
            </button>
            <button
              type="button"
              className="brume-btn brume-btn--soft rp-key"
              disabled={playing || path.length >= FIREFLY_MAX_MOVES}
              onClick={() => append("left")}
            >
              <span aria-hidden="true">↶ </span>Left
            </button>
            <button
              type="button"
              className="brume-btn brume-btn--soft rp-key"
              disabled={playing || path.length >= FIREFLY_MAX_MOVES}
              onClick={() => append("right")}
            >
              <span aria-hidden="true">↷ </span>Right
            </button>
          </div>
          <div className="rp-actions">
            <button
              type="button"
              className="brume-btn brume-btn--push"
              onClick={walk}
              disabled={playing || path.length === 0}
            >
              {playing ? "Walking…" : "Walk it"}
            </button>
          </div>
        </>
      )}
    </>
  );
}

// --- Minute scenes -------------------------------------------------

function SceneArt({ scene }: { scene: GiftScene }) {
  if (scene === "ferry") {
    return (
      <svg viewBox="0 0 240 140" className="rp-scene" role="img" aria-label="A ferry hull beside a pier in the rain">
        <rect width="240" height="140" fill="var(--rp-dusk)" />
        <path d="M0 96 H240 V140 H0 Z" fill="var(--rp-water)" />
        <path d="M30 78 L210 78 L192 104 L48 104 Z" fill="var(--rp-hull)" />
        <rect x="66" y="58" width="108" height="20" rx="4" fill="var(--rp-cabin)" />
        <rect x="78" y="63" width="12" height="10" rx="2" fill="var(--rp-lit)" />
        <rect x="98" y="63" width="12" height="10" rx="2" fill="var(--rp-lit)" />
        <rect x="118" y="63" width="12" height="10" rx="2" fill="var(--rp-lit-dim)" />
        <rect x="138" y="63" width="12" height="10" rx="2" fill="var(--rp-lit)" />
        <path d="M196 96 V140 M204 96 V140 M196 112 H204" stroke="var(--rp-pier)" strokeWidth="4" />
        {[20, 60, 100, 140, 180, 220].map((x) => (
          <path key={x} d={`M${x} 12 l-6 22`} stroke="var(--rp-rain)" strokeWidth="1.6" strokeLinecap="round" />
        ))}
        <path d="M0 116 q30 -6 60 0 t60 0 t60 0 t60 0" stroke="var(--rp-ripple)" fill="none" strokeWidth="1.5" />
      </svg>
    );
  }
  if (scene === "window") {
    return (
      <svg viewBox="0 0 240 140" className="rp-scene" role="img" aria-label="A steaming cup on a kitchen windowsill">
        <rect width="240" height="140" fill="var(--rp-wall)" />
        <rect x="50" y="16" width="140" height="88" rx="6" fill="var(--rp-dusk)" />
        <path d="M120 16 V104 M50 60 H190" stroke="var(--rp-sill-line)" strokeWidth="4" />
        <circle cx="160" cy="38" r="10" fill="var(--rp-lit)" opacity="0.85" />
        <rect x="36" y="104" width="168" height="12" rx="4" fill="var(--rp-sill)" />
        <path d="M96 84 h34 v20 a6 6 0 0 1 -6 6 h-22 a6 6 0 0 1 -6 -6 Z" fill="var(--rp-cup)" />
        <path d="M130 88 q14 2 10 12 q-3 8 -12 6" fill="none" stroke="var(--rp-cup)" strokeWidth="4" />
        <path d="M106 74 q4 -8 0 -14 M118 76 q5 -9 1 -16" stroke="var(--rp-steam)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 240 140" className="rp-scene" role="img" aria-label="Leaves and fireflies in a night garden">
      <rect width="240" height="140" fill="var(--rp-night)" />
      {[
        "M30 130 q10 -44 26 -58 q2 30 -8 58 Z",
        "M78 130 q4 -38 22 -52 q6 28 -4 52 Z",
        "M170 130 q-2 -42 18 -56 q8 30 -2 56 Z",
        "M206 130 q-8 -36 10 -50 q10 26 2 50 Z",
      ].map((d, i) => (
        <path key={i} d={d} fill="var(--rp-leaf)" />
      ))}
      {[
        [60, 44], [110, 30], [150, 58], [196, 40], [88, 66], [140, 88], [44, 82], [212, 78],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 3 : 2} fill="var(--rp-firefly)" />
      ))}
    </svg>
  );
}

function MistPanes({
  cleared,
  onClear,
  sceneName,
}: {
  cleared: boolean[];
  onClear: (i: number) => void;
  sceneName: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const activePointer = useRef<number | null>(null);

  const paneAt = (e: React.PointerEvent) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const pane = el?.closest?.("[data-pane]");
    return pane ? Number(pane.getAttribute("data-pane")) : null;
  };

  const next = cleared.findIndex((c) => !c);
  return (
    <div
      ref={rootRef}
      className="rp-mist"
      onPointerDown={(e) => {
        if (!e.isPrimary || activePointer.current !== null) return;
        if (e.target instanceof Element && e.target.closest(".rp-mist__step")) return;
        const pane = paneAt(e);
        if (pane === null) return;
        activePointer.current = e.pointerId;
        onClear(pane);
        try {
          rootRef.current?.setPointerCapture(e.pointerId);
        } catch {
          // Some engines reject capture; taps and keyboard still work.
        }
      }}
      onPointerMove={(e) => {
        if (activePointer.current !== e.pointerId) return;
        const pane = paneAt(e);
        if (pane !== null) onClear(pane);
      }}
      onLostPointerCapture={() => {
        activePointer.current = null;
      }}
      onPointerUp={() => {
        activePointer.current = null;
      }}
      onPointerCancel={() => {
        activePointer.current = null;
      }}
    >
      {cleared.map((gone, i) => (
        <button
          key={i}
          type="button"
          data-pane={i}
          className={`rp-mist__pane${gone ? " is-clear" : ""}`}
          aria-label={gone ? `Pane ${i + 1}, clear` : `Wipe pane ${i + 1} of mist over ${sceneName}`}
          aria-pressed={gone}
          disabled={gone}
          onClick={() => onClear(i)}
        />
      ))}
      <button
        type="button"
        className="brume-btn brume-btn--soft rp-mist__step"
        onClick={() => next >= 0 && onClear(next)}
        disabled={next < 0}
      >
        Clear the mist
      </button>
    </div>
  );
}

function MinuteView({ gift, onMakeBack }: { gift: Minute; onMakeBack?: () => void }) {
  const [cleared, setCleared] = useState([false, false, false]);
  const headRef = useRef<HTMLHeadingElement>(null);
  const done = cleared.every(Boolean);

  useEffect(() => {
    headRef.current?.focus();
  }, []);

  const clear = (i: number) =>
    setCleared((c) => (c[i] ? c : c.map((v, j) => (j === i ? true : v))));

  return (
    <>
      <h1 className="rp-title" tabIndex={-1} ref={headRef}>A minute for you</h1>
      <p className="rp-lede">Someone wrapped {SCENE_PROMISES[gift.scene]}. Wipe the mist — or tap each pane.</p>
      <div className="rp-gift">
        <SceneArt scene={gift.scene} />
        {!done && <MistPanes cleared={cleared} onClear={clear} sceneName={SCENE_LABELS[gift.scene]} />}
      </div>
      <p className="rp-status" role="status">
        {done ? "All three panes are clear." : `${cleared.filter(Boolean).length} of 3 panes clear.`}
      </p>
      {done && (
        <figure className="rp-line">
          <blockquote>{gift.line}</blockquote>
        </figure>
      )}
      {onMakeBack && (
        <div className="rp-actions">
          <button type="button" className="brume-btn brume-btn--push" onClick={onMakeBack} disabled={!done}>
            Make one back
          </button>
        </div>
      )}
    </>
  );
}

function MinuteComposer({ draft, setDraft }: { draft: Minute; setDraft: (m: Minute) => void }) {
  const [preview, setPreview] = useState(false);
  const headRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headRef.current?.focus();
  }, [preview]);

  const ready = draft.line.trim().length > 0;
  const shareUrl = useMemo(
    () => `${window.location.origin}/decompress?room=minute${minuteFragment(draft)}`,
    [draft],
  );

  if (preview) {
    return (
      <>
        <p className="rp-eyebrow">How it arrives</p>
        <MinuteView gift={draft} />
        <div className="rp-actions">
          <button type="button" className="brume-btn brume-btn--soft" onClick={() => setPreview(false)}>
            Keep editing
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="rp-title" tabIndex={-1} ref={headRef}>A Minute From You</h1>
      <p className="rp-lede">Pick a small scene, write one last line, and seal it into a link.</p>

      <fieldset className="rp-scenes">
        <legend className="rp-field__label">Scene</legend>
        {(["ferry", "window", "garden"] as GiftScene[]).map((scene) => (
          <button
            key={scene}
            type="button"
            className={`rp-scene-pick${draft.scene === scene ? " is-selected" : ""}`}
            aria-pressed={draft.scene === scene}
            onClick={() => setDraft({ ...draft, scene })}
          >
            <SceneArt scene={scene} />
            <span>{SCENE_LABELS[scene]}</span>
          </button>
        ))}
      </fieldset>

      <label className="rp-field">
        <span className="rp-field__label">The last line — one sentence, up to {GIFT_LINE_MAX} letters</span>
        <input
          className="rp-input"
          type="text"
          value={draft.line}
          maxLength={GIFT_LINE_MAX}
          onChange={(e) => setDraft({ ...draft, line: e.target.value })}
          placeholder="Meet me where the mist lifts."
        />
      </label>

      <div className="rp-actions">
        <button type="button" className="brume-btn brume-btn--push" onClick={() => setPreview(true)} disabled={!ready}>
          Preview it
        </button>
      </div>

      {ready && (
        <div className="rp-send">
          <ShareLink url={shareUrl} title="A minute for you" manualLabel="Or take the link yourself" />
          <p className="rp-note">{GIFT_PRIVACY}</p>
        </div>
      )}
    </>
  );
}

function MinuteRoom() {
  const fragment = window.location.hash;
  const gift = useMemo(() => (fragment ? readMinute(fragment) : null), [fragment]);
  const [draft, setDraft] = useState<Minute>({ scene: "ferry", line: "" });

  useEffect(() => {
    document.title = gift ? "A minute for you · Brume" : "A Minute From You · Brume";
    return () => {
      document.title = "Brume";
    };
  }, [gift]);

  if (fragment && !gift) {
    return (
      <>
        <h1 className="rp-title">This link has come undone</h1>
        <p className="rp-lede">
          The minute inside it can't be read — it may have been cut short on the way over.
        </p>
        <div className="rp-actions">
          <a className="brume-btn brume-btn--push" href="/decompress?room=minute">
            Make a new one
          </a>
        </div>
      </>
    );
  }

  if (gift) {
    return (
      <MinuteView
        key={fragment}
        gift={gift}
        onMakeBack={() => {
          // A fresh composer — the opened link is left behind, not resent.
          window.location.replace("/decompress?room=minute");
        }}
      />
    );
  }

  return <MinuteComposer draft={draft} setDraft={setDraft} />;
}

export default function RoomPlay({ room }: { room: "firefly" | "minute" }) {
  if (room === "firefly") {
    return (
      <div className="rp-page">
        <main className="rp-shell rp-shell--toy" data-sentry-block>
          <div className="rp-toprow">
            <a className="rp-exit" href={EXIT_HREF}>‹ Room</a>
            <ShareLink
              compact
              url={`${window.location.origin}/decompress?room=firefly`}
              title="The Last Firefly"
              manualLabel="Take the link"
            />
          </div>
          <FireflyRoom />
        </main>
      </div>
    );
  }
  return (
    <div className="rp-page">
      <main className="rp-shell" data-sentry-block>
        <a className="rp-exit" href={EXIT_HREF}>← Back to the room</a>
        <MinuteRoom />
      </main>
      <footer className="rp-footer">
        <p>A pause can be enough.</p>
      </footer>
    </div>
  );
}
