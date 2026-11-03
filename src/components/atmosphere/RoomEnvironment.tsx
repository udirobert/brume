import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  practiceProgress,
  resolvedMaterial,
  useRoomExperience,
  ROOM_MATERIALS,
  type RoomMaterial,
} from "@/lib/roomExperience";
import { clearFeel } from "@/lib/feelTheme";
import { syncAmbience } from "@/lib/ambience";
import { createRoomRenderer } from "@/lib/atmosphere/roomRenderer";
import { useSessionStore } from "@/stores/sessionStore";
import { breathAmount } from "@/lib/breathCurve";
import { RoomControls } from "./RoomControls";
import "@/styles/brume-room.css";

const MATERIAL_COUNT = 6;
const FRAME_MS = 1000 / 30;

function isCoreRoomPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname.startsWith("/session") ||
    pathname.startsWith("/post-session") ||
    pathname === "/decompress"
  );
}

function oneHot(index: number, out: Float32Array) {
  out.fill(0);
  if (index >= 0) out[index] = 1;
}

export function RoomEnvironment() {
  const { pathname } = useLocation();
  const core = isCoreRoomPath(pathname);

  useEffect(() => {
    if (!core) {
      clearFeel();
      useRoomExperience.getState().reset();
    }
  }, [core]);

  if (!core) return null;
  return (
    <>
      <RoomCanvas pathname={pathname} />
      {pathname !== "/" && (
        <RoomControls
          routeKey={pathname}
          immersive
          decompress={pathname === "/decompress"}
        />
      )}
    </>
  );
}

