import React, { useEffect, useRef } from "react";

/**
 * Slow mist folds + pointer-lifted motes behind the practice shell.
 * Color follows html[data-daypart] via --mist-r/g/b; a check-in word
 * can override that through feelTheme — the room retints, stills and
 * thickens for heavier words (absorbed, never alarmed).
 * Session never mounts this.
 */
const rgb = { r: 147, g: 197, b: 253 };
const rgbTarget = { r: 147, g: 197, b: 253 };
let weightTarget = 0;
let weight = 0;

function readMist() {
  const s = getComputedStyle(document.documentElement);
  rgbTarget.r = Number(s.getPropertyValue("--mist-r")) || 147;
  rgbTarget.g = Number(s.getPropertyValue("--mist-g")) || 197;
  rgbTarget.b = Number(s.getPropertyValue("--mist-b")) || 253;
  weightTarget = Number(s.getPropertyValue("--brume-feel-weight")) || 0;
}

const FOLDS = [
  { x: 0.38, y: 0.30, rx: 0.42, ry: 0.30, speed: 0.00011, phase: 0.2, amp: 22, depth: 1 },
  { x: 0.62, y: 0.44, rx: 0.36, ry: 0.26, speed: 0.00008, phase: 1.6, amp: 16, depth: 0.55 },
  { x: 0.50, y: 0.58, rx: 0.48, ry: 0.20, speed: 0.00006, phase: 3.0, amp: 12, depth: 0.35 },
  { x: 0.24, y: 0.52, rx: 0.28, ry: 0.24, speed: 0.00010, phase: 4.4, amp: 18, depth: 0.7 },
  { x: 0.72, y: 0.28, rx: 0.22, ry: 0.18, speed: 0.00009, phase: 2.2, amp: 10, depth: 0.4 },
] as const;

const POOL = 200;
const LIFE = 1600;
const SPACING = 7;
const CAP = 14;
const IDLE = 0.055;

