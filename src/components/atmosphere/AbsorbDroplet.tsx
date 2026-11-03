/**
 * AbsorbDroplet — the room takes the word.
 *
 * A check-in tap sheds a soft blob that detaches, stretches and melts
 * toward the mascot through an SVG goo filter; the room's retint
 * settles as it arrives. One-shot, pointer-events-none, cleans itself
 * up. Never rendered under reduced motion (the caller checks).
 */
import { useEffect, useRef } from "react";
import { EASE } from "@/lib/motion";

interface Point {
  x: number;
  y: number;
}

interface AbsorbDropletProps {
  /** Viewport point the word was tapped at (chip centre). */
  from: Point;
  /** Viewport point the droplet is absorbed into (mascot centre). */
  to: Point;
  color: string;
  onDone: () => void;
}

const ease = `cubic-bezier(${EASE.join(",")})`;

export function AbsorbDroplet({ from, to, color, onDone }: AbsorbDropletProps) {
  const mainRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const budRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const midX = (from.x + to.x) / 2;
    const midY = Math.min(from.y, to.y) - 90;
    const anims: Animation[] = [];

    const path = (r: number): Keyframe[] => [
      {
        transform: `translate(${from.x - r}px, ${from.y - r}px) scale(0.35)`,
        opacity: 0,
      },
      {
        transform: `translate(${from.x - r}px, ${from.y - r}px) scale(1.12)`,
        opacity: 1,
        offset: 0.16,
      },
      {
        transform: `translate(${midX - r}px, ${midY - r}px) scale(0.8)`,
        opacity: 1,
        offset: 0.62,
      },
      {
        transform: `translate(${to.x - r}px, ${to.y - r}px) scale(0.12)`,
        opacity: 0,
      },
    ];

    if (mainRef.current) {
      anims.push(
        mainRef.current.animate(path(17), {
          duration: 480,
          easing: ease,
          fill: "forwards",
        }),
      );
    }
    // A trailing droplet keeps the goo stretched, then merges at arrival.
    if (trailRef.current) {
      anims.push(
        trailRef.current.animate(path(10), {
          duration: 480,
          delay: 85,
          easing: ease,
          fill: "backwards",
        }),
      );
    }
    // The bit that stays behind — the word letting go of the chip.
    if (budRef.current) {
      anims.push(
        budRef.current.animate(
          [
            {
              transform: `translate(${from.x - 8}px, ${from.y - 8}px) scale(1)`,
              opacity: 0.9,
            },
            {
              transform: `translate(${from.x - 8}px, ${from.y - 8}px) scale(0)`,
              opacity: 0,
            },
          ],
          { duration: 300, delay: 120, easing: ease, fill: "backwards" },
        ),
      );
    }

    const timer = window.setTimeout(onDone, 620);
    return () => {
      window.clearTimeout(timer);
      anims.forEach((a) => a.cancel());
    };
    // Positions are captured at mount — a re-tap mounts a new droplet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blob: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    borderRadius: "50%",
    background: color,
    opacity: 0,
    willChange: "transform, opacity",
  };

  return (
    <>
      <svg width="0" height="0" aria-hidden="true" className="absolute">
        <filter id="brume-absorb-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b" />
          <feColorMatrix
            in="b"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -11"
          />
        </filter>
      </svg>
      <div
        className="pointer-events-none fixed inset-0 z-40"
        aria-hidden="true"
        style={{ filter: "url(#brume-absorb-goo)" }}
      >
        <div ref={budRef} style={{ ...blob, width: 16, height: 16 }} />
        <div ref={trailRef} style={{ ...blob, width: 20, height: 20 }} />
        <div ref={mainRef} style={{ ...blob, width: 34, height: 34 }} />
      </div>
    </>
  );
}

export default AbsorbDroplet;
