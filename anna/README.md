# Brume — Anna App (Reset)

Anna App: `manifest.json` (schema 3) + static SPA in `bundle/` + a
chat-native Executa plugin in `executas/brume/` (dev `tool_id`
`tool-dev-brume`, declared under `required_executas`). One camera-free
Reset breathing routine (~90 s, 4 s in / 6 s out × 9 cycles), offered
two ways: the iframe app below, and `#brume reset` in chat, where
`brume_reset` renders the guided break as verbatim `_display` blocks and
`brume_complete` writes the session record (`storage/set`, `scope:
"user"`, same `reset/...` namespace as the bundle) plus a
`sampling/createMessage` closing line — falling back to a fixed line
when sampling is unavailable. Abandoned chat runs write nothing. On
iframe completion (natural end or ended early with ≥1 active second) the
bundle:

1. calls `anna.llm.complete` — a short prompt built **only** from session
   facts (pattern name, active seconds, cycles, interrupted flag) asks the
   model for one calm closing line (≤15 words), which is shown under the
   factual result. This is the server-observable step: per Anna forum
   staff, a `storage.set` alone does **not** count as a Qualified App Run,
   but a successful `llm.complete` producing the meaningful result can.
   The call is raced against a ~4 s timeout and never blocks the result;
   on denial/failure/timeout/no-SDK the fixed line "Take a moment before
   you begin again." is shown instead (a fallback-only run likely does
   not qualify).
2. writes a factual record (`{pattern, activeSeconds, cycles,
   completedAt, interrupted}`) via `anna.storage.*` at `scope: "user"`.

No audio, no getUserMedia, no external network calls.

## Mid-session pacing (co-breathing)

- **Chat**: `brume_reset` accepts `pace` (`slow`/`normal`/`fast`) and
  `remaining_seconds`; a mid-break "slower" is a re-invocation covering
  the remainder — see `executas/brume/README.md`.
- **Bundle**: `Slower`/`Faster` buttons step through three tempo levels
  (0.8× / 1× / 1.25×). The SessionClock is untouched — a tempo factor
  stretches *pattern-time* (see `bundle/timing.js` tempo section), so a
  tempo change applies immediately while preserving the current phase
  and its progress fraction; the elapsed clock never jumps. Buttons are
  disabled while paused.

## Proactive offer skill

`skills/brume-reset-offer/SKILL.md` is a **Skill Executa**
(`execution_mode: "prompt"`) that teaches the agent when/how to *offer*
a reset — suggestion only, never auto-starts, dismissible, one offer per
session max. Per
[skill-publish](https://anna.partners/developers/skills/skill-publish)
a Skill is `executa_type="skill"` with the same draft → version →
visibility pipeline as a tool; the publish wizard returns a platform
`tool_id` like `skill-{author}-{slug}-{uniq}` that *can* then be copied
into the app manifest's `required_executas` / `optional_executas`
([app-bundling](https://anna.partners/developers/apps/app-bundling) —
bundling is a `tool_id` list, and `visibility: "app_bundled"` exists for
exactly this). It is **not declared in `manifest.json` yet** because the
`tool_id` must already exist in the Executa catalogue at
submission/publish and ours is unpublished — publish the skill first
(`POST /api/v1/executas/my/drafts` → commit → `visibility` → version),
then add its `skill-…` id, likely under `optional_executas` (suggestion
surface, not required for the app to function).

For local testing, point the skill loader at it:
`MATRIX_SKILLS_DIR=$PWD/skills` or copy the folder into
`<workspace>/skills/` per
[skill-local](https://anna.partners/developers/skills/skill-local).

Layout:

- `manifest.json` — schema 3, `host_capabilities: ["llm.complete",
  "llm.sample"]`, `required_executas: ["tool-dev-brume"]`,
  `ui.host_api.storage: ["get","set"]` + `ui.host_api.llm: ["complete"]`,
  structured `storage` declaration, `dev.mocks` stub
- `app.json` — listing metadata (name/tagline/description)
- `executas/brume/` — Python stdio Executa plugin (stdlib only; see its
  own README) + `sampling-fixture.jsonl` for `--mock-sampling`
- `bundle/index.html`, `app.css`, `app.js` — UI
- `bundle/timing.js` — monotonic active-time clock (port of
  `src/lib/utils/session-timing.ts` semantics) + tempo tracker
  (`createTempoTracker` / `setTempo` / `sampleSessionTimingWithTempo`)
- `skills/brume-reset-offer/SKILL.md` — proactive-offer Skill Executa
  (unpublished; see "Proactive offer skill" above)
- `bundle/session.js` — pattern definition, completion record, closing
  line (`buildClosingPrompt` / `fetchClosingLine` / `FALLBACK_CLOSING_LINE`)
- `test/smoke.mjs` — `mountBundle` smoke test (plain node, not vitest);
  covers the llm.complete call args plus denied/failure/timeout/no-SDK
  fallback paths
- `test/mock-llm.jsonl` — `--mock-llm` fixture for the local harness

Commands (Node 22+, `uv`, and `npm i -g @anna-ai/cli` required):

```bash
anna-app validate --strict
anna-app dev --no-llm                        # llm calls -> llm_disabled; fallback line shown
anna-app dev --mock-llm test/mock-llm.jsonl  # canned llm.complete; real result shape
npm install && npm test                      # smoke test against the mock host runtime
```

Note on local llm: `manifest.dev.mocks["llm.complete"]` is declared per
the schema but **not consumed by `@anna-ai/cli` 0.1.59** — llm calls are
intercepted by the JS `LlmBridge`, which only reads `--mock-llm` JSONL
fixtures (`{"ns":"llm","method":"complete","result":{…}}` per line; the
`match.contentIncludes` selector does not see inside `messages` arrays,
so the fixture uses an unconditional entry). Real `llm.complete` calls
need a Nexus login (`anna-app login --host <nexus-url>`); only in
production Anna does the call consume the signed-in user's quota and
become a server-side record.

Note: `anna/` has its own `package.json`/`package-lock.json` on purpose —
do not add its dependencies to the repo-root manifests.
