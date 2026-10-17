# Dependencies & Toolchain

Current frontend/toolchain state as of **2026-10-17**. The frontend was
migrated to exact, pinned latest-compatible versions — no caret ranges or `latest`
tags in `package.json`, so the manifest is the audited target.

## Runtime requirements

- **Node.js `>=24.15.0 <25`** (`engines` in `package.json`, `.nvmrc` = `24`)
- **pnpm `12.14.0`** (`packageManager` field; `corepack enable` picks it up)

```bash
pnpm install --frozen-lockfile
pnpm dev    # http://localhost:4556
```

## Version policy

- All direct dependencies are **exact pins** resolved against npm `latest`
  at migration time. Upgrade deliberately, not via floating ranges.
- `pnpm-workspace.yaml` is tracked and enforces pnpm 12's default
  `minimumReleaseAge` gate. The only `minimumReleaseAgeExclude` entries are
  the two exact pins `eslint@10.13.0` and `lucide-react@1.58.0` — exact
  versions only, no wildcards. This migration did not use `--force` or
  `legacy-peer-deps` to bypass compatibility checks.
- The pnpm 12 lockfile is multi-document; always install with
  `--frozen-lockfile`.

## Intentional exceptions to "latest"

| Package | Pinned | Why |
|---|---|---|
| `typescript` | **6.0.3** | `typescript-eslint@8.71.2` peers `typescript >=4.8.4 <6.1.0`; TS 7.0.2 is outside that range |
| `zod` | **3.25.76** | `@lens-protocol/metadata@2.1.0` peers `zod ^3` |
| `@types/node` | **24.19.2** | matches the Node 24 runtime; `@types/node@26` tracks Node 26 |
| `@lens-protocol/client` | `0.0.0-canary-20250430134539` | npm `latest` still resolves to this canary — it is **not** a stable GA release |

## Current major versions

React/DOM **19.3.1** (+ `@types/react` 19.3.0, `react-is` 19.3.1 for the
recharts 3 peer), Vite **8.3.4** + `@vitejs/plugin-react` **6.1.2**,
Tailwind CSS **4.3.3** via `@tailwindcss/vite` with the legacy
`@config` seam (`tailwind.config.ts` still loads), Vitest **5.0.5**,
ESLint **10.13.0** + `typescript-eslint` 8.71.2, wagmi **3.7.7**
(`@wagmi/core` 3.6.5, `@wagmi/connectors` 8.2.0, `viem` 2.57.7),
React Router **7.18.4**, framer-motion **14.3.0**, recharts **3.10.1**,
sonner **2.0.8**, Sentry **11.8.0**, `@supabase/supabase-js` 2.118.0,
`@revenuecat/purchases-capacitor` **13.7.4**, Capacitor **8.5.3**.

**32 unused direct declarations were removed** from `package.json`
(including a direct `esbuild` entry — Vite may still use it transitively).

## Native (Android)

`android/` targets Capacitor 8 minimums: minSdk **24** (Android 7),
compile/target SDK **36**, AGP **8.13.0**, Gradle wrapper **8.14.3**,
Java **21**. `pnpm exec cap sync android` completed, but **no native
compile was run** — no JDK is available on the migration machine. There is
no tracked iOS project and none was created. This is not a release-ready
native claim.

## Backend

`backend/` (Python/FastAPI vision service) and the MCP server were **not**
touched: no requirements/security refresh, no Google GenAI or MediaPipe
migration. Those remain a separate pass and are **not verified here**.

## Feature status after migration

- Camera feedback is optional: JPEG frames go to the backend for MediaPipe
  landmark/movement estimates — **not** on-device processing and **not**
  breathing verification. The session preview currently auto-prompts for
  camera on mount (known issue, separate fix).
- "Try hands-free preview" on the session setup screen is a labeled
  **simulation** — no camera, no model, no live gesture detection yet.
- Post-session and share cards show recorded duration ("practice time") —
  no score, stillness, or verification marks. Credential minting is not
  exposed from the post-session flow; legacy Flow/Lens plumbing remains in
  the codebase but is not user-facing there.
- Pause/resume control fixed (paused check now wins over lifecycle
  `isActive`). **Known issue:** the on-screen session timer keeps counting
  wall-clock time while paused — do not treat displayed time as
  active-practice time.

## Verification status

Recorded during the migration (logs on the migration machine only, not
repo artifacts): unit tests pass (75-test baseline suite plus a later
focused 8-test run — overlapping, not additive); `tsc --noEmit
--skipLibCheck` clean; `eslint .` 0 errors / 176 warnings; production
build passes; `--frozen-lockfile` install coherent. Browser smoke covered
settled desktop/mobile home, sign-in page, camera-free session start, the
hands-free demo, and pause/resume button state. **Not covered:** signed-in
wallet transactions, purchases, live camera, full-routine E2E, native
builds. The `e2e/` Playwright fixtures predate current routes (e.g. login
vs `/auth`) and were not run.

Repeatable commands:

```bash
pnpm exec vitest run                          # unit tests
pnpm exec tsc --noEmit --skipLibCheck         # typecheck
pnpm exec eslint . --max-warnings=500         # lint (CI budget)
pnpm run build                                # production build
pnpm test:e2e                                 # playwright (stale fixtures)
```

Tests use Vitest + `react-dom`/`act` + jsdom; React Testing Library and
MSW are **not** installed — don't assume their APIs in new tests.
