// Self-contained session view: reads the plan from toolOutput and runs
// the phases itself, so it works before the web /embed route exists.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BUNDLE = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../anna/bundle");
const ADAPTER_IMPORT = 'import { BRUME_AVATAR, MASCOT_STATES, validateAvatar, sampleMascot } from "./mascot-engine.js";';

function readBundle(name) {
  return readFileSync(path.join(BUNDLE, name), "utf8");
}

function stripModule(src, name, allowedImports = []) {
  const imports = src.match(/^import \{[^}]*\} from "[^"]*";$/gm) || [];
  for (const imp of imports) {
    if (!allowedImports.includes(imp)) {
      throw new Error(`${name}: unexpected import ${imp} — widget embedding needs updating`);
    }
  }
  const out = src
    .replace(/^import \{[^}]*\} from "[^"]*";\s*$/gm, "")
    .replace(/^export (?=(const|function|class|let|var))/gm, "");
  if (/^\s*(import|export)\s/m.test(out)) {
    throw new Error(`${name}: unrecognised module syntax left after transform`);
  }
  return out;
}

export function buildWidgetHtml() {
  const engine = stripModule(readBundle("mascot-engine.js"), "mascot-engine.js");
  const adapter = stripModule(readBundle("mascot.js"), "mascot.js", [ADAPTER_IMPORT]);
  const css = `${readBundle("mascot.css")}\n${readBundle("brand.css").replace(/@font-face\s*\{[^}]*\}/g, "")}`;

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
${css}
  html,body{margin:0;height:100%;background:var(--brume-paper);color:var(--brume-ink);
    font-family:var(--brume-font)}
  body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px}
  #mascot{width:120px;height:120px}
  #phase{font-size:22px;letter-spacing:.02em;min-height:1.4em}
  #title{font-size:15px;opacity:.75;max-width:26em;text-align:center}
  #cue{font-size:13px;opacity:.55;min-height:1.4em}
  #again{border:1px solid var(--brume-ink);border-radius:999px;background:none;
    color:inherit;padding:8px 22px;font:inherit;font-size:14px;cursor:pointer;display:none}
</style></head><body>
  <div id="mascot"></div>
  <div id="phase"></div>
  <div id="title"></div>
  <div id="cue"></div>
  <button id="again">Again</button>
<script>
${engine}
${adapter}
  const data = (window.openai && window.openai.toolOutput) || {};
  const phases = data.phases || [{word:"Breathe in",seconds:4},{word:"Breathe out",seconds:6}];
  const cycles = data.cycles || 4;
  document.getElementById("title").textContent = data.title || "";
  const word = document.getElementById("phase"), cue = document.getElementById("cue"),
        again = document.getElementById("again");
  const mascot = createMascot(document.getElementById("mascot"), { presence: "quiet", autoAnimate: false });
  const reducedMotion = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  const PHASE = {
    "Breathe in": { state: "inhale", breath: 1 },
    "Top up": { state: "topup", breath: 1 },
    "Hold": { state: "hold", breath: 1 },
    "Breathe out": { state: "exhale", breath: 0 },
    "Rest": { state: "idle", breath: 0 },
  };
  let cueIx = 0, stopped = false, running = false, raf = 0, timeout = 0, timeoutResolve = null;
  let phaseFrom = 0, phaseTo = 0, phaseStart = 0;
  let currentPhaseSeconds = 1, lastBreath = 0;
  function setCue(){ const c=(data.cues||[])[cueIx++%(data.cues.length||1)]||""; cue.textContent=c; }
  function breathDriveWanted(){ return running && !stopped && !reducedMotion.matches && !document.hidden; }
  function driveBreath(){
    raf = 0;
    if (!breathDriveWanted()) return;
    const p = Math.min(1, (performance.now() - phaseStart) / 1000 / Math.max(0.1, currentPhaseSeconds));
    mascot.setBreath(phaseFrom + (phaseTo - phaseFrom) * p);
    raf = requestAnimationFrame(driveBreath);
  }
  function syncDriver(){
    if (breathDriveWanted() && !raf) raf = requestAnimationFrame(driveBreath);
    if (!breathDriveWanted() && raf) { cancelAnimationFrame(raf); raf = 0; }
  }
  function onMediaOrVisibility(){ syncDriver(); }
  function enterPhase(ph){
    const conf = PHASE[ph.word] || { state: "idle", breath: lastBreath };
    mascot.setState(conf.state);
    phaseFrom = lastBreath; phaseTo = conf.breath;
    phaseStart = performance.now(); currentPhaseSeconds = ph.seconds;
    lastBreath = conf.breath;
    mascot.setBreath(phaseFrom);
  }
  function sleep(ms){ return new Promise(r=>{ timeoutResolve=r; timeout=setTimeout(()=>{timeout=0;timeoutResolve=null;r()},ms); }); }
  async function run(){
    if (running) return;
    running = true; stopped = false;
    mascot.setOptions({ autoAnimate: false });
    again.style.display="none"; setCue();
    lastBreath = 0; mascot.setBreath(0);
    syncDriver();
    for (let c=0;c<cycles && !stopped;c++){
      for (const ph of phases){
        if (stopped) break;
        word.textContent = ph.word;
        enterPhase(ph);
        await sleep(ph.seconds*1000);
      }
      if (phases.length && data.cues && data.cues.length>1) setCue();
    }
    running = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if(!stopped){
      mascot.setBreath(0);
      mascot.setState("proud");
      mascot.setOptions({ autoAnimate: true });
      word.textContent="Done"; again.style.display="block";
    }
  }
  again.onclick=()=>run();
  if (reducedMotion.addEventListener) reducedMotion.addEventListener("change", onMediaOrVisibility);
  document.addEventListener("visibilitychange", onMediaOrVisibility);
  window.addEventListener("pagehide", () => {
    stopped = true; running = false;
    if (timeout) clearTimeout(timeout);
    if (timeoutResolve) timeoutResolve();
    if (raf) cancelAnimationFrame(raf);
    if (reducedMotion.removeEventListener) reducedMotion.removeEventListener("change", onMediaOrVisibility);
    document.removeEventListener("visibilitychange", onMediaOrVisibility);
    mascot.destroy();
  });
  run();
</script></body></html>`;
}

export const WIDGET_HTML = buildWidgetHtml();
