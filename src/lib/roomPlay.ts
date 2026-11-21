/**
 * roomPlay — the two small experiments that live in the Decompress room.
 *
 * Firefly: a tiny lantern-board puzzle. A closed grammar of moves walks
 * the companion across a 5×3 board; everything is parsed and run here
 * so the UI only plays frames back. Nothing is stored, sent, or
 * interpreted beyond this grammar — it is not a language model.
 *
 * Minute: a one-line gift sealed into the URL fragment. The fragment
 * never reaches a server; `minuteFragment`/`readMinute` are the whole
 * envelope.
 */

export type Move = "step" | "left" | "right";

export const FIREFLY_MAX_MOVES = 16;
const MAX_MOVES = FIREFLY_MAX_MOVES;
const MAX_REPEAT = 8;

const STEP_WORDS = new Set(["step", "forward"]);

/**
 * Parse an instruction like "step 2, then left, step" into moves.
 * Grammar: items joined by spaces, commas or the word "then"; each item
 * is a verb — `step`/`forward`, `left`/`turn left`, `right`/`turn right` —
 * with an optional repeat count 1-8. Unknown words, stray numbers,
 * trailing separators or more than 16 moves all return null; nothing
 * is silently skipped.
 */
export function parseMoves(input: string): Move[] | null {
  const tokens = input
    .trim()
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(Boolean);
  if (tokens.length === 0) return null;

  const moves: Move[] = [];
  let expectItem = true; // a "then" separator may not lead or trail

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === "then") {
      if (expectItem) return null; // leading "then" or doubled separator
      expectItem = true;
      continue;
    }
    expectItem = false;

    let move: Move;
    if (STEP_WORDS.has(token)) {
      move = "step";
    } else if (token === "left" || token === "right") {
      move = token;
    } else if (token === "turn") {
      const next = tokens[++i];
      if (next !== "left" && next !== "right") return null;
      move = next;
    } else {
      return null;
    }

    let repeat = 1;
    const count = tokens[i + 1];
    if (count !== undefined && /^[0-9]+$/.test(count)) {
      repeat = Number(count);
      if (repeat < 1 || repeat > MAX_REPEAT) return null;
      i++;
    }
    if (moves.length + repeat > MAX_MOVES) return null;
    for (let r = 0; r < repeat; r++) moves.push(move);
  }
  if (expectItem) return null; // trailing "then"/separator
  return moves;
}

// --- Firefly board -------------------------------------------------

export interface FireflyFrame {
  x: number;
  y: number;
  /** 0=E, 1=S, 2=W, 3=N (y grows downward, like the screen). */
  dir: number;
}

export const FIREFLY_BOARD = { width: 5, height: 3 } as const;
export const FIREFLY_START: FireflyFrame = { x: 0, y: 1, dir: 0 };
export const FIREFLY_GOAL = { x: 4, y: 1 } as const;
export const FIREFLY_STONE = { x: 2, y: 1 } as const;

const DELTAS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

const isGoal = (x: number, y: number) => x === FIREFLY_GOAL.x && y === FIREFLY_GOAL.y;
const isStone = (x: number, y: number) => x === FIREFLY_STONE.x && y === FIREFLY_STONE.y;
const onBoard = (x: number, y: number) =>
  x >= 0 && y >= 0 && x < FIREFLY_BOARD.width && y < FIREFLY_BOARD.height;

/**
 * Run a move list over the board. Frames record every visited pose —
 * including pure turns, so playback can show them. The run stops at the
 * first goal, collision or edge; "short" means the moves simply ran out.
 */
export function runFirefly(moves: readonly Move[]): {
  frames: FireflyFrame[];
  end: "light" | "stone" | "edge" | "short";
} {
  const frames: FireflyFrame[] = [{ ...FIREFLY_START }];
  let { x, y, dir } = FIREFLY_START;

  for (const move of moves) {
    if (move === "left" || move === "right") {
      dir = (dir + (move === "left" ? 3 : 1)) % 4;
      frames.push({ x, y, dir });
      continue;
    }
    const [dx, dy] = DELTAS[dir];
    const nx = x + dx;
    const ny = y + dy;
    if (isStone(nx, ny)) return { frames, end: "stone" };
    if (!onBoard(nx, ny)) return { frames, end: "edge" };
    x = nx;
    y = ny;
    frames.push({ x, y, dir });
    if (isGoal(x, y)) return { frames, end: "light" };
  }
  return { frames, end: "short" };
}

// --- Minute gift ---------------------------------------------------

export type GiftScene = "ferry" | "window" | "garden";

export interface Minute {
  scene: GiftScene;
  line: string;
}

const GIFT_VERSION = "1";
const GIFT_SCENES: ReadonlySet<string> = new Set(["ferry", "window", "garden"]);
export const GIFT_LINE_MAX = 140;
const GIFT_FRAGMENT_MAX = 4096;

/**
 * Seal a minute into a URL fragment: `#v=1&scene=ferry&line=…`.
 * URLSearchParams does the escaping, so any unicode — &, #, emoji —
 * survives the trip. The caller puts it after the path; it is never
 * sent anywhere.
 */
export function minuteFragment(gift: Minute): string {
  const params = new URLSearchParams();
  params.set("v", GIFT_VERSION);
  params.set("scene", gift.scene);
  params.set("line", gift.line);
  return `#${params.toString()}`;
}

/** Closed copy sets — the only words these rooms can show. */
export const FIREFLY_END_COPY = {
  light: "The light is home.",
  stone: "Oh. A stone.",
  edge: "The edge of the room.",
  short: "A few steps short.",
} as const;

export const GIFT_PRIVACY =
  "Your line travels in the link. Anyone with it can read it.";

export const SCENE_LABELS: Record<GiftScene, string> = {
  ferry: "Rain ferry",
  window: "Kitchen window",
  garden: "Night garden",
};

export const SCENE_PROMISES: Record<GiftScene, string> = {
  ferry: "a crossing under rain",
  window: "a warm sill at dusk",
  garden: "small lights between leaves",
};

/**
 * Open a minute fragment. Returns null for anything malformed:
 * overlong input, unknown version or scene, blank or >140 UTF-16-unit
 * lines, duplicate keys, or keys we do not use.
 */
export function readMinute(hash: string): Minute | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (raw.length === 0 || raw.length >= GIFT_FRAGMENT_MAX) return null;

  const seen = new Set<string>();
  for (const pair of raw.split("&")) {
    const key = pair.split("=", 1)[0];
    let decodedKey: string;
    try {
      decodedKey = decodeURIComponent(key.replace(/\+/g, " "));
    } catch {
      return null;
    }
    if (seen.has(decodedKey)) return null;
    seen.add(decodedKey);
  }

  const params = new URLSearchParams(raw);
  if (params.get("v") !== GIFT_VERSION) return null;
  const scene = params.get("scene");
  const line = params.get("line");
  if (seen.size !== 3 || !scene || !GIFT_SCENES.has(scene)) return null;
  if (line === null || line.trim() === "" || line.length > GIFT_LINE_MAX) return null;
  return { scene: scene as GiftScene, line };
}
