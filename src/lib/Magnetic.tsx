import { useEffect, useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/**
 * Magnetic — the element leans toward the pointer inside a trigger
 * radius and springs back with an overshoot when it leaves. The pull
 * lives on a wrapper so the child's own press squash is untouched.
 * Reduced motion: no pull at all.
 */
export function Magnetic({
  children,
  pull = 0.32,
  radius = 150,
  className,
}: {
  children: ReactNode;
  pull?: number;
  radius?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 150, damping: 11, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 150, damping: 11, mass: 0.5 });

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)");

    let enabled = !reduced.matches && !coarse.matches;
    const reset = () => {
      x.set(0);
      y.set(0);
    };
    const hardReset = () => {
      x.jump(0);
      y.jump(0);
      sx.jump(0);
      sy.jump(0);
    };
    const onMove = (e: PointerEvent) => {
      if (!enabled) return;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2 - sx.get());
      const dy = e.clientY - (r.top + r.height / 2 - sy.get());
      const inside = Math.hypot(dx, dy) < radius;
      x.set(inside ? dx * pull : 0);
      y.set(inside ? dy * pull : 0);
    };
    const onPrefChange = () => {
      enabled = !reduced.matches && !coarse.matches;
      if (!enabled) hardReset();
    };
    const onLeave = () => reset();
    reduced.addEventListener("change", onPrefChange);
    coarse.addEventListener("change", onPrefChange);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave);
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      reduced.removeEventListener("change", onPrefChange);
      coarse.removeEventListener("change", onPrefChange);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [pull, radius, x, y, sx, sy]);

  return (
    <motion.span
      ref={ref}
      className={className}
      style={{ x: sx, y: sy, display: "inline-block" }}
    >
      {children}
    </motion.span>
  );
}
