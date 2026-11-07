# AGENTS.md

## Anna App (`anna/`) — the active product

Read `anna/README.md` first (layout, flows, testing tiers, release steps,
platform gotchas). Progress log and market/platform learnings:
`docs/ANNA.md` §12.

Brand: shared tokens + bundled Manrope live in `anna/bundle/brand.css`
and `anna/bundle/fonts/`; the web app `@import`s the same file and both
UIs share `--brume-*` daypart tokens. Browser QA: `npm run test:browser`
in `anna/` (fake host :4618, session brume-preparation-qa).

Mascot is shared three ways: `bundle/mascot-engine.js` (frozen
`BRUME_AVATAR` + `validateAvatar` + pure `sampleMascot` — all motion),
`bundle/mascot.js` (single DOM adapter, `createMascot(host, opts)`),
`bundle/mascot.css` (paint only, `@import`ed by `app.css` and
`src/components/BrumeMascot.css`); the MCP widget inlines all three via
`mcp/widget.js`. Frames blend between states over 0.5 s (easeOutQuint,
from the frozen displayed pose), and one-shot `react("hop"|"settle"|"celebrate"|"ready")`
layers on top; reduced motion disables bob, blinks, drift, blends and
reactions. Colours come from `--brume-mascot-*` tokens in
`brand.css`. Focused test: `node --test test/mascot.mjs` (in `anna/`).
Expressiveness doctrine (2026-11-07): states are schedules, not poses —
seeded `STATE_VARIANTS` dwell on `stateAge` (variant 0 is the drawn
state; hold/topup never vary), exhale/thinking/sleepy each own one
scripted beat, and far expression changes land inside a forced blink
(the breath loop is exempt). Blinks are a seeded aperiodic schedule with
18 % doubles; eyes carry sphere-depth narrowing plus mirrored per-state
`EYE_TILTS`; bright/proud companions perk spontaneously ~1 per 40 s.
The adapter's `lookAt: Element` aims the gaze (Home points it at the mic
while listening, the suggested word after a match, the help card when
blocked; a hand-choice or a miss releases it). Every behaviour is a pure
function of (t, options) and gated off under reduced motion — the pose
stays, the schedule goes. MotionLab's "Mascot schedules" board keeps the
proof frames.

Verification (run from `anna/`, all free):

```bash
npm test                                         # node smoke + shared fixture
(cd executas/brume && python3 -m unittest test_plan)
anna-app validate --strict
```

Prompt changes: `node scripts/prompt-check.mjs all` (Gemini 3 Flash, the model Anna serves by default; needs
`anna/.env.local`; does not use Anna quota). Real-LLM `anna-app dev` and
Cloud Agent chats DO use the Anna account quota — keep them to the tier-3
release checklist, one new chat per step.

Rules:
- `bundle/plan.js` and `executas/brume/brume_plugin.py` share one contract;
  change both and cover it in `test/plan-cases.json`.
- After changing the plugin's `describe`, regenerate
  `executas/brume/manifest.json` and bump the version in `executa.json`,
  `pyproject.toml` and `VERSION`; binaries come from the
  "Brume Executa Binaries" GitHub workflow.
- No health, medical or hormone claims in copy or prompts, and no scores
  or streaks — those clauses are the product's stance and stay absolute.
- **We do not sense you.** No camera, and no continuous, ambient or
  biometric capture of any kind. This is what the old "no camera or
  microphone" clause was actually protecting, so it is written as the
  protection rather than as a device list. One exception is shipped and
  bounded: the check-in microphone (`src/lib/voiceCheckin.ts`) listens for
  one sentence per press (hold or tap), sends it to AssemblyAI to become words, matches
  those words against the 14-feeling catalog and drops them. Nothing is
  recorded; no transcript reaches `checkinLedger.ts` or `track()`; and
  voice still only *proposes* (see the check-in doctrine below). Opt-in per
  utterance is what keeps this inside the rule — a standing listen, an
  always-on wake word, or any inference drawn from the audio itself (tone,
  breath rate, affect) is not allowed and would break the rule outright.
