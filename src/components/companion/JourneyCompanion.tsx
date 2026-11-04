import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { onSpeaking } from "@/lib/voiceCues";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import { BrumeMascot, type BrumeMascotProps } from "@/components/BrumeMascot";
import { EASE } from "@/lib/motion";

const COMPANION_SIZE = 176;
const HANDOFF_MS = 180;
const LAYOUT_SETTLE_MS = 400;

interface CompanionContextValue {
  register: (id: string, el: HTMLElement, props: BrumeMascotProps) => () => void;
  update: (id: string, props: BrumeMascotProps) => void;
}

const CompanionContext = createContext<CompanionContextValue | null>(null);

function anchorSignature(props: BrumeMascotProps): string {
  return JSON.stringify({
    state: props.state,
    breath: props.breath == null ? null : Math.round(props.breath * 1000) / 1000,
    size: props.size,
    presence: props.presence,
    trackPointer: props.trackPointer,
    breathing: props.breathing,
    breathPeriod: props.breathPeriod,
    reaction: props.reaction ? [props.reaction.name, props.reaction.key] : null,
    tapReaction: props.tapReaction ?? null,
    demeanor: props.demeanor ?? null,
    allowTapEscalation: props.allowTapEscalation ?? null,
  });
}

export function CompanionAnchor(props: BrumeMascotProps) {
  const ctx = useContext(CompanionContext);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const signature = anchorSignature(props);
  const size = props.size ?? 104;

  useLayoutEffect(() => {
    if (!ctx || !ref.current) return;
    return ctx.register(id, ref.current, propsRef.current);
  }, [ctx, id]);

  useEffect(() => {
    ctx?.update(id, propsRef.current);
  }, [ctx, id, signature]);

  if (!ctx) return <BrumeMascot {...props} />;
  return (
    <span
      ref={ref}
      data-companion-anchor
      className={props.className}
      style={{ display: "inline-block", width: size, height: size }}
    />
  );
}

type Rect = { x: number; y: number; w: number };