function RoomCanvas({ pathname }: { pathname: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const routeRef = useRef(pathname);
  const apiRef = useRef<{ routeChanged: () => void } | null>(null);

  routeRef.current = pathname;

  useEffect(() => {
    apiRef.current?.routeChanged();
  }, [pathname]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const doc = canvas.ownerDocument;
    const win = doc.defaultView ?? window;
    doc.documentElement.dataset.room = "1";

    let webgl = false;
    const renderer = createRoomRenderer(canvas, (status) => {
      webgl = status === "webgl";
      wrap.dataset.renderer = status;
      if (status === "webgl") {
        drawOnce();
        syncMotion();
      } else {
        stop();
        wrap.dataset.motion = "still";
      }
    });
    webgl = !!renderer;
    wrap.dataset.renderer = renderer ? "webgl" : "fallback";

    const store = useRoomExperience;
    const weights = new Float32Array(MATERIAL_COUNT);
    const target = new Float32Array(MATERIAL_COUNT);

    const pointer = { x: 0.5, y: 0.5, strength: 0 };
    let time = 0;
    let lastProgress = store.getState().progress;
    let lastBreath = store.getState().breath;
    let raf = 0;
    let lastDraw = 0;
    let lastTick = 0;
    let disposed = false;

    const reducedQuery = win.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    let reduced = !!reducedQuery?.matches;

    const stillActive = () => reduced || store.getState().still;

    const syncTarget = () => {
      const m = resolvedMaterial(store.getState());
      wrap.dataset.material = m;
      oneHot(ROOM_MATERIALS.indexOf(m), target);
      if (stillActive() || !webgl) weights.set(target);
    };
    syncTarget();
    weights.set(target);

    const frameNow = () => {
      const material = resolvedMaterial(store.getState());
      let mixTop = -1;
      let mixSecond = -1;
      for (let i = 0; i < MATERIAL_COUNT; i++) {
        if (mixTop < 0 || weights[i] > weights[mixTop]) {
          mixSecond = mixTop;
          mixTop = i;
        } else if (mixSecond < 0 || weights[i] > weights[mixSecond]) {
          mixSecond = i;
        }
      }
      renderer?.draw({
        material: ROOM_MATERIALS[Math.max(0, mixTop)],
        previousMaterial: ROOM_MATERIALS[Math.max(0, mixSecond)],
        mix: weights[Math.max(0, mixTop)],
        time,
        breath: lastBreath,
        progress: lastProgress,
        pointer,
        still: stillActive(),
        weights,
      });
      wrap.dataset.material = material;
    };

    function drawOnce() {
      if (!renderer) return;
      weights.set(target);
      renderer.draw({
        material: resolvedMaterial(store.getState()),
        previousMaterial: resolvedMaterial(store.getState()),
        mix: 1,
        time,
        breath: lastBreath,
        progress: lastProgress,
        pointer,
        still: true,
        weights,
      });
    }

    const onSessionRoute = () =>
      routeRef.current.startsWith("/session") &&
      !routeRef.current.startsWith("/post-session");

    // The audible room follows the same material — it only sounds while
    // the breath is actually running, so pause and the landing go quiet.
    const updateAmbience = () => {
      const s = useSessionStore.getState();
      syncAmbience(
        resolvedMaterial(store.getState()),
        onSessionRoute() && s.phase === "active",
      );
    };

    const syncPractice = () => {
      if (!onSessionRoute()) return;
      const s = useSessionStore.getState();
      const practicing = s.phase === "active";
      const paused = s.phase === "paused";
      if (practicing || s.phase === "complete") {
        lastProgress = practiceProgress(s.metrics?.duration ?? 0);
        const phase =
          s.metrics?.currentPhase === "pause"
            ? "hold_after_exhale"
            : (s.metrics?.currentPhase ?? "inhale");
        lastBreath = breathAmount(phase, (s.metrics?.phaseProgress ?? 0) / 100, true);
      } else if (!paused) {
        lastProgress = 0;
        lastBreath = 0;
      }
      store.getState().setPractice({
        progress: lastProgress,
        breath: lastBreath,
        practicing,
        paused,
      });
    };

    const tick = (now: number) => {
      raf = 0;
      if (disposed || doc.hidden || stillActive() || !webgl) return;
      const dt = Math.min(0.05, Math.max(0, (now - lastTick) / 1000));
      lastTick = now;

      if (store.getState().paused) return;
      time += dt;
      pointer.strength = Math.max(0, pointer.strength - dt * 1.4);

      const k = 1 - Math.exp(-dt * 3.2);
      for (let i = 0; i < MATERIAL_COUNT; i++) {
        weights[i] += (target[i] - weights[i]) * k;
      }

      if (now - lastDraw >= FRAME_MS) {
        lastDraw = now;
        frameNow();
      }
      raf = win.requestAnimationFrame(tick);
    };

    const start = () => {
      if (raf || disposed || doc.hidden || stillActive() || !webgl || store.getState().paused)
        return;
      lastTick = performance.now();
      raf = win.requestAnimationFrame(tick);
    };
    function stop() {
      if (raf) {
        win.cancelAnimationFrame(raf);
        raf = 0;
      }
    }
    const syncMotion = () => {
      const still = stillActive() || !webgl || store.getState().paused;
      wrap.dataset.motion = still ? "still" : "live";
      if (still) {
        stop();
        drawOnce();
      } else {
        start();
      }
    };

    const resize = () => {
      renderer?.resize(win.innerWidth, win.innerHeight, win.devicePixelRatio || 1);
      if (stillActive() || !webgl || store.getState().paused) drawOnce();
    };

    const onPointerMove = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("button, a, input, summary, details, [role='button'], [role='progressbar']"))
        return;
      pointer.x = e.clientX / Math.max(1, win.innerWidth);
      pointer.y = 1 - e.clientY / Math.max(1, win.innerHeight);
      pointer.strength = 1;
    };

    const onVisibility = () => {
      if (doc.hidden) stop();
      else syncMotion();
    };
    const onReduced = () => {
      reduced = !!reducedQuery?.matches;
      if (reduced) weights.set(target);
      syncMotion();
    };

    const unsubRoom = store.subscribe((state, prev) => {
      lastProgress = state.progress;
      lastBreath = state.breath;
      if (
        state.materialOverride !== prev.materialOverride ||
        state.feelIndex !== prev.feelIndex
      ) {
        syncTarget();
        if (stillActive() || !webgl || state.paused) drawOnce();
      }
      if (state.still !== prev.still || state.paused !== prev.paused) syncMotion();
      updateAmbience();
    });

    const unsubSession = useSessionStore.subscribe(() => {
      syncPractice();
      updateAmbience();
    });

    apiRef.current = {
      routeChanged: () => {
        const route = routeRef.current;
        if (!route.startsWith("/session") && route !== "/decompress") {
          const st = store.getState();
          if (st.practicing || st.paused) {
            st.setPractice({ practicing: false, paused: false });
          }
        }
        if (route.startsWith("/session")) {
          const s = useSessionStore.getState();
          if (s.phase !== "active" && s.phase !== "paused" && s.phase !== "complete") {
            lastProgress = 0;
            lastBreath = 0;
            store.getState().setPractice({
              progress: 0,
              breath: 0,
              practicing: false,
              paused: false,
            });
          }
        }
        syncPractice();
        syncMotion();
      },
    };

    resize();
    apiRef.current?.routeChanged();
    updateAmbience();

    win.addEventListener("pointermove", onPointerMove, { passive: true });
    win.addEventListener("resize", resize);
    doc.addEventListener("visibilitychange", onVisibility);
    reducedQuery?.addEventListener?.("change", onReduced);

    return () => {
      disposed = true;
      apiRef.current = null;
      stop();
      unsubRoom();
      unsubSession();
      syncAmbience(null, false);
      win.removeEventListener("pointermove", onPointerMove);
      win.removeEventListener("resize", resize);
      doc.removeEventListener("visibilitychange", onVisibility);
      reducedQuery?.removeEventListener?.("change", onReduced);
      renderer?.destroy();
      delete doc.documentElement.dataset.room;
    };
  }, []);

  return (
    <div ref={wrapRef} className="brume-room" aria-hidden="true" data-motion="still">
      <canvas ref={canvasRef} className="brume-room__canvas" />
      <div className="brume-room__fallback" />
    </div>
  );
}

export default RoomEnvironment;
