# Brume — Anna App

Brume is a calm companion on Anna: a mist-sprite mascot that prepares you
for the conversation ahead (editable talking points plus one optional
practice turn), plans a short breathing break for the moment you're in,
and runs a 1-minute alertness check against your own usual. AI
preparation is the primary function; basic fallback breathing remains
available. Anna determines whether a run qualifies for its program.
Unfinished tasks checkpoint to user storage and resume on reopen.

Current state (2026-10-22): app **0.3.2** rejected on review
(AI-native core + task recovery), local rework candidate verified and
unpublished; bundled tool **0.4.4** (binaries in GitHub release
`brume-executa-v0.4.4`). Listing logo, cover and 5 screenshots set in the
Developer Console (images served from `anna/listing/` on GitHub). App id 582, slug `brume`, tool id
`tool-papa-brume-htcxvfcr`. Product context and the full progress log:
[`docs/ANNA.md`](../docs/ANNA.md) §12.

## Layout

- `app.json` — listing (name, tagline, long description, `version`) and
  `bundled_executas: {"brume": {"path": "./executas/brume"}}`.
- `manifest.json` — schema 3. `required_executas: bundled:brume` (resolved to
  the real tool id at publish), `ui.form_factors: ["desktop","mobile"]`,
  `ui.host_api`: storage get/set/list, llm complete/catalog, audio speak,
  mobile haptics, window set_title. Top-level `host_capabilities:
  ["llm.complete"]`. `system_prompt_addendum` tells Anna's model how to
  call the tools and `open_app_view` (app_id 582, payload
  `{context, mode: reset|ready|alertness, key_point}`).
- `bundle/` — static SPA (no build step):
  - `app.js` screens and flows; `index.html`, `app.css`
  - `plan.js` pattern library, prompts, parsing/validation, health-claim
    and cue filters, cycle snapping, summary/personalization (mirrored 1:1
    in the Python plugin — keep them in sync)
  - `preparation-prompts.js` + `preparation.js` conversation-preparation
    prompts and strict parse/request helpers
  - `recovery.js` active-task checkpoint store (`brume/active-task`,
    versioned envelope, serialized/coalesced writes, corrupt-safe load)
  - `alertness.js` reaction-time metrics, baseline, bands, note prompt
  - `mascot.js` inline-SVG mist sprite, 12 states, breath-driven scale
  - `session.js` records, storage, prefs, `llm.complete` wrappers
  - `timing.js` monotonic active-time clock + tempo (pause never accrues)
  - `audio.js` WebAudio chime + `audio.speak` voice cues (decoded in memory)
- `executas/brume/` — Python stdio Executa (stdlib only), see its README.
  `manifest.json` there is the exported `describe` output (the platform
  syncs it as the protocol manifest; a test enforces equality).
- `test/smoke.mjs` (node, `mountBundle`), `test/preparation.mjs` +
  `test/recovery.mjs` (node:test unit tests), `test/plan-cases.json`
  (shared fixture, also read by `executas/brume/test_plan.py`), and
  `test/fake-host-server.mjs` + `test/fake-sdk.js` (test-only host with
  scripted llm replies + persistent KV for browser QA).
- `scripts/prompt-check.mjs` — real-LLM prompt check via Featherless.
- `listing/` — store screenshots, cover, logo (**stale: pre-mascot**).

## The three flows

1. **Breathing break** — Home → Planning (`llm.complete` plans pattern +
   length + title/opening/cues/why, personalized by past check-ins) → Plan
   (override pattern/length/sound) → Session (mascot breathes, phase word,
   cues, Slower/Faster, Pause/End) → Check-in (Calmer / Same / Still wired)
   → Result (AI reflection + next step). Sessions snap to whole cycles.
   Patterns: cyclic sigh 2/1/6, long exhale 4/6, box 4-4-4-4, steady
   5.5/5.5; lengths 60/90/120/180 s.
2. **Prepare a conversation** — event + goal + key point + kind → AI
   drafts opening/keyPoint/approach/objection/response/nextStep (one
   clarify question max) → editable wording and hypothetical pushback → optional one-turn
   rehearsal ("Get one adjustment") → saved card (`ready/sessions/<ts>`,
   `ready/last`). Optional guided pause reuses the timed steps
   (breathe → open up → hum → rehearse) and returns to the plan.
3. **Alertness check** — sleepiness 1–9 (Karolinska) → 60 s
   reaction-time test (ISI 1.5–4 s, false start <100 ms, lapse ≥500 ms) →
   median, lapses, band vs own baseline (needs 3 checks, same input type)
   → AI note with a fitting next step. "Not a medical test."

