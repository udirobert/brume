import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const run = promisify(execFile);
const BASE = "http://127.0.0.1:4618";
const SESSION = process.env.AGENT_BROWSER_SESSION || "brume-preparation-qa";
let passed = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function cli(...args) {
  const { stdout } = await run("agent-browser", ["--session", SESSION, ...args]);
  return stdout.trim();
}
const ev = async (js) => {
  const out = (await cli("eval", js)).trim();
  const unq = (v) => { try { return JSON.parse(v); } catch { return v; } };
  const r = unq(out);
  return typeof r === "string" && r !== out ? unq(r) : r;
};
const post = (p, b) => fetch(`${BASE}${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b || {}) }).then((r) => r.json());
const screens = 'JSON.stringify([...document.querySelectorAll(".screen")].filter(s=>!s.hidden).map(s=>s.id))';
const CASE = process.env.CASE || null;
const failures = [];
async function ok(name, fn) {
  if (CASE && !CASE.split("|").some((part) => name.includes(part))) return;
  try { await fn(); passed += 1; console.log("ok", passed, "-", name); }
  catch (e) { failures.push({ name, err: e.message?.split("\n").slice(0, 6).join(" | ") || String(e) }); console.log("FAIL", "-", name); }
}

const fresh = async () => {
  await cli("open", "about:blank");
  await sleep(400);
  await post("/__reset");
  await cli("open", BASE);
  await sleep(1100);
};
const server = spawn("node", [join(here, "fake-host-server.mjs")], { env: { ...process.env, PORT: "4618" } });
let browserStarted = false;
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Fake host did not start")), 8000);
    let output = "";
    server.once("error", reject);
    server.once("exit", (code) => reject(new Error(`Fake host exited: ${code}`)));
    server.stdout.on("data", (data) => {
      output += data;
      if (output.includes(`fake host on ${BASE}`)) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });
  await post("/__reset");
  browserStarted = true;
  await cli("open", BASE);
  await sleep(1200);

  await ok("boots to home", async () => {
    assert.deepEqual(await ev(screens), ["screen-home"]);
    assert.ok(await ev('document.body.scrollWidth <= document.documentElement.clientWidth + 1'));
  });

  await ok("prep full flow + reload identical + no extra LLM", async () => {
    await fresh();
    await ev('document.getElementById("btn-ready").click()');
    await cli("fill", "#prep-event", "Deadline ask");
    await cli("fill", "#prep-goal", "Two more weeks");
    await ev('document.getElementById("btn-prep-go").click()');
    await sleep(900);
    assert.deepEqual(await ev(screens), ["screen-prep-plan"]);
    await ev('document.getElementById("prep-opening").value="EDITED OP";document.getElementById("prep-opening").dispatchEvent(new Event("input"))');
    await ev('document.getElementById("btn-prep-practice").click()');
    await cli("fill", "#prep-reply", "my draft answer");
    await ev('document.getElementById("btn-prep-adjust").click()');
    await sleep(900);
    assert.deepEqual(await ev(screens), ["screen-prep-feedback"]);
    await ev('document.getElementById("prep-final-response").value="USER FINAL";document.getElementById("prep-final-response").dispatchEvent(new Event("input"))');
    await ev('document.getElementById("btn-prep-card").click()');
    await sleep(1200);
    const before = (await post("/__dump")).llmCalls.length;
    await cli("reload");
    await sleep(1400);
    assert.deepEqual(await ev(screens), ["screen-prep-card"]);
    assert.equal(await ev('document.getElementById("card-opening").textContent'), "EDITED OP");
    assert.equal(await ev('document.getElementById("card-response").textContent'), "USER FINAL");
    assert.equal((await post("/__dump")).llmCalls.length, before);
    const dump = await post("/__dump");
    assert.ok(Object.keys(dump.kv).some((k) => k.startsWith("ready/sessions/")));
  });

  await ok("reset session reload restores paused, no closed accrual", async () => {
    await fresh();
    await ev('document.getElementById("btn-ready").click()');
    await cli("fill", "#prep-event", "x");
    await ev('document.getElementById("btn-prep-go").click()');
    await sleep(900);
    await ev('document.getElementById("btn-prep-finish").click()');
    await sleep(1200);
    await ev('document.getElementById("btn-card-done").click()');
    await sleep(600);
    await ev('document.getElementById("btn-quick").click()');
    await sleep(400);
    await ev('document.getElementById("btn-begin").click()');
    await sleep(3000);
    await cli("reload");
    await sleep(1400);
    const r = await ev('JSON.stringify({screen:[...document.querySelectorAll(".screen")].filter(s=>!s.hidden).map(s=>s.id),pause:document.getElementById("btn-pause").textContent,elapsed:document.getElementById("elapsed").textContent})');
    assert.deepEqual(r.screen, ["screen-session"]);
    assert.equal(r.pause, "Resume");
    assert.ok(r.elapsed === "0:02" || r.elapsed === "0:03" || r.elapsed === "0:04", r.elapsed);
    await sleep(1500);
    assert.equal(await ev('document.getElementById("elapsed").textContent'), r.elapsed);
    await ev('document.getElementById("btn-end").click()');
    await sleep(300);
    await ev('document.querySelector("[data-felt=calmer]").click()');
    await sleep(1500);
    assert.deepEqual(await ev(screens), ["screen-result"]);
    assert.equal(await ev('document.getElementById("closing-line").textContent'), "Carry this quiet into whatever comes next.");
    await ev('document.getElementById("btn-again").click()');
    await sleep(400);
  });


  await ok("alert interruption on reload keeps no record", async () => {
    await fresh();
    await ev('document.getElementById("btn-alertness").click()');
    await sleep(300);
    await ev('document.getElementById("btn-alert-skip-kss").click()');
    for (let i = 0; i < 20; i += 1) {
      await sleep(400);
      const cp = (await post("/__dump")).kv["brume/active-task"];
      if (cp && cp.screen === "test") break;
    }
    const cpx = (await post("/__dump")).kv["brume/active-task"];
    assert.equal(cpx?.screen, "test", `expected test checkpoint, got ${cpx?.screen}`);
    await cli("reload");
    await sleep(1400);
    const r = await ev('JSON.stringify({screen:[...document.querySelectorAll(".screen")].filter(s=>!s.hidden).map(s=>s.id),note:!document.getElementById("alert-interrupt-note").hidden})');
    assert.deepEqual(r.screen, ["screen-alert"]);
    assert.equal(r.note, true);
    const dump = await post("/__dump");
    assert.ok(!Object.keys(dump.kv).some((k) => k.startsWith("alert/checks/")));
  });

  await ok("full 60s alert run saves metrics once, note failure honest", async () => {
    await fresh();
    await ev('document.getElementById("btn-alertness").click()');
    await sleep(400);
    await post("/__script", { responses: [{ error: { code: "down", message: "note down" } }] });
    await ev('document.getElementById("btn-alert-start").click()');
    await sleep(3200);
    await ev(`window.__tap=setInterval(()=>{const m=document.getElementById("alert-ms");if(m&&!m.hidden&&Number(m.textContent)>=150){document.getElementById("alert-target").dispatchEvent(new PointerEvent("pointerdown",{pointerType:"mouse"}))}},120)`);
    await cli("wait", "#alert-band", "75000");
    await ev('clearInterval(window.__tap)');
    await sleep(800);
    assert.deepEqual(await ev(screens), ["screen-alert-result"]);
    assert.ok((await ev('document.getElementById("alert-median").textContent')).includes("ms"));
    const dump = await post("/__dump");
    const checks = Object.keys(dump.kv).filter((k) => k.startsWith("alert/checks/"));
    assert.equal(checks.length, 1);
    const rec = dump.kv[checks[0]];
    assert.ok(rec.medianMs > 0 && rec.trials > 0);
    const note = await ev('document.getElementById("alert-note").textContent');
    assert.ok(note.includes("saved") || note === "AI note unavailable", note);
    await ev('document.getElementById("btn-alert-done").click()');
  });

  await ok("entry payload keep/replace over unfinished task", async () => {
    await fresh();
    await ev('document.getElementById("btn-alertness").click()');
    await sleep(400);
    await ev('__pushPayload && __pushPayload({context:"c",mode:"reset"})');
    await sleep(300);
    const t = await ev('document.getElementById("task-banner-text").textContent');
    assert.ok(t.includes("unfinished"), t);
    await ev('document.getElementById("btn-task-keep").click()');
    await sleep(300);
    assert.equal(await ev('document.getElementById("task-banner").hidden'), true);
    await ev('document.getElementById("btn-home-nav").click()');
  });

  await ok("initial ready payload populates prep input", async () => {
    await cli("open", "about:blank");
    await sleep(400);
    await post("/__reset");
    await post("/__entry", { payload: { mode: "ready", context: "Interview tomorrow", goal: "Senior role", key_point: "Shipping record" } });
    await cli("open", BASE);
    await sleep(1200);
    assert.deepEqual(await ev(screens), ["screen-prep-input"]);
    assert.equal(await ev('document.getElementById("prep-event").value'), "Interview tomorrow");
    assert.equal(await ev('document.getElementById("prep-goal").value'), "Senior role");
  });

  const READY_CP = (updatedAt) => ({ version: 1, id: "t-1", flow: "ready", screen: "plan", updatedAt,
    data: { prep: { input: { event: "stored event", goal: "g", keyPoint: "", kind: null },
      stage: "plan", clarificationUsed: false, question: "", clarification: "",
      plan: { opening: "o", keyPoint: "k", approach: "a", objection: "ob", response: "r", nextStep: "n" },
      reply: "", feedback: null, finalResponse: null, finalNextStep: null,
      busy: null, error: "", completedAt: null, saved: false }, pause: null } });

  await ok("checkpoint get denial blocks writes, retry restores", async () => {
    await cli("open", "about:blank");
    await sleep(400);
    await post("/__reset");
    await post("/__kv", { op: "set", key: "brume/active-task", value: READY_CP(Date.now()) });
    await post("/__fault", { op: "get", key: "brume/active-task", times: 1 });
    await cli("open", BASE);
    await sleep(1200);
    const t = await ev('document.getElementById("task-banner-text").textContent');
    assert.ok(t.includes("Couldn't check"), t);
    await ev('document.getElementById("btn-ready").click()');
    await sleep(400);
    const dump = await post("/__dump");
    assert.equal(dump.kv["brume/active-task"].id, "t-1");
    await ev('document.getElementById("btn-task-retry").click()');
    await sleep(800);
    assert.deepEqual(await ev(screens), ["screen-prep-plan"]);
    assert.equal(await ev('document.getElementById("prep-opening").value'), "o");
  });

  await ok("corrupt nested state shows banner, month-old restores", async () => {
    await cli("open", "about:blank");
    await sleep(400);
    await post("/__reset");
    await post("/__kv", { op: "set", key: "brume/active-task", value: { version: 1, id: "x", flow: "ready", screen: "plan", updatedAt: Date.now(), data: { prep: { stage: "bogus" } } } });
    await cli("open", BASE);
    await sleep(1200);
    assert.ok((await ev('document.getElementById("task-banner-text").textContent')).includes("can't restore"));
    await post("/__kv", { op: "set", key: "brume/active-task", value: READY_CP(Date.now() - 30 * 24 * 3600 * 1000) });
    await cli("reload");
    await sleep(1200);
    assert.deepEqual(await ev(screens), ["screen-prep-plan"]);
  });

  await ok("failed tombstone blocks replace, persisted task survives", async () => {
    await cli("open", "about:blank");
    await sleep(400);
    await post("/__reset");
    await post("/__kv", { op: "set", key: "brume/active-task", value: READY_CP(Date.now()) });
    await cli("open", BASE);
    await sleep(1100);
    await ev('__pushPayload({mode:"reset",context:"new task"})');
    await sleep(300);
    assert.equal(await ev('document.getElementById("btn-task-replace").hidden'), false);
    await post("/__fault", { op: "set", key: "brume/active-task", times: 1 });
    await ev('document.getElementById("btn-task-replace").click()');
    await sleep(800);
    const dump = await post("/__dump");
    assert.equal(dump.kv["brume/active-task"].id, "t-1");
    assert.ok((await ev('document.getElementById("task-status").textContent')).includes("Couldn't save"));
    await ev('document.getElementById("task-status").querySelector("button")?.click()');
    await sleep(800);
    assert.equal((await post("/__dump")).kv["brume/active-task"], undefined);
  });

  await ok("clarification draft survives reload, Continue keeps event+goal", async () => {
    await cli("open", "about:blank");
    await sleep(400);
    await post("/__reset");
    await post("/__script", { responses: [
      { text: JSON.stringify({ kind: "clarify", question: "Internal or external?" }) },
      { text: '{"kind":"plan","opening":"o","keyPoint":"k","approach":"a","objection":"ob","response":"r","nextStep":"n"}' },
    ] });
    await cli("open", BASE);
    await sleep(1100);
    await ev('document.getElementById("btn-ready").click()');
    await cli("fill", "#prep-event", "Deadline ask");
    await cli("fill", "#prep-goal", "2 weeks");
    await ev('document.getElementById("btn-prep-go").click()');
    await sleep(800);
    assert.deepEqual(await ev(screens), ["screen-prep-clarify"]);
    await cli("fill", "#prep-clarification", "Internal team");
    await cli("reload");
    await sleep(1100);
    assert.equal(await ev('document.getElementById("prep-clarification").value'), "Internal team");
    await ev('document.getElementById("btn-prep-answer").click()');
    await sleep(800);
    const dump = await post("/__dump");
    const last = dump.llmCalls.at(-1);
    const input = JSON.parse(last.messages[1].content.text);
    assert.equal(input.event, "Deadline ask");
    assert.equal(input.goal, "2 weeks");
    assert.equal(input.clarification.answer, "Internal team");
    assert.deepEqual(await ev(screens), ["screen-prep-plan"]);
  });

  await ok("cancel delayed prep, retry works; home stays home on late reply", async () => {
    await cli("open", "about:blank");
    await sleep(400);
    await post("/__reset");
    await post("/__script", { responses: [{ delayMs: 4000, text: '{"kind":"plan","opening":"o","keyPoint":"k","approach":"a","objection":"ob","response":"r","nextStep":"n"}' }, { text: '{"kind":"plan","opening":"o2","keyPoint":"k","approach":"a","objection":"ob","response":"r","nextStep":"n"}' }] });
    await cli("open", BASE);
    await sleep(1100);
    await ev('document.getElementById("btn-ready").click()');
    await cli("fill", "#prep-event", "x");
    await ev('document.getElementById("btn-prep-go").click()');
    await sleep(400);
    await ev('document.getElementById("btn-prep-cancel").click()');
    await sleep(4500);
    assert.deepEqual(await ev(screens), ["screen-prep-input"]);
    await ev('document.getElementById("btn-prep-go").click()');
    await sleep(900);
    assert.deepEqual(await ev(screens), ["screen-prep-plan"]);
    assert.equal(await ev('document.getElementById("prep-opening").value'), "o2");
    await fresh();
    await post("/__script", { responses: [{ delayMs: 2500, text: '{"kind":"plan","opening":"LATE","keyPoint":"k","approach":"a","objection":"ob","response":"r","nextStep":"n"}' }] });
    await ev('document.getElementById("btn-ready").click()');
    await cli("fill", "#prep-event", "Leave this draft");
    await ev('document.getElementById("btn-prep-go").click()');
    await sleep(400);
    await ev('document.getElementById("btn-home-nav").click()');
    await sleep(3000);
    assert.deepEqual(await ev(screens), ["screen-home"]);
  });

  await ok("payload replace while delayed prep never stale-shows", async () => {
    await cli("open", "about:blank");
    await sleep(400);
    await post("/__reset");
    await post("/__script", { responses: [{ delayMs: 3000, text: '{"kind":"plan","opening":"STALE","keyPoint":"k","approach":"a","objection":"ob","response":"r","nextStep":"n"}' }] });
    await cli("open", BASE);
    await sleep(1100);
    await ev('document.getElementById("btn-ready").click()');
    await cli("fill", "#prep-event", "x");
    await ev('document.getElementById("btn-prep-go").click()');
    await sleep(400);
    await ev('__pushPayload && __pushPayload({context:"new thing",mode:"reset"})');
    await sleep(300);
    await ev('document.getElementById("btn-task-replace").click()');
    await sleep(4200);
    assert.deepEqual(await ev(screens), ["screen-plan"]);
    assert.equal((await post("/__dump")).kv["brume/active-task"].flow, "reset");
  });

  await ok("guided pause survives running reload and Home with edited rehearsal", async () => {
    await fresh();
    await ev('document.getElementById("btn-ready").click()');
    await cli("fill", "#prep-event", "Discuss a delivery date");
    await ev('document.getElementById("btn-prep-go").click()');
    await sleep(1000);
    await cli("fill", "#prep-opening", "My edited opening survives the pause.");
    await ev('document.getElementById("btn-prep-pause").click()');
    await sleep(1800);
    await cli("reload");
    await sleep(1100);
    assert.deepEqual(await ev(screens), ["screen-ready-run"]);
    assert.equal(await ev('document.getElementById("btn-ready-pause").textContent'), "Resume");
    const first = (await post("/__dump")).kv["brume/active-task"];
    assert.ok(first.data.pause.elapsedMs >= 1000);
    const paused = await ev('document.getElementById("ready-timer").textContent');
    await sleep(1100);
    assert.equal(await ev('document.getElementById("ready-timer").textContent'), paused);
    await ev('document.getElementById("btn-home-nav").click()');
    await cli("reload");
    await sleep(1000);
    assert.deepEqual(await ev(screens), ["screen-ready-run"]);
    assert.equal(await ev('document.getElementById("ready-timer").textContent'), paused);
    for (let i = 0; i < 3; i += 1) await ev('document.getElementById("btn-ready-next").click()');
    assert.equal(await ev('document.getElementById("ready-opener").textContent'), "My edited opening survives the pause.");
  });

  await ok("failed card save survives reload and retries without another model call", async () => {
    await fresh();
    await ev('document.getElementById("btn-ready").click()');
    await cli("fill", "#prep-event", "Prepare a budget request");
    await ev('document.getElementById("btn-prep-go").click()');
    await sleep(1000);
    await post("/__fault", { op: "set", key: "ready/last", times: 1 });
    await ev('document.getElementById("btn-prep-finish").click()');
    await sleep(1000);
    assert.ok((await ev('document.getElementById("card-save-note").textContent')).includes("Couldn't save"));
    const before = await post("/__dump");
    const key = Object.keys(before.kv).find((k) => k.startsWith("ready/sessions/"));
    assert.ok(key);
    await cli("reload");
    await sleep(1000);
    assert.equal(await ev('document.getElementById("btn-card-save-retry").hidden'), false);
    await ev('document.getElementById("btn-card-save-retry").click()');
    await sleep(1000);
    assert.equal(await ev('document.getElementById("card-save-note").textContent'), "Saved.");
    const after = await post("/__dump");
    assert.equal(after.llmCalls.length, before.llmCalls.length);
    assert.deepEqual(Object.keys(after.kv).filter((k) => k.startsWith("ready/sessions/")), [key]);
    assert.equal(after.kv["ready/last"].completedAt, after.kv[key].completedAt);
  });

  await ok("pending reset reflection restores facts and stable save without regeneration", async () => {
    await fresh();
    await ev('document.getElementById("btn-quick").click();document.getElementById("btn-begin").click()');
    await sleep(1300);
    await ev('document.getElementById("btn-end").click()');
    await post("/__script", { responses: [{ delayMs: 5000, text: "Delayed note." }] });
    await ev('document.querySelector("[data-felt=calmer]").click()');
    await sleep(500);
    const before = await post("/__dump");
    const timestamp = before.kv["brume/active-task"].data.result.completedAt;
    assert.equal(before.kv["brume/active-task"].data.result.reflectionStatus, "pending");
    await cli("reload");
    await sleep(1000);
    assert.deepEqual(await ev(screens), ["screen-result"]);
    assert.equal((await post("/__dump")).llmCalls.length, before.llmCalls.length);
    await ev('document.getElementById("btn-save-anyway").click()');
    await sleep(1000);
    const after = await post("/__dump");
    assert.equal(after.kv["reset/last"].completedAt, timestamp);
    assert.equal(after.kv["reset/summary"].total, 1);
    assert.equal(after.llmCalls.length, before.llmCalls.length);
  });

  await ok("mobile 320 no overflow + card screenshot", async () => {
    await fresh();
    await cli("set", "viewport", "320", "740");
    await sleep(300);
    await ev('document.getElementById("btn-ready").click()');
    await cli("fill", "#prep-event", "Discuss the deadline with my manager");
    await ev('document.getElementById("btn-prep-go").click()');
    await sleep(1000);
    assert.deepEqual(await ev(screens), ["screen-prep-plan"]);
    assert.ok((await ev('document.body.scrollWidth')) <= 321, "no 320px overflow");
    await cli("screenshot", "/tmp/brume-prep-plan-mobile.png");
    await cli("set", "viewport", "420", "700");
    await ev('document.getElementById("btn-prep-finish").click()');
    await sleep(1000);
    assert.deepEqual(await ev(screens), ["screen-prep-card"]);
    assert.ok((await ev('document.body.scrollWidth')) <= 421, "no 420px overflow");
    await cli("screenshot", "/tmp/brume-prep-card-desktop.png");
  });

  await ok("moment button pre-fills without model call", async () => {
    await fresh();
    await ev('document.querySelector("[data-moment=deadline]").click()');
    await sleep(400);
    assert.deepEqual(await ev(screens), ["screen-prep-input"]);
    assert.equal(await ev('document.getElementById("prep-event").value'), "I need to push back on a deadline.");
    assert.ok((await ev('document.getElementById("prep-wording-badge").textContent')).includes("Wording"));
    assert.equal((await post("/__dump")).llmCalls.length, 0);
  });

  await ok("valid Anna draft handoff: editable plan, zero model", async () => {
    await cli("open", "about:blank");
    await sleep(400);
    await post("/__reset");
    await post("/__entry", { payload: { mode: "ready", context: "Interview next week", goal: "Senior PM",
      preparation: { kind: "plan", opening: "Thanks for having me.", keyPoint: "I ship programs.", approach: "Lead with outcomes.", objection: "Domain depth?", response: "I ramped X in 6 weeks.", nextStep: "Happy to share a plan." } } });
    await cli("open", BASE);
    await sleep(1500);
    assert.deepEqual(await ev(screens), ["screen-prep-plan"]);
    assert.equal(await ev('!document.getElementById("prep-handoff-label").hidden'), true);
    assert.equal(await ev('document.getElementById("prep-opening").value'), "Thanks for having me.");
    assert.equal((await post("/__dump")).llmCalls.length, 0);
  });

  await ok("invalid draft keeps context, honest error, no call", async () => {
    await cli("open", "about:blank");
    await sleep(400);
    await post("/__reset");
    await post("/__entry", { payload: { mode: "ready", context: "Team conflict", preparation: { kind: "plan", opening: "only" } } });
    await cli("open", BASE);
    await sleep(1500);
    assert.deepEqual(await ev(screens), ["screen-prep-input"]);
    assert.equal(await ev('document.getElementById("prep-event").value'), "Team conflict");
    assert.ok((await ev('document.getElementById("prep-status-text").textContent')).includes("could not be used"));
    assert.equal((await post("/__dump")).llmCalls.length, 0);
  });

  await ok("startup visible while connect hangs; failure retries once", async () => {
    await cli("open", "about:blank");
    await sleep(400);
    await post("/__reset");
    await post("/__startup", { delayMs: 4000 });
    await cli("open", BASE);
    await sleep(600);
    assert.equal(await ev('!document.getElementById("startup-panel").hidden'), true);
    await sleep(4000);
    assert.deepEqual(await ev(screens), ["screen-home"]);
    await post("/__startup", { fail: true, delayMs: 0 });
    await cli("open", BASE);
    await sleep(10500);
    assert.equal(await ev('document.getElementById("btn-startup-retry").hidden'), false);
    await post("/__startup", { fail: false });
    await ev('document.getElementById("btn-startup-retry").click()');
    await sleep(1500);
    assert.deepEqual(await ev(screens), ["screen-home"]);
  });

  await ok("wording preference explicit save/forget persists", async () => {
    await fresh();
    await ev('document.getElementById("pref-details").open=true;document.getElementById("wording-select").value="concise";document.getElementById("btn-pref-save").click()');
    await sleep(800);
    const dump = await post("/__dump");
    assert.equal(dump.kv["ready/preferences"].wordingStyle, "concise");
    await cli("reload");
    await sleep(1400);
    await ev('document.getElementById("pref-details").open=true');
    await sleep(500);
    assert.equal(await ev('document.getElementById("wording-select").value'), "concise");
    await ev('document.getElementById("btn-pref-forget").click()');
    await sleep(600);
    assert.equal((await post("/__dump")).kv["ready/preferences"], undefined);
  });

  await ok("brand font local + no remote font requests", async () => {
    await fresh();
    const r = await ev(`(async()=>{await document.fonts.load('700 16px Manrope');
      const res=performance.getEntriesByType('resource').map(e=>e.name);
      return JSON.stringify({manrope:document.fonts.check('700 16px Manrope'),
        fontLoaded:res.some(n=>n.includes('Manrope')),
        remoteFont:res.filter(n=>n.includes('fonts.googleapis')||n.includes('fonts.gstatic'))})})()`);
    assert.equal(r.manrope, true, JSON.stringify(r));
    assert.equal(r.fontLoaded, true);
    assert.equal(r.remoteFont.length, 0, r.remoteFont.join(","));
  });

  await ok("saved wording reaches a new task and model; preserve survives", async () => {
    await fresh();
    await sleep(500);
    await ev('document.getElementById("pref-details").open=true;document.getElementById("wording-select").value="concise";document.getElementById("btn-pref-save").click()');
    await sleep(500);
    await ev('document.querySelector("[data-moment=deadline]").click()');
    await cli("fill", "#prep-preserve", "Trust without promising Friday.");
    await ev('document.getElementById("btn-prep-go").click()');
    await sleep(1000);
    const first = await post("/__dump");
    const request = JSON.parse(first.llmCalls.at(-1).messages[1].content.text);
    assert.equal(request.wordingStyle, "concise");
    assert.equal(request.preserve, "Trust without promising Friday.");
    assert.equal(first.kv["brume/active-task"].data.prep.wordingStyle, "concise");
    await ev('document.getElementById("btn-prep-finish").click()');
    await sleep(800);
    assert.equal(await ev('document.getElementById("card-pref-slot").contains(document.getElementById("pref-details"))'), true);
    await post("/__fault", { op: "set", key: "ready/preferences", times: 1 });
    await ev('document.getElementById("btn-pref-forget").click()');
    await sleep(400);
    assert.equal((await post("/__dump")).kv["ready/preferences"].wordingStyle, "concise");
    assert.ok((await ev('document.getElementById("pref-status").textContent')).includes("Couldn't remove"));
    await ev('document.getElementById("btn-pref-retry").click()');
    await sleep(400);
    assert.equal((await post("/__dump")).kv["ready/preferences"], undefined);
    await ev('document.getElementById("btn-card-done").click()');
    await sleep(400);
    await ev('document.getElementById("btn-ready").click()');
    await sleep(400);
    assert.equal((await post("/__dump")).kv["brume/active-task"].data.prep.wordingStyle, "natural");
  });

  await ok("slow optional history cannot block unfinished task restoration", async () => {
    await cli("open", "about:blank");
    await sleep(400);
    await post("/__reset");
    await post("/__kv", { op: "set", key: "brume/active-task", value: READY_CP(Date.now()) });
    await post("/__delay", { key: "reset/summary", ms: 9000 });
    await post("/__delay", { key: "brume/prefs", ms: 9000 });
    await cli("open", BASE);
    await sleep(1200);
    assert.deepEqual(await ev(screens), ["screen-prep-plan"]);
    assert.equal((await post("/__dump")).kv["brume/active-task"].id, "t-1");
    assert.equal((await post("/__dump")).llmCalls.length, 0);
  });

  await ok("active task read timeout blocks replacement and Retry restores", async () => {
    await cli("open", "about:blank");
    await sleep(400);
    await post("/__reset");
    await post("/__kv", { op: "set", key: "brume/active-task", value: READY_CP(Date.now()) });
    await post("/__delay", { key: "brume/active-task", ms: 9000 });
    await cli("open", BASE);
    await sleep(9000);
    assert.ok((await ev('document.getElementById("task-banner-text").textContent')).includes("Couldn't check"));
    await ev('document.querySelector("[data-moment=deadline]").click()');
    assert.equal((await post("/__dump")).kv["brume/active-task"].id, "t-1");
    assert.equal((await post("/__dump")).llmCalls.length, 0);
    await post("/__delay", { key: "brume/active-task", ms: 0 });
    await ev('document.getElementById("btn-task-retry").click()');
    await sleep(800);
    assert.deepEqual(await ev(screens), ["screen-prep-plan"]);
    assert.equal(await ev('document.getElementById("prep-opening").value'), "o");
  });

  console.log(`\n${passed} passed, ${failures.length} failed`);
  for (const f of failures) console.log(`FAILED: ${f.name}\n  ${f.err}`);
  process.exitCode = failures.length ? 1 : 0;
} finally {
  if (browserStarted) {
    try { await cli("close", "--session", SESSION); } catch {}
  }
  server.kill();
}
