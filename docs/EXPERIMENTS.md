# Experiments — what do people fall in love with?

**Status:** B2C only. The web app is the only live surface. The MCP
server is built but NOT deployed (not on Cloudflare, not in ChatGPT);
that waits until a cohort of web users enjoys the app and retention is
proven (see "Bar for going live"). B2B / team capacity sharing is parked
(`docs/MASCOT-RESEARCH.md` §D).

## Product shape: one room, many weathers

Brume is a compact, simple experience: one room and one companion that
persist across routes. Different kinds of surface are *states of that
room* that you toggle or trigger — not destinations. Best-in-class
compact apps (one canvas, a few verbs, everything else a mode of the
canvas) work this way; we hold ourselves to it.

**Rules for any new idea:**
1. **No new nav items, no new pages/routes.** Nav is Home, Progress,
   Decompress, Profile. A new surface lives on the existing stage. If it
   needs its own page, it is the wrong idea or the wrong form.
2. **A hard cap on surfaces: 3–4 verbs** (today: *breathe* — guided
   session; *touch* — the room answers a hand; *say* — the Words Card;
   *rest* — the landing). A fifth must replace one.
3. **Shared grammar and one exit.** Every surface ends the same way
   (landing, then an optional word). People learn one grammar once.
4. **Switch without a menu.** Direct manipulation: touch the room, tap
   the mascot, press Begin. A settings drawer is where surfaces go to
   die. Settings hold *skins* (materials), never surfaces.
5. **Reveal slowly.** First visit = Begin and little else. Depth appears
   after the first session. Compact means the first screen stays simple.
6. **Everything is ephemeral.** No gallery, no history of creations, no
   save. Nothing to manage means nothing that grows the surface count.

**Four questions a new surface must pass** (all four):
- Can it live on the existing stage and room?
- Does it end at the same landing?
- Does it add a verb, or just a skin/variant of an existing one?
  (Skins go in room settings; variants are arms of an experiment.)
- Would removing it hurt anyone? If we can't answer yes after the
  cohort, remove it.

Same rule for the other experiments: Words Card arms (E2) are *variants
of one surface*, material variations (E1) are *skins*, never pages.

## Decided (not experiments)

- **The mascot glides, reacts and hushes.** Executive decision.
  `JourneyCompanion`, reactions and `hush` stay as they are.
- **We lean into room and material.** Variations are coming; the open
  question is which ones invite play (below).
- **Brume's claim is that the companion remembers.** No rhythm is magic
  (our own note above), so patterns are a commodity — nobody picks Brume
  because it has Wim Hof and 4-7-8. The one defensible claim is a small,
  private, longitudinal model of the user's states plus the craft around
  it. Anything that does not serve *being remembered* is decoration:
  pleasant, sometimes lovely, but it does not decide the future.
- **The ledger is the spine.** One append-only, device-local record —
  `(timestamp, feeling, reason-code, daypart)` in
  `src/lib/checkinLedger.ts`. The recap, the memory line, a future host
  handoff and any paid sync all read that one schema. Session minutes
  join by day rather than being stored twice. A feature that cannot say
  what it writes to the ledger does not get built — for a solo product
  whose UI only ever accretes, the schema is cheaper than a feature and
  it is also the only real governance we have on the surface count.
- **The companion lives where the user already is.** Our own research
  (`docs/MASCOT-RESEARCH.md`, Finch) says the #1 retention engine is a
  persistent home-screen surface showing the companion's state — not
  push, and not persistence *inside our own routes*. `JourneyCompanion`
  is craft; a widget (or an agent's conversation) is the mechanism. So
  the web app is the **session** — two minutes, no retention burden —
  and the presence is the thing that comes back. This also stops the
  web-and-Anna split being two products: it is one product in a second
  place.
- **We never interpret feelings.** Voice proposes and never commits: a
  spoken word turns the nearest chip face-up and waits for a tap.
  Interpretation of emotional input is a pure trust liability — the one
  error class that ends a wellness product is *"this app told me I was
  fine when I said I wasn't"* — and it is a capability a **host** (Anna,
  a ChatGPT app) already does better with a real model, owning the
  privacy story along with it. Brume holds the ritual, the room, the
  ledger and the mascot. The host holds the words.