function rgba(a: number) {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

export function MistField() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointer = window.matchMedia("(pointer: coarse)");

    const pointer = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    const curr = { x: 0, y: 0 };
    const prev = { x: Number.NaN, y: Number.NaN };

    const ox = new Float32Array(POOL);
    const oy = new Float32Array(POOL);
    const vx = new Float32Array(POOL);
    const vy = new Float32Array(POOL);
    const birth = new Float32Array(POOL);
    birth.fill(Number.NaN);
    const moteSize = new Float32Array(POOL);
    let head = 0;
    let idle = 0;

    let visible = true;
    let running = true;
    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    let width = 0;
    let height = 0;
    // The sigh — when a check-in word is let go, the mist gathers
    // toward that point, swells, then releases (~1.5s, half-sine).
    let sighX = 0;
    let sighY = 0;
    let sighT = Number.NEGATIVE_INFINITY;

    const spawn = (x: number, y: number, staticAge = false) => {
      const i = head;
      head = (head + 1) % POOL;
      ox[i] = x;
      oy[i] = y;
      vx[i] = (Math.random() - 0.5) * 22;
      vy[i] = -10 - Math.random() * 24;
      birth[i] = staticAge ? -1 : elapsed;
      moteSize[i] = 0.55 + Math.random() * 0.7;
    };

    const seedStill = () => {
      for (let i = 0; i < 48; i++) {
        const t = i / 47;
        spawn(
          width * (0.28 + t * 0.44),
          height * (0.34 + Math.sin(t * Math.PI) * 0.14),
          true,
        );
      }
    };

    const emitAlong = (dt: number) => {
      if (coarsePointer.matches || reduceMotion.matches) return;
      if (Number.isNaN(prev.x)) {
        prev.x = curr.x;
        prev.y = curr.y;
        return;
      }

      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const dist = Math.hypot(dx, dy);
      const count = Math.min(CAP, Math.floor(dist / SPACING));

      for (let i = 1; i <= count; i++) {
        const t = i / count;
        spawn(prev.x + dx * t, prev.y + dy * t);
      }

      if (count) {
        prev.x = curr.x;
        prev.y = curr.y;
        idle = 0;
      } else {
        idle += dt;
        if (idle > IDLE) {
          spawn(curr.x, curr.y);
          idle = 0;
        }
      }
    };

    const drawFold = (
      x: number,
      y: number,
      rx: number,
      ry: number,
      alpha: number,
    ) => {
      const r = Math.max(rx, ry);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(alpha));
      g.addColorStop(0.42, rgba(alpha * 0.35));
      g.addColorStop(1, rgba(0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawMotes = () => {
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < POOL; i++) {
        const staticMote = birth[i] === -1;
        if (!staticMote && !Number.isFinite(birth[i])) continue;

        const age = staticMote ? LIFE * 0.35 : elapsed - birth[i];
        if (!staticMote && (age < 0 || age > LIFE)) continue;

        const u = Math.min(1, Math.max(0, age / LIFE));
        const lift = staticMote ? 0 : u;
        const x = ox[i] + vx[i] * lift + Math.sin((i + u) * 4.2) * 8 * lift;
        const y = oy[i] + vy[i] * lift;
        const fade = staticMote
          ? 0.22
          : Math.sin(Math.min(1, u / 0.12) * Math.PI * 0.5) * (1 - Math.max(0, (u - 0.4) / 0.6));
        const r = (1.6 + moteSize[i] * 2.4) * (staticMote ? 1 : 1 - u * 0.35);

        ctx.fillStyle = rgba(0.42 * fade);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const paint = (t: number) => {
      readMist();
      if (reduceMotion.matches) {
        rgb.r = rgbTarget.r;
        rgb.g = rgbTarget.g;
        rgb.b = rgbTarget.b;
        weight = weightTarget;
      } else {
        // The room settles into the feeling over ~1s — absorb, not snap.
        rgb.r += (rgbTarget.r - rgb.r) * 0.05;
        rgb.g += (rgbTarget.g - rgb.g) * 0.05;
        rgb.b += (rgbTarget.b - rgb.b) * 0.05;
        weight += (weightTarget - weight) * 0.045;
      }
      const still = 1 - weight * 0.6;
      const lift = Math.max(0, 0.35 - weight) * 0.5;
      const amp = still + lift;
      const dense = 1 + (weight - 0.35) * 0.5;
      const reach = 1 - weight * 0.5;
      const depth = 0.03 + weight * 0.025;
      const breathe = reduceMotion.matches ? 1 : 1 - depth + Math.sin(t * 0.00022) * depth;
      const sighAge = elapsed - sighT;
      const sigh =
        !reduceMotion.matches && sighAge >= 0 && sighAge < 1500
          ? Math.sin((sighAge / 1500) * Math.PI)
          : 0;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "screen";

      for (const fold of FOLDS) {
        const driftX = reduceMotion.matches
          ? 0
          : Math.sin(t * fold.speed + fold.phase) * fold.amp * amp;
        const driftY = reduceMotion.matches
          ? 0
          : Math.cos(t * fold.speed * 0.85 + fold.phase) * fold.amp * 0.55 * amp;
        const parallax = (10 + fold.depth * 14) * reach;
        let x = fold.x * width + driftX + pointer.x * parallax;
        let y = fold.y * height + driftY + pointer.y * parallax * 0.7;
        if (sigh > 0) {
          // Nearby folds lean in toward where the word was let go —
          // the room gathers it in rather than rippling out.
          const dx = sighX - x;
          const dy = sighY - y;
          const d = Math.hypot(dx, dy) || 1;
          const gather = sigh * 30 * Math.exp(-d / (Math.max(width, height) * 0.55)) * fold.depth;
          x += (dx / d) * gather;
          y += (dy / d) * gather;
        }
        const swell = 1 + sigh * 0.14 * fold.depth;
        const rx = fold.rx * width * breathe * swell;
        const ry = fold.ry * height * breathe * swell;
        drawFold(x, y, rx, ry, (0.32 + fold.depth * 0.14) * dense * (1 + sigh * 0.5));
      }

      drawMotes();
      ctx.globalCompositeOperation = "source-over";
    };

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduceMotion.matches) {
        seedStill();
        paint(0);
      }
    };

    const frame = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);

      const hidden = document.hidden || !visible;
      const dt = Math.min(1 / 30, (now - last) / 1000);
      last = now;

      if (hidden || reduceMotion.matches) return;

      elapsed += dt * 1000;
      pointer.x += (target.x - pointer.x) * 0.08;
      pointer.y += (target.y - pointer.y) * 0.08;
      emitAlong(dt);
      paint(elapsed);
    };

    const onPointer = (event: PointerEvent) => {
      if (coarsePointer.matches || reduceMotion.matches) return;
      target.x = event.clientX / window.innerWidth - 0.5;
      target.y = event.clientY / window.innerHeight - 0.5;
      curr.x = event.clientX;
      curr.y = event.clientY;
    };

    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      prev.x = Number.NaN;
      prev.y = Number.NaN;
    };

    const onVisibility = () => {
      if (!document.hidden) last = performance.now();
    };

    const onFeel = (event: Event) => {
      const detail = (event as CustomEvent).detail ?? {};
      sighX = typeof detail.x === "number" ? detail.x : curr.x;
      sighY = typeof detail.y === "number" ? detail.y : curr.y;
      sighT = elapsed;
    };

    curr.x = window.innerWidth / 2;
    curr.y = window.innerHeight / 2;
    resize();
    if (reduceMotion.matches) seedStill();
    paint(0);

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? true;
      },
      { threshold: 0.01 },
    );
    io.observe(wrap);

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("visibilitychange", onVisibility);
    document.documentElement.addEventListener("brume:feel", onFeel);
    raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      document.documentElement.removeEventListener("brume:feel", onFeel);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}

export default MistField;
