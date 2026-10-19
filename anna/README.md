# Brume — Anna App

Brume is a calm companion on Anna: a mist-sprite mascot that plans a short
breathing break for the moment you're in, walks you through a 3-minute
get-ready before a big conversation, and runs a 1-minute alertness check
against your own usual. Every run ends in an AI-written, specific result
(that is what makes it an Anna "Qualified App Run").

Current state (2026-10-19): app **0.3.1** published (not yet submitted for
review), bundled tool **0.4.2** (binaries in GitHub release
`brume-executa-v0.4.2`). App id 582, slug `brume`, tool id
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
  - `alertness.js` reaction-time metrics, baseline, bands, note prompt
  - `mascot.js` inline-SVG mist sprite, 12 states, breath-driven scale
  - `session.js` records, storage, prefs, `llm.complete` wrappers
  - `timing.js` monotonic active-time clock + tempo (pause never accrues)
  - `audio.js` WebAudio chime + `audio.speak` voice cues (decoded in memory)
- `executas/brume/` — Python stdio Executa (stdlib only), see its README.
  `manifest.json` there is the exported `describe` output (the platform
  syncs it as the protocol manifest; a test enforces equality).
- `test/smoke.mjs` (node, `mountBundle`) + `test/plan-cases.json` (shared
  fixture, also read by `executas/brume/test_plan.py`).
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
2. **Get ready** — event + kind + optional key point → AI drafts opener,
   key point, reminder → Breathe (7 guided cyclic sighs) → Open up →
   Warm up your voice (hum) → Rehearse → Done.
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
`reset/summary`, `ready/sessions/<ts>`, `alert/checks/<ts>`,
`alert/summary`, `brume/prefs`.

Copy rules: no health/medical/hormone claims, no scores, streaks or guilt,
no camera or microphone. `HEALTH_CLAIM_RE` + `CUE_FORBIDDEN_RE` back this
up in code for every model-written field.

## Testing — cheapest first

Anna quota is shared between local real-LLM runs and Cloud Agent chats, and
long chat threads are expensive. Use the tiers in order.

**Tier 1 — free, every change**

```bash
npm install && npm test                        # node smoke + shared fixture
(cd executas/brume && python3 -m unittest test_plan)
anna-app validate --strict
```

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
  (gitignored), set `FEATHERLESS_API_KEY`, then
  `node scripts/prompt-check.mjs [plan|reflection|alertness|all]`. Uses the
  real prompt builders and validators; default model
  `deepseek-ai/DeepSeek-V3-0324` (Meta Llama models on Featherless are
  gated behind Hugging Face access). A proxy only: Anna's production model
  (Gemini 3 Flash at time of writing) may behave differently.
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
