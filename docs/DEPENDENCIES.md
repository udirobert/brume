# Dependencies & Toolchain

Current frontend/toolchain state as of **2026-11-24**. The frontend was
migrated to exact, pinned latest-compatible versions on 2026-10-17 — no caret
ranges or `latest` tags in `package.json`, so the manifest is the audited
target. `package.json` is always the source of truth; this page explains the
choices behind it.

> **The chain era is gone (2026-11-05).** `@onflow/*`, `viem`, `@lens-*`,
> `wagmi`'s consumers, `src/lib/crypto`, `src/lib/ai`, `src/lib/sharing`,
> `cadence/` and `flow.json` were removed. `lucide-react`, `next-themes` and
> `recharts` went with them. One leftover remains: **`wagmi@3.7.7` is still
> declared in `package.json` and imported nowhere in `src/`** — the guard in
> `src/lib/__tests__/no-wallet.test.ts` names it as forbidden. Dropping the
> declaration is a small, safe tidy-up that nobody has done yet; until then it
> installs without being used.

## Runtime requirements

- **Node.js `>=24.15.0 <25`** (`engines` in `package.json`, `.nvmrc` = `24`)
- **pnpm `10.33.2`** (`packageManager` field; `corepack enable` picks it up,
  and `netlify.toml` pins the same value for builds)

```bash
pnpm install --frozen-lockfile
pnpm dev    # http://localhost:4556
```

## Version policy

- All direct dependencies are **exact pins** resolved against npm `latest`
  at migration time. Upgrade deliberately, not via floating ranges.
- `pnpm-workspace.yaml` is tracked and applies pnpm's `minimumReleaseAge`
  gate to every package. The only `minimumReleaseAgeExclude` entries are the
  two exact pins `eslint@10.13.0` and `lucide-react@1.58.0` — exact versions
  only, no wildcards. (`lucide-react` is no longer a dependency; its entry is
  harmless and can be retired with the next lockfile change.)
- The lockfile is multi-document; always install with `--frozen-lockfile`.

## Intentional exceptions to "latest"

| Package | Pinned | Why |
|---|---|---|
| `typescript` | **6.0.3** | `typescript-eslint@8.71.2` peers `typescript >=4.8.4 <6.1.0`; TS 7.0.2 is outside that range |
| `@types/node` | **24.19.2** | matches the Node 24 runtime; `@types/node@26` tracks Node 26 |
| `zod` | **3.25.76** | pinned for `@lens-protocol/metadata`'s `zod ^3` peer — a reason that left with the chain cut. Now an upgrade candidate, not a constraint |

## Current major versions

React/DOM **19.3.1** (+ `@types/react` 19.3.0), Vite **8.3.4** +
`@vitejs/plugin-react` **6.1.2**, Tailwind CSS **4.3.3** via
`@tailwindcss/vite` with the legacy `@config` seam (`tailwind.config.ts` still
loads), Vitest **5.0.5**, ESLint **10.13.0** + `typescript-eslint` 8.71.2,
React Router **7.18.4**, framer-motion **14.3.0**, sonner **2.0.8**, Sentry
**11.8.0**, `@supabase/supabase-js` 2.118.0, `onesignal-cordova-plugin`
**5.6.1**, `@revenuecat/purchases-capacitor` **13.7.4**, Capacitor **8.5.3**,
Playwright **1.64.1** (browser QA).

**32 unused direct declarations were removed** from `package.json` at the
migration (including a direct `esbuild` entry — Vite may still use it
transitively).

## Native (Android)

`android/` targets Capacitor 8 minimums: minSdk **24** (Android 7),
compile/target SDK **36**, AGP **8.13.0**, Gradle wrapper **8.14.3**,
Java **21**. `pnpm exec cap sync android` completed, but **no native
compile was run** — no JDK is available on the migration machine. There is
no tracked iOS project and none was created. This is not a release-ready
native claim.

## Backend

Three separate toolchains, deliberately not one:

- **`backend/vision-service/`** — Python/FastAPI on Hetzner. Production voice
  talks to it: `/api/tts`, `/api/stt`, `/api/stt-token`, metered by
  `voice_guard.py`, `/health` public. The vision/AI-analysis endpoints still on
  that box belong to the earlier product; **the web app calls neither**. It has
  its own `requirements.txt`/Docker build and is not part of the root pnpm
  workspace.
- **`netlify/functions/`** — the TTS proxy and the anonymous metrics counter
  (Netlify Blobs, no credential to configure). Same request/response contract as
  the Hetzner service, so a build without `VITE_HETZNER_SERVICE_URL` degrades
  rather than breaks.
- **`mcp/`** — its own npm project (`mcp/package.json`, `npm test`), Node ESM,
  zero runtime dependencies; it imports `anna/bundle/plan.js` from outside its
  package on purpose.

No dependency refresh is claimed for any of them here.

## What the app does and does not do (2026-11-24)

- **No camera.** There is no camera path in `src/`: no `getUserMedia` for video,
  no vision request, no hands-free simulation. `getUserMedia` appears once, for
  **audio**, in `src/lib/voiceCheckin.ts`.
- **The microphone is one sentence per press.** It streams to AssemblyAI only
  while the press or the tap contract holds, matches the words against the
  fourteen-feeling catalog, offers the nearest chip and drops the transcript.
  Nothing is recorded; nothing reaches `checkinLedger.ts` or `track()`.
- **Practice time only.** Post-session and share cards report recorded duration.
  No score, no stillness, no verification mark, and no credential is minted or
  shown — the Flow/Lens plumbing is gone from the app entirely.
- **Pause/resume** runs on a monotonic active-time clock: duration, rhythm phase
  and cycle count all exclude paused wall-clock time (frozen-clock fixtures).
  The session shell sizes to `100dvh` so pause/breathe/end never slide behind a
  mobile browser bar.

## Verification

```bash
pnpm vitest run                    # unit tests (Vitest + jsdom, no RTL/MSW)
npx tsc --noEmit                   # typecheck
pnpm lint                          # eslint
pnpm run build                     # production build
(cd anna && npm test)              # Anna bundle smoke + shared fixture
(cd mcp && npm test)               # MCP contract + widget
```

Tests use Vitest with `react-dom`/`act` and jsdom; **React Testing Library and
MSW are not installed** — don't assume their APIs in new tests. The `e2e/`
Playwright fixtures predate the current routes (login vs `/auth`) and were not
run; browser QA lives in `anna/test/browser-qa.mjs` instead.

## Anna App (`anna/`)

`anna/` is a standalone **Anna App** project (see `docs/ANNA.md`): a
bundle-only static SPA (`manifest.json` schema 3 + `bundle/`) with its
own `package.json`/lockfile and `node_modules` — deliberately isolated
from the root pnpm toolchain; root `package.json`/`pnpm-lock.yaml` are
untouched. Toolchain: `npm i -g @anna-ai/cli` (needs Node 22+ and `uv`).

```bash
cd anna
anna-app validate --strict     # schema + host_api ACL checks
anna-app dev --no-llm          # local harness on :5180 (no PAT needed offline)
npm install && npm test        # mountBundle smoke test (node, not vitest)
```

`anna-app dev` requires `--no-llm` (or a `anna-app login` PAT; a canned
`llm.complete` can be served via `--mock-llm test/mock-llm.jsonl`) and the
harness storage backend is in-memory `runtime_state`. Verified locally
(2026-10-17): `validate --strict` passes; the harness served the bundle
and round-tripped a `scope:"user"` completion record via `storage.*`, and
session completion issues `anna.llm.complete` for the result's closing
line — the server-observable step that makes a run count as qualified
(forum-confirmed); the fixed fallback line shown on llm
denial/failure/timeout likely does not qualify.

`anna/executas/brume/` is a stdlib-only Python Executa plugin
(`brume_reset` + `brume_complete`, published `tool_id` `tool-papa-brume-htcxvfcr`,
auto-discovered by `anna-app dev`); run it with `uv run --project
`cd anna && anna-app executa dev --dir executas/brume --invoke
brume_reset`. CLI pinned at `@anna-ai/cli` 0.1.59 (app-schema 0.27.0) -
current as of the beta.186-190 changelog.
