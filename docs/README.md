# Brume — documentation hub

Two doors: the rules, then this index. Everything else is either a living document or explicitly
marked history.

- **[`AGENTS.md`](../AGENTS.md)** — the project's rules and the doctrine behind each cut. Start here.
- **[`../README.md`](../README.md)** — what the product is, how to run it, how to verify it.

## Living documents

| Document | Purpose |
|---|---|
| [`EXPERIMENTS.md`](./EXPERIMENTS.md) | Product shape (one room, four verbs), the experiments E1–E6, the event taxonomy, and the **bar for going live** — the gate everything else waits behind |
| [`ANNA.md`](./ANNA.md) | Anna Founding Builder program: verified rules, market research, and the §12 progress log (every cut, every review outcome) |
| [`MCP-APP.md`](./MCP-APP.md) | The MCP app: architecture, tools, the inlined widget, and the remaining build list |
| [`AGENTIC.md`](./AGENTIC.md) | Why the web app stays agent-*friendly* and not agentic, and where the agent belongs |
| [`DISTRIBUTION.md`](./DISTRIBUTION.md) | Channels ranked, with the ones we declined and the reason attached |
| [`BRUME.md`](./BRUME.md) | The product brief: core loop, screens, shared mascot, voice ideas |
| [`MASCOT-RESEARCH.md`](./MASCOT-RESEARCH.md) | What Finch, Shmoody and Voidpet prove about companions, and the anti-Tamagotchi stance |
| [`ASSEMBLYAI-ENTRY.md`](./ASSEMBLYAI-ENTRY.md) | The voice-hackathon write-up — also the clearest statement of the propose-never-commit voice rule |
| [`WEB-MOTION.md`](./WEB-MOTION.md) · [`UI-PRIMITIVES.md`](./UI-PRIMITIVES.md) | Motion and control vocabulary for the web app |
| [`DEPENDENCIES.md`](./DEPENDENCIES.md) | Pinned versions, the install policy, and what is deliberately not a dependency |
| [`TESTING.md`](./TESTING.md) | Testing tiers across the three surfaces |
| [`DEVELOPMENT.md`](./DEVELOPMENT.md) | Setup, structure, the three shared contracts, and how to verify a change (its history appendix is the chain-era plan) |

Two things are contracts in code rather than documents, and should be read there:
`src/pages/PrivacyPolicy.tsx` (the privacy page is the promise, and its test reads the length of
`WIRE` in `src/lib/metrics.ts`) and `AGENTS.md` ("Getting a change onto the box") for operating the
voice service.

## History — read as record, not as the app

| Document | Status |
|---|---|
| [`STRATEGY.md`](./STRATEGY.md) | Superseded 2026-11. The "verifiable practice" thesis (camera proof, agent API monetization) that Brume was built on and then rejected |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) · [`API.md`](./API.md) | The chain-era system design: Flow, Lens, wallet auth, vision endpoints. The web app calls none of it |
| [`AUTHENTICATION.md`](./AUTHENTICATION.md) | Chain/wallet sign-in. Sign-in is now an email |
| [`CONSOLIDATION.md`](./CONSOLIDATION.md) · [`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md) · [`PR9_REVIEW_NOTES.md`](./PR9_REVIEW_NOTES.md) | Point-in-time decision and review records |
| [`RUNBOOK.md`](./RUNBOOK.md) | The Shipaton console runbook (Aug–Sep 2026): Apple account, RevenueCat, OneSignal, the camera permission string. The Shipaton window is over and there is no paywall or camera to run |
| [`LAUNCH-PLAYBOOK.md`](./LAUNCH-PLAYBOOK.md) | Copy-ready launch assets. Section 2 (MCP deploy, ChatGPT directory) is **on hold** behind the retention bar; the rest is unscheduled |
| [`HACKTOBERFEST_WEEK3.md`](./HACKTOBERFEST_WEEK3.md) · [`ads/`](./ads) | Drafts and campaign material |

## How the pieces run

```
browser (React 19 / Vite 8)
  ├─ Supabase            optional email sign-in; your own rows
  ├─ /api/metrics        same-origin counter → Netlify Blobs, daily aggregates, 8 events
  └─ /api/tts, /api/stt  voice → FastAPI service on Hetzner (api.brume.trustfall.xyz)
                            the Netlify function and the vite middleware are the
                            fallbacks; the same contract in all three places

Anna agent  → anna/executas/brume (Python, plan.js parity) + the window's own model call
MCP host    → mcp/worker.js + mcp-core.js, importing anna/bundle/plan.js
```

## Deploying

- **The site:** a push to `main` deploys the Netlify site (`netlify.toml`; `pnpm build`, SPA fallback,
  `/api/tts` and `/api/metrics` redirects to functions).
- **The voice service:** *not* `deploy-hetzner.sh`. That script provisions as `root@` on port 22,
  which times out, and it would re-provision a shared box. The route that works is the four-file `scp`
  plus `docker-compose up -d --build vision-service` written out in `AGENTS.md` ("Getting a change onto
  the box"). Never `docker-compose down`, and `VOICE_SHARED_SECRET` unset is a supported state.
- **The Anna app:** `cd anna && anna-app apps publish`, then — only when the owner decides —
  `anna-app apps submit-review brume`. Publishing is not submitting; review is done by the owner.
- **The MCP app:** not deployed, by decision. See `MCP-APP.md` for what a deploy would need.

## Verifying a change

```bash
pnpm vitest run && npx tsc --noEmit && pnpm lint          # web app
(cd anna && npm test && anna-app validate --strict)        # Anna bundle + manifest
(cd anna/executas/brume && python3 -m unittest test_plan)  # Python parity with plan.js
(cd mcp && npm test)                                       # MCP contract + widget
```

Browser QA lives in `anna/test/browser-qa.mjs` (fake host on :4618, agent-browser). Prompt changes:
`node scripts/prompt-check.mjs all` from `anna/` — it uses `anna/.env.local` and does not spend Anna
quota, unlike a real `anna-app dev` chat.
