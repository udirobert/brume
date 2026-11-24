# Consolidation Registry — Brume v1

> **Status: partly historical.** Written for the v1 cut, when the surfaces were
> Flow/Lens/NFT features. Those are gone (2026-11-04) and the registry below is
> the record of how they went. The principle at the top — *delete, don't bury* —
> is still how this repo prefers to remove things, so read the method, not the
> inventory.

> Companion to `docs/STRATEGY.md` and `docs/BRUME.md`. Principle (updated in the
> dead-code sweep): **delete, don't bury** — git history preserves everything, and
> unreferenced code rots into type/lint noise. The v1 "bury, don't delete" stance
> was superseded once the surfaces were confirmed unreachable.
> Registry last updated: consolidation round 5 (Shipaton sprint — UX collapse + dead code + Web3 lazy-load).

## Consolidation Round 5 — Shipaton UX collapse + dead code + Web3 lazy-load

**37 files changed, 603 insertions, 8,169 deletions.** Main bundle: 2,777 kB → 1,837 kB (34% smaller). Build: 8,972 → 8,920 modules.

### UX collapse (product design)

- **Onboarding:** 4 marketing slides → 1 screen with mist orb + "Begin" → direct session. Account creation deferred to after the magic moment.
- **Home:** 3-layer flow (state chips → ContextCard → Start button) → 1-tap entry. State chip navigates directly to session with recommendation reason as router state. Feature cards and dual CTAs removed.
- **Session:** 3 modes (classic/enhanced/mobile) → 1. Camera permission asked in-session; orb shows verified vs unverified visually. No mode picker.
- **Post-session:** 1,162-line `Results.tsx` dashboard → 80-line `PostSession.tsx`. Score + proof card + share. No tabs, no agent traces, no streaming indicators.
- **BreathingAnimation:** Flat blue circle → 3-layer volumetric mist orb (halo + cloud + core, progressive blur). Breath signal from `useStableMetrics` drives glow (confidence), opacity (verified vs unverified), shiver (restlessness during holds), color (blue→amber), and a pulsing verification ring. Floating SessionHeader/SessionFooter bars replaced by minimal 10px corner overlay.
- **Proof card:** Canvas-rendered 1080×1920 shareable image via Web Share API. Replaces text-only share. Designed card with mist visual language, verification seal, score, stats.
- **Header:** 324 lines → 92 lines. Killed mobile sheet menu, WalletManager, OfflineIndicator, community links. Logo + 3 links + auth state.
- **Footer:** Deleted (98 lines). Privacy/terms links live in profile.

### Dead code deleted (22 files, ~7,200 lines)

**Results chain (12 files):** `Results.tsx`, `SessionCompleteModal.tsx`, `PostSessionActions.tsx`, `EnhancedAIAnalysisDisplay.tsx`, `StreamingIndicator.tsx`, `AgentTrace.tsx`, `AIAnalysisErrorBoundary.tsx`, `PatternSelection.tsx`, `MoodBasedRecommendations.tsx`, `ContextCollector.tsx`, `RecommendationCard.tsx`, `PatternSelectionPage.tsx`

**Social chain (6 files):** `CommunityFeed.tsx`, `BreathingSessionPost.tsx`, `SocialActions.tsx`, `SocialButton.tsx`, `Leaderboard.tsx`, `LeaderboardService.ts`

**Infrastructure (4 files):** `Footer.tsx`, `use-toast.ts`, `ui/toast.tsx`, `ui/use-toast.ts`, `CameraContext.tsx`

### Infrastructure consolidation

- **Dual toast system → one.** Deleted `use-toast` hook (191 lines) + `ui/toast.tsx` (127 lines). All toast calls now use `sonner`. `ConnectWalletButton` migrated.
- **CameraContext → cameraStore.** Deleted `CameraContext.tsx` (47 lines). All consumers now call `useCameraStore()` directly. Removed `CameraProvider` from App.
- **Web3 lazy-loaded.** `EagerWeb3Provider` (836 kB chunk: wagmi + ConnectKit + QueryClient + WalletProvider) was eagerly loaded on every page. Now lazy-loaded and wraps only `/profile` and `/subscription` routes. Session, home, onboarding, and post-session screens load with zero Web3 overhead.

### Route set after round 5

| Route | Screen | Web3? |
|-------|--------|-------|
| `/` | Home — headline + state chips → one tap to session | No |
| `/onboarding` | Mist orb + "Begin" | No |
| `/session` | Camera permission → mist orb → breathe | No |
| `/post-session` | Score + proof card + share | No |
| `/progress` | Streak trail (pending redesign) | No |
| `/profile` | Settings, wallet, subscription | **Yes** |
| `/subscription` | Paywall | **Yes** |
| `/auth` | Sign in / sign up | No |

