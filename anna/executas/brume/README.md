# brume — Executa plugin

Chat-native guided Reset for the Brume Anna App. A stdio JSON-RPC 2.0
Executa plugin, stdlib-only Python (3.10+), no dependencies.

- `brume_reset` — plans (via `sampling/createMessage` + a `storage/get`
  of `reset/summary` for "what has worked" personalization) and returns
  the pacing script as verbatim `_display` blocks plus the plan fields.
  Optional args:
  - `context` — what the user said they are doing or about to do;
    drives the AI plan. Without it (or on any sampling failure) the
    plan falls back to deterministic keyword rules.
  - `pattern` — one of `cyclic-sigh` | `long-exhale` | `box` | `steady`;
    an explicit choice skips the model entirely.
  - `pace` — `"slow"` (1.25×), `"normal"` (1×, default), `"fast"`
    (0.8×), a tempo factor applied to every phase. A mid-break pace
    change is a re-invocation — continuations keep the first segment's
    pattern unless `pattern` is given.
  - `remaining_seconds` — delivers only roughly that many more seconds
    (partial cycles allowed, ≥1 cycle), so a re-invoked script covers
    just the un-delivered remainder.
  - `cycles` — legacy override; by default cycles derive from the
    planned length (60/90/120/180 s).
  Each invoke appends a segment `{pace, pattern, plan, cycles, seconds}`
  so the record reflects what was actually delivered; re-invoked
  scripts are framed as continuations ("continuing at a slower pace").
- `brume_complete` — optional `felt` (`calmer`|`same`|`wired`) check-in;
  writes the factual session record via plugin-side APS (`storage/set`,
  `scope: "user"`, keys `reset/sessions/<iso>` + `reset/last` +
  `reset/summary`, same namespace the iframe bundle uses) and asks the
  host for a reflection line via `sampling/createMessage` (`llm.sample`)
  with the same prompt contract as the bundle. Degrades to a fixed line
  when sampling is unavailable; abandoned runs write nothing.

The plan contract (prompt, JSON extraction, validation caps, fallback
rules, summary shape) is a 1:1 port of `anna/bundle/plan.js`; both are
tested against `anna/test/plan-cases.json` (`npm test` and
`python3 -m unittest test_plan`).

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
