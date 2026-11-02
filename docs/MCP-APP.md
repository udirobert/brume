# Brume as an MCP app (ChatGPT Apps SDK + GTransformer submission)

Status: spec (2026-11-02). Build window: Nov 13–15 (GTransformer), then
submit to the ChatGPT app directory.

## What it is

Brume exposed to any MCP host as **a quiet room agents can send people
into** — the AGENTIC.md decision in practice. Same contract as the Anna
Executa: the calling model writes the plan, the tool validates and renders
it, and a widget shows the live breathing session.

## Architecture

```
ChatGPT / MCP host
   └─ MCP server (this repo, `mcp/`, Node ESM, Streamable HTTP)
        ├─ tools:  brume_reset, brume_complete
        ├─ contract: anna/bundle/plan.js (imported — same file the Anna
        │   bundle and the Python executa share)
        └─ widget resource → https://brume.trustfall.xyz/embed/reset
             (new embed route in the web app, built during the window)
```

- **`brume_reset`** — args mirror `executas/brume/manifest.json`
  (`context`, `pattern`, `seconds`, `title`, `opening`, `cues`, `why`,
  `pace`, `remaining_seconds`, `cycles`). Server validates with
  `validateAgentPlan()`, fills gaps via `fallbackPlan()`, returns the
  pacing script + the widget URL carrying `pattern`/`seconds`.
- **`brume_complete`** — `felt` + `reflection`, returns a cleaned
  reflection. No server-side persistence in v1 (nothing to delete, nothing
  to leak — a Responsible-AI point).
- **`brume_get_ready`** — left out of v1; it's an Anna-specific flow. Add
  only if the demo story wants it.

## Hard constraints (shared with the whole product)

- No health/medical/biometric claims — cues describe rhythm only.
  `HEALTH_CLAIM_RE` and `CUE_FORBIDDEN_RE` in `plan.js` enforce this.
- No scores, streaks, camera, microphone, accounts.
- Nothing sent anywhere by default; check-in words stay on device.

## Status (2026-11-02)

- `mcp/` scaffold done and verified end-to-end: `initialize`,
  `tools/list`, `tools/call` for both tools over Streamable HTTP,
  including through a public HTTPS tunnel. 6 contract tests pass
  (`cd mcp && npm test`).
- Public dev endpoint: `cloudflared tunnel --url http://localhost:4619`
  quick tunnel in front of `node server.js` — free, no account, real
  streaming. Ephemeral URL each run; fine for dev-mode testing.
- GTransformer declined ($50 fee) — the MCP app is now the main track.

## Build list (free path)

1. ~~`mcp/` server~~ — done.
2. Test in ChatGPT developer mode via the quick tunnel (needs the owner's
   ChatGPT account; developer mode availability may depend on plan).
3. Web app `/embed/reset` route (optional polish — the widget is already
   self-contained): session orb driven by query params, no nav/chrome.
4. Permanent free hosting for submission: Cloudflare Workers free tier or
   a Netlify function (SSE buffering needs checking) — the quick tunnel
   can't be the submitted URL.
5. OpenAI app submission: verified developer + privacy policy; no auth /
   demo account needed.

## Open questions

- Permanent hosting for the MCP endpoint (Cloudflare Workers free tier is
  the best fit for a tiny stateless endpoint).
- Whether the widget embed needs `window.openai` bridge integration or a
  plain iframe suffices for v1.
