# brume — Executa plugin

Chat-native Brume tools for the Brume Anna App (current version 0.4.2). A
stdio JSON-RPC 2.0 Executa plugin, stdlib-only Python (3.10+), no
dependencies.

**The calling model writes the AI text.** Anna's own model plans the break
and writes the reflection and get-ready copy, passing them as tool
arguments; the plugin validates and filters them (same caps,
`HEALTH_CLAIM_RE` and `CUE_FORBIDDEN_RE` as the bundle) and renders verbatim
`_display` blocks. The plugin makes **no** `sampling/createMessage` calls
and declares no `llm.sample`: on Anna that capability is off after install
and nothing in the chat flow asks the user to enable it (found on the
Cloud Agent, 2026-10-19). `host_capabilities` = `aps.kv`,
`aps.scope.user.read`, `aps.scope.user.write` (must normalize to the app
manifest's `storage` block, or publish fails with "storage declaration
drift").

- `brume_reset` — plan args from the model: `context`, `pattern`
  (`cyclic-sigh` | `long-exhale` | `box` | `steady`), `seconds`
  (60/90/120/180), `title`, `opening`, `cues` (posture/attention only),
  `why`. Valid → `planSource: "agent"`; missing/invalid pattern →
  deterministic keyword fallback (`planSource: "fallback"`). Also:
  - `pace` — `slow` (1.25×), `normal`, `fast` (0.8×); a mid-break pace
    change is a re-invocation and keeps the stored plan.
  - `remaining_seconds` — covers only the un-delivered remainder.
  - `cycles` — legacy; ignored when `seconds` is given. Sessions snap to
    whole cycles.
- `brume_complete` — `reflection` (written by the model; cleaned and
  filtered, fallback line if missing/blocked) and optional `felt`
  (`calmer`|`same`|`wired`). Writes `reset/sessions/<iso>`, `reset/last`
  and `reset/summary` (`scope: "user"`, shared with the window).
- `brume_get_ready` — `event` (required), `kind`, `opener`, `key_point`,
  `reminder`. Renders Breathe (7 cyclic-sigh lines) → Open up → Warm up
  your voice → Rehearse (opener, key point, reminder) → "You're ready. Go
  well." Writes `ready/sessions/<iso>`.

`manifest.json` here is the exported `describe` output; `anna-app apps
publish` syncs it as the protocol manifest (`test_plan.py` asserts it
equals `MANIFEST`). Regenerate it whenever `describe` changes.

The plan contract (validation caps, filters, fallback rules, cycle
snapping, summary shape) is a 1:1 port of `anna/bundle/plan.js`; both are
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
python3 executas/brume/scripts/smoke_binary.py <binary> <version>  # all 3 tools

# raw protocol:
echo '{"jsonrpc":"2.0","method":"describe","id":1}' \
  | uv run --project executas/brume tool-papa-brume-htcxvfcr
```