- **Brume has a character, and it is a string table.** What Brume says
  about itself (`src/lib/spokenGreeting.ts`) comes from its own side of
  the room — the hour, the breath, the room — never the user's choice
  handed back with a reason attached, and never one of the fourteen
  catalog words. Keyed `valence × daypart`, deterministic, ~14 words.
  Generated lines would break the privacy property (the words sent to the
  voice service are always ours), break `copy-claims.test.ts` (it can only
  check what is literal in source) and break the character: a companion
  that says something different every visit is a feed. Rules in
  `AGENTS.md`, invariants pinned in `spokenGreeting.test.ts`.
- **We do not sense you.** The old clause was "no camera or microphone",
  which the shipped voice check-in had already broken — and a rule the
  product ignores is not a rule, it is a finding waiting to be written.
  Rewritten as what it protected: no camera, no continuous, ambient or
  biometric capture, nothing inferred from a signal. The one exception is
  the check-in microphone: opt-in per utterance, one sentence per tap,
  matched against the fourteen words and dropped — no audio stored, no
  transcript in the ledger or in `track()`, and voice still only proposes.
  A standing listen or any inference from the audio itself is outside the
  rule, which is what closes E4 steps 2 and 3. Because the claim is now
  live tension between two documents rather than a hypothetical, the
  privacy page had to stop saying the microphone is never used
  (`PrivacyPolicy.tsx`, `About.tsx`; pinned by their tests).

## Cut (2026-11-04)

The check-in had quietly become a classifier: it asked a question,
graded the answer to it, and each pass added a layer instead of removing
one — ~50 more words, then a fuzzy matcher, then a 12-prompt deck, then
a `viaVoice` exception. What left, and why:

- **`aspire`/`avoid` modes and the rotating prompt deck.** Both
  real-world misfires came from the modes ("I am feeling great" →
  Heavy), and the second fix established a rule no user can hold: the
  same sentence meaning different things depending on the channel used
  *and* what the RNG rolled. Rule 3 says people learn one grammar once.
  One question, always: *How are you feeling?* The variety now comes
  from what the room remembers (E6) — variety about *this* user, not a
  writerly pool that reads the same for everyone. Predictability is a
  feature of calm; ritual is the actual mechanism by which a breathing
  practice works.
- **Auto-select on voice.** Propose-only, per above. A miss and a hit
  become the same interaction, which retires three tiers and makes the
  whole "Brume misread me" class unreachable.
- **The free-text margin** (`checkinMargin.ts`, "add a word?"). The
  memory idea arrived one step too early: it stored the one thing the
  privacy contract forbids as data (their words), could not be
  aggregated client-side without the LLM that `AGENTIC.md` keeps out of
  this loop, and baked `mode` in as a permanent confound the moment the
  prompt went random. It collected the sensitive thing and got none of
  the value. Replaced by a closed-set reason — what the recap can
  actually use, in less surface. A private line still belongs in the
  product: as E2 arm B, never as analysis substrate.
- **Standing: Home goes back to Begin and the chips.** Breath-cue pills,
  presence pills, room settings and the rhythm picker all sit on the
  literal first screen today — rule 5 inverted, ~20 decisions where the
  doctrine promises one. Depth appears after the first session.

## Content rules for everything here

The research behind these experiments (slow breathing, art-making) can
shape the *design*, but none of it may appear as a claim in the product,
prompts or marketing: no health/medical/hormone/outcome claims, no
scores, no streaks, and nothing sensed from the body or inferred from a
signal (`AGENTS.md`, "We do not sense you"). The check-in microphone is
the one bounded exception — one sentence per tap, matched to a closed set
of fourteen words, nothing recorded — and it stays inside the rule only
for as long as it does exactly that. Describe the rhythm and the
experience, never the result.

Design guidance we take from the research without quoting it:
- No rhythm is magic (5.5 vs 12 breaths/min showed no difference in the
  largest blinded trial), so few simple patterns, and put effort into the
  experience around them. Keep fast breathing and breath-holds out of the
  default flow.
- Self-judgment undermines art-making's benefit, so "make something, not
  something good": no gallery, no ratings, no "good/bad", nothing shared
  by default, and the work fades.

## Status board

