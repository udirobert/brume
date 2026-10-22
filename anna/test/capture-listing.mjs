import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";

const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const output = join(here, "../listing/candidate");
const SESSION = "brume-listing-capture";
const BASE = "http://127.0.0.1:4619";
const cli = async (...a) => (await run("agent-browser", ["--session", SESSION, ...a])).stdout.trim();
const ev = async (js) => JSON.parse(await cli("eval", js));
const post = (p, b) => fetch(`${BASE}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b || {}) }).then((r) => r.json());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const screen = async () => ev('[...document.querySelectorAll(".screen")].filter(s=>!s.hidden)[0]?.id');
async function waitScreen(id) {
  for (let i = 0; i < 30; i += 1) {
    if (await screen() === id) return;
    await sleep(200);
  }
  assert.equal(await screen(), id);
}
async function shot(name, expected, width, height) {
  await waitScreen(expected);
  assert.equal(await ev('document.getElementById("task-banner").hidden'), true);
  await cli("set", "viewport", String(width), String(height));
  await ev('document.documentElement.dataset.daypart="day";document.activeElement?.blur();document.fonts.ready.then(()=>true)');
  await cli("screenshot", join(output, name), "--full");
}

const EVENT = "My manager wants the full report on Friday. I can deliver the full report on Tuesday or a shorter summary on Friday.";
const GOAL = "Agree which delivery option meets the immediate need.";
const PRESERVE = "Trust with my manager; do not imply they caused the delay.";
const DRAFT = {
  kind: "plan",
  opening: "Can we agree which matters more for this report: full scope or Friday delivery?",
  keyPoint: "I can offer the full report on Tuesday or a shorter summary on Friday.",
  approach: "Name both options and ask which meets the immediate need.",
  objection: "We already committed to Friday. Why can't you just get it done?",
  response: "I can deliver a shorter summary on Friday. Would that meet the immediate need, with the full report on Tuesday?",
  nextStep: "Which option should I work toward?",
};

const fresh = async () => {
  await cli("open", "about:blank");
  await sleep(800);
  await post("/__reset");
  await cli("open", BASE);
  await waitScreen("screen-home");
  assert.equal((await post("/__dump")).kv["brume/active-task"], undefined);
};

const server = spawn(process.execPath, [join(here, "fake-host-server.mjs")], { env: { ...process.env, PORT: "4619" } });
let browserStarted = false;
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Capture host did not start")), 8000);
    server.once("error", (e) => { clearTimeout(timeout); reject(e); });
    server.once("exit", (code) => { clearTimeout(timeout); reject(new Error(`Capture host exited: ${code}`)); });
    server.stdout.on("data", (data) => {
      if (String(data).includes(`fake host on ${BASE}`)) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
  await mkdir(output, { recursive: true });
  browserStarted = true;
  await fresh();
  await shot("home-mobile.png", "screen-home", 390, 844);
  await ev('document.querySelector("[data-moment=deadline]").click();true');
  await waitScreen("screen-prep-input");
  await cli("fill", "#prep-event", EVENT);
  await cli("fill", "#prep-goal", GOAL);
  await cli("fill", "#prep-preserve", PRESERVE);
  await shot("input-mobile.png", "screen-prep-input", 390, 844);
  await post("/__script", { responses: [
    { text: JSON.stringify(DRAFT) },
    { text: JSON.stringify({
      adjustment: "Acknowledge the commitment, then ask which of the two options meets the immediate need.",
      response: "I hear the Friday commitment. I can offer the summary Friday or the full report Tuesday. Which would help most?",
      nextStep: "Which option should I work toward?",
    }) },
  ] });
  await ev('document.getElementById("btn-prep-go").click();true');
  await shot("plan-desktop.png", "screen-prep-plan", 1024, 800);
  await ev('document.getElementById("btn-prep-practice").click();true');
  await waitScreen("screen-prep-practice");
  await cli("fill", "#prep-reply", "I hear the deadline pressure. A summary Friday or the full report Tuesday are the honest options.");
  await ev('document.getElementById("btn-prep-adjust").click();true');
  await shot("rehearsal-mobile.png", "screen-prep-feedback", 390, 844);
  await ev('document.getElementById("btn-prep-card").click();true');
  await waitScreen("screen-prep-card");
  for (let i = 0; i < 30; i += 1) {
    if (await ev('document.getElementById("card-save-note").textContent') === "Saved.") break;
    await sleep(200);
  }
  assert.equal(await ev('document.getElementById("card-save-note").textContent'), "Saved.");
  await shot("card-desktop.png", "screen-prep-card", 1024, 800);

  for (const [name, width, height, text] of [
    ["cover.png", 1200, 630, true],
    ["logo.png", 512, 512, false],
  ]) {
    await fresh();
    await cli("set", "viewport", String(width), String(height));
    await ev(`(() => {
      const sprite=document.querySelector('#mascot-home svg').cloneNode(true);
      sprite.style.cssText='width:${text ? 180 : 360}px;height:${text ? 180 : 360}px;overflow:visible';
      const board=document.createElement('div');
      board.style.cssText='display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:22px;width:${width}px;height:${height}px';
      board.append(sprite);
      if(${text}) {
        for(const [copy,size,color] of [['Brume',64,'var(--fg)'],['Get ready for what comes next.',36,'var(--accent)'],['Prepare a conversation. Keep your footing.',24,'var(--muted)']]) {
          const p=document.createElement('p');p.textContent=copy;p.style.cssText='margin:0;font-size:'+size+'px;font-weight:'+(size>30?700:400)+';color:'+color;board.append(p);
        }
      }
      document.documentElement.dataset.daypart='day';
      document.body.replaceChildren(board);
      return true;
    })()`);
    await cli("screenshot", join(output, name));
  }
  console.log("7 listing candidates captured from synthetic fixtures.");
} finally {
  if (browserStarted) {
    try { await cli("close"); } catch {}
  }
  server.kill();
}
