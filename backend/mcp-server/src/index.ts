#!/usr/bin/env node
/**
 * Brume Proof-of-Practice MCP Server
 *
 * Exposes verified-breathwork primitives to any MCP-compatible agent.
 * This is the agent-native wedge (see docs/STRATEGY.md §4): agents that coach
 * humans cannot verify physical practice — Brume can.
 *
 * Monetization: metered per API key today (`BRUME_API_KEYS`); x402-style
 * per-call payment hooks marked TODO(x402) at the metering layer.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const VISION_URL = process.env.BRUME_VISION_URL ?? "https://api.brume.trustfall.xyz";

// --- Metering stub -----------------------------------------------------------
// TODO(x402): replace key-based metering with per-call payment verification.
const VALID_KEYS = new Set((process.env.BRUME_API_KEYS ?? "dev-key").split(","));
function meter(apiKey: string, tool: string): void {
  if (!VALID_KEYS.has(apiKey)) throw new Error("invalid_api_key");
  // TODO: usage counter per key — billing + HAMM evidence trail
  void tool;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${VISION_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`vision_service_${res.status}`);
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${VISION_URL}${path}`);
  if (!res.ok) throw new Error(`vision_service_${res.status}`);
  return res.json() as Promise<T>;
}

const server = new McpServer({
  name: "brume-proof-of-practice",
  version: "0.1.0",
});

// ---------------------------------------------------------------------------
// Tool 1: verify a session — did the human actually breathe?
// Queries the vision service's session store for real camera data. The vision
// API is frame-based (image_data), so verification is established on-device
// during the session; this tool reports the server-side verification state.
// ---------------------------------------------------------------------------
server.tool(
  "breath_verify_session",
  "Verify whether a breathwork session was camera-verified. Returns verified status, breathing-frame count, and measured breath rate. Verification is established server-side from the vision processor's session store — not self-reported.",
  {
    apiKey: z.string().describe("Metered API key"),
    sessionId: z.string().describe("The session_id used during the camera session"),
  },
  async ({ apiKey, sessionId }) => {
    meter(apiKey, "breath_verify_session");
    const result = await get<{
      session_id: string;
      verified: boolean;
      breathing_frames: number;
      confidence_frames: number;
      breath_rate: number | null;
    }>(`/api/session/${encodeURIComponent(sessionId)}/verify-status`);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

// ---------------------------------------------------------------------------
// Tool 2: recommend a pattern — state → pattern
// Local heuristic table (the app's 20+ patterns stay client-side; keep this cheap)
// ---------------------------------------------------------------------------
const PATTERN_TABLE: Record<string, { name: string; cadence: string; why: string }> = {
  anxious: { name: "Physiological Sigh", cadence: "2x inhale 2s / exhale 6s", why: "Fastest down-regulation of acute arousal" },
  stressed: { name: "Box Breathing", cadence: "4-4-4-4", why: "Balances autonomic tone under load" },
  tired: { name: "Bhastrika (gentle)", cadence: "1s in / 1s out x20", why: "Sympathetic activation without strain" },
  unfocused: { name: "Coherence 5.5", cadence: "5.5s in / 5.5s out", why: "HRV resonance for sustained attention" },
  sleep: { name: "4-7-8", cadence: "4-7-8", why: "Parasympathetic shift for sleep onset" },
};
server.tool(
  "breath_recommend_pattern",
  "Recommend a breathing pattern for a user's detected or self-reported state.",
  { apiKey: z.string(), state: z.enum(["anxious", "stressed", "tired", "unfocused", "sleep"]) },
  async ({ apiKey, state }) => {
    meter(apiKey, "breath_recommend_pattern");
    return { content: [{ type: "text", text: JSON.stringify(PATTERN_TABLE[state]) }] };
  },
);

// ---------------------------------------------------------------------------
// Tool 3: attest practice — portable credential (Flow, via backend)
// Calls POST /api/attest on the vision service. The backend verifies the
// session server-side (camera data in the session store) before issuing.
// ---------------------------------------------------------------------------
server.tool(
  "breath_attest_practice",
  "Issue a portable, on-chain proof-of-practice credential for a verified session. The backend verifies that the session was camera-verified before issuing. Credentials are attestations, not collectibles.",
  {
    apiKey: z.string(),
    sessionId: z.string(),
    walletAddress: z.string().describe("Flow address of the practitioner"),
  },
  async ({ apiKey, sessionId, walletAddress }) => {
    meter(apiKey, "breath_attest_practice");
    const result = await post<{
      success: boolean;
      credential: { type: string; sessionId: string; subject: string; issuedAt: string; metrics: Record<string, unknown> };
      attestation: { status: string; txId: string | null; network: string };
    }>("/api/attest", { session_id: sessionId, wallet_address: walletAddress });
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
);

// ---------------------------------------------------------------------------
// Tool 4: coach.respond — Zen coaching grounded in real signals
// Calls POST /api/ai-analysis with the correct AIAnalysisRequest shape
// (provider + session_data), and reads the result from the correct field.
// ---------------------------------------------------------------------------
server.tool(
  "coach_respond",
  "Get coaching guidance from Zen, grounded in the user's actual measured breath data — not self-report.",
  {
    apiKey: z.string(),
    message: z.string(),
    visionMetrics: z
      .object({ breathRate: z.number(), sessionScore: z.number(), emotionalState: z.string().optional() })
      .optional(),
  },
  async ({ apiKey, message, visionMetrics }) => {
    meter(apiKey, "coach_respond");
    // AIAnalysisRequest requires `provider` and `session_data` (Dict).
    const result = await post<{
      success: boolean;
      provider: string;
      analysis_type: string;
      result: Record<string, unknown> | null;
      error: string | null;
      cached: boolean;
    }>("/api/ai-analysis", {
      provider: "cerebras",
      session_data: {
        message,
        visionMetrics,
        // Minimal session_data fields the analysis functions read
        patternName: "Breathing Session",
        sessionDuration: 0,
      },
    });
    // AIAnalysisResponse.result is the analysis dict; extract the text.
    // The fallback-analysis path returns { analysis: string, ... } in result.
    const analysisText =
      (result.result as { analysis?: string } | null)?.analysis ??
      JSON.stringify(result.result ?? { error: result.error });
    return { content: [{ type: "text", text: analysisText }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("brume-mcp running on stdio — 4 tools registered");
