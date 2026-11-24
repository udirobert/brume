# Development Guide

Setup, structure, and how to verify a change. What the product *is* lives in
[`../README.md`](../README.md) and [`../AGENTS.md`](../AGENTS.md); what it is
*allowed* to be lives in [`EXPERIMENTS.md`](./EXPERIMENTS.md).

> **Read the history section at the bottom as history.** This page used to
> document an AI-analysis roadmap, Flow/Lens wallet flows and camera
> verification. None of those exist in the app. The material is kept verbatim
> under "History" so the decisions stay legible, and everything above that line
> is current.

## Quick Start

**Node.js 24** (`>=24.15.0 <25`, `.nvmrc`) and **pnpm 10.33.2** (`corepack enable`
reads `packageManager`).

```bash
pnpm install --frozen-lockfile
pnpm dev          # opens http://localhost:4556
```

Guest use works with no backend at all. The voice needs either the Hetzner
service (`VITE_HETZNER_SERVICE_URL`) or the Netlify function, and falls back to
the browser's own voice and speech recognition when neither answers.

### Getting a change live

```bash
# The site — a push to main deploys Netlify (pnpm build, SPA fallback,
# /api/tts and /api/metrics redirected to functions)
git push origin main

# The Anna app — publish a version, then (owner only) submit for review
cd anna && anna-app apps publish

# The voice service — NOT deploy-hetzner.sh (root@ :22 times out and it
# re-provisions a shared box). The four-file scp route is written out in
# AGENTS.md, "Getting a change onto the box". Never docker-compose down.
```

`pnpm run deploy` is a status check, not a deploy. `pnpm run deploy:vision`
runs the stale provisioning script — don't.

The MCP app (`mcp/`) is deliberately undeployed; see [`MCP-APP.md`](./MCP-APP.md).

## Environment

Copy `.env.example` to `.env.local`. It documents every variable, the ones that
are deliberately absent, and why.

```bash
# .env.local — publishable values only; src/config/environment.ts validates these
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Server-side only, never with a `VITE_` prefix: `ASSEMBLYAI_API_KEY`,
`VOICE_SHARED_SECRET` (server half) with `VITE_VOICE_KEY` (build half),
`METRICS_READ_TOKEN`, `GITHUB_WEBHOOK_SECRET`. A `VITE_`-prefixed key is a
published key.

## Commands

```bash
pnpm dev                                  # dev server, :4556
pnpm run build                            # production build
pnpm run lint                             # eslint
npx tsc --noEmit                          # typecheck
pnpm test                                 # vitest run
pnpm exec vitest                          # watch mode

