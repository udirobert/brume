// Brume as an MCP app — see docs/MCP-APP.md.
// Same contract as the Anna Executa (anna/executas/brume): the calling
// model writes the plan, we validate it against anna/bundle/plan.js (the
// file all three implementations share), then return the pacing script
// plus a self-contained widget that runs the live session.

import http from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import {
  PATTERNS,
  ALLOWED_LENGTHS,
  validateAgentPlan,
  fallbackPlan,
  effectiveLengthSeconds,
  phaseWord,
  cleanReflection,
} from "../anna/bundle/plan.js";

const WIDGET_URI = "ui://widget/brume-session.html";

// Self-contained session view: reads the plan from toolOutput and runs
// the phases itself, so it works before the web /embed route exists.
const WIDGET_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;height:100%;background:#faf6ef;color:#2f2a33;
    font-family:system-ui,-apple-system,sans-serif}
  body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px}
  #orb{width:120px;height:120px;border-radius:50%;
    background:radial-gradient(circle at 40% 35%,#cbb8f0,#8f7ad8);
    box-shadow:0 0 60px 12px rgba(143,122,216,.35);
    transition:transform .9s cubic-bezier(.16,1,.3,1),opacity .9s;
    transform:scale(.72);opacity:.85}
  #orb.in{transform:scale(1);opacity:1}
  #phase{font-size:22px;letter-spacing:.02em;min-height:1.4em}
  #title{font-size:15px;opacity:.75;max-width:26em;text-align:center}
  #cue{font-size:13px;opacity:.55;min-height:1.4em}
  #again{border:1px solid #2f2a33;border-radius:999px;background:none;
    color:inherit;padding:8px 22px;font:inherit;font-size:14px;cursor:pointer;display:none}
  @media (prefers-reduced-motion:reduce){#orb{transition:none}}
</style></head><body>
  <div id="orb"></div>
  <div id="phase"></div>
  <div id="title"></div>
  <div id="cue"></div>
  <button id="again">Again</button>
<script>
  const data = (window.openai && window.openai.toolOutput) || {};
  const phases = data.phases || [{word:"Breathe in",seconds:4},{word:"Breathe out",seconds:6}];
  const cycles = data.cycles || 4;
  document.getElementById("title").textContent = data.title || "";
  const orb = document.getElementById("orb"), word = document.getElementById("phase"),
        cue = document.getElementById("cue"), again = document.getElementById("again");
  let cueIx = 0;
  function setCue(){ const c=(data.cues||[])[cueIx++%(data.cues.length||1)]||""; cue.textContent=c; }
  function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
  let stopped = false;
  async function run(){
    stopped = false; again.style.display="none"; setCue();
    for (let c=0;c<cycles && !stopped;c++){
      for (const ph of phases){
        if (stopped) break;
        word.textContent = ph.word;
        orb.classList.toggle("in", ph.word==="Breathe in"||ph.word==="Top up"||ph.word==="Hold");
        await sleep(ph.seconds*1000);
      }
      if (phases.length && data.cues && data.cues.length>1) setCue();
    }
    if(!stopped){ word.textContent="Done"; orb.classList.remove("in"); again.style.display=""; }
  }
  again.onclick=()=>run();
  run();
</script></body></html>`;

function createServer() {
const server = new McpServer({ name: "brume", version: "0.0.1" });

server.registerResource(
  "brume-session-widget",
  WIDGET_URI,
  { title: "Brume session", description: "The live breathing view for a planned break." },
  async () => ({
    contents: [
      {
        uri: WIDGET_URI,
        mimeType: "text/html+skybridge",
        text: WIDGET_HTML,
      },
    ],
  }),
);

const patternEnum = z.enum(["cyclic-sigh", "long-exhale", "box", "steady"]);
const secondsEnum = z.union([
  z.literal(60), z.literal(90), z.literal(120), z.literal(180),
]);

server.registerTool(
  "brume_reset",
  {
    title: "Brume — a breathing break",
    description:
      "Start (or continue) a short guided breathing break for the user. " +
      "Before calling, plan it yourself from what the user said: choose pattern " +
      "(cyclic-sigh: 2s in, 1s top-up, 6s out — right before something tense or when " +
      "keyed up; long-exhale: 4s in, 6s out — a gentle reset between tasks; " +
      "box: 4s in, 4s hold, 4s out, 4s hold — getting ready for focused work; " +
      "steady: 5.5s in, 5.5s out — winding down) and seconds " +
      `(${ALLOWED_LENGTHS.join(", ")}; 60 if they have little time), and write ` +
      "title, opening, cues and why. Describe only the rhythm and how it fits " +
      "their moment — never effects on the body, brain, stress, sleep or health. " +
      "When the user says they are done, call brume_complete.",
    inputSchema: {
      context: z.string().optional().describe(
        "What the user said they are doing or about to do, as a short phrase. Never invent one.",
      ),
      pattern: patternEnum.optional().describe("Breathing pattern you chose."),
      seconds: secondsEnum.optional().describe("Length you chose."),
      title: z.string().optional().describe("Up to 6 words naming this break."),
      opening: z.string().optional().describe(
        "One or two calm sentences (max 30 words) responding to what they said.",
      ),
      cues: z.array(z.string()).optional().describe(
        "2 or 3 short phrases (max 8 words each) about posture or attention — never counts, timings, or the words in, out, hold, inhale or exhale.",
      ),
      why: z.string().optional().describe(
        "One sentence (max 20 words): which part of their note this rhythm fits, describing the rhythm only.",
      ),
      pace: z.string().optional(),
      remaining_seconds: z.number().optional(),
      cycles: z.number().optional(),
    },
    _meta: { "openai/outputTemplate": WIDGET_URI },
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
  },
  async (args) => {
    const plan = validateAgentPlan(args) ?? fallbackPlan(args?.context, "fallback");
    const { cycles, effectiveSeconds } = effectiveLengthSeconds(
      plan.pattern,
      plan.seconds,
    );
    const p = PATTERNS[plan.pattern];
    const phases = [
      ["inhale", p.inhale],
      ["topup", p.topup],
      ["hold", p.hold],
      ["exhale", p.exhale],
      ["pause", p.holdAfterExhale],
    ]
      .filter(([, s]) => s > 0)
      .map(([phase, s]) => ({ word: phaseWord(plan.pattern, phase), seconds: s }));

    const script = [
      plan.title,
      "",
      plan.opening,
      "",
      `${p.name} — ${p.rhythm} · ${cycles} cycles, about ${effectiveSeconds}s`,
      ...plan.cues.map((c) => `· ${c}`),
      "",
      plan.why,
      "",
      "(When you're done, say so — we'll close it out together.)",
    ].join("\n");

    return {
      content: [{ type: "text", text: script }],
      structuredContent: {
        pattern: plan.pattern,
        seconds: plan.seconds,
        effectiveSeconds,
        cycles,
        phases,
        title: plan.title,
        opening: plan.opening,
        cues: plan.cues,
        why: plan.why,
        planSource: plan.planSource,
      },
    };
  },
);

server.registerTool(
  "brume_complete",
  {
    title: "Brume — close out a break",
    description:
      "Record that the breathing break finished and write the short closing " +
      "note shown after it. At most 2 sentences, 35 words: acknowledge how it " +
      "went in plain words (if still wired or ended early, be matter-of-fact, " +
      "never guilt), then one concrete next step tied to what they said they " +
      "are doing next. No emoji, no medical or health claims, no breathing science.",
    inputSchema: {
      felt: z.enum(["calmer", "same", "wired"]).optional().describe(
        "How the user says they feel now, if they said.",
      ),
      reflection: z.string().optional().describe(
        "The short closing note you wrote for them.",
      ),
    },
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
  },
  async (args) => {
    const note = cleanReflection(args?.reflection);
    return {
      content: [{ type: "text", text: note }],
      structuredContent: { felt: args?.felt ?? null, reflection: note },
    };
  },
);

return server;
}

// Stateless Streamable HTTP: a fresh server+transport per request, per the
// SDK's recommended stateless pattern.
const port = Number(process.env.PORT || 4619);
http
  .createServer(async (req, res) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
    }
  })
  .listen(port, () => {
    console.error(`brume-mcp listening on :${port}`);
  });
