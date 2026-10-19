# AGENTS.md

## Anna App (`anna/`) — the active product

Read `anna/README.md` first (layout, flows, testing tiers, release steps,
platform gotchas). Progress log and market/platform learnings:
`docs/ANNA.md` §12.

Verification (run from `anna/`, all free):

```bash
npm test                                         # node smoke + shared fixture
(cd executas/brume && python3 -m unittest test_plan)
anna-app validate --strict
```

Prompt changes: `node scripts/prompt-check.mjs all` (Featherless, needs
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