| | State |
| --- | --- |
| Event taxonomy (`src/lib/events.ts`) | **wired + tested** |
| E4 step 1 — room answers touch (Home) | **built**, desktop pixel-verified; phone touch/scroll unverified |
| E1 — material variations | variations pending from owner; skins-only, in room settings |
| E2 — Words Card arms | **not started**: needs the flag mechanism (`arm` is always `sentence`) |
| E3 — landing | instrumented (`landing_*`); no analysis yet |
| E5 — opt-in reminder | not started (secondary to E6) |
| Check-in classifier (modes, prompt deck) | **cut 2026-11-04** — one question; voice proposes only |
| The margin (free-text note) | **cut** — replaced by closed-set reasons (`checkinLedger.ts`) |
| The ledger (`checkinLedger.ts`) | **built**, device-local, tested; nothing reads it yet |
| Cue texture mid-session (the glyph) | **built 2026-11-04** — spoken → breath → quiet on one button, browser-verified; preview row and glyph share `CUE_STATES` |
| Brume's own spoken line (`spokenGreeting.ts`) | **rewritten 2026-11-04** — closed table keyed valence × daypart; never echoes the catalog, never generated |
| E6 — the room remembers | **not started**: needs the ledger (done) + an arm flag (todo); the counter now exists, so D7 is readable from day one of traffic |
| Companion as a persistent surface (widget / host) | **not started**: research-backed, unbuilt; the `android/` shell is empty |
| Home surface count | **too high** — cues, presence, room settings and rhythm picker all sit on the first screen; strip after the cohort reads |
| Privacy copy for anonymous counts | **corrected 2026-11-04** — the page now separates the five events the counter receives from the counts that stay on the device; the check-in is counted as a position and never as a word, the mic is transient; any widening of `WIRE` updates this page in the same commit |
| Sensing rule ("we do not sense you") | **rewritten 2026-11-04** — the mic is transient, opt-in, records nothing; `PrivacyPolicy.tsx` + `About.tsx` no longer claim it is never used |
| OneSignal dashboard | **check**: no streak-framed journey may exist (see `docs/BRUME.md` tag table) |
| Bar for going live (X%, N) | **set** — 25% / 50 / +8pt gap / 5 voices |

## The experiments

### E1 — Room and material variations: what invites play?
- **Question:** which materials/variations do people explore, settle on,
  and leave replenished — rather than restless, like a feed?
- **Variations** should differ along clear axes (colour, motion energy,
  texture) so we can tell which axis people respond to.
- **Signals:** material switches per session, time in room, first pick,
  final pick; then post-session "How is it now?" for heavy explorers vs
  non-explorers.
- **Healthy if:** explorers feel the same or better afterward.
  **Kill / rethink if:** exploring correlates with feeling worse or with
  leaving sooner (a feed in disguise).
- The landing (E3) gives play a natural end.

### E2 — Words Card: is a sentence for someone else the right form?
Arms to compare:
- **A** the current sentence for someone else (with optional quiet room link).
- **B** a private line for yourself: one intention for the next hour
  (the "just for me" path exists, so this is cheap).
- **C** just the word, no card.
- **D** a visual artifact: the room as it looked, with the word.
- **Signals:** copy/share rate vs skip rate; return visits afterwards.
- **Why B matters:** closest to "the 90-second transition between
  thinking and doing".

### E3 — Landing and self-ending
- `LANDING_SECONDS` (90 s): the next inhale boundary self-pauses into the
  landing; a tap resumes once; ~10 s idle completes.
- **Signals:** share of sessions that reach the landing; resume-tap rate;
  return rate of landing-reachers vs early stoppers.

### E4 — Make something with the breath (mist drawing)
A ladder; stop climbing when demand stops showing up.
1. **The room answers touch, no sensors. (BUILT — Home only)**
   Press and drag on empty space and the room leaves soft mist. There is
   no page, no mode, no button, no copy. The brush breathes with the
   companion (same cosine, same clock, same 7 s period as the sprite's
   own breath — a test pins this to the engine), so dabs are fuller when
   the sprite is fullest. Hurried strokes go thin and faint, mirroring
   the mascot's hush (1200 px/s). Nothing is saved, rated or shared;
   dabs fade in ~14 s. Buttons, links, fields and the mascot keep their
   own taps — a stroke never starts on them.
   Files: `src/lib/mistBrush.ts`, `src/components/atmosphere/RoomTouch.tsx`.
   *Fallback if always-on proves noisy near Begin:* one deliberate
   gesture on the mascot (press and hold to enter drawing) — still no
   page and no menu.