**Removed routes:** `/results`, `/patterns`, `/community`, `/leaderboard`, `/settings` — all redirect to `/` or `/profile`.

### Empty directories removed

`src/components/unified/`, `src/components/social/`, `src/components/context/`, `src/components/recommendations/`, `src/components/error/`, `src/services/social/`

## Consolidation Round 4 — final pass (branch `feat/consolidation-final`)

Closes the two remaining items from the "next passes" list plus the stale
known-inconsistency note.

- **Copy sweep completed.** `UserProfile` no longer displays Lens identity or
  social-graph stats ("Lens Protocol Stats" / "No Lens Profile Found" cards,
  @handle + follow button). Lens survives as quiet infrastructure: wallets are
  still disconnected on sign-out, nothing chain-forward is shown. The Lens card
  is replaced by a "Verified Practice" card pointing at `/progress`. Dead
  "Creator Verified" stat row removed (creator economy is buried). `Index` hero
  rebrand shipped in PR #12. `Settings` was already clean.
- **Debug audit resolved.**
  - `AIAnalysisDebugButton` + `src/debug/ai-analysis-debug.ts` **deleted** —
    explicitly marked "TEMPORARY … Remove after debugging" and rendered
    unconditionally on `/results`.
  - `DeveloperTools` + `SystemHealthMonitor` **kept** — already env-gated
    behind `development.debugMode` (`VITE_DEBUG_MODE === "true"`, off in prod)
    in `MainLayout`, which is the intended prod posture.
  - `src/components/integration/` and `src/pages/api/` confirmed already gone
    (removed in round 3).
- **Known-inconsistency #5 closed.** `MobileBottomNav` was deleted in round 2;
  the single `BottomTabBar` uses `/session`. `SessionEntryPoints` offering
  `/session/classic` vs `/session/enhanced` mode cards is the intended entry.

With round 4 the consolidation registry has **no open passes**. Future cleanup
happens file-by-file under the nav-discipline and delete-don't-bury rules.

## Consolidation Round 3 — dead-code deletion (branch `feat/consolidation-ux`)

The buried surfaces from v1 (and every module they orphaned) were **deleted** after
reachability analysis confirmed zero importers from `main.tsx`. Verified by
`tsc` (0 errors), `eslint` (0 errors), `vitest` (39/39) and `pnpm build` (✓).

- **110 files / ~21.6k lines removed** — buried pages (marketplace, creator tools,
  instructor onboarding, Lens hub), their dedicated components/types, plus orphaned
  hooks, libs, stores, providers and API routes.
- **Kept:** `components/ui/` (shadcn kit = design-system baseline), `*.d.ts`
  ambient declarations, and all `__tests__/` + `*.test.ts` suites (vitest
  discovers tests by glob, so "no importer" is expected, not a dead signal).
- The old v1 "buried" table below is retained for history; the files it lists are
  now **gone** from the working tree (recoverable from git history).

| Surface | Was buried at | Now |
|---|---|---|
| Marketplace | `src/pages/EnhancedMarketplace.tsx`, `src/components/marketplace/`, `src/types/marketplace.ts` | **deleted** |
| Creator tools | `src/pages/CreatePattern.tsx`, `src/components/creator/`, `src/pages/EnhancedCreatorDashboard.tsx`, `src/types/creator.ts` | **deleted** |
| Instructor onboarding | `src/pages/InstructorOnboarding.tsx` | **deleted** |
| Lens social hub | `src/pages/LensSocialHubPage.tsx`, `src/pages/LensSocialFlowPage.tsx`, `src/components/lens/LensSocialHub.tsx` | **deleted** |
| Social composer | `src/components/social/ResponsiveSocialCreate.tsx` | deleted in CI pass |

**What was deliberately NOT deleted** (verified live): `sessionStore`, `visionStore`,
`useSession`, `Results`-subtree (`PostSessionActions`, `InlineUpgrade`,
`useSecureAIAnalysis`, `SessionCompleteModal`), `TodayCard`, `VideoFeed`,
`BreathingAnimation`, `FaceMeshOverlay`, supabase client, `lib/lens`,
`lib/sharing`, `cameraStore`, `authStore`.

## Buried (unrouted Aug 27, branch `feat/brume`) — historical record

