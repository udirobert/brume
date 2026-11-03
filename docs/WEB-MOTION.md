# Web motion — the CALM transition grammar

Post Tier-A/B motion upgrade. The vocabulary, its numbers, and where
each piece lives, so future PRs change motion *deliberately*, not by
drift. Inspiration set: bloub's measured-state discipline,
grokbot-desktop's motion-as-interaction-protocol, smear/showreel's
deform-along-velocity principle, MotionSites' spec-and-freeze-frame loop.

## The grammar

| Move | Numbers | Lives in |
| --- | --- | --- |
| Signature ease (entrances) | `cubic-bezier(0.16, 1, 0.3, 1)` | `src/lib/motion.ts` `EASE` |
| Durations | quick 0.2s · standard 0.5s · slow 0.9s | `src/lib/motion.ts` `DURATION` |
| Settle ease (the *only* sanctioned overshoot — releases) | `cubic-bezier(0.34, 1.56, 0.64, 1)` | `EASE_SETTLE` + CSS `--press-return` |
| Press squash (press) | `translateY 3px · scaleX 1.02 · scaleY 0.96`, 70ms fast-in | CSS `:active` rules + `PRESS` |
| Press release | 260ms settle ease, passes rest once | CSS `--press-return` |
| Page change (core loop) | root out 180ms · in 320ms rise 0.6% · entry morph 340ms — **non-core routes only now** | `src/styles/brume-transitions.css` + `src/lib/viewTransition.ts` |
| Companion glide (core journey) | 0.5s signature ease between anchors · immediate on scroll/resize · opacity-only under reduced motion | `src/components/companion/JourneyCompanion.tsx` |
| Feeling flip (paired chips) | inner face rotateX −72° → 0 in 0.32s, button stays put · opacity-only under reduced motion | `src/components/checkin/PairedFeelings.tsx` |
| Session handover (preview ↔ breath) | opacity-only, outgoing pops out of layout so the anchor rect is real | `ResponsiveEnhancedSession` `AnimatePresence mode="popLayout"` |
| Post-session panels | in-place morph, never a growing drawer — main ↔ words ↔ details swap at 0.28s opacity+rise (opacity-only reduced) | `PostSessionCelebration.tsx` `AnimatePresence mode="wait"` |

## Rules that don't move

- Transform + opacity only. Reduced motion = opacity only (CSS zeroes
  the transitions; the view transitions run without animation).
- Say reassurance once per screen. Playful motion lives on the mascot
  only.
- No health/medical/hormone claims in any copy introduced by these UIs
  (`copy-claims.test.ts` guards the vocabularies it knows about).

## How the core journey moves

The core loop (Home → session → post-session → Home) no longer
snapshots pages with `viewTransitionTo`. Continuity comes from two
persistent actors instead:

1. `JourneyCompanionProvider` mounts ONE `BrumeMascot` outside the
   routes. `CompanionAnchor` marks where it belongs on each screen;
   registration hands it a real rect and the mascot glides 0.5s to
   the new anchor — the same SVG across the whole journey. On scroll
   or resize it tracks its anchor immediately; under reduced motion
   geometry jumps and only opacity animates.
2. `RoomEnvironment` mounts ONE WebGL1 canvas behind the core routes.
   The chosen feeling selects a material (waves, sand, cells, snow,
   ink — `src/lib/feelings.ts`), breath and practice duration feed it
   slowly, and a `Still room` toggle or reduced motion draws it
   statically. RAF is capped at 30 fps and 900k pixels; a CSS
   fallback covers no-WebGL.

`viewTransitionTo` remains for non-core navigation (forced clicks keep
native behaviour; no-API browsers navigate instantly). The
`data-vt-entry` morph convention stays available for routes that still
use it.

## The feeling chips

Each of the five `PairedFeelings` chips holds a word and its
counterpart. First activation selects the visible face; activating
the same chip again turns the inner label `rotateX −72° → 0` (0.32s)
to the counterpart; switching chips never flips. The selection drives
the feel catalog — mascot state, one-shot reaction, demeanor, orb
tint, room material — in one place (`src/lib/feelings.ts`), so
positive faces can celebrate and heavy faces never do.