Chat (`#brume …`): `brume_reset`, `brume_complete`, `brume_get_ready`.
**Anna's own model writes the plan, reflection and get-ready text as tool
arguments**; the tool validates and filters them, renders verbatim
`_display` blocks, and writes records. The tool has no sampling
capability on purpose (see "Platform gotchas").

Storage (all `scope: "user"`): `reset/sessions/<ts>`, `reset/last`,
`reset/summary`, `ready/sessions/<ts>`, `ready/last`, `alert/checks/<ts>`,
`alert/summary`, `brume/prefs`, `brume/active-task` (single unfinished-
task checkpoint; tombstoned via `set` null, never auto-erased when
corrupt).

Copy rules: no health/medical/hormone claims, no scores, streaks or guilt,
no camera or microphone. `HEALTH_CLAIM_RE` + `CUE_FORBIDDEN_RE` back this
up in code for every model-written field.

## Testing — cheapest first

Anna quota is shared between local real-LLM runs and Cloud Agent chats, and
long chat threads are expensive. Use the tiers in order.

**Tier 1 — free, every change**

```bash
npm install && npm test && npm run test:browser                        # node smoke + shared fixture + preparation/recovery unit tests
(cd executas/brume && python3 -m unittest test_plan)
anna-app validate --strict
```

Browser QA without quota: `node test/fake-host-server.mjs` serves the
bundle with a scripted fake host (`/__script`, `/__kv`, `/__dump`); drive
it with agent-browser. Current state: implemented locally, not yet
published or tested on Anna Cloud Agents.

Binary build + protocol smoke (also runs in CI on all 4 platforms):

```bash
cd executas/brume && uv venv /tmp/brume-venv && uv pip install --python /tmp/brume-venv pyinstaller
/tmp/brume-venv/bin/pyinstaller --onefile --name brume --clean brume_plugin.py
python3 scripts/smoke_binary.py dist/brume <version>
```

(get_ready/complete wait ~20 s in the smoke because nothing answers the
storage reverse-RPC; a fake-host harness that answers it is a TODO.)

**Tier 2 — cheap, only when a prompt changes**

- UI/layout: `anna-app dev --mock-llm test/mock-llm.jsonl` (no quota).
- Prompt quality without Anna quota: copy `.env.example` to `.env.local`
  (gitignored), set `GEMINI_API_KEY`, then
  `node scripts/prompt-check.mjs [plan|reflection|alertness|all]`. Uses the
  real prompt builders and validators against `gemini-3-flash-preview` —
  the model Anna showed as the default — at Anna's default temperature
  (0.7). Apps can't pin the production model: `llm.complete` runs on the
  user's chosen model and `modelPreferences` only breaks ties among models
  the user enabled, so prompts must stay robust across models. The script
  flags truncated/empty answers (`finish_reason=length`), which matters for
  thinking models at our small `maxTokens`. Featherless
  (`FEATHERLESS_API_KEY`) is a fallback proxy only; its Chat plan forbids
  automated/benchmark traffic.
- `anna-app dev` with a logged-in account uses real Anna models and
  **consumes account quota** — small batches only.

**Tier 3 — Anna Cloud Agent, once per release candidate**

Fixed checklist, each step in a NEW chat (context size drives cost):

1. Developer Console → Install vX; wait for "Deploying bundled tools…" to
   finish, then confirm the tool is callable (chat shows
   `tool_papa_brume_htcxvfcr__brume_reset`, not `exec_run`).
2. `#brume quick reset, call in 10 minutes` → `planSource: "agent"`, cues
   posture-only.
3. `done, feeling calmer` → `reflectionSource: "agent"`, record written.
4. `#brume get me ready: <event>. The one thing: <point>` → opener and key
   point present in the Rehearse block.
5. Ask to open the get-ready in the app → no permission gate, event and
   key point prefilled.
6. One window alertness check → AI note (not the fallback line).

Consider BYOK in Anna for test traffic so it doesn't burn credits.

## Release

1. Bump the plugin version in `executa.json`, `pyproject.toml` and
   `VERSION`; regenerate `executas/brume/manifest.json` from `describe`.
2. Push to `main`, run the **Brume Executa Binaries** workflow
   (`.github/workflows/brume-executa-binaries.yml`) — builds darwin-arm64,
   darwin-x86_64 (macos-15-intel), linux-x86_64 (ubuntu-22.04),
   windows-x86_64, smokes each, publishes release
   `brume-executa-v<version>`.
