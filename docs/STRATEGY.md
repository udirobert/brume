# Strategy: Creative Monopoly & Wedge

> v3 — Thiel/PG consolidation pass. Decisions locked: revenue model is **agent-native**
> (Proof-of-Practice as a Service); the Shipaton app is named **Brume** (`xyz.trustfall.brume`);
> NFT marketplace buried (sunk cost). Today is **Aug 27** — we are *inside* the Shipaton window
> (Aug 1 – Sep 30, 2026). Sprint mode: release within days; every week of delay costs
> Grand-Prize traction-measurement time.

---

## 1. Diagnosis (unchanged, sharpened)

The old positioning — *"AI + CV + Web3 + social wellness platform"* — lists technologies, not a monopoly (Thiel red flag), and targets "everyone" (PG red flag). It also predates agentic primitives: the Zen agent is an Eliza-era character file, not a service agents can pay to call.

## 2. The Consolidation Insight (holds)

Every component is one capability — **verifiable practice** — seen from four angles:

| Layer | Component | Role |
|---|---|---|
| **Measurement** | Camera vision (MediaPipe breath tracking, FACS emotional overlay, adaptive sessions) | *Proves* a human breathed, and how state changed |
| **Interpretation** | Zen AI coach, pre/adaptive/post emotional arc | Turns signals into guidance |
| **Attestation** | Flow on-chain records | Makes practice *portable and verifiable* — credentials, not collectibles |
| **Distribution** | Lens graph, verified-only leaderboard, accountability hub | Makes proof *social* and unfakeable |

> **Monopoly claim: Brume is the trust layer for breathwork — the only platform that can verify a human actually practiced.**

The 10x: every competitor is a timer with audio. None can *know* you breathed. In an agentic world this 10x gets sharper, not duller — agents are proliferating as coaches, therapists, and wellness concierges, and **none of them can verify anything about the physical world**. We own the sensor.

## 3. Thiel Checklist (v2)

- **Proprietary tech:** camera-based breath + emotion verification, no wearable. The moat is accuracy across lighting/skin tones/devices — engineering budget's first call.
- **Network effects:** attestations on Lens's open graph; now also **agent adoption** — every agent that integrates our verification tool makes it the default primitive.
- **Scale economies:** the verification API serves the 10th agent at near-zero marginal cost. Classic software scale the old Web3 plan never had.
- **Brand:** "Imperfect" — *progress you can prove.*
- **Secret:** the wellness industry runs on the honor system; and in the agent economy, *no agent can trust a human's self-report of physical practice.* Whoever verifies practice owns the trust layer — for humans **and** for the agents coaching them.

## 4. The Wedge: Agent-Native "Proof of Practice as a Service"

**The pivot:** the customer is no longer the instructor (SaaS) — it's the **agent**. Sell verification as a primitive.

**The offering (what we expose):**

```
MCP server / paid API (metered, x402-style per-call):
  breath.verify_session(video_metrics)   → verified: bool, rate, depth, score
  breath.recommend_pattern(state)        → pattern from detected emotional state
  breath.attest_practice(session_id)     → portable, on-chain credential
  coach.respond(context, vision_metrics) → Zen coaching grounded in real signals
```

Who pays: AI coach/companion apps, corporate wellness bots, telehealth and therapy-adjacent agents, focus/productivity agents, games with calm-down mechanics. They all need to answer "did the human actually do it?" — and we are the only ones who can say yes.

| | **A. Agent API (PPaaS)** ⭐ | **B. New mobile app (flagship client)** | **C. Lens/Flow attestations** |
|---|---|---|---|
| Role | **The business** — metered verification/coaching calls | **Shipaton vehicle + data flywheel + consumer revenue** (RevenueCat IAP) | **Trust substrate** — cheap, already built |
| Thiel fit | Small market (agent builders) we can own outright; expands with the agent economy | Beachhead audience we hand-recruit; PG's unscalable phase | Compounds quietly |
| Risk | Agent-payment rails still maturing — ship metered API keys first, x402 second | Must be a *new* app (Shipaton rule) | Crypto-cyclical; keep as infra, not story |

**Sequence:** (1) Ship the new mobile app for Shipaton — it generates verified-session data (the flywheel that improves the moat) and consumer revenue. (2) Expose the same engine as the agent API — the app becomes the reference client and live demo. (3) Instructors/studios/corporate return later as *expansion*, reachable through the agents that already serve them.

## 5. Shipaton Battle Plan (Aug 1 – Sep 30, 2026)