cd anna && npm test                       # bundle smoke + shared fixture
cd anna && anna-app validate --strict     # app manifest
cd anna/executas/brume && python3 -m unittest test_plan   # Python parity
cd mcp && npm test                        # MCP contract + widget
cd backend/vision-service && python3 -m unittest test_voice_guard
```

Browser QA: `cd anna && npm run test:browser` (fake host on :4618,
`agent-browser`, session `brume-preparation-qa`). Prompt changes:
`node scripts/prompt-check.mjs all` from `anna/` — Gemini 3 Flash, no Anna quota.

`pnpm test:e2e` runs Playwright, whose fixtures predate the current routes
(`login` vs `/auth`). Treat it as unrunnable until someone fixes it.

## Project structure

```
brume/
├── src/                        web app (React 19, Vite 8, Tailwind 4)
│   ├── components/             atmosphere, checkin, companion, navigation, roomplay
│   ├── lib/                    ledger, metrics wire, voice, motion, feelings, room
│   ├── pages/                  Home, Onboarding, Session, Decompress,
│   │                           PostSession, Progress, Profile, About, legal
│   ├── stores/                 session state (only what the API callers use)
│   └── styles/                 brume-controls.css, brume-checkin.css, brume-a11y.css
├── anna/                       the Anna app (own npm project, isolated on purpose)
│   ├── bundle/                 plan.js + preparation.js contracts, mascot, brand
│   ├── executas/brume/         Python executa, manifest, fixtures
│   ├── skills/                 the reset-offer skill
│   └── test/                   smoke, unit tests, browser QA
├── mcp/                        MCP server + worker + inlined widget (own npm project)
├── backend/vision-service/     FastAPI voice service (TTS/STT + guard)
├── netlify/functions/          TTS proxy, anonymous metrics counter
├── android/, capacitor.config.ts   Capacitor shell — not the web product
└── docs/                       living docs first, history marked
```

## Three contracts that must stay in sync

| Contract | Owners | Cover |
|---|---|---|
| `anna/bundle/plan.js` | Anna bundle, Python executa, MCP server | `anna/test/plan-cases.json` |
| `anna/bundle/preparation.js` | the Anna window (fact vocabulary, entity + role gates, masking) | `faithfulness`, `fact_scan`, `deadline_day`, `mask_reference` fixtures |
| `anna/bundle/mascot-engine.js` | Anna bundle, web `BrumeMascot`, MCP widget | `anna/test/mascot.mjs` |

Change one and you change all three, in one commit.

## Testing notes

Vitest with `react-dom`/`act` and jsdom. **React Testing Library and MSW are not
installed** — don't assume their APIs. The Anna bundle and `mcp/` use
`node --test`, not Vitest. See [`TESTING.md`](./TESTING.md) for the tiers.

## Contributing

1. Branch from `main`.
2. Make the change, and change the doc that would otherwise be wrong.
3. Run the commands above for the surfaces you touched.
4. Open a PR describing what you verified, not what you intended.

New copy must pass `copy-claims.test.ts` (no health/medical/hormone/outcome
claims, no scores or streaks); new events must be added to `src/lib/events.ts`,
`WIRE` in `src/lib/metrics.ts`, the Netlify function's `ALLOWED` map and
`PrivacyPolicy.tsx` in the same commit.

## Security

- Never commit keys. Local secrets live in gitignored env files
  (`anna/.env.local`, root `.env*`); `.env.example` documents the names with
  empty values.
- `pnpm run security` / `pnpm run security:secrets` run the existing checks.
- Report issues via GitHub Issues.

---

# History — the chain and vision era (2026-08 → 2026-11-04)

Kept verbatim from the previous version of this page. It describes a product that
required a camera, a wallet and an AI coach; all three were cut, and
`src/lib/__tests__/no-wallet.test.ts` keeps the wallet from coming back. For the
reasoning behind each cut, read [`../AGENTS.md`](../AGENTS.md) and
[`EXPERIMENTS.md`](./EXPERIMENTS.md) ("Cut"); for the design of that era,
[`ARCHITECTURE.md`](./ARCHITECTURE.md) and [`STRATEGY.md`](./STRATEGY.md).

## AI Analysis System Roadmap

> **Historical planning document** — describes the roadmap as originally
> designed, not validated current feature status. See
> [DEPENDENCIES.md](./DEPENDENCIES.md) for what's actually shipping.

### Phase 1: Enhanced Prompt Engineering (✅ Complete)

**Achievements:**
- ✅ Created sophisticated "Dr. Breathe" AI persona with expert knowledge
- ✅ Implemented data-driven prompts that reference specific session metrics
- ✅ Added pattern-specific expertise and scientific explanations
- ✅ Built comprehensive breathing pattern knowledge base

**Key Files:**
- `src/lib/ai/breathing-expertise.ts` - Comprehensive pattern knowledge
- `src/lib/ai/enhanced-prompts.ts` - Sophisticated prompt engineering
- `src/lib/ai/enhanced-analysis-service.ts` - Integration service
- `src/lib/ai/user-experience-assessment.ts` - Advanced user profiling
- `src/components/ai/EnhancedAIAnalysisDisplay.tsx` - Premium UI component

### Phase 2: Interactive Chat System (✅ Complete)

**Achievements:**
- ✅ Dr. Breathe persona system with warm, approachable AI coach personality
- ✅ Interactive chat interface integrated into analysis display
- ✅ Real-time conversation system with message history
- ✅ Usage limits & premium features with smart tracking
- ✅ Complete UI rebrand from "AI Analysis" to "Dr. Breathe"

### Phase 3: Adaptive Learning System (📋 Planned)

**Planned Features:**
- Advanced personalization with user profile learning
- Adaptive recommendation algorithms and goal-based coaching
- Premium features including real-time session guidance
- Advanced analytics dashboard and community coaching features

## Blockchain Implementation

### Real Blockchain Integration (✅ Complete)

**What Was Implemented:**
- ✅ Real Lens Protocol integration with official SDK (quiet infrastructure)
- ✅ Real Flow integration — `PracticeCredential` attestations with
  authorized-verifier co-signatures (credentials, not collectibles)
- ✅ User-friendly error messages and transaction monitoring
- ✅ Gas cost estimation and transaction status tracking

**Key Features:**
- **Lens Protocol**: Session signing infrastructure (social surfaces removed in consolidation)
- **Flow Blockchain**: User-initiated credential minting; the contract accepts
  only backend-co-signed attestations (see `docs/RUNBOOK.md` §8)
- **Error Handling**: User-friendly error translations and recovery
- **Transaction Monitoring**: Real-time status updates and gas estimates

### Testing Recommendations

#### Lens Protocol Testing
```typescript
// 1. Connect and authenticate
const { authenticateLens } = useBlockchainAuth();
await authenticateLens();

