# Brume — Product Brief

> **Brume** (French: *mist*) — a calm companion for the two minutes between
> things. Nothing to get right, nothing to prove.
> Shipaton 2026 entry · bundle `xyz.trustfall.brume` · see `docs/STRATEGY.md`
> (historical — the camera-verification thesis there is superseded).

## One-liner

Brume is a guided breathing companion. You pick a rhythm — or say how the
moment is and we suggest one — and the session is just the breath and the
clock. Afterwards you can put the moment into one honest sentence and copy or
share it. No camera, no scores, no streaks, no account required.

> **Status note (2026-11):** the original "camera-verified proof" concept is
> dropped, not just unproven — the web app does not request or use the camera
> at all. Results report recorded practice time only; credentials are not
> minted or shown. `docs/STRATEGY.md` is kept for history.
>
> **Tech migration (2026-10-17):** frontend moved to exact pinned versions —
> React 19, Vite 8, Tailwind 4, wagmi 3, Capacitor 8 — see
> [DEPENDENCIES.md](./DEPENDENCIES.md) for pins, exceptions, and verification
> status.

## Core loop (retention engine)

1. Open → optional check-in word (Okay / Stretched / A lot / At limit / Overwhelmed) → **"here's a rhythm"**
2. Guided breathing session — orb and clock only, nothing to get right
3. Post-session: practice-time summary → "put it into words" — one honest sentence you can copy or share
4. /decompress: two unhurried minutes, then the same check-in → words loop

## Screens (v1 scope — 6, nothing more)

| Screen | Notes |
|---|---|
| Onboarding | Emotional check-in; no permissions, no account |
| Home | "How is it for you right now?" — check-in words suggest a rhythm; doors to reset and /decompress |
| Session | Breathing animation only (no camera) |
| Decompress | Two-minute pause → check-in → words card |
| Post-session | Practice-time summary + words card (no score or verification marks) |
| Progress | Sessions and minutes — plain facts, no streaks shown |
| Paywall | RevenueCat; see below |

## Monetization (HAMM evidence)

- **Free:** the full core loop — 5 core patterns and /decompress.
- **Brume Premium** (`brume_premium` entitlement): 20+ patterns, deep session
  insights, adaptive sessions, accountability buddies.
  Monthly + annual, **7-day trial**. Judges get a promo code (submission requirement).
- **Agent API** (`backend/mcp-server`): metered verification/coaching calls —
  the two-sided monetization story: consumers pay via RevenueCat, agents pay per call.
- Port existing plumbing: `revenuecat_config.py`, `revenueCatAuthIntegration.ts`.

## OneSignal Journeys (Keep Them Coming Back evidence)

**Wired client-side** (`src/lib/notifications/oneSignal.ts`, hooks in `App.tsx` init +
`sessionStore.completeSession`). Permission is asked **in context** — after the first
completed session, never on first open. SDK: `onesignal-cordova-plugin` (Capacitor).

**Tag contract v1** (client → OneSignal; configure Journeys against these):

| Tag | Values | Journey |
|---|---|---|
| `first_breath_done` | `"true"` | **1. First Breath** — trigger: user 24h old AND tag absent → "Your first breath is waiting" |
| `last_session_at` | ISO date | **2. Come back when you're ready** — trigger: `last_session_at` ≥ 1 day stale → "Your mist is waiting" |
| `streak` | number | tag still sent for segmentation; streaks are not shown in the UI |
| `sessions_total` | number | **4. Weekly digest** — Sunday summary: sessions and minutes |

**3. Buddy Accountability** needs a server leg (client can't securely notify another
user): a small server leg calls OneSignal REST with the buddy's player id when a
session completes. Post-release task — Journeys 1, 2, 4 carry the award story alone.

**Dashboard setup (no code):** create OneSignal app → add iOS/Android platforms →
set `VITE_ONESIGNAL_APP_ID` → build the 3 Journeys above. `identifyUser()` /
`resetNotificationUser()` helpers exist but are unwired until auth settles (works
anonymously via tags meanwhile).

## Cut list for v1 (Thiel-small)

- ❌ Marketplace UI (buried — attestations stay as quiet credentials)
- ❌ Multi-wallet onboarding prominence (wallet = optional, in Settings)
- ❌ Instructor dashboard, wearables, extra chains
- ✅ Keep: vision engine, emotional arc, Zen coach, offline PWA behavior

## Submission checklist (due Sep 30)

- [ ] App live on Google Play (target Sep 3) + iOS submitted
- [ ] ≤2-min demo video (YouTube) — show: check-in word → breathing session → "put it into words"
- [ ] 1024×1024 icon (mist mark on `brume-900`)
- [ ] 1179×2556 screenshot, no device frame
- [ ] Judge promo code / free trial
- [ ] Devpost text: lead with the monopoly line + two-sided monetization

## Open build questions

1. Apple developer account active? (longest-lead item — confirm today)
2. google-services.json for OneSignal push on Android (gradle already guards for it)
3. Domain: `brumeapp.netlify.app` for landing + agent API docs