### Hard constraints
- **Brand-new app**, first *public* release inside Aug 1 – Sep 30, 2026. Updates to previously released apps don't qualify.
  - ✅ Identity locked: **Brume**, bundle `xyz.trustfall.brume` (renamed from `com.imperfectbreath.app` on branch `feat/brume`). Still confirm the old id was never published to any store. We are inside the window — release ASAP; the pre-Aug-1 embargo no longer applies.
- **RevenueCat SDK** must power ≥1 IAP. Plumbing already exists (`revenuecat_config.py`, `revenueCatAuthIntegration.ts`) — port it into the new app.
- Submission assets: 2-min demo video (YouTube/Vimeo), 1024×1024 icon, 1179×2556 screenshot, free trial or promo code for judges.

### Award targeting (pick 3, focus)
| Priority | Award | Why we win |
|---|---|---|
| 🎯 Primary | **HAMM** (most creative/robust monetization) | Two-sided revenue on one primitive: consumers pay via RevenueCat IAP, agents pay per verification call. Nobody else in the field has an agent-revenue story — this *is* the new monetization playbook. |
| 🎯 Primary | **Grand Prize** (traction) | Accountability loops + shareable verified credentials are a growth engine; judged on post-release growth hustle. |
| 🎯 Primary | **Peace Prize** (social good) | Camera-only = no $300 wearable gatekeeping. Free-tier verified breathwork for anxiety/stress is a genuine accessibility story. |
| 🆓 Free rider | **#BuildInPublic** | The narrative writes itself: "we built this *before* agentic primitives existed; now we rebuilt it as the trust layer for the agent era." Post the whole consolidation pass. |
| 🆓 Free rider | **Keep Them Coming Back (OneSignal)** | Streak-rescue and accountability-buddy nudge Journeys are cheap to add and directly on-mechanic. |
| 🏃 Stretch | Influencer — Yoga & Fitness | "What should I do today?" is literally our emotional-arc engine (detected state → today's plan). Only if bandwidth allows. |
| ⏭️ Skip | Kotlin, Replit, Game, Galaxy, Catvertising | Stack mismatch or off-thesis. |

### Timeline (Aug 27 → Sep 30 — 5-week sprint)
- **Wk 0 (Aug 27–31):** Brume rebrand ✅ (`feat/brume`), bury marketplace UI, RevenueCat entitlement + paywall, Play internal testing. Start Apple developer account / iOS build NOW — App Review latency is the biggest schedule risk.
- **Wk 1 (Sep 1–5):** **Public release target: Sep 3** — Google Play first (faster review), iOS same week. OneSignal journeys live day one. #BuildInPublic daily cadence starts.
- **Wk 2–3 (Sep 6–20):** one documented growth experiment per week (Grand Prize evidence), MCP server alpha (`backend/mcp-server` ✅ scaffolded) + 2–3 agent design partners, RevenueCat paywall experiments.
- **Wk 4 (Sep 21–27):** feature freeze, record ≤2-min video, produce assets, judge promo codes.
- **Sep 28–30:** buffer + submit. Hard deadline Sep 30.

## 6. Consolidation Decisions (v2)

- **Bury the NFT marketplace.** Confirmed sunk cost. Attestations survive as *credentials* (infra), never as a storefront.
- **Build the agent primitives:** MCP server + metered API around the vision engine. This is the revenue model now.
- **RevenueCat in the new app:** free tier (verified sessions, core patterns) → premium (advanced patterns, deep coaching, credential gallery). Consumer IAP funds the flywheel; agent API is the scale story.
- **Double down (unchanged):** verification accuracy (the moat), the emotional arc (the love), accountability hub (retention + OneSignal award).
- **Keep saying "verified record of practice," not "NFT,"** to non-crypto audiences.

## 7. Monopoly Metrics (v2)

- % sessions verified; **D30 retention verified vs. unverified** (thesis test)
- **Agent API:** integrated agents, calls/month, revenue per 1k verified sessions
- **Consumer:** trial→paid conversion (HAMM evidence), D7/D30 streak survival (OneSignal evidence), credential shares per verified session (virality evidence)

## 8. Open Questions

1. ~~New app name/identity~~ — **decided: Brume** (`xyz.trustfall.brume`). Remaining: verify the old id was never store-listed; register `brumeapp.netlify.app`.
2. **Agent payment rails** — metered API keys at launch, x402-style per-call when? Recommendation: keys first.
3. **Verification accuracy bar** — what false-accept/reject rates make "verified" sellable to agent builders? Needs a measurement pass before the API pitch.
4. **Award bandwidth** — confirm the 3 primary targets (HAMM / Grand / Peace) so scope stays Thiel-small.
