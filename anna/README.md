# Brume — Anna App

Brume's declared primary function on Anna is conversation preparation.
The meaningful result is a saved card: Anna's model drafts the opening,
key point, approach, one hypothetical pushback, response, and next step;
the user edits them and may rehearse once. Breathing, Arrive, and the
one-minute alertness check stay in the app, behind a quiet control or an
explicit request. They are not the result a review or a qualified run
should treat as the product. A basic breathing plan remains available
when the model is down. Unfinished tasks checkpoint to user storage and
resume on reopen.

Published review pin (2026-11-07): **v0.4.2** (version_id=1994, cut by
`anna-app apps publish --bump patch` and re-pinned with
`apps submit-review`; tool frozen at 0.4.5/executa_version 1012,
reset-offer skill at 767). That pin is the review-feedback release plus
**Arrive**: a feeling ring proposes exactly one small act — Scatter or
Set it down — and the model writes only the invitation line. v0.4.2
rebuilds both acts (`docs/ANNA.md` §12.25).

Local source (2026-11-13), **not published**: the preparation card is
the primary result, and it is produced in chat as well as in the window.
The chat tool asks the person for every fact a draft would state — the
value is masked in the question — and saves the card from their answers,
so no model-written prose is ever the card's oracle (`docs/ANNA.md`
§12.31). A draft may not add a count, a weekday, or a clock time the
person did not write (§12.26). Source tool version is **0.4.9**, app
**0.4.7**. The published binaries are still **0.4.5**
(GitHub release `brume-executa-v0.4.5`; the darwin-arm64 matrix leg
moved to macos-15 after GitHub retired macos-14). Run the Brume Executa
Binaries workflow, download the four archives, and pass the
three-projects Cloud Agent case before the next `apps publish`. App id
582, slug `brume`, tool id `tool-papa-brume-htcxvfcr`. Product context
and the full progress log: [`docs/ANNA.md`](../docs/ANNA.md) §12.

## Layout

- `app.json` — listing (name, tagline, long description, `version`) and
  `bundled_executas: {"brume": {"path": "./executas/brume"}}`.
