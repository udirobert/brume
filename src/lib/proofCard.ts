/**
 * Proof Card — canvas-rendered shareable image for completed sessions.
 *
 * Generates a 1080×1920 vertical image (stories/phone share format) that
 * users can share via navigator.share (Web Share API with files) or
 * download. This is the Grand Prize virality surface — a designed image
 * card that lands in someone's camera roll or social feed, not forgettable
 * text.
 *
 * The visual language mirrors the mist orb: layered radial gradients on a
 * deep dark background, with the practice duration as the hero element.
 */
import { formatPracticeDuration } from "./utils/practice-duration";

export interface ProofCardData {
  patternName: string;
  duration: number;       // seconds
  cycles?: number;
  streak?: number;
  date?: Date;
}

const W = 1080;
const H = 1920;

// Brand colors
const BG_DEEP = "#0a0e1a";
const BG_MID = "#121829";
const MIST_BLUE = "rgba(147, 197, 253, 0.35)";
const MIST_BLUE_DIM = "rgba(147, 197, 253, 0.12)";
const TEXT_PRIMARY = "#f0f4ff";
const TEXT_SECONDARY = "rgba(240, 244, 255, 0.55)";
const ACCENT = "#93c5fd";

/**
 * Render the share card to a canvas and return a Blob (image/png).
 */
export async function renderProofCard(data: ProofCardData): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // --- Background: deep gradient ---
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, BG_DEEP);
  bgGrad.addColorStop(0.5, BG_MID);
  bgGrad.addColorStop(1, BG_DEEP);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // --- Mist halo at top — mirrors the orb visual ---
  const haloGrad = ctx.createRadialGradient(W / 2, 400, 0, W / 2, 400, 500);
  haloGrad.addColorStop(0, MIST_BLUE);
  haloGrad.addColorStop(0.5, MIST_BLUE_DIM);
  haloGrad.addColorStop(1, "transparent");
  ctx.fillStyle = haloGrad;
  ctx.fillRect(0, 0, W, 800);

  // Smaller inner glow
  const innerGrad = ctx.createRadialGradient(W / 2, 400, 0, W / 2, 400, 250);
  innerGrad.addColorStop(0, "rgba(147, 197, 253, 0.25)");
  innerGrad.addColorStop(1, "transparent");
  ctx.fillStyle = innerGrad;
  ctx.fillRect(0, 150, W, 500);

  // --- Brand wordmark ---
  ctx.fillStyle = TEXT_PRIMARY;
  ctx.font = "300 42px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.letterSpacing = "8px";
  ctx.fillText("BRUME", W / 2, 120);

  // Tagline
  ctx.fillStyle = TEXT_SECONDARY;
  ctx.font = "300 24px system-ui, -apple-system, sans-serif";
  ctx.fillText("a quiet moment to breathe", W / 2, 160);

  // --- Session mark — simple ring, no verification claims ---
  ctx.strokeStyle = `rgba(147, 197, 253, 0.3)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(W / 2, 500, 120, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = TEXT_SECONDARY;
  ctx.font = "400 22px system-ui, -apple-system, sans-serif";
  ctx.fillText("SESSION COMPLETE", W / 2, 620);

  // --- Duration — large, centered ---
  ctx.fillStyle = TEXT_PRIMARY;
  ctx.font = "700 120px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(formatPracticeDuration(data.duration), W / 2, 820);

  ctx.fillStyle = TEXT_SECONDARY;
  ctx.font = "400 28px system-ui, -apple-system, sans-serif";
  ctx.fillText("practice time", W / 2, 870);

  // --- Stats row ---
  const stats = [{ label: "PATTERN", value: data.patternName }];
  if (data.cycles != null) {
    stats.push({ label: "CYCLES", value: String(data.cycles) });
  }
  if (data.streak && data.streak > 0) {
    stats.push({ label: "STREAK", value: `${data.streak}d` });
  }

  const statY = 1000;
  const statSpacing = W / (stats.length + 1);

  stats.forEach((stat, i) => {
    const x = statSpacing * (i + 1);
    ctx.fillStyle = TEXT_SECONDARY;
    ctx.font = "600 16px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(stat.label, x, statY);

    ctx.fillStyle = TEXT_PRIMARY;
    ctx.font = "400 32px system-ui, -apple-system, sans-serif";
    // Truncate long pattern names
    const value = stat.value.length > 16 ? stat.value.substring(0, 14) + "…" : stat.value;
    ctx.fillText(value, x, statY + 45);
  });

  // --- Divider ---
  ctx.strokeStyle = "rgba(147, 197, 253, 0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(200, 1120);
  ctx.lineTo(W - 200, 1120);
  ctx.stroke();

  // --- Date ---
  const date = data.date || new Date();
  ctx.fillStyle = TEXT_SECONDARY;
  ctx.font = "300 24px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    W / 2,
    1180,
  );

  // --- Bottom mist glow ---
  const bottomGrad = ctx.createRadialGradient(W / 2, H - 200, 0, W / 2, H - 200, 400);
  bottomGrad.addColorStop(0, MIST_BLUE_DIM);
  bottomGrad.addColorStop(1, "transparent");
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, H - 400, W, 400);

  // --- URL ---
  ctx.fillStyle = ACCENT;
  ctx.font = "400 28px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("brume.trustfall.xyz", W / 2, H - 120);

  ctx.fillStyle = TEXT_SECONDARY;
  ctx.font = "300 20px system-ui, -apple-system, sans-serif";
  ctx.fillText("progress over perfection", W / 2, H - 80);

  // --- Convert to blob ---
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png", 0.95);
  });
}

/**
 * Share the proof card via Web Share API (with file) or download fallback.
 */
export async function shareProofCard(data: ProofCardData): Promise<"shared" | "downloaded" | "copied"> {
  const blob = await renderProofCard(data);
  if (!blob) {
    // Fallback: copy text
    await copyTextFallback(data);
    return "copied";
  }

  const file = new File([blob], "brume-proof.png", { type: "image/png" });

  // Try Web Share API with file
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: "Brume",
        text: shareText(data),
        files: [file],
      });
      return "shared";
    } catch (err) {
      // User dismissed — don't fallback, they chose to cancel
      if (err instanceof Error && err.name === "AbortError") return "shared";
    }
  }

  // Fallback: download the image
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "brume-proof.png";
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}

function shareText(data: ProofCardData): string {
  const parts = [
    `A session on Brume`,
    `${data.patternName} · ${formatPracticeDuration(data.duration)}`,
    data.streak ? `${data.streak}-day streak` : "",
  ].filter(Boolean);
  return parts.join(" · ") + " 🌫️";
}

async function copyTextFallback(data: ProofCardData): Promise<void> {
  const text = `${shareText(data)} — https://brume.trustfall.xyz`;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // silent fail
  }
}
