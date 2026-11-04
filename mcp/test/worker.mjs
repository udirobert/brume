import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";
import { WIDGET_URI } from "../mcp-core.js";

async function rpc(body) {
  const res = await worker.fetch(
    new Request("https://brume-mcp.example.com/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return {
    status: res.status,
    json: res.status === 200 ? await res.json() : null,
  };
}

test("worker answers /health and CORS preflight", async () => {
  const opt = await worker.fetch(
    new Request("https://brume-mcp.example.com/", { method: "OPTIONS" }),
  );
  assert.equal(opt.status, 204);
  assert.equal(opt.headers.get("Access-Control-Allow-Origin"), "*");

  const health = await worker.fetch(
    new Request("https://brume-mcp.example.com/health"),
  );
  assert.equal(health.status, 200);
  const body = await health.json();
  assert.equal(body.ok, true);
  assert.equal(body.name, "brume");
});

test("worker handles initialize, tools/list, tools/call and resources/read", async () => {
  const init = await rpc({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-03-26" },
  });
  assert.equal(init.status, 200);
  assert.equal(init.json.result.serverInfo.name, "brume");

  const list = await rpc({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
  });
  assert.equal(list.json.result.tools.length, 2);
  assert.equal(list.json.result.tools[0].name, "brume_reset");
  assert.equal(
    list.json.result.tools[0]._meta["openai/outputTemplate"],
    WIDGET_URI,
  );

  const resetCall = await rpc({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "brume_reset",
      arguments: {
        context: "before my 1-on-1",
        pattern: "cyclic-sigh",
        seconds: 90,
        title: "Before the 1-on-1",
        opening: "Take ninety seconds before you walk in.",
        cues: ["Drop your shoulders", "Unclench your jaw"],
        why: "A double inhale and long exhale fits a tense moment.",
      },
    },
  });
  assert.equal(
    resetCall.json.result.structuredContent.planSource,
    "agent",
  );
  assert.equal(
    resetCall.json.result.structuredContent.pattern,
    "cyclic-sigh",
  );

  const completeCall = await rpc({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "brume_complete",
      arguments: {
        felt: "calmer",
        reflection: "You took a moment. Open your notes for the 1-on-1.",
      },
    },
  });
  assert.equal(
    completeCall.json.result.structuredContent.felt,
    "calmer",
  );

  const resRead = await rpc({
    jsonrpc: "2.0",
    id: 5,
    method: "resources/read",
    params: { uri: WIDGET_URI },
  });
  assert.match(resRead.json.result.contents[0].text, /createMascot/);
});
