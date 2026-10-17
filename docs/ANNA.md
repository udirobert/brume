# Brume on Anna: Product and Adoption Plan

> **Status:** 2026-10-17. This is a plan - nothing here is implemented
> feature proof. The local CLI contract (schema-3 bundle-only manifest,
> `validate --strict`, `dev` harness, storage round-trip) has been
> verified live; production behavior and qualified-run semantics have not.
> For the actually-implemented baseline see
> [DEPENDENCIES.md](./DEPENDENCIES.md).

## 1. Vision

**A breathing break between thinking and doing.** One quiet utility people
reach for at recurring moments - before a difficult task, between tasks or
meetings, after work - not a wellness dashboard.

Initial audience hypothesis: Anna users who are working, creating, or
deciding. This is an acquisition wedge, not a restriction on eventual
users. Brume is non-clinical: no stress diagnosis, no validated
physiology score.

## 2. Program context (unverified)

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
  Qualification window Sep 1-Nov 30 2026; since Oct 2026 grants computed
  per-builder-portfolio (one grant/builder/month, users deduped across a
  builder's apps). Revenue share separate: 70% of eligible usage profit,
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
  `manifest.required_executas` under the dev `tool_id` `tool-dev-brume`;
  not yet published to the Executa catalogue.
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
  "slower"/"stop" mid-run). **Built locally:** `brume_reset` now takes
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
