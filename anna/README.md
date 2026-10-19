# Brume — Anna App (Reset)

Anna App: `manifest.json` (schema 3) + static SPA in `bundle/` + a
chat-native Executa plugin in `executas/brume/` (bundled handle
`bundled:brume` in `required_executas` — `app.json` maps it to
`./executas/brume`, and publish resolves it to the platform `tool_id`
`tool-papa-brume-htcxvfcr`). Brume is AI-native: each break is *planned*
by the model — the user says what's next ("big call in 10 minutes") and
`llm.complete` (window) / `sampling/createMessage` (chat) picks one of
four patterns (cyclic sigh / long exhale / box / steady) and a length
(60–180 s), plus a title, opening line, in-session cues and a "why",
personalized by the user's own after-session ratings. After the break a
second model call writes the reflection note — both calls are what make
each run server-observable. Any failure falls back to a deterministic
plan. The window flow: Home → Planning → Plan → Session → Check-in →
Result, with chime (WebAudio) or voice (host `audio.speak`) phase cues,
mobile support (`form_factors`, haptics, safe-area), and `#brume reset`
in chat. Sessions write `reset/sessions/<ts>` + `reset/last` +
`reset/summary` (scope `user`). On
iframe completion (natural end or ended early with ≥1 active second) the
bundle:

1. calls `anna.llm.complete` — a short prompt built **only** from session
   facts (context, pattern name, active/planned seconds, cycles,
   interrupted flag, and the check-in `felt` value) asks the model for a
   ≤2-sentence reflection note, shown under the factual result. This is
   the server-observable step: per Anna forum staff, a `storage.set`
   alone does **not** count as a Qualified App Run, but a successful
   `llm.complete` producing the meaningful result can. The call is raced
   against a ~6 s timeout and never blocks the result; on
   denial/failure/timeout/no-SDK the fixed line "Take a moment before
   you begin again." is shown instead (a fallback-only run likely does
   not qualify).
2. writes a factual record (`{completedAt, context, pattern,
   plannedSeconds, activeSeconds, cycles, interrupted, felt, planSource,
   reflection, source}`) via `anna.storage.*` at `scope: "user"`, plus a
   read-modify-write `reset/summary` that feeds the plan prompt's
   "what has worked" line.

No camera, no getUserMedia, no external network calls. Chime tones are
synthesized locally (WebAudio); voice cues use host `audio.speak`
(inline delivery, decoded in memory — no URLs persisted).

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
  "llm.sample"]`, `required_executas: ["bundled:brume"]` (resolved to
  `tool-papa-brume-htcxvfcr` at publish via `app.json`
  `bundled_executas`),
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
