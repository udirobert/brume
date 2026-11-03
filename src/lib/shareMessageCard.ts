/**
 * Message card — the canvas-rendered share image for "Put it into words".
 *
 * Where proofCard sells the practice (duration hero, stats), this card
 * carries the person's own sentence: a 1080×1920 portrait image with a
 * warm paper ground, a mist halo tinted by the feeling they checked in
 * with, the Brume blob drawn as plain ellipses, and their words wrapped
 * and centred. It lands in a camera roll or chat as a designed artefact,
 * not bare text.
 *
 * Nothing is shared unless the person chooses Share; every API is
 * guarded so the worst case is copying the sentence as plain text.
 */

const W = 1080;
const H = 1920;

// Brand colours — same warm paper/ink family as proofCard.
const BG_DEEP = "#f4f0e2";
const BG_MID = "#efe9d6";
const TEXT_PRIMARY = "#1e2237";
const TEXT_SECONDARY = "rgba(30, 34, 55, 0.55)";
const DEFAULT_MIST: readonly [number, number, number] = [198, 214, 60];

/**
 * Turn a CSS colour from `--brume-orb-mist` ("rgb(146 158 214)" or hex)
 * into an rgba() string at the given alpha. Unknown formats fall back
 * to the pear mist used by the proof card.
 */