- Web app copy follows the same rule as Anna: no health/medical/hormone or
  outcome claims, no scores or streaks, nothing sensed from the body.
  `src/lib/__tests__/copy-claims.test.ts` enforces this for pattern,
  recommendation and check-in strings — extend it when adding copy sources.
  Privacy copy is part of the contract: `src/pages/PrivacyPolicy.tsx` must
  describe the microphone as transient and opt-in, never as unused, and
  `src/pages/__tests__/PrivacyPolicy.test.tsx` pins that wording.
- `anna-app apps publish` uploads a new version (not a review submission);
  submitting for review is done by the owner in the Developer Console.

## MCP app (`mcp/`)

Brume exposed to MCP hosts (ChatGPT Apps SDK target) — spec in
`docs/MCP-APP.md`, rationale in `docs/AGENTIC.md`, distribution plan in
`docs/DISTRIBUTION.md`. The server imports `anna/bundle/plan.js` directly;
that file is now shared by THREE implementations (Anna bundle, Python
executa, MCP server) — keep the contract in sync across all three and
cover changes in `anna/test/plan-cases.json`. Verify: `npm test` in `mcp/`.
Same content rules: rhythm-only copy, enforced by the shared regexes.

## Web app (`src/`)

Shared brand tokens live in `anna/bundle/brand.css` (both UIs import the
same file — retuning affects the Anna bundle too). Shared controls are in
`src/styles/brume-controls.css` and `src/styles/brume-checkin.css`; the
check-in vocabulary/message builder is `src/lib/checkin.ts`. The web app
uses no camera and no scores or streaks UI, and its microphone is a
transient, per-tap option that records nothing (see the sensing rule
above); core loop is a breathing reset or `/decompress` → check-in word →
optional one-sentence message.

Sign-in is an email and nothing else, and the web app sells nothing. Cut on
4 November 2026: wallet and SIWE sign-in, Flow attestations, Lens posting and
profile, the `/subscription` route, and every tier label in the UI.
`src/lib/__tests__/no-wallet.test.ts` walks `src` and fails on an import of a
chain library, so that surface cannot come back quietly; the account shape
that survived is `src/types/user.ts`. `src/lib/monetization/` stays only for
the Capacitor build — on the web `revenueCatService.initialize()` returns
before touching the SDK, so no sign-in reaches RevenueCat. The chain-era
dependencies (`@onflow`, `wagmi`, `viem`, `@lens-*`) were removed outright
on 5 November 2026 along with `src/lib/ai`, `src/lib/sharing`, `src/lib/api`'s
chain services, `src/lib/crypto`, `cadence/` and `flow.json`; `lucide-react`,
`next-themes` and `recharts` went with them — `src/components/icons/BrumeIcons.tsx`
is the only icon set.
`docs/ARCHITECTURE.md` and `docs/API.md` still describe the chain design —
read them as history, not as the app.

Doctrine for the check-in (2026-11-04, after two real-world misreads —
read before adding anything to it):
- **Never interpret a feeling.** `src/lib/voiceCheckin.ts` matches a
  transcript to the 14-word catalog and that is all it may do. Voice
  *proposes*: it turns the nearest chip face-up and waits for a tap. It
  must never select, never flip, never infer valence from a sentence —
  and any transcript containing a negation returns no match at all, so
  the UI asks instead of declaring ("not good" is not Light). When Brume
  runs inside a host that already has a language model, the host reads
  the words; Brume keeps the ritual, the room, the ledger, the mascot.
- **One question.** *How are you feeling?* always. No modes, no rotating
  prompt deck — a rule that depends on the input channel or an RNG is a
  rule no user can hold.
