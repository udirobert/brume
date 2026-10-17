# brume — Executa plugin

Chat-native guided Reset for the Brume Anna App. A stdio JSON-RPC 2.0
Executa plugin, stdlib-only Python (3.10+), no dependencies.

- `brume_reset` — returns the full ~90s pacing script (4s in / 6s out,
  9 cycles) as verbatim `_display` blocks plus model-facing fields that
  point to `brume_complete`.
- `brume_complete` — writes a factual session record via plugin-side APS
  (`storage/set`, `scope: "user"`, keys `reset/sessions/<iso>` +
  `reset/last`, same namespace the iframe bundle uses) and asks the host
  for a closing line via `sampling/createMessage` (`llm.sample`).
  Degrades to a fixed line when sampling is unavailable; abandoned runs
  write nothing.

`tool_id` is `tool-dev-brume` (local dev identity from `executa.json` /
`[project.scripts]`); the app manifest references it under
`required_executas`.

## Run / smoke

```sh
# from anna/
anna-app dev --no-llm                      # auto-discovers executas/brume
anna-app executa dev --dir executas/brume --describe
anna-app executa dev --dir executas/brume \
  --mock-sampling executas/brume/sampling-fixture.jsonl \
  --invoke brume_complete                  # exercises both reverse RPCs

# raw protocol:
echo '{"jsonrpc":"2.0","method":"describe","id":1}' \
  | uv run --project executas/brume tool-dev-brume
```