export function JourneyCompanionProvider({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const registry = useRef(new Map<string, { el: HTMLElement; props: BrumeMascotProps }>());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [props, setProps] = useState<BrumeMascotProps | null>(null);
  const [hidden, setHidden] = useState(true);
  const hideTimer = useRef(0);
  const settleTimer = useRef(0);
  const activeElRef = useRef<HTMLElement | null>(null);
  const lastPropsRef = useRef<BrumeMascotProps | null>(null);
  const lastRectRef = useRef<Rect | null>(null);
  const hiddenRef = useRef(true);
  const reducedRef = useRef(!!reduced);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scale = useMotionValue(1);
  const opacity = useMotionValue(0);

  hiddenRef.current = hidden;
  reducedRef.current = !!reduced;

  // The companion "is talking" — a body class follows the voice so the
  // mascot's speaking shimmer works wherever it's anchored.
  useEffect(
    () =>
      onSpeaking((speaking) => {
        document.body.classList.toggle("brume-speaking", speaking);
      }),
    [],
  );

  const jump = useCallback(
    (t: { x: number; y: number; scale: number; opacity: number }) => {
      x.stop(); y.stop(); scale.stop(); opacity.stop();
      x.jump(t.x); y.jump(t.y); scale.jump(t.scale); opacity.jump(t.opacity);
    },
    [x, y, scale, opacity],
  );

  const glide = useCallback(
    (t: { x: number; y: number; scale: number; opacity: number }) => {
      animate(x, t.x, { duration: 0.5, ease: EASE });
      animate(y, t.y, { duration: 0.5, ease: EASE });
      animate(scale, t.scale, { duration: 0.5, ease: EASE });
      animate(opacity, t.opacity, { duration: 0.5, ease: EASE });
    },
    [x, y, scale, opacity],
  );

  const currentRect = useCallback((): Rect | null => {
    const el = activeElRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width };
  }, []);

  const targetFor = useCallback((r: Rect | null, visible: boolean) => {
    const base = lastRectRef.current;
    const rr = r ?? base ?? { x: 0, y: 0, w: COMPANION_SIZE };
    return {
      x: rr.x,
      y: rr.y,
      scale: rr.w / COMPANION_SIZE,
      opacity: visible ? 1 : 0,
    };
  }, []);

  const toTarget = useCallback(
    (r: Rect | null, visible: boolean, immediate: boolean) => {
      if (r) lastRectRef.current = r;
      const t = targetFor(r, visible);
      if (immediate) jump(t);
      else glide(t);
    },
    [targetFor, jump, glide],
  );

  const rectChanged = (a: Rect | null, b: Rect | null) =>
    !!a !== !!b ||
    (a && b && (Math.abs(a.x - b.x) >= 0.5 || Math.abs(a.y - b.y) >= 0.5 || Math.abs(a.w - b.w) >= 0.5));

  const armSettle = useCallback(() => {
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      settleTimer.current = 0;
      const r = currentRect();
      if (rectChanged(r, lastRectRef.current)) {
        toTarget(r, !hiddenRef.current, true);
      }
    }, LAYOUT_SETTLE_MS);
  }, [currentRect, toTarget]);

  const refresh = useCallback(() => {
    const last = [...registry.current.keys()].pop() ?? null;
    const entry = last ? registry.current.get(last)! : null;
    setActiveId(last);
    activeElRef.current = entry?.el ?? null;
    if (entry) {
      const firstEver = lastPropsRef.current === null;
      lastPropsRef.current = entry.props;
      setProps(entry.props);
      if (hideTimer.current) {
        window.clearTimeout(hideTimer.current);
        hideTimer.current = 0;
      }
      setHidden(false);
      const r = entry.el.getBoundingClientRect();
      const rect: Rect | null = r.width > 0 ? { x: r.left, y: r.top, w: r.width } : null;
      if (rect) {
        toTarget(rect, true, firstEver || reducedRef.current);
      } else {
        requestAnimationFrame(() => {
          const r2 = entry.el.getBoundingClientRect();
          if (r2.width > 0) {
            toTarget({ x: r2.left, y: r2.top, w: r2.width }, true, firstEver || reducedRef.current);
          }
        });
      }
      armSettle();
    } else {
      if (!hideTimer.current) {
        hideTimer.current = window.setTimeout(() => {
          hideTimer.current = 0;
          setHidden(true);
          toTarget(null, false, reducedRef.current);
        }, HANDOFF_MS);
      }
    }
  }, [toTarget, armSettle]);

  const register = useCallback(
    (id: string, el: HTMLElement, props: BrumeMascotProps) => {
      registry.current.set(id, { el, props });
      refresh();
      return () => {
        registry.current.delete(id);
        refresh();
      };
    },
    [refresh],
  );

  const update = useCallback((id: string, next: BrumeMascotProps) => {
    const entry = registry.current.get(id);
    if (!entry) return;
    entry.props = next;
    const last = [...registry.current.keys()].pop();
    if (last === id) {
      lastPropsRef.current = next;
      setProps(next);
    }
  }, []);

  const ctx = useMemo(() => ({ register, update }), [register, update]);

  useEffect(() => {
    const el = activeElRef.current;
    const onMove = () => {
      const r = currentRect();
      if (rectChanged(r, lastRectRef.current)) toTarget(r, !hiddenRef.current, true);
    };
    window.addEventListener("scroll", onMove, { capture: true, passive: true });
    window.addEventListener("resize", onMove);
    let observer: ResizeObserver | null = null;
    if (el && typeof ResizeObserver === "function") {
      observer = new ResizeObserver(() => {
        const r = currentRect();
        if (rectChanged(r, lastRectRef.current)) toTarget(r, !hiddenRef.current, true);
      });
      observer.observe(el);
    }
    return () => {
      window.removeEventListener("scroll", onMove, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", onMove);
      observer?.disconnect();
    };
  }, [activeId, currentRect, toTarget]);

  useEffect(() => {
    if (reduced) {
      x.stop(); y.stop(); scale.stop(); opacity.stop();
      toTarget(currentRect(), !hiddenRef.current, true);
    }
  }, [reduced, x, y, scale, opacity, currentRect, toTarget]);

  useEffect(
    () => () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
      x.stop(); y.stop(); scale.stop(); opacity.stop();
    },
    [x, y, scale, opacity],
  );

  const shown = props ?? lastPropsRef.current;
  const {
    className: _className,
    layoutId: _layoutId,
    size: _size,
    ...actual
  } = shown ?? {};

  return (
    <CompanionContext.Provider value={ctx}>
      {children}
      <motion.div
        data-journey-companion
        aria-hidden={hidden}
        inert={hidden}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 20,
          width: COMPANION_SIZE,
          height: COMPANION_SIZE,
          transformOrigin: "0 0",
          pointerEvents: "none",
          x,
          y,
          scale,
          opacity,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            pointerEvents: hidden || !actual.tapReaction ? "none" : "auto",
          }}
        >
          {shown && <BrumeMascot {...actual} size={COMPANION_SIZE} />}
        </div>
      </motion.div>
    </CompanionContext.Provider>
  );
}

export default JourneyCompanionProvider;