2. ~~Opt-in microphone breath input, on-device, nothing recorded or sent.~~
   **Closed 2026-11-04, and it is now forbidden rather than undecided.** The
   sensing rule allows capture that returns a word from a closed set and
   keeps nothing; measuring the breath itself is inference from a signal,
   which is exactly what the rule now names as not allowed. The check-in
   mic that shipped is the ceiling, not a first step.
3. ~~Opt-in camera/face input.~~ Same rule, decided: no.
- **Step 1 question:** does anyone touch the room at all, and does it
  pull them toward Begin or away from it?
  **Signals:** `room_touch` (strokes, seconds, material) per Home visit;
  share of Home visits with any touch; Begin rate for touchers vs not;
  repeat touching on later days.
- **Kill step 2/3 if:** step 1 sees little use (permissions not worth it).

### E5 — Return without nagging
One opt-in daypart reminder (OneSignal is wired) vs none. Tests the
anti-Tamagotchi bet: does a quiet product retain without guilt mechanics?
Secondary to E6 — a reminder is a delivery mechanism for being
remembered, and on its own it only proves we can interrupt someone.

### E6 — The room remembers (the retention test)
- **Question:** does being *noticed* cause a return visit? This is the
  product's actual thesis, and it is the one experiment worth clearing
  everything else for.
- **Treatment:** once the ledger holds ≥7 entries, Home puts one line
  under the question, composed from closed vocabulary and counts —
  "restless three mornings this week." No chart, no score, no streak, no
  insight-voice ("work is stressing you"): the companion names what it
  saw and the user draws the conclusion. Control: the same Home, no
  line. The rotating deck's whole job was to make the room feel alive
  each visit; this does it with the user's own weather instead.
- **Signals:** D7 return, memory-line on/off; whether the line is
  ignored, dismissed or opened; check-ins per week after first exposure;
  ledger growth. Reason codes supply the trigger axis the free-text note
  never could, and joining sessions by day supplies the minutes.
- **Blocked on:** nothing but traffic. D7 is a counter-side number now —
  `visit` carries the day gap and the counter buckets it, so returns read
  from `GET /api/metrics` as soon as there are enough new arrivals. The
  ledger half (≥7 entries → one line on Home) is buildable now and reads
  nothing off-device; the arm flag still needs deciding per the taxonomy
  note above (an arm is a name for a thing users can't see, so it must not
  leak into the UI).
- **Healthy if:** the treated arm returns more *and* the returns are
  voluntary (no reminder needed) — E5 stays off in the treated arm so the
  two effects don't blur.
- **Kill / rethink if:** returns don't move. Then Brume is a *session*,
  not a *companion*, and the honest move is selling the ritual into hosts
  where we get invoked rather than remembered. Either answer is worth
  more than building both futures out of the same calendar.
- **Honest limit:** at n=50, a 25% arm reads anywhere from 12% to 38%.
  We are looking for a large gap plus a qualitative signal from at least
  five people, not statistical significance. Do not schedule the recap,
  the widget or sync until this reads.

## Event taxonomy (anonymous, counts only)

Never a user's words, never the drawing, never message text. Every event goes
through `track()` in `src/lib/events.ts`, whose type map is the contract: a
number, a boolean or a member of a closed set, so there is no field a sentence
could be put into.

**The wire is `src/lib/metrics.ts` (added 2026-11-04)** — a same-origin POST to
`/api/metrics`, served by `netlify/functions/metrics.mjs` and stored in Netlify
Blobs as one aggregate document per day. Only the seven events named in its
`WIRE` leave the device: `visit` (two day numbers), `session_start`,
`session_complete`, `session_abandon`, `after_answer`, and the two sentence
acts (`words_card_shown`, `words_written`) that make the qualitative bar
countable — see "Qualitative" below. A field the wire doesn't
name is dropped before the request; a string that isn't shaped like a catalog
id is dropped too; the counter re-checks both and buckets every number, so the
most anyone can read out of it is how many. `src/lib/__tests__/metrics.test.ts`
pins the client map and the server map to each other — widening one without the
other fails the test.

`trackEvent` in `src/lib/analytics.ts` still has **no provider**: no PostHog or
Mixpanel script loads anywhere, so the console-in-dev path is the only other
consumer. Everything else in the table below — check-ins, reasons, materials,
cues, touches, Words Card copies — is counted locally and never sent. Wiring a
provider is not a config change: it is the moment `PrivacyPolicy.tsx` starts
describing transmission that actually happens, so that page and its test change
in the same commit.

