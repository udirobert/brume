# Brume

> A calm companion for the two minutes between things. Nothing to get right, nothing to prove.

Brume (French: *mist*) is a guided breathing companion with a traveller's mascot in it. One question —
*How are you feeling?* — then a word, a rhythm, and two minutes of nothing but the breath and the
clock. Afterwards the moment can become one honest sentence, yours to keep, copy or drop. No camera,
no scores, no streaks, no account required.

**Live:** [brumeapp.netlify.app](https://brumeapp.netlify.app) · **Anna app:** `@papa/brume`

## One product, three faces

| Surface | Where it runs | State |
|---|---|---|
| **Web app** — `src/` | brumeapp.netlify.app | **live**, and the only surface the product is judged by right now |
| **Anna app** — `anna/` | inside the Anna agent, `@papa/brume` | current cut v0.4.12 carries the reviewer's rework request (`docs/ANNA.md` §12.40–12.41) |
| **MCP app** — `mcp/` | any MCP host (ChatGPT Apps SDK target) | built and tested, **not deployed** — held behind the retention bar in `docs/EXPERIMENTS.md` |

All three run one breathing-plan contract, `anna/bundle/plan.js`, which the Python executa in
`anna/executas/brume/` ports and `mcp/` imports directly. All three draw the same mascot —
`anna/bundle/mascot-engine.js` (frozen geometry + every motion, pure), `mascot.js` (the one DOM
adapter) and `mascot.css` (paint only).

They are not the same product in three wrappers, and that is deliberate. The web app is the practice.
The Anna app's primary result is a **preparation card for one conversation** — drafted by the host's
model, gated in the window so it cannot add a count, a day, a time, a name or an addressee the person
did not write — with a breathing break, Arrive and a one-minute alertness check behind it.

## Core loop

1. **One question, always the same one.** *How are you feeling?* Fourteen words, tapped — or said,
   and the nearest word offers itself for a tap. Voice never picks for you.
2. **A rhythm, not a library.** The word chooses the pattern; there is nothing to browse.
3. **The session.** The breath, the clock, and one glyph that cycles the sound
   (spoken → breath → quiet). Past 90 s the breath can end by itself — a tap resumes once.
4. **The landing.** A closed-set *"How is it now?"* and, optionally, one sentence you can read back,
   copy, or leave. Never a score, never a mark.

`/decompress` is a two-minute shoulder pause beside a pond. Two toys live behind quiet links —
`/decompress?room=firefly` and `/decompress?room=minute` — and neither writes anything to the ledger.

The four verbs are *breathe* (session), *touch* (the room answers a hand), *say* (the sentence),
*rest* (the landing). Nav is Home, Progress, Decompress, Profile — a fifth verb would replace one, and
a new surface has to be a state of the existing room, never a new route (`docs/EXPERIMENTS.md`).

## What Brume refuses, and where that is enforced

- **We do not sense you.** No camera. No continuous, ambient or biometric capture, and nothing
  inferred from a signal. The one exception is bounded and shipped: the check-in microphone listens
  for one sentence per press, matches it against the fourteen words and drops it — nothing recorded,
  no transcript in the ledger or in `track()`, and voice only ever *proposes*. GDPR-shaped help for a
  stuck mic lives in a closed table, not a generated apology.
- **No scores, no streaks, no tiers.** `src/lib/__tests__/no-streaks.test.ts` walks the source and
  fails on the comeback.
- **No health, medical, hormone or outcome claims** — in copy, prompts or Anna's plan validation.
  `copy-claims.test.ts` checks the strings; `HEALTH_CLAIM_RE` and `CUE_FORBIDDEN_RE` in `plan.js`
  check what a model sends.
- **No wallet, no chain.** Cut on 4 November 2026 (wallet, SIWE, Flow attestations, Lens, the
  subscription route). `no-wallet.test.ts` fails on an import of a chain library. Sign-in is an email
  and nothing else, and the web app sells nothing.
- **Your words stay where they were said.** `src/lib/checkinLedger.ts` is the spine: append-only,
  device-local `(t, feeling, reason, daypart)`. The only thing that leaves the device is eight named
  events through the same-origin counter in `src/lib/metrics.ts` — day numbers, seconds and closed-set
  ids, no device key. `PrivacyPolicy.tsx` names them, and its test reads the length of `WIRE`.

## Repository

```
brume/
├── src/                  web app (React 19, Vite 8, Tailwind 4)
│   ├── lib/              checkin ledger, metrics wire, voice, motion, feelings
│   ├── components/       atmosphere, checkin, companion, navigation, roomplay
│   └── pages/            Home, Onboarding, Session, Decompress, PostSession, Progress, Profile
├── anna/                 the Anna app
│   ├── bundle/           plan.js + preparation.js (the two contracts), mascot, brand
│   ├── executas/brume/   the Python executa + manifest + fixtures
│   └── skills/           the reset-offer skill
├── mcp/                  MCP server + worker + inlined mascot widget
├── backend/vision-service/   FastAPI voice service on Hetzner (TTS/STT + the guard)
├── netlify/functions/    the TTS proxy and the anonymous metrics counter
├── docs/                 living docs first, history clearly marked
└── android/, capacitor.config.ts   the Capacitor shell (not the web product)
```

## Development

Node **24** (`>=24.15.0 <25`, see `.nvmrc`) and pnpm **10.33.2** (`corepack enable` reads
`packageManager`).

```bash
pnpm install --frozen-lockfile
pnpm dev        # http://localhost:4556
```

The lockfile is multi-document and `pnpm-workspace.yaml` applies pnpm's `minimumReleaseAge` gate, with
exact-pin exceptions only for the two latest-audited releases. Always install with
`--frozen-lockfile`.

Copy `.env.example` to `.env.local`. Guest use needs only the publishable Supabase URL and anon key.
Everything that costs money or holds a secret — the AssemblyAI key, the voice guard, the metrics read
token — lives server-side and never carries a `VITE_` prefix; a bundled key is a published key.

## Verification

```bash
pnpm vitest run && npx tsc --noEmit && pnpm lint          # web app
(cd anna && npm test)                                     # Anna bundle smoke + shared fixture
(cd anna/executas/brume && python3 -m unittest test_plan)  # Python parity with plan.js
(cd anna && anna-app validate --strict)                    # app manifest
(cd mcp && npm test)                                       # MCP contract + embedded widget
(cd backend/vision-service && python3 -m unittest test_voice_guard)
```

Prompt changes get `node scripts/prompt-check.mjs all` from `anna/` (Gemini 3 Flash, no Anna quota
used). Real-LLM runs (`anna-app dev`, Cloud Agent chats) spend the Anna account quota, so they belong
to the release checklist, one new chat per step.

## Docs

Living, in the order they matter:

| Document | What it decides |
|---|---|
| [`AGENTS.md`](./AGENTS.md) | the rules, and the doctrine behind each cut — read this one first |
| [`docs/EXPERIMENTS.md`](./docs/EXPERIMENTS.md) | product shape, the experiments, the bar for going live |
| [`docs/ANNA.md`](./docs/ANNA.md) | Anna program rules, progress log, review outcomes (§12) |
| [`docs/MCP-APP.md`](./docs/MCP-APP.md) · [`docs/AGENTIC.md`](./docs/AGENTIC.md) | the MCP app, and why the web app is agent-*friendly* rather than agentic |
| [`docs/DISTRIBUTION.md`](./docs/DISTRIBUTION.md) | channels, ranked, with what was declined and why |
| [`docs/DEVELOPMENT.md`](./docs/DEVELOPMENT.md) · [`docs/TESTING.md`](./docs/TESTING.md) | setup and the testing tiers |
| [`docs/BRUME.md`](./docs/BRUME.md) | the product brief |

History, kept rather than rewritten: [`docs/STRATEGY.md`](./docs/STRATEGY.md) (the camera-verification
thesis, superseded), [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) and [`docs/API.md`](./docs/API.md)
(the chain-era design). Read those three as the record of what Brume was, not as the app.

## Privacy, in one paragraph

Session history and check-in words stay on your device; signed-in sessions also live in your own
Supabase rows. The microphone is opened per press, sends one sentence to AssemblyAI to become words,
and stores nothing. Spoken lines are whole lines from a closed table — the words going to the voice
service are always Brume's, never yours. The counter receives eight anonymous events as daily
aggregates and cannot name a person. There is no advertising, no analytics provider, and nothing for
sale. Read `src/pages/PrivacyPolicy.tsx` (it is pinned by a test) rather than this paragraph.

## License

MIT — see [LICENSE](./LICENSE).