export function mistRgba(
  orbMistCss: string | null | undefined,
  alpha: number,
): string {
  let rgb: readonly [number, number, number] = DEFAULT_MIST;
  if (orbMistCss) {
    const spaced = orbMistCss.match(/(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/);
    if (spaced) {
      rgb = [Number(spaced[1]), Number(spaced[2]), Number(spaced[3])];
    } else {
      const hex = orbMistCss.match(/#([0-9a-f]{6})/i);
      if (hex) {
        const v = hex[1];
        rgb = [
          parseInt(v.slice(0, 2), 16),
          parseInt(v.slice(2, 4), 16),
          parseInt(v.slice(4, 6), 16),
        ];
      }
    }
  }
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

/**
 * Greedy word wrap driven by an injected measurer so it stays testable
 * without a canvas. Returns at most `maxLines` lines; if words remain,
 * the last line is shrunk to make room for a trailing ellipsis.
 */
export function wrapText(
  measure: (text: string) => number,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0 || maxLines < 1) return [];

  const lines: string[] = [];
  let line = "";
  let wi = 0;
  while (wi < words.length && lines.length < maxLines) {
    const candidate = line ? `${line} ${words[wi]}` : words[wi];
    if (line && measure(candidate) > maxWidth) {
      lines.push(line);
      line = "";
    } else {
      line = candidate;
      wi += 1;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);

  if (wi < words.length && lines.length > 0) {
    let last = lines[lines.length - 1];
    while (last && measure(`${last}…`) > maxWidth) {
      const cut = last.lastIndexOf(" ");
      last = cut > 0 ? last.slice(0, cut) : last.slice(0, -1);
    }
    lines[lines.length - 1] = last ? `${last}…` : "…";
  }
  return lines;
}

/** Download/share filename, slugged by the practised pattern when known. */
export function messageCardFilename(patternName?: string): string {
  const slug = (patternName ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `brume-words-${slug}.png` : "brume-words.png";
}

/**
 * Render the message card to a PNG Blob. Returns null whenever canvas
 * is unavailable (SSR, jsdom, disabled 2d context) so callers can fall
 * back to plain text.
 */
export async function renderMessageCard(
  message: string,
  orbMistCss?: string,
): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // --- Warm paper ground ---
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, BG_DEEP);
  bgGrad.addColorStop(0.5, BG_MID);
  bgGrad.addColorStop(1, BG_DEEP);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // --- Mist halo behind the blob, tinted by the checked-in feeling ---
  const haloGrad = ctx.createRadialGradient(W / 2, 620, 0, W / 2, 620, 560);
  haloGrad.addColorStop(0, mistRgba(orbMistCss, 0.4));
  haloGrad.addColorStop(0.55, mistRgba(orbMistCss, 0.14));
  haloGrad.addColorStop(1, "transparent");
  ctx.fillStyle = haloGrad;
  ctx.fillRect(0, 0, W, 1200);

  // --- Small wordmark ---
  ctx.fillStyle = TEXT_SECONDARY;
  ctx.font = "300 34px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.letterSpacing = "8px";
  ctx.fillText("BRUME", W / 2, 140);
  ctx.letterSpacing = "0px";

  // --- Brume blob silhouette — three soft ellipses, nothing else ---
  const cx = W / 2;
  const cy = 640;
  ctx.fillStyle = mistRgba(orbMistCss, 0.85);
  const blob = (dx: number, dy: number, rx: number, ry: number) => {
    ctx.beginPath();
    ctx.ellipse(cx + dx, cy + dy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  blob(-100, -80, 120, 100); // left lobe
  blob(95, -95, 135, 105); // right lobe
  blob(0, 30, 220, 175); // body

  // --- The message — wrapped, centred, four lines at most ---
  ctx.fillStyle = TEXT_PRIMARY;
  ctx.font = "400 58px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  const lines = wrapText(
    (s) => ctx.measureText(s).width,
    message.trim(),
    W - 260,
    4,
  );
  const lineHeight = 88;
  const centreY = 1240;
  const startY = centreY - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((lineText, i) => {
    ctx.fillText(lineText, W / 2, startY + i * lineHeight);
  });

  // --- Bottom mist echo + footer ---
  const bottomGrad = ctx.createRadialGradient(W / 2, H - 160, 0, W / 2, H - 160, 420);
  bottomGrad.addColorStop(0, mistRgba(orbMistCss, 0.12));
  bottomGrad.addColorStop(1, "transparent");
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, H - 520, W, 520);

  ctx.fillStyle = TEXT_SECONDARY;
  ctx.font = "300 28px system-ui, -apple-system, sans-serif";
  ctx.fillText("a moment to breathe", W / 2, H - 110);

  if (typeof canvas.toBlob !== "function") return null;
  return new Promise((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/png", 0.95);
  });
}

export type MessageCardShareResult =
  | "shared"
  | "downloaded"
  | "copied"
  | "unavailable";

/** Clipboard write with every API guarded; resolves to whether it worked. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== "function"
    ) {
      return false;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Share the rendered card: Web Share API with the PNG file first, a PNG
 * download when files can't be shared, and the sentence itself copied
 * to the clipboard when no image path exists at all.
 */
export async function shareMessageCard(options: {
  message: string;
  orbMistCss?: string;
  patternName?: string;
}): Promise<MessageCardShareResult> {
  const { message, orbMistCss, patternName } = options;
  const filename = messageCardFilename(patternName);

  let blob: Blob | null;
  try {
    blob = await renderMessageCard(message, orbMistCss);
  } catch {
    blob = null;
  }

  if (blob && typeof navigator !== "undefined") {
    try {
      const file = new File([blob], filename, { type: "image/png" });
      if (
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] }) &&
        typeof navigator.share === "function"
      ) {
        try {
          await navigator.share({
            title: "Brume",
            text: message,
            files: [file],
          });
          return "shared";
        } catch (err) {
          // Share sheet dismissed — the person chose to cancel.
          if (err instanceof Error && err.name === "AbortError") {
            return "shared";
          }
        }
      }
    } catch {
      // File / canShare unsupported — fall through to download.
    }
  }

  if (
    blob &&
    typeof document !== "undefined" &&
    typeof URL !== "undefined" &&
    typeof URL.createObjectURL === "function"
  ) {
    try {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      return "downloaded";
    } catch {
      // Fall through to copying the sentence itself.
    }
  }

  return (await copyText(message)) ? "copied" : "unavailable";
}