| Surface | Files still on disk | Why buried |
|---|---|---|
| Marketplace (`/marketplace`) | `src/pages/EnhancedMarketplace.tsx`, `src/components/marketplace/`, `src/types/marketplace.ts` | Sunk cost; cold-start liquidity, no 10x (STRATEGY §6) |
| Creator tools (`/create`) | `src/pages/CreatePattern.tsx`, `src/components/creator/`, `src/pages/EnhancedCreatorDashboard.tsx` | Creator economy depends on marketplace |
| Instructor onboarding (`/instructor-onboarding`) | `src/pages/InstructorOnboarding.tsx` | Wedge A deferred — agents pay first (STRATEGY §4) |
| Lens social hub (`/lens`, `/lens/flow`) | `src/pages/LensSocialHubPage.tsx`, `src/pages/LensSocialFlowPage.tsx`, `src/components/lens/` | Lens survives as quiet attestation infra, not a destination |
| Social posting (`/create-post`) | `src/components/social/ResponsiveSocialCreate.tsx` | Sharing happens via post-session credential cards, not a composer |
| Duplicate route (`/enhanced`) | — (was aliasing `Index`) | Dead weight |

**Note for judges/reviewers:** buried files may still reference each other; they're excluded
from the route tree and nav. Full deletion is a post-Shipaton decision once attestations prove
out (marketplace resurrection requires density we don't have).

## Kept (the v1 spine — updated round 5)

- **Core loop:** `Index` (home) → `SessionModeWrapper` → `PostSession` (proof card + share) → `Progress` (streaks)
- **Money:** `Subscription` (Brume Premium paywall, `brume_premium` entitlement)
- **Trust/legal:** `Auth`, `Onboarding`, `PrivacyPolicy`, `TermsOfService`, `UserProfile`
- **Mobile nav:** Home / Session / Profile — unchanged

## UI/UX consolidation notes

1. **One voice.** Brand copy reads "Brume — progress you can prove" everywhere
   user-facing (index.html, Header, Onboarding, Index hero as of PR #12,
   UserProfile as of round 4). Sweep complete.
2. **One palette.** `index.css` root tokens → mist family (h≈204), matching the `brume` Tailwind scale. The old teal primary (180°) and peach accent (25°) are gone from the base theme; page-level gradients (e.g. Subscription's purple/blue) are being normalized as files are touched.
3. **One promise per screen.** Camera permission = "let Brume see your breath" (not "enable biometrics"). NFT → "verified record of practice" everywhere user-facing.
4. **Nav discipline rule going forward:** adding a nav item requires removing one — the Header's desktop row is capped at Practice / Progress / Community / Profile.
5. **Known inconsistency (resolved in round 4):** `MobileBottomNav` was
   deleted in round 2; the single `BottomTabBar` links `/session`.

## Next consolidation passes (post-release)

**None open.** All listed passes completed:

- ~~Dead-code deletion sweep~~ → round 3 (110 files / ~21.6k lines)
- ~~`src/components/{debug,developer,monitoring,integration}` audit~~ → round 4
  (debug button deleted; developer/monitoring kept, env-gated; integration gone)
- ~~`src/pages/api/`~~ → confirmed gone in round 4 (deleted in round 3)

---

## Consolidation Round 2 — UI/UX & page consolidation (branch `feat/consolidation-ux`)

**Principle applied: fold destinations toward the 6-screen core loop; keep the files, stop separate routes.**

| Move | Before | After |
|---|---|---|
| **Mobile nav dedup** | `MobileBottomNav` (global in `App.tsx`) **and** `BottomTabBar` (inside `ResponsiveNavigation`) both rendered on touch → **two stacked bars** | Removed global `MobileBottomNav.tsx`; the single context-aware `BottomTabBar` (from `ResponsiveNavigation`) is the only mobile bottom nav. |
| **Community + Leaderboard** | Separate `/community` and `/leaderboard` pages | `Leaderboard` folded into `/community` sidebar; `/leaderboard` redirects → `/community`. One accountability door. |
| **Profile + Settings** | Separate `/profile` and `/settings` pages | Settings (theme, privacy/terms, sign out) hosted inline inside `/profile`; `/settings` redirects → `/profile`. `Settings.tsx` kept on disk (buried), removed dead Marketplace/Share buttons. |
| **Session entry unify** | Nav + "Start Again"/"Start Now" pointed directly at `/session/classic` | All practice/repeat CTAs and nav unify on `/session` entry (which still offers classic/enhanced mode cards). Resolves the v1 known-inconsistency note. |
| **Results → Progress** | Post-session screen ended at share/repeat actions | Added "See My Progress" CTA that closes the core loop: session → results → proof gallery. |

**Route set after round 2 (MainLayout):** `/`, `/session`, `/patterns`, `/session/:mode`, `/progress`, `/results`, `/community`, `/profile`, `/subscription` (+ `/settings` and `/leaderboard` kept as redirects so nothing breaks).

**Still buried (unchanged from v1):** marketplace, creator tools, instructor onboarding, Lens hub, social composer — files on disk, unrouted.
