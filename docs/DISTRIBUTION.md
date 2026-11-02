# Distribution opportunities (2026-11-02)

Context: Anna Founding Builder Program needs ~200 MAU by 2026-11-30; store
browse alone won't get there. Meanwhile the web app and the Anna toolset are
the same product — "agent-friendly, not agentic" (see `docs/AGENTIC.md`).

## Ranked opportunities

### 1. ~~GTransformer AI Buildathon — Nov 13–15, 2026~~ DECLINED
- Good thematic fit (Wellbeing theme, mandatory Responsible AI), but
  participation requires a **$50 Luma registration** — declined 2026-11-02.
  Everything below is the free-only plan.

### 2. ChatGPT app directory via Apps SDK (MCP) — biggest channel
- OpenAI accepts app submissions; apps are plugins built on the Apps SDK
  (built on MCP), listed at chatgpt.com/apps.
- The Anna Executa is already the tools-plus-UI pattern; porting
  `brume_reset`/`brume_complete`-style tools to an MCP app is the smallest
  step into the largest distribution channel.
- Lands the AGENTIC.md decision in practice: Brume is a quiet room other
  agents can send people into.
- Wellness apps are sparse in the directory today.

### 3. DEV challenges + the repositioning story — cheapest ongoing
- DEV runs challenges continuously (monthly MLH × DEV writing challenge is
  always on; themed hackathons rotate).
- The story "we removed the camera, the streaks and the claims from our
  own wellness app" is publishable as-is and drives qualified traffic.

### 4. Product Hunt — for the Nov 30 MAU push
- "A little room to breathe" + honest positioning is PH-friendly; a
  middling launch still sends a few hundred users.
- Time it late November; seed with a DEV post first.

### 5. Chrome Web Store new-tab / break-reminder extension
- Google's "Mindful Break" proved demand and no longer exists.
- Wrapping the existing web app as a new-tab experience is days of work
  for a persistent install base.

### 6. Capacitor → App Store / Play — slow burn
- Already scaffolded; Android icons still need the purple mascot.
- Crowded category; an ASO play, not a November play.

## Skipped (with reasons)

- **Colosseum / crypto hackathons:** no onchain component. The only bridge
  is reviving the dormant proof-of-practice attestation infra, which
  contradicts the honest positioning (attesting to practice we can't
  verify is the old problem reintroduced).
- **Slack/Teams B2B:** real demand, but months of effort.
- **Most Devpost wellness hackathons:** students-only or closed
  (StartWell, Hack2Heal); GTransformer was the exception but costs $50.

## Sequence (free only)

1. **Now:** finish the MCP app — deploy the endpoint publicly (free tier),
   test in ChatGPT developer mode, then submit to the app directory
   (verified developer + privacy policy are the gates).
2. **Next:** DEV post telling the honest-repositioning story ("we removed
   the camera, the streaks and the claims from our own wellness app") —
   free, and seeds the Product Hunt launch.
3. **Near Nov 30:** Product Hunt launch for the MAU push.
4. **Later:** Chrome new-tab extension (one-time $5 store fee — owner's
   call); Capacitor stores are paid too, so they wait.
