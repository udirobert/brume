# Brume — Anna App (Reset)

Bundle-only Anna App: `manifest.json` (schema 3) + static SPA in
`bundle/`. No executas. One camera-free Reset breathing routine (~90 s,
4 s in / 6 s out × 9 cycles). On completion (natural end or ended early
with ≥1 active second) the bundle:

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

Layout:

- `manifest.json` — schema 3, `host_capabilities: ["llm.complete"]`,
  `ui.host_api.storage: ["get","set"]` + `ui.host_api.llm: ["complete"]`,
  structured `storage` declaration, `dev.mocks` stub
- `app.json` — listing metadata (name/tagline/description)
- `bundle/index.html`, `app.css`, `app.js` — UI
- `bundle/timing.js` — monotonic active-time clock (port of
  `src/lib/utils/session-timing.ts` semantics)
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