- `manifest.json` — schema 3. `required_executas: bundled:brume` (resolved to
  the real tool id at publish), `ui.form_factors: ["desktop","mobile"]`,
  `ui.host_api`: storage get/set/list, llm complete/catalog, audio speak,
  mobile haptics, window set_title. Top-level `host_capabilities:
  ["llm.complete"]`. `system_prompt_addendum` tells Anna's model how to
  call the tools and `open_app_view` (app_id 582, payload
  `{context, mode: reset|ready|alertness|arrive, key_point}`; arrive also
  takes `feeling`).
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
  - `mascot-engine.js` + `mascot-engine.d.ts` — frozen `BRUME_AVATAR`
    geometry, `validateAvatar`, pure `sampleMascot` (all motion)
  - `mascot.js` + `mascot.d.ts` — single DOM adapter (`createMascot`)
    rendering engine frames; shared with the web app and MCP widget
  - `mascot.css` — mascot paint only, `@import`ed by `app.css` (and the
    web's `src/components/BrumeMascot.css`, inlined by `mcp/widget.js`)
  - `session.js` records, storage, prefs, `llm.complete` wrappers
  - `timing.js` monotonic active-time clock + tempo (pause never accrues)
  - `audio.js` WebAudio chime + `audio.speak` voice cues (decoded in memory)
- `executas/brume/` — Python stdio Executa (stdlib only), see its README.
  `manifest.json` there is the exported `describe` output (the platform
  syncs it as the protocol manifest; a test enforces equality).
- `test/smoke.mjs` (node, `mountBundle`), `test/preparation.mjs` +
  `test/recovery.mjs` + `test/session-storage.mjs` + `test/experience.mjs`
  + `test/mascot.mjs` (node:test unit tests), `test/plan-cases.json`
  (shared fixture, also read by `executas/brume/test_plan.py`), and
  `test/fake-host-server.mjs` + `test/fake-sdk.js` (test-only host with
  scripted llm replies + persistent KV for browser QA).
- `scripts/prompt-check.mjs` — real-LLM prompt check via Featherless.
- `listing/` — store screenshots, cover, logo; `listing/candidate/`
  contains the 2026-10-22 fixtures and needs regeneration for the shared
  mascot before the next release.

## Shared mascot

One contract, three consumers (Anna bundle, web app, MCP widget):

- `mascot-engine.js` — `BRUME_AVATAR` (frozen version:1 geometry: body
  primitives, highlight, eyes, four mouth paths), `validateAvatar`
  (strict keys, in-viewBox bounds, safe path-data mouths), and
  `sampleMascot(t, opts)`: a pure function returning the complete frame —
  eyes/lids, mouth, body scale, and every accessory value (halo, arms,
  wisps, waves, swirl, topup puff) plus a `pose` used for 0.5 s
  easeOutQuint blends between states (mouths morph via `blendPath`).
  Deterministic blink schedule in every state except `hold`/`sleepy`,
  gaze drift + per-state look offsets, a gentle root bob (halved while
  breath-driven), `breathAmount` easing, one-shot `reaction`s
  (`hop`/`settle`/`celebrate`), companion sleepy-slit fade, reduced
  motion = static expression.
- `mascot.js` — `createMascot(host, opts)` returns
  `{setState, setBreath, setOptions, react, renderAt, destroy}`. Owns the RAF
  clock, reduced-motion media changes, hidden/offscreen suspension and
  companion pointer tracking. `renderAt(t, overrides)` samples a fixed
  time for deterministic frames; `autoAnimate:false` for externally
  driven clocks.
- `mascot.css` — paint/structure only (no keyframes); colours via
  `--brume-mascot-*` tokens in `brand.css` so the sprite follows daypart
  retunes.

## The flows

1. **Prepare a conversation (primary)** — a fresh open lands here. Event +
   goal + key point + kind. If a deadline is in the same week and no day
   or clock time was given, one question asks which day to name; skip
   leaves the next step unscheduled, and that question uses the only
   clarify slot. The model then drafts
   opening/keyPoint/approach/objection/response/nextStep. Counts, weekdays,
   and clock times must already be in the person's text: a failing line is
   blanked (the pushback becomes "What makes this hard?"), the message
   names the field, and the sprite looks at it. A kept fact is marked
   "From what you wrote." Optional one-turn rehearsal ("Get one
   adjustment") is shown only when the note quotes the reply. The saved
   card (`ready/sessions/<ts>`, `ready/last`) leads with one sayable
   paragraph — opening, key point, next step — and says it was drafted
   for this conversation. Optional guided pause reuses the timed steps
   (breathe → open up → hum → rehearse) and returns to the plan.
2. **Breathing break (optional)** — behind "Or take a breathing break" on
   Home → Planning (`llm.complete` plans pattern + length + title/opening/cues/why,
   personalized by past check-ins) → Plan (override pattern/length/sound) →
   Session → Check-in → Result. Sessions snap to whole cycles. Patterns:
   cyclic sigh 2/1/6, long exhale 4/6, box 4-4-4-4, steady 5.5/5.5; lengths
   60/90/120/180 s. Quick reset skips planning and is labelled as such.
3. **Arrive and alertness (optional)** — both live under "Something other
   than the conversation". Arrive maps one closed-set feeling to Scatter
   or Set it down; the model writes only the invitation, and nothing is
   saved. Alertness is a 1–9 sleepiness rating plus a 60 s reaction-time
   check against the person's own baseline. The home control does not
   chart those times. The check screen says it is not a medical test.

Chat (`#brume …`): `brume_prepare` is Brume's primary result and it is
produced in chat. It is called in two steps. Step 1 takes `situation`
(the model's relay of what the user said) plus optional `goal`,
`key_point`, `preserve`, and the model's own draft of the card
(`draft_opening`, `draft_key_point`, `draft_approach`,
`draft_objection`, `draft_response`, `draft_next_step`). It answers
`needs_input` with one question per fact the draft would assert — the
value is masked, so the person states it — plus a question about which
day to name when a same-week deadline has none. Step 2 takes
`request_id` and `answers`: the model's values are replaced by the
person's, the card is saved (`ready/sessions/<ts>`, `ready/last`) and
returned in `_display` blocks. **No tool argument is ever the oracle for
a card's fact**: the protocol offers no transcript to check model prose
against, so every fact in a chat-saved card is a value the person
stated. `brume_reset` and `brume_complete` are the optional breathing
break.

In the window, Anna's reading of a chat message is shown as a
*suggestion*, never as the source: the person writes the situation
themselves, so the card's facts are grounded in their words, and the card
always quotes the situation it was prepared from. The window's draft is
checked against the submitted source; the chat path's draft is checked
against the person's answers. **Anna's own model writes the plan, the
draft and the reflection as tool arguments**; the tool validates and
filters them, renders verbatim
`_display` blocks, and writes records. The tool has no sampling
capability on purpose (see "Platform gotchas").

Storage (all `scope: "user"`): `reset/sessions/<ts>`, `reset/last`,
`reset/summary`, `ready/sessions/<ts>`, `ready/last`, `ready/prepare/<id>`
(the chat path's pending request, waiting for the person's answers),
`alert/checks/<ts>`,
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
node --test test/mascot.mjs                                            # focused mascot engine tests
(cd .. && pnpm vitest run src/components/__tests__/BrumeMascot.test.tsx) # adapter + React wrapper
(cd ../mcp && npm test)                                                # MCP contract + widget tests
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

(complete waits ~20 s in the smoke because nothing answers the
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
2. Fresh install, one new chat, this sentence and nothing else:
   "I manage 3 projects and I added one deadline in the same week."
   `brume_prepare` must return `needs_input` — the tool asks the person
   for every fact the draft would state, with the value hidden, and for
   which day to name. Answer each question; call `brume_prepare` again
   with `request_id` and `answers`; the tool saves the card and returns
   it. The card must not say 4, four, Friday, or a clock time unless
   the person said it, and the saved card must appear under
   `ready/last`. This is the reviewer's case — it has to pass before any
   other chat.
3. Same scenario, asked in chat instead ("put the card in chat"): the
   model calls `brume_prepare` and the card is saved and shown in chat.
4. `#brume quick reset, call in 10 minutes` → `planSource: "agent"`, cues
   posture-only.
5. `done, feeling calmer` → `reflectionSource: "agent"`, record written.
6. Ask to open the preparation in the app → no permission gate; Anna's
   reading appears as a suggestion and Prepare stays off until the
   person writes the situation.
7. One window alertness check → AI note (not the fallback line).

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
  improvises (`exec_run brume_reset …`). Check before testing.
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

An entry payload with `mode: "arrive"` opens the feeling ring; an optional
`feeling` (id or label, closed set) pre-selects it and shows the matched
act card. Anna's model is told it may offer this when a user names a
feeling and wants a small physical act rather than conversation.

Run `npm run test:browser` for fake-host regressions.
`node test/capture-listing.mjs` generates candidate images using a separate
local fake host and synthetic examples, then closes its browser session.
`node scripts/preparation-check.mjs --dry-run` makes no model calls;
`--live` needs explicit spend approval and manual review of the output.