## The mascot's own grammar

"Playful motion lives on the mascot" — so the mascot carries the
richest grammar in the app. It lives in `anna/bundle/mascot-engine.js`
(shared by the Anna bundle, this app via `BrumeMascot.tsx`, and the
MCP widget — one engine, one painter in `mascot.js`).

| Move | Numbers |
| --- | --- |
| Idle stillness | companion: bob −0.45 + rotate ±0.35° (7s) · quiet: bob −0.35 (6s) — the body holds nearly still; life comes from the gaze |
| Gaze wander | slow sinusoids (9s / 13s periods), amplitude by presence |
| The glance | deterministic look-away every 6.4s (`LOOK_PERIOD`), fade in 0.25s, out 0.35s so it wraps continuously; non-companion presence ×0.55 |
| Reactions | three-act curves in `reactionCurve` — **hop** 0.5s (crouch 0–0.14 → apex stretch 0.14–0.55 → fall → touchdown squash 0.86–0.97), **settle** 0.9s (gather 0–0.15 → sink 0.15–0.7 → `outBack` overshoot 0.7–0.97), **celebrate** 0.9s (three shrinking bounces + touchdown squashes, face envelope in/out), **ready** 1.4s (blink at the touch → soften 0–0.28 → exhale release 0.28–0.72 → ground 0.72–1 — the pre-performance routine embodied). Last 3% parks on `REACTION_REST` so every reaction lands exactly — never a snap, never a creep |
| Silhouette | `BODY_POSES` per-state deltas on the three body primitives (`sx`/`sy`/`dy`), emitted as `frame.body.prims`, painted per-primitive in `mascot.js`; part of `pose`, so states morph through the frozen-pose blend |
| Flight smear | the sprite deforms along its velocity between screens: stretch 1+0.18·a along, squash 1−0.11·a across, a = strength·(1−age/0.55s)²; `smearFrom({x,y,strength})` is a one-shot like `react`, wired from `flightVector` (strength = 0.35 floor + scaled to 1 by 400px, so even a hop reads as a dart) |
| Attention | the companion reads HOW you come (no camera): pointer-speed EMA + nearness — fast & near = agitation → `hush` eases toward 1 (bob, wander, glance all quiet); slow & near for 0.6s = arrival → it settles with you, once per approach |
| State blending | every change lerps from the frozen displayed pose over 0.5s `easeOutQuint` — silhouette keys included |

Motion as interaction protocol (`react`/`smearFrom`/`hush` wired to
real moments): feeling pick → catalog-mapped reaction (`feelings.ts`
— positive faces hop/celebrate, heavy faces ready/settle only),
session phase → ready/settle (`ResponsiveEnhancedSession`),
presence toggle → the current feeling's own reaction (`Index.tsx`),
flight → smear (mount-time, `BrumeMascot.tsx`), pointer agitation →
hush, pointer arrival → settle (`mascot.js` attention layer),
tap the mascot → `ready` arc — taps within 1.6s escalate
ready → hop → celebrate only while the demeanor is open
(`tapReaction` + `allowTapEscalation`); heavy feelings get a subdued
avatar (`mascotDemeanor.ts`) and never escalate.

Pinned by `anna/test/mascot.mjs` (31 tests): purity, no option/avatar
mutation, reactions equal base at expiry, silhouette is state-driven
(survives reduced motion), glance continuity across the 6.4s wrap,
smear aligned/decaying/identity at end.

## The frozen-frame loop

`http://localhost:xxxx/motion-lab` (dev only, `src/pages/MotionLab.tsx`)
renders each move at fixed easings — compare frames instead of
eyeballing live. The mascot strips paint real engine frames via
`createMascot(host, { autoAnimate: false })` + `renderAt(t, opts)`, so
what you critique is exactly what ships. When touching motion, add or
update a strip rather than describing the change in the PR text.