3. Download the four archives into `executas/brume/dist/` (gitignored; the
   paths must match `distribution.binary_artifacts`), verify `.sha256`.
4. From `anna/`: `anna-app apps publish --bump patch` (uploads binaries,
   syncs the protocol manifest, cuts an immutable app version; does NOT
   submit for review). Then update `app.json` `version` to match.
5. Tier-3 checklist, then submit for review in the Developer Console.

## Platform gotchas (learned the hard way)

- **No binaries = broken tool on Cloud Agents.** A Python executa needs
  `distribution.binary_artifacts` for all four platforms; the Cloud Agent
  is Linux x86_64. (Cause of the first rejection.)
- **Executa `llm.sample` is OFF after install** and the chat path never
  prompts for it — sampling silently fails. Hence: the calling model
  writes the AI text as tool args; the tool declares no sampling.
- Declaring a tool capability the user must grant also adds an "Allow all &
  open" gate in front of `open_app_view`, and the window opened from that
  gate **drops the payload**.
- **Storage declarations must match**: the tool's `aps.*` capabilities
  must normalize to the app manifest's `storage` block
  (`aps.kv` + `aps.scope.user.read` + `aps.scope.user.write` ⇔
  `scopes: {user: "rw"}`), or publish fails with "storage declaration
  drift". Dry-run does not catch this; only the real publish does.
- Without `executas/brume/manifest.json`, host capabilities aren't
  grantable in the permissions UI until an agent backfills them.
- After installing a new version, the tool can be missing from the agent
  for minutes (seen with 0.3.1 — still unexplained); the model then
  improvises (`exec_run brume_get_ready …`). Check before testing.
- `version` lives in `app.json`, not `manifest.json` (schema rejects it);
  `--bump` doesn't write it back.
- `anna-app dev` denies `audio.*`/`mobile.*` locally; voice and haptics
  can only be checked in production.
- `--mock-llm` fixtures are unconditional (no sequencing/matching inside
  `messages`).
- `gh`: the active account may be `sneldao`; pushes to udirobert/brume use
  `gh auth token --user udirobert`.

## Open items

- Diagnose the tool missing after the 0.3.1 install (needs quota/BYOK).
- Voice cues and phone haptics: verify on a real device.
- Harden `cleanReflection`/`clean_reflection` against models appending
  "(19 words)", "(Word count: …)" or "Alternative…" notes (seen on
  DeepSeek via prompt-check; not seen on Anna's model yet).
- Regenerate `listing/` assets with the mascot; upload logo/cover/
  screenshots in the Developer Console.
- Fake-host harness for the binary smoke (answer storage reverse-RPCs).
- Submit for review after a clean tier-3 run.

Note: `anna/` has its own `package.json`/`package-lock.json` on purpose —
do not add its dependencies to the repo-root manifests.

### Listing candidate images

`listing/candidate/*.png` are mock screenshots captured from a fake-host
run with synthetic scenario data — they demonstrate the UI, not model
quality or review QA. This build is a local candidate, not published.

### Brand and first use

`bundle/brand.css` is the shared source for the web and Anna colours and
bundled Manrope font. The green mascot remains the same character.
Moment buttons only prefill context; they never select canned advice or
start a model request. The goal and optional `preserve` boundary are
included in preparation and rehearsal requests.

The startup shell renders before the host connects. Connection and active-task
reads have separate eight-second timeouts; a failed read blocks new tasks
until retry or an explicit decision about an unreadable checkpoint. Optional
history and preference reads run after task recovery, without blocking it.
No model calls are made to warm up the app.

The optional `ready/preferences` record stores only an explicitly remembered
wording style. Removing it writes null. A preference applies to new
preparations, not existing drafts. Old task checkpoints remain compatible.

An entry payload with `mode: "ready"` may include `context`, `goal`,
`key_point`, `preserve` and an optional six-field `preparation` object
with `kind: "plan"`. A valid draft opens for review without another model
call; an invalid draft leaves the input available for the user to prepare.
Existing unfinished tasks still require an explicit keep/replace decision.

Run `npm run test:browser` for fake-host regressions.
`node test/capture-listing.mjs` generates candidate images using a separate
local fake host and synthetic examples, then closes its browser session.
`node scripts/preparation-check.mjs --dry-run` makes no model calls;
`--live` needs explicit spend approval and manual review of the output.
