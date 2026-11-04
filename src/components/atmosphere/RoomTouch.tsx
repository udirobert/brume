import { useEffect, useRef } from "react";
import { track } from "@/lib/events";
import { resolvedMaterial, useRoomExperience } from "@/lib/roomExperience";
import {
  DAB_LIFE_S,
  MAX_DABS,
  ageFade,
  dabFor,
  dabSpacing,
  hushFromSpeed,
  mascotBreath,
} from "@/lib/mistBrush";

/**
 * The room answers touch. Press and drag on empty space and it leaves
 * soft mist, fuller as the companion breathes in, thinner as it breathes
 * out, and fainter when the hand hurries. No page, no mode, nothing
 * saved: every dab fades by itself. Only counts leave the device
 * (strokes, seconds), never the drawing.
 *
 * Mounted on Home only. Buttons, links, fields and the mascot keep their
 * own taps — a stroke never starts on them.
 */
const SPRITE = 64;
const IGNORE =
  "button, a, input, select, textarea, summary, details, label, [role='button'], [data-journey-companion], [data-companion-anchor]";

function readRgb(): [number, number, number] {
  const s = getComputedStyle(document.documentElement);
  return [
    Number(s.getPropertyValue("--mist-r")) || 147,
    Number(s.getPropertyValue("--mist-g")) || 197,
    Number(s.getPropertyValue("--mist-b")) || 253,
  ];
}

function makeSprite(rgb: [number, number, number]): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = SPRITE;
  const g = c.getContext("2d");
  if (g) {
    const r = SPRITE / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    const [R, G, B] = rgb;
    grad.addColorStop(0, `rgba(${R},${G},${B},1)`);
    grad.addColorStop(0.45, `rgba(${R},${G},${B},0.45)`);
    grad.addColorStop(1, `rgba(${R},${G},${B},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, SPRITE, SPRITE);
  }
  return c;
}

export function RoomTouch() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dx = new Float32Array(MAX_DABS);
    const dy = new Float32Array(MAX_DABS);
    const dr = new Float32Array(MAX_DABS);
    const da = new Float32Array(MAX_DABS);
    const born = new Float32Array(MAX_DABS).fill(Number.NaN);
    let head = 0;

    let rgb = readRgb();
    let sprite = makeSprite(rgb);
    let tintAt = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let drawing = false;
    let pointerId = -1;
    let lastX = 0;
    let lastY = 0;
    let lastMs = 0;
    let speed = 0;
    let carry = 0;
    let strokes = 0;
    let drawnMs = 0;
    const t0 = performance.now();
    // Same clock as the mascot (performance.now() / 1000), so the brush
    // and the sprite breathe in step.
    const clock = () => performance.now() / 1000;
    const since = () => (performance.now() - t0) / 1000;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, window.innerWidth);
      height = Math.max(1, window.innerHeight);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    };

    const dab = (x: number, y: number, hush: number) => {
      const d = dabFor(mascotBreath(clock()), hush);
      const i = head;
      head = (head + 1) % MAX_DABS;
      dx[i] = x;
      dy[i] = y;
      dr[i] = d.radius;
      da[i] = d.alpha;
      born[i] = since();
    };

    const schedule = () => {
      if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
    };

    function frame() {
      raf = 0;
      const t = since();
      if (t - tintAt > 0.5) {
        tintAt = t;
        const next = readRgb();
        if (next[0] !== rgb[0] || next[1] !== rgb[1] || next[2] !== rgb[2]) {
          rgb = next;
          sprite = makeSprite(rgb);
        }
      }
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.clearRect(0, 0, width, height);
      let alive = 0;
      for (let i = 0; i < MAX_DABS; i++) {
        const bt = born[i];
        if (Number.isNaN(bt)) continue;
        const age = t - bt;
        if (age >= DAB_LIFE_S) {
          born[i] = Number.NaN;
          continue;
        }
        alive++;
        ctx!.globalAlpha = da[i] * ageFade(age);
        const r = dr[i];
        ctx!.drawImage(sprite, dx[i] - r, dy[i] - r, r * 2, r * 2);
      }
      ctx!.globalAlpha = 1;
      if (alive > 0 || drawing) schedule();
    }

    const end = () => {
      if (!drawing) return;
      drawing = false;
      pointerId = -1;
      speed = 0;
      drawnMs += performance.now() - lastMs;
      delete document.documentElement.dataset.drawing;
    };

    const onDown = (e: PointerEvent) => {
      if (e.button > 0 || drawing) return;
      const el = e.target as Element | null;
      if (el?.closest?.(IGNORE)) return;
      drawing = true;
      pointerId = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
      lastMs = performance.now();
      speed = 0;
      carry = 0;
      strokes++;
      document.documentElement.dataset.drawing = "1";
      dab(e.clientX, e.clientY, 0);
      schedule();
    };

    const onMove = (e: PointerEvent) => {
      if (!drawing || e.pointerId !== pointerId) return;
      const now = performance.now();
      const dt = Math.max(0.001, (now - lastMs) / 1000);
      const dist = Math.hypot(e.clientX - lastX, e.clientY - lastY);
      // Same smoothing as the mascot's pointer speed (EMA 0.35).
      speed += (dist / dt - speed) * 0.35;
      const hush = hushFromSpeed(speed);
      const spacing = dabSpacing(dabFor(mascotBreath(clock()), hush).radius);
      const ux = dist ? (e.clientX - lastX) / dist : 0;
      const uy = dist ? (e.clientY - lastY) / dist : 0;
      // Walk the segment, placing a dab every `spacing` px; `carry` is
      // the distance already walked since the last dab.
      let pos = spacing - carry;
      let lastDab = -carry;
      let guard = 0;
      while (pos <= dist && guard++ < 24) {
        dab(lastX + ux * pos, lastY + uy * pos, hush);
        lastDab = pos;
        pos += spacing;
      }
      carry = dist - lastDab;
      lastX = e.clientX;
      lastY = e.clientY;
      lastMs = now;
      schedule();
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    document.addEventListener("visibilitychange", schedule);

    return () => {
      end();
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      document.removeEventListener("visibilitychange", schedule);
      if (strokes > 0) {
        track("room_touch", {
          strokes,
          seconds: Math.round(drawnMs / 1000),
          material: resolvedMaterial(useRoomExperience.getState()),
        });
      }
    };
  }, []);

  return <canvas ref={canvasRef} className="brume-room-touch" aria-hidden="true" />;
}

export default RoomTouch;
