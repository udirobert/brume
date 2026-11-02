# Brume as an MCP app

Status: local scaffold + shared-mascot widget verified (2026-11-02). Not
deployed, no permanent host, not submitted to the ChatGPT app directory.

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
        └─ widget resource ui://widget/brume-session.html
             (self-contained HTML built by mcp/widget.js: shared
              mascot engine + DOM adapter + mascot.css + brand tokens
              inlined at server startup, no remote assets)
```

- **`brume_reset`** — args mirror `executas/brume/manifest.json`
  (`context`, `pattern`, `seconds`, `title`, `opening`, `cues`, `why`,
  `pace`, `remaining_seconds`, `cycles`). Server validates with
  `validateAgentPlan()`, fills gaps via `fallbackPlan()`, returns the
  pacing script as `content` plus `structuredContent`
  (`phases`/`cycles`/`title`/`opening`/`cues`/`why`/`planSource`). The tool
  declares `_meta["openai/outputTemplate"]` → `WIDGET_URI` to select the
  widget resource.
- **Widget** — reads `window.openai.toolOutput`, runs the phases itself:
  phase word → mascot state (inhale/topup/hold/exhale/Rest→idle), breath
  progress eases continuously across each phase, `proud` on completion,
  `Again` restarts a single guarded loop, `pagehide` cancels
  timers/RAF/listeners and destroys the mascot, reduced-motion renders
  static expressions. The shared mist sprite replaces the old generic
  orb. A future web `/embed/reset` route remains optional polish — it is
  not the current architecture.
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

- `mcp/` scaffold verified end-to-end (earlier run): `initialize`,
  `tools/list`, `tools/call` for both tools over Streamable HTTP,
  including through a public HTTPS tunnel.
- Shared-mascot widget verified locally: 15 tests pass
  (`cd mcp && npm test`) — plan contract plus real jsdom execution of the
  embedded widget script (phases → mascot states → `proud`, single-loop
  `Again`, reduced-motion driver suppression, `pagehide` cleanup), and a
  live browser check.
- Public dev endpoint: `cloudflared tunnel --url http://localhost:4619`
  quick tunnel in front of `node server.js` — free, no account, real
  streaming. Ephemeral URL each run; fine for dev-mode testing.
- GTransformer declined ($50 fee) — the MCP app is now the main track.

## Build list (free path)

1. ~~`mcp/` server~~ — done.
2. ~~Shared mascot widget~~ — done (sprite replaces the orb; embedded
   engine/adapter/CSS inlined by `mcp/widget.js`).
3. Test in ChatGPT developer mode via the quick tunnel (needs the owner's
   ChatGPT account; developer mode availability may depend on plan) —
   the remaining end-to-end host integration check.
4. Web app `/embed/reset` route (optional polish — the widget is already
   self-contained): mascot sprite driven by `toolOutput`, no nav/chrome.
5. Permanent free hosting for submission: Cloudflare Workers free tier or
   a Netlify function (SSE buffering needs checking) — the quick tunnel
   can't be the submitted URL.
6. OpenAI app submission: verified developer + privacy policy; no auth /
   demo account needed.

## Open questions

- Permanent hosting for the MCP endpoint (Cloudflare Workers free tier is
  the best fit for a tiny stateless endpoint).
- End-to-end verification inside a real ChatGPT host session (the widget
  already consumes `window.openai.toolOutput`; the open question is host
  behaviour, not a missing bridge).
