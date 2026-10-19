# brume — Executa plugin

Chat-native guided Reset for the Brume Anna App. A stdio JSON-RPC 2.0
Executa plugin, stdlib-only Python (3.10+), no dependencies.

- `brume_reset` — returns the full ~90s pacing script (4s in / 6s out,
  9 cycles) as verbatim `_display` blocks plus model-facing fields that
  point to `brume_complete`. Optional args:
  - `pace` — `"slow"` (5s in / 7s out), `"normal"` (4s in / 6s out,
    default), `"fast"` (3s in / 5s out). If the user asks to adjust pace
    mid-break, the agent re-invokes `brume_reset` with the new pace —
    re-invocation is the adaptation mechanism, no separate tool.
  - `remaining_seconds` — delivers only roughly that many more seconds
    (partial cycles allowed, ≥1 cycle), so a re-invoked script covers
    just the un-delivered remainder. Overrides `cycles`.
  - `cycles` — 3–12 (default 9) when `remaining_seconds` is not set.
  Each invoke appends a segment `{pace, cycles, seconds}` so the record
  reflects what was actually delivered; re-invoked scripts are framed as
  continuations ("continuing at a slower pace").
- `brume_complete` — writes a factual session record via plugin-side APS
  (`storage/set`, `scope: "user"`, keys `reset/sessions/<iso>` +
  `reset/last`, same namespace the iframe bundle uses) and asks the host
  for a closing line via `sampling/createMessage` (`llm.sample`).
  Degrades to a fixed line when sampling is unavailable; abandoned runs
  write nothing. Mixed-pace runs record `"pattern": "Reset · mixed pace"`
  with a `paces` list and per-segment detail.

`tool_id` is `tool-papa-brume-htcxvfcr` (identity in `.anna/executa.json`;
`executa.json` / `[project.scripts]` carry the same id). The app manifest
references it as `bundled:brume`, which `anna-app apps publish` resolves
against this directory.

## Distribution (binary installs)

`executa.json` declares `distribution.profiles`: `local` (run the Python
module in place — used by `anna-app dev`) and `binary` (default `active`;
prebuilt PyInstaller binaries so the plugin installs on hosts without
Python, e.g. Cloud Agents). `binary.binary_artifacts` maps each platform
to `dist/brume-{version}-<platform>.{tar.gz,zip}` — the archives are
uploaded directly by the CLI at publish (`binary_artifacts` = push, not
pull-mirror), with the executable at the archive root (`brume` /
`brume.exe`).

## Building the binaries

Run the **`Brume Executa Binaries`** workflow
(`.github/workflows/brume-executa-binaries.yml`, `workflow_dispatch`
only): a matrix job builds `pyinstaller --onefile` on
macos-14/macos-15-intel/ubuntu-22.04/windows-latest, smoke-tests each
binary (`scripts/smoke_binary.py` — describe → health → invoke → clean
exit on stdin close), and packages `brume-<version>-<platform>` archives
+ `.sha256`. A final job publishes all four to GitHub Release tag
`brume-executa-v<version>` (version is read from `executa.json`).

To ship a release: bump `version` in `executa.json` + `pyproject.toml` +
`VERSION` in `brume_plugin.py` together, run the workflow, download the
release assets into `anna/executas/brume/dist/` (gitignored), then
`anna-app apps publish` uploads them via `binary_artifacts`.

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
  | uv run --project executas/brume tool-papa-brume-htcxvfcr
```
