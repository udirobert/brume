// Brume — a small mist sprite that IS the breath circle.
// Hand-built inline SVG, no dependencies. createMascot(el) returns
// { setState(name), setBreath(scale01), destroy() }.
//
// States: idle | thinking | inhale | topup | hold | exhale | proud |
// sleepy | bright | stretch | hum | watching. prefers-reduced-motion
// renders static expressions (no scaling, bob, blinks or particles).

import { BRUME_AVATAR, MASCOT_STATES, MASCOT_REACTIONS, MASCOT_REACTION_DURATIONS, validateAvatar, sampleMascot } from "./mascot-engine.js";

const NS = "http://www.w3.org/2000/svg";

function el(doc, tag, attrs) {
  const n = doc.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

const ARM_L = { d: "M 30 52 L 18 30" };
const ARM_R = { d: "M 70 52 L 82 30" };
const CHEEK_L = { cx: 36, cy: 58, rx: 4, ry: 2.5 };
const CHEEK_R = { cx: 64, cy: 58, rx: 4, ry: 2.5 };
const WISP_BASE = [0, 1, 2, 3].map((i) => ({ cx: 50 + (i - 1.5) * 6, cy: 70, r: 2.5 - i * 0.3 }));
const WAVE_PATHS = ["M 68 56 q 4 2 0 5", "M 74 54 q 6 4 0 9"];
const SWIRL = { d: "M 50 8 q 8 -4 4 4 q -4 8 -10 2", cx: 50, cy: 8 };
const HALO = { cx: 50, cy: 52, r: 36 };

const scaleAround = (cx, cy, s) => `translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`;

export function createMascot(host, options = {}) {
  const doc = host.ownerDocument || document;
  const win = doc.defaultView || (typeof window !== "undefined" ? window : null);
  host.classList.add("mascot");
  host.setAttribute("data-mascot", "");

  const svg = el(doc, "svg", { viewBox: "0 0 100 100", "aria-hidden": "true" });
  svg.classList.add("mascot-svg");

  const rootG = el(doc, "g", { class: "mascot-root" });
  svg.appendChild(rootG);

  const halo = el(doc, "circle", { cx: HALO.cx, cy: HALO.cy, r: HALO.r, class: "mascot-halo" });
  rootG.appendChild(halo);

  const bodyG = el(doc, "g", { class: "mascot-body" });
  const primG = el(doc, "g", { class: "mascot-prims" });
  bodyG.appendChild(primG);

  // Little arms (only visible in "stretch").
  const armL = el(doc, "path", { d: ARM_L.d, class: "mascot-arm" });
  const armR = el(doc, "path", { d: ARM_R.d, class: "mascot-arm" });
  bodyG.appendChild(armL);
  bodyG.appendChild(armR);

  // Eyes.
  const eyeL = el(doc, "ellipse", { class: "mascot-eye" });
  const eyeR = el(doc, "ellipse", { class: "mascot-eye" });
  const lidL = el(doc, "rect", { class: "mascot-lid", height: 0 });
  const lidR = el(doc, "rect", { class: "mascot-lid", height: 0 });
  bodyG.appendChild(eyeL);
  bodyG.appendChild(eyeR);
  bodyG.appendChild(lidL);
  bodyG.appendChild(lidR);

  // Cheeks (fill for "hold" state).
  const cheekL = el(doc, "ellipse", { ...CHEEK_L, class: "mascot-cheek" });
  const cheekR = el(doc, "ellipse", { ...CHEEK_R, class: "mascot-cheek" });
  bodyG.appendChild(cheekL);
  bodyG.appendChild(cheekR);

  const mouthG = el(doc, "g", { class: "mascot-mouth-g" });
  const mouth = el(doc, "path", { class: "mascot-mouth" });
  mouthG.appendChild(mouth);
  bodyG.appendChild(mouthG);
  rootG.appendChild(bodyG);

  // Mist wisps for exhale / thinking / hum / proud.
  const wispsG = el(doc, "g", { class: "mascot-wisps" });
  const wispEls = WISP_BASE.map((w, i) => {
    const c = el(doc, "circle", { cx: w.cx, cy: w.cy, r: w.r, class: `mascot-wisp w${i}` });
    wispsG.appendChild(c);
    return c;
  });
  rootG.appendChild(wispsG);

  // Sound-wave lines for hum.
  const wavesG = el(doc, "g", { class: "mascot-waves" });
  for (const d of WAVE_PATHS) wavesG.appendChild(el(doc, "path", { d, class: "mascot-wave" }));
  rootG.appendChild(wavesG);

  // Thinking swirl.
  const swirl = el(doc, "path", { d: SWIRL.d, class: "mascot-swirl" });
  rootG.appendChild(swirl);

  host.appendChild(svg);

  let avatar = BRUME_AVATAR;
  function rebuildGeometry() {
    primG.textContent = "";
    for (const prim of avatar.body) {
      const { type, opacity, ...attrs } = prim;
      const node = el(doc, type, { ...attrs, class: "mascot-fill" });
      if (opacity !== undefined) node.setAttribute("opacity", opacity);
      primG.appendChild(node);
    }
    const { type, opacity, ...attrs } = avatar.highlight;
    const node = el(doc, type, { ...attrs, class: "mascot-hl" });
    node.setAttribute("opacity", opacity ?? 0.8);
    primG.appendChild(node);
  }

  const opts = { state: "idle", autoAnimate: true, ...options };
  let pointerGaze = null;
  let lastActivity = nowSec();
  let rafId = 0;
  let destroyed = false;
  let offscreen = false;
  let stateEnteredAt = nowSec();
  let poseFrom = null;
  let reactionName = null;
  let reactionStart = 0;

  const media = win && win.matchMedia ? win.matchMedia("(prefers-reduced-motion: reduce)") : null;

  function nowSec() {
    return win && win.performance ? win.performance.now() / 1000 : Date.now() / 1000;
  }

  function isReduced() {
    return opts.reducedMotion !== undefined ? opts.reducedMotion : !!(media && media.matches);
  }

  function isSuspended() {
    if (destroyed) return true;
    if (doc.hidden) return true;
    if (offscreen) return true;
    for (let n = host; n; n = n.parentElement) {
      if (n.hidden === true) return true;
    }
    return false;
  }

  function applyFrame(frame) {
    const r = frame.root;
    rootG.setAttribute(
      "transform",
      `translate(0 ${r.y}) rotate(${r.rotate} 50 58) `
        + `translate(${r.originX} ${r.originY}) scale(${r.sx} ${r.sy}) `
        + `translate(${-r.originX} ${-r.originY})`,
    );
    halo.setAttribute("opacity", String(frame.accessories.halo.opacity));
    halo.setAttribute(
      "transform",
      scaleAround(HALO.cx, HALO.cy, frame.accessories.halo.scale),
    );
    bodyG.setAttribute(
      "transform",
      scaleAround(frame.body.originX, frame.body.originY, frame.body.scale),
    );

    const e = frame.eyes;
    eyeL.setAttribute("cx", e.left.cx); eyeL.setAttribute("cy", e.left.cy);
    eyeL.setAttribute("rx", e.left.rx); eyeL.setAttribute("ry", e.left.ry);
    eyeR.setAttribute("cx", e.right.cx); eyeR.setAttribute("cy", e.right.cy);
    eyeR.setAttribute("rx", e.right.rx); eyeR.setAttribute("ry", e.right.ry);
    lidL.setAttribute("x", e.lidLeft.x); lidL.setAttribute("y", e.lidLeft.y);
    lidL.setAttribute("width", e.lidLeft.width); lidL.setAttribute("height", e.lidLeft.height);
    lidR.setAttribute("x", e.lidRight.x); lidR.setAttribute("y", e.lidRight.y);
    lidR.setAttribute("width", e.lidRight.width); lidR.setAttribute("height", e.lidRight.height);

    mouth.setAttribute("d", frame.mouth.d);
    mouthG.setAttribute("transform", `translate(${frame.mouth.dx} ${frame.mouth.dy})`);

    const a = frame.accessories;
    armL.setAttribute("opacity", a.arms.opacity);
    armR.setAttribute("opacity", a.arms.opacity);
    armL.setAttribute("transform", `rotate(${a.arms.rotateLeft} ${a.arms.pivotLeft.x} ${a.arms.pivotLeft.y})`);
    armR.setAttribute("transform", `rotate(${a.arms.rotateRight} ${a.arms.pivotRight.x} ${a.arms.pivotRight.y})`);
    cheekL.setAttribute("opacity", a.cheeks.opacity);
    cheekR.setAttribute("opacity", a.cheeks.opacity);
    wispEls.forEach((c, i) => {
      c.setAttribute("transform", `translate(0 ${a.wisps[i].dy})`);
      c.setAttribute("opacity", a.wisps[i].opacity);
    });
    wavesG.setAttribute("opacity", a.waves.opacity);
    swirl.setAttribute("opacity", a.swirl.opacity);
    swirl.setAttribute("transform", `rotate(${a.swirl.rotate} ${SWIRL.cx} ${SWIRL.cy})`);
  }

  function liveFrame(t) {
    return sampleMascot(t, {
      avatar,
      state: opts.state,
      breath: opts.breath,
      from: poseFrom,
      reaction: reactionName
        ? { name: reactionName, age: t - reactionStart }
        : undefined,
      presence: opts.presence,
      gaze: opts.gaze !== undefined ? opts.gaze : pointerGaze,
      lean: opts.lean,
      reducedMotion: isReduced(),
      idleSeconds: opts.idleSeconds !== undefined
        ? opts.idleSeconds
        : Math.max(0, t - lastActivity),
      breathing: opts.breathing,
      breathPeriod: opts.breathPeriod,
      stateAge: opts.stateAge !== undefined ? opts.stateAge : t - stateEnteredAt,
    });
  }

  function render(t) {
    if (reactionName && t - reactionStart >= MASCOT_REACTION_DURATIONS[reactionName]) {
      reactionName = null;
    }
    applyFrame(liveFrame(t));
  }

  function cancelRaf() {
    if (rafId && win && win.cancelAnimationFrame) win.cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function tick() {
    rafId = 0;
    if (isSuspended()) return;
    render(nowSec());
    schedule();
  }

  function schedule() {
    if (rafId || destroyed || isReduced() || opts.autoAnimate === false || isSuspended()) return;
    if (win && win.requestAnimationFrame) rafId = win.requestAnimationFrame(tick);
  }

  function refresh() {
    if (destroyed) return;
    render(nowSec());
    if (isSuspended() || isReduced() || opts.autoAnimate === false) {
      cancelRaf();
      return;
    }
    schedule();
  }

  function onMediaChange() {
    syncListeners();
    refresh();
  }
  function onVisibility() {
    syncListeners();
    if (doc.hidden) cancelRaf();
    else refresh();
  }

  const markActivity = () => { lastActivity = nowSec(); };

  function gazeFromPointer(event) {
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.52;
    const nx = (event.clientX - cx) / (rect.width * 0.5);
    const ny = (event.clientY - cy) / (rect.height * 0.5);
    const r = Math.hypot(nx, ny) || 1;
    const k = Math.tanh(r) / r;
    pointerGaze = { x: nx * k * 2.4, y: ny * k * 1.8 };
  }

  function onPointerMove(event) {
    markActivity();
    if (opts.trackPointer) gazeFromPointer(event);
  }
  function onPointerLeave() {
    pointerGaze = null;
  }

  function companionActive() {
    return opts.presence === "companion" && !isReduced() && !isSuspended();
  }

  let listenersOn = { pointer: false, activity: false };
  function syncListeners() {
    if (!win) return;
    const want = companionActive();
    const wantPointer = want && !!opts.trackPointer;
    if (listenersOn.pointer === wantPointer && listenersOn.activity === want) return;
    if (listenersOn.pointer) {
      win.removeEventListener("pointermove", onPointerMove);
      win.removeEventListener("pointerleave", onPointerLeave);
    }
    if (listenersOn.activity) {
      win.removeEventListener("pointermove", markActivity);
      win.removeEventListener("pointerdown", markActivity);
      win.removeEventListener("keydown", markActivity);
    }
    listenersOn = { pointer: wantPointer, activity: want };
    if (wantPointer) {
      win.addEventListener("pointermove", onPointerMove, { passive: true });
      win.addEventListener("pointerleave", onPointerLeave);
    } else {
      pointerGaze = null;
      if (want) win.addEventListener("pointermove", markActivity, { passive: true });
    }
    if (want) {
      win.addEventListener("pointerdown", markActivity, { passive: true });
      win.addEventListener("keydown", markActivity);
    } else {
      pointerGaze = null;
    }
  }

  function detachAll() {
    if (!win) return;
    win.removeEventListener("pointermove", onPointerMove);
    win.removeEventListener("pointerleave", onPointerLeave);
    win.removeEventListener("pointermove", markActivity);
    win.removeEventListener("pointerdown", markActivity);
    win.removeEventListener("keydown", markActivity);
    listenersOn = { pointer: false, activity: false };
    pointerGaze = null;
  }

  let observer = null;
  if (win && typeof win.IntersectionObserver === "function") {
    observer = new win.IntersectionObserver((entries) => {
      offscreen = entries.every((en) => !en.isIntersecting);
      if (offscreen) {
        cancelRaf();
        detachAll();
      } else {
        syncListeners();
        refresh();
      }
    });
    observer.observe(host);
  }

  let hiddenObserver = null;
  if (win && typeof win.MutationObserver === "function") {
    hiddenObserver = new win.MutationObserver(() => {
      if (isSuspended()) {
        cancelRaf();
        detachAll();
      } else {
        syncListeners();
        refresh();
      }
    });
    const ancestors = [];
    for (let n = host; n; n = n.parentElement) ancestors.push(n);
    for (const n of ancestors) {
      hiddenObserver.observe(n, { attributes: true, attributeFilter: ["hidden"] });
    }
  }

  if (media && media.addEventListener) media.addEventListener("change", onMediaChange);
  else if (media && media.addListener) media.addListener(onMediaChange);
  doc.addEventListener("visibilitychange", onVisibility);
  syncListeners();

  function freezePose() {
    const t = nowSec();
    poseFrom = isReduced() ? null : liveFrame(t).pose;
    stateEnteredAt = t;
  }

  function setState(name) {
    const next = MASCOT_STATES.includes(name) ? name : "idle";
    if (next !== opts.state) freezePose();
    opts.state = next;
    host.dataset.state = next;
    refresh();
  }

  function setBreath(scale01) {
    opts.breath = scale01;
    refresh();
  }

  function setOptions(partial = {}) {
    if ("state" in partial) {
      const next = MASCOT_STATES.includes(partial.state) ? partial.state : "idle";
      if (next !== opts.state) freezePose();
    }
    for (const [k, v] of Object.entries(partial)) {
      if (v === undefined) delete opts[k];
      else opts[k] = v;
    }
    if ("avatar" in partial) {
      const res = opts.avatar ? validateAvatar(opts.avatar) : { ok: false };
      avatar = res.ok ? res.value : BRUME_AVATAR;
      rebuildGeometry();
    }
    if ("state" in partial) {
      const next = MASCOT_STATES.includes(opts.state) ? opts.state : "idle";
      opts.state = next;
      host.dataset.state = next;
    }
    syncListeners();
    refresh();
  }

  function renderAt(timeSeconds, overrides = {}) {
    const merged = { ...opts, ...(overrides || {}) };
    applyFrame(sampleMascot(timeSeconds, {
      avatar,
      state: merged.state,
      breath: merged.breath,
      presence: merged.presence,
      gaze: merged.gaze,
      lean: merged.lean,
      reducedMotion: merged.reducedMotion === true,
      idleSeconds: merged.idleSeconds !== undefined ? merged.idleSeconds : 0,
      breathing: merged.breathing,
      breathPeriod: merged.breathPeriod,
      stateAge: merged.stateAge !== undefined ? merged.stateAge : timeSeconds,
      from: merged.from,
      reaction: merged.reaction,
    }));
  }

  function react(name) {
    if (!MASCOT_REACTIONS.includes(name)) return;
    reactionName = name;
    reactionStart = nowSec();
    refresh();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    cancelRaf();
    if (observer) observer.disconnect();
    if (hiddenObserver) hiddenObserver.disconnect();
    if (media && media.removeEventListener) media.removeEventListener("change", onMediaChange);
    else if (media && media.removeListener) media.removeListener(onMediaChange);
    doc.removeEventListener("visibilitychange", onVisibility);
    detachAll();
    svg.remove();
    host.classList.remove("mascot");
    host.removeAttribute("data-mascot");
  }

  if (opts.avatar) {
    const res = validateAvatar(opts.avatar);
    if (res.ok) avatar = res.value;
  }
  rebuildGeometry();
  setState(opts.state && MASCOT_STATES.includes(opts.state) ? opts.state : "idle");
  return { setState, setBreath, setOptions, renderAt, react, destroy };
}
