# brume — Executa plugin

Chat-native Brume tools for the Brume Anna App. A
stdio JSON-RPC 2.0 Executa plugin, stdlib-only Python (3.10+), no
dependencies.

**The calling model writes the AI text.** Anna's own model plans
the optional break and writes the reflection, passing them as tool
arguments; the plugin validates and filters them (same caps,
`HEALTH_CLAIM_RE` and `CUE_FORBIDDEN_RE` as the bundle) and renders verbatim
`_display` blocks. The plugin makes **no** `sampling/createMessage` calls
and declares no `llm.sample`: on Anna that capability is off after install
and nothing in the chat flow asks the user to enable it (found on the
Cloud Agent, 2026-10-19). `host_capabilities` = `aps.kv`,
`aps.scope.user.read`, `aps.scope.user.write` (must normalize to the app
manifest's `storage` block, or publish fails with "storage declaration
drift").

- `brume_prepare` — Brume's primary result: it relays the situation
  and opens the window where the card is made. One call.
  - `situation` (required: the model's relay of the user's words),
    optional `goal`, `key_point`, `preserve` — nothing else. There are
    deliberately no draft parameters: every argument is model-written
    and the protocol offers no transcript, so the tool cannot carry
    card content. Returns `open_window` with an `open_app_view`
    payload (`mode: "ready"`, `context`, optional `goal`/`key_point`/
    `preserve`).
  - The window shows the relay as a masked suggestion
    (`maskReference` — facts and names hidden), the person writes the
    situation in their own words, and the card is drafted from that
    text by the window's own model call under the faithfulness gate,
    then saved to `ready/sessions/<iso>` and `ready/last`. The card's
    content is model-composed in the window from the person's words —
    an `llm.complete` run, not a storage write of typed text.
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

**Why the card is made in the window.** Every tool argument is
written by the calling model, and the protocol offers the plugin no
transcript, so nothing the tool receives can be the card's source —
not the relay, not a draft, not an `answers` parameter (the earlier
two-step design let the model answer its own questions, and masked-
fact substitution still left the model's sentences: "Tell Priya you
manage …" + "three" keeps Priya). And a card the window saves from
typed text alone is a storage write, not a qualified run — the
primary value has to come from the model's reasoning. So the tool only
relays and opens the window; there the person writes the situation in
their own words and the window's own `llm.complete` drafts the card
from it under the faithfulness gate — the same pipeline as the in-app
Prepare button. The relay is shown only masked (`maskReference`), so
invented facts and names cannot sit on the review screen.

The window's fact scanner (`scanFacts` / `ungroundedSpans` /
`faithfulnessIssues`) is the contract that gates the model's draft
against the person's typed source; the plugin no longer ports it.

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
python3 executas/brume/scripts/smoke_binary.py <binary> <version>  # describe, health, reset, complete, prepare

# raw protocol:
echo '{"jsonrpc":"2.0","method":"describe","id":1}' \
  | uv run --project executas/brume tool-papa-brume-htcxvfcr
```
