# Brume — Product Brief

> **Brume** (French: *mist*) — a calm companion for the two minutes between
> things. Nothing to get right, nothing to prove.
> Bundle `xyz.trustfall.brume` · rules in `AGENTS.md`, experiments in
> `docs/EXPERIMENTS.md`, Anna program in `docs/ANNA.md`.

**Status (2026-11-24).** The web app is the only live surface, and it sells
nothing. The Anna app's v0.4.12 came back from review with a differentiation
request; **v0.4.13** answers it with a follow-up loop (what happened last time,
in the person's own words, quoted back on the next preparation of the same kind)
and is now `pending_review`. The MCP app is built, tested
and deliberately undeployed until the retention bar in `docs/EXPERIMENTS.md`
is met. Everything below describes the product; the sections marked
*historical* describe what it was during the Shipaton window (Aug 1 – Sep 30,
2026) and are kept so the decisions stay legible.

> **The camera thesis is dropped, not merely unproven.** The web app does not
> request or use the camera at all, results report recorded practice time
> only, and no credential is minted or shown. `docs/STRATEGY.md` is history.
>
> **Tech migration (2026-10-17):** the frontend runs exact pinned versions —
> React 19, Vite 8, Tailwind 4, Capacitor 8 — see
> [DEPENDENCIES.md](./DEPENDENCIES.md) for pins and exceptions, and
> `package.json` for what is actually installed.

## One-liner

Brume is a guided breathing companion. You pick a rhythm — or say how the
moment is and we suggest one — and the session is just the breath and the
clock. Afterwards you can put the moment into one honest sentence and copy or
share it. No camera, no scores, no streaks, no account required.

## Core loop (retention engine)

1. Open → one question, always the same one — *How are you feeling?* → tap
   a word, or say it and the nearest word offers itself for a tap →
   **"here's a rhythm"**. Naming one thing behind it ("because · work") is
   optional, one tap, and stays on the device.
2. Guided breathing session — breathing animation and clock only, nothing to get right.
   One glyph on the breath cycles its sound — **spoken → breath → quiet** — mid-session,
   no menu, each tap auditioning the texture it just switched to.
3. Post-session: practice-time summary → "put it into words" — one honest sentence you can copy or share
4. /decompress: a two-minute shoulder pause beside a little pond —
   tapping Brume's pond makes one ripple and never starts the timer →
   rest → **Done** back to Home, or **Add a word** → an optional words
   card, shared only on request. Two tiny toys link quietly from the
   same room (`?room=firefly`, `?room=minute`).

**What turns a loop into a companion** is that step 1 accumulates: one
device-local ledger of `(when, feeling, reason, daypart)` that the room
reads back. Once there is enough of it, Home says the weather it has
seen — "restless three mornings this week" — instead of asking the same
question into silence. Nothing about the user is interpreted (voice
proposes, never decides — see `docs/EXPERIMENTS.md`, "We never interpret
feelings") and nothing leaves the device to do it. The 2026-11-04
revision of the check-in exists because the previous one graded the
answer to its own question; the doctrine "nothing to get right, nothing
to prove" rules out a classifier by definition.

## Screens (6, nothing more)

| Screen | Notes |
|---|---|
| Onboarding | Emotional check-in; no permissions, no account |
| Home | "How are you feeling?" — check-in words suggest a rhythm; doors to reset and /decompress |
| Session | Breathing animation only (no camera); one cue glyph — spoken · breath · quiet |
| Decompress | Two-minute shoulder pause at a pond (tap Brume for a ripple — it never starts anything) → rest → Done, or Add a word → optional words card, shared only on request; quiet links to two room-play toys |
| Post-session | Practice-time summary + words card (no score or verification marks) |
| Progress | Sessions and minutes — plain facts, no streaks shown |

Sign-in (`/auth`, email and password through Supabase) and Profile are
optional doors, not a seventh screen — the app is complete signed out, and
nothing is gated behind an account. There is no paywall and no tier label in
the UI; see "Monetization" below.

### Shared mascot

The mist-sprite mascot on Home, Session, Decompress and error/empty
surfaces is one shared implementation (2026-11-02):
`anna/bundle/mascot-engine.js` (frozen `BRUME_AVATAR` geometry +
`validateAvatar` + pure `sampleMascot` — all 12 expressions, deterministic
blink, companion idle gaze/doze, reduced-motion static expressions),
`anna/bundle/mascot.js` (single DOM adapter, `createMascot` →
`{setState, setBreath, setOptions, react, renderAt, destroy}`), and
`anna/bundle/mascot.css` (paint only, colours from `--brume-mascot-*`
tokens in `brand.css`). Expressions blend over 0.5 s (easeOutQuint from
the frozen displayed pose, mouths morph), a gentle bob runs on an inner
`g.mascot-root` (halved while breath-driven, off under reduced motion),
blinks and gaze drift run in every state except `hold`/`sleepy`, and
one-shot `react("hop"|"settle"|"celebrate")` calls layer on top.
Brume is also a *travelling companion*: a shared framer-motion
`layoutId="brume-companion"` makes the sprite glide between mount
points instead of unmount/remount — PageLoader → Onboarding/Auth → Home
card → session preview (`watching`, it waits with you) → the breath orb
→ post-session pride. `LayoutGroup` + `MotionConfig
reducedMotion="user"` wrap the router in `App.tsx`; only one
companion-id mascot per screen. Mid-flight, the sprite keeps its
previous face (the engine's pose blend morphs it en route), leads with
its gaze and leans into the travel direction (`lean`, released after
~700 ms). The check-in word now echoes through
the journey: `feelTheme.ts` maps it to a mascot expression + reaction +
`--brume-orb-mist` tint + a room response — `--brume-mist-r/g/b`
retints the MistField live and `--brume-feel-weight` tells it how
still and dense to go (heavier words: drift slows, folds thicken,
parallax recedes, the room breath deepens — absorbed, never alarmed).
Tapping a word also fires `brume:feel` with the tap point: the mist
sighs — folds gather toward it, swell and release over ~1.5 s — and
condenses the word into a wisp, a bright fold born at the tap point
that lifts and dissolves back into the field (~2.4 s). On tap the
chip also sheds a goo droplet (`AbsorbDroplet`, SVG
`feGaussianBlur`+`feColorMatrix`, WAAPI) that melts toward the mascot
as the retint settles; reduced motion skips all of it and snaps the
tint. The check-in is two rows on purpose — one row of five words
(selected chip stays lit), one slide-in row: ‹ choose again puts
the word down (releases the room), "Take it into a breath" carries
it to the preview; "More rhythms" and "Take two minutes" merged into
one quiet footer line. Heavy words (At limit, Overwhelmed) answer
with `tender`, a soft down-gazing smile — empathy, not sleepiness —
added as the 13th mascot state in the shared engine. Immersive routes have no MistField, so the shell answers there
as a still wash (`.brume-feel-wash` — masked `--brume-orb-mist`
drench at a `--brume-feel-weight` opacity, colour cross-fades). The
preview repeats the word with re-pick chips that swap the pattern in
place; the orb holds the tint until the flow ends, and
`--brume-mascot-wisp` picks the colour up too (it reads the same
mist tokens). Decompress tints the room on check-in as well and
releases it on unmount. Still ahead: contextual suggestions. The same three files drive the Anna bundle, the
web `BrumeMascot` wrapper and the MCP session widget — it covers mascot
surfaces only; other screen animations are unchanged.

## Monetization

**Nothing is sold today.** The web app has no paywall, no tier label and no
subscription route: they were cut on 2026-11-04 with the wallet, and
`src/lib/__tests__/no-streaks.test.ts` and the copy tests keep the UI honest
about not having a score to sell. `src/lib/monetization/` survives only for
the Capacitor build, where `revenueCatService.initialize()` returns before
touching the SDK on the web, so no sign-in reaches RevenueCat.

The revenue surface that does exist is the **Anna Founding Builder program**
(`docs/ANNA.md` §12.1): monthly grants paid on *qualified* MAU — users who
actually ran the app's declared primary function in that calendar month —
from $50/mo at 200 MAU to $5,000/mo at 20,000. The window runs to
2027-03-31, each month its own cycle, and one meaningful improvement per
month is required to keep receiving it.

Deliberately not built, in order of how often it gets proposed:

- **No agent API / metered "proof of practice."** That was the camera thesis
  (`docs/STRATEGY.md`); a face in frame proves nothing, so there is nothing to
  meter. Retired with the camera, not merely unscheduled.
- **No premium tier on the web.** A solo developer does not out-content Calm,
  and a paid tier would put a decision between someone and their two minutes.
  Money is a decision for the day the retention bar comes back with five
  yeses in it (`docs/EXPERIMENTS.md`), not something to sample earlier.
- **No advertising, no analytics provider.** `trackEvent` still has no
  provider; wiring one is the moment `PrivacyPolicy.tsx` starts describing
  transmission that happens.

## Mascot Strategy & Competitive Insights

See [`docs/MASCOT-RESEARCH.md`](./MASCOT-RESEARCH.md) for full competitive research on Shmoody, Finch, and Voidpet.
Key pillars:
- **Anti-Tamagotchi stance:** Unlike Finch or Voidpet, Brume is not a pet you have to keep alive. The sprite asks nothing of you and holds the weight with you.
- **Current phase:** B2C web experiments only; nothing deployed to Cloudflare/ChatGPT until retention is proven — see [`docs/EXPERIMENTS.md`](./EXPERIMENTS.md).
- **Actionable outcome bridge:** Like Shmoody's action plans, Brume delivers a concrete output—the Post-Session Words Card ("say it in a sentence without explaining it") and AI conversation preparation on Anna.

## OneSignal (Capacitor build only)

**Status:** wired client-side and a guarded no-op on the web — with
`VITE_ONESIGNAL_APP_ID` unset nothing initialises, and that is the shipped
state. It belongs to the Capacitor shell, not to brumeapp.netlify.app.

**Wired** (`src/lib/notifications/oneSignal.ts`, hooks in `App.tsx` init +
`sessionStore.completeSession`). Permission is asked **in context** — after the first
completed session, never on first open. SDK: `onesignal-cordova-plugin` (Capacitor).

**Tag contract v1** (client → OneSignal; configure Journeys against these):

| Tag | Values | Journey |
|---|---|---|
| `first_breath_done` | `"true"` | **1. First Breath** — trigger: user 24h old AND tag absent → "Your first breath is waiting" |
| `last_session_at` | ISO date | **2. Come back when you're ready** — trigger: `last_session_at` ≥ 1 day stale → "Your mist is waiting" |
| `sessions_total` | number | **4. Weekly digest** — Sunday summary: sessions and minutes |

**3. Buddy Accountability** needs a server leg (client can't securely notify another
user): a small server leg calls OneSignal REST with the buddy's player id when a
session completes. Not built, and not scheduled — it is the kind of "keep them
coming back" mechanism the retention experiments exist to test rather than assume.

**Dashboard setup (no code):** create OneSignal app → add iOS/Android platforms →
set `VITE_ONESIGNAL_APP_ID` → build the 3 Journeys above. `identifyUser()` /
`resetNotificationUser()` helpers exist but are unwired until auth settles (works
anonymously via tags meanwhile). **No journey may be framed as a streak** — that is
the product's stance, not a preference.

## Cut list — what is not in the product

Cut on 4–5 November 2026, and kept cut by tests rather than by memory:

- **Wallet, chain sign-in, Flow attestations, Lens posting/profile** — the whole
  chain era. `src/lib/__tests__/no-wallet.test.ts` walks `src` and fails on an
  import of a chain library. Sign-in is an email.
- **The `/subscription` route, every tier label, the entire selling surface.**
- **The camera and any verification of practice** — a face in frame proved nothing.
- **Scores, streaks and the comeback mechanics built on them** — `no-streaks.test.ts`.
- **The check-in classifier** (modes, rotating prompt deck, free-text margin) —
  cut 2026-11-04; replaced by one question and a closed-set reason code.
- **Instructor dashboard, wearables, extra chains, the NFT marketplace.**

✅ **Kept:** the breath and the clock, the fourteen words, the device-local
ledger, the travelling mascot, the room and its material, the Words Card, the
landing, the PWA's offline behaviour, and the three shared contracts
(`plan.js`, `preparation.js`, `mascot-engine.js`).

## Submission checklist (historical — Shipaton window closed 30 Sep 2026)

Kept because the assets it names still exist under `anna/listing/`:

- [ ] App live on Google Play (target Sep 3) + iOS submitted
- [ ] ≤2-min demo video (YouTube) — show: check-in word → breathing session → "put it into words"
- [ ] 1024×1024 icon (mist mark on `brume-900`)
- [ ] 1179×2556 screenshot, no device frame
- [ ] Judge promo code / free trial
- [ ] Devpost text: lead with the monopoly line + two-sided monetization

## Shipaton-era open questions (closed — recorded as answered)

1. ~~Apple developer account?~~ Never opened; the Capacitor shell stayed a shell.
2. ~~`google-services.json` for OneSignal push~~ Moot: push is Capacitor-only and unset.
3. ~~Domain~~ `brumeapp.netlify.app` serves the app; `api.brume.trustfall.xyz`
   serves voice. No agent API docs, because there is no agent API.

Current open decisions live in `docs/EXPERIMENTS.md` ("Open decisions") — chiefly
whether the product is a companion or a session sold into hosts, which is E6's
question to answer.

## Future ideas (parked, 2026-11-02)

### Hands-free interaction — inspired by Winq (winq.kroking.dev)

Winq is a macOS gaze tracker: the camera reads head direction + eye
position purely as an *input* channel (look at a window → it focuses).
Frames are processed on-device and discarded. The useful frame for us:

**Camera-as-input is honest; camera-as-verification was not.** We removed
Brume's camera because a face in frame proves nothing about breathing —
the camera produced no user value. Winq's camera produces all of its
value. If a camera ever returns to Brume, it is for *control* (a nod to
start, a glance to pick a check-in word), never for *proof*.

Tension to respect: during a session the user wants eyes closed — gaze is
a pre-session modality at best.

Candidate order for "communicate without typing", cheapest first:

1. **OS dictation on existing inputs** — the check-in field already
   accepts iOS/Android/macOS built-in dictation. Zero code; make sure the
   copy invites it.
2. **Brume speaks** — extend `anna/bundle/audio.js`-style cues to the web
   session (spoken phase words instead of on-screen text). Serves the real
   hands-free case: eyes closed. **Shipped 2026-11-02** (phase cues + the
   preview choice) for the AssemblyAI voice hackathon (see
   `docs/DISTRIBUTION.md`).
3. **Optional voice input** — Web Speech API "say how you feel" check-in;
   free, on-device where supported, opt-in. AssemblyAI's core product is
   STT — the same vendor could cover voice in AND voice out, which is
   also extra hackathon credit.
4. **Gaze/head control** — the Winq move; revisit only if it controls
   something real, and never as a claim about breathing.

### Voice landscape survey (2026-11-02)

Four categories, and what each sells:

| Player | What they sell | Voice model | Gap for us |
|---|---|---|---|
| **Othership** ($18/mo, 500+ sessions) | A *journey* — produced guided breathwork, charismatic human guides, immersive music | Long narration tracks | Heavy, library-driven, claims-heavy ("regulate your nervous system") |
| **Breathwrk** ($9/mo) | A *routine* — pre-recorded classes, schedules, streaks, categories | Guided class audio | Habit/gamification model we deliberately avoid |
| **Calm / Headspace** | A *library* — narrated content, celebrity voices | Narration-as-content | Browsing is the opposite of our check-in → done loop |
| **Moonbird / Morphée** (hardware) | A *device* — screen-free breathing, haptic or box-based | Voice/haptics on hardware | Proves screen-free demand; we do it with software |
| **Pi / Sesame / Hume EVI** | A *conversation* — an AI that talks to you | Always-on voice agent | Not our game — conversation means explaining, ours means not explaining |

**The niche:** everyone sells content you consume, a coach that talks to
you, or hardware you buy. Nobody sells *a moment* — two minutes, nothing
to browse, nothing to get right — and nobody offers it inside other
agents (MCP). Othership wants to take you on a journey; Brume wants to
get out of your way in 90 seconds. Our voice is therefore **whisper, not
narration**: the minimum speech needed so you can close your eyes.

**Voice ideas by user outcome** (ranked by fit):

1. *"Don't make me look"* — spoken phase cues: shipped.
2. *"Just say it"* — voice check-in: speak a word instead of tapping;
   free via Web Speech API, AAI STT for the hackathon story.
3. *"Say it kindly"* — Brume reads your composed check-in sentence back
   to you; hearing your own words said warmly is different from reading
   them. Bridges to the share-with-a-human mechanic. **Shipped
   2026-11-04** ("Hear it" on the Words Card; not offered on
   "just for me" — its contract is "nothing is sent").
4. *"Meet me where I am"* — spoken opening line, from Brume's side of the
   room ("Evening. Nothing to finish tonight. Just the long exhale.").
   **Shipped 2026-11-04** as the Begin greeting; **rewritten 2026-11-04**
   out of the receipt voice ("You came in restless — we'll take it slow").
   Whole lines from a closed table keyed valence × daypart — no model call,
   no user text, and never one of the fourteen words Brume just offered.
   Live TTS runs through `/api/tts` (primary: the Hetzner FastAPI
   service via `VITE_HETZNER_SERVICE_URL`; `netlify/functions/tts.mjs`
   is the relative-path fallback, vite middleware in dev); key stays
   server-side, browser voice is the fallback, cues hold while a line
   speaks.
5. *"Stay with me"* — sparse optional murmurs in Decompress ("stay as
   long as you like"). Companion made audible — must stay rare and
   off-able; talking during a pause is a fine line.
6. *"Tell me what to do"* — voice commands mid-session ("slower",
   "done") — STT again.

**Don't build:** a conversational voice agent. Pi/Sesame/Hume compete on
who talks best; our differentiator is the product that needs the least
of you.
