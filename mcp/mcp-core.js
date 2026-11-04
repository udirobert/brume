// Shared, runtime-agnostic MCP core for Brume (used by both Node `server.js`
// and Cloudflare Worker `worker.js`). Validates agent plans with the shared
// `anna/bundle/plan.js` contract and serves the self-contained widget HTML.

import {
  PATTERNS,
  ALLOWED_LENGTHS,
  validateAgentPlan,
  fallbackPlan,
  effectiveLengthSeconds,
  phaseWord,
  cleanReflection,
} from "../anna/bundle/plan.js";

export const WIDGET_URI = "ui://widget/brume-session.html";

export function runBrumeReset(args = {}) {
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
}

export function runBrumeComplete(args = {}) {
  const note = cleanReflection(args?.reflection);
  return {
    content: [{ type: "text", text: note }],
    structuredContent: { felt: args?.felt ?? null, reflection: note },
  };
}

export const MCP_TOOLS = [
  {
    name: "brume_reset",
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
      type: "object",
      properties: {
        context: {
          type: "string",
          description:
            "What the user said they are doing or about to do, as a short phrase. Never invent one.",
        },
        pattern: {
          type: "string",
          enum: ["cyclic-sigh", "long-exhale", "box", "steady"],
          description: "Breathing pattern you chose.",
        },
        seconds: {
          type: "number",
          enum: [60, 90, 120, 180],
          description: "Length you chose.",
        },
        title: {
          type: "string",
          description: "Up to 6 words naming this break.",
        },
        opening: {
          type: "string",
          description:
            "One or two calm sentences (max 30 words) responding to what they said.",
        },
        cues: {
          type: "array",
          items: { type: "string" },
          description:
            "2 or 3 short phrases (max 8 words each) about posture or attention — never counts, timings, or the words in, out, hold, inhale or exhale.",
        },
        why: {
          type: "string",
          description:
            "One sentence (max 20 words): which part of their note this rhythm fits, describing the rhythm only.",
        },
        pace: { type: "string" },
        remaining_seconds: { type: "number" },
        cycles: { type: "number" },
      },
    },
    _meta: { "openai/outputTemplate": WIDGET_URI },
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
  },
  {
    name: "brume_complete",
    title: "Brume — close out a break",
    description:
      "Record that the breathing break finished and write the short closing " +
      "note shown after it. At most 2 sentences, 35 words: acknowledge how it " +
      "went in plain words (if still wired or ended early, be matter-of-fact, " +
      "never guilt), then one concrete next step tied to what they said they " +
      "are doing next. No emoji, no medical or health claims, no breathing science.",
    inputSchema: {
      type: "object",
      properties: {
        felt: {
          type: "string",
          enum: ["calmer", "same", "wired"],
          description: "How the user says they feel now, if they said.",
        },
        reflection: {
          type: "string",
          description: "The short closing note you wrote for them.",
        },
      },
    },
    annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
  },
];

/**
 * Pure JSON-RPC 2.0 dispatcher for stateless MCP Streamable HTTP (usable in
 * Cloudflare Workers or any Web Fetch runtime).
 */
export function handleMcpJsonRpc(message, widgetHtml) {
  if (!message || typeof message !== "object") {
    return {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Invalid Request" },
    };
  }

  const { id, method, params } = message;

  // Notifications have no id and expect no JSON-RPC response body (HTTP 202)
  if (id === undefined || id === null) {
    return null;
  }

  switch (method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: params?.protocolVersion || "2025-03-26",
          capabilities: {
            tools: {},
            resources: {},
          },
          serverInfo: {
            name: "brume",
            version: "0.0.1",
          },
        },
      };

    case "ping":
      return { jsonrpc: "2.0", id, result: {} };

    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: { tools: MCP_TOOLS },
      };

    case "tools/call": {
      const name = params?.name;
      const args = params?.arguments ?? {};
      if (name === "brume_reset") {
        return { jsonrpc: "2.0", id, result: runBrumeReset(args) };
      }
      if (name === "brume_complete") {
        return { jsonrpc: "2.0", id, result: runBrumeComplete(args) };
      }
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: `Unknown tool: ${String(name)}` },
      };
    }

    case "resources/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          resources: [
            {
              uri: WIDGET_URI,
              name: "brume-session-widget",
              title: "Brume session",
              description: "The live breathing view for a planned break.",
              mimeType: "text/html+skybridge",
            },
          ],
        },
      };

    case "resources/read": {
      const uri = params?.uri;
      if (uri !== WIDGET_URI) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: `Resource not found: ${String(uri)}` },
        };
      }
      return {
        jsonrpc: "2.0",
        id,
        result: {
          contents: [
            {
              uri: WIDGET_URI,
              mimeType: "text/html+skybridge",
              text: widgetHtml,
            },
          ],
        },
      };
    }

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${String(method)}` },
      };
  }
}
