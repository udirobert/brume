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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onMove = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const inside = Math.hypot(dx, dy) < radius;
      x.set(inside ? dx * pull : 0);
      y.set(inside ? dy * pull : 0);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [pull, radius, x, y]);

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
