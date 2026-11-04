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

## Content rules for everything here

The research behind these experiments (slow breathing, art-making) can
shape the *design*, but none of it may appear as a claim in the product,
prompts or marketing: no health/medical/hormone/outcome claims, no
scores, no streaks, no camera, no microphone (`AGENTS.md`). Describe the
rhythm and the experience, never the result.

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
| E5 — opt-in reminder | not started |
| Privacy copy for anonymous counts | **todo** (`PrivacyPolicy.tsx` wording is generic) |
| OneSignal dashboard | **check**: no streak-framed journey may exist (see `docs/BRUME.md` tag table) |
| Bar for going live (X%, N) | **unset** |

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
2. Opt-in microphone breath input, on-device, nothing recorded or sent.
   Needs a decision to revisit "no microphone".
3. Opt-in camera/face input. Heaviest: permissions, weak devices,
   privacy perception, and a face on screen invites self-judgment.
- **Step 1 question:** does anyone touch the room at all, and does it
  pull them toward Begin or away from it?
  **Signals:** `room_touch` (strokes, seconds, material) per Home visit;
  share of Home visits with any touch; Begin rate for touchers vs not;
  repeat touching on later days.
- **Kill step 2/3 if:** step 1 sees little use (permissions not worth it).

### E5 — Return without nagging
One opt-in daypart reminder (OneSignal is wired) vs none. Tests the
anti-Tamagotchi bet: does a quiet product retain without guilt mechanics?

## Event taxonomy (anonymous, counts only)

Never a user's words, never the drawing, never message text. Uses
`trackEvent` in `src/lib/analytics.ts` (PostHog/Mixpanel if present,
console in dev).

All events go through `track()` in `src/lib/events.ts`. Its type map is
the privacy contract: every property is a number, a boolean or a member
of a closed set, so there is no field where a user's words, a message or
a drawing could be sent. Add the event there (and here) before wiring it.
A test asserts every value sent is a number, a boolean or a short id.

| Event | Properties | Fires |
| --- | --- | --- |
| `visit` | `days_since_first` | once per calendar day (two local day numbers stored; no id, no cookie) |
| `session_start` | `pattern`, `mode` | store `startSession` |
| `session_complete` | `pattern`, `seconds`, `cycles` | store `completeSession` |
| `session_abandon` | `pattern`, `seconds`, `phase` | session reset while active/paused (never after complete) |
| `landing_reached` | `seconds` | the 90 s self-pause |
| `landing_resumed` | — | tap resumes from the landing |
| `landing_settled` | — | ~10 s idle completes it |
| `checkin_word` | `feeling` (index), `surface` | home chip or decompress |
| `words_card_shown` | `surface`, `arm` | card mounts |
| `words_card_copied` / `_shared` | `surface`, `arm`, `room_link`, `for_me`, `edited` | user copies / shares |
| `words_card_heard` | `surface`, `edited` | "Hear it" speaks the card aloud |
| `room_link_toggled` | `surface`, `on` | toggle |
| `material_changed` | `to` (material or `auto`) | override picked in room settings |
| `after_answer` | `choice`, `material_changes` | "How is it now?" answered; `material_changes` = overrides since the last answer (the E1 replenishment link) |
| `room_touch` | `strokes`, `seconds`, `material` | once per Home visit with ≥1 stroke |

Not yet: `arm` is always `sentence` until E2 arms exist. Console output
for events is dev-only now.

Each experiment still needs a flag so cohorts see different arms (todo; E2 `arm` is the first place it plugs in).
Privacy copy must say these are aggregate and anonymous.

## Bar for going live (write it down before looking at data)

Set before the cohort starts, e.g. D7 return above **X%** across at
least **N** people, plus some of them saying they would miss it. Fill in
X and N, then commit this file. Only then do Cloudflare and ChatGPT come
back on the table.

## Qualitative

Ten users beats a dashboard now. One optional question after a session
("What was that like?"); read every answer.

## Open decisions

- Is "no camera / no microphone" up for review, or does E4 stay at step 1?
- Values for X and N above.