// 2. Share a session
const { shareBreathingSession } = useLens();
await shareBreathingSession(sessionData, score);

// 3. Create a post
const { createPost } = useLens();
await createPost("Test post content", ["breathing", "wellness"]);

// 4. Follow someone
const { followUser } = useLens();
await followUser("0x1234...");
```

#### Flow Testing
```typescript
// 1. Connect wallet
const { connect } = useFlow();
await connect();

// 2. Mint an NFT
const { mintBreathingPattern } = useFlow();
const txId = await mintBreathingPattern(attributes, metadata);

// 3. Monitor transaction
const { waitForTransaction } = useFlow();
await waitForTransaction(txId);
```

## User Testing Readiness

### Integration Rating: 8.5/10 ⭐⭐⭐⭐

**Strengths:**
- ✅ Real blockchain integration using official SDKs
- ✅ Unified architecture with single source of truth
- ✅ Proper error handling and session management
- ✅ Type safety and comprehensive testing coverage

**Areas for Improvement:**
- 🔧 Enhanced transaction status monitoring
- 🔧 User-friendly error message translations
- 🔧 Gas cost preview before transactions
- 🔧 Loading states and progress indicators

### Pre-User Testing Checklist

#### Critical (Must Have) 🔴
- [x] Transaction status tracking
- [x] User-friendly error messages
- [x] Loading states and progress indicators
- [x] Wallet connection UI

#### Important (Should Have) 🟡
- [x] Transaction history
- [x] Gas cost preview
- [x] Network status indicator
- [x] Retry logic for failed operations

### Testing Plan

#### Phase 1: Internal Testing (1-2 days)
**Lens Protocol Tests:**
1. Connect wallet → Authenticate → Create post
2. Follow/unfollow users
3. Load timeline with pagination
4. Load user profiles
5. Share breathing session

**Flow Blockchain Tests:**
1. Connect Flow wallet
2. Mint NFT (check on Flow testnet explorer)
3. Transfer NFT between accounts
4. Execute payment transaction
5. Check transaction status

#### Phase 2: Alpha Testing (3-5 days)
**Participants**: 5-10 internal users
**Focus**: Complete user flows and error scenarios

#### Phase 3: Beta Testing (1-2 weeks)
**Participants**: 50-100 external users
**Focus**: Real-world usage and performance under load

## Deployment Checklist

### Before User Testing
- [x] Set up testnet faucets for users
- [x] Create test accounts with tokens
- [x] Deploy to staging environment
- [x] Set up error monitoring (Sentry)
- [x] Configure analytics (PostHog/Mixpanel)
- [x] Create user testing guide
- [x] Set up feedback collection form
- [x] Prepare rollback plan

### Environment Variables
```env
# .env.testing
VITE_LENS_APP_ID=0xC75A89145d765c396fd75CbD16380Eb184Bd2ca7
VITE_LENS_ENVIRONMENT=testnet
VITE_FLOW_NETWORK=testnet
VITE_FLOW_ACCESS_NODE=https://rest-testnet.onflow.org
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_ERROR_REPORTING=true
```

## Success Metrics

### Technical Metrics
- Transaction success rate: >95%
- Average transaction time: <30 seconds
- Error rate: <5%
- Session persistence: >90%

### User Experience Metrics
- Task completion rate: >80%
- User satisfaction: >4/5
- Feature discovery: >70%
- Return rate: >60%

## Common Issues

### Build Fails
```bash
# Clear cache and reinstall
rm -rf node_modules dist .vite
npm install
npm run build
```

### Backend Connection Issues
```bash
# Check backend health
curl http://localhost:8001/health
# Should return: {"status": "healthy"}
```

### Camera Not Working
- Ensure HTTPS (required for camera access)
- Check browser permissions
- Try different browser

## Performance Optimization

### Caching Strategies
```typescript
// Session data caching
const cacheManager = {
  get: (key: string) => {
    const cached = localStorage.getItem(`cache:${key}`);
    if (cached) {
      const { data, expiry } = JSON.parse(cached);
      if (Date.now() < expiry) {
        return data;
      }
    }
    return null;
  },

  set: (key: string, data: any, ttlMinutes = 30) => {
    const cacheEntry = {
      data,
      expiry: Date.now() + (ttlMinutes * 60 * 1000)
    };
    localStorage.setItem(`cache:${key}`, JSON.stringify(cacheEntry));
  }
};
```

### Rate Limiting
```typescript
// Client-side rate limiting
const rateLimiter = {
  requests: new Map(),

  canMakeRequest: (endpoint: string): boolean => {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window
    const endpointRequests = rateLimiter.requests.get(endpoint) || [];

    // Clean old requests
    const recentRequests = endpointRequests.filter(time => time > windowStart);

    // Check limit (max 30 requests per minute)
    if (recentRequests.length >= 30) {
      return false;
    }

    // Record this request
    recentRequests.push(now);
    rateLimiter.requests.set(endpoint, recentRequests);
    return true;
  }
};
```

## Deployment Architecture

### API Service Deployment
```yaml
# docker-compose.yml
version: '3.8'
services:
  vision-api:
    build: ./backend/vision-service
    ports:
      - "8001:8001"
    environment:
      - ENV=production
      - MODEL_DOWNLOAD_ON_START=false
    restart: unless-stopped

  ai-service:
    build: ./backend/ai-service
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
    depends_on:
      - vision-api
