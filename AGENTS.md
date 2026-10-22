# AGENTS.md

## Anna App (`anna/`) — the active product

Read `anna/README.md` first (layout, flows, testing tiers, release steps,
platform gotchas). Progress log and market/platform learnings:
`docs/ANNA.md` §12.

Brand: shared tokens + bundled Manrope live in `anna/bundle/brand.css`
and `anna/bundle/fonts/`; the web app `@import`s the same file and both
UIs share `--brume-*` daypart tokens. Browser QA: `npm run test:browser`
in `anna/` (fake host :4618, session brume-preparation-qa).

Verification (run from `anna/`, all free):

```bash
npm test                                         # node smoke + shared fixture
(cd executas/brume && python3 -m unittest test_plan)
anna-app validate --strict
```

Prompt changes: `node scripts/prompt-check.mjs all` (Gemini 3 Flash, the model Anna serves by default; needs
`anna/.env.local`; does not use Anna quota). Real-LLM `anna-app dev` and
Cloud Agent chats DO use the Anna account quota — keep them to the tier-3
release checklist, one new chat per step.

Rules:
- `bundle/plan.js` and `executas/brume/brume_plugin.py` share one contract;
  change both and cover it in `test/plan-cases.json`.
- After changing the plugin's `describe`, regenerate
  `executas/brume/manifest.json` and bump the version in `executa.json`,
  `pyproject.toml` and `VERSION`; binaries come from the
  "Brume Executa Binaries" GitHub workflow.
- No health, medical or hormone claims in copy or prompts; no scores,
  streaks, camera or microphone.
- `anna-app apps publish` uploads a new version (not a review submission);
  submitting for review is done by the owner in the Developer Console.

## Secrets

Never commit keys. Local secrets live in gitignored env files
(`anna/.env.local`, root `.env*`); `anna/.env.example` documents the
variables with empty values.

## Git / GitHub

The active `gh` account may be `sneldao`; for udirobert/brume use
`gh auth token --user udirobert` (don't switch the active account).

### Release candidate notes (local, unpublished)

- Conversation preparation replaced the old get-ready script:
  `bundle/preparation.js` + `bundle/preparation-prompts.js` (prompt text is
  maintained outside this change), strict JSON validation, one clarify + one rehearsal max.
- `bundle/recovery.js` checkpoints one active task to
  `brume/active-task` and validates per-flow data on load/save; reset and
  preparation restore their exact screen paused, a live alert test always
  restarts (partial timings are never kept).
- `session.js`: `unwrap` stays sync (ok:false throws, ok:true → result);
  storage call sites `await` the SDK promise; `saveCompletionRecord`
  dedupes summary folds by `completedAt`.
- Tests: `npm test` = smoke + `node --test test/preparation.mjs
  test/recovery.mjs`. Browser QA via `test/fake-host-server.mjs`
  (scripted llm, persistent KV) + agent-browser. Verified locally only —
  not published, no tier-3 run.
