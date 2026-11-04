# Distribution opportunities (2026-11-02)

Context: Anna Founding Builder Program needs ~200 MAU by 2026-11-30; store
browse alone won't get there. Meanwhile the web app and the Anna toolset are
the same product — "agent-friendly, not agentic" (see `docs/AGENTIC.md`).
For competitive research on companion apps (Shmoody, Finch, Voidpet), see
`docs/MASCOT-RESEARCH.md`.

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

## Live: AssemblyAI Voice Hackathon Week (ends Nov 7, 11:00 AM PT)

- "Hack into speech" — online, teams 1–4, **free** ($100 + $50 in TTS API
  credits), $2,000 across 20 winners (Visa gift cards). Original window
  Oct 15–23 paused for a TTS update; corrected dates Oct 27 – Nov 7.
- Submission: Google Form (forms.gle/XCW2RdZGbarVLnKEA). Extra points for
  using their agent builder and posting on LinkedIn/X tagging AssemblyAI.
- Our entry: **"Brume speaks"** — a voice layer so a reset works with
  eyes closed (their stated themes: in-app assistants that talk back,
  accessibility). Declare the pre-existing codebase honestly.
  Submission draft + video script: `docs/ASSEMBLYAI-ENTRY.md`.
- Architecture (two tiers, 2026-11-04):
  1. **Fixed cues** — pre-rendered WAVs via their TTS
     (`scripts/generate-voice.mjs` → `public/voice/`), spoken or
     breath-shaped, `speechSynthesis` fallback.
  2. **Spoken lines** — live TTS through `/api/tts`
     (primary: `POST /api/tts` on the Hetzner FastAPI service via
     `VITE_HETZNER_SERVICE_URL`; fallbacks: `netlify/functions/tts.mjs`
     on the relative path, vite middleware in dev; key stays
     server-side, 280-char cap, text never logged): the session
     greeting — one line from Brume's own side of the room on Begin — and
     "Hear it" on the Words Card reading your sentence back. Browser voice is the
     fallback; phase cues hold while a line speaks.

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
