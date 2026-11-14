# Brume on Anna: Product and Adoption Plan

> **Status (2026-10-19):** sections 1-11 are the original 2026-10-17 plan
> and are partly superseded. What shipped since, what we learned on the
> real Cloud Agent, and current open items are in
> [§12 Progress log and learnings](#12-progress-log-and-learnings-2026-10-19).
> Operational detail (layout, testing tiers, release steps, platform
> gotchas) lives in [`anna/README.md`](../anna/README.md).

## 1. Vision

**A breathing break between thinking and doing.** One quiet utility people
reach for at recurring moments - before a difficult task, between tasks or
meetings, after work - not a wellness dashboard.

Initial audience hypothesis: Anna users who are working, creating, or
deciding. This is an acquisition wedge, not a restriction on eventual
users. Brume is non-clinical: no stress diagnosis, no validated
physiology score.

## 2. Program context (superseded — verified rules in §12.1)

Sourced only from the user's announcement, not confirmed platform terms:

- Approved, published Marketplace Apps run inside Anna with a user-facing
  UI and working backend execution, providing independent functionality.
- **Qualified App MAU**: unique signed-in Anna users who successfully
  execute the app's primary function and receive a meaningful, nontrivial
  result in a calendar month. Viewing, installation, failed runs, bots,
  self-run farms, and artificial usage are excluded.
- The announcement cites a threshold of 200 qualified MAU and a
  qualification window of Sep-Nov 2026.
- Earlier notes about financial tiers and an October builder dedup claim
  are **unverified**. This plan contains no exact tier table and no
  revenue projection.
- The prior August beta tasks in older notes are obsolete planning.
  Updated review deadline, eligibility, and availability require official
  confirmation - this document does not promise a grant.

Primary links (not live-verified):

- https://forum.anna.partners/t/turn-your-ai-agents-apps-into-recurring-monthly-grants-join-the-anna-ai-os-founding-builder-program-up-to-80k-month-pool/205?u=dora
- https://anna.partners/developers
- https://anna.partners/llms.txt
- https://github.com/whtcjdtc2007/anna-executa-examples

## 3. Current baseline vs proposed

What exists today in this repo:

- React camera-free breathing journey; camera feedback is optional and
  sends JPEG frames to the backend (no on-device processing claim). The
  proposed initial Anna slice will exclude this camera path by default.
- "Try hands-free preview" is a labeled **simulation** - no live gesture
  detection.
- Post-session and share surfaces show recorded duration and factual
  session details, with no score or verification marks. The pause/resume
  control bug is fixed.
- A minimal bundle-only Anna adapter now exists under `anna/` (Reset
  breathing slice; `validate --strict` passes; verified end-to-end in the
  local `anna-app dev` harness). It is local-only - no approved, published
  Anna release has been established.

Known blockers carried into this plan:

- ~~The session setup screen currently auto-requests camera permission.~~
  **Fixed (foundation slice, 2026-10-17):** camera is opt-in only --
  verified zero `getUserMedia` calls on mount, demo, and camera-free
  start.
- ~~The on-screen timer counts wall-clock time including paused
  periods.~~ **Fixed (foundation slice):** one monotonic active-time
  clock drives duration/rhythm/cycles; verified paused timer freezes and
  post-session reports active seconds only.
- The broader backend needs a security/ownership refresh before release,
  and the Playwright E2E fixtures are stale.
- See [DEPENDENCIES.md](./DEPENDENCIES.md) for the full list.

**Progress (2026-10-17):** the M0 foundation slice (camera opt-in +
monotonic timing) is implemented and verified. M0 is **not** complete --
the Anna platform contract is unconfirmed and no adapter exists.

Nothing below claims modes, telemetry, or adapters already built.

## 4. Modes

One engine; modes differ only in intent, routine, default duration,
introduction, optional reflection, and result template. Not three apps.

| Mode | Length | User intent |
|---|---|---|
| Reset | ~90 sec (first release) | "I need a moment" - simple comfortable breathing |
| Focus | ~3 min | "Help me begin" - optionally names one next action (user-provided, not AI-inferred mental state) |
| Unwind | ~4 min | "I'm finished for now" - quiet end-of-work ritual |

Durations are proposed starting points, not medical prescriptions or grant
thresholds. Pace may be adjusted and the session stopped at any time;
no forced holds or hyperventilation. **Reset is the only first slice**;
Focus and Unwind follow the first real Anna run and feedback. The advanced
pattern library stays secondary and is not a first decision. Camera,
touch, and hands-free input remain optional; no live-gesture dependency.

## 5. Primary journey

Trusted Anna identity (if the platform supports it) -> choose purpose ->
one action (Reset) -> timer rhythm -> explicit completion or interruption
-> factual, useful result -> repeat/share option.

A proposed meaningful result contains: selected routine/intent, correct
active duration (excluding pauses), completion status, cycles only when
actually tracked, an optional skippable user reflection, and a next action
based on user input or clearly-labeled guidance (never measurement).
Example Focus next action: the user's own "open the outline and write the
first paragraph." No deterministic wellness score, no verified-practice
claim, no camera-as-proof.

Target a meaningful result returned through Anna's supported execution
path; its exact mechanism and qualification criteria need confirmation.
AI may assist wording/adaptation but must not be required for the clock
or happy path. A meaningful non-AI fallback must be available, and sessions
must not stall on an LLM error.

## 6. Anna integration - verified contract (2026-10-17)

Checked against https://anna.partners/developers (all pages are Markdown):

- **App shape confirmed.** An Anna App = `manifest.json` + a static SPA
  `bundle/` rendered in a sandboxed iframe + optional `executas/` (stdio
  JSON-RPC 2.0 plugins). Schema 2 adds the `ui` section; schema 3 adds a
  structured `storage` declaration. Bundle-only apps with no
  `required_executas` are explicitly supported.
- **Tooling confirmed.** `npm i -g @anna-ai/cli` gives `anna-app init`
  (scaffold: manifest + bundle + Python executa), `anna-app dev` (local
  harness running the production dispatcher against an in-memory store),
  `anna-app validate --strict` (schema + host_api ACL coverage), and
  `mountBundle` for CI tests. Requires Node 22+ and `uv`.
- **Identity confirmed.** Host API calls from the iframe are automatically
  scoped to the signed-in user (`app_session_token` / `storage_token`).
  No second Supabase/email/wallet login needed; do not trust
  client-supplied IDs.
- **Persistence confirmed.** `anna.storage.*` (APS KV, per-user, durable,
  cross-device) is the host-API default. Session history/completions write
  via APS from the iframe - giving a server-side completion record aligned
  with "Anna's server-side execution records." Whether an APS write alone
  constitutes a Qualified App Run is **still unverified** (see below).
- **Host API vs Executa decided.** Official guidance: default to the host
  API; executas are only for heavy CPU, long-lived process state, or
  developer-owned secrets. Our breathing engine is pure UI timing, so the
  first slice should be **bundle-only** (schema 2/3, `ui.host_api` ACL for
  `storage.*`, no custom executa). The Python vision service stays out.
- **Capabilities confirmed (real names).** `host_capabilities` allow-list
  includes `llm.sample`, `llm.complete`, `llm.audio.speak`,
  `llm.audio.transcribe`, `aps.kv`, `aps.scope.user.read/write`, etc. The
  old plan's `llm.sample`/`aps.kv`/`required_executas`/`plugin.py` guesses
  were directionally right - they are now confirmed names, not hypotheses.
- **Qualified-run semantics CONFIRMED (forum staff, topic 351, Oct 2026).**
  A bundle-only app qualifies without an Executa IF the run is started by
  a signed-in user, completes the declared primary function, returns a
  meaningful result, and is verifiable through server-side records.
  **A `storage.set` alone does NOT count; a successful `llm.complete`
  that produces the app's meaningful result can.** There is no single
  universal "mark complete" call - declared function + server-observable
  execution are considered together. BYOK and free/paid credits all count.
- **Design consequence (settled):** the completion path must end in a
  server-observable meaningful step - `llm.complete` generating the
  closing/next-action line, declared in `host_capabilities` +
  `ui.host_api.llm` - or a bundled executa. The non-AI fallback stays for
  UX but a fallback-only run will likely not count toward MAU.
- **Grant economics (official rules, confirmed).** Tiers: 200 MAU $80
  launch/$50 monthly ... 20,000+ $6,000/$5,000; highest tier only.
  Since Oct 2026 grants are computed per-builder-portfolio (one
  grant/builder/month, users deduped across a builder's apps). The
  qualification window was Sep 1–Nov 30 2026 and is now **March 31, 2027**
  (§12.32). Revenue share separate: 70% of eligible usage profit,
  $50 minimum.
- **Store landscape confirmed:** 35 apps total, install counts single
  digits to ~48. Zero breathwork/meditation/calm/sleep apps. Store browse
  will not deliver 200 MAU - invitations/external traffic are the only
  realistic channel.
- **APS confirmed:** durable per-user KV hosted by Anna, cross-device.
  `scope=user` reachable via `aps.scope.user.*` / schema-3
  `storage.scopes.user` (our manifest matches). Caveat: user-scope keys
  are visible to any granted plugin - keep ritual state namespaced and
  non-sensitive.
- **Local-harness Executa note (verified 2026-10-17):** `anna-app dev`
  (`uvx anna-app-runtime-local@0.2.0a28`) auto-discovers `executas/` and
  answers `storage/*` + `sampling/createMessage` reverse RPCs, but its
  plugin pool never sends `initialize` — the lifecycle doc's "the Agent
  always tries v2 first" describes production, not the dev harness.
  Plugins must therefore treat reverse-RPC availability as
  try-and-degrade, not negotiation-gated. Chat-path `#brume reset` is
  not exercised by the harness (it exposes `tools.invoke` to the iframe
  only); the full chat surface is verified only at runtime on the real
  Agent.
- **Still unverified:** CSP/permissions-policy on `getUserMedia` in the
  iframe (camera stays excluded regardless); production APS vs harness
  behavior differences at scale.

**Adapter design (revised):** bundle the session engine (monotonic clock,
camera-free Reset) as the iframe SPA; on completion write the factual
record via `anna.storage` (user scope) AND issue an `llm.complete` call
that produces the result's closing/next-action line so the run is
server-observable and qualifies. Non-AI fallback remains the UX default
for resilience, clearly noted as likely non-qualifying.

## 6a. Differentiation pillars (team-confirmed, 2026-10-17)

Brume's positioning vs Calm/Headspace (content libraries you visit):

1. **Zero-friction recovery** - inside the existing workflow, not another
   app to open.
2. **Responsive, not prescriptive** - "slower" adjusts the pace; the
   experience adapts to the user.
3. **Wellbeing without gamification** - no streaks, scores, guilt, or
   camera. Recovery is not another metric to optimize.

**Product answer (settled): hybrid, proactive in suggestion only.** The
agent may *offer* a reset using learned cues (APS `scope=user` ritual
memory - e.g. "you usually pause before writing"), but never auto-starts
or interrupts. `#brume reset` stays the always-on reactive path. An offer
must be dismissible ("not now") and the product works fully without ever
accepting one. Proactive suggestion is the differentiator; unsolicited
interruption would break pillar 3.

**Build surface (settled before submission):**
- `reset` Executa tool -> `#brume reset` guided break inline in chat
  (stronger qualifying evidence than iframe activity alone). **Built
  locally:** `anna/executas/brume/` (`brume_reset` returns the pacing
  script as verbatim `_display` blocks; `brume_complete` writes the
  factual record via `storage/set` scope `user` and asks the host for a
  closing line via `sampling/createMessage`). Declared in
  `manifest.required_executas` under the dev `tool_id` `tool-papa-brume-htcxvfcr`;
  published to the catalogue as `tool-papa-brume-htcxvfcr`.
- `SKILL.md` Skill -> agent offers contextually from learned cues.
  **Built locally:** `anna/skills/brume-reset-offer/SKILL.md` (Skill
  Executa, `execution_mode: "prompt"`; offer rules mirror the settled
  product line — once per session, dismissible, never auto-starts,
  observable cues only). Not yet in `manifest.required_executas`: a
  Skill is `executa_type="skill"` and its platform `skill-…` tool_id is
  only issued at publish — add it (likely `optional_executas`,
  `visibility: app_bundled`) once published, per
  anna.partners/developers/skills/skill-publish + apps/app-bundling.
- `scope=user` APS ritual memory -> cue learning, repeat history.
- Pacing adaptation in chat-driven sessions (co-breathing: user says
  "slower"/"stop" mid-run).

**Published identities (2026-10-17):** Executa `tool-papa-brume-htcxvfcr`
(required_executas) and Skill `skill-u3f06a4c-brume-reset-offer-62gn2cgc`
(optional_executas, visibility=app_bundled) are live in the catalogue;
manifest.json references the real IDs. Local harness maps via
executas/brume/.anna/executa.json.

**Submitted for review (2026-10-17):** Anna App id 582, slug `brume`,
immutable version 0.1.0 (id 1435) is pinned in `pending_review` -
executa frozen at v0.2.0 (executa_version 766), skill at v1.0.0 (767),
bundle staged (5 files). Still unverified until a real signed-in account
runs it: production `llm.complete`/`sampling`, `scope=user` APS
persistence, whether runs register as qualified, iframe CSP.

**Platform sync (beta.186-190, checked 2026-10-17):** CLI already at
0.1.59 / schema 0.27.0; all changes additive, nothing to fix for the
pending review. Watch-outs and options:
- Tool sets are now intersected with executas the user has *Learned*;
  our `required_executas` auto-install should ride through, but if
  `#brume` doesn't surface for a real user, this is the first suspect.
- Review-queue pagination fix (beta.190) un-stuck apps beyond the first
  100 - our review should be reachable.
- `anna.audio.session()` (realtime voice: streaming ASR + TTS + `say()`)
  is a strong future path for hands-free co-breathing - spoken "slower"
  mid-break, eyes-closed pacing cues - without camera or local MediaPipe.
  Costs are per-second/per-char; requires `ui.host_api.audio:["session"]`
  and a user grant. Roadmap, not v1. **Built locally:** `brume_reset` now takes
  `pace` (slow 5/7, normal 4/6, fast 3/5) + `remaining_seconds` — a
  mid-break pace ask is a re-invocation covering the remainder, and
  `brume_complete` records summed segments (mixed-pace runs get
  `"pattern": "Reset · mixed pace"`). In the iframe, Slower/Faster
  buttons step a uniform tempo factor over pattern-time
  (`bundle/timing.js`), preserving phase progress without touching the
  monotonic clock; disabled while paused.

## 7. Retention loop

Chosen contextual cue -> one-tap repeat routine -> optional
"settled / same / less settled" self-report -> relevant next visit.

Offer a preferred cue after a useful first session, not before value. A
weekly practice view must contain no fabricated streaks, no shame for a
missed day, and no leaderboard or long-hold competition. Reminders are
opt-in and only if Anna supports them - no push server is promised.
Stopping comfortably is always available. Sensitive reflections are
private by default; minimize, delete, and reset where implemented.

## 8. Acquisition loop

Helpful session -> optional "Pass this break on" -> recipient sees the
specific routine and a clear begin -> their first successful Anna run ->
their own ritual.

The recipient gets a useful session, not a score-brag graphic; short copy
like "before your next meeting." Share/deep-link format is
capability-dependent - do not pretend Anna embeds or deep links are
confirmed; fall back only to a supported standard app entry route, with
optional privacy-preserving source attribution if possible. No personal
mood, history, camera data, or reflection in a shared artifact or URL; no
mandatory share, rewarded clicks, referral spam, or artificial run farms.
A public demo click does not count as MAU; Anna auth is required for a
qualified user. Test invitation usefulness before more graphic polish.

## 9. Later social mode

"Shared quiet break": asynchronous same-day routine invitation - no feed,
no realtime video/sync, no public completion or compliance visibility for
friends or employers; participation private unless explicit consent. Build
only after the core loop is validated; scheduled shared sessions only with
demand and platform support; live local gesture remains a further optional
experiment, not a core acquisition claim. Excluded from the first slice:
wallet, NFT credentials, heavy biometrics, paid MAU buying, all additional
mode engines.

## 10. Measurement

No telemetry is implemented by this plan, and no baseline or numerical
success threshold has been established.

- Primary outcome: distinct valid signed-in Anna users with at least one
  successful execution of the declared primary function in a calendar
  month, using Anna server-side records as the authority once its contract
  is verified. Until then, label product completion events as provisional,
  not qualified usage.
- Activation: among distinct valid signed-in Anna users entering Brume in
  a defined cohort window, the fraction completing their first successful
  primary-function run within seven days of first entry. Report the cohort
  window and exclude cohorts without a full seven-day observation window.
- Second-session return: among users completing a first successful run in
  a defined cohort window, the fraction completing another distinct
  successful run within the following seven days. Exclude cohorts without
  a full follow-up window.
- Seven-day return: among users completing a first successful run in a
  defined cohort window, the fraction completing another successful run on
  day seven after the first, using a declared UTC calendar-day convention.
  Report separately from second-session return; do not mix exact-day and
  within-seven-days retention.
- Invitation conversion: among distinct consent-attributable recipients
  who open a shared routine in a defined cohort window, the fraction
  completing their first successful Anna run within seven days of that
  opening. Use aggregate opened-invitation conversion instead if lawful
  recipient-level attribution is unavailable, name that different measure
  explicitly, and do not infer identities across external previews and
  Anna accounts.
- Count distinct users and distinct runs separately; deduplicate retries
  and duplicate completion submissions. Do not count previews, failed or
  interrupted sessions, automated tests, or invitations as successful
  runs. Do not upload camera data or reflection text for growth
  measurement.

## 11. Milestones

No timeline and no grant guarantees; each milestone has an exit checklist,
not invented metric goals.

- **M0 - Validation.** Confirm the Anna contract items in section 6; fix
  the camera opt-in prompt and the paused wall-clock timer; clear the
  known release blockers. Exit: confirmed integration answers plus a green
  local baseline.
- **M1 - Reset vertical slice.** One valid signed-in user completes the
  declared primary function and receives a meaningful result through the
  tested Anna execution path, with retry-safe failure states and an
  established approval path (not "published" unless actually published).
- **M2 - Ritual repeat.** One-tap repeat plus private opt-in reflection,
  tested with consented actual users; measure before expanding.
- **M3 - Invitation.** Recipient-focused "Pass this break on"; compare
  qualitative feedback and conversion - no arbitrary threshold.
- **M4 - Expansion.** Focus and Unwind modes and a small async shared
  quiet break, only on evidence, each with a stated purpose.

## Immediate checklist

1. Verify the Anna docs/links above.
2. Fix camera auto-prompt and the paused-timer issue.
3. ~~Build the minimal Anna Reset adapter (after contract confirmation).~~
   Done locally in `anna/` (2026-10-17); not yet exercised against
   production Anna.
4. Observe actual first completions.

## 12. Progress log and learnings (2026-10-19)

### 12.1 Program rules (verified from the official forum post, topic 205)

- Grants pay on **Qualified App MAU**: unique signed-in users with at least
  one **Qualified App Run** in a calendar month. A run qualifies only if it
  executes the app's declared primary function and returns a "meaningful,
  non-trivial result", measured from Anna's server-side logs. Installs,
  views, failed or cancelled runs, bots, and developer/team/QA accounts
  don't count. BYOK, free credits and paid credits all count.
- Tiers: E 200+ MAU $50/mo · D 500+ $100 · C 1,000+ $200 · B 4,000+ $1,000
  · A 10,000+ $2,500 · S 20,000+ $5,000. Since October grants are per
  builder portfolio (users deduped across a builder's apps). One
  meaningful improvement per month is required to keep receiving a grant.
  The window that ended **2026-11-30** was extended to **2027-03-31**
  (§12.32): each calendar month is still its own measurement cycle.
- September: only two builders qualified (both Tier D, 500+).
- Review criteria include an **"AI-Native Core: primary value must depend
  on AI reasoning or workflows. Superficial chatbot add-ons do not
  qualify."** A fixed timer with an AI closing line would fail this.

### 12.2 Market research (2026-10-19)

- **Anna marketplace:** 40 apps. Leaders have ~550–930 installs (Earth
  Anomaly Observatory 929, nikku696969's suite ~560–700), each with 4–6 real
  screenshots and a proper cover. **No breathing, break or wellness app
  exists** — open lane. Money Companion (cat mascot, 141 installs) shows a
  companion character can make an app a daily habit. Most apps are
  desktop-only; mobile apps get a "📱 Mobile ready" badge.
- **Wellness app retention:** ~95% of users abandon meditation/breathing
  apps within weeks; main causes are no external cue to come back and too
  many choices. Brume's structural advantage on Anna is that the cue lives
  where the work happens (agent chat + the proactive offer skill).
- **Evidence we lean on, and how we phrase it:** cyclic sighing improved
  mood more than mindfulness meditation in Balban et al. 2023 (Cell Reports
  Medicine) — offered as a pattern, described by rhythm only. The
  Psychomotor Vigilance Test is the standard reaction-time measure of
  reduced alertness; 3-minute phone versions were validated (Basner et al.),
  though a 2022 study found the 3-minute PVT tracks the 10-minute version
  less well — so Brume compares only against the user's own baseline and
  says "not a medical test". The Karolinska Sleepiness Scale is a validated
  one-item self-rating.
- **Power posing:** the hormone claims (testosterone/cortisol) failed
  replication (Ranehill et al. 2015, n=200) and the original lead author
  (Dana Carney) disavowed the effect in 2016; self-reported "feeling
  powerful" evidence is weaker and contested. Brume includes "open up your
  posture" as a preparation step with no claimed effect.
- **Camera-based tiredness detection:** rejected — breaks the
  no-camera promise, webcam fatigue estimates are unreliable, and Anna
  only offers still-photo capture on mobile.

### 12.3 What shipped (app 0.1.0 → 0.3.2, tool 0.2.0 → 0.4.4)

1. **Rejection fixes (review email 2026-10-19):** long listing description;
   PyInstaller binaries for darwin-arm64/x86_64, linux-x86_64,
   windows-x86_64 via GitHub Actions, uploaded through
   `distribution.binary_artifacts`; bundled-executa setup
   (`bundled:brume`).
2. **AI-native core:** sessions are planned by AI from one line of context
   (pattern, length, title, opening, posture cues, why), personalized by
   the user's own after-session ratings; AI reflection + next step after
   each break.
3. **Brume mascot:** inline-SVG mist sprite with 12 states; it is the
   breathing circle and reflects alertness.
4. **Get ready (3 min):** guided cyclic sighs → open up → humming voice
   warm-up → rehearse an AI-drafted opener, key point and reminder.
5. **Alertness check (1 min):** Karolinska rating + 60 s reaction-time test
   → median, lapses, band vs own baseline (after 3 checks, same input
   type) → AI next-step note.
6. **Chat tools** `brume_reset`, `brume_complete`, `brume_get_ready`, with
   Anna's model writing the AI text as tool arguments.
7. Mobile support (responsive, safe areas, 44px targets, haptics), chime and
   voice cues, health-claim and cue filters shared between JS and Python
   via one fixture file.

### 12.4 Cloud Agent findings (real Anna, Linux Cloud Agent on fly.io)

| Version | Finding | Resolution |
|---|---|---|
| 0.2.1 | Linux binary installs, starts and renders the chat script | ✅ review issue #2 resolved |
| 0.2.1 | Window AI plan 3.5 s, reflection 2 s, cross-path storage works | ✅ |
| 0.2.1 | Tool `llm.sample` is OFF after install; chat AI silently fell back to canned text (`planSource: "fallback"`) | Calling model writes plan/reflection as tool args; sampling removed (tool 0.4.0) |
| 0.2.1 | "Allow all & open" gate before `open_app_view`; window opened from it dropped the chat context | Gate gone once the tool stopped requesting a user-grantable capability |
| 0.2.1 | AI cues contradicted phases ("Hold for four" during "Breathe out"); box hold labelled "Rest"; cycle count mismatch | Cue rules + filter; box "Hold"; sessions snap to whole cycles |
| 0.3.0 | Chat plan + reflection now `agent`; no permission gate; window opens in ready mode with event prefilled; alertness check runs (median 308 ms) | ✅ |
| 0.3.0 | Health filter matched "research" and blanked the get-ready opener/key point and the alertness note | Narrowed regex + gaps closed (tool 0.4.1/0.4.2) |
| 0.3.0 | Get-ready Breathe step had no guidance, only a countdown | Real guided session |
| 0.3.1 | **Tool missing from the agent >3 min after install**; model improvised `exec_run brume_get_ready` | **Open** — then the account hit "Quota exhausted" |

### 12.5 Testing strategy (decided 2026-10-19)

Most bugs worth finding are in our code and are free to catch locally; the
ones only Anna reveals (permission defaults, tool deployment, gates, how
Anna's model uses tools) need a short cloud pass. So: **tier 1** unit/smoke
tests + CI binaries on every change; **tier 2** mock-LLM UI runs and
prompt checks against Gemini 3 Flash (`anna/scripts/prompt-check.mjs`) —
the model Anna serves by default; apps cannot pin the production model, it
is the user's choice — when prompts change; **tier 3** a fixed ~6-turn Cloud Agent checklist per release
candidate, each turn in a new chat. Quota burned in this session came from
long chat threads (context re-sent every turn) and real-LLM `anna-app dev`
batches on the Anna account. BYOK in Anna is recommended for test traffic.
Details: `anna/README.md` → Testing.

### 12.6 Rejection rework (local candidate, 2026-10-22, unpublished)

Second review email flagged: (1) main value not AI-native, (2) task
progress lost on close, (3) asked for a fresh-install Cloud Agent test
before resubmission. The local candidate answers all three; it is not yet
published or tier-3 tested.

- **AI-native core reworked.** The primary flow is now conversation
  preparation: event + goal + optional preserve/key point → AI drafts
  opening/keyPoint/approach/objection/response/nextStep (one clarify
  question max, one rehearsal turn max) → editable plan → optional
  adaptive rehearsal ("Get one adjustment") → saved card
  (`ready/sessions/<ts>`, `ready/last`). Prompt builders in
  `bundle/preparation-prompts.js` (policy: treat user JSON as data, no
  invented facts/motives, no scores, fields capped); strict parser in
  `bundle/preparation.js` rejects prose, malformed/over-cap fields,
  health claims and a second clarify. Breathing stays as explicit
  fallback + optional guided pause inside the flow. Get-ready timed
  steps reuse the pause machinery (`readyStepElapsed` now survives
  pause/reopen — no reset on resume).
- **Task recovery.** `bundle/recovery.js` checkpoints one active task to
  `brume/active-task`: versioned envelope, per-flow/per-screen data
  validation, serialized coalesced writes, tombstone clear, corrupt-safe
  load (never auto-erase), 8 s read timeout. Reset restores the session
  paused with clock/tracker/tempo intact and no closed-time accrual;
  check-in and pending result (stable `completedAt`,
  `reflectionStatus: pending`) restore without re-calling the model;
  a live alertness test never resumes partial timings — it restarts with
  an interrupt note; results restore with honest unsaved state. Failed
  saves keep the checkpoint with a retry; a failed clear keeps the task
  (no resurrect-after-clear). Every AI/storage boundary is guarded by
  task id + generation so late replies can't mutate a newer task.
  New-task entry points all route through keep/replace when a task or
  load error exists.
- **Cold-start + onboarding.** Static brand header + startup panel render
  before JS; bounded connect (8 s), recovery first, optional reads
  (summary/prefs/wording/alert-line) run concurrently after, never
  blocking restore; queued entry_payload applies post-recovery through
  the keep/replace gate. Home offers four moment buttons (deadline,
  support, feedback, interview — `bundle/experience.js`) that prefill
  context only, no model call; explicit wording preference
  (`ready/preferences`, natural/concise/direct) applies to new tasks and
  reaches the model payload. `mode:"ready"` payload may carry
  `preserve` and a validated six-field `preparation` draft
  (`planSource:"anna-handoff"`, editable, zero extra model calls;
  invalid drafts keep context + honest error).
- **Brand unification.** `bundle/brand.css` is now the canonical token
  source (mist palette, daypart overrides, bundled Manrope WOFF2 + OFL
  license); web `src/index.css` consumes the shared vars and the remote
  Google Fonts links are gone. Anna app.css aliases everything to
  `--brume-*`; sprite now uses periwinkle (#7c8cc9) — see mascot.js + BrumeMascot.css, kept in sync.
  (Superseded: shared mascot foundation in §12.9 — colour now comes from
  `--brume-mascot-*` tokens and the single adapter/CSS are shared three ways.)
- **Honesty.** "Planned offline" → truthful basic-plan labels; the
  breathing fallback never calls the model; save failures show
  keep-window-open retry; no fabricated Qualified-Run claims.
- **Test infrastructure.** `test/browser-qa.mjs` (26 agent-browser cases,
  own fake host :4618), `test/fake-host-server.mjs` (scripted llm /
  per-key KV faults+delays / startup delay+fail / entry payload),
  `test/capture-listing.mjs` (regenerates `listing/candidate/` PNGs),
  `test/preparation.mjs` + `recovery.mjs` + `session-storage.mjs` +
  `experience.mjs` unit tests, `scripts/preparation-check.mjs`
  (semantic plan/rehearsal review, dry-run default).
- **Verified 2026-10-22:** `npm test` 198 smoke + 85 unit; browser 26/26
  (incl. full 60 s alert run, reload recovery, fault retry, payload
  races, 320/420/1024 viewports, local font, no remote font requests);
  `anna-app validate --strict` ✓; root vite dev build ✓.
- **Not yet done:** publish candidate (new app version), real-model
  prompt check (`preparation-check.mjs --live` needs quota approval),
  tier-3 fresh-install Cloud Agent pass, upload `listing/candidate/`
  images in the Developer Console, forum report on the 0.3.0→0.3.1
  missing-tool delay.

### 12.7 Open items

1. Diagnose the missing tool after installing 0.3.1 (needs quota or BYOK);
   then the full tier-3 checklist from a truly fresh install of the
   published candidate (new app version — published versions are
   immutable, so the rework must ship before tier 3).
2. Run `anna/scripts/preparation-check.mjs --live` (Anna default model,
   quota-consuming) and manually review the semantic criteria.
3. Verify voice cues and phone haptics on a real device.
4. Harden reflection cleaning against appended "(19 words)" /
   "Alternative…" notes (seen on DeepSeek via prompt-check).
5. ~~Regenerate listing screenshots/cover/logo with the mascot~~ —
   `anna/listing/candidate/` generated 2026-10-22 from synthetic fixtures
   (UI demo only, not model-QA evidence); **uploaded 2026-11-06** — logo
   re-uploaded (new CDN hash), cover + five store shots now point at the
   candidate PNGs in this repo.
6. Fake-host harness for the binary smoke (answer storage reverse-RPCs).
7. ~~Post the forum report on the 0.3.0 → 0.3.1 missing-tool delay~~ —
   **posted 2026-11-02** in Developers with tag `executa`, titled
   "[Bug Report] Bundled Executa tools missing from the agent for 3+
   minutes after upgrading an app version (0.3.0 → 0.3.1); model runs
   the tool name as a shell command". Shows as **Pending (1)** under
   `/u/papa/activity/pending` — awaiting moderator approval; no public
   URL until approved. Covers App ID 582, `tool-papa-brume-htcxvfcr`,
   the >3 min delay, the `exec_run brume_get_ready` symptom, and the
   quota blocker.
8. ~~Submit 0.3.x for review~~ — **0.3.2 (tool 0.4.4) submitted
   2026-10-19, rejected.** The local candidate in §12.6 is the resubmission
   path: publish → tier-3 Cloud Agent run → submit. Next after that:
   distribution — store browse alone won't reach 200 MAU. The Nov 30
   cutoff this note was written against was later extended to 2027-03-31
   (§12.32).

### 2026-11-02 — web app alignment

The web app (src/) was repositioned to match Anna's stance: no camera, no
streaks, no scores, no outcome claims. The shared brand tokens in
`anna/bundle/brand.css` are now the warm paper/ink/pear palette — this
affects the Anna bundle visuals too, since the iframe links the same file.
Run `npm run test:browser` in `anna/` before the next publish to check the
bundle still looks right.

### 12.8 Review round 3 and remaining steps (2026-11-02)

Feedback timeline (Anna Dev team): 21 Oct — post the 0.3.0 → 0.3.1
missing-tool delay on the forum; no separate dev quota (use BYOK or the
weekly contribution rewards); notify them once the Cloud Agent test passes
and review moves forward. 22 Oct — rejected: (1) core not AI-native,
(2) progress lost on close, (3) run a fresh-install Cloud Agent test before
resubmitting. 25 Oct — BYOK steps (Settings → Advanced → LLM → My API Keys
→ Custom OpenAI-compatible → Test & Save, **then enable "Apps & plugins use
my API Key by default"**, off by default), plus a **new blocker: the app
hangs forever on "Checking for unfinished work…"**. The 25 Oct email did not
re-raise the AI-native issue; that suggests, but does not confirm, that the
conversation-preparation rework was accepted.

Startup hang, defect CONFIRMED, reviewer trigger NOT yet confirmed:
`initializeHost()` (`bundle/app.js`) set "Checking for unfinished work…"
then ran `loadActiveTask({ apply: true })` -> `hydrateTask()` with no
try/catch and no `.catch` on the call. Any exception there rejected
`initializeHost()` unhandled and left the panel up forever — the reviewer's
symptom. Reproduced only with a synthetic non-enumerable throwing field
(`?poison=hydrate` in `test/fake-sdk.js`); 12+ ordinary malformed
checkpoints (plain JSON) took the corrupt -> Home path and did not hang, so
we do not know what the reviewer's environment actually hit. Other
candidates: a different unhandled throw on the real host, or heavily
throttled timers (hidden/background iframe) delaying the 8 s timeouts and
the watchdog. The tier-3 Cloud Agent run (fresh install, then reopen with a
leftover checkpoint) is what will settle it. Fixed: `initializeHost` wrapped in try/catch -> error +
Retry, 15 s boot watchdog (localhost-only `__BRUME_BOOT_WATCHDOG_MS`
override), `loadActiveTask` treats validate/hydrate throws as corrupt
checkpoint (raw kept, never erased), `.catch` on both call sites,
`loadOptionalData` wrapped. Two new browser-qa cases.

Note: since 22 Oct the shared `brand.css` was retuned warm (web alignment,
2 Nov); re-run `npm run test:browser` and regenerate `listing/candidate/`
before the next publish.


#### 12.8 status, 2026-11-02 (console check)

- Developer Console: app 582 is **Rejected**; version history has 0.3.3, 0.3.4, 0.3.5 (all cut 22 Oct) and now **0.3.6** (cut 2 Nov, `version_id=1892`, guarded startup; tool unchanged at 0.4.4, executa_version 790). Docs earlier saying "unpublished" were stale: the reviewers' 25 Oct test hit a version with the startup screen (0.3.3+). 0.3.6 is installed on the dev account but **not submitted** for review.
- BYOK: Featherless and an OpenRouter provider are already added and Verified, and "Apps & plugins use my API Key by default" is ON. Featherless had no models added; `deepseek-ai/DeepSeek-V3-0324` was added (harmless, can stay).
- **Blocker for the Cloud Agent test:** the Anna account is out of quota (Subscription & Usage: 1,000 / 1,000 used, quota reset "Not available" on the Free plan). A chat message fails with "Quota exhausted, unable to continue using Anna service" even with the BYOK Featherless model selected as Main Model, so the chat itself is gated on Anna quota (BYOK covers app/plugin LLM calls, not this gate). Options: Add-on quota, upgrade, or the weekly developer contribution rewards thread. Main Model was restored to Qwen3.8 Flash.

### 12.9 Shared mascot foundation (2026-11-02)

One mascot contract now serves all three surfaces — shipped in source,
**not published/deployed** anywhere.

- **Architecture.** `anna/bundle/mascot-engine.js` holds the frozen
  version:1 `BRUME_AVATAR` definition (cloud body primitives, highlight,
  eye geometry, four mouth paths), `validateAvatar` (strict keys,
  type-specific radii, in-viewBox bounds, path-data-only mouths, safe on
  arbitrary input), and `sampleMascot(t, opts)` — a pure function
  returning the complete frame (eyes/lids, mouth, body scale, halo, arm
  sway, wisps, waves, swirl, topup puff). `anna/bundle/mascot.js` is the
  single DOM adapter (`createMascot` → `{setState, setBreath, setOptions,
  renderAt, destroy}`) owning the RAF clock; `anna/bundle/mascot.css` is
  the single paint file imported by Anna `app.css` and the web's
  `BrumeMascot.css`, and inlined into the MCP widget (`mcp/widget.js`
  embeds engine + adapter + CSS + brand tokens at startup with
  fail-closed transform assertions). Colours come from new
  `--brume-mascot-*` tokens in `brand.css`, mixed from the daypart
  primary — the sprite follows dawn/dusk/night retunes automatically.
- **Design preserved.** Same cloud identity, same 12 expressions, same
  caller behaviour and props (web `BrumeMascot` is a thin wrapper). The
  old random blink is now a fixed deterministic schedule (4.8 / 10.4 /
  17.2 s in a 20 s window); autonomous CSS keyframes (bob removed — at
  rest the sprite lives through subtle blink/gaze only) are computed by
  the sampler, so a fixed-time frame is complete and testable.
- **A11y + lifecycle.** prefers-reduced-motion renders static state
  expressions and reacts live to media changes; companion pointer gaze
  uses radial/tanh falloff centred on the eyes, companion-only idle
  drift and a sleepy-slit fade after 120 s of inactivity; hidden
  documents, `[hidden]` ancestors and offscreen elements suspend RAF and
  listeners, resuming cleanly; destroy is idempotent with no pending
  frames or listeners.
- **Verified locally:** `node --test test/mascot.mjs` (16), web
  `pnpm vitest run src/components/__tests__/BrumeMascot.test.tsx` (16),
  `cd mcp && npm test` (15, incl. jsdom widget execution), `npm test`
  (101), `tsc --noEmit` clean, lint 0 errors, `anna-app validate
  --strict` pass, real-browser checks on web /decompress, the Anna fake
  host and the widget (no console errors; reduced-motion and dusk
  daypart verified live).

### 12.10 Mascot life: blends, bob and reactions (2026-11-03)

Bringing the mascot to life (informed by bloub's blend-from-frame
transitions and grokbot-desktop's event reactions); still source-only.

- **Motion lives on an inner root.** All svg children sit under
  `g.mascot-root`; bob/rotate/squash apply there instead of a
  `transform` attribute on the outer `<svg>` (browsers treat that as a
  CSS px-space transform — a topup puff shifted the whole sprite).
  Engine frame `svg` → `root: {y, rotate, sx, sy}`.
- **Bob is back.** Removed by the §12.9 refactor; now engine-computed
  (quiet 6 s / 1 unit, companion 7 s / 1.5 units + 1° tilt, halved when
  breath is externally driven, zero under reduced motion).
- **Life in every state.** Blinks run in all states except `hold` and
  `sleepy`; gaze micro-drift everywhere (companion-idle keeps the old
  1.1/0.6 amplitude, other states ~half, quiet smaller still) plus
  purposeful look offsets (up on inhale, down on exhale, up-right when
  thinking). In `hold` the sprite is deliberately still.
- **State changes blend.** Every frame exposes a numeric `pose`; on a
  real change the adapter freezes the displayed pose and eases to the
  target over 0.5 s (easeOutQuint, no overshoot). The four mouth paths
  now share one two-quad closed structure so `blendPath` lerps them
  (mismatched structures still swap at k=0.5). Chained mid-fade changes
  stay continuous. Reduced motion = no blend.
- **One-shot reactions.** `react("hop" | "settle" | "celebrate")`
  (grokbot-style) layers on the live frame and clears itself: hop on
  session start/resume and decompress taps, settle on pause, celebrate
  on result/prep-card. Web takes a `reaction={{name, key}}` prop that
  fires on key change.
- **Anna breath fix.** The session tick and pattern preview passed raw
  phase progress to `setBreath`, so the body grew during exhale/hold and
  snapped — now `breathAmount(phase, p)` (eased: inhale→p, topup/hold→1,
  exhale→1−p, else 0), matching the web. Anna mascots now run
  `presence:"companion"`.
- **Verified locally:** `node --test test/mascot.mjs` (23),
  `pnpm vitest run` (178; BrumeMascot.test 19 incl. mid-fade continuity
  + reaction prop), `npm test` (108), `cd mcp && npm test` (15),
  `tsc --noEmit`, lint 0 errors; browser-checked on web /session and
  /decompress and the Anna fake host (hop/bob/blends/breath observed
  live).
- **Still needed for release:** the full
  browser suite, `listing/candidate/` regeneration with the new sprite,
  and the tier-3 Cloud Agent run before submit — none of that ran here.

#### 12.10 status, 2026-11-03 (publish)

- `anna-app apps publish --bump patch` cut **0.3.7**
  (`version_id=1902`, executa_version 790 frozen again — tool unchanged
  at 0.4.4; all four binaries deduped/cached). `app.json` bumped to
  match. 20/20 `npm run test:browser` cases passed on the new sprite;
  `listing/candidate/*.png` regenerated with it.
- **`apps release 0.3.7` is refused while status is Rejected** — the
  console path is `submit-review` → pending → approval → release.
- **Submitted for review** (`anna-app apps submit-review`) — app is
  **pending_review** on v0.3.7, ahead of the tier-3 run: owner decided
  not to wait on quota (the reviewer pass doubles as the fresh-install
  Cloud Agent test; the boot-hang fix is what it proves or disproves).
  Note: any cut after submission needs a re-run of `submit-review` to
  re-pin the review to it.

### 12.11 Motion tiers B/C + attention layer (2026-11-03, unpublished)

Web motion upgrade continued (Tier A transitions shipped earlier same
day; all source-side, nothing published).

- **Tier B — bloub-grade mascot engine.** Deterministic 6.4s glance
  (lookBias), idle bob cut to −0.45/−0.35 + rotate 0.35, per-state
  silhouette deltas (BODY_POSES → `frame.body.prims`, painted
  per-primitive in mascot.js), three-act reaction curves
  (`reactionCurve` — crouch/apex/touchdown-squash; last 3% parks on
  REACTION_REST so reactions land exactly).
- **Tier C — flight smear + protocol wiring.** `smearFrom({x,y,
  strength})` one-shot: sprite deforms along flight velocity
  (stretch 0.18 / squash 0.11, quadratic decay over 0.55s). Fixed two
  real flight-detection bugs: position is a mount-id-tagged trail
  (`src/lib/mascotFlight.ts`, 13 unit tests) — StrictMode replays and
  sibling mounts can't overwrite the previous spot; staleness =
  departure time. Presence toggle answers: Company→hop, Quiet→settle.
- **Attention layer (two-way, no camera).** New `hush` engine input:
  pointer-speed EMA + nearness in the shared adapter — agitated near
  it → hush eases to 1 (bob, gaze wander, glance all quiet — it models
  stillness); slow dwell 0.6s near it → it settles with you, once per
  approach. Companion presence only; reduced motion untouched.
- **Positioning noted for the record:** embodied companion is the
  wedge — "company, not content" / not content, not a metric, not a
  chatbot. Mist metaphor is the doctrine (gathers, releases, returns,
  never keeps). Camera attention (Winq-style gaze) evaluated and held
  out — no-camera promise stands; behaviour-attention carries the loop.
- **Verified:** anna 116 tests, mcp 15, web 186 vitest + 13
  mascotFlight tests, tsc/lint clean, live browser QA of smear frames
  and lab strips. Docs: `docs/WEB-MOTION.md` carries the full grammar.

### 12.12 Memory, reflection and art-as-artifact (2026-11-06, local, unpublished)

Reaction to Anna Dev feedback (UI soothing, thin feature set, missing
export/print). Doctrine held: no new routes, no scores/streaks, no
sensing, closed-set ledger only.

- **Export/print (Anna prep card).** `anna/bundle/index.html` gained
  Export card + Print buttons; `app.js` adds `prepCardText`,
  `exportPrepCard` (clipboard + dated `.txt` download) and
  `printPrepCard` (`window.print()`); `app.css` adds `@media print` so
  only the card prints. Highest-ROI item in the feedback; users asked
  for it by name.
- **Memory as reflection (Anna).** Home gained a `#memory-line` element;
  `refreshHomeMeta()` writes an observational tally built only from
  closed-set stored fields ("The room remembers N preparations. Last:
  …"). Count, never a grade.
- **Soothing UI pass (Anna).** Button transitions/hover lift; print
  styles. Mascot motion untouched — only the container got quieter.
- **Cross-flow pattern reflection (Anna).** New `summarizeHistory` +
  `formatHistoryForPrompt` + `prepPersonalizationFromReady` in
  `plan.js` (closed-set only, no free text); `buildReflectionPrompt`
  accepts `history`; `OUTCOME_CLAIM_RE` backstop in `cleanReflection`.
  `app.js` loads reset + ready sessions and threads them into
  `fetchReflection` / `fetchPlan`. Anna now references the user's own
  patterns observationally ("you've used before", never "it helped").
- **Web parity.** `src/pages/Index.tsx` gained a memory line reading
  `checkinLedger` (closed-set feeling word + daypart + count); room
  material now remembers the user's weather via
  `rememberedMaterialFromFeelings` in `src/lib/roomExperience.ts`
  (E6a art-as-artifact arm, behind a flag, no number/label). `src/pages/PostSession.tsx`
  insight is pattern-aware and closed-set ("You've practised {pattern}
  N times. The room keeps it.").
- **Anna Dev CLI.** `@anna-ai/cli` bumped to 0.1.64; smoke test adapted
  to the new ACL shape (`storage.scopes`, `allowedTools`) and NO_MOCK
  errors. `npm test` in `anna/` green (smoke 192 assertions + 117 unit
  tests).
- **Experiment spec.** `docs/EXPERIMENTS.md` gained the E6a
  art-as-artifact arm under E6 (hypothesis: lifts D7 above the
  line-only arm; kill if no added lift).
- **Not done (deliberate):** web export/print (no prep flow on web),
  manifest schema 4 migration (schemas 1-3 still work; needs validation
  pass), shared Node/Chrome runtime (stdlib-only executa), progression
  system (doctrine forbids scores/streaks — room change is the only
  progression).
- **Verified:** anna `npm test` green; web `vitest` 438/438, `tsc`
  clean.

### 12.13 Corrections to 12.12 (2026-11-06, local, unpublished)

A review of 12.12 found it had drifted from the doctrine it cites. What
changed, and what the earlier entry got wrong:

- **E6 is now an experiment.** 12.12 shipped the web memory line and the
  remembered room material to everyone, with no control. They sit behind
  `src/lib/arms.ts` now (control / line / line_room); the arm rides the
  `visit` event as one closed id and the counter keeps `by_arm`
  histograms. Privacy page names it.
- **The web line is a pattern, not a tally.** "The room remembers 4
  check-ins. Last: Restless · dusk." was a receipt. It is now
  `memoryLine.ts`: gated at ≥7 entries, names a recurring feeling and
  daypart ("Restless, three mornings this week."), silent otherwise.
- **Anna's memory line no longer prints typed text.** 12.12 claimed
  "closed-set stored fields" while interpolating `event.slice(0, 40)` —
  the user's own sentence. It is now `preparationMemoryLine` in `plan.js`
  (stored `kind` only: "Interviews, twice."), silent until a kind
  recurs, pinned by `preparation_memory` cases in `plan-cases.json`.
- **PostSession insight reverted** to "You practised {pattern}." The
  per-pattern counter had no test, was race-prone against the save
  effect, and was a progress number by another name.
- **`OUTCOME_CLAIM_RE` was mirrored nowhere and over-broad.** The
  Python executa did not have it (the plan.js header says the two share
  one contract), and bare `worked` would have rejected "you worked through
  all 10 cycles". Now mirrored in `brume_plugin.py` with `worked` only
  matched as a claim ("that worked"), and covered by five new
  `reflection_outputs` cases that both runtimes run.
- **Verified:** `prompt-check reflection` against Gemini 3 Flash with a
  history case — 4/4 shown, none replaced. `npm test` (anna), `python3 -m
  unittest test_plan`, mcp `npm test`, web vitest/tsc/lint — see commit.

### 12.14 Voice input: hold is the default, tap is a choice (2026-11-06)

Real-phone testing found the tap path (listen until silence) unreliable —
silence detection cut sentences, and the pressed state did not persist.
Decision: **hold-to-talk is the default**; tap is an explicit opt-in.

- `getMicMode`/`setMicMode` in `voiceCheckin.ts` (`brume.micMode.v1`,
  closed set, hold by default, storage refusal reads as hold).
- Hold: mic open while the finger is down, no silence rule, release ends
  it (ForceEndpoint + brief grace); a quick press still isn't a dead end —
  it settles into listen-until-silence for that one sentence. Tap: first
  press starts hands-free, release does nothing, silence or a second press
  ends it.
- The choice lives in Home's Options as a "Say it · hold / tap" pill row
  (same pattern as the breath-cue pills), rendered only where the mic is
  supported; the mic's accessible label follows the mode.
- Failure copy now names the remedy: a no-prompt refusal means the site
  was denied before (iOS remembers) or the browser withholds the mic
  (in-app webviews) — the pill says "allow it in your browser's site
  settings". Off-HTTPS is its own named failure.
- The one-time hold tip ("keep your finger on it to take your time") only
  ever shows to hold-mode users after a tapped match.
- Copy: About + PrivacyPolicy describe hold-by-default truthfully; tests
  pin it. Verified: 487 vitest, tsc/lint clean, real-browser check of the
  pill persisting across reload.

### 12.15 A stuck mic gets a hand, not an epitaph (2026-11-06)

Audit of the blocked-mic moment found the help evaporating: the failure
line was rendered through the transcript's dissolve animation (4.2 s and
gone) and said "allow it in your browser's site settings" — words nobody
can act on, on the screen they're stuck on. Voice is the entry's headline;
the stuck path is where judges land.

- **Failures never dissolve.** Transcripts are theirs — that's why the
  mist takes them. Help lines are Brume's own, from a closed table, and
  stay until dismissed or the next press.
- **`VOICE_HELP` closed table** (`voiceCheckin.ts`): per failure × device
  (`deviceKindFromUA`: in-app browser / iOS / Android / other), always
  ending in the exit — "Or just tap a word." In-app browsers hear "this
  page is open inside another app's browser… open it in Safari or
  Chrome"; iOS hears the aA › Website Settings path; Android the lock ›
  Permissions path.
- **The companion carries it**: `onVoiceState` gains `"blocked"`; Home's
  mascot settles while the card explains — a blocked mic is a pause, not
  an alarm.
- **First-press expectation**: one-time line beside the mic ("hold to
  speak — the browser asks for the mic the first time", mode-aware), so
  the OS prompt is never a surprise. Most blocked mics are accidental
  denials of a surprise prompt.
- Copy-claims covers the whole table; UA detection, persistence, dismiss
  and the hint are tested (494 vitest, tsc/lint clean); first-use hint
  verified in a real mobile viewport.

### 12.16 Their words dissolve; our invitation stays (2026-11-06)

"I said drained and nothing happened." Four things stacked: Drained is
the energy pair's initial face, so the matched-flip had nothing to move;
the "Drained? tap to choose" line rode the transcript's dissolve and was
gone in 4.2 s; the glow is subtle; and Index ignored `onVoiceState
("matched", index)` entirely — a wiring oversight. The backdrop/ledger/
commit gating on the tap is the doctrine and stays; the feedback desert
between hearing and choosing was the bug.

- **The invitation is now a standing pill** (`.brume-voice-offer`):
  their transcript passes through the mist, our invitation persists
  until a chip is tapped (any path — `selectedIndex` effect), the mic is
  pressed again, or "okay" dismisses it. Same doctrine as the help card:
  theirs dissolves, ours stays.
- **The companion acknowledges the match**: Index's `onVoiceState` now
  takes the suggested index and plays the feeling's own reaction. No
  tint, no ledger, no Begin nudge — acknowledgment, not commitment.
- Tests: already-face-up match ("drained"), persistence past the 6 s
  transcript clear, retirement on tap / next press / okay, companion
  receives `("matched", index)`; tap-mode localStorage leak between
  tests fixed with a storage clear in the mic describe (499 vitest).

### 12.17 The confirmation spin (2026-11-06)

"Even if drained was face up I would expect it to react." When the heard
word is already showing — or already chosen — the flip has nothing to do,
and the room used to nod silently. Now the chip plays a confirmation
spin: one rotateY turn with a soft swell (0.9 s, transform-only; an
opacity pulse under reduced motion), distinct from the flip's rotateX,
retired by onAnimationEnd with a timeout guarantee (jsdom never fires the
event — noted in the test). The invitation pill stands beside it; the
chosen-word case adds no pill, that word is already theirs.

Mascot research the same evening (grokbot-face + bloub, both studied in
full): ten lessons recorded against `anna/bundle/mascot-engine.js` —
chief among them states-as-schedules (micro-expression cycles + per-state
blink rates), blink-masked state changes, sphere-depth eye compression on
gaze, seeded blink schedules with double blinks, and rare spontaneous
one-shots in positive states. Not built yet; the engine is shared with
Anna and frozen-contract, so each lesson is its own change with
`anna/test/mascot.mjs` coverage.

### 12.18 All ten lessons, one engine pass (2026-11-06)

The research became a single expressiveness pass on
`anna/bundle/mascot-engine.js` — all ten lessons, still one pure
`sampleMascot(t, options)`:

- **States as schedules.** `STATE_VARIANTS` rotates each state through
  2–4 small variants (another mouth, ±0.5 dy, a touch of lid) on seeded
  3.2–6.6 s dwells keyed on `stateAge`. Variant zero is the identity, so
  every state still enters exactly as drawn; hold and topup keep one
  variant — stillness and the puff are their whole part.
- **Scripted beats.** One micro-narrative per state: the exhale sigh
  (lids heavy over its first 2.2 s), a thinking saccade upward every
  3.1 s, sleepy's slow 5.6 s drowsy blink.
- **Blink-masked transitions.** A far expression change (mouth + lid +
  dy distance > 0.75) lands inside a forced blink across the 0.5 s
  blend — sin-shaped, exact at both endpoints. The breath loop
  (inhale/topup/hold/exhale) is exempt: masking every cycle would be a
  metronome, not a character.
- **Sphere depth + mirrored tilts.** The eye toward the gaze edge
  narrows up to 16 % of its rx; `EYE_TILTS` rotate per state (sleepy
  −6° outer-corners-down, bright +3° up), mirrored between the eyes,
  blended in pose space, painted by the adapter as a rotation about
  each eye's own centre.
- **Seeded aperiodic blinks.** Two candidate slots per 4 s cell, each
  with its own fire probability and jittered offset — ~1 blink per
  3.9 s, 18 % of them doubled 0.32 s later. The old 20 s/3-times
  metronome is gone; the pins now scan the schedule and assert density,
  determinism and doubles.
- **Spontaneous perk.** Bright/proud companions lift on their own about
  once per 40 s (seeded schedule on absolute t) — never quiet, never
  hushed, never reduced.
- **Landing wobble.** The hop's touchdown squash carries one decaying
  counter-oscillation; both terms zero at the window's edges, so the
  reaction still parks on exact rest (old pins untouched).
- **Listening gaze.** The adapter learned `lookAt: Element` — tanh-damped
  gaze (180 px scale, clamped to the engine's maxima) resolved every
  frame *and* in `renderAt`. Home aims it at the mic while listening,
  the suggested word after a match, the help card when blocked; a
  hand-choice or a miss releases it.

And the QA surface: MotionLab grew a "Mascot schedules" board — eleven
frozen proof frames (variant dwells, the mask mid-blend, depth, tilts,
each beat, the perk at t 65.86).

Contract care: the export surface is unchanged; the blend pins now pass
explicit `stateAge` on both sides (variants are a function of it) and
the blend-open assertion expects the masked dip; pose and eye frames
gained `tilt` (`mascot-engine.d.ts`, `mascot.d.ts`), and the adapter
renders tilt-less frames un-rotated. Reduced motion still gets the
pose, never the schedule — every new behaviour is gated behind it.

41 engine tests (was 35), 510 web tests (was 501), anna 126, mcp 17 —
all green; `anna-app validate --strict` passes.

### 12.19 The home column stops floating — Begin always in view (2026-11-06)

Phone review found the mobile home stack broken in four ways: the title
floating low under a centred wrapper, Begin below the fold (and behind
the fixed tab bar) once a feeling was chosen, the reason row collapsing
into near-invisible text on pick ("nothing seems to happen"), and the
mascot squishing or overlaying chips. Measured live at 375×667,
320×568 and desktop before touching anything.

- **Home opts out of the shared vertical centreing** —
  `main:has(> .brume-home--compact) { justify-content: flex-start }`
  plus trimmed top padding; the column owns its own rhythm (title near
  the nav, action at the bottom) and `flex-grow: 1` fills the room.
  Every child is `flex: none` — the squish was flexbox shrinking the
  anchor box on overflow.
- **The action seat**: Begin sits in `.brume-home__footer` —
  `margin-top: auto` seats it at the bottom of a short screen,
  `position: sticky` pins it above the tab bar
  (`bottom: safe-area + 88px`, inside the layout's 96px reservation)
  on a long one. Only Begin pins; Options stays in flow so an opened
  sheet never covers the chips, and the seat's fade gradient is
  `pointer-events: none` — chips under it stay tappable (verified with
  elementFromPoint at 320×568).
- **Reasons transform instead of vanishing**: the picked word stays as
  one confirmed pill ("because sleep · kept on this device",
  `role="status"`, same 40px beat as the row so Begin doesn't jump),
  and the companion settles once in acknowledgment (`onPick`).
- **Selection focus**: `.brume-pairs.has-selection` dims the unchosen
  words to 0.55 (same grammar as the listening dim); hover/focus
  restore them.
- **The mascot yields on mobile**: home anchor 156 → 132 on
  `useIsMobile` (the hook learned a `matchMedia` guard for jsdom),
  companion margins trimmed.

Verified with ego-browser at 375×667 (everything above the tab bar,
zero scroll), 320×568 (Begin still pinned and clear, reasons scroll
beneath it) and desktop (seat at the column's foot, no tab bar). 512
web tests, tsc clean, lint 0 errors.

### 12.20 The session fits the viewport, and the voice speaks once per edge (2026-11-06)

Two phone reports from a live breath, both fixed at the root:

- **Controls no longer hide behind the browser bar.** The session shell
  was `h-[100dvh] min-h-screen` — and `min-height: 100vh` is the
  viewport *with the URL bar retracted*, so it forced the box taller
  than the visible area and pushed pause/breathe/end behind the
  browser's own chrome. Now it is `h-screen` with a
  `supports-[height:100dvh]:h-[100dvh]` upgrade and no minimum; the
  safe-area-aware bottom padding does the rest. Verified in a prod
  build at 390×700: End at y=674, zero scroll.
- **"Breathe out" twice in a row, cut off.** The phase-cue effect
  keys off `flatPattern` identity, and `SessionModeWrapper` rebuilt
  its config inline while `useOfflineManager` polls `getSyncStatus()`
  (a fresh object) every 5 s — so every poll re-ran the effect and
  `playFile` restarted the *still-speaking* cue from the top. Two
  fixes that each close the door alone: the wrapper's config is
  memoized, and the cue effect keeps a `lastCueRef` so a cue belongs
  to the phase **edge** — stray re-runs stay silent, pause/resume
  resets the ref so a resume re-orients with exactly one cue.

A dev-only artifact worth knowing: in `vite dev` (StrictMode
double-mount) the manageTiming owner unmounts mid-startup and its
cleanup pauses the brand-new session, so Begin lands on "Resume".
Production builds run active; the jsdom integration suite drives time
with fake timers and pins the once-per-edge behaviour directly.

New tests: 2 integration (edge once under churn; resume re-orients
once), 2 layout (dvh sizing, safe-area seat). 516 web tests, tsc
clean, lint 0 errors.

### 12.21 v0.3.9 — the review-feedback release (2026-11-06)

Anna Dev's three points (UI not calming enough, thin feature set, no
export/print) shipped as one cut. Everything from 12.12–12.20 is now
immutable server-side:

- **Plugin 0.4.5** (`executa_version=1012`): `clean_reflection` gained
  the `OUTCOME_CLAIM_RE` backstop mirroring `plan.js`; binaries rebuilt
  for all four platforms (`brume-executa-v0.4.5`). Note: GitHub retired
  the `macos-14` runner image mid-flight — the darwin-arm64 matrix leg
  now builds on `macos-15`.
- **App 0.3.9** (`version_id=1987`) published via
  `anna-app apps publish --bump patch` and submitted for review
  (`status: pending_review`). Listing description now names the
  export/copy/print card; metadata synced.
- **Verification before cut:** anna `npm test` green (smoke + 126 unit),
  `test_plan` 16/16, `prompt-check all` zero fallbacks on
  gemini-3-flash-preview, web 516 vitest + tsc clean + lint 0 errors,
  `anna-app validate --strict` passes (retired-fields warning only —
  schema-4 migration still deferred).
- **Still blocked:** the required fresh-install Cloud Agent e2e run —
  account quota is 1000/1000 and the BYOK bug is platform-side. Track:
  forum post at forum.anna.partners (Build Anna Better program = +1000
  credits). Anna Dev confirmed the review run does NOT substitute for
  the self-run test, so approval may still wait on quota even if 0.3.9
  passes content review.

### 12.22 "Arrive" — the anti-chatbot research and the gesture grammar (2026-11-06)

Trigger: a teammate's fresh look at 0.3.9 still read as "essentially a
chatbot" — conversation plus a breathing rhythm. Anna Dev's review
asked for a core strength users can't get elsewhere and more
emotion-regulation tools. Tavily research across the competitive
landscape:

- **Chatbots** (Woebot, Wysa, Anna's own chat path): words all the way
  down — the exact thinness flagged.
- **Mood→strategy mappers** (How We Feel / Yale, Daylio): feeling →
  regulation strategies is proven UX, but strategies are lists and
  short videos; nothing you do with your hands.
- **Companion pets** (Finch, 4.9★/750k ratings): acts nurture a pet —
  but progression is streaks/goals/checklists, all doctrine-forbidden.
- **Art therapy** (Scribble Journey, ZenFlow, Palette): guided drawing
  lessons; art is saved and judged, never released.
- **Micro-technique lists** (butterfly hug, 5-4-3-2-1, physiological
  sigh, category games): 30–60s evidence-aligned resets exist only as
  bullet points — nobody made the gesture itself the product.

**The gap:** an in-the-moment, eyes-down, hands-busy ritual where the
feeling is expressed and *released*, not tracked or discussed.
"Draw it, watch it become mist" exists nowhere — art apps save the
work, mood apps log it, chatbots ask about it.

**Design (approved direction):** "Arrive" — one tap, one act, never a
menu.

- Feeling picker is a **mist ring**, not a form: curated ~8 words
  (Wired, Restless, Heavy, Drained, Anxious, Okay, Light, Grateful)
  drift around the mascot; tap one and it floats over and settles
  beside it. Exploration is touching, not choosing — the primitive
  that makes a richer set feel playful instead of paralysing
  (How We Feel deliberately simplifies to a navigator for the same
  reason).
- Brume proposes **exactly one act** — deterministic feeling→act map;
  the LLM writes only the one-line observational invitation (never
  interprets the feeling). No menu: choice paralysis is the enemy.
- Acts are **gestures that end in release**, all <60s, states of the
  room: *Scatter* (draw ~20s → strokes lift and dissolve into mist —
  the flagship), *Set down* (drag the weight off — arousal-down),
  *Name it* (tap a word into a sentence the LLM completes
  observationally). Breathing and prep remain the standing doors.
- **Nothing persists.** No saving, streaks or scores; v1 writes no
  ledger entries at all (a later arm may add a closed-set act id).

### 12.23 Arrive ships — v0.4.0 in review (2026-11-06)

The 12.22 design landed same-day as **v0.4.0** (version_id=1990,
`pending_review`, re-pinned via `apps submit-review`):

- `anna/bundle/arrive.js` — FEELINGS (9 closed-set words: Wired, Heavy,
  Restless, Drained, Anxious, Foggy, Overwhelmed, Stuck, Okay), the
  feeling→act map (scatter | setdown | null), invite prompt builder +
  `cleanInvite` (claim-word and feeling-echo rejection, word/char caps),
  closed `INVITE_FALLBACK` per feeling, and the two act controllers
  (`createScatter` canvas→mist dissolve, `createSetdown` weighted pull).
- `session.js` — `fetchInvite` (never throws; fallback on any failure).
- Home gained a third card ("How are you arriving?"); three new
  screens (arrive/scatter/setdown) with mascot states tender/watching.
  Acts are NOT tasks — nothing checkpoints, nothing writes storage.
- Verified: 133 anna tests (7 new arrive tests), browser QA on the
  fake host drove ring → pick → invite → both acts to completion;
  reduced-motion paths are opacity-only; keyboard paths exist
  (Enter/Space on canvas, ArrowDown on the weight).
- Invite prompt spot-checked on gemini-3-flash-preview: real lines
  pass the cleaner; free-tier rate limits produced empties, which the
  fallback covers by design.
- Listing description gained section 4 (Arrive); metadata synced.

Open: Name-it act and Set-down polish are fast follows; a future arm
may write a closed-set `(feeling, act)` id if E6 measurement wants it.

### 12.24 Pre-review polish pass — agent-offered acts (2026-11-07, local)

Rejection-risk review before the v0.4.0 verdict: the two criteria that
actually burned us before are "AI-Native Core" and "the agent can't do
this". The highest-leverage fix was wiring Arrive into the chat→app
handoff, plus small UX hardening found while checking mobile.

- **`mode: "arrive"` entry payload.** `open_app_view` can now deep-link
  the feeling ring with an optional `feeling` (id or label, closed set,
  invalid values open the bare ring). `applyEntryPayload` returns
  whether it navigated so the boot path's `show(home)` can't stomp a
  taskless arrive screen (real bug caught by the new QA case).
  `system_prompt_addendum` now tells Anna's model it may offer Arrive
  when a user names a feeling and wants a small physical act rather
  than conversation — the agent is the suggester, not just the ring.
- **Mobile fit.** Ring verified at 320×568 and 390×700: orbs stay inside
  the viewport, but the act card pushed Begin below the fold on the
  smallest phones. A `max-height: 620px` media query shrinks the mascot
  slot, ring height and act padding across all three arrive screens;
  Begin now sits at ~527px on 568-tall viewports with zero scroll.
- **Bug found and fixed:** `els.setdownTrack` was referenced by
  enter/finishSetdown but missing from the element map — Set it down
  threw before navigating. Restored; keyboard ArrowDown completion
  re-verified.
- **Haptics** on act completion (Scatter let-go, Set-down landing) via
  the existing `mobile.haptics` grant.
- **Invite prompt** for the no-act ("Okay") path rewritten as a calm
  send-off, not a question — earlier wording produced odd lines.
- **Privacy copy** (app.json): "what you type or tap" — feeling taps
  are sent to Anna's model for the invite line.
- **QA infra:** browser-qa sets `AGENT_BROWSER_DEFAULT_TIMEOUT=90s`
  (the 60s alert case exceeded the CLI's 25s default — environmental,
  not product); two new arrive payload cases; capture-listing gained
  `arrive-mobile.png` (8 candidates total).

Verified: 133 anna unit tests, arrive payload cases green, full
browser-qa suite green (30 cases), `validate --strict` clean.

**Published same-day as v0.4.1** (version_id=1993,
`apps publish --bump patch`, binaries deduped at 0.4.5/1012) and
re-pinned via `apps submit-review` — the review pin is now v0.4.1,
which carries the Set-it-down fix that v0.4.0 lacked.

### 12.25 The two acts, rebuilt (2026-11-07, v0.4.2)

A design review found that both acts were missing the thing they are named
for. Scatter's "mist" snapped every stroke into about 24 coloured dots at
half opacity, and they rose like confetti. Set it down asked for "slowly"
but a flick finished it; the finishing animation sped up (a drop, not a
setting-down); and its landing (`.setdown-landing`, `--drop`) was styled
but never rendered. Both acts now follow the mascot's pattern: a pure core,
tested in node, plus a thin DOM adapter.

- **Scatter.** Single-colour ink in the room's primary that thins as the hand
  speeds up. On release the page lightens, then an erosion front rises from
  the bottom of the drawing with a smooth ragged edge. Each segment feathers
  out just before its moment and becomes soft pre-tinted sprites that drift
  up, swell, shift from ink toward the daypart mist colour, and thin out
  before the canvas edge. The whole dissolve is under 3.7 s, and particles
  are capped at 1,400 however much ink there is. Resizing no longer wipes
  the drawing. Arrow keys draw and Enter lets go. Let it go stays disabled
  until there is ink. The mascot watches the page, exhales while the mist
  goes, then settles; the old `celebrate` after Anxious or Overwhelmed is
  gone. Closing line: "The page is clear."
- **Set it down.** The weight never travels faster than 85 px/s and chases
  the finger with a lag. A finger that gets 68 px ahead has rushed it: the
  grip slips, the weight floats back, and the hint reads "Slower — let it
  take its time." Past 86 % of the track it lands on its own, keeping its
  arriving speed and then only slowing. It lands onto a real ground: the
  shadow grows as it nears, the trail and path fade, two mist puffs rise,
  and there is a small squash. Holding ArrowDown, Space or Enter lowers it
  at the same pace (no more one-press finish). The mascot's gaze follows the
  weight down. Closing line: "Set down. It can stay there."
- Both acts end with Back home plus a quiet "Once more", and the copy swaps
  in place so nothing jumps.
- Three fallback invitations had repeated the catalog word ("That wired
  feeling", "Restless?", "the anxious part"), which is what `cleanInvite`
  refuses from the model. They have been rewritten, and a test now holds
  every fallback to the same rules.

Verified: the anna suite (148 tests, 15 new for the acts); browser QA with
two new cases (draw → mist → clear, resize keeps ink, keyboard draw; a flick
slips, a slow pull lands, a key hold lands without hurrying). A browser
probe showed the remaining ink's centre climbing 170 → 129 → 77 → 32 px and
the mist rising and gone by about 3.05 s. With 4,480 ink points, frames
stayed at 16.7 ms p50 and 16.8 ms p95 (desktop headless; not measured on a
phone). The weight path was linear at the finger's pace, then
142.7 → 158.2 → 161.4 → 162 px. At 320×568 everything fits with no overflow,
and reduced motion uses opacity only (no transforms, no puff animation).

**Published same-day as v0.4.2** (version_id=1994, `apps publish --bump
patch`; bundled tool unchanged at 0.4.5/executa_version 1012, binaries
deduped, reset-offer skill at 767) and re-pinned via `apps submit-review`
— the review pin moved from v0.4.1 to v0.4.2. Store metadata unchanged
(the listing's Scatter/Set it down copy still describes the acts). No
tier-3 run before the re-pin; the change is bundle-only (no prompt, tool or
manifest change).

### 12.26 The card stays faithful (2026-11-12, local, unpublished)

Review rejected the pin again on two points. The test sentence was "I
manage 3 projects and I added one deadline in the same week." The card
said 4 projects, the practice note repeated it, and a Friday clock time
appeared that the person never wrote. The second point was that the model
felt bolted onto a breathing app.

The answer is one loop. A fresh open lands on the conversation form.
Breathing, Arrive, and alertness stay behind "Something other than the
conversation," and the home breathing break stays hidden until a card
exists. The listing, the system prompt, and the tool catalogue lead with
the preparation card. `brume_prepare` is the chat-path result;
`brume_get_ready` (the older timed script) was removed in 0.4.7.

Faithfulness is a check after parse, in the workspace and in the plugin:

- Counts (digits and number words; "3" matches "three"), weekdays, and
  clock times in a model field must already be in the person's own text.
  Hyphenated compounds are scrubbed first, so "one" inside "one-on-one"
  is not a count. A failing objection becomes "What makes this hard?";
  every other failing field is blanked for the person to write. The
  workspace retries the model once and names the dropped spans. The
  plugin refuses the whole card and writes nothing.
- A kept fact is marked under that line ("From what you wrote: 3"). A
  blanked line names the field and the kind of fact, focuses that field,
  and the sprite looks at it.
- If the person mentions a deadline in the same week and names no day
  and no clock time, one question is asked before any draft: which day
  the card should name, if any. Skip leaves the next step unscheduled.
  That question uses the only clarify slot.
- A rehearsal note is shown only when it repeats the practice reply
  (three words in a row, or the whole reply when it is shorter). The
  rehearsal check reads the person's words, not the earlier draft, so a
  bad plan cannot launder a fact.
- The saved record, the copy, the download, and the chat display lead
  with one sayable paragraph: opening, key point, and next step.

Source tool version is 0.4.6. The published review pin is still v0.4.2
(version_id 1994) and the GitHub binaries are still
`brume-executa-v0.4.5`. Do not `apps publish` until the binaries workflow
has produced the four archives and a fresh-install Cloud Agent chat has
passed the three-projects sentence. That sentence is tier-3 step 2 in
`anna/README.md`, and `anna/test/browser-qa.mjs` runs it against the fake
host.

Verified locally: `npm test` in `anna/` (211 smoke checks, 152 unit
tests), `python3 -m unittest test_plan` (21), and the reviewer browser
case (`CASE="reviewer case"`). The full browser suite was not re-run.
The gate covers counts, weekdays, and clock times. It does not catch
every invented proper noun. On the chat path, `event` and `goal` are
treated as the person's words.

### 12.27 The oracle becomes the user's own words (2026-11-13, local, unpublished)

The 12.26 gate still trusted model-written text: `brume_prepare` checked
fields against `event` + `goal`, which the same model writes — a fact
invented into `event` grounded itself. The workspace handoff had the same
hole, a missing `mode` fell through to a breathing plan, and a complete
handoff draft skipped the deadline question entirely. The check itself
missed ordinals, month names, `tomorrow`, `noon`, `a couple`, and
`o'clock`.

The contract now takes `user_words` (required, ≤1500 chars): everything
the user actually said, copied verbatim, including answers to follow-up
questions. `event`, `goal`, and all six fields are checked against it —
nothing the model writes can ground itself. It is a strong heuristic, not
a proof: a model that misquotes `user_words` still defeats it, so the
workspace (human-typed source, human-edited draft) remains the default
path and `brume_prepare` is for explicit in-chat requests only.

Changes (tool 0.4.7, app 0.4.3):

- Plugin: `user_words` oracle; deadline-without-day returns
  `needs_input: "deadline_day"` instead of refusing — the model asks once
  and retries with the day inside `user_words`, or sets
  `schedule_unspecified: true` when the user chose no day (the stateless
  equivalent of the workspace skip). `brume_get_ready` removed from the
  manifest, dispatch, and implementation — three tools remain.
- Widened fact vocabulary in both implementations, kept in parity through
  the new `faithfulness` and `deadline_day` sections of
  `test/plan-cases.json`: ordinals (`the 14th`, `fourth`), month names,
  `today/tomorrow/tonight/yesterday`, `noon/midday/midnight`, `weekend`,
  vague counts (`a couple`, `a few`, `a dozen`, `several`), relative
  spans (`next week`, `in the morning`, `end of the week`), and
  `o'clock`. `at 3 o'clock` yields one `3 o'clock` phrase, not a stray
  `at 3` token.
- Workspace: missing `payload.mode` now defaults to `ready`, not `reset`.
  A complete handoff draft goes through the same deadline question as the
  typed path (`pendingHandoffPlan`, snapshotted at `clarify` so it
  survives a window close); the answer joins the source and the draft is
  re-checked before the card renders.
- System prompt addendum: workspace is the default, `brume_prepare` only
  on explicit in-chat asks, `user_words` rules spelled out,
  `needs_input` → ask once then retry, breathing explicitly requested
  only.
- `brume-reset-offer` skill repointed from a 90-second break to a
  preparation offer (named upcoming conversation, high-stakes send, or a
  dreaded one; never generic stress, never auto-opens).
- `app.json` listing compressed: Arrive and the alertness check are one
  line each; version bumped to 0.4.3 for the next `apps publish`.

Verified locally: `python3 -m unittest test_plan` (30), `npm test` in
`anna/` (smoke covers every fixture case against `preparation.js`), and
the manifest regenerated from `describe` (3 tools, `user_words` +
`schedule_unspecified` params). NOT yet done — the four binaries are not
built, nothing is published, and no fresh-install Cloud Agent chat has
run the three-projects sentence. The publish order stays: binaries
workflow → `anna-app validate --strict` → `apps publish` → tier-3 →
Developer Console resubmit.

### 12.28 The card leaves chat entirely (2026-11-13, local, unpublished)

12.27's `user_words` oracle was still model-written — a model that quotes
its own invention verbatim defeats it, and the `preparation` handoff had
the same shape (a draft checked against model-written context). The
schema survey settled it: `agent.session.*` is run history, not the chat
transcript, and the plugin's reverse-RPC surface is only `storage/*` plus
`sampling/createMessage`. There is no capability that could ever hand
the tool the user's message, so no chat-saved card can be checked
against it.

The answer is to remove the path, not patch it (tool 0.4.7):

- `brume_prepare` removed from the plugin — manifest, dispatch, and all
  the faithfulness machinery that served it. Two tools remain,
  `brume_reset` and `brume_complete`, described as what they are: the
  optional breathing break. The manifest description says the card lives
  in the window.
- `open_app_view` payloads are prefill-only. `parseReadyHandoff` ignores
  `preparation` entirely — a model-written draft can no longer reach the
  card, labelled or not. Every ready payload lands on the input screen;
  the person reads (and can edit) the situation, presses Prepare, answers
  the clarify question if it fires, and the draft is written in-window
  from what they submit. `pendingHandoffPlan`/`resolveHandoffClarify`
  and the handoff label are gone.
- The system prompt drops the `preparation` block and all `brume_prepare`
  instructions (addendum 3996 → 2843 chars): "If the user asks to prepare
  in chat rather than the window, explain that the card is prepared in
  the window where they can see and keep every word, and open it the same
  way."
- `phraseTokens` canonicalises `the same X` → `this X` (week, weekend,
  month, day): restating the person's own span is not a new fact, and the
  reviewer sentence's "in the same week" was otherwise a false positive
  on a faithful draft.
- `app.json`: the breathing break is now one line beside Arrive and the
  alertness check.

The oracle story is now true end to end: every saved card passed through
text the person saw on screen (prefilled or typed), a draft they could
edit, and their own save tap. The faithfulness gate still checks the
in-window draft against the submitted source — model drafts can still
invent, and the check still withholds those spans — but no model-written
string is ever the oracle.

Verified locally: `python3 -m unittest test_plan` (16), `npm test` in
`anna/` (152 unit + 238 smoke, incl. new `same week` fixture cases),
`anna-app validate --strict`, and browser-qa cases: reviewer case,
prefill-only handoff, malformed draft ignored, and the dayless-deadline
prefill → ask → in-window draft flow. NOT yet done — binaries, publish,
fresh-install Cloud Agent run, resubmit.

### 12.29 The gate catches the fixtures too (2026-11-13, local, unpublished)

Four browser-QA cases (reset-session reload, failed card save, mobile
320, saved-wording/preserve) had been red since the faithfulness gate
landed in 12.26 — typed contexts like `"x"` never grounded the fake
host's `DEFAULT_PLAN`, so `keyPoint`'s "two more people" was correctly
withheld, `prepCardComplete` stayed false, and every flow wedged at
`screen-prep-plan`. The suite was never re-run after the gate, so the
breakage read as new. The gate was right; the fixtures were the bug.
Each context now states the plan's facts (`test/browser-qa.mjs`): the
reviewer sentence is unchanged, the rest name "two more people" in the
event or goal. Full suite 34/34 green — first clean run since the
card-completeness gate existed.

### 12.30 The agent needs a result it can produce (2026-11-13, local, unpublished)

The next review pass found the two holes the 12.28 design traded for:

- **The chat surface was breathing-only.** With `brume_prepare` gone, the
  only tools were the break (`brume_reset`, `brume_complete`) — and the
  catalogue described them as exactly that. The review scores the server
  log of the declared result, and the only successful tool result a chat
  could produce was a breathing session — "a timer with an AI line."
- **Prefill had become the unchecked oracle.** `open_app_view` prefills
  model-written `context`/`goal`/`key_point` into the form, and the
  faithfulness gate checks the draft against those same fields. Invented
  prefill produced a "grounded" draft: the invention moved from the card
  into the situation box, and a reviewer who reads the result instead of
  editing the form would never see it.

`brume_prepare` returns in 0.4.8 — as a deterministic front end, not a
card-saver:

- `situation` (the model's relay of the user's words) + optional
  `goal`/`key_point`/`preserve`. A dayless same-week deadline →
  `needs_input` with the question — the reviewer sentence now produces
  the ask in chat, as a logged tool result, before any window opens.
  Retry with `deadline_day` or `schedule_unspecified` → `open_window`
  with the `open_app_view` payload. `_schedule_question` is a 1:1 port
  of `scheduleQuestion` in `bundle/preparation.js`, pinned by the
  `deadline_day` fixture cases on both sides. It saves nothing and
  returns no card fields — a state machine, not a formatter.
- In the window, prefilled fields are marked: `prep.sourceProvenance`
  (`typed` | `handoff` | `confirmed` | `edited`). Handoff prefill shows
  "Anna wrote this from your message" and disables Prepare until the
  person edits a field or taps "This is what I said" — a card can no
  longer exist without the person engaging the source. `recovery.js`
  validates the field; old checkpoints default to `typed`.
- The card carries its source: a "Prepared from" block quotes the
  submitted situation — "your words", "Anna's summary… you confirmed",
  or "you corrected Anna's summary" — so an invented situation appears
  on the result itself instead of hiding upstream. Stored on the card
  record and re-rendered by `showLastPreparation`.

The ceiling is honestly stated: nothing in this protocol can compare
model-written prefill to the user's message, so the product now makes
the comparison the person's job — structurally required before Prepare,
and legible on the card after. Verified: `test_plan` 23 (interview
contract + fixture parity), `npm test` 152 + smoke, browser-qa 35/35
(new gate case, confirm path in the dayless flow, card-source
assertions), `anna-app validate --strict`.

Release so far: `brume-executa-v0.4.8` binaries (all four, smoke incl.
the interviewer contract) and app cuts 0.4.5/0.4.6. The proactive
skill turned out to still be the Oct-17 breathing-break offer — the
imported `skill-u3f06a4c-…` is owned by another identity, so
`executa publish` minted our own `skill-papa-brume-reset-offer-w4p5ngnh`
(v1.0.1, preparation-offer content) and `optional_executas` now
references it; 0.4.6 (id 2220) freezes it. NOT done: tier-3 fresh
install + resubmit.

### 12.31 The chat path makes the card, and the person states its facts (2026-11-13, local, unpublished)

The next review pass had three points, and they pulled against each
other: the chat surface never produced the declared primary result (a
saved preparation card) — the only thing a chat could produce was a
breathing session, "a timer with an AI closing line"; the prefill was an
unchecked oracle, so an invented fact ("4 projects", "Friday at 3pm")
was laundered through one tap; and the published cuts were skewed
(0.4.2/0.4.5) against the source (0.4.6/0.4.8), so the tree could not
be installed and judged.

**The constraint that decides the shape.** The plugin's reverse-RPC
surface is `storage/*` plus `sampling/createMessage`; the tool call
carries `arguments` and an `invoke_id`. There is no transcript. So
model prose can never be checked against the user's message, and any
card built from a model relay inherits the relay's inventions. The
answer cannot be "check the model's prose" — it has to be **"never let
the model's prose be the fact"**.

**So the chat path asks for the facts.** `brume_prepare` is now the
card, in two steps (tool 0.4.9):

- Step 1 takes `situation` (the model's relay), the optional
  `goal`/`key_point`/`preserve` the user stated, and the model's own
  draft in `draft_opening`, `draft_key_point`, `draft_approach`,
  `draft_objection`, `draft_response`, `draft_next_step`. It scans the
  draft for facts and answers `needs_input` with **one question per
  fact, with the value masked** — "Your draft says “You are juggling …
  projects”. How many?" — plus the deadline question when a same-week
  deadline has no day. The person states each value.
- Step 2 takes `request_id` and `answers` (one "id = answer" per
  question). The tool replaces the model's value with the person's,
  re-checks the card against the answers, writes `ready/sessions/<ts>`
  and `ready/last`, and returns the card in `_display` blocks.

The card's facts are therefore *the values the person stated*: "four
projects" cannot survive, because "four" was masked and the answer was
"three". A fact the person does not confirm leaves its field blank
(the same rule the window applies to an ungrounded draft), and the card
records every question and answer, so the transcript of the card is
auditable. The deadline question is now unskippable by construction:
`deadline_day` and `schedule_unspecified` are gone from the tool's
parameters — there is no way to hand the tool a day it has not asked
for.

**The prefill is no longer an oracle either.** In the window, Anna's
reading of a chat message is shown as a *suggestion* — read-only, above
the form — and the fields start empty. Prepare stays off until the
person writes the situation, so the source of a window card is text
they typed and the truth-conferring "This is what I said" tap is gone.
`parseReadyHandoff` returns a suggestion, not an input; `recovery.js`
validates it.

**The scanner became a shared contract.** `scanFacts` in
`bundle/preparation.js` is now the single implementation of the fact
vocabulary (counts, ordinals, weekdays, clock times, relative days,
months, phrases), with the spans it occupies, and `ungroundedSpans` is
built on it. `brume_plugin.py` ports it 1:1; the new `fact_scan`
section of `test/plan-cases.json` (25 cases) runs against both sides.
The plugin also ports `ungrounded_spans`, so the chat card and the
window card are checked by the same rule.

**Versions.** Tool 0.4.9 (`executa.json`, `pyproject.toml`, `VERSION`,
`manifest.json` regenerated from `describe`), app 0.4.7, prompt
addendum rewritten for the two-step contract, the proactive skill
updated, the listing rewritten ("a chat message prefills the situation
… it is marked as Anna's reading, not as your words").

Verified locally: `npm test` in `anna/` (152 unit + smoke, incl. the
new `fact_scan` parity), `python3 -m unittest test_plan` (27, incl. the
card flow, the masking, the substitution and the unskippable day),
`anna-app validate --strict` (one pre-existing warning about retired
manifest fields). NOT verified: the browser QA suite — `agent-browser`
is not installed in this environment — and the binaries, the publish,
the tier-3 fresh install and the resubmit. The three-projects sentence
must now be answered by the *person* in chat, and the saved card must
show their values.

### 12.32 Qualification window extended to 31 March 2027 (2026-11-13)

Community announcement on the Founding Builder thread
([topic 205](https://forum.anna.partners/t/turn-your-ai-agents-apps-into-recurring-monthly-grants-join-the-anna-ai-os-founding-builder-program-up-to-80k-month-pool/205)):

- New deadline: **March 31, 2027**. A builder can qualify in any calendar
  month before that date. Each month stays an independent measurement
  cycle.
- Portfolio calculation rules are unchanged, and the marketing-support
  initiatives stay in effect. Outstanding apps still get dedicated
  marketing and featured promotion from the Anna team.

The extension moves the MAU clock. It does not change review, the
qualified-run definition, or the AI-native rule in §12.1.

### 12.33 The cut is published — app v0.4.7, tool 0.4.9 (2026-11-13)

The 12.31 change shipped the same day it was written. Commit `812c7d5`
(24 files) went to `main`; the **Brume Executa Binaries** workflow
(run 43497302363) built and smoked all four platforms and published
GitHub release `brume-executa-v0.4.9`; the four archives were pulled
into `executas/brume/dist/` and every `.sha256` verified. `anna-app
apps publish` (no bump — `app.json` already declared 0.4.7) registered
the bundled executa unchanged at v0.4.9, synced the protocol manifest,
uploaded the four binary artifacts (`executa_version=1103`), froze the
reset-offer skill at 1098 (v1.0.1), and cut **app v0.4.7**
(`version_id=2272`) — now the server's `latest`. App status stays
`rejected`; the review pin is still v0.4.2 until `submit-review`.

Verified this round that §12.31 could not: `npm run test:browser`
passed **35/35** on the fake host, including the reviewer-case test —
"I manage 3 projects and I added one deadline in the same week" keeps
three, drops four/Friday/a clock time, and Anna's chat reading gates
Prepare until the person writes the situation.

Still outstanding, in order: the tier-3 fresh-install Cloud Agent
checklist (`anna/README.md`, each step a new chat — install v0.4.7,
confirm `brume_prepare` is callable, run the three-projects sentence,
the chat-card variant, reset/reflect/arrive/alertness), then
`anna-app apps submit-review brume` to re-pin the review to v0.4.7 /
tool 0.4.9. `apps release` is refused while status is rejected — the
console path is submit-review → approval → release.

### 12.34 The answers move into the window — tool 0.4.10, app 0.4.8 (2026-11-14, local, unpublished)

The 0.4.9/0.4.7 cut was reviewed again and failed on the point §12.31
could not fully close: **the second call still trusted the model to be
the user.** Phase 2 accepted `answers` as tool arguments, and nothing in
the protocol is the person's reply — a model that answered its own
masked questions with "four" and "Friday" wrote that card under a line
reading "Prepared from what you told me." Two smaller findings rode
along: the chat card's "Key point" came from the first call's
`key_point` relay, which was never scanned, and names, roles and motives
in any field never became questions, so the model's sentences around a
replaced number survived untouched.

The fix removes the channel entirely rather than trying to authenticate
it. `brume_prepare` (tool **0.4.10**) is now a single call: it takes the
same `situation`/`goal`/`key_point`/`preserve`/`draft_*` arguments —
`request_id`, `answers`, `deadline_day` and `schedule_unspecified` are
gone from the manifest — scans every draft field including
`draft_key_point`, and returns `open_window` with an `open_app_view`
payload carrying the draft fields. The window's new "Confirm the
details" stage (`screen-prep-interview` in `bundle/app.js`) recomputes
the masked questions itself via `factQuestions` + `scheduleQuestion`,
shows Anna's reading as a suggestion only, and collects one typed
answer per fact. `applyAnswers` substitutes the person's values into
every field carrying the fact — a deduped fact is replaced everywhere,
not just where it was first seen — and a fact left blank blanks every
field carrying it. The substituted draft then passes the same
`faithfulnessIssues` gate a model draft does, lands on the ordinary plan
stage for review, and the card saves through the existing path with a
`facts`/`blanked`/`deadlineDay` audit so a reviewer can compare the card
against exactly what the person typed. "Write it myself instead" drops
back to the manual form, which was already person-sourced.

The contract moved with it: `preparation.js` gained `factQuestions`,
`maskedContext`, `applyAnswers`, `scheduleDay`, `questionFor` and
`CARD_FACT_FIELDS`; the plugin keeps the 1:1 Python port
(`_fact_questions`/`_apply_answers`) for parity; `plan-cases.json` gained
an `interview` section — now nine cases including cross-field dedupe —
run by both `npm test` and `python3 -m unittest test_plan`. The
`system_prompt_addendum`, the reset-offer skill, `app.json` copy and the
executa README all describe the one-call `open_window` flow and state
plainly that the tool accepts no answers.

Versions: tool **0.4.10** (`executa.json`, `pyproject.toml`, plugin
`VERSION`, regenerated `manifest.json`), app **0.4.8** (`app.json`).
Local gates: `npm test` 152+ smoke green, `test_plan` 24 green,
`anna-app validate --strict` clean, browser QA extended with two
interview cases (masked questions → typed answers → `ready/last` record
with audit; declined facts blank their fields). Remaining, in order:
commit, the 0.4.10 binaries workflow, download + checksum, `apps
publish`, the tier-3 fresh-install Cloud Agent checklist (rewritten for
the window interview), then `apps submit-review`.

### 12.35 The interview cut is published — app v0.4.8, tool 0.4.10 (2026-11-13)

§12.34 shipped the same day it was written. Commit `8d11e85` (23 files)
went to `main`; the **Brume Executa Binaries** workflow (run
43505664377) built and smoked all four platforms — the smoke now
drives the one-call `open_window` contract — and published GitHub
release `brume-executa-v0.4.10`. The four archives were pulled into
`executas/brume/dist/` and every `.sha256` verified. `anna-app apps
publish` (no bump — `app.json` already declared 0.4.8) registered the
bundled executa unchanged at v0.4.10, synced the protocol manifest,
uploaded the four binary artifacts (`executa_version=1104`), froze the
reset-offer skill at 1098 (v1.0.1), and cut **app v0.4.8**
(`version_id=2273`) — now the server's `latest`. App status stays
`rejected`; the review pin moves only on `submit-review`.

Local gates this round: `npm test` 154 green (incl. new recovery cases
pinning the interview stage), `test_plan` 24 green, `validate --strict`
clean, browser QA **37/37** including the two interview cases — masked
questions → typed answers → `ready/last` with the facts audit, and
declined facts blanking their fields.

Still outstanding, in order: the tier-3 fresh-install Cloud Agent
checklist (`anna/README.md`, rewritten for the window interview — each
step a new chat: install v0.4.8, confirm `brume_prepare` is callable,
run the three-projects sentence and watch `open_app_view` open
"Confirm the details", type the answers in the window, verify
`ready/last`; then the chat variant, reset/reflect/arrive/alertness),
then `anna-app apps submit-review brume` to re-pin the review to v0.4.8
/ tool 0.4.10.

### 12.36 The card is written by the person, field by field — tool 0.4.11, app 0.4.9 (candidate)

§12.34–12.35's window interview was rejected on two counts, and both
were structural, not copy:

1. **A fact-free draft skipped the interview entirely.** A draft that
   asserted nothing scanned produced an empty question list, "Continue
   to my draft" stayed enabled, and the model's sentences saved as the
   card with `sourceProvenance: "answered"`. Meanwhile Anna's reading on
   the same screen could still show "4" and "Friday".
2. **Token substitution left the model's sentences.** "Tell Priya you
   manage …" + the typed "three" stayed "Tell Priya you manage three."
   The name, the role, the motive survived; only the scanned token
   changed, and the card's quoted "source" was the bare answer while
   the body was still the model's prose.

The fix removes substitution altogether. `brume_prepare` (tool
**0.4.11**) still takes the situation plus the model's draft fields and
still returns `open_window` with an `open_app_view` payload — but the
payload's `interview.fields` is now masked *reference* only. The
window's "Write your card" stage (`screen-prep-interview`) shows Anna's
reading as a labelled suggestion, renders one labelled block per
drafted field with `maskFacts` applied ("Anna's draft — for reference,
not the card"), and gives the person a textarea per field. Nothing
model-written is ever substituted into anything; blank fields are
dropped; an interview with no typed field refuses to continue. The
saved card records `interview: { draft, written, deadlineDay }` — the
model's draft beside the person's own words — and
`sourceProvenance: "answered"` now means "the person wrote every part".

The deadline-day prompt keys on the *suggestion* (the relay of the
person's words), never on the draft, which could invent a deadline.
`preparation.js` lost `factQuestions`/`maskedContext`/`applyAnswers`/
`questionFor`; it keeps `scanFacts` (the faithfulness gate and the
shared vocabulary) and gains `maskFacts` + `scheduleDay`. The plugin
lost `_fact_questions`/`_apply_answers`/`_schedule_question` the same
way; `test_plan.py` asserts the manifest carries no `answers`,
`request_id`, `deadline_day` or `schedule_unspecified` parameters.

Versions: tool **0.4.11** (`executa.json`, `pyproject.toml`, plugin
`VERSION`, regenerated `manifest.json`), app **0.4.9** (`app.json`).
Local gates: `npm test` 154 green, `test_plan` 22 green,
`anna-app validate --strict` clean, browser QA **37/37** — the two
interview cases now write all six fields and assert no draft value
reaches `ready/last`, plus the fact-free-draft case proves an empty
interview cannot save.

Shipped the same day: commit `d82c2f3` to `main`; the **Brume Executa
Binaries** workflow (run 43512290546) built and smoked all four
platforms and published GitHub release `brume-executa-v0.4.11`; the
four archives were pulled into `executas/brume/dist/` and every
`.sha256` verified, and `smoke_binary.py` passed against the local
darwin-arm64 build. `anna-app apps publish` registered the bundled
executa unchanged at v0.4.11, synced the protocol manifest, uploaded
the four binary artifacts (`executa_version=1105`), froze the
reset-offer skill at 1098 (v1.0.1), and cut **app v0.4.9**
(`version_id=2274`) — now the server's `latest`. App status stays
`rejected`; the review pin moves only on `submit-review`.

Still outstanding, in order: the tier-3 fresh-install Cloud Agent
checklist (`anna/README.md` — install v0.4.9, confirm `brume_prepare`
is callable, run the three-projects sentence and watch `open_app_view`
open "Write your card", write every field, verify `ready/last` and the
`interview` audit; then the chat variant, reset/reflect/arrive/
alertness), then `anna-app apps submit-review brume` to re-pin the
review to v0.4.9 / tool 0.4.11.

### 12.37 The chat path produces a real AI card — tool 0.4.12, app 0.4.10 (candidate)

§12.36's person-writes-every-field interview was rejected on the deepest
ground yet: **the chat path no longer produces the result at all**. The
tool's draft was masked reference and thrown away; the window asked the
person to write six fields; the saved card was a storage write of typed
text with no `llm.complete` on that path — and staff had already said a
storage write alone is not a qualified run, because the primary value
has to depend on the model's reasoning. The masked reference also still
showed every invention the fact scanner does not know: "Tell Priya you
manage four projects on Friday" displayed as "Tell Priya you manage …"
— the name sat on the review screen above the empty boxes.

The fix is subtraction. `brume_prepare` (tool **0.4.12**) is now a pure
relay: `situation` plus stated `goal`/`key_point`/`preserve` — the six
`draft_*` parameters are gone from the manifest, along with the
`interview` payload, `maskFacts`/`scheduleDay`/`CARD_FACT_FIELDS`, the
window's interview stage, and the plugin's entire fact scanner
(`scan_facts`/`ungrounded_spans`, ~200 lines — the window owns the
faithfulness gate now). What remains is exactly the pipeline the
reviewer already accepted in the window: `open_app_view` opens the
ordinary preparation form with Anna's reading as a suggestion, the
person writes the situation in their own words, Prepare stays off
until they do, `faithfulPlan` makes the `llm.complete` call, the
faithfulness gate withholds ungrounded spans, and the card saves
quoting the typed source with `planSource: "ai"` and `planModel` set.

The display hole closes with `maskReference` (preparation.js): the
suggestion quote now masks scanned facts AND every capitalised token
that does not open a sentence — names like "Priya" are not facts the
scanner knows, but they are still the model's words, so they mask too
("Tell … you manage … projects …."), while sentence-initial capitals
and first-person pronouns survive. Model prose is never shown raw.

Versions: tool **0.4.12** (`executa.json`, `pyproject.toml`, plugin
`VERSION`, regenerated `manifest.json`), app **0.4.10** (`app.json`).
Local gates: `npm test` 152 green, `test_plan` 20 green,
`anna-app validate --strict` clean, browser QA **37/37** — the two
handoff cases now assert the masked suggestion hides names and facts,
Prepare gates on typed words, an `llm.complete` runs on the chat path,
and `ready/last` carries `planSource: "ai"` with no relay invention.

Shipped the same day: commit `b330b19` to `main`; the **Brume Executa
Binaries** workflow (run 43518994954) built and smoked all four
platforms and published GitHub release `brume-executa-v0.4.12`; the
four archives were pulled into `executas/brume/dist/` and every
`.sha256` verified, and `smoke_binary.py` passed against the local
darwin-arm64 build. `anna-app apps publish` registered the bundled
executa unchanged at v0.4.12, synced the protocol manifest, uploaded
the four binary artifacts (`executa_version=1106`), froze the
reset-offer skill at 1098 (v1.0.1), and cut **app v0.4.10**
(`version_id=2275`) — now the server's `latest`. App status stays
`rejected`; the review pin moves only on `submit-review`.

Still outstanding, in order: the tier-3 fresh-install Cloud Agent
checklist (`anna/README.md` — install v0.4.10, confirm `brume_prepare`
is callable, run the three-projects sentence, write your own words in
the window, verify the model-drafted card under `ready/last`; then the
chat variant, reset/reflect/arrive/alertness), then
`anna-app apps submit-review brume` to re-pin the review to v0.4.10 /
tool 0.4.12.

### 12.38 The gate learns names — tool 0.4.13, app 0.4.11 (candidate)

§12.37 made the chat path produce a real AI card and masked the relay,
but the reviewer's name objection survived it in two places, and both
are the same class the fact scanner does not know. The card's own
faithfulness gate (`ungroundedSpans`) scanned counts, weekdays, dates
and clock times — not names — so a window draft reading "Tell Priya the
extra project can move" saved untouched: "four" and "Friday" were
withheld, "Priya" was not a fact the scanner could see. And
`maskReference` let *any* sentence-initial capital survive, so the
suggestion still showed "Priya needs the update" on the review screen
above the empty boxes. A name is not a count, but it is still the
model's invention, and the person never wrote it.

The fix is an **entity gate** beside the fact gate. `scanEntities`
(preparation.js) flags every capitalised token that is neither a
first-person pronoun nor an allowed sentence opener; `ungroundedSpans`
grounds each against the person's typed words (case-insensitive, facts
deduped first so "Friday" stays a weekday not a name) and blanks the
field exactly like an ungrounded count, with one retry. `spanKind`
labels it `name`, so the message reads "Opening added a name you didn't
write." `maskReference` now uses the *same* opener allowlist, so a name
that opens a line masks too — only the closed opener set survives, and
the suggestion and the gate agree. The plugin's `brume_prepare`
describe also constrains the visible chat reply: say only that you are
opening the window, do not restate counts, days, times or names from
what the user said. The prompts name the rule outright ("Name only
people the person has already named").

The ambitious part was the opener signal, and the honest result is a
rejection. A **frequency-list inversion** was prototyped — treat the
top-N corpus words as openers, flag everything else — and measured
against the fixtures: it leaks 5–8 invented names where the allowlist
leaks a documented few, because corpus frequency lists are saturated
with proper names (john@372, sam@3386, sarah@3524…). Inverting
frequency would *exempt* invented names and write them into the saved
card — the exact failure the gate exists to prevent. So frequency is
used only **offline**, to audit the open tier for gaps, never at
runtime. The runtime signal stays a **closed set**, deliberately: it
errs toward flagging (a rare opener is withheld and retried — the safe
direction), never toward exempting.

Two tiers, honest about which is complete:
- `FUNCTION_WORDS` — the finite grammatical core (pronouns,
  determiners, prepositions, conjunctions, auxiliaries/modals, question
  words). Enumerable and complete; none are names except the modals
  Will/May.
- `CARD_OPENERS` — the open lexical class (imperative verbs, situation
  nouns, discourse markers). Best-effort, kept complete by
  `scripts/audit-openers.mjs` plus the one retry. ~39 reviewed safe
  openers were added from the audit (Help/Use/Know…,
  Time/People/Business…, Personally/Frankly/Hopefully…).

`SENTENCE_OPENERS` is the union and drives both `scanEntities` and
`maskReference`. The bounded name-leak surface is exactly
**{Will, May, Hope}** — frequent legitimate openers that double as given
names ("Will you…", "May I…", "Hope you're well"); exempt at sentence
start, flagged mid-sentence. `npm run audit:openers -- --check` fails if
that surface ever grows. The audit's precision name set is raw corpus
frequency minus a no-names frequency list (509 corpus-curated names);
broad name lists (forbes/Unix propernames) were dropped because they
inject junk ("the", "think", "just", "my") that would mislabel the
surface.

Versions: tool **0.4.13** (`executa.json`, `pyproject.toml`, plugin
`VERSION`, regenerated `manifest.json`), app **0.4.11** (`app.json`,
whose description now says "a count, a day, a time or a name you did not
write"). Local gates: `npm test` (smoke + 157 unit) green, `test_plan`
20 green, `anna-app validate --strict` clean (one pre-existing
retired-field warning), `audit:openers --check` exit 0 (surface
{Hope, May, Will}), browser QA **38/38** — a new case drives the
window's own model to draft an invented name and asserts the field is
blanked after one retry while the clean fields survive. New fixtures:
`fact_scan` name cases (invented at sentence start and mid-sentence,
grounded reuse, case-insensitive grounding, name+count together) and
`mask_reference` sentence-initial-name masked.

Still local and unpublished. Outstanding, in order: the tier-3
fresh-install Cloud Agent checklist against v0.4.11 (the reviewer's
three-projects sentence must save a card with no invented name), then
the **Brume Executa Binaries** workflow for tool 0.4.13, `anna-app apps
publish --bump patch`, and `anna-app apps submit-review brume` to move
the review pin off v0.4.2.

### 12.39 The gate learns addressees — app 0.4.12, tool 0.4.13 (candidate)

§12.38 closed the capitalised-name hole, and a reviewer pressed on what
it left open: a card can still invent a *lowercase* person. "Tell your
manager the extra project can move" asserts a specific addressee the
person never stated, and the name gate cannot see it — "manager" is not
capitalised, so `scanEntities` skips it and the field saves untouched.
The same critique named three other surfaces, and the honest answer
splits them into what a span scanner can close and what it cannot.

The fix is a **role gate** beside the name gate, deliberately narrow.
`scanRoles` (preparation.js) matches a possessive determiner + a role
noun — "your manager", "my boss", "their client" — against a closed
`ROLE_NOUNS` vocabulary, and `ungroundedSpans` grounds the role against
the person's typed words exactly like a name (tolerant of plural and
possessive 's, so "your managers" is grounded when the person wrote
"manager"). `spanKind` labels it `role`, so the message reads "Opening
added a role you didn't write." The prompts name the rule ("Do not
assign an addressee role the person did not state") and the retry
strings carry it.

The ambitious part, again, is a rejection measured against the fixtures.
A **blanket role-noun gate** — flag any role noun not in the source — was
prototyped first and blanked ~33% of legitimate cards, including this
app's own test plan ("the current team", "the same team"): role nouns
are common nouns, so a closed vocabulary over-withholds the generic
groups a card legitimately uses. The **possessive subset** is the
high-precision signal — a specific addressee ("your manager"), not a
generic group ("the team") — and measured ~7% false positives with zero
fixture regressions and the test plan intact. So the blanket tier was
reversed out and the narrow one shipped. "head" and "report" were
dropped from `ROLE_NOUNS` for the same precision reason ("your report"
is a document, "your head" a body part, not a person).

What stays **bounded**, written down rather than promised away:
- Non-possessive roles ("a colleague", "the stakeholder") and motives
  ("because they are behind schedule") still pass. Motives are open
  prose no span scanner can ground; the prompt and the person's review
  carry them. The role gate is internal defense-in-depth, not a complete
  role guarantee.
- The user-facing claim stays the **absolute classes** — "a count, a day,
  a time or a name you did not write" (app.json unchanged). The role tier
  is not added to the promise: under-promise the mechanical guarantee,
  over-deliver quietly.
- The name-leak surface is still exactly **{Will, May, Hope}** — the
  documented sentence-initial trade ("Hope can take the extra project"
  keeps Hope at the start of a line). `audit:openers --check` pins it.
- The visible **chat reply** is constrained by instruction, not by a
  check: the relay protocol offers no transcript to verify the model's
  bubble against, so "say only that you are opening the window" is a
  prompt rule the card gate cannot enforce. The card is mechanically
  gated; the bubble is prompt-bounded, and that difference is honest.

Versions: app **0.4.12** (`app.json`); tool stays **0.4.13** — the gate
change is window-only (`preparation.js`, `preparation-prompts.js`). The
plugin's relay logic and `describe` are unchanged (a stale module
docstring that still claimed a fact-scanner port was corrected to match
the window-owns-the-gate architecture); the manifest is `describe`-derived,
so no regeneration or tool bump. Local gates: `npm test` (smoke + 161
unit) green, `test_plan` 20 green, `anna-app validate --strict` clean (one
pre-existing retired-field warning), `audit:openers --check` exit 0
(surface {Hope, May, Will}), browser QA **38/38**. New fixtures: 12
`faithfulness` role cases (invented addressee at sentence start and
mid-sentence, grounded reuse, case-insensitive grounding, generic group
kept, non-possessive bounded miss, plural invented/grounded, singular
grounded by plural source, name+role and count+role together, imperative
"Lead" kept) and 4 unit tests pinning the withhold, the grounding, the
bounded scope and `scanRoles`.

Still local and unpublished. Outstanding, in order: the tier-3
fresh-install Cloud Agent checklist against v0.4.12 (the reviewer's
"your manager" sentence must save a card with the role withheld), then
the **Brume Executa Binaries** workflow for tool 0.4.13, `anna-app apps
publish --bump patch`, and `anna-app apps submit-review brume` to move
the review pin off v0.4.2.

### 12.40 The remaining quoted inventions (2026-11-14, local)

§12.39 left four sentences a reviewer could still quote. Three are now
withheld by the window gate:

- An article plus a person-shaped role — "the manager", "a colleague",
  "the stakeholder" — is the same addressee as "your manager". Group
  nouns stay possessive-only, so "the current team" is kept.
- An ascribed cause ("because they are behind schedule") and an invented
  extra project ("the extra project can move") blank the field as a
  motive. The person writing those words still grounds them.
- Will, May, and Hope are names unless they open a real frame ("Will
  you", "May I", "Hope you're"). "Hope can take the extra project" is
  withheld.

The chat bubble is the one the gate cannot see. `brume_prepare` now
returns a fixed `_display` line, and the system prompt requires that
sentence as the whole visible reply. A model that talks before the tool
call can still say "4" or "Friday" in the transcript. There is no
transcript for the tool to check.

Local gates before publish: `npm test` green, `test_plan` 20 green.
`smoke_binary.py` passed against the local darwin-arm64 build.

Shipped the same night: commit `6c87e64` to `main`; the **Brume Executa
Binaries** workflow (run 43548702496) built and smoked all four
platforms and published GitHub release `brume-executa-v0.4.13`; the
four archives were pulled into `executas/brume/dist/` and every
`.sha256` verified. `anna-app apps publish` (no bump — `app.json`
already declared 0.4.12) registered the bundled executa at v0.4.13,
synced the protocol manifest, uploaded the four binary artifacts
(`executa_version=1107`), froze the reset-offer skill at 1098
(v1.0.1), and cut **app v0.4.12** (`version_id=2277`).
`anna-app apps submit-review brume` moved the app to `pending_review`
with review candidate **0.4.12**. The fresh-install Cloud Agent
checklist was not run before that submit.