- **The pattern has a name — propose-never-commit voice**: token →
  realtime stream (the mic is tapped before the token arrives, so the
  opening words are kept; turns joined — a pause mid-sentence must not
  lose the feeling word; `keyterms_prompt` is the catalog itself) →
  closed-set match on **whole words** ("hopeless" must never reach Hopeful,
  "cansada" must never reach "sad"; "calm down" is an ask, not a report) →
  offer → tap → transcript dropped.
  The input itself defaults to **hold** — the mic is open exactly while
  the finger is down, so a pause can never cut a sentence and the ending
  is always the user's; **tap** (one press starts, silence or a second
  press ends) is an opt-in pill in Home's Options, for hands that can't
  sustain a press. Any press that loses its finger without ending the
  listen — a quick tap under the threshold, or a release the browser
  steals (`pointercancel`, e.g. the first-press permission sheet) —
  settles into that same tap contract: a hold never outlives the finger,
  and an open mic always says how it ends ("tap again when done", the
  button itself reading "tap to stop"). It is what makes multilingual
  hearing safe: `LANG`
  catalogs (es/fr/de today) widen only the alias table, never the
  interpretation.
  And it is what makes refusal legible — a negated utterance reads
  "I'll ask instead" on screen, not a silent miss, and a stuck mic gets
  a recovery, not an epitaph: the failure names the fix for *this*
  device (in-app browser → open it in Safari; iOS → aA › Website
  Settings; closed table `VOICE_HELP`, never generated), the card
  persists until dismissed — the dissolve belongs to transcripts, which
  are theirs, not to help, which is ours — and every card ends in the
  exit: "Or just tap a word." Symmetrically, a spoken *match* splits the
  same way: the transcript dissolves (theirs) while the invitation —
  "Drained — tap to keep it" — stands as a persistent pill until it or
  the chip is tapped (either is the committing tap; the pill is the word,
  not an "okay"), the mic is pressed again, or "Not this one" (×) retires
  it and the glow together; taking it leaves the seat a breath longer as
  the kept word ("Drained — kept") so the confirm lands where the eye
  already is; it scrolls clear of the pinned Begin; and the
  companion acknowledges the match with the suggested word's own
  reaction (acknowledgment only — no tint, no ledger, the tap still
  owns the commit). Any new voice surface
  implements this pattern or it does not ship.
- **`src/lib/checkinLedger.ts` is the spine**: append-only, device-local
  `(t, feeling, reason, daypart)`. The recap, the memory line and any
  future host handoff read it. Closed sets only — free text is never
  analysis substrate. A new feature must say what it writes to the
  ledger, or it doesn't get built.

Doctrine for Brume's own voice (`src/lib/spokenGreeting.ts`) — the lines
Brume speaks, not the lines it reads:
- **A closed table, never generated.** Whole lines keyed `valence × daypart`.
  The safety property "the words going to the voice service are always ours,
  never typed by the user" rests on this, and `copy-claims.test.ts` can only
  check what is literal in source.
- **From Brume's side of the room.** The hour, the breath, the room — never
  the user's own choice handed back with a reason attached ("You came in
  restless — we'll take it slow" is a receipt, and a receipt has no
  character). Never one of the fourteen catalog words, either: "Early light"
  beside the feeling Light reads as an echo either way.
- **Same situation, same line.** No rotation, no RNG — consistency is what
  makes it a someone rather than a feed.
- **≤ ~14 words, imperative or observational, never explains itself.**
  Instructions are allowed; predictions ("you'll feel", "this calms") are
  outcome claims and are not.

Verification: `pnpm vitest run`, `npx tsc --noEmit`, `pnpm lint`.

