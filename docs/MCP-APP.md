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

## Build list for Nov 13–15

1. `mcp/` server: tool schemas + validation + widget resource (~done in
   scaffold; needs deployment URL).
2. Web app `/embed/reset` route: the session orb running headless from
   query params (`pattern`, `seconds`, `embed=1`); no nav, no chrome.
3. Test against ChatGPT developer mode (custom MCP app) or the MCPJam
   inspector.
4. Devpost submission: description ("who does this measurably help, and
   how?"), repo link, demo video, "built with", Responsible AI note —
   declare the pre-existing codebase honestly.
5. After the event: OpenAI app submission (verified developer, privacy
   policy, demo account not needed — no auth).

## Open questions

- Hosting for the MCP endpoint (Netlify function vs small always-on
  server; ChatGPT needs a public HTTPS URL).
- Whether the widget embed needs `window.openai` bridge integration or a
  plain iframe suffices for v1.