```

### Health Monitoring
```typescript
// Health check implementation
const healthCheck = async () => {
  const checks = await Promise.all([
    checkVisionService(),
    checkAIService(),
    checkDatabase(),
    checkBlockchain()
  ]);

  return {
    status: checks.every(check => check.status === 'healthy') ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString()
  };
};
```

## Next Steps

### Week 1: Critical Fixes
1. ✅ Implement transaction status tracking
2. ✅ Add user-friendly error messages
3. ✅ Create wallet connection UI
4. ✅ Add loading states and progress indicators
5. ✅ Set up error monitoring

### Week 2: Testing & Refinement
1. ✅ Internal testing (all team members)
2. ✅ Fix critical bugs
3. ✅ Alpha testing (5-10 users)
4. ✅ Iterate based on feedback
5. ✅ Performance optimization

### Week 3: Beta Preparation
1. ✅ Beta testing (50-100 users)
2. ✅ Monitor metrics
3. ✅ Collect feedback
4. ✅ Final refinements
5. ✅ Prepare for production

## Resources

- [Lens Protocol Documentation](https://docs.lens.xyz/)
- [Flow Blockchain Documentation](https://developers.flow.com/)
- [FCL Documentation](https://developers.flow.com/tools/fcl-js)
- [Live Demo](https://brumeapp.netlify.app)