Experiments + measurement: `docs/EXPERIMENTS.md` (hypotheses, kill
criteria, "bar for going live"). Every event goes through `track()` in
`src/lib/events.ts` — its type map is the privacy contract (numbers,
booleans, closed sets; never words, messages or drawings), so add events
there and in the doc first. **The wire is `src/lib/metrics.ts`** — a
same-origin counter (`/api/metrics`,
`netlify/functions/metrics.mjs`, stored as daily aggregates in Netlify
Blobs) that sends only the eight events named in its `WIRE`: `visit`,
`session_start`, `session_complete`, `session_abandon`, `after_answer`,
`words_card_shown`, `words_written`, `room_touch` (strokes, seconds and
material — never the drawing; the counter keeps bucketed counts). Day
numbers, seconds and closed-set ids, no device key, no person to
reconstruct; a value that isn't a number, a boolean or an id-shaped string
is dropped before the request goes out. `trackEvent` still has no provider —
adding one is a decision, not a dependency. Widening the wire takes three
changes in one commit: the client `WIRE`, the function's `ALLOWED` map (the
parity test fails otherwise), and `src/pages/PrivacyPolicy.tsx`, which names
what may leave — its test reads the length of `WIRE`, so an old number on the
page fails. The room answers touch on Home only
(`RoomTouch.tsx` + `src/lib/mistBrush.ts`: breath = the mascot's own
7 s cosine, hush mirrors `ATTENTION.AGITATED`; tests pin both to the
frozen mascot files). Focused tests:
`pnpm vitest run src/lib/__tests__/events.test.ts src/lib/__tests__/mistBrush.test.ts src/components/atmosphere/__tests__/RoomTouch.test.tsx`.

Motion: the archetype is CALM — one signature ease and three durations in
`src/lib/motion.ts` (0.2/0.5/0.9 s); the breath itself uses `easeInOutSine`
in `src/lib/breathCurve.ts`. Playful motion lives only on the mascot.
Transform + opacity only; reduced-motion means opacity only.
Say reassurance once per screen.
Icons: `src/components/icons/BrumeIcons.tsx` (drawn in the mascot's
rounded style; no lucide sparkles/charts in navigation).
Accessibility: `src/styles/brume-a11y.css` covers forced-colors and
prefers-contrast; reduced motion = opacity only.

Web-only room + companion experiment (Anna bundle and shared mascot
engine unchanged): `src/lib/feelings.ts` is the 14-feeling catalog
(index 0–4 keep their legacy meanings; pairs 5–14 power the select-then-flip
chips in `src/components/checkin/PairedFeelings.tsx` — positive faces may
hop/celebrate, heavy never do). `src/lib/roomExperience.ts` holds the
in-memory feel→material store;
`src/components/atmosphere/RoomEnvironment.tsx` + `src/lib/atmosphere/roomRenderer.ts`
render one persistent WebGL1 canvas on core routes with a CSS fallback;
`RoomControls` is the material/still override on non-home routes.
`src/components/companion/JourneyCompanion.tsx` mounts ONE mascot
outside the routes and glides it between `CompanionAnchor`s.
Core-loop navigation is direct — no `viewTransitionTo` snapshots.
Focused tests:
`pnpm vitest run src/lib/__tests__/feelings.test.ts src/lib/__tests__/roomExperience.test.ts src/lib/__tests__/mascotDemeanor.test.ts src/components/atmosphere/__tests__/RoomEnvironment.test.tsx src/components/checkin/__tests__/PairedFeelings.test.tsx src/components/home/__tests__/Home.test.tsx`.