Reading the counter: `GET /api/metrics` returns the daily documents; set
`METRICS_READ_TOKEN` in the function env to require
`Authorization: Bearer <token>`. Cohorts are read across days — `since_first`
says how long a device has been around, `gaps` says how long it waited between
visits, and `since_first["0"]` on a day is that day's new arrivals.

All events go through `track()` in `src/lib/events.ts`. Its type map is the
privacy contract: every property is a number, a boolean or a member of a
closed set, so there is no field where a user's words, a message or a drawing
could be sent. Add the event there (and here) before wiring it. A test asserts
every value sent is a number, a boolean or a short id.

| Event | Properties | Fires |
| --- | --- | --- |
| `visit` | `days_since_first`, `days_since_last` | once per calendar day (two local day numbers; no id, no cookie) |
| `session_start` | `pattern`, `mode` | store `startSession` |
| `session_complete` | `pattern`, `seconds`, `cycles` | store `completeSession` |
| `session_abandon` | `pattern`, `seconds`, `phase` | session reset while active/paused (never after complete) |
| `landing_reached` | `seconds` | the 90 s self-pause |
| `landing_resumed` | — | tap resumes from the landing |
| `landing_settled` | — | ~10 s idle completes it |
| `checkin_word` | `feeling` (index), `surface` | home chip or decompress |
| `checkin_reason` | `feeling` (index), `reason` (closed set) | a "because" tap |
| `words_card_shown` | `surface`, `arm` | card mounts |
| `words_written` | `surface`, `arm`, `for_me` | the first keystroke that makes the composed sentence theirs — the act, never the words |
| `words_card_copied` / `_shared` | `surface`, `arm`, `room_link`, `for_me`, `edited` | user copies / shares |
| `words_card_heard` | `surface`, `edited` | "Hear it" speaks the card aloud |
| `room_link_toggled` | `surface`, `on` | toggle |
| `material_changed` | `to` (material or `auto`) | override picked in room settings |
| `cue_changed` | `from`, `to` (spoken · breath · quiet) | the session glyph cycled |
| `after_answer` | `choice`, `material_changes` | "How is it now?" answered; `material_changes` = overrides since the last answer (the E1 replenishment link) |
| `room_touch` | `strokes`, `seconds`, `material` | once per Home visit with ≥1 stroke |

**Wired to the counter:** `visit`, `session_start`, `session_complete`,
`session_abandon`, `after_answer`, `words_card_shown`, `words_written`.
Everything else in the table is counted on the device and stays there — the
table describes the contract, and `WIRE` in `src/lib/metrics.ts` is the subset
that travels. `PrivacyPolicy.test.tsx` reads the length of `WIRE`, so the page
cannot keep saying an old number.

**The ledger is not an event.** `checkinLedger.ts` holds the same three
numbers plus a timestamp, on the device, and nothing from it is ever
fetched, logged or spoken — which is what lets the recap exist at all
while the contract stays "numbers, booleans, closed sets." The event is
the shadow cast by one tap; the ledger is the thing the companion reads.
`checkin_word`'s `mode` property is retired with the modes (2026-11-04):
randomised per visit it was a confound, not a signal, and no analysis
should be built on entries that carry it.

Not yet: `arm` is always `sentence` until E2 arms exist. Console output
for events is dev-only now.

Each experiment still needs a flag so cohorts see different arms (todo; E2 `arm` is the first place it plugs in).
Privacy copy must say these are aggregate and anonymous. — **done for the
wired seven** (`PrivacyPolicy.tsx` splits what is sent from what stays on the
device); re-read it whenever `WIRE` widens.

## Bar for going live (written before looking at data)

**D7 return ≥ 25% across ≥ 50 new users, with the E6 memory-line arm at
least 8 points above its own control, and at least 5 people saying out
loud they would miss it.** Set 2026-11-04 — committed before any cohort
data exists, and it stands.

How the percentage is read, so nobody has to guess later: `GET
/api/metrics` returns one aggregate document per day. New arrivals are
`since_first["0"]` summed over the cohort window; a return on day 7 is a
`gaps` entry in the 5–9 band arriving on a later day. The counter holds no
person, so this is a *shape* read, not a true cohort — it can say whether
people come back a week later, and cannot say whether *the same* people do.
Any arm comparison therefore needs the arm flag wired before the read, not
after.

