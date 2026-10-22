import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const bundleDir = join(here, "..", "bundle");
const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 4617);

const kv = new Map();
const llmCalls = [];
const kvFaults = { get: {}, set: {}, list: {} };
let entryPayload = null;
let startup = { fail: false, delayMs: 0 };
const kvDelays = {};
let script = [];
const hangers = [];

const DEFAULT_PLAN = JSON.stringify({
  kind: "plan",
  opening: "I wanted to talk through the timeline together.",
  keyPoint: "We need two more people to hit the date.",
  approach: "Start from the shared goal, then name the constraint.",
  objection: "Why can't the current team absorb it?",
  response: "Here is what slips if nothing changes.",
  nextStep: "Can we look at staffing this week?",
});
const DEFAULT_REHEARSAL = JSON.stringify({
  adjustment: "Name the trade-off before defending the ask.",
  response: "If the date stays, scope has to move — here's where.",
  nextStep: "Shall we pick what descopes together?",
});
const DEFAULT_PLAN_LLM = JSON.stringify({
  pattern: "cyclic-sigh", seconds: 90, title: "Before the call",
  opening: "A short settle before you dial in.",
  cues: ["Shoulders soft", "Unclench your jaw"],
  why: "The long exhale suits the minutes before a tense moment.",
});
const DEFAULT_REFLECTION = "Carry this quiet into whatever comes next.";
const DEFAULT_NOTE = "Use the next few minutes on the task that needs it most.";

function defaultReply(messages) {
  const sys = messages[0]?.content?.text ?? "";
  if (sys.includes("conversation-preparation companion")) {
    if (sys.includes("practised one response")) return DEFAULT_REHEARSAL;
    return DEFAULT_PLAN;
  }
  if (sys.includes("breathing break for a person")) return DEFAULT_PLAN_LLM;
  if (sys.includes("alertness check")) return DEFAULT_NOTE;
  return DEFAULT_REFLECTION;
}

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const json = (v) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(v));
  };
  const body = async () => {
    const d = await new Promise((r) => {
      let acc = "";
      req.on("data", (c) => (acc += c));
      req.on("end", () => r(acc));
    });
    try {
      return JSON.parse(d || "{}");
    } catch {
      return { __bad: true };
    }
  };

  if (url.pathname === "/__kv") {
    const args = await body();
    if (args.__bad) { res.writeHead(400); return res.end("bad json"); }
    const { op, key, value } = args;
    if (kvDelays[key] > 0) await new Promise((r) => setTimeout(r, kvDelays[key]));
    if ((kvFaults[op]?.[key] || 0) > 0) {
      kvFaults[op][key] -= 1;
      return json({ ok: false, error: { code: "faulted", message: "injected kv fault" } });
    }
    if (op === "get") return json({ value: kv.has(key) ? kv.get(key) : null });
    if (op === "set") {
      if (value === null) kv.delete(key); else kv.set(key, value);
      return json({ ok: true, result: null });
    }
    if (op === "list") {
      return json({ keys: [...kv.keys()].filter((k) => k.startsWith(args.prefix || "")).map((k) => ({ key: k })) });
    }
  }
  if (url.pathname === "/__llm") {
    const req_ = await body();
    llmCalls.push(req_);
    const next = script.length ? script.shift() : { text: defaultReply(req_.messages) };
    if (next.hang) {
      hangers.push(res);
      return;
    }
    if (next.delayMs) await new Promise((r) => setTimeout(r, next.delayMs));
    if (next.error) return json({ ok: false, error: next.error });
    return json({
      role: "assistant",
      content: { type: "text", text: next.text },
      model: "fake-model",
      stopReason: "endTurn",
    });
  }
  if (url.pathname === "/__script") { script = (await body()).responses || []; return json({ ok: true }); }
  if (url.pathname === "/__fault") {
    const b = await body();
    if (b.op && b.key) kvFaults[b.op][b.key] = (kvFaults[b.op][b.key] || 0) + (b.times ?? 1);
    return json({ ok: true, kvFaults });
  }
  if (url.pathname === "/__startup" && req.method === "POST") {
    startup = { ...startup, ...(await body()) };
    return json({ ok: true, startup });
  }
  if (url.pathname === "/__startup") return json(startup);
  if (url.pathname === "/__delay" && req.method === "POST") {
    const b = await body();
    kvDelays[b.key] = b.ms || 0;
    return json({ ok: true, kvDelays });
  }
  if (url.pathname === "/__entry" && req.method === "POST") {
    entryPayload = (await body()).payload ?? null;
    return json({ ok: true });
  }
  if (url.pathname === "/__entry") return json({ payload: entryPayload });
  if (url.pathname === "/__dump") {
    return json({ kv: Object.fromEntries(kv), llmCalls });
  }
  if (url.pathname === "/__reset") {
    kv.clear(); llmCalls.length = 0; script = [];
    kvFaults.get = {}; kvFaults.set = {}; kvFaults.list = {}; entryPayload = null;
    startup = { fail: false, delayMs: 0 }; for (const k of Object.keys(kvDelays)) delete kvDelays[k];
    return json({ ok: true });
  }

  let path = url.pathname === "/" ? "/index.html" : url.pathname;
  let file;
  if (path === "/static/anna-apps/_sdk/latest/index.js") {
    file = join(here, "fake-sdk.js");
  } else {
    file = join(bundleDir, path);
    if (!file.startsWith(bundleDir)) { res.writeHead(403); return res.end(); }
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "text/plain" });
    res.end(data);
  } catch {
    res.writeHead(404); res.end("not found");
  }
});
server.listen(PORT, HOST, () => console.log(`fake host on http://${HOST}:${PORT}`));