Home mobile layout (2026-11-06, after a real-phone review): the home
column opts out of the shared centring (`main:has(> .brume-home--compact)`
→ `flex-start`, children `flex: none` — flex-shrink was the mascot
squish). Begin lives in `.brume-home__footer`: `margin-top: auto` seats
it, `position: sticky` pins it above the fixed tab bar on overflow
(mobile `bottom: safe-area + 88px`, inside the layout's `pb-24`
reservation) — Begin is always in view. Only Begin pins; Options stays
in flow, and the seat's fade is `pointer-events: none` so chips beneath
it stay tappable. Reasons transform on pick into one confirmed pill
(same height as the row — nothing jumps) that reads their own sentence
back — "Heavy, because money — kept", a drawn check its only mark;
under it a closed-table aside, one per valence (heavy → "it can sit
here.", positive → "worth keeping.") — the acknowledgment is the mirror,
privacy stays under the chips where it belongs, and the companion
settles once (`onPick`); `.brume-pairs.has-selection` dims the unchosen
words. Home
mascot anchor is 132px on `useIsMobile`, 156 otherwise.

Session lifecycle: the session offers its own ending — past
`LANDING_SECONDS` (90 s, matching `practiceProgress` fullness) in
`ResponsiveEnhancedSession`, the next inhale boundary self-pauses into
the landing ("the breath can rest here"); a tap resumes (offered once),
~10 s idle completes through the same path as End. On post-session,
answering "How is it now?" calls `clearFeel()` — the room releases the
word's tint — and the heading takes focus on mount so the route change
announces. `sessionStore` holds only the API callers use;
`sessionSelectors.isActive` means `phase === 'active'` literally (not
"session exists").

Spoken breath cues belong to the phase **edge**, not to renders: the
cue effect in `ResponsiveEnhancedSession` keeps a `lastCueRef` so a
stray re-run (config identity churn, the 5 s offline-status poll) stays
silent, and pause/resume resets the ref so a resume re-orients with one
cue. The session shell sizes to the *dynamic* viewport
(`supports-[height:100dvh]:h-[100dvh]`, `h-screen` fallback, no
`min-h-screen`) so pause/breathe/end never slide behind a mobile browser
bar.

## Product shape: compact, one room

Brume stays a compact experience — one room + one companion persisting
across routes; new kinds of surface are *states of the room* you toggle
or trigger, never new destinations. **Do not add nav items, pages or
routes** (nav = Home, Progress, Decompress, Profile). Cap of 3–4 verbs
(breathe, touch, say, rest); a fifth replaces one. No settings drawers
for surfaces (settings hold skins only), nothing saved/gallery'd, every
surface ends at the same landing. Full rules and the four-question test:
`docs/EXPERIMENTS.md` ("Product shape"). Current phase is B2C web
experiments; MCP/Cloudflare/ChatGPT stay undeployed until retention is
proven.

## The voice server (`backend/vision-service/`)

The FastAPI service on Hetzner (`api.brume.trustfall.xyz`) is what production
voice actually talks to: `src/lib/voiceCues.ts` and `src/lib/voiceCheckin.ts`
build their endpoint from `VITE_HETZNER_SERVICE_URL`, and `/api/tts` exists
**three** times — the vite dev middleware, this server, and
`netlify/functions/tts.mjs`, which only a build *without* the Hetzner var ever
reaches. Same request/response contract on all three. So never conclude from a
curl of the Netlify function that the voice is down; that is how it was
concluded wrongly once, on a working deployment.

A refused or unreachable voice request degrades rather than errors: a spoken
line falls through to the browser's own voice, a check-in to the browser's own
recognition — the same paths a network failure takes.

`voice_guard.py` meters the three routes that spend the AssemblyAI quota, per
visitor per minute and globally per day, and requires `X-Brume-Voice-Key`
(⇔ `VOICE_SHARED_SECRET` on the server, `VITE_VOICE_KEY` in the build) only
when that is set. Unset is a supported configuration, not a broken one: the
limits alone are what bounds the cost, since anything shipped in a bundle is
public. Verify: `python3 -m unittest test_voice_guard` in
`backend/vision-service/`.

**A push to `main` can redeploy this server.** `/webhook/github` runs
`./deploy-hetzner.sh` on the box when the GitHub HMAC signature verifies, and
refuses every request — correctly signed included — while
`GITHUB_WEBHOOK_SECRET` is unset. So "every push deploys the site" also means
"every push may restart the backend", and client and server changes to one
contract ship together whether that was intended or not.

It is not wired up at the moment, and that is the safer half of the state: the
box has a `GITHUB_WEBHOOK_SECRET` set and the hook on the repository does not
agree with it, so every delivery is a clean 401 (before the hardening they were
500s — the generic handler was rewriting its own signature refusal, which is how
a working refusal looked like a broken endpoint). Whoever wants push-to-deploy
sets both sides to the same value; whoever does not should leave them apart,
because the script that would then run is the stale September copy on the box —
`docker-compose down` plus `build --no-cache` on a shared machine, inside a
300-second subprocess timeout.

`/health` is public and answers one question (`status`). The service inventory
it used to publish — which model, whether a key was configured, which sessions
were live — belongs in the boot log. And the vision/AI-analysis endpoints still
on that box belong to the product Brume was before: the web app calls neither.

### Getting a change onto the box

`deploy-hetzner.sh` is a provision-and-deploy script (explicit tar list →
`scp` → `docker-compose down` → `build --no-cache` → rewrite the systemd unit),
and it is not the route: it connects as `root@` on port 22, which times out,
while the box is reachable as the `snel-bot` ssh alias — `deploy@157.180.36.156`
port 49152, in the `docker` group, with `NOPASSWD: ALL`. It is also a shared
box (`voisss_butler`, onpoint grafana/prometheus/node-exporter, ollama), so
re-provisioning Docker and rewriting units for one project is out of scope.

What works is the four-file deploy: `scp` the changed `.py` files to `/tmp`,
`sudo cp` them into `/opt/vision-service` keeping a timestamped `.bak` of each
file replaced, then rebuild. **Recreate with `sudo docker rm <stopped>` first,
then `sudo docker-compose up -d --build vision-service`** — compose v1 on this
box dies mid-recreate with `KeyError: 'ContainerConfig'` against the current
engine, and it does so *after* stopping the old container, which leaves the
voice service down with nothing running. Never `down`. `cd /opt/vision-service`
or `env_file: .env` resolves to nothing and the keys vanish.

Deployed this way on 5 November 2026 with the guard active and
`VOICE_SHARED_SECRET` unset, so the routes stay keyless and only the limits
apply — 8 per visitor per minute, 1500 per day. Verified from the public
domain: a spoken line returns audio, an over-limit burst returns 429 from the
app (not from the edge `limit_req`, which is a separate 10 r/s), and the 9
guard tests pass inside the container. Host nginx sets `X-Real-IP`, which is
what makes the per-visitor bucket per *visitor*; without it every request
would share one bucket keyed on the proxy. `/opt/vision-service` is not a git
checkout and the `deploy-hetzner.sh` sitting on the box is the September copy,
so files land there only by this route — whoever runs the webhook runs that
stale script, not this one.

## Secrets

Never commit keys. Local secrets live in gitignored env files
(`anna/.env.local`, root `.env*`); `anna/.env.example` documents the
variables with empty values.

## Git / GitHub

The active `gh` account may be `sneldao`; for udirobert/brume use
`gh auth token --user udirobert` (don't switch the active account).

### Release candidate notes (local, unpublished)

- Conversation preparation replaced the old get-ready script:
  `bundle/preparation.js` + `bundle/preparation-prompts.js` (prompt text is
  maintained outside this change), strict JSON validation, one clarify + one rehearsal max.
- `bundle/recovery.js` checkpoints one active task to
  `brume/active-task` and validates per-flow data on load/save; reset and
  preparation restore their exact screen paused, a live alert test always
  restarts (partial timings are never kept).
- `session.js`: `unwrap` stays sync (ok:false throws, ok:true → result);
  storage call sites `await` the SDK promise; `saveCompletionRecord`
  dedupes summary folds by `completedAt`.
- Tests: `npm test` = smoke + `node --test test/preparation.mjs
  test/recovery.mjs`. Browser QA via `test/fake-host-server.mjs`
  (scripted llm, persistent KV) + agent-browser. Verified locally only —
  not published, no tier-3 run.