**Checked live on 2026-11-04, and it was not working.** The deployed function
answered both verbs with a 502: it returned a v1 `{statusCode, body}` object
from a v2 function, and the read asked Blobs for `list().keys` where the
installed version answers `list().blobs`. Nothing had ever been recorded. Both
shapes are now pinned by a test that calls the handler, which is the only
reason either would have been caught: `tsc`, the suite and the build were all
green while the endpoint was dead. The cohort window opens the day this
deploys, and a D7 read is a week later at the earliest.

The day's document filled within a minute of the fix going out — nine
`since_first["0"]` arrivals, `session_starts` still zero. Nobody starts a
breathing session by accident, so most of those are loads, not people: a
crawler that runs JavaScript has no localStorage and looks exactly like a first
visit. Until the arrival is gated on an act, read the count of new arrivals as
an upper bound and the ratio between the counts as the thing with meaning.

Both halves are load-bearing: a bare percentage at n=50 is noise with a
decimal point attached, and "they said they'd miss it" on its own is a
favour we ask friends. Wellness base rates are brutal — roughly 95% of
people who start a breathing or meditation practice abandon it — so 25%
is deliberately not ambitious on its own; the *gap* between the arms is
the claim.

Only then do Cloudflare, ChatGPT and an Anna-wide push come back on the
table — and what follows from a pass is paid sync plus the recap, not
pattern unlocks. A solo dev does not out-content Calm.

## Qualitative — the ten conversations

The bar's second half is *five people saying out loud they would miss it*. That
is not a counter reading and it must not become one. The sentences stay on the
device — `checkinLedger.ts` has no field a sentence could go into, and the
wire carries the act of writing, never the words — so what anyone said exists
only in the conversation it was said in.

**The instrument, as shipped.** One optional question after a session, asked
twice in two forms and never more: closed-set on the landing — *"How is it
now?"* (lighter / about the same / still a lot) — and open in the sentence
card, where the line Brume composed is theirs to rewrite. A third question
would make the landing a survey, and a survey is a feed with a smiley.

**What the counter can say about it.** `words_card_shown` — how many opened
the card; `words_written` — how many made the sentence their own (first
keystroke, once per card); `after_answer` — how many answered, and which of
the three. Enough to size a cohort, not enough to know what anyone meant.

**What happens by hand.** Ten conversations. Each one ends with the same two
questions, in this order:

1. *"What was that like?"* — then say nothing. The first answer to the silence
   is the one worth reading.
2. *"If Brume stopped tomorrow, would you miss it?"* — the bar's own wording,
   on purpose. "It's nice" is not a yes, and a yes they had to be asked twice
   for is not a yes either.

Fill one row per person. Verdict in their terms, no sentences: what someone
said in a conversation is not material for a public repository unless they
offer it, and the row's job is to be countable, not to be evidence.

| # | date | would they miss it? |
| - | ---- | ------------------- |
| 1 |      |                     |
| 2 |      |                     |
| 3 |      |                     |
| 4 |      |                     |
| 5 |      |                     |
| 6 |      |                     |
| 7 |      |                     |
| 8 |      |                     |
| 9 |      |                     |
| 10|      |                     |

**Reading it on 7 November:** five *yes* rows, five different people. Fewer
than ten rows filled is a finding about reach, not about the product — say so
in the row's absence rather than rounding up. If the table comes back empty,
the honest line in the next version of this doc is "we heard nothing", and E6's
percentage is then the only thing left to argue from.

## Open decisions

- ~~Is "no camera / no microphone" up for review?~~ **Decided 2026-11-04**
  (see "We do not sense you" above). The rule was already being broken by
  shipped code, so the review was not optional; it was resolved as the
  protection, not the device list.
- Which persistent presence comes first — an Android widget in the empty
  Capacitor shell, or presence inside a host agent (Anna first, since it
  already ships)? They are the same bet about the companion's continuity
  and a different bet about distribution.
- Does the monthly recap get built before or after E6 reads? (Proposed:
  after. The recap is the reward for a mechanism we have not yet proven
  causes a return visit.)
- Is an arrival a person? `visit` fires on load, so a JavaScript crawler is
  counted as a new arrival and the ≥50-user half of the bar can be met by
  spiders. Gating the send on a first act — a tap, a key, the tab becoming
  visible — would fix the number and stop counting the person who reads the
  page and leaves without touching it, which is a real arrival too. Not
  decided, and not decided silently mid-window.
- If E6 fails: is the product a session sold into hosts, and does the
  consumer web app become a demo of it?
