// Cloudflare Worker entry for Brume MCP (`npx wrangler deploy`).
// Stateless Streamable HTTP endpoint supporting ChatGPT Apps SDK, Claude
// Desktop, and any MCP client over HTTPS. Zero persistence, zero external
// runtime dependencies.

import { handleMcpJsonRpc } from "./mcp-core.js";
import { WIDGET_HTML } from "./widget-bundle.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Mcp-Session-Id, Last-Event-ID",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return jsonResponse({ ok: true, name: "brume", version: "0.0.1" });
    }

    if (request.method === "GET" && url.pathname === "/widget") {
      return new Response(WIDGET_HTML, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    if (request.method === "DELETE") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
      return jsonResponse(
        {
          name: "brume-mcp",
          description:
            "Brume MCP endpoint — send JSON-RPC 2.0 POST requests here.",
        },
        405,
      );
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse(
        {
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error" },
        },
        400,
      );
    }

    if (Array.isArray(payload)) {
      const results = payload
        .map((msg) => handleMcpJsonRpc(msg, WIDGET_HTML))
        .filter((res) => res !== null);
      if (results.length === 0) {
        return new Response(null, { status: 202, headers: CORS_HEADERS });
      }
      return jsonResponse(results, 200);
    }

    const result = handleMcpJsonRpc(payload, WIDGET_HTML);
    if (result === null) {
      return new Response(null, { status: 202, headers: CORS_HEADERS });
    }

    return jsonResponse(result, 200);
  },
};
