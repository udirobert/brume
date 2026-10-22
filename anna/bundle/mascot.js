// Brume — a small mist sprite that IS the breath circle.
// Hand-built inline SVG, no dependencies. createMascot(el) returns
// { setState(name), setBreath(scale01), destroy() }.
//
// States: idle | thinking | inhale | topup | hold | exhale | proud |
// sleepy | bright | stretch | hum | watching. prefers-reduced-motion
// renders static expressions (no scaling, bob, blinks or particles).

const NS = "http://www.w3.org/2000/svg";
const REDUCED =
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const MOUTH = {
  closed: "M 44 60 Q 50 63 56 60",
  smile: "M 43 58 Q 50 65 57 58",
  open: "M 47 59 Q 50 63 53 59 Q 50 65 47 59 Z",
  flat: "M 45 61 L 55 61",
};

function el(tag, attrs) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

export function createMascot(host) {
  host.classList.add("mascot");
  host.setAttribute("data-mascot", "");
  const svg = el("svg", { viewBox: "0 0 100 100", "aria-hidden": "true" });
  svg.classList.add("mascot-svg");

  const halo = el("circle", { cx: 50, cy: 52, r: 36, class: "mascot-halo", fill: "none", stroke: "rgba(124,140,201,.18)", "stroke-width": 10 });
  svg.appendChild(halo);

  const bodyG = el("g", { class: "mascot-body" });
  // Cloud blob: main body plus two smaller lobes on top.
  bodyG.appendChild(el("ellipse", { cx: 50, cy: 58, rx: 30, ry: 26, class: "mascot-fill", fill: "#7c8cc9" }));
  bodyG.appendChild(el("circle", { cx: 38, cy: 38, r: 14, class: "mascot-fill", fill: "#7c8cc9" }));
  bodyG.appendChild(el("circle", { cx: 58, cy: 34, r: 17, class: "mascot-fill", fill: "#7c8cc9" }));
  bodyG.appendChild(el("ellipse", { cx: 56, cy: 30, rx: 8, ry: 5, class: "mascot-hl", fill: "#9aa8da", opacity: ".8" }));

  // Little arms (only visible in "stretch").
  const armL = el("path", { d: "M 30 52 L 18 30", class: "mascot-arm", stroke: "#7c8cc9", "stroke-width": 5, "stroke-linecap": "round", fill: "none", opacity: 0 });
  const armR = el("path", { d: "M 70 52 L 82 30", class: "mascot-arm", stroke: "#7c8cc9", "stroke-width": 5, "stroke-linecap": "round", fill: "none", opacity: 0 });
  bodyG.appendChild(armL); bodyG.appendChild(armR);

  // Eyes.
  const eyeL = el("ellipse", { cx: 41, cy: 52, rx: 3.2, ry: 4, class: "mascot-eye", fill: "#26303a" });
  const eyeR = el("ellipse", { cx: 59, cy: 52, rx: 3.2, ry: 4, class: "mascot-eye", fill: "#26303a" });
  const lidL = el("rect", { x: 37, y: 50, width: 8, height: 0, class: "mascot-lid", fill: "#7c8cc9" });
  const lidR = el("rect", { x: 55, y: 50, width: 8, height: 0, class: "mascot-lid", fill: "#7c8cc9" });
  bodyG.appendChild(eyeL); bodyG.appendChild(eyeR);
  bodyG.appendChild(lidL); bodyG.appendChild(lidR);

  // Cheeks (fill for "hold" state).
  const cheekL = el("ellipse", { cx: 36, cy: 58, rx: 4, ry: 2.5, class: "mascot-cheek", fill: "#9aa8da", opacity: 0 });
  const cheekR = el("ellipse", { cx: 64, cy: 58, rx: 4, ry: 2.5, class: "mascot-cheek", fill: "#9aa8da", opacity: 0 });
  bodyG.appendChild(cheekL); bodyG.appendChild(cheekR);

  const mouth = el("path", { d: MOUTH.closed, class: "mascot-mouth", fill: "none", stroke: "#26303a", "stroke-width": 2, "stroke-linecap": "round" });
  bodyG.appendChild(mouth);
  svg.appendChild(bodyG);

  // Mist wisps for exhale / thinking / hum / proud.
  const wisps = el("g", { class: "mascot-wisps" });
  for (let i = 0; i < 4; i += 1) {
    wisps.appendChild(el("circle", {
      cx: 50 + (i - 1.5) * 6, cy: 70, r: 2.5 - i * 0.3, class: `mascot-wisp w${i}`,
      fill: "#dde3f3", opacity: 0,
    }));
  }
  svg.appendChild(wisps);

  // Sound-wave lines for hum.
  const waves = el("g", { class: "mascot-waves" });
  waves.appendChild(el("path", { d: "M 68 56 q 4 2 0 5", class: "mascot-wave", fill: "none", stroke: "#7c8cc9", "stroke-width": 2, "stroke-linecap": "round", opacity: 0 }));
  waves.appendChild(el("path", { d: "M 74 54 q 6 4 0 9", class: "mascot-wave", fill: "none", stroke: "#7c8cc9", "stroke-width": 2, "stroke-linecap": "round", opacity: 0 }));
  svg.appendChild(waves);

  // Thinking swirl.
  const swirl = el("path", {
    d: "M 50 8 q 8 -4 4 4 q -4 8 -10 2", class: "mascot-swirl", fill: "none", stroke: "#7c8cc9", "stroke-width": 2, opacity: 0,
  });
  svg.appendChild(swirl);

  host.appendChild(svg);

  let state = "idle", blinkTimer = null;

  function applyEyes({ dx = 0, dy = 0, open = 1, lidFrac = 0 }) {
    const ry = 4 * open;
    for (const [e, l, x] of [[eyeL, lidL, 41], [eyeR, lidR, 59]]) {
      e.setAttribute("cx", x + dx); e.setAttribute("cy", 52 + dy);
      e.setAttribute("ry", Math.max(0.4, ry));
      l.setAttribute("x", x + dx - 4);
      l.setAttribute("y", 48 + dy);
      l.setAttribute("height", String(9 * lidFrac));
    }
  }

  function scheduleBlink() {
    if (REDUCED || blinkTimer) return;
    blinkTimer = setTimeout(() => {
      blinkTimer = null;
      if (state !== "idle") return;
      applyEyes({ open: 0.12 });
      setTimeout(() => applyEyes({}), 140);
      scheduleBlink();
    }, 4000 + Math.random() * 3000);
  }

  const STATES = {
    idle: () => { applyEyes({}); mouth.setAttribute("d", MOUTH.closed); scheduleBlink(); },
    thinking: () => { applyEyes({ dy: -2 }); mouth.setAttribute("d", MOUTH.flat); },
    inhale: () => { applyEyes({}); mouth.setAttribute("d", MOUTH.open); },
    topup: () => { applyEyes({}); mouth.setAttribute("d", MOUTH.open); },
    hold: () => { applyEyes({ open: 0.12 }); mouth.setAttribute("d", MOUTH.closed); },
    exhale: () => { applyEyes({ open: 0.35 }); mouth.setAttribute("d", MOUTH.closed); },
    proud: () => { applyEyes({ open: 0.35 }); mouth.setAttribute("d", MOUTH.smile); },
    sleepy: () => { applyEyes({ lidFrac: 0.6, dy: 1.5 }); mouth.setAttribute("d", MOUTH.closed); },
    bright: () => { applyEyes({ open: 1.25 }); mouth.setAttribute("d", MOUTH.smile); },
    stretch: () => { applyEyes({ open: 1.1 }); mouth.setAttribute("d", MOUTH.smile); },
    hum: () => { applyEyes({ open: 0.4 }); mouth.setAttribute("d", MOUTH.flat); },
    watching: () => { applyEyes({ open: 1.2 }); mouth.setAttribute("d", MOUTH.flat); },
  };

  function setState(name) {
    state = name;
    host.dataset.state = name;
    const puffs = name === "topup";
    host.classList.toggle("mascot-puff", puffs);
    host.classList.toggle("mascot-cheeks", name === "hold");
    host.classList.toggle("mascot-arms", name === "stretch");
    host.classList.toggle("mascot-wisped", ["exhale", "proud"].includes(name));
    host.classList.toggle("mascot-humming", name === "hum");
    host.classList.toggle("mascot-thinking", name === "thinking");
    (STATES[name] || STATES.idle)();
  }

  function setBreath(scale01) {
    if (REDUCED) return;
    const s = 0.86 + Math.max(0, Math.min(1, scale01)) * 0.18;
    bodyG.setAttribute("transform", `scale(${s.toFixed(3)})`);
    bodyG.setAttribute("transform-origin", "50 55");
  }

  function destroy() {
    if (blinkTimer) clearTimeout(blinkTimer);
    svg.remove();
  }

  setState("idle");
  if (!REDUCED) scheduleBlink();
  return { setState, setBreath, destroy };
}
