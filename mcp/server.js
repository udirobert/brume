// Brume as an MCP app — see docs/MCP-APP.md.
// Same contract as the Anna Executa (anna/executas/brume): the calling
// model writes the plan, we validate it against anna/bundle/plan.js (the
// file all three implementations share), then return the pacing script
// plus a self-contained widget that runs the live session.

import http from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { ALLOWED_LENGTHS } from "../anna/bundle/plan.js";
import { WIDGET_URI, runBrumeReset, runBrumeComplete } from "./mcp-core.js";
import { WIDGET_HTML } from "./widget.js";

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
    async (args) => runBrumeReset(args),
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
    async (args) => runBrumeComplete(args),
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
